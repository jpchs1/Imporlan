<?php
/**
 * Config API - Imporlan
 *
 * CRUD endpoints para configuracion del sistema (planes, agentes, precios)
 *
 * Admin endpoints (require auth):
 * - GET  ?action=migrate               - Crear tablas
 * - GET  ?action=plans_list            - Listar planes
 * - POST ?action=plans_create          - Crear plan
 * - POST ?action=plans_update          - Actualizar plan
 * - POST ?action=plans_delete          - Eliminar plan
 * - GET  ?action=agents_list           - Listar agentes
 * - POST ?action=agents_create         - Crear agente
 * - POST ?action=agents_update         - Actualizar agente
 * - POST ?action=agents_delete         - Eliminar agente
 * - GET  ?action=pricing_get           - Obtener configuracion de precios
 * - POST ?action=pricing_update        - Actualizar precios
 */

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/auth_helper.php';

require_once __DIR__ . '/cors_helper.php';
setCorsHeadersSecure();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get':
        requireAdminAuthShared();
        settingsGet();
        break;
    case 'update':
        requireAdminAuthShared();
        settingsUpdate();
        break;
    case 'migrate':
        requireAdminAuthShared();
        configMigrate();
        break;
    case 'plans_list':
        requireAdminAuthShared();
        plansList();
        break;
    case 'plans_create':
        requireAdminAuthShared();
        plansCreate();
        break;
    case 'plans_update':
        requireAdminAuthShared();
        plansUpdate();
        break;
    case 'plans_delete':
        requireAdminAuthShared();
        plansDelete();
        break;
    case 'agents_list':
        requireAdminAuthShared();
        agentsList();
        break;
    case 'agents_create':
        requireAdminAuthShared();
        agentsCreate();
        break;
    case 'agents_update':
        requireAdminAuthShared();
        agentsUpdate();
        break;
    case 'agents_delete':
        requireAdminAuthShared();
        agentsDelete();
        break;
    case 'pricing_get':
        requireAdminAuthShared();
        pricingGet();
        break;
    case 'pricing_update':
        requireAdminAuthShared();
        pricingUpdate();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida']);
}

