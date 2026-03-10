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

$dbConfig = __DIR__ . '/db_config.php';
if (file_exists($dbConfig)) {
    require_once $dbConfig;
    require_once __DIR__ . '/orders_api.php';
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
    case 'delete_solicitud':
        deleteSolicitud();
        break;
    case 'request_payment':
        requestPayment();
        break;
    case 'fix_descriptions':
        fixDescriptions();
        break;
    case 'fix_webpay_status':
        fixWebpayStatus();
        break;
    case 'cleanup_test_solicitudes':
        cleanupTestSolicitudes();
        break;
    case 'create_missing_orders':
        createMissingOrders();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida. Use: get, add, all, quotation_requests, send_payment_reminders, delete_solicitud, request_payment, fix_descriptions, fix_webpay_status, cleanup_test_solicitudes, create_missing_orders']);
}

/**
 * Sanitize a purchase description to fix malformed or corrupted values.
 * 
 * Handles cases like "1enlacesDiputado" or other non-standard descriptions
 * that may have been stored due to data corruption or older code versions.
 * Normalizes them to the standard "Cotizacion Online - N links" format.
 */
function sanitizeDescription($description) {
    if (empty($description)) {
        return 'Link Cotizado';
    }
    
    // Check for malformed descriptions that contain concatenated text
    // like "1enlacesDiputado", "2enlacesXYZ", etc.
    // Pattern: optional prefix + digits + "enlaces" + any trailing text (camelCase or otherwise)
    if (preg_match('/^(?:Cotizaci[oó]n\s+Online\s*-?\s*)?(\d+)\s*enlaces\w*/iu', $description, $matches)) {
        $count = intval($matches[1]);
        $linkWord = $count === 1 ? 'link' : 'links';
        return "Cotizacion Online - {$count} {$linkWord}";
    }
    
    // Also catch "N linksXYZ" pattern (e.g. "1 linksMP", "2 linksFoo")
    if (preg_match('/^(?:Cotizaci[oó]n\s+Online\s*-?\s*)?(\d+)\s*links[A-Z]\w*/u', $description, $matches)) {
        $count = intval($matches[1]);
        $linkWord = $count === 1 ? 'link' : 'links';
        return "Cotizacion Online - {$count} {$linkWord}";
    }
    
    return $description;
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
                'title' => sanitizeDescription($purchase['description'] ?? ''),
                'price' => $purchase['amount_clp'] ?? $purchase['amount'] ?? 0,
                'status' => $purchase['status'] ?? 'pending',
                'contractedAt' => $purchase['date'] ?? date('d M Y'),
                'paidAt' => $purchase['date'] ?? date('d M Y'),
                'payment_method' => $purchase['payment_method'] ?? 'unknown'
            ];
        } else if ($purchase['type'] === 'plan') {
            $plans[] = [
                'id' => $purchase['id'],
                'planName' => $purchase['plan_name'] ?? sanitizeDescription($purchase['description'] ?? ''),
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
        'payment_method' => $input['payment_method'], // 'paypal', 'mercadopago', 'webpay', 'transferencia_bancaria'
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

    // Auto-create order (expediente) for this purchase
    $orderId = null;
    try {
        $dbConfig = __DIR__ . '/db_config.php';
        if (file_exists($dbConfig)) {
            require_once $dbConfig;
            require_once __DIR__ . '/orders_api.php';
            $purchaseData = array_merge($purchase, [
                'customer_name' => $input['user_name'] ?? $input['customer_name'] ?? explode('@', $input['user_email'])[0],
                'customer_phone' => $input['user_phone'] ?? $input['customer_phone'] ?? null,
            ]);
            if ($purchase['type'] === 'link' || $purchase['type'] === 'cotizacion') {
                $storedLinks = $input['links'] ?? [];
                // Fallback: get links from quotation_requests.json
                if (empty($storedLinks)) {
                    require_once __DIR__ . '/email_service.php';
                    $emailService = new EmailService();
                    $storedLinks = $emailService->getStoredQuotationLinks($input['user_email']);
                }
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
 * Delete a solicitud (quotation request or purchase) by ID
 * Admin only - removes from quotation_requests.json or purchases.json
 */
function deleteSolicitud() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Metodo no permitido. Use POST']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? '';

    if (empty($id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta el campo: id']);
        return;
    }

    // Determine if it's a quotation request or a purchase based on ID prefix
    if (strpos($id, 'qr_') === 0) {
        // Delete from quotation_requests.json
        $file = __DIR__ . '/quotation_requests.json';
        if (!file_exists($file)) {
            http_response_code(404);
            echo json_encode(['error' => 'No se encontro el archivo de solicitudes']);
            return;
        }
        $data = json_decode(file_get_contents($file), true);
        $requests = $data['requests'] ?? [];
        $found = false;
        $filtered = [];
        foreach ($requests as $req) {
            if (($req['id'] ?? '') === $id) {
                $found = true;
            } else {
                $filtered[] = $req;
            }
        }
        if (!$found) {
            http_response_code(404);
            echo json_encode(['error' => 'Solicitud no encontrada: ' . $id]);
            return;
        }
        $data['requests'] = $filtered;
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'deleted_id' => $id, 'source' => 'quotation_requests']);
    } else {
        // Delete from purchases.json
        global $purchasesFile;
        $data = json_decode(file_get_contents($purchasesFile), true);
        $purchases = $data['purchases'] ?? [];
        $found = false;
        $filtered = [];
        foreach ($purchases as $p) {
            if (($p['id'] ?? '') === $id) {
                $found = true;
            } else {
                $filtered[] = $p;
            }
        }
        if (!$found) {
            http_response_code(404);
            echo json_encode(['error' => 'Compra no encontrada: ' . $id]);
            return;
        }
        $data['purchases'] = $filtered;
        file_put_contents($purchasesFile, json_encode($data, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'deleted_id' => $id, 'source' => 'purchases']);
    }
}

/**
 * Send a payment request email to a specific solicitud by ID
 * Admin action - sends reminder to the user associated with the solicitud
 */
function requestPayment() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Metodo no permitido. Use POST']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? '';

    if (empty($id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta el campo: id']);
        return;
    }

    // Find the solicitud data
    $email = '';
    $name = '';
    $requestData = null;
    $source = '';

    if (strpos($id, 'qr_') === 0) {
        // Look in quotation_requests.json
        $file = __DIR__ . '/quotation_requests.json';
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true);
            foreach (($data['requests'] ?? []) as $req) {
                if (($req['id'] ?? '') === $id) {
                    $email = $req['email'] ?? '';
                    $name = $req['name'] ?? '';
                    $requestData = $req;
                    $source = 'quotation_requests';
                    break;
                }
            }
        }
    } else {
        // Look in purchases.json
        global $purchasesFile;
        $data = json_decode(file_get_contents($purchasesFile), true);
        foreach (($data['purchases'] ?? []) as $p) {
            if (($p['id'] ?? '') === $id) {
                $email = $p['user_email'] ?? $p['email'] ?? '';
                $name = $p['payer_name'] ?? $p['user_name'] ?? '';
                $requestData = [
                    'id' => $id,
                    'email' => $email,
                    'name' => $name,
                    'date' => $p['timestamp'] ?? $p['date'] ?? date('d/m/Y'),
                    'boat_links' => []
                ];
                // Try to extract links from description
                $desc = $p['description'] ?? '';
                if (strpos($desc, 'http') !== false) {
                    preg_match_all('/https?:\/\/[^\s,|]+/', $desc, $matches);
                    if (!empty($matches[0])) {
                        $requestData['boat_links'] = $matches[0];
                    }
                }
                $source = 'purchases';
                break;
            }
        }
    }

    if (!$requestData) {
        http_response_code(404);
        echo json_encode(['error' => 'Solicitud no encontrada: ' . $id]);
        return;
    }

    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'La solicitud no tiene un email valido para enviar el recordatorio']);
        return;
    }

    // Send the payment reminder email
    require_once __DIR__ . '/email_service.php';
    $emailService = new EmailService();
    $result = $emailService->sendPaymentReminderEmail($email, $name, $requestData);

    if ($result && ($result['success'] ?? false)) {
        echo json_encode([
            'success' => true,
            'message' => 'Recordatorio de pago enviado a ' . $email,
            'email' => $email,
            'source' => $source
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'error' => 'Error al enviar email: ' . ($result['error'] ?? 'Error desconocido'),
            'email' => $email
        ]);
    }
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

