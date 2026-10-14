<?php
/**
 * «Enviar desglose» · el Servicio All-Inclusive por etapa, sin mostrar el FEE.
 *
 * JP, 14-oct-2026: «Siempre nos piden desglosar este item del Servicio todo
 * incluido, pero ahí está nuestro trabajo». Y después: «no siempre lo piden,
 * así que no es necesario mostrarlo por default. Solo a quienes lo pidan, y yo
 * manualmente poder enviarlo haciendo click en 1 botón».
 *
 * Lo que este test fija:
 *
 *  1. Las etapas suman, al peso, el All-Inclusive que el cliente ya tiene.
 *  2. El flete y el seguro van a costo (están en la declaración de aduana).
 *  3. El FEE completo no aparece en ninguna línea: la mitad va en una línea
 *     «Gestión Imporlan» y la otra mitad se reparte en las tres etapas de
 *     logística en proporción a su costo (JP, 14-oct: repartido entero, USA
 *     se veía cara para su título).
 *  4. Una cotización rota no sale (`cuadra` = false).
 *  5. El botón no lo muestra por defecto: sólo se manda a mano, con la
 *     cotización ya publicada, y re-guardar la cotización borra la marca.
 *
 *   php test/cotizador-desglose-tests.php
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

// Valores por defecto del cotizador (api/settings_api.php), dólar a 950.
$rate = 950;
$qd = [
    'usd_clp_rate' => $rate, 'valor_lancha_usd' => 30000, 'iva_pct' => 19, 'lujo_pct' => 2, 'lujo_aplica' => false,
    'trailer_usd' => 0, 'inspeccion_usd' => 850, 'inland_usa_usd' => 2100, 'transporte_roro_usd' => 8500,
    'fumigacion_usd' => 400, 'seguro_usd' => 320, 'gastos_naviera_usd' => 450, 'congestion_usd' => 0,
    'thc_usd' => 160, 'baf_usd' => 615, 'wharfage_usd' => 252, 'handling_chile_usd' => 150,
    'miami_admin_usd' => 150, 'escorte_usd' => 0,
    'fee_wire_clp' => 240000, 'inland_puerto_clp' => 349000, 'chequeo_mecanico_clp' => 209000,
    'pulido_clp' => 186400, 'entrega_clp' => 0, 'aduana_extra_clp' => 220018, 'autorizaciones_clp' => 80000,
    'gastos_puerto_clp' => 400000, 'agencia_aduana_clp' => 280000, 'iva_servicios_linea_clp' => 100107,
    'gastos_despachos_clp' => 47924, 'honorarios_agencia_clp' => 71951,
    'fee_imporlan_clp' => 3000000,
];

// El total como lo arma el QuoteModal del admin: lancha + costos + FEE + IVA(CIF) + lujo.
function totalAdmin(array $qd): float
{
    $rate = $qd['usd_clp_rate'];
    $usd = 0; $clp = 0;
    foreach ($qd as $k => $v) {
        if (substr($k, -4) === '_usd' && $k !== 'valor_lancha_usd') $usd += $v;
        if (substr($k, -4) === '_clp') $clp += $v;  // incluye el FEE
    }
    $lancha = $qd['valor_lancha_usd'] * $rate;
    $iva = ($lancha + $qd['transporte_roro_usd'] * $rate) * $qd['iva_pct'] / 100;
    $lujo = $qd['lujo_aplica'] ? $lancha * $qd['lujo_pct'] / 100 : 0;
    return $lancha + $usd * $rate + $clp + $iva + $lujo;
}

$total = round(totalAdmin($qd));
$d = cotizadorDesgloseEtapas($qd, $total);
$montos = array_column($d['etapas'], 'clp', 'label');

/* ── 1 · cuadra al peso con lo que el cliente ya vio ─────────────────── */
// Misma cuenta que el panel del cliente y el correo «Tu cotización está lista».
$lancha = 30000 * $rate;
$allInclCliente = round($total - $lancha - ($lancha + 8500 * $rate) * 0.19);
t($d['all_inclusive'] == $allInclCliente, 'el All-Inclusive del desglose es el mismo del panel: ' . $d['all_inclusive']);
t(array_sum($montos) == $d['all_inclusive'], 'las etapas suman el All-Inclusive al peso: ' . array_sum($montos));
t(count($d['etapas']) === 5 && $d['cuadra'] === true, 'cuatro etapas más «Gestión Imporlan», y la cotización cuadra');
t($d['etapas'][4]['label'] === 'Gestión Imporlan', 'la gestión va al final');

