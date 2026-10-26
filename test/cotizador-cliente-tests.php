<?php
/**
 * La planilla interna de la cotización no sale al cliente.
 *
 * JP, 14-oct-2026, sobre un cliente que pidió desglosar el «Servicio
 * All-Inclusive»: «ahí está nuestro trabajo, entonces tampoco podemos
 * entregar esta información».
 *
 * El panel le muestra al cliente sólo el resumen (Lancha, All-Inclusive, IVA,
 * Lujo, Total), pero el expediente (`orders_api.php?action=user_detail`)
 * mandaba `quote_data` completo: cada costo USD/CLP y `fee_imporlan_clp`,
 * legibles con F12. Lo que este test fija:
 *
 *  1. Al cliente le llegan sólo las claves con que se pinta el resumen.
 *  2. El FEE y los costos de la planilla no viajan.
 *  3. El resumen que el cliente calcula sigue dando lo mismo que antes.
 *
 *   php test/cotizador-cliente-tests.php
 */

$ok = 0;
$mal = 0;
function t($cond, $que)
{
    global $ok, $mal;
    if ($cond) { $ok++; return; }
    $mal++;
    fwrite(STDERR, "FALLA: {$que}\n");
}

require_once __DIR__ . '/../api/cotizador_helpers.php';

// Sin MySQL: information_schema y pricing_config fallan y los helpers caen a
// sus defaults (no agregan columnas, 24 h de espera).
$pdo = new PDO('sqlite::memory:');

$planilla = [
    'usd_clp_rate' => 950, 'valor_lancha_usd' => 30000, 'valor_negociado_usd' => 30000,
    'transporte_roro_usd' => 8500, 'seguro_usd' => 320, 'inland_usa_usd' => 2100,
    'gastos_puerto_clp' => 400000, 'agencia_aduana_clp' => 280000,
    'iva_pct' => 19, 'lujo_pct' => 2, 'lujo_aplica' => false,
    'fee_imporlan_clp' => 3000000,
    'pago_1_pct' => 7, 'pago_2_pct' => 63, 'pago_3_pct' => 30,
];
$publicada = [
    'id' => 1, 'order_id' => 1,
    'quote_data' => json_encode($planilla),
    'quote_total_clp' => 50000000, 'quote_total_usd' => 52631.58,
    'quote_payments' => '{"p1_pct":7,"p1_clp":3500000}',
    'quote_calculated_at' => date('Y-m-d H:i:s', time() - 3 * 86400),
    'quote_published_at' => date('Y-m-d H:i:s', time() - 2 * 86400),
];

$out = cotizadorApplyClientVisibility($pdo, [$publicada])[0];
$qd = json_decode((string) $out['quote_data'], true);

/* ── 1 · sólo lo que pinta el resumen ────────────────────────────────── */
t(is_array($qd), 'quote_data sigue llegando como JSON');
t(array_keys($qd) == ['usd_clp_rate', 'valor_lancha_usd', 'transporte_roro_usd', 'iva_pct', 'lujo_pct', 'lujo_aplica'],
    'llegan exactamente las claves del resumen: ' . implode(',', array_keys((array) $qd)));

/* ── 2 · el FEE y la planilla no viajan ──────────────────────────────── */
$json = json_encode($out);
t(strpos($json, 'fee_imporlan') === false, 'el FEE Imporlan no sale al cliente');
t(strpos($json, '3000000') === false, 'ni su monto');
foreach (['seguro_usd', 'inland_usa_usd', 'gastos_puerto_clp', 'agencia_aduana_clp', 'pago_1_pct', 'valor_negociado_usd'] as $k) {
    t(strpos($json, $k) === false, "{$k} no sale al cliente");
}

/* ── 3 · el resumen da lo mismo ──────────────────────────────────────── */
t($out['quote_total_clp'] == 50000000, 'el total no se toca');
t($out['quote_payments'] === $publicada['quote_payments'], 'el plan de pagos no se toca');
// Misma cuenta que links-contratados.js y el correo: IVA sobre lancha + RORO.
$iva = ($qd['valor_lancha_usd'] + $qd['transporte_roro_usd']) * $qd['usd_clp_rate'] * $qd['iva_pct'] / 100;
t(abs($iva - (30000 + 8500) * 950 * 0.19) < 1, 'el IVA aduanero se sigue pudiendo calcular');

/* ── mientras está en análisis no sale nada, como antes ──────────────── */
$pendiente = array_merge($publicada, [
    'quote_calculated_at' => date('Y-m-d H:i:s'), 'quote_published_at' => null,
]);
$out = cotizadorApplyClientVisibility($pdo, [$pendiente])[0];
t(!array_key_exists('quote_data', $out) && $out['quote_pending'] === true, 'en análisis: sin números');

/* ── el correo «Tu cotización está lista» se arma con lo mismo ───────── */
$src = (string) file_get_contents(__DIR__ . '/../api/cotizador_helpers.php');
if (preg_match('/function cotizadorSendReadyEmail\(.*?\n    \}\n/s', $src, $m)) {
    preg_match_all('/\$qd\[\'([a-z_]+)\'\]/', $m[0], $usadas);
    $faltan = array_diff(array_unique($usadas[1]), array_keys($qd ?: $planilla));
    t($faltan === [], 'el correo no lee claves que el cliente ya no recibe: ' . implode(',', $faltan));
} else {
    t(false, 'no encontré cotizadorSendReadyEmail');
}

echo "{$ok} ok, {$mal} mal\n";
exit($mal ? 1 : 0);
