<?php
/** Synthetic SQLite operation, actual renderer/state machine, captured mail only. */
$root = dirname(__DIR__);
$box = sys_get_temp_dir() . '/inspection-price-' . getmypid();
mkdir($box, 0700, true);
foreach (['operador_usa.php', 'inspection_upload_followup.php', 'inspection_upload_template.php', 'inspection_price_followup.php', 'inspection_price_template.php', 'eleccion_lancha.php', 'auth_helper.php'] as $file) copy("$root/api/$file", "$box/$file");
file_put_contents("$box/db_config.php", '<?php function getDbConnection() { return $GLOBALS["db"]; }');
file_put_contents("$box/email_service.php", '<?php class EmailService { function sendInspectionPriceEmail($to,$mail,$metadata) { $GLOBALS["captured"][] = compact("to","mail","metadata"); return ["success"=>true]; } function sendCustomEmail(...$args) { return ["success"=>true]; } }');
ini_set('error_log', '/dev/null');
require "$box/operador_usa.php";
$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$db->exec('CREATE TABLE orders (id INTEGER PRIMARY KEY, order_number TEXT, status TEXT, chosen_link_id INT, chosen_inspection INT, import_steps TEXT, usa_token TEXT, refund_requested_at TEXT, inspection_result TEXT)');
$db->exec('CREATE TABLE order_links (id INTEGER PRIMARY KEY, order_id INT, title TEXT)');
$db->exec('CREATE TABLE order_events (id INTEGER PRIMARY KEY, order_id INT, event_type TEXT, meta_json TEXT, user_id TEXT)');
$db->exec("INSERT INTO orders (id,order_number,status,chosen_link_id,chosen_inspection,usa_token) VALUES (1,'IMP-DEMO','in_progress',11,1,'" . str_repeat('a', 48) . "'),(2,'IMP-OTHER','in_progress',22,1,NULL)");
$db->exec("INSERT INTO order_links VALUES (11,1,'Demo boat'),(22,2,'Other demo boat')");
opuInspectionSchema($db);
$request = opuInspectionRequest($db, opuOrden($db, 1), ['nombre'=>'Assigned Coordinator', 'email'=>'coordinator@example.test']);
$captured = []; $count = 0; $failed = 0;
function check($ok, $label) { global $count, $failed; $count++; if (!$ok) $failed++; echo ($ok ? 'ok ' : 'FAIL ') . $label . "\n"; }
function state() { return opuPriceState($GLOBALS['db'], opuOrden($GLOBALS['db'],1)); }
function submitPrice($status, $previous = '', $current = '', $reason = '') {
    $state = state();
    return opuPriceSave($GLOBALS['db'], opuOrden($GLOBALS['db'],1), ['price_request_id'=>(string)$state['request_id'], 'price_revision'=>(string)$state['revision'], 'price_status'=>$status, 'price_original'=>$previous, 'price_confirmed'=>$current, 'price_reason'=>$reason]);
}
function tick($time, $send = null) { return opuPriceRun($GLOBALS['db'], new DateTimeImmutable($time), $send); }
check(state()['status'] === 'pending' && !state()['ready'] && opuPriceGate($db,opuOrden($db,1)), 'known completed inspection has a separate pending price step');
check(opuPriceState($db,opuOrden($db,2)) === null, 'uninspected operations are not silently enrolled');
check(tick('2026-10-25T19:00:00Z')['price_sent'] === 1, 'first price email is sent immediately, including afternoon');
check($captured[0]['to'] === 'coordinator@example.test', 'request goes to the assigned coordinator');
check($captured[0]['metadata']['event'] === 'inspection_price_confirmation' && !$captured[0]['metadata']['reminder'], 'delivery metadata identifies initial price confirmation');
check(strpos($captured[0]['mail']['html'],'One price confirmation.') !== false && strpos($captured[0]['mail']['text'],'Price unchanged') !== false && strpos($captured[0]['mail']['text'],'Still being negotiated') !== false, 'HTML and text explain all three situations');
check(strpos($captured[0]['mail']['html'],'#purchase-price') !== false && strpos($captured[0]['mail']['text'],'authorize the purchase') !== false, 'CTA opens the actual form and does not authorize a purchase');
check(tick('2026-10-25T19:05:00Z')['price_sent'] === 0 && tick('2026-10-26T10:59:00Z')['price_sent'] === 0, 'repeat cron and pre-08:00 do not duplicate');
check(tick('2026-10-26T11:00:00Z')['price_sent'] === 1 && end($captured)['metadata']['reminder'], 'next Chile morning sends one reminder');
check(tick('2026-10-26T11:05:00Z')['price_sent'] === 0 && tick('2026-10-27T15:00:00Z')['price_sent'] === 0, 'no second daily or afternoon reminder');
check(submitPrice('unchanged','25000','24000') !== [] && state()['revision'] === 0, 'unchanged cannot disguise different amounts');
check(submitPrice('adjusted','25000','25000','A specific inspection finding.') !== [], 'adjusted requires a real amount difference');
check(submitPrice('adjusted','25000','24000','short') !== [], 'adjustment requires a meaningful inspection reason');
foreach (['25,000','25.000,50','-100','0','NaN','1e5','25000.123','100000000','<script>'] as $invalid) check(opuPriceCents($invalid) === null, 'reject ambiguous/invalid USD input: ' . $invalid);
check(opuPriceCents('25000.5') === 2500050 && opuPriceCents('0.01') === 1, 'USD parses exactly to cents');
check(submitPrice('negotiating','','','Waiting for seller response on engine repair costs; next update tomorrow.') === [] && !state()['confirmed'], 'pending negotiation records a reason and leaves step open');
check(tick('2026-10-27T11:00:00Z')['price_sent'] === 1, 'pending negotiation continues daily AM reminders');
check(opuPriceReview($db,opuOrden($db,1),state()['request_id'],state()['revision'],'reviewer@example.test') !== null, 'team cannot validate a pending negotiation');
check(submitPrice('adjusted','25000.50','24000.25','Seller agreed to reduce the purchase price due to the engine finding.') === [], 'coordinator can record a confirmed adjustment with reason');
check(state()['original_cents'] === 2500050 && state()['confirmed_cents'] === 2400025 && state()['confirmed'] && !state()['ready'], 'confirmed adjusted values remain pending team review');
check(tick('2026-10-28T11:00:00Z')['price_sent'] === 0, 'reminders stop on a confirmed price before team review');
$v = state()['revision'];
check(opuPriceReview($db,opuOrden($db,1),state()['request_id'],$v-1,'reviewer@example.test') !== null, 'stale admin review cannot validate a newer response');
check(opuPriceReview($db,opuOrden($db,1),state()['request_id'],$v,'reviewer@example.test') === null && state()['ready'] && !opuPriceGate($db,opuOrden($db,1)), 'review of the exact version releases the price gate');
check(submitPrice('adjusted','25000.50','24000.25','Seller agreed to reduce the purchase price due to the engine finding.') === [] && state()['ready'], 'exact repeated save preserves validation');
check(submitPrice('unchanged','25000.50','25000.50') === [] && !state()['ready'], 'a corrected response invalidates the earlier team review');
$input = ['price_request_id'=>$request['id'],'price_revision'=>'0','price_status'=>'unchanged','price_original'=>'100','price_confirmed'=>'100'];
check(opuPriceSave($db,opuOrden($db,1),$input) !== [] && state()['confirmed_cents'] === 2500050, 'stale portal submission cannot overwrite current data');
$input['price_revision'] = (string)state()['revision'];
check(opuPriceSave($db,opuOrden($db,2),$input) !== [], 'request from another operation cannot accept a price');
$portal = opuPricePortal($db,opuOrden($db,1),['price_reason'=>'<script>alert(1)</script>']);
check(strpos($portal,'&lt;script&gt;') !== false && strpos($portal,'<script>') === false && strpos($portal,'name="price_revision"') !== false, 'portal escapes input and binds the version');
$events = $db->query("SELECT meta_json FROM order_events WHERE event_type='inspeccion_precio_actualizado'")->fetchAll(PDO::FETCH_COLUMN);
check(count($events) === 3 && strpos(implode('',$events),'engine finding') !== false, 'all changed responses and reasons remain in the audit trail');
check(empty(opuOrden($db,1)['import_steps']), 'saving and reviewing never changes milestones');
$db->exec("UPDATE orders SET chosen_link_id=99 WHERE id=1");
check(opuPriceState($db,opuOrden($db,1)) === null && tick('2026-10-29T11:00:00Z')['price_sent'] === 0, 'replacement boat hides old values and stops old reminders');
$db->exec('UPDATE orders SET chosen_link_id=11 WHERE id=1');
foreach (["status='completed'", "status='in_progress',refund_requested_at='2026-10-29'", "refund_requested_at=NULL,inspection_result='no_apta'", "inspection_result=NULL,chosen_inspection=0", "chosen_inspection=1,import_steps='{\"compra\":\"2026-10-29\"}'"] as $change) {
    $db->exec('UPDATE orders SET ' . $change . ' WHERE id=1');
    check(opuPriceState($db,opuOrden($db,1)) === null, 'closed/refunded/rejected/no-survey/already purchased operations are excluded');
}
$db->exec("UPDATE orders SET import_steps=NULL WHERE id=1");
submitPrice('negotiating','','','Waiting for the seller to confirm a new purchase price.');
check(tick('2026-10-29T11:00:00Z',function(){return false;})['price_failed'] === 1, 'delivery failure is auditable separately');
check(tick('2026-10-29T11:05:00Z')['price_sent'] === 0, 'uncertain delivery cannot be immediately retried into duplicate mail');
$mail = opuInspectionPriceEmail(['operator_name'=>'<img onerror=x>','boat'=>'Boat <script>','order_number'=>'DEMO','portal_url'=>'https://www.imporlan.cl/','customer_email'=>'private@example.test','quote_total_clp'=>123456]);
check(strpos($mail['html'],'<img onerror=x>') === false && strpos($mail['html'],'&lt;img') !== false && strpos($mail['html'],'private@example.test') === false && strpos($mail['html'],'123456') === false, 'renderer escapes values and excludes customer contact and quotation amounts');
$source = file_get_contents("$root/api/operador_usa.php");
check(strpos($source,"requireAdminAuthShared(['admin', 'support'])") < strpos($source,"if (\$r === 'admin_precio_revisar'"), 'team validation route is behind admin/support authorization');
foreach (glob("$box/*") as $file) unlink($file); rmdir($box);
echo ($count-$failed) . "/$count passed\n";
exit($failed ? 1 : 0);
