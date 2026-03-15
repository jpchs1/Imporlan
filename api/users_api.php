<?php
/**
 * Users API - Imporlan
 *
 * CRUD endpoints para gestionar usuarios admin
 *
 * Admin endpoints (require auth):
 * - GET  ?action=list              - Listar usuarios admin
 * - POST ?action=create            - Crear usuario admin
 * - POST ?action=update            - Actualizar usuario admin
 * - POST ?action=delete            - Eliminar usuario admin
 * - GET  ?action=migrate           - Crear tabla admin_users
 * - POST ?action=update_email      - Actualizar email de usuario real (purchases/quotations)
 * - POST ?action=set_secondary_email - Asignar email secundario a usuario
 * - GET  ?action=get_secondary_email - Obtener email secundario de usuario
 */

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/auth_helper.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'migrate':
        requireAdminAuthShared();
        usersMigrate();
        break;
    case 'list':
        requireAdminAuthShared();
        usersList();
        break;
    case 'create':
        requireAdminAuthShared();
        usersCreate();
        break;
    case 'update':
        requireAdminAuthShared();
        usersUpdate();
        break;
    case 'delete':
        requireAdminAuthShared();
        usersDelete();
        break;
    case 'update_email':
        requireAdminAuthShared();
        usersUpdateEmail();
        break;
    case 'set_secondary_email':
        requireAdminAuthShared();
        usersSetSecondaryEmail();
        break;
    case 'get_secondary_email':
        requireAdminAuthShared();
        usersGetSecondaryEmail();
        break;
    case 'send_password_reset':
        requireAdminAuthShared();
        usersSendPasswordReset();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida. Use: migrate, list, create, update, delete, update_email, set_secondary_email, get_secondary_email, send_password_reset']);
}

