<?php
/** Real SQLite state transitions and portal uploads; all outgoing mail is captured. */
$root = dirname(__DIR__);
$box = sys_get_temp_dir() . '/inspection-upload-' . getmypid();
mkdir($box, 0700, true);
foreach (['operador_usa.php', 'inspection_upload_followup.php', 'inspection_upload_template.php', 'eleccion_lancha.php', 'auth_helper.php'] as $file) copy("$root/api/$file", "$box/$file");
file_put_contents("$box/db_config.php", '<?php function getDbConnection() { return $GLOBALS["db"]; }');
file_put_contents("$box/email_service.php", '<?php class EmailService { function sendCustomEmail(...$args) { $GLOBALS["STAFF_CAPTURE"][] = $args; return ["success"=>true]; } function sendExpedienteFilesEmail(...$args) { $GLOBALS["CLIENT_UPLOAD_CAPTURE"][] = $args; return ["success"=>true]; } function sendInspectionUploadEmail($to,$mail,$metadata) { $GLOBALS["RECEIPTS_CAPTURE"][] = compact("to","mail","metadata"); return ["success"=>empty($GLOBALS["RECEIPT_SHOULD_FAIL"])]; } }');
$RECEIPTS_CAPTURE = [];
$STAFF_CAPTURE = [];
$CLIENT_UPLOAD_CAPTURE = [];
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
check($RECEIPTS_CAPTURE === [], 'a partial upload never receives a complete-package thank-you');
$sent = [];
opuInspectionRun($db, at('2026-10-25T11:00:00Z'), $send);
check(count($sent) === 1 && strpos($sent[0]['mail']['html'], '2 OF 3 RECEIVED') !== false, 'next reminder shows exactly what was received');

$other = opuInspectionRequest($db, opuOrden($db,36), ['nombre'=>'Assigned Operator','email'=>'operator@example.com']);
opuInspectionAttach($db, opuOrden($db,36), $other['id'], $res['files']);
check(opuInspectionReceived($db,$other) === ['report'=>false,'photos'=>false,'videos'=>false], 'files belonging to another order do not count');
$res = opuGuardarActualizacion($db, opuOrden($db,35), '', [$file($video)], 'copy', $id);
check(count($res['files']) === 1 && $res['files'][0]['category'] === 'video', 'actual MIME-checked video is saved');
check(requestRow($id)['status'] === 'completed' && requestRow($id)['completed_at'], 'all three uploads stop the request immediately');
check(count($RECEIPTS_CAPTURE) === 1 && $RECEIPTS_CAPTURE[0]['to'] === 'ddm4me25@gmail.com', 'completing the actual upload immediately thanks the assigned operator');
$thanks = $RECEIPTS_CAPTURE[0];
check(strpos($thanks['mail']['subject'],'Thank you: inspection files received') !== false && strpos($thanks['mail']['html'],'3 OF 3 RECEIVED') !== false, 'professional thank-you confirms all three file types');
check(strpos($thanks['mail']['text'],'coordinate the next steps in the acquisition process') !== false && strpos($thanks['mail']['text'],'Please wait for our confirmation') !== false, 'explains the next buyer steps without authorizing the purchase');
check(stripos($thanks['mail']['html'],'lathrop') === false && stripos($thanks['mail']['html'],'alathrop') === false && strpos($thanks['mail']['html'],'CLP') === false, 'thank-you does not expose customer identity, contact or prices');
check($thanks['metadata']['event'] === 'inspection_upload_received', 'receipt has its own auditable event metadata');
opuInspectionFinish($db, $request);
check(opuInspectionAcknowledge($db,$id) === null && count($RECEIPTS_CAPTURE) === 1, 'repeated completion, reloads and cron cannot thank twice');
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

// Completed packages from before deployment receive exactly one acknowledgement.
$db->exec('DELETE FROM order_usa_upload_receipts WHERE request_id=' . intval($id));
$backfill = [];
$receiptSend = function ($to,$mail,$metadata) use (&$backfill) { $backfill[] = compact('to','mail','metadata'); return true; };
check(opuInspectionDrainReceipts($db,$receiptSend)['sent'] === 1 && count($backfill) === 1, 'backfills the already completed operation once');
check(opuInspectionDrainReceipts($db,$receiptSend)['sent'] === 0 && count($backfill) === 1, 'subsequent deployment cron does not resend the receipt');
$db->exec("UPDATE order_usa_upload_receipts SET status='sending' WHERE request_id=" . intval($id));
check(opuInspectionAcknowledge($db,$id,$receiptSend) === null && count($backfill) === 1, 'a concurrent or uncertain claimed send is never repeated');
$db->exec("UPDATE order_usa_upload_receipts SET status='sent' WHERE request_id=" . intval($id));

