<?php
/**
 * Instalar la API key de ScrapingBee — Imporlan
 * =============================================
 *
 * ScrapingBee es el unico camino que queda para BoatTrader, boats.com y
 * YachtWorld: los tres estan detras de Cloudflare y bloquean tanto la IP del
 * hosting como la de Jina. La llave vive en api/scraper_config.php, que ademas
 * guarda las cookies de Facebook, asi que editarlo a mano por SSH para cambiar
 * un valor es justo donde se rompe otra cosa.
 *
 * La llave se pide por teclado y sin mostrarla: un argumento queda escrito en
 * el historial del shell, y con esa llave cualquiera gasta los creditos de la
 * cuenta.
 *
 * USO
 *   php /home/wwimpo/imporlan-staging/scripts/set_scrapingbee_key.php
 *
 * Respalda antes de tocar el archivo y consulta el saldo real al terminar, que
 * es la unica forma de saber si la llave quedo bien.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("Solo por linea de comandos.\n");
}

$configPath = '/home/wwimpo/imporlan.cl/api/scraper_config.php';
if (!file_exists($configPath)) {
    $configPath = __DIR__ . '/../api/scraper_config.php';
}

function leerOcultoSb($prompt) {
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

/** Muestra la llave sin exponerla, para poder cotejarla con el panel. */
function taparLlave($k) {
    if (strlen($k) < 12) return str_repeat('*', strlen($k));
    return substr($k, 0, 6) . str_repeat('*', strlen($k) - 10) . substr($k, -4);
}

echo "\n  Instalar la API key de ScrapingBee\n";
echo "  " . str_repeat('=', 58) . "\n";
echo "  Archivo: $configPath\n\n";

$config = file_exists($configPath) ? require $configPath : [];
if (!is_array($config)) {
    exit("  El archivo existe pero no devuelve un array. Revisalo a mano.\n\n");
}

$anterior = trim($config['scrapingbee_api_key'] ?? '');
if ($anterior) {
    echo "  Llave actual: " . taparLlave($anterior) . " (se va a reemplazar)\n\n";
}

echo "  La encuentras en dashboard.scrapingbee.com, en \"Your API Key\".\n";
echo "  Copiala completa con el boton de copiar, no seleccionando el texto:\n";
echo "  el panel la muestra cortada con puntos suspensivos.\n\n";

$llave = leerOcultoSb('  API key (no se muestra al escribir): ');

if (strlen($llave) < 40) {
    exit("\n  Esa llave parece incompleta: son varias decenas de caracteres.\n"
       . "  Si la seleccionaste con el mouse quedo cortada; usa el boton de\n"
       . "  copiar del panel. No se cambio nada.\n\n");
}
if (!preg_match('/^[A-Z0-9]+$/i', $llave)) {
    exit("\n  La llave trae caracteres raros; puede que hayas copiado espacios\n"
       . "  o los puntos suspensivos. No se cambio nada.\n\n");
}

// ── Comprobar contra ScrapingBee ANTES de escribir ──
// Guardar primero y avisar despues obliga a deshacer a mano si la llave estaba
// mala. Preguntando antes, el archivo solo cambia si la llave sirve.
echo "\n  Comprobando la llave con ScrapingBee...\n";
$ch = curl_init('https://app.scrapingbee.com/api/v1/usage?api_key=' . urlencode($llave));
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25]);
$resp = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$uso = json_decode((string) $resp, true);
if ($code !== 200 || !is_array($uso)) {
    $detalle = str_replace($llave, taparLlave($llave), strip_tags((string) $resp));
    exit("\n  ScrapingBee rechaza la llave (HTTP $code): " . substr($detalle, 0, 160) . "\n"
       . "  No se cambio nada.\n\n");
}

$usados = $uso['used_api_credit'] ?? 0;
$total = $uso['max_api_credit'] ?? 0;
echo "  Llave valida. Creditos: $usados de $total usados";
echo (is_numeric($usados) && is_numeric($total)) ? ' — quedan ' . max(0, $total - $usados) . "\n" : "\n";
if (!empty($uso['renewal_subscription_date'])) {
    echo "  Renovacion: " . substr($uso['renewal_subscription_date'], 0, 10) . "\n";
}

// ── Recien ahora, escribir ──
if (file_exists($configPath)) {
    $backup = $configPath . '.bak-' . date('Ymd-His');
    if (!@copy($configPath, $backup)) {
        exit("\n  No pude respaldar el archivo. No se cambio nada.\n\n");
    }
    // El archivo se reescribe entero desde el array: los comentarios que
    // tuviera quedan solo en el respaldo.
    echo "\n  Respaldo (conserva el formato y los comentarios originales):\n    $backup\n";
}

$config['scrapingbee_api_key'] = $llave;

$contenido = "<?php\n"
    . "// Configuracion del scraper. Generado en parte por scripts/set_scrapingbee_key.php\n"
    . "// el " . date('d-m-Y H:i') . ". Este archivo NO esta en el repositorio: vive solo\n"
    . "// en el servidor porque contiene credenciales.\n"
    . "return " . var_export($config, true) . ";\n";

if (@file_put_contents($configPath, $contenido, LOCK_EX) === false) {
    exit("\n  No pude escribir $configPath. Revisa permisos.\n\n");
}
@chmod($configPath, 0640);

echo "  Llave guardada: " . taparLlave($llave) . "\n\n";
echo "  Siguiente paso, para no gastar creditos a ciegas:\n";
echo "    php " . __DIR__ . "/probar_scrapingbee.php\n\n";
