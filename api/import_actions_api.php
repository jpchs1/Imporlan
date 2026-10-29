<?php
require_once __DIR__ . '/import_action_reminders.php';
require_once __DIR__ . '/cors_helper.php';
setCorsHeadersSecure();
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: private, no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
$session = requireAdminAuthShared(['admin','support']);
$owner = opuPriceCanApprove($session);
$pdo = getDbConnection();
if (!$pdo) { http_response_code(503); echo json_encode(['error'=>'No pudimos consultar los recordatorios']); exit; }
$action = $_GET['action'] ?? 'preview';
$in = $_SERVER['REQUEST_METHOD'] === 'POST' ? json_decode(file_get_contents('php://input'),true) : [];
if (!is_array($in)) $in=[];
try {
    if ($action === 'configure' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!$owner) { http_response_code(403); echo json_encode(['error'=>'Sólo Juan Pablo puede configurar estos correos']); exit; }
        if (!array_key_exists('enabled',$in) || !is_bool($in['enabled'])) { http_response_code(400); echo json_encode(['error'=>'Se requiere enabled como booleano']); exit; }
        $error=impActionConfigure($pdo,$session,$in['enabled'],$in['template_hash'] ?? null);
        if ($error) { http_response_code(409); echo json_encode(['error'=>$error]); exit; }
        echo json_encode(['success'=>true,'settings'=>impActionSettings($pdo)]); exit;
    }
    $id=intval($_GET['order_id'] ?? $in['order_id'] ?? 0);
    $audience=$_GET['audience'] ?? $in['audience'] ?? 'client';
    if (!$id || !in_array($audience,['client','owner'],true)) { http_response_code(400); echo json_encode(['error'=>'Se requiere un expediente y un destinatario válido']); exit; }
    if ($audience === 'owner' && !$owner) { http_response_code(403); echo json_encode(['error'=>'La revisión interna está reservada a Juan Pablo']); exit; }
    if ($action === 'preview' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $preview=impActionPreview($pdo,$id,$audience);
        $delivery=impActionDelivery($pdo,$preview);
        echo json_encode(['success'=>true,'can_send'=>$owner && (bool)$preview && !$delivery,'can_configure'=>$owner,'settings'=>impActionSettings($pdo),'preview'=>$preview,'delivery'=>$delivery],JSON_UNESCAPED_UNICODE); exit;
    }
    if ($action === 'send_now' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!$owner) { http_response_code(403); echo json_encode(['error'=>'Sólo Juan Pablo puede enviar este recordatorio']); exit; }
        $result=impActionSend($pdo,$id,$audience,$in['fingerprint'] ?? null);
        if (!$result['sent']) {
            http_response_code($result['reason']==='failed'?502:409);
            $messages=['changed'=>'El estado cambió o no hay una acción pendiente. Actualiza la vista previa.','already_attempted'=>'Ya se intentó este aviso hoy. Revisa el registro antes de repetirlo.','skipped'=>'La acción se resolvió o cambió. No se envió un correo desactualizado.','failed'=>'El servidor no confirmó el envío. Se registró el intento y no se repite automáticamente hoy.'];
            echo json_encode(['error'=>$messages[$result['reason']] ?? 'No se envió el correo','reason'=>$result['reason']]); exit;
        }
        echo json_encode(['success'=>true,'sent'=>true]); exit;
    }
    http_response_code(405); echo json_encode(['error'=>'Acción o método no permitido']);
} catch (Throwable $e) {
    error_log('[import-actions-api] ' . get_class($e));
    http_response_code(503); echo json_encode(['error'=>'No pudimos completar la operación. Si solicitaste un envío, consulta el registro antes de repetirlo.']);
}
