<?php
/**
 * Tracking API - Imporlan Maritime Tracking
 * 
 * Public endpoints:
 * - GET ?action=featured                    - Get featured vessels
 * - GET ?action=vessel_detail&id=X          - Get vessel detail
 * - GET ?action=vessel_positions&id=X       - Get vessel position history
 * - GET ?action=public_tracking&token=X     - Public tracking by token
 * 
 * Admin endpoints (require auth):
 * - GET  ?action=admin_list_vessels         - List all vessels
 * - POST ?action=admin_create_vessel        - Create vessel
 * - POST ?action=admin_update_vessel        - Update vessel
 * - POST ?action=admin_delete_vessel        - Delete vessel
 * - POST ?action=admin_rotate_featured      - Rotate featured vessels
 * - POST ?action=admin_assign_vessel        - Assign vessel to order
 * - POST ?action=admin_add_position         - Add manual position
 * - GET  ?action=admin_lookup_vessel        - Lookup vessel by name/IMO/MMSI from VesselFinder
 * - GET  ?action=migrate                    - Create/update tables
 * 
 * Cron endpoint (require token):
 * - GET  ?action=run_position_update&token=X - Trigger AISstream position update via HTTP
 * 
 * Tracking config endpoints (require admin auth):
 * - GET  ?action=tracking_config_get         - Get tracking configuration
 * - POST ?action=tracking_config_save        - Save tracking configuration
 */

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/auth_helper.php';
require_once __DIR__ . '/tracking/ais_provider.php';

if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
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
            requireAdminAuth();
            runTrackingMigration();
            break;
        case 'featured':
            getFeaturedVessels();
            break;
        case 'vessel_detail':
            getVesselDetail();
            break;
        case 'vessel_positions':
            getVesselPositions();
            break;
        case 'public_tracking':
            getPublicTracking();
            break;
        case 'admin_list_vessels':
            requireAdminAuth();
            adminListVessels();
            break;
        case 'admin_create_vessel':
            requireAdminAuth();
            adminCreateVessel();
            break;
        case 'admin_update_vessel':
            requireAdminAuth();
            adminUpdateVessel();
            break;
        case 'admin_delete_vessel':
            requireAdminAuth();
            adminDeleteVessel();
            break;
        case 'admin_rotate_featured':
            requireAdminAuth();
            adminRotateFeatured();
            break;
        case 'admin_assign_vessel':
            requireAdminAuth();
            adminAssignVessel();
            break;
        case 'admin_add_position':
            requireAdminAuth();
            adminAddPosition();
            break;
        case 'admin_lookup_vessel':
            requireAdminAuth();
            adminLookupVessel();
            break;
        case 'run_position_update':
            runPositionUpdateViaHTTP();
            break;
        case 'tracking_config_get':
            requireAdminAuth();
            trackingConfigGet();
            break;
        case 'tracking_config_save':
            requireAdminAuth();
            trackingConfigSave();
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Accion no valida']);
    }
}

function requireAdminAuth() {
    return requireAdminAuthShared();
}

function runTrackingMigration() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS vessels (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type ENUM('auto','manual') NOT NULL DEFAULT 'manual',
                display_name VARCHAR(255) NOT NULL,
                imo VARCHAR(7) NULL,
                mmsi VARCHAR(9) NULL,
                call_sign VARCHAR(50) NULL,
                shipping_line VARCHAR(255) NULL,
                client_name VARCHAR(255) NULL,
                origin_label VARCHAR(255) NULL,
                destination_label VARCHAR(255) NULL,
                eta_manual DATETIME NULL,
                status ENUM('active','inactive','arrived','scheduled') NOT NULL DEFAULT 'active',
                is_featured BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS vessel_positions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vessel_id INT NOT NULL,
                lat DECIMAL(10,7) NOT NULL,
                lon DECIMAL(10,7) NOT NULL,
                speed DECIMAL(5,2) NULL,
                course DECIMAL(5,2) NULL,
                destination VARCHAR(255) NULL,
                eta DATETIME NULL,
                source VARCHAR(50) NOT NULL,
                fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE,
                INDEX idx_vessel_fetched (vessel_id, fetched_at DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $columns = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('vessel_id', $columns)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN vessel_id INT NULL");
            $pdo->exec("ALTER TABLE orders ADD FOREIGN KEY fk_orders_vessel (vessel_id) REFERENCES vessels(id) ON DELETE SET NULL");
        }
        if (!in_array('tracking_public_token', $columns)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN tracking_public_token VARCHAR(64) NULL UNIQUE");
        }

        $vesselCols = $pdo->query("SHOW COLUMNS FROM vessels")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('client_name', $vesselCols)) {
            $pdo->exec("ALTER TABLE vessels ADD COLUMN client_name VARCHAR(255) NULL AFTER shipping_line");
        }

        // Tracking configuration table (for AIS API keys, cron tokens, etc.)
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS tracking_config (
                id INT AUTO_INCREMENT PRIMARY KEY,
                config_key VARCHAR(100) NOT NULL UNIQUE,
                config_value TEXT,
                description VARCHAR(255),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        echo json_encode(['success' => true, 'message' => 'Tracking tables created/updated successfully']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Migration failed: ' . $e->getMessage()]);
    }
}

