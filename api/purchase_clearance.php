<?php
/** Purchase readiness comes from confirmed income and reviewed evidence, never from an uploaded file alone. */
require_once __DIR__.'/payment_balance.php';
require_once __DIR__.'/eleccion_lancha.php';

function impPaymentSettlement($request) {
    $credits=impPaymentCredits($request);
    $total=intval($request['amount_clp'] ?? 0);
    $confirmed=!empty($request['payment_credits']) ? array_sum(array_column($credits,'amount_clp')) : (($request['status'] ?? '')==='paid'?$total:0);
    $missing=0;$review=0;
    if($credits) {
        foreach($credits as $c) {
            if(in_array($c['bank'] ?? '',['webpay','mercadopago','paypal'],true))continue;
            $proof=null;foreach($request['receipts'] ?? [] as $r)if(($r['id'] ?? '')===($c['receipt_id'] ?? null))$proof=$r;
            if(!$proof || ($proof['status'] ?? '')==='rejected') {
                if(!impPaymentCreditProofSubmitted($request,$c))$missing++;
            } elseif(($proof['status'] ?? '')!=='reviewed')$review++;
        }
        foreach($request['receipts'] ?? [] as $r)if(($r['status'] ?? '')!=='rejected' && !impPaymentReceiptLinked($request,$r))$review++;
    } elseif(($request['status'] ?? '')==='paid' && !in_array($request['payment_method'] ?? '',['webpay','mercadopago','paypal'],true)) {
        $proofs=array_values(array_filter($request['receipts'] ?? [],function($r){return ($r['status'] ?? '')!=='rejected';}));
        if(!$proofs)$missing++;
        foreach($proofs as $r)if(($r['status'] ?? '')!=='reviewed' || ((($r['currency'] ?? 'CLP')==='USD' || intval($r['declared_amount_clp'] ?? 0)!==$total) && mb_strlen(trim($r['review_note'] ?? ''))<10))$review++;
    }
    return ['settled'=>$total>0 && ($request['status'] ?? '')==='paid' && $confirmed>=$total && !$missing && !$review,'remaining_clp'=>max(0,$total-$confirmed),'missing_proofs'=>$missing,'review_pending'=>$review];
}

