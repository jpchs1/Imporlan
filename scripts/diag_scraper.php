<?php
/**
 * Diagnostico del scraper — Imporlan
 * ==================================
 *
 * Cuando un expediente queda con tarjetas sin foto ni precio, la pregunta es
 * siempre la misma: se cayo el scraper, o el sitio nos esta bloqueando? Este
 * script contesta eso separando las dos estrategias que usa la libreria y
 * mostrando que devolvio cada una.
 *
 *   directFetch  el servidor pide la pagina el mismo, con user-agent de
 *                navegador. Lo que se prueba aca es la IP del hosting.
 *   Jina Reader  r.jina.ai busca la pagina por nosotros. Lo que se prueba es
 *                la IP de Jina, que es distinta y puede estar bloqueada
 *                cuando la del hosting no lo esta, o al reves.
 *
 * Que un sitio conteste "Just a moment..." con HTTP 200 no es un error del
 * scraper: es el desafio de Cloudflare. Por eso el script lo detecta y lo
 * nombra, en vez de reportar exito.
 *
 * USO — se corre desde el clon de staging, que ya esta fuera del docroot y por
 * eso el antivirus del hosting no lo toca:
 *   php /home/wwimpo/imporlan-staging/scripts/diag_scraper.php URL [URL...]
 *
 * Sin URLs usa un anuncio de BoatTrader y uno de Facebook Marketplace.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("Solo por linea de comandos.\n");
}

// La libreria vive fuera del docroot; deploy-prod.sh la instala aca.
$lib = '/home/wwimpo/lib/imporlan/link_scraper.php';
if (!is_readable($lib)) {
    $lib = __DIR__ . '/../lib/link_scraper.php';   // repo, para probar en local
}
if (!is_readable($lib)) {
    exit("No encuentro link_scraper.php. Corriste deploy-prod.sh?\n");
}

if (!defined('IMPORLAN_API_DIR')) {
    $api = '/home/wwimpo/imporlan.cl/api';
    define('IMPORLAN_API_DIR', is_dir($api) ? $api : __DIR__ . '/../api');
}

require_once $lib;

$urls = array_slice($argv, 1);
if (!$urls) {
    $urls = [
        'https://www.boattrader.com/boat/2019-cobalt-r5-surf-8625998/',
        'https://www.facebook.com/marketplace/item/1801380614070000/',
    ];
}

/** Reconoce la pagina de desafio de Cloudflare, que llega con HTTP 200. */
function diagEsDesafio($texto) {
    if (!$texto) return false;
    return (bool) preg_match('/Just a moment|Performing security verification|Attention Required|cf-challenge|Enable JavaScript and cookies/i', $texto);
}

function diagLinea($etiqueta, $valor) {
    printf("    %-17s %s\n", $etiqueta, $valor);
}

echo "\n";
echo "  Diagnostico del scraper — " . date('d-m-Y H:i') . "\n";
echo "  " . str_repeat('=', 74) . "\n";

$cfg = function_exists('loadScraperConfig') ? loadScraperConfig() : [];
$bee = trim($cfg['scrapingbee_api_key'] ?? '');
diagLinea('ScrapingBee', $bee ? 'configurado (Plan B disponible)' : 'sin API key (Plan B nivel 1 no corre)');

// Marketplace no bloquea: entrega la pagina, pero sin sesion no trae ni el
// precio ni la ubicacion ni las fotos. Sin estas cookies, cualquier anuncio de
// Facebook va a salir con el titulo generico "Facebook" y nada mas.
$fb = buildFacebookCookieString($cfg);
diagLinea('Cookies Facebook', $fb ? 'configuradas' : 'NO configuradas (Marketplace no va a entregar datos)');
diagLinea('Libreria', $lib);

// "Configurado" no es lo mismo que "funciona": la llave puede estar puesta y
// la cuenta sin creditos. La libreria se traga ese error y el sintoma final es
// identico al de una pagina vacia, asi que hay que preguntarle a ScrapingBee.
if ($bee) {
    $ch = curl_init('https://app.scrapingbee.com/api/v1/usage?api_key=' . urlencode($bee));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $u = json_decode((string) $resp, true);
    if ($code === 200 && is_array($u)) {
        $usados = $u['used_api_credit'] ?? '?';
        $total  = $u['max_api_credit'] ?? '?';
        $quedan = (is_numeric($usados) && is_numeric($total)) ? ($total - $usados) : null;
        diagLinea('  creditos', $usados . ' de ' . $total . ' usados'
            . ($quedan !== null ? ' — quedan ' . max(0, $quedan) : '')
            . ($quedan !== null && $quedan <= 0 ? '  ← AGOTADA, Plan B no puede funcionar' : ''));
    } else {
        diagLinea('  creditos', 'no se pudo consultar (HTTP ' . $code . ') — ' . substr(strip_tags((string) $resp), 0, 90));
    }
}

