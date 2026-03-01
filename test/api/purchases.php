<?php
/**
 * Purchases API - Imporlan
 * 
 * Endpoints para gestionar compras de usuarios
 * 
 * Uso:
 * - GET /purchases.php?action=get&user_email=email@example.com - Obtener compras de un usuario
 * - POST /purchases.php?action=add - Agregar una nueva compra
 */

$dbConfig = __DIR__ . '/../../api/db_config.php';
if (file_exists($dbConfig)) {
    require_once $dbConfig;
    require_once __DIR__ . '/../../api/orders_api.php';
}

// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// File to store purchases
$purchasesFile = __DIR__ . '/purchases.json';

// Initialize purchases file if it doesn't exist
if (!file_exists($purchasesFile)) {
    file_put_contents($purchasesFile, json_encode(['purchases' => []]));
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get':
        getPurchases();
        break;
    case 'add':
        addPurchase();
        break;
    case 'all':
        getAllPurchases();
        break;
    case 'quotation_requests':
        getQuotationRequests();
        break;
    case 'send_payment_reminders':
        sendPaymentReminders();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida. Use: get, add, all, quotation_requests, send_payment_reminders']);
}

/**
 * Get purchases for a specific user
 */
function getPurchases() {
    global $purchasesFile;
    
    $userEmail = $_GET['user_email'] ?? null;
    
    if (!$userEmail) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta el parametro: user_email']);
        return;
    }
    
    $data = json_decode(file_get_contents($purchasesFile), true);
    $purchases = $data['purchases'] ?? [];
    
    // Filter purchases by user email
    $userPurchases = array_filter($purchases, function($p) use ($userEmail) {
        return strtolower($p['user_email'] ?? '') === strtolower($userEmail);
    });
    
    // Separate into links and plans
    $links = [];
    $plans = [];
    
    foreach ($userPurchases as $purchase) {
        if ($purchase['type'] === 'link' || $purchase['type'] === 'cotizacion') {
            $links[] = [
                'id' => $purchase['id'],
                'url' => $purchase['url'] ?? '',
                'title' => $purchase['description'] ?? 'Link Cotizado',
                'price' => $purchase['amount_clp'] ?? $purchase['amount'] ?? 0,
                'status' => $purchase['status'] ?? 'pending',
                'contractedAt' => $purchase['date'] ?? date('d M Y'),
                'paidAt' => $purchase['date'] ?? date('d M Y'),
                'payment_method' => $purchase['payment_method'] ?? 'unknown'
            ];
        } else if ($purchase['type'] === 'plan') {
            $plans[] = [
                'id' => $purchase['id'],
                'planName' => $purchase['plan_name'] ?? $purchase['description'] ?? 'Plan',
                'price' => $purchase['amount_clp'] ?? $purchase['amount'] ?? 0,
                'days' => $purchase['days'] ?? 7,
                'status' => $purchase['status'] ?? 'active',
                'startDate' => $purchase['date'] ?? date('d M Y'),
                'endDate' => $purchase['end_date'] ?? date('d M Y', strtotime('+7 days')),
                'proposalsReceived' => $purchase['proposals_received'] ?? 0,
                'proposalsTotal' => $purchase['proposals_total'] ?? 5,
                'payment_method' => $purchase['payment_method'] ?? 'unknown'
            ];
        }
    }
    
    echo json_encode([
        'success' => true,
        'links' => array_values($links),
        'plans' => array_values($plans),
        'total_purchases' => count($userPurchases)
    ]);
}

/**
 * Add a new purchase
 */
