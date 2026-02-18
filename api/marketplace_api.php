<?php
/**
 * Marketplace API - Imporlan
 * CRUD for boat listings with photo upload
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Email, X-User-Name');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/marketplace_email_service.php';

if (!defined('JWT_SECRET')) {
    $jwt = getenv('JWT_SECRET');
    if ($jwt) define('JWT_SECRET', $jwt);
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'init_db':
        initMarketplaceDb();
        break;
    case 'list':
        listListings();
        break;
    case 'my_listings':
        $user = requireAuth();
        myListings($user);
        break;
    case 'get':
        getListing();
        break;
    case 'create':
        $user = requireAuth();
        createListing($user);
        break;
    case 'update':
        $user = requireAuth();
        updateListing($user);
        break;
    case 'upload_photo':
        $user = requireAuth();
        uploadPhoto($user);
        break;
    case 'delete':
        $user = requireAuth();
        deleteListing($user);
        break;
    case 'renew':
        $user = requireAuth();
        renewListing($user);
        break;
    case 'mark_sold':
        $user = requireAuth();
        markListingSold($user);
        break;
    case 'lead':
        handleLeadSubmission();
        break;
    case 'migrate_v2':
        $user = requireAuth();
        migrateMarketplaceV2();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida']);
}

function base64UrlDecode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

function base64UrlEncode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function verifyJWT($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    list($base64Header, $base64Payload, $base64Signature) = $parts;
    $signature = hash_hmac('sha256', "$base64Header.$base64Payload", JWT_SECRET, true);
    $expectedSignature = base64UrlEncode($signature);
    if (!hash_equals($expectedSignature, $base64Signature)) return null;
    $payload = json_decode(base64UrlDecode($base64Payload), true);
    if ($payload['exp'] < time()) return null;
    return $payload;
}

function requireAuth() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    $userEmail = $headers['X-User-Email'] ?? $headers['x-user-email'] ?? null;
    $userName = $headers['X-User-Name'] ?? $headers['x-user-name'] ?? null;

    if (!preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit();
    }
    $token = $matches[1];
    $payload = verifyJWT($token);

    if (!$payload && $userEmail) {
        $parts = explode('.', $token);
        if (count($parts) === 3) {
            $tokenPayload = json_decode(base64UrlDecode($parts[1]), true);
            if ($tokenPayload && isset($tokenPayload['exp']) && $tokenPayload['exp'] > time()) {
                $payload = [
                    'sub' => $tokenPayload['sub'] ?? '0',
                    'email' => $userEmail,
                    'name' => $userName,
                    'exp' => $tokenPayload['exp']
                ];
            }
        }
    }

    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Token invalido']);
        exit();
    }

    if (empty($payload['email']) && $userEmail) $payload['email'] = $userEmail;
    if (empty($payload['name']) && $userName) $payload['name'] = $userName;

    return $payload;
}

function initMarketplaceDb() {
    $pdo = getDbConnection();
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS marketplace_listings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                user_name VARCHAR(255) NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                tipo VARCHAR(100) DEFAULT NULL,
                ano INT DEFAULT NULL,
                eslora VARCHAR(50) DEFAULT NULL,
                precio DECIMAL(12,2) DEFAULT 0,
                moneda ENUM('USD','CLP') DEFAULT 'USD',
                ubicacion VARCHAR(255) DEFAULT NULL,
                descripcion TEXT DEFAULT NULL,
                estado ENUM('Nueva','Usada') DEFAULT 'Usada',
                condicion ENUM('Excelente','Muy Buena','Buena','Regular','Para Reparacion') DEFAULT 'Buena',
                horas INT DEFAULT NULL,
                fotos TEXT DEFAULT NULL,
                status ENUM('active','sold','deleted') DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_status (status),
                INDEX idx_user (user_email),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        echo json_encode(['success' => true, 'message' => 'Tabla marketplace creada']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function listListings() {
    $pdo = getDbConnection();
    $stmt = $pdo->prepare("
        SELECT * FROM marketplace_listings
        WHERE status = 'active'
        ORDER BY created_at DESC
    ");
    $stmt->execute();
    $listings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($listings as &$l) {
        $l['fotos'] = $l['fotos'] ? json_decode($l['fotos'], true) : [];
    }
    echo json_encode(['listings' => $listings]);
}

function myListings($user) {
    $pdo = getDbConnection();
    $stmt = $pdo->prepare("
        SELECT * FROM marketplace_listings
        WHERE user_email = ? AND status != 'deleted'
        ORDER BY created_at DESC
    ");
    $stmt->execute([$user['email']]);
    $listings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($listings as &$l) {
        $l['fotos'] = $l['fotos'] ? json_decode($l['fotos'], true) : [];
    }
    echo json_encode(['listings' => $listings]);
}

function getListing() {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta id']);
        return;
    }
    $pdo = getDbConnection();
    $stmt = $pdo->prepare("SELECT * FROM marketplace_listings WHERE id = ? AND status = 'active'");
    $stmt->execute([$id]);
    $listing = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$listing) {
        http_response_code(404);
        echo json_encode(['error' => 'Publicacion no encontrada']);
        return;
    }
    $listing['fotos'] = $listing['fotos'] ? json_decode($listing['fotos'], true) : [];
    echo json_encode(['listing' => $listing]);
}

function createListing($user) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['nombre'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Nombre es obligatorio']);
        return;
    }
    $pdo = getDbConnection();
    $fotos = isset($input['fotos']) && is_array($input['fotos']) ? json_encode($input['fotos']) : '[]';
    $now = date('Y-m-d H:i:s');
    $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));

    try {
        $emailService = getMarketplaceEmailService();
        $emailService->ensureMigrated();
    } catch (Exception $e) {
        error_log('[Marketplace] Auto-migration on create: ' . $e->getMessage());
    }

    $cols = $pdo->query("SHOW COLUMNS FROM marketplace_listings")->fetchAll(PDO::FETCH_COLUMN);
    $hasDateCols = in_array('published_at', $cols) && in_array('expires_at', $cols);

    if ($hasDateCols) {
        $stmt = $pdo->prepare("
            INSERT INTO marketplace_listings
            (user_email, user_name, nombre, tipo, ano, eslora, precio, moneda, ubicacion, descripcion, estado, condicion, horas, fotos, published_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO marketplace_listings
            (user_email, user_name, nombre, tipo, ano, eslora, precio, moneda, ubicacion, descripcion, estado, condicion, horas, fotos)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
    }
    $params = [
        $user['email'],
        $user['name'] ?? explode('@', $user['email'])[0],
        trim($input['nombre']),
        $input['tipo'] ?? null,
        intval($input['ano'] ?? 0) ?: null,
        $input['eslora'] ?? null,
        floatval($input['precio'] ?? 0),
        in_array($input['moneda'] ?? '', ['USD','CLP']) ? $input['moneda'] : 'USD',
        $input['ubicacion'] ?? null,
        $input['descripcion'] ?? null,
        in_array($input['estado'] ?? '', ['Nueva','Usada']) ? $input['estado'] : 'Usada',
        in_array($input['condicion'] ?? '', ['Excelente','Muy Buena','Buena','Regular','Para Reparacion']) ? $input['condicion'] : 'Buena',
        intval($input['horas'] ?? 0) ?: null,
        $fotos,
    ];
    if ($hasDateCols) {
        $params[] = $now;
        $params[] = $expiresAt;
    }
    $stmt->execute($params);
    $id = $pdo->lastInsertId();

    try {
        $listing = fetchListingById($pdo, $id);
        if ($listing) {
            $emailService = getMarketplaceEmailService();
            $userName = $user['name'] ?? explode('@', $user['email'])[0];
            $emailService->sendListingCreatedEmail($user['email'], $userName, $listing);
            $emailService->sendAdminListingCreatedEmail($listing);
        }
    } catch (Exception $e) {
        error_log('[Marketplace] Email send error on create: ' . $e->getMessage());
    }

    echo json_encode(['success' => true, 'id' => $id]);
}

function uploadPhoto($user) {
    if (empty($_FILES['photo'])) {
        http_response_code(400);
        echo json_encode(['error' => 'No se recibio archivo']);
        return;
    }

    $file = $_FILES['photo'];
    $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!in_array($file['type'], $allowed)) {
        http_response_code(400);
        echo json_encode(['error' => 'Tipo de archivo no permitido']);
        return;
    }
    if ($file['size'] > 5 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['error' => 'Archivo demasiado grande (max 5MB)']);
        return;
    }

    $uploadDir = __DIR__ . '/marketplace_photos/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
    $filename = uniqid('mkt_') . '_' . time() . '.' . $ext;
    $destPath = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al guardar archivo']);
        return;
    }

    $isTest = strpos($_SERVER['REQUEST_URI'] ?? '', '/test/') !== false;
    $baseUrl = $isTest ? '/test/api/marketplace_photos/' : '/api/marketplace_photos/';
    $url = $baseUrl . $filename;

    echo json_encode(['success' => true, 'url' => $url]);
}

function deleteListing($user) {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta id']);
        return;
    }
    $pdo = getDbConnection();

    $listing = fetchListingById($pdo, $id);
    if (!$listing || $listing['user_email'] !== $user['email']) {
        http_response_code(404);
        echo json_encode(['error' => 'Anuncio no encontrado']);
        return;
    }

    $stmt = $pdo->prepare("UPDATE marketplace_listings SET status='deleted' WHERE id=? AND user_email=?");
    $stmt->execute([$id, $user['email']]);

    try {
        $emailService = getMarketplaceEmailService();
        $userName = $user['name'] ?? $listing['user_name'];
        $emailService->sendListingDeletedEmail($user['email'], $userName, $listing);
        $emailService->sendAdminListingDeletedEmail($listing);
    } catch (Exception $e) {
        error_log('[Marketplace] Email send error on delete: ' . $e->getMessage());
    }

    echo json_encode(['success' => true]);
}

function updateListing($user) {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta id']);
        return;
    }
    $pdo = getDbConnection();

    $existing = fetchListingById($pdo, $id);
    if (!$existing || $existing['user_email'] !== $user['email']) {
        http_response_code(404);
        echo json_encode(['error' => 'Anuncio no encontrado']);
        return;
    }
    if ($existing['status'] === 'deleted' || $existing['status'] === 'expired') {
        http_response_code(400);
        echo json_encode(['error' => 'No se puede editar un anuncio eliminado o expirado']);
        return;
    }

    $fields = [];
    $params = [];
    $allowedFields = [
        'nombre' => 'string', 'tipo' => 'string', 'ano' => 'int',
        'eslora' => 'string', 'precio' => 'float', 'moneda' => 'enum:USD,CLP',
        'ubicacion' => 'string', 'descripcion' => 'string',
        'estado' => 'enum:Nueva,Usada',
        'condicion' => 'enum:Excelente,Muy Buena,Buena,Regular,Para Reparacion',
        'horas' => 'int'
    ];

    foreach ($allowedFields as $field => $type) {
        if (!array_key_exists($field, $input)) continue;
        $val = $input[$field];
        if (strpos($type, 'enum:') === 0) {
            $valid = explode(',', substr($type, 5));
            if (!in_array($val, $valid)) continue;
        } elseif ($type === 'int') {
            $val = intval($val) ?: null;
        } elseif ($type === 'float') {
            $val = floatval($val);
        } else {
            $val = trim($val);
        }
        $fields[] = "$field = ?";
        $params[] = $val;
    }

    if (isset($input['fotos']) && is_array($input['fotos'])) {
        $fields[] = 'fotos = ?';
        $params[] = json_encode($input['fotos']);
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['error' => 'No hay campos para actualizar']);
        return;
    }

    $params[] = $id;
    $params[] = $user['email'];
    $sql = "UPDATE marketplace_listings SET " . implode(', ', $fields) . " WHERE id = ? AND user_email = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    try {
        $updated = fetchListingById($pdo, $id);
        if ($updated) {
            $emailService = getMarketplaceEmailService();
            $userName = $user['name'] ?? $updated['user_name'];
            $emailService->sendListingEditedEmail($user['email'], $userName, $updated);
            $emailService->sendAdminListingEditedEmail($updated);
        }
    } catch (Exception $e) {
        error_log('[Marketplace] Email send error on update: ' . $e->getMessage());
    }

    echo json_encode(['success' => true]);
}

function renewListing($user) {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? $_GET['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta id']);
        return;
    }
    $pdo = getDbConnection();

    $listing = fetchListingById($pdo, $id);
    if (!$listing || $listing['user_email'] !== $user['email']) {
        http_response_code(404);
        echo json_encode(['error' => 'Anuncio no encontrado']);
        return;
    }
    if ($listing['status'] === 'deleted') {
        http_response_code(400);
        echo json_encode(['error' => 'No se puede renovar un anuncio eliminado']);
        return;
    }

    $now = date('Y-m-d H:i:s');
    $newExpires = date('Y-m-d H:i:s', strtotime('+30 days'));
    $newStatus = 'active';

    $stmt = $pdo->prepare("
        UPDATE marketplace_listings
        SET status = ?, published_at = ?, expires_at = ?
        WHERE id = ? AND user_email = ?
    ");
    $stmt->execute([$newStatus, $now, $newExpires, $id, $user['email']]);

    try {
        $renewed = fetchListingById($pdo, $id);
        if ($renewed) {
            $emailService = getMarketplaceEmailService();
            $userName = $user['name'] ?? $renewed['user_name'];
            $emailService->sendListingRenewedEmail($user['email'], $userName, $renewed);
            $emailService->sendAdminListingRenewedEmail($renewed);
        }
    } catch (Exception $e) {
        error_log('[Marketplace] Email send error on renew: ' . $e->getMessage());
    }

    echo json_encode(['success' => true, 'expires_at' => $newExpires]);
}

function markListingSold($user) {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta id']);
        return;
    }
    $pdo = getDbConnection();

    $listing = fetchListingById($pdo, $id);
    if (!$listing || $listing['user_email'] !== $user['email']) {
        http_response_code(404);
        echo json_encode(['error' => 'Anuncio no encontrado']);
        return;
    }

    $stmt = $pdo->prepare("UPDATE marketplace_listings SET status='sold' WHERE id=? AND user_email=?");
    $stmt->execute([$id, $user['email']]);

    try {
        $emailService = getMarketplaceEmailService();
        $userName = $user['name'] ?? $listing['user_name'];
        $emailService->sendListingSoldEmail($user['email'], $userName, $listing);
        $emailService->sendAdminListingSoldEmail($listing);
    } catch (Exception $e) {
        error_log('[Marketplace] Email send error on mark_sold: ' . $e->getMessage());
    }

    echo json_encode(['success' => true]);
}

function migrateMarketplaceV2() {
    $emailService = getMarketplaceEmailService();
    $result = $emailService->migrateMarketplaceSchema();
    echo json_encode($result);
}

function handleLeadSubmission() {
    $input = json_decode(file_get_contents('php://input'), true);
    $email = trim($input['email'] ?? '');
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email invalido']);
        return;
    }
    $nombre = trim($input['nombre'] ?? '');
    $intereses = trim($input['intereses'] ?? '');

    $pdo = getDbConnection();

    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS marketplace_leads (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                nombre VARCHAR(255),
                intereses TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    } catch (PDOException $e) {
        error_log('[Marketplace] Lead table creation: ' . $e->getMessage());
    }

    try {
        $check = $pdo->prepare("SELECT id FROM marketplace_leads WHERE email = ?");
        $check->execute([$email]);
        if ($check->fetch()) {
            $stmt = $pdo->prepare("UPDATE marketplace_leads SET nombre = COALESCE(NULLIF(?, ''), nombre), intereses = COALESCE(NULLIF(?, ''), intereses) WHERE email = ?");
            $stmt->execute([$nombre, $intereses, $email]);
            echo json_encode(['success' => true, 'message' => 'Informacion actualizada']);
            return;
        }

        $stmt = $pdo->prepare("INSERT INTO marketplace_leads (email, nombre, intereses) VALUES (?, ?, ?)");
        $stmt->execute([$email, $nombre, $intereses]);
        $leadId = $pdo->lastInsertId();

        try {
            $emailService = getMarketplaceEmailService();
            $emailService->sendLeadWelcomeEmail($email, $nombre, $intereses);
            $emailService->sendAdminLeadEmail($email, $nombre, $intereses);
        } catch (Exception $e) {
            error_log('[Marketplace] Lead email send error: ' . $e->getMessage());
        }

        echo json_encode(['success' => true, 'id' => $leadId]);
    } catch (PDOException $e) {
        error_log('[Marketplace] Lead save error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al guardar. Intente nuevamente.']);
    }
}

function fetchListingById($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM marketplace_listings WHERE id = ?");
    $stmt->execute([intval($id)]);
    $listing = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($listing && $listing['fotos']) {
        $listing['fotos'] = json_decode($listing['fotos'], true) ?: [];
    }
    return $listing ?: null;
}
