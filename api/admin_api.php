<?php
/**
 * Admin API - Imporlan
 * 
 * Endpoints para el panel de administracion
 */

require_once __DIR__ . '/cors_helper.php';
setCorsHeadersSecure();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/credentials.php';
define('ADMIN_EMAIL', IMPORLAN_ADMIN_EMAIL);
define('ADMIN_PASSWORD', IMPORLAN_ADMIN_PASSWORD);
define('SUPPORT_EMAIL', IMPORLAN_SUPPORT_EMAIL);
define('SUPPORT_PASSWORD', IMPORLAN_SUPPORT_PASSWORD);
define('JWT_SECRET', IMPORLAN_JWT_SECRET);

$purchasesFile = __DIR__ . '/purchases.json';

if (!file_exists($purchasesFile)) {
    file_put_contents($purchasesFile, json_encode(['purchases' => []]));
}

require_once __DIR__ . '/plan_expiration.php';
maybeExpireStalePlans();

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
    case 'update_purchase_status':
        $p = requireAuth();
        $GLOBALS['authPayload'] = $p;
        if (!in_array($p['role'] ?? '', ['admin', 'support'], true)) {
            http_response_code(403);
            echo json_encode(['detail' => 'Acceso denegado']);
            exit();
        }
        updatePurchaseStatus();
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
    if (!isset($payload['exp'])) {
        $payload['exp'] = time() + (7 * 24 * 60 * 60);
    }
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
    
    // Reject 2FA pending tokens - they should only be used for /auth/verify-2fa
    if (($payload['purpose'] ?? null) === '2fa_pending') {
        http_response_code(401);
        echo json_encode(['detail' => 'Token de 2FA no es valido para esta operacion']);
        exit();
    }

    if (!in_array($payload['role'], ['admin', 'support', 'agent'])) {
        http_response_code(403);
        echo json_encode(['detail' => 'Acceso denegado']);
        exit();
    }

    return $payload;
}

function handleLogin() {
    // Rate limit login attempts
    require_once __DIR__ . '/antispam.php';
    imporlan_login_protection();

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
    
    // If not a hardcoded user, try database (admin_users table)
    if (!$user) {
        try {
            require_once __DIR__ . '/db_config.php';
            $pdo = getDbConnection();
            if ($pdo) {
                $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE email = ? AND status = 'active'");
                $stmt->execute([$email]);
                $dbUser = $stmt->fetch(PDO::FETCH_ASSOC);
                // Sólo roles del equipo entran al panel admin.
                if ($dbUser && in_array($dbUser['role'], ['admin', 'support', 'agent'], true)
                    && password_verify($password, $dbUser['password_hash'])) {
                    $user = [
                        'id' => (int)$dbUser['id'],
                        'email' => $dbUser['email'],
                        'name' => $dbUser['name'],
                        'role' => $dbUser['role'],
                        'status' => $dbUser['status'],
                        'locale' => $dbUser['locale'] ?? 'es',
                        'permissions' => $dbUser['permissions'] ?? null
                    ];
                    // Update last_login
                    $pdo->prepare("UPDATE admin_users SET last_login = NOW() WHERE id = ?")->execute([$dbUser['id']]);
                }
            }
        } catch (Exception $e) {
            // DB not available, fall through
        }
    }
    
    if (!$user) {
        require_once __DIR__ . '/security_alerts.php';
        (new SecurityAlerts())->logFailedLogin($email);

        http_response_code(401);
        echo json_encode(['detail' => 'Invalid credentials']);
        return;
    }

    // Check if 2FA is enabled
    require_once __DIR__ . '/two_factor.php';
    require_once __DIR__ . '/security_alerts.php';
    $tfa = new TwoFactorAuth();
    $securityAlerts = new SecurityAlerts();

    if ($tfa->isEnabled($user['email'])) {
        if (!$tfa->isTrustedDevice($user['email'])) {
            $tempToken = createJWT([
                'sub' => (string)$user['id'],
                'email' => $user['email'],
                'role' => $user['role'],
                'purpose' => '2fa_pending',
                'exp' => time() + 300
            ]);
            echo json_encode([
                'requires_2fa' => true,
                'temp_token' => $tempToken,
                'message' => 'Se requiere codigo de verificacion 2FA'
            ]);
            return;
        }
    }

    $securityAlerts->logSuccessfulLogin($user['email']);

    $token = createJWT([
        'sub' => (string)$user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'locale' => $user['locale'] ?? 'es',
        'permissions' => $user['permissions'] ?? null
    ]);
    
    echo json_encode([
        'access_token' => $token,
        'token_type' => 'bearer',
        'user' => array_merge($user, [
            'provider' => 'email',
            'avatar_url' => null,
            'last_login' => date('c'),
            'created_at' => $user['created_at'] ?? '2026-01-01T00:00:00',
            'updated_at' => date('c')
        ])
    ]);
}

