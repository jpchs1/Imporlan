<?php
/**
 * Local Auth Handler - Imporlan
 * Handles login, auth/me, Google OAuth and registration locally
 * Replaces dependency on Fly.dev backend
 */

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/credentials.php';

function handleAuthEndpoint($uriPath) {
    header('Content-Type: application/json');

    $method = $_SERVER['REQUEST_METHOD'];

    if (preg_match('#/auth/login$#', $uriPath) && $method === 'POST') {
        handleLogin();
        return;
    }

    if (preg_match('#/auth/me$#', $uriPath) && $method === 'GET') {
        handleAuthMe();
        return;
    }

    if (preg_match('#/auth/google$#', $uriPath) && $method === 'POST') {
        handleGoogleAuth();
        return;
    }

    if (preg_match('#/auth/register$#', $uriPath) && $method === 'POST') {
        handleRegister();
        return;
    }

    if (preg_match('#/auth/verify-2fa$#', $uriPath) && $method === 'POST') {
        handleVerify2FA();
        return;
    }

    if (preg_match('#/auth/logout$#', $uriPath)) {
        echo json_encode(['success' => true]);
        return;
    }

    // Settings endpoints
    if (preg_match('#/settings/dollar-observado$#', $uriPath)) {
        handleDollarObservado();
        return;
    }

    http_response_code(404);
    echo json_encode(['detail' => 'Endpoint not found']);
}

function getJwtSecretLocal() {
    return IMPORLAN_JWT_SECRET;
}

function generateJWT($payload) {
    $secret = getJwtSecretLocal();
    $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
    $b64Header = rtrim(strtr(base64_encode($header), '+/', '-_'), '=');
    $b64Payload = rtrim(strtr(base64_encode(json_encode($payload)), '+/', '-_'), '=');
    $signature = hash_hmac('sha256', "$b64Header.$b64Payload", $secret, true);
    $b64Signature = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');
    return "$b64Header.$b64Payload.$b64Signature";
}

function verifyJWTLocal($token) {
    $secret = getJwtSecretLocal();
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    list($b64Header, $b64Payload, $b64Sig) = $parts;
    $expectedSig = rtrim(strtr(base64_encode(
        hash_hmac('sha256', "$b64Header.$b64Payload", $secret, true)
    ), '+/', '-_'), '=');

    if (!hash_equals($expectedSig, $b64Sig)) return null;

    $payload = json_decode(base64_decode(strtr($b64Payload, '-_', '+/')), true);
    if (!$payload || ($payload['exp'] ?? 0) < time()) return null;

    return $payload;
}

function buildUserResponse($user, $token = null) {
    $response = [
        'provider' => $user['provider'] ?? 'email',
        'avatar_url' => $user['avatar_url'] ?? null,
        'last_login' => date('c'),
        'created_at' => $user['created_at'] ?? '2026-01-01T00:00:00',
        'updated_at' => date('c')
    ];
    $result = array_merge($user, $response);
    if ($token) {
        return ['access_token' => $token, 'token_type' => 'bearer', 'user' => $result];
    }
    return $result;
}

