<?php
/**
 * Migration: WhatsApp AI Chat Tables - Imporlan
 *
 * Run once: php migrations/whatsapp_ai_tables.php
 * Adds WhatsApp channel support to existing chat system + AI context tables
 */

require_once __DIR__ . '/../db_config.php';

$pdo = getDbConnection();

try {
    // 1. Add WhatsApp columns to chat_conversations
    $alterQueries = [
        "ALTER TABLE chat_conversations ADD COLUMN channel ENUM('web','whatsapp') DEFAULT 'web'",
        "ALTER TABLE chat_conversations ADD COLUMN whatsapp_phone VARCHAR(20) DEFAULT NULL",
        "ALTER TABLE chat_conversations ADD COLUMN whatsapp_wa_id VARCHAR(50) DEFAULT NULL",
        "ALTER TABLE chat_conversations ADD INDEX idx_channel (channel)",
        "ALTER TABLE chat_conversations ADD INDEX idx_whatsapp_phone (whatsapp_phone)",
    ];

    foreach ($alterQueries as $sql) {
        try {
            $pdo->exec($sql);
            echo "OK: $sql\n";
        } catch (PDOException $e) {
            echo "SKIP (already exists): " . $e->getMessage() . "\n";
        }
    }

    // 2. Add 'ai' sender_role to chat_messages
    try {
        $pdo->exec("ALTER TABLE chat_messages MODIFY COLUMN sender_role ENUM('user','admin','support','system','ai') NOT NULL");
        echo "OK: Added 'ai' to sender_role ENUM\n";
    } catch (PDOException $e) {
        echo "SKIP: " . $e->getMessage() . "\n";
    }

    // 3. Create AI conversation context table (lead tracking + memory)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS whatsapp_ai_context (
            id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT NOT NULL,
            whatsapp_phone VARCHAR(20) NOT NULL,
            lead_stage ENUM('nuevo','explorando','calificado','cotizando','caliente','cerrado') DEFAULT 'nuevo',
            lead_data JSON DEFAULT NULL,
            conversation_summary TEXT DEFAULT NULL,
            message_count INT DEFAULT 0,
            ai_message_count INT DEFAULT 0,
            last_ai_action VARCHAR(100) DEFAULT NULL,
            escalated_at DATETIME DEFAULT NULL,
            follow_up_scheduled_at DATETIME DEFAULT NULL,
            follow_up_sent TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE INDEX idx_conversation (conversation_id),
            INDEX idx_phone (whatsapp_phone),
            INDEX idx_lead_stage (lead_stage),
            INDEX idx_follow_up (follow_up_scheduled_at, follow_up_sent),
            FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "OK: Created whatsapp_ai_context table\n";

    // 4. Create WhatsApp message log (raw webhook data for debugging)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS whatsapp_webhook_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            direction ENUM('incoming','outgoing') NOT NULL,
            wa_message_id VARCHAR(100) DEFAULT NULL,
            phone VARCHAR(20) DEFAULT NULL,
            payload JSON NOT NULL,
            status VARCHAR(50) DEFAULT 'received',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_phone (phone),
            INDEX idx_direction (direction),
            INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "OK: Created whatsapp_webhook_log table\n";

    // 5. Create AI usage tracking (for cost monitoring)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS ai_usage_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT DEFAULT NULL,
            model VARCHAR(50) NOT NULL,
            input_tokens INT DEFAULT 0,
            output_tokens INT DEFAULT 0,
            cache_read_tokens INT DEFAULT 0,
            cache_creation_tokens INT DEFAULT 0,
            tools_used JSON DEFAULT NULL,
            cost_usd DECIMAL(10,6) DEFAULT 0,
            response_time_ms INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_conversation (conversation_id),
            INDEX idx_created (created_at),
            INDEX idx_model (model)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "OK: Created ai_usage_log table\n";

    echo "\n=== Migration completed successfully ===\n";

} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
