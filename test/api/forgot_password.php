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

$input = json_decode(file_get_contents('php://input'), true);
$email = isset($input['email']) ? trim($input['email']) : '';

if (!$email || strpos($email, '@') === false) {
    http_response_code(400);
    echo json_encode(['error' => 'Email es requerido']);
    exit();
}

require_once __DIR__ . '/fly_config.php';

function flyRequest($method, $path, $body = null, $token = null) {
    $ch = curl_init(FLY_API . $path);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    $headers = ['Content-Type: application/json'];
    if ($token) $headers[] = 'Authorization: Bearer ' . $token;
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    if ($body) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $resp = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($err) error_log("flyRequest error: $method $path - $err");
    return ['code' => $code, 'body' => json_decode($resp, true), 'raw' => $resp];
}

function findFlyUser($adminToken, $email) {
    $listResp = flyRequest('GET', '/api/admin/users', null, $adminToken);
    if ($listResp['code'] === 200 && isset($listResp['body']['users'])) {
        foreach ($listResp['body']['users'] as $u) {
            if (isset($u['email']) && strtolower($u['email']) === strtolower($email)) {
                return $u;
            }
        }
    }
    for ($id = 1; $id <= 200; $id++) {
        $r = flyRequest('GET', '/api/admin/users/' . $id, null, $adminToken);
        if ($r['code'] === 200 && isset($r['body']['user']['email'])) {
            if (strtolower($r['body']['user']['email']) === strtolower($email)) {
                return $r['body']['user'];
            }
        }
        if ($r['code'] === 404) continue;
    }
    return null;
}

try {
    $adminLogin = flyRequest('POST', '/api/auth/login-json', [
        'email' => FLY_ADMIN_EMAIL, 'password' => FLY_ADMIN_PASS
    ]);
    if ($adminLogin['code'] !== 200 || !isset($adminLogin['body']['access_token'])) {
        throw new Exception('Cannot connect to auth service');
    }
    $adminToken = $adminLogin['body']['access_token'];

    $flyUser = findFlyUser($adminToken, $email);
    if (!$flyUser) {
        http_response_code(404);
        echo json_encode(['error' => 'No se encontro una cuenta con ese email.']);
        exit();
    }

    $flyUserId = $flyUser['id'];

    $resetResp = flyRequest('PUT', '/api/admin/users/' . $flyUserId . '/action', [
        'action' => 'reset_password',
        'reason' => 'User requested password reset'
    ], $adminToken);

    if ($resetResp['code'] !== 200) {
        $unblockResp = flyRequest('PUT', '/api/admin/users/' . $flyUserId . '/action', [
            'action' => 'unblock'
        ], $adminToken);
        $resetResp = flyRequest('PUT', '/api/admin/users/' . $flyUserId . '/action', [
            'action' => 'reset_password',
            'reason' => 'User requested password reset'
        ], $adminToken);
        if ($resetResp['code'] !== 200) {
            throw new Exception('Failed to reset password');
        }
    }

    $verifyLogin = flyRequest('POST', '/api/auth/login-json', [
        'email' => $email, 'password' => FLY_TEMP_PASSWORD
    ]);
    if ($verifyLogin['code'] !== 200) {
        throw new Exception('Password reset did not apply correctly');
    }

    require_once __DIR__ . '/email_service.php';
    $emailService = getEmailService();
    $userName = isset($flyUser['name']) ? $flyUser['name'] : 'Usuario';
    $emailResult = $emailService->sendPasswordResetEmail($email, $userName, FLY_TEMP_PASSWORD);

    if ($emailResult && isset($emailResult['success']) && $emailResult['success']) {
        echo json_encode(['success' => true, 'message' => 'Se ha enviado una contrasena temporal a tu email.']);
    } else {
        echo json_encode([
            'success' => true,
            'message' => 'Tu contrasena ha sido restablecida. Revisa tu email o usa la contrasena temporal.',
            'show_temp' => true
        ]);
    }
} catch (Exception $e) {
    error_log("Error in forgot_password: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error al procesar la solicitud. Intenta nuevamente.']);
}