function handleLogin() {
    // Rate limit login attempts
    require_once __DIR__ . '/antispam.php';
    imporlan_login_protection();

    $input = json_decode(file_get_contents('php://input'), true);
    $email = trim($input['email'] ?? $input['username'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['detail' => 'Email y contrasena son requeridos']);
        return;
    }

    // Check admin accounts from credentials config
    $hardcoded = [
        IMPORLAN_ADMIN_EMAIL => ['password' => IMPORLAN_ADMIN_PASSWORD, 'name' => 'Administrador Imporlan', 'role' => 'admin', 'id' => 1],
        IMPORLAN_SUPPORT_EMAIL => ['password' => IMPORLAN_SUPPORT_PASSWORD, 'name' => 'Soporte Imporlan', 'role' => 'support', 'id' => 2],
    ];

    $user = null;
    if (isset($hardcoded[$email]) && $password === $hardcoded[$email]['password']) {
        $user = [
            'id' => $hardcoded[$email]['id'],
            'email' => $email,
            'name' => $hardcoded[$email]['name'],
            'role' => $hardcoded[$email]['role'],
            'status' => 'active',
            'locale' => 'es',
        ];
    }

    // Check database
    if (!$user) {
        try {
            $pdo = getDbConnection();
            if ($pdo) {
                $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE email = ? AND status = 'active'");
                $stmt->execute([$email]);
                $dbUser = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($dbUser && password_verify($password, $dbUser['password_hash'])) {
                    $user = [
                        'id' => (int)$dbUser['id'],
                        'email' => $dbUser['email'],
                        'name' => $dbUser['name'],
                        'role' => $dbUser['role'],
                        'status' => $dbUser['status'],
                        'locale' => $dbUser['locale'] ?? 'es',
                        'permissions' => $dbUser['permissions'] ?? null,
                    ];
                    // Update last login
                    $pdo->prepare("UPDATE admin_users SET last_login = NOW() WHERE id = ?")->execute([$dbUser['id']]);
                }
            }
        } catch (Exception $e) {
            error_log("Auth DB error: " . $e->getMessage());
        }
    }

    // Check panel users (registered via Google/email on the website)
    if (!$user) {
        try {
            $pdo = getDbConnection();
            if ($pdo) {
                // Check if there's a users table for panel users
                $tables = $pdo->query("SHOW TABLES LIKE 'users'")->fetchAll();
                if (count($tables) > 0) {
                    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
                    $stmt->execute([$email]);
                    $panelUser = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($panelUser && isset($panelUser['password_hash']) && password_verify($password, $panelUser['password_hash'])) {
                        $user = [
                            'id' => (int)$panelUser['id'],
                            'email' => $panelUser['email'],
                            'name' => $panelUser['name'] ?? explode('@', $panelUser['email'])[0],
                            'role' => 'user',
                            'status' => 'active',
                            'locale' => 'es',
                        ];
                    }
                }
            }
        } catch (Exception $e) {}
    }

    if (!$user) {
        // Log failed login
        require_once __DIR__ . '/security_alerts.php';
        (new SecurityAlerts())->logFailedLogin($email);

        http_response_code(401);
        echo json_encode(['detail' => 'Credenciales invalidas']);
        return;
    }

    // Check if 2FA is enabled for this user
    require_once __DIR__ . '/two_factor.php';
    require_once __DIR__ . '/security_alerts.php';
    $tfa = new TwoFactorAuth();
    $securityAlerts = new SecurityAlerts();

    if ($tfa->isEnabled($user['email'])) {
        // Check if device is trusted (skip 2FA)
        if (!$tfa->isTrustedDevice($user['email'])) {
            // 2FA required - return partial response requiring code
            $tempPayload = [
                'sub' => (string)$user['id'],
                'email' => $user['email'],
                'role' => $user['role'],
                'purpose' => '2fa_pending',
                'exp' => time() + 300, // 5 min to enter code
                'iat' => time()
            ];
            $tempToken = generateJWT($tempPayload);

            echo json_encode([
                'requires_2fa' => true,
                'temp_token' => $tempToken,
                'message' => 'Se requiere codigo de verificacion 2FA'
            ]);
            return;
        }
    }

    // Log successful login
    $securityAlerts->logSuccessfulLogin($user['email']);

    $payload = [
        'sub' => (string)$user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'locale' => $user['locale'] ?? 'es',
        'permissions' => $user['permissions'] ?? null,
        'exp' => time() + (7 * 24 * 60 * 60),
        'iat' => time()
    ];

    $token = generateJWT($payload);
    echo json_encode(buildUserResponse($user, $token));
}

