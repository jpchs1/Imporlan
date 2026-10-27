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
foreach (['orders_api.php', 'eleccion_lancha.php', 'email_service.php', 'cotizador_helpers.php', 'scraper_locator.php', 'auth_helper.php', 'session_revocation.php', 'payment_requests_helper.php', 'operador_usa.php', 'inspection_upload_followup.php', 'inspection_upload_template.php', 'inspection_price_followup.php', 'inspection_price_template.php'] as $f) {
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
register_shutdown_function(function () use ($caja) {
    array_map('unlink', glob("$caja/expediente_files/{,.}*", GLOB_BRACE) ?: []);
    @rmdir("$caja/expediente_files");
    array_map('unlink', array_filter(glob("$caja/*"), 'is_file'));
    @rmdir($caja);
});

$BD = new PDO('sqlite::memory:');
$BD->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$BD->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$BD->sqliteCreateFunction('NOW', function () { return date('Y-m-d H:i:s'); }, 0);
$BD->exec("CREATE TABLE orders (id INTEGER PRIMARY KEY, order_number TEXT, customer_email TEXT, customer_name TEXT,
    status TEXT, visible_to_client INTEGER DEFAULT 1, timeline_step INTEGER DEFAULT 1, vessel_id INTEGER NULL,
    chosen_link_id INTEGER NULL, chosen_at TEXT NULL, chosen_by TEXT NULL, chosen_inspection INTEGER NULL,
    chosen_note TEXT NULL, import_steps TEXT NULL, usa_token TEXT NULL, usa_link_id INTEGER NULL,
    usa_requested_at TEXT NULL, usa_updated_at TEXT NULL, admin_notes TEXT NULL,
    inspection_result TEXT NULL, inspection_result_at TEXT NULL, inspection_note TEXT NULL, refund_requested_at TEXT NULL,
    inspection_decided_by TEXT NULL, inspection_client_ok_at TEXT NULL, inspection_report_file_id INTEGER NULL, inspection_report_at TEXT NULL, inspection_summary TEXT NULL,
    inspection_es TEXT NULL, inspection_es_status TEXT NULL, inspection_es_at TEXT NULL, inspection_es_error TEXT NULL, declined_link_ids TEXT NULL)");
$BD->exec("CREATE TABLE order_usa_updates (id INTEGER PRIMARY KEY, order_id INTEGER, note TEXT, file_ids TEXT, shared_text TEXT NULL, shared_at TEXT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
$BD->exec("CREATE TABLE expediente_files (id INTEGER PRIMARY KEY, order_id INTEGER, original_name TEXT, stored_name TEXT, mime_type TEXT, file_size INTEGER, category TEXT, description TEXT, uploaded_by TEXT, visible_to_client INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
$BD->exec("CREATE TABLE order_client_data (order_id INTEGER PRIMARY KEY, user_email TEXT, data TEXT, ci_front_id INTEGER, ci_back_id INTEGER, terms_version TEXT, terms_accepted_at TEXT, terms_ip TEXT, terms_ua TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)");
$BD->exec("CREATE TABLE notifications (id INTEGER PRIMARY KEY, user_email TEXT, type TEXT, title TEXT, message TEXT, link TEXT)");
$BD->exec("CREATE TABLE order_links (id INTEGER PRIMARY KEY, order_id INTEGER, row_index INTEGER, url TEXT, title TEXT,
    image_url TEXT, location TEXT, hours TEXT, engine TEXT, link_status TEXT DEFAULT 'active', make TEXT, model TEXT, year INTEGER,
    value_chile_clp REAL, value_chile_negotiated_clp REAL, quote_total_clp REAL, quote_total_usd REAL, quote_payments TEXT, quote_published_at TEXT)");
$BD->exec("CREATE TABLE order_events (id INTEGER PRIMARY KEY, order_id INTEGER, event_type TEXT, meta_json TEXT, user_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
$CORREOS = [];
$DAVID = 'ddm4me25@gmail.com';
/** Los correos que no son a David (al cliente y al equipo). */
function sinDavid() { return array_values(array_filter($GLOBALS['CORREOS'], function ($m) { return $m['to'] !== $GLOBALS['DAVID']; })); }

$_SERVER['SCRIPT_FILENAME'] = __FILE__; // orders_api.php no corre su switch
require "$caja/orders_api.php";

function sembrar() {
    $bd = $GLOBALS['BD'];
    $bd->exec('DELETE FROM orders; DELETE FROM order_links; DELETE FROM order_events; DELETE FROM order_usa_updates; DELETE FROM expediente_files; DELETE FROM notifications; DELETE FROM order_client_data;');
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
    // Alberto ya completó sus datos, su cédula y aceptó los Términos en IMP-00035 y IMP-00037.
    foreach ([35, 37] as $id) datosListos($id);
    $GLOBALS['CORREOS'] = [];
}

/** Datos válidos de Alberto (RUT 11.111.111-1 es válido por módulo 11). */
function datosAlberto() {
    return ['nombre' => 'Alberto Lathrop Vicuña', 'rut' => '11111111-1', 'fecha_nacimiento' => '1975-03-14', 'nacionalidad' => 'Chilena',
        'estado_civil' => 'Casado/a', 'profesion' => 'Ingeniero', 'telefono' => '+56 9 1234 5678', 'direccion' => 'Av. Apoquindo 1234, depto 56',
        'comuna' => 'Las Condes', 'region' => 'Metropolitana'];
}

function datosListos($orderId) {
    $GLOBALS['BD']->prepare("INSERT OR REPLACE INTO order_client_data (order_id, user_email, data, ci_front_id, ci_back_id, terms_version, terms_accepted_at) VALUES (?, 'alberto@example.com', ?, 901, 902, ?, '2026-10-21 10:00:00')")
        ->execute([$orderId, json_encode(datosAlberto()), IMP_TERMINOS_VERSION]);
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
ok(sinDavid() === [], 'sin «avisar al cliente» no sale ningún correo (al cliente ni al equipo)');
[$c] = llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'inspeccion', 'done' => true]);
ok($c === 409, 'no se marca inspección si eligió sin inspección');
[$c, $r] = llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'compra', 'done' => true, 'notify_client' => true]);
ok($c === 200 && !empty($r['notified']), 'compra cerrada, con aviso');
$h = sinDavid();
ok(count($h) === 1 && strpos($h[0]['subject'], 'Compra cerrada en Estados Unidos') !== false, 'correo de hito: ' . ($h[0]['subject'] ?? '—'));
ok(strpos($h[0]['html'] ?? '', 'Inspección técnica aprobada') === false, 'la lista de avance omite la inspección que no pidió');
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
ok(sinDavid() === [], 'sin «avisar al cliente», sin correos (salvo el pedido a David)');
sembrar();
llamar('adminChooseLink', $admin, ['order_id' => 35, 'link_id' => 12, 'inspection' => true, 'request_pago1' => false]);
ok(vigentes() === [], 'con request_pago1 = false no se crea');
llamar('adminChooseLink', $admin, ['order_id' => 35, 'link_id' => 12, 'request_pago1' => true]);
llamar('adminChooseLink', $admin, ['order_id' => 35, 'link_id' => 0]);
ok(vigentes() === [], 'quitar la elección anula el Pago 1 pendiente');

$api = file_get_contents("$raiz/api/orders_api.php");
echo "\nDavid Morris (operación en EE. UU.): pedidos, portal, y sin contacto con el cliente\n";
$DAVID = 'ddm4me25@gmail.com';
function aDavid() { return array_values(array_filter($GLOBALS['CORREOS'], function ($m) { return $m['to'] === $GLOBALS['DAVID']; })); }
function sinCliente($html) { return stripos($html, 'alberto') === false && stripos($html, 'Lathrop') === false && strpos($html, '$') === false && stripos($html, 'CLP') === false; }
sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
$d = aDavid();
ok(count($d) === 1 && strpos($d[0]['subject'], 'Update needed · IMP-00035 · 2018 Cobalt R30') !== false, 'al elegir, a David le llega el pedido: ' . ($d[0]['subject'] ?? '—'));
ok(preg_match('#operador_usa\.php\?r=portal&amp;t=([a-f0-9]{48})#', $d[0]['html'] ?? '', $m) === 1, 'con su link privado al expediente');
$token = $m[1] ?? '';
ok(sinCliente($d[0]['html'] ?? ''), 'sin nombre ni correo del cliente, y sin precios');
ok(strpos($d[0]['html'], 'confirm the boat is still available') !== false, 'le pide lo que toca: confirmar disponibilidad y precio');
$CORREOS = [];
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
ok(aDavid() === [], 'confirmar la misma lancha no le vuelve a escribir');
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 15, 'inspection' => true]);
$d = aDavid();
ok(count($d) === 2 && strpos($d[0]['subject'], 'On hold') !== false && strpos($d[0]['subject'], 'Cobalt') !== false, 'si el cliente cambia, a David se le pide pausar la anterior');
ok(strpos($d[1]['subject'], 'Sea Ray SPX 210') !== false, 'y se le pide la nueva');
$CORREOS = [];
llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'disponibilidad', 'done' => true]);
$d = aDavid();
ok(count($d) === 1 && strpos($d[0]['html'], 'coordinate the technical survey') !== false, 'al marcar disponibilidad, se le pide la inspección');
$CORREOS = [];
foreach (['inspeccion', 'compra'] as $h) llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => $h, 'done' => true]);
ok(count(aDavid()) === 2 && strpos(aDavid()[1]['html'], 'pickup') !== false, 'después la compra y el transporte');
$CORREOS = [];
llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'transporte', 'done' => true]);
ok(aDavid() === [], 'en camino a Chile: lo que sigue (aduana) es del equipo en Chile, a David no se le pide nada');

