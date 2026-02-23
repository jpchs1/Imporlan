<?php
/**
 * Payment Requests API - Imporlan
 * 
 * Sistema de solicitudes de pago personalizadas
 * Permite a admins crear solicitudes de pago para usuarios específicos
 * 
 * Endpoints:
 * - POST ?action=admin_create - Crear nueva solicitud (admin)
 * - GET  ?action=user_list - Listar solicitudes del usuario autenticado
 * - GET  ?action=admin_list - Listar todas las solicitudes (admin)
 * - POST ?action=update_status - Actualizar estado (admin)
 * - GET  ?action=get_by_id&id=xxx - Obtener solicitud por ID
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth_helper.php';
require_once __DIR__ . '/email_service.php';
require_once __DIR__ . '/db_config.php';

setCorsHeaders();

header('Content-Type: application/json');

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'admin_create':
        adminCreateRequest();
        break;
    case 'user_list':
        userListRequests();
        break;
    case 'admin_list':
        adminListRequests();
        break;
    case 'update_status':
        updateRequestStatus();
        break;
    case 'get_by_id':
        getRequestById();
        break;
    case 'admin_update':
        adminUpdateRequest();
        break;
    case 'user_list_public':
        userListRequestsPublic();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida', 'available_actions' => ['admin_create', 'user_list', 'user_list_public', 'admin_list', 'update_status', 'get_by_id', 'admin_update']]);
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getPaymentRequestsFile() {
    return __DIR__ . '/payment_requests.json';
}

function loadPaymentRequests() {
    $file = getPaymentRequestsFile();
    if (!file_exists($file)) {
        $data = ['requests' => []];
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
        return $data;
    }
    $data = json_decode(file_get_contents($file), true);
    if (!is_array($data) || !isset($data['requests'])) {
        return ['requests' => []];
    }
    return $data;
}

function savePaymentRequests($data) {
    $file = getPaymentRequestsFile();
    $fp = fopen($file, 'c');
    if ($fp && flock($fp, LOCK_EX)) {
        fseek($fp, 0);
        ftruncate($fp, 0);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
    } else {
        if ($fp) fclose($fp);
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
    }
}

function findRequestById($id) {
    $data = loadPaymentRequests();
    foreach ($data['requests'] as $request) {
        if ($request['id'] === $id) {
            return $request;
        }
    }
    return null;
}

function updateRequestInFile($id, $updates) {
    $data = loadPaymentRequests();
    foreach ($data['requests'] as &$request) {
        if ($request['id'] === $id) {
            foreach ($updates as $key => $value) {
                $request[$key] = $value;
            }
            savePaymentRequests($data);
            return $request;
        }
    }
    return null;
}

function validatePaymentRequest($input) {
    $errors = [];
    
    if (empty($input['user_email']) || !filter_var($input['user_email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'user_email invalido o faltante';
    }
    if (empty($input['title']) || strlen($input['title']) > 200) {
        $errors[] = 'title es requerido (max 200 caracteres)';
    }
    if (!isset($input['amount_clp']) || floatval($input['amount_clp']) <= 0) {
        $errors[] = 'amount_clp debe ser mayor a 0';
    }
    
    return $errors;
}

function logPaymentRequest($action, $data) {
    $logFile = __DIR__ . '/payment_requests.log';
    $logEntry = date('Y-m-d H:i:s') . ' [' . $action . '] ' . json_encode($data) . "\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND);
}

function getUserToken() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        return null;
    }
    return verifyJWTToken($matches[1]);
}

// ============================================================
// ACTION HANDLERS
// ============================================================

/**
 * A) admin_create - Crear nueva solicitud de pago
 */