/* ── 2 · flete y seguro a costo ──────────────────────────────────────── */
t($montos['Flete marítimo y seguro'] == (8500 + 320) * $rate, 'flete + seguro va a costo: ' . $montos['Flete marítimo y seguro']);

/* ── 3 · el FEE no aparece entero ────────────────────────────────────── */
$gestion = $montos['Gestión Imporlan'];
t($gestion == 1500000, 'Gestión Imporlan es la mitad del margen, a miles: ' . $gestion);
$costo = [
    'Inspección, retiro y traslado a puerto (EE.UU.)' => (850 + 2100 + 400 + 150) * $rate + 240000,
    'Puerto y desaduanaje en Chile' => (450 + 160 + 615 + 252 + 150) * $rate + 400000 + 280000 + 220018 + 80000 + 100107 + 47924 + 71951,
    'Traslado, revisión y entrega' => 349000 + 209000 + 186400,
];
$factor = ($d['all_inclusive'] - $montos['Flete marítimo y seguro'] - $gestion) / array_sum($costo);
foreach ($costo as $etapa => $c) {
    t($montos[$etapa] > $c, "«{$etapa}» lleva su parte del FEE");
    t(abs($montos[$etapa] - $c * $factor) < 1000, "«{$etapa}» la lleva en proporción a su costo");
    // Lo que JP vio caro: USA quedaba 43% sobre su costo. Ahora ninguna pasa de ~21%.
    t($montos[$etapa] / $c < 1.25, "«{$etapa}» no se ve inflada: " . round(($montos[$etapa] / $c - 1) * 100) . '% sobre su costo');
}
t(!in_array(3000000.0, array_map('floatval', $montos), true), 'ninguna línea es el FEE');
t(fmod($montos['Puerto y desaduanaje en Chile'], 1000) == 0 && fmod($montos['Traslado, revisión y entrega'], 1000) == 0,
    'Chile y entrega redondeadas a miles (se leen como precio)');

$html = cotizadorDesgloseHtml(['year' => 2015, 'make' => 'Chaparral', 'model' => '21 Sport H2O',
    'quote_data' => json_encode($qd), 'quote_total_clp' => $total], 'Alberto Lathrop E.');
t(stripos($html, 'fee') === false, 'el correo no dice FEE');
t(strpos($html, '3.000.000') === false, 'ni muestra su monto');
foreach (['comisión', 'margen', 'honorarios'] as $palabra) {
    t(stripos($html, $palabra) === false, "el correo no habla de «{$palabra}»");
}
t(strpos($html, 'Hola Alberto,') !== false, 'saluda por el nombre de pila');
t(strpos($html, 'src="https://www.imporlan.cl/images/correo/firma-jp.jpg"') !== false, 'va con la firma gráfica de Juan Pablo');
t(@md5_file(__DIR__ . '/../images/correo/firma-jp.jpg') === md5_file(__DIR__ . '/../.github/correo/firma-jp.jpg'),
    'la firma publicada es la misma del workflow de correo');
t(strpos($html, '$ ' . number_format($d['all_inclusive'], 0, ',', '.')) !== false, 'muestra el All-Inclusive');
t(strpos($html, 'van a costo') !== false && strpos($html, 'la gestión de Imporlan de principio a fin') !== false,
    'dice qué va a costo, que las demás son precio de servicio y qué es la última línea');
// Codex, PR 665: el IVA del cotizador va sobre lancha + flete, sin el seguro;
// el correo no puede decir que se calcula sobre «flete y seguro».
t(strpos($html, 'se calcula el IVA') === false, 'no afirma una base del IVA distinta de la que se usa');