function usersMigrate() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS admin_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('admin','support','user') DEFAULT 'user',
                status ENUM('active','suspended') DEFAULT 'active',
                phone VARCHAR(50),
                last_login TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_role (role),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Create user_secondary_emails table for storing secondary emails
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS user_secondary_emails (
                id INT AUTO_INCREMENT PRIMARY KEY,
                primary_email VARCHAR(255) NOT NULL,
                secondary_email VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY idx_primary (primary_email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Add secondary_email column to admin_users if it doesn't exist
        try {
            $pdo->exec("ALTER TABLE admin_users ADD COLUMN secondary_email VARCHAR(255) DEFAULT NULL AFTER email");
        } catch (PDOException $e) {
            // Column already exists, ignore
        }

        $count = $pdo->query("SELECT COUNT(*) FROM admin_users")->fetchColumn();
        if ($count == 0) {
            $adminApi = __DIR__ . '/admin_api.php';
            $content = file_get_contents($adminApi);
            $adminPass = '';
            $supportPass = '';
            if (preg_match("/ADMIN_PASSWORD.*?'([^']+)'/", $content, $m)) $adminPass = $m[1];
            if (preg_match("/SUPPORT_PASSWORD.*?'([^']+)'/", $content, $m)) $supportPass = $m[1];
            $stmt = $pdo->prepare("INSERT INTO admin_users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)");
            if ($adminPass) $stmt->execute(['Administrador Imporlan', 'admin@imporlan.cl', password_hash($adminPass, PASSWORD_DEFAULT), 'admin', 'active']);
            if ($supportPass) $stmt->execute(['Soporte Imporlan', 'soporte@imporlan.cl', password_hash($supportPass, PASSWORD_DEFAULT), 'support', 'active']);
        }

        echo json_encode(['success' => true, 'message' => 'admin_users table created/updated']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Migration failed: ' . $e->getMessage()]);
    }
}

function usersList() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        // Check if secondary_email column exists
        $hasSecondaryCol = false;
        try {
            $pdo->query("SELECT secondary_email FROM admin_users LIMIT 1");
            $hasSecondaryCol = true;
        } catch (PDOException $e) {
            // Column doesn't exist yet
        }

        $cols = 'id, name, email, role, status, phone, last_login, created_at, updated_at';
        if ($hasSecondaryCol) {
            $cols = 'id, name, email, secondary_email, role, status, phone, last_login, created_at, updated_at';
        }
        $stmt = $pdo->query("SELECT $cols FROM admin_users ORDER BY created_at DESC");
        $adminUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($adminUsers as &$u) {
            $u['source'] = 'admin';
            $u['total_purchases'] = 0;
            $u['total_spent'] = 0;
            if (!$hasSecondaryCol) {
                $u['secondary_email'] = null;
            }
        }
        unset($u);

        $adminEmails = array_map(function($u) { return strtolower($u['email']); }, $adminUsers);

        $realUsers = [];
        $purchasesFile = __DIR__ . '/purchases.json';
        if (file_exists($purchasesFile)) {
            $data = json_decode(file_get_contents($purchasesFile), true);
            $purchases = $data['purchases'] ?? [];
            $usersMap = [];
            foreach ($purchases as $p) {
                $email = strtolower($p['user_email'] ?? '');
                if (!$email) continue;
                if (in_array($email, $adminEmails)) continue;
                if (!isset($usersMap[$email])) {
                    $usersMap[$email] = [
                        'id' => 'real_' . (count($usersMap) + 1),
                        'name' => explode('@', $p['user_email'])[0],
                        'email' => $p['user_email'],
                        'secondary_email' => null,
                        'role' => 'user',
                        'status' => 'active',
                        'phone' => null,
                        'last_login' => $p['timestamp'] ?? null,
                        'created_at' => $p['timestamp'] ?? ($p['date'] ?? null),
                        'updated_at' => $p['timestamp'] ?? ($p['date'] ?? null),
                        'source' => 'real',
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
            $realUsers = array_values($usersMap);
        }

        // Load secondary emails for real users from user_secondary_emails table
        try {
            $secStmt = $pdo->query("SELECT primary_email, secondary_email FROM user_secondary_emails");
            $secEmails = $secStmt->fetchAll(PDO::FETCH_ASSOC);
            $secMap = [];
            foreach ($secEmails as $se) {
                $secMap[strtolower($se['primary_email'])] = $se['secondary_email'];
            }
            foreach ($realUsers as &$ru) {
                $key = strtolower($ru['email']);
                if (isset($secMap[$key])) {
                    $ru['secondary_email'] = $secMap[$key];
                }
            }
            unset($ru);
        } catch (PDOException $e) {
            // Table may not exist yet, ignore
        }

        $allUsers = array_merge($adminUsers, $realUsers);
        // Sort all users by date descending (newest first)
        usort($allUsers, function($a, $b) {
            $dateA = strtotime($a['created_at'] ?? '') ?: 0;
            $dateB = strtotime($b['created_at'] ?? '') ?: 0;
            return $dateB - $dateA;
        });
        echo json_encode(['success' => true, 'users' => $allUsers, 'total' => count($allUsers)]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al listar: ' . $e->getMessage()]);
    }
}

function usersCreate() {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['name']) || empty($input['email']) || empty($input['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere name, email y password']);
        return;
    }
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $existing = $pdo->prepare("SELECT id FROM admin_users WHERE email = ?");
        $existing->execute([$input['email']]);
        if ($existing->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Ya existe un usuario con ese email']);
            return;
        }
        $stmt = $pdo->prepare("INSERT INTO admin_users (name, email, password_hash, role, status, phone) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['name'],
            $input['email'],
            password_hash($input['password'], PASSWORD_DEFAULT),
            $input['role'] ?? 'user',
            $input['status'] ?? 'active',
            $input['phone'] ?? null
        ]);
        $id = intval($pdo->lastInsertId());
        echo json_encode(['success' => true, 'id' => $id, 'message' => 'Usuario creado']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al crear: ' . $e->getMessage()]);
    }
}

function usersUpdate() {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere id']);
        return;
    }
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $sets = [];
        $params = [];
        $allowed = ['name', 'email', 'role', 'status', 'phone'];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $input)) {
                $sets[] = "$field = ?";
                $params[] = $input[$field];
            }
        }
        if (!empty($input['password'])) {
            $sets[] = "password_hash = ?";
            $params[] = password_hash($input['password'], PASSWORD_DEFAULT);
        }
        if (empty($sets)) {
            http_response_code(400);
            echo json_encode(['error' => 'No hay campos para actualizar']);
            return;
        }
        $params[] = $id;
        $stmt = $pdo->prepare("UPDATE admin_users SET " . implode(', ', $sets) . " WHERE id = ?");
        $stmt->execute($params);
        echo json_encode(['success' => true, 'message' => 'Usuario actualizado']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al actualizar: ' . $e->getMessage()]);
    }
}