/**
 * Fix corrupted descriptions directly in purchases.json.
 * Scans all purchases and normalizes malformed descriptions using sanitizeDescription().
 * This is a one-time cleanup action (admin only).
 */
function fixDescriptions() {
    global $purchasesFile;
    
    $data = json_decode(file_get_contents($purchasesFile), true);
    $purchases = $data['purchases'] ?? [];
    
    $fixed = [];
    $total = count($purchases);
    
    foreach ($purchases as &$purchase) {
        $changes = [];
        
        // Fix description field
        $original = $purchase['description'] ?? '';
        $sanitized = sanitizeDescription($original);
        if ($sanitized !== $original && !empty($original)) {
            $purchase['description'] = $sanitized;
            $changes['description'] = ['from' => $original, 'to' => $sanitized];
        }
        
        // Fix plan_name field too (can also contain corrupted data)
        $originalPlan = $purchase['plan_name'] ?? '';
        $sanitizedPlan = sanitizeDescription($originalPlan);
        if ($sanitizedPlan !== $originalPlan && !empty($originalPlan)) {
            $purchase['plan_name'] = $sanitizedPlan;
            $changes['plan_name'] = ['from' => $originalPlan, 'to' => $sanitizedPlan];
        }
        
        if (!empty($changes)) {
            $fixed[] = [
                'id' => $purchase['id'] ?? 'unknown',
                'user_email' => $purchase['user_email'] ?? 'unknown',
                'changes' => $changes
            ];
        }
    }
    unset($purchase);
    
    if (count($fixed) > 0) {
        $data['purchases'] = $purchases;
        file_put_contents($purchasesFile, json_encode($data, JSON_PRETTY_PRINT));
    }
    
    echo json_encode([
        'success' => true,
        'total_purchases' => $total,
        'fixed_count' => count($fixed),
        'fixed_details' => $fixed
    ]);
}

