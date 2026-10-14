<?php
/**
 * Ningun codigo lee lo que trae un token sin haber comprobado antes su firma.
 *
 * test/api/chat_api.php (espejo vivo en produccion, con la base de datos de
 * produccion) tenia en handlePoll un "respaldo": si la firma no cuadraba,
 * decodificaba el token igual y lo aceptaba con tal de que no estuviera
 * vencido. Con eso cualquiera armaba un token a mano y leia los chats de los
 * clientes. En /api ya estaba arreglado; la copia se quedo atras.
 *
 * La regla que se cobra: en cada funcion de api/ y test/api/ que decodifica
 * algo en base64 y lo pasa por json_decode, tiene que haber un hash_equals()
 * antes. No se busca por nombre de archivo ni de funcion: el hueco aparecio
 * justamente en una funcion que no era "la que verifica".
 *
 * Uso: php test/jwt-firma-tests.php
 */

$raiz = dirname(__DIR__);
$fallos = 0;
$total = 0;

if (($argv[1] ?? '') === '--google') {
    exit(probarGoogle($argv[2]));
}

function ok($cond, $msg) {
    global $fallos, $total;
    $total++;
    if ($cond) {
        echo "  ok  $msg\n";
    } else {
        $fallos++;
        echo "  FALLA  $msg\n";
    }
}

/**
 * Devuelve [nombreFuncion => cuerpo] de un archivo PHP, usando el tokenizer
 * para no confundirse con llaves dentro de strings.
 */
function funcionesDe($codigo) {
    $tokens = token_get_all($codigo);
    $out = [];
    $n = count($tokens);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($tokens[$i]) || $tokens[$i][0] !== T_FUNCTION) continue;
        $nombre = '{closure}';
        for ($j = $i + 1; $j < $n; $j++) {
            if (is_array($tokens[$j]) && $tokens[$j][0] === T_STRING) { $nombre = $tokens[$j][1]; break; }
            if ($tokens[$j] === '(') break;
        }
        // Buscar la llave que abre el cuerpo (las funciones abstractas no tienen)
        $k = $i + 1;
        while ($k < $n && $tokens[$k] !== '{' && $tokens[$k] !== ';') $k++;
        if ($k >= $n || $tokens[$k] === ';') continue;
        $prof = 0;
        $cuerpo = '';
        for (; $k < $n; $k++) {
            $t = $tokens[$k];
            $txt = is_array($t) ? $t[1] : $t;
            if ($t === '{' || (is_array($t) && in_array($t[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], true))) $prof++;
            if ($t === '}') $prof--;
            $cuerpo .= $txt;
            if ($prof === 0) break;
        }
        $clave = $nombre;
        $s = 2;
        while (isset($out[$clave])) $clave = $nombre . '#' . $s++;
        $out[$clave] = $cuerpo;
    }
    return $out;
}

/**
 * Posiciones de json_decode(...) cuyo argumento pasa por base64. Se excluye la
 * cabecera de un JWT: hay que leerla antes de verificar para saber con que
 * llave (kid) se firmo, y no trae nada de quien es el usuario.
 */
function decodificacionesBase64($cuerpo) {
    $pos = [];
    if (preg_match_all('/json_decode\s*\(\s*(?:base64UrlDecode|authBase64UrlDecode|base64_decode|base64url_decode)\s*\(([^;]*)/i', $cuerpo, $m, PREG_OFFSET_CAPTURE)) {
        foreach ($m[0] as $i => $x) {
            if (stripos($m[1][$i][0], 'header') !== false) continue;
            $pos[] = $x[1];
        }
    }
    return $pos;
}

/** Lo que cuenta como verificar la firma: HMAC (hash_equals) o RSA (openssl_verify). */
function verificaAntes($texto) {
    return stripos($texto, 'hash_equals(') !== false || stripos($texto, 'openssl_verify(') !== false;
}

/** El codigo sin comentarios (para que un comentario que explica no cuente). */
function sinComentarios($codigo) {
    $out = '';
    foreach (token_get_all("<?php " . $codigo) as $t) {
        if (is_array($t) && in_array($t[0], [T_COMMENT, T_DOC_COMMENT], true)) continue;
        $out .= is_array($t) ? $t[1] : $t;
    }
    return $out;
}

/** Lista de problemas: funciones que decodifican sin hash_equals antes. */
function decodificaSinFirma($codigo) {
    $malas = [];
    foreach (funcionesDe($codigo) as $nombre => $cuerpo) {
        foreach (decodificacionesBase64($cuerpo) as $p) {
            if (!verificaAntes(substr($cuerpo, 0, $p))) {
                $malas[] = $nombre;
                break;
            }
        }
    }
    return $malas;
}

