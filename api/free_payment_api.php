<?php
/**
 * Free Payment API - Imporlan
 *
 * Allows public users to pay any amount via WebPay, MercadoPago, or PayPal.
 * No authentication required. Records every payment in free_payments.json.
 *
 * Endpoints:
 * - POST ?action=init_webpay       - Create WebPay transaction and return redirect URL
 * - POST ?action=init_mercadopago  - Create MercadoPago preference and return init_point
 * - POST ?action=init_paypal       - Create PayPal order and return order_id
 * - POST ?action=capture_paypal    - Capture approved PayPal order
 * - GET/POST with token_ws         - WebPay callback (browser redirect)
 * - POST ?action=mp_webhook        - MercadoPago webhook
 * - GET  ?action=get_status&ref=X  - Check payment status by reference
 * - GET  ?action=admin_list        - List all free payments (admin)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/email_service.php';

// WebPay credentials (same as webpay.php)
if (!defined('WEBPAY_COMMERCE_CODE')) {
    define('WEBPAY_COMMERCE_CODE', '597034812373');
    define('WEBPAY_API_KEY_SECRET', '464a2bf8092ad625b634ccf4bb506440');
    define('WEBPAY_API_URL', 'https://webpay3g.transbank.cl');
}

// WebPay callback detection (must happen before CORS/JSON headers)
if (isset($_POST['token_ws']) || isset($_GET['token_ws']) || isset($_POST['TBK_TOKEN'])) {
    handleWebpayCallback();
    exit();
}

setCorsHeaders();

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'init_webpay':
        header('Content-Type: application/json');
        initWebpay();
        break;
    case 'init_mercadopago':
        header('Content-Type: application/json');
        initMercadoPago();
        break;
    case 'init_paypal':
        header('Content-Type: application/json');
        initPayPal();
        break;
    case 'capture_paypal':
        header('Content-Type: application/json');
        capturePayPal();
        break;
    case 'mp_webhook':
        handleMPWebhook();
        break;
    case 'get_status':
        header('Content-Type: application/json');
        getPaymentStatus();
        break;
    case 'admin_list':
        header('Content-Type: application/json');
        adminListPayments();
        break;
    default:
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => 'Accion no valida',
            'available_actions' => ['init_webpay', 'init_mercadopago', 'init_paypal', 'capture_paypal', 'get_status', 'admin_list']
        ]);
}

// ============================================================
// DATA LAYER
// ============================================================

function getFreePaymentsFile() {
    return __DIR__ . '/free_payments.json';
}

function loadFreePayments() {
    $file = getFreePaymentsFile();
    if (!file_exists($file)) {
        $data = ['payments' => []];
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
        return $data;
    }
    $data = json_decode(file_get_contents($file), true);
    if (!is_array($data) || !isset($data['payments'])) {
        return ['payments' => []];
    }
    return $data;
}

function saveFreePayment($payment) {
    $file = getFreePaymentsFile();
    $fp = fopen($file, 'c+');
    if (!$fp) return false;

    if (flock($fp, LOCK_EX)) {
        $contents = stream_get_contents($fp);
        $data = json_decode($contents, true);
        if (!is_array($data) || !isset($data['payments'])) {
            $data = ['payments' => []];
        }
        $data['payments'][] = $payment;
        fseek($fp, 0);
        ftruncate($fp, 0);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
    return true;
}

function updateFreePaymentByRef($ref, $updates) {
    $file = getFreePaymentsFile();
    $fp = fopen($file, 'c+');
    if (!$fp) return null;

    $updated = null;
    if (flock($fp, LOCK_EX)) {
        $contents = stream_get_contents($fp);
        $data = json_decode($contents, true);
        if (!is_array($data) || !isset($data['payments'])) {
            flock($fp, LOCK_UN);
            fclose($fp);
            return null;
        }
        foreach ($data['payments'] as &$p) {
            if ($p['referencia'] === $ref) {
                foreach ($updates as $k => $v) {
                    $p[$k] = $v;
                }
                $updated = $p;
                break;
            }
        }
        if ($updated) {
            fseek($fp, 0);
            ftruncate($fp, 0);
            fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
            fflush($fp);
        }
        flock($fp, LOCK_UN);
    }
    fclose($fp);
    return $updated;
}

function logFreePayment($event, $data) {
    $logFile = __DIR__ . '/free_payments.log';
    $entry = date('Y-m-d H:i:s') . ' [' . $event . '] ' . json_encode($data) . "\n";
    file_put_contents($logFile, $entry, FILE_APPEND);
}

// ============================================================
// VALIDATION
// ============================================================

function validateInput() {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }

    $errors = [];

    // Required: amount
    if (!isset($input['monto']) || floatval($input['monto']) <= 0) {
        $errors[] = 'El monto debe ser mayor a 0';
    }

    $monto = floatval($input['monto'] ?? 0);

    // WebPay only accepts CLP integers >= 50
    if (($input['gateway'] ?? '') === 'webpay' && $monto < 50) {
        $errors[] = 'El monto minimo para WebPay es $50 CLP';
    }

    // General max
    if ($monto > 50000000) {
        $errors[] = 'El monto maximo es $50.000.000';
    }

    // Sanitize optional fields
    $clean = [
        'monto'       => $monto,
        'moneda'      => $input['moneda'] ?? 'CLP',
        'nombre'      => trim(strip_tags($input['nombre'] ?? '')),
        'email'       => trim(strtolower($input['email'] ?? '')),
        'telefono'    => trim(strip_tags($input['telefono'] ?? '')),
        'concepto'    => trim(strip_tags($input['concepto'] ?? '')),
        'cotizacion'  => trim(strip_tags($input['cotizacion'] ?? '')),
        'expediente'  => trim(strip_tags($input['expediente'] ?? '')),
        'gateway'     => $input['gateway'] ?? '',
    ];

    // Validate email format if provided
    if (!empty($clean['email']) && !filter_var($clean['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Email invalido';
    }

    // Validate gateway
    if (!in_array($clean['gateway'], ['webpay', 'mercadopago', 'paypal'])) {
        $errors[] = 'Gateway invalido. Usar: webpay, mercadopago, paypal';
    }

    return ['input' => $clean, 'errors' => $errors];
}

function buildDescription($input) {
    $parts = [];
    if (!empty($input['concepto'])) {
        $parts[] = $input['concepto'];
    } else {
        $parts[] = 'Pago Imporlan';
    }
    if (!empty($input['cotizacion'])) {
        $parts[] = 'Cot: ' . $input['cotizacion'];
    }
    if (!empty($input['expediente'])) {
        $parts[] = 'Exp: ' . $input['expediente'];
    }
    return implode(' | ', $parts);
}

function generateRef() {
    return 'fp_' . date('Ymd') . '_' . substr(uniqid(), -8);
}

function createPaymentRecord($input, $ref) {
    return [
        'id'                     => 'fpay_' . uniqid(),
        'fecha'                  => date('Y-m-d H:i:s'),
        'nombre'                 => $input['nombre'],
        'email'                  => $input['email'],
        'telefono'               => $input['telefono'],
        'concepto'               => $input['concepto'],
        'cotizacion'             => $input['cotizacion'],
        'expediente'             => $input['expediente'],
        'referencia'             => $ref,
        'monto'                  => $input['monto'],
        'moneda'                 => $input['moneda'],
        'gateway'                => $input['gateway'],
        'estado'                 => 'pending',
        'transaction_id_gateway' => null,
        'created_at'             => date('Y-m-d H:i:s'),
        'updated_at'             => date('Y-m-d H:i:s'),
    ];
}

// ============================================================
// WEBPAY
// ============================================================

function initWebpay() {
    $v = validateInput();
    if (!empty($v['errors'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'errors' => $v['errors']]);
        return;
    }

    $input = $v['input'];
    $ref = generateRef();
    $description = buildDescription($input);
    $amount = intval($input['monto']); // WebPay requires integer CLP

    // Save pending record
    $record = createPaymentRecord($input, $ref);
    saveFreePayment($record);

    // Save pending info for callback
    $pendingDir = __DIR__ . '/fp_webpay_pending';
    if (!is_dir($pendingDir)) mkdir($pendingDir, 0755, true);
    file_put_contents($pendingDir . '/' . $ref . '.json', json_encode([
        'ref' => $ref,
        'input' => $input,
        'description' => $description,
    ]));

    $returnUrl = 'https://www.imporlan.cl/api/free_payment_api.php';
    $sessionId = 'fp_' . time();

    $requestData = [
        'buy_order'  => $ref,
        'session_id' => $sessionId,
        'amount'     => $amount,
        'return_url' => $returnUrl,
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, WEBPAY_API_URL . '/rswebpaytransaction/api/webpay/v1.2/transactions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Tbk-Api-Key-Id: ' . WEBPAY_COMMERCE_CODE,
        'Tbk-Api-Key-Secret: ' . WEBPAY_API_KEY_SECRET,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    logFreePayment('WEBPAY_CREATE', ['ref' => $ref, 'amount' => $amount, 'http' => $httpCode]);

    if ($httpCode !== 200) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al crear transaccion WebPay', 'details' => json_decode($response, true)]);
        return;
    }

    $result = json_decode($response, true);

    echo json_encode([
        'success'      => true,
        'gateway'      => 'webpay',
        'ref'          => $ref,
        'token'        => $result['token'],
        'url'          => $result['url'],
        'redirect_url' => $result['url'] . '?token_ws=' . $result['token'],
    ]);
}

function handleWebpayCallback() {
    ob_start();

    $token = $_POST['token_ws'] ?? $_GET['token_ws'] ?? null;
    $tbkToken = $_POST['TBK_TOKEN'] ?? $_GET['TBK_TOKEN'] ?? null;

    logFreePayment('WEBPAY_CALLBACK', ['token_ws' => $token, 'TBK_TOKEN' => $tbkToken]);

    if ($tbkToken) {
        // User cancelled
        $buyOrder = $_POST['TBK_ORDEN_COMPRA'] ?? $_GET['TBK_ORDEN_COMPRA'] ?? '';
        if ($buyOrder && strpos($buyOrder, 'fp_') === 0) {
            updateFreePaymentByRef($buyOrder, [
                'estado' => 'cancelled',
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        }
        if (ob_get_level()) ob_end_clean();
        header_remove('Content-Type');
        http_response_code(302);
        header('Location: https://www.imporlan.cl/pagar/?estado=cancelado');
        exit();
    }

    if (!$token) {
        if (ob_get_level()) ob_end_clean();
        header_remove('Content-Type');
        http_response_code(302);
        header('Location: https://www.imporlan.cl/pagar/?estado=error&msg=no_token');
        exit();
    }

    // Commit the transaction
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, WEBPAY_API_URL . '/rswebpaytransaction/api/webpay/v1.2/transactions/' . $token);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Tbk-Api-Key-Id: ' . WEBPAY_COMMERCE_CODE,
        'Tbk-Api-Key-Secret: ' . WEBPAY_API_KEY_SECRET,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    logFreePayment('WEBPAY_COMMIT', ['http' => $httpCode, 'result' => $result]);

    if ($httpCode !== 200) {
        if (ob_get_level()) ob_end_clean();
        header_remove('Content-Type');
        http_response_code(302);
        header('Location: https://www.imporlan.cl/pagar/?estado=error&msg=commit_failed');
        exit();
    }

    $approved = isset($result['response_code']) && $result['response_code'] === 0;
    $buyOrder = $result['buy_order'] ?? '';

    // Clean up pending file
    $pendingFile = __DIR__ . '/fp_webpay_pending/' . $buyOrder . '.json';
    if (file_exists($pendingFile)) {
        unlink($pendingFile);
    }

    if ($approved && strpos($buyOrder, 'fp_') === 0) {
        updateFreePaymentByRef($buyOrder, [
            'estado'                 => 'paid',
            'transaction_id_gateway' => $result['authorization_code'] ?? $token,
            'updated_at'             => date('Y-m-d H:i:s'),
        ]);

        sendFreePaymentConfirmation($buyOrder);

        if (ob_get_level()) ob_end_clean();
        header_remove('Content-Type');
        http_response_code(302);
        header('Location: https://www.imporlan.cl/pagar/?estado=aprobado&ref=' . urlencode($buyOrder));
    } else {
        if (strpos($buyOrder, 'fp_') === 0) {
            updateFreePaymentByRef($buyOrder, [
                'estado'     => 'rejected',
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        }
        if (ob_get_level()) ob_end_clean();
        header_remove('Content-Type');
        http_response_code(302);
        header('Location: https://www.imporlan.cl/pagar/?estado=rechazado&ref=' . urlencode($buyOrder));
    }
    exit();
}

// ============================================================
// MERCADOPAGO
// ============================================================

function initMercadoPago() {
    $v = validateInput();
    if (!empty($v['errors'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'errors' => $v['errors']]);
        return;
    }

    $input = $v['input'];
    $ref = generateRef();
    $description = buildDescription($input);
    $amount = floatval($input['monto']);

    // Save pending record
    $record = createPaymentRecord($input, $ref);
    saveFreePayment($record);

    $config = getMercadoPagoConfig();

    $preferenceData = [
        'items' => [[
            'id'          => $ref,
            'title'       => $description,
            'description' => 'Pago libre Imporlan - ' . $ref,
            'quantity'    => 1,
            'currency_id' => 'CLP',
            'unit_price'  => $amount,
        ]],
        'back_urls' => [
            'success' => 'https://www.imporlan.cl/pagar/?estado=aprobado&ref=' . $ref,
            'failure' => 'https://www.imporlan.cl/pagar/?estado=rechazado&ref=' . $ref,
            'pending' => 'https://www.imporlan.cl/pagar/?estado=pendiente&ref=' . $ref,
        ],
        'auto_return'        => 'approved',
        'notification_url'   => 'https://www.imporlan.cl/api/free_payment_api.php?action=mp_webhook',
        'statement_descriptor' => 'IMPORLAN',
        'external_reference' => $ref,
    ];

    if (!empty($input['email'])) {
        $preferenceData['payer'] = ['email' => $input['email']];
        if (!empty($input['nombre'])) {
            $preferenceData['payer']['name'] = $input['nombre'];
        }
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.mercadopago.com/checkout/preferences');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($preferenceData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $config['access_token'],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    logFreePayment('MP_CREATE', ['ref' => $ref, 'amount' => $amount, 'http' => $httpCode]);

    if ($httpCode !== 201 && $httpCode !== 200) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al crear preferencia MercadoPago', 'details' => json_decode($response, true)]);
        return;
    }

    $preference = json_decode($response, true);

    echo json_encode([
        'success'       => true,
        'gateway'       => 'mercadopago',
        'ref'           => $ref,
        'preference_id' => $preference['id'],
        'init_point'    => $preference['init_point'],
    ]);
}

function handleMPWebhook() {
    $input = json_decode(file_get_contents('php://input'), true);

    logFreePayment('MP_WEBHOOK', $input ?? []);

    if (!isset($input['type']) || !isset($input['data']['id'])) {
        http_response_code(200);
        echo json_encode(['status' => 'ignored']);
        return;
    }

    if ($input['type'] === 'payment') {
        $paymentId = $input['data']['id'];

        $config = getMercadoPagoConfig();
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.mercadopago.com/v1/payments/' . $paymentId);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $config['access_token'],
        ]);
        $response = curl_exec($ch);
        curl_close($ch);

        $payment = json_decode($response, true);
        $extRef = $payment['external_reference'] ?? '';

        logFreePayment('MP_PAYMENT', ['id' => $paymentId, 'status' => $payment['status'] ?? null, 'ref' => $extRef]);

        if (strpos($extRef, 'fp_') === 0 && ($payment['status'] ?? '') === 'approved') {
            updateFreePaymentByRef($extRef, [
                'estado'                 => 'paid',
                'transaction_id_gateway' => strval($paymentId),
                'updated_at'             => date('Y-m-d H:i:s'),
            ]);
            sendFreePaymentConfirmation($extRef);
        }
    }

    http_response_code(200);
    echo json_encode(['status' => 'received']);
}

// ============================================================
// PAYPAL
// ============================================================

function initPayPal() {
    $v = validateInput();
    if (!empty($v['errors'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'errors' => $v['errors']]);
        return;
    }

    $input = $v['input'];
    $ref = generateRef();
    $description = buildDescription($input);
    $amount = floatval($input['monto']);
    $currency = strtoupper($input['moneda'] ?? 'USD');

    // For PayPal, force USD
    $currency = 'USD';

    // Save pending record
    $record = createPaymentRecord($input, $ref);
    $record['moneda'] = $currency;
    saveFreePayment($record);

    // Save pending file for capture
    $pendingDir = __DIR__ . '/fp_paypal_pending';
    if (!is_dir($pendingDir)) mkdir($pendingDir, 0755, true);

    $accessToken = getPayPalAccessToken();
    if (!$accessToken) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al obtener token PayPal']);
        return;
    }

    $config = getPayPalConfig();

    $orderData = [
        'intent' => 'CAPTURE',
        'purchase_units' => [[
            'description' => $description,
            'custom_id'   => $ref,
            'amount'      => [
                'currency_code' => $currency,
                'value'         => number_format($amount, 2, '.', ''),
            ],
        ]],
        'application_context' => [
            'brand_name'   => 'Imporlan',
            'landing_page' => 'NO_PREFERENCE',
            'user_action'  => 'PAY_NOW',
            'return_url'   => 'https://www.imporlan.cl/pagar/?estado=aprobado&ref=' . $ref,
            'cancel_url'   => 'https://www.imporlan.cl/pagar/?estado=cancelado&ref=' . $ref,
        ],
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $config['url'] . '/v2/checkout/orders');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    logFreePayment('PAYPAL_CREATE', ['ref' => $ref, 'amount' => $amount, 'http' => $httpCode]);

    if ($httpCode !== 201) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al crear orden PayPal', 'details' => json_decode($response, true)]);
        return;
    }

    $order = json_decode($response, true);

    // Save pending info
    file_put_contents($pendingDir . '/' . $order['id'] . '.json', json_encode([
        'ref'   => $ref,
        'input' => $input,
    ]));

    // Find approval URL for redirect flow
    $approvalUrl = '';
    foreach (($order['links'] ?? []) as $link) {
        if ($link['rel'] === 'approve') {
            $approvalUrl = $link['href'];
            break;
        }
    }

    echo json_encode([
        'success'      => true,
        'gateway'      => 'paypal',
        'ref'          => $ref,
        'order_id'     => $order['id'],
        'status'       => $order['status'],
        'approval_url' => $approvalUrl,
    ]);
}

function capturePayPal() {
    $input = json_decode(file_get_contents('php://input'), true);
    $orderId = $input['order_id'] ?? '';

    if (empty($orderId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'order_id es requerido']);
        return;
    }

    $accessToken = getPayPalAccessToken();
    if (!$accessToken) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al obtener token PayPal']);
        return;
    }

    $config = getPayPalConfig();

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $config['url'] . '/v2/checkout/orders/' . $orderId . '/capture');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, '');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    logFreePayment('PAYPAL_CAPTURE', ['order_id' => $orderId, 'http' => $httpCode]);

    if ($httpCode !== 201 && $httpCode !== 200) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al capturar pago PayPal', 'details' => json_decode($response, true)]);
        return;
    }

    $capture = json_decode($response, true);
    $captureId = $capture['purchase_units'][0]['payments']['captures'][0]['id'] ?? null;

    // Retrieve ref from pending file
    $pendingFile = __DIR__ . '/fp_paypal_pending/' . $orderId . '.json';
    $ref = null;
    if (file_exists($pendingFile)) {
        $pending = json_decode(file_get_contents($pendingFile), true);
        $ref = $pending['ref'] ?? null;
        unlink($pendingFile);
    }

    if ($ref && ($capture['status'] ?? '') === 'COMPLETED') {
        updateFreePaymentByRef($ref, [
            'estado'                 => 'paid',
            'transaction_id_gateway' => $captureId ?? $orderId,
            'updated_at'             => date('Y-m-d H:i:s'),
        ]);
        sendFreePaymentConfirmation($ref);
    }

    echo json_encode([
        'success' => true,
        'status'  => $capture['status'] ?? 'UNKNOWN',
        'ref'     => $ref,
        'capture_id' => $captureId,
    ]);
}

function getPayPalAccessToken() {
    $config = getPayPalConfig();

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $config['url'] . '/v1/oauth2/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, 'grant_type=client_credentials');
    curl_setopt($ch, CURLOPT_USERPWD, $config['client_id'] . ':' . $config['secret']);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) return null;

    $data = json_decode($response, true);
    return $data['access_token'] ?? null;
}

// ============================================================
// STATUS & ADMIN
// ============================================================

function getPaymentStatus() {
    $ref = $_GET['ref'] ?? '';
    if (empty($ref)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Parametro ref es requerido']);
        return;
    }

    $data = loadFreePayments();
    foreach ($data['payments'] as $p) {
        if ($p['referencia'] === $ref) {
            echo json_encode([
                'success' => true,
                'payment' => [
                    'referencia' => $p['referencia'],
                    'estado'     => $p['estado'],
                    'monto'      => $p['monto'],
                    'moneda'     => $p['moneda'],
                    'gateway'    => $p['gateway'],
                    'concepto'   => $p['concepto'],
                    'fecha'      => $p['fecha'],
                ],
            ]);
            return;
        }
    }

    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Pago no encontrado']);
}

function adminListPayments() {
    // Require admin auth
    require_once __DIR__ . '/auth_helper.php';
    $admin = requireAdminAuthShared();

    $data = loadFreePayments();
    $payments = $data['payments'];

    // Filters
    $filterStatus = $_GET['estado'] ?? null;
    $filterGateway = $_GET['gateway'] ?? null;
    if ($filterStatus) {
        $payments = array_filter($payments, fn($p) => $p['estado'] === $filterStatus);
    }
    if ($filterGateway) {
        $payments = array_filter($payments, fn($p) => $p['gateway'] === $filterGateway);
    }

    // Sort newest first
    usort($payments, fn($a, $b) => strtotime($b['created_at']) - strtotime($a['created_at']));

    // Pagination
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = min(100, max(1, intval($_GET['limit'] ?? 50)));
    $total = count($payments);
    $pages = ceil($total / $limit);
    $offset = ($page - 1) * $limit;

    echo json_encode([
        'success'  => true,
        'payments' => array_values(array_slice($payments, $offset, $limit)),
        'total'    => $total,
        'page'     => $page,
        'pages'    => $pages,
    ]);
}

// ============================================================
// EMAIL NOTIFICATION
// ============================================================

function sendFreePaymentConfirmation($ref) {
    try {
        $data = loadFreePayments();
        $payment = null;
        foreach ($data['payments'] as $p) {
            if ($p['referencia'] === $ref) {
                $payment = $p;
                break;
            }
        }
        if (!$payment || empty($payment['email'])) return;

        $emailService = new EmailService();
        $nombre = $payment['nombre'] ?: explode('@', $payment['email'])[0];
        $monto = number_format($payment['monto'], 0, ',', '.');
        $moneda = $payment['moneda'] ?? 'CLP';
        $concepto = $payment['concepto'] ?: 'Pago libre';
        $gateway = strtoupper($payment['gateway']);

        $subject = 'Pago confirmado - Imporlan';
        $body = "
        <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>
            <div style='background:#1a365d;padding:20px;text-align:center;'>
                <h1 style='color:#fff;margin:0;font-size:24px;'>Pago Confirmado</h1>
            </div>
            <div style='padding:30px;background:#f7fafc;'>
                <p>Hola <strong>{$nombre}</strong>,</p>
                <p>Tu pago ha sido procesado exitosamente.</p>
                <table style='width:100%;border-collapse:collapse;margin:20px 0;'>
                    <tr style='border-bottom:1px solid #e2e8f0;'>
                        <td style='padding:10px 0;color:#718096;'>Referencia</td>
                        <td style='padding:10px 0;font-weight:bold;text-align:right;'>{$ref}</td>
                    </tr>
                    <tr style='border-bottom:1px solid #e2e8f0;'>
                        <td style='padding:10px 0;color:#718096;'>Concepto</td>
                        <td style='padding:10px 0;text-align:right;'>{$concepto}</td>
                    </tr>
                    <tr style='border-bottom:1px solid #e2e8f0;'>
                        <td style='padding:10px 0;color:#718096;'>Monto</td>
                        <td style='padding:10px 0;font-weight:bold;font-size:18px;text-align:right;'>\${$monto} {$moneda}</td>
                    </tr>
                    <tr style='border-bottom:1px solid #e2e8f0;'>
                        <td style='padding:10px 0;color:#718096;'>Medio de pago</td>
                        <td style='padding:10px 0;text-align:right;'>{$gateway}</td>
                    </tr>
                    <tr>
                        <td style='padding:10px 0;color:#718096;'>Fecha</td>
                        <td style='padding:10px 0;text-align:right;'>" . date('d/m/Y H:i') . "</td>
                    </tr>
                </table>
                <p style='color:#718096;font-size:14px;'>Conserva este correo como comprobante de pago.</p>
            </div>
            <div style='background:#edf2f7;padding:15px;text-align:center;font-size:12px;color:#a0aec0;'>
                Imporlan - Importacion de embarcaciones<br>www.imporlan.cl
            </div>
        </div>";

        $emailService->sendEmail($payment['email'], $subject, $body);

        // Also notify admin
        $adminBody = "
        <div style='font-family:Arial,sans-serif;'>
            <h2>Nuevo pago libre recibido</h2>
            <p><strong>Ref:</strong> {$ref}</p>
            <p><strong>Nombre:</strong> {$nombre}</p>
            <p><strong>Email:</strong> {$payment['email']}</p>
            <p><strong>Telefono:</strong> {$payment['telefono']}</p>
            <p><strong>Monto:</strong> \${$monto} {$moneda}</p>
            <p><strong>Concepto:</strong> {$concepto}</p>
            <p><strong>Cotizacion:</strong> {$payment['cotizacion']}</p>
            <p><strong>Expediente:</strong> {$payment['expediente']}</p>
            <p><strong>Gateway:</strong> {$gateway}</p>
            <p><strong>Fecha:</strong> " . date('d/m/Y H:i') . "</p>
        </div>";

        $emailService->sendEmail(SMTP_USER, 'Pago libre recibido - $' . $monto . ' ' . $moneda . ' - ' . $nombre, $adminBody);

        logFreePayment('EMAIL_SENT', ['ref' => $ref, 'to' => $payment['email']]);
    } catch (Exception $e) {
        logFreePayment('EMAIL_ERROR', ['ref' => $ref, 'error' => $e->getMessage()]);
    }
}