function settingsGet() {
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS site_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(100) NOT NULL UNIQUE,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $stmt = $pdo->query("SELECT setting_key, setting_value FROM site_settings");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $settings = [];
        foreach ($rows as $r) {
            $settings[$r['setting_key']] = $r['setting_value'];
        }
        echo json_encode(['success' => true, 'settings' => $settings]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function settingsUpdate() {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos requeridos']);
        return;
    }
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS site_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(100) NOT NULL UNIQUE,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $allowed = ['site_name', 'contact_email', 'phone', 'address', 'dollar_rate', 'whatsapp'];
        $stmt = $pdo->prepare("INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        foreach ($input as $key => $value) {
            if (in_array($key, $allowed)) {
                $stmt->execute([$key, $value]);
            }
        }
        echo json_encode(['success' => true, 'message' => 'Configuracion guardada']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function configMigrate() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS search_plans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price_clp INT DEFAULT 0,
                price_usd DECIMAL(10,2) DEFAULT 0,
                max_links INT DEFAULT 5,
                duration_days INT DEFAULT 30,
                features TEXT,
                is_active TINYINT(1) DEFAULT 1,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS agents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50),
                specialization VARCHAR(255),
                bio TEXT,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS pricing_config (
                id INT AUTO_INCREMENT PRIMARY KEY,
                config_key VARCHAR(100) NOT NULL UNIQUE,
                config_value TEXT,
                description VARCHAR(255),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $countPlans = $pdo->query("SELECT COUNT(*) FROM search_plans")->fetchColumn();
        if ($countPlans == 0) {
            $stmt = $pdo->prepare("INSERT INTO search_plans (name, description, price_clp, price_usd, max_links, duration_days, features, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute(['Plan Fragata', 'Monitoreo por 7 dias', 67600, 69.99, 5, 7, '1 Requerimiento especifico,5 propuestas/cotizaciones,Analisis ofertas y recomendacion,✗ Reporte IA', 1]);
            $stmt->execute(['Plan Capitan de Navio', 'Monitoreo por 14 dias', 119600, 124.99, 9, 14, '1 Requerimiento especifico,9 propuestas/cotizaciones,Analisis ofertas y recomendacion,✗ Reporte IA', 2]);
            $stmt->execute(['Plan Almirante', 'Monitoreo por 21 dias', 189600, 199.99, 15, 21, '1 Requerimiento especifico,15 propuestas/cotizaciones,Analisis ofertas y recomendacion,✓ Reporte IA incluido', 3]);
        }

        $countAgents = $pdo->query("SELECT COUNT(*) FROM agents")->fetchColumn();
        if ($countAgents == 0) {
            $stmt = $pdo->prepare("INSERT INTO agents (name, email, phone, specialization) VALUES (?, ?, ?, ?)");
            $stmt->execute(['Carlos Martinez', 'carlos@imporlan.cl', '+56 9 1234 5678', 'Lanchas y Botes']);
            $stmt->execute(['Maria Lopez', 'maria@imporlan.cl', '+56 9 8765 4321', 'Yates y Veleros']);
        }

        $countPricing = $pdo->query("SELECT COUNT(*) FROM pricing_config")->fetchColumn();
        if ($countPricing == 0) {
            $stmt = $pdo->prepare("INSERT INTO pricing_config (config_key, config_value, description) VALUES (?, ?, ?)");
            $stmt->execute(['default_currency', 'CLP', 'Moneda por defecto']);
            $stmt->execute(['usd_to_clp_rate', '950', 'Tipo de cambio USD a CLP']);
            $stmt->execute(['commission_percent', '10', 'Porcentaje de comision']);
            $stmt->execute(['tax_percent', '19', 'IVA porcentaje']);
            $stmt->execute(['min_order_clp', '50000', 'Monto minimo de orden en CLP']);
        }

        // Cotizador defaults — based on the official spreadsheet
        // Planilla de Costos Importacion Imporlan 2026.
        cotizadorSeedDefaults($pdo);
        cotizadorEnsureOrderLinkColumns($pdo);

        echo json_encode(['success' => true, 'message' => 'Config tables created/updated']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Migration failed: ' . $e->getMessage()]);
    }
}

function plansList() {
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }
    try {
        $stmt = $pdo->query("SELECT * FROM search_plans ORDER BY sort_order ASC, id ASC");
        $plans = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'plans' => $plans, 'total' => count($plans)]);
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), "doesn't exist") !== false) {
            ob_start();
            configMigrate();
            ob_end_clean();
            try {
                $stmt = $pdo->query("SELECT * FROM search_plans ORDER BY sort_order ASC, id ASC");
                $plans = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'plans' => $plans, 'total' => count($plans)]);
            } catch (PDOException $e2) {
                http_response_code(500);
                echo json_encode(['error' => 'Migration failed: ' . $e2->getMessage()]);
            }
            return;
        }
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function plansCreate() {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere name']);
        return;
    }
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }
    try {
        $stmt = $pdo->prepare("INSERT INTO search_plans (name, description, price_clp, price_usd, max_links, duration_days, features, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $maxOrder = $pdo->query("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM search_plans")->fetchColumn();
        $stmt->execute([
            $input['name'],
            $input['description'] ?? '',
            intval($input['price_clp'] ?? 0),
            floatval($input['price_usd'] ?? 0),
            intval($input['max_links'] ?? 5),
            intval($input['duration_days'] ?? 30),
            $input['features'] ?? '',
            intval($input['is_active'] ?? 1),
            intval($input['sort_order'] ?? $maxOrder)
        ]);
        echo json_encode(['success' => true, 'id' => intval($pdo->lastInsertId()), 'message' => 'Plan creado']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function plansUpdate() {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Se requiere id']); return; }
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }
    try {
        $allowed = ['name', 'description', 'price_clp', 'price_usd', 'max_links', 'duration_days', 'features', 'is_active', 'sort_order'];
        $sets = []; $params = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $input)) { $sets[] = "$f = ?"; $params[] = $input[$f]; }
        }
        if (empty($sets)) { http_response_code(400); echo json_encode(['error' => 'Nada que actualizar']); return; }
        $params[] = $id;
        $pdo->prepare("UPDATE search_plans SET " . implode(', ', $sets) . " WHERE id = ?")->execute($params);
        echo json_encode(['success' => true, 'message' => 'Plan actualizado']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function plansDelete() {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Se requiere id']); return; }
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }
    try {
        $pdo->prepare("DELETE FROM search_plans WHERE id = ?")->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Plan eliminado']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function agentsList() {
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }
    try {
        $stmt = $pdo->query("SELECT * FROM agents ORDER BY id ASC");
        $agents = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'agents' => $agents, 'total' => count($agents)]);
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), "doesn't exist") !== false) {
            ob_start();
            configMigrate();
            ob_end_clean();
            try {
                $stmt = $pdo->query("SELECT * FROM agents ORDER BY id ASC");
                $agents = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'agents' => $agents, 'total' => count($agents)]);
            } catch (PDOException $e2) {
                http_response_code(500);
                echo json_encode(['error' => 'Migration failed: ' . $e2->getMessage()]);
            }
            return;
        }
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function agentsCreate() {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere name']);
        return;
    }
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }
    try {
        $stmt = $pdo->prepare("INSERT INTO agents (name, email, phone, specialization, bio, is_active) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['name'],
            $input['email'] ?? '',
            $input['phone'] ?? '',
            $input['specialization'] ?? '',
            $input['bio'] ?? '',
            intval($input['is_active'] ?? 1)
        ]);
        echo json_encode(['success' => true, 'id' => intval($pdo->lastInsertId()), 'message' => 'Agente creado']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function agentsUpdate() {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Se requiere id']); return; }
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }
    try {
        $allowed = ['name', 'email', 'phone', 'specialization', 'bio', 'is_active'];
        $sets = []; $params = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $input)) { $sets[] = "$f = ?"; $params[] = $input[$f]; }
        }
        if (empty($sets)) { http_response_code(400); echo json_encode(['error' => 'Nada que actualizar']); return; }
        $params[] = $id;
        $pdo->prepare("UPDATE agents SET " . implode(', ', $sets) . " WHERE id = ?")->execute($params);
        echo json_encode(['success' => true, 'message' => 'Agente actualizado']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function agentsDelete() {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Se requiere id']); return; }
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }
    try {
        $pdo->prepare("DELETE FROM agents WHERE id = ?")->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Agente eliminado']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function pricingGet() {
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }
    try {
        // Lazy-init cotizador defaults so old installations get the new keys
        // automatically the first time the admin opens the Cotizador tab.
        try { cotizadorSeedDefaults($pdo); cotizadorEnsureOrderLinkColumns($pdo); } catch (PDOException $e) { /* ignore */ }

        $stmt = $pdo->query("SELECT * FROM pricing_config ORDER BY id ASC");
        $configs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $result = [];
        foreach ($configs as $c) {
            $result[$c['config_key']] = ['value' => $c['config_value'], 'description' => $c['description'], 'id' => $c['id']];
        }
        echo json_encode(['success' => true, 'pricing' => $result]);
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), "doesn't exist") !== false) {
            ob_start();
            configMigrate();
            ob_end_clean();
            try {
                $stmt = $pdo->query("SELECT * FROM pricing_config ORDER BY id ASC");
                $configs = $stmt->fetchAll(PDO::FETCH_ASSOC);
                $result = [];
                foreach ($configs as $c) {
                    $result[$c['config_key']] = ['value' => $c['config_value'], 'description' => $c['description'], 'id' => $c['id']];
                }
                echo json_encode(['success' => true, 'pricing' => $result]);
            } catch (PDOException $e2) {
                http_response_code(500);
                echo json_encode(['error' => 'Migration failed: ' . $e2->getMessage()]);
            }
            return;
        }
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function pricingUpdate() {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Body JSON invalido']);
        return;
    }
    // Accept either { configs: {key: value, ...} } (canonical) or
    // {key: value, ...} or {key: {value, ...}, ...} (frontend's getPricing shape).
    $raw = $input['configs'] ?? $input;
    if (!is_array($raw) || empty($raw)) {
        http_response_code(400);
        echo json_encode(['error' => 'No hay valores para guardar']);
        return;
    }
    $configs = [];
    foreach ($raw as $k => $v) {
        if (is_array($v) && isset($v['value'])) $v = $v['value'];
        if ($v === null) continue;
        $configs[$k] = (string)$v;
    }
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }
    try {
        // Upsert so new keys (e.g. cot_*) created in the UI also persist.
        $stmt = $pdo->prepare("
            INSERT INTO pricing_config (config_key, config_value)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)
        ");
        foreach ($configs as $key => $value) {
            $stmt->execute([$key, $value]);
        }
        echo json_encode(['success' => true, 'updated' => count($configs)]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}


/**
 * Default values for the importation cost calculator (cotizador), seeded from
 * the "Planilla de Costos Importacion Imporlan 2026" spreadsheet. Stored as
 * cot_<currency>_<key> entries in the existing pricing_config key/value table.
 *
 * Idempotent: only inserts keys that don't already exist, so admin edits made
 * via the panel are never overwritten on re-migrate.
 */
function cotizadorSeedDefaults(PDO $pdo): void {
    $defaults = [
        // Tipo de cambio
        ['cot_usd_clp_rate', '920', 'Tipo de cambio USD a CLP (cotizador)'],

        // Costos en USD (defaults editables por cotizacion)
        ['cot_usd_trailer', '0', 'Trailer (solo si no trae) - USD'],
        ['cot_usd_inspeccion_lancha', '850', 'Revision Lancha USA - Inspeccion Tecnica - USD'],
        ['cot_usd_inland_usa', '2100', 'Inland USA - Bodegaje y Entrega en Puerto - USD'],
        ['cot_usd_transporte_roro', '8500', 'Transporte Maritimo (RORO) - USD'],
        ['cot_usd_certificado_fumigacion', '400', 'Certificado de Fumigacion - USD'],
        ['cot_usd_seguro', '320', 'Seguro / Insurance - USD'],
        ['cot_usd_gastos_locales_naviera', '450', 'Gastos Locales Naviera - USD'],
        ['cot_usd_congestion_surcharge', '0', 'Congestion Surcharge (Naviera) - USD'],
        ['cot_usd_thc', '160', 'THC - USD'],
        ['cot_usd_baf', '615', 'BAF (Impuesto) - USD'],
        ['cot_usd_wharfage', '252', 'WHARFAGE - USD'],
        ['cot_usd_handling_chile', '150', 'Handling Chile - USD'],
        ['cot_usd_miami_admin_fee', '150', 'Miami Admin FEE - USD'],
        ['cot_usd_escorte', '0', 'Escorte (Port Pass) - USD'],

        // Costos en CLP (defaults editables por cotizacion)
        ['cot_clp_fee_wire_transfer', '240000', 'FEE Wire Transferencia - CLP'],
        ['cot_clp_inland_puerto_santiago', '349000', 'Inland Puerto - Santiago - CLP'],
        ['cot_clp_chequeo_mecanico', '209000', 'Chequeo Mecanico Chile - CLP'],
        ['cot_clp_pulido_tratamiento', '186400', 'Pulido y Tratamiento Chile - CLP'],
        ['cot_clp_entrega_traslado', '0', 'Entrega / Traslado en Chile - CLP'],
        ['cot_clp_aduana_extra', '220018', 'Aduana Asciende a M$1.2 + IVA - CLP'],
        ['cot_clp_autorizaciones', '80000', 'Autorizaciones - CLP (gross)'],
        ['cot_clp_gastos_puerto', '400000', 'Gastos de Puerto - CLP (gross)'],
        ['cot_clp_agencia_aduana', '280000', 'Agencia de Aduana - CLP (gross)'],
        ['cot_clp_iva_servicios_linea', '100107', 'IVA Servicios linea - CLP'],
        ['cot_clp_gastos_despachos', '47924', 'Gastos de Despachos - CLP'],
        ['cot_clp_honorarios_agencia', '71951', 'Honorarios Agencia - CLP'],

        // Porcentajes y cargos
        ['cot_pct_iva_aduanero', '19', 'IVA Aduanero (% sobre CIF)'],
        ['cot_pct_impuesto_lujo', '2', 'Impuesto al Lujo (% sobre valor lancha cuando aplica)'],
        ['cot_clp_fee_imporlan_default', '3000000', 'FEE Imporlan default - CLP'],

        // Estructura de pagos
        ['cot_pago_1_pct', '7', 'Pago 1 (%)'],
        ['cot_pago_2_pct', '63', 'Pago 2 (%)'],
        ['cot_pago_3_pct', '30', 'Pago 3 (%)'],

        // Visibilidad cliente
        ['cot_client_delay_hours', '24', 'Horas de delay antes de mostrar cotizacion al cliente'],
    ];

    $stmt = $pdo->prepare("INSERT IGNORE INTO pricing_config (config_key, config_value, description) VALUES (?, ?, ?)");
    foreach ($defaults as [$k, $v, $desc]) {
        $stmt->execute([$k, $v, $desc]);
    }
}

/**
 * cotizadorEnsureOrderLinkColumns now lives in cotizador_helpers.php so the
 * cron and lazy-publish paths can self-migrate without going through this
 * file. Keep this stub for any old callers.
 */
require_once __DIR__ . '/cotizador_helpers.php';