// Funciones que decodifican base64 + JSON y NO son tokens: estado propio,
// cursores, etc. Si aparece una nueva aqui, que sea una decision consciente.
$noSonTokens = [];

echo "Canario: el detector reconoce el hueco que habia\n";
$viejo = <<<'PHP'
<?php
function handlePoll() {
    $payload = verifyJWT($token);
    if (!$payload) {
        $parts = explode('.', $token);
        if (count($parts) === 3) {
            $tokenPayload = json_decode(base64UrlDecode($parts[1]), true);
            if ($tokenPayload && $tokenPayload['exp'] > time()) $payload = $tokenPayload;
        }
    }
}
function verifyJWT($token) {
    $parts = explode('.', $token);
    list($h, $p, $s) = $parts;
    $esperada = base64UrlEncode(hash_hmac('sha256', "$h.$p", JWT_SECRET, true));
    if (!hash_equals($esperada, $s)) return null;
    return json_decode(base64UrlDecode($p), true);
}
PHP;
$d = decodificaSinFirma($viejo);
ok($d === ['handlePoll'], 'marca handlePoll viejo y deja pasar verifyJWT (detecto: ' . implode(', ', $d) . ')');
$alReves = "<?php function v(\$t){ \$x = json_decode(base64_decode(\$t), true); if (!hash_equals('a','b')) return null; return \$x; }";
ok(decodificaSinFirma($alReves) === ['v'], 'hash_equals despues de decodificar no cuenta');
$googleViejo = <<<'PHP'
<?php
function verifyGoogleIdToken($t) {
    [$h, $p, $s] = explode('.', $t);
    $header = json_decode(base64_decode(strtr($h, '-_', '+/')), true);
    $payload = json_decode(base64_decode(strtr($p, '-_', '+/')), true);
    if (!$certs) return $payload;
    return openssl_verify("$h.$p", $s, $k, OPENSSL_ALGO_SHA256) === 1 ? $payload : null;
}
PHP;
ok(decodificaSinFirma($googleViejo) === ['verifyGoogleIdToken'], 'marca el login con Google viejo (leia el token antes de verificar)');

echo "\napi/ y test/api/: nadie lee un token sin verificar la firma\n";
$archivos = [];
foreach (['api', 'test/api'] as $dir) {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("$raiz/$dir", FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) {
        if ($f->isFile() && substr($f->getFilename(), -4) === '.php') $archivos[] = $f->getPathname();
    }
}
sort($archivos);
ok(count($archivos) > 50, 'se revisan ' . count($archivos) . ' archivos PHP');
$revisadas = 0;
foreach ($archivos as $ruta) {
    $rel = substr($ruta, strlen($raiz) + 1);
    $codigo = file_get_contents($ruta);
    foreach (funcionesDe($codigo) as $cuerpo) {
        if (decodificacionesBase64($cuerpo)) $revisadas++;
    }
    foreach (decodificaSinFirma($codigo) as $fn) {
        if (in_array("$rel::$fn", $noSonTokens, true)) continue;
        ok(false, "$rel::$fn decodifica base64+JSON sin verificar la firma antes");
    }
}
ok($revisadas >= 10, "$revisadas funciones decodifican base64+JSON y todas verifican antes");

echo "\nLos dos handlePoll quedan iguales en lo que importa\n";
foreach (['api/chat_api.php', 'test/api/chat_api.php'] as $rel) {
    $fns = funcionesDe(file_get_contents("$raiz/$rel"));
    $hp = $fns['handlePoll'] ?? '';
    ok($hp !== '', "$rel tiene handlePoll");
    ok(strpos($hp, 'verifyJWT(') !== false, "$rel: handlePoll usa verifyJWT");
    ok(stripos(sinComentarios($hp), 'base64') === false, "$rel: handlePoll no decodifica el token por su cuenta");
    ok(strpos($hp, "'2fa_pending'") !== false, "$rel: handlePoll rechaza el token temporal de 2FA");
}

echo "\nLogin con Google: firma real, contra las dos copias\n";
if (!function_exists('openssl_pkey_new')) {
    ok(false, 'falta la extension openssl para probar el login con Google');
} else {
    foreach (['api/auth_local.php', 'test/api/auth_local.php'] as $rel) {
        $salida = [];
        exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' --google ' . escapeshellarg("$raiz/$rel") . ' 2>&1', $salida, $rc);
        foreach ($salida as $l) echo "    $l\n";
        ok($rc === 0, "$rel: el login con Google solo acepta tokens firmados por Google para esta app");
    }
}

echo "\n" . ($total - $fallos) . "/$total ok\n";
exit($fallos ? 1 : 0);