echo "\nEl portal de David\n";
$o = orden(35);
ok($token !== '' && $token === $o['usa_token'], 'el link es uno por expediente (sirve aunque cambie la lancha)');
ok(opuOrdenPorToken($BD, $o['usa_token'])['id'] == 35, 'el token abre su expediente');
ok(opuOrdenPorToken($BD, str_repeat('a', 48)) === null && opuOrdenPorToken($BD, "x' OR 1=1 --") === null, 'un token inventado no abre nada');
$pag = opuPaginaPortal($BD, $o);
ok(strpos($pag, '2020 Sea Ray SPX 210') !== false && sinCliente($pag), 'la página muestra la lancha, sin datos del cliente ni precios');
ok(strpos($pag, 'Survey approved') !== false && strpos($pag, 'name="files[]"') !== false, 'con el avance y el formulario para subir archivos');

$tmp = sys_get_temp_dir() . '/opu-' . getmypid();
@mkdir($tmp);
file_put_contents("$tmp/foto.png", base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));
file_put_contents("$tmp/bill.pdf", "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
file_put_contents("$tmp/x.php", "<?php echo 1;");
$CORREOS = [];
$res = opuGuardarActualizacion($BD, $o, "Seller confirmed. Paid 20,000 USD to the dealer, call me at 555-0100.", [
    ['name' => 'foto.png', 'tmp_name' => "$tmp/foto.png", 'size' => filesize("$tmp/foto.png"), 'error' => 0],
    ['name' => 'bill.pdf', 'tmp_name' => "$tmp/bill.pdf", 'size' => filesize("$tmp/bill.pdf"), 'error' => 0],
    ['name' => 'x.php', 'tmp_name' => "$tmp/x.php", 'size' => 13, 'error' => 0],
], 'copy');
ok($res['update_id'] > 0 && count($res['files']) === 2 && count($res['errores']) === 1, 'guarda la foto y el PDF, y rechaza el .php');
$f = $BD->query("SELECT original_name, visible_to_client, uploaded_by FROM expediente_files ORDER BY id")->fetchAll();
ok($f[0]['visible_to_client'] == 1 && $f[1]['visible_to_client'] == 0 && $f[0]['uploaded_by'] === 'operador_usa', 'la foto queda visible para el cliente; el PDF, sólo para el equipo');
$eq = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'contacto@imporlan.cl'; }));
$cl = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'alberto@example.com'; }));
ok(count($eq) === 1 && strpos($eq[0]['html'], 'Seller confirmed') !== false, 'el equipo recibe la nota de David');
ok(count($cl) === 1 && strpos($cl[0]['html'], 'Seller confirmed') === false && strpos($cl[0]['html'], '555-0100') === false && stripos($cl[0]['html'], 'David') === false, 'el cliente recibe aviso de las fotos, sin la nota ni el nombre de David');
ok(intval($BD->query("SELECT COUNT(*) FROM notifications WHERE user_email = 'alberto@example.com'")->fetchColumn()) === 1, 'y una notificación en su panel');
ok(opuNovedadesCliente($BD, 35) === [], 'la nota de David no es una novedad para el cliente hasta que el equipo la comparte');
$CORREOS = [];
ok(opuCompartir($BD, $res['update_id'], 'El vendedor confirmó que la lancha está disponible. Te dejamos el documento de compra.') === null, 'el equipo la comparte con su propio texto');
$nov = opuNovedadesCliente($BD, 35);
ok(count($nov) === 1 && strpos($nov[0]['text'], 'El vendedor confirmó') === 0 && !isset($nov[0]['note']), 'el cliente ve el texto del equipo, no la nota');
ok(intval($BD->query("SELECT visible_to_client FROM expediente_files WHERE original_name = 'bill.pdf'")->fetchColumn()) === 1, 'y el PDF de esa actualización pasa a ser visible');
ok(count($CORREOS) === 1 && $CORREOS[0]['to'] === 'alberto@example.com' && strpos($CORREOS[0]['subject'], 'Novedades de tu lancha') === 0, 'con un correo «Novedades de tu lancha»');
ok(opuCompartir($BD, 999, 'x')[0] === 404 && opuCompartir($BD, $res['update_id'], '  ')[0] === 400, 'compartir sin texto o una actualización inexistente: error');
$vacia = opuGuardarActualizacion($BD, $o, '   ', [], 'copy');
ok($vacia['update_id'] === 0 && $vacia['errores'], 'una actualización vacía no se guarda');
array_map('unlink', glob("$tmp/*")); @rmdir($tmp);
array_map('unlink', glob("$caja/expediente_files/*")); @unlink("$caja/expediente_files/.htaccess"); @rmdir("$caja/expediente_files");

