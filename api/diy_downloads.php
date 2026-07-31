<?php
/**
 * Entrega del material descargable del programa "Importa tú mismo".
 *
 * Los PDF de pago no se sirven directamente desde /importa-tu-mismo/recursos/
 * (ver el .htaccess de esa carpeta): se entregan por aquí, validando que exista
 * una compra pagada en purchases.json.
 *
 * Acciones:
 *   GET ?action=list&order=DIY_...            -> JSON con el plan y sus documentos
 *   GET ?action=list&payment_id=123456        -> idem, para MercadoPago
 *   GET ?action=file&order=DIY_...&doc=manual -> descarga el archivo
 *
 * El identificador de la compra (order_id de WebPay o payment_id de la pasarela)
 * actúa como token: sólo lo conoce quien completó el pago y quien recibe el
 * email de confirmación.
 */

require_once __DIR__ . '/cors_helper.php';
setCorsHeadersSecure();

$RESOURCE_DIR = dirname(__DIR__) . '/importa-tu-mismo/recursos/';

require_once __DIR__ . '/diy_catalog.php';

$DOCS = diyDocs();
$PLANS = diyPlans();

/**
 * Busca una compra pagada del programa por order_id o payment_id.
 * Devuelve null si no existe, no está pagada o no corresponde al programa.
 */
function findDiyPurchase($order, $paymentId) {
    $file = __DIR__ . '/purchases.json';
    if (!file_exists($file)) return null;

    $data = json_decode(file_get_contents($file), true);
    if (!isset($data['purchases']) || !is_array($data['purchases'])) return null;

    foreach ($data['purchases'] as $p) {
        $matchOrder = $order && isset($p['order_id']) && (string)$p['order_id'] === (string)$order;
        $matchPay = $paymentId && isset($p['payment_id']) && (string)$p['payment_id'] === (string)$paymentId;
        if (!$matchOrder && !$matchPay) continue;

        $status = strtolower($p['status'] ?? '');
        if (!in_array($status, ['paid', 'approved', 'completed'], true)) continue;

        if (!diyIsProgramPurchase($p)) continue;

        return $p;
    }
    return null;
}

/** Deduce el id de plan a partir del nombre guardado en la compra. */
function planIdFromPurchase($purchase) {
    // findDiyPurchase() ya garantiza que el plan es reconocible; el null
    // defensivo evita entregar material si eso cambiara en el futuro.
    $label = ($purchase['plan_name'] ?? '') . ' ' . ($purchase['description'] ?? '');
    return diyPlanIdFromLabel($label);
}

$action = $_GET['action'] ?? 'list';
$order = isset($_GET['order']) ? trim((string)$_GET['order']) : '';
$paymentId = isset($_GET['payment_id']) ? trim((string)$_GET['payment_id']) : '';

// Sólo aceptamos identificadores con forma razonable de token.
if ($order !== '' && !preg_match('/^[A-Za-z0-9_\-]{6,64}$/', $order)) $order = '';
if ($paymentId !== '' && !preg_match('/^[A-Za-z0-9_\-]{4,64}$/', $paymentId)) $paymentId = '';

$purchase = ($order || $paymentId) ? findDiyPurchase($order, $paymentId) : null;

if ($action === 'file') {
    $docId = $_GET['doc'] ?? '';
    if (!isset($DOCS[$docId])) {
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => 'Documento no encontrado']);
        exit;
    }

    $doc = $DOCS[$docId];
    $allowed = !empty($doc['free']);

    if (!$allowed) {
        if (!$purchase) {
            http_response_code(403);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'error' => 'Compra no encontrada o no pagada']);
            exit;
        }
        $planId = planIdFromPurchase($purchase);
        $allowed = $planId && in_array($docId, $PLANS[$planId]['docs'], true);
    }

    if (!$allowed) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => 'Ese documento no está incluido en tu plan']);
        exit;
    }

    $path = $RESOURCE_DIR . $doc['file'];
    if (!file_exists($path)) {
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => 'Archivo no disponible']);
        exit;
    }

    $isCsv = substr($doc['file'], -4) === '.csv';
    header('Content-Type: ' . ($isCsv ? 'text/csv; charset=utf-8' : 'application/pdf'));
    header('Content-Disposition: attachment; filename="' . $doc['file'] . '"');
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
}

/* action=list */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (!$purchase) {
    echo json_encode([
        'success' => false,
        'error' => 'No encontramos una compra pagada asociada a ese identificador.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$planId = planIdFromPurchase($purchase);
if (!$planId) {
    echo json_encode(['success' => false, 'error' => 'No pudimos identificar el plan de esa compra.'], JSON_UNESCAPED_UNICODE);
    exit;
}
$tokenParam = $order ? ('order=' . rawurlencode($order)) : ('payment_id=' . rawurlencode($paymentId));

$items = [];
foreach ($PLANS[$planId]['docs'] as $docId) {
    if (!isset($DOCS[$docId])) continue;
    $items[] = [
        'id' => $docId,
        'title' => $DOCS[$docId]['title'],
        'pages' => $DOCS[$docId]['pages'],
        'kind' => (substr($DOCS[$docId]['file'], -4) === '.csv') ? 'csv' : 'pdf',
        'url' => '/api/diy_downloads.php?action=file&doc=' . rawurlencode($docId) . '&' . $tokenParam
    ];
}

echo json_encode([
    'success' => true,
    'plan_id' => $planId,
    'plan_name' => $PLANS[$planId]['name'],
    'buyer_email' => $purchase['user_email'] ?? '',
    'date' => $purchase['date'] ?? '',
    'documents' => $items
], JSON_UNESCAPED_UNICODE);