$xss = cotizadorDesgloseHtml(['make' => '<b>x</b>', 'quote_data' => json_encode($qd), 'quote_total_clp' => $total], '<script>alert(1)</script>');
t(strpos($xss, '<script>') === false && strpos($xss, '<b>x</b>') === false, 'escapa nombre y título');

/* ── 4 · lo que no puede salir ───────────────────────────────────────── */
$roto = cotizadorDesgloseEtapas($qd, $lancha + 1000000);
t($roto['cuadra'] === false, 'si el total no alcanza para el flete, no cuadra');

// Un resto chico no puede dejar una etapa negativa por el redondeo a miles.
$iva = ($lancha + 8500 * $rate) * 0.19;
$justo = cotizadorDesgloseEtapas($qd, $lancha + $iva + (8500 + 320) * $rate + 1500);
t($justo['cuadra'] === true, 'resto chico: cuadra');
t(min(array_column($justo['etapas'], 'clp')) > 0, 'resto chico: ninguna etapa negativa ni en cero');
t(array_sum(array_column($justo['etapas'], 'clp')) == $justo['all_inclusive'], 'resto chico: suma igual al peso');

// Devin, PR 665: USA sin costo, Chile y entrega iguales y un resto impar. El
// redondeo no puede dejar una etapa negativa ni sumar un peso de más.
$impar = array_merge(array_fill_keys(array_keys($qd), 0), [
    'usd_clp_rate' => 1, 'valor_lancha_usd' => 0, 'iva_pct' => 19, 'lujo_pct' => 2, 'lujo_aplica' => false,
    'transporte_roro_usd' => 0, 'seguro_usd' => 100, 'gastos_puerto_clp' => 500, 'inland_puerto_clp' => 500,
]);
foreach ([3101, 2101, 1101, 102] as $allIncl) {
    $r = cotizadorDesgloseEtapas($impar, $allIncl);
    $suma = array_sum(array_column($r['etapas'], 'clp'));
    t($r['cuadra'] && $suma == $allIncl && min(array_column($r['etapas'], 'clp')) > 0,
        "resto impar ({$allIncl}): suma {$suma}, sin etapas negativas");
}

// Sin costos de servicio cargados, todo el resto queda en USA.
$soloFlete = array_merge($qd, array_fill_keys(['trailer_usd', 'inspeccion_usd', 'inland_usa_usd', 'fumigacion_usd',
    'miami_admin_usd', 'escorte_usd', 'gastos_naviera_usd', 'congestion_usd', 'thc_usd', 'baf_usd', 'wharfage_usd',
    'handling_chile_usd', 'fee_wire_clp', 'inland_puerto_clp', 'chequeo_mecanico_clp', 'pulido_clp', 'entrega_clp',
    'aduana_extra_clp', 'autorizaciones_clp', 'gastos_puerto_clp', 'agencia_aduana_clp', 'iva_servicios_linea_clp',
    'gastos_despachos_clp', 'honorarios_agencia_clp'], 0));
$s = cotizadorDesgloseEtapas($soloFlete, round(totalAdmin($soloFlete)));
t(count($s['etapas']) === 3 && $s['etapas'][1]['clp'] == 1500000 && $s['etapas'][2]['clp'] == 1500000 && $s['cuadra'],
    'sin costos de servicio: flete, una etapa con la mitad y la gestión con la otra');