/**
 * Fix WebPay purchase statuses from 'pending' to 'paid'.
 * WebPay only completes the callback on successful payment, so all WebPay
 * purchases recorded should have status 'paid' not 'pending'.
 * This is a one-time cleanup action.
 */
function fixWebpayStatus() {
    global $purchasesFile;
    
    $data = json_decode(file_get_contents($purchasesFile), true);
    $purchases = $data['purchases'] ?? [];
    
    $fixed = [];
    $total = count($purchases);
    
    foreach ($purchases as &$purchase) {
        $method = $purchase['payment_method'] ?? '';
        $status = $purchase['status'] ?? '';
        
        if ($method === 'webpay' && $status === 'pending') {
            $purchase['status'] = 'paid';
            $fixed[] = [
                'id' => $purchase['id'] ?? 'unknown',
                'user_email' => $purchase['user_email'] ?? 'unknown',
                'old_status' => 'pending',
                'new_status' => 'paid',
                'amount' => $purchase['amount_clp'] ?? $purchase['amount'] ?? 0,
                'date' => $purchase['date'] ?? ''
            ];
        }
    }
    unset($purchase);
    
    if (count($fixed) > 0) {
        $data['purchases'] = $purchases;
        file_put_contents($purchasesFile, json_encode($data, JSON_PRETTY_PRINT));
    }
    
    echo json_encode([
        'success' => true,
        'total_purchases' => $total,
        'fixed_count' => count($fixed),
        'fixed_details' => $fixed
    ]);
}

/**
 * Remove test solicitudes from quotation_requests.json.
 * Cleans up entries from test emails (containing 'devin' or 'test' in email).
 * This is a one-time cleanup action.
 */
function cleanupTestSolicitudes() {
    $file = __DIR__ . '/quotation_requests.json';
    
    if (!file_exists($file)) {
        echo json_encode([
            'success' => true,
            'message' => 'No quotation_requests.json found',
            'cleaned_count' => 0
        ]);
        return;
    }
    
    $data = json_decode(file_get_contents($file), true);
    $requests = $data['requests'] ?? [];
    $originalCount = count($requests);
    
    $cleaned = [];
    $kept = [];
    
    foreach ($requests as $req) {
        $email = strtolower($req['email'] ?? '');
        if (strpos($email, 'devin') !== false || strpos($email, 'test') !== false) {
            $cleaned[] = [
                'id' => $req['id'] ?? 'unknown',
                'email' => $req['email'] ?? 'unknown',
                'name' => $req['name'] ?? 'unknown',
                'date' => $req['date'] ?? ''
            ];
        } else {
            $kept[] = $req;
        }
    }
    
    if (count($cleaned) > 0) {
        $data['requests'] = $kept;
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
    }
    
    echo json_encode([
        'success' => true,
        'original_count' => $originalCount,
        'cleaned_count' => count($cleaned),
        'remaining_count' => count($kept),
        'cleaned_details' => $cleaned
    ]);
}

