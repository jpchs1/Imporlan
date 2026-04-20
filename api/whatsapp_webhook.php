<?php
/**
 * WhatsApp Webhook - Multi-tenant AI Chat
 *
 * Receives incoming WhatsApp messages via Meta Cloud API webhook.
 * Routes each message to the correct business (Imporlan, Clasesdeski, Deckeva, Tourevo).
 * If no business matches → does NOT respond (owner handles it manually).
 *
 * Webhook URL: https://www.imporlan.cl/api/whatsapp_webhook.php
 */

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/ai/whatsapp_api.php';
require_once __DIR__ . '/ai/whatsapp_config.php';
require_once __DIR__ . '/ai/chat_ai_handler.php';
require_once __DIR__ . '/ai/conversation_memory.php';
require_once __DIR__ . '/ai/business_router.php';

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
    http_response_code(200);

    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!$payload) {
        exit();
    }

    WhatsAppAPI::logWebhook('incoming', null, $payload);

    $parsed = WhatsAppAPI::parseIncomingMessage($payload);

    if (!$parsed || $parsed['type'] !== 'message') {
        exit();
    }

    $phone = $parsed['from'] ?? '';
    $contactName = $parsed['contact_name'] ?? '';
    $waId = $parsed['wa_id'] ?? $phone;
    $messageText = $parsed['text'] ?? '';
    $waMessageId = $parsed['message_id'] ?? '';
    $buttonId = $parsed['button_id'] ?? '';
    $listId = $parsed['list_id'] ?? '';

    if (empty($phone) || empty($messageText)) {
        exit();
    }

    try {
        $wa = new WhatsAppAPI();
        if ($waMessageId) {
            $wa->markAsRead($waMessageId);
        }

        $memory = new ConversationMemory();
        $router = new BusinessRouter();

        // --- BUSINESS ROUTING ---

        // Check if there's an existing conversation for this phone
        $existingConv = getExistingConversation($phone);
        $conversationId = $existingConv ? (int)$existingConv['id'] : null;

        // Handle business selection menu response
        if ($buttonId && strpos($buttonId, 'biz_') === 0) {
            $slug = substr($buttonId, 4);
            $business = $router->getBusinessBySlug($slug);
            if ($business && $conversationId) {
                $router->assignBusiness($conversationId, (int)$business['id']);
            }
        } else {
            $business = $router->detectBusiness($phone, $messageText, $conversationId);
        }

        // --- NO BUSINESS DETECTED: SILENT MODE ---
        if (!$business) {
            // Save the message so the owner can see it, but DON'T respond via AI
            if (!$conversationId) {
                $conversation = $memory->getOrCreateConversation($phone, $contactName, $waId, null);
                $conversationId = (int)$conversation['id'];
            }
            $memory->saveUserMessage($conversationId, $phone, $contactName ?: "WhatsApp $phone", $messageText);

            // Notify owner via email about unclassified message
            notifyOwnerUnclassifiedMessage($phone, $contactName, $messageText);

            // Log it
            error_log("[WhatsApp Router] No business match for message from $phone: " . mb_substr($messageText, 0, 100));
            exit();
        }

        // --- BUSINESS DETECTED: PROCESS WITH AI ---

        // Get or create conversation with business context
        $businessId = (int)$business['id'];
        if (!$conversationId) {
            $conversation = $memory->getOrCreateConversation($phone, $contactName, $waId, $businessId);
            $conversationId = (int)$conversation['id'];
        } else {
            // Ensure business is assigned to existing conversation
            $router->assignBusiness($conversationId, $businessId);
        }

        $memory->saveUserMessage($conversationId, $phone, $contactName ?: "WhatsApp $phone", $messageText);

        // Check if escalated to human
        if ($memory->isEscalated($conversationId)) {
            notifyAdminNewWhatsAppMessage($conversationId, $phone, $contactName, $messageText, $business);
            exit();
        }

        // Small delay to feel natural
        $delay = defined('AI_RESPONSE_DELAY_SECONDS') ? AI_RESPONSE_DELAY_SECONDS : 2;
        if ($delay > 0) {
            sleep($delay);
        }

        // Process through AI with business context
        $handler = new ChatAIHandler();
        $handler->setBusiness($business);
        $response = $handler->processMessage($conversationId, $messageText, $phone);

        $aiText = $response['text'] ?? '';

        if (!empty($aiText)) {
            $memory->saveAiMessage($conversationId, $aiText);
            $sendResult = $wa->sendText($phone, $aiText);

            WhatsAppAPI::logWebhook('outgoing', $phone, [
                'business' => $business['slug'],
                'text' => $aiText,
                'tool_actions' => array_map(fn($a) => $a['tool'], $response['tool_actions'] ?? []),
                'send_result' => $sendResult['success'] ?? false,
            ], $sendResult['messages'][0]['id'] ?? '');
        }

        handlePostResponseActions($response['tool_actions'] ?? [], $conversationId, $phone, $business);

    } catch (\Exception $e) {
        error_log("[WhatsApp Webhook] Error: " . $e->getMessage());
        error_log("[WhatsApp Webhook] Trace: " . $e->getTraceAsString());

        try {
            $wa = new WhatsAppAPI();
            $wa->sendText($phone, "Gracias por tu mensaje. Nuestro equipo te responderá pronto. Si es urgente, llámanos al +56 9 4021 1459.");
        } catch (\Exception $e2) {
            error_log("[WhatsApp Webhook] Fallback failed: " . $e2->getMessage());
        }
    }

    exit();
}

