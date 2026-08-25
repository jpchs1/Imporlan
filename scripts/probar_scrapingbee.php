<?php
/**
 * Que permite esta cuenta de ScrapingBee, y cuanto cuesta — Imporlan
 * ==================================================================
 *
 * Dos preguntas distintas que se responden juntas porque comparten el mismo
 * experimento.
 *
 * La primera es si la cuenta permite lo que el scraper necesita. BoatTrader,
 * boats.com y YachtWorld estan detras de Cloudflare, y ahi ni siquiera basta
 * premium_proxy: hay que llegar a stealth_proxy, que en varios planes viene
 * capado. Si no esta disponible, la cuenta no sirve para esos sitios por mucho
 * credito que tenga.
 *
 * La segunda es cuanto cuesta cada anuncio, para poder dimensionar el plan. Ojo
 * con eso: el contador de creditos de ScrapingBee se actualiza con retraso, asi
 * que restar el saldo antes y despues de una peticion suele dar 0 aunque la
 * peticion se haya cobrado. Por eso este script no publica un costo por
 * anuncio salvo que lo haya medido de verdad, y para la cifra exacta manda al
 * panel.
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

function sbPedir($llave, $url, $proxy, $conJs) {
    $params = [
        'api_key' => $llave,
        'url' => $url,
        'render_js' => $conJs ? 'true' : 'false',
    ];
    // premium usa IPs residenciales; stealth es el modo que ScrapingBee reserva
    // para los sitios que ni asi ceden, y BoatTrader resulto ser uno de esos.
    if ($proxy === 'premium') $params['premium_proxy'] = 'true';
    if ($proxy === 'stealth') $params['stealth_proxy'] = 'true';
    // block_ads, block_resources y wait solo existen con navegador detras.
    // Mandarlos con render_js apagado hace que la API rechace la peticion
    // entera, y el 500 se lee como si hubiera fallado el sitio.
    if ($conJs) {
        $params['block_ads'] = 'true';
        $params['wait'] = '3000';
    }

    $ch = curl_init('https://app.scrapingbee.com/api/v1/?' . http_build_query($params));
    // Resolver el desafio de Cloudflare con navegador toma mucho mas que una
    // peticion normal. Con 70 segundos la prueba expiraba y devolvia HTTP 0,
    // que se leia como un fallo del sitio cuando en realidad nunca supimos el
    // resultado — y el credito igual se cobro.
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 180, CURLOPT_ENCODING => '']);
    $html = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $errCurl = curl_error($ch);
    curl_close($ch);
    // HTTP 0 significa que la peticion no llego a completarse; sin el texto de
    // cURL el motivo queda invisible.
    if ($code === 0 && $errCurl) return [0, 'La peticion no se completo: ' . $errCurl];
    return [$code, (string) $html];
}

/**
 * BoatTrader responde HTTP 200 con su propia pagina de error cuando el anuncio
 * ya no existe, y adentro deja el estado real. Distinguirlo importa: llegar a
 * un 404 significa que el proxy funciono y que el unico problema es el link.
 */
function sbAnuncioBorrado($html) {
    return (bool) preg_match('/"statusCode"\s*:\s*404|status code 404/i', $html);
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
    ['Basico              ', $urlTrivial, 'ninguno', false, 'la cuenta responde'],
    ['Premium proxy       ', $urlTrivial, 'premium', false, 'el plan permite IPs residenciales'],
    ['Navegador (JS)      ', $urlTrivial, 'ninguno', true,  'el plan permite render_js'],
    ['Anuncio premium     ', $urlAnuncio, 'premium', false, 'la variante mas barata'],
    ['Anuncio premium+JS  ', $urlAnuncio, 'premium', true,  'residencial con navegador'],
    ['Anuncio stealth+JS  ', $urlAnuncio, 'stealth', true,  'el modo mas caro, para sitios que no ceden'],
];

