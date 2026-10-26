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
 * cron-deploy.sh lo ejecuta automáticamente, incluso sin cambios en main.
 * También puede usarse un cron independiente (el lock evita duplicados):
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

// Una sola instancia: un cron independiente y el de deploy pueden coincidir.
$lock = fopen(sys_get_temp_dir() . '/imporlan-cola-scraping.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) exit(0);

// El despliegue ya trae el consumidor: no debe depender de una migración
// manual para poder usarlo. --ver sigue siendo estrictamente de lectura.
$columnas = $pdo->query("SHOW COLUMNS FROM order_links")->fetchAll(PDO::FETCH_COLUMN);
$definiciones = [
    'scrape_state' => "ENUM('idle','en_cola','procesando','error') DEFAULT 'idle'",
    'scrape_queued_at' => 'DATETIME NULL',
    'scrape_message' => 'VARCHAR(255) NULL',
];
foreach ($definiciones as $columna => $definicion) {
    if (in_array($columna, $columnas, true)) continue;
    if ($soloVer) exit("Faltan las columnas de la cola. Ejecuta el worker sin --ver para instalarlas.\n");
    $pdo->exec("ALTER TABLE order_links ADD COLUMN $columna $definicion");
}

if ($soloVer) {
    $cola = $pdo->query("SELECT o.order_number, l.row_index, l.scrape_state
                          FROM order_links l JOIN orders o ON o.id = l.order_id
                         WHERE l.scrape_state IN ('en_cola', 'procesando')
                         ORDER BY l.scrape_queued_at, l.id")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($cola as $c) echo "{$c['order_number']} fila {$c['row_index']}: {$c['scrape_state']}\n";
    echo count($cola) . " fila(s) pendientes\n";
    exit(0);
}

$resultados = procesarColaScraping($pdo, $limite);
$ok = 0;
foreach ($resultados as $r) {
    if ($r['status'] === 'idle') $ok++;
    printf("[%s] %s fila %d: %s (%ds)\n", $ahora, $r['order_number'], $r['row_index'], $r['status'], $r['seconds']);
}
printf("[%s] %d completada(s), %d incompleta(s)\n", $ahora, $ok, count($resultados) - $ok);
