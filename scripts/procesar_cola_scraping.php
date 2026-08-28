<?php
/**
 * Vaciar la cola de scraping — Imporlan
 * =====================================
 *
 * BoatTrader, boats.com y YachtWorld tardan entre 50 y 90 segundos en responder
 * —medido contra anuncios vivos: 50,6 / 73,8 / 86,8— porque hay que atravesar
 * su Cloudflare con un navegador de verdad. Ninguna peticion web sobrevive eso:
 * el servidor la corta mucho antes que PHP, el panel muestra un error, y el
 * credito se gasta igual porque ScrapingBee si hizo el trabajo. Lo unico que se
 * pierde es la respuesta.
 *
 * Por eso el panel ya no los pide en vivo: los deja en cola y contesta al
 * instante. Este script es el que hace el trabajo de verdad, desde consola,
 * donde no hay ningun servidor web mirando el reloj.
 *
 * EN CRON, cada cinco minutos:
 *   *!/5 * * * * /usr/local/bin/php /home/wwimpo/imporlan-staging/scripts/procesar_cola_scraping.php >> /home/wwimpo/logs/cola_scraping.log 2>&1
 *   (sin el signo de admiracion; va escapado para no cerrar este comentario)
 *
 * A MANO, para no esperar al cron:
 *   php /home/wwimpo/imporlan-staging/scripts/procesar_cola_scraping.php
 *
 * USO
 *   --limite=N   cuantas filas procesar como maximo (por defecto 5)
 *   --ver        muestra la cola y no procesa nada
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("Solo por linea de comandos.\n");
}

$apiPath = '/home/wwimpo/imporlan.cl/api/orders_api.php';
if (!file_exists($apiPath)) $apiPath = __DIR__ . '/../api/orders_api.php';
if (!file_exists($apiPath)) exit("No encuentro orders_api.php.\n");
if (!file_exists(dirname($apiPath) . '/db_config.php')) {
    exit("Falta db_config.php. Este script corre en el servidor.\n");
}
require_once $apiPath;

$soloVer = in_array('--ver', $argv, true);
$limite = 5;
foreach ($argv as $a) {
    if (preg_match('/^--limite=(\d+)$/', $a, $m)) $limite = max(1, intval($m[1]));
}

$pdo = getDbConnection();
if (!$pdo) exit("No pude conectar a la base de datos.\n");

$ahora = date('d-m-Y H:i');

// Las columnas de la cola las crea la migracion, que no corre sola. Sin esta
// comprobacion el script moria con "Unknown column 'scrape_state'" y, como el
// hosting tiene display_errors apagado, no imprimia absolutamente nada: el
// comando volvia al prompt en silencio y no habia forma de saber por que.
if (!$pdo->query("SHOW COLUMNS FROM order_links LIKE 'scrape_state'")->fetch()) {
    exit("\n  Falta la migracion: la tabla order_links todavia no tiene las columnas\n"
       . "  de la cola. Corre esto una vez y vuelve a intentar:\n\n"
       . "    php -r 'require \"/home/wwimpo/imporlan.cl/api/orders_api.php\"; runMigration();'\n\n");
}

// Se procesa la mas antigua primero: si alguien encola diez fichas, la que
// lleva mas rato esperando es la que mas molesta.
$cola = $pdo->query(
    "SELECT l.order_id, l.row_index, l.url, o.order_number
       FROM order_links l
       JOIN orders o ON o.id = l.order_id
      WHERE l.scrape_state = 'en_cola'
      ORDER BY l.scrape_queued_at ASC, l.id ASC"
)->fetchAll(PDO::FETCH_ASSOC);

if (!$cola) {
    // En cron esto se imprime cada cinco minutos; una sola linea alcanza.
    echo "[$ahora] cola vacia\n";
    exit(0);
}

echo "[$ahora] " . count($cola) . " fila(s) en cola\n";
foreach ($cola as $c) {
    echo "    {$c['order_number']} fila {$c['row_index']}  " . substr($c['url'], 0, 70) . "\n";
}
if ($soloVer) exit(0);

$porHacer = array_slice($cola, 0, $limite);
if (count($cola) > $limite) {
    // Con un tope, una cola larga se reparte entre varias corridas del cron en
    // vez de dejar un proceso de media hora colgado.
    echo "    (se procesan " . count($porHacer) . "; el resto queda para la proxima corrida)\n";
}

$ok = 0;
$fallidas = 0;
foreach ($porHacer as $c) {
    $t = microtime(true);
    $pdo->prepare("UPDATE order_links SET scrape_state = 'procesando' WHERE order_id = ? AND row_index = ?")
        ->execute([$c['order_id'], $c['row_index']]);

    try {
        // La misma funcion que usa el panel, con $incluirLentos en true: aca si
        // se pueden pedir los sitios que tardan.
        $r = scrapeOrderLinkRows($pdo, intval($c['order_id']), false, 0, intval($c['row_index']), true);
        $estado = $r[0]['status'] ?? 'sin_resultado';
        $campos = $r[0]['fields'] ?? [];
    } catch (\Throwable $e) {
        $estado = 'excepcion';
        $campos = [];
        error_log('procesar_cola_scraping: ' . $e->getMessage());
    }

    $segundos = round(microtime(true) - $t);

    if ($estado === 'updated' && $campos) {
        // applyScrapedDataToLinkRow ya devolvio la fila a 'idle' al escribir.
        $ok++;
        printf("    %s fila %-2d  listo en %ds  (%s)\n", $c['order_number'], $c['row_index'], $segundos, implode(', ', $campos));
    } else {
        // No se deja en 'en_cola': el cron la reintentaria en bucle y cada
        // intento cuesta creditos. Queda marcada como error, con el motivo a la
        // vista en el panel, para que una persona decida.
        $fallidas++;
        $pdo->prepare("UPDATE order_links
                          SET scrape_state = 'error',
                              scrape_message = 'No se pudo leer el anuncio. Puede estar retirado o el sitio no cedio.'
                        WHERE order_id = ? AND row_index = ?")
            ->execute([$c['order_id'], $c['row_index']]);
        printf("    %s fila %-2d  sin datos en %ds (%s)\n", $c['order_number'], $c['row_index'], $segundos, $estado);
    }
}

echo "[$ahora] $ok completada(s), $fallidas sin datos\n";
