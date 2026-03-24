<?php
/**
 * Admin Forgot Password - Imporlan Admin Panel (TEST)
 * Generates a secure reset token, stores it on the server, and emails
 * a reset link to contacto@imporlan.cl so the admin can set a new password.
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

// Only allow admin email
if ($email !== 'admin@imporlan.cl') {
    http_response_code(400);
    echo json_encode(['error' => 'Este formulario es solo para el administrador.']);
    exit();
}

// Generate secure token
$token = bin2hex(random_bytes(32));
$expiry = time() + 3600; // 1 hour

// Store token in a file (one token at a time for admin)
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
    'token' => hash('sha256', $token),
    'email' => $email,
    'expiry' => $expiry,
    'ip' => isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown',
    'created' => date('Y-m-d H:i:s')
]));

// Build reset URL
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'www.imporlan.cl';
$resetUrl = $scheme . '://' . $host . '/test/api/admin_reset_password.php?token=' . $token;

// SMTP configuration
$smtpHost = 'mail.imporlan.cl';
$smtpPort = 465;
$smtpUser = 'contacto@imporlan.cl';
$smtpPass = '^IBn?P-Z5@#_';

$to = 'contacto@imporlan.cl';
$date = date('d/m/Y H:i:s');

$subject = '[TEST] Restablecer contrasena - Admin Panel Imporlan';

$htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:20px">';
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
$htmlBody .= '<div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:16px 0">';
$htmlBody .= '<p style="margin:4px 0;color:#64748b;font-size:13px"><strong>Fecha:</strong> ' . $date . '</p>';
$htmlBody .= '<p style="margin:4px 0;color:#64748b;font-size:13px"><strong>Expira en:</strong> 1 hora</p>';
$htmlBody .= '</div>';
$htmlBody .= '<p style="color:#94a3b8;font-size:12px;line-height:1.5">Si no solicitaste este cambio, ignora este correo. El enlace expirara automaticamente.</p>';
$htmlBody .= '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">';
$htmlBody .= '<p style="color:#94a3b8;font-size:12px;text-align:center">Notificacion automatica del sistema Imporlan (TEST)</p>';
$htmlBody .= '</div></body></html>';

try {
    $errno = 0;
    $errstr = '';
    $context = stream_context_create([
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true]
    ]);
    $smtp = @stream_socket_client("ssl://$smtpHost:$smtpPort", $errno, $errstr, 30, STREAM_CLIENT_CONNECT, $context);
    if (!$smtp) {
        throw new Exception("SMTP connect failed: $errstr ($errno)");
    }

    fgets($smtp, 515);
    fwrite($smtp, "EHLO imporlan.cl\r\n"); fgets($smtp, 515);
    while ($line = fgets($smtp, 515)) { if ($line[3] === ' ') break; }
    fwrite($smtp, "AUTH LOGIN\r\n"); fgets($smtp, 515);
    fwrite($smtp, base64_encode($smtpUser) . "\r\n"); fgets($smtp, 515);
    fwrite($smtp, base64_encode($smtpPass) . "\r\n"); fgets($smtp, 515);
    fwrite($smtp, "MAIL FROM:<$smtpUser>\r\n"); fgets($smtp, 515);
    fwrite($smtp, "RCPT TO:<$to>\r\n"); fgets($smtp, 515);
    fwrite($smtp, "DATA\r\n"); fgets($smtp, 515);

    $headers = "From: Imporlan <$smtpUser>\r\n";
    $headers .= "To: $to\r\n";
    $headers .= "Subject: $subject\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "Date: " . date('r') . "\r\n";
    $headers .= "Message-ID: <" . uniqid('imporlan_admin_reset_test_', true) . "@imporlan.cl>\r\n";
    $headers .= "\r\n";

    fwrite($smtp, $headers . $htmlBody . "\r\n.\r\n");
    $dataResp = fgets($smtp, 515);
    fwrite($smtp, "QUIT\r\n");
    fclose($smtp);

    if (strpos($dataResp, '250') !== false) {
        echo json_encode([
            'success' => true,
            'message' => 'Se ha enviado un enlace de recuperacion a contacto@imporlan.cl. Revisa tu bandeja de entrada.'
        ]);
    } else {
        throw new Exception("SMTP DATA response: $dataResp");
    }
} catch (Exception $e) {
    error_log("Error in admin_forgot_password (test): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error al enviar el correo. Intenta nuevamente.']);
}
