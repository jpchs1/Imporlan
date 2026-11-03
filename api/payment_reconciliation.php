<?php
/** A fully confirmed installment gets one native notice per audience. Files alone never book money. */
require_once __DIR__.'/purchase_clearance.php';
require_once __DIR__.'/operador_usa.php';
require_once __DIR__.'/payment_reconciliation_template.php';

function impReconciliationNumber($r) {
    $n=intval($r['metadata']['custom_fields']['pago'] ?? 0);
    if(!$n && preg_match('/pago\s*([123])\b/i',$r['title'] ?? '',$m))$n=intval($m[1]);
    return in_array($n,[1,2,3],true)?$n:0;
}
function impReconciliationIsImport($r) {return impReconciliationNumber($r)>0 && !empty($r['metadata']['order_id'] ?? $r['metadata']['order_number'] ?? null);}
function impReconciliationContext($id) {
    $r=impPaymentRead($id);if(!$r || !impReconciliationIsImport($r))return null;
    $ref=$r['metadata']['order_id'] ?? $r['metadata']['order_number'];
    if(!is_scalar($ref))return null;
    $pdo=getDbConnection();if(!$pdo)return null;
    $st=$pdo->prepare(ctype_digit((string)$ref)?'SELECT * FROM orders WHERE id=?':'SELECT * FROM orders WHERE order_number=?');$st->execute([ctype_digit((string)$ref)?$ref:strtoupper(trim((string)$ref))]);$o=$st->fetch(PDO::FETCH_ASSOC);
    if(!$o || in_array($o['status'] ?? '',['expired','canceled','cancelled'],true) || empty($o['visible_to_client']) || !empty($o['refund_requested_at']) || impInspeccionNoApta($o) || strtolower($o['customer_email'])!==strtolower($r['user_email']) || !impTieneEleccion($o))return null;
    $n=impReconciliationNumber($r);$link=impLeerLink($pdo,$o['id'],$o['chosen_link_id']);$plan=$link?impPlanPago($link,$n):null;
    $chargeLink=intval($r['metadata']['custom_fields']['link_id'] ?? 0);
    if(!$plan || intval($r['amount_clp'])!==$plan['clp'] || ($n>1 && $chargeLink && $chargeLink!==intval($o['chosen_link_id'])))return null;
    $credits=impPaymentCredits($r);$confirmed=!empty($r['payment_credits'])?array_sum(array_column($credits,'amount_clp')):(($r['status'] ?? '')==='paid'?intval($r['amount_clp']):0);
    if(($r['status'] ?? '')!=='paid' || $confirmed<intval($r['amount_clp']))return null;
    $duplicates=impConCobros(function(&$store)use($o,$n,$id){$count=0;foreach($store['requests'] as $other)if(($other['id'] ?? '')!==$id && ($other['status'] ?? '')==='paid' && strtolower($other['user_email'] ?? '')===strtolower($o['customer_email']) && impEsPagoDelExpediente($other,$o['id'],$n,$o['order_number']))$count++;return $count;});
    if($duplicates===null || $duplicates>0)return null;
    return ['request'=>$r,'order'=>$o,'link'=>$link,'number'=>$n,'confirmed'=>$confirmed,'evidence'=>impPaymentSettlement($r)];
}
function impReconciliationSchema($pdo) {
    $engine=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'?'':' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    $pdo->exec("CREATE TABLE IF NOT EXISTS payment_reconciliation_notices (request_id VARCHAR(128) NOT NULL,audience VARCHAR(16) NOT NULL,recipient_hash VARCHAR(64) NOT NULL,status VARCHAR(16) NOT NULL,attempted_at DATETIME NOT NULL,sent_at DATETIME NULL,PRIMARY KEY(request_id,audience))$engine");
}
function impReconciliationStates($pdo,$id) {
    impReconciliationSchema($pdo);$st=$pdo->prepare('SELECT audience,status,attempted_at,sent_at FROM payment_reconciliation_notices WHERE request_id=?');$st->execute([$id]);
    return $st->fetchAll(PDO::FETCH_ASSOC);
}
function impReconciliationOwner() {return defined('IMPORLAN_WORKFLOW_OWNER_EMAIL')?IMPORLAN_WORKFLOW_OWNER_EMAIL:'jpchs1@gmail.com';}
function impReconciliationRecipient($context,$audience) {
    if($audience==='client')return $context['order']['customer_email'];
    if($audience==='owner')return impReconciliationOwner();
    if($audience==='coordinator')return opuOperador()['email'];
    return '';
}
function impReconciliationFingerprint($context,$audience) {
    return hash('sha256',json_encode([$context['request'],$context['order']['chosen_link_id'],$context['link']['quote_payments'],$audience,strtolower(impReconciliationRecipient($context,$audience))]));
}
function impReconciliationSend($id,$retry=false,$sender=null) {
    $context=impReconciliationContext($id);if(!$context)return ['eligible'=>false,'sent'=>0,'failed'=>0];
    $pdo=getDbConnection();impReconciliationSchema($pdo);$result=['eligible'=>true,'sent'=>0,'failed'=>0,'covered'=>0];
    foreach(['client','owner','coordinator'] as $audience) {
        $to=impReconciliationRecipient($context,$audience);$recipient=hash('sha256',strtolower($to));$now=gmdate('Y-m-d H:i:s');
        if($retry){$claim=$pdo->prepare("UPDATE payment_reconciliation_notices SET status='attempted',attempted_at=?,sent_at=NULL WHERE request_id=? AND audience=? AND recipient_hash=? AND status='failed'");$claim->execute([$now,$id,$audience,$recipient]);}
        else {$insert=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'?'INSERT OR IGNORE':'INSERT IGNORE';$claim=$pdo->prepare("$insert INTO payment_reconciliation_notices (request_id,audience,recipient_hash,status,attempted_at) VALUES (?,?,?,'attempted',?)");$claim->execute([$id,$audience,$recipient,$now]);}
        if(!$claim->rowCount())continue;
        $fresh=impReconciliationContext($id);$ok=false;$status='failed';$coveredAt=null;
        if($fresh && hash_equals(impReconciliationFingerprint($context,$audience),impReconciliationFingerprint($fresh,$audience))) {
            try {
                $purchaseReady=$audience==='coordinator' && opuHitoEnCurso($fresh['order'])==='compra' && !opuPriceGate($pdo,$fresh['order']) && !opuInspectionOwnsStage($pdo,$fresh['order']) && impPurchaseClearanceFor($pdo,$fresh['order'])['ready'];
                if($fresh['number']<=2 && $purchaseReady && !$sender) {
                    // The purchase handoff is the coordinator's one completion notice when buying is authorized.
                    $ok=impResumePurchase($fresh['request'],$retry);
                    $handoff=impPurchaseHandoffState($pdo,$fresh['order']);
                    if(!$ok && ($handoff['status'] ?? '')==='sent'){$status='covered';$coveredAt=$handoff['sent_at'];}
                } else {
                    // Coordinator rendering only receives an operational projection, never buyer amounts/contact.
                    if($audience==='coordinator')$mail=impReconciliationCoordinatorEmail(['order_number'=>$fresh['order']['order_number'],'portal'=>opuUrlPortal(opuToken($pdo,$fresh['order'])),'purchase_hold'=>opuHitoEnCurso($fresh['order'])==='compra' && !$purchaseReady,'start_operation'=>$fresh['number']===1 && !isHistoricalFirstPayment($fresh['request'])]);
                    else $mail=impReconciliationFinancialEmail($fresh,$audience);
                    if($sender)$ok=(bool)$sender($to,$mail,$audience);
                    else {require_once __DIR__.'/email_service.php';$sent=(new EmailService())->sendImportActionEmail($to,$mail,['audience'=>$audience,'order_id'=>$fresh['order']['id'],'event'=>'payment_reconciled','request_id'=>$id]);$ok=!empty($sent['success']);}
                }
                if($status!=='covered')$status=$ok?'sent':'failed';
            }catch(Throwable $e){$status='failed';error_log('[payment-reconciliation] delivery failed');}
        }
        $pdo->prepare('UPDATE payment_reconciliation_notices SET status=?,sent_at=? WHERE request_id=? AND audience=?')->execute([$status,$coveredAt ?: ($ok?gmdate('Y-m-d H:i:s'):null),$id,$audience]);
        $result[$status==='covered'?'covered':($ok?'sent':'failed')]++;
    }
    return $result;
}
