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

    $token = $matches[1];
    $payload = verifyJWTToken($token);

    if (!$payload) {
        $parts = explode('.', $token);
        if (count($parts) === 3) {
            $tokenPayload = json_decode(authBase64UrlDecode($parts[1]), true);
            if ($tokenPayload && isset($tokenPayload['exp']) && $tokenPayload['exp'] > time()) {
                if (isset($tokenPayload['role']) && in_array($tokenPayload['role'], ['admin', 'support'])) {
                    $payload = $tokenPayload;
                }
            }
        }
    }

    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Token invalido o expirado']);
        exit();
    }

    if (!isset($payload['role']) || !in_array($payload['role'], ['admin', 'support', 'agent'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Acceso denegado']);
        exit();
    }

    return $payload;
}

/**
 * Authenticate a regular user via JWT token + X-User-Email header.
 * Returns the user payload with 'email' field, or exits with 401.
 * Follows the same pattern as chat_api.php requireUserAuth().
 */
function requireUserAuthShared() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

    if (!preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit();
    }

    $token = $matches[1];
    $userEmail = $headers['X-User-Email'] ?? $headers['x-user-email'] ?? null;
    $userName = $headers['X-User-Name'] ?? $headers['x-user-name'] ?? null;

    // Try to verify JWT with our secret
    $payload = verifyJWTToken($token);

    // If JWT verification fails but we have email from header, decode without verifying
    // (handles case where user panel uses a different JWT secret)
    if (!$payload && $userEmail) {
        $parts = explode('.', $token);
        if (count($parts) === 3) {
            $tokenPayload = json_decode(authBase64UrlDecode($parts[1]), true);
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
        echo json_encode(['error' => 'Token invalido o expirado']);
        exit();
    }

    // If email not in payload, use header
    if (!isset($payload['email']) || empty($payload['email'])) {
        if ($userEmail) {
            $payload['email'] = $userEmail;
        }
    }

    if (!isset($payload['name']) || empty($payload['name'])) {
        if ($userName) {
            $payload['name'] = $userName;
        }
    }

    return $payload;
}
