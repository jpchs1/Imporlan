<?php
/** Confirmed bank/gateway credits. Uploaded files never contribute money. */
function impPaymentCredits($request) { return array_values(array_filter($request['payment_credits'] ?? [],function($c){return ($c['status'] ?? '')==='confirmed';})); }
function impPaymentBalance($request) {
    $total=max(0,intval($request['amount_clp'] ?? 0));
    $credits=array_sum(array_column(impPaymentCredits($request),'amount_clp'));
    $confirmed=($request['status'] ?? '')==='paid' ? max($total,$credits) : $credits;
    return ['total'=>$total,'confirmed'=>$confirmed,'remaining'=>max(0,$total-$confirmed),'excess'=>max(0,$confirmed-$total)];
}
function impPaymentReceiptLinked($request,$receipt) {
    foreach(impPaymentCredits($request) as $credit) if (!empty($credit['receipt_id']) && $credit['receipt_id']===($receipt['id'] ?? null)) return true;
    return false;
}
function impPaymentCreditHasProof($request,$credit) {
    foreach($request['receipts'] ?? [] as $r)if(($r['id'] ?? '')===($credit['receipt_id'] ?? null) && ($r['status'] ?? '')!=='rejected')return true;
    return false;
}
/** A client-selected credit hint stops repeat upload requests, but never books money or approves evidence. */
function impPaymentCreditProofSubmitted($request,$credit) {
    foreach($request['receipts'] ?? [] as $r)if(($r['credit_id'] ?? '')===($credit['id'] ?? null) && ($r['status'] ?? '')!=='rejected' && !impPaymentReceiptLinked($request,$r))return true;
    return false;
}
function impPaymentProofPending($request) {
    if (($request['status'] ?? '')!=='pending') return false;
    foreach($request['receipts'] ?? [] as $r) if (($r['status'] ?? '')!=='rejected' && !impPaymentReceiptLinked($request,$r)) return true;
    return empty($request['receipts']) && ($request['receipt_status'] ?? '')!=='rejected' && (!empty($request['receipt_received_at']) || !empty($request['receipt_url']) || !empty($request['voucher_url']) || !empty($request['comprobante_url']));
}
function impPaymentRead($id) {
    require_once __DIR__.'/eleccion_lancha.php';
    return impConCobros(function(&$store)use($id){foreach($store['requests'] as $r)if(($r['id'] ?? '')===$id)return $r;return null;});
}
function impPaymentPublic($request) {
    if (isset($request['payment_credits'])) $request['payment_credits']=array_map(function($c){return array_intersect_key($c,array_flip(['id','amount_clp','received_on','bank','reference','receipt_id','status']));},$request['payment_credits']);
    return $request;
}
function impPaymentLinkReceipt(&$request,$creditId,$receiptId,$actor,$note='') {
    $ci=null;$ri=null;
    foreach($request['payment_credits'] ?? [] as $i=>$c)if($c['id']===$creditId)$ci=$i;
    foreach($request['receipts'] ?? [] as $i=>$r)if($r['id']===$receiptId)$ri=$i;
    if ($ci===null || $ri===null || ($request['receipts'][$ri]['status'] ?? '')==='rejected') return 'Selecciona un abono y un comprobante vigente de este pago.';
    foreach(impPaymentCredits($request) as $c)if(($c['receipt_id'] ?? null)===$receiptId && $c['id']!==$creditId)return 'El comprobante ya respalda otro abono.';
    if (!empty($request['payment_credits'][$ci]['receipt_id']) && $request['payment_credits'][$ci]['receipt_id']!==$receiptId) {
        if(impPaymentCreditHasProof($request,$request['payment_credits'][$ci]))return 'Este abono ya tiene un comprobante asociado.';
        $request['payment_credits'][$ci]['previous_receipt_ids'][]=$request['payment_credits'][$ci]['receipt_id'];
    }
    $receipt=$request['receipts'][$ri];
    if (($receipt['currency'] ?? 'CLP')==='USD' || intval($receipt['declared_amount_clp'] ?? 0)!==$request['payment_credits'][$ci]['amount_clp']) {
        if (mb_strlen(trim($note))<10)return 'Explica la diferencia de monto o la conversión revisada antes de asociar este comprobante.';
    }
    $request['payment_credits'][$ci]['receipt_id']=$receiptId;
    $request['receipts'][$ri]['status']='reviewed';$request['receipts'][$ri]['reviewed_by']=$actor;
    $request['receipts'][$ri]['reviewed_at']=gmdate('Y-m-d H:i:s');$request['receipts'][$ri]['review_note']=$note;
    $request['receipt_status']=impPaymentProofPending($request)?'pending':'reconciled';
    return null;
}
/** Atomic, idempotent registration; the original request amount is immutable. */
function impPaymentAddCredit($id,$input,$actor,$gateway=false) {
    require_once __DIR__.'/eleccion_lancha.php';
    $amount=$input['amount_clp'] ?? '';$key=$input['idempotency_key'] ?? ''; $date=$input['received_on'] ?? '';
    if(!is_string($input['reference'] ?? '') || !is_string($input['note'] ?? '') || !is_string($input['bank'] ?? '') || !is_string($input['receipt_id'] ?? ''))return [400,'Datos del abono inválidos.'];
    $bank=$input['bank'] ?? ''; $ref=trim((string)($input['reference'] ?? ''));$note=trim((string)($input['note'] ?? ''));
    if ((!is_int($amount) && !is_string($amount)) || !preg_match('/^[1-9][0-9]{0,11}$/D',(string)$amount) || !is_string($key) || !preg_match('/^[a-zA-Z0-9_-]{8,120}$/D',$key)) return [400,'Indica un monto entero positivo y una clave de registro válida.'];
    if (!is_string($date) || !preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/D',$date,$m) || !checkdate(intval($m[2]),intval($m[3]),intval($m[1])) || $date>(new DateTimeImmutable('now',new DateTimeZone('America/Santiago')))->format('Y-m-d')) return [400,'Indica la fecha real del abono, sin fechas futuras.'];
    if (!in_array($bank,$gateway?['webpay','mercadopago','paypal']:['global66','santander','otro'],true) || mb_strlen($ref)>120 || mb_strlen($note)>1000 || ($ref==='' && mb_strlen($note)<10)) return [400,'Selecciona el banco y la referencia; si no hay número de operación, explica el respaldo en una observación.'];
    $amount=intval($amount);$receiptId=$input['receipt_id'] ?? null;
    $identity=hash('sha256',json_encode([$amount,$date,$bank,$ref,$note,$receiptId],JSON_UNESCAPED_UNICODE));
    $result=impConCobros(function(&$store)use($id,$input,$actor,$gateway,$amount,$key,$date,$bank,$ref,$note,$receiptId,$identity){
        foreach($store['requests'] as &$r)if(($r['id'] ?? '')===$id) {
            foreach($r['payment_credits'] ?? [] as $c)if(($c['idempotency_key'] ?? '')===$key) return ($c['payload_hash'] ?? '')===$identity ? ['code'=>200,'request'=>$r,'duplicate'=>true,'newly_paid'=>false] : ['code'=>409,'error'=>'La clave de registro ya se usó con otros datos.'];
            if (($r['status'] ?? '')!=='pending' && !($gateway && ($r['status'] ?? '')==='paid' && !empty($r['payment_credits']))) return ['code'=>409,'error'=>'El cobro ya no está pendiente. Actualiza el registro.'];
            $balance=impPaymentBalance($r);
            if($balance['total']<=0)return ['code'=>409,'error'=>'La solicitud no tiene un monto válido.'];
            if (!$gateway && (intval($input['expected_amount_clp'] ?? -1)!==$balance['total'] || intval($input['expected_remaining_clp'] ?? -1)!==$balance['remaining'])) return ['code'=>409,'error'=>'El saldo cambió. Actualiza antes de registrar el abono.'];
            foreach($store['requests'] as $other)foreach(impPaymentCredits($other) as $c) {
                $same=$ref!=='' ? ($c['bank']===$bank && strtolower($c['reference'])===strtolower($ref)) : ($c['bank']===$bank && $c['received_on']===$date && $c['amount_clp']===$amount && strtolower($other['user_email'] ?? '')===strtolower($r['user_email'] ?? ''));
                if($same)return ['code'=>409,'error'=>'Ese movimiento ya está registrado. Revisa su referencia para no duplicarlo.'];
            }
            $wasPaid=($r['status'] ?? '')==='paid';
            if($gateway){$r['payment_id']=$ref;$r['purchase_id']=$input['purchase_id'] ?? null;}
            $credit=['id'=>'pc_'.bin2hex(random_bytes(16)),'amount_clp'=>$amount,'received_on'=>$date,'bank'=>$bank,'reference'=>$ref,'note'=>$note,'status'=>'confirmed','confirmed_by'=>$actor,'confirmed_at'=>gmdate('Y-m-d H:i:s'),'idempotency_key'=>$key,'payload_hash'=>$identity,'receipt_id'=>null];
            $r['payment_credits'][]=$credit;
            if ($receiptId) { $error=impPaymentLinkReceipt($r,$credit['id'],(string)$receiptId,$actor,$note);if($error)return ['code'=>422,'error'=>$error]; }
            $balance=impPaymentBalance($r);
            if ($balance['remaining']===0) {
                $r['status']='paid';$r['paid_at']=max(array_column(impPaymentCredits($r),'received_on'));
                $r['paid_confirmed_by']=$actor;$r['paid_confirmed_at']=gmdate('Y-m-d H:i:s');
                $banks=array_unique(array_column(impPaymentCredits($r),'bank'));
                $r['payment_method']=count(array_intersect($banks,['webpay','mercadopago','paypal'])) ? (count($banks)>1?'mixto':reset($banks)) : 'transferencia_bancaria';
            }
            return ['guardar'=>true,'code'=>200,'request'=>$r,'credit'=>$credit,'duplicate'=>false,'newly_paid'=>!$wasPaid && $r['status']==='paid'];
        }
        return ['code'=>404,'error'=>'Solicitud no encontrada.'];
    });
    if(!$result)return [503,'No se pudo guardar el abono.'];
    return [$result['code'],$result['error'] ?? $result];
}
function impPaymentAssociateCredit($id,$creditId,$receiptId,$actor,$note) {
    if(!is_string($note) || mb_strlen($note)>1000)return ['error'=>'La observación debe tener hasta 1000 caracteres.'];
    require_once __DIR__.'/eleccion_lancha.php';
    return impConCobros(function(&$store)use($id,$creditId,$receiptId,$actor,$note){foreach($store['requests'] as &$r)if(($r['id'] ?? '')===$id){$error=impPaymentLinkReceipt($r,$creditId,$receiptId,$actor,$note);return $error?['error'=>$error]:['guardar'=>true,'request'=>$r];}return ['error'=>'Solicitud no encontrada.'];});
}
/** A late first-payment reconciliation does not restart inspection notifications. */
function isHistoricalFirstPayment($request) {
    $n=intval($request['metadata']['custom_fields']['pago'] ?? 0);
    if(!$n && preg_match('/pago\s*([123])\b/i',$request['title'] ?? '',$m))$n=intval($m[1]);
    if($n!==1)return false;
    $ref=$request['metadata']['order_id'] ?? $request['metadata']['order_number'] ?? null;
    if(!is_scalar($ref) || trim((string)$ref)==='')return false;
    try { require_once __DIR__.'/eleccion_lancha.php';require_once __DIR__.'/db_config.php';$pdo=getDbConnection();if(!$pdo)return false;
        $st=$pdo->prepare(ctype_digit((string)$ref)?'SELECT * FROM orders WHERE id=?':'SELECT * FROM orders WHERE order_number=?');$st->execute([$ref]);$o=$st->fetch(PDO::FETCH_ASSOC);
        return $o && strtolower($o['customer_email'])===strtolower($request['user_email']) && (!empty($o['inspection_client_ok_at']) || !empty($o['inspection_report_at']) || (bool)array_intersect_key(impPasos($o),array_flip(['inspeccion','compra','transporte','aduana','entrega'])));
    }catch(Throwable $e){return false;}
}
function impPaymentNotifyCompleted($request) {
    if(isHistoricalFirstPayment($request))return;
    try {require_once __DIR__.'/email_service.php';(new EmailService())->sendPaymentRequestPaidEmail($request['user_email'],explode('@',$request['user_email'])[0],$request,$request);}catch(Throwable $e){error_log('[payment-credit] confirmation email failed');}
    try {require_once __DIR__.'/operador_usa.php';opuAlPagarCobro($request);}catch(Throwable $e){error_log('[payment-credit] operation hook failed');}
}
/** Gateway initiation always uses the owned invoice's freshly read net balance. */
function impPaymentGatewayRequest($id,$actor) {
    if(($actor['role'] ?? '')==='agent')return [403,'El operador no tiene acceso a pagos.'];
    $r=impPaymentRead((string)$id);
    if(!$r || (!in_array($actor['role'] ?? '',['admin','support'],true) && strtolower($actor['email'] ?? '')!==strtolower($r['user_email'] ?? '')))return [403,'No tienes acceso a este pago.'];
    $b=impPaymentBalance($r);
    if(($r['status'] ?? '')!=='pending' || $b['remaining']<=0 || impPaymentProofPending($r))return [409,'El cobro ya está cubierto o hay un comprobante pendiente de conciliación. Actualiza antes de pagar.'];
    return [200,['request'=>$r,'amount'=>$b['remaining']]];
}
function impPaymentAuthenticatedGatewayRequest($id) {
    require_once __DIR__.'/auth_helper.php';
    return impPaymentGatewayRequest($id,requireUserAuthShared());
}
/** Transbank buy_order allows 26 characters. Each real attempt gets its own pending record. */
function impPaymentAttemptOrder() { return 'PR'.bin2hex(random_bytes(12)); }
