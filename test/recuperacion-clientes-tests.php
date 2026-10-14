<?php
/**
 * Recuperacion de contrasena de los clientes — pruebas
 * ====================================================
 *
 * Lo que se protege aqui no es que el formulario "funcione": es que siga
 * cumpliendo las tres promesas que lo hacen seguro, porque las tres son
 * invisibles mirando la pantalla.
 *
 *   1. El enlace vence y se usa UNA vez.
 *   2. Nadie puede pedir enlaces sin parar — ni para un correo, ni desde una IP.
 *   3. El formulario contesta lo mismo exista o no la cuenta, para que no sirva
 *      de lista de clientes de Imporlan.
 *
 * Se corre solo:  php test/recuperacion-clientes-tests.php
 */

$tmp = sys_get_temp_dir() . '/imporlan_test_tokens_' . getmypid();
@mkdir($tmp, 0700, true);
define('UR_DIR_TOKENS', $tmp);

require_once __DIR__ . '/../api/user_recovery_common.php';

$ok = 0;
$fallos = [];

function prueba($titulo, $condicion) {
    global $ok, $fallos;
    if ($condicion) {
        $ok++;
        echo "  ok    $titulo\n";
    } else {
        $fallos[] = $titulo;
        echo "  FALLA $titulo\n";
    }
}

/** Crea un token como lo hace user_forgot_password.php. */
function emitirToken($email, $vidaSegundos = 3600) {
    $token = bin2hex(random_bytes(32));
    file_put_contents(urRutaToken($token), json_encode([
        'email'   => $email,
        'expiry'  => time() + $vidaSegundos,
        'ip'      => '1.2.3.4',
        'created' => date('Y-m-d H:i:s'),
    ]));
    return $token;
}

echo "\nRecuperacion de contrasena de clientes\n";
echo str_repeat('-', 54) . "\n";

// ---------------------------------------------------------------- tokens
$token = emitirToken('cliente@ejemplo.cl');

prueba('el token se guarda hasheado, no en claro',
    file_exists($tmp . '/' . hash('sha256', $token) . '.json')
    && !file_exists($tmp . '/' . $token . '.json'));

$contenido = json_decode(file_get_contents(urRutaToken($token)), true);
prueba('el archivo del token no contiene el token',
    strpos(json_encode($contenido), $token) === false);

prueba('un token recien emitido sigue vigente',
    $contenido['expiry'] > time());

// Un solo uso: el endpoint borra el archivo al grabar la clave. Despues de eso
// el mismo enlace no puede volver a servir.
@unlink(urRutaToken($token));
prueba('el token usado deja de existir',
    !file_exists(urRutaToken($token)));

// Vencimiento.
$viejo = emitirToken('cliente@ejemplo.cl', -10);
$datosViejo = json_decode(file_get_contents(urRutaToken($viejo)), true);
prueba('un token vencido se reconoce como vencido',
    $datosViejo['expiry'] < time());
@unlink(urRutaToken($viejo));

// La poda saca lo antiguo y respeta lo reciente.
$reciente = emitirToken('otro@ejemplo.cl');
$antiguo  = emitirToken('viejo@ejemplo.cl');
touch(urRutaToken($antiguo), time() - 4 * 3600);
urPodarTokens(3);
prueba('la poda borra los tokens antiguos',  !file_exists(urRutaToken($antiguo)));
prueba('la poda respeta los tokens vigentes', file_exists(urRutaToken($reciente)));
@unlink(urRutaToken($reciente));

// ------------------------------------------------------------ topes de uso
// Por correo: 3 por hora. El cuarto se rechaza aunque venga de otra IP, para
// que nadie use el formulario para llenarle la bandeja a un cliente.
$victima = 'victima@ejemplo.cl';
$permitidos = 0;
for ($i = 0; $i < 3; $i++) {
    if (urPermiteSolicitud($victima, '10.0.0.' . $i)) $permitidos++;
}
prueba('se permiten 3 solicitudes por correo', $permitidos === 3);
prueba('la cuarta solicitud del mismo correo se rechaza',
    urPermiteSolicitud($victima, '10.0.0.99') === false);

