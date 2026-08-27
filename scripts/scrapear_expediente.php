<?php
/**
 * Completar las fichas de un expediente desde consola — Imporlan
 * ==============================================================
 *
 * BoatTrader, boats.com y YachtWorld tardan entre 50 y 90 segundos en
 * responder: hay que atravesar el Cloudflare con un navegador de verdad, y eso
 * no se apura. Medido contra anuncios vivos: 50,6 s / 73,8 s / 86,8 s.
 *
 * Ninguna peticion web sobrevive eso. El PHP tiene set_time_limit(300), pero
 * quien corta es el servidor web mucho antes, asi que el boton "Rescrapear" del
 * panel recibe un error, la ficha queda incompleta —y el credito se gasta
 * igual, porque ScrapingBee ya hizo el trabajo—. Desde consola no hay nadie que
 * corte, y por eso el mismo anuncio que falla en el panel sale completo aca.
 *
 * Este script hace exactamente lo que hace el boton del panel: llama a
 * scrapeOrderLinkRows(), la misma funcion, y escribe en las mismas columnas. La
 * unica diferencia es que no tiene un servidor web encima mirando el reloj.
 *
 * Ademas deja las paginas en el cache de seis horas, asi que si despues alguien
 * aprieta "Reintentar" en el panel, esa vez si responde al instante y sin
 * cobrar.
 *
 * USO
 *   php scrapear_expediente.php --pendientes     que expedientes tienen fichas a medias
 *   php scrapear_expediente.php IMP-00003        un expediente por su numero
 *   php scrapear_expediente.php 42               o por su id interno
 *   php scrapear_expediente.php IMP-00003 --todo tambien las filas ya completas
 *   php scrapear_expediente.php IMP-00003 --si   sin preguntar (para cron)
 *
 * Por defecto toca las filas a las que les falta la foto o el precio, que son
 * los dos datos que el cliente necesita para decidir. No alcanza con mirar el
 * titulo: cuando el scrapeo falla, el titulo igual se rellena deduciendolo de la
 * URL, asi que una fila rota se ve "con ficha" y con este criterio quedaria
 * fuera justo la que hay que arreglar.
 *
 * Cada anuncio de un sitio con Cloudflare cuesta 75 creditos de ScrapingBee, asi
 * que el script los cuenta y pregunta antes de gastarlos.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("Solo por linea de comandos.\n");
}

// Los argumentos se revisan antes de cargar nada: un error de tipeo tiene que
// contestar con el modo de uso, no con un fatal de la base de datos.
$argumento = $argv[1] ?? '';
$soloVacias = !in_array('--todo', $argv, true);
$sinPreguntar = in_array('--si', $argv, true);

$listarPendientes = in_array('--pendientes', $argv, true);

if (!$listarPendientes && ($argumento === '' || $argumento[0] === '-')) {
    exit("\n  Falta el expediente.\n"
       . "    php " . basename(__FILE__) . " --pendientes        que expedientes tienen fichas a medias\n"
       . "    php " . basename(__FILE__) . " IMP-00003\n"
       . "    php " . basename(__FILE__) . " IMP-00003 --todo   (tambien las filas ya completas)\n\n");
}

// La API de produccion primero: su __DIR__ es el que hace que uploads/ y
// scraper_config.php resuelvan a las rutas del sitio y no a las del repo.
$apiPath = '/home/wwimpo/imporlan.cl/api/orders_api.php';
if (!file_exists($apiPath)) $apiPath = __DIR__ . '/../api/orders_api.php';
if (!file_exists($apiPath)) exit("\n  No encuentro orders_api.php.\n\n");
if (!file_exists(dirname($apiPath) . '/db_config.php')) {
    // En el repo no esta: tiene credenciales y por eso no se versiona. Sin este
    // aviso el error es un fatal de require_once que no explica nada.
    exit("\n  Falta " . dirname($apiPath) . "/db_config.php, que es el que trae las\n"
       . "  credenciales de la base. Este script hay que correrlo en el servidor.\n\n");
}

require_once $apiPath;

$pdo = getDbConnection();
if (!$pdo) exit("No pude conectar a la base de datos.\n");

/**
 * Una fila esta incompleta cuando le falta la foto o el precio.
 *
 * Mirar el titulo no sirve: cuando el scrapeo falla, el titulo igual se rellena
 * deduciendolo de la URL ("2021 Chaparral 267 Ssx" sale del propio link), asi
 * que la fila rota aparenta estar completa. Foto y precio son los dos datos que
 * el cliente necesita para decidir, y los unicos que solo pueden venir del
 * anuncio.
 */
function filaIncompleta($f) {
    $sinFoto = trim((string) ($f['image_url'] ?? '')) === '';
    $sinPrecio = !((float) ($f['value_usa_usd'] ?? 0) > 0);
    return $sinFoto || $sinPrecio;
}

// ── Modo --pendientes: donde estan las fichas a medias ──
// Sin esto, para arreglar un link roto que se vio en el panel hay que adivinar
// a que expediente pertenece.
if ($listarPendientes) {
    $filasTodas = $pdo->query(
        "SELECT o.order_number, l.order_id, l.row_index, l.url, l.image_url, l.value_usa_usd
           FROM order_links l
           JOIN orders o ON o.id = l.order_id
          WHERE l.url IS NOT NULL AND TRIM(l.url) <> ''
          ORDER BY l.order_id, l.row_index"
    )->fetchAll(PDO::FETCH_ASSOC);

    $porExpediente = [];
    foreach ($filasTodas as $f) {
        if (filaIncompleta($f)) $porExpediente[$f['order_number']][] = $f;
    }

    echo "\n  Expedientes con fichas incompletas\n";
    echo "  " . str_repeat('=', 68) . "\n";
    if (!$porExpediente) {
        echo "  Ninguno: todas las filas con link tienen foto y precio.\n\n";
        exit(0);
    }
    foreach ($porExpediente as $numero => $rotas) {
        echo "\n  $numero — " . count($rotas) . " fila(s)\n";
        foreach ($rotas as $f) {
            $falta = [];
            if (trim((string) $f['image_url']) === '') $falta[] = 'foto';
            if (!((float) $f['value_usa_usd'] > 0)) $falta[] = 'precio';
            printf("    fila %-2d  falta %-12s %s\n", $f['row_index'],
                implode('+', $falta), substr($f['url'], 0, 52));
        }
    }
    echo "\n  " . str_repeat('=', 68) . "\n";
    echo "  Para completar uno:  php " . basename(__FILE__) . " <numero>\n\n";
    exit(0);
}

