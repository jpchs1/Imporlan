<?php
/**
 * Ninguna ruta de cliente decide de quien son los datos con lo que manda el
 * navegador.
 *
 * Como se filtraron los expedientes (#690): orders_api.php?action=user_list
 * tomaba user_email de la URL y, sin sesion, devolvia los expedientes de
 * cualquier cliente. El espejo /test/api/purchases.php (vivo en produccion,
 * con la base real) hacia lo mismo con las compras, y ademas tenia abiertas
 * las acciones del equipo. email.php mandaba correos "de Imporlan" a quien
 * fuera, user_products.php leia productos de cualquier user_id.
 *
 * La regla que se cobra, en cada archivo de api/ y test/api/:
 *
 *   Si una funcion (o el codigo principal) lee user_email / email / user_id /
 *   customer_email de $_GET, $_POST, $_REQUEST o del cuerpo JSON —tambien
 *   cuando ese cuerpo le llega como parametro—, ANTES tiene que haber pasado
 *   por requireUserAuthShared / requireAdminAuth* / requireUserAuth /
 *   requireAuth (o verificado el token a mano), ya sea en la misma funcion o
 *   en quien la llama. Dentro de un switch, lo que autentica un `case` no
 *   cubre a los demas.
 *
 *   Las excepciones (webhooks y pasarelas de pago, login, registro,
 *   recuperacion de contrasena, formularios publicos) van en $EXCEPCIONES,
 *   una por una y con su razon. Una excepcion que ya no hace falta tambien
 *   falla, para que la lista no se quede con huecos "por si acaso".
 *
 * El analisis es estatico (sin red ni base de datos) y se prueba primero
 * contra el codigo viejo (canario): tiene que verlo.
 *
 * Limite conocido: una llamada de auth que esta antes en el texto cubre lo
 * que viene despues, salvo entre `case` distintos de un switch. Un
 * `if ($accion === 'x') { requireAdminAuth(); ... exit(); }` seguido de
 * codigo publico se da por cubierto. Se prefiere eso a seguir el flujo de
 * control de verdad; el patron de la API es "auth arriba, switch abajo".
 *
 * Uso: php test/acceso-api-tests.php
 */

$raiz = dirname(__DIR__);
$fallos = 0;
$total = 0;

function ok($cond, $msg) {
    global $fallos, $total;
    $total++;
    echo ($cond ? '  ok  ' : '  FALLA  ') . $msg . "\n";
    if (!$cond) $fallos++;
}

// ---------------------------------------------------------------------------
// Excepciones legitimas: archivo => [alcance => razon]. '(principal)' es el
// codigo fuera de funciones. Cada entrada tiene que seguir produciendo un
// hallazgo; si deja de hacerlo, se borra de aqui.
// ---------------------------------------------------------------------------
$EXCEPCIONES = [
    // Pasarelas de pago: el comprador no siempre tiene sesion (cotizador
    // publico). Lo que se guarda como compra sale de lo que confirma el
    // proveedor (captura de PayPal, commit de WebPay, webhook de Mercado
    // Pago), y user_email solo etiqueta el recibo.
    'api/paypal.php' => [
        'captureOrder' => 'pasarela de pago: la captura la valida PayPal; user_email solo etiqueta la compra',
    ],
    'test/api/paypal.php' => [
        'captureOrder' => 'espejo de api/paypal.php',
    ],
    'api/webpay.php' => [
        'createTransaction' => 'pasarela de pago: inicia la transaccion que Transbank confirma en el callback',
    ],
    'test/api/webpay.php' => [
        'createTransaction' => 'espejo de api/webpay.php',
    ],
    // Login, registro y recuperacion de contrasena: por definicion no hay
    // sesion todavia. El correo identifica a quien intenta entrar, no a quien
    // se le muestran datos.
    'api/auth_local.php' => [
        'handleLogin' => 'login',
        'handleRegister' => 'registro de clientes',
    ],
    'test/api/auth_local.php' => [
        'handleLogin' => 'espejo: login',
        'handleRegister' => 'espejo: registro de clientes',
    ],
    'api/admin_api.php' => [
        'handleLogin' => 'login del panel admin',
    ],
    'test/api/admin_api.php' => [
        'handleLogin' => 'espejo: login del panel admin',
    ],
    'api/test/proxy.php' => [
        '(principal)' => 'login local del proxy de /api/test/',
    ],
    'api/register-hook.php' => [
        '(principal)' => 'alta de cuenta al registrarse (lo invoca index.php)',
    ],
    'api/register-proxy.php' => [
        '(principal)' => 'registro de clientes',
    ],
    'test/api/register-proxy.php' => [
        '(principal)' => 'espejo: registro de clientes',
    ],
    'api/user_forgot_password.php' => [
        '(principal)' => 'recuperacion de contrasena de clientes (responde igual exista o no la cuenta)',
    ],
    'api/admin_forgot_password.php' => [
        '(principal)' => 'recuperacion de contrasena del equipo',
    ],
    'test/api/admin_forgot_password.php' => [
        '(principal)' => 'espejo: recuperacion de contrasena del equipo',
    ],
    // Formularios publicos: el correo es el del remitente, para contestarle.
    'api/support_api.php' => [
        '(principal)' => 'formulario publico de soporte/contacto',
    ],
    'test/api/support_api.php' => [
        '(principal)' => 'espejo: formulario publico de soporte',
    ],
    // api/inspection_api.php (formulario publico de inspeccion) no aparece:
    // su rama admin_list autentica antes, y para el analisis eso cubre el
    // resto del archivo (ver "Limite conocido" arriba).
    'api/marketplace_api.php' => [
        'handleLeadSubmission' => 'formulario publico de contacto con el vendedor de una publicacion',
    ],
    'test/api/marketplace_api.php' => [
        'handleLeadSubmission' => 'espejo: formulario publico de contacto con el vendedor',
    ],
];

