<?php
/**
 * MercadoPago Payment API - Imporlan
 * 
 * Endpoints para procesar pagos con MercadoPago
 * 
 * Uso:
 * - POST /mercadopago.php?action=create_preference - Crear una preferencia de pago
 * - GET /mercadopago.php?action=get_public_key - Obtener la Public Key para el frontend
 * - POST /mercadopago.php?action=webhook - Webhook para notificaciones de pago
 */

require_once 'config.php';
require_once __DIR__ . '/email_service.php';

setCorsHeaders();

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get_public_key':
        getPublicKey();
        break;
    case 'create_preference':
        createPreference();
        break;
    case 'webhook':
        handleWebhook();
        break;
    case 'get_payment':
        getPayment();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Acción no válida']);
}

/**
 * Obtener la Public Key de MercadoPago para el frontend
 */
function getPublicKey() {
    $config = getMercadoPagoConfig();
    echo json_encode([
        'public_key' => $config['public_key'],
        'environment' => PAYMENT_ENVIRONMENT
    ]);
}

/**
 * Crear una preferencia de pago en MercadoPago
 */
function createPreference() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['amount']) || !isset($input['description'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Faltan parámetros: amount, description']);
        return;
    }
    
    $amount = floatval($input['amount']);
    $description = $input['description'];
    $planName = $input['plan_name'] ?? 'Plan Imporlan';
    $quantity = intval($input['quantity'] ?? 1);
    
    // Información del comprador (opcional)
    $payerEmail = $input['payer_email'] ?? null;
    $payerName = $input['payer_name'] ?? null;
    
    $config = getMercadoPagoConfig();
    
    $preferenceData = [
        'items' => [
            [
                'id' => uniqid('imporlan_'),
                'title' => $planName,
                'description' => $description,
                'quantity' => $quantity,
                'currency_id' => 'CLP',
                'unit_price' => $amount
            ]
        ],
        'back_urls' => [
            'success' => 'https://www.imporlan.cl/panel/#myproducts',
            'failure' => 'https://www.imporlan.cl/panel/#myproducts',
            'pending' => 'https://www.imporlan.cl/panel/#myproducts'
        ],
        'auto_return' => 'approved',
        'notification_url' => 'https://www.imporlan.cl/api/mercadopago.php?action=webhook',
        'statement_descriptor' => 'IMPORLAN',
        'external_reference' => $planName . '_' . time()
    ];
    
    // Agregar información del pagador si está disponible
    if ($payerEmail) {
        $preferenceData['payer'] = [
            'email' => $payerEmail
        ];
        if ($payerName) {
            $preferenceData['payer']['name'] = $payerName;
        }
    }
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.mercadopago.com/checkout/preferences');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($preferenceData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $config['access_token']
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 201 && $httpCode !== 200) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Error al crear preferencia en MercadoPago',
            'details' => json_decode($response, true)
        ]);
        return;
    }
    
    $preference = json_decode($response, true);
    
    echo json_encode([
        'success' => true,
        'preference_id' => $preference['id'],
        'init_point' => $preference['init_point'],
        'sandbox_init_point' => $preference['sandbox_init_point'] ?? $preference['init_point']
    ]);
}

/**
 * Manejar webhook de notificaciones de MercadoPago
 */
function handleWebhook() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Log del webhook para debugging
    $logFile = __DIR__ . '/mp_webhooks.log';
    $logEntry = date('Y-m-d H:i:s') . ' - ' . json_encode($input) . "\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND);
    
    if (!isset($input['type']) || !isset($input['data']['id'])) {
        http_response_code(200);
        echo json_encode(['status' => 'ignored']);
        return;
    }
    
    if ($input['type'] === 'payment') {
        $paymentId = $input['data']['id'];
        
        // Obtener detalles del pago
        $config = getMercadoPagoConfig();
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.mercadopago.com/v1/payments/' . $paymentId);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $config['access_token']
        ]);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $payment = json_decode($response, true);
        
        // Log del pago
        $paymentLog = date('Y-m-d H:i:s') . ' - Payment: ' . json_encode([
            'id' => $payment['id'] ?? null,
            'status' => $payment['status'] ?? null,
            'amount' => $payment['transaction_amount'] ?? null,
            'payer_email' => $payment['payer']['email'] ?? null
        ]) . "\n";
        file_put_contents($logFile, $paymentLog, FILE_APPEND);
        
        // Guardar compra si el pago fue aprobado
        if (($payment['status'] ?? '') === 'approved' && isset($payment['payer']['email'])) {
            $externalRef = $payment['external_reference'] ?? '';
            $description = $payment['description'] ?? $payment['additional_info']['items'][0]['title'] ?? 'Compra Imporlan';
            
            // Determinar tipo de compra basado en external_reference o descripcion
            $purchaseType = 'link';
            $planName = '';
            $planDays = 7;
            
            if (stripos($externalRef, 'plan') !== false || stripos($description, 'plan') !== false) {
                $purchaseType = 'plan';
                $planName = $description;
                if (stripos($description, 'capitan') !== false || stripos($description, 'navio') !== false) {
                    $planDays = 14;
                } else if (stripos($description, 'fragata') !== false) {
                    $planDays = 7;
                }
            }
            
            $purchase = savePurchase([
                'user_email' => $payment['payer']['email'],
                'type' => $purchaseType,
                'description' => $description,
                'url' => '',
                'plan_name' => $planName,
                'days' => $planDays,
                'amount' => $payment['transaction_amount'] ?? 0,
                'amount_clp' => $payment['transaction_amount'] ?? 0,
                'currency' => $payment['currency_id'] ?? 'CLP',
                'payment_method' => 'mercadopago',
                'payment_id' => $paymentId,
                'order_id' => $externalRef,
                'status' => 'pending'
            ]);
            
            if (empty($purchase['_duplicate'])) {
                sendMercadoPagoConfirmationEmail($purchase, $payment);
            }
        }
    }
    
    http_response_code(200);
    echo json_encode(['status' => 'received']);
}

