<?php
/**
 * Vigilante de las pasarelas de pago — Imporlan
 * =============================================
 *
 * WebPay estuvo caido sin que nadie se enterara hasta que un cliente no pudo
 * comprar su plan: faltaba /home/wwimpo/webpay_config.php y Transbank devolvia
 * 401 en cada intento. El sitio seguia respondiendo bien, asi que ningun
 * chequeo existente lo detecto. Esto cierra ese hueco.
 *
 * Que revisa:
 *   - WebPay: pide un token de transaccion real a Transbank. Es el unico
 *     chequeo que sirve, porque un 401 por credenciales solo aparece al
 *     llamar. El token nunca se confirma, asi que expira solo y no cobra nada.
 *   - MercadoPago y PayPal: que las credenciales esten configuradas.
 *
 * Avisa por correo a contacto@imporlan.cl cuando una pasarela cae, y otra vez
 * cuando se recupera. Entre medio guarda silencio: sin ese control, un cron
 * cada 6 horas mandaria cuatro correos al dia mientras el problema siga y
 * terminarian ignorandose.
 *
 * USO (por cron, cada 6 horas):
 *   0 *\/6 * * * /usr/bin/php /home/wwimpo/imporlan.cl/api/payment_healthcheck.php >/dev/null 2>&1
 *
 * Tambien se puede correr a mano para ver el estado:
 *   php api/payment_healthcheck.php
 */

$esCli = (php_sapi_name() === 'cli');

// Vive dentro del docroot, asi que por HTTP hay que probar quien llama. El
// token se define en el mismo archivo fuera del docroot que guarda las
// credenciales de WebPay.
if (!$esCli) {
    $cfg = '/home/wwimpo/webpay_config.php';
    if (file_exists($cfg)) require_once $cfg;
    $esperado = defined('IMPORLAN_HEALTHCHECK_TOKEN') ? IMPORLAN_HEALTHCHECK_TOKEN : getenv('IMPORLAN_HEALTHCHECK_TOKEN');
    $recibido = $_GET['token'] ?? '';
    if (!$esperado || !hash_equals((string) $esperado, (string) $recibido)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Acceso denegado.']);
        exit;
    }
    header('Content-Type: application/json');
}


/** Estado entre corridas, para no repetir el mismo aviso. */
function hcEstadoArchivo() {
    $dir = __DIR__ . '/logs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
        @file_put_contents($dir . '/.htaccess', "Require all denied\n");
    }
    return $dir . '/payment_health.json';
}

function hcLeerEstado() {
    $f = hcEstadoArchivo();
    if (!is_readable($f)) return [];
    $d = json_decode((string) @file_get_contents($f), true);
    return is_array($d) ? $d : [];
}

function hcGuardarEstado($estado) {
    @file_put_contents(hcEstadoArchivo(), json_encode($estado, JSON_PRETTY_PRINT), LOCK_EX);
}

/**
 * WebPay: pide un token real. Es el unico chequeo que detecta credenciales
 * vencidas o mal cargadas, que es exactamente lo que fallo.
 */
function hcRevisarWebpay() {
    $cfg = '/home/wwimpo/webpay_config.php';
    if (file_exists($cfg)) require_once $cfg;

    $code = defined('WEBPAY_COMMERCE_CODE') ? WEBPAY_COMMERCE_CODE : (getenv('WEBPAY_COMMERCE_CODE') ?: '');
    $key  = defined('WEBPAY_API_KEY_SECRET') ? WEBPAY_API_KEY_SECRET : (getenv('WEBPAY_API_KEY_SECRET') ?: '');

    if (!$code || !$key) {
        return [false, 'Falta ' . $cfg . ' o no define el codigo de comercio y la llave secreta.'];
    }

    $payload = json_encode([
        'buy_order'  => 'HC-' . substr((string) time(), -8),
        'session_id' => 'healthcheck',
        'amount'     => 1000,
        'return_url' => 'https://www.imporlan.cl/api/webpay.php?action=commit_transaction',
    ]);

    $ch = curl_init('https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Tbk-Api-Key-Id: ' . $code,
            'Tbk-Api-Key-Secret: ' . $key,
        ],
    ]);
    $resp = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($err) return [false, 'No se pudo contactar a Transbank: ' . $err];

    $data = json_decode((string) $resp, true);
    if ($http >= 200 && $http < 300 && !empty($data['token'])) {
        return [true, 'Token obtenido correctamente.'];
    }
    if ($http === 401) {
        return [false, 'Transbank rechaza las credenciales (401 Not Authorized). Revisa el codigo de comercio y la API Key en ' . $cfg . ', y que sean las de produccion.'];
    }
    return [false, 'Transbank respondio HTTP ' . $http . ': ' . substr((string) $resp, 0, 200)];
}

/**
 * MercadoPago y PayPal: que la configuracion exista y traiga las credenciales.
 *
 * No se les pide una operacion real como a WebPay porque crear una preferencia
 * o una orden deja registros en la cuenta del comercio; aca alcanza con
 * comprobar que api/config.php —que vive solo en el servidor, igual que las
 * credenciales de Transbank— las esta entregando.
 */
