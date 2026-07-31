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

/* Catálogo de documentos. Debe mantenerse alineado con LIBRARY en
   assets/importa-tu-mismo-checkout.js */
$DOCS = [
    'mini-guia'   => ['file' => '00-mini-guia-gratis-importar-embarcacion-usa-chile.pdf', 'title' => 'Mini-guía: importar en 8 pasos', 'pages' => 6,  'free' => true],
    'manual'      => ['file' => '01-manual-maestro-importacion-usa-chile.pdf',            'title' => 'Manual Maestro de Importación USA a Chile', 'pages' => 12],
    'checklist'   => ['file' => '02-checklist-maestro-70-puntos.pdf',                     'title' => 'Checklist Maestro de 70 puntos', 'pages' => 6],
    'costos'      => ['file' => '03-guia-costos-aranceles-impuestos.pdf',                 'title' => 'Guía de Costos, Aranceles e Impuestos', 'pages' => 8],
    'calculadora' => ['file' => 'calculadora-costos-importacion-imporlan.csv',            'title' => 'Planilla de cálculo de costos', 'pages' => 0],
    'documentos'  => ['file' => '04-documentos-formularios-y-plantillas.pdf',             'title' => 'Documentos, formularios y plantillas', 'pages' => 6],
    'directemar'  => ['file' => '05-tramites-directemar-y-matricula.pdf',                 'title' => 'Trámites DIRECTEMAR y matrícula en Chile', 'pages' => 5],
    'logistica'   => ['file' => '06-logistica-fletes-seguro-e-inspeccion.pdf',            'title' => 'Logística, fletes, seguro e inspección', 'pages' => 7],
    'errores'     => ['file' => '07-errores-costosos-y-como-evitarlos.pdf',               'title' => '25 errores costosos y cómo evitarlos', 'pages' => 6],
    'directorio'  => ['file' => '08-directorio-proveedores-y-negociacion.pdf',            'title' => 'Directorio de proveedores y negociación', 'pages' => 6],
    'post'        => ['file' => '09-post-importacion-en-chile.pdf',                       'title' => 'Después de importar: puesta en marcha', 'pages' => 6],
];

$BASE_DOCS = ['manual', 'checklist', 'costos', 'calculadora', 'documentos', 'directemar', 'logistica', 'errores'];

$PLANS = [
    'navegante' => ['name' => 'Plan Navegante',       'docs' => $BASE_DOCS],
    'timonel'   => ['name' => 'Plan Timonel',         'docs' => array_merge($BASE_DOCS, ['directorio'])],
    'patron'    => ['name' => 'Plan Patrón de Nave',  'docs' => array_merge($BASE_DOCS, ['directorio', 'post'])],
];

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

        $label = ($p['plan_name'] ?? '') . ' ' . ($p['description'] ?? '');
        if (stripos($label, 'Importa') === false) continue;

        return $p;
    }
    return null;
}

/** Deduce el id de plan a partir del nombre guardado en la compra. */
function planIdFromPurchase($purchase, $plans) {
    $label = strtolower(($purchase['plan_name'] ?? '') . ' ' . ($purchase['description'] ?? ''));
    if (strpos($label, 'patr') !== false) return 'patron';
    if (strpos($label, 'timonel') !== false) return 'timonel';
    if (strpos($label, 'navegante') !== false) return 'navegante';
    return 'navegante';
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
        $planId = planIdFromPurchase($purchase, $PLANS);
        $allowed = in_array($docId, $PLANS[$planId]['docs'], true);
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

$planId = planIdFromPurchase($purchase, $PLANS);
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
