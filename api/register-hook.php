<?php
require_once __DIR__ . '/db_config.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['email'])) {
    http_response_code(400);
    echo json_encode(['error' => 'email required']);
    exit();
}

$pdo = getDbConnection();
if (!$pdo) {
    http_response_code(500);
    echo json_encode(['error' => 'DB error']);
    exit();
}

try {
    $check = $pdo->prepare("SELECT id FROM admin_users WHERE email = ?");
    $check->execute([strtolower($input['email'])]);
    if ($check->fetch()) {
        echo json_encode(['success' => true, 'message' => 'already exists']);
        exit();
    }

    $stmt = $pdo->prepare("INSERT INTO admin_users (name, email, password_hash, role, status, phone) VALUES (?, ?, ?, 'user', 'active', ?)");
    $stmt->execute([
        $input['name'] ?? explode('@', $input['email'])[0],
        strtolower($input['email']),
        password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
        $input['phone'] ?? null
    ]);

    $newId = $pdo->lastInsertId();

    try {
        $emailServiceFile = __DIR__ . '/email_service.php';
        if (file_exists($emailServiceFile)) {
            if (!class_exists('EmailService')) {
                require_once $emailServiceFile;
            }
            $emailService = new EmailService();
            $emailService->sendInternalNotification('new_registration', [
                'user_name' => $input['name'] ?? explode('@', $input['email'])[0],
                'user_email' => $input['email'],
                'registration_date' => date('d/m/Y H:i:s')
            ]);
        }
    } catch (Exception $e) {
        error_log("register-hook email error: " . $e->getMessage());
    }

    echo json_encode(['success' => true, 'id' => intval($newId)]);
} catch (PDOException $e) {
    error_log("register-hook error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Insert failed']);
}
