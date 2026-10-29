<?php
/** Real planner, SQLite claims, race revalidation and native MIME; no email/network escapes the fixture. */
$box=sys_get_temp_dir().'/import-action-'.getmypid();
$argv[1]=$box;
require __DIR__.'/fixtures/import-action-bootstrap.php';
$total=0; $failed=0;
function check($ok,$label) { global $total,$failed; $total++; if (!$ok) $failed++; echo ($ok?'ok ':'FAIL ').$label."\n"; }
function audience($snapshot,$who='client') { foreach (impActionPlan($snapshot) as $p) if ($p['audience']===$who) return $p; return null; }
function kinds($p) { return $p ? array_column($p['tasks'],'kind') : []; }
function payment($n=1,$status='pending',$ref='IMP-DEMO') { return ['id'=>'fixture-p'.$n,'title'=>'Pago '.$n,'status'=>$status,'amount_clp'=>2987981,'user_email'=>'client@example.test','metadata'=>['order_id'=>$ref,'custom_fields'=>['pago'=>$n]]]; }
function clearDeliveries($db) { $db->exec('DELETE FROM import_action_deliveries'); }
register_shutdown_function(function() use($box) { foreach (glob("$box/email-assets/*") as $f) unlink($f); rmdir("$box/email-assets"); foreach(glob("$box/*") as $f) unlink($f); rmdir($box); });
file_put_contents("$box/payment_requests.json",json_encode(['requests'=>[payment()]]));
$advanced=impActionSnapshot($db,1);$advanced['client_data_complete']=true;
check(audience($advanced)===null && in_array('reconcile_payment',kinds(audience($advanced,'owner')),true),'inspection already performed suppresses old pending Pago 1 and asks owner to reconcile');
$s=$advanced; $s['order']['inspection_client_ok_at']=null;$s['order']['inspection_report_at']=null; $s['client_data_complete']=true;
$p=audience($s);
check(kinds($p)===['payment'] && $p['tasks'][0]['amount_clp']===2987981,'initial selection leads to existing first payment, exact persisted amount');
check($p['to']==='client@example.test' && $p['tasks'][0]['url']==='https://www.imporlan.cl/panel/#/payments?pagar=fixture-p1','recipient comes from order and CTA opens its existing charge');
check(!in_array('charge',kinds(audience($s,'owner')),true),'no new Pago 2 while owner price/inspection milestone remain pending');
$s['client_data_complete']=false; check(kinds(audience($s))===['payment','data'],'payment is primary and incomplete import data is secondary');
$s['order']['inspection_client_ok_at']=null; $s['order']['inspection_report_at']='2026-10-29'; check(in_array('inspection',kinds(audience($s)),true),'report ready without decision asks the customer to review');
$s['order']['import_steps']=json_encode(['inspeccion'=>'2026-10-29']); check(!in_array('inspection',kinds(audience($s)),true),'registered inspection milestone suppresses repeat approval');
check(in_array('charge',kinds(audience($s,'owner')),true),'due Pago 2 without a request prompts owner review rather than creates a charge');
$base=impActionSnapshot($db,1); $base['client_data_complete']=true;$base['order']['inspection_client_ok_at']=null;$base['order']['inspection_report_at']=null;
$s=$base; $s['payments']=[payment(1,'paid'),payment()]; check(audience($s)===null,'paid payment overrides stale pending duplicate');
foreach (['cancelled','paid'] as $status) { $s=$base; $s['payments']=[payment(1,$status)]; check(audience($s)===null,"$status charge never asks for payment"); }
foreach ([payment(1,'pending','OTHER'),array_replace(payment(),['user_email'=>'other@example.test']),array_replace(payment(),['amount_clp'=>0])] as $r) { $s=$base; $s['payments']=[$r]; check(audience($s)===null,'foreign recipient/order or zero amount cannot become a client reminder'); }
$s=$base; $s['payments'][0]['metadata']=['order_id'=>999,'order_number'=>'IMP-DEMO','custom_fields'=>['pago'=>1]]; check(audience($s)===null,'explicit foreign internal order id wins over matching public reference');
$s=$base; $s['payments']=[payment(2),payment()]; check(audience($s)['tasks'][0]['payment_id']==='fixture-p1','oldest payment number takes priority');
$s['payments'][1]['receipt_received_at']='2026-10-29'; check(audience($s)===null && in_array('receipt',kinds(audience($s,'owner')),true),'receipt waits for owner validation and does not request a later payment');
$s=$base; $s['order']['inspection_result']='no_apta'; check(kinds(audience($s))===['choice'],'declined boat asks for next choice instead of collection');
$s['order']['refund_requested_at']='2026-10-29'; check(audience($s)===null && kinds(audience($s,'owner'))===['refund'],'refund waits for owner and suppresses client reminders');
foreach (['completed','expired','cancelled','canceled'] as $status) { $s=$base; $s['order']['status']=$status; check(impActionPlan($s)===[],"$status closes all action reminders"); }
$s=$base; $s['order']['visible_to_client']=0; check(impActionPlan($s)===[],'hidden operation never notifies');
$s=$base; $s['order']['import_steps']=json_encode(['entrega'=>'2026-10-29']); check(impActionPlan($s)===[],'delivered operation never notifies');
$s=$base; $s['link']['order_id']=2; check(impActionPlan($s)===[],'boat from another operation never notifies');
$s=$base; $s['price']=['confirmed'=>true,'ready'=>false,'confirmed_cents'=>123456789];
check(in_array('price',kinds(audience($s,'owner')),true) && strpos(json_encode(audience($s)), '123456789')===false,'unapproved proposal goes only to owner with no client price leak');
$mail=impActionEmail(audience($base));
check(strpos($mail['html'],'$2.987.981 CLP')!==false && strpos($mail['text'],'$2.987.981 CLP')!==false,'HTML and real plaintext have the same payment amount');
$approved=$advanced;$approved['payments']=[payment(2),payment(1,'paid')];$approvedMail=impActionEmail(audience($approved));
check(strpos($approvedMail['html'],'Tu aprobación de la inspección ya está registrada')!==false && strpos($approvedMail['html'],'Revisar y decidir')===false && strpos($approvedMail['html'],'Realizar Pago 2')!==false,'approved inspection asks for Pago 2, never a repeated Pago 1');
check(strpos($mail['html'],'no vuelvas a pagar')!==false && strpos($mail['html'],'Global66')!==false,'receipt guidance explicitly avoids duplicate payment');
$escaped=audience($base); $escaped['boat']='<script>alert(1)</script>'; check(strpos(impActionEmail($escaped)['html'],'<script>')===false,'persisted dynamic text is escaped');
check(impActionSettings($db)['enabled']===false,'automatic delivery defaults disabled');
$owner=['role'=>'admin','email'=>'owner@example.test'];
foreach ([['role'=>'support','email'=>$owner['email']],['role'=>'agent','email'=>$owner['email']],['role'=>'admin','email'=>'other@example.test']] as $actor) check(impActionConfigure($db,$actor,true,impActionTemplateHash())!==null,'only principal admin may enable reminders');
check(impActionConfigure($db,$owner,true,'stale')!==null,'configuration rejects a stale template');
check(impActionConfigure($db,$owner,true,impActionTemplateHash())===null && impActionSettings($db)['enabled'],'principal enables exact deployed template');
$db->exec("UPDATE import_action_settings SET template_hash='previous-version' WHERE id=1");
check(impActionSettings($db)['enabled'],'authorized ongoing reminders survive template maintenance without requiring another activation');
$sent=[]; $sender=function($to,$mail,$plan)use(&$sent){$sent[]=compact('to','mail','plan');return true;};
$loader=function($id)use(&$base){return $base;};
$now=new DateTimeImmutable('2026-10-29T12:00:00Z');
$hash=impActionPreview($db,1,'client',$loader)['fingerprint'];
check(impActionSend($db,1,'client','stale',$now,$sender,$loader)['reason']==='changed' && count($sent)===0,'stale manual preview never reaches SMTP');
check(impActionSend($db,1,'client',$hash,$now,$sender,$loader)['sent'] && count($sent)===1,'fresh persisted action sends once');
check(impActionSend($db,1,'client',$hash,$now,$sender,$loader)['reason']==='already_attempted' && count($sent)===1,'same-day retry cannot duplicate a send');
check(impActionDelivery($db,impActionPrepare(audience($base)),$now)['status']==='sent','delivery audit exposes confirmed SMTP status');
check(impActionSend($db,1,'client',$hash,$now->modify('+1 day'),$sender,$loader)['sent'],'still-pending action may remind on a new Chile day');
clearDeliveries($db); $competing=null;
$concurrent=function($to,$mail,$plan)use($db,$hash,$now,$sender,$loader,&$competing){$competing=impActionSend($db,1,'client',$hash,$now,$sender,$loader);return true;};
check(impActionSend($db,1,'client',$hash,$now,$concurrent,$loader)['sent'] && $competing['reason']==='already_attempted','daily claim is reserved before SMTP so a competing sender cannot duplicate it');
clearDeliveries($db); $calls=0; $race=function($id)use($base,&$calls){$s=$base; if(++$calls>1)$s['payments'][0]['status']='paid';return $s;};
check(impActionSend($db,1,'client',$hash,$now,$sender,$race)['reason']==='skipped' && count($sent)===2,'payment recorded between claim and send suppresses stale email');
foreach (['cancelled','completed','boat','approval'] as $change) {
 clearDeliveries($db); $calls=0; $race=function($id)use($base,&$calls,$change){$s=$base;if(++$calls>1){if($change==='cancelled')$s['payments'][0]['status']='cancelled';if($change==='completed')$s['order']['status']='completed';if($change==='boat')$s['order']['chosen_link_id']=22;if($change==='approval')$s['order']['inspection_client_ok_at']='2026-10-29';}return $s;};
 check(impActionSend($db,1,'client',$hash,$now,$sender,$race)['reason']==='skipped',"$change change is revalidated immediately before delivery");
}
clearDeliveries($db); $failure=function(){throw new RuntimeException('uncertain SMTP');};
check(impActionSend($db,1,'client',$hash,$now,$failure,$loader)['reason']==='failed','SMTP failure is recorded without changing business state');
check(impActionSend($db,1,'client',$hash,$now,$sender,$loader)['reason']==='already_attempted','uncertain SMTP is never automatically retried the same day');
clearDeliveries($db); $before=count($sent);
foreach (['2026-10-29T11:29:00Z','2026-10-29T21:00:00Z','2026-06-15T12:29:00Z','2026-06-15T22:00:00Z'] as $time) check(impActionRun($db,new DateTimeImmutable($time),$sender,$loader)['action_sent']===0,'outside Chile daytime including seasonal UTC offset sends nothing');
check(impActionRun($db,new DateTimeImmutable('2026-10-29T11:30:00Z'),$sender,$loader)['action_sent']===1 && count($sent)===$before+1,'cron sends the current client task starting at 08:30 Chile');
check(impActionRun($db,$now,$sender,$loader)['action_sent']===0,'next hosting cron tick does not resend');
clearDeliveries($db); impActionConfigure($db,$owner,false,impActionTemplateHash());
check(impActionRun($db,$now,$sender,$loader)['action_sent']===0,'disabled schedule never sends');
$bytes=file_get_contents("$box/payment_requests.json"); $orders=$db->query('SELECT * FROM orders')->fetchAll();
$_SERVER['SCRIPT_FILENAME']="$box/import_actions_api.php"; require "$box/email_service.php";
$native=new EmailService(); $result=$native->sendImportActionEmail('client@example.test',$mail,['audience'=>'client','order_id'=>1]);
$capture=end($GLOBALS['ACTION_SMTP']);
check($result['success'] && $capture['to']==='client@example.test' && $capture['bccEmails']===['jpchs1@gmail.com'],'native SMTP recipient and required owner BCC are preserved');
check(strpos($capture['body'],'Content-ID: <imporlan-signature-jp>')!==false && strpos($capture['body'],'Content-Type: text/plain; charset=UTF-8')!==false && strpos($capture['body'],'Content-Type: multipart/alternative;')!==false,'native MIME contains inline graphic signature and actual plaintext alternative');
$from=array_values(array_filter($capture['headers'],function($h){return strpos($h,'From:')===0;}))[0];
check(strpos($from,base64_encode('Juan Pablo · Imporlan'))!==false && strpos($from,'contacto@imporlan.cl')!==false,'customer sender is Juan Pablo using native authenticated account');
check($bytes===file_get_contents("$box/payment_requests.json") && $orders===$db->query('SELECT * FROM orders')->fetchAll(),'planning and sending never alter payment requests or order state');
file_put_contents("$box/payment_requests.json",'{broken'); $broken=false; try{impActionSnapshot($db,1);}catch(Throwable $e){$broken=true;}
check($broken,'unreadable payment store aborts rather than inventing missing charges');
echo "$total action reminder checks, $failed failures\n";
exit($failed?1:0);
