<?php
/**
 * WebPay Plus API for Imporlan WebPanel
 * Supports both Integration (testing) and Production environments
 * Configure credentials via environment variables or config file
 */

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Load configuration - check for config file first, then environment variables
$configFile = __DIR__ . '/config.php';
if (file_exists($configFile)) {
    require_once $configFile;
}

// WebPay Plus Credentials - can be overridden by config.php or environment variables
// Default to Integration/Testing environment
if (!defined('WEBPAY_COMMERCE_CODE')) {
    define('WEBPAY_COMMERCE_CODE', getenv('WEBPAY_COMMERCE_CODE') ?: '597055555532');
}
if (!defined('WEBPAY_API_KEY_SECRET')) {
    define('WEBPAY_API_KEY_SECRET', getenv('WEBPAY_API_KEY_SECRET') ?: '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C');
}
if (!defined('WEBPAY_API_URL')) {
    define('WEBPAY_API_URL', getenv('WEBPAY_API_URL') ?: 'https://webpay3gint.transbank.cl');
}

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
        $isProduction = strpos(WEBPAY_API_URL, 'webpay3gint') === false;
        echo json_encode([
            'success' => false, 
            'error' => 'Invalid action',
            'available_actions' => ['create_transaction', 'commit_transaction', 'get_status', 'refund'],
            'environment' => $isProduction ? 'PRODUCTION' : 'INTEGRATION'
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
    // Use the callback URL for WebPay to return to
    $returnUrl = 'https://www.imporlan.cl/api/webpay.php?action=callback';
    
    $requestData = [
        'buy_order' => $buyOrder,
        'session_id' => $sessionId,
        'amount' => $amount,
        'return_url' => $returnUrl
    ];
    
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
    
    // If TBK_TOKEN is present, user cancelled the transaction
    if ($tbkToken) {
        header('Location: https://www.imporlan.cl/panel/#payments?payment=cancelled');
        exit();
    }
    
    if (!$token) {
        header('Location: https://www.imporlan.cl/panel/#payments?payment=error&message=no_token');
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
    
    if ($httpCode !== 200) {
        header('Location: https://www.imporlan.cl/panel/#payments?payment=error&message=commit_failed');
        exit();
    }
    
    // Check if transaction was approved
    $approved = isset($result['response_code']) && $result['response_code'] === 0;
    
    if ($approved) {
        // Save purchase to purchases.json (similar to other payment methods)
        savePurchase($result);
        
        header('Location: https://www.imporlan.cl/panel/#payments?payment=success&order=' . urlencode($result['buy_order']));
    } else {
        header('Location: https://www.imporlan.cl/panel/#payments?payment=rejected&code=' . ($result['response_code'] ?? 'unknown'));
    }
    exit();
}

/**
 * Save purchase to purchases.json
 */
function savePurchase($transaction) {
    $purchasesFile = __DIR__ . '/purchases.json';
    $purchases = [];
    
    if (file_exists($purchasesFile)) {
        $purchases = json_decode(file_get_contents($purchasesFile), true) ?? [];
    }
    
    $purchases[] = [
        'id' => uniqid('webpay_'),
        'method' => 'webpay',
        'buy_order' => $transaction['buy_order'] ?? null,
        'amount' => $transaction['amount'] ?? null,
        'authorization_code' => $transaction['authorization_code'] ?? null,
        'payment_type' => $transaction['payment_type_code'] ?? null,
        'card_number' => $transaction['card_detail']['card_number'] ?? null,
        'transaction_date' => $transaction['transaction_date'] ?? date('c'),
        'created_at' => date('c'),
        'status' => 'completed'
    ];
    
    file_put_contents($purchasesFile, json_encode($purchases, JSON_PRETTY_PRINT));
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
?>
