<?php
/**
 * Register Proxy - Imporlan
 *
 * Originally proxied to two Fly.dev backends (now retired / DNS no longer resolves).
 * Kept as a back-compat shim because the SPA bundle hardcodes /api/register-proxy.php.
 *
 * Flow:
 *   1. Delegate registration to handleRegister() in auth_local.php (local DB).
 *   2. On success, fire an internal admin notification email via EmailService.
 */

require_once __DIR__ . '/cors_helper.php';
require_once __DIR__ . '/auth_local.php';

setCorsHeadersSecure();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['detail' => 'Method not allowed']);
    exit();
}

ob_start();
try {
    handleRegister();
} catch (Throwable $e) {
    error_log("register-proxy handleRegister error: " . $e->getMessage());
    if (http_response_code() < 400) {
        http_response_code(500);
    }
    echo json_encode(['detail' => 'Error al registrar usuario']);
}
$body = ob_get_clean();
$status = http_response_code();

echo $body;

if ($status >= 200 && $status < 300) {
    try {
        $data = json_decode($body, true);
        $user = is_array($data) && isset($data['user']) ? $data['user'] : null;
        if ($user && !empty($user['email'])) {
            sendInternalRegistrationNotification($user);
        }
    } catch (Throwable $e) {
        error_log("register-proxy notification error: " . $e->getMessage());
    }
}

function sendInternalRegistrationNotification(array $user): void {
    $emailServiceFile = __DIR__ . '/email_service.php';
    if (!file_exists($emailServiceFile)) {
        return;
    }
    if (!class_exists('EmailService')) {
        require_once $emailServiceFile;
    }
    $service = new EmailService();
    $service->sendInternalNotification('new_registration', [
        'user_name'         => $user['name'] ?? explode('@', $user['email'])[0],
        'user_email'        => $user['email'],
        'registration_date' => date('d/m/Y H:i:s'),
    ]);
}