/** Compras con dinero efectivamente recibido (expired = plan pagado ya cerrado). */
function purchaseIsPaid($p) {
    return in_array($p['status'] ?? '', ['paid', 'active', 'completed', 'expired'], true);
}

function purchaseAmount($p) {
    return floatval($p['amount_clp'] ?? $p['amount'] ?? 0);
}

function purchaseTime($p) {
    return strtotime($p['timestamp'] ?? '') ?: (strtotime($p['date'] ?? '') ?: 0);
}

function getDashboard() {
    global $purchasesFile;
    
    $data = json_decode(file_get_contents($purchasesFile), true);
    $purchases = $data['purchases'] ?? [];
    
    $users = [];
    $weekAgo = time() - 7 * 86400;
    foreach ($purchases as $p) {
        $email = strtolower($p['user_email'] ?? '');
        if (!$email) continue;
        if (!isset($users[$email])) {
            $users[$email] = ['email' => $p['user_email'], 'total_purchases' => 0, 'total_spent' => 0, 'first' => PHP_INT_MAX];
        }
        $users[$email]['total_purchases']++;
        if (purchaseIsPaid($p)) $users[$email]['total_spent'] += purchaseAmount($p);
        $t = purchaseTime($p);
        if ($t && $t < $users[$email]['first']) $users[$email]['first'] = $t;
    }
    
    $totalUsers = count($users);
    $newUsers7d = count(array_filter($users, fn($u) => $u['first'] !== PHP_INT_MAX && $u['first'] >= $weekAgo));
    $totalPurchases = count($purchases);
    $pendingPurchases = count(array_filter($purchases, fn($p) => ($p['status'] ?? '') === 'pending'));
    $completedPurchases = count(array_filter($purchases, 'purchaseIsPaid'));
    
    // Sólo dinero recibido: no suman compras pendientes ni canceladas.
    $totalRevenue = array_reduce(array_filter($purchases, 'purchaseIsPaid'), fn($sum, $p) => $sum + purchaseAmount($p), 0);
    $monthStart = strtotime(date('Y-m-01 00:00:00'));
    $revenueMonth = array_reduce(
        array_filter($purchases, fn($p) => purchaseIsPaid($p) && purchaseTime($p) >= $monthStart),
        fn($sum, $p) => $sum + purchaseAmount($p), 0);
    
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
    
    $sortedPurchases = $purchases;
    usort($sortedPurchases, fn($a, $b) => purchaseTime($b) <=> purchaseTime($a));
    $recentPurchases = array_slice($sortedPurchases, 0, 10);
    $recentActivity = array_map(function($p) {
        return [
            'id' => $p['id'] ?? '',
            'user_email' => $p['user_email'] ?? '',
            'type' => $p['type'] ?? '',
            'description' => $p['plan_name'] ?? ($p['description'] ?? ''),
            'amount' => $p['amount_clp'] ?? ($p['amount'] ?? 0),
            'status' => $p['status'] ?? '',
            'payment_method' => $p['payment_method'] ?? '',
            'date' => $p['timestamp'] ?? ($p['date'] ?? '')
        ];
    }, $recentPurchases);

    // Ingresos por mes (últimos 6) para el gráfico del dashboard.
    $revenueByMonth = [];
    for ($i = 5; $i >= 0; $i--) {
        $revenueByMonth[date('Y-m', strtotime("first day of -$i month"))] = 0;
    }
    foreach ($purchases as $p) {
        if (!purchaseIsPaid($p)) continue;
        $k = date('Y-m', purchaseTime($p) ?: 0);
        if (isset($revenueByMonth[$k])) $revenueByMonth[$k] += purchaseAmount($p);
    }
    
    echo json_encode([
        'total_users' => $totalUsers,
        'new_users_7d' => $newUsers7d,
        'total_submissions' => $totalPurchases,
        'pending_submissions' => $pendingPurchases,
        'total_revenue' => $totalRevenue,
        'revenue_month' => $revenueMonth,
        'revenue_by_month' => array_map(fn($m, $v) => ['month' => $m, 'amount' => $v], array_keys($revenueByMonth), array_values($revenueByMonth)),
        'completed_payments' => $completedPurchases,
        'active_plans' => count(array_filter($purchases, fn($p) => ($p['type'] ?? '') === 'plan' && in_array($p['status'] ?? '', ['paid', 'active'], true))),
        'total_plans' => count(array_filter($purchases, fn($p) => ($p['type'] ?? '') === 'plan')),
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
        if (purchaseIsPaid($p)) $usersMap[$email]['total_spent'] += purchaseAmount($p);
        
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
            'created_at' => $p['timestamp'] ?? ($p['date'] ?? ''),
            'updated_at' => $p['timestamp'] ?? ($p['date'] ?? ''),
            'sort_time' => purchaseTime($p),
            'days' => $p['days'] ?? null,
            'end_date' => $p['end_date'] ?? null,
            'payer_name' => $p['payer_name'] ?? null,
            'payer_phone' => $p['payer_phone'] ?? null,
            'expired_at' => $p['expired_at'] ?? null,
            'expired_reason' => $p['expired_reason'] ?? null,
            'reactivated_at' => $p['reactivated_at'] ?? null,
        ];
    }, $purchases, array_keys($purchases));
    
    usort($items, fn($a, $b) => $b['sort_time'] <=> $a['sort_time']);
    
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
    $totalSpent = array_reduce(array_filter($userPurchases, 'purchaseIsPaid'), fn($sum, $p) => $sum + purchaseAmount($p), 0);
    
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
        'purchases' => (function ($l) { usort($l, fn($a, $b) => purchaseTime($b) <=> purchaseTime($a)); return $l; })(array_values($userPurchases))
    ];
    
    echo json_encode($user);
}

