<?php
/**
 * Shared Authentication Helper - Imporlan
 * Provides JWT verification for API endpoints
 * JWT secret is loaded from environment variable JWT_SECRET
 */

function getJwtSecret() {
    if (defined('IMPORLAN_JWT_SECRET')) {
        return IMPORLAN_JWT_SECRET;
    }
    if (defined('JWT_SECRET')) {
        return JWT_SECRET;
    }
    // Load from credentials config
    $credentialsFile = __DIR__ . '/credentials.php';
    if (file_exists($credentialsFile)) {
        require_once $credentialsFile;
        if (defined('IMPORLAN_JWT_SECRET')) {
            return IMPORLAN_JWT_SECRET;
        }
    }
    $secret = getenv('JWT_SECRET');
    if ($secret) {
        return $secret;
    }
    error_log('CRITICAL: JWT secret not configured');
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

/**
 * Require admin authentication.
 * @param array $allowedRoles Roles allowed for this endpoint. Defaults to ['admin', 'support'].
 *        Pass ['admin', 'support', 'agent'] to also allow agent access on specific endpoints.
 */
function requireAdminAuthShared($allowedRoles = ['admin', 'support']) {
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
        http_response_code(401);
        echo json_encode(['error' => 'Token invalido o expirado']);
        exit();
    }

    if (($payload['purpose'] ?? null) === '2fa_pending') {
        http_response_code(401);
        echo json_encode(['error' => 'Token de 2FA no es valido para esta operacion']);
        exit();
    }

    if (!isset($payload['role']) || !in_array($payload['role'], $allowedRoles)) {
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

    // Verify JWT with cryptographic signature - no bypass allowed
    $payload = verifyJWTToken($token);

    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Token invalido o expirado']);
        exit();
    }

    return $payload;
}