function addPurchase() {
    global $purchasesFile;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos de compra invalidos']);
        return;
    }
    
    // Required fields
    $requiredFields = ['user_email', 'type', 'amount', 'payment_method'];
    foreach ($requiredFields as $field) {
        if (!isset($input[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Falta el campo: $field"]);
            return;
        }
    }
    
    $data = json_decode(file_get_contents($purchasesFile), true);
    
    // Create purchase record
    $purchase = [
        'id' => 'pur_' . uniqid(),
        'user_email' => $input['user_email'],
        'type' => $input['type'], // 'link', 'cotizacion', 'plan'
        'description' => $input['description'] ?? '',
        'plan_name' => $input['plan_name'] ?? '',
        'url' => $input['url'] ?? '',
        'amount' => floatval($input['amount']),
        'amount_clp' => intval($input['amount_clp'] ?? $input['amount']),
        'currency' => $input['currency'] ?? 'CLP',
        'payment_method' => $input['payment_method'], // 'paypal', 'mercadopago'
        'payment_id' => $input['payment_id'] ?? null,
        'order_id' => $input['order_id'] ?? null,
        'status' => $input['status'] ?? 'pending',
        'days' => intval($input['days'] ?? 7),
        'proposals_total' => intval($input['proposals_total'] ?? 5),
        'proposals_received' => 0,
        'date' => date('d M Y'),
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    // Calculate end date for plans
    if ($purchase['type'] === 'plan') {
        $purchase['end_date'] = date('d M Y', strtotime('+' . $purchase['days'] . ' days'));
    }
    
    $data['purchases'][] = $purchase;
    
    file_put_contents($purchasesFile, json_encode($data, JSON_PRETTY_PRINT));

    $orderId = null;
    try {
        if (function_exists('createOrderFromQuotation')) {
            $purchaseData = array_merge($purchase, [
                'customer_name' => $input['user_name'] ?? $input['customer_name'] ?? explode('@', $input['user_email'])[0],
                'customer_phone' => $input['user_phone'] ?? $input['customer_phone'] ?? null,
            ]);
            if ($purchase['type'] === 'link' || $purchase['type'] === 'cotizacion') {
                $storedLinks = $input['links'] ?? [];
                $orderId = createOrderFromQuotation($purchaseData, $storedLinks);
            } else {
                $orderId = createOrderFromPurchase($purchaseData);
            }
        }
    } catch (Exception $e) {
        error_log("purchases.php: order creation error: " . $e->getMessage());
    }

    echo json_encode([
        'success' => true,
        'purchase' => $purchase,
        'order_id' => $orderId
    ]);
}

/**
 * Get all purchases (admin only)
 */
function getAllPurchases() {
    global $purchasesFile;
    
    $data = json_decode(file_get_contents($purchasesFile), true);
    
    echo json_encode([
        'success' => true,
        'purchases' => $data['purchases'] ?? [],
        'total' => count($data['purchases'] ?? [])
    ]);
}

/**
 * Send payment reminder emails to all quotation requests without payment
 * Reads quotation_requests.json, cross-references with purchases.json,
 * and sends reminder emails to users who haven't paid
 */
function sendPaymentReminders() {
    $purchasesFile = __DIR__ . '/purchases.json';
    $quotationFile = __DIR__ . '/quotation_requests.json';
    
    if (!file_exists($quotationFile)) {
        echo json_encode(['success' => true, 'sent' => 0, 'message' => 'No hay solicitudes de cotizacion']);
        return;
    }
    
    // Load quotation requests
    $qrData = json_decode(file_get_contents($quotationFile), true);
    $requests = $qrData['requests'] ?? [];
    
    // Load purchases to cross-reference
    $purchaseEmails = [];
    if (file_exists($purchasesFile)) {
        $pData = json_decode(file_get_contents($purchasesFile), true);
        foreach (($pData['purchases'] ?? []) as $p) {
            $email = strtolower($p['user_email'] ?? '');
            if (!empty($email)) {
                $purchaseEmails[$email] = true;
            }
        }
    }
    
    // Initialize email service
    require_once __DIR__ . '/email_service.php';
    $emailService = new EmailService();
    
    $sent = 0;
    $failed = 0;
    $skipped = 0;
    $details = [];
    $processedEmails = [];
    
    foreach ($requests as $request) {
        $email = strtolower(trim($request['email'] ?? ''));
        $name = trim($request['name'] ?? '');
        
        // Skip if no valid email
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $skipped++;
            $details[] = [
                'id' => $request['id'] ?? 'unknown',
                'email' => $email,
                'status' => 'skipped',
                'reason' => 'Email invalido o vacio'
            ];
            continue;
        }
        
        // Skip if already has a purchase (already paid)
        if (isset($purchaseEmails[$email])) {
            $skipped++;
            $details[] = [
                'id' => $request['id'] ?? 'unknown',
                'email' => $email,
                'status' => 'skipped',
                'reason' => 'Ya tiene compra registrada'
            ];
            continue;
        }
        
        // Skip if already sent reminder to this email in this batch
        if (isset($processedEmails[$email])) {
            $skipped++;
            $details[] = [
                'id' => $request['id'] ?? 'unknown',
                'email' => $email,
                'status' => 'skipped',
                'reason' => 'Ya se envio recordatorio a este email'
            ];
            continue;
        }
        
        // Send reminder email
        $result = $emailService->sendPaymentReminderEmail($email, $name, $request);
        $processedEmails[$email] = true;
        
        if ($result && ($result['success'] ?? false)) {
            $sent++;
            $details[] = [
                'id' => $request['id'] ?? 'unknown',
                'email' => $email,
                'name' => $name,
                'status' => 'sent',
                'boat_links' => count($request['boat_links'] ?? [])
            ];
        } else {
            $failed++;
            $details[] = [
                'id' => $request['id'] ?? 'unknown',
                'email' => $email,
                'status' => 'failed',
                'error' => $result['error'] ?? 'Unknown error'
            ];
        }
    }
    
    // Update quotation_requests.json with reminder tracking
    $now = date('Y-m-d H:i:s');
    $updated = false;
    foreach ($qrData['requests'] as &$req) {
        $reqEmail = strtolower(trim($req['email'] ?? ''));
        if (isset($processedEmails[$reqEmail])) {
            $req['reminder_sent'] = true;
            $req['reminder_date'] = $now;
            $updated = true;
        }
    }
    unset($req);
    
    if ($updated) {
        file_put_contents($quotationFile, json_encode($qrData, JSON_PRETTY_PRINT));
    }
    
    echo json_encode([
        'success' => true,
        'sent' => $sent,
        'failed' => $failed,
        'skipped' => $skipped,
        'total_requests' => count($requests),
        'details' => $details
    ]);
}

/**
 * Get all quotation requests (admin only)
 * Reads from quotation_requests.json stored by email_service.php
 */
function getQuotationRequests() {
    $file = __DIR__ . '/quotation_requests.json';
    
    if (!file_exists($file)) {
        echo json_encode([
            'success' => true,
            'requests' => [],
            'total' => 0
        ]);
        return;
    }
    
    $data = json_decode(file_get_contents($file), true);
    $requests = $data['requests'] ?? [];
    
    // Sort by date descending (newest first)
    usort($requests, function($a, $b) {
        return strtotime($b['date'] ?? '0') - strtotime($a['date'] ?? '0');
    });
    
    echo json_encode([
        'success' => true,
        'requests' => $requests,
        'total' => count($requests)
    ]);
}

