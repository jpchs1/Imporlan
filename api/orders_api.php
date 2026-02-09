<?php
/**
 * Orders (Expedientes) API - Imporlan
 * 
 * Endpoints para gestionar expedientes de busqueda y links contratados
 * 
 * User endpoints:
 * - GET  ?action=user_list&user_email=X        - Listar expedientes del usuario
 * - GET  ?action=user_detail&id=X&user_email=X - Detalle de un expediente
 * 
 * Admin endpoints (require auth):
 * - GET  ?action=admin_list                     - Listar todos los expedientes
 * - GET  ?action=admin_detail&id=X              - Detalle de expediente (admin)
 * - POST ?action=admin_update                   - Actualizar expediente
 * - POST ?action=admin_update_links             - Actualizar links de un expediente
 * - POST ?action=admin_add_link                 - Agregar link a expediente
 * - POST ?action=admin_delete_link              - Eliminar link de expediente
 * - POST ?action=admin_create                   - Crear expediente manualmente
 * - GET  ?action=migrate                        - Crear tablas en la BD
 */

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/auth_helper.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'migrate':
        runMigration();
        break;
    case 'user_list':
        userListOrders();
        break;
    case 'user_detail':
        userGetOrderDetail();
        break;
    case 'admin_list':
        requireAdminAuth();
        adminListOrders();
        break;
    case 'admin_detail':
        requireAdminAuth();
        adminGetOrderDetail();
        break;
    case 'admin_update':
        requireAdminAuth();
        adminUpdateOrder();
        break;
    case 'admin_update_links':
        requireAdminAuth();
        adminUpdateLinks();
        break;
    case 'admin_add_link':
        requireAdminAuth();
        adminAddLink();
        break;
    case 'admin_delete_link':
        requireAdminAuth();
        adminDeleteLink();
        break;
    case 'admin_create':
        requireAdminAuth();
        adminCreateOrder();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida']);
}

function requireAdminAuth() {
    return requireAdminAuthShared();
}

function runMigration() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_number VARCHAR(50) UNIQUE NOT NULL,
                customer_id VARCHAR(100),
                customer_email VARCHAR(255) NOT NULL,
                customer_name VARCHAR(255) NOT NULL,
                plan_name VARCHAR(255),
                requirement_name TEXT,
                asset_name VARCHAR(255),
                type_zone VARCHAR(255),
                agent_user_id VARCHAR(100),
                agent_name VARCHAR(255),
                agent_phone VARCHAR(50),
                status ENUM('new','pending_admin_fill','in_progress','completed','expired','canceled') DEFAULT 'new',
                purchase_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_customer (customer_email),
                INDEX idx_status (status),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS order_links (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                row_index INT NOT NULL,
                url TEXT,
                title VARCHAR(500),
                value_usa_usd DECIMAL(12,2),
                value_to_negotiate_usd DECIMAL(12,2),
                value_chile_clp DECIMAL(12,0),
                value_chile_negotiated_clp DECIMAL(12,0),
                selection_order INT,
                comments TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                INDEX idx_order (order_id, row_index)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS order_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                event_type VARCHAR(100) NOT NULL,
                meta_json TEXT,
                user_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                INDEX idx_order_events (order_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        echo json_encode(['success' => true, 'message' => 'Tables created successfully']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Migration failed: ' . $e->getMessage()]);
    }
}

function generateOrderNumber($pdo) {
    $year = date('Y');
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM orders WHERE YEAR(created_at) = $year");
    $row = $stmt->fetch();
    $seq = ($row['cnt'] ?? 0) + 1;
    return sprintf("EXP-%s-%03d", $year, $seq);
}

function logOrderEvent($pdo, $orderId, $eventType, $meta = [], $userId = null) {
    $stmt = $pdo->prepare("INSERT INTO order_events (order_id, event_type, meta_json, user_id) VALUES (?, ?, ?, ?)");
    $stmt->execute([$orderId, $eventType, json_encode($meta), $userId]);
}

function userListOrders() {
    $userEmail = $_GET['user_email'] ?? '';
    $userId = $_GET['user_id'] ?? '';

    if (!$userEmail && !$userId) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere user_email o user_id']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $where = '';
        $params = [];
        if ($userEmail) {
            $where = 'WHERE customer_email = ?';
            $params[] = $userEmail;
        } else {
            $where = 'WHERE customer_id = ?';
            $params[] = $userId;
        }

        $stmt = $pdo->prepare("
            SELECT id, order_number, customer_email, customer_name, plan_name,
                   requirement_name, asset_name, type_zone, agent_name, agent_phone,
                   status, created_at, updated_at
            FROM orders
            $where
            ORDER BY created_at DESC
        ");
        $stmt->execute($params);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'orders' => $orders]);
    } catch (PDOException $e) {
        error_log("Error listing user orders: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener expedientes']);
    }
}