function getFeaturedVessels() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->query("
            SELECT v.*, 
                   vp.lat, vp.lon, vp.speed, vp.course, vp.destination AS pos_destination, 
                   vp.eta AS pos_eta, vp.fetched_at AS last_position_update
            FROM vessels v
            LEFT JOIN (
                SELECT vp1.*
                FROM vessel_positions vp1
                INNER JOIN (
                    SELECT vessel_id, MAX(fetched_at) as max_fetched
                    FROM vessel_positions
                    GROUP BY vessel_id
                ) vp2 ON vp1.vessel_id = vp2.vessel_id AND vp1.fetched_at = vp2.max_fetched
            ) vp ON v.id = vp.vessel_id
            WHERE v.is_featured = 1 AND v.status IN ('active', 'arrived')
            ORDER BY v.updated_at DESC
        ");
        $vessels = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // For vessels without position data, try to fetch live from AIS provider
        $provider = getAISProvider();
        foreach ($vessels as &$vessel) {
            if (empty($vessel['lat']) && empty($vessel['lon'])) {
                $livePos = $provider->getVesselPosition($vessel['imo'], $vessel['mmsi']);
                if ($livePos) {
                    $vessel['lat'] = $livePos['lat'];
                    $vessel['lon'] = $livePos['lon'];
                    $vessel['speed'] = $livePos['speed'];
                    $vessel['course'] = $livePos['course'];
                    $vessel['pos_destination'] = $livePos['destination'];
                    $vessel['pos_eta'] = $livePos['eta'];
                    $vessel['last_position_update'] = $livePos['lastUpdate'];
                }
            }
        }
        unset($vessel);

        echo json_encode(['success' => true, 'vessels' => $vessels]);
    } catch (PDOException $e) {
        error_log("Error getting featured vessels: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener embarcaciones']);
    }
}

