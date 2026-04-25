<?php
/**
 * Migration — US Operations deal desk
 *
 * Creates the schema for /USOperations/:
 *   us_ops_deals       — one row per deal (full state JSON + key columns
 *                         denormalized for indexing/listing).
 *   us_ops_audit       — append-only event log of stage changes and
 *                         significant edits.
 *   us_ops_collaborators — stateside team members granted access by deal.
 *
 * Run via:  /api/migrations/create_us_operations.php
 *
 * Idempotent: each statement uses CREATE TABLE IF NOT EXISTS, and the
 * column adds are wrapped in TRY/CATCH so re-runs don't break.
 */

header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/../db_config.php';

$result = ['success' => true, 'steps' => []];

try {
    $pdo = getDbConnection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // -------------------------------------------------------
    //  1. us_ops_deals
    // -------------------------------------------------------
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS us_ops_deals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            deal_number   VARCHAR(40)  NOT NULL UNIQUE,
            title         VARCHAR(255) NOT NULL DEFAULT '',
            status        VARCHAR(40)  NOT NULL DEFAULT 'Sourcing',
            pipeline_index TINYINT     NOT NULL DEFAULT 0,
            source_url    VARCHAR(512) NULL,
            source_id     VARCHAR(64)  NULL,
            location_us   VARCHAR(120) NULL,
            asking_price  DECIMAL(12,2) NULL,
            target_price  DECIMAL(12,2) NULL,
            agreed_price  DECIMAL(12,2) NULL,
            list_price    DECIMAL(12,2) NULL,
            sold_price    DECIMAL(12,2) NULL,
            all_in_cost   DECIMAL(12,2) NULL,
            projected_profit DECIMAL(12,2) NULL,
            margin_pct    DECIMAL(6,2)  NULL,
            payload       LONGTEXT     NOT NULL,
            owner_email   VARCHAR(190) NULL,
            created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_status (status),
            INDEX idx_owner (owner_email),
            INDEX idx_updated (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $result['steps'][] = 'us_ops_deals OK';

    // -------------------------------------------------------
    //  2. us_ops_audit
    // -------------------------------------------------------
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS us_ops_audit (
            id INT AUTO_INCREMENT PRIMARY KEY,
            deal_id  INT          NOT NULL,
            actor    VARCHAR(190) NULL,
            action   VARCHAR(80)  NOT NULL,
            from_val VARCHAR(255) NULL,
            to_val   VARCHAR(255) NULL,
            note     TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_deal (deal_id),
            INDEX idx_action (action),
            CONSTRAINT fk_us_ops_audit_deal
                FOREIGN KEY (deal_id) REFERENCES us_ops_deals(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $result['steps'][] = 'us_ops_audit OK';

    // -------------------------------------------------------
    //  3. us_ops_collaborators
    // -------------------------------------------------------
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS us_ops_collaborators (
            id INT AUTO_INCREMENT PRIMARY KEY,
            deal_id  INT          NOT NULL,
            name     VARCHAR(160) NOT NULL,
            role     VARCHAR(80)  NOT NULL,
            email    VARCHAR(190) NULL,
            phone    VARCHAR(60)  NULL,
            location VARCHAR(160) NULL,
            access_token VARCHAR(64) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_deal_email (deal_id, email),
            INDEX idx_deal (deal_id),
            CONSTRAINT fk_us_ops_collab_deal
                FOREIGN KEY (deal_id) REFERENCES us_ops_deals(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $result['steps'][] = 'us_ops_collaborators OK';

    // -------------------------------------------------------
    //  4. Seed the target deal so /USOperations/ can attach to it.
    // -------------------------------------------------------
    $check = $pdo->prepare("SELECT id FROM us_ops_deals WHERE deal_number = ? LIMIT 1");
    $check->execute(['US-2026-001']);
    if (!$check->fetchColumn()) {
        $payload = json_encode([
            'version' => 1,
            'dealNumber' => 'US-2026-001',
            'dealStatus' => 'Sourcing',
            'pipelineIndex' => 0,
            'makeModel' => 'TBD',
            'knownIssue' => 'TBD',
            'sourceUrl' => 'https://www.facebook.com/marketplace/item/976023998340848/',
            'fbItemId' => '976023998340848'
        ], JSON_UNESCAPED_SLASHES);
        $ins = $pdo->prepare("
            INSERT INTO us_ops_deals
                (deal_number, title, status, pipeline_index, source_url, source_id, payload)
            VALUES (?, ?, ?, 0, ?, ?, ?)
        ");
        $ins->execute([
            'US-2026-001',
            'Facebook Marketplace target boat',
            'Sourcing',
            'https://www.facebook.com/marketplace/item/976023998340848/',
            '976023998340848',
            $payload
        ]);
        $result['steps'][] = 'Seed deal US-2026-001 inserted';
    } else {
        $result['steps'][] = 'Seed deal US-2026-001 already present';
    }

    echo json_encode($result, JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => $e->getMessage(),
        'steps'   => $result['steps']
    ], JSON_PRETTY_PRINT);
}