/**
 * Corre en un proceso aparte (las dos copias definen las mismas funciones).
 * Saca del archivo el bloque del login con Google, lo carga, firma tokens con
 * una llave RSA de prueba y deja esa llave en el cache como si fuera de Google.
 */
function probarGoogle($archivo) {
    $codigo = file_get_contents($archivo);
    $ini = strpos($codigo, 'const IMPORLAN_GOOGLE_CLIENT_ID');
    $fin = strpos($codigo, 'function handleGoogleAuth');
    if ($ini === false || $fin === false || $fin < $ini) {
        echo "no encontre el bloque del login con Google\n";
        return 1;
    }
    $dir = sys_get_temp_dir() . '/imporlan-google-' . getmypid();
    @mkdir($dir);
    $bloque = substr($codigo, $ini, $fin - $ini);
    // Google "no responde": las llaves se piden a un puerto cerrado. Asi el
    // caso sin llaves no depende de la red de quien corre el test.
    $bloque = str_replace("'https://www.googleapis.com/oauth2/v3/certs'", "'http://127.0.0.1:9/certs'", $bloque, $n);
    if ($n !== 1) {
        echo "no encontre la URL de las llaves de Google\n";
        return 1;
    }
    file_put_contents("$dir/google.php", "<?php\n" . $bloque);
    require "$dir/google.php";
    $cache = sys_get_temp_dir() . '/google_certs_' . md5($dir) . '.json';

    $b64 = function ($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); };
    $llave = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    $det = openssl_pkey_get_details($llave);
    file_put_contents($cache, json_encode(['keys' => [[
        'kid' => 'prueba', 'kty' => 'RSA', 'alg' => 'RS256',
        'n' => $b64($det['rsa']['n']), 'e' => $b64($det['rsa']['e']),
    ]]]));

    $firmar = function (array $p, array $h = []) use ($b64, $llave) {
        $h = $h + ['alg' => 'RS256', 'kid' => 'prueba', 'typ' => 'JWT'];
        $datos = $b64(json_encode($h)) . '.' . $b64(json_encode($p));
        openssl_sign($datos, $sig, $llave, OPENSSL_ALGO_SHA256);
        return "$datos." . $b64($sig);
    };
    $base = [
        'iss' => 'https://accounts.google.com',
        'aud' => IMPORLAN_GOOGLE_CLIENT_ID,
        'exp' => time() + 600,
        'email' => 'cliente@example.com',
        'email_verified' => true,
    ];

    $casos = [];
    $casos[] = ['token valido', $firmar($base), true];
    $falso = explode('.', $firmar($base));
    $falso[1] = $b64(json_encode(['email' => 'admin@imporlan.cl'] + $base));
    $casos[] = ['contenido cambiado despues de firmar', implode('.', $falso), false];
    $casos[] = ['sin firma', $falso[0] . '.' . $falso[1] . '.', false];
    $casos[] = ['emitido para otra app (aud)', $firmar(['aud' => 'otra-app.apps.googleusercontent.com'] + $base), false];
    $casos[] = ['sin aud', $firmar(array_diff_key($base, ['aud' => 1])), false];
    $casos[] = ['otro emisor', $firmar(['iss' => 'https://evil.example'] + $base), false];
    $casos[] = ['vencido', $firmar(['exp' => time() - 10] + $base), false];
    $casos[] = ['alg none', $firmar($base, ['alg' => 'none']), false];
    $casos[] = ['alg HS256', $firmar($base, ['alg' => 'HS256']), false];
    $casos[] = ['basura', 'a.b.c', false];

    $malos = 0;
    foreach ($casos as [$nombre, $token, $debe]) {
        $r = verifyGoogleIdToken($token);
        $bien = $debe ? (is_array($r) && $r['email'] === 'cliente@example.com') : $r === null;
        if (!$bien) $malos++;
        echo ($bien ? 'ok    ' : 'FALLA ') . $nombre . ($debe ? ' -> se acepta' : ' -> se rechaza') . "\n";
    }

    // Sin llaves de Google (cache vacio y Google sin responder): se rechaza. Antes se aceptaba "con validacion
    // basica", o sea sin verificar la firma.
    file_put_contents($cache, '{}');
    $sinLlaves = verifyGoogleIdToken($firmar($base, ['kid' => 'no-existe']));
    if ($sinLlaves !== null) $malos++;
    echo ($sinLlaves === null ? 'ok    ' : 'FALLA ') . "sin la llave de Google -> se rechaza\n";

    @unlink($cache);
    @unlink("$dir/google.php");
    @rmdir($dir);
    return $malos ? 1 : 0;
}
