<?php
/** Private payment evidence. Upload is not a bank confirmation and never marks a payment paid. */
require_once __DIR__.'/eleccion_lancha.php';

function impReceiptCanRead($request,$session) {
    if (in_array($session['role'] ?? '',['admin','support'],true)) return true;
    if (($session['role'] ?? '')==='agent') return false;
    return !empty($session['email']) && hash_equals(strtolower(trim((string)$request['user_email'])),strtolower(trim((string)$session['email'])));
}
function impReceiptFind($id) {
    return impConCobros(function(&$store)use($id){foreach($store['requests'] as $r)if($r['id']===$id)return $r;return null;});
}
function impReceiptPublic($r) {
    return ['id'=>$r['id'],'original_name'=>$r['original_name'],'mime_type'=>$r['mime_type'],'file_size'=>$r['file_size'],'uploaded_at'=>$r['uploaded_at'],'reference'=>$r['reference'],'currency'=>$r['currency'] ?? 'CLP','declared_amount'=>$r['declared_amount'] ?? (string)$r['declared_amount_clp'],'declared_amount_clp'=>$r['declared_amount_clp'],'status'=>$r['status'] ?? 'pending','review_note'=>$r['review_note'] ?? null,'download_url'=>'/api/payment_receipts_api.php?action=download&id='.rawurlencode($r['id'])];
}
function impReceiptDirectory() {
    $dir=__DIR__.'/payment_receipts/';
    if (!is_dir($dir) && !mkdir($dir,0755,true)) throw new RuntimeException('No se pudo preparar el comprobante');
    if (!is_file($dir.'.htaccess')) file_put_contents($dir.'.htaccess',"Require all denied\nOptions -Indexes\nRemoveHandler .php .phtml .phar\n");
    return $dir;
}
function impReceiptUpload($id,$session,$file,$fields,$move='move_uploaded_file') {
    $request=impReceiptFind($id);
    if (!$request || !impReceiptCanRead($request,$session)) return [403,'No tienes acceso a este pago'];
    if (($request['status'] ?? '')==='cancelled') return [409,'Este cobro está cancelado'];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK || empty($file['tmp_name']) || !is_file($file['tmp_name'])) return [400,'Selecciona un comprobante PDF, JPG, PNG o WebP'];
    $size=filesize($file['tmp_name']); if (!$size || $size>10*1024*1024) return [400,'El comprobante debe pesar hasta 10 MB'];
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $allowed=['application/pdf'=>'pdf','image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
    if (!isset($allowed[$mime])) return [400,'El formato debe ser PDF, JPG, PNG o WebP'];
    $amount=$fields['amount'] ?? $fields['amount_clp'] ?? ''; $currency=$fields['currency'] ?? 'CLP';
    if (!in_array($currency,['CLP','USD'],true)) return [400,'La moneda debe ser CLP o USD'];
    $pattern=$currency==='CLP' ? '/^[1-9][0-9]{0,11}$/D' : '/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/D';
    if (!is_scalar($amount) || !preg_match($pattern,(string)$amount) || floatval($amount)<=0) return [400,'Indica el monto transferido sin separador de miles; en USD usa punto decimal'];
    $reference=$fields['reference'] ?? '';
    if (!is_string($reference) || mb_strlen(trim($reference))<3 || mb_strlen(trim($reference))>120) return [400,'Indica la referencia o número de transferencia (3 a 120 caracteres)'];
    $receipt=['id'=>'rc_'.bin2hex(random_bytes(16)),'original_name'=>mb_substr(basename((string)($file['name'] ?? 'comprobante')),0,160),'mime_type'=>$mime,'file_size'=>$size,'uploaded_at'=>gmdate('Y-m-d H:i:s'),'uploaded_by'=>strtolower($session['email']),'reference'=>trim($reference),'declared_amount_clp'=>intval($amount),'status'=>'pending'];
    $receipt['stored_name']=$receipt['id'].'.'.$allowed[$mime]; $path=impReceiptDirectory().$receipt['stored_name'];
    $receipt['currency']=$currency;$receipt['declared_amount']=(string)$amount;$receipt['declared_amount_clp']=$currency==='CLP' ? intval($amount) : null;
    if (!$move($file['tmp_name'],$path)) return [500,'No se pudo guardar el comprobante'];
    $saved=impConCobros(function(&$store)use($id,$session,$receipt){
        foreach($store['requests'] as &$r) if($r['id']===$id && impReceiptCanRead($r,$session) && ($r['status'] ?? '')!=='cancelled') {
            $receipts=$r['receipts'] ?? []; if(count($receipts)>=10)return null;
            foreach($receipts as $existing)if($existing['reference']===$receipt['reference'] && ($existing['status'] ?? '')!=='rejected')return null;
            $r['receipts'][]=$receipt;
            $r['receipt_received_at']=$receipt['uploaded_at'];
            $r['receipt_status']='pending';
            $r['receipt_url']=impReceiptPublic($receipt)['download_url'];
            return ['guardar'=>true,'request'=>$r];
        }return null;
    });
    if (!$saved) { unlink($path); return [409,'El cobro cambió, la referencia ya estaba registrada o se alcanzó el límite de 10 comprobantes']; }
    return [200,['receipt'=>impReceiptPublic($receipt),'status'=>$saved['request']['status'],'message'=>'Comprobante recibido. El equipo revisará el ingreso antes de confirmar el pago.']];
}

function impReceiptReview($id,$receiptId,$session,$decision,$note) {
    if (!in_array($session['role'] ?? '',['admin','support'],true)) return [403,'La revisión corresponde al equipo'];
    if (!in_array($decision,['reviewed','rejected'],true) || !is_string($note) || mb_strlen(trim($note))>1000 || ($decision==='rejected' && mb_strlen(trim($note))<5)) return [400,'Indica una revisión válida y explica el motivo si solicitas otro comprobante'];
    $saved=impConCobros(function(&$store)use($id,$receiptId,$session,$decision,$note){
        foreach($store['requests'] as &$r)if($r['id']===$id) {
            if (empty($r['receipts'])) return null;
            $found=false;
            foreach($r['receipts'] as &$receipt)if($receipt['id']===$receiptId){$receipt['status']=$decision;$receipt['reviewed_at']=gmdate('Y-m-d H:i:s');$receipt['reviewed_by']=$session['email'];$receipt['review_note']=trim($note);$found=true;}
            unset($receipt);if(!$found)return null;
            $r['receipt_status']=count(array_filter($r['receipts'],function($x){return ($x['status'] ?? '')!=='rejected';})) ? 'pending' : 'rejected';
            return ['guardar'=>true];
        }return null;
    });
    return $saved ? [200,['message'=>'Revisión registrada. El estado de pago sólo cambia al confirmar el ingreso.']] : [404,'No se encontró el comprobante'];
}