/**
 * Update purchase status manually (admin only).
 * POST with JSON body: { "purchase_id": "xxx", "status": "paid|pending|active|expired|canceled" }
 * Valid statuses: pending, paid, active, expired, canceled
 * 
 * This endpoint syncs the status across:
 * 1. purchases.json (admin Dashboard, Usuarios, Compras)
 * 2. orders table in MySQL (Expedientes, user panel)
 */
function updatePurchaseStatus() {
    global $purchasesFile;
    
    $input = json_decode(file_get_contents('php://input'), true);
    $purchaseId = $input['purchase_id'] ?? '';
    $newStatus = $input['status'] ?? '';
    
    if (empty($purchaseId) || empty($newStatus)) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere purchase_id y status']);
        return;
    }
    
    $validStatuses = ['pending', 'paid', 'active', 'expired', 'canceled'];
    if (!in_array($newStatus, $validStatuses)) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Status no valido. Use: ' . implode(', ', $validStatuses)
        ]);
        return;
    }
    
    // === 1. Update purchases.json (con lock: el cierre automático de planes
    // y las pasarelas escriben el mismo archivo) ===
    $fp = fopen($purchasesFile, 'c+');
    if (!$fp || !flock($fp, LOCK_EX)) {
        http_response_code(500);
        echo json_encode(['error' => 'No se pudo abrir el registro de compras']);
        return;
    }
    $data = json_decode(stream_get_contents($fp), true);
    $purchases = $data['purchases'] ?? [];
    
    $found = false;
    $oldStatus = '';
    $purchaseInfo = null;
    
    foreach ($purchases as &$purchase) {
        if (($purchase['id'] ?? '') === $purchaseId) {
            $oldStatus = $purchase['status'] ?? 'unknown';
            $purchase['status'] = $newStatus;
            // Reactivar a mano reinicia el plazo del cierre automático (60 días).
            if (in_array($newStatus, ['paid', 'active'], true) && !in_array($oldStatus, ['paid', 'active'], true)) {
                $purchase['reactivated_at'] = date('Y-m-d H:i:s');
            }
            if ($newStatus !== 'expired') {
                unset($purchase['expired_reason']);
            }
            $found = true;
            $purchaseInfo = [
                'id' => $purchase['id'],
                'user_email' => $purchase['user_email'] ?? '',
                'description' => $purchase['description'] ?? '',
                'amount' => $purchase['amount_clp'] ?? $purchase['amount'] ?? 0,
                'old_status' => $oldStatus,
                'new_status' => $newStatus
            ];
            break;
        }
    }
    unset($purchase);
    
    if (!$found) {
        flock($fp, LOCK_UN);
        fclose($fp);
        http_response_code(404);
        echo json_encode(['error' => 'Compra no encontrada con id: ' . $purchaseId]);
        return;
    }
    
    $data['purchases'] = $purchases;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    
    // === 2. Sync order status in MySQL (Expedientes) ===
    $orderSynced = false;
    $orderStatusMap = [
        'pending' => 'pending_admin_fill',
        'paid' => 'in_progress',
        'active' => 'in_progress',
        'expired' => 'expired',
        'canceled' => 'canceled'
    ];
    $orderStatus = $orderStatusMap[$newStatus] ?? null;
    
    if ($orderStatus) {
        try {
            require_once __DIR__ . '/db_config.php';
            $pdo = getDbConnection();
            if ($pdo) {
                // Un expediente completado no se reabre por un cambio en la compra.
                $ids = $pdo->prepare("SELECT id FROM orders WHERE purchase_id = ? AND status <> 'completed' AND status <> ?");
                $ids->execute([$purchaseId, $orderStatus]);
                $orderIds = $ids->fetchAll(PDO::FETCH_COLUMN);
                $upd = $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?");
                $evt = $pdo->prepare("INSERT INTO order_events (order_id, event_type, meta_json, user_id) VALUES (?, 'status_change', ?, ?)");
                foreach ($orderIds as $oid) {
                    $upd->execute([$orderStatus, $oid]);
                    try {
                        $evt->execute([$oid, json_encode(['new_status' => $orderStatus, 'reason' => 'Cambio de estado de la compra ' . $purchaseId]), $GLOBALS['authPayload']['email'] ?? 'admin']);
                    } catch (Exception $e) { /* auditoría best-effort */ }
                }
                $orderSynced = count($orderIds) > 0;
            }
        } catch (Exception $e) {
            error_log("Error syncing order status for purchase $purchaseId: " . $e->getMessage());
        }
    }
    
    $purchaseInfo['order_synced'] = $orderSynced;
    $purchaseInfo['order_status'] = $orderStatus;
    
    echo json_encode([
        'success' => true,
        'message' => 'Status actualizado correctamente' . ($orderSynced ? ' (expediente sincronizado)' : ''),
        'purchase' => $purchaseInfo
    ]);
}
