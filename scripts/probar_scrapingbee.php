<?php
/**
 * Que permite esta cuenta de ScrapingBee, y cuanto cuesta — Imporlan
 * ==================================================================
 *
 * Dos preguntas distintas que se responden juntas porque comparten el mismo
 * experimento.
 *
 * La primera es si la cuenta permite lo que el scraper necesita. BoatTrader,
 * boats.com y YachtWorld estan detras de Cloudflare y solo pasan con
 * premium_proxy, que en varios planes viene capado; si no esta disponible, la
 * cuenta no sirve para esos sitios por mucho credito que tenga.
 *
 * La segunda es cuanto cuesta cada anuncio. El scraper pide las paginas con
 * premium_proxy y render_js juntos, la combinacion mas cara del tarifario. El
 * precio y la foto de BoatTrader viven en el JSON incrustado del anuncio, que
 * llega en el HTML sin ejecutar nada, asi que render_js podria sobrar.
 *
 * Se prueba por etapas y contra un sitio trivial primero. Cuando todo se prueba
 * de una vez, un fallo no dice si la culpa es de la cuenta, del plan, de los
 * parametros o del anuncio: la primera version de este script devolvio HTTP 500
 * en las dos variantes y no permitia distinguir nada.
 *
 * USO
 *   php /home/wwimpo/imporlan-staging/scripts/probar_scrapingbee.php [URL]
 *
 * Gasta creditos reales. Las peticiones que fallan no se cobran.
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

$urlAnuncio = $argv[1] ?? 'https://www.boattrader.com/boat/2019-cobalt-r5-surf-8625998/';
$urlTrivial = 'https://example.com';

function sbSaldo($llave) {
    $ch = curl_init('https://app.scrapingbee.com/api/v1/usage?api_key=' . urlencode($llave));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
    $r = json_decode((string) curl_exec($ch), true);
    curl_close($ch);
    return is_array($r) ? ($r['used_api_credit'] ?? null) : null;
}

function sbPedir($llave, $url, $premium, $conJs) {
    $params = [
        'api_key' => $llave,
        'url' => $url,
        'render_js' => $conJs ? 'true' : 'false',
    ];
    if ($premium) $params['premium_proxy'] = 'true';
    // block_ads, block_resources y wait solo existen con navegador detras.
    // Mandarlos con render_js apagado hace que la API rechace la peticion
    // entera, y el 500 se lee como si hubiera fallado el sitio.
    if ($conJs) {
        $params['block_ads'] = 'true';
        $params['wait'] = '3000';
    }

    $ch = curl_init('https://app.scrapingbee.com/api/v1/?' . http_build_query($params));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 70, CURLOPT_ENCODING => '']);
    $html = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, (string) $html];
}

/** Reusa el extractor de produccion: interesa la ficha, no que la pagina llegue. */
function sbFicha($html, $url) {
    static $cargado = false;
    if (!$cargado) {
        $lib = '/home/wwimpo/lib/imporlan/link_scraper.php';
        if (!is_readable($lib)) $lib = __DIR__ . '/../lib/link_scraper.php';
        if (!defined('IMPORLAN_API_DIR')) {
            $api = '/home/wwimpo/imporlan.cl/api';
            define('IMPORLAN_API_DIR', is_dir($api) ? $api : __DIR__ . '/../api');
        }
        require_once $lib;
        $cargado = true;
    }
    $r = ['title'=>null,'image_url'=>null,'location'=>null,'hours'=>null,'engine'=>null,
          'make'=>null,'model'=>null,'year'=>null,'value_usa_usd'=>null,'description'=>null];
    parseHtml($html, $url, parse_url($url), $r);
    extractFromStructuredData($html, $r);
    return $r;
}

$saldo = sbSaldo($llave);
if ($saldo === null) exit("\n  No pude consultar el saldo. Revisa la llave.\n\n");