echo "\nRecordatorios y Pago 1\n";
sembrar();
llamar('adminChooseLink', $admin, ['order_id' => 35, 'link_id' => 12, 'inspection' => false]);
$CORREOS = [];
ok(opuRecordar($BD) === 0, 'recién pedido: no se le recuerda');
$BD->exec("UPDATE orders SET usa_requested_at = '2020-01-01 00:00:00', chosen_at = '2020-01-01 00:00:00' WHERE id = 35");
ok(opuRecordar($BD) === 1 && strpos(aDavid()[0]['html'], 'friendly reminder') !== false, 'sin novedades en ' . OPU_DIAS_RECORDATORIO . ' días: recordatorio');
$BD->exec("UPDATE orders SET usa_requested_at = '2020-01-01 00:00:00', import_steps = '{\"disponibilidad\":\"x\",\"compra\":\"x\",\"transporte\":\"x\"}' WHERE id = 35");
ok(opuRecordar($BD) === 0, 'con el paso en curso en Chile (aduana), no');
sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12]);
$p1 = vigentes()[0];
$p1['status'] = 'paid';
$CORREOS = [];
ok(opuAlPagarCobro($p1) === true && strpos(aDavid()[0]['html'], 'first payment') !== false, 'con el Pago 1 pagado, a David se le avisa que la operación quedó confirmada');
$otro = $p1; $otro['metadata']['custom_fields']['pago'] = 2;
ok(opuAlPagarCobro($otro) === false, 'otros pagos no le escriben');

echo "\nEl rol de David (agente) no ve cómo contactar al cliente ni tiene chat\n";
$red = ocultarContactoParaAgente(['customer_email' => 'a@b.cl', 'customer_phone' => '+569', 'secondary_email' => 'c@d.cl', 'customer_name' => 'Alberto Lathrop', 'agent_phone' => '+5694', 'order_number' => 'IMP-1'], ['role' => 'agent']);
ok($red['customer_email'] === '' && $red['customer_phone'] === '' && $red['secondary_email'] === '' && $red['customer_name'] === 'Alberto', 'al agente se le borran correo y teléfono, y el nombre queda en el primero');
ok($red['agent_phone'] === '+5694' && $red['order_number'] === 'IMP-1', 'lo demás queda igual');
ok(ocultarContactoParaAgente(['customer_email' => 'a@b.cl'], ['role' => 'admin'])['customer_email'] === 'a@b.cl', 'al equipo no se le oculta nada');
ok(strpos($api, "adminGetOrderDetail(requireAdminAuth())") !== false && strpos($api, "adminListOrders(requireAdminAuth())") !== false, 'el detalle y la lista del admin reciben la sesión para ocultar');
ok(strpos($api, "array_diff(\$allowedFields, ['customer_name', 'customer_email', 'customer_phone'])") !== false, 'y el agente no puede pisar el contacto real al guardar (lo recibe vacío)');
$chat = file_get_contents("$raiz/api/chat_api.php");
ok(preg_match("/function requireAdminAuth\(\).*?in_array\(\\\$payload\['role'\], \['admin', 'support'\]\)/s", $chat) === 1, 'el chat del equipo no admite al agente');
ok(strpos(file_get_contents("$raiz/admin-react/src/admin/config.js"), "{ to: '/chat', roles: STAFF") !== false, 'y el menú no le muestra el Chat');
ok(strpos($api, "unset(\$order['usa_token']") !== false, 'el cliente no recibe el link privado de David');

