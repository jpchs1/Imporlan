<?php
/**
 * Conversation Memory Manager - Imporlan
 * Handles context retrieval, conversation history, and lead tracking for AI.
 */

class ConversationMemory {
    private $pdo;

    public function __construct() {
        $this->pdo = getDbConnection();
    }

    /**
     * Get or create a conversation for a WhatsApp phone number.
     */
    public function getOrCreateConversation(string $phone, string $contactName, string $waId, ?int $businessId = null): array {
        $phone = $this->normalizePhone($phone);

        // Look for existing open conversation
        $stmt = $this->pdo->prepare("
            SELECT c.*, ctx.lead_stage, ctx.lead_data, ctx.message_count,
                   ctx.ai_message_count, ctx.escalated_at, ctx.conversation_summary
            FROM chat_conversations c
            LEFT JOIN whatsapp_ai_context ctx ON ctx.conversation_id = c.id
            WHERE c.whatsapp_phone = ? AND c.status = 'open' AND c.channel = 'whatsapp'
            ORDER BY c.updated_at DESC LIMIT 1
        ");
        $stmt->execute([$phone]);
        $conv = $stmt->fetch(\PDO::FETCH_ASSOC);

        if ($conv) {
            return $conv;
        }

        // Create new conversation
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO chat_conversations
                (user_id, user_email, user_name, channel, whatsapp_phone, whatsapp_wa_id, status, business_id)
                VALUES (0, ?, ?, 'whatsapp', ?, ?, 'open', ?)
            ");
            $email = "wa_{$phone}@whatsapp.imporlan.cl";
            $stmt->execute([
                $email,
                $contactName ?: "WhatsApp $phone",
                $phone,
                $waId,
                $businessId
            ]);
            $conversationId = (int)$this->pdo->lastInsertId();

            $stmt = $this->pdo->prepare("
                INSERT INTO whatsapp_ai_context
                (conversation_id, whatsapp_phone, lead_stage, lead_data, message_count, business_id)
                VALUES (?, ?, 'nuevo', '{}', 0, ?)
            ");
            $stmt->execute([$conversationId, $phone, $businessId]);

            $this->pdo->commit();

            return [
                'id' => $conversationId,
                'user_email' => $email,
                'user_name' => $contactName ?: "WhatsApp $phone",
                'whatsapp_phone' => $phone,
                'channel' => 'whatsapp',
                'status' => 'open',
                'lead_stage' => 'nuevo',
                'lead_data' => '{}',
                'message_count' => 0,
                'ai_message_count' => 0,
                'escalated_at' => null,
                'conversation_summary' => null,
                'business_id' => $businessId,
            ];
        } catch (\PDOException $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Save an incoming user message.
     */
    public function saveUserMessage(int $conversationId, string $phone, string $name, string $message): int {
        $stmt = $this->pdo->prepare("
            INSERT INTO chat_messages (conversation_id, sender_id, sender_role, sender_name, sender_email, message)
            VALUES (?, 0, 'user', ?, ?, ?)
        ");
        $stmt->execute([$conversationId, $name, "wa_{$phone}@whatsapp.imporlan.cl", $message]);
        $messageId = (int)$this->pdo->lastInsertId();

        $this->pdo->prepare("
            UPDATE whatsapp_ai_context SET message_count = message_count + 1 WHERE conversation_id = ?
        ")->execute([$conversationId]);

        $this->pdo->prepare("
            UPDATE chat_conversations SET updated_at = NOW() WHERE id = ?
        ")->execute([$conversationId]);

        return $messageId;
    }

    /**
     * Save an AI response message.
     */
    public function saveAiMessage(int $conversationId, string $message): int {
        $stmt = $this->pdo->prepare("
            INSERT INTO chat_messages (conversation_id, sender_id, sender_role, sender_name, message)
            VALUES (?, 0, 'ai', 'Mariana - Imporlan', ?)
        ");
        $stmt->execute([$conversationId, $message]);
        $messageId = (int)$this->pdo->lastInsertId();

        $this->pdo->prepare("
            UPDATE whatsapp_ai_context SET ai_message_count = ai_message_count + 1 WHERE conversation_id = ?
        ")->execute([$conversationId]);

        return $messageId;
    }

    /**
     * Get recent conversation history formatted for Claude API.
     */
    public function getMessageHistory(int $conversationId, int $limit = 20): array {
        $stmt = $this->pdo->prepare("
            SELECT sender_role, sender_name, message, timestamp
            FROM chat_messages
            WHERE conversation_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        ");
        $stmt->execute([$conversationId, $limit]);
        $rows = array_reverse($stmt->fetchAll(\PDO::FETCH_ASSOC));

        $messages = [];
        foreach ($rows as $row) {
            $role = in_array($row['sender_role'], ['user']) ? 'user' : 'assistant';

            // Skip system messages from Claude history
            if ($row['sender_role'] === 'system') continue;

            // Group consecutive same-role messages
            if (!empty($messages) && end($messages)['role'] === $role) {
                $lastIdx = count($messages) - 1;
                $messages[$lastIdx]['content'] .= "\n" . $row['message'];
            } else {
                $messages[] = [
                    'role' => $role,
                    'content' => $row['message']
                ];
            }
        }

        return $messages;
    }

    /**
     * Get AI context for a conversation.
     */
    public function getContext(int $conversationId): ?array {
        $stmt = $this->pdo->prepare("
            SELECT * FROM whatsapp_ai_context WHERE conversation_id = ?
        ");
        $stmt->execute([$conversationId]);
        $ctx = $stmt->fetch(\PDO::FETCH_ASSOC);
        if ($ctx) {
            $ctx['lead_data'] = json_decode($ctx['lead_data'] ?? '{}', true);
        }
        return $ctx;
    }

    /**
     * Check if conversation is escalated to human.
     */
    public function isEscalated(int $conversationId): bool {
        $stmt = $this->pdo->prepare("
            SELECT escalated_at, assigned_to_id
            FROM chat_conversations c
            LEFT JOIN whatsapp_ai_context ctx ON ctx.conversation_id = c.id
            WHERE c.id = ?
        ");
        $stmt->execute([$conversationId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        return !empty($row['escalated_at']) || !empty($row['assigned_to_id']);
    }

    /**
     * Update conversation summary (for long conversations).
     */
    public function updateSummary(int $conversationId, string $summary): void {
        $this->pdo->prepare("
            UPDATE whatsapp_ai_context SET conversation_summary = ? WHERE conversation_id = ?
        ")->execute([$summary, $conversationId]);
    }

    private function normalizePhone(string $phone): string {
        $phone = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($phone) === 9 && $phone[0] === '9') {
            $phone = '56' . $phone;
        }
        return $phone;
    }
}
