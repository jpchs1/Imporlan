<?php
/**
 * WebPay Plus API for Imporlan WebPanel - PRODUCTION
 * Uses Transbank Production credentials
 * 
 * Endpoints:
 * - POST /webpay.php?action=create_transaction - Create a new transaction
 * - POST /webpay.php?action=commit_transaction - Commit a transaction
 * - GET /webpay.php?action=get_status - Get transaction status
 * - POST /webpay.php?action=refund - Refund a transaction
 * - GET/POST with token_ws - Callback from WebPay
 */

require_once 'config.php';
require_once __DIR__ . '/email_service.php';
require_once __DIR__ . '/db_config.php';

setCorsHeaders();

// WebPay Plus Integration/Test Credentials
// TODO: Replace with production credentials when available from Transbank
define('WEBPAY_COMMERCE_CODE', '597055555532');
define('WEBPAY_API_KEY_SECRET', '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C');
define('WEBPAY_API_URL', 'https://webpay3gint.transbank.cl');

// Get action from query string
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Handle WebPay callback (when user returns from payment)
if (isset($_POST['token_ws']) || isset($_GET['token_ws'])) {
    $action = 'callback';
}

// Get JSON input for API calls
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

switch ($action) {
    case 'create_transaction':
        header('Content-Type: application/json');
        createTransaction($input);
        break;
    case 'commit_transaction':
        header('Content-Type: application/json');
        commitTransaction($input);
        break;
    case 'callback':
        handleCallback();
        break;
    case 'get_status':
        header('Content-Type: application/json');
        getTransactionStatus($input);
        break;
    case 'refund':
        header('Content-Type: application/json');
        refundTransaction($input);
        break;
    default:
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false, 
            'error' => 'Invalid action',
            'available_actions' => ['create_transaction', 'commit_transaction', 'get_status', 'refund'],
            'environment' => 'PRODUCTION'
        ]);
}

/**
 * Create a new WebPay Plus transaction
 */
function createTransaction($data) {
    if (!isset($data['amount']) || !isset($data['buy_order'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required parameters: amount, buy_order']);
        return;
    }
    
    $amount = intval($data['amount']);
    $sessionId = $data['session_id'] ?? 'session_' . time();
    $buyOrder = $data['buy_order'];
    
    // Store purchase info in session for later use in callback
    $purchaseInfo = [
        'user_email' => $data['user_email'] ?? null,
        'payer_name' => $data['payer_name'] ?? null,
        'plan_name' => $data['plan_name'] ?? '',
        'description' => $data['description'] ?? '',
        'type' => $data['type'] ?? 'link',
        'days' => $data['days'] ?? 7,
        'amount' => $amount,
        'boat_links' => $data['boat_links'] ?? []
    ];
    
    // Save purchase info to a temporary file for retrieval in callback
    $tempFile = __DIR__ . '/webpay_pending/' . $buyOrder . '.json';
    if (!is_dir(__DIR__ . '/webpay_pending')) {
        mkdir(__DIR__ . '/webpay_pending', 0755, true);
    }
    file_put_contents($tempFile, json_encode($purchaseInfo));
    
    // Use the callback URL for WebPay to return to
    $returnUrl = 'https://www.imporlan.cl/api/webpay.php?action=callback';
    
    $requestData = [
        'buy_order' => $buyOrder,
        'session_id' => $sessionId,
        'amount' => $amount,
        'return_url' => $returnUrl
    ];
    
    // Log the transaction creation
    logWebpay('CREATE_TRANSACTION', $requestData);
    
    try {
        $emailService = new EmailService();
        $emailService->sendQuotationRequestNotification([
            'name' => $data['payer_name'] ?? 'Cliente',
            'email' => $data['user_email'] ?? '',
            'phone' => $data['payer_phone'] ?? '',
            'country' => $data['country'] ?? 'Chile',
            'boat_links' => $data['boat_links'] ?? []
        ]);
    } catch (Exception $e) {
        logWebpay('NOTIF_ERROR', ['error' => $e->getMessage()]);
    }
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, WEBPAY_API_URL . '/rswebpaytransaction/api/webpay/v1.2/transactions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Tbk-Api-Key-Id: ' . WEBPAY_COMMERCE_CODE,
        'Tbk-Api-Key-Secret: ' . WEBPAY_API_KEY_SECRET
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Error creating WebPay transaction',
            'http_code' => $httpCode,
            'details' => json_decode($response, true)
        ]);
        return;
    }
    
    $result = json_decode($response, true);
    
    echo json_encode([
        'success' => true,
        'token' => $result['token'],
        'url' => $result['url'],
        'redirect_url' => $result['url'] . '?token_ws=' . $result['token']
    ]);
}

/**
 * Handle WebPay callback when user returns from payment
 */
