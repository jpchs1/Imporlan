<?php
// API real contra SQLite; el proveedor se sustituye para no gastar créditos.
$raiz = dirname(__DIR__);
$caja = sys_get_temp_dir() . '/imporlan-scraping-' . getmypid();
mkdir($caja, 0700);
register_shutdown_function(function () use ($caja) {
    foreach (glob("$caja/*") as $f) unlink($f);
    rmdir($caja);
});
$codigo = file_get_contents("$raiz/api/orders_api.php");
$codigo = str_replace("file_get_contents('php://input')", "json_encode(\$GLOBALS['INPUT'])", $codigo);
file_put_contents("$caja/orders_api.php", $codigo);
foreach (['auth_helper.php', 'cotizador_helpers.php', 'eleccion_lancha.php', 'operador_usa.php'] as $f) file_put_contents("$caja/$f", '<?php');
file_put_contents("$caja/db_config.php", '<?php function getDbConnection() { return $GLOBALS["BD"]; }');
file_put_contents("$caja/scraper_locator.php", '<?php function linkScraperPath() { return __DIR__ . "/scraper.php"; }');
file_put_contents("$caja/email_service.php", '<?php class EmailService { protected $adminEmails = ["team@example.com"]; }');
file_put_contents("$caja/scraper.php", <<<'PHP'
<?php
function scrapeLinkData($url) {
    $GLOBALS['PEDIDOS'][] = $url;
    if (isset($GLOBALS['DURANTE'])) { $f = $GLOBALS['DURANTE']; unset($GLOBALS['DURANTE']); $f(); }
    if (strpos($url, '/retirado') !== false) return ['error' => 'retirado'];
    if (strpos($url, '/parcial') !== false) return ['title' => 'Sólo título'];
    return ['title' => 'Anuncio leído', 'image_url' => 'https://img.example/boat.jpg', 'value_usa_usd' => 12000];
}
PHP);
class ScrapingPDO extends PDO {
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false {
        if (str_starts_with($query, 'SHOW COLUMNS')) $query = "SELECT 'scrape_state' AS Field";
        return parent::query($query, $fetchMode, ...$fetchModeArgs);
    }
}
$BD = new ScrapingPDO('sqlite::memory:');
$BD->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$BD->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$BD->sqliteCreateFunction('NOW', fn() => date('Y-m-d H:i:s'));
$BD->exec("CREATE TABLE orders (id INTEGER PRIMARY KEY, order_number TEXT, customer_id INT, customer_email TEXT,
      customer_name TEXT, customer_phone TEXT, plan_name TEXT, requirement_name TEXT, service_type TEXT, status TEXT, origin TEXT, purchase_id TEXT);
    INSERT INTO orders (id, order_number) VALUES (36, 'IMP-00036'), (37, 'IMP-00037');
    CREATE TABLE notifications (user_email TEXT, type TEXT, title TEXT, message TEXT, link TEXT);
    CREATE TABLE order_links (id INTEGER PRIMARY KEY, order_id INT, row_index INT, url TEXT, title TEXT, image_url TEXT,
      location TEXT, hours TEXT, engine TEXT, make TEXT, model TEXT, year INT, value_usa_usd REAL,
      value_to_negotiate_usd REAL, value_chile_clp REAL, value_chile_negotiated_clp REAL,
      selection_order INT, comments TEXT, link_status TEXT DEFAULT 'active',
      scrape_state TEXT DEFAULT 'idle', scrape_queued_at TEXT, scrape_message TEXT);
    CREATE TABLE order_events (order_id INT, event_type TEXT, meta_json TEXT, user_id INT);");
$_SERVER['SCRIPT_FILENAME'] = __FILE__;
require "$caja/orders_api.php";
$fallos = 0;
function ok($cond, $msg) { global $fallos; echo ($cond ? 'ok ' : 'FALLA ') . $msg . "\n"; if (!$cond) $fallos++; }
function fila($id) { return $GLOBALS['BD']->query('SELECT * FROM order_links WHERE id = ' . intval($id))->fetch(); }
function accion($fn, $input) { $GLOBALS['INPUT'] = $input; ob_start(); $fn(); return json_decode(ob_get_clean(), true); }
$PEDIDOS = [];

$ids = [];
for ($i = 1; $i <= 8; $i++) {
    $r = accion('adminAddLink', ['order_id' => 36, 'url' => "https://www.boattrader.com/boat/$i", 'title' => 'Título precargado']);
    $ids[] = $r['link_id'];
}
ok(count($ids) === 8 && $BD->query("SELECT COUNT(*) FROM order_links WHERE scrape_state = 'en_cola'")->fetchColumn() == 8,
    'agregar ocho links con título encola los ocho');
ok(!$PEDIDOS, 'guardar no hace llamadas de red dentro de la petición web');
$resultado = procesarColaScraping($BD, 5);
ok(count($resultado) === 5 && count($PEDIDOS) === 5, 'la primera pasada respeta el límite');
ok($BD->query("SELECT COUNT(*) FROM order_links WHERE scrape_state = 'en_cola'")->fetchColumn() == 3, 'los otros tres quedan pendientes');
procesarColaScraping($BD, 5);
ok(count($PEDIDOS) === 8 && fila($ids[7])['scrape_state'] === 'idle', 'la siguiente pasada completa el lote, con foto y precio');