/**
 * Send purchase confirmation email via EmailService
 */
function sendMercadoPagoConfirmationEmail($purchase, $payment) {
    try {
        $emailService = new EmailService();
        
        $payerName = trim(($payment['payer']['first_name'] ?? '') . ' ' . ($payment['payer']['last_name'] ?? ''));
        if (empty($payerName)) {
            $payerName = $purchase['user_email'];
        }
        
        $productName = $purchase['plan_name'] ?: $purchase['description'];
        
        $items = [];
        $mpItems = $payment['additional_info']['items'] ?? [];
        if (!empty($mpItems)) {
            foreach ($mpItems as $mpItem) {
                $itemTitle = $mpItem['title'] ?? $mpItem['description'] ?? 'Servicio Imporlan';
                $itemUrl = '';
                if (strpos($itemTitle, 'http') === 0) {
                    $itemUrl = $itemTitle;
                }
                $items[] = [
                    'title' => $itemTitle,
                    'description' => $mpItem['description'] ?? '',
                    'url' => $itemUrl
                ];
            }
        }
        if (empty($items)) {
            $items[] = ['title' => $productName ?: 'Compra Imporlan'];
        }
        
        $plansConfig = [
            'fragata' => ['name' => 'Plan Fragata', 'days' => 7, 'proposals' => 5, 'features' => ['1 Requerimiento especifico', '5 propuestas/cotizaciones', 'Analisis ofertas y recomendacion']],
            'capitan' => ['name' => 'Plan Capitan de Navio', 'days' => 14, 'proposals' => 9, 'features' => ['1 Requerimiento especifico', '9 propuestas/cotizaciones', 'Analisis ofertas y recomendacion']],
            'almirante' => ['name' => 'Plan Almirante', 'days' => 21, 'proposals' => 15, 'features' => ['1 Requerimiento especifico', '15 propuestas/cotizaciones', 'Analisis ofertas y recomendacion']]
        ];
        
        $purchaseType = $purchase['type'];
        $planName = $purchase['plan_name'] ?: $productName;
        $planDays = $purchase['days'] ?? 7;
        $planProposals = 5;
        $planFeatures = [];
        $planEndDate = '';
        
        if ($purchaseType === 'plan') {
            $descLower = strtolower($productName . ' ' . $planName);
            foreach ($plansConfig as $key => $cfg) {
                if (stripos($descLower, $key) !== false || stripos($descLower, $cfg['name']) !== false) {
                    $planName = $cfg['name'];
                    $planDays = $cfg['days'];
                    $planProposals = $cfg['proposals'];
                    $planFeatures = $cfg['features'];
                    break;
                }
            }
            $planEndDate = date('d/m/Y', strtotime('+' . $planDays . ' days'));
        }
        
        $commonData = [
            'description' => $productName ?: ($purchaseType === 'plan' ? $planName : 'Cotizacion por Links'),
            'items' => $items,
            'price' => $purchase['amount_clp'],
            'currency' => $purchase['currency'] ?? 'CLP',
            'payment_method' => 'MercadoPago',
            'payment_reference' => $purchase['payment_id'],
            'purchase_date' => date('d/m/Y'),
            'user_email' => $purchase['user_email'],
            'order_id' => $purchase['order_id'],
            'purchase_type' => $purchaseType,
            'plan_name' => $planName,
            'plan_days' => $planDays,
            'plan_proposals' => $planProposals,
            'plan_features' => $planFeatures,
            'plan_end_date' => $planEndDate
        ];
        
        $emailService->sendQuotationLinksPaidEmail(
            $purchase['user_email'],
            $payerName,
            $commonData
        );
        
        $storedLinks = $emailService->getStoredQuotationLinks($purchase['user_email']);
        $formData = array_merge($commonData, [
            'boat_links' => $storedLinks,
            'name' => $payerName
        ]);
        $emailService->sendQuotationFormEmail(
            $purchase['user_email'],
            $payerName,
            $formData
        );
        
        if ($purchaseType === 'plan') {
            $emailService->sendPlanBusquedaEmail(
                $purchase['user_email'],
                $payerName,
                $commonData
            );
        } else {
            $emailService->sendCotizacionPorLinksEmail(
                $purchase['user_email'],
                $payerName,
                $commonData
            );
        }
        
        $logFile = __DIR__ . '/mp_webhooks.log';
        $logEntry = date('Y-m-d H:i:s') . ' - EMAIL_SENT: to=' . $purchase['user_email'] . ', order=' . $purchase['order_id'] . ", emails=payment+form+activation\n";
        file_put_contents($logFile, $logEntry, FILE_APPEND);
    } catch (Exception $e) {
        $logFile = __DIR__ . '/mp_webhooks.log';
        $logEntry = date('Y-m-d H:i:s') . ' - EMAIL_ERROR: ' . $e->getMessage() . "\n";
        file_put_contents($logFile, $logEntry, FILE_APPEND);
    }
}

