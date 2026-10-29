<?php
require_once __DIR__.'/auth_helper.php';
require_once __DIR__.'/db_config.php';
require_once __DIR__.'/cors_helper.php';
require_once __DIR__.'/payment_receipts.php';
setCorsHeadersSecure();
header('Cache-Control: private, no-store');
header('Content-Type: application/json; charset=UTF-8');
if ($_SERVER['REQUEST_METHOD']==='OPTIONS') { http_response_code(200); exit; }
// A customer cannot select an identity through request fields. Agent has no financial access.
$session=requireUserAuthShared();
if (($session['role'] ?? '')==='agent') { http_response_code(403); echo json_encode(['error'=>'Acceso denegado']); exit; }
$action=$_GET['action'] ?? '';
try {
    if ($action==='review' && $_SERVER['REQUEST_METHOD']==='POST') {
        $in=json_decode(file_get_contents('php://input'),true) ?: [];
        [$code,$result]=impReceiptReview((string)($in['request_id'] ?? ''),(string)($in['receipt_id'] ?? ''),$session,$in['decision'] ?? '',$in['note'] ?? '');
        http_response_code($code);echo json_encode(is_array($result)?['success'=>true]+$result:['error'=>$result]);exit;
    }
    if ($action==='upload' && $_SERVER['REQUEST_METHOD']==='POST') {
        [$code,$result]=impReceiptUpload((string)($_POST['request_id'] ?? ''),$session,$_FILES['receipt'] ?? [],$_POST);
        http_response_code($code); echo json_encode(is_array($result)?['success'=>true]+$result:['error'=>$result],JSON_UNESCAPED_UNICODE); exit;
    }
    if ($action==='list' && $_SERVER['REQUEST_METHOD']==='GET') {
        $r=impReceiptFind((string)($_GET['request_id'] ?? ''));
        if (!$r || !impReceiptCanRead($r,$session)) {http_response_code(403);echo json_encode(['error'=>'No tienes acceso a este pago']);exit;}
        echo json_encode(['success'=>true,'receipts'=>array_map('impReceiptPublic',$r['receipts'] ?? [])]);exit;
    }
    if ($action==='download' && $_SERVER['REQUEST_METHOD']==='GET') {
        $id=(string)($_GET['id'] ?? ''); $found=null;
        if (preg_match('/^rc_[a-f0-9]{32}$/D',$id)) $found=impConCobros(function(&$store)use($id,$session){foreach($store['requests'] as $r)if(impReceiptCanRead($r,$session))foreach($r['receipts'] ?? [] as $receipt)if($receipt['id']===$id)return $receipt;return null;});
        if (!$found || !preg_match('/^rc_[a-f0-9]{32}\.(pdf|jpg|png|webp)$/D',$found['stored_name']) || !is_file(__DIR__.'/payment_receipts/'.$found['stored_name'])) {http_response_code(403);echo json_encode(['error'=>'Comprobante no disponible']);exit;}
        header('Content-Type: '.$found['mime_type']);header('X-Content-Type-Options: nosniff');header("Content-Disposition: inline; filename*=UTF-8''".rawurlencode($found['original_name']));
        readfile(__DIR__.'/payment_receipts/'.$found['stored_name']);exit;
    }
    http_response_code(405);echo json_encode(['error'=>'Acción o método no permitido']);
} catch(Throwable $e) { error_log('[payment-receipt] '.get_class($e));http_response_code(503);echo json_encode(['error'=>'No se pudo completar la operación con el comprobante']); }
