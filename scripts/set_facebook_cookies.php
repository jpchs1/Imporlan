<?php
/**
 * Renovar la sesion de Facebook del scraper — Imporlan
 * ====================================================
 *
 * Marketplace no nos bloquea: entrega la pagina completa. Lo que no entrega,
 * sin una sesion valida, es el precio, la ubicacion ni las fotos — asi que el
 * anuncio termina en el expediente con el titulo generico "Facebook" y nada
 * mas. Las sesiones de Facebook caducan en semanas, de modo que esto hay que
 * rehacerlo cada tanto; de ahi que exista el script en vez de instrucciones.
 *
 * Pide las cookies por teclado y no por argumento a proposito: un argumento
 * queda escrito en el historial del shell, y xs es la sesion completa de esa
 * cuenta de Facebook. Por lo mismo conviene usar una cuenta desechable y no
 * la personal.
 *
 * DE DONDE SE SACAN
 *   1. Entrar a facebook.com en el navegador con la cuenta que se va a usar.
 *   2. F12 → Application (o Almacenamiento) → Cookies → https://www.facebook.com
 *   3. Copiar el valor de c_user (son puros numeros) y el de xs.
 *      datr es opcional y ayuda a que la sesion dure mas.
 *
 * USO
 *   php /home/wwimpo/imporlan-staging/scripts/set_facebook_cookies.php
 *
 * Respalda el archivo antes de tocarlo y comprueba la sesion contra un anuncio
 * real al terminar, para no dejar la duda de si quedo bien.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("Solo por linea de comandos.\n");
}

$configPath = '/home/wwimpo/imporlan.cl/api/scraper_config.php';
if (!file_exists($configPath)) {
    $configPath = __DIR__ . '/../api/scraper_config.php';
}

$lib = '/home/wwimpo/lib/imporlan/link_scraper.php';
if (!is_readable($lib)) $lib = __DIR__ . '/../lib/link_scraper.php';

/** Lee una linea sin mostrarla, para que la sesion no quede en pantalla. */
function leerOculto($prompt) {
    echo $prompt;
    if (!function_exists('shell_exec') || stripos(PHP_OS, 'WIN') === 0) {
        return trim((string) fgets(STDIN));
    }
    @shell_exec('stty -echo 2>/dev/null');
    $valor = trim((string) fgets(STDIN));
    @shell_exec('stty echo 2>/dev/null');
    echo "\n";
    return $valor;
}

function leerVisible($prompt) {
    echo $prompt;
    return trim((string) fgets(STDIN));
}

echo "\n  Renovar la sesion de Facebook del scraper\n";
echo "  " . str_repeat('=', 58) . "\n";
echo "  Archivo: $configPath\n\n";

$config = file_exists($configPath) ? require $configPath : [];
if (!is_array($config)) {
    exit("  El archivo existe pero no devuelve un array. Revisalo a mano.\n\n");
}

$previas = $config['facebook_cookies'] ?? [];
if (!empty($previas['c_user'])) {
    echo "  Sesion actual: c_user " . $previas['c_user'] . " (se va a reemplazar)\n\n";
}

$cUser = leerVisible('  c_user (solo numeros): ');
if (!preg_match('/^\d{5,}$/', $cUser)) {
    exit("\n  c_user deberia ser solo numeros. No se cambio nada.\n\n");
}

$xs = leerOculto('  xs (no se muestra al escribir): ');
if (strlen($xs) < 10) {
    exit("\n  El valor de xs parece incompleto. No se cambio nada.\n\n");
}

$datr = leerVisible('  datr (opcional, Enter para omitir): ');

// Respaldo antes de escribir: el archivo tiene la llave de ScrapingBee y otras
// cosas que no queremos perder por un error de este script.
if (file_exists($configPath)) {
    $backup = $configPath . '.bak-' . date('Ymd-His');
    if (!@copy($configPath, $backup)) {
        exit("\n  No pude respaldar el archivo. No se cambio nada.\n\n");
    }
    // El archivo se reescribe entero desde el array, asi que los comentarios
    // que tuviera se pierden. El respaldo es el que los conserva.
    echo "\n  Respaldo (conserva el formato y los comentarios originales):\n    $backup\n";
}

$config['facebook_cookies'] = array_filter([
    'c_user' => $cUser,
    'xs'     => $xs,
    'datr'   => $datr !== '' ? $datr : null,
], fn($v) => $v !== null);

$contenido = "<?php\n"
    . "// Configuracion del scraper. Generado en parte por scripts/set_facebook_cookies.php\n"
    . "// el " . date('d-m-Y H:i') . ". Este archivo NO esta en el repositorio: vive solo\n"
    . "// en el servidor porque contiene credenciales.\n"
    . "return " . var_export($config, true) . ";\n";

if (@file_put_contents($configPath, $contenido, LOCK_EX) === false) {
    exit("\n  No pude escribir $configPath. Revisa permisos.\n\n");
}
@chmod($configPath, 0640);
echo "  Cookies guardadas.\n";

// ── Comprobar de inmediato, que es el punto ──
if (!is_readable($lib)) {
    echo "\n  No encuentro link_scraper.php para comprobar. Corre el diagnostico a mano.\n\n";
    exit(0);
}

if (!defined('IMPORLAN_API_DIR')) {
    define('IMPORLAN_API_DIR', dirname($configPath));
}
require_once $lib;

echo "\n  Comprobando contra un anuncio real...\n";
$prueba = 'https://www.facebook.com/marketplace/item/1801380614070000/';
$html = directFetch($prueba);

if (!$html) {
    echo "  Facebook no respondio. Reintenta en un rato.\n\n";
    exit(1);
}
if (sesionFacebookRechazada($html)) {
    echo "  RECHAZADA — Facebook no reconoce esta sesion.\n";
    echo "  Revisa que c_user y xs sean de la misma cuenta y esten completos,\n";
    echo "  y que la sesion siga abierta en el navegador de donde los sacaste.\n\n";
    exit(1);
}

echo "  ACEPTADA — Facebook reconoce la sesion.\n\n";
echo "  Ahora vuelve a scrapear los links de Facebook desde el admin, o corre:\n";
echo "    php " . __DIR__ . "/diag_scraper.php\n\n";
