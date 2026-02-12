<?php
/**
 * PayPal Payment API - Imporlan
 * 
 * Endpoints para procesar pagos con PayPal
 * 
 * Uso:
 * - POST /paypal.php?action=create_order - Crear una orden de pago
 * - POST /paypal.php?action=capture_order - Capturar el pago de una orden
 * - GET /paypal.php?action=get_client_id - Obtener el Client ID para el frontend
 */

require_once 'config.php';
require_once __DIR__ . '/email_service.php';
require_once __DIR__ . '/db_config.php';

setCorsHeaders();

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get_client_id':
        getClientId();
        break;
    case 'create_order':
        createOrder();
        break;
    case 'capture_order':
        captureOrder();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Acción no válida']);
}

/**
 * Obtener el Client ID de PayPal para el frontend
 */
function getClientId() {
    $config = getPayPalConfig();
    echo json_encode([
        'client_id' => $config['client_id'],
        'environment' => PAYMENT_ENVIRONMENT
    ]);
}

/**
 * Obtener token de acceso de PayPal
 */
function getAccessToken() {
    $config = getPayPalConfig();
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $config['url'] . '/v1/oauth2/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, 'grant_type=client_credentials');
    curl_setopt($ch, CURLOPT_USERPWD, $config['client_id'] . ':' . $config['secret']);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/x-www-form-urlencoded'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        return null;
    }
    
    $data = json_decode($response, true);
    return $data['access_token'] ?? null;
}

/**
 * Crear una orden de pago en PayPal
 */
function createOrder() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['amount']) || !isset($input['description'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Faltan parámetros: amount, description']);
        return;
    }
    
    $amount = floatval($input['amount']);
    $description = $input['description'];
    $currency = $input['currency'] ?? 'USD';
    $planName = $input['plan_name'] ?? 'Plan Imporlan';
    
    $accessToken = getAccessToken();
    if (!$accessToken) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener token de PayPal']);
        return;
    }
    
    $config = getPayPalConfig();
    
    $orderData = [
        'intent' => 'CAPTURE',
        'purchase_units' => [
            [
                'description' => $description,
                'custom_id' => $planName,
                'amount' => [
                    'currency_code' => $currency,
                    'value' => number_format($amount, 2, '.', '')
                ]
            ]
        ],
        'application_context' => [
            'brand_name' => 'Imporlan',
            'landing_page' => 'NO_PREFERENCE',
            'user_action' => 'PAY_NOW',
            'return_url' => 'https://www.imporlan.cl/panel/#myproducts',
            'cancel_url' => 'https://www.imporlan.cl/panel/#myproducts'
        ]
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $config['url'] . '/v2/checkout/orders');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 201) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Error al crear orden en PayPal',
            'details' => json_decode($response, true)
        ]);
        return;
    }
    
    $order = json_decode($response, true);
    echo json_encode([
        'success' => true,
        'order_id' => $order['id'],
        'status' => $order['status']
    ]);
    
    // Notificar a admins si vienen datos del cotizador
    try {
        $emailService = new EmailService();
        $emailService->sendQuotationRequestNotification([
            'name' => $input['payer_name'] ?? 'Cliente',
            'email' => $input['payer_email'] ?? '',
            'phone' => $input['payer_phone'] ?? '',
            'country' => $input['country'] ?? 'Chile',
            'boat_links' => $input['boat_links'] ?? []
        ]);
    } catch (Exception $e) {
        $logFile = __DIR__ . '/paypal.log';
        file_put_contents($logFile, date('Y-m-d H:i:s') . ' - NOTIF_ERROR: ' . $e->getMessage() . "\n", FILE_APPEND);
    }
}

/**
 * Capturar el pago de una orden
 */
