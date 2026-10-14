<?php
/**
 * Pagina donde el cliente escribe su contrasena nueva
 * ===================================================
 *
 * Se llega aqui por el enlace del correo que manda user_forgot_password.php.
 * GET muestra el formulario, POST graba la clave.
 */

require_once __DIR__ . '/user_recovery_common.php';

/** Lee el token del enlace y devuelve [datos, mensajeDeError, vencido]. */
function urValidarToken($token) {
    if (!$token || !preg_match('/^[a-f0-9]{64}$/', $token)) {
        return [null, 'El enlace no es valido. Pide uno nuevo desde el panel.', false];
    }
    $ruta = urRutaToken($token);
    if (!$ruta || !file_exists($ruta)) {
        return [null, 'Este enlace ya se uso o vencio. Pide uno nuevo desde el panel.', true];
    }
    $datos = json_decode((string) @file_get_contents($ruta), true);
    if (!is_array($datos) || empty($datos['email'])) {
        return [null, 'El enlace no es valido. Pide uno nuevo desde el panel.', false];
    }
    if (time() > intval($datos['expiry'] ?? 0)) {
        @unlink($ruta);
        return [null, 'El enlace vencio (dura una hora). Pide uno nuevo desde el panel.', true];
    }
    return [$datos, '', false];
}

// ---------------------------------------------------------------- POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');

    $input = json_decode(file_get_contents('php://input'), true);
    $token = isset($input['token']) ? trim((string) $input['token']) : '';
    $nueva = isset($input['new_password']) ? (string) $input['new_password'] : '';

    if (strlen($nueva) < 8) {
        http_response_code(400);
        echo json_encode(['error' => 'La contrasena debe tener al menos 8 caracteres.']);
        exit();
    }

    [$datos, $error] = urValidarToken($token);
    if (!$datos) {
        http_response_code(400);
        echo json_encode(['error' => $error]);
        exit();
    }

    try {
        $pdo = getDbConnection();
        if (!$pdo) throw new Exception('sin conexion a la base de datos');

        $cuenta = urBuscarCuenta($pdo, $datos['email']);
        if (!$cuenta) {
            @unlink(urRutaToken($token));
            http_response_code(400);
            echo json_encode(['error' => 'La cuenta ya no existe. Escribenos a contacto@imporlan.cl.']);
            exit();
        }

        $pdo->prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?")
            ->execute([password_hash($nueva, PASSWORD_DEFAULT), $cuenta['id']]);

        // El enlace sirve una sola vez. Y se tiran tambien los otros enlaces
        // vivos del mismo correo: si alguien pidio tres, los tres dejan de
        // servir en cuanto uno se usa.
        @unlink(urRutaToken($token));
        $dir = urDirectorioTokens();
        foreach (glob(($dir ?: '') . '/*.json') ?: [] as $archivo) {
            $otro = json_decode((string) @file_get_contents($archivo), true);
            if (is_array($otro) && isset($otro['email'])
                && strcasecmp($otro['email'], $cuenta['email']) === 0) {
                @unlink($archivo);
            }
        }

        // Los intentos fallidos de hace un rato dejaron su IP bloqueada media
        // hora. Sin esto, cambia la clave y el panel le sigue diciendo
        // "demasiados intentos".
        urLimpiarBloqueoLogin(urIpCliente());

        urRegistrar("contrasena cambiada  {$cuenta['email']}  ip=" . urIpCliente());

        if ($cuenta['status'] !== 'active') {
            // Se dice la verdad en vez de dejarlo chocar contra un
            // "credenciales invalidas" que no explica nada: con la cuenta
            // desactivada el login falla aunque la clave sea correcta.
            urRegistrar("cuenta no activa tras el cambio  {$cuenta['email']}  estado={$cuenta['status']}");
            echo json_encode([
                'success' => true,
                'message' => 'Tu contrasena quedo guardada, pero tu cuenta figura como "' . $cuenta['status'] . '" '
                           . 'y por eso todavia no podras entrar. Escribenos a contacto@imporlan.cl y la reactivamos.',
            ]);
            exit();
        }

        echo json_encode([
            'success' => true,
            'message' => 'Listo. Ya puedes entrar a tu panel con tu contrasena nueva.',
        ]);
    } catch (Exception $e) {
        error_log('user_reset_password: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'No pudimos guardar la contrasena. Intenta de nuevo o escribenos a contacto@imporlan.cl.']);
    }
    exit();
}

// ----------------------------------------------------------------- GET
$token = isset($_GET['token']) ? trim((string) $_GET['token']) : '';
[$datos, $error] = urValidarToken($token);
$correo = $datos['email'] ?? '';