// Por IP: 12 por hora, con correos distintos. Asi no se puede recorrer una
// lista de correos desde una sola maquina.
$ip = '172.16.0.1';
$permitidos = 0;
for ($i = 0; $i < 12; $i++) {
    if (urPermiteSolicitud("c$i@ejemplo.cl", $ip)) $permitidos++;
}
prueba('se permiten 12 solicitudes por IP', $permitidos === 12);
prueba('la numero 13 desde la misma IP se rechaza',
    urPermiteSolicitud('c99@ejemplo.cl', $ip) === false);

// Un rechazo por correo no debe gastar tambien la cuota de la IP: si lo
// hiciera, insistir con un correo bloqueado dejaria sin servicio a toda la
// oficina que sale por esa misma IP.
$ipLimpia = '192.168.50.7';
urPermiteSolicitud($victima, $ipLimpia);   // rechazado por el tope del correo
$sobrevivientes = 0;
for ($i = 0; $i < 12; $i++) {
    if (urPermiteSolicitud("libre$i@ejemplo.cl", $ipLimpia)) $sobrevivientes++;
}
prueba('un rechazo por correo no consume la cuota de la IP', $sobrevivientes === 12);

// ------------------------------------------------- solo cuentas de cliente
// admin_users guarda tambien a los administradores, y este formulario es
// publico: sin este filtro cualquiera podria disparar el cambio de clave de un
// administrador escribiendo su correo.
prueba('una cuenta con role user si se atiende',
    urEsCuentaDeCliente(['role' => 'user']) === true);
prueba('una cuenta de administrador no se atiende',
    urEsCuentaDeCliente(['role' => 'admin']) === false);
prueba('una cuenta de soporte no se atiende',
    urEsCuentaDeCliente(['role' => 'support']) === false);
prueba('una fila sin role no se atiende',
    urEsCuentaDeCliente(['email' => 'x@y.cl']) === false);

$reset = file_get_contents(__DIR__ . '/../api/user_reset_password.php');
prueba('la pagina de cambio tambien comprueba el role',
    strpos($reset, 'urEsCuentaDeCliente($cuenta)') !== false);

// --------------------------------------------- el tope no se puede esquivar
// Si urIpCliente leyera X-Forwarded-For, bastaria con cambiar esa cabecera en
// cada intento para estrenar cuota una y otra vez.
$_SERVER['REMOTE_ADDR'] = '203.0.113.9';
$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.77';
prueba('el tope se cuenta por REMOTE_ADDR, no por la cabecera del proxy',
    urIpCliente() === '203.0.113.9');
prueba('el log si conserva la cabecera del proxy',
    strpos(urIpParaElLog(), '198.51.100.77') !== false);

$_SERVER['REMOTE_ADDR'] = 'no-es-una-ip';
prueba('una REMOTE_ADDR rara no se usa como clave',
    urIpCliente() === 'desconocida');
unset($_SERVER['HTTP_X_FORWARDED_FOR']);

// ---------------------------------------- el enlace va a un solo buzon
// Los correos normales llevan copia oculta a jpchs1@gmail.com y CC al correo
// secundario del cliente. Este lleva la llave de la cuenta.
$forgotSrc = file_get_contents(__DIR__ . '/../api/user_forgot_password.php');
prueba('el enlace se manda con sendPrivateEmail',
    strpos($forgotSrc, 'sendPrivateEmail(') !== false
    && strpos($forgotSrc, 'sendCustomEmail(') === false);

$mailer = file_get_contents(__DIR__ . '/../api/email_service.php');
prueba('sendPrivateEmail pide envio solo al destinatario',
    (bool) preg_match('/function sendPrivateEmail.*?sendEmail\(.*?,\s*true\s*\)/s', $mailer));
prueba('la copia oculta se salta cuando es solo al destinatario',
    strpos($mailer, '!empty($this->bccEmails) && !$soloDestinatario') !== false);
prueba('el CC al correo secundario tambien se salta',
    strpos($mailer, '$soloDestinatario ? null : $this->getSecondaryEmail(') !== false);

// ------------------------------------------ nada de tokens huerfanos
prueba('si el correo no sale, el token se borra',
    (bool) preg_match('/if \(empty\(\$envio\[.success.\]\)\) \{.*?@unlink\(\$ruta\)/s', $forgotSrc));

