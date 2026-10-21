<?php
/**
 * Elegir la lancha e importar (api/eleccion_lancha.php + orders_api.php).
 *
 * JP, 21-oct-2026: «Alberto Lathrop decidió avanzar con esta, mejora la UI/UX
 * desde este punto en donde al usuario le toca elegir la lancha con la que
 * quiere avanzar y empezar el proceso de importación».
 *
 * Lo que se cobra:
 *   1. Las reglas: qué lancha se puede elegir, hasta cuándo se puede cambiar,
 *      qué etapa queda.
 *   2. Las acciones de verdad (user_choose_link, user_unchoose_link,
 *      admin_choose_link, admin_set_import_step) contra una base SQLite en
 *      memoria, con una copia de la API donde los correos se capturan en vez
 *      de salir: nadie elige en un expediente ajeno, el correo al equipo y al
 *      cliente sale con lo que corresponde, y la etapa se mueve.
 *   3. Las rutas exigen sesión (cliente o equipo) y nunca leen el correo del
 *      cuerpo de la petición.
 *
 * Uso: php test/eleccion-lancha-tests.php
 */

$raiz = dirname(__DIR__);
$fallos = 0;
$total = 0;

function ok($cond, $msg) {
    global $fallos, $total;
    $total++;
    echo ($cond ? '  ok  ' : '  FALLA  ') . $msg . "\n";
    if (!$cond) $fallos++;
}

// ---------------------------------------------------------------------------
// Copia de la API: db_config da la base SQLite y sendEmail captura.
// ---------------------------------------------------------------------------
$caja = sys_get_temp_dir() . '/imporlan-eleccion-' . getmypid();
@mkdir($caja, 0700, true);
foreach (['orders_api.php', 'eleccion_lancha.php', 'email_service.php', 'cotizador_helpers.php', 'scraper_locator.php', 'auth_helper.php', 'session_revocation.php', 'payment_requests_helper.php'] as $f) {
    copy("$raiz/api/$f", "$caja/$f");
}
// En la consola ya hay salida: el código HTTP se anota en vez de mandarse.
file_put_contents("$caja/orders_api.php", str_replace('http_response_code(', 'codigoDePrueba(', file_get_contents("$caja/orders_api.php")));
function codigoDePrueba($c = null) { if ($c !== null) $GLOBALS['CODIGO'] = $c; return $GLOBALS['CODIGO'] ?? 200; }
ini_set('error_log', '/dev/null'); // los error_log esperados (SHOW COLUMNS en SQLite, SMTP) no ensucian la salida
file_put_contents("$caja/db_config.php", "<?php\nfunction getDbConnection() { return \$GLOBALS['BD']; }\n");
$es = file_get_contents("$caja/email_service.php");
$firma = 'protected function sendEmail($to, $subject, $htmlContent, $template, $metadata = null, $soloDestinatario = false) {';
ok(strpos($es, $firma) !== false, 'la copia encuentra sendEmail para capturar los correos');
$es = str_replace($firma, $firma . "\n        \$GLOBALS['CORREOS'][] = ['to' => \$to, 'subject' => \$subject, 'html' => \$htmlContent, 'template' => \$template];\n        return ['success' => true];", $es);
file_put_contents("$caja/email_service.php", $es);
register_shutdown_function(function () use ($caja) { array_map('unlink', glob("$caja/*")); @rmdir($caja); });

$BD = new PDO('sqlite::memory:');
$BD->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$BD->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$BD->sqliteCreateFunction('NOW', function () { return date('Y-m-d H:i:s'); }, 0);
$BD->exec("CREATE TABLE orders (id INTEGER PRIMARY KEY, order_number TEXT, customer_email TEXT, customer_name TEXT,
    status TEXT, visible_to_client INTEGER DEFAULT 1, timeline_step INTEGER DEFAULT 1, vessel_id INTEGER NULL,
    chosen_link_id INTEGER NULL, chosen_at TEXT NULL, chosen_by TEXT NULL, chosen_inspection INTEGER NULL,
    chosen_note TEXT NULL, import_steps TEXT NULL)");
