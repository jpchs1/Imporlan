<?php
/**
 * Cambiar la contrasena cierra las sesiones en TODO el sitio — pruebas
 * ===================================================================
 *
 * session_revocation.php (PR #669) pone una marca por cuenta: "nada emitido
 * antes de este momento sirve". Esta prueba no mira como funciona la marca
 * —eso lo cubre recuperacion-clientes-tests.php— sino que llegue a todas
 * partes. Cuando entro, la marca:
 *
 *   - la miraban 2 de los 9 verificadores de token del sitio. El dashboard
 *     del administrador, el chat, el marketplace y los cuatro espejos de
 *     /test/api seguian aceptando una sesion revocada una semana entera;
 *   - se ponia en 1 de los 4 sitios donde cambia una contrasena;
 *   - y el deploy por rsync la borraba.
 *
 * Y una regla mas, porque ya paso: un solo mecanismo. Dos sesiones de trabajo
 * escribieron cada una el suyo el mismo dia, y con dos listas distintas una
 * sesion podia estar revocada en una y viva en la otra.
 *
 * Se corre solo:  php test/sesiones-tests.php
 */

$raiz = dirname(__DIR__);
$ok = 0;
$fallos = [];

function prueba($titulo, $condicion) {
    global $ok, $fallos;
    if ($condicion) { $ok++; echo "  ok    $titulo\n"; }
    else { $fallos[] = $titulo; echo "  FALLA $titulo\n"; }
}
function leer($ruta) { global $raiz; return (string) @file_get_contents($raiz . '/' . $ruta); }

echo "\nCambiar la contrasena cierra las sesiones en todo el sitio\n";
echo str_repeat('-', 62) . "\n";

// ------------------------------------------------------- un solo mecanismo
prueba('no existe un segundo mecanismo de revocacion (api/sesiones.php)',
    !file_exists($raiz . '/api/sesiones.php'));
$restos = [];
foreach (array_merge(glob($raiz . '/api/*.php'), glob($raiz . '/test/api/*.php')) as $php) {
    if (preg_match('/sesionSigueValiendo|sesionesCerrarAnteriores/', file_get_contents($php))) $restos[] = basename($php);
}
prueba('ningun archivo usa las funciones del mecanismo retirado', !$restos);

// ------------------------------------------- los nueve verificadores
// Se buscan por el PATRON —partir el token en tres—, no por el nombre de la
// funcion, que es como se escaparon la primera vez. Y en /test/api tambien:
// esos espejos estan vivos en produccion, cargan ../../api/credentials.php
// (el mismo secreto) y deploy-test.sh les copia la base de produccion.
$verificadores = [];
foreach (array_merge(glob($raiz . '/api/*.php'), glob($raiz . '/test/api/*.php')) as $php) {
    $src = file_get_contents($php);
    if (preg_match('/explode\(\s*[\'"]\.[\'"]\s*,\s*\$token\s*\)/', $src)) {
        $verificadores[str_replace($raiz . '/', '', $php)] = $src;
    }
}
// Nueve exactos: un verificador nuevo frena CI hasta que alguien decida a
// conciencia si lleva el corte.
prueba('hay exactamente nueve verificadores (cinco + cuatro espejos)', count($verificadores) === 9);

$corte = "if (function_exists('impTokenRevocado') && impTokenRevocado(\$payload)) return null;";
foreach ($verificadores as $nombre => $src) {
    $esEspejo = strpos($nombre, 'test/api/') === 0;
    prueba("$nombre consulta la revocacion", strpos($src, $corte) !== false);
    // Los espejos tienen que leer las marcas de PRODUCCION. Si apuntaran a su
    // propia carpeta no encontrarian el archivo, el function_exists daria
    // false, y dejarian pasar todo sin decir nada.
    $ruta = $esEspejo ? "'/../../api/session_revocation.php'" : "'/session_revocation.php'";
    prueba("$nombre carga session_revocation.php con red y de la ruta correcta",
        strpos($src, "if (file_exists(__DIR__ . $ruta)) require_once") !== false);
}

// -------------------------------- sin red, una caida tumba todo el sitio
// auth_helper.php y auth_local.php lo cargan al PRINCIPIO. Un require a secas
// de un archivo que falta es un error fatal al cargarlos: en cada peticion
// autenticada del sitio. El antivirus del hosting ya se llevo un archivo.
foreach (['api/auth_helper.php', 'api/auth_local.php'] as $f) {
    prueba("$f no cae si falta session_revocation.php",
        !preg_match("/^require_once __DIR__ \\. '\\/session_revocation\\.php';/m", leer($f)));
}