function adminCreateRequest() {
    $admin = requireAdminAuthShared();
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos JSON invalidos']);
        return;
    }
    
    $errors = validatePaymentRequest($input);
    if (!empty($errors)) {
        http_response_code(400);
        echo json_encode(['error' => 'Validacion fallida', 'details' => $errors]);
        return;
    }
    
    // Generate unique ID
    $requestId = 'pr_' . uniqid();
    
    $request = [
        'id' => $requestId,
        'user_email' => strtolower(trim($input['user_email'])),
        'title' => trim($input['title']),
        'description' => trim($input['description'] ?? ''),
        'amount_clp' => intval($input['amount_clp']),
        'amount_usd' => isset($input['amount_usd']) && $input['amount_usd'] > 0 ? floatval($input['amount_usd']) : null,
        'status' => 'pending',
        'created_by' => $admin['email'] ?? $admin['sub'] ?? 'admin',
        'created_at' => date('Y-m-d H:i:s'),
        'paid_at' => null,
        'payment_id' => null,
        'payment_method' => null,
        'purchase_id' => null,
        'cancelled_reason' => null,
        'metadata' => [
            'order_id' => $input['order_id'] ?? null,
            'boat_name' => $input['boat_name'] ?? null,
            'custom_fields' => $input['custom_fields'] ?? []
        ]
    ];
    
    // Save to file
    $data = loadPaymentRequests();
    $data['requests'][] = $request;
    savePaymentRequests($data);
    
    logPaymentRequest('CREATED', ['id' => $requestId, 'user' => $request['user_email'], 'amount' => $request['amount_clp'], 'admin' => $request['created_by']]);
    
    // Send email notification to user
    $sendEmail = $input['send_email'] ?? true;
    if ($sendEmail) {
        try {
            $emailService = new EmailService();
            $firstName = explode('@', $request['user_email'])[0];
            $emailService->sendPaymentRequestEmail($request['user_email'], $firstName, $request);
            logPaymentRequest('EMAIL_SENT', ['id' => $requestId, 'to' => $request['user_email']]);
        } catch (Exception $e) {
            logPaymentRequest('EMAIL_ERROR', ['id' => $requestId, 'error' => $e->getMessage()]);
        }
    }
    
    // Create chat notification message
    try {
        createPaymentRequestChatMessage($request, 'created');
        logPaymentRequest('CHAT_MSG_SENT', ['id' => $requestId, 'user' => $request['user_email']]);
    } catch (Exception $e) {
        logPaymentRequest('CHAT_MSG_ERROR', ['id' => $requestId, 'error' => $e->getMessage()]);
    }
    
    echo json_encode([
        'success' => true,
        'request_id' => $requestId,
        'message' => 'Solicitud de pago creada exitosamente',
        'request' => $request
    ]);
}

/**
 * B) user_list - Listar solicitudes del usuario autenticado
 */
function userListRequests() {
    $payload = getUserToken();
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        return;
    }
    
    $userEmail = strtolower($payload['email'] ?? $payload['sub'] ?? '');
    if (empty($userEmail)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email de usuario no encontrado en token']);
        return;
    }
    
    $status = $_GET['status'] ?? 'pending';
    $data = loadPaymentRequests();
    
    $filtered = array_filter($data['requests'], function($r) use ($userEmail, $status) {
        $emailMatch = strtolower($r['user_email']) === $userEmail;
        if ($status === 'all') return $emailMatch;
        return $emailMatch && $r['status'] === $status;
    });
    
    // Sort by created_at DESC
    usort($filtered, function($a, $b) {
        return strtotime($b['created_at']) - strtotime($a['created_at']);
    });
    
    echo json_encode([
        'success' => true,
        'requests' => array_values($filtered)
    ]);
}

/**
 * C) admin_list - Listar todas las solicitudes (admin)
 */
function adminListRequests() {
    requireAdminAuthShared();
    
    $data = loadPaymentRequests();
    $requests = $data['requests'];
    
    // Apply filters
    $filterEmail = $_GET['user_email'] ?? null;
    $filterStatus = $_GET['status'] ?? null;
    $filterDateFrom = $_GET['date_from'] ?? null;
    $filterDateTo = $_GET['date_to'] ?? null;
    
    if ($filterEmail) {
        $filterEmail = strtolower($filterEmail);
        $requests = array_filter($requests, function($r) use ($filterEmail) {
            return strtolower($r['user_email']) === $filterEmail;
        });
    }
    
    if ($filterStatus) {
        $requests = array_filter($requests, function($r) use ($filterStatus) {
            return $r['status'] === $filterStatus;
        });
    }
    
    if ($filterDateFrom) {
        $requests = array_filter($requests, function($r) use ($filterDateFrom) {
            return strtotime($r['created_at']) >= strtotime($filterDateFrom);
        });
    }
    
    if ($filterDateTo) {
        $requests = array_filter($requests, function($r) use ($filterDateTo) {
            return strtotime($r['created_at']) <= strtotime($filterDateTo . ' 23:59:59');
        });
    }
    
    // Sort by created_at DESC
    usort($requests, function($a, $b) {
        return strtotime($b['created_at']) - strtotime($a['created_at']);
    });
    
    // Pagination
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = min(100, max(1, intval($_GET['limit'] ?? 50)));
    $total = count($requests);
    $pages = ceil($total / $limit);
    $offset = ($page - 1) * $limit;
    
    $paginatedRequests = array_slice($requests, $offset, $limit);
    
    echo json_encode([
        'success' => true,
        'requests' => array_values($paginatedRequests),
        'total' => $total,
        'page' => $page,
        'pages' => $pages
    ]);
}