function captureOrder() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['order_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta el parámetro: order_id']);
        return;
    }
    
    $orderId = $input['order_id'];
    $userEmail = $input['user_email'] ?? null;
    $purchaseType = $input['purchase_type'] ?? 'link';
    $purchaseDescription = $input['purchase_description'] ?? '';
    $purchaseUrl = $input['purchase_url'] ?? '';
    $planName = $input['plan_name'] ?? '';
    $planDays = $input['plan_days'] ?? 7;
    $amountCLP = $input['amount_clp'] ?? 0;
    
    $accessToken = getAccessToken();
    if (!$accessToken) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener token de PayPal']);
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
        'Authorization: Bearer ' . $accessToken
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 201 && $httpCode !== 200) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Error al capturar pago en PayPal',
            'details' => json_decode($response, true)
        ]);
        return;
    }
    
    $capture = json_decode($response, true);
    
    // Extraer información del pago
    $payerEmail = $capture['payer']['email_address'] ?? $userEmail ?? 'N/A';
    $amount = $capture['purchase_units'][0]['payments']['captures'][0]['amount']['value'] ?? 0;
    $currency = $capture['purchase_units'][0]['payments']['captures'][0]['amount']['currency_code'] ?? 'USD';
    $captureId = $capture['purchase_units'][0]['payments']['captures'][0]['id'] ?? null;
    
    $paymentInfo = [
        'order_id' => $orderId,
        'status' => $capture['status'],
        'payer_email' => $payerEmail,
        'amount' => $amount,
        'currency' => $currency,
        'capture_id' => $captureId,
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    // Guardar la compra en purchases.json si tenemos el email del usuario
    if ($userEmail && $capture['status'] === 'COMPLETED') {
        $purchaseRecord = savePurchase([
            'user_email' => $userEmail,
            'type' => $purchaseType,
            'description' => $purchaseDescription,
            'url' => $purchaseUrl,
            'plan_name' => $planName,
            'days' => $planDays,
            'amount' => $amount,
            'amount_clp' => $amountCLP,
            'currency' => $currency,
            'payment_method' => 'paypal',
            'payment_id' => $captureId,
            'order_id' => $orderId,
            'status' => 'pending'
        ]);
        
        sendPayPalConfirmationEmails($purchaseRecord, $userEmail);
        createPayPalPaymentNotificationMessage($purchaseRecord, $userEmail);
    }
    
    echo json_encode([
        'success' => true,
        'payment' => $paymentInfo
    ]);
}

/**
 * Send purchase confirmation + quotation form emails for PayPal
 */
function sendPayPalConfirmationEmails($purchase, $userEmail) {
    try {
        require_once __DIR__ . '/email_service.php';
        
        $emailService = new EmailService();
        $payerName = $userEmail;
        $productName = $purchase['plan_name'] ?: $purchase['description'];
        $purchaseType = $purchase['type'] ?? 'link';
        
        $plansConfig = [
            'fragata' => ['name' => 'Plan Fragata', 'days' => 7, 'proposals' => 5, 'features' => ['1 Requerimiento especifico', '5 propuestas/cotizaciones', 'Analisis ofertas y recomendacion']],
            'capitan' => ['name' => 'Plan Capitan de Navio', 'days' => 14, 'proposals' => 9, 'features' => ['1 Requerimiento especifico', '9 propuestas/cotizaciones', 'Analisis ofertas y recomendacion']],
            'almirante' => ['name' => 'Plan Almirante', 'days' => 21, 'proposals' => 15, 'features' => ['1 Requerimiento especifico', '15 propuestas/cotizaciones', 'Analisis ofertas y recomendacion']]
        ];
        
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
        
        $items = [['title' => $productName ?: 'Compra Imporlan', 'description' => '', 'url' => '']];
        
        $commonData = [
            'description' => $productName ?: ($purchaseType === 'plan' ? $planName : 'Cotizacion por Links'),
            'items' => $items,
            'price' => $purchase['amount_clp'],
            'currency' => $purchase['currency'] ?? 'CLP',
            'payment_method' => 'PayPal',
            'payment_reference' => $purchase['payment_id'] ?? $purchase['order_id'],
            'purchase_date' => date('d/m/Y'),
            'user_email' => $userEmail,
            'order_id' => $purchase['order_id'],
            'purchase_type' => $purchaseType,
            'plan_name' => $planName,
            'plan_days' => $planDays,
            'plan_proposals' => $planProposals,
            'plan_features' => $planFeatures,
            'plan_end_date' => $planEndDate
        ];
        
        $emailService->sendQuotationLinksPaidEmail(
            $userEmail,
            $payerName,
            $commonData
        );
        
        $storedLinks = $emailService->getStoredQuotationLinks($userEmail);
        $formData = array_merge($commonData, [
            'boat_links' => $storedLinks,
            'name' => $payerName
        ]);
        $emailService->sendQuotationFormEmail(
            $userEmail,
            $payerName,
            $formData
        );
        
        if ($purchaseType === 'plan') {
            $emailService->sendPlanBusquedaEmail(
                $userEmail,
                $payerName,
                $commonData
            );
        } else {
            $emailService->sendCotizacionPorLinksEmail(
                $userEmail,
                $payerName,
                $commonData
            );
        }
        
        $logFile = __DIR__ . '/paypal.log';
        $logEntry = date('Y-m-d H:i:s') . ' - EMAIL_SENT: to=' . $userEmail . ', order=' . ($purchase['order_id'] ?? '') . ", emails=payment+form+activation\n";
        file_put_contents($logFile, $logEntry, FILE_APPEND);
    } catch (Exception $e) {
        $logFile = __DIR__ . '/paypal.log';
        $logEntry = date('Y-m-d H:i:s') . ' - EMAIL_ERROR: ' . $e->getMessage() . "\n";
        file_put_contents($logFile, $logEntry, FILE_APPEND);
    }
}

