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

define('FLY_API', 'https://app-bxlfgnkv.fly.dev');
define('ADMIN_EMAIL', 'admin@imporlan.cl');
define('ADMIN_PASS', 'admin123');

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

function findFlyUserId($adminToken, $email) {
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
        'email' => ADMIN_EMAIL, 'password' => ADMIN_PASS
    ]);
    if ($adminLogin['code'] !== 200 || !isset($adminLogin['body']['access_token'])) {
        throw new Exception('Cannot connect to auth service');
    }
    $adminToken = $adminLogin['body']['access_token'];

    $flyUser = findFlyUserId($adminToken, $email);
    if (!$flyUser) {
        http_response_code(404);
        echo json_encode(['error' => 'Usuario no encontrado']);
        exit();
    }

    $flyUserId = $flyUser['id'];
    $flyUserName = $flyUser['name'];

    $updateResp = flyRequest('PUT', '/api/admin/users/' . $flyUserId, [
        'password' => $newPassword
    ], $adminToken);

    if ($updateResp['code'] === 200 || $updateResp['code'] === 204) {
        echo json_encode(['success' => true, 'message' => 'Contrasena actualizada correctamente']);
        exit();
    }

    $patchResp = flyRequest('PATCH', '/api/admin/users/' . $flyUserId, [
        'password' => $newPassword
    ], $adminToken);

    if ($patchResp['code'] === 200 || $patchResp['code'] === 204) {
        echo json_encode(['success' => true, 'message' => 'Contrasena actualizada correctamente']);
        exit();
    }

    $del = flyRequest('DELETE', '/api/users/' . $flyUserId, null, $adminToken);
    if ($del['code'] !== 200 && $del['code'] !== 204) {
        $del = flyRequest('DELETE', '/api/admin/users/' . $flyUserId, null, $adminToken);
    }

    sleep(1);

    $reg = flyRequest('POST', '/api/auth/register', [
        'email' => $email,
        'password' => $newPassword,
        'name' => $flyUserName
    ]);

    if ($reg['code'] !== 200 && $reg['code'] !== 201) {
        sleep(2);
        $reg2 = flyRequest('POST', '/api/auth/register', [
            'email' => $email,
            'password' => $newPassword,
            'name' => $flyUserName
        ]);
        if ($reg2['code'] !== 200 && $reg2['code'] !== 201) {
            $verify = flyRequest('POST', '/api/auth/login-json', [
                'email' => $email, 'password' => $newPassword
            ]);
            if ($verify['code'] !== 200) {
                throw new Exception('Error updating auth service: ' . ($reg['raw'] ?? 'unknown'));
            }
        }
    }

    echo json_encode(['success' => true, 'message' => 'Contrasena actualizada correctamente']);
} catch (Exception $e) {
    error_log("Error changing password: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error al cambiar la contrasena. Intenta nuevamente.']);
}
