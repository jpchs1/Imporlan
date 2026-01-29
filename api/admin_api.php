<?php
/**
 * Admin API - Imporlan
 * 
 * Endpoints para el panel de administracion
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

define('ADMIN_EMAIL', 'admin@imporlan.cl');
define('ADMIN_PASSWORD', 'admin123');
define('SUPPORT_EMAIL', 'soporte@imporlan.cl');
define('SUPPORT_PASSWORD', 'soporte123');
define('JWT_SECRET', 'imporlan-admin-secret-key-2026');

$purchasesFile = __DIR__ . '/purchases.json';

if (!file_exists($purchasesFile)) {
    file_put_contents($purchasesFile, json_encode(['purchases' => []]));
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        handleLogin();
        break;
    case 'dashboard':
        requireAuth();
        getDashboard();
        break;
    case 'users':
        requireAuth();
        getUsers();
        break;
    case 'purchases':
        requireAuth();
        getPurchases();
        break;
    case 'user':
        requireAuth();
        getUserDetail();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida']);
}

function base64UrlEncode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

function createJWT($payload) {
    $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
    $payload['exp'] = time() + (7 * 24 * 60 * 60);
    $payload['iat'] = time();
    
    $base64Header = base64UrlEncode($header);
    $base64Payload = base64UrlEncode(json_encode($payload));
    
    $signature = hash_hmac('sha256', "$base64Header.$base64Payload", JWT_SECRET, true);
    $base64Signature = base64UrlEncode($signature);
    
    return "$base64Header.$base64Payload.$base64Signature";
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

function requireAuth() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    
    if (!preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['detail' => 'No autorizado']);
        exit();
    }
    
    $token = $matches[1];
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

function handleLogin() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';
    
    $user = null;
    
    if ($email === ADMIN_EMAIL && $password === ADMIN_PASSWORD) {
        $user = [
            'id' => 1,
            'email' => ADMIN_EMAIL,
            'name' => 'Administrador Imporlan',
            'role' => 'admin',
            'status' => 'active'
        ];
    } else if ($email === SUPPORT_EMAIL && $password === SUPPORT_PASSWORD) {
        $user = [
            'id' => 2,
            'email' => SUPPORT_EMAIL,
            'name' => 'Soporte Imporlan',
            'role' => 'support',
            'status' => 'active'
        ];
    }
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['detail' => 'Invalid credentials']);
        return;
    }
    
    $token = createJWT([
        'sub' => (string)$user['id'],
        'email' => $user['email'],
        'role' => $user['role']
    ]);
    
    echo json_encode([
        'access_token' => $token,
        'token_type' => 'bearer',
        'user' => array_merge($user, [
            'provider' => 'email',
            'avatar_url' => null,
            'last_login' => date('c'),
            'created_at' => '2026-01-01T00:00:00',
            'updated_at' => date('c')
        ])
    ]);
}

function getDashboard() {
    global $purchasesFile;
    
    $data = json_decode(file_get_contents($purchasesFile), true);
    $purchases = $data['purchases'] ?? [];
    
    $users = [];
    foreach ($purchases as $p) {
        $email = strtolower($p['user_email'] ?? '');
        if ($email && !isset($users[$email])) {
            $users[$email] = ['email' => $p['user_email'], 'total_purchases' => 0, 'total_spent' => 0];
        }
        if ($email) {
            $users[$email]['total_purchases']++;
            $users[$email]['total_spent'] += floatval($p['amount_clp'] ?? $p['amount'] ?? 0);
        }
    }
    
    $totalUsers = count($users);
    $totalPurchases = count($purchases);
    $pendingPurchases = count(array_filter($purchases, fn($p) => ($p['status'] ?? '') === 'pending'));
    $completedPurchases = count(array_filter($purchases, fn($p) => in_array($p['status'] ?? '', ['completed', 'paid', 'active'])));
    
    $totalRevenue = array_reduce($purchases, function($sum, $p) {
        return $sum + floatval($p['amount_clp'] ?? $p['amount'] ?? 0);
    }, 0);
    
    $byPaymentMethod = [];
    foreach ($purchases as $p) {
        $method = $p['payment_method'] ?? 'unknown';
        $byPaymentMethod[$method] = ($byPaymentMethod[$method] ?? 0) + 1;
    }
    
    $byStatus = [];
    foreach ($purchases as $p) {
        $status = $p['status'] ?? 'unknown';
        $byStatus[$status] = ($byStatus[$status] ?? 0) + 1;
    }
    
    $recentPurchases = array_slice(array_reverse($purchases), 0, 10);
    $recentActivity = array_map(function($p) {
        return [
            'id' => $p['id'],
            'user_email' => $p['user_email'],
            'type' => $p['type'],
            'amount' => $p['amount_clp'] ?? $p['amount'],
            'status' => $p['status'],
            'date' => $p['timestamp'] ?? $p['date']
        ];
    }, $recentPurchases);
    
    echo json_encode([
        'total_users' => $totalUsers,
        'new_users_7d' => $totalUsers,
        'total_submissions' => $totalPurchases,
        'pending_submissions' => $pendingPurchases,
        'total_revenue' => $totalRevenue,
        'completed_payments' => $completedPurchases,
        'active_plans' => count(array_filter($purchases, fn($p) => $p['type'] === 'plan')),
        'total_plans' => count(array_filter($purchases, fn($p) => $p['type'] === 'plan')),
        'users_by_role' => [
            ['role' => 'user', 'count' => $totalUsers],
            ['role' => 'admin', 'count' => 1],
            ['role' => 'support', 'count' => 1]
        ],
        'submissions_by_status' => array_map(fn($s, $c) => ['status' => $s, 'count' => $c], array_keys($byStatus), array_values($byStatus)),
        'payments_by_provider' => array_map(fn($p, $c) => ['provider' => $p, 'count' => $c], array_keys($byPaymentMethod), array_values($byPaymentMethod)),
        'payments_summary' => [
            'pending' => $pendingPurchases,
            'completed' => $completedPurchases,
            'failed' => 0
        ],
        'recent_activity' => $recentActivity,
        'last_updated' => date('c')
    ]);
}

function getUsers() {
    global $purchasesFile;
    
    $data = json_decode(file_get_contents($purchasesFile), true);
    $purchases = $data['purchases'] ?? [];
    
    $usersMap = [];
    foreach ($purchases as $p) {
        $email = strtolower($p['user_email'] ?? '');
        if (!$email) continue;
        
        if (!isset($usersMap[$email])) {
            $usersMap[$email] = [
                'id' => count($usersMap) + 1,
                'email' => $p['user_email'],
                'name' => explode('@', $p['user_email'])[0],
                'phone' => null,
                'role' => 'user',
                'status' => 'active',
                'provider' => 'email',
                'avatar_url' => null,
                'last_login' => $p['timestamp'] ?? null,
                'created_at' => $p['timestamp'] ?? $p['date'],
                'updated_at' => $p['timestamp'] ?? $p['date'],
                'total_purchases' => 0,
                'total_spent' => 0
            ];
        }
        
        $usersMap[$email]['total_purchases']++;
        $usersMap[$email]['total_spent'] += floatval($p['amount_clp'] ?? $p['amount'] ?? 0);
        
        if (($p['timestamp'] ?? '') > ($usersMap[$email]['last_login'] ?? '')) {
            $usersMap[$email]['last_login'] = $p['timestamp'];
            $usersMap[$email]['updated_at'] = $p['timestamp'];
        }
    }
    
    $users = array_values($usersMap);
    usort($users, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
    
    echo json_encode([
        'items' => $users,
        'total' => count($users),
        'last_updated' => date('c')
    ]);
}

function getPurchases() {
    global $purchasesFile;
    
    $data = json_decode(file_get_contents($purchasesFile), true);
    $purchases = $data['purchases'] ?? [];
    
    $items = array_map(function($p, $index) {
        return [
            'id' => $index + 1,
            'purchase_id' => $p['id'],
            'user_email' => $p['user_email'],
            'type' => $p['type'],
            'description' => $p['description'] ?? '',
            'plan_name' => $p['plan_name'] ?? '',
            'url' => $p['url'] ?? '',
            'amount' => floatval($p['amount'] ?? 0),
            'amount_clp' => intval($p['amount_clp'] ?? $p['amount'] ?? 0),
            'currency' => $p['currency'] ?? 'CLP',
            'payment_method' => $p['payment_method'] ?? 'unknown',
            'payment_id' => $p['payment_id'] ?? null,
            'order_id' => $p['order_id'] ?? null,
            'status' => $p['status'] ?? 'pending',
            'date' => $p['date'] ?? '',
            'created_at' => $p['timestamp'] ?? $p['date'],
            'updated_at' => $p['timestamp'] ?? $p['date']
        ];
    }, $purchases, array_keys($purchases));
    
    usort($items, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
    
    echo json_encode([
        'items' => $items,
        'total' => count($items),
        'last_updated' => date('c')
    ]);
}

function getUserDetail() {
    global $purchasesFile;
    
    $userEmail = $_GET['email'] ?? null;
    
    if (!$userEmail) {
        http_response_code(400);
        echo json_encode(['error' => 'Falta email del usuario']);
        return;
    }
    
    $data = json_decode(file_get_contents($purchasesFile), true);
    $purchases = $data['purchases'] ?? [];
    
    $userPurchases = array_filter($purchases, function($p) use ($userEmail) {
        return strtolower($p['user_email'] ?? '') === strtolower($userEmail);
    });
    
    if (empty($userPurchases)) {
        http_response_code(404);
        echo json_encode(['error' => 'Usuario no encontrado']);
        return;
    }
    
    $firstPurchase = reset($userPurchases);
    $totalSpent = array_reduce($userPurchases, fn($sum, $p) => $sum + floatval($p['amount_clp'] ?? $p['amount'] ?? 0), 0);
    
    $user = [
        'id' => 1,
        'email' => $firstPurchase['user_email'],
        'name' => explode('@', $firstPurchase['user_email'])[0],
        'phone' => null,
        'role' => 'user',
        'status' => 'active',
        'provider' => 'email',
        'avatar_url' => null,
        'created_at' => $firstPurchase['timestamp'] ?? $firstPurchase['date'],
        'updated_at' => $firstPurchase['timestamp'] ?? $firstPurchase['date'],
        'total_purchases' => count($userPurchases),
        'total_spent' => $totalSpent,
        'purchases' => array_values($userPurchases)
    ];
    
    echo json_encode($user);
}