/**
 * Crear mensaje de sistema en el chat del panel tras pago con PayPal
 */
function createPayPalPaymentNotificationMessage($purchase, $userEmail) {
    try {
        $pdo = getDbConnection();
        if (!$pdo) return;
        if (empty($userEmail)) return;
        $userName = $userEmail;

        $stmt = $pdo->prepare("SELECT id FROM chat_conversations WHERE user_email = ? AND status = 'open' ORDER BY updated_at DESC LIMIT 1");
        $stmt->execute([$userEmail]);
        $conv = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$conv) {
            $stmt = $pdo->prepare("INSERT INTO chat_conversations (user_email, user_name, status, auto_messages_sent) VALUES (?, ?, 'open', '{}')");
            $stmt->execute([$userEmail, $userName]);
            $conversationId = intval($pdo->lastInsertId());
        } else {
            $conversationId = intval($conv['id']);
        }

        $amount = number_format($purchase['amount_clp'] ?? $purchase['amount'] ?? 0, 0, ',', '.');
        $description = $purchase['description'] ?? 'Servicio Imporlan';
        $isPlan = ($purchase['type'] ?? '') === 'plan';

        if ($isPlan) {
            $planName = $purchase['plan_name'] ?: $description;
            $message = "Pago confirmado\n\n" .
                "Tu pago por {$planName} ha sido procesado exitosamente via PayPal.\n\n" .
                "Monto: \${$amount} CLP\n" .
                "Fecha: " . date('d/m/Y H:i') . "\n\n" .
                "Tu plan ya esta activo. Nuestro equipo comenzara a trabajar en tu requerimiento de inmediato.\n\n" .
                "Puedes ver el estado en la seccion 'Mis Productos Contratados' de tu panel.";
        } else {
            $message = "Pago confirmado\n\n" .
                "Tu pago por Cotizacion por Links ha sido procesado exitosamente via PayPal.\n\n" .
                "Monto: \${$amount} CLP\n" .
                "Fecha: " . date('d/m/Y H:i') . "\n\n" .
                "Nuestro equipo revisara tu solicitud y te enviaremos la cotizacion a la brevedad.\n\n" .
                "Puedes ver el estado en la seccion 'Mis Productos Contratados' de tu panel.";
        }

        $stmt = $pdo->prepare("INSERT INTO chat_messages (conversation_id, sender_id, sender_role, sender_name, sender_email, message) VALUES (?, 0, 'system', 'Sistema Imporlan', NULL, ?)");
        $stmt->execute([$conversationId, $message]);

        $stmt = $pdo->prepare("UPDATE chat_conversations SET updated_at = NOW() WHERE id = ?");
        $stmt->execute([$conversationId]);

        $logFile = __DIR__ . '/paypal.log';
        file_put_contents($logFile, date('Y-m-d H:i:s') . " - CHAT_MSG_SENT: conv={$conversationId}, user={$userEmail}\n", FILE_APPEND);
    } catch (Exception $e) {
        $logFile = __DIR__ . '/paypal.log';
        file_put_contents($logFile, date('Y-m-d H:i:s') . ' - CHAT_MSG_ERROR: ' . $e->getMessage() . "\n", FILE_APPEND);
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
    
    $purchase = [
        'id' => 'pur_' . uniqid(),
        'user_email' => $purchaseData['user_email'],
        'type' => $purchaseData['type'],
        'description' => $purchaseData['description'] ?? '',
        'plan_name' => $purchaseData['plan_name'] ?? '',
        'url' => $purchaseData['url'] ?? '',
        'amount' => floatval($purchaseData['amount']),
        'amount_clp' => intval($purchaseData['amount_clp'] ?? $purchaseData['amount']),
        'currency' => $purchaseData['currency'] ?? 'USD',
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
