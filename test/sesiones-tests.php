<?php
/**
 * Cambiar la contrasena cierra las sesiones abiertas — pruebas
 * ===========================================================
 *
 * Un token de Imporlan vale siete dias y se verifica mirando solo su firma y
 * su vencimiento. Hasta ahora, cambiar la contrasena no echaba a nadie: a un
 * cliente con la sesion robada, el ladron le seguia dentro una semana — justo
 * en el caso en que uno cambia la clave.
 *
 * Lo que se protege aqui:
 *
 *   1. Un token emitido ANTES del cambio deja de valer.
 *   2. Uno emitido DESPUES sigue valiendo.
 *   3. Ante la duda NO se echa a nadie: sin archivo, sin marca o sin correo,
 *      la sesion sigue. Un disco lleno no puede dejar a los clientes fuera.
 *   4. Las dos verificaciones de token cortan igual — el panel del cliente usa
 *      una y el de administracion la otra.
 *
 * Se corre solo:  php test/sesiones-tests.php
 */

require_once __DIR__ . '/../api/sesiones.php';

$ok = 0;
$fallos = [];

function prueba($titulo, $condicion) {
    global $ok, $fallos;
    if ($condicion) { $ok++; echo "  ok    $titulo\n"; }
    else { $fallos[] = $titulo; echo "  FALLA $titulo\n"; }
}

// El archivo real no se toca: se trabaja sobre una copia y se restaura.
$archivo = sesionesArchivo();
$habia = is_file($archivo) ? (string) file_get_contents($archivo) : null;
$habiaCarpeta = is_dir(dirname($archivo));
@unlink($archivo);
sesionesLista(true);

echo "\nCerrar sesiones al cambiar la contrasena\n";
echo str_repeat('-', 54) . "\n";

$correo = 'cliente@ejemplo.cl';
$tokenDe = function ($email, $iat) { return ['email' => $email, 'iat' => $iat, 'exp' => $iat + 604800]; };

// ------------------------------------------------- sin marca, nadie se cae
prueba('sin archivo, la sesion sigue valiendo',
    sesionSigueValiendo($tokenDe($correo, time() - 100)) === true);

// ------------------------------------------------------- el corte en si
sesionesCerrarAnteriores($correo);
prueba('la carpeta se crea sola al cerrar sesiones', is_file($archivo));

prueba('un token anterior al cambio deja de valer',
    sesionSigueValiendo($tokenDe($correo, time() - 3600)) === false);

prueba('un token posterior al cambio sigue valiendo',
    sesionSigueValiendo($tokenDe($correo, time() + 2)) === true);

prueba('a otra cuenta no le pasa nada',
    sesionSigueValiendo($tokenDe('otro@ejemplo.cl', time() - 3600)) === true);

prueba('el correo no distingue mayusculas',
    sesionSigueValiendo($tokenDe('CLIENTE@Ejemplo.CL', time() - 3600)) === false);

// --------------------------------------------- ante la duda, no se expulsa
prueba('un payload sin correo no se bloquea',
    sesionSigueValiendo(['iat' => time() - 3600]) === true);

prueba('un payload que no es array no se bloquea',
    sesionSigueValiendo(null) === true);

// Sin iat no hay forma de saber si el token es anterior al cambio; como consta
// que la clave cambio hace poco, ahi si se opta por lo seguro.
prueba('sin iat, con un cambio reciente, no sigue',
    sesionSigueValiendo(['email' => $correo]) === false);

// ------------------------------------------------- la marca caduca sola
// Pasados los siete dias que dura un token, guardar la marca no protege de
// nada: esos tokens ya vencieron por su cuenta.
@file_put_contents($archivo, json_encode([$correo => (int) floor(microtime(true) * 1000) - (8 * 24 * 3600 * 1000)]));
sesionesLista(true);
prueba('una marca de hace mas de siete dias ya no echa a nadie',
    sesionSigueValiendo($tokenDe($correo, time() - (9 * 24 * 3600))) === true);

// Y al escribir se podan: la lista no crece para siempre.
sesionesCerrarAnteriores('nuevo@ejemplo.cl');
$lista = json_decode((string) file_get_contents($archivo), true);
prueba('al escribir se podan las marcas vencidas', !isset($lista[$correo]));
prueba('y se conserva la nueva', isset($lista['nuevo@ejemplo.cl']));

// -------------------------------------------- archivo ilegible: no expulsa
@file_put_contents($archivo, 'esto no es json');
sesionesLista(true);
prueba('un archivo corrupto no deja a nadie fuera',
    sesionSigueValiendo($tokenDe($correo, time() - 3600)) === true);

