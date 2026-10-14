<?php
/**
 * Nada sale antes de las cabeceras.
 *
 * /home/wwimpo/smtp_config.php (fuera del repo, lo edita el servidor) imprimia
 * un salto de linea. Como email_service.php lo carga al principio, todo lo que
 * manda correos —chat, marketplace, PayPal, MercadoPago, Webpay— respondia
 * con ese salto antes de las cabeceras:
 *   - los 401 llegaban como 200, y el panel no se enteraba de que la sesion
 *     se habia cerrado;
 *   - header('Location') ya no tenia efecto: Webpay no devolvia al cliente al
 *     panel despues de pagar o de cancelar (verificado en vivo: 200 sin
 *     Location).
 *
 * Lo que se cobra:
 *   1. Todo archivo de configuracion de /home/wwimpo/ se carga entre
 *      ob_start() y ob_end_clean(): lo que imprima se bota.
 *   2. Ningun PHP de api/ ni test/api/ tiene algo antes de <?php ni espacios
 *      sueltos despues del cierre de PHP del final (test/api/email.php tenia
 *      uno).
 *
 * Uso: php test/salida-limpia-tests.php
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

/** Cargas de configuracion del servidor que no estan envueltas. */
function cargasSinEnvolver($codigo) {
    $malas = [];
    $lineas = explode("\n", $codigo);
    // Variables que apuntan a /home/wwimpo/*.php
    preg_match_all("~(\\\$\\w+)\\s*=\\s*'/home/wwimpo/[^']+\\.php'~", $codigo, $m);
    $vars = array_unique($m[1]);
    foreach ($lineas as $i => $l) {
        $esCarga = preg_match("~^\\s*(require|include)(_once)?\\s*\\(?\\s*'/home/wwimpo/~", $l);
        foreach ($vars as $v) {
            if (preg_match('~^\s*(require|include)(_once)?\s*\(?\s*' . preg_quote($v, '~') . '\s*\)?\s*;~', $l)) $esCarga = true;
        }
        if (!$esCarga) continue;
        $antes = trim($lineas[$i - 1] ?? '');
        $despues = trim($lineas[$i + 1] ?? '');
        if ($antes !== 'ob_start();' || $despues !== 'ob_end_clean();') $malas[] = $i + 1;
    }
    return $malas;
}

echo "Canario\n";
$viejo = "<?php\n\$smtpConfigFile = '/home/wwimpo/smtp_config.php';\nif (file_exists(\$smtpConfigFile)) {\n    require_once \$smtpConfigFile;\n}\n";
ok(cargasSinEnvolver($viejo) === [4], 'marca la carga de smtp_config.php como estaba');
$nuevo = "<?php\n\$f = '/home/wwimpo/x.php';\nif (file_exists(\$f)) {\n    ob_start();\n    require_once \$f;\n    ob_end_clean();\n}\n";
ok(cargasSinEnvolver($nuevo) === [], 'deja pasar la carga envuelta');

echo "\nLas configuraciones del servidor se cargan sin dejar salir nada\n";
$archivos = [];
foreach (['api', 'test/api'] as $dir) {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("$raiz/$dir", FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) {
        if ($f->isFile() && substr($f->getFilename(), -4) === '.php') $archivos[] = $f->getPathname();
    }
}
sort($archivos);
$cargas = 0;
foreach ($archivos as $ruta) {
    $rel = substr($ruta, strlen($raiz) + 1);
    $codigo = file_get_contents($ruta);
    if (strpos($codigo, '/home/wwimpo/') === false) continue;
    foreach (cargasSinEnvolver($codigo) as $linea) {
        ok(false, "$rel:$linea carga una configuracion del servidor sin ob_start()/ob_end_clean()");
    }
    $cargas += substr_count($codigo, "ob_start();\n") ? 1 : 0;
}
ok($cargas >= 7, "$cargas archivos cargan configuracion del servidor, todos envueltos");
foreach (['api/email_service.php', 'test/api/email_service.php', 'api/webpay.php', 'api/credentials.php'] as $rel) {
    ok(cargasSinEnvolver(file_get_contents("$raiz/$rel")) === [] && strpos(file_get_contents("$raiz/$rel"), 'ob_end_clean();') !== false,
        "$rel envuelve su configuracion");
}

echo "\nNingun PHP imprime algo fuera de <?php ... ?>\n";
$sucios = [];
foreach ($archivos as $ruta) {
    $c = file_get_contents($ruta);
    $rel = substr($ruta, strlen($raiz) + 1);
    if (strncmp($c, '<?php', 5) !== 0) { $sucios[] = "$rel (algo antes de <?php)"; continue; }
    // Tras el ultimo token: si es un cierre de PHP, lo que sigue sale tal cual.
    $tokens = token_get_all($c);
    $ultimo = end($tokens);
    // Solo espacios sueltos: las paginas de recuperar contrasena terminan en
    // </body></html> a proposito.
    if (is_array($ultimo) && $ultimo[0] === T_INLINE_HTML && trim($ultimo[1]) === '') {
        $sucios[] = "$rel (texto despues del cierre de PHP: " . json_encode($ultimo[1]) . ")";
    }
}
ok($sucios === [], count($archivos) . ' archivos limpios' . ($sucios ? ': ' . implode(', ', $sucios) : ''));

echo "\n" . ($total - $fallos) . "/$total ok\n";
exit($fallos ? 1 : 0);