/** Pure projection of the two agreed installments needed before purchasing. */
function impPurchaseClearance($order,$link,$requests) {
    $out=['ready'=>false,'remaining_clp'=>0,'missing_proofs'=>0,'review_pending'=>0,'missing_payments'=>[],'issues'=>[]];
    if(!$link || intval($link['id'] ?? 0)!==intval($order['chosen_link_id'] ?? 0)) {$out['issues'][]='Revisa la lancha elegida.';return $out;}
    foreach([1,2] as $n) {
        $plan=impPlanPago($link,$n);
        if(!$plan){$out['issues'][]='Publica el plan acordado del Pago '.$n.'.';continue;}
        $candidates=array_values(array_filter($requests,function($r)use($order,$n){return impEsPagoDelExpediente($r,$order['id'],$n,$order['order_number'] ?? '') && strtolower($r['user_email'] ?? '')===strtolower($order['customer_email'] ?? '') && ($r['status'] ?? '')!=='cancelled';}));
        $paid=array_values(array_filter($candidates,function($r){return ($r['status'] ?? '')==='paid';}));
        $selected=count($paid)===1?$paid[0]:(count($candidates)===1?$candidates[0]:null);
        if(!$selected){$out['missing_payments'][]=$n;$out['issues'][]=$candidates?'Concilia las solicitudes duplicadas del Pago '.$n.'.':'Registra la solicitud del Pago '.$n.'.';continue;}
        $chargeLink=intval($selected['metadata']['custom_fields']['link_id'] ?? 0);
        if(intval($selected['amount_clp'])!==$plan['clp'] || ($n===2 && $chargeLink && $chargeLink!==intval($link['id']))) {$out['issues'][]='Concilia el Pago '.$n.' con el plan y la lancha vigentes.';continue;}
        $state=impPaymentSettlement($selected);
        $out['remaining_clp']+=$state['remaining_clp'];$out['missing_proofs']+=$state['missing_proofs'];$out['review_pending']+=$state['review_pending'];
        if(!$state['settled'])$out['issues'][]='Completa y concilia el Pago '.$n.'.';
    }
    $out['ready']=!$out['issues'];
    return $out;
}
function impPurchaseClearanceFor($pdo,$order) {
    $link=impLeerLink($pdo,$order['id'],$order['chosen_link_id'] ?? 0);
    $requests=impConCobros(function(&$store){return $store['requests'];});
    if(!is_array($requests))throw new RuntimeException('Payment reconciliation unavailable');
    return impPurchaseClearance($order,$link,$requests);
}
function impPurchaseHandoffSchema($pdo) {
    $engine=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'?'':' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    $pdo->exec("CREATE TABLE IF NOT EXISTS order_purchase_handoffs (order_id INT NOT NULL,link_id INT NOT NULL,status VARCHAR(16) NOT NULL,attempted_at DATETIME NOT NULL,sent_at DATETIME NULL,PRIMARY KEY(order_id,link_id))$engine");
}
function impPurchaseHandoffState($pdo,$order) {
    impPurchaseHandoffSchema($pdo);
    $st=$pdo->prepare('SELECT status,attempted_at,sent_at FROM order_purchase_handoffs WHERE order_id=? AND link_id=?');$st->execute([$order['id'],$order['chosen_link_id'] ?? 0]);
    return $st->fetch(PDO::FETCH_ASSOC) ?: null;
}
/** One operator handoff; only an explicit owner action may retry a failed delivery. */
function impResumePurchase($request,$retry=false) {
    require_once __DIR__.'/operador_usa.php';
    $ref=$request['metadata']['order_id'] ?? $request['metadata']['order_number'] ?? '';
    if(!is_scalar($ref) || trim((string)$ref)==='')return false;
    $pdo=getDbConnection();if(!$pdo)return false;
    $st=$pdo->prepare(ctype_digit((string)$ref)?'SELECT * FROM orders WHERE id=?':'SELECT * FROM orders WHERE order_number=?');$st->execute([$ref]);$o=$st->fetch(PDO::FETCH_ASSOC);
    if($o && isset($request['user_email']) && strtolower($request['user_email'])!==strtolower($o['customer_email']))return false;
    if(!$o || impExpedienteCerrado($o) || !empty($o['refund_requested_at']) || impInspeccionNoApta($o) || !impTieneEleccion($o) || opuHitoEnCurso($o)!=='compra' || opuPriceGate($pdo,$o) || !impPurchaseClearanceFor($pdo,$o)['ready'])return false;
    impPurchaseHandoffSchema($pdo);
    $insert=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'?'INSERT OR IGNORE':'INSERT IGNORE';
    if($retry) {$claim=$pdo->prepare("UPDATE order_purchase_handoffs SET status='attempted',attempted_at=?,sent_at=NULL WHERE order_id=? AND link_id=? AND status='failed'");$claim->execute([gmdate('Y-m-d H:i:s'),$o['id'],$o['chosen_link_id']]);}
    else {$claim=$pdo->prepare("$insert INTO order_purchase_handoffs (order_id,link_id,status,attempted_at) VALUES (?,?,'attempted',?)");$claim->execute([$o['id'],$o['chosen_link_id'],gmdate('Y-m-d H:i:s')]);}
    if(!$claim->rowCount())return false;
    $fresh=opuOrden($pdo,$o['id']);$sent=false;
    if($fresh && !impExpedienteCerrado($fresh) && empty($fresh['refund_requested_at']) && !impInspeccionNoApta($fresh) && intval($fresh['chosen_link_id'])===intval($o['chosen_link_id']) && opuHitoEnCurso($fresh)==='compra' && !opuPriceGate($pdo,$fresh) && impPurchaseClearanceFor($pdo,$fresh)['ready']) {
        try {$sent=opuPedirActualizacion($pdo,$fresh,'The Imporlan team has completed its internal review and authorized the purchase. Please follow the current instructions in your private portal.','',true);}catch(Throwable $e){error_log('[purchase-handoff] operator notice failed');}
    }
    $pdo->prepare('UPDATE order_purchase_handoffs SET status=?,sent_at=? WHERE order_id=? AND link_id=?')->execute([$sent?'sent':'failed',$sent?gmdate('Y-m-d H:i:s'):null,$o['id'],$o['chosen_link_id']]);
    return $sent;
}
