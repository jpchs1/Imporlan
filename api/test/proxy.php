<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$TARGET_BACKEND = 'https://app-bxlfgnkv.fly.dev';

$requestUri = $_SERVER['REQUEST_URI'];
$path = parse_url($requestUri, PHP_URL_PATH);
$query = parse_url($requestUri, PHP_URL_QUERY);

$path = preg_replace('#^/api/test/#', '/api/', $path);

// Handle auth/login locally instead of forwarding to Fly.dev
if ($path === '/api/auth/login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    
    $input = json_decode(file_get_contents('php://input'), true);
    $email = $input['email'] ?? $input['username'] ?? '';
    $password = $input['password'] ?? '';
    
    $adminEmail = 'admin@imporlan.cl';
    $adminPassword = 'admin123';
    $supportEmail = 'soporte@imporlan.cl';
    $supportPassword = 'soporte123';
    $jwtSecret = 'imporlan-admin-secret-key-2026';
    
    $user = null;
    if ($email === $adminEmail && $password === $adminPassword) {
        $user = [
            'id' => 1,
            'email' => $adminEmail,
            'name' => 'Administrador Imporlan',
            'role' => 'admin',
            'status' => 'active'
        ];
    } else if ($email === $supportEmail && $password === $supportPassword) {
        $user = [
            'id' => 2,
            'email' => $supportEmail,
            'name' => 'Soporte Imporlan',
            'role' => 'support',
            'status' => 'active'
        ];
    }
    
    if (!$user) {
        // Also check against admin users database
        $dbConfigPath = __DIR__ . '/../db_config.php';
        if (file_exists($dbConfigPath)) {
            try {
                $dbConfig = include $dbConfigPath;
                if (is_array($dbConfig)) {
                    $pdo = new PDO(
                        "mysql:host={$dbConfig['host']};dbname={$dbConfig['dbname']};charset=utf8mb4",
                        $dbConfig['user'],
                        $dbConfig['password']
                    );
                    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                    
                    $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE email = ? AND status = 'active'");
                    $stmt->execute([$email]);
                    $dbUser = $stmt->fetch(PDO::FETCH_ASSOC);
                    
                    if ($dbUser && password_verify($password, $dbUser['password'])) {
                        $user = [
                            'id' => (int)$dbUser['id'],
                            'email' => $dbUser['email'],
                            'name' => $dbUser['name'],
                            'role' => $dbUser['role'],
                            'status' => $dbUser['status']
                        ];
                    }
                }
            } catch (Exception $e) {
                // DB not available, continue with hardcoded check only
            }
        }
    }
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['detail' => 'Credenciales invalidas']);
        exit();
    }
    
    // Generate JWT
    $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
    $payload = [
        'sub' => (string)$user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'exp' => time() + (7 * 24 * 60 * 60),
        'iat' => time()
    ];
    
    $b64Header = rtrim(strtr(base64_encode($header), '+/', '-_'), '=');
    $b64Payload = rtrim(strtr(base64_encode(json_encode($payload)), '+/', '-_'), '=');
    $signature = hash_hmac('sha256', "$b64Header.$b64Payload", $jwtSecret, true);
    $b64Signature = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');
    $token = "$b64Header.$b64Payload.$b64Signature";
    
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
    exit();
}

// Handle auth/me locally - verify token and return user info
if ($path === '/api/auth/me' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    header('Content-Type: application/json');
    
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['detail' => 'No autorizado']);
        exit();
    }
    
    $token = $matches[1];
    $jwtSecret = 'imporlan-admin-secret-key-2026';
    
    // Verify JWT
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        http_response_code(401);
        echo json_encode(['detail' => 'Token invalido']);
        exit();
    }
    
    list($b64Header, $b64Payload, $b64Sig) = $parts;
    $expectedSig = rtrim(strtr(base64_encode(
        hash_hmac('sha256', "$b64Header.$b64Payload", $jwtSecret, true)
    ), '+/', '-_'), '=');
    
    if (!hash_equals($expectedSig, $b64Sig)) {
        http_response_code(401);
        echo json_encode(['detail' => 'Token invalido']);
        exit();
    }
    
    $payload = json_decode(base64_decode(strtr($b64Payload, '-_', '+/')), true);
    if (!$payload || ($payload['exp'] ?? 0) < time()) {
        http_response_code(401);
        echo json_encode(['detail' => 'Token expirado']);
        exit();
    }
    
    // Return user data from token
    $userData = [
        'id' => (int)($payload['sub'] ?? 0),
        'email' => $payload['email'] ?? '',
        'name' => $payload['email'] === 'admin@imporlan.cl' ? 'Administrador Imporlan' : 
                  ($payload['email'] === 'soporte@imporlan.cl' ? 'Soporte Imporlan' : explode('@', $payload['email'])[0]),
        'role' => $payload['role'] ?? 'user',
        'status' => 'active',
        'provider' => 'email',
        'avatar_url' => null,
        'last_login' => date('c'),
        'created_at' => '2026-01-01T00:00:00',
        'updated_at' => date('c')
    ];
    
    echo json_encode($userData);
    exit();
}

