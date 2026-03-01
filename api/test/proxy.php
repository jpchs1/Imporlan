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

// Handle /api/admin/* endpoints locally - return stub responses
// The React SPA calls these but real data comes from enhancer scripts calling local PHP APIs
if (preg_match('#^/api/admin(/|$)#', $path)) {
    header('Content-Type: application/json');
    
    $adminPath = preg_replace('#^/api/admin/?#', '', $path);
    $adminPath = explode('?', $adminPath)[0]; // remove query string from path
    
    // Return appropriate empty stub data based on endpoint
    switch ($adminPath) {
        case 'dashboard':
            echo json_encode([
                'total_users' => 0,
                'total_orders' => 0,
                'total_revenue' => 0,
                'recent_orders' => [],
                'stats' => []
            ]);
            break;
        case 'content':
            echo json_encode([
                'items' => [],
                'total' => 0
            ]);
            break;
        case 'users':
            echo json_encode([
                'users' => [],
                'total' => 0
            ]);
            break;
        case 'requests':
        case 'solicitudes':
            echo json_encode([
                'requests' => [],
                'total' => 0
            ]);
            break;
        case 'plans':
        case 'planes':
            echo json_encode([
                'plans' => [],
                'total' => 0
            ]);
            break;
        case 'payments':
        case 'pagos':
            echo json_encode([
                'payments' => [],
                'total' => 0
            ]);
            break;
        case 'audit':
        case 'auditoria':
            echo json_encode([
                'logs' => [],
                'total' => 0
            ]);
            break;
        case 'settings':
        case 'configuracion':
            echo json_encode([
                'settings' => []
            ]);
            break;
        default:
            // Generic empty response for any other admin endpoint
            echo json_encode([
                'data' => [],
                'total' => 0
            ]);
            break;
    }
    exit();
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