function usersUpdateEmail() {
    $input = json_decode(file_get_contents('php://input'), true);
    $oldEmail = trim($input['old_email'] ?? '');
    $newEmail = trim($input['new_email'] ?? '');
    if (!$oldEmail || !$newEmail) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere old_email y new_email']);
        return;
    }
    if (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'El nuevo email no es valido']);
        return;
    }
    $updated = 0;

    // Update in purchases.json
    $purchasesFile = __DIR__ . '/purchases.json';
    if (file_exists($purchasesFile)) {
        $data = json_decode(file_get_contents($purchasesFile), true);
        if ($data && isset($data['purchases'])) {
            foreach ($data['purchases'] as &$p) {
                if (strtolower($p['user_email'] ?? '') === strtolower($oldEmail)) {
                    $p['user_email'] = $newEmail;
                    $updated++;
                }
            }
            unset($p);
            if ($updated > 0) {
                file_put_contents($purchasesFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }
        }
    }

    // Update in quotation_requests.json
    $quotationFile = __DIR__ . '/quotation_requests.json';
    if (file_exists($quotationFile)) {
        $data = json_decode(file_get_contents($quotationFile), true);
        if ($data) {
            $changed = false;
            foreach ($data as &$q) {
                if (strtolower($q['user_email'] ?? '') === strtolower($oldEmail)) {
                    $q['user_email'] = $newEmail;
                    $changed = true;
                    $updated++;
                }
                if (strtolower($q['email'] ?? '') === strtolower($oldEmail)) {
                    $q['email'] = $newEmail;
                    $changed = true;
                }
            }
            unset($q);
            if ($changed) {
                file_put_contents($quotationFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }
        }
    }

    // Update in orders table (expedientes)
    $pdo = getDbConnection();
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("UPDATE orders SET client_email = ? WHERE LOWER(client_email) = LOWER(?)");
            $stmt->execute([$newEmail, $oldEmail]);
            $updated += $stmt->rowCount();
        } catch (PDOException $e) {
            // Non-critical, continue
        }
    }

    // Also update in user_secondary_emails table if the primary email changed
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("UPDATE user_secondary_emails SET primary_email = ? WHERE LOWER(primary_email) = LOWER(?)");
            $stmt->execute([$newEmail, $oldEmail]);
        } catch (PDOException $e) {
            // Table may not exist yet, ignore
        }
    }

    echo json_encode(['success' => true, 'message' => 'Email actualizado en ' . $updated . ' registros', 'records_updated' => $updated]);
}

function usersSetSecondaryEmail() {
    $input = json_decode(file_get_contents('php://input'), true);
    $primaryEmail = trim($input['primary_email'] ?? '');
    $secondaryEmail = trim($input['secondary_email'] ?? '');
    $source = $input['source'] ?? 'real';
    $userId = intval($input['user_id'] ?? 0);

    if (!$primaryEmail) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere primary_email']);
        return;
    }
    if ($secondaryEmail && !filter_var($secondaryEmail, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'El email secundario no es valido']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        // For admin users, update the secondary_email column directly
        if ($source === 'admin' && $userId) {
            try {
                $stmt = $pdo->prepare("UPDATE admin_users SET secondary_email = ? WHERE id = ?");
                $stmt->execute([$secondaryEmail ?: null, $userId]);
            } catch (PDOException $e) {
                // Column may not exist, try migration first
                try {
                    $pdo->exec("ALTER TABLE admin_users ADD COLUMN secondary_email VARCHAR(255) DEFAULT NULL AFTER email");
                    $stmt = $pdo->prepare("UPDATE admin_users SET secondary_email = ? WHERE id = ?");
                    $stmt->execute([$secondaryEmail ?: null, $userId]);
                } catch (PDOException $e2) {
                    // ignore
                }
            }
        }

        // For all users (including admin), also store in user_secondary_emails table
        // This table is used by the email service to look up secondary emails
        // Ensure table exists
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS user_secondary_emails (
                id INT AUTO_INCREMENT PRIMARY KEY,
                primary_email VARCHAR(255) NOT NULL,
                secondary_email VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY idx_primary (primary_email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        if ($secondaryEmail) {
            // Upsert: insert or update
            $stmt = $pdo->prepare("INSERT INTO user_secondary_emails (primary_email, secondary_email) VALUES (?, ?) ON DUPLICATE KEY UPDATE secondary_email = ?, updated_at = NOW()");
            $stmt->execute([$primaryEmail, $secondaryEmail, $secondaryEmail]);
        } else {
            // Remove secondary email
            $stmt = $pdo->prepare("DELETE FROM user_secondary_emails WHERE LOWER(primary_email) = LOWER(?)");
            $stmt->execute([$primaryEmail]);
        }

        echo json_encode(['success' => true, 'message' => 'Email secundario actualizado']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al actualizar email secundario: ' . $e->getMessage()]);
    }
}

function usersGetSecondaryEmail() {
    $email = trim($_GET['email'] ?? '');
    if (!$email) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere email']);
        return;
    }
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $stmt = $pdo->prepare("SELECT secondary_email FROM user_secondary_emails WHERE LOWER(primary_email) = LOWER(?)");
        $stmt->execute([$email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'secondary_email' => $row ? $row['secondary_email'] : null]);
    } catch (PDOException $e) {
        echo json_encode(['success' => true, 'secondary_email' => null]);
    }
}

