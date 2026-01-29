<?php
/**
 * Chat Auto Messages - Imporlan
 * 
 * Script para enviar mensajes automáticos a conversaciones sin agente asignado.
 * Debe ejecutarse cada minuto mediante cron job.
 * 
 * Cron job recomendado:
 * * * * * * php /path/to/api/chat_auto_messages.php >> /var/log/chat_auto_messages.log 2>&1
 */

// Prevent direct web access in production (allow CLI only)
if (php_sapi_name() !== 'cli' && !isset($_GET['cron_key'])) {
    // Allow web access with a secret key for testing
    $expectedKey = 'imporlan_auto_msg_2026';
    if (!isset($_GET['cron_key']) || $_GET['cron_key'] !== $expectedKey) {
        http_response_code(403);
        echo json_encode(['error' => 'Acceso denegado']);
        exit();
    }
}

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/email_service.php';

// Configuration
define('AUTO_MSG_3MIN_DELAY', 3 * 60);   // 3 minutes in seconds
define('AUTO_MSG_15MIN_DELAY', 15 * 60); // 15 minutes in seconds

// Auto message texts
define('AUTO_MSG_3MIN_TEXT', 
    "⏳ Seguimos contigo\n\n" .
    "Nuestros agentes aún se encuentran ocupados, pero tu conversación sigue en cola y será atendida a la brevedad.\n\n" .
    "🙏 Agradecemos tu paciencia.\n" .
    "Si lo deseas, puedes seguir enviándonos información adicional sobre tu consulta para que podamos ayudarte más rápido cuando tomemos contacto.\n\n" .
    "Equipo Imporlan"
);

define('AUTO_MSG_15MIN_TEXT',
    "📩 Actualización de tu solicitud\n\n" .
    "En este momento nuestros agentes continúan ocupados y no hemos podido atenderte aún.\n\n" .
    "Queremos que sepas que tu mensaje ha sido registrado correctamente y será recibido por nuestro equipo vía correo electrónico, para que podamos revisarlo con calma y darte una respuesta completa.\n\n" .
    "📬 Nos pondremos en contacto contigo a la brevedad a través de este medio o por correo.\n\n" .
    "Agradecemos mucho tu paciencia y tu interés en Imporlan."
);

/**
 * Main function to process auto messages
 */
function processAutoMessages() {
    $pdo = getDbConnection();
    $now = time();
    $processedCount = 0;
    
    try {
        // Get all open conversations without an assigned agent
        $stmt = $pdo->prepare("
            SELECT id, user_email, user_name, auto_messages_sent, created_at
            FROM chat_conversations
            WHERE status = 'open'
            AND assigned_to_id IS NULL
        ");
        $stmt->execute();
        $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($conversations as $conversation) {
            $conversationId = $conversation['id'];
            $createdAt = strtotime($conversation['created_at']);
            $elapsedSeconds = $now - $createdAt;
            
            // Parse auto_messages_sent JSON
            $autoMessagesSent = json_decode($conversation['auto_messages_sent'] ?? '{}', true) ?: [];
            
            // Check if we need to send the 3-minute message
            if ($elapsedSeconds >= AUTO_MSG_3MIN_DELAY && !isset($autoMessagesSent['3min'])) {
                if (sendAutoMessage($pdo, $conversationId, AUTO_MSG_3MIN_TEXT)) {
                    $autoMessagesSent['3min'] = date('Y-m-d H:i:s');
                    updateAutoMessagesSent($pdo, $conversationId, $autoMessagesSent);
                    $processedCount++;
                    logMessage("Sent 3-minute message to conversation #$conversationId");
                }
            }
            
            // Check if we need to send the 15-minute message
            if ($elapsedSeconds >= AUTO_MSG_15MIN_DELAY && !isset($autoMessagesSent['15min'])) {
                if (sendAutoMessage($pdo, $conversationId, AUTO_MSG_15MIN_TEXT)) {
                    $autoMessagesSent['15min'] = date('Y-m-d H:i:s');
                    updateAutoMessagesSent($pdo, $conversationId, $autoMessagesSent);
                    $processedCount++;
                    logMessage("Sent 15-minute message to conversation #$conversationId");
                    
                    // Also send email notification to admin about unattended conversation
                    sendUnattendedConversationEmail($conversation);
                }
            }
        }
        
        return $processedCount;
        
    } catch (PDOException $e) {
        logMessage("Database error: " . $e->getMessage());
        return -1;
    }
}

/**
 * Send an automatic message to a conversation
 */
function sendAutoMessage($pdo, $conversationId, $message) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO chat_messages (conversation_id, sender_id, sender_role, sender_name, sender_email, message)
            VALUES (?, 0, 'system', 'Sistema Imporlan', NULL, ?)
        ");
        $stmt->execute([$conversationId, $message]);
        
        // Update conversation timestamp
        $stmt = $pdo->prepare("UPDATE chat_conversations SET updated_at = NOW() WHERE id = ?");
        $stmt->execute([$conversationId]);
        
        return true;
    } catch (PDOException $e) {
        logMessage("Error sending auto message to conversation #$conversationId: " . $e->getMessage());
        return false;
    }
}