$fila = fila($ids[0]);
$fila['comments'] = 'Comentario interno';
accion('adminUpdateLinks', ['order_id' => 36, 'links' => [$fila]]);
procesarColaScraping($BD);
ok(count($PEDIDOS) === 8, 'guardar comentarios no vuelve a pedir ni cobrar el anuncio');
$fila['url'] = 'https://dealer.example/otra';
accion('adminUpdateLinks', ['order_id' => 36, 'links' => [$fila]]);
ok(fila($ids[0])['scrape_state'] === 'en_cola', 'cambiar la URL encola también sitios rápidos y filas con ficha');
procesarColaScraping($BD);
ok(count($PEDIDOS) === 9 && end($PEDIDOS) === $fila['url'], 'se pide la nueva URL');

$BD->exec("UPDATE order_links SET image_url = NULL, value_usa_usd = NULL, scrape_queued_at = NULL WHERE id = {$ids[1]}");
ok(encolarLinksAutomaticos($BD, 36) === 1, 'recupera una ficha con título pero sin foto/precio, sin repetir las completas');
procesarColaScraping($BD);

$r = accion('adminAddLink', ['order_id' => 37, 'url' => 'https://dealer.example/retirado']);
$retirado = $r['link_id'];
$r = accion('adminAddLink', ['order_id' => 36, 'url' => 'https://dealer.example/parcial']);
$parcial = $r['link_id'];
procesarColaScraping($BD);
ok(fila($retirado)['scrape_state'] === 'error' && fila($parcial)['scrape_state'] === 'error', 'anuncio retirado y título parcial no se anuncian como completos');
$n = count($PEDIDOS);
encolarLinksAutomaticos($BD, 36);
procesarColaScraping($BD);
ok(count($PEDIDOS) === $n, 'los errores no se reintentan cobrando en bucle');
ok(fila($retirado)['order_id'] == 37, 'los expedientes conservan sus filas');

encolarLinksAutomaticos($BD, 36, $ids[2], true);
$DURANTE = function () use ($BD, $ids) { $BD->exec("UPDATE order_links SET row_index = 99 WHERE id = {$ids[2]}"); };
procesarColaScraping($BD);
ok(fila($ids[2])['scrape_state'] === 'idle' && fila($ids[2])['row_index'] == 99, 'reordenar durante el scraping conserva el resultado en el id correcto');
encolarLinksAutomaticos($BD, 36, $ids[3], true);
$DURANTE = function () use ($BD, $ids) {
    $BD->exec("UPDATE order_links SET url = 'https://dealer.example/nuevo', title = 'Nuevo', image_url = NULL, value_usa_usd = NULL WHERE id = {$ids[3]}");
    encolarLinksAutomaticos($BD, 36, $ids[3], true);
};
procesarColaScraping($BD);
$cambiada = fila($ids[3]);
ok($cambiada['title'] === 'Nuevo' && !$cambiada['image_url'] && $cambiada['scrape_state'] === 'en_cola', 'cambiar de anuncio durante una lectura descarta la respuesta vieja y conserva la cola nueva');
procesarColaScraping($BD);
ok(fila($ids[3])['scrape_state'] === 'idle', 'el anuncio nuevo se completa en la pasada siguiente');
$BD->exec("UPDATE order_links SET scrape_state = 'procesando', scrape_queued_at = '2000-01-01' WHERE id = $retirado");
procesarColaScraping($BD);
ok(fila($retirado)['scrape_state'] === 'error', 'un proceso interrumpido deja de aparecer leyendo para siempre');
$r = accion('adminAddLink', ['order_id' => 36, 'url' => '']);
ok(fila($r['link_id'])['scrape_state'] === 'idle', 'agregar una fila vacía no crea trabajo');

encolarLinksAutomaticos($BD, 36, $ids[4], true);
$vacia = fila($ids[4]);
$vacia['url'] = null;
accion('adminUpdateLinks', ['order_id' => 36, 'links' => [$vacia]]);
ok(fila($ids[4])['scrape_state'] === 'idle', 'borrar una URL cancela la lectura pendiente');

$n = count($PEDIDOS);
$nuevo = createOrderFromQuotation(['id' => 'pago-prueba', 'user_email' => 'customer@example.com'], [
    ['url' => 'https://www.boattrader.com/boat/a', 'title' => 'Precargado'],
    ['url' => 'https://dealer.example/b', 'title' => 'Precargado'],
]);
ok($nuevo && $BD->query("SELECT COUNT(*) FROM order_links WHERE order_id = $nuevo AND scrape_state = 'en_cola'")->fetchColumn() == 2,
    'el pago encola todos los enlaces antes de las notificaciones, aunque traigan título');
ok(count($PEDIDOS) === $n, 'el webhook de pago no espera a la red ni gasta créditos');

exit($fallos ? 1 : 0);