// ------------------------------- las CINCO verificaciones cortan igual
// Habia cinco copias del verificador de tokens y el corte estaba en dos: el
// dashboard del administrador, el chat y el marketplace seguian aceptando un
// token revocado una semana entera. Se buscan por el patron —partir el token
// en tres—, no por el nombre, que es como se escaparon la primera vez.
$corte = "if (function_exists('sesionSigueValiendo') && !sesionSigueValiendo(\$payload)) return null;";
// Se busca tambien en /test/api: esos espejos estan vivos en produccion, usan
// el MISMO secreto (../../api/credentials.php) y la misma base. Un token
// revocado que muere en /api pero vive en /test/api no esta revocado.
$verificadores = [];
foreach (array_merge(glob(__DIR__ . '/../api/*.php'), glob(__DIR__ . '/api/*.php')) as $php) {
    $src = file_get_contents($php);
    if (preg_match('/explode\(\s*[\'"]\.[\'"]\s*,\s*\$token\s*\)/', $src)) {
        $verificadores[str_replace(dirname(__DIR__) . '/', '', realpath($php))] = $src;
    }
}
// Nueve exactos: si alguien agrega un verificador nuevo, esta prueba lo frena
// hasta que alguien decida a conciencia si lleva el corte.
prueba('se encontraron los nueve verificadores (cinco + cuatro espejos)', count($verificadores) === 9);
foreach ($verificadores as $nombre => $src) {
    $esEspejo = strpos($nombre, 'test/api/') === 0;
    prueba("$nombre consulta las sesiones cerradas",
        strpos($src, $corte) !== false);
    // Los espejos leen la lista de PRODUCCION: si apuntaran a su propia
    // carpeta no encontrarian sesiones.php y dejarian pasar todo en silencio.
    $ruta = $esEspejo ? "'/../../api/sesiones.php'" : "'/sesiones.php'";
    prueba("$nombre carga sesiones.php con red y de la ruta correcta",
        strpos($src, "if (file_exists(__DIR__ . $ruta)) require_once") !== false);
}

// deploy.php hace rsync --delete: sin excluir logs/, cada deploy borraba la
// lista y los tokens robados volvian a servir. (Y lo aprendido de WhatsApp.)
$deploy = file_get_contents(__DIR__ . '/../api/deploy.php');
prueba('el deploy por rsync no borra la lista de sesiones cerradas',
    strpos($deploy, "'api/logs',") !== false);

// ------------------------------------- precision: el mismo segundo
// iat va en segundos. Un token nacido ANTES del cambio pero en ese mismo
// segundo pasaba como bueno. Ahora los tokens traen iat_ms.
@unlink($archivo); sesionesLista(true);
$antesMs = (int) floor(microtime(true) * 1000);
usleep(3000);
sesionesCerrarAnteriores('preciso@ejemplo.cl');
usleep(3000);
$despuesMs = (int) floor(microtime(true) * 1000);
$seg = (int) floor($antesMs / 1000);
prueba('un token del mismo segundo pero ANTERIOR al cambio ya no vale',
    sesionSigueValiendo(['email' => 'preciso@ejemplo.cl', 'iat' => $seg, 'iat_ms' => $antesMs]) === false);
prueba('uno del mismo segundo pero POSTERIOR si vale',
    sesionSigueValiendo(['email' => 'preciso@ejemplo.cl', 'iat' => $seg, 'iat_ms' => $despuesMs]) === true);

$corteMs = sesionesCerrarAnteriores('mismo-ms@ejemplo.cl');
prueba('cerrar sesiones devuelve el momento del corte', is_int($corteMs) && $corteMs > 0);
prueba('un token con iat_ms igual al corte no vale',
    sesionSigueValiendo(['email' => 'mismo-ms@ejemplo.cl', 'iat' => intdiv($corteMs, 1000), 'iat_ms' => $corteMs]) === false);
prueba('uno con iat_ms = corte + 1 si vale',
    sesionSigueValiendo(['email' => 'mismo-ms@ejemplo.cl', 'iat' => intdiv($corteMs, 1000), 'iat_ms' => $corteMs + 1]) === true);

