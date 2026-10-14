<?php
/**
 * Recuperacion de contrasena de los clientes — piezas compartidas
 * ===============================================================
 *
 * Hasta ahora el panel del cliente no tenia forma de recuperar la contrasena:
 * el enlace "Olvidaste tu contrasena?" solo mostraba el correo y el WhatsApp
 * de Imporlan. Es decir, cada cliente que olvidaba su clave quedaba fuera
 * hasta que una persona lo atendiera a mano. Esto lo resuelve.
 *
 * Los tokens viven en archivos y no en una tabla a proposito: una migracion
 * que no corre deja el sistema roto en silencio, y eso ya nos paso. Un
 * directorio se crea solo la primera vez que alguien pide un enlace.
 */

// db_config.php no esta en el repositorio (lo crea el hosting), asi que el
// include solo ocurre si el archivo existe. De ese modo los tests pueden
// cargar este archivo sin base de datos; en produccion siempre esta.
if (!function_exists('getDbConnection') && file_exists(__DIR__ . '/db_config.php')) {
    require_once __DIR__ . '/db_config.php';
}

/** Carpeta de los tokens, fuera del alcance de una URL (ver .htaccess). */
function urDirectorioTokens() {
    // UR_DIR_TOKENS solo lo define la bateria de tests, para no escribir en el
    // directorio real mientras se comprueba el vencimiento y los topes.
    $dir = defined('UR_DIR_TOKENS') ? UR_DIR_TOKENS : __DIR__ . '/../.user_reset_tokens';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    $htaccess = $dir . '/.htaccess';
    if (is_dir($dir) && !file_exists($htaccess)) {
        @file_put_contents($htaccess, "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    }
    return is_dir($dir) ? $dir : null;
}

/**
 * Se guarda el sha256 del token, nunca el token. Si alguien llega a leer el
 * directorio, no se lleva nada con lo que entrar: tendria que invertir el hash.
 */
function urRutaToken($token) {
    $dir = urDirectorioTokens();
    return $dir ? $dir . '/' . hash('sha256', $token) . '.json' : null;
}

/**
 * Borra lo vencido. Sin esto el directorio crece para siempre.
 *
 * Tambien barre los `.usando`: son tokens que alguien empezo a canjear y que
 * quedarian tirados si el proceso se muriera entremedio.
 */
function urPodarTokens($horas = 3) {
    $dir = urDirectorioTokens();
    if (!$dir) return;
    foreach (array_merge(glob($dir . '/*.json') ?: [], glob($dir . '/*.usando') ?: []) as $archivo) {
        if (time() - @filemtime($archivo) > $horas * 3600) @unlink($archivo);
    }
}

/**
 * Tope de solicitudes. Dos cuentas distintas: por correo, para que nadie use
 * el formulario para llenarle la bandeja a un cliente; y por IP, para que no
 * se pueda recorrer una lista de correos desde una sola maquina.
 *
 * Cada contador se lee y se escribe con el archivo bloqueado. Sin el bloqueo,
 * varias peticiones a la vez leen el mismo valor, las tres se creen la primera
 * y cada una pisa la marca de las otras: el tope se puede pasar de largo justo
 * cuando alguien lo esta intentando a proposito.
 *
 * Devuelve true si la solicitud se puede atender.
 */
function urPermiteSolicitud($email, $ip) {
    $dir = urDirectorioTokens();
    if (!$dir) return true; // sin disco no se bloquea a nadie

    $limites = [
        ['rl_mail_' . md5(strtolower($email)) . '.json', 3,  3600],
        ['rl_ip_'   . md5($ip) . '.json',                12, 3600],
    ];

    $ahora = time();
    $abiertos = [];   // [recurso, marcas] por archivo, mientras se decide
    $permitido = true;

    foreach ($limites as [$nombre, $maximo, $ventana]) {
        $archivo = $dir . '/' . $nombre;
        $fh = @fopen($archivo, 'c+');
        if (!$fh) continue;             // sin disco no se bloquea a nadie
        if (!flock($fh, LOCK_EX)) { fclose($fh); continue; }

        $contenido = stream_get_contents($fh);
        $marcas = json_decode((string) $contenido, true);
        if (!is_array($marcas)) $marcas = [];
        $marcas = array_values(array_filter($marcas, function ($t) use ($ahora, $ventana) {
            return is_int($t) && ($ahora - $t) < $ventana;
        }));

        if (count($marcas) >= $maximo) {
            $permitido = false;
            flock($fh, LOCK_UN);
            fclose($fh);
            break;
        }

        $marcas[] = $ahora;
        // Los candados siguen puestos hasta saber si se anota o no: soltarlos
        // aqui reabriria la misma carrera que vinimos a cerrar.
        $abiertos[] = [$fh, $marcas];
    }

    // Solo se anota el intento si pasa los dos topes; asi un rechazo por correo
    // no gasta tambien la cuota de la IP.
    foreach ($abiertos as [$fh, $marcas]) {
        if ($permitido) {
            rewind($fh);
            ftruncate($fh, 0);
            fwrite($fh, json_encode($marcas));
            fflush($fh);
        }
        flock($fh, LOCK_UN);
        fclose($fh);
    }

    return $permitido;
}

/**
 * La IP con la que se cuenta el tope. A proposito es REMOTE_ADDR y no
 * X-Forwarded-For: esa cabecera la escribe quien hace la peticion, asi que
 * bastaria con cambiarla en cada intento para estrenar cuota una y otra vez y
 * dejar el tope por IP en nada. REMOTE_ADDR es la unica que no se puede
 * inventar desde fuera.
 */
function urIpCliente() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'desconocida';
}

/**
 * Lo que se guarda en el log. Aqui si valen las cabeceras del proxy, porque
 * para entender un caso raro sirven aunque alguien las haya escrito a mano; lo
 * que no pueden es decidir un tope.
 */
function urIpParaElLog() {
    $partes = [urIpCliente()];
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP'] as $cabecera) {
        if (!empty($_SERVER[$cabecera])) {
            $partes[] = $cabecera . '=' . substr(preg_replace('/\s+/', '', $_SERVER[$cabecera]), 0, 60);
        }
    }
    return implode(' ', $partes);
}

