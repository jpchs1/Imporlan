<?php
/**
 * Business Router - Multi-tenant WhatsApp AI
 *
 * Determines which business a message belongs to based on:
 * 1. Existing conversation context (returning customer)
 * 2. Keyword matching in the message
 * 3. Interactive menu selection (if ambiguous)
 *
 * Returns null if no business matches → message goes to owner directly (no AI).
 */

class BusinessRouter {
    private $pdo;
    private $businesses = null;

    public function __construct() {
        $this->pdo = getDbConnection();
    }

    /**
     * Detect which business should handle this message.
     *
     * @param string $phone     Sender's phone number
     * @param string $message   The message text
     * @param int|null $conversationId  Existing conversation ID (if any)
     * @return array|null  Business record or null if unrecognized
     */
    public function detectBusiness(string $phone, string $message, ?int $conversationId = null): ?array {
        // 1. Check if conversation already has a business assigned
        if ($conversationId) {
            $existing = $this->getBusinessFromConversation($conversationId);
            if ($existing) {
                return $existing;
            }
        }

        // 2. Check if this phone has a recent conversation with a known business
        $recent = $this->getBusinessFromRecentConversation($phone);
        if ($recent) {
            return $recent;
        }

        // 3. Try keyword matching
        $matched = $this->matchByKeywords($message);

        if (count($matched) === 1) {
            return $matched[0];
        }

        if (count($matched) > 1) {
            // Multiple matches — return first match (most keywords hit)
            // The AI will confirm in context
            return $matched[0];
        }

        // 4. Check if the message is a button/list reply from the business selection menu
        $menuMatch = $this->matchByMenuSelection($message);
        if ($menuMatch) {
            return $menuMatch;
        }

        // 5. No match found → return null (owner handles it)
        return null;
    }

    /**
     * Get the business selection menu to send when business can't be detected.
     * Returns WhatsApp interactive buttons payload data.
     */
    public function getBusinessSelectionMenu(): array {
        $businesses = $this->loadBusinesses();
        $buttons = [];
        foreach (array_slice($businesses, 0, 3) as $b) {
            $buttons[] = [
                'id' => 'biz_' . $b['slug'],
                'title' => $b['name']
            ];
        }

        return [
            'body' => "¡Hola! Este número atiende a varias empresas. ¿Con cuál necesitas hablar?",
            'buttons' => $buttons,
            'footer' => 'Elige una opcion para continuar'
        ];
    }

    /**
     * Check if this is a response to the business selection menu.
     */
    public function matchByMenuSelection(string $message): ?array {
        $lower = mb_strtolower(trim($message));
        $businesses = $this->loadBusinesses();

        foreach ($businesses as $b) {
            // Match button ID format "biz_slug" or the business name directly
            if ($lower === 'biz_' . $b['slug'] || mb_strtolower($b['name']) === $lower) {
                return $b;
            }
        }

        return null;
    }

    /**
     * Assign a business to a conversation.
     */
    public function assignBusiness(int $conversationId, int $businessId): void {
        try {
            $this->pdo->prepare("
                UPDATE whatsapp_ai_context SET business_id = ? WHERE conversation_id = ?
            ")->execute([$businessId, $conversationId]);

            $this->pdo->prepare("
                UPDATE chat_conversations SET business_id = ? WHERE id = ?
            ")->execute([$businessId, $conversationId]);
        } catch (\PDOException $e) {
            error_log("[BusinessRouter] Assign failed: " . $e->getMessage());
        }
    }

    /**
     * Get a business by its slug.
     */
    public function getBusinessBySlug(string $slug): ?array {
        $businesses = $this->loadBusinesses();
        foreach ($businesses as $b) {
            if ($b['slug'] === $slug) return $b;
        }
        return null;
    }

    /**
     * Get a business by its ID.
     */
    public function getBusinessById(int $id): ?array {
        $businesses = $this->loadBusinesses();
        foreach ($businesses as $b) {
            if ((int)$b['id'] === $id) return $b;
        }
        return null;
    }

    // --- Private helpers ---

    private function getBusinessFromConversation(int $conversationId): ?array {
        $stmt = $this->pdo->prepare("
            SELECT ctx.business_id FROM whatsapp_ai_context ctx
            WHERE ctx.conversation_id = ? AND ctx.business_id IS NOT NULL
        ");
        $stmt->execute([$conversationId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        if ($row && $row['business_id']) {
            return $this->getBusinessById((int)$row['business_id']);
        }
        return null;
    }

    private function getBusinessFromRecentConversation(string $phone): ?array {
        $phone = preg_replace('/[^0-9]/', '', $phone);
        $stmt = $this->pdo->prepare("
            SELECT ctx.business_id
            FROM chat_conversations c
            JOIN whatsapp_ai_context ctx ON ctx.conversation_id = c.id
            WHERE c.whatsapp_phone = ? AND ctx.business_id IS NOT NULL AND c.channel = 'whatsapp'
            ORDER BY c.updated_at DESC LIMIT 1
        ");
        $stmt->execute([$phone]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        if ($row && $row['business_id']) {
            return $this->getBusinessById((int)$row['business_id']);
        }
        return null;
    }

    private function matchByKeywords(string $message): array {
        $lower = mb_strtolower($message);
        // Remove accents for matching
        $normalized = $this->removeAccents($lower);
        $businesses = $this->loadBusinesses();
        $scores = [];

        foreach ($businesses as $b) {
            $keywords = json_decode($b['keywords'], true) ?: [];
            $score = 0;

            foreach ($keywords as $kw) {
                $kwNorm = $this->removeAccents(mb_strtolower($kw));
                if (mb_strpos($normalized, $kwNorm) !== false) {
                    $score++;
                    // Exact business name match gets extra weight
                    if ($kwNorm === $this->removeAccents(mb_strtolower($b['slug']))) {
                        $score += 5;
                    }
                }
            }

            if ($score > 0) {
                $scores[] = ['business' => $b, 'score' => $score];
            }
        }

        // Sort by score descending
        usort($scores, fn($a, $b) => $b['score'] - $a['score']);

        return array_map(fn($s) => $s['business'], $scores);
    }

    private function removeAccents(string $text): string {
        $search  = ['á','é','í','ó','ú','ñ','ü'];
        $replace = ['a','e','i','o','u','n','u'];
        return str_replace($search, $replace, $text);
    }

    private function loadBusinesses(): array {
        if ($this->businesses !== null) {
            return $this->businesses;
        }

        try {
            $stmt = $this->pdo->query("SELECT * FROM businesses WHERE ai_enabled = 1 ORDER BY id ASC");
            $this->businesses = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        } catch (\PDOException $e) {
            error_log("[BusinessRouter] Load failed: " . $e->getMessage());
            $this->businesses = [];
        }

        return $this->businesses;
    }
}