// Handle /api/admin/* endpoints locally - return real data for dashboard, stubs for others
// The React SPA calls these; dashboard returns computed stats, other sections use enhancer scripts
if (preg_match('#^/api/admin(/|$)#', $path)) {
    header('Content-Type: application/json');
    
    $adminPath = preg_replace('#^/api/admin/?#', '', $path);
    $adminPath = explode('?', $adminPath)[0];
    $firstSegment = explode('/', $adminPath)[0];
    
    switch ($firstSegment) {
        case 'dashboard':
            echo json_encode(computeDashboardStats());
            break;
        case 'users':
        case 'submissions':
        case 'payments':
        case 'audit-logs':
            echo json_encode(['items' => [], 'total' => 0, 'pages' => 0]);
            break;
        case 'plans':
        case 'content':
            echo json_encode(['items' => []]);
            break;
        default:
            echo json_encode(['items' => [], 'total' => 0, 'pages' => 0]);
            break;
    }
    exit();
}

/**
 * Convert a timestamp string to ISO 8601 format for React compatibility.
 * Handles MySQL format "2026-03-01 12:16:51" -> "2026-03-01T12:16:51"
 */
function toISO8601($ts) {
    if (!$ts) return '';
    // Already has T separator - likely ISO format
    if (strpos($ts, 'T') !== false) return $ts;
    // Try to parse and reformat
    $parsed = strtotime($ts);
    if ($parsed !== false && $parsed > 0) {
        return date('c', $parsed); // ISO 8601 with timezone
    }
    // Fallback: replace space with T
    return str_replace(' ', 'T', $ts);
}

/**
 * Compute real dashboard statistics from purchases.json, quotation_requests.json, and database
 */