$BD->exec("CREATE TABLE order_links (id INTEGER PRIMARY KEY, order_id INTEGER, row_index INTEGER, url TEXT, title TEXT,
    image_url TEXT, link_status TEXT DEFAULT 'active', make TEXT, model TEXT, year INTEGER,
    value_chile_clp REAL, value_chile_negotiated_clp REAL, quote_total_clp REAL, quote_total_usd REAL, quote_payments TEXT, quote_published_at TEXT)");
$BD->exec("CREATE TABLE order_events (id INTEGER PRIMARY KEY, order_id INTEGER, event_type TEXT, meta_json TEXT, user_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
$CORREOS = [];

$_SERVER['SCRIPT_FILENAME'] = __FILE__; // orders_api.php no corre su switch
require "$caja/orders_api.php";

function sembrar() {
    $bd = $GLOBALS['BD'];
    $bd->exec('DELETE FROM orders; DELETE FROM order_links; DELETE FROM order_events;');
    $bd->exec("INSERT INTO orders (id, order_number, customer_email, customer_name, status) VALUES
        (35, 'IMP-00035', 'alberto@example.com', 'Alberto Lathrop', 'in_progress'),
        (36, 'IMP-00036', 'otra@example.com', 'Otra Persona', 'in_progress'),
        (37, 'IMP-00037', 'alberto@example.com', 'Alberto Lathrop', 'expired')");
    $bd->exec("INSERT INTO order_links (id, order_id, row_index, url, title, image_url, link_status, value_chile_negotiated_clp, quote_total_clp, quote_published_at) VALUES
        (11, 35, 1, 'https://www.facebook.com/marketplace/item/1', '2015 Chaparral 21 Sport H2O', 'https://img.example/c.jpg', 'active', 42685440, 41000000, NULL),
        (12, 35, 2, 'https://www.boattrader.com/boat/2', '2018 Cobalt R30', '', 'active', NULL, 98000000, '2026-10-10 10:00:00'),
        (15, 35, 5, 'https://www.boattrader.com/boat/5', '2020 Sea Ray SPX 210', '', 'active', NULL, 50000000, '2026-10-12 10:00:00'),
        (13, 35, 3, 'https://www.boattrader.com/boat/3', 'Vendida', '', 'sold', NULL, NULL, NULL),
        (14, 35, 4, '', '', '', 'active', NULL, NULL, NULL),
        (21, 36, 1, 'https://www.boattrader.com/boat/9', 'Ajena', '', 'active', NULL, NULL, NULL),
        (31, 37, 1, 'https://www.boattrader.com/boat/7', 'En vencido', '', 'active', NULL, NULL, NULL)");
    // Plan de pagos de las cotizaciones publicadas (7 / 63 / 30, como el cotizador).
    $bd->exec("UPDATE order_links SET quote_total_usd = 103000, quote_payments = '{\"p1_pct\":7,\"p1_clp\":6860000,\"p2_pct\":63,\"p2_clp\":61740000,\"p3_pct\":30,\"p3_clp\":29400000}' WHERE id = 12");
    $bd->exec("UPDATE order_links SET quote_payments = '{\"p1_pct\":7,\"p1_clp\":3500000,\"p2_pct\":63,\"p2_clp\":31500000,\"p3_pct\":30,\"p3_clp\":15000000}' WHERE id = 15");
    // El Chaparral tiene plan pero la cotización NO está publicada: no hay Pago 1 automático.
    $bd->exec("UPDATE order_links SET quote_payments = '{\"p1_pct\":7,\"p1_clp\":2870000}' WHERE id = 11");
    file_put_contents(impArchivoCobros(), json_encode(['requests' => []]));
    $GLOBALS['CORREOS'] = [];
}

function orden($id) {
    $st = $GLOBALS['BD']->prepare('SELECT * FROM orders WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch();
}

/** Corre una acción y devuelve [código, json]. */
function llamar($fn, ...$args) {
    $GLOBALS['CODIGO'] = 200;
    ob_start();
    $fn(...$args);
    $out = ob_get_clean();
    return [$GLOBALS['CODIGO'], json_decode($out, true)];
}

$alberto = ['email' => 'alberto@example.com', 'sub' => '77', 'role' => 'user'];
$intruso = ['email' => 'otra@example.com', 'sub' => '78', 'role' => 'user'];
$admin = ['email' => 'jp@imporlan.cl', 'sub' => '1', 'role' => 'admin'];

// ---------------------------------------------------------------------------
echo "\nReglas\n";
ok(impEtapaPorEleccion([]) === 0, 'sin elección no cambia la etapa');
ok(impEtapaPorEleccion(['chosen_link_id' => 11, 'chosen_inspection' => 1]) === 3, 'con inspección: etapa Inspección');
ok(impEtapaPorEleccion(['chosen_link_id' => 11, 'chosen_inspection' => 0]) === 4, 'sin inspección: directo a Compra');
ok(impEtapaPorEleccion(['chosen_link_id' => 11, 'chosen_inspection' => 1, 'import_steps' => '{"inspeccion":"2026-10-21 10:00:00"}']) === 4, 'inspección aprobada: Compra');
ok(impEtapaPorEleccion(['chosen_link_id' => 11, 'chosen_inspection' => 1, 'import_steps' => '{"transporte":"2026-10-21 10:00:00"}']) === 5, 'en camino: Logística');
ok(impPasos(['import_steps' => '{"compra":"x","inventado":"y"}']) === ['compra' => 'x'], 'un hito desconocido no cuenta');
ok(impClientePuedeCambiar(['chosen_link_id' => 11]) === true, 'sin hitos el cliente puede cambiar');
ok(impClientePuedeCambiar(['chosen_link_id' => 11, 'import_steps' => '{"disponibilidad":"x"}']) === false, 'con un hito ya no');
ok(timelineStepDesdeDatos(['chosen_link_id' => 11, 'chosen_inspection' => 0, 'status' => 'in_progress'], true, 0) === 4, 'timelineStepDesdeDatos usa la elección');
ok(timelineStepDesdeDatos(['chosen_link_id' => 11, 'chosen_inspection' => 1, 'timeline_step' => 5, 'status' => 'in_progress'], true, 0) === 5, 'el ajuste manual mayor sigue mandando');
$o = ['id' => 35, 'status' => 'in_progress'];
ok(impValidarEleccionCliente($o, ['order_id' => 35, 'url' => 'x', 'link_status' => 'active']) === null, 'una lancha disponible se puede elegir');
ok(impValidarEleccionCliente($o, ['order_id' => 36, 'url' => 'x'])[0] === 404, 'una lancha de otro expediente no');
ok(impValidarEleccionCliente($o, ['order_id' => 35, 'url' => 'x', 'link_status' => 'sold'])[0] === 409, 'una vendida no');
ok(impValidarEleccionCliente($o, ['order_id' => 35, 'url' => ''])[0] === 400, 'una fila sin anuncio no');
ok(impValidarEleccionCliente(['id' => 35, 'status' => 'expired'], ['order_id' => 35, 'url' => 'x'])[0] === 409, 'en un expediente vencido no');

// ---------------------------------------------------------------------------
echo "\nEl cliente elige\n";
sembrar();
[$c, $r] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 11, 'inspection' => true, 'note' => 'Prefiero que la inspeccionen', 'user_email' => 'otra@example.com']);
ok($c === 200 && !empty($r['success']), 'elige el Chaparral');
$o = orden(35);
ok(intval($o['chosen_link_id']) === 11 && $o['chosen_by'] === 'cliente' && intval($o['chosen_inspection']) === 1, 'queda guardada con inspección y por el cliente');
ok($r['eleccion']['link_id'] === 11 && $r['eleccion']['client_can_change'] === true, 'la respuesta trae la elección');
ok(intval(orden(36)['chosen_link_id'] ?? 0) === 0, 'el user_email del cuerpo no se usa (el expediente ajeno no se toca)');
$aEquipo = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'contacto@imporlan.cl'; }));
$aCliente = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'alberto@example.com'; }));
ok(count($aEquipo) === 1 && strpos($aEquipo[0]['subject'], 'Alberto Lathrop eligió 2015 Chaparral 21 Sport H2O') !== false, 'aviso al equipo: ' . ($aEquipo[0]['subject'] ?? '—'));
ok(strpos($aEquipo[0]['html'] ?? '', 'Prefiero que la inspeccionen') !== false, 'el aviso al equipo trae la nota del cliente');
ok(strpos($aEquipo[0]['html'] ?? '', '#/orders?id=35') !== false, 'y el link al expediente en el admin');
ok(count($aCliente) === 1 && strpos($aCliente[0]['subject'], 'Elegiste tu lancha') !== false, 'confirmación al cliente');
ok(strpos($aCliente[0]['html'] ?? '', '$42.685.440') !== false, 'con el negociado (la cotización sin publicar no se filtra)');
ok(strpos($aCliente[0]['html'] ?? '', '41.000.000') === false, 'la cotización no publicada no aparece en el correo');
ok(strpos($aCliente[0]['html'] ?? '', 'inspección técnica') !== false, 'los pasos incluyen la inspección');