// A future request honours its assigned operator and handles a failed receipt safely.
$db->exec("UPDATE orders SET refund_requested_at=NULL WHERE id=36");
$assigned = opuInspectionRequest($db,opuOrden($db,36),['nombre'=>'Assigned Operator','email'=>'operator@example.com'],'receipt-assigned');
$res = opuGuardarActualizacion($db,opuOrden($db,36),'',[$file($photo),$file($pdf),$file($video)],'copy',$assigned['id']);
check(count($res['files']) === 3 && end($RECEIPTS_CAPTURE)['to'] === 'operator@example.com', 'future completed packages thank their actual assigned operator');
$db->exec('DELETE FROM order_usa_upload_receipts WHERE request_id=' . intval($assigned['id']));
opuInspectionQueueReceipt($db,$assigned['id']);
check(opuInspectionAcknowledge($db,$assigned['id'],function(){ return false; }) === false, 'receipt SMTP failure remains distinguishable from success');
$status = $db->query('SELECT status FROM order_usa_upload_receipts WHERE request_id=' . intval($assigned['id']))->fetchColumn();
check($status === 'failed' && opuInspectionDrainReceipts($db,$receiptSend)['sent'] === 0, 'failed or uncertain receipts are not silently resent');
$db->exec('DELETE FROM order_usa_upload_receipts WHERE request_id=' . intval($assigned['id']));
opuInspectionQueueReceipt($db,$assigned['id']);
$db->exec("UPDATE orders SET status='cancelled' WHERE id=36");
check(opuInspectionAcknowledge($db,$assigned['id'],$receiptSend) === null && count($backfill) === 1, 'a closed operation does not receive a stale acknowledgement');
check(empty(opuOrden($db,35)['import_steps']) && empty(opuOrden($db,36)['import_steps']), 'acknowledgements do not approve inspections or trigger payment milestones');

