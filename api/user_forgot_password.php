<?php
/**
 * "Olvide mi contrasena" del panel del cliente
 * ============================================
 *
 * Recibe un correo, y si hay una cuenta con ese correo le manda un enlace para
 * poner una clave nueva. El enlace vale una hora y una sola vez.
 *
 * La respuesta es SIEMPRE la misma, exista la cuenta o no. Si contestara
 * "ese correo no esta registrado", el formulario se convertiria en una forma
 * comoda de averiguar quienes son clientes de Imporlan.
 */

require_once __DIR__ . '/cors_helper.php';
setCorsHeadersSecure();
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

require_once __DIR__ . '/user_recovery_common.php';

$input = json_decode(file_get_contents('php://input'), true);
$email = isset($input['email']) ? trim($input['email']) : '';

// La misma frase para todos los finales buenos. Esta escrita una sola vez para
// que ningun cambio futuro la deje distinta en una rama y no en la otra: dos
// textos distintos vuelven a delatar que cuentas existen.
$respuestaNeutra = [
    'success' => true,
    'message' => 'Si ese correo tiene una cuenta en Imporlan, te enviamos un enlace para crear una contrasena nueva. '
               . 'Revisa tu bandeja de entrada y la carpeta de spam; puede tardar un par de minutos.',
];

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Escribe un correo valido.']);
    exit();
}

$ip = urIpCliente();

if (!urPermiteSolicitud($email, $ip)) {
    urRegistrar("limite alcanzado  $email  ip=" . urIpParaElLog());
    http_response_code(429);
    echo json_encode(['error' => 'Ya pediste varios enlaces seguidos. Espera una hora o escribenos a contacto@imporlan.cl.']);
    exit();
}

urPodarTokens();