// --------------------------------- los cuatro sitios donde cambia la clave
$sitios = [
    'api/user_reset_password.php'  => ["impInvalidarSesionesDe(\$cuenta['id'])", 'la recuperacion del cliente'],
    'api/users_api.php'            => ['impInvalidarSesionesDe($id)',            'el admin editando la clave de alguien'],
    'api/admin_profile.php'        => ["impInvalidarSesionesDe(\$row['id'])",    'el cambio de tu propia clave'],
    'api/admin_reset_password.php' => ['impInvalidarSesionesDe(1)',              'la recuperacion del administrador principal'],
];
foreach ($sitios as $f => [$llamada, $queEs]) {
    prueba("se cierran las sesiones en $queEs", strpos(leer($f), $llamada) !== false);
}
prueba('y en el reseteo con clave temporal del panel',
    strpos(leer('api/users_api.php'), "impInvalidarSesionesDe(\$user['id'])") !== false);

// El administrador principal no vive en la base: su sub es 1, fijo, en los
// dos logins. Si eso cambiara, el reseteo marcaria otra cuenta.
prueba('el administrador principal sigue teniendo sub = 1 en auth_local',
    (bool) preg_match("/IMPORLAN_ADMIN_EMAIL => \[[^\]]*'id' => 1\]/", leer('api/auth_local.php')));

// ---------------------------------------- el deploy no borra las marcas
$deploy = leer('api/deploy.php');
prueba('el deploy por rsync no borra las marcas de sesiones', strpos($deploy, "'.imporlan_sesiones',") !== false);
prueba('ni lo aprendido por el contestador de WhatsApp', strpos($deploy, "'api/logs',") !== false);

// ---------------------- quien cambia su propia clave no se expulsa a si mismo
$perfil = leer('api/admin_profile.php');
prueba('cambiar tu propia clave te devuelve un token nuevo', strpos($perfil, "'access_token' => \$tokenNuevo") !== false);
prueba('el token nuevo conserva los permisos del agente', strpos($perfil, "'permissions' => \$user['permissions'] ?? null,") !== false);
prueba('y el panel lo guarda',
    strpos(leer('admin-react/src/admin/api.js'), 'if (res?.access_token) localStorage.setItem(STORAGE_KEYS.token, res.access_token);') !== false);

// ----------------------------- ninguna credencial viaja a un segundo buzon
prueba('la contrasena temporal va solo al titular',
    (bool) preg_match("/'password_reset', \['user_email' => \\\$userEmail\], true\)/", leer('api/email_service.php')));
prueba('el enlace del administrador va solo al titular', strpos(leer('api/admin_forgot_password.php'), 'sendPrivateEmail(') !== false);

// -------------------------------------------------- de punta a punta
// Con el mecanismo real, sobre una carpeta de prueba (el gancho que el propio
// session_revocation.php deja para los tests).
$tmp = sys_get_temp_dir() . '/imporlan_sesiones_test_' . getmypid();
define('IMP_DIR_SESIONES', $tmp);
require_once $raiz . '/api/session_revocation.php';

$antes = time() - 30;
prueba('un token emitido antes de nada sigue valiendo',
    impTokenRevocado(['sub' => '77', 'iat' => $antes]) === false);
impInvalidarSesionesDe(77);
prueba('tras cambiar la clave, el token anterior ya no vale',
    impTokenRevocado(['sub' => '77', 'iat' => $antes]) === true);
prueba('el token nuevo, emitido en el mismo segundo, si vale',
    impTokenRevocado(['sub' => '77', 'iat' => time()]) === false);
prueba('a otra cuenta no le pasa nada',
    impTokenRevocado(['sub' => '78', 'iat' => $antes]) === false);

foreach (glob($tmp . '/{,.}*', GLOB_BRACE) ?: [] as $f) if (is_file($f)) @unlink($f);
@rmdir($tmp);

echo str_repeat('-', 62) . "\n";
if ($fallos) {
    echo count($fallos) . " prueba(s) fallaron:\n";
    foreach ($fallos as $f) echo "  - $f\n";
    exit(1);
}
echo "$ok prueba(s), todo en orden.\n\n";