echo "\nDatos del cliente, cédula y Términos antes de elegir\n";
ok(impRutValido('11.111.111-1') && impRutValido('76914409-9') && !impRutValido('11.111.111-2') && !impRutValido('12-3'), 'el RUT se valida con módulo 11');
ok(impRutFormato('769144099') === '76.914.409-9', 'y se guarda con formato');
[$d, $e] = impValidarDatos(datosAlberto());
ok($e === [] && $d['rut'] === '11.111.111-1', 'datos completos y válidos pasan');
[, $e] = impValidarDatos(['nombre' => 'X'] + array_fill_keys(['rut', 'fecha_nacimiento'], ''));
ok(isset($e['rut'], $e['comuna'], $e['estado_civil']), 'cada campo que falta se informa');
[, $e] = impValidarDatos(['fecha_nacimiento' => date('Y-m-d', strtotime('-10 years'))] + datosAlberto());
ok(isset($e['fecha_nacimiento']), 'un menor de edad no puede');
sembrar();
$BD->exec("DELETE FROM order_client_data WHERE order_id = 35");
[$c, $r] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12]);
ok($c === 409 && ($r['code'] ?? '') === 'faltan_datos' && orden(35)['chosen_link_id'] === null, 'sin datos, cédula ni Términos no se puede elegir (409 faltan_datos)');
ok(vigentes() === [] && $CORREOS === [], 'y no se crea el Pago 1 ni sale ningún correo');
$tmp = sys_get_temp_dir() . '/ci-' . getmypid();
@mkdir($tmp);
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
foreach (['f1', 'r1', 'f2'] as $n) file_put_contents("$tmp/$n.png", $png);
file_put_contents("$tmp/malo.txt", "hola");
$o = orden(35);
$archivo = function ($n) use ($tmp) { return ['name' => "$n", 'tmp_name' => "$tmp/$n", 'size' => filesize("$tmp/$n"), 'error' => 0]; };
[$ok, $err] = impGuardarDatosCliente($BD, $o, 'alberto@example.com', datosAlberto(), ['frente' => $archivo('f1.png'), 'reverso' => $archivo('r1.png')], '1.2.3.4', 'Test', 'copy');
ok(!$ok && isset($err['terminos']), 'sin aceptar los Términos no se guarda');
[$ok, $err] = impGuardarDatosCliente($BD, $o, 'alberto@example.com', datosAlberto() + ['acepta_terminos' => 1], ['frente' => $archivo('f1.png')], '1.2.3.4', 'Test', 'copy');
ok(!$ok && isset($err['ci_reverso']), 'falta el reverso: no se guarda');
[$ok, $err] = impGuardarDatosCliente($BD, $o, 'alberto@example.com', datosAlberto() + ['acepta_terminos' => 1], ['frente' => $archivo('f1.png'), 'reverso' => $archivo('malo.txt')], '1.2.3.4', 'Test', 'copy');
ok(!$ok && isset($err['ci_reverso']), 'un archivo que no es foto ni PDF se rechaza');
[$ok, $err] = impGuardarDatosCliente($BD, $o, 'alberto@example.com', datosAlberto() + ['acepta_terminos' => 1, 'terminos_version' => IMP_TERMINOS_VERSION], ['frente' => $archivo('f2.png'), 'reverso' => $archivo('r1.png')], '1.2.3.4', 'Mozilla/5.0', 'copy');
$fila = impFilaDatos($BD, 35);
ok($ok && impDatosCompletos($fila), 'con todo, queda completo: ' . json_encode($err));
ok($fila['terms_version'] === IMP_TERMINOS_VERSION && $fila['terms_ip'] === '1.2.3.4' && $fila['terms_accepted_at'], 'se guarda qué versión de los Términos aceptó, cuándo y desde qué IP');
$ci = $BD->query("SELECT uploaded_by, visible_to_client, description FROM expediente_files WHERE uploaded_by = 'cliente_identidad' ORDER BY id")->fetchAll();
ok(count($ci) === 2 && $ci[0]['visible_to_client'] == 0 && strpos($ci[0]['description'], 'Cédula') === 0, 'la cédula queda como archivo interno (no se mezcla con las fotos de la lancha)');
[$c] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12]);
ok($c === 200 && intval(orden(35)['chosen_link_id']) === 12, 'ahora sí elige');
$BD->exec("UPDATE order_client_data SET terms_version = '2020-01-01' WHERE order_id = 35");
ok(!impDatosCompletos(impFilaDatos($BD, 35)), 'si cambia la versión de los Términos, hay que aceptarlos de nuevo');
// Otro expediente: se reusan datos y cédula, con aceptación nueva.
$BD->exec("INSERT INTO orders (id, order_number, customer_email, customer_name, status) VALUES (38, 'IMP-00038', 'alberto@example.com', 'Alberto Lathrop', 'in_progress')");
$BD->exec("UPDATE order_client_data SET terms_version = '" . IMP_TERMINOS_VERSION . "' WHERE order_id = 35");
$pub = impDatosPublicos($BD, null, impFilaDatosAnterior($BD, 'alberto@example.com', 38));
ok($pub['de_otro_expediente'] && $pub['datos']['comuna'] === 'Las Condes' && $pub['ci_frente'] && !$pub['completo'], 'en otro expediente se precargan los datos y la cédula anteriores, sin darlo por completo');
ok(!isset($pub['ci_frente_url']), 'el cliente no recibe enlaces de descarga de la cédula');
[$ok] = impGuardarDatosCliente($BD, orden(38), 'alberto@example.com', datosAlberto() + ['acepta_terminos' => 1, 'reusar_cedula' => 1], [], '5.6.7.8', 'Test', 'copy');
ok($ok && impDatosCompletos(impFilaDatos($BD, 38)), 'reusando la cédula anterior basta con confirmar datos y Términos');
$adm = impDatosPublicos($BD, impFilaDatos($BD, 35), null, true);
ok(strpos($adm['ci_frente_url'] ?? '', '/api/expediente_files_api.php?action=download&id=') === 0 && $adm['terminos_ip'] === '1.2.3.4', 'el equipo recibe enlaces firmados a la cédula y el IP de la aceptación');
array_map('unlink', glob("$tmp/*")); @rmdir($tmp);
array_map('unlink', glob("$caja/expediente_files/*")); @unlink("$caja/expediente_files/.htaccess"); @rmdir("$caja/expediente_files");
ok(preg_match("/case 'admin_import_data':\s*\/\/[^\n]*\n\s*adminImportData\(requireAdminAuthShared\(\['admin', 'support'\]\)\);/", $api) === 1, 'los datos y la cédula del cliente no los ve el agente (sólo admin y support)');
ok(preg_match("/case 'user_import_data':\s*userImportData\(requireUserAuthShared\(\)\);/", $api) === 1, 'el cliente sólo con su sesión');
ok(strpos(file_get_contents("$raiz/api/expediente_files_api.php"), "uploaded_by <> 'cliente_identidad'") !== false, 'y la lista de archivos del agente no incluye la cédula');
sembrar();
$BD->exec("DELETE FROM order_client_data WHERE order_id = 35");
llamar('adminChooseLink', $admin, ['order_id' => 35, 'link_id' => 12, 'notify_client' => true]);
$cli = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'alberto@example.com' && strpos($m['subject'], 'Confirmamos tu lancha') === 0; }));
ok(count($cli) === 1 && strpos($cli[0]['html'], 'subes tu cédula por ambos lados') !== false, 'si el equipo marca la elección y faltan datos, el correo se los pide');

echo "\nPago 2 y Pago 3 por hito (JP: inspección aprobada / lancha en el puerto de EE. UU.)\n";
sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
$CORREOS = [];
[$c, $r] = llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'disponibilidad', 'done' => true, 'notify_client' => true]);
ok(($r['pago'] ?? null) === null && count(vigentes()) === 1, 'con inspección pedida, la disponibilidad no gatilla pagos');
[$c, $r] = llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'inspeccion', 'done' => true, 'notify_client' => true]);
$v = vigentes();
$p2 = array_values(array_filter($v, function ($q) { return ($q['metadata']['custom_fields']['pago'] ?? 0) === 2; }));
ok(count($p2) === 1 && $p2[0]['amount_clp'] === 61740000 && strpos($p2[0]['title'], 'Pago 2 · 2018 Cobalt R30 (63%)') === 0, 'inspección aprobada: se crea el Pago 2 por el 63%');
ok(($r['pago']['n'] ?? 0) === 2 && !empty($r['pago']['creado']), 'y la respuesta lo informa al admin');
$hito = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'alberto@example.com' && strpos($m['subject'], 'Inspección técnica aprobada') === 0; }));
ok(count($hito) === 1 && strpos($hito[0]['html'], 'Pagar el Pago 2') !== false && strpos($hito[0]['html'], '#/payments?pagar=' . $p2[0]['id']) !== false, 'el aviso del hito al cliente trae el botón para pagar el Pago 2');
llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'inspeccion', 'done' => false]);
llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'inspeccion', 'done' => true]);
ok(count(array_filter(vigentes(), function ($q) { return ($q['metadata']['custom_fields']['pago'] ?? 0) === 2; })) === 1, 'desmarcar y volver a marcar no duplica el Pago 2');
llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'compra', 'done' => true]);
ok(count(vigentes()) === 2, 'la compra cerrada no gatilla pagos');
[$c, $r] = llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'transporte', 'done' => true, 'notify_client' => false]);
$p3 = array_values(array_filter(vigentes(), function ($q) { return ($q['metadata']['custom_fields']['pago'] ?? 0) === 3; }));
ok(count($p3) === 1 && $p3[0]['amount_clp'] === 29400000 && ($r['pago']['n'] ?? 0) === 3, 'lancha entregada en el puerto de EE. UU. (en camino): se crea el Pago 3 por el 30%');
sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => false]);
[$c, $r] = llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'disponibilidad', 'done' => true]);
ok(($r['pago']['n'] ?? 0) === 2, 'sin inspección, el Pago 2 sale al confirmar disponibilidad y precio');
ok(impPagoPorHito(['chosen_inspection' => 1], 'disponibilidad') === 0 && impPagoPorHito([], 'aduana') === 0 && impPagoPorHito([], 'entrega') === 0, 'aduana y entrega no gatillan pagos');
sembrar();
llamar('adminChooseLink', $admin, ['order_id' => 35, 'link_id' => 11, 'inspection' => true]);
[$c, $r] = llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'inspeccion', 'done' => true]);
ok($c === 200 && ($r['pago'] ?? null) === null, 'sin cotización publicada no hay monto: no se crea el Pago 2 (lo crea el equipo a mano)');

