<?php
/**
 * Admin Reset Password Page - Imporlan Admin Panel (TEST)
 * Validates the reset token and allows the admin to set a new password.
 * Updates the hardcoded admin password in the PHP auth files (proxy.php, admin_api.php).
 */

$tokenDir = __DIR__ . '/../.admin_reset_tokens';
$tokenFile = $tokenDir . '/token.json';

// Files that contain the hardcoded admin password and need updating
// From test/api/ we need to reach ../api/test/proxy.php and ../api/admin_api.php
$rootDir = dirname(dirname(__DIR__)); // public_html root
$authFiles = [
    $rootDir . '/api/test/proxy.php',
    $rootDir . '/api/admin_api.php',
];

// Handle POST (password update)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');

    $input = json_decode(file_get_contents('php://input'), true);
    $token = isset($input['token']) ? $input['token'] : '';
    $newPassword = isset($input['new_password']) ? $input['new_password'] : '';

    if (!$token || !$newPassword) {
        http_response_code(400);
        echo json_encode(['error' => 'Token y nueva contrasena son requeridos.']);
        exit();
    }

    if (strlen($newPassword) < 6) {
        http_response_code(400);
        echo json_encode(['error' => 'La contrasena debe tener al menos 6 caracteres.']);
        exit();
    }

    // Validate token
    if (!file_exists($tokenFile)) {
        http_response_code(400);
        echo json_encode(['error' => 'El enlace de recuperacion ha expirado o no es valido.']);
        exit();
    }

    $tokenData = json_decode(file_get_contents($tokenFile), true);
    if (!$tokenData) {
        http_response_code(400);
        echo json_encode(['error' => 'Token invalido.']);
        exit();
    }

    if (time() > $tokenData['expiry']) {
        @unlink($tokenFile);
        http_response_code(400);
        echo json_encode(['error' => 'El enlace de recuperacion ha expirado. Solicita uno nuevo.']);
        exit();
    }

    if (!hash_equals($tokenData['token'], hash('sha256', $token))) {
        http_response_code(400);
        echo json_encode(['error' => 'Token invalido.']);
        exit();
    }

    // Token is valid - update the hardcoded admin password in the PHP auth files
    try {
        $updatedCount = 0;
        $errors = [];

        foreach ($authFiles as $filePath) {
            if (!file_exists($filePath)) {
                continue;
            }

            $content = file_get_contents($filePath);
            if ($content === false) {
                $errors[] = basename($filePath) . ': no se pudo leer';
                continue;
            }

            // Match the line: $adminPassword = 'xxx'; (in proxy.php)
            // or: define('ADMIN_PASSWORD', 'xxx'); (in admin_api.php)
            $escapedPassword = addcslashes($newPassword, "'\\");
            $changed = false;

            // Pattern for proxy.php style: $adminPassword = 'xxx';
            $newContent = preg_replace(
                "/\\\$adminPassword\s*=\s*'[^']*'/",
                "\$adminPassword = '" . $escapedPassword . "'",
                $content,
                -1,
                $count
            );
            if ($count > 0) $changed = true;

            // Pattern for admin_api.php style: define('ADMIN_PASSWORD', 'xxx');
            $newContent = preg_replace(
                "/define\\s*\\(\\s*'ADMIN_PASSWORD'\\s*,\\s*'[^']*'\\s*\\)/",
                "define('ADMIN_PASSWORD', '" . $escapedPassword . "')",
                $newContent,
                -1,
                $count
            );
            if ($count > 0) $changed = true;

            if ($changed) {
                if (file_put_contents($filePath, $newContent) !== false) {
                    $updatedCount++;
                } else {
                    $errors[] = basename($filePath) . ': no se pudo escribir';
                }
            }
        }

        if ($updatedCount === 0 && !empty($errors)) {
            throw new Exception('No se pudo actualizar la contrasena: ' . implode(', ', $errors));
        }

        // Invalidate the token
        @unlink($tokenFile);

        echo json_encode([
            'success' => true,
            'message' => 'Contrasena actualizada exitosamente. Ya puedes iniciar sesion con tu nueva contrasena.'
        ]);
    } catch (Exception $e) {
        error_log("admin_reset_password error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit();
}

// Handle GET (show reset form)
$token = isset($_GET['token']) ? $_GET['token'] : '';
$error = '';
$expired = false;

if (!$token) {
    $error = 'Enlace invalido. No se encontro el token de recuperacion.';
} elseif (!file_exists($tokenFile)) {
    $error = 'El enlace de recuperacion ha expirado o ya fue utilizado.';
    $expired = true;
} else {
    $tokenData = json_decode(file_get_contents($tokenFile), true);
    if (!$tokenData || !hash_equals($tokenData['token'], hash('sha256', $token))) {
        $error = 'El enlace de recuperacion no es valido.';
    } elseif (time() > $tokenData['expiry']) {
        @unlink($tokenFile);
        $error = 'El enlace de recuperacion ha expirado. Solicita uno nuevo.';
        $expired = true;
    }
}

header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Restablecer Contrasena - Imporlan Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 50%, #ede9fe 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            background: #fff;
            border-radius: 16px;
            padding: 40px;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 4px 24px rgba(0,0,0,.08);
        }
        .logo {
            text-align: center;
            margin-bottom: 24px;
        }
        .logo-icon {
            width: 56px;
            height: 56px;
            background: #3b82f6;
            border-radius: 50%;
            margin: 0 auto 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: #fff;
        }
        h1 {
            font-size: 22px;
            color: #1e293b;
            text-align: center;
            margin-bottom: 8px;
        }
        .subtitle {
            font-size: 14px;
            color: #64748b;
            text-align: center;
            margin-bottom: 28px;
            line-height: 1.5;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 600;
            color: #475569;
        }
        .input-wrapper {
            position: relative;
        }
        input[type="password"], input[type="text"] {
            width: 100%;
            padding: 12px 44px 12px 16px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            font-size: 14px;
            outline: none;
            transition: border .2s;
        }
        input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59,130,246,.1);
        }
        .toggle-btn {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            cursor: pointer;
            color: #94a3b8;
            font-size: 18px;
            padding: 4px;
        }
        .toggle-btn:hover { color: #64748b; }
        .submit-btn {
            width: 100%;
            padding: 14px;
            background: #3b82f6;
            color: #fff;
            border: none;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: background .2s;
        }
        .submit-btn:hover { background: #2563eb; }
        .submit-btn:disabled {
            background: #94a3b8;
            cursor: not-allowed;
        }
        .error-box {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 14px 16px;
            border-radius: 10px;
            font-size: 14px;
            text-align: center;
            line-height: 1.5;
        }
        .success-box {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #16a34a;
            padding: 14px 16px;
            border-radius: 10px;
            font-size: 14px;
            text-align: center;
            line-height: 1.5;
        }
        .message-box {
            margin-top: 16px;
            font-size: 14px;
            padding: 12px 16px;
            border-radius: 10px;
            text-align: center;
            display: none;
        }
        .message-box.error {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            display: block;
        }
        .message-box.success {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #16a34a;
            display: block;
        }
        .back-link {
            display: block;
            text-align: center;
            margin-top: 20px;
            color: #3b82f6;
            text-decoration: none;
            font-size: 14px;
        }
        .back-link:hover { text-decoration: underline; }
        .password-rules {
            font-size: 12px;
            color: #94a3b8;
            margin-top: 6px;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">
            <div class="logo-icon">&#128274;</div>
        </div>

        <?php if ($error): ?>
            <h1>Restablecer Contrasena</h1>
            <div style="margin-top:20px" class="error-box">
                <?php echo htmlspecialchars($error); ?>
            </div>
            <?php if ($expired): ?>
                <a href="/panel/admin/" class="back-link">Volver al Admin Panel</a>
            <?php endif; ?>
        <?php else: ?>
            <h1>Nueva Contrasena</h1>
            <p class="subtitle">Ingresa tu nueva contrasena para el Admin Panel de Imporlan.</p>

            <form id="resetForm">
                <div class="form-group">
                    <label>Nueva Contrasena</label>
                    <div class="input-wrapper">
                        <input type="password" id="newPassword" required minlength="6" placeholder="Minimo 6 caracteres" />
                        <button type="button" class="toggle-btn" onclick="togglePass('newPassword', this)">&#128065;</button>
                    </div>
                    <p class="password-rules">Minimo 6 caracteres</p>
                </div>
                <div class="form-group">
                    <label>Confirmar Contrasena</label>
                    <div class="input-wrapper">
                        <input type="password" id="confirmPassword" required minlength="6" placeholder="Repite tu contrasena" />
                        <button type="button" class="toggle-btn" onclick="togglePass('confirmPassword', this)">&#128065;</button>
                    </div>
                </div>
                <button type="submit" class="submit-btn" id="submitBtn">Actualizar Contrasena</button>
            </form>

            <div id="messageBox" class="message-box"></div>
            <a href="/panel/admin/" class="back-link" id="backLink" style="display:none">Ir al Admin Panel</a>
        <?php endif; ?>
    </div>

    <?php if (!$error): ?>
    <script>
        var token = <?php echo json_encode($token); ?>;

        function togglePass(id, btn) {
            var inp = document.getElementById(id);
            if (inp.type === 'password') {
                inp.type = 'text';
                btn.innerHTML = '&#128064;';
            } else {
                inp.type = 'password';
                btn.innerHTML = '&#128065;';
            }
        }

        document.getElementById('resetForm').addEventListener('submit', function(e) {
            e.preventDefault();
            var pw = document.getElementById('newPassword').value;
            var cpw = document.getElementById('confirmPassword').value;
            var msgBox = document.getElementById('messageBox');
            var btn = document.getElementById('submitBtn');

            if (pw !== cpw) {
                msgBox.className = 'message-box error';
                msgBox.textContent = 'Las contrasenas no coinciden.';
                return;
            }
            if (pw.length < 6) {
                msgBox.className = 'message-box error';
                msgBox.textContent = 'La contrasena debe tener al menos 6 caracteres.';
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Actualizando...';
            msgBox.className = 'message-box';
            msgBox.style.display = 'none';

            fetch(window.location.pathname, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, new_password: pw })
            })
            .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
            .then(function(res) {
                if (res.data.success) {
                    msgBox.className = 'message-box success';
                    msgBox.textContent = res.data.message;
                    document.getElementById('resetForm').style.display = 'none';
                    document.getElementById('backLink').style.display = 'block';
                } else {
                    msgBox.className = 'message-box error';
                    msgBox.textContent = res.data.error || 'Error al actualizar la contrasena.';
                    btn.disabled = false;
                    btn.textContent = 'Actualizar Contrasena';
                }
            })
            .catch(function() {
                msgBox.className = 'message-box error';
                msgBox.textContent = 'Error de conexion. Intenta nuevamente.';
                btn.disabled = false;
                btn.textContent = 'Actualizar Contrasena';
            });
        });
    </script>
    <?php endif; ?>
</body>
</html>