function handleVerify2FA() {
    $input = json_decode(file_get_contents('php://input'), true);
    $tempToken = $input['temp_token'] ?? '';
    $code = $input['code'] ?? '';
    $trustDevice = $input['trust_device'] ?? false;

    if (!$tempToken || !$code) {
        http_response_code(400);
        echo json_encode(['detail' => 'Token temporal y codigo 2FA son requeridos']);
        return;
    }

    // Verify the temporary token
    $payload = verifyJWTLocal($tempToken);
    if (!$payload || ($payload['purpose'] ?? '') !== '2fa_pending') {
        http_response_code(401);
        echo json_encode(['detail' => 'Token temporal invalido o expirado']);
        return;
    }

    require_once __DIR__ . '/two_factor.php';
    require_once __DIR__ . '/security_alerts.php';
    $tfa = new TwoFactorAuth();
    $securityAlerts = new SecurityAlerts();

    if (!$tfa->verifyLogin($payload['email'], $code)) {
        $securityAlerts->log2FAFailure($payload['email']);
        http_response_code(401);
        echo json_encode(['detail' => 'Codigo 2FA invalido']);
        return;
    }

    // 2FA verified - build the real user data
    $email = $payload['email'];
    $user = null;

    // Rebuild user from DB or credentials
    $hardcoded = [
        IMPORLAN_ADMIN_EMAIL => ['password' => IMPORLAN_ADMIN_PASSWORD, 'name' => 'Administrador Imporlan', 'role' => 'admin', 'id' => 1],
        IMPORLAN_SUPPORT_EMAIL => ['password' => IMPORLAN_SUPPORT_PASSWORD, 'name' => 'Soporte Imporlan', 'role' => 'support', 'id' => 2],
    ];

    if (isset($hardcoded[$email])) {
        $user = [
            'id' => $hardcoded[$email]['id'],
            'email' => $email,
            'name' => $hardcoded[$email]['name'],
            'role' => $hardcoded[$email]['role'],
            'status' => 'active',
            'locale' => 'es',
        ];
    } else {
        try {
            $pdo = getDbConnection();
            if ($pdo) {
                $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE email = ? AND status = 'active'");
                $stmt->execute([$email]);
                $dbUser = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($dbUser) {
                    $user = [
                        'id' => (int)$dbUser['id'],
                        'email' => $dbUser['email'],
                        'name' => $dbUser['name'],
                        'role' => $dbUser['role'],
                        'status' => $dbUser['status'],
                        'locale' => $dbUser['locale'] ?? 'es',
                        'permissions' => $dbUser['permissions'] ?? null,
                    ];
                }
            }
        } catch (Exception $e) {}
    }

    if (!$user) {
        http_response_code(401);
        echo json_encode(['detail' => 'Usuario no encontrado']);
        return;
    }

    // Trust device if requested
    $trustedDeviceData = null;
    if ($trustDevice) {
        $trustedDeviceData = $tfa->trustDevice($email);
    }

    $securityAlerts->logSuccessfulLogin($email);

    $fullPayload = [
        'sub' => (string)$user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'locale' => $user['locale'] ?? 'es',
        'permissions' => $user['permissions'] ?? null,
        'exp' => time() + (7 * 24 * 60 * 60),
        'iat' => time()
    ];

    $token = generateJWT($fullPayload);
    $response = buildUserResponse($user, $token);

    // Include trusted device cookie info for the frontend to set
    if ($trustedDeviceData) {
        $response['trusted_device'] = $trustedDeviceData;
    }

    echo json_encode($response);
}

function handleAuthMe() {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['detail' => 'No autorizado']);
        return;
    }

    $payload = verifyJWTLocal($matches[1]);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['detail' => 'Token invalido o expirado']);
        return;
    }

    // Resolve user name
    $userName = explode('@', $payload['email'] ?? '')[0];
    try {
        $pdo = getDbConnection();
        if ($pdo) {
            $stmt = $pdo->prepare("SELECT name FROM admin_users WHERE email = ?");
            $stmt->execute([$payload['email'] ?? '']);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) $userName = $row['name'];
        }
    } catch (Exception $e) {}

    echo json_encode([
        'id' => (int)($payload['sub'] ?? 0),
        'email' => $payload['email'] ?? '',
        'name' => $userName,
        'role' => $payload['role'] ?? 'user',
        'locale' => $payload['locale'] ?? 'es',
        'permissions' => $payload['permissions'] ?? null,
        'status' => 'active',
        'provider' => 'email',
        'avatar_url' => null,
        'last_login' => date('c'),
        'created_at' => '2026-01-01T00:00:00',
        'updated_at' => date('c')
    ]);
}