$saldoInicial = $saldo;
$res = [];
foreach ($etapas as $i => [$nombre, $url, $proxy, $conJs, $queMide]) {
    [$code, $html] = sbPedir($llave, $url, $proxy, $conJs);
    $nuevo = sbSaldo($llave);
    $costo = ($nuevo !== null) ? $nuevo - $saldo : null;
    $saldo = $nuevo ?? $saldo;

    $ok = ($code === 200 && strlen($html) > 200);
    // Un costo en 0 casi nunca significa "gratis": el contador de ScrapingBee
    // va con retraso y todavia no registro esta peticion. Imprimirlo como
    // "0 creditos" hacia que el resumen recomendara dividir el plan por cero.
    printf("  [%d] %s  %s   %s\n", $i + 1, $nombre,
        $ok ? 'OK   ' : 'FALLA', ($costo > 0) ? $costo . ' credito(s)' : '');
    printf("      %s\n", $queMide);

    if (!$ok) {
        printf("      HTTP %d: %s\n", $code, trim(preg_replace('/\s+/', ' ', strip_tags($html))));
    } elseif ($url === $urlAnuncio && sbAnuncioBorrado($html)) {
        // Atravesar Cloudflare y encontrar un 404 es un exito tecnico con
        // resultado vacio. Sin separarlo, la conclusion culpaba a la
        // configuracion cuando el problema era el link.
        printf("      La pagina llego, pero el anuncio ya no existe (404 del sitio).\n");
        $ok = false;
        $res[$i] = ['ok' => false, 'costo' => $costo, 'borrado' => true];
        echo "\n";
        continue;
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
    echo "  AVISO: este plan NO permite premium_proxy, que es lo que necesita\n";
    echo "  Facebook Marketplace cuando hace falta sesion. Sigo igual, porque\n";
    echo "  los sitios de Cloudflare no dependen de premium sino de stealth.\n\n";
}

$barato  = $res[3];   // premium, sin navegador
$medio   = $res[4];   // premium con navegador
$stealth = $res[5];   // stealth con navegador

// El costo por peticion casi nunca se puede medir: el contador de ScrapingBee
// va con retraso y devuelve 0. Antes esto se imprimia igual y salia la
// instruccion absurda de dividir los creditos del plan por cero.
$porAnuncio = function ($e) {
    return ($e['costo'] > 0)
        ? "Costo medido: " . $e['costo'] . " creditos por anuncio.\n"
        : "El contador de ScrapingBee no alcanzo a registrar el cobro, asi que\n"
        . "  el costo por anuncio no se puede medir aqui.\n";
};

if ($barato['ok']) {
    echo "  RECOMENDACION: premium_proxy sin render_js.\n";
    echo "  Trae foto y precio, y es la combinacion mas barata del tarifario.\n";
    echo "  Hay que apagar render_js para este dominio en planBScrapingBee().\n";
    echo "  " . $porAnuncio($barato);
} elseif ($medio['ok']) {
    echo "  RECOMENDACION: premium_proxy con render_js.\n";
    echo "  Sin navegador el sitio devuelve el desafio de Cloudflare, asi que no\n";
    echo "  hay ahorro posible por ese lado.\n";
    echo "  " . $porAnuncio($medio);
} elseif ($stealth['ok']) {
    echo "  RECOMENDACION: stealth_proxy con render_js, que es como quedo el\n";
    echo "  scraper en produccion para BoatTrader, boats.com y YachtWorld.\n";
    echo "  Es lo unico que atraviesa este Cloudflare: premium no pasa ni con\n";
    echo "  navegador ni sin el.\n";
    echo "  " . $porAnuncio($stealth);
    echo "  Es la variante mas cara del tarifario, asi que conviene elegir bien\n";
    echo "  que anuncios se piden en vez de rescrapear expedientes enteros.\n";
} elseif (!empty($barato['borrado']) || !empty($medio['borrado']) || !empty($stealth['borrado'])) {
    echo "  El anuncio de prueba ya no existe: el sitio devolvio su pagina de 404.\n";
    echo "  Eso NO es un fallo del proxy — llegar al 404 significa que pasamos\n";
    echo "  Cloudflare. Repite con un anuncio vivo:\n";
    echo "    php " . __DIR__ . "/buscar_boattrader.php\n";
} else {
    echo "  Ninguna combinacion trajo la ficha, y el plan permite todas.\n";
    echo "  Quedan dos explicaciones: que el anuncio ya no exista —pruebalo\n";
    echo "  pasando otra URL como argumento— o que este Cloudflare no ceda ni\n";
    echo "  con stealth. Si es lo segundo, BoatTrader no es viable a ningun\n";
    echo "  precio y conviene apoyarse en Facebook Marketplace y Rightboat.\n";
}

// El gasto total de la corrida es mas confiable que el de cada peticion: entre
// la primera y la ultima consulta el contador ya tuvo tiempo de moverse.
$saldoFinal = sbSaldo($llave);
if ($saldoInicial !== null && $saldoFinal !== null) {
    echo "\n  Gasto de esta corrida: " . max(0, $saldoFinal - $saldoInicial) . " creditos"
       . " (6 peticiones, contador en $saldoFinal).\n";
}
echo "\n  El contador de ScrapingBee se actualiza con retraso, asi que un costo\n";
echo "  en 0 puede ser eso y no una peticion gratis. La cifra exacta por tipo\n";
echo "  de peticion esta en dashboard.scrapingbee.com, en el detalle de uso.\n";
echo "\n";
