<?php
/**
 * Imporlan - Simulacion de Cotizacion por Email
 * Envia simulaciones de costos de importacion para distintos valores de compra.
 * Solo requiere Nombre y Email del cliente.
 * Version: 1.0.0
 */

// ── Configuration ──
$DOLAR_COMPRA = 935;
$VALOR_SERVICIO = 16434095; // CLP (sin formato)

// Simulaciones pre-calculadas
$simulaciones = [
    [
        'usd' => 25000,
        'clp' => 23375000,
        'clp_pct' => 52,
        'servicio' => 16434095,
        'servicio_pct' => 36,
        'iva' => 5507150,
        'iva_pct' => 12,
        'lujo' => 0,
        'lujo_pct' => 0,
        'total' => 45316245,
    ],
    [
        'usd' => 30000,
        'clp' => 28050000,
        'clp_pct' => 55,
        'servicio' => 16434095,
        'servicio_pct' => 32,
        'iva' => 6395400,
        'iva_pct' => 13,
        'lujo' => 0,
        'lujo_pct' => 0,
        'total' => 50879495,
    ],
    [
        'usd' => 35000,
        'clp' => 32725000,
        'clp_pct' => 58,
        'servicio' => 16434095,
        'servicio_pct' => 29,
        'iva' => 7283650,
        'iva_pct' => 13,
        'lujo' => 0,
        'lujo_pct' => 0,
        'total' => 56442745,
    ],
    [
        'usd' => 40000,
        'clp' => 37400000,
        'clp_pct' => 60,
        'servicio' => 16434095,
        'servicio_pct' => 27,
        'iva' => 8171900,
        'iva_pct' => 13,
        'lujo' => 0,
        'lujo_pct' => 0,
        'total' => 62005995,
    ],
    [
        'usd' => 45000,
        'clp' => 42075000,
        'clp_pct' => 62,
        'servicio' => 16434095,
        'servicio_pct' => 24,
        'iva' => 9060150,
        'iva_pct' => 13,
        'lujo' => 0,
        'lujo_pct' => 0,
        'total' => 67569245,
    ],
    [
        'usd' => 50000,
        'clp' => 46750000,
        'clp_pct' => 64,
        'servicio' => 16434095,
        'servicio_pct' => 22,
        'iva' => 9948400,
        'iva_pct' => 14,
        'lujo' => 0,
        'lujo_pct' => 0,
        'total' => 73132495,
    ],
    [
        'usd' => 55000,
        'clp' => 51425000,
        'clp_pct' => 65,
        'servicio' => 16434095,
        'servicio_pct' => 21,
        'iva' => 10836650,
        'iva_pct' => 14,
        'lujo' => 0,
        'lujo_pct' => 0,
        'total' => 78695745,
    ],
];

// ── Handle form submission ──
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'enviar_simulacion') {
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');

    $nombre = trim($_POST['nombre'] ?? '');
    $email  = trim($_POST['email'] ?? '');

    if (!$nombre || !$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Por favor ingrese un nombre y email valido.']);
        exit;
    }

    // ── Build email HTML ──
    $emailHtml = buildSimulacionEmailHTML($nombre, $simulaciones, $DOLAR_COMPRA);

    // ── Send email ──
    $subject = "Simulacion de Costos de Importacion - IMPORLAN";

    $headers  = "From: Imporlan <contacto@imporlan.cl>\r\n";
    $headers .= "Reply-To: contacto@imporlan.cl\r\n";
    $headers .= "Bcc: jpchs1@gmail.com\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";

    $sent = mail($email, $subject, $emailHtml, $headers);

    echo json_encode([
        'success' => $sent,
        'message' => $sent ? 'Simulacion enviada exitosamente a ' . $email : 'Error al enviar el correo. Intente nuevamente.'
    ]);
    exit;
}

// ── Format number helper ──
function formatCLP($n) {
    return '$' . number_format($n, 0, ',', '.');
}

