<?php
/**
 * Buscar anuncios vivos en BoatTrader — Imporlan
 * ==============================================
 *
 * BoatTrader esta detras de Cloudflare y no cede ni desde la IP del hosting ni
 * desde Jina ni con premium_proxy. Si cede con stealth_proxy de ScrapingBee, y
 * eso abre la puerta que dabamos por cerrada.
 *
 * Este script pide una pagina de resultados y devuelve los anuncios que hay
 * ahi. Es la unica forma de conseguir links vivos: buscarlos por Google
 * devuelve anuncios retirados hace meses, y un anuncio retirado da 404 o, peor,
 * redirige a la categoria y contamina la ficha con datos que no son suyos.
 *
 * Una busqueda cuesta lo mismo que un anuncio, pero rinde varias decenas de
 * links, asi que conviene partir por aca antes de probar uno por uno.
 *
 * USO
 *   php buscar_boattrader.php                          bowriders, cualquier estado
 *   php buscar_boattrader.php "make-cobalt/state-fl"   filtrando por marca y estado
 *   php buscar_boattrader.php "URL COMPLETA"           una busqueda armada a mano
 *
 * Los filtros son los mismos que arma el sitio al navegar: mira la URL en el
 * navegador despues de filtrar y copia lo que va despues de /boats/.
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

$filtro = $argv[1] ?? 'type-power/class-power-bowrider';
$url = preg_match('#^https?://#i', $filtro)
    ? $filtro
    : 'https://www.boattrader.com/boats/' . trim($filtro, '/') . '/';

function btSaldo($llave) {
    $ch = curl_init('https://app.scrapingbee.com/api/v1/usage?api_key=' . urlencode($llave));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
    $r = json_decode((string) curl_exec($ch), true);
    curl_close($ch);
    return is_array($r) ? ($r['used_api_credit'] ?? null) : null;
}

echo "\n  Anuncios vivos en BoatTrader\n";
echo "  " . str_repeat('=', 66) . "\n";
echo "  Busqueda: $url\n";

$antes = btSaldo($llave);
echo "  Creditos usados al empezar: " . ($antes ?? '?') . "\n\n";
echo "  Pidiendo la pagina con stealth_proxy (puede tardar un par de minutos)...\n";

$params = [
    'api_key' => $llave,
    'url' => $url,
    'render_js' => 'true',
    'stealth_proxy' => 'true',
    'block_ads' => 'true',
    'wait' => '5000',
];
$ch = curl_init('https://app.scrapingbee.com/api/v1/?' . http_build_query($params));
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 200, CURLOPT_ENCODING => '']);
$html = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

$despues = btSaldo($llave);
$costo = ($antes !== null && $despues !== null) ? $despues - $antes : null;
echo "  Costo de la busqueda: " . ($costo === null ? '?' : $costo . ' creditos') . "\n\n";

if ($code !== 200) {
    echo "  La busqueda fallo (HTTP $code)" . ($err ? ": $err" : '') . "\n";
    echo "  " . substr(trim(preg_replace('/\s+/', ' ', strip_tags((string) $html))), 0, 300) . "\n\n";
    exit(1);
}

// Los anuncios se referencian con /boat/<slug-con-id>/. El id final es lo que
// permite descartar duplicados: la misma lancha aparece varias veces en la
// pagina, en el listado y en los bloques de destacados.
preg_match_all('#/boat/([a-z0-9\-]+-(\d{6,}))/#i', $html, $m, PREG_SET_ORDER);
$vistos = [];
foreach ($m as $x) {
    $vistos[$x[2]] = 'https://www.boattrader.com/boat/' . $x[1] . '/';
}

if (!$vistos) {
    echo "  La pagina llego pero no trae anuncios. Puede ser que el filtro no\n";
    echo "  devuelva resultados, o que hayamos caido en una pagina intermedia.\n";
    echo "  Revisa el filtro navegando el sitio y copiando la URL.\n\n";
    exit(1);
}

echo "  " . count($vistos) . " anuncio(s) encontrados:\n\n";
foreach ($vistos as $id => $u) {
    echo "  $u\n";
}

echo "\n  " . str_repeat('=', 66) . "\n";
echo "  Estos links estan vivos ahora. Para ver que ficha sale de uno:\n";
echo "    php " . __DIR__ . "/probar_scrapingbee.php \"<URL>\"\n\n";
echo "  Ojo: cada anuncio que se scrapee con stealth cuesta lo mismo que esta\n";
echo "  busqueda, asi que conviene elegir antes de pedirlos todos.\n\n";