echo "\n  Que permite esta cuenta de ScrapingBee\n";
echo "  " . str_repeat('=', 64) . "\n";
echo "  Creditos usados al empezar: $saldo\n\n";

$etapas = [
    ['Basico            ', $urlTrivial, false, false, 'la cuenta responde'],
    ['Premium proxy     ', $urlTrivial, true,  false, 'el plan permite IPs residenciales'],
    ['Navegador (JS)    ', $urlTrivial, false, true,  'el plan permite render_js'],
    ['Anuncio + premium ', $urlAnuncio, true,  false, 'la variante barata sirve para el anuncio'],
    ['Anuncio + todo    ', $urlAnuncio, true,  true,  'la variante cara sirve para el anuncio'],
];

$res = [];
foreach ($etapas as $i => [$nombre, $url, $premium, $conJs, $queMide]) {
    [$code, $html] = sbPedir($llave, $url, $premium, $conJs);
    $nuevo = sbSaldo($llave);
    $costo = ($nuevo !== null) ? $nuevo - $saldo : null;
    $saldo = $nuevo ?? $saldo;

    $ok = ($code === 200 && strlen($html) > 200);
    printf("  [%d] %s  %s   %s\n", $i + 1, $nombre,
        $ok ? 'OK   ' : 'FALLA', $costo === null ? '' : $costo . ' credito(s)');
    printf("      %s\n", $queMide);

    if (!$ok) {
        printf("      HTTP %d: %s\n", $code, trim(preg_replace('/\s+/', ' ', strip_tags($html))));
    } elseif ($url === $urlAnuncio) {
        $f = sbFicha($html, $url);
        printf("      titulo: %s\n", $f['title'] ?: '—');
        printf("      precio: %s   foto: %s\n",
            !empty($f['value_usa_usd']) ? 'USD ' . number_format($f['value_usa_usd']) : '—',
            !empty($f['image_url']) ? 'si' : '—');
        $ok = !empty($f['value_usa_usd']) && !empty($f['image_url']);
    }
    echo "\n";
    $res[$i] = ['ok' => $ok, 'costo' => $costo];
}

echo "  " . str_repeat('=', 64) . "\n";

if (!$res[0]['ok']) {
    echo "  La cuenta no responde ni a una peticion trivial. El problema es la\n";
    echo "  llave o la cuenta, no la configuracion del scraper.\n\n";
    exit(1);
}
if (!$res[1]['ok']) {
    echo "  Este plan NO permite premium_proxy, que es lo unico que pasa el\n";
    echo "  Cloudflare de BoatTrader, boats.com y YachtWorld. Con creditos de\n";
    echo "  sobra la cuenta igual no sirve para esos sitios: hay que subir a un\n";
    echo "  plan que lo incluya, o dejar esas fuentes fuera y trabajar con\n";
    echo "  Facebook Marketplace y Rightboat, que no lo necesitan.\n\n";
    exit(1);
}

$barato = $res[3];
$caro = $res[4];

if ($barato['ok']) {
    echo "  RECOMENDACION: apagar render_js para BoatTrader.\n";
    if ($barato['costo'] && $caro['costo']) {
        $veces = round($caro['costo'] / max(1, $barato['costo']), 1);
        echo "  Trae foto y precio igual, y cuesta {$barato['costo']} contra {$caro['costo']} creditos:\n";
        echo "  el mismo plan rinde {$veces} veces mas anuncios.\n";
    }
} elseif ($caro['ok']) {
    echo "  RECOMENDACION: dejar render_js encendido, que es como esta hoy.\n";
    echo "  Sin el la pagina no entrega foto ni precio, asi que no hay ahorro.\n";
} else {
    echo "  El plan permite todo, pero de ese anuncio no sale ficha por ninguna\n";
    echo "  de las dos vias. Lo mas probable es que ya no exista: pruebalo con\n";
    echo "  otro pasando la URL como argumento.\n";
}
echo "\n";