function formatUSD($n) {
    return 'USD $' . number_format($n, 0, ',', '.');
}

// ── Build simulation email HTML ──
function buildSimulacionEmailHTML($nombre, $simulaciones, $dolar) {
    $h = function($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); };
    $fecha = date('d/m/Y');

    $html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:30px 0;">
    <tr><td align="center">
    <table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0a1628,#1a365d);padding:30px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:12px;">
                <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#22d3ee,#3b82f6);display:inline-block;text-align:center;line-height:48px;">
                    <span style="color:white;font-size:24px;">&#9973;</span>
                </div>
                <div style="display:inline-block;text-align:left;">
                    <div style="font-size:22px;font-weight:700;color:#fff;">IMPORLAN</div>
                    <div style="font-size:11px;color:#94a3b8;">Tu lancha, puerta a puerta</div>
                </div>
            </div>
            <div style="margin-top:16px;font-size:12px;color:#60a5fa;letter-spacing:2px;text-transform:uppercase;">Simulacion de Costos de Importacion</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:30px 40px;">
            <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:6px;">Estimado/a ' . $h($nombre) . ',</div>
            <div style="font-size:14px;color:#475569;margin-bottom:8px;line-height:1.6;">
                Gracias por su interes en importar una embarcacion desde USA a Chile. A continuacion le presentamos una simulacion de costos para distintos valores de compra, para que pueda evaluar cual se ajusta mejor a su presupuesto.
            </div>
            <div style="font-size:12px;color:#64748b;margin-bottom:24px;">
                <strong>Tipo de cambio utilizado:</strong> 1 USD = $' . number_format($dolar, 0, ',', '.') . ' CLP &nbsp;|&nbsp; <strong>Fecha:</strong> ' . $fecha . '
            </div>';

    // ── Each simulation ──
    foreach ($simulaciones as $i => $sim) {
        $bgColor = ($i % 2 === 0) ? '#f8fafc' : '#ffffff';
        $usdFormatted = number_format($sim['usd'], 0, ',', '.');
        $clpFormatted = number_format($sim['clp'], 0, ',', '.');
        $servicioFormatted = number_format($sim['servicio'], 0, ',', '.');
        $ivaFormatted = number_format($sim['iva'], 0, ',', '.');
        $lujoFormatted = number_format($sim['lujo'], 0, ',', '.');
        $totalFormatted = number_format($sim['total'], 0, ',', '.');

        $html .= '
            <div style="background:' . $bgColor . ';border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:16px;">
                <div style="font-size:13px;font-weight:700;color:#1a365d;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #3b82f6;">
                    Cotizacion Itemizada &mdash; Lancha USD $' . $usdFormatted . '
                </div>
                <table width="100%" cellpadding="6" cellspacing="0" style="font-size:13px;">
                    <tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="color:#0f172a;padding:8px 0;">Valor Lancha Compra en USA (USD)</td>
                        <td style="color:#0f172a;font-weight:600;text-align:right;padding:8px 0;">$' . $usdFormatted . '</td>
                        <td style="color:#64748b;text-align:right;padding:8px 0;width:50px;"></td>
                    </tr>
                    <tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="color:#0f172a;padding:8px 0;">Valor Lancha Compra en USA (CLP)</td>
                        <td style="color:#0f172a;font-weight:600;text-align:right;padding:8px 0;">$' . $clpFormatted . '</td>
                        <td style="color:#64748b;text-align:right;padding:8px 0;">' . $sim['clp_pct'] . '%</td>
                    </tr>
                    <tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="color:#0f172a;padding:8px 0;">Valor Servicio All-Inclusive</td>
                        <td style="color:#0f172a;font-weight:600;text-align:right;padding:8px 0;">$' . $servicioFormatted . '</td>
                        <td style="color:#64748b;text-align:right;padding:8px 0;">' . $sim['servicio_pct'] . '%</td>
                    </tr>
                    <tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="color:#0f172a;padding:8px 0;">IVA (Sobre valor CIF)</td>
                        <td style="color:#0f172a;font-weight:600;text-align:right;padding:8px 0;">$' . $ivaFormatted . '</td>
                        <td style="color:#64748b;text-align:right;padding:8px 0;">' . $sim['iva_pct'] . '%</td>
                    </tr>
                    <tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="color:#0f172a;padding:8px 0;">Impuesto al Lujo N/A</td>
                        <td style="color:#0f172a;font-weight:600;text-align:right;padding:8px 0;">$' . $lujoFormatted . '</td>
                        <td style="color:#64748b;text-align:right;padding:8px 0;">' . $sim['lujo_pct'] . '%</td>
                    </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                    <tr>
                        <td style="background:#1a365d;color:white;padding:12px 16px;border-radius:8px 0 0 8px;font-size:14px;font-weight:700;">TOTAL</td>
                        <td style="background:#1a365d;color:white;padding:12px 16px;border-radius:0 8px 8px 0;font-size:14px;font-weight:700;text-align:right;">$' . $totalFormatted . '</td>
                        <td style="background:#1a365d;color:#94a3b8;padding:12px 8px;border-radius:0 8px 8px 0;font-size:12px;text-align:right;width:50px;">100%</td>
                    </tr>
                </table>
            </div>';
    }

    // ── Service includes + Footer ──
    $html .= '
            <div style="background:linear-gradient(135deg,rgba(59,130,246,0.05),rgba(34,211,238,0.05));border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:16px 20px;margin-bottom:20px;margin-top:24px;">
                <div style="font-size:12px;font-weight:700;color:#1a365d;margin-bottom:8px;">&#9989; Servicio All-Inclusive incluye:</div>
                <div style="font-size:12px;color:#475569;line-height:1.8;">
                    Naviera (flete maritimo) &bull; Transporte terrestre USA &bull; Puerto de origen &bull;
                    Seguro de carga &bull; Agencia de Aduanas &bull; Puerto de destino Chile &bull;
                    Tramites y documentacion &bull; Coordinacion integral puerta a puerta
                </div>
            </div>

            <div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
                <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:4px;">&#9888; Nota importante:</div>
                <div style="font-size:12px;color:#78350f;line-height:1.6;">
                    Los valores presentados son referenciales y estan basados en un tipo de cambio de 1 USD = $' . number_format($dolar, 0, ',', '.') . ' CLP. Los montos finales pueden variar segun la fecha de compra, el tipo de embarcacion, y las condiciones de importacion vigentes. Contactenos para una cotizacion personalizada.
                </div>
            </div>

            <div style="text-align:center;margin-top:24px;">
                <a href="https://www.imporlan.cl/cotizador-importacion/" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;">Cotizar mi embarcacion</a>
            </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0f172a;padding:24px 40px;text-align:center;">
            <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">IMPORLAN - Importacion de Embarcaciones</div>
            <div style="font-size:11px;color:#64748b;">contacto@imporlan.cl &bull; +56 9 4021 1459 &bull; imporlan.cl</div>
        </td></tr>
    </table>
    </td></tr></table></body></html>';

    return $html;
}

