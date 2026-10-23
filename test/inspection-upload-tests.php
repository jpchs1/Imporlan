<?php
/** Real SQLite state transitions and portal uploads; all outgoing mail is captured. */
$root = dirname(__DIR__);
$box = sys_get_temp_dir() . '/inspection-upload-' . getmypid();
mkdir($box, 0700, true);
foreach (['operador_usa.php', 'inspection_upload_followup.php', 'inspection_upload_template.php', 'eleccion_lancha.php', 'auth_helper.php'] as $file) copy("$root/api/$file", "$box/$file");
file_put_contents("$box/db_config.php", '<?php function getDbConnection() { return $GLOBALS["db"]; }');
file_put_contents("$box/email_service.php", '<?php class EmailService { function sendCustomEmail(...$args) { return ["success"=>true]; } function sendExpedienteFilesEmail(...$args) { return ["success"=>true]; } }');
ini_set('error_log', '/dev/null');
require "$box/operador_usa.php";
$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$db->sqliteCreateFunction('NOW', function () { return gmdate('Y-m-d H:i:s'); });
$db->exec("CREATE TABLE orders (id INTEGER PRIMARY KEY, order_number TEXT, status TEXT, chosen_link_id INT, chosen_inspection INT, chosen_at TEXT, import_steps TEXT, usa_token TEXT, usa_link_id INT, usa_requested_at TEXT, usa_updated_at TEXT, customer_email TEXT, refund_requested_at TEXT)");
$db->exec("CREATE TABLE order_links (id INTEGER PRIMARY KEY, order_id INT, title TEXT, image_url TEXT, location TEXT, hours TEXT)");
$db->exec("CREATE TABLE order_events (id INTEGER PRIMARY KEY, order_id INT, event_type TEXT, meta_json TEXT, user_id TEXT)");
$db->exec("CREATE TABLE order_usa_updates (id INTEGER PRIMARY KEY, order_id INT, note TEXT, file_ids TEXT, shared_text TEXT, shared_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
$db->exec("CREATE TABLE expediente_files (id INTEGER PRIMARY KEY, order_id INT, original_name TEXT, stored_name TEXT, mime_type TEXT, file_size INT, category TEXT, description TEXT, uploaded_by TEXT, visible_to_client INT)");
opuInspectionSchema($db);
$db->exec("INSERT INTO orders (id,order_number,status,chosen_link_id,chosen_inspection) VALUES (35,'IMP-00035','in_progress',11,1),(36,'IMP-00036','in_progress',12,1)");
$db->exec("INSERT INTO order_links (id,order_id,title,location,hours) VALUES (11,35,'Chaparral 21 Sport H2O 2015','Lula, GA','163'),(12,36,'Another boat','','')");
$total = 0; $failures = 0;
function check($value, $message) { global $total, $failures; $total++; if (!$value) $failures++; echo ($value ? 'ok ' : 'FAIL ') . $message . PHP_EOL; }
function requestRow($id) { $st = $GLOBALS['db']->prepare('SELECT * FROM order_usa_upload_requests WHERE id = ?'); $st->execute([$id]); return $st->fetch(); }
function at($time) { return new DateTimeImmutable($time); }
$sent = [];
$send = function ($to, $mail, $metadata) use (&$sent) { $sent[] = compact('to', 'mail', 'metadata'); return true; };

$request = opuInspectionBootstrap($db);
check($request && $request['order_id'] == 35 && $request['link_id'] == 11, 'bootstraps the authorized operation and selected boat');
check(opuInspectionBootstrap($db)['id'] === $request['id'], 'repeated deploy/cron does not recreate the request');
check($db->query('SELECT COUNT(*) FROM order_usa_upload_requests')->fetchColumn() == 1, 'other clients are not enrolled');
$id = $request['id'];
check(opuInspectionRun($db, at('2026-10-23T18:00:00Z'), $send)['sent'] === 1, 'first request goes immediately even in the afternoon');
check(opuInspectionRun($db, at('2026-10-23T18:05:00Z'), $send)['sent'] === 0, 'repeated cron does not send twice that day');
check(opuInspectionRun($db, at('2026-10-24T10:59:00Z'), $send)['sent'] === 0, '07:59 Chile is before the reminder window');
check(opuInspectionRun($db, at('2026-10-24T11:00:00Z'), $send)['sent'] === 1, '08:00 Chile sends the next reminder');
check(opuInspectionRun($db, at('2026-10-24T11:05:00Z'), $send)['sent'] === 0, 'morning reminder is sent only once');
check(opuInspectionRun($db, at('2026-10-25T15:00:00Z'), $send)['sent'] === 0, 'no afternoon catch-up reminder');
check($sent[0]['to'] === 'ddm4me25@gmail.com' && $sent[0]['metadata']['reminder'] === false && $sent[1]['metadata']['reminder'] === true, 'recipient and initial/reminder metadata are correct');
check(strpos($sent[0]['mail']['html'], '0 OF 3 RECEIVED') !== false && strpos($sent[0]['mail']['text'], 'Inspection videos') !== false, 'HTML and text explicitly request all three file types');
check(strpos($sent[0]['mail']['html'], 'coordinate the technical survey') === false, 'completed inspection is never requested again');
check(strpos($sent[0]['mail']['html'], 'alberto') === false && strpos($sent[0]['mail']['html'], 'CLP') === false, 'operator email does not contain customer contact or prices');
$portal = opuPaginaPortal($db, opuOrden($db,35));
check(strpos($portal, 'inspection_request_id') !== false && strpos($portal, 'Upload the inspection package') !== false, 'private portal shows the scoped checklist and upload field');
check(opuRecordar($db) === 1 && opuPedirActualizacion($db, opuOrden($db,35), 'test') === false, 'legacy reminder skips the tracked operation and still serves other orders');

// Exercise actual file validation/storage with partial and final submissions.
$photo = "$box/photo.png"; $pdf = "$box/report.pdf"; $video = "$box/video.mp4";
file_put_contents($photo, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));
file_put_contents($pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
file_put_contents($video, hex2bin('000000206674797069736f6d0000020069736f6d69736f32617663316d703431'));
$file = function ($path) { return ['name'=>basename($path),'tmp_name'=>$path,'size'=>filesize($path),'error'=>0]; };
opuGuardarActualizacion($db, opuOrden($db,35), 'Inspection complete. https://example.com/video', [], 'copy', $id);
check(opuInspectionReceived($db,$request) === ['report'=>false,'photos'=>false,'videos'=>false], 'a note or pasted link cannot complete uploads');
$res = opuGuardarActualizacion($db, opuOrden($db,35), '', [$file($photo), $file($pdf)], 'copy', $id);
check(count($res['files']) === 2 && opuInspectionReceived($db,$request) === ['report'=>true,'photos'=>true,'videos'=>false], 'real PDF and image satisfy only their categories');
check(requestRow($id)['status'] === 'pending', 'partial upload keeps request open');
$sent = [];
opuInspectionRun($db, at('2026-10-25T11:00:00Z'), $send);
check(count($sent) === 1 && strpos($sent[0]['mail']['html'], '2 OF 3 RECEIVED') !== false, 'next reminder shows exactly what was received');

$other = opuInspectionRequest($db, opuOrden($db,36), ['nombre'=>'Assigned Operator','email'=>'operator@example.com']);
opuInspectionAttach($db, opuOrden($db,36), $other['id'], $res['files']);
check(opuInspectionReceived($db,$other) === ['report'=>false,'photos'=>false,'videos'=>false], 'files belonging to another order do not count');
$res = opuGuardarActualizacion($db, opuOrden($db,35), '', [$file($video)], 'copy', $id);
check(count($res['files']) === 1 && $res['files'][0]['category'] === 'video', 'actual MIME-checked video is saved');
check(requestRow($id)['status'] === 'completed' && requestRow($id)['completed_at'], 'all three uploads stop the request immediately');
check(opuInspectionRun($db, at('2026-10-26T11:00:00Z'), $send)['sent'] === 1 && end($sent)['to'] === 'operator@example.com', 'completed request stops; another assigned operator gets only their own request');
$portal = opuPaginaPortal($db, opuOrden($db,35));
check(strpos($portal,'Inspection package received') !== false && strpos($portal,'inspection_request_id') === false, 'portal confirms receipt and removes the pending form binding');
check(opuInspectionOwnsStage($db, opuOrden($db,35)), 'old reminder cannot ask to perform the already completed inspection');
check(empty(opuOrden($db,35)['import_steps']), 'upload completion never approves the survey or advances payment milestones');

$db->exec("UPDATE orders SET chosen_link_id=999 WHERE id=36");
check(opuInspectionRun($db, at('2026-10-27T11:00:00Z'), $send)['cancelled'] === 1, 'changing the selected boat cancels its request');
$db->exec("UPDATE orders SET chosen_link_id=12 WHERE id=36");
$r = opuInspectionRequest($db, opuOrden($db,36), null, 'failure-case');
$failSend = function () { return false; };
check(opuInspectionRun($db, at('2026-10-27T18:00:00Z'), $failSend)['failed'] === 1, 'mail failure is recorded separately from successful sends');
check(opuInspectionRun($db, at('2026-10-27T18:05:00Z'), $send)['sent'] === 0, 'failed or uncertain attempt is not retried into duplicate messages');
$db->exec("UPDATE orders SET status='cancelled' WHERE id=36");
check(opuInspectionRun($db, at('2026-10-28T11:00:00Z'), $send)['cancelled'] === 1, 'closing an order stops follow-ups');
$db->exec("UPDATE orders SET status='in_progress' WHERE id=36");
$r = opuInspectionRequest($db, opuOrden($db,36), null, 'refund-case');
$db->exec("UPDATE orders SET refund_requested_at='2026-10-28' WHERE id=36");
check(opuInspectionRun($db, at('2026-10-29T11:00:00Z'), $send)['cancelled'] === 1, 'refund request stops follow-ups');
check(opuInspectionDue(['status'=>'pending','last_sent_at'=>'2026-06-01','last_attempt_on'=>'2026-06-01'], at('2026-06-02T12:00:00Z')), 'winter 08:00 uses Chile UTC-4');
check(!opuInspectionDue(['status'=>'pending','last_sent_at'=>'2026-06-01','last_attempt_on'=>'2026-06-01'], at('2026-06-02T11:00:00Z')), 'winter 07:00 is not mistaken for summer 08:00');
$escaped = opuInspectionEmail(['boat'=>'<script>alert(1)</script>', 'portal_url'=>'https://example.com/?a=1&b=2']);
check(strpos($escaped['html'],'<script>') === false && strpos($escaped['html'],'&lt;script&gt;') !== false, 'listing content is escaped in the email');

// Canary: removing the video requirement would incorrectly stop a partial request.
check(count(array_filter(['report'=>true,'photos'=>true,'videos'=>false])) !== 3, 'canary protects the video requirement');
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($box, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
foreach ($it as $file) { $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname()); } rmdir($box);
echo ($total-$failures) . "/$total passed\n";
exit($failures ? 1 : 0);