/**
 * Create missing orders (expedientes) for purchases that don't have one.
 * Scans all purchases, checks if an order exists in the database for each,
 * and creates orders for those that are missing.
 * Links are pulled from quotation_requests.json when available.
 * This ensures all purchases are reflected in Expedientes.
 */
function createMissingOrders() {
    global $purchasesFile;

    try {
        require_once __DIR__ . '/db_config.php';
        require_once __DIR__ . '/orders_api.php';
        $pdo = getDbConnection();
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'No se pudo conectar a la base de datos: ' . $e->getMessage()]);
        return;
    }

    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'No se pudo conectar a la base de datos']);
        return;
    }

    $data = json_decode(file_get_contents($purchasesFile), true);
    $purchases = $data['purchases'] ?? [];

    // Load quotation requests for link lookup
    $qrFile = __DIR__ . '/quotation_requests.json';
    $quotationRequests = [];
    if (file_exists($qrFile)) {
        $qrData = json_decode(file_get_contents($qrFile), true);
        foreach (($qrData['requests'] ?? []) as $qr) {
            $email = strtolower($qr['email'] ?? '');
            if (!isset($quotationRequests[$email])) {
                $quotationRequests[$email] = $qr;
            }
        }
    }

    // Get all existing purchase_ids from orders table
    $existingPurchaseIds = [];
    $stmt = $pdo->query("SELECT purchase_id FROM orders WHERE purchase_id IS NOT NULL AND purchase_id != ''");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $existingPurchaseIds[$row['purchase_id']] = true;
    }

    $created = [];
    $skipped = [];
    $errors = [];

    foreach ($purchases as $purchase) {
        $purchaseId = $purchase['id'] ?? '';
        $userEmail = $purchase['user_email'] ?? '';

        // Skip test purchases
        $emailLower = strtolower($userEmail);
        if (strpos($emailLower, 'devin') !== false || strpos($emailLower, 'test') !== false) {
            $skipped[] = ['id' => $purchaseId, 'reason' => 'test_email', 'email' => $userEmail];
            continue;
        }

        // Skip if order already exists for this purchase
        if (isset($existingPurchaseIds[$purchaseId])) {
            $skipped[] = ['id' => $purchaseId, 'reason' => 'order_exists', 'email' => $userEmail];
            continue;
        }

        // Get boat links from quotation requests
        $storedLinks = [];
        $qr = $quotationRequests[$emailLower] ?? null;
        if ($qr && !empty($qr['boat_links'])) {
            $storedLinks = $qr['boat_links'];
        }

        // Prepare purchase data for order creation
        $purchaseData = array_merge($purchase, [
            'customer_name' => $qr['name'] ?? explode('@', $userEmail)[0],
            'customer_phone' => $qr['phone'] ?? null,
        ]);

        try {
            $type = $purchase['type'] ?? 'link';
            if ($type === 'plan') {
                $orderId = createOrderFromPurchase($purchaseData);
            } else {
                $orderId = createOrderFromQuotation($purchaseData, $storedLinks);
            }

            if ($orderId) {
                $created[] = [
                    'purchase_id' => $purchaseId,
                    'order_id' => $orderId,
                    'email' => $userEmail,
                    'type' => $type,
                    'links_loaded' => count($storedLinks)
                ];
            } else {
                $errors[] = [
                    'purchase_id' => $purchaseId,
                    'email' => $userEmail,
                    'error' => 'createOrder returned null'
                ];
            }
        } catch (Exception $e) {
            $errors[] = [
                'purchase_id' => $purchaseId,
                'email' => $userEmail,
                'error' => $e->getMessage()
            ];
        }
    }

    echo json_encode([
        'success' => true,
        'total_purchases' => count($purchases),
        'orders_created' => count($created),
        'skipped' => count($skipped),
        'errors_count' => count($errors),
        'created_details' => $created,
        'skipped_details' => $skipped,
        'error_details' => $errors
    ]);
}