function getVesselDetail() {
    $vesselId = intval($_GET['id'] ?? 0);
    if (!$vesselId) {
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
        $stmt = $pdo->prepare("SELECT * FROM vessels WHERE id = ?");
        $stmt->execute([$vesselId]);
        $vessel = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$vessel) {
            http_response_code(404);
            echo json_encode(['error' => 'Embarcacion no encontrada']);
            return;
        }

        $posStmt = $pdo->prepare("
            SELECT lat, lon, speed, course, destination, eta, source, fetched_at
            FROM vessel_positions
            WHERE vessel_id = ?
            ORDER BY fetched_at DESC
            LIMIT 1
        ");
        $posStmt->execute([$vesselId]);
        $position = $posStmt->fetch(PDO::FETCH_ASSOC);

        $vessel['current_position'] = $position ?: null;

        $provider = getAISProvider();
        $livePos = $provider->getVesselPosition($vessel['imo'], $vessel['mmsi']);
        if ($livePos) {
            $vessel['current_position'] = $livePos;
        }

        echo json_encode(['success' => true, 'vessel' => $vessel]);
    } catch (PDOException $e) {
        error_log("Error getting vessel detail: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener detalle']);
    }
}

function getVesselPositions() {
    $vesselId = intval($_GET['id'] ?? 0);
    $limit = intval($_GET['limit'] ?? 100);
    if (!$vesselId) {
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
        $stmt = $pdo->prepare("
            SELECT lat, lon, speed, course, destination, eta, source, fetched_at
            FROM vessel_positions
            WHERE vessel_id = ?
            ORDER BY fetched_at DESC
            LIMIT ?
        ");
        $stmt->execute([$vesselId, $limit]);
        $positions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'positions' => $positions]);
    } catch (PDOException $e) {
        error_log("Error getting vessel positions: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener posiciones']);
    }
}

function getPublicTracking() {
    $token = $_GET['token'] ?? '';
    if (!$token) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere token']);
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
            SELECT o.order_number, o.customer_name, o.vessel_id,
                   v.display_name AS vessel_name, v.imo, v.mmsi,
                   v.origin_label, v.destination_label, v.eta_manual, v.status AS vessel_status,
                   v.shipping_line
            FROM orders o
            INNER JOIN vessels v ON o.vessel_id = v.id
            WHERE o.tracking_public_token = ?
        ");
        $stmt->execute([$token]);
        $data = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$data) {
            http_response_code(404);
            echo json_encode(['error' => 'Tracking no encontrado']);
            return;
        }

        $posStmt = $pdo->prepare("
            SELECT lat, lon, speed, course, destination, eta, source, fetched_at
            FROM vessel_positions
            WHERE vessel_id = ?
            ORDER BY fetched_at DESC
            LIMIT 1
        ");
        $posStmt->execute([$data['vessel_id']]);
        $position = $posStmt->fetch(PDO::FETCH_ASSOC);

        $histStmt = $pdo->prepare("
            SELECT lat, lon, speed, fetched_at
            FROM vessel_positions
            WHERE vessel_id = ?
            ORDER BY fetched_at DESC
            LIMIT 50
        ");
        $histStmt->execute([$data['vessel_id']]);
        $history = $histStmt->fetchAll(PDO::FETCH_ASSOC);

        $data['current_position'] = $position ?: null;
        $data['position_history'] = $history;

        echo json_encode(['success' => true, 'tracking' => $data]);
    } catch (PDOException $e) {
        error_log("Error getting public tracking: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener seguimiento']);
    }
}

function adminListVessels() {
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
            $where[] = 'v.status = ?';
            $params[] = $_GET['status'];
        }
        if (!empty($_GET['type'])) {
            $where[] = 'v.type = ?';
            $params[] = $_GET['type'];
        }
        if (!empty($_GET['search'])) {
            $where[] = '(v.display_name LIKE ? OR v.imo LIKE ? OR v.mmsi LIKE ? OR v.shipping_line LIKE ?)';
            $search = '%' . $_GET['search'] . '%';
            $params = array_merge($params, [$search, $search, $search, $search]);
        }

        $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

        $stmt = $pdo->prepare("
            SELECT v.*,
                   vp.lat, vp.lon, vp.speed, vp.fetched_at AS last_position_update,
                   (SELECT COUNT(*) FROM orders WHERE vessel_id = v.id) as order_count
            FROM vessels v
            LEFT JOIN (
                SELECT vp1.*
                FROM vessel_positions vp1
                INNER JOIN (
                    SELECT vessel_id, MAX(fetched_at) as max_fetched
                    FROM vessel_positions
                    GROUP BY vessel_id
                ) vp2 ON vp1.vessel_id = vp2.vessel_id AND vp1.fetched_at = vp2.max_fetched
            ) vp ON v.id = vp.vessel_id
            $whereClause
            ORDER BY v.created_at DESC
        ");
        $stmt->execute($params);
        $vessels = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // For vessels without position data, try to fetch live from AIS provider
        $provider = getAISProvider();
        foreach ($vessels as &$vessel) {
            if (empty($vessel['lat']) && empty($vessel['lon'])) {
                $livePos = $provider->getVesselPosition($vessel['imo'], $vessel['mmsi']);
                if ($livePos) {
                    $vessel['lat'] = $livePos['lat'];
                    $vessel['lon'] = $livePos['lon'];
                    $vessel['speed'] = $livePos['speed'];
                    $vessel['last_position_update'] = $livePos['lastUpdate'];
                }
            }
        }
        unset($vessel);

        $countStmt = $pdo->query("SELECT COUNT(*) as total FROM vessels");
        $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

        echo json_encode(['success' => true, 'vessels' => $vessels, 'total' => intval($total)]);
    } catch (PDOException $e) {
        error_log("Error listing vessels: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener embarcaciones']);
    }
}

function adminCreateVessel() {
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['display_name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere display_name']);
        return;
    }
    if (empty($input['imo']) && empty($input['mmsi'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere IMO o MMSI']);
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
            INSERT INTO vessels (type, display_name, imo, mmsi, call_sign, shipping_line,
                                client_name, origin_label, destination_label, eta_manual, status, is_featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $input['type'] ?? 'manual',
            $input['display_name'],
            $input['imo'] ?? null,
            $input['mmsi'] ?? null,
            $input['call_sign'] ?? null,
            $input['shipping_line'] ?? null,
            $input['client_name'] ?? null,
            $input['origin_label'] ?? null,
            $input['destination_label'] ?? null,
            $input['eta_manual'] ?? null,
            $input['status'] ?? 'active',
            $input['is_featured'] ?? false
        ]);

        $vesselId = $pdo->lastInsertId();

        if (!empty($input['lat']) && !empty($input['lon'])) {
            $posStmt = $pdo->prepare("
                INSERT INTO vessel_positions (vessel_id, lat, lon, speed, course, destination, eta, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', NOW())
            ");
            $posStmt->execute([
                $vesselId,
                $input['lat'],
                $input['lon'],
                $input['speed'] ?? null,
                $input['course'] ?? null,
                $input['destination_label'] ?? null,
                $input['eta_manual'] ?? null
            ]);
        }

        echo json_encode(['success' => true, 'vessel_id' => intval($vesselId), 'message' => 'Embarcacion creada']);
    } catch (PDOException $e) {
        error_log("Error creating vessel: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al crear embarcacion: ' . $e->getMessage()]);
    }
}

function adminUpdateVessel() {
    $input = json_decode(file_get_contents('php://input'), true);
    $vesselId = intval($input['id'] ?? 0);

    if (!$vesselId) {
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
        'type', 'display_name', 'imo', 'mmsi', 'call_sign', 'shipping_line',
        'client_name', 'origin_label', 'destination_label', 'eta_manual', 'status', 'is_featured'
    ];

    $sets = [];
    $params = [];

    foreach ($allowedFields as $field) {
        if (array_key_exists($field, $input)) {
            $sets[] = "$field = ?";
            $params[] = $input[$field];
        }
    }

    if (empty($sets)) {
        http_response_code(400);
        echo json_encode(['error' => 'No hay campos para actualizar']);
        return;
    }

    $params[] = $vesselId;

    try {
        $stmt = $pdo->prepare("UPDATE vessels SET " . implode(', ', $sets) . " WHERE id = ?");
        $stmt->execute($params);

        if (!empty($input['lat']) && !empty($input['lon'])) {
            $posStmt = $pdo->prepare("
                INSERT INTO vessel_positions (vessel_id, lat, lon, speed, course, destination, eta, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', NOW())
            ");
            $posStmt->execute([
                $vesselId,
                $input['lat'],
                $input['lon'],
                $input['speed'] ?? null,
                $input['course'] ?? null,
                $input['destination_label'] ?? null,
                $input['eta_manual'] ?? null
            ]);
        }

        echo json_encode(['success' => true, 'message' => 'Embarcacion actualizada']);
    } catch (PDOException $e) {
        error_log("Error updating vessel: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al actualizar embarcacion']);
    }
}

function adminDeleteVessel() {
    $input = json_decode(file_get_contents('php://input'), true);
    $vesselId = intval($input['id'] ?? 0);

    if (!$vesselId) {
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
        $pdo->prepare("UPDATE orders SET vessel_id = NULL, tracking_public_token = NULL WHERE vessel_id = ?")->execute([$vesselId]);
        $pdo->prepare("DELETE FROM vessels WHERE id = ?")->execute([$vesselId]);

        echo json_encode(['success' => true, 'message' => 'Embarcacion eliminada']);
    } catch (PDOException $e) {
        error_log("Error deleting vessel: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al eliminar embarcacion']);
    }
}

function adminRotateFeatured() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $arrived = $pdo->query("
            SELECT v.id FROM vessels v
            WHERE v.type='auto' AND v.status='active'
            AND v.destination_label LIKE '%Chile%'
            AND (SELECT vp.lat FROM vessel_positions vp WHERE vp.vessel_id = v.id ORDER BY vp.fetched_at DESC LIMIT 1) < -30
        ")->fetchAll(PDO::FETCH_COLUMN);

        $rotated = 0;
        foreach ($arrived as $vid) {
            $pdo->prepare("UPDATE vessels SET status='arrived' WHERE id=?")->execute([$vid]);
            $rotated++;
        }

        if ($rotated > 0) {
            $pdo->exec("
                UPDATE vessels SET status='active'
                WHERE type='auto' AND status='scheduled'
                LIMIT $rotated
            ");
        }

        $activeCount = $pdo->query("SELECT COUNT(*) FROM vessels WHERE is_featured=1 AND status='active'")->fetchColumn();
        if ($activeCount < 3) {
            $needed = 3 - $activeCount;
            $pdo->exec("
                UPDATE vessels SET is_featured=1, status='active'
                WHERE type='auto' AND status='scheduled' AND is_featured=0
                LIMIT $needed
            ");
        }

        echo json_encode(['success' => true, 'rotated' => $rotated, 'active_featured' => intval($activeCount)]);
    } catch (PDOException $e) {
        error_log("Error rotating featured: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al rotar embarcaciones']);
    }
}

function adminAssignVessel() {
    $input = json_decode(file_get_contents('php://input'), true);
    $orderId = intval($input['order_id'] ?? 0);
    $vesselId = intval($input['vessel_id'] ?? 0);

    if (!$orderId || !$vesselId) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere order_id y vessel_id']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $vesselStmt = $pdo->prepare("SELECT id, display_name FROM vessels WHERE id = ?");
        $vesselStmt->execute([$vesselId]);
        $vessel = $vesselStmt->fetch(PDO::FETCH_ASSOC);
        if (!$vessel) {
            http_response_code(404);
            echo json_encode(['error' => 'Embarcacion no encontrada']);
            return;
        }

        $orderStmt = $pdo->prepare("SELECT id, order_number, customer_email, customer_name FROM orders WHERE id = ?");
        $orderStmt->execute([$orderId]);
        $order = $orderStmt->fetch(PDO::FETCH_ASSOC);
        if (!$order) {
            http_response_code(404);
            echo json_encode(['error' => 'Expediente no encontrado']);
            return;
        }

        $token = bin2hex(random_bytes(32));

        $updateStmt = $pdo->prepare("UPDATE orders SET vessel_id = ?, tracking_public_token = ? WHERE id = ?");
        $updateStmt->execute([$vesselId, $token, $orderId]);

        $eventStmt = $pdo->prepare("INSERT INTO order_events (order_id, event_type, meta_json) VALUES (?, 'TRACKING_ASSIGNED', ?)");
        $eventStmt->execute([$orderId, json_encode(['vessel_id' => $vesselId, 'vessel_name' => $vessel['display_name'], 'token' => $token])]);

        $scriptPath = $_SERVER['SCRIPT_FILENAME'] ?? __FILE__;
        $requestUri = $_SERVER['REQUEST_URI'] ?? '';
        $isTest = (strpos($scriptPath, '/test/') !== false || strpos($requestUri, '/test/') !== false);
        $baseUrl = $isTest ? 'https://www.imporlan.cl/test/t/' : 'https://www.imporlan.cl/t/';
        $trackingUrl = $baseUrl . $token;
        $emailSent = false;
        if (!empty($order['customer_email'])) {
            try {
                require_once __DIR__ . '/email_service.php';
                $emailService = getEmailService();
                $emailSent = $emailService->sendTrackingActivated(
                    $order['customer_email'],
                    $order['order_number'],
                    $trackingUrl
                );
            } catch (Exception $e) {
                error_log("Error sending tracking email: " . $e->getMessage());
            }
        }

        echo json_encode([
            'success' => true,
            'message' => 'Tracking asignado',
            'token' => $token,
            'tracking_url' => $trackingUrl,
            'email_sent' => $emailSent
        ]);
    } catch (PDOException $e) {
        error_log("Error assigning vessel: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al asignar tracking']);
    }
}

function adminAddPosition() {
    $input = json_decode(file_get_contents('php://input'), true);
    $vesselId = intval($input['vessel_id'] ?? 0);

    if (!$vesselId || !isset($input['lat']) || !isset($input['lon'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere vessel_id, lat y lon']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $provider = getAISProvider();
        $position = $provider->addManualPosition(
            $vesselId,
            floatval($input['lat']),
            floatval($input['lon']),
            isset($input['speed']) ? floatval($input['speed']) : null,
            isset($input['course']) ? floatval($input['course']) : null,
            $input['destination'] ?? null,
            $input['eta'] ?? null
        );

        echo json_encode(['success' => true, 'position' => $position]);
    } catch (Exception $e) {
        error_log("Error adding position: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al agregar posicion']);
    }
}

/**
 * Scrape vessel info from VesselFinder's public detail page (no API key needed).
 * Works for IMO (7 digits) and MMSI (9 digits) lookups.
 */
function scrapeVesselFinderPublic($query) {
    $isIMO = preg_match('/^\d{7}$/', $query);
    $isMMSI = preg_match('/^\d{9}$/', $query);
    if (!$isIMO && !$isMMSI) return null;

    // VesselFinder detail page works with IMO numbers directly
    if ($isIMO) {
        $url = "https://www.vesselfinder.com/vessels/details/" . urlencode($query);
    } else {
        // For MMSI, use the search page
        $url = "https://www.vesselfinder.com/vessels?name=&imo=&mmsi=" . urlencode($query) . "&type=&flag=";
    }

    $ctx = stream_context_create([
        'http' => [
            'timeout' => 10,
            'method' => 'GET',
            'header' => "User-Agent: Mozilla/5.0 (compatible; ImporlanBot/1.0)\r\nAccept: text/html\r\n",
            'follow_location' => true
        ]
    ]);

    $html = @file_get_contents($url, false, $ctx);
    if ($html === false) return null;

    $result = [
        'source' => 'vesselfinder_public',
        'display_name' => '',
        'imo' => '',
        'mmsi' => '',
        'call_sign' => '',
        'shipping_line' => '',
        'origin_label' => '',
        'destination_label' => '',
    ];

    // Extract vessel name from <title> tag: "VESSEL NAME, Type - Details ... - IMO XXXXXXX"
    if (preg_match('/<title>([^,]+),\s*([^-]+)\s*-\s*Details[^<]*<\/title>/', $html, $m)) {
        $result['display_name'] = trim($m[1]);
    } elseif (preg_match('/<h1[^>]*class="title"[^>]*>([^<]+)<\/h1>/', $html, $m)) {
        $result['display_name'] = trim($m[1]);
    }

    // Extract IMO and MMSI from meta description or script vars
    // Pattern: "IMO 9777589, MMSI 218833000"
    if (preg_match('/var vu_imo=(\d{7})/', $html, $m)) {
        $result['imo'] = $m[1];
    } elseif (preg_match('/IMO\s*[:=]?\s*(\d{7})/', $html, $m)) {
        $result['imo'] = $m[1];
    }

    if (preg_match('/var MMSI=(\d{9})/', $html, $m)) {
        $result['mmsi'] = $m[1];
    } elseif (preg_match('/MMSI\s*[:=]?\s*(\d{9})/', $html, $m)) {
        $result['mmsi'] = $m[1];
    }

    // Extract destination from the page
    if (preg_match('/en route to the port of\s*<strong>([^<]+)<\/strong>/', $html, $m)) {
        $result['destination_label'] = trim($m[1]);
    }

    // Only return if we found at least the vessel name
    if (!$result['display_name']) return null;

    return $result;
}

function adminLookupVessel() {
    $query = trim($_GET['query'] ?? '');
    if (strlen($query) < 2) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere al menos 2 caracteres']);
        return;
    }

    $results = [];

    // First search in local DB
    $pdo = getDbConnection();
    if ($pdo) {
        try {
            $search = '%' . $query . '%';
            $stmt = $pdo->prepare("
                SELECT id, display_name, imo, mmsi, call_sign, shipping_line,
                       origin_label, destination_label, eta_manual, status
                FROM vessels
                WHERE display_name LIKE ? OR imo LIKE ? OR mmsi LIKE ? OR call_sign LIKE ?
                ORDER BY updated_at DESC
                LIMIT 10
            ");
            $stmt->execute([$search, $search, $search, $search]);
            $localVessels = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($localVessels as $v) {
                $results[] = [
                    'source' => 'local',
                    'display_name' => $v['display_name'],
                    'imo' => $v['imo'],
                    'mmsi' => $v['mmsi'],
                    'call_sign' => $v['call_sign'],
                    'shipping_line' => $v['shipping_line'],
                    'origin_label' => $v['origin_label'],
                    'destination_label' => $v['destination_label'],
                    'local_id' => intval($v['id'])
                ];
            }
        } catch (PDOException $e) {
            error_log("Error searching local vessels: " . $e->getMessage());
        }
    }

    // Then try VesselFinder API if configured
    $apiKey = getenv('AIS_API_KEY') ?: '';
    if ($apiKey && count($results) === 0) {
        try {
            // Try by IMO if query is numeric and 7 digits
            if (preg_match('/^\d{7}$/', $query)) {
                $url = "https://api.vesselfinder.com/vessel?userkey=" . urlencode($apiKey) . "&imo=" . urlencode($query);
            } elseif (preg_match('/^\d{9}$/', $query)) {
                $url = "https://api.vesselfinder.com/vessel?userkey=" . urlencode($apiKey) . "&mmsi=" . urlencode($query);
            } else {
                $url = null;
            }

            if ($url) {
                $ctx = stream_context_create([
                    'http' => [
                        'timeout' => 8,
                        'method' => 'GET',
                        'header' => "Accept: application/json\r\n"
                    ]
                ]);
                $response = @file_get_contents($url, false, $ctx);
                if ($response !== false) {
                    $data = json_decode($response, true);
                    if ($data && isset($data['AIS'])) {
                        $ais = $data['AIS'];
                        $results[] = [
                            'source' => 'vesselfinder',
                            'display_name' => $ais['NAME'] ?? '',
                            'imo' => strval($ais['IMO'] ?? ''),
                            'mmsi' => strval($ais['MMSI'] ?? ''),
                            'call_sign' => $ais['CALLSIGN'] ?? '',
                            'shipping_line' => '',
                            'origin_label' => '',
                            'destination_label' => $ais['DESTINATION'] ?? '',
                            'lat' => $ais['LATITUDE'] ?? null,
                            'lon' => $ais['LONGITUDE'] ?? null,
                            'speed' => $ais['SPEED'] ?? null,
                            'course' => $ais['COURSE'] ?? null
                        ];
                    }
                }
            }
        } catch (Exception $e) {
            error_log("Error looking up vessel from VesselFinder: " . $e->getMessage());
        }
    }

    // Fallback: scrape VesselFinder public page for IMO/MMSI lookups (no API key needed)
    if (count($results) === 0 && (preg_match('/^\d{7}$/', $query) || preg_match('/^\d{9}$/', $query))) {
        try {
            $vfResult = scrapeVesselFinderPublic($query);
            if ($vfResult) {
                $results[] = $vfResult;
            }
        } catch (Exception $e) {
            error_log("Error scraping VesselFinder public: " . $e->getMessage());
        }
    }

    echo json_encode(['success' => true, 'results' => $results]);
}

/**
 * Run AISstream position update via HTTP request (alternative to server cron).
 * Protected by a secret token configured in ais_config.php.
 * 
 * Usage: GET ?action=run_position_update&token=YOUR_SECRET_TOKEN
 */
function runPositionUpdateViaHTTP() {
    require_once __DIR__ . '/tracking/ais_config_helper.php';
    require_once __DIR__ . '/tracking/websocket_client.php';

    $expectedToken = getAISConfig('CRON_SECRET_TOKEN');
    $providedToken = $_GET['token'] ?? '';

    if (!$expectedToken || $providedToken !== $expectedToken) {
        http_response_code(403);
        echo json_encode(['error' => 'Token invalido o no configurado']);
        return;
    }

    $apiKey = getAISConfig('AISSTREAM_API_KEY');
    if (!$apiKey) {
        http_response_code(500);
        echo json_encode(['error' => 'AISSTREAM_API_KEY no configurada']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    // Get active vessels with MMSI
    try {
        $stmt = $pdo->query("
            SELECT id, display_name, imo, mmsi 
            FROM vessels 
            WHERE status IN ('active', 'arrived') 
              AND (mmsi IS NOT NULL AND mmsi != '')
        ");
        $vessels = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error getting vessels: ' . $e->getMessage()]);
        return;
    }

    if (empty($vessels)) {
        echo json_encode(['success' => true, 'message' => 'No active vessels with MMSI to track', 'positions' => 0]);
        return;
    }

    // Build MMSI list
    $mmsiList = [];
    $mmsiToVessel = [];
    foreach ($vessels as $v) {
        $mmsi = trim($v['mmsi']);
        if ($mmsi) {
            $mmsiList[] = $mmsi;
            $mmsiToVessel[$mmsi] = $v['id'];
        }
    }

    $mmsiList = array_slice($mmsiList, 0, 50);

    // Connect to AISstream
    $ws = new WebSocketClient();
    if (!$ws->connect('wss://stream.aisstream.io/v0/stream')) {
        http_response_code(502);
        echo json_encode(['error' => 'Failed to connect to AISstream WebSocket']);
        return;
    }

    // Subscribe
    $subscription = json_encode([
        'APIKey' => $apiKey,
        'BoundingBoxes' => [[[-90, -180], [90, 180]]],
        'FiltersShipMMSI' => $mmsiList,
        'FilterMessageTypes' => ['PositionReport', 'StandardClassBPositionReport']
    ]);
    $ws->send($subscription);

    // Listen for 30 seconds max
    $listenSeconds = 30;
    $startTime = time();
    $positionsReceived = 0;
    $updates = [];

    while ((time() - $startTime) < $listenSeconds) {
        $remaining = $listenSeconds - (time() - $startTime);
        if ($remaining <= 0) break;

        $data = $ws->read(min($remaining, 5));
        if ($data === null) continue;

        $message = json_decode($data, true);
        if (!$message) continue;

        if (isset($message['error'])) {
            $ws->close();
            http_response_code(502);
            echo json_encode(['error' => 'AISstream error: ' . $message['error']]);
            return;
        }

        $msgType = $message['MessageType'] ?? '';
        $metadata = $message['MetaData'] ?? [];
        $mmsi = strval($metadata['MMSI'] ?? '');
        $shipName = $metadata['ShipName'] ?? '';

        if ($msgType === 'PositionReport' || $msgType === 'StandardClassBPositionReport') {
            $report = $message['Message'][$msgType] ?? [];
            $lat = $report['Latitude'] ?? $metadata['latitude'] ?? null;
            $lon = $report['Longitude'] ?? $metadata['longitude'] ?? null;
            $speed = isset($report['Sog']) ? floatval($report['Sog']) : null;
            $course = isset($report['Cog']) ? floatval($report['Cog']) : null;

            if ($lat !== null && $lon !== null && isset($mmsiToVessel[$mmsi])) {
                $vesselId = $mmsiToVessel[$mmsi];
                try {
                    $stmt = $pdo->prepare("
                        INSERT INTO vessel_positions (vessel_id, lat, lon, speed, course, destination, eta, source, fetched_at)
                        VALUES (?, ?, ?, ?, ?, NULL, NULL, 'aisstream', NOW())
                    ");
                    $stmt->execute([$vesselId, $lat, $lon, $speed, $course]);
                    $positionsReceived++;
                    $updates[] = [
                        'vessel_id' => $vesselId,
                        'ship_name' => trim($shipName),
                        'mmsi' => $mmsi,
                        'lat' => $lat,
                        'lon' => $lon,
                        'speed' => $speed,
                        'course' => $course
                    ];
                } catch (PDOException $e) {
                    error_log("[run_position_update] Error saving position: " . $e->getMessage());
                }
            }
        }
    }

    $ws->close();

    echo json_encode([
        'success' => true,
        'message' => "AISstream update completed",
        'vessels_tracked' => count($mmsiList),
        'positions_received' => $positionsReceived,
        'listen_seconds' => time() - $startTime,
        'updates' => $updates
    ]);
}

/**
 * Get tracking configuration (admin only)
 */
function trackingConfigGet() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        // Ensure table exists
        $check = $pdo->query("SHOW TABLES LIKE 'tracking_config'");
        if ($check->rowCount() === 0) {
            echo json_encode(['success' => true, 'config' => new \stdClass(), 'message' => 'Run migration first']);
            return;
        }

        $stmt = $pdo->query("SELECT config_key, config_value, description FROM tracking_config ORDER BY id ASC");
        $configs = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $configs[$row['config_key']] = [
                'value' => $row['config_value'],
                'description' => $row['description']
            ];
        }

        // Check which sources are active
        require_once __DIR__ . '/tracking/ais_config_helper.php';
        $aisStreamKey = getAISConfig('AISSTREAM_API_KEY');
        $cronToken = getAISConfig('CRON_SECRET_TOKEN');

        echo json_encode([
            'success' => true,
            'config' => $configs,
            'status' => [
                'aisstream_configured' => !empty($aisStreamKey),
                'cron_token_configured' => !empty($cronToken),
                'aisstream_key_source' => !empty(getenv('AISSTREAM_API_KEY')) ? 'env' : (!empty($configs['AISSTREAM_API_KEY']['value'] ?? '') ? 'database' : 'none')
            ]
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error getting config: ' . $e->getMessage()]);
    }
}

/**
 * Save tracking configuration (admin only)
 */
function trackingConfigSave() {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['configs'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere configs']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    // Only allow specific config keys
    $allowedKeys = [
        'AISSTREAM_API_KEY' => 'API key de AISstream.io para posiciones en tiempo real',
        'AIS_API_KEY' => 'API key de VesselFinder para consultas REST',
        'CRON_SECRET_TOKEN' => 'Token secreto para trigger HTTP del cron de posiciones'
    ];

    try {
        // Ensure table exists
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS tracking_config (
                id INT AUTO_INCREMENT PRIMARY KEY,
                config_key VARCHAR(100) NOT NULL UNIQUE,
                config_value TEXT,
                description VARCHAR(255),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $stmt = $pdo->prepare("
            INSERT INTO tracking_config (config_key, config_value, description) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), description = VALUES(description)
        ");

        $saved = [];
        foreach ($input['configs'] as $key => $value) {
            if (!array_key_exists($key, $allowedKeys)) {
                continue;
            }
            $stmt->execute([$key, $value, $allowedKeys[$key]]);
            $saved[] = $key;
        }

        echo json_encode(['success' => true, 'message' => 'Configuracion guardada', 'saved' => $saved]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error saving config: ' . $e->getMessage()]);
    }
}