echo "\nInspección no apta: otra lancha (Pago 1 abonado) o devolución\n";
function pagarPago1() {
    $data = json_decode(file_get_contents(impArchivoCobros()), true);
    foreach ($data['requests'] as &$q) { if ($q['status'] === 'pending' && ($q['metadata']['custom_fields']['pago'] ?? 0) === 1) $q['status'] = 'paid'; }
    unset($q);
    file_put_contents(impArchivoCobros(), json_encode($data));
}
sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
pagarPago1();
llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'disponibilidad', 'done' => true]);
ok(impEleccionParaPanel(orden(35))['client_can_change'] === false, 'antes: con Pago 1 pagado y un hito, no puede cambiar');
$CORREOS = [];
[$c, $r] = llamar('adminInspeccionResultado', $admin, ['order_id' => 35, 'resultado' => 'no_apta', 'nota' => 'Humedad en el casco y motor con baja compresión.', 'notify_client' => true]);
ok($c === 200 && ($r['eleccion']['inspection_result'] ?? '') === 'no_apta' && $r['eleccion']['inspection_note'] === 'Humedad en el casco y motor con baja compresión.', 'el equipo marca la inspección como no apta, con su nota');
ok($r['eleccion']['client_can_change'] === true, 'y el cliente puede volver a elegir aunque haya pagado el Pago 1');
$cli = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'alberto@example.com'; }));
ok(count($cli) === 1 && strpos($cli[0]['subject'], 'No seguimos con') === 0 && strpos($cli[0]['html'], 'te ahorraste un problema') !== false && strpos($cli[0]['html'], 'se abona a la nueva') !== false, 'al cliente le llega el resultado con calma y sus dos opciones');
ok(count(aDavid()) === 1 && strpos(aDavid()[0]['subject'], 'On hold') !== false, 'a David se le pide pausar esa lancha');
ok(timelineStepDesdeDatos(orden(35), true, 0) === 3, 'la etapa queda en Inspección');
[$c] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 15, 'inspection' => true]);
$o = orden(35);
ok($c === 200 && intval($o['chosen_link_id']) === 15 && $o['inspection_result'] === null && $o['import_steps'] === null, 'elige otra lancha: empieza de cero');
ok(count(vigentes()) === 1 && vigentes()[0]['status'] === 'paid', 'y su Pago 1 pagado se abona: no se le cobra otro');
sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
pagarPago1();
[$c] = llamar('userPedirDevolucion', $alberto, ['order_id' => 35]);
ok($c === 409, 'sin inspección no apta, la devolución no se pide por el panel');
llamar('adminInspeccionResultado', $admin, ['order_id' => 35, 'resultado' => 'no_apta', 'nota' => 'x']);
[$c] = llamar('userPedirDevolucion', $intruso, ['order_id' => 35]);
ok($c === 403, 'otro cliente no pide la devolución por él');
$CORREOS = [];
[$c, $r] = llamar('userPedirDevolucion', $alberto, ['order_id' => 35]);
ok($c === 200 && !empty(orden(35)['refund_requested_at']) && $r['pago1_pagado'] === 6860000, 'el cliente pide la devolución del Pago 1');
ok(count($CORREOS) === 1 && $CORREOS[0]['to'] === 'contacto@imporlan.cl' && strpos($CORREOS[0]['html'], '6.860.000') !== false, 'el equipo recibe el aviso con el monto pagado');
ok(impEleccionParaPanel(orden(35))['client_can_change'] === false, 'con la devolución pedida ya no elige otra');
[$c] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 15]);
ok($c === 409, 'y el servidor lo bloquea');
sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
llamar('adminInspeccionResultado', $admin, ['order_id' => 35, 'resultado' => 'no_apta']);
llamar('userPedirDevolucion', $alberto, ['order_id' => 35]);
ok(vigentes() === [], 'si el Pago 1 no estaba pagado, se anula (no hay nada que devolver)');
sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
llamar('adminInspeccionResultado', $admin, ['order_id' => 35, 'resultado' => 'no_apta']);
llamar('adminSetImportStep', $admin, ['order_id' => 35, 'step' => 'inspeccion', 'done' => true]);
ok(orden(35)['inspection_result'] === null, 'si después se aprueba (otra revisión), el «no apta» deja de valer');
[$c] = llamar('adminInspeccionResultado', $admin, ['order_id' => 35, 'resultado' => 'no_apta']);
sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => false]);
[$c] = llamar('adminInspeccionResultado', $admin, ['order_id' => 35, 'resultado' => 'no_apta']);
ok($c === 409, 'si eligió sin inspección, no hay resultado de inspección que marcar');
ok(preg_match("/case 'user_pedir_devolucion':\s*userPedirDevolucion\(requireUserAuthShared\(\)\);/", $api) === 1 && preg_match("/case 'admin_inspeccion_resultado':\s*adminInspeccionResultado\(requireAdminAuth\(\)\);/", $api) === 1, 'las rutas nuevas exigen sesión');