/**
 * Helper: Make HTTP request to Fly.io backend
 */
function flyApiRequest($baseUrl, $method, $path, $body = null, $token = null) {
    $ch = curl_init($baseUrl . $path);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    $headers = ['Content-Type: application/json'];
    if ($token) $headers[] = 'Authorization: Bearer ' . $token;
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    if ($body) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $resp = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($err) error_log("flyApiRequest error: $method $path - $err");
    return ['code' => $code, 'body' => json_decode($resp, true), 'raw' => $resp];
}

/**
 * Helper: Reset password on a Fly.io backend for a given user email.
 * Returns ['success' => bool, 'temp_password' => string|null, 'error' => string|null]
 */
function resetFlyBackendPassword($flyBaseUrl, $loginPath, $usersListPath, $userEmail, $adminEmail, $adminPass, $newPassword = null, $resetEndpointTemplate = null) {
    // Step 1: Login as admin
    $loginResp = flyApiRequest($flyBaseUrl, 'POST', $loginPath, [
        'email' => $adminEmail,
        'password' => $adminPass
    ]);
    if ($loginResp['code'] !== 200 || !isset($loginResp['body']['access_token'])) {
        return ['success' => false, 'temp_password' => null, 'error' => 'Cannot login to auth service'];
    }
    $adminToken = $loginResp['body']['access_token'];

    // Step 2: Find user by email
    $listResp = flyApiRequest($flyBaseUrl, 'GET', $usersListPath, null, $adminToken);
    $flyUserId = null;
    if ($listResp['code'] === 200) {
        $users = $listResp['body']['users'] ?? $listResp['body'] ?? [];
        if (is_array($users)) {
            foreach ($users as $u) {
                if (isset($u['email']) && strtolower($u['email']) === strtolower($userEmail)) {
                    $flyUserId = $u['id'];
                    break;
                }
            }
        }
    }
    if (!$flyUserId) {
        return ['success' => false, 'temp_password' => null, 'error' => 'User not found on auth service'];
    }

    // Step 3: Try dedicated reset-password endpoint (admin backend has this)
    if ($resetEndpointTemplate && $newPassword) {
        $resetPath = str_replace('{user_id}', $flyUserId, $resetEndpointTemplate);
        $resetResp = flyApiRequest($flyBaseUrl, 'POST', $resetPath, [
            'new_password' => $newPassword
        ], $adminToken);
        if ($resetResp['code'] === 200) {
            return ['success' => true, 'temp_password' => $newPassword, 'error' => null];
        }
    }

    // Step 4: Try reset_password action (user backend uses this)
    $actionResp = flyApiRequest($flyBaseUrl, 'PUT', $usersListPath . '/' . $flyUserId . '/action', [
        'action' => 'reset_password',
        'reason' => 'Admin password reset'
    ], $adminToken);
    if ($actionResp['code'] === 200 && isset($actionResp['body']['message'])) {
        // Extract temp password from response message if available
        $msg = $actionResp['body']['message'];
        if (preg_match('/temporal:\s*(\S+)/', $msg, $m)) {
            $tempPw = $m[1];
        } else {
            $tempPw = 'temp123456'; // Default temp password from Fly backend
        }
        // Ensure user is active (unblock if needed)
        flyApiRequest($flyBaseUrl, 'PUT', $usersListPath . '/' . $flyUserId . '/action', [
            'action' => 'unblock',
            'reason' => 'Password reset - ensure active'
        ], $adminToken);
        return ['success' => true, 'temp_password' => $tempPw, 'error' => null];
    }

    return ['success' => false, 'temp_password' => null, 'error' => 'Failed to reset password on auth service'];
}