try {
    $pdo = getDbConnection();
    if (!$pdo) throw new Exception('sin conexion a la base de datos');

    $cuenta = urBuscarCuenta($pdo, $email);

    if (!$cuenta) {
        // Para el cliente esto se ve igual que un envio correcto. Queda en el
        // log para que, cuando avise que no le llego nada, se sepa que el
        // correo que escribio no tiene cuenta.
        urRegistrar("sin cuenta  $email  ip=" . urIpParaElLog() . urPistaTablaHeredada($pdo, $email));
        echo json_encode($respuestaNeutra);
        exit();
    }

    if (!urEsCuentaDeCliente($cuenta)) {
        // Este formulario es publico: si atendiera tambien a los
        // administradores, cualquiera podria disparar el cambio de clave de uno
        // con solo escribir su correo. Ellos tienen admin_forgot_password.php.
        // Queda anotado por si alguna vez un cliente de verdad quedara aqui con
        // el role equivocado: se veria en el log en vez de ser un misterio.
        urRegistrar("cuenta no es de cliente  {$cuenta['email']}  role={$cuenta['role']}  ip=" . urIpParaElLog());
        echo json_encode($respuestaNeutra);
        exit();
    }

    $token = bin2hex(random_bytes(32));
    $ruta = urRutaToken($token);
    if (!$ruta) throw new Exception('no se pudo crear el directorio de tokens');

    $guardado = @file_put_contents($ruta, json_encode([
        'email'   => $cuenta['email'],
        'expiry'  => time() + 3600,
        'ip'      => $ip,
        'created' => date('Y-m-d H:i:s'),
    ]));
    if ($guardado === false) throw new Exception('no se pudo guardar el token');
    @chmod($ruta, 0600);

    // Host fijo: nunca el Host de la peticion. Si se tomara de ahi, un atacante
    // podria hacer que el enlace —con un token valido— apunte a su dominio.
    $enlace = 'https://www.imporlan.cl/api/user_reset_password.php?token=' . $token;

    $nombre = trim((string) $cuenta['name']);
    if ($nombre === '' || strpos($nombre, '@') !== false) {
        $nombre = 'Hola';
    } else {
        $nombre = 'Hola ' . explode(' ', $nombre)[0];
    }

    $html  = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>';
    $html .= '<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif">';
    $html .= '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:36px;box-shadow:0 2px 10px rgba(15,23,42,.08)">';
    $html .= '<div style="text-align:center;margin-bottom:24px">';
    $html .= '<div style="display:inline-block;width:56px;height:56px;line-height:56px;background:#0891b2;border-radius:16px;color:#fff;font-size:26px;font-weight:700">I</div>';
    $html .= '<h2 style="color:#0f172a;margin:16px 0 0;font-size:21px">Crea una contrasena nueva</h2>';
    $html .= '</div>';
    $html .= '<p style="color:#475569;font-size:15px;line-height:1.6">' . htmlspecialchars($nombre) . ', recibimos una solicitud para recuperar el acceso a tu panel de Imporlan.</p>';
    $html .= '<p style="color:#475569;font-size:15px;line-height:1.6">Haz clic en el boton y elige tu contrasena nueva:</p>';
    $html .= '<div style="text-align:center;margin:28px 0">';
    $html .= '<a href="' . htmlspecialchars($enlace) . '" style="display:inline-block;background:#0891b2;color:#fff;padding:14px 34px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600">Crear contrasena nueva</a>';
    $html .= '</div>';
    $html .= '<p style="color:#94a3b8;font-size:12px;text-align:center;word-break:break-all">O copia este enlace en tu navegador:<br>' . htmlspecialchars($enlace) . '</p>';
    $html .= '<div style="background:#f8fafc;border-radius:10px;padding:14px 16px;margin:20px 0">';
    $html .= '<p style="margin:4px 0;color:#64748b;font-size:13px"><strong>El enlace vence en:</strong> 1 hora</p>';
    $html .= '<p style="margin:4px 0;color:#64748b;font-size:13px"><strong>Se puede usar:</strong> una sola vez</p>';
    $html .= '</div>';
    $html .= '<p style="color:#94a3b8;font-size:12px;line-height:1.6">Si no pediste esto, ignora el correo: tu contrasena actual sigue funcionando y nadie puede entrar con este enlace sin acceso a tu bandeja.</p>';
    $html .= '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">';
    $html .= '<p style="color:#94a3b8;font-size:12px;text-align:center">Imporlan &middot; contacto@imporlan.cl &middot; +56 9 4021 1459</p>';
    $html .= '</div></body></html>';

    require_once __DIR__ . '/email_service.php';
    $emailService = new EmailService();
    // sendPrivateEmail y no sendCustomEmail: los correos normales llevan copia
    // oculta a jpchs1@gmail.com y CC al correo secundario del cliente, y este
    // lleva la llave de la cuenta. Tiene que llegar a un solo buzon.
    $envio = $emailService->sendPrivateEmail($cuenta['email'], 'Recupera el acceso a tu panel Imporlan', $html);

    if (empty($envio['success'])) {
        // Se borra el token. Dejarlo vivo no le sirve a nadie —en disco solo
        // esta su hash, asi que el enlace ya no se puede reconstruir para
        // entregarlo a mano— y mientras tanto seguiria siendo un enlace valido
        // sin que el cliente sepa que existe.
        @unlink($ruta);
        $motivo = $envio['error'] ?? 'desconocido';
        urRegistrar("fallo el envio  {$cuenta['email']}  ip=" . urIpParaElLog() . "  motivo=$motivo");
        error_log('user_forgot_password: envio fallido - ' . $motivo);

        // Y se contesta lo mismo que si la cuenta no existiera. Un error aqui
        // seria un error QUE SOLO VEN LAS CUENTAS REALES: durante una caida del
        // SMTP bastaria con ir probando correos y quedarse con los que dan 500
        // para sacar la lista de clientes de Imporlan. El cliente no queda a
        // ciegas, porque debajo del mensaje el panel muestra el correo y el
        // WhatsApp de Imporlan para cuando no llega nada.
        echo json_encode($respuestaNeutra);
        exit();
    }

    $aviso = $cuenta['status'] === 'active' ? '' : "  (cuenta en estado {$cuenta['status']})";
    urRegistrar("enlace enviado  {$cuenta['email']}  ip=" . urIpParaElLog() . $aviso);

    echo json_encode($respuestaNeutra);
} catch (Exception $e) {
    error_log('user_forgot_password: ' . $e->getMessage());
    urRegistrar("error  $email  ip=" . urIpParaElLog() . "  " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Hubo un problema al procesar tu solicitud. Intenta de nuevo o escribenos a contacto@imporlan.cl.']);
}