echo "\nNadie elige en un expediente ajeno ni algo que no se puede\n";
sembrar();
[$c] = llamar('userChooseLink', $intruso, ['order_id' => 35, 'link_id' => 11]);
ok($c === 403 && intval(orden(35)['chosen_link_id'] ?? 0) === 0, 'otro cliente: 403 y nada cambia');
[$c] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 21]);
ok($c === 404, 'una lancha de otro expediente: 404');
[$c] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 13]);
ok($c === 409, 'una vendida: 409');
[$c] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 14]);
ok($c === 400, 'una fila sin anuncio: 400');
[$c] = llamar('userChooseLink', $alberto, ['order_id' => 37, 'link_id' => 31]);
ok($c === 409, 'en su expediente vencido: 409');
ok($CORREOS === [], 'ningún intento fallido manda correos');

echo "\nCambiar y deshacer, hasta que el equipo marque un hito\n";
sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 11, 'inspection' => false]);
$CORREOS = [];
[$c] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => false]);
ok($c === 200 && intval(orden(35)['chosen_link_id']) === 12, 'cambia al Cobalt');
ok(strpos($CORREOS[0]['html'] ?? '', 'Antes había elegido') !== false && strpos($CORREOS[0]['html'], 'Chaparral') !== false, 'el equipo ve cuál tenía antes');
ok(strpos(($CORREOS[1]['html'] ?? ''), '$98.000.000') !== false, 'con la cotización publicada, el correo al cliente usa su total');
[$c] = llamar('userUnchooseLink', $intruso, ['order_id' => 35]);
ok($c === 403 && intval(orden(35)['chosen_link_id']) === 12, 'otro cliente no la deshace');
[$c, $r] = llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'disponibilidad', 'done' => true]);
ok($c === 200 && isset($r['eleccion']['steps']['disponibilidad']), 'el equipo marca disponibilidad');
[$c] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 11]);
ok($c === 409 && intval(orden(35)['chosen_link_id']) === 12, 'con un hito el cliente ya no cambia de lancha');
[$c] = llamar('userUnchooseLink', $alberto, ['order_id' => 35]);
ok($c === 409, 'ni la deshace');
llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'disponibilidad', 'done' => false]);
[$c] = llamar('userUnchooseLink', $alberto, ['order_id' => 35]);
ok($c === 200 && orden(35)['chosen_link_id'] === null, 'sin hitos la deshace');