function usersSendPasswordReset() {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $email = trim($input['email'] ?? '');

    if (!$id && !$email) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere id o email del usuario']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        // Find user in local database
        if ($id) {
            $stmt = $pdo->prepare("SELECT id, name, email, role FROM admin_users WHERE id = ?");
            $stmt->execute([$id]);
        } else {
            $stmt = $pdo->prepare("SELECT id, name, email, role FROM admin_users WHERE LOWER(email) = LOWER(?)");
            $stmt->execute([$email]);
        }
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuario no encontrado en admin_users']);
            return;
        }

        // Fly.io backend configuration
        $FLY_USER = 'https://app-bxlfgnkv.fly.dev';
        $FLY_ADMIN = 'https://app-hbgmmbqj.fly.dev';
        $FLY_ADMIN_EMAIL = 'admin@imporlan.cl';
        $FLY_ADMIN_PASS = 'admin123';

        // Generate temporary password (12 chars, alphanumeric)
        $chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $tempPassword = '';
        for ($i = 0; $i < 12; $i++) {
            $tempPassword .= $chars[random_int(0, strlen($chars) - 1)];
        }

        $flyResetResults = [];
        $flyTempPassword = null;

        // Reset password on Fly.io admin backend (has dedicated reset-password endpoint)
        $adminResult = resetFlyBackendPassword(
            $FLY_ADMIN,
            '/api/test/auth/login',
            '/api/test/admin/users',
            $user['email'],
            $FLY_ADMIN_EMAIL,
            $FLY_ADMIN_PASS,
            $tempPassword,
            '/api/test/admin/users/{user_id}/reset-password'
        );
        $flyResetResults['admin_backend'] = $adminResult['success'];

        // Reset password on Fly.io user backend (uses reset_password action)
        $userResult = resetFlyBackendPassword(
            $FLY_USER,
            '/api/auth/login-json',
            '/api/admin/users',
            $user['email'],
            $FLY_ADMIN_EMAIL,
            $FLY_ADMIN_PASS,
            $tempPassword,
            null
        );
        $flyResetResults['user_backend'] = $userResult['success'];

        // Determine which password to use in email
        if ($adminResult['success'] && $adminResult['temp_password']) {
            $flyTempPassword = $adminResult['temp_password'];
        }
        if ($userResult['success'] && $userResult['temp_password']) {
            // User backend password takes priority since that's where panel login goes
            $flyTempPassword = $userResult['temp_password'];
        }

        // Use Fly temp password if available, otherwise use our generated one
        $finalPassword = $flyTempPassword ?? $tempPassword;

        // Update password in local admin_users database for consistency
        $stmtUpdate = $pdo->prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?");
        $stmtUpdate->execute([password_hash($finalPassword, PASSWORD_DEFAULT), $user['id']]);

        // Send email with temporary password
        require_once __DIR__ . '/email_service.php';
        $emailService = new EmailService();
        $result = $emailService->sendPasswordResetEmail($user['email'], $user['name'], $finalPassword);

        $responseMsg = 'Contrasena restablecida';
        if ($flyResetResults['user_backend']) {
            $responseMsg .= ' (panel usuario actualizado)';
        }
        if ($result['success']) {
            $responseMsg .= ' y email enviado a ' . $user['email'];
        }

        if ($result['success']) {
            echo json_encode([
                'success' => true,
                'message' => $responseMsg,
                'fly_reset' => $flyResetResults
            ]);
        } else {
            echo json_encode([
                'success' => true,
                'message' => $responseMsg . '. Error email: ' . ($result['error'] ?? 'Error desconocido'),
                'email_error' => true,
                'fly_reset' => $flyResetResults
            ]);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al resetear contrasena: ' . $e->getMessage()]);
    }
}

function usersDelete() {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere id']);
        return;
    }
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $stmt = $pdo->prepare("SELECT email FROM admin_users WHERE id = ?");
        $stmt->execute([$id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuario no encontrado']);
            return;
        }
        if ($user['email'] === 'admin@imporlan.cl') {
            http_response_code(403);
            echo json_encode(['error' => 'No se puede eliminar al administrador principal']);
            return;
        }
        $stmt = $pdo->prepare("DELETE FROM admin_users WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Usuario eliminado']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al eliminar: ' . $e->getMessage()]);
    }
}