function hcRevisarPasarela($nombre, $fn, $campos) {
    $cfg = __DIR__ . '/config.php';
    if (!file_exists($cfg)) {
        return [false, 'Falta api/config.php en el servidor.'];
    }
    require_once $cfg;
    if (!function_exists($fn)) {
        return [false, "api/config.php no define $fn()."];
    }
    try {
        $c = $fn();
    } catch (\Throwable $e) {
        return [false, "$fn() fallo: " . $e->getMessage()];
    }
    if (!is_array($c)) {
        return [false, "$fn() no devolvio una configuracion."];
    }
    foreach ($campos as $campo) {
        if (empty($c[$campo])) {
            return [false, "La configuracion de $nombre no trae '$campo'."];
        }
    }
    return [true, 'Credenciales presentes.'];
}

// ── Correr los chequeos ──
$revisiones = [
    'WebPay'      => hcRevisarWebpay(),
    'MercadoPago' => hcRevisarPasarela('MercadoPago', 'getMercadoPagoConfig', ['access_token']),
    'PayPal'      => hcRevisarPasarela('PayPal', 'getPayPalConfig', ['client_id']),
];

$estado  = hcLeerEstado();
$ahora   = time();
$avisos  = [];
$nuevo   = [];
$enviados = 0;

foreach ($revisiones as $pasarela => [$ok, $detalle]) {
    $previo    = $estado[$pasarela]['ok'] ?? true;
    $ultimoAviso = $estado[$pasarela]['ultimo_aviso'] ?? 0;

    if (!$ok) {
        // Repetir el aviso como mucho una vez al dia mientras siga caida.
        if ($previo || ($ahora - $ultimoAviso) > 86400) {
            $avisos[] = ['pasarela' => $pasarela, 'ok' => false, 'detalle' => $detalle];
            $ultimoAviso = $ahora;
        }
    } elseif (!$previo) {
        $avisos[] = ['pasarela' => $pasarela, 'ok' => true, 'detalle' => 'Volvio a funcionar.'];
        $ultimoAviso = 0;
    }

    $nuevo[$pasarela] = ['ok' => $ok, 'detalle' => $detalle, 'revisado' => date('c', $ahora), 'ultimo_aviso' => $ultimoAviso];
}

hcGuardarEstado($nuevo);

// ── Avisar ──
foreach ($avisos as $aviso) {
    $titulo = $aviso['ok']
        ? "{$aviso['pasarela']} volvio a funcionar"
        : "{$aviso['pasarela']} no esta operativo";
    $cuerpo = $aviso['ok']
        ? "La pasarela {$aviso['pasarela']} responde correctamente de nuevo."
        : "Los clientes NO pueden pagar con {$aviso['pasarela']}.\n\n{$aviso['detalle']}";

    error_log("payment_healthcheck: $titulo — {$aviso['detalle']}");

    try {
        require_once __DIR__ . '/email_service.php';
        $svc = new EmailService();
        $r = $svc->sendInternalNotification('critical_error', [
            'error'   => $titulo,
            'message' => $cuerpo,
            'context' => 'payment_healthcheck',
            'date'    => date('d-m-Y H:i'),
        ]);
        if (!empty($r['success'])) {
            $enviados++;
        } else {
            error_log('payment_healthcheck: el aviso no pudo entregarse a contacto@imporlan.cl');
        }
    } catch (\Throwable $e) {
        // require_once de un archivo ausente lanza Error, no Exception: por eso
        // se atrapa Throwable. Un problema con el correo no debe hacer que el
        // chequeo falle entero.
        error_log('payment_healthcheck: no se pudo enviar el aviso: ' . $e->getMessage());
    }
}

// ── Salida ──
$resumen = [];
foreach ($revisiones as $pasarela => [$ok, $detalle]) {
    $resumen[$pasarela] = ['ok' => $ok, 'detalle' => $detalle];
}
$todoBien = !in_array(false, array_column($resumen, 'ok'), true);

if ($esCli) {
    foreach ($resumen as $pasarela => $r) {
        printf("  %-13s %s  %s\n", $pasarela, $r['ok'] ? 'OK   ' : 'CAIDO', $r['detalle']);
    }
    if (!$avisos) {
        echo "\n  Sin cambios respecto de la revision anterior.\n";
    } elseif ($enviados === count($avisos)) {
        echo "\n  " . $enviados . " aviso(s) enviado(s) a contacto@imporlan.cl\n";
    } else {
        echo "\n  " . $enviados . " de " . count($avisos) . " aviso(s) enviados; el resto NO se pudo entregar (ver error_log).\n";
    }
    exit($todoBien ? 0 : 1);
}

echo json_encode(['ok' => $todoBien, 'pasarelas' => $resumen, 'avisos_detectados' => count($avisos), 'avisos_enviados' => $enviados]);