function handleGoogleAuth() {
    $input = json_decode(file_get_contents('php://input'), true);
    $credential = $input['credential'] ?? $input['token'] ?? $input['id_token'] ?? '';

    if (empty($credential)) {
        http_response_code(400);
        echo json_encode(['detail' => 'Google credential required']);
        return;
    }

    // Decode Google JWT (we just need the payload, Google already verified it client-side)
    $parts = explode('.', $credential);
    if (count($parts) !== 3) {
        http_response_code(400);
        echo json_encode(['detail' => 'Invalid Google token']);
        return;
    }

    $googlePayload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
    if (!$googlePayload || empty($googlePayload['email'])) {
        http_response_code(400);
        echo json_encode(['detail' => 'Invalid Google token payload']);
        return;
    }

    $email = $googlePayload['email'];
    $name = $googlePayload['name'] ?? explode('@', $email)[0];
    $avatar = $googlePayload['picture'] ?? null;

    // Check if user exists in admin_users
    $userId = 0;
    $role = 'user';
    $locale = 'es';
    $permissions = null;
    try {
        $pdo = getDbConnection();
        if ($pdo) {
            $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE email = ?");
            $stmt->execute([$email]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                $userId = (int)$existing['id'];
                $name = $existing['name'];
                $role = $existing['role'];
                $locale = $existing['locale'] ?? 'es';
                $permissions = $existing['permissions'] ?? null;
                $pdo->prepare("UPDATE admin_users SET last_login = NOW() WHERE id = ?")->execute([$userId]);
            } else {
                // Auto-create user account for Google sign-in
                $stmt = $pdo->prepare("INSERT INTO admin_users (name, email, password_hash, role, status, last_login, created_at) VALUES (?, ?, ?, 'user', 'active', NOW(), NOW())");
                $stmt->execute([$name, $email, password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT)]);
                $userId = (int)$pdo->lastInsertId();
            }
        }
    } catch (Exception $e) {
        error_log("Google auth DB error: " . $e->getMessage());
        // Continue without DB - use Google data
        $userId = crc32($email);
    }

    $user = [
        'id' => $userId,
        'email' => $email,
        'name' => $name,
        'role' => $role,
        'status' => 'active',
        'locale' => $locale,
        'permissions' => $permissions,
        'provider' => 'google',
        'avatar_url' => $avatar,
    ];

    $payload = [
        'sub' => (string)$userId,
        'email' => $email,
        'role' => $role,
        'locale' => $locale,
        'permissions' => $permissions,
        'exp' => time() + (7 * 24 * 60 * 60),
        'iat' => time()
    ];

    $token = generateJWT($payload);
    echo json_encode(buildUserResponse($user, $token));
}

function handleRegister() {
    $input = json_decode(file_get_contents('php://input'), true);
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $name = trim($input['name'] ?? $input['full_name'] ?? '');
    $phone = trim($input['phone'] ?? '');

    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['detail' => 'Email y contrasena son requeridos']);
        return;
    }

    if (empty($name)) {
        $name = explode('@', $email)[0];
    }

    try {
        $pdo = getDbConnection();
        if (!$pdo) {
            http_response_code(500);
            echo json_encode(['detail' => 'Database unavailable']);
            return;
        }

        // Check if email already exists
        $stmt = $pdo->prepare("SELECT id FROM admin_users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['detail' => 'Este email ya esta registrado. Intenta iniciar sesion.']);
            return;
        }

        // Create user
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO admin_users (name, email, password_hash, phone, role, status, last_login, created_at) VALUES (?, ?, ?, ?, 'user', 'active', NOW(), NOW())");
        $stmt->execute([$name, $email, $hash, $phone]);
        $userId = (int)$pdo->lastInsertId();

        $user = [
            'id' => $userId,
            'email' => $email,
            'name' => $name,
            'role' => 'user',
            'status' => 'active',
            'locale' => 'es',
        ];

        $payload = [
            'sub' => (string)$userId,
            'email' => $email,
            'role' => 'user',
            'locale' => 'es',
            'exp' => time() + (7 * 24 * 60 * 60),
            'iat' => time()
        ];

        $token = generateJWT($payload);

        // Send notification email
        try {
            require_once __DIR__ . '/email_service.php';
            $emailService = new EmailService();
            $emailService->sendWelcomeEmail($email, $name);
        } catch (Exception $e) {
            error_log("Welcome email failed: " . $e->getMessage());
        }

        echo json_encode(buildUserResponse($user, $token));
    } catch (Exception $e) {
        error_log("Register error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['detail' => 'Error al registrar usuario']);
    }
}

function handleDollarObservado() {
    // Return cached dollar value or fetch from API
    try {
        $pdo = getDbConnection();
        if ($pdo) {
            $stmt = $pdo->query("SELECT value FROM settings WHERE key_name = 'dollar_observado' LIMIT 1");
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                echo json_encode(['value' => floatval($row['value'])]);
                return;
            }
        }
    } catch (Exception $e) {}

    // Fallback
    echo json_encode(['value' => 950.0]);
}