function handleCallback() {
    $token = $_POST['token_ws'] ?? $_GET['token_ws'] ?? null;
    $tbkToken = $_POST['TBK_TOKEN'] ?? $_GET['TBK_TOKEN'] ?? null;
    
    // Log callback
    logWebpay('CALLBACK', ['token_ws' => $token, 'TBK_TOKEN' => $tbkToken]);
    
    // If TBK_TOKEN is present, user cancelled the transaction
    if ($tbkToken) {
        header('Location: https://www.imporlan.cl/panel/#myproducts?payment=cancelled');
        exit();
    }
    
    if (!$token) {
        header('Location: https://www.imporlan.cl/panel/#myproducts?payment=error&message=no_token');
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
        'Tbk-Api-Key-Secret: ' . WEBPAY_API_KEY_SECRET
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $result = json_decode($response, true);
    
    // Log commit result
    logWebpay('COMMIT_RESULT', ['http_code' => $httpCode, 'result' => $result]);
    
    if ($httpCode !== 200) {
        header('Location: https://www.imporlan.cl/panel/#myproducts?payment=error&message=commit_failed');
        exit();
    }
    
    // Check if transaction was approved
    $approved = isset($result['response_code']) && $result['response_code'] === 0;
    
    if ($approved) {
        // Get the buy_order to retrieve purchase info
        $buyOrder = $result['buy_order'] ?? null;
        
        // Save purchase to purchases.json with full information
        savePurchaseFromWebpay($result, $buyOrder);
        
        header('Location: https://www.imporlan.cl/panel/#myproducts?payment=success&order=' . urlencode($buyOrder));
    } else {
        header('Location: https://www.imporlan.cl/panel/#myproducts?payment=rejected&code=' . ($result['response_code'] ?? 'unknown'));
    }
    exit();
}

/**
 * Save purchase to purchases.json with proper format (matching MercadoPago)
 */
function savePurchaseFromWebpay($transaction, $buyOrder) {
    $purchasesFile = __DIR__ . '/purchases.json';
    
    // Initialize file if it doesn't exist
    if (!file_exists($purchasesFile)) {
        file_put_contents($purchasesFile, json_encode(['purchases' => []]));
    }
    
    $data = json_decode(file_get_contents($purchasesFile), true);
    
    // Ensure purchases array exists
    if (!isset($data['purchases']) || !is_array($data['purchases'])) {
        $data = ['purchases' => []];
    }
    
    // Try to get purchase info from pending file
    $purchaseInfo = null;
    $pendingFile = __DIR__ . '/webpay_pending/' . $buyOrder . '.json';
    if (file_exists($pendingFile)) {
        $purchaseInfo = json_decode(file_get_contents($pendingFile), true);
        // Clean up pending file
        unlink($pendingFile);
    }
    
    // Check for duplicate by buy_order
    foreach ($data['purchases'] as $existing) {
        if (isset($existing['order_id']) && $existing['order_id'] === $buyOrder) {
            return $existing; // Already exists
        }
    }
    
    // Determine purchase type and plan info from amount or description
    $amount = $transaction['amount'] ?? 0;
    $purchaseType = $purchaseInfo['type'] ?? 'link';
    $planName = $purchaseInfo['plan_name'] ?? '';
    $planDays = $purchaseInfo['days'] ?? 7;
    $userEmail = $purchaseInfo['user_email'] ?? '';
    $description = $purchaseInfo['description'] ?? '';
    
    // If no purchase info, try to determine from amount
    if (!$purchaseInfo) {
        if ($amount >= 60000) {
            $purchaseType = 'plan';
            $planName = 'Plan Fragata';
            $planDays = 7;
            $description = 'Plan Fragata - WebPay';
        } else if ($amount >= 25000) {
            $purchaseType = 'plan';
            $planName = 'Plan Capitan';
            $planDays = 14;
            $description = 'Plan Capitan - WebPay';
        } else {
            $purchaseType = 'link';
            $description = 'Cotizacion Online - WebPay';
        }
    }
    
    $purchase = [
        'id' => 'pur_' . uniqid(),
        'user_email' => $userEmail,
        'type' => $purchaseType,
        'description' => $description,
        'plan_name' => $planName,
        'url' => '',
        'amount' => floatval($amount),
        'amount_clp' => intval($amount),
        'currency' => 'CLP',
        'payment_method' => 'webpay',
        'payment_id' => $transaction['authorization_code'] ?? null,
        'order_id' => $buyOrder,
        'status' => 'pending',
        'days' => intval($planDays),
        'proposals_total' => 5,
        'proposals_received' => 0,
        'date' => date('d M Y'),
        'timestamp' => date('Y-m-d H:i:s'),
        'webpay_details' => [
            'authorization_code' => $transaction['authorization_code'] ?? null,
            'payment_type' => $transaction['payment_type_code'] ?? null,
            'card_number' => $transaction['card_detail']['card_number'] ?? null,
            'transaction_date' => $transaction['transaction_date'] ?? date('c')
        ]
    ];
    
    if ($purchase['type'] === 'plan') {
        $purchase['end_date'] = date('d M Y', strtotime('+' . $purchase['days'] . ' days'));
    }
    
    $data['purchases'][] = $purchase;
    
    file_put_contents($purchasesFile, json_encode($data, JSON_PRETTY_PRINT));
    
    // Log the saved purchase
    logWebpay('PURCHASE_SAVED', $purchase);
    
    // Send confirmation email if we have the user's email
    if ($userEmail) {
        sendPurchaseConfirmationEmail($purchase);
        createWebpayPaymentNotificationMessage($purchase);

        try {
            $dbConfig = __DIR__ . '/db_config.php';
            if (file_exists($dbConfig)) {
                require_once $dbConfig;
                require_once __DIR__ . '/orders_api.php';
                $purchase['customer_name'] = explode('@', $userEmail)[0];
                if ($purchaseType === 'plan') {
                    createOrderFromPurchase($purchase);
                } else {
                    require_once __DIR__ . '/email_service.php';
                    $emailService = new EmailService();
                    $storedLinks = $emailService->getStoredQuotationLinks($userEmail);
                    createOrderFromQuotation($purchase, $storedLinks);
                }
            }
        } catch (Exception $e) {
            logWebpay('ORDER_CREATE_ERROR', ['error' => $e->getMessage()]);
        }
    }
    
    return $purchase;
}

/**
 * Send purchase confirmation + quotation form emails
 */
function sendPurchaseConfirmationEmail($purchase) {
    try {
        require_once __DIR__ . '/email_service.php';
        
        $emailService = new EmailService();
        $payerName = $purchase['user_email'];
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
            'currency' => 'CLP',
            'payment_method' => 'WebPay',
            'payment_reference' => $purchase['payment_id'] ?? $purchase['order_id'],
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
        
        logWebpay('EMAIL_SENT', ['to' => $purchase['user_email'], 'order' => $purchase['order_id'], 'emails' => 'payment+form+activation']);
    } catch (Exception $e) {
        logWebpay('EMAIL_ERROR', ['error' => $e->getMessage()]);
    }
}

/**
 * Commit (confirm) a WebPay Plus transaction (API call)
 */
function commitTransaction($data) {
    $token = $data['token'] ?? $_GET['token_ws'] ?? null;
    
    if (!$token) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing token parameter']);
        return;
    }
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, WEBPAY_API_URL . '/rswebpaytransaction/api/webpay/v1.2/transactions/' . $token);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Tbk-Api-Key-Id: ' . WEBPAY_COMMERCE_CODE,
        'Tbk-Api-Key-Secret: ' . WEBPAY_API_KEY_SECRET
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $result = json_decode($response, true);
    
    if ($httpCode !== 200) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Error committing WebPay transaction',
            'http_code' => $httpCode,
            'details' => $result
        ]);
        return;
    }
    
    // Check if transaction was approved
    $approved = isset($result['response_code']) && $result['response_code'] === 0;
    
    echo json_encode([
        'success' => $approved,
        'transaction' => $result,
        'status' => $approved ? 'APPROVED' : 'REJECTED',
        'amount' => $result['amount'] ?? null,
        'buy_order' => $result['buy_order'] ?? null,
        'authorization_code' => $result['authorization_code'] ?? null,
        'payment_type_code' => $result['payment_type_code'] ?? null,
        'response_code' => $result['response_code'] ?? null
    ]);
}