// --- Helper Functions ---

function getExistingConversation(string $phone): ?array {
    $phone = preg_replace('/[^0-9]/', '', $phone);
    try {
        $pdo = getDbConnection();
        $stmt = $pdo->prepare("
            SELECT c.id, c.business_id, c.status
            FROM chat_conversations c
            WHERE c.whatsapp_phone = ? AND c.status = 'open' AND c.channel = 'whatsapp'
            ORDER BY c.updated_at DESC LIMIT 1
        ");
        $stmt->execute([$phone]);
        return $stmt->fetch(\PDO::FETCH_ASSOC) ?: null;
    } catch (\PDOException $e) {
        return null;
    }
}

function handlePostResponseActions(array $toolActions, int $conversationId, string $phone, array $business): void {
    foreach ($toolActions as $action) {
        $tool = $action['tool'] ?? '';
        $result = $action['result'] ?? [];

        if ($tool === 'escalate_to_human' && ($result['success'] ?? false)) {
            try {
                $wa = new WhatsAppAPI();
                $wa->sendContact(
                    $phone,
                    "Juan Pablo - {$business['name']}",
                    $business['admin_phone'] ?? WHATSAPP_DISPLAY_PHONE,
                    $business['admin_email'] ?? ADMIN_NOTIFICATION_EMAIL
                );
            } catch (\Exception $e) {
                error_log("[PostAction] Contact card failed: " . $e->getMessage());
            }
        }
    }
}

function notifyOwnerUnclassifiedMessage(string $phone, string $name, string $message): void {
    try {
        require_once __DIR__ . '/email_service.php';
        $emailService = new EmailService();
        $emailService->sendInternalNotification('whatsapp_unclassified', [
            'phone' => $phone,
            'name' => $name ?: "WhatsApp $phone",
            'message' => mb_substr($message, 0, 500),
            'date' => date('d/m/Y H:i'),
            'note' => 'Este mensaje no fue clasificado en ningun negocio. Requiere respuesta manual.'
        ]);
    } catch (\Exception $e) {
        error_log("[WhatsApp] Unclassified notification failed: " . $e->getMessage());
    }
}

function notifyAdminNewWhatsAppMessage(int $conversationId, string $phone, string $name, string $message, array $business): void {
    try {
        require_once __DIR__ . '/email_service.php';
        $emailService = new EmailService();
        $emailService->sendInternalNotification('whatsapp_new_message', [
            'conversation_id' => $conversationId,
            'business' => $business['name'],
            'phone' => $phone,
            'name' => $name ?: "WhatsApp $phone",
            'message' => mb_substr($message, 0, 500),
            'date' => date('d/m/Y H:i'),
        ]);
    } catch (\Exception $e) {
        error_log("[WhatsApp] Admin notification failed: " . $e->getMessage());
    }
}

http_response_code(405);
echo 'Method Not Allowed';