header('Content-Type: text/html; charset=UTF-8');
header('X-Robots-Tag: noindex, nofollow');
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Nueva contrasena &middot; Imporlan</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
       background:linear-gradient(135deg,#0f172a 0%,#0e2a3d 50%,#0f172a 100%);
       min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:rgba(255,255,255,.07);backdrop-filter:blur(16px);
        border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:36px;
        width:100%;max-width:420px;box-shadow:0 20px 50px rgba(0,0,0,.35)}
  .logo{width:56px;height:56px;margin:0 auto 16px;border-radius:18px;
        background:linear-gradient(135deg,#06b6d4,#0e7490);display:flex;
        align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:700}
  h1{font-size:20px;color:#fff;text-align:center;margin-bottom:8px}
  .sub{font-size:14px;color:#94a3b8;text-align:center;margin-bottom:26px;line-height:1.55}
  .sub b{color:#cbd5e1;font-weight:600}
  label{display:block;margin-bottom:6px;font-size:11px;font-weight:700;color:#94a3b8;
        text-transform:uppercase;letter-spacing:.06em}
  .group{margin-bottom:18px;position:relative}
  input{width:100%;padding:13px 46px 13px 16px;border:1px solid rgba(255,255,255,.12);
        border-radius:12px;font-size:14px;outline:none;background:rgba(255,255,255,.06);
        color:#fff;transition:border .15s,box-shadow .15s}
  input::placeholder{color:#64748b}
  input:focus{border-color:rgba(34,211,238,.5);box-shadow:0 0 0 3px rgba(34,211,238,.12)}
  .ojo{position:absolute;right:12px;top:30px;background:none;border:none;cursor:pointer;
       font-size:17px;padding:4px;opacity:.6}
  .ojo:hover{opacity:1}
  .hint{font-size:11px;color:#64748b;margin-top:6px}
  button.enviar{width:100%;padding:14px;background:linear-gradient(90deg,#0891b2,#06b6d4);
        color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer}
  button.enviar:hover{filter:brightness(1.08)}
  button.enviar:disabled{opacity:.55;cursor:not-allowed}
  .caja{padding:14px 16px;border-radius:12px;font-size:14px;text-align:center;line-height:1.55}
  .mal{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);color:#fca5a5}
  .bien{background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.25);color:#6ee7b7}
  #aviso{margin-top:16px;display:none}
  a.volver{display:block;text-align:center;margin-top:20px;color:#22d3ee;
           text-decoration:none;font-size:14px}
  a.volver:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="card">
  <div class="logo">I</div>
<?php if ($error): ?>
  <h1>Nueva contrasena</h1>
  <div class="caja mal" style="margin-top:18px"><?php echo htmlspecialchars($error); ?></div>
  <a class="volver" href="https://www.imporlan.cl/panel/">Volver al panel</a>
<?php else: ?>
  <h1>Nueva contrasena</h1>
  <p class="sub">Elige la contrasena con la que entraras a tu panel.<br><b><?php echo htmlspecialchars($correo); ?></b></p>

  <form id="f">
    <div class="group">
      <label>Nueva contrasena</label>
      <input type="password" id="p1" required minlength="8" placeholder="Minimo 8 caracteres" autocomplete="new-password">
      <button type="button" class="ojo" onclick="ver('p1',this)">&#128065;</button>
      <p class="hint">Minimo 8 caracteres</p>
    </div>
    <div class="group">
      <label>Repitela</label>
      <input type="password" id="p2" required minlength="8" placeholder="La misma de arriba" autocomplete="new-password">
      <button type="button" class="ojo" onclick="ver('p2',this)">&#128065;</button>
    </div>
    <button type="submit" class="enviar" id="b">Guardar contrasena</button>
  </form>

  <div id="aviso" class="caja"></div>
  <a class="volver" href="https://www.imporlan.cl/panel/" id="ir" style="display:none">Ir a mi panel</a>
<?php endif; ?>
</div>

<?php if (!$error): ?>
<script>
var token = <?php echo json_encode($token); ?>;

function ver(id, btn){
  var i = document.getElementById(id);
  i.type = i.type === 'password' ? 'text' : 'password';
  btn.innerHTML = i.type === 'password' ? '&#128065;' : '&#128064;';
}

/* El display va en linea porque el estilo en linea inicial (display:none)
   le gana al display de la clase. */
function avisar(clase, texto){
  var a = document.getElementById('aviso');
  a.className = 'caja' + (clase ? ' ' + clase : '');
  a.textContent = texto;
  a.style.display = texto ? 'block' : 'none';
}

document.getElementById('f').addEventListener('submit', function(e){
  e.preventDefault();
  var p1 = document.getElementById('p1').value;
  var p2 = document.getElementById('p2').value;
  var b  = document.getElementById('b');

  if (p1 !== p2)   { avisar('mal', 'Las dos contrasenas no son iguales.'); return; }
  if (p1.length < 8){ avisar('mal', 'La contrasena debe tener al menos 8 caracteres.'); return; }

  b.disabled = true; b.textContent = 'Guardando...';
  avisar('', '');

  fetch(window.location.pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token, new_password: p1 })
  })
  .then(function(r){
    return r.json()
      .catch(function(){ return { error: 'Respuesta invalida del servidor (HTTP ' + r.status + ').' }; })
      .then(function(d){ return { status: r.status, data: d }; });
  })
  .then(function(res){
    if (res.data.success) {
      avisar('bien', res.data.message);
      document.getElementById('f').style.display = 'none';
      document.getElementById('ir').style.display = 'block';
    } else {
      /* Se muestra el detalle del servidor: sin esto un 500 se ve igual que
         "no pasa nada". */
      avisar('mal', res.data.error || ('No se pudo guardar (HTTP ' + res.status + ').'));
      b.disabled = false; b.textContent = 'Guardar contrasena';
    }
  })
  .catch(function(err){
    avisar('mal', 'Error de conexion: ' + ((err && err.message) || 'intenta de nuevo') + '.');
    b.disabled = false; b.textContent = 'Guardar contrasena';
  });
});
</script>
<?php endif; ?>
</body>
</html>