/**
 * Deja rastro de cada solicitud. No es decorado: cuando un cliente avisa que
 * "no le llego nada", esta es la unica forma de saber si pidio el enlace, si
 * su cuenta existe y si el correo salio. El .htaccess de api/ no sirve .log.
 */
function urRegistrar($linea) {
    $dir = __DIR__ . '/logs';
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    @file_put_contents(
        $dir . '/recuperacion_clientes.log',
        date('Y-m-d H:i:s') . '  ' . $linea . "\n",
        FILE_APPEND
    );
}

/*
 * AQUI HABIA UNA FUNCION QUE LIMPIABA EL BLOQUEO POR INTENTOS FALLIDOS
 * -------------------------------------------------------------------
 * La idea era amable: cinco claves erradas dejan la IP bloqueada media hora
 * (imporlan_login_protection, en antispam.php), y quien acaba de demostrar que
 * controla el correo de la cuenta no tiene por que cumplir ese castigo.
 *
 * Pero ese bloqueo NO es por cuenta, es por IP: su clave es md5($ip.'_login')
 * y nada mas. Limpiarlo le soltaba el freno a todas las cuentas que se
 * intentaran desde esa misma IP. Quien controlara el correo de un solo cliente
 * podia gastar sus cinco intentos contra OTRA cuenta, cambiarse su propia
 * clave para borrar el contador, y seguir — cinco intentos cada medio minuto
 * en vez de cada media hora.
 *
 * Asi que no se limpia. Al cliente que venia bloqueado el panel le dice
 * "Demasiados intentos de login. Intenta en N minutos", que al menos es un
 * mensaje claro y con cuenta regresiva. Una espera molesta pero explicada es
 * mejor que un freno de fuerza bruta con un agujero.
 */