echo "\nEl equipo marca la elección y los hitos\n";
sembrar();
[$c, $r] = llamar('adminChooseLink', $admin, ['order_id' => 35, 'link_id' => 11, 'inspection' => false, 'notify_client' => false]);
ok($c === 200 && orden(35)['chosen_by'] === 'equipo', 'marca el Chaparral por el cliente');
ok($CORREOS === [], 'sin «avisar al cliente» no sale ningún correo');
[$c] = llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'inspeccion', 'done' => true]);
ok($c === 409, 'no se marca inspección si eligió sin inspección');
[$c, $r] = llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'compra', 'done' => true, 'notify_client' => true]);
ok($c === 200 && !empty($r['notified']), 'compra cerrada, con aviso');
ok(count($CORREOS) === 1 && strpos($CORREOS[0]['subject'], 'Compra cerrada en Estados Unidos') !== false, 'correo de hito: ' . ($CORREOS[0]['subject'] ?? '—'));
ok(strpos($CORREOS[0]['html'], 'Inspección técnica aprobada') === false, 'la lista de avance omite la inspección que no pidió');
$CORREOS = [];
llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'compra', 'done' => true, 'notify_client' => true]);
ok($CORREOS === [], 'marcar dos veces el mismo hito no repite el correo');
llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'transporte', 'done' => true]);
ok(timelineStepDesdeDatos(orden(35), true, 0) === 5, 'en camino: etapa 5');
ok(array_keys(json_decode(orden(35)['import_steps'], true)) === ['compra', 'transporte'], 'los hitos se guardan en orden');
[$c] = llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'hackear', 'done' => true]);
ok($c === 400, 'un hito inventado: 400');
[$c] = llamar('adminChooseLink', $admin, ['order_id' => 35, 'link_id' => 12, 'inspection' => true, 'notify_client' => true]);
ok($c === 200 && orden(35)['import_steps'] === null, 'cambiar de lancha borra los hitos de la otra');
ok(count(array_filter($CORREOS, function ($m) { return strpos($m['subject'], 'Confirmamos tu lancha') !== false; })) === 1, 'y con aviso, el cliente recibe «Confirmamos tu lancha»');
[$c] = llamar('adminChooseLink', $admin, ['order_id' => 35, 'link_id' => 0]);
ok($c === 200 && orden(35)['chosen_link_id'] === null, 'el equipo puede quitar la elección');
$ev = $BD->query("SELECT event_type FROM order_events WHERE order_id = 35 ORDER BY id")->fetchAll(PDO::FETCH_COLUMN);
ok(in_array('lancha_elegida', $ev, true) && in_array('hito_importacion', $ev, true) && in_array('eleccion_deshecha', $ev, true), 'todo queda en el historial del expediente');