// Separate evidence and explicit unavailability are different, auditable states.
$db->exec("INSERT INTO orders (id,order_number,status,chosen_link_id,chosen_inspection) VALUES
    (37,'IMP-TEST-37','in_progress',137,1),(38,'IMP-TEST-38','in_progress',138,1),
    (39,'IMP-TEST-39','in_progress',139,1),(40,'IMP-TEST-40','in_progress',140,1),
    (41,'IMP-TEST-41','in_progress',141,1),(42,'IMP-TEST-42','in_progress',142,1)");
$db->exec("INSERT INTO order_links (id,order_id,title) VALUES
    (137,37,'Exception test boat'),(138,38,'Reason-only test boat'),
    (139,39,'Scope test boat'),(140,40,'Reminder test boat'),
    (141,41,'Missing-file test boat'),(142,42,'Closed test boat')");
$db->exec("UPDATE orders SET customer_email='buyer37@example.test' WHERE id=37");
$waived = opuInspectionRequest($db, opuOrden($db,37), ['nombre'=>'Assigned Operator','email'=>'operator@example.com']);
$beforeFiles = (int) $db->query('SELECT COUNT(*) FROM expediente_files WHERE order_id=37')->fetchColumn();
$bad = opuGuardarActualizacion($db, opuOrden($db,37), '', [$file($photo)], 'copy', $waived['id'], ['videos'=>'No']);
check(!empty($bad['errores']) && !$bad['files'] && (int) $db->query('SELECT COUNT(*) FROM expediente_files WHERE order_id=37')->fetchColumn() === $beforeFiles, 'an invalid reason rejects the submission before storing any uploaded file');
check(opuInspectionExceptionErrors($db, opuOrden($db,37), $waived['id'], ['videos'=>'   ']) !== [], 'whitespace is not an explanation for a missing requirement');
check(opuInspectionExceptionErrors($db, opuOrden($db,37), $waived['id'], ['videos'=>str_repeat('x',2001)]) !== [], 'overlong explanations are rejected rather than silently truncated');
check(opuInspectionExceptionErrors($db, opuOrden($db,37), $waived['id'], ['purchase'=>'The operator cannot approve a purchase here.']) !== [], 'only the three upload requirements can be marked unavailable');
$res = opuGuardarActualizacion($db, opuOrden($db,37), '', [$file($pdf),$file($photo),$file($photo)], 'copy', 0);
$state = opuInspectionState($db, requestRow($waived['id']));
check(count($res['files']) === 3 && $state['requirements']['report']['count'] === 1 && $state['requirements']['photos']['count'] === 2 && $state['requirements']['videos']['count'] === 0, 'legacy forms infer the active request and count reports, photos and videos separately');
check($state['received'] === ['report'=>true,'photos'=>true,'videos'=>false] && $state['missing'] === ['videos'] && $state['received_count'] === 2 && $state['resolved_count'] === 2, 'multiple photos never stand in for the missing video category');
check($state['requirements']['report']['files'][0]['original_name'] === 'report.pdf' && $state['requirements']['report']['files'][0]['mime_type'] === 'application/pdf', 'per-requirement evidence includes the persisted filename and verified MIME');
check($state['requirements']['photos']['files'][0]['id'] != $state['requirements']['photos']['files'][1]['id'], 'each photo in the evidence list retains its own file identity');

$beforeReceipts = count($RECEIPTS_CAPTURE);
$beforeClientNotices = count($CLIENT_UPLOAD_CAPTURE);
$reason = 'The engine-running video was not recorded because the marina prohibited starting the engine.';
$reasonResult = opuGuardarActualizacion($db, opuOrden($db,37), '', [], 'copy', $waived['id'], ['videos'=>$reason]);
$state = opuInspectionState($db, requestRow($waived['id']));
check($reasonResult['update_id'] && !$reasonResult['files'] && !$reasonResult['errores'], 'the private portal accepts an explanation without demanding a file or a separate note');
check($state['status'] === 'completed' && $state['resolved_count'] === 3 && $state['received_count'] === 2 && $state['completion_mode'] === 'with_exceptions' && $state['missing'] === [], 'two received types plus one explicit explanation resolve the delivery automatically');
check($state['received']['videos'] === false && $state['requirements']['videos']['count'] === 0 && $state['requirements']['videos']['exception']['reason'] === $reason && $state['requirements']['videos']['resolved'] === true, 'an unavailable video remains distinct from an actually received video');
check(count($RECEIPTS_CAPTURE) === $beforeReceipts + 1 && end($RECEIPTS_CAPTURE)['to'] === 'operator@example.com', 'resolving the last outstanding requirement thanks the assigned operator exactly once');
$exceptionThanks = end($RECEIPTS_CAPTURE)['mail'];
check(strpos($exceptionThanks['html'],'3 OF 3 RECEIVED') === false && strpos($exceptionThanks['text'],$reason) !== false, 'the acknowledgement records the reason without falsely claiming all three file types arrived');
check(count($CLIENT_UPLOAD_CAPTURE) === $beforeClientNotices, 'an internal unavailability explanation is never sent directly to the buyer');
check(empty(opuOrden($db,37)['import_steps']), 'resolving document delivery does not approve the inspection or trigger payment milestones');
$events = $db->query('SELECT meta_json FROM order_events WHERE order_id=37')->fetchAll(PDO::FETCH_COLUMN);
check((bool) array_filter($events, function ($meta) use ($reason) { return strpos((string)$meta,$reason) !== false; }), 'the reason is preserved in the operation audit trail');
check(opuInspectionSaveExceptions($db, opuOrden($db,37), $waived['id'], ['videos'=>$reason]) === [] && count($RECEIPTS_CAPTURE) === $beforeReceipts + 1, 'resubmitting the same explanation is idempotent and does not send another thank-you');
$sent = [];
opuInspectionRun($db, at('2026-10-30T11:00:00Z'), $send);
check(!array_filter($sent, function ($mail) use ($waived) { return $mail['metadata']['request_id'] == $waived['id']; }), 'daily reminders stop when all requirements are received or explicitly explained');
$portal = opuPaginaPortal($db, opuOrden($db,37));
check(strpos($portal,opuEsc($reason)) !== false && strpos($portal,'The report, photos and videos are in the system.') === false, 'the completed portal displays the explanation instead of claiming missing files exist');

// If the unavailable material arrives later, real evidence takes precedence;
// the earlier explanation remains in the audit history.
$late = opuGuardarActualizacion($db, opuOrden($db,37), '', [$file($video)], 'copy', $waived['id']);
$state = opuInspectionState($db, requestRow($waived['id']));
$events = $db->query('SELECT meta_json FROM order_events WHERE order_id=37')->fetchAll(PDO::FETCH_COLUMN);
check(count($late['files']) === 1 && $state['received']['videos'] && $state['requirements']['videos']['count'] === 1 && $state['completion_mode'] === 'files', 'a later actual video replaces the exception in the effective evidence state');
check((bool) array_filter($events, function ($meta) use ($reason) { return strpos((string)$meta,$reason) !== false; }) && count($RECEIPTS_CAPTURE) === $beforeReceipts + 1, 'late evidence keeps the original reason auditable without another completion email');

// Each exception belongs to the current selected boat and request, not merely
// to someone who can supply a numeric request ID.
$scope = opuInspectionRequest($db, opuOrden($db,39));
check(opuInspectionSaveExceptions($db, opuOrden($db,39), $waived['id'], ['videos'=>$reason]) !== [] && opuInspectionState($db,requestRow($scope['id']))['resolved_count'] === 0, 'one operation cannot attach reasons to another operation request');
$db->exec('UPDATE orders SET chosen_link_id=999 WHERE id=39');
check(opuInspectionSaveExceptions($db, opuOrden($db,39), $scope['id'], ['videos'=>$reason]) !== [], 'changing the selected boat invalidates reasons for its previous request');
$db->exec('UPDATE orders SET chosen_link_id=139 WHERE id=39');
$db->exec("UPDATE orders SET refund_requested_at='2026-10-30' WHERE id=39");
check(opuInspectionSaveExceptions($db, opuOrden($db,39), $scope['id'], ['videos'=>$reason]) !== [], 'an operation awaiting a refund cannot be advanced through an exception');
$db->exec("UPDATE orders SET status='cancelled' WHERE id=39");

$closed = opuInspectionRequest($db, opuOrden($db,42));
$db->exec("UPDATE orders SET status='cancelled' WHERE id=42");
check(opuInspectionSaveExceptions($db, opuOrden($db,42), $closed['id'], ['videos'=>$reason]) !== [], 'closed operations cannot be resolved by a stale portal submission');

// A reason is a valid alternative for each requirement, but partial reasons
// must leave the remaining categories open and show exactly what is missing.
$reasonOnly = opuInspectionRequest($db, opuOrden($db,38));
$escapedReason = 'No report is available <script>alert(1)</script> because the inspector could not attend.';
$partialReasons = opuGuardarActualizacion($db, opuOrden($db,38), '', [], 'copy', $reasonOnly['id'], ['report'=>$escapedReason]);
$state = opuInspectionState($db,requestRow($reasonOnly['id']));
check($partialReasons['update_id'] && $state['status'] === 'pending' && $state['received_count'] === 0 && $state['resolved_count'] === 1 && $state['missing'] === ['photos','videos'], 'one reason resolves only its own requirement and leaves the other two pending');
$portal = opuPaginaPortal($db, opuOrden($db,38));
check(strpos($portal,'&lt;script&gt;') !== false && strpos($portal,'<script>alert(1)</script>') === false, 'free-text exception reasons are escaped in the private portal');
$sent = [];
opuInspectionRun($db, at('2026-10-31T11:00:00Z'), $send);
$partialReminders = array_values(array_filter($sent, function ($mail) use ($reasonOnly) { return $mail['metadata']['request_id'] == $reasonOnly['id']; }));
check(count($partialReminders) === 1 && strpos($partialReminders[0]['mail']['html'],'&lt;script&gt;') !== false && strpos($partialReminders[0]['mail']['html'],'<script>alert(1)</script>') === false, 'the reminder preserves an explained requirement as escaped text');
$onlyMissing = opuInspectionEmail([
    'order_number'=>'IMP-TEST-38', 'reminder'=>true, 'portal_url'=>'https://example.com/private',
    'received'=>$state['received'], 'requirements'=>$state['requirements'], 'missing'=>$state['missing'],
]);
check(stripos($onlyMissing['subject'],'photos') !== false && stripos($onlyMissing['subject'],'videos') !== false && stripos($onlyMissing['subject'],'report') === false, 'the reminder subject requests only the still-missing photos and videos');
$reasonOnlyCount = count($RECEIPTS_CAPTURE);
$res = opuGuardarActualizacion($db, opuOrden($db,38), '', [], 'copy', $reasonOnly['id'], [
    'photos'=>'The inspector did not have camera access at this marina.',
    'videos'=>'No testing or video recording was permitted by the seller.',
]);
$state = opuInspectionState($db,requestRow($reasonOnly['id']));
check($res['update_id'] && $state['status'] === 'completed' && $state['received_count'] === 0 && $state['resolved_count'] === 3 && $state['completion_mode'] === 'with_exceptions', 'all explicit reasons can finish the delivery while keeping zero received file types');
check(count($RECEIPTS_CAPTURE) === $reasonOnlyCount + 1 && strpos(end($RECEIPTS_CAPTURE)['mail']['html'],'3 OF 3 RECEIVED') === false && empty(opuOrden($db,38)['import_steps']), 'reason-only completion is acknowledged honestly and never approves acquisition milestones');

// The team notification must expose three separate evidence categories, not
// just an ambiguous combined photos/videos total. Client mail sees only media.
$db->exec("UPDATE orders SET customer_email='buyer40@example.test' WHERE id=40");
$noticeRequest = opuInspectionRequest($db, opuOrden($db,40));
$namedPhoto = $file($photo);
$namedPhoto['name'] = 'inspection <img src=x onerror=alert(1)>.png';
$internalReason = 'The PDF is unavailable <script>alert(2)</script> because only a verbal inspection was supplied.';
$res = opuGuardarActualizacion($db, opuOrden($db,40), '', [$namedPhoto], 'copy', $noticeRequest['id'], ['report'=>$internalReason]);
$staffNotice = end($STAFF_CAPTURE);
$staffHtml = $staffNotice[2];
$staffText = html_entity_decode(strip_tags($staffHtml), ENT_QUOTES, 'UTF-8');
check($res['update_id'] && $staffNotice[0] === 'contacto@imporlan.cl' && strpos($staffText,'En esta actualización: 1 foto(s), 0 video(s), 0 documento(s)') !== false, 'the actual staff upload notification separates batch photo, video and document counts');
check(strpos($staffText,'Informe PDF: No disponible') !== false && strpos($staffText,'Fotos: Recibido · 1 archivo(s)') !== false && strpos($staffText,'Videos: Pendiente') !== false, 'the actual staff email has a separate received, explained or pending status for every requirement');
check(strpos($staffHtml,opuEsc($namedPhoto['name'])) !== false && strpos($staffHtml,opuEsc($internalReason)) !== false && strpos($staffHtml,'<script>alert(2)</script>') === false && strpos($staffHtml,'<img src=x onerror=alert(1)>') === false, 'filenames and internal reasons are present as escaped text in the staff notification');
$clientNotice = end($CLIENT_UPLOAD_CAPTURE);
check($clientNotice[0] === 'buyer40@example.test' && $clientNotice[2]['file_count'] === 1 && count($clientNotice[2]['files']) === 1 && $clientNotice[2]['files'][0]['category'] === 'image', 'a mixed file-and-reason update sends the buyer only the newly uploaded visible media');
check(strpos(json_encode($clientNotice),$internalReason) === false && !isset($clientNotice[2]['requirements']) && strpos($clientNotice[2]['description'],'1 foto') !== false && strpos($clientNotice[2]['description'],'video') === false, 'client mail does not expose unavailability reasons or claim a video arrived when only a photo did');

// Metadata alone is insufficient: a deleted or empty persisted file must not
// satisfy the evidence checklist.
$missingFile = opuInspectionRequest($db, opuOrden($db,41));
$res = opuGuardarActualizacion($db, opuOrden($db,41), '', [$file($pdf)], 'copy', $missingFile['id']);
$stored = $db->query('SELECT stored_name FROM expediente_files WHERE id=' . intval($res['files'][0]['id']))->fetchColumn();
unlink("$box/expediente_files/$stored");
$state = opuInspectionState($db,requestRow($missingFile['id']));
check(!$state['received']['report'] && $state['requirements']['report']['count'] === 0 && $state['resolved_count'] === 0, 'a database row whose original file has disappeared is not counted as a received report');
file_put_contents("$box/expediente_files/$stored", '');
$state = opuInspectionState($db,requestRow($missingFile['id']));
check(!$state['received']['report'] && $state['requirements']['report']['count'] === 0, 'an empty on-disk file is not accepted merely because its database size is positive');

// Canary: removing the video requirement would incorrectly stop a partial request.
check(count(array_filter(['report'=>true,'photos'=>true,'videos'=>false])) !== 3, 'canary protects the video requirement');
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($box, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
foreach ($it as $file) { $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname()); } rmdir($box);
echo ($total-$failures) . "/$total passed\n";
exit($failures ? 1 : 0);