/**
 * Guardar compra en purchases.json
 */
function savePurchase($purchaseData) {
    $purchasesFile = __DIR__ . '/purchases.json';
    
    // Inicializar archivo si no existe
    if (!file_exists($purchasesFile)) {
        file_put_contents($purchasesFile, json_encode(['purchases' => []]));
    }
    
    $data = json_decode(file_get_contents($purchasesFile), true);
    
    // Verificar si ya existe una compra con el mismo payment_id para evitar duplicados
    foreach ($data['purchases'] as $existing) {
        if (isset($existing['payment_id']) && $existing['payment_id'] === $purchaseData['payment_id']) {
            $existing['_duplicate'] = true;
            return $existing;
        }
    }
    
    $purchase = [
        'id' => 'pur_' . uniqid(),
        'user_email' => $purchaseData['user_email'],
        'type' => $purchaseData['type'],
        'description' => $purchaseData['description'] ?? '',
        'plan_name' => $purchaseData['plan_name'] ?? '',
        'url' => $purchaseData['url'] ?? '',
        'amount' => floatval($purchaseData['amount']),
        'amount_clp' => intval($purchaseData['amount_clp'] ?? $purchaseData['amount']),
        'currency' => $purchaseData['currency'] ?? 'CLP',
        'payment_method' => $purchaseData['payment_method'],
        'payment_id' => $purchaseData['payment_id'] ?? null,
        'order_id' => $purchaseData['order_id'] ?? null,
        'status' => $purchaseData['status'] ?? 'pending',
        'days' => intval($purchaseData['days'] ?? 7),
        'proposals_total' => intval($purchaseData['proposals_total'] ?? 5),
        'proposals_received' => 0,
        'date' => date('d M Y'),
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    if ($purchase['type'] === 'plan') {
        $purchase['end_date'] = date('d M Y', strtotime('+' . $purchase['days'] . ' days'));
    }
    
    $data['purchases'][] = $purchase;
    
    file_put_contents($purchasesFile, json_encode($data, JSON_PRETTY_PRINT));
    
    return $purchase;
}

/**
 * Obtener información de un pago específico
 */
function getPayment() {
    $paymentId = $_GET['payment_id'] ?? null;
    
    if (!$paymentId) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta el parámetro: payment_id']);
        return;
    }
    
    $config = getMercadoPagoConfig();
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.mercadopago.com/v1/payments/' . $paymentId);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $config['access_token']
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Error al obtener pago de MercadoPago',
            'details' => json_decode($response, true)
        ]);
        return;
    }
    
    $payment = json_decode($response, true);
    
    echo json_encode([
        'success' => true,
        'payment' => [
            'id' => $payment['id'],
            'status' => $payment['status'],
            'status_detail' => $payment['status_detail'],
            'amount' => $payment['transaction_amount'],
            'currency' => $payment['currency_id'],
            'payer_email' => $payment['payer']['email'] ?? null,
            'date_created' => $payment['date_created'],
            'date_approved' => $payment['date_approved'] ?? null
        ]
    ]);
}