// ---------------------------------------------------------------------------
echo "\nPago 1 (7%) al elegir: la inspección no se cobra aparte\n";
function cobros() { return json_decode(file_get_contents(impArchivoCobros()), true)['requests']; }
function vigentes() { return array_values(array_filter(cobros(), function ($r) { return $r['status'] !== 'cancelled'; })); }
sembrar();
[$c, $r] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
$v = vigentes();
ok($c === 200 && count($v) === 1, 'elegir con cotización publicada crea un cobro');
ok(($v[0]['amount_clp'] ?? 0) === 6860000 && strpos($v[0]['title'], 'Pago 1 · 2018 Cobalt R30 (7%)') === 0, 'es el Pago 1 por el 7% de la cotización: ' . ($v[0]['title'] ?? '—'));
ok(($v[0]['metadata']['order_id'] ?? 0) === 35 && ($v[0]['metadata']['custom_fields']['pago'] ?? 0) === 1 && ($v[0]['user_email'] ?? '') === 'alberto@example.com', 'ligado al expediente y al cliente');
ok(($v[0]['amount_usd'] ?? 0) == 7210, 'con su referencia en dólares (7% del total USD)');
ok(($r['pago1']['id'] ?? '') === $v[0]['id'] && ($r['pago1']['amount_clp'] ?? 0) === 6860000, 'la respuesta trae el Pago 1 para el botón «Pagar»');
$cli = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'alberto@example.com'; }));
ok(strpos($cli[0]['html'] ?? '', 'Pagar el Pago 1') !== false && strpos($cli[0]['html'], '#/payments?pagar=' . $v[0]['id']) !== false, 'el correo al cliente lleva el botón para pagar ese cobro');
ok(strpos($cli[0]['html'], 'USD 850') === false && strpos($cli[0]['html'], 'incluida en la operación') !== false, 'y dice que la inspección va incluida, sin precio aparte');
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => false]);
ok(count(vigentes()) === 1, 'volver a confirmar la misma lancha no duplica el cobro');
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 15]);
$v = vigentes();
ok(count($v) === 1 && $v[0]['amount_clp'] === 3500000, 'cambiar de lancha anula el Pago 1 pendiente y crea el de la nueva');
ok(count(array_filter(cobros(), function ($r) { return $r['status'] === 'cancelled' && $r['cancelled_reason'] === 'Cambió de lancha'; })) === 1, 'el anterior queda anulado con motivo');
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 11]);
ok(vigentes() === [], 'una lancha sin cotización publicada no genera cobro (y anula el pendiente de la otra)');
$cli = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'alberto@example.com'; }));
ok(strpos(end($cli)['html'], 'apenas esté lista tu cotización final') !== false, 'y el correo dice que el Pago 1 llega con la cotización');
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12]);
llamar('userUnchooseLink', $alberto, ['order_id' => 35]);
ok(vigentes() === [], 'deshacer la elección anula el Pago 1 pendiente');
// Pagado: ya no se cambia ni se deshace.
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12]);
$data = json_decode(file_get_contents(impArchivoCobros()), true);
foreach ($data['requests'] as &$q) { if ($q['status'] === 'pending') $q['status'] = 'paid'; }
unset($q);
file_put_contents(impArchivoCobros(), json_encode($data));
[$c] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 15]);
ok($c === 409 && intval(orden(35)['chosen_link_id']) === 12, 'con el Pago 1 pagado el cliente no cambia de lancha');
[$c] = llamar('userUnchooseLink', $alberto, ['order_id' => 35]);
ok($c === 409, 'ni deshace la elección');
ok(impEleccionParaPanel(orden(35))['client_can_change'] === false, 'y el panel lo sabe (client_can_change = false)');
echo "\nEl equipo marca la elección: también pide el Pago 1\n";
sembrar();
[$c, $r] = llamar('adminChooseLink', $admin, ['order_id' => 35, 'link_id' => 12, 'inspection' => true, 'notify_client' => false]);
ok($c === 200 && count(vigentes()) === 1 && ($r['pago1']['amount_clp'] ?? 0) === 6860000, 'marcar la elección crea el Pago 1');
ok($CORREOS === [], 'sin «avisar al cliente», sin correos');
sembrar();
llamar('adminChooseLink', $admin, ['order_id' => 35, 'link_id' => 12, 'inspection' => true, 'request_pago1' => false]);
ok(vigentes() === [], 'con request_pago1 = false no se crea');
llamar('adminChooseLink', $admin, ['order_id' => 35, 'link_id' => 12, 'request_pago1' => true]);
llamar('adminChooseLink', $admin, ['order_id' => 35, 'link_id' => 0]);
ok(vigentes() === [], 'quitar la elección anula el Pago 1 pendiente');