$local = file_get_contents(__DIR__ . '/../api/auth_local.php');
$adminApi = file_get_contents(__DIR__ . '/../api/admin_api.php');
$estampa = "\$payload['iat_ms'] = max((int) floor(microtime(true) * 1000), (int) (\$payload['iat_ms'] ?? 0));";
prueba('generateJWT estampa iat_ms, nunca antes del pedido', strpos($local, $estampa) !== false);
prueba('createJWT estampa iat_ms, nunca antes del pedido',   strpos($adminApi, $estampa) !== false);
prueba('el token renovado nace un milisegundo despues del corte',
    strpos(file_get_contents(__DIR__ . '/../api/admin_profile.php'), "'iat_ms'      => is_int(\$sesionesCerradas) ? \$sesionesCerradas + 1 : null,") !== false);

// --------------------------------------------- escritura atomica
// Truncar y reescribir dejaba un instante con la lista vacia, y ahi un token
// revocado pasaba. Ahora se escribe a un temporal y se renombra encima.
$ses = file_get_contents(__DIR__ . '/../api/sesiones.php');
prueba('la lista se reemplaza de un golpe, no se trunca',
    strpos($ses, '@rename($tmp, $archivo)') !== false && strpos($ses, 'ftruncate') === false);

prueba('si no se puede escribir, se avisa en vez de fingir exito',
    strpos($ses, 'function sesionesCerrarAnteriores') !== false
    && preg_match('/if \(!\$escrito\) \{[^}]*return false;/s', $ses) === 1);

// --------------------- se cierra en los cuatro sitios donde cambia la clave
$donde = [
    'api/user_reset_password.php' => 'la recuperacion del cliente',
    'api/users_api.php'           => 'el panel de administracion',
    'api/admin_profile.php'       => 'el cambio de tu propia clave',
    'api/admin_reset_password.php'=> 'la recuperacion del administrador principal',
];
foreach ($donde as $archivoPhp => $queEs) {
    prueba("se cierran las sesiones en $queEs",
        strpos(file_get_contents(__DIR__ . '/../' . $archivoPhp), 'sesionesCerrarAnteriores(') !== false);
}

// Si en la misma edicion se cambia el correo, los tokens vivos llevan el
// VIEJO: la marca tiene que ir a ese.
$usersApi = file_get_contents(__DIR__ . '/../api/users_api.php');
prueba('al cambiar clave y correo a la vez se marca el correo anterior',
    strpos($usersApi, 'sesionesCerrarAnteriores($targetEmail)') !== false);

$resetPrincipal = file_get_contents(__DIR__ . '/../api/admin_reset_password.php');
prueba('el reseteo del principal marca la cuenta del administrador',
    strpos($resetPrincipal, 'sesionesCerrarAnteriores(IMPORLAN_ADMIN_EMAIL)') !== false);

// Quien cambia su propia clave no se expulsa a si mismo.
$perfil = file_get_contents(__DIR__ . '/../api/admin_profile.php');
prueba('cambiar tu propia clave te devuelve un token nuevo',
    strpos($perfil, "'access_token' => \$tokenNuevo") !== false);
$apiAdmin = file_get_contents(__DIR__ . '/../admin-react/src/admin/api.js');
prueba('el token renovado conserva los permisos del agente',
    strpos($perfil, "'permissions' => \$user['permissions'] ?? null,") !== false);
prueba('y el panel lo guarda',
    strpos($apiAdmin, 'if (res?.access_token) localStorage.setItem(STORAGE_KEYS.token, res.access_token);') !== false);

// ------------------------- ninguna credencial viaja a un segundo buzon
$mailer = file_get_contents(__DIR__ . '/../api/email_service.php');
prueba('la contrasena temporal va solo al titular',
    (bool) preg_match("/'password_reset', \['user_email' => \\\$userEmail\], true\)/", $mailer));
prueba('el enlace del administrador va solo al titular',
    strpos(file_get_contents(__DIR__ . '/../api/admin_forgot_password.php'), 'sendPrivateEmail(') !== false);
prueba('el enlace del cliente va solo al titular',
    strpos(file_get_contents(__DIR__ . '/../api/user_forgot_password.php'), 'sendPrivateEmail(') !== false);

// --------------------------------------------------------------- limpieza
if ($habia === null) { @unlink($archivo); } else { @file_put_contents($archivo, $habia); }
// El candado es un archivo aparte: si no se borra, cada corrida deja uno.
@unlink($archivo . '.lock');
if (!$habiaCarpeta) @rmdir(dirname($archivo));

echo str_repeat('-', 54) . "\n";
if ($fallos) {
    echo count($fallos) . " prueba(s) fallaron:\n";
    foreach ($fallos as $f) echo "  - $f\n";
    exit(1);
}
echo "$ok prueba(s), todo en orden.\n\n";