// ---------------------------------------------------------------------------
// Analisis estatico
// ---------------------------------------------------------------------------

const CLAVES_IDENTIDAD = ['user_email', 'email', 'user_id', 'customer_email'];
const RE_AUTH = '/\b(requireUserAuthShared|requireAdminAuthShared|requireAdminAuth|requireUserAuth|requireAuth|getUserToken|verifyJWT\w*)\s*\(/';
const PALABRAS_NO_LLAMADA = ['if', 'elseif', 'while', 'for', 'foreach', 'switch', 'isset', 'empty', 'array', 'list', 'function', 'fn', 'return', 'echo', 'print', 'unset', 'catch', 'match', 'exit', 'die', 'require', 'require_once', 'include', 'include_once', 'declare', 'and', 'or', 'new', 'clone', 'use'];

/**
 * Separa un archivo PHP en alcances: '(principal)' y una entrada por funcion
 * de primer nivel. Los comentarios se quitan (conservando los saltos de
 * linea) y los cuerpos de clases se omiten: sus metodos no son rutas.
 *
 * Devuelve [nombre => ['texto' => ..., 'linea' => lineaInicial, 'params' => [...]]]
 */
function alcancesDe($codigo) {
    $tokens = token_get_all($codigo);
    $n = count($tokens);
    $texto = function ($t) {
        if (!is_array($t)) return $t;
        if ($t[0] === T_COMMENT || $t[0] === T_DOC_COMMENT) return str_repeat("\n", substr_count($t[1], "\n"));
        return $t[1];
    };
    $lineaDe = function ($i) use ($tokens) {
        for ($j = $i; $j >= 0; $j--) if (is_array($tokens[$j])) return $tokens[$j][2];
        return 1;
    };

    $out = ['(principal)' => ['texto' => '', 'linea' => 1, 'params' => []]];
    $prof = 0;
    for ($i = 0; $i < $n; $i++) {
        $t = $tokens[$i];
        $esAbre = ($t === '{' || (is_array($t) && in_array($t[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true)));
        $esCierra = ($t === '}');

        // Clase/interfaz/trait de primer nivel: saltar hasta su llave de cierre.
        if ($prof === 0 && is_array($t) && in_array($t[0], [T_CLASS, T_INTERFACE, T_TRAIT], true)
            && !(isset($tokens[$i - 2]) && is_array($tokens[$i - 2]) && $tokens[$i - 2][0] === T_NEW)
            && !(isset($tokens[$i - 1]) && is_array($tokens[$i - 1]) && $tokens[$i - 1][0] === T_DOUBLE_COLON)) {
            $k = $i;
            while ($k < $n && $tokens[$k] !== '{') $k++;
            $p = 0;
            for (; $k < $n; $k++) {
                $tk = $tokens[$k];
                if ($tk === '{' || (is_array($tk) && in_array($tk[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) $p++;
                if ($tk === '}') $p--;
                $out['(principal)']['texto'] .= str_repeat("\n", substr_count($texto($tk), "\n"));
                if ($p === 0) break;
            }
            $i = $k;
            continue;
        }

        // Funcion con nombre, de primer nivel.
        if ($prof === 0 && is_array($t) && $t[0] === T_FUNCTION) {
            $nombre = null;
            $j = $i + 1;
            while ($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) $j++;
            if ($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_STRING) $nombre = $tokens[$j][1];
            if ($nombre !== null) {
                $firma = '';
                $k = $j + 1;
                while ($k < $n && $tokens[$k] !== '{' && $tokens[$k] !== ';') { $firma .= $texto($tokens[$k]); $k++; }
                if ($k >= $n || $tokens[$k] === ';') { $i = $k; continue; }
                $params = [];
                if (preg_match('/\((.*)\)/s', $firma, $m)) {
                    foreach (explode(',', $m[1]) as $p) {
                        if (preg_match('/(\$\w+)/', $p, $pm)) $params[] = $pm[1];
                    }
                }
                $cuerpo = '';
                $p = 0;
                $lineaIni = $lineaDe($k);
                for (; $k < $n; $k++) {
                    $tk = $tokens[$k];
                    if ($tk === '{' || (is_array($tk) && in_array($tk[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) $p++;
                    if ($tk === '}') $p--;
                    $cuerpo .= $texto($tk);
                    if ($p === 0) break;
                }
                $clave = $nombre;
                $s = 2;
                while (isset($out[$clave])) $clave = $nombre . '#' . $s++;
                $out[$clave] = ['texto' => $cuerpo, 'linea' => $lineaIni, 'params' => $params];
                // El principal conserva los saltos de linea para no perder la cuenta.
                $out['(principal)']['texto'] .= str_repeat("\n", substr_count($firma . $cuerpo, "\n"));
                $i = $k;
                continue;
            }
        }

        if ($esAbre) $prof++;
        if ($esCierra) $prof--;
        $out['(principal)']['texto'] .= $texto($t);
    }
    return $out;
}

/** Llamadas a funciones de usuario: [[nombre, offset, [args]], ...]. */
function llamadasEn($texto) {
    $out = [];
    if (!preg_match_all('/(?<![\w$>:\\\\])([A-Za-z_]\w*)\s*\(/', $texto, $m, PREG_OFFSET_CAPTURE)) return $out;
    foreach ($m[1] as $idx => $nm) {
        $nombre = $nm[0];
        if (in_array(strtolower($nombre), PALABRAS_NO_LLAMADA, true)) continue;
        $ini = $m[0][$idx][1] + strlen($m[0][$idx][0]); // justo despues del '('
        $args = [];
        $prof = 1;
        $actual = '';
        for ($i = $ini, $L = strlen($texto); $i < $L; $i++) {
            $c = $texto[$i];
            if ($c === '(' || $c === '[') $prof++;
            if ($c === ')' || $c === ']') { $prof--; if ($prof === 0) break; }
            if ($c === ',' && $prof === 1) { $args[] = trim($actual); $actual = ''; continue; }
            $actual .= $c;
        }
        if (trim($actual) !== '') $args[] = trim($actual);
        $out[] = [$nombre, $nm[1], $args];
    }
    return $out;
}

/** Offset de la etiqueta `case`/`default` mas cercana antes de $offset, o -1. */
function bloqueCaseDe(array $cases, $offset) {
    $b = -1;
    foreach ($cases as $c) { if ($c < $offset) $b = $c; else break; }
    return $b;
}

/**
 * Hay autenticacion que cubre lo que pasa en $offset: una llamada de auth
 * antes, y que no este encerrada en OTRO `case` del switch.
 */
function cubierto(array $alcance, $offset) {
    if ($alcance['protegido']) return true;
    $bloque = bloqueCaseDe($alcance['cases'], $offset);
    foreach ($alcance['auth'] as $a) {
        if ($a >= $offset) continue;
        $ba = bloqueCaseDe($alcance['cases'], $a);
        if ($ba === -1 || $ba === $bloque) return true;
    }
    return false;
}

/**
 * Analiza un archivo. Devuelve los hallazgos: [[alcance, linea, fragmento]].
 */
function hallazgosDe($codigo) {
    $alcances = alcancesDe($codigo);
    foreach ($alcances as $nombre => &$a) {
        $a['nombre'] = $nombre;
        $a['contaminadas'] = ['$_GET' => true, '$_POST' => true, '$_REQUEST' => true];
        $a['llamadas'] = llamadasEn($a['texto']);
        $a['auth'] = [];
        if (preg_match_all(RE_AUTH, $a['texto'], $m, PREG_OFFSET_CAPTURE)) {
            foreach ($m[0] as $x) $a['auth'][] = $x[1];
        }
        $a['cases'] = [];
        if (preg_match_all('/(?<![\w$>])(case\s+[^:\n]+?|default)\s*:(?!:)/', $a['texto'], $m, PREG_OFFSET_CAPTURE)) {
            foreach ($m[0] as $x) $a['cases'][] = $x[1];
        }
        $a['protegido'] = false;
        $a['sitios'] = []; // [[alcanceLlamador, offset]]
    }
    unset($a);

    // Sitios de llamada de cada funcion.
    foreach ($alcances as $nombre => $a) {
        foreach ($a['llamadas'] as [$fn, $off, $args]) {
            if (isset($alcances[$fn]) && $fn !== '(principal)') $alcances[$fn]['sitios'][] = [$nombre, $off, $args];
        }
    }

    // Contaminacion (taint) hasta punto fijo: cuerpo JSON, alias y parametros
    // que reciben una variable contaminada en algun sitio de llamada.
    for ($ronda = 0; $ronda < 10; $ronda++) {
        $cambio = false;
        foreach ($alcances as $nombre => &$a) {
            $t = $a['texto'];
            if (preg_match_all('/(\$\w+)\s*=\s*json_decode\s*\(\s*file_get_contents\s*\(\s*[\'"]php:\/\/input/', $t, $m)) {
                foreach ($m[1] as $v) if (!isset($a['contaminadas'][$v])) { $a['contaminadas'][$v] = true; $cambio = true; }
            }
            if (preg_match_all('/(\$\w+)\s*=\s*(\$\w+)\s*(?:;|\?\?)/', $t, $m)) {
                foreach ($m[1] as $i => $v) {
                    if (isset($a['contaminadas'][$m[2][$i]]) && !isset($a['contaminadas'][$v])) { $a['contaminadas'][$v] = true; $cambio = true; }
                }
            }
            foreach ($a['sitios'] as [$llamador, $off, $args]) {
                foreach ($args as $i => $arg) {
                    if (!isset($a['params'][$i])) continue;
                    if (preg_match('/^(\$\w+)$/', $arg, $am) && isset($alcances[$llamador]['contaminadas'][$am[1]])) {
                        $p = $a['params'][$i];
                        if (!isset($a['contaminadas'][$p])) { $a['contaminadas'][$p] = true; $cambio = true; }
                    }
                }
            }
        }
        unset($a);
        if (!$cambio) break;
    }

    // Funciones protegidas desde el inicio: todos sus sitios de llamada estan
    // cubiertos. Punto fijo porque el llamador puede ser otra funcion.
    for ($ronda = 0; $ronda < 10; $ronda++) {
        $cambio = false;
        foreach ($alcances as $nombre => &$a) {
            if ($nombre === '(principal)' || $a['protegido'] || !$a['sitios']) continue;
            $todos = true;
            foreach ($a['sitios'] as [$llamador, $off]) {
                if (!cubierto($alcances[$llamador], $off)) { $todos = false; break; }
            }
            if ($todos) { $a['protegido'] = true; $cambio = true; }
        }
        unset($a);
        if (!$cambio) break;
    }

    // Lecturas de identidad sin cubrir.
    $hallazgos = [];
    $claves = implode('|', CLAVES_IDENTIDAD);
    foreach ($alcances as $nombre => $a) {
        if (!preg_match_all('/(\$\w+)\s*\[\s*[\'"](' . $claves . ')[\'"]\s*\]/', $a['texto'], $m, PREG_OFFSET_CAPTURE)) continue;
        foreach ($m[0] as $i => $x) {
            $var = $m[1][$i][0];
            if (!isset($a['contaminadas'][$var])) continue;
            $off = $x[1];
            if (cubierto($a, $off)) continue;
            $linea = $a['linea'] + substr_count($a['texto'], "\n", 0, $off);
            $hallazgos[] = [$nombre, $linea, $x[0]];
            break; // uno por alcance basta
        }
    }
    return $hallazgos;
}

function nombresDe(array $hallazgos) {
    return array_values(array_unique(array_map(function ($h) { return $h[0]; }, $hallazgos)));
}

// ---------------------------------------------------------------------------
// Canario: el codigo viejo tiene que caer.
// ---------------------------------------------------------------------------
echo "Canario\n";

// orders_api.php antes de #690: user_list sin sesion, correo de la URL.
$viejoOrders = <<<'PHP'
<?php
$action = $_GET['action'] ?? '';
switch ($action) {
    case 'user_list':
        userListOrders();
        break;
    case 'admin_list':
        requireAdminAuth();
        adminListOrders();
        break;
}
function userListOrders($authPayload = null) {
    // Use email from verified JWT token, not from untrusted GET parameter
    $userEmail = $authPayload['email'] ?? $_GET['user_email'] ?? '';
    $userId = $authPayload['sub'] ?? $_GET['user_id'] ?? '';
}
function adminListOrders() {
    $filtro = $_GET['email'] ?? '';
}
PHP;
$h = hallazgosDe($viejoOrders);
ok(nombresDe($h) === ['userListOrders'], 'orders_api viejo: ve user_list (correo de la URL sin sesion) y no toca admin_list: ' . json_encode(nombresDe($h)));

// test/api/purchases.php como estaba: sin ninguna autenticacion.
$viejoPurchases = <<<'PHP'
<?php
$action = $_GET['action'] ?? '';
switch ($action) {
    case 'get':
        getPurchases();
        break;
    case 'all':
        getAllPurchases();
        break;
}
function getPurchases() {
    global $purchasesFile;
    $userEmail = $_GET['user_email'] ?? null;
    if (!$userEmail) { return; }
}
function getAllPurchases() { echo '[]'; }
PHP;
ok(nombresDe(hallazgosDe($viejoPurchases)) === ['getPurchases'], 'test/api/purchases.php viejo: get sin sesion');

// email.php como estaba: el cuerpo llega como parametro.
$viejoEmail = <<<'PHP'
<?php
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);
switch ($action) {
    case 'send_welcome_email':
        sendWelcomeEmail($input);
        break;
}
function sendWelcomeEmail($data) {
    $userEmail = isset($data['user_email']) ? $data['user_email'] : '';
}
PHP;
ok(nombresDe(hallazgosDe($viejoEmail)) === ['sendWelcomeEmail'], 'email.php viejo: el cuerpo contaminado pasa por parametro');

// user_products.php como estaba: user_id de la peticion en el principal.
$viejoProductos = <<<'PHP'
<?php
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$userId = $input['user_id'] ?? $_GET['user_id'] ?? null;
PHP;
ok(nombresDe(hallazgosDe($viejoProductos)) === ['(principal)'], 'user_products.php viejo: user_id sin sesion en el principal');

// La autenticacion de un case no cubre a otro.
$casesCruzados = <<<'PHP'
<?php
switch ($_GET['action'] ?? '') {
    case 'a':
        requireAdminAuthShared();
        listarTodo();
        break;
    case 'b':
        verUno();
        break;
}
function listarTodo() { $f = $_GET['email'] ?? ''; }
function verUno() { $e = $_GET['email'] ?? ''; }
PHP;
ok(nombresDe(hallazgosDe($casesCruzados)) === ['verUno'], 'lo que autentica un case no cubre a los demas');

// Lo arreglado pasa: sesion primero, el correo se contrasta con el token.
$nuevo = <<<'PHP'
<?php
$action = $_GET['action'] ?? '';
if ($action === 'get') {
    $auth = requireUserAuthShared();
    $emailCliente = correoClienteDesdeSesion($auth, $_GET['user_email'] ?? null);
} elseif ($action !== '') {
    requireAdminAuthShared(['admin', 'support']);
}
switch ($action) {
    case 'get':
        getPurchases($emailCliente);
        break;
    case 'add':
        addPurchase();
        break;
}
function getPurchases($userEmail) { echo $userEmail; }
function addPurchase() {
    $input = json_decode(file_get_contents('php://input'), true);
    $correo = $input['user_email'];
}
PHP;
ok(hallazgosDe($nuevo) === [], 'lo arreglado pasa (sesion antes del switch, correo del token)');

$protegidaPorLlamador = <<<'PHP'
<?php
function adminCreateRequest() {
    $admin = requireAdminAuthShared();
    $input = json_decode(file_get_contents('php://input'), true);
    $errores = validar($input);
}
function validar($input) {
    return empty($input['user_email']) ? ['falta'] : [];
}
adminCreateRequest();
PHP;
ok(hallazgosDe($protegidaPorLlamador) === [], 'una funcion auxiliar queda cubierta si todos sus llamadores autenticaron antes');

// ---------------------------------------------------------------------------
// Lo real: api/ y test/api/.
// ---------------------------------------------------------------------------
echo "\napi/ y test/api/\n";

$archivos = [];
foreach (['api', 'test/api'] as $dir) {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("$raiz/$dir", FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) {
        if (substr($f->getFilename(), -4) !== '.php') continue;
        $archivos[] = substr($f->getPathname(), strlen($raiz) + 1);
    }
}
sort($archivos);
ok(count($archivos) > 40, 'se encontraron ' . count($archivos) . ' archivos PHP');

$usadas = [];
$malos = [];
foreach ($archivos as $rel) {
    $codigo = file_get_contents("$raiz/$rel");
    foreach (hallazgosDe($codigo) as [$alcance, $linea, $fragmento]) {
        if (isset($EXCEPCIONES[$rel][$alcance])) {
            $usadas[$rel][$alcance] = true;
            continue;
        }
        $malos[] = "$rel:$linea  $alcance  lee $fragmento sin sesion antes";
    }
}
ok($malos === [], 'ninguna ruta de cliente lee la identidad de la peticion sin sesion' . ($malos ? "\n      - " . implode("\n      - ", $malos) : ''));

$sobran = [];
foreach ($EXCEPCIONES as $rel => $alcances) {
    foreach ($alcances as $alcance => $razon) {
        if (!file_exists("$raiz/$rel")) { $sobran[] = "$rel (ya no existe)"; continue; }
        if (empty($usadas[$rel][$alcance])) $sobran[] = "$rel $alcance";
    }
}
ok($sobran === [], 'todas las excepciones siguen haciendo falta' . ($sobran ? "\n      - " . implode("\n      - ", $sobran) : ''));

// Las rutas de cliente que filtran por correo pasan por el mismo embudo.
$conEmbudo = ['api/notifications_api.php', 'api/inspection_reports_api.php', 'api/reports_api.php', 'api/purchases.php', 'api/payment_requests_api.php', 'api/email.php', 'test/api/purchases.php', 'test/api/email.php'];
foreach ($conEmbudo as $rel) {
    ok(strpos(file_get_contents("$raiz/$rel"), 'correoClienteDesdeSesion(') !== false, "$rel toma el correo del cliente con correoClienteDesdeSesion()");
}
ok(strpos(file_get_contents("$raiz/api/auth_helper.php"), 'function correoClienteDesdeSesion(') !== false, 'correoClienteDesdeSesion() vive en api/auth_helper.php');

// Lo que se retiro del espejo no vuelve a cambiar contrasenas sin sesion.
foreach (['test/api/change_password.php', 'test/api/forgot_password.php'] as $rel) {
    $c = file_get_contents("$raiz/$rel");
    ok(strpos($c, 'http_response_code(410)') !== false && strpos($c, 'curl_init') === false, "$rel esta retirado (410, sin backend)");
}

// Nadie toma la identidad de cabeceras que pone el navegador.
$conCabecera = [];
foreach ($archivos as $rel) {
    $c = file_get_contents("$raiz/$rel");
    if (preg_match('/\$headers\s*\[\s*[\'"][Xx]-[Uu]ser-[Ee]mail[\'"]\s*\]/', $c)) $conCabecera[] = $rel;
}
ok($conCabecera === [], 'ninguna ruta lee X-User-Email como identidad' . ($conCabecera ? ': ' . implode(', ', $conCabecera) : ''));

echo "\n$total pruebas, $fallos fallos\n";
exit($fallos === 0 ? 0 : 1);