echo "\nLas rutas exigen sesión y no leen el correo del cuerpo\n";
$api = file_get_contents("$raiz/api/orders_api.php");
ok(preg_match("/case 'user_choose_link':\s*userChooseLink\(requireUserAuthShared\(\)\);/", $api) === 1, 'user_choose_link exige sesión de cliente');
ok(preg_match("/case 'user_unchoose_link':\s*userUnchooseLink\(requireUserAuthShared\(\)\);/", $api) === 1, 'user_unchoose_link exige sesión de cliente');
ok(preg_match("/case 'admin_choose_link':\s*adminChooseLink\(requireAdminAuth\(\)\);/", $api) === 1, 'admin_choose_link exige sesión del equipo');
ok(preg_match("/case 'admin_set_import_step':\s*adminSetImportStep\(requireAdminAuth\(\)\);/", $api) === 1, 'admin_set_import_step exige sesión del equipo');
$i = strpos($api, 'function userChooseLink');
$f = strpos($api, 'function adminChooseLink');
ok($i !== false && $f !== false && strpos(substr($api, $i, $f - $i), "user_email") === false, 'las rutas del cliente no leen user_email');

echo "\nCanario: la prueba de ajeno detecta un filtro roto\n";
sembrar();
$roto = function ($sesion, $input) {
    // Lo que pasaría si se buscara el expediente sin el correo del token.
    $st = $GLOBALS['BD']->prepare('UPDATE orders SET chosen_link_id = ? WHERE id = ?');
    $st->execute([$input['link_id'], $input['order_id']]);
};
$roto($intruso, ['order_id' => 35, 'link_id' => 11]);
ok(intval(orden(35)['chosen_link_id']) === 11, 'sin el filtro por correo, el expediente ajeno sí cambia (la prueba lo vería)');

echo "\n" . ($total - $fallos) . "/$total ok\n";
exit($fallos ? 1 : 0);
