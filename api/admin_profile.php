<?php
/**
 * Admin Profile API - Imporlan Admin Panel
 * Handles profile updates: name, photo, and password changes.
 * Profile data is stored in .admin_profiles/profiles.json
 * Password changes update the hardcoded password in proxy.php and admin_api.php
 */

require_once __DIR__ . '/cors_helper.php';
setCorsHeadersSecure();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/auth_helper.php';

$profileDir = __DIR__ . '/../.admin_profiles';
$profileFile = $profileDir . '/profiles.json';

// requireAdminAuthShared handles 401/403 and exits if unauthorized
$user = requireAdminAuthShared(['admin', 'support', 'agent']);

$userEmail = $user['email'] ?? '';

// Ensure profile directory exists
if (!is_dir($profileDir)) {
    mkdir($profileDir, 0755, true);
    // Protect with .htaccess
    file_put_contents($profileDir . '/.htaccess', "Deny from all\n");
}

// Load existing profiles
function loadProfiles($profileFile) {
    if (file_exists($profileFile)) {
        $data = json_decode(file_get_contents($profileFile), true);
        if (is_array($data)) return $data;
    }
    return [];
}

function saveProfiles($profileFile, $profiles) {
    file_put_contents($profileFile, json_encode($profiles, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// GET - fetch current profile
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $profiles = loadProfiles($profileFile);
    $profile = $profiles[$userEmail] ?? [
        'name' => '',
        'avatar_url' => null
    ];
    echo json_encode([
        'success' => true,
        'profile' => $profile
    ]);
    exit();
}

// POST - update profile
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    // Handle multipart form data (photo upload)
    if (strpos($contentType, 'multipart/form-data') !== false) {
        $action = $_POST['action'] ?? 'update_photo';

        if ($action === 'update_photo' && isset($_FILES['avatar'])) {
            $file = $_FILES['avatar'];
            // MIME real del contenido y extensión derivada de él.
            $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $realMime = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);

            if (!isset($allowed[$realMime])) {
                http_response_code(400);
                echo json_encode(['error' => 'Formato de imagen no valido. Usa JPG, PNG, GIF o WEBP.']);
                exit();
            }

            if ($file['size'] > 5 * 1024 * 1024) {
                http_response_code(400);
                echo json_encode(['error' => 'La imagen no debe superar los 5MB.']);
                exit();
            }

            // Save avatar
            $avatarDir = __DIR__ . '/../.admin_profiles/avatars';
            if (!is_dir($avatarDir)) {
                mkdir($avatarDir, 0755, true);
            }

            $ext = $allowed[$realMime];
            $filename = md5($userEmail) . '_' . time() . '.' . $ext;
            $targetPath = $avatarDir . '/' . $filename;

            // Delete old avatar if exists
            $profiles = loadProfiles($profileFile);
            $oldAvatar = $profiles[$userEmail]['avatar_file'] ?? null;
            if ($oldAvatar && file_exists($avatarDir . '/' . $oldAvatar)) {
                @unlink($avatarDir . '/' . $oldAvatar);
            }

            if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
                http_response_code(500);
                echo json_encode(['error' => 'No se pudo guardar la imagen.']);
                exit();
            }

            // Update profile
            if (!isset($profiles[$userEmail])) {
                $profiles[$userEmail] = ['name' => '', 'avatar_url' => null];
            }
            $profiles[$userEmail]['avatar_file'] = $filename;
            $profiles[$userEmail]['avatar_url'] = '/api/admin_avatar.php?u=' . urlencode($userEmail) . '&t=' . time();
            saveProfiles($profileFile, $profiles);

            echo json_encode([
                'success' => true,
                'message' => 'Foto de perfil actualizada.',
                'avatar_url' => $profiles[$userEmail]['avatar_url']
            ]);
            exit();
        }

        if ($action === 'remove_photo') {
            $profiles = loadProfiles($profileFile);
            $avatarDir = __DIR__ . '/../.admin_profiles/avatars';
            $oldAvatar = $profiles[$userEmail]['avatar_file'] ?? null;
            if ($oldAvatar && file_exists($avatarDir . '/' . $oldAvatar)) {
                @unlink($avatarDir . '/' . $oldAvatar);
            }
            if (isset($profiles[$userEmail])) {
                $profiles[$userEmail]['avatar_file'] = null;
                $profiles[$userEmail]['avatar_url'] = null;
                saveProfiles($profileFile, $profiles);
            }
            echo json_encode(['success' => true, 'message' => 'Foto eliminada.']);
            exit();
        }
    }

    // Handle JSON body
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos invalidos.']);
        exit();
    }

    $action = $input['action'] ?? 'update_profile';

    // Update name
    if ($action === 'update_profile') {
        $newName = trim($input['name'] ?? '');
        if (empty($newName)) {
            http_response_code(400);
            echo json_encode(['error' => 'El nombre no puede estar vacio.']);
            exit();
        }

        $profiles = loadProfiles($profileFile);
        if (!isset($profiles[$userEmail])) {
            $profiles[$userEmail] = ['name' => '', 'avatar_url' => null];
        }
        $profiles[$userEmail]['name'] = $newName;
        saveProfiles($profileFile, $profiles);

        echo json_encode([
            'success' => true,
            'message' => 'Perfil actualizado exitosamente.',
            'name' => $newName
        ]);
        exit();
    }

    // Change password
    if ($action === 'change_password') {
        $currentPassword = $input['current_password'] ?? '';
        $newPassword = $input['new_password'] ?? '';
        $confirmPassword = $input['confirm_password'] ?? '';

        if (empty($currentPassword) || empty($newPassword)) {
            http_response_code(400);
            echo json_encode(['error' => 'Todos los campos son obligatorios.']);
            exit();
        }

        if ($newPassword !== $confirmPassword) {
            http_response_code(400);
            echo json_encode(['error' => 'Las contrasenas no coinciden.']);
            exit();
        }

        if (strlen($newPassword) < 8) {
            http_response_code(400);
            echo json_encode(['error' => 'La contrasena debe tener al menos 8 caracteres.']);
            exit();
        }

        // Cuentas del equipo creadas en Usuarios (tabla admin_users): se
        // verifica y se actualiza el hash. Antes se comparaba contra
        // contraseñas leídas con regex de archivos PHP que ya no las tienen,
        // así que siempre respondía "contraseña actual incorrecta".
        require_once __DIR__ . '/db_config.php';
        require_once __DIR__ . '/credentials.php';
        $pdo = getDbConnection();
        $row = null;
        $isMainAccount = in_array(strtolower($userEmail), [strtolower(IMPORLAN_ADMIN_EMAIL), strtolower(IMPORLAN_SUPPORT_EMAIL)], true);
        if ($pdo && !$isMainAccount) {
            $st = $pdo->prepare("SELECT id, password_hash FROM admin_users WHERE email = ?");
            $st->execute([$userEmail]);
            $row = $st->fetch(PDO::FETCH_ASSOC);
        }

        if (!$row) {
            // Cuentas principales (definidas en la configuración del servidor):
            // su contraseña no se guarda en la base; se cambia con el enlace de
            // recuperación, que la escribe en la configuración de forma segura.
            http_response_code(400);
            echo json_encode(['error' => 'La contrasena de esta cuenta principal se cambia desde "Olvide mi contrasena" en la pantalla de ingreso.']);
            exit();
        }

        if (!password_verify($currentPassword, $row['password_hash'])) {
            http_response_code(400);
            echo json_encode(['error' => 'La contrasena actual es incorrecta.']);
            exit();
        }

        $upd = $pdo->prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?");
        $upd->execute([password_hash($newPassword, PASSWORD_DEFAULT), $row['id']]);
        echo json_encode(['success' => true, 'message' => 'Contrasena actualizada correctamente.']);
        exit();
    }

    // Remove photo via JSON
    if ($action === 'remove_photo') {
        $profiles = loadProfiles($profileFile);
        $avatarDir = __DIR__ . '/../.admin_profiles/avatars';
        $oldAvatar = $profiles[$userEmail]['avatar_file'] ?? null;
        if ($oldAvatar && file_exists($avatarDir . '/' . $oldAvatar)) {
            @unlink($avatarDir . '/' . $oldAvatar);
        }
        if (isset($profiles[$userEmail])) {
            $profiles[$userEmail]['avatar_file'] = null;
            $profiles[$userEmail]['avatar_url'] = null;
            saveProfiles($profileFile, $profiles);
        }
        echo json_encode(['success' => true, 'message' => 'Foto eliminada.']);
        exit();
    }

    http_response_code(400);
    echo json_encode(['error' => 'Accion no valida.']);
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Metodo no permitido.']);