function userGetOrderDetail() {
    $orderId = intval($_GET['id'] ?? 0);
    $userEmail = $_GET['user_email'] ?? '';
    $userId = $_GET['user_id'] ?? '';

    if (!$orderId || (!$userEmail && !$userId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere id y user_email o user_id']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $where = 'WHERE o.id = ?';
        $params = [$orderId];
        if ($userEmail) {
            $where .= ' AND o.customer_email = ?';
            $params[] = $userEmail;
        } else {
            $where .= ' AND o.customer_id = ?';
            $params[] = $userId;
        }

        $stmt = $pdo->prepare("
            SELECT o.* FROM orders o $where
        ");
        $stmt->execute($params);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            http_response_code(404);
            echo json_encode(['error' => 'Expediente no encontrado']);
            return;
        }

        $linkStmt = $pdo->prepare("
            SELECT * FROM order_links WHERE order_id = ? ORDER BY row_index ASC
        ");
        $linkStmt->execute([$orderId]);
        $links = $linkStmt->fetchAll(PDO::FETCH_ASSOC);

        $order['links'] = $links;

        echo json_encode(['success' => true, 'order' => $order]);
    } catch (PDOException $e) {
        error_log("Error getting order detail: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener expediente']);
    }
}

function adminListOrders() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $where = [];
        $params = [];

        if (!empty($_GET['status'])) {
            $where[] = 'status = ?';
            $params[] = $_GET['status'];
        }
        if (!empty($_GET['agent'])) {
            $where[] = 'agent_name LIKE ?';
            $params[] = '%' . $_GET['agent'] . '%';
        }
        if (!empty($_GET['from_date'])) {
            $where[] = 'created_at >= ?';
            $params[] = $_GET['from_date'] . ' 00:00:00';
        }
        if (!empty($_GET['to_date'])) {
            $where[] = 'created_at <= ?';
            $params[] = $_GET['to_date'] . ' 23:59:59';
        }
        if (!empty($_GET['search'])) {
            $where[] = '(customer_name LIKE ? OR customer_email LIKE ? OR order_number LIKE ? OR asset_name LIKE ?)';
            $search = '%' . $_GET['search'] . '%';
            $params = array_merge($params, [$search, $search, $search, $search]);
        }

        $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

        $stmt = $pdo->prepare("
            SELECT id, order_number, customer_email, customer_name, plan_name,
                   requirement_name, asset_name, type_zone, agent_name, agent_phone,
                   status, purchase_id, created_at, updated_at
            FROM orders
            $whereClause
            ORDER BY created_at DESC
        ");
        $stmt->execute($params);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $countStmt = $pdo->query("SELECT COUNT(*) as total FROM orders");
        $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

        echo json_encode(['success' => true, 'orders' => $orders, 'total' => intval($total)]);
    } catch (PDOException $e) {
        error_log("Error listing admin orders: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener expedientes']);
    }
}

function adminGetOrderDetail() {
    $orderId = intval($_GET['id'] ?? 0);

    if (!$orderId) {
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
        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            http_response_code(404);
            echo json_encode(['error' => 'Expediente no encontrado']);
            return;
        }

        $linkStmt = $pdo->prepare("
            SELECT * FROM order_links WHERE order_id = ? ORDER BY row_index ASC
        ");
        $linkStmt->execute([$orderId]);
        $links = $linkStmt->fetchAll(PDO::FETCH_ASSOC);

        $eventStmt = $pdo->prepare("
            SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC LIMIT 50
        ");
        $eventStmt->execute([$orderId]);
        $events = $eventStmt->fetchAll(PDO::FETCH_ASSOC);

        $order['links'] = $links;
        $order['events'] = $events;

        echo json_encode(['success' => true, 'order' => $order]);
    } catch (PDOException $e) {
        error_log("Error getting admin order detail: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener expediente']);
    }
}

function adminUpdateOrder() {
    $input = json_decode(file_get_contents('php://input'), true);
    $orderId = intval($input['id'] ?? 0);

    if (!$orderId) {
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

    $allowedFields = [
        'plan_name', 'requirement_name', 'asset_name', 'type_zone',
        'agent_user_id', 'agent_name', 'agent_phone', 'status',
        'customer_name', 'customer_email'
    ];

    $sets = [];
    $params = [];
    $changes = [];

    foreach ($allowedFields as $field) {
        if (array_key_exists($field, $input)) {
            $sets[] = "$field = ?";
            $params[] = $input[$field];
            $changes[$field] = $input[$field];
        }
    }

    if (empty($sets)) {
        http_response_code(400);
        echo json_encode(['error' => 'No hay campos para actualizar']);
        return;
    }

    $params[] = $orderId;

    try {
        $stmt = $pdo->prepare("UPDATE orders SET " . implode(', ', $sets) . " WHERE id = ?");
        $stmt->execute($params);

        logOrderEvent($pdo, $orderId, 'order_updated', $changes, $input['admin_user_id'] ?? null);

        echo json_encode(['success' => true, 'message' => 'Expediente actualizado']);
    } catch (PDOException $e) {
        error_log("Error updating order: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al actualizar expediente']);
    }
}

function adminUpdateLinks() {
    $input = json_decode(file_get_contents('php://input'), true);
    $orderId = intval($input['order_id'] ?? 0);
    $links = $input['links'] ?? [];

    if (!$orderId) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere order_id']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $pdo->beginTransaction();

        foreach ($links as $link) {
            $linkId = intval($link['id'] ?? 0);
            if ($linkId) {
                $stmt = $pdo->prepare("
                    UPDATE order_links SET
                        url = ?, title = ?, value_usa_usd = ?, value_to_negotiate_usd = ?,
                        value_chile_clp = ?, value_chile_negotiated_clp = ?,
                        selection_order = ?, comments = ?
                    WHERE id = ? AND order_id = ?
                ");
                $stmt->execute([
                    $link['url'] ?? null,
                    $link['title'] ?? null,
                    $link['value_usa_usd'] ?? null,
                    $link['value_to_negotiate_usd'] ?? null,
                    $link['value_chile_clp'] ?? null,
                    $link['value_chile_negotiated_clp'] ?? null,
                    $link['selection_order'] ?? null,
                    $link['comments'] ?? null,
                    $linkId,
                    $orderId
                ]);
            }
        }

        $pdo->commit();

        logOrderEvent($pdo, $orderId, 'links_updated', ['count' => count($links)], $input['admin_user_id'] ?? null);

        echo json_encode(['success' => true, 'message' => 'Links actualizados']);
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log("Error updating links: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al actualizar links']);
    }
}

function adminAddLink() {
    $input = json_decode(file_get_contents('php://input'), true);
    $orderId = intval($input['order_id'] ?? 0);

    if (!$orderId) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere order_id']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $maxStmt = $pdo->prepare("SELECT COALESCE(MAX(row_index), 0) + 1 as next_index FROM order_links WHERE order_id = ?");
        $maxStmt->execute([$orderId]);
        $nextIndex = $maxStmt->fetch(PDO::FETCH_ASSOC)['next_index'];

        $stmt = $pdo->prepare("
            INSERT INTO order_links (order_id, row_index, url, title, value_usa_usd, value_to_negotiate_usd, value_chile_clp, value_chile_negotiated_clp, selection_order, comments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $orderId,
            $nextIndex,
            $input['url'] ?? null,
            $input['title'] ?? null,
            $input['value_usa_usd'] ?? null,
            $input['value_to_negotiate_usd'] ?? null,
            $input['value_chile_clp'] ?? null,
            $input['value_chile_negotiated_clp'] ?? null,
            $input['selection_order'] ?? null,
            $input['comments'] ?? null
        ]);

        $linkId = $pdo->lastInsertId();
        logOrderEvent($pdo, $orderId, 'link_added', ['link_id' => $linkId, 'row_index' => $nextIndex]);

        echo json_encode(['success' => true, 'link_id' => intval($linkId), 'row_index' => intval($nextIndex)]);
    } catch (PDOException $e) {
        error_log("Error adding link: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al agregar link']);
    }
}

function adminDeleteLink() {
    $input = json_decode(file_get_contents('php://input'), true);
    $linkId = intval($input['link_id'] ?? 0);
    $orderId = intval($input['order_id'] ?? 0);

    if (!$linkId || !$orderId) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere link_id y order_id']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM order_links WHERE id = ? AND order_id = ?");
        $stmt->execute([$linkId, $orderId]);

        logOrderEvent($pdo, $orderId, 'link_deleted', ['link_id' => $linkId]);

        echo json_encode(['success' => true, 'message' => 'Link eliminado']);
    } catch (PDOException $e) {
        error_log("Error deleting link: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al eliminar link']);
    }
}

function adminCreateOrder() {
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['customer_email']) || empty($input['customer_name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere customer_email y customer_name']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $orderNumber = generateOrderNumber($pdo);

        $stmt = $pdo->prepare("
            INSERT INTO orders (order_number, customer_id, customer_email, customer_name, plan_name, requirement_name, asset_name, type_zone, agent_user_id, agent_name, agent_phone, status, purchase_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $orderNumber,
            $input['customer_id'] ?? null,
            $input['customer_email'],
            $input['customer_name'],
            $input['plan_name'] ?? null,
            $input['requirement_name'] ?? null,
            $input['asset_name'] ?? null,
            $input['type_zone'] ?? null,
            $input['agent_user_id'] ?? null,
            $input['agent_name'] ?? null,
            $input['agent_phone'] ?? null,
            $input['status'] ?? 'new',
            $input['purchase_id'] ?? null
        ]);

        $orderId = intval($pdo->lastInsertId());

        $linkCount = intval($input['initial_links'] ?? 10);
        for ($i = 1; $i <= $linkCount; $i++) {
            $pdo->prepare("INSERT INTO order_links (order_id, row_index) VALUES (?, ?)")->execute([$orderId, $i]);
        }

        logOrderEvent($pdo, $orderId, 'created', [
            'order_number' => $orderNumber,
            'source' => $input['source'] ?? 'manual'
        ], $input['admin_user_id'] ?? null);

        echo json_encode([
            'success' => true,
            'order_id' => $orderId,
            'order_number' => $orderNumber,
            'message' => 'Expediente creado exitosamente'
        ]);
    } catch (PDOException $e) {
        error_log("Error creating order: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al crear expediente: ' . $e->getMessage()]);
    }
}

function createOrderFromPurchase($purchase) {
    $pdo = getDbConnection();
    if (!$pdo) {
        error_log("Orders: Cannot create order - DB connection failed");
        return null;
    }

    try {
        $orderNumber = generateOrderNumber($pdo);

        $stmt = $pdo->prepare("
            INSERT INTO orders (order_number, customer_id, customer_email, customer_name, plan_name, requirement_name, asset_name, type_zone, status, purchase_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)
        ");
        $stmt->execute([
            $orderNumber,
            $purchase['customer_id'] ?? null,
            $purchase['user_email'] ?? $purchase['customer_email'] ?? '',
            $purchase['customer_name'] ?? explode('@', $purchase['user_email'] ?? '')[0],
            $purchase['plan_name'] ?? '',
            $purchase['description'] ?? '',
            $purchase['asset_name'] ?? '',
            $purchase['type_zone'] ?? '',
            $purchase['id'] ?? $purchase['purchase_id'] ?? null
        ]);

        $orderId = intval($pdo->lastInsertId());

        for ($i = 1; $i <= 10; $i++) {
            $pdo->prepare("INSERT INTO order_links (order_id, row_index) VALUES (?, ?)")->execute([$orderId, $i]);
        }

        logOrderEvent($pdo, $orderId, 'created', [
            'order_number' => $orderNumber,
            'source' => 'purchase',
            'purchase_id' => $purchase['id'] ?? null
        ]);

        return $orderId;
    } catch (PDOException $e) {
        error_log("Error creating order from purchase: " . $e->getMessage());
        return null;
    }
}

function createOrderFromQuotation($purchase, $storedLinks = []) {
    $pdo = getDbConnection();
    if (!$pdo) {
        error_log("Orders: Cannot create order from quotation - DB connection failed");
        return null;
    }

    try {
        $orderNumber = generateOrderNumber($pdo);

        $stmt = $pdo->prepare("
            INSERT INTO orders (order_number, customer_id, customer_email, customer_name, plan_name, requirement_name, status, purchase_id)
            VALUES (?, ?, ?, ?, ?, ?, 'new', ?)
        ");
        $stmt->execute([
            $orderNumber,
            $purchase['customer_id'] ?? null,
            $purchase['user_email'] ?? $purchase['customer_email'] ?? '',
            $purchase['customer_name'] ?? explode('@', $purchase['user_email'] ?? '')[0],
            $purchase['plan_name'] ?? 'Cotizacion por Links',
            $purchase['description'] ?? '',
            $purchase['id'] ?? $purchase['purchase_id'] ?? null
        ]);

        $orderId = intval($pdo->lastInsertId());

        if (!empty($storedLinks)) {
            foreach ($storedLinks as $index => $link) {
                $url = is_array($link) ? ($link['url'] ?? $link['link'] ?? '') : $link;
                $title = is_array($link) ? ($link['title'] ?? '') : '';
                $pdo->prepare("INSERT INTO order_links (order_id, row_index, url, title) VALUES (?, ?, ?, ?)")
                    ->execute([$orderId, $index + 1, $url, $title]);
            }
            $remaining = 10 - count($storedLinks);
            for ($i = 0; $i < $remaining; $i++) {
                $pdo->prepare("INSERT INTO order_links (order_id, row_index) VALUES (?, ?)")
                    ->execute([$orderId, count($storedLinks) + $i + 1]);
            }
        } else {
            for ($i = 1; $i <= 10; $i++) {
                $pdo->prepare("INSERT INTO order_links (order_id, row_index) VALUES (?, ?)")->execute([$orderId, $i]);
            }
        }

        logOrderEvent($pdo, $orderId, 'created', [
            'order_number' => $orderNumber,
            'source' => 'quotation',
            'links_count' => count($storedLinks)
        ]);

        return $orderId;
    } catch (PDOException $e) {
        error_log("Error creating order from quotation: " . $e->getMessage());
        return null;
    }
}
