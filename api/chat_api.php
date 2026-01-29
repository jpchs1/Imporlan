<?php
/**
 * Chat API - Imporlan
 * 
 * Endpoints para el sistema de chat en tiempo real
 * Soporta usuarios del panel cliente y admin/soporte
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/email_service.php';

// Load JWT configuration from admin_api.php if not already defined
if (!defined('JWT_SECRET')) {
    // Use config file for JWT secret
    $configFile = __DIR__ . '/config.php';
    if (file_exists($configFile)) {
        require_once $configFile;
    }
    // Fallback: define from environment or use placeholder that will be set in production
    if (!defined('JWT_SECRET')) {
        define('JWT_SECRET', getenv('JWT_SECRET') ?: 'change-this-in-production');
    }
}
if (!defined('ADMIN_EMAIL')) {
    define('ADMIN_EMAIL', getenv('ADMIN_EMAIL') ?: 'admin@imporlan.cl');
}
if (!defined('SUPPORT_EMAIL')) {
    define('SUPPORT_EMAIL', getenv('SUPPORT_EMAIL') ?: 'soporte@imporlan.cl');
}

// Rate limiting configuration
define('RATE_LIMIT_MESSAGES', 30); // Max messages per minute
define('RATE_LIMIT_WINDOW', 60); // Window in seconds

$action = $_GET['action'] ?? '';

switch ($action) {
    // User endpoints
    case 'user_conversations':
        $user = requireUserAuth();
        getUserConversations($user);
        break;
    case 'user_messages':
        $user = requireUserAuth();
        getUserMessages($user);
        break;
    case 'user_send':
        $user = requireUserAuth();
        userSendMessage($user);
        break;
    case 'user_start_conversation':
        $user = requireUserAuth();
        userStartConversation($user);
        break;
    case 'user_unread_count':
        $user = requireUserAuth();
        getUserUnreadCount($user);
        break;
    
    // Admin/Support endpoints
    case 'admin_conversations':
        $admin = requireAdminAuth();
        getAdminConversations($admin);
        break;
    case 'admin_messages':
        $admin = requireAdminAuth();
        getAdminMessages($admin);
        break;
    case 'admin_send':
        $admin = requireAdminAuth();
        adminSendMessage($admin);
        break;
    case 'admin_assign':
        $admin = requireAdminAuth();
        assignConversation($admin);
        break;
    case 'admin_close':
        $admin = requireAdminAuth();
        closeConversation($admin);
        break;
    case 'admin_reopen':
        $admin = requireAdminAuth();
        reopenConversation($admin);
        break;
    case 'admin_unread_count':
        $admin = requireAdminAuth();
        getAdminUnreadCount($admin);
        break;
    case 'admin_user_details':
        $admin = requireAdminAuth();
        getAdminUserDetails($admin);
        break;
    
    // Polling endpoint for real-time updates
    case 'poll':
        handlePoll();
        break;
    
    // Initialize database tables
    case 'init_db':
        initDatabase();
        break;
    
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida']);
}

// JWT Functions
function base64UrlEncode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

function verifyJWT($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    
    list($base64Header, $base64Payload, $base64Signature) = $parts;
    
    $signature = hash_hmac('sha256', "$base64Header.$base64Payload", JWT_SECRET, true);
    $expectedSignature = base64UrlEncode($signature);
    
    if (!hash_equals($expectedSignature, $base64Signature)) return null;
    
    $payload = json_decode(base64UrlDecode($base64Payload), true);
    
    if ($payload['exp'] < time()) return null;
    
    return $payload;
}

function getAuthToken() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    
    if (!preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        return null;
    }
    
    return $matches[1];
}

function requireUserAuth() {
    $token = getAuthToken();
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['detail' => 'No autorizado']);
        exit();
    }
    
    $payload = verifyJWT($token);
    
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['detail' => 'Token invalido o expirado']);
        exit();
    }
    
    return $payload;
}

function requireAdminAuth() {
    $token = getAuthToken();
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['detail' => 'No autorizado']);
        exit();
    }
    
    $payload = verifyJWT($token);
    
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['detail' => 'Token invalido o expirado']);
        exit();
    }
    
    if (!in_array($payload['role'], ['admin', 'support'])) {
        http_response_code(403);
        echo json_encode(['detail' => 'Acceso denegado']);
        exit();
    }
    
    return $payload;
}

// Rate limiting
function checkRateLimit($userId) {
    $pdo = getDbConnection();
    
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count 
        FROM chat_messages 
        WHERE sender_id = ? 
        AND timestamp > DATE_SUB(NOW(), INTERVAL ? SECOND)
    ");
    $stmt->execute([$userId, RATE_LIMIT_WINDOW]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($result['count'] >= RATE_LIMIT_MESSAGES) {
        http_response_code(429);
        echo json_encode(['error' => 'Demasiados mensajes. Por favor espera un momento.']);
        exit();
    }
}

// Sanitize message content
function sanitizeMessage($message) {
    // Remove any HTML tags
    $message = strip_tags($message);
    // Convert special characters to HTML entities
    $message = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    // Trim whitespace
    $message = trim($message);
    // Limit message length
    if (strlen($message) > 5000) {
        $message = substr($message, 0, 5000);
    }
    return $message;
}

// Initialize database tables
function initDatabase() {
    $pdo = getDbConnection();
    
    try {
        // Create chat_conversations table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS chat_conversations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                user_email VARCHAR(255) NOT NULL,
                user_name VARCHAR(255) DEFAULT NULL,
                assigned_to_id INT DEFAULT NULL,
                assigned_to_role ENUM('admin', 'support') DEFAULT NULL,
                assigned_to_name VARCHAR(255) DEFAULT NULL,
                status ENUM('open', 'closed') DEFAULT 'open',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user_email (user_email),
                INDEX idx_status (status),
                INDEX idx_assigned (assigned_to_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        
        // Create chat_messages table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                conversation_id INT NOT NULL,
                sender_id INT NOT NULL,
                sender_role ENUM('user', 'admin', 'support') NOT NULL,
                sender_name VARCHAR(255) NOT NULL,
                sender_email VARCHAR(255) DEFAULT NULL,
                message TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                read_status TINYINT(1) DEFAULT 0,
                INDEX idx_conversation (conversation_id),
                INDEX idx_timestamp (timestamp),
                INDEX idx_read_status (read_status),
                FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        
        echo json_encode(['success' => true, 'message' => 'Tablas de chat creadas correctamente']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al crear tablas: ' . $e->getMessage()]);
    }
}

// User Functions
function getUserConversations($user) {
    $pdo = getDbConnection();
    
    $stmt = $pdo->prepare("
        SELECT 
            c.*,
            (SELECT message FROM chat_messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message,
            (SELECT timestamp FROM chat_messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message_time,
            (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id AND read_status = 0 AND sender_role != 'user') as unread_count
        FROM chat_conversations c
        WHERE c.user_email = ?
        ORDER BY c.updated_at DESC
    ");
    $stmt->execute([$user['email']]);
    $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['conversations' => $conversations]);
}

function getUserMessages($user) {
    $pdo = getDbConnection();
    $conversationId = $_GET['conversation_id'] ?? null;
    
    if (!$conversationId) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta conversation_id']);
        return;
    }
    
    // Verify user owns this conversation
    $stmt = $pdo->prepare("SELECT id FROM chat_conversations WHERE id = ? AND user_email = ?");
    $stmt->execute([$conversationId, $user['email']]);
    if (!$stmt->fetch()) {
        http_response_code(403);
        echo json_encode(['error' => 'No tienes acceso a esta conversacion']);
        return;
    }
    
    // Get messages
    $stmt = $pdo->prepare("
        SELECT * FROM chat_messages 
        WHERE conversation_id = ? 
        ORDER BY timestamp ASC
    ");
    $stmt->execute([$conversationId]);
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Mark messages from admin/support as read
    $stmt = $pdo->prepare("
        UPDATE chat_messages 
        SET read_status = 1 
        WHERE conversation_id = ? AND sender_role != 'user' AND read_status = 0
    ");
    $stmt->execute([$conversationId]);
    
    echo json_encode(['messages' => $messages]);
}

function userStartConversation($user) {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    
    $initialMessage = sanitizeMessage($input['message'] ?? '');
    
    if (empty($initialMessage)) {
        http_response_code(400);
        echo json_encode(['error' => 'El mensaje no puede estar vacio']);
        return;
    }
    
    checkRateLimit($user['sub']);
    
    try {
        $pdo->beginTransaction();
        
        // Create conversation
        $stmt = $pdo->prepare("
            INSERT INTO chat_conversations (user_id, user_email, user_name, status)
            VALUES (?, ?, ?, 'open')
        ");
        $userName = $user['name'] ?? explode('@', $user['email'])[0];
        $stmt->execute([$user['sub'], $user['email'], $userName]);
        $conversationId = $pdo->lastInsertId();
        
        // Add initial message
        $stmt = $pdo->prepare("
            INSERT INTO chat_messages (conversation_id, sender_id, sender_role, sender_name, sender_email, message)
            VALUES (?, ?, 'user', ?, ?, ?)
        ");
        $stmt->execute([$conversationId, $user['sub'], $userName, $user['email'], $initialMessage]);
        
        $pdo->commit();
        
        // Send email notification to admin
        sendChatNotification($user['email'], $userName, $initialMessage, $conversationId);
        
        echo json_encode([
            'success' => true,
            'conversation_id' => $conversationId,
            'message' => 'Conversacion iniciada'
        ]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Error al crear conversacion: ' . $e->getMessage()]);
    }
}

function userSendMessage($user) {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    
    $conversationId = $input['conversation_id'] ?? null;
    $message = sanitizeMessage($input['message'] ?? '');
    
    if (!$conversationId || empty($message)) {
        http_response_code(400);
        echo json_encode(['error' => 'Faltan datos requeridos']);
        return;
    }
    
    // Verify user owns this conversation
    $stmt = $pdo->prepare("SELECT id, status FROM chat_conversations WHERE id = ? AND user_email = ?");
    $stmt->execute([$conversationId, $user['email']]);
    $conversation = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$conversation) {
        http_response_code(403);
        echo json_encode(['error' => 'No tienes acceso a esta conversacion']);
        return;
    }
    
    if ($conversation['status'] === 'closed') {
        http_response_code(400);
        echo json_encode(['error' => 'Esta conversacion esta cerrada']);
        return;
    }
    
    checkRateLimit($user['sub']);
    
    try {
        $userName = $user['name'] ?? explode('@', $user['email'])[0];
        
        $stmt = $pdo->prepare("
            INSERT INTO chat_messages (conversation_id, sender_id, sender_role, sender_name, sender_email, message)
            VALUES (?, ?, 'user', ?, ?, ?)
        ");
        $stmt->execute([$conversationId, $user['sub'], $userName, $user['email'], $message]);
        $messageId = $pdo->lastInsertId();
        
        // Update conversation timestamp
        $stmt = $pdo->prepare("UPDATE chat_conversations SET updated_at = NOW() WHERE id = ?");
        $stmt->execute([$conversationId]);
        
        // Send email notification to admin
        sendChatNotification($user['email'], $userName, $message, $conversationId);
        
        echo json_encode([
            'success' => true,
            'message_id' => $messageId
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al enviar mensaje: ' . $e->getMessage()]);
    }
}

function getUserUnreadCount($user) {
    $pdo = getDbConnection();
    
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count
        FROM chat_messages m
        JOIN chat_conversations c ON m.conversation_id = c.id
        WHERE c.user_email = ? AND m.sender_role != 'user' AND m.read_status = 0
    ");
    $stmt->execute([$user['email']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode(['unread_count' => (int)$result['count']]);
}

// Admin Functions
function getAdminConversations($admin) {
    $pdo = getDbConnection();
    
    $status = $_GET['status'] ?? 'all';
    $assigned = $_GET['assigned'] ?? 'all';
    
    $sql = "
        SELECT 
            c.*,
            (SELECT message FROM chat_messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message,
            (SELECT timestamp FROM chat_messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message_time,
            (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id AND read_status = 0 AND sender_role = 'user') as unread_count
        FROM chat_conversations c
        WHERE 1=1
    ";
    $params = [];
    
    if ($status !== 'all') {
        $sql .= " AND c.status = ?";
        $params[] = $status;
    }
    
    if ($assigned === 'me') {
        $sql .= " AND c.assigned_to_id = ?";
        $params[] = $admin['sub'];
    } elseif ($assigned === 'unassigned') {
        $sql .= " AND c.assigned_to_id IS NULL";
    }
    
    $sql .= " ORDER BY c.updated_at DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['conversations' => $conversations]);
}

function getAdminMessages($admin) {
    $pdo = getDbConnection();
    $conversationId = $_GET['conversation_id'] ?? null;
    
    if (!$conversationId) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta conversation_id']);
        return;
    }
    
    // Get conversation details
    $stmt = $pdo->prepare("SELECT * FROM chat_conversations WHERE id = ?");
    $stmt->execute([$conversationId]);
    $conversation = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$conversation) {
        http_response_code(404);
        echo json_encode(['error' => 'Conversacion no encontrada']);
        return;
    }
    
    // Get messages
    $stmt = $pdo->prepare("
        SELECT * FROM chat_messages 
        WHERE conversation_id = ? 
        ORDER BY timestamp ASC
    ");
    $stmt->execute([$conversationId]);
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Mark user messages as read
    $stmt = $pdo->prepare("
        UPDATE chat_messages 
        SET read_status = 1 
        WHERE conversation_id = ? AND sender_role = 'user' AND read_status = 0
    ");
    $stmt->execute([$conversationId]);
    
    echo json_encode([
        'conversation' => $conversation,
        'messages' => $messages
    ]);
}

function adminSendMessage($admin) {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    
    $conversationId = $input['conversation_id'] ?? null;
    $message = sanitizeMessage($input['message'] ?? '');
    
    if (!$conversationId || empty($message)) {
        http_response_code(400);
        echo json_encode(['error' => 'Faltan datos requeridos']);
        return;
    }
    
    // Get conversation
    $stmt = $pdo->prepare("SELECT * FROM chat_conversations WHERE id = ?");
    $stmt->execute([$conversationId]);
    $conversation = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$conversation) {
        http_response_code(404);
        echo json_encode(['error' => 'Conversacion no encontrada']);
        return;
    }
    
    try {
        $adminName = $admin['role'] === 'admin' ? 'Administrador Imporlan' : 'Soporte Imporlan';
        
        $stmt = $pdo->prepare("
            INSERT INTO chat_messages (conversation_id, sender_id, sender_role, sender_name, sender_email, message)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$conversationId, $admin['sub'], $admin['role'], $adminName, $admin['email'], $message]);
        $messageId = $pdo->lastInsertId();
        
        // Update conversation timestamp
        $stmt = $pdo->prepare("UPDATE chat_conversations SET updated_at = NOW() WHERE id = ?");
        $stmt->execute([$conversationId]);
        
        // Auto-assign if not assigned
        if (!$conversation['assigned_to_id']) {
            $stmt = $pdo->prepare("
                UPDATE chat_conversations 
                SET assigned_to_id = ?, assigned_to_role = ?, assigned_to_name = ?
                WHERE id = ?
            ");
            $stmt->execute([$admin['sub'], $admin['role'], $adminName, $conversationId]);
        }
        
        // Send email notification to user (optional - can be enabled)
        // sendUserChatNotification($conversation['user_email'], $adminName, $message, $conversationId);
        
        echo json_encode([
            'success' => true,
            'message_id' => $messageId
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al enviar mensaje: ' . $e->getMessage()]);
    }
}

function assignConversation($admin) {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    
    $conversationId = $input['conversation_id'] ?? null;
    
    if (!$conversationId) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta conversation_id']);
        return;
    }
    
    try {
        $adminName = $admin['role'] === 'admin' ? 'Administrador Imporlan' : 'Soporte Imporlan';
        
        $stmt = $pdo->prepare("
            UPDATE chat_conversations 
            SET assigned_to_id = ?, assigned_to_role = ?, assigned_to_name = ?
            WHERE id = ?
        ");
        $stmt->execute([$admin['sub'], $admin['role'], $adminName, $conversationId]);
        
        echo json_encode(['success' => true, 'message' => 'Conversacion asignada']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al asignar conversacion: ' . $e->getMessage()]);
    }
}

function closeConversation($admin) {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    
    $conversationId = $input['conversation_id'] ?? null;
    
    if (!$conversationId) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta conversation_id']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("UPDATE chat_conversations SET status = 'closed' WHERE id = ?");
        $stmt->execute([$conversationId]);
        
        echo json_encode(['success' => true, 'message' => 'Conversacion cerrada']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al cerrar conversacion: ' . $e->getMessage()]);
    }
}

function reopenConversation($admin) {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    
    $conversationId = $input['conversation_id'] ?? null;
    
    if (!$conversationId) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta conversation_id']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("UPDATE chat_conversations SET status = 'open' WHERE id = ?");
        $stmt->execute([$conversationId]);
        
        echo json_encode(['success' => true, 'message' => 'Conversacion reabierta']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al reabrir conversacion: ' . $e->getMessage()]);
    }
}

function getAdminUnreadCount($admin) {
    $pdo = getDbConnection();
    
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count
        FROM chat_messages m
        JOIN chat_conversations c ON m.conversation_id = c.id
        WHERE m.sender_role = 'user' AND m.read_status = 0
    ");
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode(['unread_count' => (int)$result['count']]);
}

function getAdminUserDetails($admin) {
    $pdo = getDbConnection();
    $userEmail = $_GET['email'] ?? null;
    
    if (!$userEmail) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta email del usuario']);
        return;
    }
    
    // Get user purchases from purchases.json
    $purchasesFile = __DIR__ . '/purchases.json';
    $purchases = [];
    $totalSpent = 0;
    
    if (file_exists($purchasesFile)) {
        $data = json_decode(file_get_contents($purchasesFile), true);
        $allPurchases = $data['purchases'] ?? [];
        
        foreach ($allPurchases as $p) {
            if (strtolower($p['user_email'] ?? '') === strtolower($userEmail)) {
                $purchases[] = $p;
                $totalSpent += floatval($p['amount_clp'] ?? $p['amount'] ?? 0);
            }
        }
    }
    
    // Get conversation stats
    $stmt = $pdo->prepare("
        SELECT 
            COUNT(*) as total_conversations,
            SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_conversations
        FROM chat_conversations
        WHERE user_email = ?
    ");
    $stmt->execute([$userEmail]);
    $conversationStats = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'email' => $userEmail,
        'name' => explode('@', $userEmail)[0],
        'purchases' => $purchases,
        'total_spent' => $totalSpent,
        'total_purchases' => count($purchases),
        'conversation_stats' => $conversationStats
    ]);
}

// Polling endpoint
function handlePoll() {
    $token = getAuthToken();
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['detail' => 'No autorizado']);
        return;
    }
    
    $payload = verifyJWT($token);
    
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['detail' => 'Token invalido o expirado']);
        return;
    }
    
    $lastCheck = $_GET['last_check'] ?? date('Y-m-d H:i:s', strtotime('-1 minute'));
    $conversationId = $_GET['conversation_id'] ?? null;
    
    $pdo = getDbConnection();
    
    if (in_array($payload['role'], ['admin', 'support'])) {
        // Admin polling - get new user messages
        $sql = "
            SELECT m.*, c.user_email, c.user_name
            FROM chat_messages m
            JOIN chat_conversations c ON m.conversation_id = c.id
            WHERE m.timestamp > ? AND m.sender_role = 'user'
        ";
        $params = [$lastCheck];
        
        if ($conversationId) {
            $sql .= " AND m.conversation_id = ?";
            $params[] = $conversationId;
        }
        
        $sql .= " ORDER BY m.timestamp ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $newMessages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get updated conversations
        $stmt = $pdo->prepare("
            SELECT 
                c.*,
                (SELECT message FROM chat_messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message,
                (SELECT timestamp FROM chat_messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message_time,
                (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id AND read_status = 0 AND sender_role = 'user') as unread_count
            FROM chat_conversations c
            WHERE c.updated_at > ?
            ORDER BY c.updated_at DESC
        ");
        $stmt->execute([$lastCheck]);
        $updatedConversations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
    } else {
        // User polling - get new admin/support messages
        $sql = "
            SELECT m.*
            FROM chat_messages m
            JOIN chat_conversations c ON m.conversation_id = c.id
            WHERE m.timestamp > ? AND m.sender_role != 'user' AND c.user_email = ?
        ";
        $params = [$lastCheck, $payload['email']];
        
        if ($conversationId) {
            $sql .= " AND m.conversation_id = ?";
            $params[] = $conversationId;
        }
        
        $sql .= " ORDER BY m.timestamp ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $newMessages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $updatedConversations = [];
    }
    
    echo json_encode([
        'new_messages' => $newMessages,
        'updated_conversations' => $updatedConversations,
        'server_time' => date('Y-m-d H:i:s')
    ]);
}

// Email notification helper
function sendChatNotification($userEmail, $userName, $message, $conversationId) {
    try {
        $emailService = new EmailService();
        $emailService->sendInternalNotification('new_chat_message', [
            'user_email' => $userEmail,
            'user_name' => $userName,
            'message' => substr($message, 0, 200) . (strlen($message) > 200 ? '...' : ''),
            'conversation_id' => $conversationId,
            'date' => date('d/m/Y H:i')
        ]);
    } catch (Exception $e) {
        // Log error but don't fail the request
        error_log('Chat notification email failed: ' . $e->getMessage());
    }
}