/* ── 5 · sólo a mano, con la cotización publicada ────────────────────── */
$api = (string) file_get_contents(__DIR__ . '/../api/orders_api.php');
t((bool) preg_match("/case 'admin_send_quote_breakdown':\s*requireAdminAuth\(\);/", $api), 'el envío exige sesión de admin');
if (preg_match('/function adminSendQuoteBreakdown\(\) \{(.*?)\n\}\n/s', $api, $m)) {
    $f = $m[1];
    $posPublicada = strpos($f, "empty(\$row['quote_published_at'])");
    $posCuadra = strpos($f, "!\$d['cuadra']");
    $posPreview = strpos($f, 'if ($preview)');
    $posEnvio = strpos($f, 'cotizadorSendDesgloseEmail(');
    t($posPublicada !== false && $posPublicada < $posEnvio, 'no se manda si la cotización no está publicada');
    t($posCuadra !== false && $posCuadra < $posEnvio, 'no se manda si la cotización no cuadra');
    t($posPreview !== false && $posPreview < $posEnvio, 'la vista previa vuelve antes de enviar');
    t(strpos($f, 'quote_breakdown_sent_at = NOW()') > $posEnvio, 'marca el envío sólo después de mandarlo');
    // Devin, PR 665: lo que sale es lo que se confirmó en la vista previa.
    $posRevision = strpos($f, "(\$input['revision'] ?? '') !== cotizadorDesgloseRevision(\$row)");
    t($posRevision !== false && $posPreview < $posRevision && $posRevision < $posEnvio,
        'si la cotización cambió desde la vista previa, no se manda');
} else {
    t(false, 'no encontré adminSendQuoteBreakdown');
}
if (preg_match('/function adminSaveQuote\(\) \{(.*?)\n\}\n/s', $api, $m)) {
    t(strpos($m[1], 'quote_breakdown_sent_at     = NULL') !== false, 're-guardar la cotización borra la marca de desglose enviado');
}
$base = ['quote_data' => json_encode($qd), 'quote_total_clp' => $total, 'customer_email' => 'a@b.cl'];
$rev = cotizadorDesgloseRevision($base);
t($rev !== cotizadorDesgloseRevision(array_merge($base, ['quote_total_clp' => $total + 1])), 'la revisión cambia si cambia el total');
t($rev !== cotizadorDesgloseRevision(array_merge($base, ['quote_data' => json_encode(array_merge($qd, ['seguro_usd' => 321]))])),
    'la revisión cambia si cambia la planilla');
t($rev !== cotizadorDesgloseRevision(array_merge($base, ['customer_email' => 'otro@b.cl'])), 'la revisión cambia si cambia el destinatario');

// Remitente «Juan Pablo · Imporlan», codificado para que el From siga siendo válido.
$svc = (string) file_get_contents(__DIR__ . '/../api/email_service.php');
if (preg_match('/    public function setFromName\(\$name\) \{.*?\n    \}\n/s', $svc, $m)) {
    eval('class RemitentePrueba { public $fromName = "Imporlan"; ' . $m[0] . ' }');
    $r = new RemitentePrueba();
    $r->setFromName('Juan Pablo · Imporlan');
    t(preg_match('/^[\x20-\x7e]+$/', $r->fromName) === 1, 'el From queda en ASCII: ' . $r->fromName);
    t(iconv_mime_decode($r->fromName, 0, 'UTF-8') === 'Juan Pablo · Imporlan', 'y se lee «Juan Pablo · Imporlan»');
    $r->setFromName("Malo\r\nBcc: x@y.cl");
    t(strpos($r->fromName, "\n") === false, 'no deja inyectar cabeceras');
} else {
    t(false, 'no encontré EmailService::setFromName');
}
t(strpos((string) file_get_contents(__DIR__ . '/../api/cotizador_helpers.php'), "\$svc->setFromName('Juan Pablo · Imporlan');") !== false,
    'el desglose sale como «Juan Pablo · Imporlan»');

// JP, 14-oct: «no veo dónde dice enviar desglose» — dentro de la ventana de
// cotización no se veía. Va también a la vista en la fila del link.
$fila = (string) file_get_contents(__DIR__ . '/../admin-react/src/admin/components/LinkRow.jsx');
t(strpos($fila, '{onEnviarDesglose && lk.quote_published_at && (') !== false,
    'la fila del link muestra «Enviar desglose» cuando la cotización está publicada');

$panel = (string) file_get_contents(__DIR__ . '/../panel/assets/links-contratados.js');
t(strpos($panel, 'Flete marítimo y seguro') === false && strpos($panel, 'quote_breakdown') === false,
    'el panel del cliente no muestra el desglose por defecto');

echo "cotizador-desglose: {$ok} ok, {$mal} mal\n";
exit($mal ? 1 : 0);
