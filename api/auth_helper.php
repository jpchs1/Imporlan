<?php
/**
 * Shared Authentication Helper - Imporlan
 * Provides JWT verification for API endpoints
 * JWT secret is loaded from environment variable JWT_SECRET
 */

function getJwtSecret() {
    if (defined('JWT_SECRET')) {
        return JWT_SECRET;
    }
    $secret = getenv('JWT_SECRET');
    if ($secret) {
        return $secret;
    }
    $adminApi = __DIR__ . '/admin_api.php';
    if (file_exists($adminApi)) {
        $content = file_get_contents($adminApi);
        if (preg_match("/define\s*\(\s*'JWT_SECRET'\s*,\s*'([^']+)'\s*\)/", $content, $m)) {
            define('JWT_SECRET', $m[1]);
            return $m[1];
        }
    }
    return '';
}

function authBase64UrlDecode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

function authBase64UrlEncode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function verifyJWTToken($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    list($base64Header, $base64Payload, $base64Signature) = $parts;

    $secret = getJwtSecret();
    if (!$secret) return null;

    $signature = hash_hmac('sha256', "$base64Header.$base64Payload", $secret, true);
    $expectedSignature = authBase64UrlEncode($signature);

    if (!hash_equals($expectedSignature, $base64Signature)) return null;

    $payload = json_decode(authBase64UrlDecode($base64Payload), true);

    if (isset($payload['exp']) && $payload['exp'] < time()) return null;

    return $payload;
}

function requireAdminAuthShared() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

    if (!preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit();
    }

    $payload = verifyJWTToken($matches[1]);

    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Token invalido o expirado']);
        exit();
    }

    if (!isset($payload['role']) || !in_array($payload['role'], ['admin', 'support'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Acceso denegado']);
        exit();
    }

    return $payload;
}
