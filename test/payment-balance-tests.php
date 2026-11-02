<?php
/** Actual locked ledger and reminder planner, fictional bank credits and captured SMTP. */
$box=sys_get_temp_dir().'/partial-payments-'.getmypid();$argv[1]=$box;
require __DIR__.'/fixtures/import-action-bootstrap.php';
copy(dirname(__DIR__).'/api/payment_requests_helper.php',"$box/payment_requests_helper.php");
require "$box/payment_requests_helper.php";
$checks=0;$failed=0;
function check($ok,$label){global $checks,$failed;$checks++;if(!$ok)$failed++;echo($ok?'ok ':'FAIL ').$label."\n";}
function resetLedger($extra=[]){global $box; $r=['id'=>'fixture-p2','user_email'=>'client@example.test','title'=>'Pago 2','status'=>'pending','amount_clp'=>10000,'metadata'=>['order_id'=>'IMP-DEMO','custom_fields'=>['pago'=>2]]];$r=array_replace($r,$extra);file_put_contents("$box/payment_requests.json",json_encode(['requests'=>[$r]]));return $r;}
function inputCredit($amount,$ref,$remaining=10000,$extra=[]){return array_replace(['amount_clp'=>$amount,'received_on'=>'2026-10-20','bank'=>'global66','reference'=>$ref,'note'=>'Verified statement fixture','expected_amount_clp'=>10000,'expected_remaining_clp'=>$remaining,'idempotency_key'=>'credit_key_'.$ref],$extra);}
function addCredit($input){return impPaymentAddCredit('fixture-p2',$input,'owner@example.test');}
function clientPlan($s){foreach(impActionPlan($s) as $p)if($p['audience']==='client')return $p;return null;}
resetLedger();$one=inputCredit(2000,'TEST-BANK-A');[$code,$res]=addCredit($one);
check($code===200 && $res['request']['status']==='pending' && impPaymentBalance($res['request'])['remaining']===8000,'bank credit preserves the request total and keeps the unpaid remainder pending');
check($res['request']['payment_credits'][0]['confirmed_by']==='owner@example.test' && $res['request']['payment_credits'][0]['received_on']==='2026-10-20','bank date and authenticated reviewer are stored separately from upload evidence');
[$code,$again]=addCredit($one);check($code===200 && $again['duplicate'] && count($again['request']['payment_credits'])===1,'acknowledgement retry is idempotent after balance changes');
[$code,$res]=addCredit(array_replace($one,['amount_clp'=>3000]));check($code===409,'an idempotency key cannot register different amounts');
[$code]=addCredit(inputCredit(3000,'TEST-BANK-B'));check($code===409 && impPaymentBalance(impPaymentRead('fixture-p2'))['remaining']===8000,'stale invoice preview cannot apply a concurrent bank credit');
[$code]=addCredit(inputCredit(2000,'TEST-BANK-A',8000,['idempotency_key'=>'another_credit_key']));check($code===409,'the same bank reference cannot be booked with a new idempotency key');
[$code,$res]=addCredit(inputCredit(3000,'TEST-BANK-B',8000));check($code===200 && impPaymentBalance($res['request'])['confirmed']===5000 && impPaymentBalance($res['request'])['remaining']===5000,'multiple transfers accumulate without confirming the entire installment');
$public=impPaymentPublic($res['request']);check(!isset($public['payment_credits'][0]['confirmed_by']) && !isset($public['payment_credits'][0]['idempotency_key']) && $public['payment_credits'][0]['amount_clp']===2000,'customer credit history omits internal review and retry metadata');
[$code,$resolved]=impPaymentGatewayRequest('fixture-p2',['role'=>'user','email'=>'client@example.test']);check($code===200 && $resolved['amount']===5000,'gateway amount comes from the fresh unpaid balance, not a browser amount');
foreach([['role'=>'user','email'=>'other@example.test'],['role'=>'agent','email'=>'client@example.test']] as $actor){[$code]=impPaymentGatewayRequest('fixture-p2',$actor);check($code===403,'foreign customers and operators cannot initiate this invoice');}
$db->exec("UPDATE orders SET import_steps='{\"inspeccion\":\"2026-10-20\"}' WHERE id=1");
$s=impActionSnapshot($db,1);$s['client_data_complete']=true;$p=clientPlan($s);$task=$p['tasks'][0];
check($task['amount_clp']===5000 && $task['confirmed_amount_clp']===5000 && $task['total_amount_clp']===10000,'reminder requests the exact remaining amount of the current installment');
$mail=impActionEmail($p);check(strpos($mail['html'],'Saldo restante de este pago')!==false && strpos($mail['html'],'$5.000 CLP')!==false && strpos($mail['text'],'Saldo restante: $5.000 CLP')!==false,'HTML and plaintext show requested total, confirmed credits and only the net remainder');
check(strpos($task['title'],'Pago 2')!==false && strpos(json_encode($p),'Pago 3')===false,'partial second payment never advances collection to the third installment');
check(in_array('receipt_upload',array_column($p['tasks'],'kind'),true),'confirmed bank credits without a file still ask for their proofs without repeating those transfers');
check(strpos(array_values(array_filter($p['tasks'],function($t){return $t['kind']==='receipt_upload';}))[0]['url'],'?comprobante=fixture-p2')!==false,'proof reminder opens the dedicated upload intent instead of starting another payment');
$hinted=$s;$hinted['payments'][0]['receipts']=[['id'=>'rc_hint','credit_id'=>$hinted['payments'][0]['payment_credits'][0]['id'],'status'=>'pending']];
$hintPlan=clientPlan($hinted);$hintKinds=$hintPlan?array_column($hintPlan['tasks'],'kind'):[];
$missingProofs=implode(' ',array_column(array_filter($hintPlan['tasks'] ?? [],function($t){return $t['kind']==='receipt_upload';}),'detail'));
check(!in_array('payment',$hintKinds,true) && strpos($missingProofs,'$2.000')===false && strpos($missingProofs,'$3.000')!==false,'submitted credit proof suppresses its upload reminder while another missing proof is still requested');
$hinted['payments'][0]['payment_credits'][1]['receipt_id']='rc_hint';$hinted['payments'][0]['receipts'][0]['status']='reviewed';
$reassigned=clientPlan($hinted);$proofDetails=implode(' ',array_column(array_filter($reassigned['tasks'] ?? [],function($t){return $t['kind']==='receipt_upload';}),'detail'));
check(strpos($proofDetails,'$2.000')!==false && strpos($proofDetails,'$3.000')===false,'finance association to a different credit supersedes the customer hint and resumes the genuinely missing proof');
$now=new DateTimeImmutable('2026-10-29T12:00:00Z');$loader=function($id)use($db){$s=impActionSnapshot($db,$id);$s['client_data_complete']=true;return $s;};$sent=[];$sender=function($to,$mail)use(&$sent){$sent[]=$mail;return true;};
impActionConfigure($db,['role'=>'admin','email'=>'owner@example.test'],true,impActionTemplateHash());
$hash=impActionPreview($db,1,'client',$loader)['fingerprint'];check(impActionSend($db,1,'client',$hash,$now,$sender,$loader)['sent'],'enabled reminders send the current net balance');
check(impActionSend($db,1,'client',$hash,$now,$sender,$loader)['reason']==='already_attempted','partial balances do not bypass the once-per-day delivery claim');
$pending=['id'=>'rc_fixture','status'=>'pending','currency'=>'CLP','declared_amount_clp'=>5000];$r=impPaymentRead('fixture-p2');$r['receipts']=[$pending];file_put_contents("$box/payment_requests.json",json_encode(['requests'=>[$r]]));
check(impPaymentProofPending($r) && impPaymentBalance($r)['remaining']===5000,'new evidence pauses collection and never deducts unverified money');
[$code]=impPaymentGatewayRequest('fixture-p2',['role'=>'user','email'=>'client@example.test']);check($code===409,'pending evidence prevents a duplicate gateway payment');
$s=$loader(1);$p=clientPlan($s);check(!in_array('payment',array_column($p['tasks'],'kind'),true),'proof pending review suppresses the differential demand');
[$code,$res]=addCredit(inputCredit(5000,'TEST-BANK-C',5000,['receipt_id'=>'rc_fixture']));check($code===200 && $res['newly_paid'] && $res['request']['status']==='paid' && !impPaymentProofPending($res['request']),'last verified credit covers the installment and reconciles its matching proof');
$s=$loader(1);$p=clientPlan($s);check(!$p || !in_array('payment',array_column($p['tasks'],'kind'),true),'fully covered installments stop payment reminders immediately');
$before=count($res['request']['payment_credits']);[$code,$repeat]=addCredit(inputCredit(5000,'TEST-BANK-C',5000,['receipt_id'=>'rc_fixture']));check($code===200 && count($repeat['request']['payment_credits'])===$before && !$repeat['newly_paid'],'final-credit retry cannot book or acknowledge the payment again');
resetLedger();foreach(['0','-1','100.50','100,50','1e3',' 1000'] as $amount){[$code]=addCredit(inputCredit($amount,'BAD-'.str_replace([' ','.',','],'x',$amount)));check($code===400,'bank credits require integer CLP without ambiguous formatting');}
[$code]=addCredit(inputCredit(1000,'TEST-INVALID-DATE',10000,['received_on'=>'2026-02-31']));check($code===400,'invalid bank dates are rejected');
[$code]=addCredit(inputCredit(1000,'TEST-FUTURE-DATE',10000,['received_on'=>'2999-01-01']));check($code===400,'future bank dates are rejected');
resetLedger();[$code,$over]=addCredit(inputCredit(12000,'TEST-OVERPAY'));check($code===200 && impPaymentBalance($over['request'])['remaining']===0 && impPaymentBalance($over['request'])['excess']===2000,'actual overpayment remains recorded and is never silently assigned to another installment');
$s=$loader(1);$plans=impActionPlan($s);$owner=array_values(array_filter($plans,function($p){return $p['audience']==='owner';}));check(in_array('reconcile_excess',array_column($owner[0]['tasks'],'kind'),true),'overpayment requests internal reconciliation rather than collecting more');
resetLedger(['receipts'=>[['id'=>'rc_prior','status'=>'pending','currency'=>'CLP','declared_amount_clp'=>2000]]]);[$code,$first]=addCredit(inputCredit(2000,'TEST-PROOF-LATER'));$creditId=$first['credit']['id'];$associated=impPaymentAssociateCredit('fixture-p2',$creditId,'rc_prior','owner@example.test','Matched to verified bank statement');check(!empty($associated['request']) && !impPaymentProofPending($associated['request']) && impPaymentBalance($associated['request'])['confirmed']===2000,'a later proof can be linked to existing money without booking the amount twice');
resetLedger();addCredit(inputCredit(2000,'TEST-GATEWAY-BASE'));$mails=isset($GLOBALS['ACTION_SMTP'])?count($GLOBALS['ACTION_SMTP']):0;
handlePaymentRequestPaid('fixture-p2','TEST-GATEWAY-CAPTURE','webpay',null,8000);
check(impPaymentRead('fixture-p2')['status']==='paid' && impPaymentBalance(impPaymentRead('fixture-p2'))['confirmed']===10000,'verified gateway capture settles only the remaining invoice balance');
handlePaymentRequestPaid('fixture-p2','TEST-GATEWAY-CAPTURE','webpay',null,8000);
check(count(impPaymentRead('fixture-p2')['payment_credits'])===2 && count($GLOBALS['ACTION_SMTP'])===$mails+2 && count(array_filter($GLOBALS['ACTION_SMTP'],function($m){return $m['to']==='client@example.test';}))===1,'gateway callback retry preserves credits and sends one full-payment confirmation');
resetLedger();$attemptA=impPaymentAttemptOrder();$attemptB=impPaymentAttemptOrder();
check($attemptA!==$attemptB && strlen($attemptA)===26 && strlen($attemptB)===26,'separate WebPay attempts get distinct server-issued Transbank-compatible order identifiers');
handlePaymentRequestPaid('fixture-p2',$attemptA,'webpay',null,4000);
handlePaymentRequestPaid('fixture-p2',$attemptA,'webpay',null,4000);
check(impPaymentBalance(impPaymentRead('fixture-p2'))['confirmed']===4000,'repeated callback for one WebPay attempt cannot duplicate a partial capture');
handlePaymentRequestPaid('fixture-p2',$attemptB,'webpay',null,6000);
check(impPaymentRead('fixture-p2')['status']==='paid' && count(impPaymentRead('fixture-p2')['payment_credits'])===2,'a second distinct WebPay capture on the same invoice is recorded and settles its actual remainder');
echo "$checks partial-payment checks, $failed failures\n";exit($failed?1:0);