// Un 500 solo para las cuentas reales seria, durante una caida del SMTP, la
// lista de clientes de Imporlan servida en bandeja. Se mira SOLO ese bloque:
// el catch de mas abajo si contesta 500, y con el archivo entero cualquier
// comprobacion daria igual.
$iniBloque = strpos($forgotSrc, "if (empty(\$envio['success'])) {");
$bloqueFallo = $iniBloque === false ? '' : substr($forgotSrc, $iniBloque, strpos($forgotSrc, 'exit();', $iniBloque) - $iniBloque);
prueba('un fallo de SMTP contesta igual que una cuenta inexistente',
    $bloqueFallo !== ''
    && strpos($bloqueFallo, 'echo json_encode($respuestaNeutra);') !== false
    && strpos($bloqueFallo, 'http_response_code(500)') === false);

// ------------------------------------- el uso unico, de verdad
// unlink es atomico: de dos peticiones con el mismo enlace, solo una recibe
// true. Comprobar y borrar despues dejaba pasar a las dos.
prueba('el token se reclama antes de tocar la base de datos',
    strpos($reset, 'if (!@unlink(urRutaToken($token))) {') !== false
    && strpos($reset, 'if (!@unlink(urRutaToken($token))) {') < strpos($reset, 'getDbConnection()'));

// ------------------------------------------------- misma respuesta siempre
// La frase de exito esta escrita UNA sola vez. Si alguien agregara un segundo
// texto para el caso "no existe la cuenta", el formulario pasaria a delatar
// que correos tienen cuenta en Imporlan.
$forgot = file_get_contents(__DIR__ . '/../api/user_forgot_password.php');
preg_match_all('/Si ese correo tiene una cuenta/', $forgot, $coincidencias);
prueba('la respuesta de exito se arma en un solo lugar',
    count($coincidencias[0]) === 1);

prueba('el caso "sin cuenta" devuelve esa misma respuesta',
    (bool) preg_match('/sin cuenta.*\n.*echo json_encode\(\$respuestaNeutra\)/', $forgot));

// -------------------------------------------- cuenta desactivada en el login
// Antes el SELECT filtraba por status y una cuenta desactivada contestaba
// "credenciales invalidas" aunque la clave fuera correcta: el cliente creia
// tener mal la contrasena y la cambiaba sin que eso pudiera arreglar nada.
// Se mira solo handleLogin(): handleVerify2FA sigue filtrando por status a
// proposito, como segunda barrera, y ahi el filtro no estorba porque a esa
// altura la clave ya se comprobo.
$auth = file_get_contents(__DIR__ . '/../api/auth_local.php');
$desde = strpos($auth, 'function handleLogin(');
$hasta = strpos($auth, 'function handleVerify2FA(');
$cuerpoLogin = substr($auth, $desde, $hasta - $desde);

prueba('handleLogin ya no filtra por status en el SELECT',
    strpos($cuerpoLogin, "FROM admin_users WHERE email = ? AND status = 'active'") === false);
prueba('handleLogin avisa cuando la cuenta esta desactivada',
    strpos($cuerpoLogin, 'Tu cuenta esta desactivada') !== false);
prueba('handleLogin solo revela el estado tras verificar la clave',
    strpos($cuerpoLogin, 'if ($claveOk && !$cuentaActiva) {') !== false);

// password_verify es lento a proposito. Llamarlo en las dos ramas duplicaba el
// tiempo de cada login, acertado o no. Se cuenta solo el tramo de admin_users:
// el de la tabla `users` heredada, mas abajo, es otra cuenta y su propia
// llamada.
$tramoAdminUsers = substr($cuerpoLogin, 0, strpos($cuerpoLogin, '// Check panel users'));
prueba('handleLogin comprueba la clave una sola vez por cuenta',
    substr_count($tramoAdminUsers, 'password_verify(') === 1);

// --------------------------------------------------------------- limpieza
foreach (glob($tmp . '/*') ?: [] as $f) @unlink($f);
@rmdir($tmp);

echo str_repeat('-', 54) . "\n";
if ($fallos) {
    echo count($fallos) . " prueba(s) fallaron:\n";
    foreach ($fallos as $f) echo "  - $f\n";
    exit(1);
}
echo "$ok prueba(s), todo en orden.\n\n";
