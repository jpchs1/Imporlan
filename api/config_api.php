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

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = $_GET['action'] ?? '';

switch ($action) {
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
            $stmt->execute(['Plan Fragata', 'Monitoreo por 7 dias', 67600, 69.99, 5, 7, '1 Requerimiento especifico,5 propuestas/cotizaciones,Analisis ofertas y recomendacion', 1]);
            $stmt->execute(['Plan Capitan de Navio', 'Monitoreo por 14 dias', 119600, 124.99, 9, 14, '1 Requerimiento especifico,9 propuestas/cotizaciones,Analisis ofertas y recomendacion', 2]);
            $stmt->execute(['Plan Almirante', 'Monitoreo por 21 dias', 189600, 199.99, 15, 21, '1 Requerimiento especifico,15 propuestas/cotizaciones,Analisis ofertas y recomendacion', 3]);
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
        $stmt = $pdo->query("SELECT * FROM pricing_config ORDER BY id ASC");
        $configs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $result = [];
        foreach ($configs as $c) {
            $result[$c['config_key']] = ['value' => $c['config_value'], 'description' => $c['description'], 'id' => $c['id']];
        }
        echo json_encode(['success' => true, 'pricing' => $result]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function pricingUpdate() {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['configs'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere configs']);
        return;
    }
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }
    try {
        $stmt = $pdo->prepare("UPDATE pricing_config SET config_value = ? WHERE config_key = ?");
        foreach ($input['configs'] as $key => $value) {
            $stmt->execute([$value, $key]);
        }
        echo json_encode(['success' => true, 'message' => 'Configuracion actualizada']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}