/**
 * D) update_status - Actualizar estado de solicitud (admin)
 */
function updateRequestStatus() {
    $admin = requireAdminAuthShared();
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos JSON invalidos']);
        return;
    }
    
    $requestId = $input['request_id'] ?? '';
    $newStatus = $input['new_status'] ?? '';
    $reason = $input['reason'] ?? null;
    
    if (empty($requestId) || empty($newStatus)) {
        http_response_code(400);
        echo json_encode(['error' => 'request_id y new_status son requeridos']);
        return;
    }
    
    if (!in_array($newStatus, ['pending', 'paid', 'cancelled'])) {
        http_response_code(400);
        echo json_encode(['error' => 'new_status debe ser: pending, paid, cancelled']);
        return;
    }
    
    $request = findRequestById($requestId);
    if (!$request) {
        http_response_code(404);
        echo json_encode(['error' => 'Solicitud no encontrada']);
        return;
    }
    
    $updates = ['status' => $newStatus];
    
    if ($newStatus === 'cancelled') {
        $updates['cancelled_reason'] = $reason;
        
        // Send cancellation email
        try {
            $emailService = new EmailService();
            $firstName = explode('@', $request['user_email'])[0];
            $emailService->sendPaymentRequestCancelledEmail($request['user_email'], $firstName, array_merge($request, $updates));
        } catch (Exception $e) {
            logPaymentRequest('CANCEL_EMAIL_ERROR', ['id' => $requestId, 'error' => $e->getMessage()]);
        }
    }
    
    if ($newStatus === 'paid') {
        $updates['paid_at'] = date('Y-m-d H:i:s');
        $updates['payment_method'] = $input['payment_method'] ?? 'manual';
    }
    
    $updated = updateRequestInFile($requestId, $updates);
    
    logPaymentRequest('STATUS_UPDATED', ['id' => $requestId, 'from' => $request['status'], 'to' => $newStatus, 'admin' => $admin['email'] ?? 'admin']);
    
    echo json_encode([
        'success' => true,
        'request' => $updated
    ]);
}

/**
 * E) get_by_id - Obtener solicitud por ID
 */
function getRequestById() {
    $id = $_GET['id'] ?? '';
    if (empty($id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Parametro id es requerido']);
        return;
    }
    
    // Try admin auth first
    $isAdmin = false;
    $userEmail = '';
    
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        $payload = verifyJWTToken($matches[1]);
        if ($payload) {
            if (isset($payload['role']) && in_array($payload['role'], ['admin', 'support'])) {
                $isAdmin = true;
            }
            $userEmail = strtolower($payload['email'] ?? $payload['sub'] ?? '');
        }
    }
    
    if (!$isAdmin && empty($userEmail)) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        return;
    }
    
    $request = findRequestById($id);
    if (!$request) {
        http_response_code(404);
        echo json_encode(['error' => 'Solicitud no encontrada']);
        return;
    }
    
    // If not admin, verify ownership
    if (!$isAdmin && strtolower($request['user_email']) !== $userEmail) {
        http_response_code(403);
        echo json_encode(['error' => 'Acceso denegado']);
        return;
    }
    
    echo json_encode([
        'success' => true,
        'request' => $request
    ]);
}

/**
 * F) admin_update - Editar solicitud de pago (admin)
 */
function adminUpdateRequest() {
    $admin = requireAdminAuthShared();
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos JSON invalidos']);
        return;
    }
    
    $requestId = $input['request_id'] ?? '';
    if (empty($requestId)) {
        http_response_code(400);
        echo json_encode(['error' => 'request_id es requerido']);
        return;
    }
    
    $request = findRequestById($requestId);
    if (!$request) {
        http_response_code(404);
        echo json_encode(['error' => 'Solicitud no encontrada']);
        return;
    }
    
    // Only allow editing pending requests
    if ($request['status'] !== 'pending') {
        http_response_code(400);
        echo json_encode(['error' => 'Solo se pueden editar solicitudes pendientes']);
        return;
    }
    
    $updates = [];
    
    if (isset($input['user_email'])) {
        $email = strtolower(trim($input['user_email']));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'user_email invalido']);
            return;
        }
        $updates['user_email'] = $email;
    }
    
    if (isset($input['title'])) {
        $title = trim($input['title']);
        if (empty($title) || strlen($title) > 200) {
            http_response_code(400);
            echo json_encode(['error' => 'title es requerido (max 200 caracteres)']);
            return;
        }
        $updates['title'] = $title;
    }
    
    if (isset($input['description'])) {
        $updates['description'] = trim($input['description']);
    }
    
    if (isset($input['amount_clp'])) {
        if (floatval($input['amount_clp']) <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'amount_clp debe ser mayor a 0']);
            return;
        }
        $updates['amount_clp'] = intval($input['amount_clp']);
    }
    
    if (array_key_exists('amount_usd', $input)) {
        $updates['amount_usd'] = ($input['amount_usd'] !== null && $input['amount_usd'] > 0) ? floatval($input['amount_usd']) : null;
    }
    
    if (empty($updates)) {
        http_response_code(400);
        echo json_encode(['error' => 'No hay campos para actualizar']);
        return;
    }
    
    $updated = updateRequestInFile($requestId, $updates);
    
    logPaymentRequest('UPDATED', ['id' => $requestId, 'fields' => array_keys($updates), 'admin' => $admin['email'] ?? 'admin']);
    
    echo json_encode([
        'success' => true,
        'message' => 'Solicitud actualizada exitosamente',
        'request' => $updated
    ]);
}

