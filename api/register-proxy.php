<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
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

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['email']) || empty($input['password'])) {
    http_response_code(400);
    echo json_encode(['detail' => 'Email y password son requeridos']);
    exit();
}

// El registro se resuelve LOCALMENTE.
//
// Este archivo reenviaba a dos backends en Fly.io que ya no existen: los hosts
// ni siquiera resuelven por DNS. Cada registro gastaba 20 segundos en dos
// timeouts de conexion y terminaba devolviendo 500, asi que ningun cliente
// podia crear su cuenta desde el panel. El log lo mostraba en cada intento:
//
//   register-proxy error: https://app-bxlfgnkv.fly.dev/... - Could not resolve host
//
// handleRegister() de auth_local.php ya hace todo lo necesario —valida, detecta
// duplicados, crea el usuario, emite el JWT y manda el correo de bienvenida— y
// es lo que /api/auth/register usa desde hace tiempo. Aqui solo se delega y se
// agrega el aviso interno al equipo, que esa funcion no envia.
require_once __DIR__ . '/auth_local.php';

$registrationData = [
    'email' => $input['email'],
    'password' => $input['password'],
    'name' => $input['name'] ?? explode('@', $input['email'])[0],
    'phone' => $input['phone'] ?? null
];

// Se captura la salida para poder decidir si notificar al equipo sin alterar
// la respuesta que recibe el panel.
ob_start();
handleRegister($input);
$body = ob_get_clean();

$code = http_response_code();
if ($code >= 200 && $code < 300) {
    try {
        sendRegistrationNotification($registrationData);
    } catch (Exception $e) {
        error_log("register-proxy email error: " . $e->getMessage());
    }
}

echo $body;

function sendRegistrationNotification($data) {
    $emailServiceFile = __DIR__ . '/email_service.php';
    $dbConfigFile = __DIR__ . '/db_config.php';

    if (file_exists($emailServiceFile) && file_exists($dbConfigFile)) {
        if (!class_exists('EmailService')) {
            require_once $emailServiceFile;
        }
        try {
            $emailService = new EmailService();
            $emailService->sendInternalNotification('new_registration', [
                'user_name' => $data['name'] ?? explode('@', $data['email'])[0],
                'user_email' => $data['email'],
                'registration_date' => date('d/m/Y H:i:s')
            ]);
            return;
        } catch (Exception $e) {
            error_log("EmailService failed, using fallback: " . $e->getMessage());
        }
    }

    sendFallbackEmail($data);
}

function sendFallbackEmail($data) {
    $smtpHost = 'mail.imporlan.cl';
    $smtpPort = 465;
    $smtpUser = 'contacto@imporlan.cl';
    $smtpPass = '^IBn?P-Z5@#_';
    $adminEmails = ['contacto@imporlan.cl', 'jpchs1@gmail.com'];

    $userName = $data['name'] ?? explode('@', $data['email'])[0];
    $userEmail = $data['email'];
    $date = date('d/m/Y H:i:s');

    $subject = 'Nuevo registro de usuario - Imporlan Panel';
    $body = "Nuevo usuario registrado en el panel de Imporlan:\n\n";
    $body .= "Nombre: $userName\n";
    $body .= "Email: $userEmail\n";
    $body .= "Fecha: $date\n\n";
    $body .= "-- Notificacion automatica del sistema Imporlan";

    foreach ($adminEmails as $to) {
        $errno = 0;
        $errstr = '';
        $context = stream_context_create([
            'ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true]
        ]);
        $smtp = @stream_socket_client("ssl://$smtpHost:$smtpPort", $errno, $errstr, 30, STREAM_CLIENT_CONNECT, $context);
        if (!$smtp) {
            error_log("SMTP connect failed: $errstr ($errno)");
            continue;
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
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $headers .= "Date: " . date('r') . "\r\n";
        $headers .= "Message-ID: <" . uniqid('imporlan_', true) . "@imporlan.cl>\r\n";
        $headers .= "\r\n";

        fwrite($smtp, $headers . $body . "\r\n.\r\n");
        fgets($smtp, 515);
        fwrite($smtp, "QUIT\r\n");
        fclose($smtp);
    }
}