// ── Render the page ──
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
$year = date('Y');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simulacion de Cotizacion | IMPORLAN Chile</title>
    <meta name="description" content="Envia una simulacion de costos de importacion de embarcaciones a tu cliente.">
    <meta name="robots" content="noindex, nofollow">
    <link rel="icon" type="image/svg+xml" href="/images/imporlan-favicon.svg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body {
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        background:#0a1628;
        color:#e2e8f0;
        line-height:1.6;
        min-height:100vh;
    }

    /* Header */
    .sc-header {
        background:rgba(10,22,40,0.95);
        backdrop-filter:blur(10px);
        border-bottom:1px solid rgba(255,255,255,0.06);
        padding:16px 0;
        position:sticky;
        top:0;
        z-index:100;
    }
    .sc-header-inner {
        max-width:900px;
        margin:0 auto;
        padding:0 24px;
        display:flex;
        align-items:center;
        justify-content:space-between;
    }
    .sc-logo {
        display:flex;
        align-items:center;
        gap:12px;
        text-decoration:none;
    }
    .sc-logo-icon {
        width:44px; height:44px;
        border-radius:12px;
        background:linear-gradient(135deg,#22d3ee,#3b82f6);
        display:flex;
        align-items:center;
        justify-content:center;
    }
    .sc-logo-icon svg { width:24px; height:24px; }
    .sc-logo-text { display:flex; flex-direction:column; }
    .sc-logo-title { font-size:18px; font-weight:700; color:#fff; letter-spacing:1px; }
    .sc-logo-sub { font-size:11px; color:#94a3b8; }
    .sc-header-links { display:flex; align-items:center; gap:20px; }
    .sc-header-links a {
        display:inline-flex; align-items:center; gap:8px;
        font-size:14px; font-weight:500; color:#94a3b8;
        text-decoration:none; transition:color 0.3s;
    }
    .sc-header-links a:hover { color:#60a5fa; }
    .sc-header-links svg { width:18px; height:18px; flex-shrink:0; }

    /* Hero */
    .sc-hero {
        background:linear-gradient(135deg,#0a1628 0%,#1a365d 50%,#0f2847 100%);
        padding:64px 24px 48px;
        text-align:center;
        position:relative;
        overflow:hidden;
    }
    .sc-hero::before {
        content:'';
        position:absolute;
        top:-40%; right:-20%;
        width:600px; height:600px;
        border-radius:50%;
        background:radial-gradient(circle,rgba(59,130,246,0.06) 0%,transparent 70%);
        pointer-events:none;
    }
    .sc-hero-badge {
        display:inline-block;
        background:rgba(59,130,246,0.15);
        border:1px solid rgba(59,130,246,0.3);
        color:#60a5fa;
        font-size:11px; font-weight:700;
        letter-spacing:3px; text-transform:uppercase;
        padding:10px 28px; border-radius:30px;
        margin-bottom:24px;
    }
    .sc-hero h1 {
        color:#ffffff;
        font-size:clamp(24px,5vw,36px);
        font-weight:800;
        line-height:1.2;
        margin-bottom:16px;
    }
    .sc-hero h1 span {
        background:linear-gradient(135deg,#22d3ee,#3b82f6);
        -webkit-background-clip:text;
        -webkit-text-fill-color:transparent;
        background-clip:text;
    }
    .sc-hero p {
        color:#94a3b8;
        font-size:16px;
        max-width:600px;
        margin:0 auto;
    }

    /* Form Section */
    .sc-form-section {
        max-width:560px;
        margin:-30px auto 60px;
        padding:0 24px;
        position:relative;
        z-index:10;
    }
    .sc-form-card {
        background:rgba(30,58,95,0.5);
        border:1px solid rgba(255,255,255,0.1);
        border-radius:20px;
        padding:40px;
        backdrop-filter:blur(10px);
    }
    .sc-form-title {
        font-size:18px;
        font-weight:700;
        color:#fff;
        margin-bottom:8px;
        text-align:center;
    }
    .sc-form-subtitle {
        font-size:13px;
        color:#94a3b8;
        text-align:center;
        margin-bottom:28px;
    }
    .sc-field {
        margin-bottom:20px;
    }
    .sc-label {
        display:block;
        font-size:13px;
        font-weight:600;
        color:#e2e8f0;
        margin-bottom:6px;
    }
    .sc-input {
        width:100%;
        padding:14px 16px;
        background:rgba(0,0,0,0.3);
        border:1px solid rgba(255,255,255,0.12);
        border-radius:10px;
        color:#fff;
        font-size:15px;
        font-family:inherit;
        transition:border-color 0.3s;
        box-sizing:border-box;
    }
    .sc-input:focus {
        outline:none;
        border-color:#3b82f6;
        box-shadow:0 0 0 3px rgba(59,130,246,0.15);
    }
    .sc-input::placeholder { color:#64748b; }

    .sc-btn {
        width:100%;
        padding:16px;
        background:linear-gradient(135deg,#3b82f6,#2563eb);
        color:#fff;
        border:none;
        border-radius:12px;
        font-size:16px;
        font-weight:700;
        cursor:pointer;
        transition:all 0.3s;
        font-family:inherit;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:10px;
        margin-top:8px;
    }
    .sc-btn:hover {
        transform:translateY(-2px);
        box-shadow:0 8px 25px rgba(59,130,246,0.4);
    }
    .sc-btn:disabled {
        opacity:0.6;
        cursor:not-allowed;
        transform:none;
        box-shadow:none;
    }
    .sc-btn svg { width:20px; height:20px; }

    /* Result message */
    .sc-result {
        margin-top:20px;
        padding:14px 20px;
        border-radius:10px;
        font-size:14px;
        font-weight:500;
        display:none;
        text-align:center;
    }
    .sc-result.success {
        background:rgba(34,197,94,0.15);
        border:1px solid rgba(34,197,94,0.3);
        color:#4ade80;
        display:block;
    }
    .sc-result.error {
        background:rgba(239,68,68,0.15);
        border:1px solid rgba(239,68,68,0.3);
        color:#f87171;
        display:block;
    }

    /* Info section */
    .sc-info {
        max-width:700px;
        margin:0 auto 60px;
        padding:0 24px;
    }
    .sc-info-title {
        font-size:20px;
        font-weight:700;
        color:#fff;
        text-align:center;
        margin-bottom:24px;
    }
    .sc-info-grid {
        display:grid;
        grid-template-columns:1fr;
        gap:16px;
    }
    @media(min-width:640px) {
        .sc-info-grid { grid-template-columns:repeat(2,1fr); }
    }
    .sc-info-card {
        background:rgba(30,58,95,0.3);
        border:1px solid rgba(255,255,255,0.08);
        border-radius:14px;
        padding:20px;
        text-align:center;
    }
    .sc-info-card .sc-info-usd {
        font-size:22px;
        font-weight:800;
        color:#60a5fa;
        margin-bottom:4px;
    }
    .sc-info-card .sc-info-total {
        font-size:14px;
        color:#94a3b8;
    }
    .sc-info-card .sc-info-total strong {
        color:#22c55e;
        font-weight:700;
    }

    /* Spinner */
    .sc-spinner {
        width:20px; height:20px;
        border:3px solid rgba(255,255,255,0.3);
        border-top-color:#fff;
        border-radius:50%;
        animation:spin 0.8s linear infinite;
        display:none;
    }
    @keyframes spin { to { transform:rotate(360deg); } }

    /* Footer */
    .sc-footer {
        background:rgba(0,0,0,0.3);
        padding:24px;
        text-align:center;
        border-top:1px solid rgba(255,255,255,0.06);
    }
    .sc-footer p {
        font-size:12px;
        color:#64748b;
    }
    .sc-footer a { color:#60a5fa; text-decoration:none; }
    </style>
</head>
<body>

<!-- Header -->
<header class="sc-header">
    <div class="sc-header-inner">
        <a href="https://www.imporlan.cl/" class="sc-logo">
            <div class="sc-logo-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 20l.8-2.8A2 2 0 0 1 4.6 16h14.8a2 2 0 0 1 1.8 1.2L22 20"/>
                    <path d="M4 16l-1.2-5.6A2 2 0 0 1 4.6 8h14.8a2 2 0 0 1 1.8 2.4L20 16"/>
                    <path d="M12 4v4"/>
                    <path d="M9 4h6"/>
                </svg>
            </div>
            <div class="sc-logo-text">
                <span class="sc-logo-title">IMPORLAN</span>
                <span class="sc-logo-sub">Tu lancha, puerta a puerta</span>
            </div>
        </a>
        <div class="sc-header-links">
            <a href="https://www.imporlan.cl/">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Inicio
            </a>
            <a href="https://www.imporlan.cl/cotizador-importacion/">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                Cotizador
            </a>
        </div>
    </div>
</header>

<!-- Hero -->
<section class="sc-hero">
    <div class="sc-hero-badge">Herramienta Interna</div>
    <h1>Simulacion de <span>Costos de Importacion</span></h1>
    <p>Envia al cliente una simulacion completa con los costos estimados para importar una embarcacion desde USA a Chile, en distintos rangos de precio.</p>
</section>

<!-- Form -->
<section class="sc-form-section">
    <div class="sc-form-card">
        <div class="sc-form-title">Datos del Cliente</div>
        <div class="sc-form-subtitle">Ingrese el nombre y email del cliente. Se le enviara un correo con todas las simulaciones.</div>

        <form id="simulacionForm" onsubmit="return enviarSimulacion(event)">
            <div class="sc-field">
                <label class="sc-label" for="nombre">Nombre del Cliente</label>
                <input type="text" id="nombre" name="nombre" class="sc-input" placeholder="Ej: Juan Perez" required>
            </div>
            <div class="sc-field">
                <label class="sc-label" for="email">Email del Cliente</label>
                <input type="email" id="email" name="email" class="sc-input" placeholder="Ej: cliente@email.com" required>
            </div>
            <button type="submit" class="sc-btn" id="btnEnviar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                <span id="btnText">Enviar Simulacion por Email</span>
                <div class="sc-spinner" id="spinner"></div>
            </button>
        </form>

        <div class="sc-result" id="resultado"></div>
    </div>
</section>

<!-- Summary cards -->
<section class="sc-info">
    <div class="sc-info-title">Resumen de Simulaciones Incluidas</div>
    <div class="sc-info-grid">
        <?php foreach ($simulaciones as $sim): ?>
        <div class="sc-info-card">
            <div class="sc-info-usd">USD $<?= number_format($sim['usd'], 0, ',', '.') ?></div>
            <div class="sc-info-total">Total CLP: <strong>$<?= number_format($sim['total'], 0, ',', '.') ?></strong></div>
        </div>
        <?php endforeach; ?>
    </div>
</section>

<!-- Footer -->
<footer class="sc-footer">
    <p>&copy; <?= $year ?> <a href="https://www.imporlan.cl/">IMPORLAN</a> - Importacion de Embarcaciones. Tipo de cambio: 1 USD = $<?= number_format($DOLAR_COMPRA, 0, ',', '.') ?> CLP</p>
</footer>

<script>
async function enviarSimulacion(e) {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const btn = document.getElementById('btnEnviar');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('spinner');
    const resultado = document.getElementById('resultado');

    if (!nombre || !email) {
        resultado.className = 'sc-result error';
        resultado.textContent = 'Por favor complete todos los campos.';
        return false;
    }

    // Show loading
    btn.disabled = true;
    btnText.textContent = 'Enviando...';
    spinner.style.display = 'inline-block';
    resultado.style.display = 'none';

    try {
        const formData = new FormData();
        formData.append('action', 'enviar_simulacion');
        formData.append('nombre', nombre);
        formData.append('email', email);

        const response = await fetch(window.location.href, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        resultado.className = 'sc-result ' + (data.success ? 'success' : 'error');
        resultado.textContent = data.message;

        if (data.success) {
            document.getElementById('simulacionForm').reset();
        }
    } catch (err) {
        resultado.className = 'sc-result error';
        resultado.textContent = 'Error de conexion. Intente nuevamente.';
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Enviar Simulacion por Email';
        spinner.style.display = 'none';
    }

    return false;
}
</script>

</body>
</html>
