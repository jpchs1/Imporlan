<?php
// Guardado real contra SQLite, sin hosting, sesiones ni correos de producción.
$raiz = dirname(__DIR__);
$caja = sys_get_temp_dir() . '/imporlan-negociado-' . getmypid();
mkdir($caja, 0700);
register_shutdown_function(function () use ($caja) {
    foreach (glob("$caja/*") as $f) unlink($f);
    rmdir($caja);
});
$codigo = file_get_contents("$raiz/api/orders_api.php");
$codigo = str_replace("file_get_contents('php://input')", "json_encode(\$GLOBALS['INPUT'])", $codigo);
file_put_contents("$caja/orders_api.php", $codigo);
foreach (['auth_helper.php', 'scraper_locator.php', 'eleccion_lancha.php', 'operador_usa.php'] as $f) file_put_contents("$caja/$f", '<?php');
file_put_contents("$caja/cotizador_helpers.php", '<?php function cotizadorEnsureOrderLinkColumns($pdo) {}');
file_put_contents("$caja/db_config.php", '<?php function getDbConnection() { return $GLOBALS["BD"]; }');
$BD = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$BD->sqliteCreateFunction('NOW', fn() => date('Y-m-d H:i:s'));
$BD->exec("CREATE TABLE order_links (id INTEGER PRIMARY KEY, value_usa_usd REAL, value_to_negotiate_usd REAL,
    quote_data TEXT, quote_total_clp INTEGER, quote_total_usd REAL, quote_payments TEXT,
    quote_calculated_at TEXT, quote_published_at TEXT, quote_breakdown_sent_at TEXT, value_chile_negotiated_clp REAL);
    INSERT INTO order_links (id, value_usa_usd, value_to_negotiate_usd) VALUES (123, 4995, 4000);");
$_SERVER['SCRIPT_FILENAME'] = __FILE__;
require "$caja/orders_api.php";
$fallos = 0;
function ok($cond, $mensaje) {
    global $fallos;
    echo ($cond ? 'ok ' : 'FALLA ') . $mensaje . "\n";
    if (!$cond) $fallos++;
}
function guardar($q, $extras = []) {
    $GLOBALS['INPUT'] = array_merge(['link_id' => 123, 'quote_data' => $q, 'quote_total_clp' => 23880640,
        'quote_total_usd' => 25957.22, 'quote_payments' => ['p1_pct' => 7, 'p1_clp' => 1671645], 'publish_now' => false], $extras);
    http_response_code(200);
    ob_start(); adminSaveQuote(); $r = json_decode(ob_get_clean(), true);
    return [http_response_code(), $r];
}
function fila() { return $GLOBALS['BD']->query('SELECT * FROM order_links WHERE id = 123')->fetch(); }

[$status, $r] = guardar(['valor_negociado_usd' => 4000, 'valor_lancha_usd' => 4000]);
ok($status === 200 && !empty($r['success']), 'guarda una cotización basada en el negociado');
$f = fila();
ok($f['value_to_negotiate_usd'] == 4000 && $f['value_usa_usd'] == 4995, 'conserva separados el publicado y el negociado');
ok($f['quote_total_clp'] == 23880640 && $f['value_chile_negotiated_clp'] == 23880640, 'el total guardado se refleja en el ranking');
ok(json_decode($f['quote_data'], true)['valor_lancha_usd'] == 4000, 'el snapshot usa el negociado como valor de compra');
ok(json_decode($f['quote_payments'], true)['p1_clp'] == 1671645, 'conserva los pagos calculados');

foreach ([null, 0, -100, 'incorrecto', '1e999', 0.001] as $invalido) {
    [$status] = guardar(['valor_negociado_usd' => $invalido, 'valor_lancha_usd' => 4995], ['publish_now' => true]);
    ok($status === 400 && fila()['value_to_negotiate_usd'] == 4000 && fila()['quote_published_at'] === null,
        'rechaza un negociado inválido sin guardar ni publicar: ' . json_encode($invalido));
}
[$status] = guardar(['valor_negociado_usd' => 4000, 'valor_lancha_usd' => 4995]);
ok($status === 409, 'rechaza calcular con el publicado aunque se envíe otro negociado');
[$status] = guardar(['valor_lancha_usd' => 4995]);
ok($status === 409, 'una sesión antigua no puede sobrescribir el precio con la base publicada');
[$status] = guardar(['valor_lancha_usd' => 4000]);
ok($status === 200 && fila()['value_to_negotiate_usd'] == 4000, 'acepta un cliente anterior si realmente calculó sobre el negociado vigente');
[$status] = guardar(['valor_negociado_usd' => 3500.25, 'valor_lancha_usd' => 3500.25]);
ok($status === 200 && fila()['value_to_negotiate_usd'] == 3500.25, 'actualiza el negociado y la cotización juntos, incluidos los centavos');
[$status] = guardar(['valor_negociado_usd' => 4000, 'valor_lancha_usd' => 4000], ['link_id' => 999]);
ok($status === 404, 'no guarda cotizaciones en filas inexistentes');
$BD->exec('UPDATE order_links SET value_to_negotiate_usd = NULL WHERE id = 123');
[$status] = guardar(['valor_lancha_usd' => 4995]);
ok($status === 400, 'un cliente antiguo sin negociación tampoco puede cotizar sobre el publicado');

exit($fallos ? 1 : 0);