function computeDashboardStats() {
    $apiDir = dirname(__DIR__); // /api directory

    // --- Purchases data ---
    $purchases = [];
    $purchasesFile = $apiDir . '/purchases.json';
    if (file_exists($purchasesFile)) {
        $data = json_decode(file_get_contents($purchasesFile), true);
        $purchases = $data['purchases'] ?? [];
    }

    // --- Quotation requests data ---
    $quotationRequests = [];
    $qrFile = $apiDir . '/quotation_requests.json';
    if (file_exists($qrFile)) {
        $data = json_decode(file_get_contents($qrFile), true);
        $quotationRequests = $data['requests'] ?? [];
    }

    // --- Compute stats from purchases ---
    $totalRevenue = 0;
    $paymentsPaid = 0;
    $activePlans = 0;
    $totalPlans = 0;
    $paymentsByProvider = [];
    $submissionsByStatus = [];
    $purchaseEmails = [];
    $recentActivity = [];

    foreach ($purchases as $p) {
        $amount = floatval($p['amount_clp'] ?? $p['amount'] ?? 0);
        $totalRevenue += $amount;
        $paymentsPaid++;

        // Count plans
        if (($p['type'] ?? '') === 'plan') {
            $totalPlans++;
            $status = $p['status'] ?? 'pending';
            if ($status === 'active') $activePlans++;
        }

        // Payments by provider
        $method = $p['payment_method'] ?? $p['method'] ?? 'otro';
        if (!isset($paymentsByProvider[$method])) $paymentsByProvider[$method] = 0;
        $paymentsByProvider[$method]++;

        // Submissions by status
        $status = $p['status'] ?? 'pending';
        if (!isset($submissionsByStatus[$status])) $submissionsByStatus[$status] = 0;
        $submissionsByStatus[$status]++;

        // Track unique emails for user count
        $email = strtolower($p['user_email'] ?? '');
        if ($email) $purchaseEmails[$email] = true;

        // Recent activity from purchases
        $timestamp = $p['timestamp'] ?? $p['date'] ?? '';
        if ($timestamp) {
            $userName = explode('@', $p['user_email'] ?? '')[0];
            $type = $p['type'] ?? 'link';
            $desc = $type === 'plan'
                ? 'Compra de plan: ' . ($p['plan_name'] ?? $p['description'] ?? 'Plan')
                : 'Cotizacion por links';
            $iso = toISO8601($timestamp);
            $recentActivity[] = [
                'type' => 'purchase',
                'description' => $desc,
                'user' => $userName,
                'timestamp' => $iso,
                'created_at' => $iso
            ];
        }
    }

    // --- Quotation requests stats ---
    $pendingSubmissions = 0;
    foreach ($quotationRequests as $qr) {
        $qrEmail = strtolower($qr['email'] ?? '');
        // Count as pending if no matching purchase
        if (!$qrEmail || !isset($purchaseEmails[$qrEmail])) {
            $pendingSubmissions++;
            if (!isset($submissionsByStatus['nueva_solicitud'])) $submissionsByStatus['nueva_solicitud'] = 0;
            $submissionsByStatus['nueva_solicitud']++;
        }

        // Recent activity from quotation requests
        $date = $qr['date'] ?? '';
        if ($date) {
            $qrName = $qr['name'] ?? ($qrEmail ? explode('@', $qrEmail)[0] : 'Anonimo');
            $linksCount = count($qr['boat_links'] ?? []);
            $isoDate = toISO8601($date);
            $recentActivity[] = [
                'type' => 'quotation_request',
                'description' => 'Nueva solicitud de cotizacion' . ($linksCount > 0 ? " ($linksCount links)" : ''),
                'user' => $qrName,
                'timestamp' => $isoDate,
                'created_at' => $isoDate
            ];
        }
    }

    $totalSubmissions = count($purchases) + $pendingSubmissions;

    // Sort recent activity by timestamp descending, take last 10
    usort($recentActivity, function($a, $b) {
        return strtotime($b['timestamp'] ?? '0') - strtotime($a['timestamp'] ?? '0');
    });
    $recentActivity = array_slice($recentActivity, 0, 10);

    // --- Database stats (users, audit) ---
    $totalUsers = count($purchaseEmails); // Start with unique purchase emails
    $newUsers7d = 0;
    $usersByRole = [];
    $dbConfigPath = dirname(__DIR__) . '/db_config.php';

    if (file_exists($dbConfigPath)) {
        try {
            require_once $dbConfigPath;
            $pdo = getDbConnection();
            if ($pdo) {
                // Admin users count
                try {
                    $stmt = $pdo->query("SELECT role, COUNT(*) as cnt FROM admin_users GROUP BY role");
                    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $usersByRole[$row['role']] = (int)$row['cnt'];
                        $totalUsers += (int)$row['cnt'];
                    }
                    // New users in last 7 days
                    $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM admin_users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
                    $stmt->execute();
                    $newUsers7d = (int)$stmt->fetch(PDO::FETCH_ASSOC)['cnt'];
                } catch (Exception $e) {
                    // admin_users table might not exist yet
                }

                // Recent audit activity
                try {
                    $stmt = $pdo->query("SELECT user_name, action_type, description, created_at FROM audit_log ORDER BY created_at DESC LIMIT 5");
                    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $isoAudit = toISO8601($row['created_at']);
                        $recentActivity[] = [
                            'type' => 'audit',
                            'description' => $row['description'] ?? $row['action_type'],
                            'user' => $row['user_name'] ?? '',
                            'timestamp' => $isoAudit,
                            'created_at' => $isoAudit
                        ];
                    }
                    // Re-sort after adding audit entries
                    usort($recentActivity, function($a, $b) {
                        return strtotime($b['timestamp'] ?? '0') - strtotime($a['timestamp'] ?? '0');
                    });
                    $recentActivity = array_slice($recentActivity, 0, 10);
                } catch (Exception $e) {
                    // audit_log table might not exist yet
                }
            }
        } catch (Exception $e) {
            // DB not available, continue with file-based data only
        }
    }

    // Also count unique quotation request users
    $usersByRole['cliente'] = count($purchaseEmails);
    // Count new "users" from purchases in last 7 days
    $sevenDaysAgo = strtotime('-7 days');
    foreach ($purchases as $p) {
        $ts = strtotime($p['timestamp'] ?? $p['date'] ?? '');
        if ($ts && $ts >= $sevenDaysAgo) {
            $newUsers7d++;
        }
    }

    return [
        'stats' => [
            'total_users' => $totalUsers,
            'new_users_7d' => $newUsers7d,
            'pending_submissions' => $pendingSubmissions,
            'total_submissions' => $totalSubmissions,
            'total_revenue_clp' => (int)$totalRevenue,
            'payments_paid' => $paymentsPaid,
            'active_plans' => $activePlans,
            'total_plans' => $totalPlans
        ],
        'recent_activity' => $recentActivity,
        'payments_by_provider' => (object)$paymentsByProvider,
        'submissions_by_status' => (object)$submissionsByStatus,
        'users_by_role' => (object)$usersByRole
    ];
}

$targetUrl = $TARGET_BACKEND . $path;
if ($query) {
    $targetUrl .= '?' . $query;
}

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$headers = [];
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $headers[] = 'Authorization: ' . $_SERVER['HTTP_AUTHORIZATION'];
}
if (isset($_SERVER['CONTENT_TYPE'])) {
    $headers[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
}
if (!empty($headers)) {
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
}

$input = file_get_contents('php://input');
if ($input) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($ch, $headerLine) {
    $len = strlen($headerLine);
    $parts = explode(':', $headerLine, 2);
    if (count($parts) === 2) {
        $name = strtolower(trim($parts[0]));
        $value = trim($parts[1]);
        if (!in_array($name, ['transfer-encoding', 'connection', 'access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers'])) {
            header($headerLine, false);
        }
    }
    return $len;
});

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    error_log("admin-proxy error: $targetUrl - $error");
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['detail' => 'Backend unavailable']);
    exit();
}

http_response_code($httpCode);
echo $response;
