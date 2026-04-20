<?php
/**
 * Migration: Multi-tenant Business Support
 *
 * Run once: php migrations/multi_tenant_tables.php
 * Adds businesses table and business_id to whatsapp_ai_context
 */

require_once __DIR__ . '/../db_config.php';

$pdo = getDbConnection();

try {
    // 1. Create businesses table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS businesses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            domain VARCHAR(255) DEFAULT NULL,
            ai_assistant_name VARCHAR(100) NOT NULL,
            ai_enabled TINYINT(1) DEFAULT 1,
            system_prompt_file VARCHAR(255) NOT NULL,
            tools_enabled JSON DEFAULT NULL,
            keywords JSON NOT NULL,
            admin_phone VARCHAR(20) DEFAULT NULL,
            admin_email VARCHAR(255) DEFAULT NULL,
            welcome_message TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_slug (slug),
            INDEX idx_domain (domain)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "OK: Created businesses table\n";

    // 2. Seed the 4 businesses
    $businesses = [
        [
            'slug' => 'imporlan',
            'name' => 'Imporlan',
            'domain' => 'imporlan.cl',
            'ai_assistant_name' => 'Mariana',
            'system_prompt_file' => 'imporlan.php',
            'tools_enabled' => json_encode(['search_marketplace', 'calculate_import_quote', 'create_lead', 'escalate_to_human', 'schedule_follow_up', 'send_boat_gallery', 'send_interactive_menu', 'send_contact_card']),
            'keywords' => json_encode([
                'lancha', 'lanchas', 'barco', 'barcos', 'embarcacion', 'embarcaciones',
                'importar', 'importacion', 'importación', 'imporlan',
                'velero', 'yate', 'moto de agua', 'jet ski', 'catamaran',
                'nautico', 'náutico', 'maritimo', 'marítimo',
                'boat', 'yacht', 'vessel',
                'marketplace', 'arriendo barco', 'arriendo lancha',
                'pesca', 'bote', 'navegacion', 'navegación',
                'usa chile', 'estados unidos chile'
            ]),
            'admin_phone' => '+56940211459',
            'admin_email' => 'contacto@imporlan.cl',
            'welcome_message' => '¡Hola! 👋 Soy Mariana de Imporlan. Te ayudo con importación, venta y arriendo de embarcaciones. ¿En qué puedo ayudarte?'
        ],
        [
            'slug' => 'clasesdeski',
            'name' => 'Clases de Ski',
            'domain' => 'clasesdeski.cl',
            'ai_assistant_name' => 'Valentina',
            'system_prompt_file' => 'clasesdeski.php',
            'tools_enabled' => json_encode(['create_lead', 'escalate_to_human', 'send_interactive_menu', 'send_contact_card']),
            'keywords' => json_encode([
                'ski', 'esqui', 'esquí', 'clase', 'clases',
                'clasesdeski', 'clases de ski', 'clases de esqui',
                'nieve', 'snowboard', 'snow',
                'cerro', 'montaña', 'montana',
                'temporada', 'principiante', 'instructor',
                'ski acuatico', 'ski acuático', 'wakesurf', 'wakeboard'
            ]),
            'admin_phone' => '+56940211459',
            'admin_email' => 'contacto@clasesdeski.cl',
            'welcome_message' => '¡Hola! 👋 Soy Valentina de Clases de Ski. ¿Te interesa tomar clases o tienes alguna consulta?'
        ],
        [
            'slug' => 'deckeva',
            'name' => 'Deckeva',
            'domain' => 'deckeva.cl',
            'ai_assistant_name' => 'Camila',
            'system_prompt_file' => 'deckeva.php',
            'tools_enabled' => json_encode(['create_lead', 'escalate_to_human', 'send_interactive_menu', 'send_contact_card']),
            'keywords' => json_encode([
                'piso', 'pisos', 'eva', 'piso eva', 'pisos eva',
                'deckeva', 'deck', 'decking',
                'faux teak', 'teca', 'teca sintetica', 'teca sintética',
                'antideslizante', 'cubierta', 'revestimiento',
                'foam', 'espuma', 'marine mat',
                'piso lancha', 'piso barco', 'piso embarcacion'
            ]),
            'admin_phone' => '+56940211459',
            'admin_email' => 'contacto@deckeva.cl',
            'welcome_message' => '¡Hola! 👋 Soy Camila de Deckeva. Somos especialistas en pisos EVA y revestimientos para embarcaciones. ¿En qué te ayudo?'
        ],
        [
            'slug' => 'tourevo',
            'name' => 'Tourevo',
            'domain' => 'tourevo.cl',
            'ai_assistant_name' => 'Sofía',
            'system_prompt_file' => 'tourevo.php',
            'tools_enabled' => json_encode(['create_lead', 'escalate_to_human', 'send_interactive_menu', 'send_contact_card']),
            'keywords' => json_encode([
                'tour', 'tours', 'turismo', 'viaje', 'viajes',
                'tourevo', 'excursion', 'excursión',
                'paseo', 'recorrido', 'experiencia',
                'reserva', 'reservar', 'booking',
                'destino', 'destinos', 'itinerario',
                'guia', 'guía', 'turistico', 'turístico'
            ]),
            'admin_phone' => '+56940211459',
            'admin_email' => 'contacto@tourevo.cl',
            'welcome_message' => '¡Hola! 👋 Soy Sofía de Tourevo. Te ayudo a planificar tu próxima aventura. ¿Qué destino te interesa?'
        ]
    ];

    $stmt = $pdo->prepare("
        INSERT IGNORE INTO businesses
        (slug, name, domain, ai_assistant_name, system_prompt_file, tools_enabled, keywords, admin_phone, admin_email, welcome_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    foreach ($businesses as $b) {
        $stmt->execute([
            $b['slug'], $b['name'], $b['domain'], $b['ai_assistant_name'],
            $b['system_prompt_file'], $b['tools_enabled'], $b['keywords'],
            $b['admin_phone'], $b['admin_email'], $b['welcome_message']
        ]);
        echo "OK: Seeded business '{$b['slug']}'\n";
    }

    // 3. Add business_id to whatsapp_ai_context
    $alterQueries = [
        "ALTER TABLE whatsapp_ai_context ADD COLUMN business_id INT DEFAULT NULL",
        "ALTER TABLE whatsapp_ai_context ADD INDEX idx_business (business_id)",
        "ALTER TABLE whatsapp_ai_context ADD FOREIGN KEY fk_business (business_id) REFERENCES businesses(id) ON DELETE SET NULL",
    ];

    foreach ($alterQueries as $sql) {
        try {
            $pdo->exec($sql);
            echo "OK: $sql\n";
        } catch (PDOException $e) {
            echo "SKIP: " . $e->getMessage() . "\n";
        }
    }

    // 4. Add business_id to chat_conversations too
    try {
        $pdo->exec("ALTER TABLE chat_conversations ADD COLUMN business_id INT DEFAULT NULL");
        echo "OK: Added business_id to chat_conversations\n";
    } catch (PDOException $e) {
        echo "SKIP: " . $e->getMessage() . "\n";
    }

    echo "\n=== Multi-tenant migration completed ===\n";

} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
