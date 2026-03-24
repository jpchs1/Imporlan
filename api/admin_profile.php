<?php
/**
 * Admin Profile API - Imporlan Admin Panel
 * Handles profile updates: name, photo, and password changes.
 * Profile data is stored in .admin_profiles/profiles.json
 * Password changes update the hardcoded password in proxy.php and admin_api.php
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
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
            $allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

            if (!in_array($file['type'], $allowed)) {
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

            $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
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

        if (strlen($newPassword) < 6) {
            http_response_code(400);
            echo json_encode(['error' => 'La contrasena debe tener al menos 6 caracteres.']);
            exit();
        }

        // Verify current password against the hardcoded ones
        $proxyFile = __DIR__ . '/test/proxy.php';
        $adminApiFile = __DIR__ . '/admin_api.php';
        $currentAdminPassword = null;

        // Read current password from proxy.php
        if (file_exists($proxyFile)) {
            $content = file_get_contents($proxyFile);
            if (preg_match("/\\\$adminPassword\s*=\s*'([^']*)'/", $content, $m)) {
                $currentAdminPassword = $m[1];
            }
        }

        // Also check admin_api.php
        if (!$currentAdminPassword && file_exists($adminApiFile)) {
            $content = file_get_contents($adminApiFile);
            if (preg_match("/define\s*\(\s*'ADMIN_PASSWORD'\s*,\s*'([^']*)'\s*\)/", $content, $m)) {
                $currentAdminPassword = $m[1];
            }
        }

        // For non-admin users (support, agent), check their specific passwords
        $userRole = $user['role'] ?? '';
        if ($userEmail === 'soporte@imporlan.cl') {
            if (file_exists($proxyFile)) {
                $content = file_get_contents($proxyFile);
                if (preg_match("/\\\$supportPassword\s*=\s*'([^']*)'/", $content, $m)) {
                    $currentAdminPassword = $m[1];
                }
            }
        }

        if ($currentPassword !== $currentAdminPassword) {
            http_response_code(400);
            echo json_encode(['error' => 'La contrasena actual es incorrecta.']);
            exit();
        }

        // Update password in auth files using preg_replace_callback
        $authFiles = [
            $proxyFile,
            $adminApiFile
        ];

        $escapedPassword = addcslashes($newPassword, "'\\");
        $updatedCount = 0;
        $errors = [];

        // Determine which pattern to match based on user
        $isMainAdmin = ($userEmail === 'admin@imporlan.cl');

        foreach ($authFiles as $filePath) {
            if (!file_exists($filePath)) continue;

            $content = file_get_contents($filePath);
            if ($content === false) {
                $errors[] = basename($filePath) . ': no se pudo leer';
                continue;
            }

            $changed = false;

            if ($isMainAdmin) {
                // Update $adminPassword in proxy.php
                $newContent = preg_replace_callback(
                    "/\\\$adminPassword\s*=\s*'[^']*'/",
                    function() use ($escapedPassword) {
                        return "\$adminPassword = '" . $escapedPassword . "'";
                    },
                    $content,
                    -1,
                    $count
                );
                if ($count > 0) $changed = true;

                // Update ADMIN_PASSWORD in admin_api.php
                $newContent = preg_replace_callback(
                    "/define\s*\(\s*'ADMIN_PASSWORD'\s*,\s*'[^']*'\s*\)/",
                    function() use ($escapedPassword) {
                        return "define('ADMIN_PASSWORD', '" . $escapedPassword . "')";
                    },
                    $newContent,
                    -1,
                    $count
                );
                if ($count > 0) $changed = true;
            } else if ($userEmail === 'soporte@imporlan.cl') {
                // Update $supportPassword in proxy.php
                $newContent = preg_replace_callback(
                    "/\\\$supportPassword\s*=\s*'[^']*'/",
                    function() use ($escapedPassword) {
                        return "\$supportPassword = '" . $escapedPassword . "'";
                    },
                    $content,
                    -1,
                    $count
                );
                if ($count > 0) $changed = true;

                // Update SUPPORT_PASSWORD in admin_api.php
                $newContent = preg_replace_callback(
                    "/define\s*\(\s*'SUPPORT_PASSWORD'\s*,\s*'[^']*'\s*\)/",
                    function() use ($escapedPassword) {
                        return "define('SUPPORT_PASSWORD', '" . $escapedPassword . "')";
                    },
                    $newContent,
                    -1,
                    $count
                );
                if ($count > 0) $changed = true;
            }

            if ($changed) {
                if (file_put_contents($filePath, $newContent) !== false) {
                    $updatedCount++;
                } else {
                    $errors[] = basename($filePath) . ': no se pudo escribir';
                }
            }
        }

        if ($updatedCount === 0) {
            if (!empty($errors)) {
                http_response_code(500);
                echo json_encode(['error' => 'No se pudo actualizar la contrasena: ' . implode(', ', $errors)]);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'No se encontraron los archivos de autenticacion para actualizar.']);
            }
            exit();
        }

        echo json_encode([
            'success' => true,
            'message' => 'Contrasena actualizada exitosamente.'
        ]);
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