echo "\nReporte de inspección: el equipo lo carga, el cliente lo lee en español y decide\n";
/** Respuesta en stream de la API, como la manda Claude. */
function sseClaude($texto, $fin = 'end_turn', $previo = null) {
    $ev = [['type' => 'message_start']];
    if ($previo !== null) {
        $ev[] = ['type' => 'content_block_start', 'index' => 0, 'content_block' => ['type' => 'text', 'text' => '']];
        $ev[] = ['type' => 'content_block_delta', 'index' => 0, 'delta' => ['type' => 'text_delta', 'text' => $previo]];
        $ev[] = ['type' => 'content_block_start', 'index' => 1, 'content_block' => ['type' => 'fallback']];
    }
    foreach (str_split($texto, 40) as $trozo) $ev[] = ['type' => 'content_block_delta', 'index' => 2, 'delta' => ['type' => 'text_delta', 'text' => $trozo]];
    $ev[] = ['type' => 'message_delta', 'delta' => ['stop_reason' => $fin]];
    $out = '';
    foreach ($ev as $e) $out .= 'event: ' . $e['type'] . "\ndata: " . json_encode($e) . "\n\n";
    return $out;
}
$TRADUCCION = "# Reporte de inspección\n\n## Casco\n\nSe encontró **humedad** bajo la línea de flotación.\n\n- Gelcoat con grietas menores\n- Espejo de popa firme\n\n| Ítem | Estado |\n|---|---|\n| Motor | Bueno |\n";
$PEDIDOS_CLAUDE = [];
$GLOBALS['impClaudeHttp'] = function ($url, $h, $body, $t) {
    $GLOBALS['PEDIDOS_CLAUDE'][] = ['url' => $url, 'h' => $h, 'body' => json_decode($body, true)];
    return $GLOBALS['RESPUESTA_CLAUDE'];
};
$RESPUESTA_CLAUDE = ['code' => 200, 'body' => sseClaude($TRADUCCION)];
$pdf = sys_get_temp_dir() . '/reporte-' . getmypid() . '.pdf';
function pdfDePrueba() { file_put_contents($GLOBALS['pdf'], "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF\n"); return ['name' => 'Survey Chaparral.pdf', 'tmp_name' => $GLOBALS['pdf'], 'size' => filesize($GLOBALS['pdf']), 'error' => UPLOAD_ERR_OK]; }
function cargarReporte($entrada, $archivo = null) {
    return llamar('adminCargarReporte', $GLOBALS['admin'], $entrada, $archivo ?? pdfDePrueba(), 'copy', false);
}

sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
pagarPago1();
ok(impEleccionPublica(orden(35))['inspection_stage'] === 'coordinando', 'recién elegida con inspección: se está coordinando');
[$c] = llamar('userInspeccionDecision', $alberto, ['order_id' => 35, 'decision' => 'aprobar']);
ok($c === 409 && !isset(impPasos(orden(35))['inspeccion']), 'sin reporte, el cliente todavía no puede decidir');
[$c] = cargarReporte(['order_id' => 35], ['name' => 'x.pdf', 'tmp_name' => __FILE__, 'size' => 10, 'error' => UPLOAD_ERR_OK]);
ok($c === 400, 'el reporte tiene que ser un PDF (se mira el contenido, no el nombre)');
$CORREOS = [];
[$c, $r] = cargarReporte(['order_id' => 35, 'resumen' => 'El casco tiene humedad localizada; el resto en buen estado.', 'notify_client' => '1']);
$o = orden(35);
ok($c === 200 && $r['eleccion']['inspection_stage'] === 'reporte_listo', 'el equipo carga el reporte: ahora decide el cliente');
$f = $BD->query("SELECT * FROM expediente_files WHERE id = " . intval($o['inspection_report_file_id']))->fetch();
ok($f && intval($f['visible_to_client']) === 1 && $f['uploaded_by'] === 'inspeccion_reporte' && is_file($caja . '/expediente_files/' . $f['stored_name']), 'el PDF queda en el expediente, visible para el cliente');
ok($o['inspection_es_status'] === 'listo' && $o['inspection_es'] === trim($TRADUCCION), 'y se traduce al español');
$p = $PEDIDOS_CLAUDE[0]['body'] ?? [];
ok(($p['model'] ?? '') === 'claude-opus-5-5' && !empty($p['stream']) && ($p['messages'][0]['content'][0]['source']['media_type'] ?? '') === 'application/pdf' && strpos($p['system'] ?? '', 'No resumas') !== false, 'la traducción manda el PDF a Claude y pide traducción completa, sin resumir');
$cli = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'alberto@example.com'; }));
ok(count($cli) === 1 && $cli[0]['template'] === 'inspeccion_reporte' && strpos($cli[0]['html'], 'traducción completa al español') !== false && strpos($cli[0]['html'], 'humedad localizada') !== false && strpos($cli[0]['html'], 'Tú decides') !== false, 'al cliente le llega el aviso: reporte en inglés y en español, y que él decide');
$_GET = ['order_id' => 35];
[$c, $r] = llamar('verReporteInspeccion', $alberto, false);
ok($c === 200 && $r['original']['original_name'] === 'Survey Chaparral.pdf' && strpos($r['original']['download_url'], 'action=download') !== false, 'el cliente ve el original en inglés (enlace firmado)');
$tipos = array_column($r['es']['bloques'], 't');
ok($r['es']['status'] === 'listo' && $tipos === ['h', 'h', 'p', 'ul', 'table'] && $r['es']['bloques'][3]['items'][0] === 'Gelcoat con grietas menores' && $r['es']['bloques'][4]['rows'][1] === ['Motor', 'Bueno'], 'y la traducción en bloques: títulos, párrafos, listas y tablas');
ok($r['es']['error'] === null && !isset($r['reporte']['inspection_es']), 'sin errores internos ni el texto crudo');
[$c] = llamar('verReporteInspeccion', $intruso, false);
ok($c === 403, 'otro cliente no ve el reporte');
$_GET = [];
[$c] = llamar('userInspeccionDecision', $intruso, ['order_id' => 35, 'decision' => 'aprobar']);
ok($c === 403, 'otro cliente no decide por él');
$CORREOS = [];
[$c, $r] = llamar('userInspeccionDecision', $alberto, ['order_id' => 35, 'decision' => 'aprobar']);
$o = orden(35);
ok($c === 200 && isset(impPasos($o)['inspeccion']) && $o['inspection_decided_by'] === 'cliente' && $r['eleccion']['inspection_stage'] === 'aprobada', 'el cliente aprueba: queda «Inspección técnica aprobada», por él');
ok(($r['pago']['n'] ?? 0) === 2 && $r['pago']['amount_clp'] === 61740000, 'y se crea el Pago 2');
$eq = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'contacto@imporlan.cl'; }));
ok(count($eq) === 1 && strpos($eq[0]['subject'], 'aprobó la inspección') !== false && strpos($eq[0]['html'], '61.740.000') !== false, 'el equipo recibe el aviso con el Pago 2');
ok(count(array_filter($CORREOS, function ($m) { return $m['to'] === 'alberto@example.com' && strpos($m['html'], 'Pago 2') !== false; })) === 1, 'y al cliente le llega el Pago 2 para pagar');
[$c] = llamar('userInspeccionDecision', $alberto, ['order_id' => 35, 'decision' => 'declinar']);
ok($c === 409, 'ya decidió: no cambia la decisión desde el panel');
[$c] = cargarReporte(['order_id' => 35]);
ok($c === 409, 'con la decisión tomada, el equipo no cambia el reporte');

sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
pagarPago1();
cargarReporte(['order_id' => 35, 'notify_client' => '0']);
$CORREOS = [];
[$c, $r] = llamar('userInspeccionDecision', $alberto, ['order_id' => 35, 'decision' => 'declinar', 'motivo' => 'Prefiero no arriesgarme con la humedad.']);
$o = orden(35);
ok($c === 200 && $r['eleccion']['inspection_stage'] === 'declinada' && $o['inspection_decided_by'] === 'cliente' && $r['eleccion']['client_can_change'] === true, 'el cliente declina: puede elegir otra lancha aunque pagó el Pago 1');
ok(count(aDavid()) === 1 && strpos(aDavid()[0]['subject'], 'On hold') !== false, 'a David se le pide pausar esa lancha');
$eq = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'contacto@imporlan.cl'; }));
ok(count($eq) === 1 && strpos($eq[0]['html'], 'declinó') !== false && strpos($eq[0]['html'], 'no arriesgarme') !== false, 'el equipo recibe la decisión con su motivo');
ok(count(array_filter($CORREOS, function ($m) { return $m['to'] === 'alberto@example.com'; })) === 0, 'al cliente no se le manda correo: lo decidió él');
[$c] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
ok($c === 409, 'no puede volver a elegir la que declinó');
[$c] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 15, 'inspection' => true]);
$o = orden(35);
ok($c === 200 && intval($o['chosen_link_id']) === 15 && $o['inspection_report_at'] === null && $o['inspection_es'] === null && impEtapaInspeccion($o) === 'coordinando', 'elige otra: el reporte era de la anterior, la nueva parte de cero');
ok(impLanchasDeclinadas($o) === [12], 'la declinada queda recordada');
[$c] = llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
ok($c === 409, 'y sigue sin poder elegirse');
ok(count(vigentes()) === 1 && vigentes()[0]['status'] === 'paid', 'su Pago 1 pagado se abona a la nueva');

echo "\nTraducción: errores, reintento y lectura del stream\n";
sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
$RESPUESTA_CLAUDE = ['code' => 529, 'body' => json_encode(['type' => 'error', 'error' => ['type' => 'overloaded_error', 'message' => 'Overloaded']])];
$CORREOS = [];
cargarReporte(['order_id' => 35]);
$o = orden(35);
ok($o['inspection_es_status'] === 'error' && strpos($o['inspection_es_error'], '529') !== false && impEtapaInspeccion($o) === 'reporte_listo', 'si la traducción falla, el reporte igual queda y el cliente puede decidir');
$cli = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'alberto@example.com'; }));
ok(count($cli) === 1 && strpos($cli[0]['html'], 'en unos minutos') !== false, 'el aviso al cliente dice que la versión en español llega después');
$_GET = ['order_id' => 35];
[, $r] = llamar('verReporteInspeccion', $admin, true);
ok($r['es']['status'] === 'error' && strpos($r['es']['error'], '529') !== false && $r['es']['bloques'] === [], 'el equipo ve por qué falló');
[, $r] = llamar('verReporteInspeccion', $alberto, false);
ok($r['es']['error'] === null, 'el cliente no ve el error técnico');
$_GET = [];
$RESPUESTA_CLAUDE = ['code' => 200, 'body' => sseClaude($TRADUCCION)];
[$c] = llamar('adminTraducirReporte', $admin, ['order_id' => 35], false);
ok($c === 200 && orden(35)['inspection_es_status'] === 'listo', 'el equipo reintenta y queda traducido');
$BD->exec("UPDATE orders SET inspection_es_status = 'pendiente', inspection_es_at = '2026-01-01 10:00:00' WHERE id = 35");
ok(impEstadoTraduccion(orden(35)) === 'error', 'una traducción que no termina en 20 minutos se da por caída (se puede reintentar)');
$BD->exec("UPDATE orders SET inspection_es_at = NOW() WHERE id = 35");
[$c] = llamar('adminTraducirReporte', $admin, ['order_id' => 35], false);
ok($c === 409, 'mientras está en curso no se lanza otra');
[$t, $fin] = impLeerStreamClaude(sseClaude('Texto bueno', 'end_turn', 'Texto del modelo que se negó'));
ok($t === 'Texto bueno' && $fin === 'end_turn', 'si hubo cambio de modelo, vale el texto del último');
$RESPUESTA_CLAUDE = ['code' => 200, 'body' => sseClaude('# Parcial', 'max_tokens')];
$r = impTraducirReporte($caja . '/expediente_files/' . $BD->query("SELECT stored_name FROM expediente_files ORDER BY id DESC LIMIT 1")->fetchColumn());
ok($r['ok'] && strpos($r['texto'], 'El resto está en el original') !== false, 'si el reporte es muy largo, se avisa dónde termina la traducción');
$RESPUESTA_CLAUDE = ['code' => 200, 'body' => sseClaude('', 'refusal')];
ok(impTraducirReporte($pdf)['ok'] === false, 'si la IA no traduce, queda como error');
ok(impMarkdownABloques("1. Uno\n2. Dos\n\nTexto\nsigue")[1] === ['t' => 'p', 'x' => 'Texto sigue'], 'listas numeradas y párrafos de varias líneas');
ok(preg_match("/case 'user_inspeccion_decision':\s*userInspeccionDecision\(requireUserAuthShared\(\)\);/", $api) === 1
    && preg_match("/case 'user_inspeccion_reporte':\s*verReporteInspeccion\(requireUserAuthShared\(\), false\);/", $api) === 1
    && preg_match("/adminCargarReporte\(requireAdminAuthShared\(\['admin', 'support'\]\)\)/", $api) === 1
    && preg_match("/case 'admin_inspeccion_traducir':\s*adminTraducirReporte\(requireAdminAuthShared\(\['admin', 'support'\]\)\);/", $api) === 1, 'las rutas del reporte exigen sesión; cargar y traducir, sólo el equipo en Chile');
@unlink($pdf);

echo "\nA nombre de quién se importa\n";
[$d, $e] = impValidarDatos(datosAlberto());
ok($e === [] && !isset($d['titular_tipo']), 'por defecto, a nombre del cliente (sin campos extra)');
[$d, $e] = impValidarDatos(datosAlberto() + ['titular_tipo' => 'otro', 'titular_nombre' => 'Inversiones Lathrop SpA', 'titular_rut' => '76914409-9']);
ok($e === [] && $d['titular_nombre'] === 'Inversiones Lathrop SpA' && $d['titular_rut'] === '76.914.409-9', 'a nombre de una empresa: razón social y RUT');
[, $e] = impValidarDatos(datosAlberto() + ['titular_tipo' => 'otro', 'titular_rut' => '76914409-8']);
ok(isset($e['titular_nombre'], $e['titular_rut']), 'si indica otro titular, nombre y RUT válido son obligatorios');

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

