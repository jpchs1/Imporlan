<?php
/**
 * Cron: WhatsApp Follow-ups - Imporlan
 * Sends scheduled follow-up messages to leads via WhatsApp.
 *
 * Run every 15 minutes: */15 * * * * php /path/to/api/cron/whatsapp_follow_ups.php
 */

if (php_sapi_name() !== 'cli') {
    $cron_key = $_GET['cron_key'] ?? '';
    if ($cron_key !== 'imporlan_followup_2026') {
        http_response_code(403);
        echo 'Forbidden';
        exit();
    }
}

require_once __DIR__ . '/../db_config.php';
require_once __DIR__ . '/../ai/whatsapp_config.php';
require_once __DIR__ . '/../ai/whatsapp_api.php';

$pdo = getDbConnection();

try {
    // Find conversations with pending follow-ups
    $stmt = $pdo->prepare("
        SELECT ctx.*, c.whatsapp_phone, c.user_name, c.status
        FROM whatsapp_ai_context ctx
        JOIN chat_conversations c ON c.id = ctx.conversation_id
        WHERE ctx.follow_up_scheduled_at <= NOW()
          AND ctx.follow_up_sent = 0
          AND c.status = 'open'
          AND c.channel = 'whatsapp'
          AND ctx.escalated_at IS NULL
        LIMIT 10
    ");
    $stmt->execute();
    $followUps = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($followUps)) {
        echo "No follow-ups pending.\n";
        exit(0);
    }

    $wa = new WhatsAppAPI();
    $processed = 0;

    foreach ($followUps as $fu) {
        $phone = $fu['whatsapp_phone'];
        $leadData = json_decode($fu['lead_data'] ?? '{}', true);
        $nombre = $leadData['nombre'] ?? 'amigo/a';

        $message = "Hola $nombre! 👋 Soy Mariana de Imporlan. "
            . "Hace un tiempo conversamos sobre embarcaciones y quería saber si aún tienes interés. "
            . "¿Hay algo en lo que pueda ayudarte? Estamos para ti.";

        $result = $wa->sendText($phone, $message);

        if ($result['success'] ?? false) {
            // Mark as sent
            $stmt = $pdo->prepare("
                UPDATE whatsapp_ai_context
                SET follow_up_sent = 1, last_ai_action = 'follow_up_sent'
                WHERE conversation_id = ?
            ");
            $stmt->execute([$fu['conversation_id']]);
            $processed++;
            echo "Follow-up sent to $phone (conversation #{$fu['conversation_id']})\n";
        } else {
            echo "Failed to send follow-up to $phone: " . ($result['error'] ?? 'unknown') . "\n";
        }

        usleep(500000); // 0.5s delay between messages
    }

    echo "Processed $processed follow-ups.\n";

} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
}