/**
 * Busca la cuenta del cliente. Todas las vias de registro escriben aqui, con
 * role 'user' (handleRegister y handleGoogleAuth en auth_local.php).
 *
 * Se devuelve el role para que quien llame pueda negarse: admin_users guarda
 * tambien a los administradores, y este formulario es publico. Sin esa
 * distincion, cualquiera podria disparar el cambio de clave de un administrador
 * escribiendo su correo, y la cuenta del panel vale mucho mas que la de un
 * cliente. Los administradores tienen su propia via, admin_forgot_password.php.
 */
function urBuscarCuenta($pdo, $email) {
    $stmt = $pdo->prepare("SELECT id, name, email, status, role FROM admin_users WHERE LOWER(email) = LOWER(?) LIMIT 1");
    $stmt->execute([trim($email)]);
    $fila = $stmt->fetch(PDO::FETCH_ASSOC);
    return $fila ?: null;
}

/**
 * Entrega la respuesta y cierra la conexion, para seguir trabajando sin que el
 * cliente espere. Devuelve true si realmente se pudo cerrar.
 *
 * Es lo que iguala los tiempos entre una cuenta que existe y una que no: el
 * SMTP tarda cuando el cliente ya se fue.
 */
function urResponderYSeguirEnSegundoPlano($cuerpo) {
    if (urRespuestaYaEnviada()) return true;
    urRespuestaYaEnviada(true);

    // Sin esto, cerrar la conexion puede matar el proceso antes del correo.
    ignore_user_abort(true);

    $json = json_encode($cuerpo);
    header('Content-Length: ' . strlen($json));
    echo $json;

    // PHP-FPM la trae de fabrica; LiteSpeed —que es lo que corre en el
    // hosting— expone la suya con otro nombre.
    foreach (['fastcgi_finish_request', 'litespeed_finish_request'] as $cerrar) {
        if (function_exists($cerrar)) { $cerrar(); return true; }
    }

    // Sin ninguna de las dos no hay forma de cerrar antes de tiempo: se vacian
    // los buffers y el cliente espera igual. Todo lo demas sigue funcionando;
    // lo unico que se pierde es la igualdad de tiempos.
    while (ob_get_level() > 0) @ob_end_flush();
    @flush();
    return false;
}

/** Si ya se contesto, para que el catch del endpoint no escriba encima. */
function urRespuestaYaEnviada($marcar = false) {
    static $enviada = false;
    if ($marcar) $enviada = true;
    return $enviada;
}

/** Las cuentas que este formulario puede atender. */
function urEsCuentaDeCliente($cuenta) {
    return isset($cuenta['role']) && $cuenta['role'] === 'user';
}

/**
 * handleLogin() tambien acepta cuentas de una tabla `users` heredada, que no
 * la crea nada en este repositorio: hoy parece codigo muerto. Si no lo fuera,
 * esos clientes podrian entrar pero no recuperar su clave, y el sintoma seria
 * mudo — "pedi el enlace y no me llego nada".
 *
 * Esto no cambia el comportamiento: solo deja la pista en el log, para que el
 * dia que aparezca el caso se vea en vez de adivinarse. Si alguna vez sale una
 * linea con esta marca, hay que darle soporte de verdad a esa tabla.
 */
function urPistaTablaHeredada($pdo, $email) {
    try {
        if (!$pdo->query("SHOW TABLES LIKE 'users'")->fetch()) return '';
        $stmt = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1");
        $stmt->execute([trim($email)]);
        return $stmt->fetch() ? '  [OJO: existe en la tabla users heredada]' : '';
    } catch (\Throwable $e) {
        return '';
    }
}
