<?php
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

require_once __DIR__ . '/db_config.php';

$input = json_decode(file_get_contents('php://input'), true);
$email = $input['email'] ?? '';
$newPassword = $input['new_password'] ?? '';

if (!$email || !$newPassword) {
    http_response_code(400);
    echo json_encode(['error' => 'Email y nueva contrasena son requeridos']);
    exit();
}

if (strlen($newPassword) < 6) {
    http_response_code(400);
    echo json_encode(['error' => 'La contrasena debe tener al menos 6 caracteres']);
    exit();
}

try {
    $pdo = getDbConnection();
    $stmt = $pdo->prepare("SELECT ID, user_email FROM wp_users WHERE user_email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'Usuario no encontrado']);
        exit();
    }

    $hashed = password_hash($newPassword, PASSWORD_BCRYPT);
    $update = $pdo->prepare("UPDATE wp_users SET user_pass = ? WHERE ID = ?");
    $update->execute([$hashed, $user['ID']]);

    echo json_encode(['success' => true, 'message' => 'Contrasena actualizada correctamente']);
} catch (PDOException $e) {
    error_log("Error changing password: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error interno del servidor']);
}
