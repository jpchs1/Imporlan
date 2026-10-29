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
$db->exec("ALTER TABLE order_links ADD COLUMN value_to_negotiate_usd TEXT; ALTER TABLE order_links ADD COLUMN quote_data TEXT; ALTER TABLE order_links ADD COLUMN quote_total_clp INT; UPDATE order_links SET value_to_negotiate_usd='19000.00', quote_data='{\"valor_lancha_usd\":19000}', quote_total_clp=87000000 WHERE id=11");
$buyerBefore = $db->query('SELECT * FROM order_links WHERE id=11')->fetch(PDO::FETCH_ASSOC);
$captured = []; $count = 0; $failed = 0;
function check($ok, $label) { global $count, $failed; $count++; if (!$ok) $failed++; echo ($ok ? 'ok ' : 'FAIL ') . $label . "\n"; }
function owner() { return ['role'=>'admin', 'email'=>'admin@imporlan.cl']; }
function approve($value, $revision = null, $approvalVersion = null, $session = null) {
 $st = state();
 return opuPriceReview($GLOBALS['db'], opuOrden($GLOBALS['db'],1), $st['request_id'], $revision === null ? $st['revision'] : $revision, $session === null ? owner() : $session, $value, $approvalVersion === null ? $st['approval_version'] : $approvalVersion, 'Owner review');
}
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
check(approve('24000.25') !== null, 'team cannot validate a pending negotiation');
check(submitPrice('adjusted','25000.50','24000.25','Seller agreed to reduce the purchase price due to the engine finding.') === [], 'coordinator can record a confirmed adjustment with reason');
check(state()['original_cents'] === 2500050 && state()['confirmed_cents'] === 2400025 && state()['confirmed'] && !state()['ready'], 'confirmed adjusted values remain pending team review');
check(tick('2026-10-28T11:00:00Z')['price_sent'] === 0, 'reminders stop on a confirmed price before team review');
$forged = ['price_request_id'=>state()['request_id'], 'price_revision'=>(string)state()['revision'], 'price_status'=>'adjusted', 'price_original'=>'25000.50', 'price_confirmed'=>'24000.25', 'price_reason'=>state()['reason'], 'approved_cents'=>1, 'reviewed_by'=>owner()['email'], 'ready'=>true];
check(opuPriceSave($db,opuOrden($db,1),$forged) === [] && !state()['ready'] && state()['approved_cents'] === null, 'operator fields cannot forge an owner approval');
$db->prepare('UPDATE order_usa_inspection_prices SET reviewed_at=?, reviewed_by=? WHERE request_id=?')->execute(['2026-10-20 10:00:00', owner()['email'], state()['request_id']]);
check(!state()['ready'], 'legacy reviewed flags without an explicitly approved owner amount do not release the gate');
check(opuPriceBuyerBaseGuard($db, $db->query('SELECT * FROM order_links WHERE id=11')->fetch(PDO::FETCH_ASSOC), '24000.25', ['role'=>'support','email'=>'support@example.test']) !== null, 'unapproved operator proposals cannot be applied through generic buyer-price writes');
$v = state()['revision'];
check(approve('24000.25', $v-1) !== null, 'stale admin review cannot validate a newer response');
check(approve('24000.25', $v) === null && state()['ready'] && !opuPriceGate($db,opuOrden($db,1)), 'review of the exact version releases the price gate');
$buyerRow = $db->query('SELECT * FROM order_links WHERE id=11')->fetch(PDO::FETCH_ASSOC);
check(opuPriceBuyerBaseGuard($db,$buyerRow,'24000.25',['role'=>'agent','email'=>'coordinator@example.test']) !== null, 'agent cannot bypass approval by writing a quotation directly');
check(opuPriceBuyerBaseGuard($db,$buyerRow,'24000.25',['role'=>'support','email'=>'support@example.test']) === null, 'team may use the exact owner-approved purchase base');
check(opuPriceBuyerBaseGuard($db,$buyerRow,'24050.00',['role'=>'support','email'=>'support@example.test']) !== null, 'team cannot replace the approved base with an unapproved amount');
check(state()['approved_cents'] === 2400025 && state()['approved_revision'] === state()['revision'] && state()['reviewed_by'] === owner()['email'], 'owner approval records the chosen amount and exact proposal revision');
$approvalVersion = state()['approval_version'];
check(approve('24300.50') === null && state()['approved_cents'] === 2430050 && state()['confirmed_cents'] === 2400025, 'owner can edit the approved amount without overwriting David’s proposal');
check(approve('24500.00', null, $approvalVersion) !== null && state()['approved_cents'] === 2430050, 'a stale second owner tab cannot overwrite a newer approval');
foreach ([['role'=>'support','email'=>owner()['email']], ['role'=>'admin','email'=>'other@example.test'], ['role'=>'agent','email'=>owner()['email']]] as $actor) {
 check(approve('99999', null, null, $actor) !== null && state()['approved_cents'] === 2430050, 'only the principal admin account may approve or edit');
}
check(approve(null) !== null, 'old clients cannot silently approve without an explicit owner amount');
check(approve('25,000') !== null && approve('0') !== null, 'approval refuses invalid or ambiguous amounts');
check(strpos(opuPricePortal($db, opuOrden($db,1)), '24300.50') === false, 'David does not receive the amount edited by the owner');
$approvalEvents = $db->query("SELECT meta_json FROM order_events WHERE event_type='inspeccion_precio_aprobado'")->fetchAll(PDO::FETCH_COLUMN);
check(count($approvalEvents) === 2 && strpos(implode('', $approvalEvents), '2430050') !== false, 'approval audit preserves proposed and owner-edited values');
check(submitPrice('adjusted','25000.50','24000.25','Seller agreed to reduce the purchase price due to the engine finding.') === [] && state()['ready'], 'exact repeated save preserves validation');
check(submitPrice('unchanged','25000.50','25000.50') === [] && !state()['ready'] && state()['approved_cents'] === null, 'a corrected response invalidates the earlier team review');
$input = ['price_request_id'=>$request['id'],'price_revision'=>'0','price_status'=>'unchanged','price_original'=>'100','price_confirmed'=>'100'];
check(opuPriceSave($db,opuOrden($db,1),$input) !== [] && state()['confirmed_cents'] === 2500050, 'stale portal submission cannot overwrite current data');
$input['price_revision'] = (string)state()['revision'];
check(opuPriceSave($db,opuOrden($db,2),$input) !== [], 'request from another operation cannot accept a price');
$portal = opuPricePortal($db,opuOrden($db,1),['price_reason'=>'<script>alert(1)</script>']);
check(strpos($portal,'&lt;script&gt;') !== false && strpos($portal,'<script>') === false && strpos($portal,'name="price_revision"') !== false, 'portal escapes input and binds the version');
$events = $db->query("SELECT meta_json FROM order_events WHERE event_type='inspeccion_precio_actualizado'")->fetchAll(PDO::FETCH_COLUMN);
check(count($events) === 3 && strpos(implode('',$events),'engine finding') !== false, 'all changed responses and reasons remain in the audit trail');
check(empty(opuOrden($db,1)['import_steps']), 'saving and reviewing never changes milestones');
check($db->query('SELECT * FROM order_links WHERE id=11')->fetch(PDO::FETCH_ASSOC) === $buyerBefore, 'David submissions and owner approval leave the published buyer price and quote byte-for-byte unchanged');
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
check(strpos($mail['html'],'<img onerror=x>') === false && strpos($mail['html'],'&lt;img') !== false && strpos($mail['html'],'private@example.test') === false && strpos($mail['html'],'123456') === false && strpos($mail['html'], 'Juan Pablo must approve or edit it') !== false, 'renderer escapes values and excludes customer contact and quotation amounts');
$source = file_get_contents("$root/api/operador_usa.php");
check(strpos($source,"requireAdminAuthShared(['admin', 'support'])") < strpos($source,"if (\$r === 'admin_precio_revisar'"), 'team validation route is behind admin/support authorization');
$legacy = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$legacy->exec("CREATE TABLE order_usa_inspection_prices (request_id INT PRIMARY KEY, status TEXT, original_cents INT, confirmed_cents INT, reason TEXT, revision INT, updated_at TEXT, reviewed_at TEXT, reviewed_by TEXT, last_attempt_on TEXT, last_sent_at TEXT); INSERT INTO order_usa_inspection_prices (request_id,status,revision,confirmed_cents) VALUES (1,'adjusted',3,2400025)");
opuPriceSchema($legacy);
$upgraded = $legacy->query('SELECT confirmed_cents, approved_cents, approval_version FROM order_usa_inspection_prices')->fetch(PDO::FETCH_ASSOC);
check($upgraded['confirmed_cents'] == 2400025 && $upgraded['approved_cents'] === null && $upgraded['approval_version'] == 0, 'existing installations migrate without losing or implicitly approving the operator proposal');
// An owner can keep an existing published agreement without inventing an operator response.
$db->exec("ALTER TABLE order_links ADD COLUMN quote_published_at TEXT; UPDATE order_links SET quote_published_at='2026-10-20' WHERE id=11");
$beforeLink=$db->query('SELECT * FROM order_links WHERE id=11')->fetch(PDO::FETCH_ASSOC);
$beforePrice=state();
$input=['request_id'=>$beforePrice['request_id'],'revision'=>$beforePrice['revision'],'approval_version'=>$beforePrice['approval_version'],'agreement_hash'=>$beforePrice['agreement']['hash']];
check(opuPriceRetain($db,opuOrden($db,1),$input,['role'=>'support','email'=>owner()['email']])!==null,'support cannot waive price validation');
check(opuPriceRetain($db,opuOrden($db,1),array_replace($input,['agreement_hash'=>'stale']),owner())!==null,'retention rejects a quote changed since preview');
check(opuPriceRetain($db,opuOrden($db,1),$input,owner())===null && state()['retained'] && state()['ready'] && state()['approved_cents']===1900000,'owner retains the negotiated published base, not a new proposal');
check($beforeLink===$db->query('SELECT * FROM order_links WHERE id=11')->fetch(PDO::FETCH_ASSOC),'retention never changes quotation, totals, payment plan or negotiated amount');
check(state()['status']===$beforePrice['status'] && state()['confirmed_cents']===$beforePrice['confirmed_cents'] && state()['revision']===$beforePrice['revision'],'David history is preserved rather than falsely confirmed on his behalf');
check(opuPriceGate($db,opuOrden($db,1))===null,'owner-retained agreement satisfies the price gate');
check(submitPrice('unchanged','21000','21000')!==[] && state()['approved_cents']===1900000,'late operator submission cannot overwrite the retained agreement');
check(tick('2030-10-29T11:00:00Z')['price_sent']===0,'only this retained operation stops price emails');
$db->exec("UPDATE order_links SET quote_total_clp=88000000 WHERE id=11");
check(!state()['ready'] && opuPriceGate($db,opuOrden($db,1))!==null && tick('2030-10-30T11:00:00Z')['price_sent']===0,'changing the retained quote requires owner review while its price emails remain disabled');
$db->exec("UPDATE order_links SET quote_total_clp=87000000 WHERE id=11");
$other=opuInspectionRequest($db,opuOrden($db,2),['nombre'=>'Other Coordinator','email'=>'other@example.test']);
check(tick('2030-10-31T11:00:00Z')['price_sent']===1 && end($captured)['to']==='other@example.test','other operations keep their automatic price confirmations');
foreach (glob("$box/*") as $file) unlink($file); rmdir($box);
echo ($count-$failed) . "/$count passed\n";
exit($failed ? 1 : 0);