/**
 * Update the auto_messages_sent field for a conversation
 */
function updateAutoMessagesSent($pdo, $conversationId, $autoMessagesSent) {
    try {
        $stmt = $pdo->prepare("UPDATE chat_conversations SET auto_messages_sent = ? WHERE id = ?");
        $stmt->execute([json_encode($autoMessagesSent), $conversationId]);
        return true;
    } catch (PDOException $e) {
        logMessage("Error updating auto_messages_sent for conversation #$conversationId: " . $e->getMessage());
        return false;
    }
}

/**
 * Send email notification about unattended conversation (after 15 minutes)
 */
function sendUnattendedConversationEmail($conversation) {
    try {
        // Get the first message from the conversation
        $pdo = getDbConnection();
        $stmt = $pdo->prepare("
            SELECT message FROM chat_messages 
            WHERE conversation_id = ? AND sender_role = 'user'
            ORDER BY timestamp ASC LIMIT 1
        ");
        $stmt->execute([$conversation['id']]);
        $firstMessage = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $subject = "⚠️ Conversación sin atender - " . $conversation['user_name'];
        $body = "
            <h2>Conversación sin atender por más de 15 minutos</h2>
            <p><strong>Usuario:</strong> {$conversation['user_name']} ({$conversation['user_email']})</p>
            <p><strong>Conversación ID:</strong> #{$conversation['id']}</p>
            <p><strong>Mensaje inicial:</strong></p>
            <blockquote style='background: #f5f5f5; padding: 15px; border-left: 4px solid #22d3ee;'>
                " . nl2br(htmlspecialchars($firstMessage['message'] ?? 'Sin mensaje')) . "
            </blockquote>
            <p>Por favor, atiende esta conversación lo antes posible.</p>
            <p><a href='https://www.imporlan.cl/panel/admin/#chat'>Ir al panel de chat</a></p>
        ";
        
        // Use the existing email service
        if (function_exists('sendInternalNotification')) {
            sendInternalNotification('new_chat_message', [
                'user_email' => $conversation['user_email'],
                'user_name' => $conversation['user_name'],
                'message' => $firstMessage['message'] ?? 'Sin mensaje',
                'conversation_id' => $conversation['id'],
                'subject_prefix' => '⚠️ URGENTE: '
            ]);
        }
        
        return true;
    } catch (Exception $e) {
        logMessage("Error sending unattended conversation email: " . $e->getMessage());
        return false;
    }
}

/**
 * Log a message (to stdout in CLI mode, or to error_log in web mode)
 */
function logMessage($message) {
    $timestamp = date('Y-m-d H:i:s');
    $logLine = "[$timestamp] $message\n";
    
    if (php_sapi_name() === 'cli') {
        echo $logLine;
    } else {
        error_log($logLine);
    }
}

// Run the script
$startTime = microtime(true);
logMessage("Starting auto messages processing...");

$processedCount = processAutoMessages();

$endTime = microtime(true);
$duration = round(($endTime - $startTime) * 1000, 2);

if ($processedCount >= 0) {
    logMessage("Completed. Processed $processedCount message(s) in {$duration}ms");
    
    // Output JSON response for web access
    if (php_sapi_name() !== 'cli') {
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'processed' => $processedCount,
            'duration_ms' => $duration
        ]);
    }
} else {
    logMessage("Failed with errors");
    
    if (php_sapi_name() !== 'cli') {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Error processing auto messages'
        ]);
    }
}
