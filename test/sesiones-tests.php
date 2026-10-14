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
// RECURSIVA. La primera version miraba solo api/*.php y test/api/*.php, y se
// le escapo api/test/proxy.php: /api/test/auth/me valida el token por su
// cuenta y index.php lo enruta en produccion.
$todos = function ($dir) {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) if (substr($f->getFilename(), -4) === '.php') yield $f->getPathname();
};
foreach ([$raiz . '/api', $raiz . '/test/api'] as $dir) {
    foreach ($todos($dir) as $php) {
        $src = file_get_contents($php);
        if (preg_match('/explode\(\s*[\'"]\.[\'"]\s*,\s*\$token\s*\)/', $src)) {
            $verificadores[str_replace($raiz . '/', '', $php)] = $src;
        }
    }
}
// Diez exactos: un verificador nuevo frena CI hasta que alguien decida a
// conciencia si lleva el corte.
prueba('hay exactamente diez verificadores (contando el proxy de /api/test)', count($verificadores) === 10);

$corte = "if (function_exists('impTokenRevocado') && impTokenRevocado(\$payload)) return null;";
foreach ($verificadores as $nombre => $src) {
    if ($nombre === 'api/test/proxy.php') {
        prueba("$nombre consulta la revocacion",
            strpos($src, "if (function_exists('impTokenRevocado') && impTokenRevocado(\$payload)) {") !== false);
        prueba("$nombre carga session_revocation.php con red y de la ruta correcta",
            strpos($src, "if (file_exists(__DIR__ . '/../session_revocation.php')) require_once") !== false);
        continue;
    }
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

// --------------------- TODO el que escribe una contrasena cierra sesiones
// La lista de arriba nombra los sitios conocidos. Esta los busca por PATRON:
// una escritura en la base (password_hash = ?) o una reescritura de la clave
// del administrador en credentials_config.php. Asi se encontro el espejo
// test/api/admin_reset_password.php, que cambiaba la clave de PRODUCCION sin
// cerrar ninguna sesion.
$escritores = [];
foreach (array_merge(iterator_to_array($todos($raiz . '/api'), false), iterator_to_array($todos($raiz . '/test/api'), false)) as $php) {
    // Recursiva, por lo mismo que la de verificadores.
    $src = file_get_contents($php);
    if (preg_match('/password_hash = \?/', $src) || strpos($src, "define('IMPORLAN_ADMIN_PASSWORD', '\" .") !== false) {
        $escritores[str_replace($raiz . '/', '', $php)] = $src;
    }
}
prueba('se encontraron los cinco escritores de contrasena', count($escritores) === 5);
foreach ($escritores as $nombre => $src) {
    prueba("$nombre cierra las sesiones al cambiar la clave", strpos($src, 'impInvalidarSesionesDe(') !== false);
}

// Y el resultado del corte EMPIEZA EN FALSE: solo pasa a true si el modulo
// existe Y escribio la marca. Con la forma vieja —if (file_exists) { if
// (!corte) avisar }— un modulo ausente se saltaba el aviso entero y el cambio
// de clave salia como exito limpio con todas las sesiones viejas vivas.
foreach ($escritores as $nombre => $src) {
    prueba("$nombre trata el modulo ausente como un fallo del corte",
        strpos($src, '$sesionesCerradas = false;') !== false
        || strpos($src, "function_exists('impInvalidarSesionesDe') && impInvalidarSesionesDe(") !== false);
}
foreach (['api/admin_reset_password.php', 'test/api/admin_reset_password.php'] as $f) {
    prueba("$f dice la verdad si el corte fallo", strpos(leer($f), 'NO se pudieron cerrar las sesiones') !== false);
}
// Y quien cambio la clave se entera si el corte fallo: es lo unico que le
// permite actuar.
prueba('el cliente se entera si sus otras sesiones siguen abiertas',
    strpos(leer('api/user_reset_password.php'), 'no pudimos cerrar las otras sesiones abiertas') !== false);
prueba('el administrador tambien', substr_count(leer('api/users_api.php'), '$avisoSesiones') >= 4);

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
