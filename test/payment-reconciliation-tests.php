<?php
/** Native reconciliation notices, fictional records, intercepted SMTP; never sends real mail. */
$box=sys_get_temp_dir().'/payment-reconciled-'.getmypid();$argv[1]=$box;require __DIR__.'/fixtures/import-action-bootstrap.php';require "$box/payment_reconciliation.php";
$db->exec("UPDATE orders SET import_steps='{\"disponibilidad\":\"2026-10-20\",\"inspeccion\":\"2026-10-21\"}' WHERE id=1");
$checks=0;$failed=0;function check($v,$label){global $checks,$failed;$checks++;if(!$v)$failed++;echo($v?'ok ':'FAIL ').$label."\n";}
function saveRequest($r){global $box;file_put_contents("$box/payment_requests.json",json_encode(['requests'=>[$r]]));}
$r=['id'=>'notice-demo-p2','title'=>'Pago 2','amount_clp'=>26891827,'user_email'=>'client@example.test','status'=>'pending','metadata'=>['order_id'=>'IMP-DEMO','custom_fields'=>['pago'=>2,'link_id'=>11]],'payment_credits'=>[['id'=>'first','status'=>'confirmed','bank'=>'global66','amount_clp'=>10000000]]];saveRequest($r);
check(!impReconciliationSend($r['id'])['eligible'] && empty($GLOBALS['ACTION_SMTP']),'partial income never emits a completion notice');
$r['status']='paid';saveRequest($r);check(!impReconciliationSend($r['id'])['eligible'],'a paid flag cannot hide an incomplete confirmed ledger');
$r['payment_credits'][0]['amount_clp']=26891827;saveRequest($r);
$result=impReconciliationSend($r['id']);check($result['sent']===3 && !$result['failed'],'full confirmed income sends one notice to each audience');
$mail=$GLOBALS['ACTION_SMTP'];check(count($mail)===3 && $mail[0]['to']==='client@example.test' && $mail[1]['to']==='jpchs1@gmail.com' && $mail[2]['to']===opuOperador()['email'],'recipients are the order owner, workflow admin and configured coordinator');
check($mail[0]['bccEmails']===['jpchs1@gmail.com'],'the required owner copy remains on the customer confirmation');
check(strpos($mail[0]['subject'],'Cuadre listo')!==false && strpos($mail[1]['subject'],'Cuadre listo')!==false,'financial recipients receive the requested completion subject');
$c=impReconciliationContext($r['id']);$customer=impReconciliationFinancialEmail($c,'client');$admin=impReconciliationFinancialEmail($c,'owner');
check(strpos($customer['text'],'$26.891.827')!==false && strpos($admin['text'],'$26.891.827')!==false && strpos($customer['text'],'Saldo por pagar: $0')!==false,'client and admin see the exact confirmed total and zero installment balance');
check(strpos($customer['text'],'comprobante(s) faltante(s)')!==false && strpos($customer['text'],'compra continúa en espera')!==false,'income completion never claims missing evidence or purchase authorization is resolved');
check(strpos($mail[0]['body'],'Content-ID: <imporlan-signature-jp>')!==false && strpos($mail[0]['body'],'Content-Type: text/plain; charset=UTF-8')!==false,'customer receives graphic signature and the actual plain-text alternative');
$coordinator=impReconciliationCoordinatorEmail(['order_number'=>'IMP-DEMO','boat'=>'Boat sample','portal'=>'https://www.imporlan.cl/api/operador_usa.php?r=portal&k=FIXTURE','purchase_hold'=>true]);
check(strpos($coordinator['text'],'Please wait')!==false && !preg_match('/CLP|USD|26.891.827|client@example.test|Cliente Ejemplo/',$coordinator['html'].$coordinator['text']),'coordinator only receives a hold instruction without buyer values or contact');
check(impReconciliationSend($r['id'])['sent']===0 && count($GLOBALS['ACTION_SMTP'])===3,'replaying completion cannot duplicate any audience');
check(count(impReconciliationStates($db,$r['id']))===3,'the staff can inspect all three persisted delivery states');
$db->exec('DELETE FROM payment_reconciliation_notices');$attempted=[];
$result=impReconciliationSend($r['id'],false,function($to,$mail,$audience)use(&$attempted){$attempted[]=$audience;return $audience!=='owner';});
check($result['sent']===2 && $result['failed']===1,'partial SMTP failure does not claim every recipient received the notice');
impReconciliationSend($r['id']);check(count($attempted)===3,'automatic completion does not retry uncertain deliveries');
$retried=[];$result=impReconciliationSend($r['id'],true,function($to,$mail,$audience)use(&$retried){$retried[]=$audience;return true;});
check($result['sent']===1 && $retried===['owner'],'explicit retry reclaims only the failed recipient');
check(impReconciliationSend($r['id'],true,function(){return true;})['sent']===0,'successful explicit retries remain deduplicated');
$db->exec("UPDATE payment_reconciliation_notices SET status='attempted'");check(impReconciliationSend($r['id'],true,function(){return true;})['sent']===0,'an in-progress send cannot be reclaimed as a failed delivery');
$db->exec('DELETE FROM payment_reconciliation_notices');$r['user_email']='other@example.test';saveRequest($r);check(!impReconciliationSend($r['id'])['eligible'],'a request for another customer cannot notify this order');
$r['user_email']='client@example.test';$r['metadata']['custom_fields']['link_id']=99;saveRequest($r);check(!impReconciliationSend($r['id'])['eligible'],'the installment must match the chosen boat');
$r['metadata']['custom_fields']['link_id']=11;$r['amount_clp']=20000000;saveRequest($r);check(!impReconciliationSend($r['id'])['eligible'],'a charge changed from the published plan requires internal review');
$r['amount_clp']=26891827;$r['payment_credits'][0]['amount_clp']=28000000;saveRequest($r);$over=impReconciliationFinancialEmail(impReconciliationContext($r['id']),'client');check(strpos($over['text'],'Excedente registrado: $1.108.173')!==false,'overpayment remains explicit in both email alternatives');
$duplicate=$r;$duplicate['id']='duplicate-paid';file_put_contents("$box/payment_requests.json",json_encode(['requests'=>[$r,$duplicate]]));check(!impReconciliationSend($r['id'])['eligible'],'two paid requests for one installment require reconciliation instead of duplicate completion notices');
$r['metadata']['custom_fields']['pago']=3;$r['amount_clp']=12805632;$r['payment_credits'][0]['amount_clp']=12805632;saveRequest($r);$db->exec("UPDATE orders SET status='completed',import_steps='{\"disponibilidad\":\"2026-10-20\",\"inspeccion\":\"2026-10-21\",\"compra\":\"2026-10-22\",\"transporte\":\"2026-10-23\",\"aduana\":\"2026-10-24\",\"entrega\":\"2026-10-25\"}' WHERE id=1");check((bool)impReconciliationContext($r['id']),'a final installment may be confirmed after delivery without reopening the operation');
$db->exec("UPDATE orders SET status='cancelled' WHERE id=1");check(!impReconciliationContext($r['id']),'cancelled operation cannot issue a completion notice');
echo "$checks reconciliation checks, $failed failures\n";exit($failed?1:0);