foreach ($urls as $url) {
    echo "\n  " . str_repeat('-', 74) . "\n  $url\n\n";

    // ── 1. Directo, desde la IP del hosting ──
    $t = microtime(true);
    $html = directFetch($url);
    $ms = round((microtime(true) - $t) * 1000);
    if (!$html) {
        $estado = 'BLOQUEADO — sin respuesta util (403 o vacio)';
    } elseif (diagEsDesafio($html)) {
        $estado = 'BLOQUEADO — desafio de Cloudflare';
    } else {
        $estado = 'OK — ' . number_format(strlen($html)) . ' bytes';
    }
    echo "  [1] Directo, IP del hosting\n";
    diagLinea('resultado', $estado);
    if (function_exists('cookiesParaUrl') && cookiesParaUrl($url)) {
        // Una sesion vencida devuelve la misma pagina publica que no tener
        // ninguna, con el mismo peso y el mismo HTTP 200. La diferencia esta
        // adentro: Facebook escribe USER_ID en cero cuando no reconoce a nadie.
        diagLinea('sesion', sesionFacebookRechazada($html)
            ? 'RECHAZADA — las cookies estan vencidas; hay que sacar c_user y xs de nuevo'
            : 'aceptada — Facebook reconoce la sesion');
    }
    diagLinea('tiempo', $ms . ' ms');

    // ── 2. Jina Reader, desde la IP de Jina ──
    $t = microtime(true);
    $md = jinaFetchOnce($url, true);   // sin cache, para ver el estado de hoy
    $ms = round((microtime(true) - $t) * 1000);
    echo "\n  [2] Jina Reader\n";
    if (!$md) {
        // jinaFetchOnce ya devuelve null ante el desafio; se repite crudo para
        // poder distinguir "bloqueado" de "no respondio".
        $crudo = @file_get_contents('https://r.jina.ai/' . $url, false, stream_context_create([
            'http' => ['timeout' => 25, 'header' => "Accept: text/plain\r\nx-no-cache: true\r\n"],
        ]));
        diagLinea('resultado', diagEsDesafio($crudo) ? 'BLOQUEADO — desafio de Cloudflare' : 'sin datos utiles');
    } else {
        preg_match_all('#https?://[^\s\)"]+\.(?:jpg|jpeg|png|webp)#i', $md, $m);
        diagLinea('resultado', 'OK — ' . number_format(strlen($md)) . ' bytes');
        diagLinea('imagenes', count($m[0]) . ' encontradas');
    }
    diagLinea('tiempo', $ms . ' ms');

    // ── 3. La cadena completa, que es lo que guarda el expediente ──
    $t = microtime(true);
    $r = scrapeLinkData($url);
    $ms = round((microtime(true) - $t) * 1000);
    echo "\n  [3] scrapeLinkData() — lo que termina en el expediente\n";
    $campos = ['title', 'image_url', 'value_usa_usd', 'location', 'hours', 'engine', 'make', 'model', 'year'];
    $vacios = 0;
    foreach ($campos as $c) {
        $v = $r[$c] ?? null;
        $hay = !($v === null || $v === '' || $v === 0);
        if (!$hay) $vacios++;
        diagLinea($c, $hay ? mb_substr((string) $v, 0, 90) : '—');
    }
    diagLinea('tiempo', $ms . ' ms');

    // El veredicto no se mide contando campos: una ficha con marca, modelo y
    // año pero sin foto ni precio tiene cuatro datos y no le sirve de nada al
    // cliente, porque no puede ni verla ni compararla. Foto y precio son los
    // dos que deciden.
    $foto = !empty($r['image_url']);
    $precio = !empty($r['value_usa_usd']);
    if ($foto && $precio) {
        $veredicto = 'COMPLETA — foto y precio';
    } elseif ($foto || $precio) {
        $veredicto = 'PARCIAL — ' . ($foto ? 'tiene foto, falta precio' : 'tiene precio, falta foto');
    } else {
        $veredicto = 'INSERVIBLE — sin foto ni precio; solo lo que se deduce de la URL';
    }
    diagLinea('veredicto', $veredicto . ' (' . $vacios . ' de ' . count($campos) . ' campos vacios)');

    if (!empty($r['plan_b'])) {
        foreach ($r['plan_b'] as $p) {
            diagLinea('plan B', 'nivel ' . ($p['level'] ?? '?') . ' (' . ($p['method'] ?? '?') . '), recupero ' . ($p['fields_recovered'] ?? 0) . ' campo(s)');
        }
    }
}

echo "\n  " . str_repeat('=', 74) . "\n";
echo "  Si [1] y [2] salen BLOQUEADOS, el scraper esta sano y el sitio nos esta\n";
echo "  cerrando la puerta: no hay nada que arreglar en el codigo.\n\n";
