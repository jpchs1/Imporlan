<?php
/**
 * Audit API - Imporlan
 *
 * Endpoints para sistema de auditoria del panel admin
 *
 * Admin endpoints (require auth):
 * - POST ?action=log       - Registrar accion de auditoria
 * - GET  ?action=list      - Listar logs con filtros
 * - GET  ?action=detail&id=X - Detalle de un log
 * - GET  ?action=migrate   - Crear tabla audit_log
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
        auditMigrate();
        break;
    case 'log':
        requireAdminAuthShared();
        auditLog();
        break;
    case 'list':
        requireAdminAuthShared();
        auditList();
        break;
    case 'detail':
        requireAdminAuthShared();
        auditDetail();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida. Use: migrate, log, list, detail']);
}

function auditMigrate() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS audit_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                user_name VARCHAR(255),
                action_type ENUM('status_change','expediente_edit','link_modification','payment_change') NOT NULL,
                entity_type VARCHAR(50),
                entity_id INT,
                old_value TEXT,
                new_value TEXT,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_created_at (created_at),
                INDEX idx_user_email (user_email),
                INDEX idx_entity (entity_type, entity_id),
                INDEX idx_action_type (action_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        echo json_encode(['success' => true, 'message' => 'audit_log table created/updated']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Migration failed: ' . $e->getMessage()]);
    }
}

function auditLog() {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['action_type'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere action_type']);
        return;
    }
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $stmt = $pdo->prepare("
            INSERT INTO audit_log (user_email, user_name, action_type, entity_type, entity_id, old_value, new_value, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $input['user_email'] ?? '',
            $input['user_name'] ?? '',
            $input['action_type'],
            $input['entity_type'] ?? null,
            intval($input['entity_id'] ?? 0) ?: null,
            is_array($input['old_value'] ?? null) ? json_encode($input['old_value']) : ($input['old_value'] ?? null),
            is_array($input['new_value'] ?? null) ? json_encode($input['new_value']) : ($input['new_value'] ?? null),
            $input['description'] ?? null
        ]);
        echo json_encode(['success' => true, 'id' => intval($pdo->lastInsertId())]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al registrar: ' . $e->getMessage()]);
    }
}

function auditList() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $where = [];
        $params = [];
        if (!empty($_GET['action_type'])) {
            $where[] = 'action_type = ?';
            $params[] = $_GET['action_type'];
        }
        if (!empty($_GET['user_email'])) {
            $where[] = 'user_email LIKE ?';
            $params[] = '%' . $_GET['user_email'] . '%';
        }
        if (!empty($_GET['entity_type'])) {
            $where[] = 'entity_type = ?';
            $params[] = $_GET['entity_type'];
        }
        if (!empty($_GET['entity_id'])) {
            $where[] = 'entity_id = ?';
            $params[] = intval($_GET['entity_id']);
        }
        if (!empty($_GET['from_date'])) {
            $where[] = 'created_at >= ?';
            $params[] = $_GET['from_date'] . ' 00:00:00';
        }
        if (!empty($_GET['to_date'])) {
            $where[] = 'created_at <= ?';
            $params[] = $_GET['to_date'] . ' 23:59:59';
        }
        $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = min(100, max(10, intval($_GET['limit'] ?? 50)));
        $offset = ($page - 1) * $limit;
        $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM audit_log $whereClause");
        $countStmt->execute($params);
        $total = intval($countStmt->fetch(PDO::FETCH_ASSOC)['total']);
        $stmt = $pdo->prepare("
            SELECT * FROM audit_log
            $whereClause
            ORDER BY created_at DESC
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode([
            'success' => true,
            'logs' => $logs,
            'total' => $total,
            'page' => $page,
            'pages' => ceil($total / $limit)
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al listar: ' . $e->getMessage()]);
    }
}

function auditDetail() {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere id']);
        return;
    }
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $stmt = $pdo->prepare("SELECT * FROM audit_log WHERE id = ?");
        $stmt->execute([$id]);
        $log = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$log) {
            http_response_code(404);
            echo json_encode(['error' => 'Log no encontrado']);
            return;
        }
        echo json_encode(['success' => true, 'log' => $log]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener detalle: ' . $e->getMessage()]);
    }
}
