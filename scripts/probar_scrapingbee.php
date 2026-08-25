<?php
/**
 * Medir cuanto cuesta cada anuncio en ScrapingBee — Imporlan
 * ==========================================================
 *
 * El scraper pide las paginas de BoatTrader con premium_proxy y render_js
 * juntos. Esa combinacion es la mas cara del tarifario: la prueba gratuita de
 * 1.000 creditos alcanzo para unos trece anuncios y se agoto en dias.
 *
 * La pregunta que este script contesta es si render_js hace falta. El precio y
 * la foto de BoatTrader viven en el JSON incrustado del anuncio, que llega en
 * el HTML sin ejecutar nada; si eso alcanza, cada anuncio cuesta bastante menos
 * y el mismo plan rinde varias veces mas.
 *
 * Prueba las dos variantes contra un anuncio real, mide los creditos que gasto
 * cada una consultando el saldo antes y despues, y recomienda.
 *
 * USO
 *   php /home/wwimpo/imporlan-staging/scripts/probar_scrapingbee.php [URL]
 *
 * Gasta creditos de verdad: dos peticiones, una barata y una cara. Es el precio
 * de no seguir adivinando.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("Solo por linea de comandos.\n");
}

$configPath = '/home/wwimpo/imporlan.cl/api/scraper_config.php';
if (!file_exists($configPath)) $configPath = __DIR__ . '/../api/scraper_config.php';
if (!file_exists($configPath)) exit("No encuentro scraper_config.php.\n");

$config = require $configPath;
$llave = trim($config['scrapingbee_api_key'] ?? '');
if (!$llave) exit("No hay API key de ScrapingBee configurada.\n  Corre antes: set_scrapingbee_key.php\n\n");

$url = $argv[1] ?? 'https://www.boattrader.com/boat/2019-cobalt-r5-surf-8625998/';

function sbSaldo($llave) {
    $ch = curl_init('https://app.scrapingbee.com/api/v1/usage?api_key=' . urlencode($llave));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
    $r = json_decode((string) curl_exec($ch), true);
    curl_close($ch);
    return is_array($r) ? ($r['used_api_credit'] ?? null) : null;
}

function sbPedir($llave, $url, $conJs) {
    $params = [
        'api_key' => $llave,
        'url' => $url,
        'render_js' => $conJs ? 'true' : 'false',
        'premium_proxy' => 'true',
        'block_ads' => 'true',
        'block_resources' => 'false',
    ];
    if ($conJs) $params['wait'] = '3000';

    $ch = curl_init('https://app.scrapingbee.com/api/v1/?' . http_build_query($params));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60, CURLOPT_ENCODING => '']);
    $html = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, (string) $html];
}

/**
 * Que trajo la pagina, medido por lo unico que importa: si de ahi sale una
 * ficha que le sirva al cliente. Se reusa el extractor de verdad para no
 * medir con una regla distinta a la que despues corre en produccion.
 */
function sbEvaluar($html, $url) {
    $lib = '/home/wwimpo/lib/imporlan/link_scraper.php';
    if (!is_readable($lib)) $lib = __DIR__ . '/../lib/link_scraper.php';
    if (!defined('IMPORLAN_API_DIR')) {
        $api = '/home/wwimpo/imporlan.cl/api';
        define('IMPORLAN_API_DIR', is_dir($api) ? $api : __DIR__ . '/../api');
    }
    require_once $lib;

    $result = ['title'=>null,'image_url'=>null,'location'=>null,'hours'=>null,'engine'=>null,
               'make'=>null,'model'=>null,'year'=>null,'value_usa_usd'=>null,'description'=>null];
    parseHtml($html, $url, parse_url($url), $result);
    extractFromStructuredData($html, $result);
    return $result;
}

echo "\n  Cuanto cuesta cada anuncio en ScrapingBee\n";
echo "  " . str_repeat('=', 62) . "\n";
echo "  Anuncio: $url\n\n";

$antes = sbSaldo($llave);
if ($antes === null) exit("  No pude consultar el saldo. Revisa la llave.\n\n");
echo "  Creditos usados al empezar: $antes\n\n";

$resumen = [];
foreach ([['sin render_js', false], ['con render_js', true]] as [$etiqueta, $conJs]) {
    echo "  ── $etiqueta ──\n";
    [$code, $html] = sbPedir($llave, $url, $conJs);
    $despues = sbSaldo($llave);
    $costo = ($despues !== null && $antes !== null) ? $despues - $antes : null;
    $antes = $despues;

    if ($code !== 200) {
        printf("    %-14s HTTP %d — %s\n", 'resultado', $code, substr(strip_tags($html), 0, 120));
        printf("    %-14s %s\n\n", 'costo', $costo === null ? '?' : $costo . ' creditos');
        $resumen[$etiqueta] = ['ok' => false, 'costo' => $costo];
        continue;
    }

    $r = sbEvaluar($html, $url);
    $foto = !empty($r['image_url']);
    $precio = !empty($r['value_usa_usd']);
    printf("    %-14s %s bytes\n", 'pagina', number_format(strlen($html)));
    printf("    %-14s %s\n", 'titulo', $r['title'] ?: '—');
    printf("    %-14s %s\n", 'precio', $precio ? 'USD ' . number_format($r['value_usa_usd']) : '—');
    printf("    %-14s %s\n", 'foto', $foto ? 'si' : '—');
    printf("    %-14s %s\n\n", 'costo', $costo === null ? '?' : $costo . ' creditos');
    $resumen[$etiqueta] = ['ok' => ($foto && $precio), 'costo' => $costo];
}

echo "  " . str_repeat('=', 62) . "\n";
$barato = $resumen['sin render_js'] ?? null;
$caro = $resumen['con render_js'] ?? null;

if ($barato && $barato['ok']) {
    echo "  RECOMENDACION: apagar render_js para BoatTrader.\n";
    if ($barato['costo'] && $caro && $caro['costo']) {
        $veces = round($caro['costo'] / max(1, $barato['costo']), 1);
        echo "  Trae foto y precio igual, y cuesta {$barato['costo']} creditos contra {$caro['costo']}:\n";
        echo "  el mismo plan rinde {$veces} veces mas anuncios.\n";
    }
} elseif ($caro && $caro['ok']) {
    echo "  RECOMENDACION: dejar render_js encendido.\n";
    echo "  Sin el la pagina no entrega foto ni precio, asi que el ahorro no existe.\n";
} else {
    echo "  Ninguna de las dos variantes trajo foto y precio.\n";
    echo "  Si ademas dieron HTTP distinto de 200, el problema es la cuenta o el\n";
    echo "  sitio, no la configuracion. Revisa el detalle de arriba.\n";
}
echo "\n";