echo "\nPrecio de compra tras inspección: puerta antes de aprobar/cerrar\n";
sembrar();
$BD->exec("UPDATE orders SET chosen_link_id=12, chosen_inspection=1, import_steps='{\"disponibilidad\":\"2026-10-25\"}' WHERE id=35");
$priceRequest = opuInspectionRequest($BD, orden(35));
foreach (['inspeccion', 'compra'] as $step) {
    [$code, $data] = llamar('adminSetImportStep', $admin, ['order_id'=>35,'step'=>$step,'done'=>true]);
    ok($code === 409 && empty(impPasos(orden(35))[$step]), 'precio pendiente impide marcar ' . $step);
}
ok(json_decode(file_get_contents(impArchivoCobros()),true)['requests'] === [], 'puerta de precio pendiente no crea ningún cobro');
$price = opuPriceState($BD,orden(35));
$input = ['price_request_id'=>$price['request_id'],'price_revision'=>(string)$price['revision'],'price_status'=>'unchanged','price_original'=>'25000','price_confirmed'=>'25000'];
ok(opuPriceSave($BD,orden(35),$input) === [], 'coordinador confirma precio sin tocar la cotización');
[$code] = llamar('adminSetImportStep', $admin, ['order_id'=>35,'step'=>'inspeccion','done'=>true]);
ok($code === 409, 'respuesta confirmada requiere revisión del equipo antes de aprobar');
$price = opuPriceState($BD,orden(35));
ok(opuPriceReview($BD,orden(35),$price['request_id'],$price['revision'],$admin['email']) === null, 'equipo revisa la respuesta vigente');
[$code,$data] = llamar('adminSetImportStep', $admin, ['order_id'=>35,'step'=>'inspeccion','done'=>true]);
ok($code === 200 && isset(impPasos(orden(35))['inspeccion']), 'confirmación revisada permite continuar con aprobación explícita');
ok($data['pago']['n'] === 2 && $data['pago']['amount_clp'] === 61740000, 'Pago 2 conserva el monto de la cotización publicada');
[$code] = llamar('adminSetImportStep', $admin, ['order_id'=>35,'step'=>'compra','done'=>true]);
ok($code === 200 && isset(impPasos(orden(35))['compra']), 'compra requiere su propio hito explícito');


echo "\nEl cliente aprueba antes de que se valide el precio: queda anotado y el Pago 2 sale al validar\n";
sembrar();
llamar('userChooseLink', $alberto, ['order_id' => 35, 'link_id' => 12, 'inspection' => true]);
pagarPago1();
$BD->exec("UPDATE orders SET import_steps='{\"disponibilidad\":\"2026-10-25\"}' WHERE id=35");
// Lo de la sección anterior (misma lancha) no cuenta: solicitud y precio nuevos.
$BD->exec('DELETE FROM order_usa_upload_requests; DELETE FROM order_usa_inspection_prices;');
opuInspectionRequest($BD, orden(35));
$RESPUESTA_CLAUDE = ['code' => 200, 'body' => sseClaude($TRADUCCION)];
cargarReporte(['order_id' => 35, 'notify_client' => '0']);
$CORREOS = [];
[$c, $r] = llamar('userInspeccionDecision', $alberto, ['order_id' => 35, 'decision' => 'aprobar']);
$o = orden(35);
ok($c === 200 && $r['espera_precio'] === true && !isset(impPasos($o)['inspeccion']) && $r['pago'] === null, 'con el precio sin validar, el hito y el Pago 2 esperan');
ok($r['eleccion']['inspection_stage'] === 'aprobada' && $r['eleccion']['inspection_waiting_price'] === true && $r['eleccion']['inspection_decided_by'] === 'cliente', 'el panel muestra que aprobó y que falta confirmar el precio');
$eq = array_values(array_filter($CORREOS, function ($m) { return $m['to'] === 'contacto@imporlan.cl'; }));
ok(count($eq) === 1 && strpos($eq[0]['html'], 'confirmación de precio') !== false, 'el equipo sabe que falta validar el precio para seguir');
[$c] = llamar('userInspeccionDecision', $alberto, ['order_id' => 35, 'decision' => 'declinar']);
ok($c === 409, 'ya aprobó: no cambia la decisión desde el panel');
ok(impAprobacionPendiente($BD, 35) === null, 'mientras el precio no se valida, no se marca nada');
$price = opuPriceState($BD, orden(35));
opuPriceSave($BD, orden(35), ['price_request_id' => $price['request_id'], 'price_revision' => (string) $price['revision'], 'price_status' => 'unchanged', 'price_original' => '25000', 'price_confirmed' => '25000']);
$price = opuPriceState($BD, orden(35));
opuPriceReview($BD, orden(35), $price['request_id'], $price['revision'], $admin['email']);
$CORREOS = [];
$p = impAprobacionPendiente($BD, 35);
$o = orden(35);
ok(isset(impPasos($o)['inspeccion']) && ($p['n'] ?? 0) === 2 && $p['amount_clp'] === 61740000 && $o['inspection_decided_by'] === 'cliente', 'al validar el precio se marca la inspección aprobada por el cliente y sale el Pago 2');
ok(count(array_filter($CORREOS, function ($m) { return $m['to'] === 'alberto@example.com' && strpos($m['html'], 'Pago 2') !== false; })) === 1, 'y al cliente le llega el Pago 2');
ok(impAprobacionPendiente($BD, 35) === null, 'no se repite');
$api = file_get_contents("$raiz/api/operador_usa.php");
ok(strpos($api, 'impAprobacionPendiente($pdo, $o[\'id\'])') !== false, 'la validación del precio en el admin dispara la aprobación pendiente');
$coord = ['chosen_link_id' => 12, 'chosen_inspection' => 1, 'import_steps' => null];
$pdfDavid = [['original_name' => 'Survey.pdf', 'mime_type' => 'application/pdf']];
ok(strpos(opuSugerirReporte($coord, $pdfDavid), 'Cargar reporte') !== false && opuSugerirReporte($coord, [['original_name' => 'a.jpg', 'mime_type' => 'image/jpeg']]) === ''
    && opuSugerirReporte($coord + ['inspection_report_at' => '2026-10-27'], $pdfDavid) === '', 'si David manda un PDF mientras se espera el reporte, el equipo recibe el paso para cargarlo al cliente');

echo "\n" . ($total - $fallos) . "/$total ok\n";
exit($fallos ? 1 : 0);
