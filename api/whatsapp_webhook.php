<?php
/**
 * WhatsApp Webhook - Imporlan
 *
 * Receives incoming WhatsApp messages via Meta Cloud API webhook,
 * processes them through AI, and sends back responses.
 *
 * Webhook URL: https://www.imporlan.cl/api/whatsapp_webhook.php
 * Verify Token: Set in ai/whatsapp_config.php
 */

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/ai/whatsapp_api.php';
require_once __DIR__ . '/ai/whatsapp_config.php';
require_once __DIR__ . '/ai/chat_ai_handler.php';
require_once __DIR__ . '/ai/conversation_memory.php';

// --- Webhook Verification (GET) ---
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode = $_GET['hub_mode'] ?? '';
    $token = $_GET['hub_verify_token'] ?? '';
    $challenge = $_GET['hub_challenge'] ?? '';

    if ($mode === 'subscribe' && $token === WHATSAPP_VERIFY_TOKEN) {
        http_response_code(200);
        echo $challenge;
        exit();
    }

    http_response_code(403);
    echo 'Forbidden';
    exit();
}

// --- Incoming Message (POST) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Always respond 200 quickly to avoid Meta retries
    http_response_code(200);

    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!$payload) {
        exit();
    }

    // Log raw webhook
    WhatsAppAPI::logWebhook('incoming', null, $payload);

    // Parse the message
    $parsed = WhatsAppAPI::parseIncomingMessage($payload);

    if (!$parsed) {
        exit();
    }

    // Handle status updates (delivered, read, etc.) - just log and exit
    if ($parsed['type'] === 'status') {
        exit();
    }

    // Only process actual messages
    if ($parsed['type'] !== 'message') {
        exit();
    }

    $phone = $parsed['from'] ?? '';
    $contactName = $parsed['contact_name'] ?? '';
    $waId = $parsed['wa_id'] ?? $phone;
    $messageText = $parsed['text'] ?? '';
    $messageType = $parsed['message_type'] ?? 'text';
    $waMessageId = $parsed['message_id'] ?? '';

    if (empty($phone) || empty($messageText)) {
        exit();
    }

    try {
        // Mark as read (blue checkmarks)
        $wa = new WhatsAppAPI();
        if ($waMessageId) {
            $wa->markAsRead($waMessageId);
        }

        // Get or create conversation
        $memory = new ConversationMemory();
        $conversation = $memory->getOrCreateConversation($phone, $contactName, $waId);
        $conversationId = (int)$conversation['id'];

        // Save incoming message
        $memory->saveUserMessage($conversationId, $phone, $contactName ?: "WhatsApp $phone", $messageText);

        // Check if escalated to human — if so, don't AI respond
        if ($memory->isEscalated($conversationId)) {
            // Notify admin of new message via email
            notifyAdminNewWhatsAppMessage($conversationId, $phone, $contactName, $messageText);
            exit();
        }

        // Add a small delay to feel natural
        $delay = defined('AI_RESPONSE_DELAY_SECONDS') ? AI_RESPONSE_DELAY_SECONDS : 2;
        if ($delay > 0) {
            sleep($delay);
        }

        // Process through AI
        $handler = new ChatAIHandler();
        $response = $handler->processMessage($conversationId, $messageText, $phone);

        $aiText = $response['text'] ?? '';

        if (!empty($aiText)) {
            // Save AI response to DB
            $memory->saveAiMessage($conversationId, $aiText);

            // Send via WhatsApp
            $sendResult = $wa->sendText($phone, $aiText);

            // Log outgoing
            WhatsAppAPI::logWebhook('outgoing', $phone, [
                'text' => $aiText,
                'tool_actions' => array_map(fn($a) => $a['tool'], $response['tool_actions'] ?? []),
                'send_result' => $sendResult['success'] ?? false,
            ], $sendResult['messages'][0]['id'] ?? '');
        }

        // Handle post-response actions from tools
        handlePostResponseActions($response['tool_actions'] ?? [], $conversationId, $phone);

    } catch (\Exception $e) {
        error_log("[WhatsApp Webhook] Error processing message: " . $e->getMessage());
        error_log("[WhatsApp Webhook] Stack trace: " . $e->getTraceAsString());

        // Send fallback message
        try {
            $wa = new WhatsAppAPI();
            $wa->sendText($phone, "Gracias por tu mensaje. Nuestro equipo te responderá pronto. Si es urgente, llámanos al +56 9 4021 1459.");
        } catch (\Exception $e2) {
            error_log("[WhatsApp Webhook] Fallback send failed: " . $e2->getMessage());
        }
    }

    exit();
}

/**
 * Handle actions that should happen AFTER the main text response is sent.
 * For example: sending images, menus, or contact cards triggered by tools.
 */
function handlePostResponseActions(array $toolActions, int $conversationId, string $phone): void {
    foreach ($toolActions as $action) {
        $tool = $action['tool'] ?? '';
        $result = $action['result'] ?? [];

        // If escalated, send contact card
        if ($tool === 'escalate_to_human' && ($result['success'] ?? false)) {
            try {
                $wa = new WhatsAppAPI();
                $wa->sendContact(
                    $phone,
                    'Juan Pablo - Imporlan',
                    WHATSAPP_DISPLAY_PHONE ?? '+56940211459',
                    ADMIN_NOTIFICATION_EMAIL ?? 'contacto@imporlan.cl'
                );
            } catch (\Exception $e) {
                error_log("[PostAction] Contact card failed: " . $e->getMessage());
            }
        }
    }
}

/**
 * Notify admin when escalated conversation gets a new message.
 */
function notifyAdminNewWhatsAppMessage(int $conversationId, string $phone, string $name, string $message): void {
    try {
        require_once __DIR__ . '/email_service.php';
        $emailService = new EmailService();
        $emailService->sendInternalNotification('whatsapp_new_message', [
            'conversation_id' => $conversationId,
            'phone' => $phone,
            'name' => $name ?: "WhatsApp $phone",
            'message' => mb_substr($message, 0, 500),
            'date' => date('d/m/Y H:i'),
        ]);
    } catch (\Exception $e) {
        error_log("[WhatsApp] Admin notification failed: " . $e->getMessage());
    }
}

// Reject other methods
http_response_code(405);
echo 'Method Not Allowed';
