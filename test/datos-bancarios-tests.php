<?php
/**
 * Datos para transferir: Global66 (CLP y USD), no Santander.
 *
 * JP, 21-oct-2026: «los del Santander son reemplazados por estos de Global 66
 * en CLP y USD». Un cliente que copia una cuenta vieja transfiere a una
 * cuenta que ya no se usa, asi que se cobra en CI:
 *   1. Ningun archivo que se publica tiene la cuenta, la cuenta USD ni el
 *      SWIFT de Santander.
 *   2. Las paginas donde se paga muestran las cuentas nuevas.
 *
 * Uso: php test/datos-bancarios-tests.php
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

$VIEJOS = ['74233813', '5100369305', 'BSCHCLRM', 'Banco Santander'];

/** Archivos fuente (no los bundles con hash, que se regeneran con el build). */
function fuentes($raiz) {
    $out = [];
    foreach (['admin-react/src', 'api', 'pago', 'assets', 'panel/assets', 'panel-test/assets'] as $dir) {
        if (!is_dir("$raiz/$dir")) continue;
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("$raiz/$dir", FilesystemIterator::SKIP_DOTS));
        foreach ($it as $f) {
            if (!$f->isFile()) continue;
            $n = $f->getFilename();
            if (!preg_match('/\.(php|html|js|jsx)$/', $n)) continue;
            if (preg_match('/-[A-Za-z0-9_-]{8}\.js$/', $n)) continue; // bundle de Vite
            $out[] = $f->getPathname();
        }
    }
    return $out;
}

echo "Canario\n";
ok(preg_match('/-[A-Za-z0-9_-]{8}\.js$/', 'index-Cr-o_Lu8.js') === 1, 'reconoce un bundle de Vite');
ok(preg_match('/-[A-Za-z0-9_-]{8}\.js$/', 'payment-requests-user.js') === 0, 'no confunde un archivo a mano con un bundle');

echo "\nNinguna fuente tiene la cuenta de Santander\n";
$sucios = [];
$archivos = fuentes($raiz);
foreach ($archivos as $ruta) {
    $c = file_get_contents($ruta);
    foreach ($VIEJOS as $v) {
        if ($v === 'Banco Santander' && substr($ruta, -8) === 'banco.js') continue; // el comentario de historia
        if (strpos($c, $v) !== false) $sucios[] = substr($ruta, strlen($raiz) + 1) . " ($v)";
    }
}
ok(count($archivos) > 100, count($archivos) . ' archivos revisados');
ok($sucios === [], 'sin datos de Santander' . ($sucios ? ': ' . implode(', ', $sucios) : ''));

echo "\nLas cuentas nuevas estan donde se paga\n";
$banco = file_get_contents("$raiz/admin-react/src/shared/lib/banco.js");
$pago = file_get_contents("$raiz/pago/index.html");
$diy = file_get_contents("$raiz/assets/importa-tu-mismo-checkout.js");
foreach (['11678410', '8336089772', '026073150', 'CMFGUS33', 'Community Federal Savings Bank'] as $dato) {
    ok(strpos($banco, $dato) !== false, "panel (banco.js) tiene $dato");
    ok(strpos($pago, $dato) !== false, "/pago/ tiene $dato");
}
ok(strpos($diy, '11678410') !== false, 'checkout de Importa tu mismo tiene la cuenta vista CLP');
ok(strpos(file_get_contents("$raiz/admin-react/src/user/pages/Payments.jsx"), "from '../../shared/lib/banco'") !== false,
    'Pagos del panel lee las cuentas de banco.js');

echo "\n" . ($total - $fallos) . "/$total ok\n";
exit($fallos ? 1 : 0);