/**
 * Get transaction status
 */
function getTransactionStatus($data) {
    $token = $data['token'] ?? $_GET['token'] ?? null;
    
    if (!$token) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing token parameter']);
        return;
    }
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, WEBPAY_API_URL . '/rswebpaytransaction/api/webpay/v1.2/transactions/' . $token);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Tbk-Api-Key-Id: ' . WEBPAY_COMMERCE_CODE,
        'Tbk-Api-Key-Secret: ' . WEBPAY_API_KEY_SECRET
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    echo json_encode([
        'success' => $httpCode === 200,
        'http_code' => $httpCode,
        'transaction' => json_decode($response, true)
    ]);
}

/**
 * Refund a transaction
 */
function refundTransaction($data) {
    $token = $data['token'] ?? null;
    $amount = $data['amount'] ?? null;
    
    if (!$token || !$amount) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required parameters: token, amount']);
        return;
    }
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, WEBPAY_API_URL . '/rswebpaytransaction/api/webpay/v1.2/transactions/' . $token . '/refunds');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['amount' => intval($amount)]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Tbk-Api-Key-Id: ' . WEBPAY_COMMERCE_CODE,
        'Tbk-Api-Key-Secret: ' . WEBPAY_API_KEY_SECRET
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    echo json_encode([
        'success' => $httpCode === 200,
        'http_code' => $httpCode,
        'refund' => json_decode($response, true)
    ]);
}

/**
 * Log WebPay events for debugging
 */
function logWebpay($event, $data) {
    $logFile = __DIR__ . '/webpay.log';
    $logEntry = date('Y-m-d H:i:s') . ' [' . $event . '] ' . json_encode($data) . "\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND);
}
?>
