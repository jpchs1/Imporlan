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
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida. Use: migrate, list, create, update, delete']);
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
        $stmt = $pdo->query("SELECT id, name, email, role, status, phone, last_login, created_at, updated_at FROM admin_users ORDER BY id ASC");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'users' => $users, 'total' => count($users)]);
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