// Se acepta el numero que ve el cliente (IMP-00003) o el id interno. El numero
// es lo que aparece en el panel y en los correos; pedir el id obligaria a ir a
// buscarlo a la base justo cuando uno quiere resolver rapido.
if (ctype_digit($argumento)) {
    $st = $pdo->prepare("SELECT id, order_number FROM orders WHERE id = ?");
} else {
    $st = $pdo->prepare("SELECT id, order_number FROM orders WHERE order_number = ?");
}
$st->execute([$argumento]);
$orden = $st->fetch(PDO::FETCH_ASSOC);
if (!$orden) exit("\n  No existe el expediente '$argumento'.\n\n");

$orderId = intval($orden['id']);

$st = $pdo->prepare("SELECT row_index, url, title, image_url, value_usa_usd FROM order_links
                     WHERE order_id = ? AND url IS NOT NULL AND TRIM(url) <> ''
                     ORDER BY row_index");
$st->execute([$orderId]);
$filas = $st->fetchAll(PDO::FETCH_ASSOC);

echo "\n  Expediente {$orden['order_number']} (id $orderId)\n";
echo "  " . str_repeat('=', 68) . "\n";

if (!$filas) exit("  No tiene links cargados.\n\n");

/** Los mismos dominios que planBScrapingBee() pide con stealth_proxy. */
function esSitioCaro($url) {
    return (bool) preg_match('/yachtworld\.|boattrader\.com|boats\.com|boatsgroup\.com/i', $url);
}

$aProcesar = $soloVacias ? array_filter($filas, 'filaIncompleta') : $filas;
$indices = array_column($aProcesar, 'row_index');

foreach ($filas as $f) {
    $marca = in_array($f['row_index'], $indices) ? '→' : ' ';
    $falta = [];
    if (trim((string) $f['image_url']) === '') $falta[] = 'foto';
    if (!((float) $f['value_usa_usd'] > 0)) $falta[] = 'precio';
    printf("  %s fila %-2d  %-14s %s%s\n", $marca, $f['row_index'],
        $falta ? 'falta ' . implode('+', $falta) : 'completa',
        substr($f['url'], 0, 56), esSitioCaro($f['url']) ? '  [75 cred.]' : '');
}

if (!$aProcesar) {
    echo "\n  Todas las filas tienen foto y precio. Para rehacerlas igual: --todo\n\n";
    exit(0);
}

$caras = 0;
foreach ($aProcesar as $f) if (esSitioCaro($f['url'])) $caras++;

echo "\n  Se van a procesar " . count($aProcesar) . " fila(s).\n";
if ($caras) {
    echo "  $caras son de sitios con Cloudflare: ~" . ($caras * 75) . " creditos de ScrapingBee\n";
    echo "  y cerca de " . ($caras * 90) . " segundos en total. Las que ya se pidieron hoy\n";
    echo "  salen del cache y no cobran.\n";
}

if (!$sinPreguntar) {
    echo "\n  Continuar? [s/N] ";
    $r = strtolower(trim((string) fgets(STDIN)));
    if ($r !== 's' && $r !== 'si') exit("  Cancelado. No se gasto nada.\n\n");
}

echo "\n";
$t = microtime(true);

// La misma funcion que usa el boton del panel. Reusarla en vez de reescribir el
// scrapeo evita que consola y panel se vayan separando con cada arreglo.
//
// Se llama fila por fila, y no de una vez, por dos razones: su filtro interno
// de "solo vacias" pide titulo E imagen en blanco, que no es el criterio de
// aca; y con anuncios de 90 segundos conviene ver el avance en vez de mirar una
// pantalla quieta durante diez minutos.
$resultados = [];
foreach ($aProcesar as $i => $f) {
    printf("  fila %-2d  (%d de %d) pidiendo...", $f['row_index'], count($resultados) + 1, count($aProcesar));
    $t0 = microtime(true);
    $r = scrapeOrderLinkRows($pdo, $orderId, false, 0, intval($f['row_index']));
    $r = $r[0] ?? ['row_index' => $f['row_index'], 'status' => 'sin_resultado'];
    $campos = $r['fields'] ?? [];
    printf("\r  fila %-2d  %-13s %-42s %ds\n",
        $r['row_index'] ?? 0,
        $r['status'] ?? '?',
        $campos ? implode(', ', $campos) : substr((string) ($r['error'] ?? ''), 0, 42),
        round(microtime(true) - $t0));
    $resultados[] = $r;
}

$actualizadas = 0;
$conFoto = 0;
foreach ($resultados as $r) {
    if (($r['status'] ?? '') === 'updated') $actualizadas++;
    if (!empty($r['image'])) $conFoto++;
}

echo "\n  " . str_repeat('=', 68) . "\n";
printf("  %d de %d fila(s) actualizadas, %d con foto, en %d segundos.\n",
    $actualizadas, count($resultados), $conFoto, round(microtime(true) - $t));
echo "  Recarga el expediente en el panel para verlas.\n\n";