/**
 * G) user_list_public - Listar solicitudes por email (sin JWT, como otros endpoints)
 * Usado por el panel de usuario para mostrar solicitudes de pago pendientes
 */
function userListRequestsPublic() {
    $userEmail = $_GET['user_email'] ?? '';
    if (empty($userEmail) || !filter_var($userEmail, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'user_email es requerido y debe ser valido']);
        return;
    }
    
    $userEmail = strtolower(trim($userEmail));
    $status = $_GET['status'] ?? 'all';
    $data = loadPaymentRequests();
    
    $filtered = array_filter($data['requests'], function($r) use ($userEmail, $status) {
        $emailMatch = strtolower($r['user_email']) === $userEmail;
        if ($status === 'all') return $emailMatch;
        return $emailMatch && $r['status'] === $status;
    });
    
    // Sort by created_at DESC
    usort($filtered, function($a, $b) {
        return strtotime($b['created_at']) - strtotime($a['created_at']);
    });
    
    echo json_encode([
        'success' => true,
        'requests' => array_values($filtered)
    ]);
}

// ============================================================
// CHAT NOTIFICATION MESSAGES
// ============================================================

/**
 * Create chat notification message for payment requests
 * Similar to createPaymentNotificationMessage in mercadopago.php
 */
function createPaymentRequestChatMessage($request, $type = 'created') {
    try {
        $pdo = getDbConnection();
        if (!$pdo) return;
        
        $userEmail = $request['user_email'];
        if (empty($userEmail)) return;
        
        $userName = explode('@', $userEmail)[0];
        
        // Find or create conversation
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
        
        $amount = number_format($request['amount_clp'], 0, ',', '.');
        $title = $request['title'] ?? 'Solicitud de pago';
        $description = $request['description'] ?? '';
        
        if ($type === 'created') {
            $message = "Nueva solicitud de pago\n\n" .
                "Se ha creado una solicitud de pago para ti:\n\n" .
                "Titulo: {$title}\n" .
                "Monto: \${$amount} CLP\n";
            if (!empty($description)) {
                $message .= "Descripcion: {$description}\n";
            }
            $message .= "\nPuedes pagar desde la seccion 'Pagos Pendientes' de tu panel usando:\n" .
                "- MercadoPago\n" .
                "- WebPay\n" .
                "- PayPal\n\n" .
                "Ingresa a tu panel para ver los detalles.";
        } elseif ($type === 'paid') {
            $paymentMethod = $request['payment_method'] ?? 'N/A';
            $paidAt = $request['paid_at'] ?? date('d/m/Y H:i');
            $message = "Pago confirmado\n\n" .
                "Tu pago por '{$title}' ha sido procesado exitosamente.\n\n" .
                "Monto: \${$amount} CLP\n" .
                "Metodo: {$paymentMethod}\n" .
                "Fecha: {$paidAt}\n\n" .
                "Gracias por tu pago. Puedes ver el comprobante en 'Mis Productos'.";
        } else {
            return;
        }
        
        $stmt = $pdo->prepare("INSERT INTO chat_messages (conversation_id, sender_id, sender_role, sender_name, sender_email, message) VALUES (?, 0, 'system', 'Sistema Imporlan', NULL, ?)");
        $stmt->execute([$conversationId, $message]);
        
        $stmt = $pdo->prepare("UPDATE chat_conversations SET updated_at = NOW() WHERE id = ?");
        $stmt->execute([$conversationId]);
        
        logPaymentRequest('CHAT_MSG_CREATED', ['conversation_id' => $conversationId, 'user' => $userEmail, 'type' => $type]);
    } catch (Exception $e) {
        logPaymentRequest('CHAT_MSG_ERROR', ['error' => $e->getMessage(), 'user' => $request['user_email'] ?? '']);
    }
}
