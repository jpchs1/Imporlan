<?php
/**
 * Admin Forgot Password - Imporlan Admin Panel (TEST)
 *
 * Generates a secure reset token, stores it on the server, and emails
 * a reset link to contacto@imporlan.cl using the shared EmailService,
 * which loads its SMTP credentials from /home/wwimpo/smtp_config.php.
 */
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
$email = isset($input['email']) ? trim(strtolower($input['email'])) : '';

if (!$email || strpos($email, '@') === false) {
    http_response_code(400);
    echo json_encode(['error' => 'Email es requerido']);
    exit();
}

if ($email !== 'admin@imporlan.cl') {
    http_response_code(400);
    echo json_encode(['error' => 'Este formulario es solo para el administrador.']);
    exit();
}

$token = bin2hex(random_bytes(32));
$expiry = time() + 3600; // 1 hour

$tokenDir = __DIR__ . '/../.admin_reset_tokens';
if (!is_dir($tokenDir)) {
    mkdir($tokenDir, 0700, true);
}
$htaccess = $tokenDir . '/.htaccess';
if (!file_exists($htaccess)) {
    file_put_contents($htaccess, "Deny from all\n");
}
$tokenFile = $tokenDir . '/token.json';
file_put_contents($tokenFile, json_encode([
    'token'   => hash('sha256', $token),
    'email'   => $email,
    'expiry'  => $expiry,
    'ip'      => isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown',
    'created' => date('Y-m-d H:i:s')
]));

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'www.imporlan.cl';
$resetUrl = $scheme . '://' . $host . '/test/api/admin_reset_password.php?token=' . $token;

$to = 'contacto@imporlan.cl';
$date = date('d/m/Y H:i:s');

$subject = '[TEST] Restablecer contrasena - Admin Panel Imporlan';

$htmlBody  = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:20px">';
$htmlBody .= '<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.1)">';
$htmlBody .= '<div style="text-align:center;margin-bottom:24px">';
$htmlBody .= '<div style="width:56px;height:56px;background:#3b82f6;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center">';
$htmlBody .= '<span style="color:#fff;font-size:24px">&#128274;</span>';
$htmlBody .= '</div>';
$htmlBody .= '<h2 style="color:#1e293b;margin:0">[TEST] Restablecer Contrasena</h2>';
$htmlBody .= '</div>';
$htmlBody .= '<p style="color:#475569;font-size:15px;line-height:1.6">Se ha solicitado un restablecimiento de contrasena para el <strong>Admin Panel (TEST)</strong> de Imporlan.</p>';
$htmlBody .= '<p style="color:#475569;font-size:15px;line-height:1.6">Haz clic en el boton de abajo para crear una nueva contrasena:</p>';
$htmlBody .= '<div style="text-align:center;margin:28px 0">';
$htmlBody .= '<a href="' . htmlspecialchars($resetUrl) . '" style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600">Restablecer Contrasena</a>';
$htmlBody .= '</div>';
$htmlBody .= '<p style="color:#94a3b8;font-size:12px;text-align:center;word-break:break-all">O copia este enlace en tu navegador:<br>' . htmlspecialchars($resetUrl) . '</p>';
$htmlBody .= '<div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:16px 0">';
$htmlBody .= '<p style="margin:4px 0;color:#64748b;font-size:13px"><strong>Fecha:</strong> ' . $date . '</p>';
$htmlBody .= '<p style="margin:4px 0;color:#64748b;font-size:13px"><strong>Expira en:</strong> 1 hora</p>';
$htmlBody .= '</div>';
$htmlBody .= '<p style="color:#94a3b8;font-size:12px;line-height:1.5">Si no solicitaste este cambio, ignora este correo. El enlace expirara automaticamente.</p>';
$htmlBody .= '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">';
$htmlBody .= '<p style="color:#94a3b8;font-size:12px;text-align:center">Notificacion automatica del sistema Imporlan (TEST)</p>';
$htmlBody .= '</div></body></html>';

try {
    require_once __DIR__ . '/email_service.php';
    $emailService = new EmailService();
    $result = $emailService->sendCustomEmail($to, $subject, $htmlBody);

    if (!empty($result['success'])) {
        echo json_encode([
            'success' => true,
            'message' => 'Se envio un enlace de recuperacion al correo del administrador (' . $to . '). Revisa la bandeja de entrada y la carpeta de spam; puede tardar 1-2 minutos.'
        ]);
    } else {
        $err = isset($result['error']) ? $result['error'] : 'Error desconocido al enviar el correo';
        error_log('admin_forgot_password (test): send failed - ' . $err);
        http_response_code(500);
        echo json_encode([
            'error'  => 'No se pudo enviar el correo de recuperacion. Verifica la configuracion SMTP o intenta nuevamente.',
            'detail' => $err
        ]);
    }
} catch (Exception $e) {
    error_log('admin_forgot_password (test) exception: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error'  => 'Error al enviar el correo de recuperacion.',
        'detail' => $e->getMessage()
    ]);
}
