<?php
/**
 * Imporlan - Cotizador de Importacion de Embarcaciones
 * Standalone quotation tool for boat import services.
 * Features: multi-step wizard, editable quotation items, PDF download, email sending.
 * Version: 1.0.0
 */

// ── Handle email sending AJAX ──
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'enviar_cotizacion') {
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');

    $nombre       = trim($_POST['nombre'] ?? '');
    $email        = trim($_POST['email'] ?? '');
    $telefono     = trim($_POST['telefono'] ?? '');
    $empresa      = trim($_POST['empresa'] ?? '');
    $pais_origen  = trim($_POST['pais_origen'] ?? '');
    $tipo         = trim($_POST['tipo_embarcacion'] ?? '');
    $marca        = trim($_POST['marca'] ?? '');
    $modelo       = trim($_POST['modelo'] ?? '');
    $anio         = trim($_POST['anio'] ?? '');
    $ubicacion    = trim($_POST['ubicacion'] ?? '');
    $valor_lancha = trim($_POST['valor_lancha'] ?? '0');
    $valor_servicio = trim($_POST['valor_servicio'] ?? '0');
    $valor_iva    = trim($_POST['valor_iva'] ?? '0');
    $valor_lujo   = trim($_POST['valor_lujo'] ?? '0');
    $total        = trim($_POST['total'] ?? '0');
    $cotizacion_num = trim($_POST['cotizacion_num'] ?? '');
    $fecha        = trim($_POST['fecha'] ?? '');
    $pdf_html     = $_POST['pdf_html'] ?? '';

    if (!$nombre || !$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Datos incompletos o email invalido.']);
        exit;
    }

    // ── Build HTML email ──
    $emailHtml = buildEmailHTML($nombre, $email, $telefono, $empresa, $pais_origen,
        $tipo, $marca, $modelo, $anio, $ubicacion,
        $valor_lancha, $valor_servicio, $valor_iva, $valor_lujo, $total,
        $cotizacion_num, $fecha);

    // ── Generate PDF with DOMPDF ──
    $pdfAttachmentPath = null;
    $dompdfAutoload = __DIR__ . '/../lib/dompdf/autoload.inc.php';
    if (file_exists($dompdfAutoload) && $pdf_html) {
        try {
            require_once $dompdfAutoload;
            $dompdf = new \Dompdf\Dompdf(['isRemoteEnabled' => false, 'isHtml5ParserEnabled' => true]);
            $dompdf->loadHtml($pdf_html);
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();
            $pdfContent = $dompdf->output();
            $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $nombre);
            $pdfFilename = 'Cotizacion-Imporlan-' . $safeName . '.pdf';
            $tmpPath = sys_get_temp_dir() . '/' . $pdfFilename;
            file_put_contents($tmpPath, $pdfContent);
            $pdfAttachmentPath = $tmpPath;
        } catch (\Throwable $e) {
            // Continue without PDF if DOMPDF fails (catch Error + Exception)
            error_log('DOMPDF error: ' . $e->getMessage());
        }
    }

    // ── Send email ──
    $subject = "Cotizacion de Importacion - $cotizacion_num - $nombre";
    $boundary = md5(time());

    $headers  = "From: Imporlan <contacto@imporlan.cl>\r\n";
    $headers .= "Reply-To: contacto@imporlan.cl\r\n";
    $headers .= "Bcc: jpchs1@gmail.com\r\n";
    $headers .= "MIME-Version: 1.0\r\n";

    // ── Collect user-uploaded attachments ──
    $userAttachments = [];
    if (!empty($_FILES['attachments'])) {
        $maxFileSize = 10 * 1024 * 1024; // 10MB per file
        $allowedExts = ['pdf','doc','docx','xls','xlsx','jpg','jpeg','png','gif','mp4','mov','avi','webm','mp3','wav'];
        $fileCount = is_array($_FILES['attachments']['name']) ? count($_FILES['attachments']['name']) : 0;
        for ($i = 0; $i < $fileCount; $i++) {
            if ($_FILES['attachments']['error'][$i] !== UPLOAD_ERR_OK) continue;
            if ($_FILES['attachments']['size'][$i] > $maxFileSize) continue;
            $origName = basename($_FILES['attachments']['name'][$i]);
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExts)) continue;
            $tmpPath = $_FILES['attachments']['tmp_name'][$i];
            $mimeType = mime_content_type($tmpPath) ?: 'application/octet-stream';
            $userAttachments[] = ['path' => $tmpPath, 'name' => $origName, 'mime' => $mimeType];
        }
    }

    $hasAttachments = ($pdfAttachmentPath && file_exists($pdfAttachmentPath)) || !empty($userAttachments);

    if ($hasAttachments) {
        $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";
        $body  = "--$boundary\r\n";
        $body .= "Content-Type: text/html; charset=UTF-8\r\n";
        $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
        $body .= $emailHtml . "\r\n\r\n";

        // Attach PDF
        if ($pdfAttachmentPath && file_exists($pdfAttachmentPath)) {
            $body .= "--$boundary\r\n";
            $body .= "Content-Type: application/pdf; name=\"" . basename($pdfAttachmentPath) . "\"\r\n";
            $body .= "Content-Transfer-Encoding: base64\r\n";
            $body .= "Content-Disposition: attachment; filename=\"" . basename($pdfAttachmentPath) . "\"\r\n\r\n";
            $body .= chunk_split(base64_encode(file_get_contents($pdfAttachmentPath))) . "\r\n";
        }

        // Attach user files
        foreach ($userAttachments as $ua) {
            $body .= "--$boundary\r\n";
            $body .= "Content-Type: " . $ua['mime'] . "; name=\"" . $ua['name'] . "\"\r\n";
            $body .= "Content-Transfer-Encoding: base64\r\n";
            $body .= "Content-Disposition: attachment; filename=\"" . $ua['name'] . "\"\r\n\r\n";
            $body .= chunk_split(base64_encode(file_get_contents($ua['path']))) . "\r\n";
        }

        $body .= "--$boundary--\r\n";
    } else {
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $body = $emailHtml;
    }

    $sent = mail($email, $subject, $body, $headers);

    // Clean up temp PDF
    if ($pdfAttachmentPath && file_exists($pdfAttachmentPath)) {
        @unlink($pdfAttachmentPath);
    }

    echo json_encode([
        'success' => $sent,
        'message' => $sent ? 'Cotizacion enviada exitosamente.' : 'Error al enviar el correo. Intente nuevamente.'
    ]);
    exit;
}

// ── Build email HTML template ──
function buildEmailHTML($nombre, $email, $telefono, $empresa, $pais_origen,
    $tipo, $marca, $modelo, $anio, $ubicacion,
    $valor_lancha, $valor_servicio, $valor_iva, $valor_lujo, $total,
    $cotizacion_num, $fecha) {

    $h = function($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); };

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
    <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
        <!-- Premium Header Band -->
        <tr><td style="background:#0c1e3d;padding:0;">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="padding:28px 36px;">
                        <table cellpadding="0" cellspacing="0"><tr>
                            <td style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#0ea5e9,#6366f1);text-align:center;line-height:48px;">
                                <span style="color:white;font-size:24px;">&#9973;</span>
                            </td>
                            <td style="padding-left:14px;">
                                <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:2px;">IMPORLAN</div>
                                <div style="font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:0.5px;">Tu lancha, puerta a puerta</div>
                            </td>
                        </tr></table>
                    </td>
                    <td style="padding:28px 36px;text-align:right;">
                        <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:rgba(255,255,255,0.4);">Cotizacion</div>
                        <div style="font-size:15px;font-weight:800;color:#38bdf8;">' . $h($cotizacion_num) . '</div>
                        <div style="font-size:10px;color:rgba(255,255,255,0.4);">' . $h($fecha) . '</div>
                    </td>
                </tr>
            </table>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 36px;">
            <div style="font-size:17px;font-weight:700;color:#0c1e3d;margin-bottom:6px;">Estimado/a ' . $h($nombre) . ',</div>
            <div style="font-size:14px;color:#64748b;margin-bottom:28px;line-height:1.7;">
                Gracias por su interes en nuestro servicio de importacion. A continuacion encontrara el detalle de su cotizacion:
            </div>
            <!-- Boat Data -->
            <div style="background:#f8fafc;border-radius:12px;padding:20px 24px;margin-bottom:20px;border-left:3px solid #0ea5e9;">
                <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #f1f5f9;">Datos de la Embarcacion</div>
                <table width="100%" cellpadding="5" cellspacing="0" style="font-size:13px;">
                    <tr><td style="color:#94a3b8;font-weight:600;width:110px;">Tipo</td><td style="color:#1e293b;font-weight:500;">' . $h($tipo) . '</td></tr>
                    <tr><td style="color:#94a3b8;font-weight:600;">Marca</td><td style="color:#1e293b;font-weight:500;">' . $h($marca) . '</td></tr>
                    <tr><td style="color:#94a3b8;font-weight:600;">Modelo</td><td style="color:#1e293b;font-weight:500;">' . $h($modelo) . '</td></tr>
                    <tr><td style="color:#94a3b8;font-weight:600;">Ano</td><td style="color:#1e293b;font-weight:500;">' . $h($anio) . '</td></tr>
                    <tr><td style="color:#94a3b8;font-weight:600;">Ubicacion</td><td style="color:#1e293b;font-weight:500;">' . $h($ubicacion) . '</td></tr>
                </table>
            </div>
            <!-- Quotation Items -->
            <div style="margin-bottom:20px;">
                <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #f1f5f9;padding-left:12px;border-left:3px solid #6366f1;">Cotizacion Itemizada</div>
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
                    <tr><td style="padding:10px 14px;background:#f8fafc;border-radius:8px 0 0 8px;border-left:3px solid #0ea5e9;color:#1e293b;">Valor Lancha</td><td style="padding:10px 14px;background:#f8fafc;border-radius:0 8px 8px 0;color:#0c1e3d;font-weight:800;text-align:right;">$' . $h($valor_lancha) . '</td></tr>
                    <tr><td colspan="2" style="height:5px;"></td></tr>
                    <tr><td style="padding:10px 14px;background:#f8fafc;border-radius:8px 0 0 8px;border-left:3px solid #6366f1;color:#1e293b;">Valor Servicio All-Inclusive</td><td style="padding:10px 14px;background:#f8fafc;border-radius:0 8px 8px 0;color:#0c1e3d;font-weight:800;text-align:right;">$' . $h($valor_servicio) . '</td></tr>
                    <tr><td colspan="2" style="height:5px;"></td></tr>
                    <tr><td style="padding:10px 14px;background:#f8fafc;border-radius:8px 0 0 8px;border-left:3px solid #f59e0b;color:#1e293b;">IVA (Sobre valor CIF)</td><td style="padding:10px 14px;background:#f8fafc;border-radius:0 8px 8px 0;color:#0c1e3d;font-weight:800;text-align:right;">$' . $h($valor_iva) . '</td></tr>
                    <tr><td colspan="2" style="height:5px;"></td></tr>
                    <tr><td style="padding:10px 14px;background:#f8fafc;border-radius:8px 0 0 8px;border-left:3px solid #10b981;color:#1e293b;">Impuesto al Lujo</td><td style="padding:10px 14px;background:#f8fafc;border-radius:0 8px 8px 0;color:#0c1e3d;font-weight:800;text-align:right;">$' . $h($valor_lujo) . '</td></tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
                    <tr><td style="background:#0c1e3d;color:rgba(255,255,255,0.7);padding:14px 18px;border-radius:10px 0 0 10px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">TOTAL</td>
                    <td style="background:#0c1e3d;color:#38bdf8;padding:14px 18px;border-radius:0 10px 10px 0;font-size:20px;font-weight:800;text-align:right;">$' . $h($total) . '</td></tr>
                </table>
            </div>
            <!-- All-Inclusive -->
            <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:18px 22px;margin-bottom:20px;">
                <div style="font-size:10px;font-weight:700;color:#0369a1;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">&#9989; Servicio All-Inclusive incluye:</div>
                <div style="font-size:11px;color:#475569;line-height:1.7;">
                    <div style="margin-bottom:8px;"><strong style="color:#0369a1;">Gestiones en USA:</strong><br>Trailer (solo si no trae) &bull; Transferencia bancaria (FEE Wire) &bull; Revision e Inspeccion Tecnica USA &bull; Inland USA - Bodegaje & Entrega en Puerto</div>
                    <div style="margin-bottom:8px;"><strong style="color:#0369a1;">Naviera (Transporte Maritimo):</strong><br>Transporte Maritimo (RORO) &bull; Certificado de Fumigacion &bull; Seguro / Insurance &bull; Gastos Locales Naviera &bull; Congestion Surcharge &bull; THC / BAF / WHARFAGE &bull; Handling Chile &bull; Miami Admin FEE &bull; Escorte (Port Pass)</div>
                    <div style="margin-bottom:8px;"><strong style="color:#0369a1;">Servicios en Chile:</strong><br>Inland Puerto - Santiago &bull; Chequeo Mecanico &bull; Pulido y Tratamiento &bull; Entrega / Traslado</div>
                    <div><strong style="color:#0369a1;">Agencia de Aduanas & Desembolsos:</strong><br>Autorizaciones &bull; Gastos de Puerto &bull; Agencia de Aduana &bull; IVA Servicios &bull; Gastos de Despachos &bull; Honorarios Agencia</div>
                </div>
            </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="font-size:10px;color:#94a3b8;">Gracias por su interes en IMPORLAN.<br>Nuestro equipo le contactara a la brevedad.</td>
                <td style="font-size:10px;font-weight:600;color:#0c1e3d;text-align:right;">+56 9 4021 1459<br>contacto@imporlan.cl<br>imporlan.cl</td>
            </tr></table>
        </td></tr>
        <tr><td style="padding:10px 36px 16px;text-align:center;">
            <div style="font-size:8px;color:#94a3b8;font-style:italic;">* Los valores son referenciales en Pesos Chilenos (CLP) y pueden variar segun tipo de cambio, temporada y condiciones. Esta cotizacion no constituye un compromiso de compra.</div>
        </td></tr>
    </table>
    </td></tr></table></body></html>';
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
    <title>Cotizador de Importacion | IMPORLAN Chile</title>
    <meta name="description" content="Herramienta de cotizacion para importacion de embarcaciones a Chile. Servicio All-Inclusive puerta a puerta. Cotiza tu lancha, velero, yate o moto de agua.">
    <meta name="robots" content="noindex, nofollow">
    <link rel="icon" type="image/svg+xml" href="/images/imporlan-favicon.svg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
    /* =============================================
       IMPORLAN COTIZADOR - v2.0 (Modern Redesign)
       ============================================= */
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body {
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        background:#060d1a;
        color:#e2e8f0;
        line-height:1.6;
        min-height:100vh;
    }

    /* ── Header ── */
    .ic-header {
        background:rgba(6,13,26,0.92);
        backdrop-filter:blur(16px);
        -webkit-backdrop-filter:blur(16px);
        border-bottom:1px solid rgba(99,179,237,0.1);
        padding:14px 0;
        position:sticky;
        top:0;
        z-index:100;
    }
    .ic-header-inner {
        max-width:1200px;
        margin:0 auto;
        padding:0 28px;
        display:flex;
        align-items:center;
        justify-content:space-between;
    }
    .ic-logo {
        display:flex;
        align-items:center;
        gap:14px;
        text-decoration:none;
    }
    .ic-logo-icon {
        width:46px; height:46px;
        border-radius:14px;
        background:linear-gradient(135deg,#0ea5e9,#6366f1);
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 4px 16px rgba(14,165,233,0.35);
    }
    .ic-logo-icon svg { width:24px; height:24px; }
    .ic-logo-text { display:flex; flex-direction:column; }
    .ic-logo-title { font-size:18px; font-weight:800; color:#fff; letter-spacing:1.5px; }
    .ic-logo-sub { font-size:10px; color:#64748b; letter-spacing:0.5px; }
    .ic-header-links {
        display:flex;
        align-items:center;
        gap:6px;
    }
    .ic-header-links a {
        display:inline-flex;
        align-items:center;
        gap:7px;
        font-size:13px;
        font-weight:500;
        color:#64748b;
        text-decoration:none;
        padding:8px 14px;
        border-radius:10px;
        transition:all 0.25s;
        border:1px solid transparent;
    }
    .ic-header-links a:hover {
        color:#e2e8f0;
        background:rgba(255,255,255,0.05);
        border-color:rgba(255,255,255,0.08);
    }
    .ic-header-links svg { width:16px; height:16px; flex-shrink:0; }

    /* ── Hero ── */
    .ic-hero {
        background:linear-gradient(160deg,#060d1a 0%,#0c1e3d 45%,#0d2247 70%,#060d1a 100%);
        padding:72px 24px 64px;
        text-align:center;
        position:relative;
        overflow:hidden;
    }
    .ic-hero::before {
        content:'';
        position:absolute;
        top:-30%;
        left:50%;
        transform:translateX(-50%);
        width:900px; height:600px;
        border-radius:50%;
        background:radial-gradient(ellipse,rgba(14,165,233,0.07) 0%,rgba(99,102,241,0.04) 40%,transparent 70%);
        pointer-events:none;
    }
    .ic-hero::after {
        content:'';
        position:absolute;
        bottom:-10%;
        right:-5%;
        width:400px; height:400px;
        border-radius:50%;
        background:radial-gradient(circle,rgba(99,102,241,0.05) 0%,transparent 70%);
        pointer-events:none;
    }
    .ic-hero-badge {
        display:inline-flex;
        align-items:center;
        gap:8px;
        background:rgba(14,165,233,0.1);
        border:1px solid rgba(14,165,233,0.25);
        color:#38bdf8;
        font-size:11px;
        font-weight:700;
        letter-spacing:2.5px;
        text-transform:uppercase;
        padding:9px 22px;
        border-radius:100px;
        margin-bottom:28px;
    }
    .ic-hero-badge::before {
        content:'';
        width:6px; height:6px;
        border-radius:50%;
        background:#38bdf8;
        box-shadow:0 0 8px #38bdf8;
        animation:icPulse 2s ease-in-out infinite;
    }
    @keyframes icPulse {
        0%,100% { opacity:1; transform:scale(1); }
        50% { opacity:0.5; transform:scale(0.8); }
    }
    .ic-hero h1 {
        color:#f8fafc;
        font-size:46px;
        font-weight:300;
        line-height:1.12;
        margin-bottom:18px;
        letter-spacing:-1px;
    }
    .ic-hero h1 strong {
        font-weight:800;
        background:linear-gradient(135deg,#38bdf8 0%,#818cf8 50%,#34d399 100%);
        -webkit-background-clip:text;
        -webkit-text-fill-color:transparent;
        background-clip:text;
    }
    .ic-hero-sub {
        color:#64748b;
        font-size:16px;
        font-weight:400;
        max-width:580px;
        margin:0 auto;
        line-height:1.75;
    }

    /* ── Steps Indicator ── */
    .ic-steps {
        display:flex;
        justify-content:center;
        align-items:center;
        gap:0;
        margin:44px auto 0;
        max-width:540px;
        position:relative;
    }
    .ic-step-item {
        display:flex;
        flex-direction:column;
        align-items:center;
        position:relative;
        z-index:2;
        flex:1;
    }
    .ic-step-circle {
        width:44px; height:44px;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:14px;
        font-weight:700;
        background:rgba(255,255,255,0.04);
        color:rgba(255,255,255,0.25);
        border:2px solid rgba(255,255,255,0.08);
        transition:all 0.4s cubic-bezier(0.4,0,0.2,1);
        margin-bottom:10px;
    }
    .ic-step-item.active .ic-step-circle {
        background:linear-gradient(135deg,#0ea5e9,#6366f1);
        color:#fff;
        border-color:transparent;
        box-shadow:0 0 0 4px rgba(14,165,233,0.15),0 4px 20px rgba(14,165,233,0.4);
    }
    .ic-step-item.completed .ic-step-circle {
        background:linear-gradient(135deg,#10b981,#059669);
        color:#fff;
        border-color:transparent;
        box-shadow:0 4px 16px rgba(16,185,129,0.35);
    }
    .ic-step-label {
        font-size:10px;
        font-weight:600;
        color:rgba(255,255,255,0.25);
        transition:color 0.4s;
        text-align:center;
        letter-spacing:0.5px;
        text-transform:uppercase;
    }
    .ic-step-item.active .ic-step-label { color:#38bdf8; }
    .ic-step-item.completed .ic-step-label { color:rgba(255,255,255,0.6); }
    .ic-step-line {
        flex:1;
        height:2px;
        background:rgba(255,255,255,0.06);
        position:relative;
        top:-20px;
        z-index:1;
        transition:background 0.4s;
    }
    .ic-step-line.completed { background:linear-gradient(90deg,#10b981,#059669); }

    /* ── Main ── */
    .ic-main {
        max-width:900px;
        margin:-32px auto 0;
        padding:0 24px 80px;
        position:relative;
        z-index:10;
    }
    .ic-card {
        background:rgba(12,20,38,0.85);
        backdrop-filter:blur(24px);
        -webkit-backdrop-filter:blur(24px);
        border-radius:28px;
        box-shadow:0 0 0 1px rgba(255,255,255,0.05),0 24px 64px rgba(0,0,0,0.5),0 8px 24px rgba(0,0,0,0.3);
        border:1px solid rgba(255,255,255,0.06);
        overflow:hidden;
        position:relative;
    }
    .ic-card::before {
        content:'';
        position:absolute;
        top:0; left:0; right:0;
        height:1px;
        background:linear-gradient(90deg,transparent,rgba(14,165,233,0.4),rgba(99,102,241,0.4),transparent);
    }
    .ic-card-body { padding:48px 44px; }

    /* ── Panels ── */
    .ic-panel { display:none; animation:icFadeIn 0.45s cubic-bezier(0.4,0,0.2,1); }
    .ic-panel.active { display:block; }
    @keyframes icFadeIn {
        from { opacity:0; transform:translateY(16px); }
        to { opacity:1; transform:translateY(0); }
    }
    .ic-panel-title {
        font-size:26px;
        font-weight:700;
        color:#f8fafc;
        margin-bottom:6px;
        letter-spacing:-0.3px;
    }
    .ic-panel-subtitle {
        font-size:14px;
        color:#64748b;
        margin-bottom:36px;
        line-height:1.65;
    }

    /* ── Form Fields ── */
    .ic-field-row {
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:20px;
        margin-bottom:20px;
    }
    .ic-field-row.single { grid-template-columns:1fr; }
    .ic-field-row.triple { grid-template-columns:1fr 1fr 1fr; }
    .ic-field { display:flex; flex-direction:column; }
    .ic-field label {
        font-size:12px;
        font-weight:600;
        color:#94a3b8;
        margin-bottom:8px;
        letter-spacing:0.5px;
        text-transform:uppercase;
    }
    .ic-field label .ic-required { color:#f87171; margin-left:2px; }
    .ic-field input,
    .ic-field select,
    .ic-field textarea {
        width:100%;
        padding:14px 18px;
        border:1.5px solid rgba(255,255,255,0.07);
        border-radius:14px;
        font-size:15px;
        font-family:inherit;
        color:#e2e8f0;
        background:rgba(255,255,255,0.04);
        transition:all 0.25s;
        outline:none;
    }
    .ic-field input:hover,
    .ic-field select:hover {
        border-color:rgba(255,255,255,0.12);
        background:rgba(255,255,255,0.05);
    }
    .ic-field input:focus,
    .ic-field select:focus,
    .ic-field textarea:focus {
        border-color:#0ea5e9;
        box-shadow:0 0 0 3px rgba(14,165,233,0.12);
        background:rgba(14,165,233,0.04);
    }
    .ic-field input::placeholder,
    .ic-field textarea::placeholder { color:#334155; }
    .ic-field textarea { min-height:100px; resize:vertical; }
    .ic-field select {
        appearance:none;
        background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%2364748b'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
        background-repeat:no-repeat;
        background-position:right 16px center;
        background-size:18px;
        padding-right:44px;
        cursor:pointer;
    }
    .ic-field select option { background:#0f1e38; color:#e2e8f0; }

    /* ── Navigation Buttons ── */
    .ic-nav {
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-top:36px;
        gap:16px;
    }
    .ic-btn {
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding:14px 30px;
        border-radius:14px;
        font-size:15px;
        font-weight:600;
        font-family:inherit;
        cursor:pointer;
        transition:all 0.25s cubic-bezier(0.4,0,0.2,1);
        border:none;
        text-decoration:none;
        letter-spacing:0.1px;
    }
    .ic-btn svg { width:18px; height:18px; flex-shrink:0; }
    .ic-btn-primary {
        background:linear-gradient(135deg,#0ea5e9,#6366f1);
        color:#fff;
        box-shadow:0 4px 20px rgba(14,165,233,0.3);
    }
    .ic-btn-primary:hover {
        transform:translateY(-2px);
        box-shadow:0 8px 28px rgba(14,165,233,0.45);
        filter:brightness(1.08);
    }
    .ic-btn-secondary {
        background:rgba(255,255,255,0.05);
        color:#64748b;
        border:1.5px solid rgba(255,255,255,0.08);
    }
    .ic-btn-secondary:hover {
        background:rgba(255,255,255,0.08);
        color:#e2e8f0;
        border-color:rgba(255,255,255,0.15);
    }
    .ic-btn-success {
        background:linear-gradient(135deg,#10b981,#059669);
        color:#fff;
        box-shadow:0 4px 20px rgba(16,185,129,0.3);
    }
    .ic-btn-success:hover {
        transform:translateY(-2px);
        box-shadow:0 8px 28px rgba(16,185,129,0.45);
    }

    /* ── Quotation Table ── */
    .ic-quote-table {
        width:100%;
        border-collapse:separate;
        border-spacing:0 4px;
        margin-bottom:16px;
    }
    .ic-quote-table thead th {
        font-size:10px;
        font-weight:700;
        text-transform:uppercase;
        letter-spacing:1.5px;
        color:#475569;
        padding:10px 16px;
        text-align:left;
    }
    .ic-quote-table thead th:nth-child(2),
    .ic-quote-table thead th:nth-child(3) { text-align:right; }
    .ic-quote-table tbody tr {
        background:rgba(255,255,255,0.03);
        transition:background 0.2s;
    }
    .ic-quote-table tbody tr:hover { background:rgba(14,165,233,0.05); }
    .ic-quote-table tbody td {
        padding:14px 16px;
        font-size:14px;
        vertical-align:middle;
    }
    .ic-quote-table tbody td:first-child {
        font-weight:600;
        color:#cbd5e1;
        border-radius:12px 0 0 12px;
    }
    .ic-quote-table tbody td:nth-child(2),
    .ic-quote-table tbody td:nth-child(3) { text-align:right; }
    .ic-quote-table tbody td:last-child { border-radius:0 12px 12px 0; }
    .ic-quote-input {
        width:150px;
        padding:10px 14px;
        border:1.5px solid rgba(255,255,255,0.07);
        border-radius:10px;
        font-size:14px;
        font-weight:600;
        font-family:inherit;
        color:#e2e8f0;
        background:rgba(255,255,255,0.05);
        text-align:right;
        outline:none;
        transition:all 0.25s;
    }
    .ic-quote-input:focus {
        border-color:#0ea5e9;
        box-shadow:0 0 0 3px rgba(14,165,233,0.12);
        background:rgba(14,165,233,0.04);
    }
    .ic-quote-pct {
        display:inline-block;
        min-width:52px;
        padding:5px 10px;
        background:rgba(14,165,233,0.1);
        border-radius:8px;
        font-size:12px;
        font-weight:700;
        color:#38bdf8;
        text-align:center;
        letter-spacing:0.3px;
    }
    .ic-quote-total-row td {
        background:linear-gradient(135deg,#0c2044,#0f2a5a) !important;
        padding:18px 16px !important;
        border:none !important;
    }
    .ic-quote-total-row td:first-child {
        font-size:15px;
        font-weight:800;
        color:#f8fafc;
        border-radius:14px 0 0 14px !important;
        letter-spacing:0.5px;
    }
    .ic-quote-total-row td:nth-child(2) {
        font-size:20px;
        font-weight:800;
        color:#38bdf8;
    }
    .ic-quote-total-row td:last-child {
        border-radius:0 14px 14px 0 !important;
    }

    /* ── All-Inclusive Info Box ── */
    .ic-allinclusive {
        background:rgba(14,165,233,0.04);
        border:1px solid rgba(14,165,233,0.15);
        border-radius:16px;
        padding:20px 24px;
        margin-top:20px;
        position:relative;
        overflow:hidden;
    }
    .ic-allinclusive::before {
        content:'';
        position:absolute;
        top:0; left:0;
        width:3px; height:100%;
        background:linear-gradient(180deg,#0ea5e9,#6366f1);
        border-radius:3px 0 0 3px;
    }
    .ic-allinclusive-title {
        font-size:12px;
        font-weight:700;
        color:#38bdf8;
        margin-bottom:14px;
        display:flex;
        align-items:center;
        gap:8px;
        text-transform:uppercase;
        letter-spacing:1px;
    }
    .ic-allinclusive-list {
        font-size:12px;
        color:#94a3b8;
        line-height:1.6;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:12px;
    }
    .ic-allinc-cat {
        background:rgba(255,255,255,0.02);
        border:1px solid rgba(255,255,255,0.05);
        border-radius:10px;
        padding:12px 14px;
    }
    .ic-allinc-cat-title {
        font-size:11px;
        font-weight:700;
        color:#94a3b8;
        margin-bottom:8px;
        padding-bottom:6px;
        border-bottom:1px solid rgba(255,255,255,0.06);
    }
    .ic-allinc-cat-items {
        font-size:11px;
        color:#64748b;
        line-height:1.8;
    }

    /* ── Summary ── */
    .ic-summary {
        background:rgba(255,255,255,0.02);
        border:1px solid rgba(255,255,255,0.06);
        border-radius:18px;
        padding:28px;
        margin-bottom:28px;
        position:relative;
        overflow:hidden;
    }
    .ic-summary::before {
        content:'';
        position:absolute;
        top:0; left:0; right:0;
        height:1px;
        background:linear-gradient(90deg,transparent,rgba(14,165,233,0.3),transparent);
    }
    .ic-summary-title {
        font-size:11px;
        font-weight:700;
        color:#475569;
        margin-bottom:20px;
        display:flex;
        align-items:center;
        gap:10px;
        text-transform:uppercase;
        letter-spacing:1.5px;
    }
    .ic-summary-title svg { fill:#475569; }
    .ic-summary-row {
        display:flex;
        justify-content:space-between;
        padding:10px 0;
        border-bottom:1px solid rgba(255,255,255,0.04);
        font-size:14px;
    }
    .ic-summary-row:last-child { border-bottom:none; }
    .ic-summary-label { color:#64748b; font-weight:500; }
    .ic-summary-value { color:#cbd5e1; font-weight:600; text-align:right; max-width:60%; }

    /* ── Action Buttons ── */
    .ic-actions {
        display:grid;
        grid-template-columns:1fr 1fr 1fr;
        gap:14px;
        margin-bottom:24px;
    }
    .ic-action-btn {
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:10px;
        padding:24px 16px;
        border-radius:18px;
        border:1px solid rgba(255,255,255,0.07);
        background:rgba(255,255,255,0.03);
        color:#64748b;
        font-size:13px;
        font-weight:600;
        cursor:pointer;
        transition:all 0.25s cubic-bezier(0.4,0,0.2,1);
        text-decoration:none;
        font-family:inherit;
        letter-spacing:0.2px;
    }
    .ic-action-btn:hover {
        background:rgba(14,165,233,0.08);
        border-color:rgba(14,165,233,0.25);
        color:#38bdf8;
        transform:translateY(-3px);
        box-shadow:0 8px 24px rgba(14,165,233,0.15);
    }
    .ic-action-btn svg { width:28px; height:28px; }
    .ic-action-btn.sending {
        opacity:0.5;
        pointer-events:none;
    }

    /* ── Preview Modal ── */
    .ic-preview-overlay {
        display:none;
        position:fixed;
        inset:0;
        background:rgba(0,0,0,0.85);
        backdrop-filter:blur(12px);
        -webkit-backdrop-filter:blur(12px);
        z-index:1000;
        overflow-y:auto;
        padding:32px 20px;
    }
    .ic-preview-overlay.visible { display:flex; justify-content:center; align-items:flex-start; }
    .ic-preview-container {
        width:100%;
        max-width:760px;
        background:#fff;
        border-radius:20px;
        overflow:hidden;
        box-shadow:0 32px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.1);
    }
    .ic-preview-toolbar {
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:14px 24px;
        background:#f8fafc;
        border-bottom:1px solid #e2e8f0;
    }
    .ic-preview-toolbar-title {
        font-size:13px;
        font-weight:600;
        color:#475569;
        letter-spacing:0.3px;
    }
    .ic-preview-toolbar-actions { display:flex; gap:10px; }
    .ic-preview-toolbar-btn {
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:8px 18px;
        border-radius:10px;
        font-size:13px;
        font-weight:600;
        font-family:inherit;
        cursor:pointer;
        border:none;
        transition:all 0.2s;
    }
    .ic-preview-toolbar-btn svg { width:15px; height:15px; }
    .ic-btn-pdf { background:linear-gradient(135deg,#0ea5e9,#6366f1); color:#fff; box-shadow:0 2px 8px rgba(14,165,233,0.3); }
    .ic-btn-pdf:hover { filter:brightness(1.1); transform:translateY(-1px); }
    .ic-btn-close-preview { background:#e2e8f0; color:#475569; }
    .ic-btn-close-preview:hover { background:#cbd5e1; }

    /* ── Quote Document (inside preview) ── */
    .ic-quote-doc {
        padding:0;
        color:#1e293b;
        font-size:14px;
        line-height:1.6;
    }
    /* Premium header band */
    .ic-qdoc-band {
        background:linear-gradient(135deg,#0c1e3d 0%,#1a3a6e 50%,#0e2a5a 100%);
        padding:32px 40px;
        display:flex;
        align-items:center;
        justify-content:space-between;
    }
    .ic-qdoc-logo {
        display:flex;
        align-items:center;
        gap:14px;
    }
    .ic-qdoc-logo-icon {
        width:48px; height:48px;
        border-radius:12px;
        background:linear-gradient(135deg,#0ea5e9,#6366f1);
        display:flex;
        align-items:center;
        justify-content:center;
        color:#fff;
        font-size:24px;
        box-shadow:0 4px 16px rgba(14,165,233,0.4);
    }
    .ic-qdoc-logo-text { font-size:22px; font-weight:800; color:#fff; letter-spacing:2px; }
    .ic-qdoc-logo-sub { font-size:10px; color:rgba(255,255,255,0.45); letter-spacing:0.5px; }
    .ic-qdoc-band-right { text-align:right; }
    .ic-qdoc-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:2.5px; color:rgba(255,255,255,0.4); margin-bottom:4px; }
    .ic-qdoc-number { font-size:16px; font-weight:800; color:#38bdf8; letter-spacing:0.5px; }
    .ic-qdoc-date { font-size:11px; color:rgba(255,255,255,0.4); margin-top:3px; }
    /* Document body */
    .ic-qdoc-body { padding:36px 40px; }
    .ic-qdoc-intro { margin-bottom:28px; }
    .ic-qdoc-title { font-size:22px; font-weight:800; color:#0c1e3d; margin-bottom:4px; letter-spacing:-0.3px; }
    .ic-qdoc-client { font-size:14px; color:#64748b; }
    .ic-qdoc-client strong { color:#0c1e3d; }
    .ic-qdoc-section { margin-bottom:24px; }
    .ic-qdoc-section-title {
        font-size:10px;
        font-weight:700;
        text-transform:uppercase;
        letter-spacing:2px;
        color:#94a3b8;
        margin-bottom:12px;
        padding-bottom:8px;
        border-bottom:1px solid #f1f5f9;
        display:flex;
        align-items:center;
        gap:8px;
    }
    .ic-qdoc-section-title::before {
        content:'';
        width:3px; height:14px;
        background:linear-gradient(180deg,#0ea5e9,#6366f1);
        border-radius:2px;
        flex-shrink:0;
    }
    .ic-qdoc-table { width:100%; border-collapse:collapse; }
    .ic-qdoc-table tr:nth-child(even) td { background:#f8fafc; }
    .ic-qdoc-table td {
        padding:8px 10px;
        font-size:13px;
        vertical-align:top;
    }
    .ic-qdoc-table td:first-child { font-weight:600; color:#94a3b8; width:150px; padding-right:12px; }
    .ic-qdoc-table td:last-child { color:#1e293b; font-weight:500; }
    /* Quotation items */
    .ic-qdoc-item {
        display:flex;
        justify-content:space-between;
        align-items:center;
        padding:12px 16px;
        background:#f8fafc;
        border-radius:10px;
        margin-bottom:6px;
        border-left:3px solid #e2e8f0;
        transition:border-color 0.2s;
    }
    .ic-qdoc-item:nth-child(1) { border-left-color:#0ea5e9; }
    .ic-qdoc-item:nth-child(2) { border-left-color:#6366f1; }
    .ic-qdoc-item:nth-child(3) { border-left-color:#f59e0b; }
    .ic-qdoc-item:nth-child(4) { border-left-color:#10b981; }
    .ic-qdoc-item-name { font-size:13px; font-weight:600; color:#1e293b; }
    .ic-qdoc-item-value { font-size:14px; font-weight:800; color:#0c1e3d; }
    .ic-qdoc-item-pct {
        font-size:11px;
        font-weight:600;
        color:#fff;
        background:#94a3b8;
        padding:2px 8px;
        border-radius:100px;
        margin-left:8px;
    }
    .ic-qdoc-total {
        display:flex;
        justify-content:space-between;
        align-items:center;
        padding:16px 20px;
        background:linear-gradient(135deg,#0c1e3d,#1a3a6e);
        border-radius:12px;
        margin-top:10px;
    }
    .ic-qdoc-total-label { font-size:13px; font-weight:700; color:rgba(255,255,255,0.7); letter-spacing:1px; text-transform:uppercase; }
    .ic-qdoc-total-amount { font-size:22px; font-weight:800; color:#38bdf8; }
    /* All-inclusive in doc */
    .ic-qdoc-allinclusive {
        background:#f0f9ff;
        border:1px solid #bae6fd;
        border-radius:12px;
        padding:16px 20px;
        margin-top:20px;
    }
    .ic-qdoc-allinclusive-title {
        font-size:11px;
        font-weight:700;
        color:#0369a1;
        margin-bottom:10px;
        text-transform:uppercase;
        letter-spacing:1px;
    }
    .ic-qdoc-allinclusive-list { font-size:11px; color:#475569; line-height:1.8; }
    /* Footer */
    .ic-qdoc-footer {
        background:#f8fafc;
        border-top:1px solid #e2e8f0;
        padding:20px 40px;
        display:flex;
        align-items:center;
        justify-content:space-between;
    }
    .ic-qdoc-footer-text { font-size:11px; color:#94a3b8; line-height:1.5; }
    .ic-qdoc-footer-contact { display:flex; gap:16px; flex-wrap:wrap; }
    .ic-qdoc-footer-contact span {
        font-size:11px;
        font-weight:600;
        color:#0c1e3d;
        display:flex;
        align-items:center;
        gap:4px;
    }
    .ic-qdoc-disclaimer { font-size:9px; color:#94a3b8; margin-top:10px; font-style:italic; line-height:1.4; text-align:center; padding:0 40px 16px; }

    /* ── Timeline in document ── */
    .ic-qdoc-timeline { margin-top:24px; padding:20px 24px; background:linear-gradient(135deg,#f0f9ff,#eef2ff); border:1px solid #bae6fd; border-radius:12px; }
    .ic-qdoc-timeline-title {
        font-size:11px; font-weight:700; color:#0369a1; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:16px; text-align:center;
    }
    .ic-qdoc-timeline-steps {
        display:flex; justify-content:space-between; align-items:flex-start; gap:4px; position:relative;
    }
    .ic-qdoc-timeline-step {
        flex:1; text-align:center; position:relative; z-index:1;
    }
    .ic-qdoc-timeline-num {
        width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center;
        font-size:13px; font-weight:800; color:#fff; margin:0 auto 8px;
        background:linear-gradient(135deg,#0ea5e9,#6366f1); box-shadow:0 3px 10px rgba(14,165,233,0.3);
    }
    .ic-qdoc-timeline-step.highlight .ic-qdoc-timeline-num {
        background:linear-gradient(135deg,#f59e0b,#ef4444); box-shadow:0 3px 12px rgba(245,158,11,0.4);
        transform:scale(1.1);
    }
    .ic-qdoc-timeline-name { font-size:10px; font-weight:700; color:#0c1e3d; text-transform:uppercase; letter-spacing:0.5px; }
    .ic-qdoc-timeline-desc { font-size:9px; color:#64748b; margin-top:2px; line-height:1.3; }
    .ic-qdoc-timeline-pay { font-size:8px; font-weight:700; color:#f59e0b; margin-top:2px; }
    .ic-qdoc-timeline-connector {
        position:absolute; top:18px; left:10%; right:10%; height:2px; z-index:0;
        background:linear-gradient(90deg,#0ea5e9,#6366f1,#f59e0b,#10b981);
        border-radius:2px;
    }
    .ic-qdoc-timeline-stats {
        display:flex; justify-content:center; gap:24px; margin-top:16px; padding-top:12px; border-top:1px solid rgba(14,165,233,0.15);
    }
    .ic-qdoc-timeline-stat { text-align:center; }
    .ic-qdoc-timeline-stat-val { font-size:14px; font-weight:800; color:#0ea5e9; }
    .ic-qdoc-timeline-stat-label { font-size:8px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }

    /* ── Next Steps / CTA in document ── */
    .ic-qdoc-nextstep {
        margin-top:20px; padding:20px 24px; background:linear-gradient(135deg,#0c1e3d,#1a3a6e); border-radius:12px; text-align:center;
    }
    .ic-qdoc-nextstep-title { font-size:12px; font-weight:700; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:1.5px; margin-bottom:6px; }
    .ic-qdoc-nextstep-text { font-size:14px; color:#e2e8f0; line-height:1.6; margin-bottom:14px; }
    .ic-qdoc-nextstep-text strong { color:#38bdf8; }
    .ic-qdoc-approve-btn {
        display:inline-block; padding:14px 40px; background:linear-gradient(135deg,#10b981,#059669); color:#fff;
        font-size:14px; font-weight:700; border-radius:12px; text-decoration:none; letter-spacing:0.5px;
        box-shadow:0 4px 16px rgba(16,185,129,0.3); transition:all 0.3s; cursor:pointer; border:none;
    }
    .ic-qdoc-approve-btn:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(16,185,129,0.4); filter:brightness(1.08); }
    .ic-qdoc-approve-hint { font-size:9px; color:rgba(255,255,255,0.35); margin-top:10px; }

    /* ── File Upload Area ── */
    .ic-file-upload {
        margin-top:20px; padding:20px; border:2px dashed rgba(14,165,233,0.25); border-radius:16px;
        background:rgba(14,165,233,0.03); transition:all 0.3s;
    }
    .ic-file-upload:hover, .ic-file-upload.dragover { border-color:rgba(14,165,233,0.5); background:rgba(14,165,233,0.06); }
    .ic-file-upload-label {
        display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; text-align:center;
    }
    .ic-file-upload-icon { width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#6366f1); display:flex; align-items:center; justify-content:center; }
    .ic-file-upload-icon svg { width:20px; height:20px; fill:#fff; }
    .ic-file-upload-text { font-size:13px; font-weight:600; color:#94a3b8; }
    .ic-file-upload-hint { font-size:11px; color:#475569; }
    .ic-file-upload input[type="file"] { display:none; }
    .ic-file-list { margin-top:12px; display:flex; flex-direction:column; gap:6px; }
    .ic-file-item {
        display:flex; align-items:center; justify-content:space-between; padding:10px 14px;
        background:rgba(14,165,233,0.06); border:1px solid rgba(14,165,233,0.12); border-radius:10px;
    }
    .ic-file-item-info { display:flex; align-items:center; gap:10px; min-width:0; }
    .ic-file-item-icon { width:32px; height:32px; border-radius:8px; background:rgba(14,165,233,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .ic-file-item-icon svg { width:16px; height:16px; fill:#0ea5e9; }
    .ic-file-item-name { font-size:12px; font-weight:600; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ic-file-item-size { font-size:10px; color:#64748b; }
    .ic-file-item-remove {
        width:28px; height:28px; border-radius:8px; border:none; background:rgba(239,68,68,0.1);
        color:#f87171; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s; flex-shrink:0;
    }
    .ic-file-item-remove:hover { background:rgba(239,68,68,0.2); }
    .ic-file-item-remove svg { width:14px; height:14px; fill:currentColor; }

    /* ── Toast ── */
    .ic-toast {
        position:fixed;
        bottom:30px;
        left:50%;
        transform:translateX(-50%) translateY(100px);
        padding:14px 28px;
        border-radius:14px;
        font-size:13px;
        font-weight:600;
        z-index:2000;
        transition:transform 0.4s cubic-bezier(0.4,0,0.2,1);
        box-shadow:0 12px 40px rgba(0,0,0,0.4);
        backdrop-filter:blur(12px);
        letter-spacing:0.2px;
    }
    .ic-toast.visible { transform:translateX(-50%) translateY(0); }
    .ic-toast.success { background:rgba(16,185,129,0.95); color:#fff; }
    .ic-toast.error { background:rgba(239,68,68,0.95); color:#fff; }

    /* ── Footer ── */
    .ic-footer {
        background:rgba(0,0,0,0.4);
        border-top:1px solid rgba(255,255,255,0.04);
        padding:40px 24px 32px;
        text-align:center;
    }
    .ic-footer-brand {
        display:flex;
        align-items:center;
        justify-content:center;
        gap:12px;
        margin-bottom:20px;
    }
    .ic-footer-brand-icon {
        width:34px; height:34px;
        border-radius:10px;
        background:linear-gradient(135deg,#0ea5e9,#6366f1);
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 2px 10px rgba(14,165,233,0.3);
    }
    .ic-footer-brand-icon svg { width:18px; height:18px; }
    .ic-footer-brand-name { font-size:16px; font-weight:800; color:#f8fafc; letter-spacing:1px; }
    .ic-footer-links {
        display:flex;
        justify-content:center;
        flex-wrap:wrap;
        gap:8px;
        margin-bottom:20px;
    }
    .ic-footer-links a {
        display:inline-flex;
        align-items:center;
        gap:6px;
        font-size:12px;
        color:#475569;
        text-decoration:none;
        transition:all 0.25s;
        padding:6px 12px;
        border-radius:8px;
    }
    .ic-footer-links a:hover { color:#e2e8f0; background:rgba(255,255,255,0.05); }
    .ic-footer-links svg { width:14px; height:14px; }
    .ic-footer-copy { font-size:11px; color:#334155; }

    /* ── Print ── */
    @media print {
        body { background:#fff !important; }
        .ic-header, .ic-hero, .ic-footer, .ic-preview-toolbar, .ic-nav, .ic-actions { display:none !important; }
        .ic-preview-overlay { position:static !important; display:block !important; background:none !important; padding:0 !important; }
        .ic-preview-container { box-shadow:none !important; max-width:100% !important; border-radius:0 !important; }
        .ic-quote-doc { padding:0 !important; }
    }

    /* ── Responsive ── */
    @media (max-width:768px) {
        .ic-hero h1 { font-size:30px; letter-spacing:-0.5px; }
        .ic-hero { padding:48px 20px 40px; }
        .ic-card-body { padding:28px 20px; }
        .ic-field-row, .ic-field-row.triple { grid-template-columns:1fr; }
        .ic-quote-input { width:120px; }
        .ic-actions { grid-template-columns:1fr; }
        .ic-header-links { display:none; }
        .ic-steps { max-width:100%; }
        .ic-step-label { font-size:9px; }
        .ic-allinclusive-list { grid-template-columns:1fr; }
        .ic-qdoc-band { flex-direction:column; gap:16px; text-align:center; padding:24px 20px; }
        .ic-qdoc-band-right { text-align:center; }
        .ic-qdoc-body { padding:24px 20px; }
        .ic-qdoc-footer { flex-direction:column; gap:10px; text-align:center; padding:16px 20px; }
        .ic-qdoc-footer-contact { justify-content:center; }
        .ic-qdoc-total { flex-direction:column; gap:6px; text-align:center; }
        .ic-qdoc-timeline-steps { flex-wrap:wrap; gap:8px; }
        .ic-qdoc-timeline-step { min-width:60px; }
        .ic-qdoc-timeline-connector { display:none; }
        .ic-qdoc-timeline-stats { flex-wrap:wrap; gap:12px; }
    }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="ic-header">
        <div class="ic-header-inner">
            <a href="https://www.imporlan.cl" class="ic-logo">
                <div class="ic-logo-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                        <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
                    </svg>
                </div>
                <div class="ic-logo-text">
                    <span class="ic-logo-title">IMPORLAN</span>
                    <span class="ic-logo-sub">Tu lancha, puerta a puerta</span>
                </div>
            </a>
            <div class="ic-header-links">
                <a href="https://www.imporlan.cl">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                    imporlan.cl
                </a>
                <a href="https://wa.me/56940211459" target="_blank" rel="noopener">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                    +56 9 4021 1459
                </a>
                <a href="mailto:contacto@imporlan.cl">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                    contacto@imporlan.cl
                </a>
            </div>
        </div>
    </header>

    <!-- Hero -->
    <section class="ic-hero" id="icHero">
        <div class="ic-hero-badge">Servicio All-Inclusive</div>
        <h1>Cotizador de<br><strong>Importacion</strong></h1>
        <p class="ic-hero-sub">Genera cotizaciones profesionales para la importacion de embarcaciones desde USA a Chile. Servicio integral puerta a puerta.</p>

        <div class="ic-steps">
            <div class="ic-step-item active" data-step="1">
                <div class="ic-step-circle">1</div>
                <span class="ic-step-label">Cliente</span>
            </div>
            <div class="ic-step-line" id="icLine1"></div>
            <div class="ic-step-item" data-step="2">
                <div class="ic-step-circle">2</div>
                <span class="ic-step-label">Embarcacion</span>
            </div>
            <div class="ic-step-line" id="icLine2"></div>
            <div class="ic-step-item" data-step="3">
                <div class="ic-step-circle">3</div>
                <span class="ic-step-label">Cotizacion</span>
            </div>
            <div class="ic-step-line" id="icLine3"></div>
            <div class="ic-step-item" data-step="4">
                <div class="ic-step-circle">4</div>
                <span class="ic-step-label">Resumen</span>
            </div>
        </div>
    </section>

    <!-- Main -->
    <main class="ic-main">
        <div class="ic-card">
            <div class="ic-card-body">

                <!-- Step 1: Datos del Cliente -->
                <div class="ic-panel active" id="icPanel1">
                    <div class="ic-panel-title">Datos del Cliente</div>
                    <div class="ic-panel-subtitle">Ingrese los datos de contacto del cliente.</div>

                    <div class="ic-field-row">
                        <div class="ic-field">
                            <label>Nombre completo <span class="ic-required">*</span></label>
                            <input type="text" id="icNombre" placeholder="Nombre del cliente" autocomplete="name">
                        </div>
                        <div class="ic-field">
                            <label>Email <span class="ic-required">*</span></label>
                            <input type="email" id="icEmail" placeholder="correo@ejemplo.com" autocomplete="email">
                        </div>
                    </div>
                    <div class="ic-field-row">
                        <div class="ic-field">
                            <label>Telefono <span class="ic-required">*</span></label>
                            <input type="tel" id="icTelefono" placeholder="+56 9 1234 5678" autocomplete="tel">
                        </div>
                        <div class="ic-field">
                            <label>Empresa <small style="color:#64748b;">(opcional)</small></label>
                            <input type="text" id="icEmpresa" placeholder="Nombre de la empresa" autocomplete="organization">
                        </div>
                    </div>
                    <div class="ic-field-row single">
                        <div class="ic-field">
                            <label>Pais de origen</label>
                            <select id="icPaisOrigen">
                                <option value="Estados Unidos">Estados Unidos</option>
                                <option value="Canada">Canada</option>
                                <option value="Mexico">Mexico</option>
                                <option value="Europa">Europa</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                    </div>

                    <div class="ic-nav">
                        <div></div>
                        <button type="button" class="ic-btn ic-btn-primary" onclick="icNextStep(2)">
                            Siguiente
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                        </button>
                    </div>
                </div>

                <!-- Step 2: Datos de la Embarcacion -->
                <div class="ic-panel" id="icPanel2">
                    <div class="ic-panel-title">Datos de la Embarcacion</div>
                    <div class="ic-panel-subtitle">Ingrese las caracteristicas de la embarcacion a importar.</div>

                    <div class="ic-field-row">
                        <div class="ic-field">
                            <label>Tipo de embarcacion <span class="ic-required">*</span></label>
                            <select id="icTipoEmb">
                                <option value="">Seleccione...</option>
                                <option value="Lancha">Lancha</option>
                                <option value="Moto de Agua">Moto de Agua</option>
                                <option value="Velero">Velero</option>
                                <option value="Yate">Yate</option>
                                <option value="Bote de Pesca">Bote de Pesca</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div class="ic-field">
                            <label>Marca <span class="ic-required">*</span></label>
                            <input type="text" id="icMarca" placeholder="Ej: Yamaha, Sea Ray, Bayliner">
                        </div>
                    </div>
                    <div class="ic-field-row">
                        <div class="ic-field">
                            <label>Modelo <span class="ic-required">*</span></label>
                            <input type="text" id="icModelo" placeholder="Ej: 242 Limited, SPX 210">
                        </div>
                        <div class="ic-field">
                            <label>Ano <span class="ic-required">*</span></label>
                            <input type="number" id="icAnio" placeholder="Ej: 2022" min="1990" max="2030">
                        </div>
                    </div>
                    <div class="ic-field-row single">
                        <div class="ic-field">
                            <label>Ubicacion / Origen <span class="ic-required">*</span></label>
                            <input type="text" id="icUbicacion" placeholder="Ej: Miami, Florida, USA">
                        </div>
                    </div>

                    <div class="ic-nav">
                        <button type="button" class="ic-btn ic-btn-secondary" onclick="icNextStep(1)">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                            Anterior
                        </button>
                        <button type="button" class="ic-btn ic-btn-primary" onclick="icNextStep(3)">
                            Siguiente
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                        </button>
                    </div>
                </div>

                <!-- Step 3: Cotizacion -->
                <div class="ic-panel" id="icPanel3">
                    <div class="ic-panel-title">Cotizacion Itemizada</div>
                    <div class="ic-panel-subtitle">Ingrese los valores de cada concepto. Los porcentajes se calculan automaticamente sobre el total.</div>

                    <table class="ic-quote-table">
                        <thead>
                            <tr>
                                <th>Concepto</th>
                                <th>Valor (CLP)</th>
                                <th>%</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Valor Lancha</td>
                                <td><input type="text" class="ic-quote-input" id="icValorLancha" value="0" oninput="icFormatAndCalc(this)"></td>
                                <td><span class="ic-quote-pct" id="icPctLancha">0%</span></td>
                            </tr>
                            <tr>
                                <td>Valor Servicio All-Inclusive</td>
                                <td><input type="text" class="ic-quote-input" id="icValorServicio" value="0" oninput="icFormatAndCalc(this)"></td>
                                <td><span class="ic-quote-pct" id="icPctServicio">0%</span></td>
                            </tr>
                            <tr>
                                <td>IVA (Sobre valor CIF)</td>
                                <td><input type="text" class="ic-quote-input" id="icValorIVA" value="0" oninput="icFormatAndCalc(this)"></td>
                                <td><span class="ic-quote-pct" id="icPctIVA">0%</span></td>
                            </tr>
                            <tr>
                                <td>Impuesto al Lujo N/A</td>
                                <td><input type="text" class="ic-quote-input" id="icValorLujo" value="0" oninput="icFormatAndCalc(this)"></td>
                                <td><span class="ic-quote-pct" id="icPctLujo">0%</span></td>
                            </tr>
                            <tr class="ic-quote-total-row">
                                <td>TOTAL</td>
                                <td id="icTotal">$0</td>
                                <td><span class="ic-quote-pct" style="background:rgba(34,211,238,0.2);color:#22d3ee;">100%</span></td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="ic-allinclusive">
                        <div class="ic-allinclusive-title">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="#60a5fa"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                            El Servicio All-Inclusive incluye:
                        </div>
                        <div class="ic-allinclusive-list">
                            <div class="ic-allinc-cat">
                                <div class="ic-allinc-cat-title">&#128674; Gestiones en USA</div>
                                <div class="ic-allinc-cat-items">
                                    Trailer (solo si no trae trailer)<br>
                                    Transferencia bancaria (FEE Wire)<br>
                                    Revision e Inspeccion Tecnica USA<br>
                                    Inland USA - Bodegaje & Entrega en Puerto
                                </div>
                            </div>
                            <div class="ic-allinc-cat">
                                <div class="ic-allinc-cat-title">&#9875; Naviera (Transporte Maritimo)</div>
                                <div class="ic-allinc-cat-items">
                                    Transporte Maritimo (RORO)<br>
                                    Certificado de Fumigacion<br>
                                    Seguro / Insurance<br>
                                    Gastos Locales Naviera<br>
                                    Congestion Surcharge<br>
                                    THC / BAF / WHARFAGE<br>
                                    Handling Chile<br>
                                    Miami Admin FEE<br>
                                    Escorte (Port Pass)
                                </div>
                            </div>
                            <div class="ic-allinc-cat">
                                <div class="ic-allinc-cat-title">&#127464;&#127473; Servicios en Chile</div>
                                <div class="ic-allinc-cat-items">
                                    Inland Puerto - Santiago<br>
                                    Chequeo Mecanico Chile<br>
                                    Pulido y Tratamiento Chile<br>
                                    Entrega / Traslado
                                </div>
                            </div>
                            <div class="ic-allinc-cat">
                                <div class="ic-allinc-cat-title">&#128203; Agencia de Aduanas & Desembolsos</div>
                                <div class="ic-allinc-cat-items">
                                    Autorizaciones<br>
                                    Gastos de Puerto<br>
                                    Agencia de Aduana<br>
                                    IVA Servicios<br>
                                    Gastos de Despachos<br>
                                    Honorarios Agencia
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="ic-nav">
                        <button type="button" class="ic-btn ic-btn-secondary" onclick="icNextStep(2)">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                            Anterior
                        </button>
                        <button type="button" class="ic-btn ic-btn-primary" onclick="icNextStep(4)">
                            Siguiente
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                        </button>
                    </div>
                </div>

                <!-- Step 4: Resumen y Envio -->
                <div class="ic-panel" id="icPanel4">
                    <div class="ic-panel-title">Resumen y Envio</div>
                    <div class="ic-panel-subtitle">Revise los datos y seleccione como desea enviar la cotizacion.</div>

                    <div class="ic-summary" id="icSummaryBox">
                        <div class="ic-summary-title">
                            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                            Detalle de la Cotizacion
                        </div>
                        <div id="icSummaryContent"></div>
                    </div>

                    <!-- File Upload Area -->
                    <div class="ic-file-upload" id="icFileUploadArea">
                        <label class="ic-file-upload-label" for="icFileInput">
                            <div class="ic-file-upload-icon">
                                <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15.01l1.41 1.41L11 14.84V19h2v-4.16l1.59 1.59L16 15.01 12.01 11 8 15.01z"/></svg>
                            </div>
                            <div class="ic-file-upload-text">Adjuntar archivos a la cotizacion</div>
                            <div class="ic-file-upload-hint">Videos, PDF, documentos, imagenes (max 10MB c/u)</div>
                        </label>
                        <input type="file" id="icFileInput" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.webm,.mp3,.wav" onchange="icHandleFiles(this)">
                        <div class="ic-file-list" id="icFileList"></div>
                    </div>

                    <div class="ic-actions">
                        <button type="button" class="ic-action-btn" onclick="icShowPreview()">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                            Vista Previa
                        </button>
                        <button type="button" class="ic-action-btn" onclick="icDownloadPDF()">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                            Descargar PDF
                        </button>
                        <button type="button" class="ic-action-btn" id="icSendEmailBtn" onclick="icSendEmail()">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                            Enviar por Email
                        </button>
                    </div>

                    <div class="ic-nav">
                        <button type="button" class="ic-btn ic-btn-secondary" onclick="icNextStep(3)">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                            Modificar cotizacion
                        </button>
                        <div></div>
                    </div>
                </div>

            </div>
        </div>
    </main>

    <!-- Preview Modal -->
    <div class="ic-preview-overlay" id="icPreviewOverlay">
        <div class="ic-preview-container">
            <div class="ic-preview-toolbar">
                <span class="ic-preview-toolbar-title">Vista previa de la cotizacion</span>
                <div class="ic-preview-toolbar-actions">
                    <button type="button" class="ic-preview-toolbar-btn ic-btn-pdf" onclick="icDownloadPDF()">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        Descargar PDF
                    </button>
                    <button type="button" class="ic-preview-toolbar-btn ic-btn-close-preview" onclick="icClosePreview()">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        Cerrar
                    </button>
                </div>
            </div>
            <div class="ic-quote-doc" id="icQuoteDoc"></div>
        </div>
    </div>

    <!-- Toast -->
    <div class="ic-toast" id="icToast"></div>

    <!-- Footer -->
    <footer class="ic-footer">
        <div class="ic-footer-brand">
            <div class="ic-footer-brand-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                    <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
                </svg>
            </div>
            <span class="ic-footer-brand-name">IMPORLAN</span>
        </div>
        <div class="ic-footer-links">
            <a href="https://www.imporlan.cl">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                imporlan.cl
            </a>
            <a href="https://wa.me/56940211459" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                +56 9 4021 1459
            </a>
            <a href="mailto:contacto@imporlan.cl">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                contacto@imporlan.cl
            </a>
        </div>
        <div class="ic-footer-copy">&copy; <?php echo $year; ?> IMPORLAN. Todos los derechos reservados. Importacion de Embarcaciones.</div>
    </footer>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" integrity="sha512-GsLlZN/3F2ErC5ifS5QtgpiJtWd43JWSuIgh7mbzZ8zBps+dvLusV+eNQATqgA/HdeKFVgA5v3S/cIrLF7QnIg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <script>
    (function() {
        'use strict';

        var currentStep = 1;
        var totalSteps = 4;

        /* ── CLP Formatting ── */
        function formatCLP(num) {
            if (!num && num !== 0) return '0';
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        function parseCLP(str) {
            if (!str) return 0;
            return parseInt(String(str).replace(/\./g, '').replace(/[^0-9]/g, ''), 10) || 0;
        }

        /* ── Format input and recalculate ── */
        window.icFormatAndCalc = function(input) {
            var raw = parseCLP(input.value);
            var cursorPos = input.selectionStart;
            var oldLen = input.value.length;
            input.value = formatCLP(raw);
            var newLen = input.value.length;
            var newPos = cursorPos + (newLen - oldLen);
            if (newPos < 0) newPos = 0;
            input.setSelectionRange(newPos, newPos);
            recalcPercentages();
        };

        function recalcPercentages() {
            var vLancha = parseCLP(document.getElementById('icValorLancha').value);
            var vServicio = parseCLP(document.getElementById('icValorServicio').value);
            var vIVA = parseCLP(document.getElementById('icValorIVA').value);
            var vLujo = parseCLP(document.getElementById('icValorLujo').value);
            var total = vLancha + vServicio + vIVA + vLujo;

            document.getElementById('icTotal').textContent = '$' + formatCLP(total);
            document.getElementById('icPctLancha').textContent = total > 0 ? Math.round(vLancha / total * 100) + '%' : '0%';
            document.getElementById('icPctServicio').textContent = total > 0 ? Math.round(vServicio / total * 100) + '%' : '0%';
            document.getElementById('icPctIVA').textContent = total > 0 ? Math.round(vIVA / total * 100) + '%' : '0%';
            document.getElementById('icPctLujo').textContent = total > 0 ? Math.round(vLujo / total * 100) + '%' : '0%';
        }

        /* ── Step Navigation ── */
        window.icNextStep = function(step) {
            if (step < 1 || step > totalSteps) return;
            if (step > currentStep && !validateStep(currentStep)) return;
            if (step === 4) buildSummary();

            var panels = document.querySelectorAll('.ic-panel');
            panels.forEach(function(p) { p.classList.remove('active'); });
            document.getElementById('icPanel' + step).classList.add('active');

            var stepItems = document.querySelectorAll('.ic-step-item');
            var stepLines = [
                document.getElementById('icLine1'),
                document.getElementById('icLine2'),
                document.getElementById('icLine3')
            ];

            stepItems.forEach(function(item) {
                var s = parseInt(item.getAttribute('data-step'));
                item.classList.remove('active', 'completed');
                if (s === step) item.classList.add('active');
                else if (s < step) item.classList.add('completed');
            });
            stepLines.forEach(function(line, idx) {
                if (line) line.classList.toggle('completed', (idx + 1) < step);
            });

            currentStep = step;
            document.getElementById('icHero').scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        /* ── File Upload Handling ── */
        var uploadedFiles = [];

        window.icHandleFiles = function(input) {
            var files = input.files;
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                if (file.size > 10 * 1024 * 1024) {
                    showToast('Archivo "' + file.name + '" excede 10MB.', 'error');
                    continue;
                }
                uploadedFiles.push(file);
            }
            input.value = '';
            renderFileList();
        };

        window.icRemoveFile = function(idx) {
            uploadedFiles.splice(idx, 1);
            renderFileList();
        };

        function renderFileList() {
            var container = document.getElementById('icFileList');
            if (!uploadedFiles.length) { container.innerHTML = ''; return; }
            var html = '';
            uploadedFiles.forEach(function(f, idx) {
                var size = f.size < 1024 ? f.size + ' B' : f.size < 1048576 ? (f.size / 1024).toFixed(1) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB';
                var isVideo = f.type.startsWith('video/');
                var isImage = f.type.startsWith('image/');
                var iconPath = isVideo ? 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z' : isImage ? 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z' : 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z';
                html += '<div class="ic-file-item">';
                html += '<div class="ic-file-item-info">';
                html += '<div class="ic-file-item-icon"><svg viewBox="0 0 24 24"><path d="' + iconPath + '"/></svg></div>';
                html += '<div><div class="ic-file-item-name">' + escapeHtml(f.name) + '</div><div class="ic-file-item-size">' + size + '</div></div>';
                html += '</div>';
                html += '<button type="button" class="ic-file-item-remove" onclick="icRemoveFile(' + idx + ')"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>';
                html += '</div>';
            });
            container.innerHTML = html;
        }

        // Drag & drop
        (function() {
            var area = document.getElementById('icFileUploadArea');
            if (!area) return;
            ['dragenter','dragover'].forEach(function(ev) {
                area.addEventListener(ev, function(e) { e.preventDefault(); area.classList.add('dragover'); });
            });
            ['dragleave','drop'].forEach(function(ev) {
                area.addEventListener(ev, function(e) { e.preventDefault(); area.classList.remove('dragover'); });
            });
            area.addEventListener('drop', function(e) {
                var dt = e.dataTransfer;
                if (dt && dt.files.length) {
                    for (var i = 0; i < dt.files.length; i++) {
                        if (dt.files[i].size <= 10 * 1024 * 1024) uploadedFiles.push(dt.files[i]);
                    }
                    renderFileList();
                }
            });
        })();

        /* ── Validation ── */
        function validateStep(step) {
            if (step === 1) {
                var nombre = document.getElementById('icNombre').value.trim();
                var email = document.getElementById('icEmail').value.trim();
                var tel = document.getElementById('icTelefono').value.trim();
                if (!nombre) { showError('icNombre', 'Ingrese el nombre del cliente'); return false; }
                if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { showError('icEmail', 'Ingrese un correo valido'); return false; }
                if (!tel) { showError('icTelefono', 'Ingrese un telefono'); return false; }
                return true;
            }
            if (step === 2) {
                var tipo = document.getElementById('icTipoEmb').value;
                var marca = document.getElementById('icMarca').value.trim();
                var modelo = document.getElementById('icModelo').value.trim();
                var anio = document.getElementById('icAnio').value.trim();
                var ubi = document.getElementById('icUbicacion').value.trim();
                if (!tipo) { showError('icTipoEmb', 'Seleccione el tipo de embarcacion'); return false; }
                if (!marca) { showError('icMarca', 'Ingrese la marca'); return false; }
                if (!modelo) { showError('icModelo', 'Ingrese el modelo'); return false; }
                if (!anio) { showError('icAnio', 'Ingrese el ano'); return false; }
                if (!ubi) { showError('icUbicacion', 'Ingrese la ubicacion'); return false; }
                return true;
            }
            return true;
        }

        function showError(inputId, message) {
            var input = document.getElementById(inputId);
            input.style.borderColor = '#f87171';
            input.style.boxShadow = '0 0 0 4px rgba(248,113,113,0.15)';
            input.focus();
            input.addEventListener('input', function handler() {
                input.style.borderColor = 'rgba(255,255,255,0.08)';
                input.style.boxShadow = 'none';
                input.removeEventListener('input', handler);
            });
            var tooltip = document.createElement('div');
            tooltip.textContent = message;
            tooltip.style.cssText = 'position:absolute;background:#ef4444;color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:500;z-index:999;transform:translateY(-110%);white-space:nowrap;box-shadow:0 4px 12px rgba(239,68,68,0.3);';
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(tooltip);
            setTimeout(function() { tooltip.remove(); }, 3000);
        }

        /* ── Collect Data ── */
        function collectData() {
            return {
                nombre: document.getElementById('icNombre').value.trim(),
                email: document.getElementById('icEmail').value.trim(),
                telefono: document.getElementById('icTelefono').value.trim(),
                empresa: document.getElementById('icEmpresa').value.trim() || '-',
                paisOrigen: document.getElementById('icPaisOrigen').value,
                tipo: document.getElementById('icTipoEmb').value,
                marca: document.getElementById('icMarca').value.trim(),
                modelo: document.getElementById('icModelo').value.trim(),
                anio: document.getElementById('icAnio').value.trim(),
                ubicacion: document.getElementById('icUbicacion').value.trim(),
                valorLancha: formatCLP(parseCLP(document.getElementById('icValorLancha').value)),
                valorServicio: formatCLP(parseCLP(document.getElementById('icValorServicio').value)),
                valorIVA: formatCLP(parseCLP(document.getElementById('icValorIVA').value)),
                valorLujo: formatCLP(parseCLP(document.getElementById('icValorLujo').value)),
                total: formatCLP(parseCLP(document.getElementById('icValorLancha').value) + parseCLP(document.getElementById('icValorServicio').value) + parseCLP(document.getElementById('icValorIVA').value) + parseCLP(document.getElementById('icValorLujo').value)),
                pctLancha: document.getElementById('icPctLancha').textContent,
                pctServicio: document.getElementById('icPctServicio').textContent,
                pctIVA: document.getElementById('icPctIVA').textContent,
                pctLujo: document.getElementById('icPctLujo').textContent
            };
        }

        function generateQuoteNumber() {
            var now = new Date();
            return 'IMP-' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
        }

        function todayStr() {
            var d = new Date();
            return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
        }

        function escapeHtml(text) {
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /* ── Build Summary ── */
        function buildSummary() {
            var d = collectData();
            var html = '';
            var rows = [
                ['Nombre', d.nombre],
                ['Email', d.email],
                ['Telefono', d.telefono],
                ['Empresa', d.empresa],
                ['Pais de origen', d.paisOrigen],
                ['Embarcacion', d.tipo + ' - ' + d.marca + ' ' + d.modelo + ' ' + d.anio],
                ['Ubicacion', d.ubicacion],
                ['Valor Lancha', '$' + d.valorLancha + ' (' + d.pctLancha + ')'],
                ['Servicio All-Inclusive', '$' + d.valorServicio + ' (' + d.pctServicio + ')'],
                ['IVA (Sobre valor CIF)', '$' + d.valorIVA + ' (' + d.pctIVA + ')'],
                ['Impuesto al Lujo', '$' + d.valorLujo + ' (' + d.pctLujo + ')'],
                ['TOTAL', '$' + d.total]
            ];
            rows.forEach(function(row) {
                var isTotal = row[0] === 'TOTAL';
                html += '<div class="ic-summary-row" style="' + (isTotal ? 'background:linear-gradient(135deg,rgba(14,165,233,0.08),rgba(99,102,241,0.08));padding:12px 16px;border-radius:12px;margin-top:10px;font-size:16px;border:1px solid rgba(14,165,233,0.15);' : '') + '">';
                html += '<span class="ic-summary-label" style="' + (isTotal ? 'color:#38bdf8;font-weight:700;' : '') + '">' + row[0] + '</span>';
                html += '<span class="ic-summary-value" style="' + (isTotal ? 'color:#38bdf8;font-weight:800;font-size:20px;' : '') + '">' + escapeHtml(row[1]) + '</span>';
                html += '</div>';
            });
            // Show attached files in summary
            if (uploadedFiles.length) {
                html += '<div class="ic-summary-row" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.05);flex-direction:column;align-items:flex-start;gap:6px;">';
                html += '<span class="ic-summary-label" style="color:#0ea5e9;">Archivos adjuntos (' + uploadedFiles.length + ')</span>';
                uploadedFiles.forEach(function(f) {
                    var size = f.size < 1048576 ? (f.size / 1024).toFixed(0) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB';
                    html += '<span class="ic-summary-value" style="font-size:12px;color:#94a3b8;">' + escapeHtml(f.name) + ' (' + size + ')</span>';
                });
                html += '</div>';
            }
            document.getElementById('icSummaryContent').innerHTML = html;
        }

        /* ── Build Quote Document HTML ── */
        function buildQuoteHTML() {
            var d = collectData();
            var qNum = generateQuoteNumber();
            var date = todayStr();
            var h = '';

            // Premium header band
            h += '<div class="ic-qdoc-band">';
            h += '<div class="ic-qdoc-logo"><div class="ic-qdoc-logo-icon">&#9973;</div><div><div class="ic-qdoc-logo-text">IMPORLAN</div><div class="ic-qdoc-logo-sub">Tu lancha, puerta a puerta</div></div></div>';
            h += '<div class="ic-qdoc-band-right"><div class="ic-qdoc-label">Cotizacion</div><div class="ic-qdoc-number">' + qNum + '</div><div class="ic-qdoc-date">' + date + '</div></div>';
            h += '</div>';

            // Document body
            h += '<div class="ic-qdoc-body">';
            h += '<div class="ic-qdoc-intro"><div class="ic-qdoc-title">Cotizacion de Importacion</div>';
            h += '<div class="ic-qdoc-client">Preparado para: <strong>' + escapeHtml(d.nombre) + '</strong></div></div>';

            // Client data
            h += '<div class="ic-qdoc-section"><div class="ic-qdoc-section-title">Datos del Cliente</div>';
            h += '<table class="ic-qdoc-table">';
            h += '<tr><td>Nombre</td><td>' + escapeHtml(d.nombre) + '</td></tr>';
            h += '<tr><td>Email</td><td>' + escapeHtml(d.email) + '</td></tr>';
            h += '<tr><td>Telefono</td><td>' + escapeHtml(d.telefono) + '</td></tr>';
            if (d.empresa !== '-') h += '<tr><td>Empresa</td><td>' + escapeHtml(d.empresa) + '</td></tr>';
            h += '<tr><td>Pais de origen</td><td>' + escapeHtml(d.paisOrigen) + '</td></tr>';
            h += '</table></div>';

            // Boat data
            h += '<div class="ic-qdoc-section"><div class="ic-qdoc-section-title">Datos de la Embarcacion</div>';
            h += '<table class="ic-qdoc-table">';
            h += '<tr><td>Tipo</td><td>' + escapeHtml(d.tipo) + '</td></tr>';
            h += '<tr><td>Marca</td><td>' + escapeHtml(d.marca) + '</td></tr>';
            h += '<tr><td>Modelo</td><td>' + escapeHtml(d.modelo) + '</td></tr>';
            h += '<tr><td>Ano</td><td>' + escapeHtml(d.anio) + '</td></tr>';
            h += '<tr><td>Ubicacion</td><td>' + escapeHtml(d.ubicacion) + '</td></tr>';
            h += '</table></div>';

            // Quotation items
            h += '<div class="ic-qdoc-section"><div class="ic-qdoc-section-title">Cotizacion Itemizada (CLP)</div>';
            var items = [
                ['Valor Lancha', d.valorLancha, d.pctLancha],
                ['Valor Servicio All-Inclusive', d.valorServicio, d.pctServicio],
                ['IVA (Sobre valor CIF)', d.valorIVA, d.pctIVA],
                ['Impuesto al Lujo N/A', d.valorLujo, d.pctLujo]
            ];
            items.forEach(function(item) {
                h += '<div class="ic-qdoc-item"><div class="ic-qdoc-item-name">' + item[0] + '</div><div><span class="ic-qdoc-item-value">$' + item[1] + '</span><span class="ic-qdoc-item-pct">' + item[2] + '</span></div></div>';
            });
            h += '<div class="ic-qdoc-total"><span class="ic-qdoc-total-label">TOTAL</span><span class="ic-qdoc-total-amount">$' + d.total + '</span></div>';
            h += '</div>';

            // All-inclusive note
            h += '<div class="ic-qdoc-allinclusive"><div class="ic-qdoc-allinclusive-title">&#9989; El Servicio All-Inclusive incluye:</div>';
            h += '<div class="ic-qdoc-allinclusive-list">';
            h += '<div style="margin-bottom:8px;"><strong style="color:#0369a1;font-size:11px;">Gestiones en USA:</strong><br>Trailer (solo si no trae) &bull; Transferencia bancaria (FEE Wire) &bull; Revision e Inspeccion Tecnica USA &bull; Inland USA - Bodegaje & Entrega en Puerto</div>';
            h += '<div style="margin-bottom:8px;"><strong style="color:#0369a1;font-size:11px;">Naviera (Transporte Maritimo):</strong><br>Transporte Maritimo (RORO) &bull; Certificado de Fumigacion &bull; Seguro / Insurance &bull; Gastos Locales Naviera &bull; Congestion Surcharge &bull; THC / BAF / WHARFAGE &bull; Handling Chile &bull; Miami Admin FEE &bull; Escorte (Port Pass)</div>';
            h += '<div style="margin-bottom:8px;"><strong style="color:#0369a1;font-size:11px;">Servicios en Chile:</strong><br>Inland Puerto - Santiago &bull; Chequeo Mecanico &bull; Pulido y Tratamiento &bull; Entrega / Traslado</div>';
            h += '<div><strong style="color:#0369a1;font-size:11px;">Agencia de Aduanas & Desembolsos:</strong><br>Autorizaciones &bull; Gastos de Puerto &bull; Agencia de Aduana &bull; IVA Servicios &bull; Gastos de Despachos &bull; Honorarios Agencia</div>';
            h += '</div></div>';

            // Timeline
            h += '<div class="ic-qdoc-timeline">';
            h += '<div class="ic-qdoc-timeline-title">Proceso de Compra USA</div>';
            h += '<div class="ic-qdoc-timeline-steps" style="position:relative;">';
            h += '<div class="ic-qdoc-timeline-connector"></div>';
            var steps = [
                {num:'1', name:'Busqueda', desc:'Encuentra tu lancha ideal en portales de USA', pay:''},
                {num:'2', name:'Inspeccion', desc:'Nuestros expertos verifican la embarcacion', pay:'1er Pago - 10%', hl:true},
                {num:'3', name:'Comprar', desc:'Gestionamos la compra de forma segura', pay:'2do Pago - 90%'},
                {num:'4', name:'En Camino', desc:'Tu lancha viaja desde USA a Chile (~25 dias)', pay:''},
                {num:'5', name:'Entrega', desc:'Recibe la embarcacion donde quieras', pay:''}
            ];
            steps.forEach(function(s) {
                h += '<div class="ic-qdoc-timeline-step' + (s.hl ? ' highlight' : '') + '">';
                h += '<div class="ic-qdoc-timeline-num">' + s.num + '</div>';
                h += '<div class="ic-qdoc-timeline-name">' + s.name + '</div>';
                h += '<div class="ic-qdoc-timeline-desc">' + s.desc + '</div>';
                if (s.pay) h += '<div class="ic-qdoc-timeline-pay">' + s.pay + '</div>';
                h += '</div>';
            });
            h += '</div>';
            h += '<div class="ic-qdoc-timeline-stats">';
            h += '<div class="ic-qdoc-timeline-stat"><div class="ic-qdoc-timeline-stat-val">~58</div><div class="ic-qdoc-timeline-stat-label">Dias Totales</div></div>';
            h += '<div class="ic-qdoc-timeline-stat"><div class="ic-qdoc-timeline-stat-val">~25</div><div class="ic-qdoc-timeline-stat-label">Dias en Mar</div></div>';
            h += '<div class="ic-qdoc-timeline-stat"><div class="ic-qdoc-timeline-stat-val">8,000+</div><div class="ic-qdoc-timeline-stat-label">Millas Nauticas</div></div>';
            h += '<div class="ic-qdoc-timeline-stat"><div class="ic-qdoc-timeline-stat-val">100%</div><div class="ic-qdoc-timeline-stat-label">Seguimiento</div></div>';
            h += '</div></div>';

            // Next step / Approve
            h += '<div class="ic-qdoc-nextstep">';
            h += '<div class="ic-qdoc-nextstep-title">Siguiente Paso</div>';
            h += '<div class="ic-qdoc-nextstep-text">Al aprobar esta cotizacion, pasamos a la etapa de <strong>Inspeccion & Compra</strong>. Nuestro equipo coordinara la revision tecnica de la embarcacion y gestionara todo el proceso de adquisicion de forma segura y transparente.</div>';
            h += '<button class="ic-qdoc-approve-btn" onclick="icApproveCotizacion()">Aprobar Cotizacion</button>';
            h += '<div class="ic-qdoc-approve-hint">Al aprobar, un asesor le contactara para coordinar la inspeccion.</div>';
            h += '</div>';

            h += '</div>'; // close ic-qdoc-body

            // Footer
            h += '<div class="ic-qdoc-footer">';
            h += '<div class="ic-qdoc-footer-text">Gracias por su interes en IMPORLAN.<br>Nuestro equipo le contactara a la brevedad.</div>';
            h += '<div class="ic-qdoc-footer-contact"><span>+56 9 4021 1459</span><span>contacto@imporlan.cl</span><span>imporlan.cl</span></div>';
            h += '</div>';
            h += '<div class="ic-qdoc-disclaimer">* Los valores son referenciales en Pesos Chilenos (CLP) y pueden variar segun tipo de cambio, temporada y condiciones especificas. Esta cotizacion no constituye un compromiso de compra.</div>';

            return h;
        }

        /* ── Build PDF HTML (standalone for DOMPDF / html2pdf) ── */
        function buildPdfHTML() {
            var d = collectData();
            var qNum = generateQuoteNumber();
            var date = todayStr();
            var colors = ['#0ea5e9','#6366f1','#f59e0b','#10b981'];

            var css = '<style>';
            css += 'body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;font-size:13px;line-height:1.6;margin:0;padding:0;}';
            css += '.band{background:#0c1e3d;padding:28px 36px;display:flex;align-items:center;justify-content:space-between;}';
            css += '.logo{display:flex;align-items:center;gap:12px;}';
            css += '.logo-icon{width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#6366f1);text-align:center;line-height:44px;color:white;font-size:22px;}';
            css += '.logo-text{font-size:20px;font-weight:800;color:#fff;letter-spacing:2px;}';
            css += '.logo-sub{font-size:9px;color:rgba(255,255,255,0.4);}';
            css += '.band-right{text-align:right;}';
            css += '.label{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:rgba(255,255,255,0.4);}';
            css += '.qnum{font-size:15px;font-weight:800;color:#38bdf8;}';
            css += '.qdate{font-size:10px;color:rgba(255,255,255,0.4);}';
            css += '.content{padding:30px 36px;}';
            css += '.title{font-size:20px;font-weight:800;color:#0c1e3d;margin-bottom:3px;letter-spacing:-0.3px;}';
            css += '.client{font-size:13px;color:#64748b;margin-bottom:24px;}';
            css += '.client strong{color:#0c1e3d;}';
            css += '.section{margin-bottom:20px;}';
            css += '.section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #f1f5f9;padding-left:10px;border-left:3px solid #0ea5e9;}';
            css += 'table{width:100%;border-collapse:collapse;}';
            css += 'table td{padding:6px 8px;font-size:12px;}';
            css += 'table tr:nth-child(even) td{background:#f8fafc;}';
            css += 'table td:first-child{font-weight:600;color:#94a3b8;width:130px;}';
            css += 'table td:last-child{color:#1e293b;font-weight:500;}';
            css += '.item{display:flex;justify-content:space-between;padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:5px;border-left:3px solid #e2e8f0;}';
            css += '.item-name{font-size:12px;font-weight:600;color:#1e293b;}';
            css += '.item-val{font-size:13px;font-weight:800;color:#0c1e3d;}';
            css += '.item-pct{font-size:10px;font-weight:600;color:#fff;background:#94a3b8;padding:1px 7px;border-radius:50px;margin-left:6px;}';
            css += '.total-row{display:flex;justify-content:space-between;padding:14px 18px;background:linear-gradient(135deg,#0c1e3d,#1a3a6e);border-radius:10px;margin-top:8px;color:white;}';
            css += '.total-label{font-size:12px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;}';
            css += '.total-amount{font-size:20px;font-weight:800;color:#38bdf8;}';
            css += '.allinc{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px 18px;margin-top:16px;}';
            css += '.allinc-title{font-size:10px;font-weight:700;color:#0369a1;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;}';
            css += '.allinc-list{font-size:10px;color:#475569;line-height:1.8;}';
            css += '.allinc-list strong{color:#0369a1;font-size:10px;}';
            css += '.footer-bar{background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 36px;display:flex;align-items:center;justify-content:space-between;}';
            css += '.footer-text{font-size:10px;color:#94a3b8;}';
            css += '.footer-contact{font-size:10px;font-weight:600;color:#0c1e3d;}';
            css += '.disclaimer{font-size:8px;color:#94a3b8;text-align:center;padding:8px 36px 16px;font-style:italic;}';
            css += '</style>';

            var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css + '</head><body>';

            // Premium header band
            html += '<div class="band"><div class="logo"><div class="logo-icon">&#9973;</div><div><div class="logo-text">IMPORLAN</div><div class="logo-sub">Tu lancha, puerta a puerta</div></div></div>';
            html += '<div class="band-right"><div class="label">Cotizacion</div><div class="qnum">' + qNum + '</div><div class="qdate">' + date + '</div></div></div>';

            html += '<div class="content">';
            html += '<div class="title">Cotizacion de Importacion</div>';
            html += '<div class="client">Preparado para: <strong>' + escapeHtml(d.nombre) + '</strong></div>';

            html += '<div class="section"><div class="section-title">Datos del Cliente</div><table>';
            html += '<tr><td>Nombre</td><td>' + escapeHtml(d.nombre) + '</td></tr>';
            html += '<tr><td>Email</td><td>' + escapeHtml(d.email) + '</td></tr>';
            html += '<tr><td>Telefono</td><td>' + escapeHtml(d.telefono) + '</td></tr>';
            if (d.empresa !== '-') html += '<tr><td>Empresa</td><td>' + escapeHtml(d.empresa) + '</td></tr>';
            html += '<tr><td>Pais de origen</td><td>' + escapeHtml(d.paisOrigen) + '</td></tr>';
            html += '</table></div>';

            html += '<div class="section"><div class="section-title">Datos de la Embarcacion</div><table>';
            html += '<tr><td>Tipo</td><td>' + escapeHtml(d.tipo) + '</td></tr>';
            html += '<tr><td>Marca</td><td>' + escapeHtml(d.marca) + '</td></tr>';
            html += '<tr><td>Modelo</td><td>' + escapeHtml(d.modelo) + '</td></tr>';
            html += '<tr><td>Ano</td><td>' + escapeHtml(d.anio) + '</td></tr>';
            html += '<tr><td>Ubicacion</td><td>' + escapeHtml(d.ubicacion) + '</td></tr>';
            html += '</table></div>';

            html += '<div class="section"><div class="section-title">Cotizacion Itemizada (CLP)</div>';
            var items = [
                ['Valor Lancha', d.valorLancha, d.pctLancha],
                ['Valor Servicio All-Inclusive', d.valorServicio, d.pctServicio],
                ['IVA (Sobre valor CIF)', d.valorIVA, d.pctIVA],
                ['Impuesto al Lujo N/A', d.valorLujo, d.pctLujo]
            ];
            items.forEach(function(i, idx) {
                html += '<div class="item" style="border-left-color:' + colors[idx] + '"><span class="item-name">' + i[0] + '</span><span><span class="item-val">$' + i[1] + '</span><span class="item-pct">' + i[2] + '</span></span></div>';
            });
            html += '<div class="total-row"><span class="total-label">TOTAL</span><span class="total-amount">$' + d.total + '</span></div></div>';

            html += '<div class="allinc"><div class="allinc-title">&#9989; El Servicio All-Inclusive incluye:</div>';
            html += '<div class="allinc-list">';
            html += '<div style="margin-bottom:6px;"><strong>Gestiones en USA:</strong><br>Trailer (solo si no trae) &bull; Transferencia bancaria (FEE Wire) &bull; Revision e Inspeccion Tecnica USA &bull; Inland USA - Bodegaje & Entrega en Puerto</div>';
            html += '<div style="margin-bottom:6px;"><strong>Naviera (Transporte Maritimo):</strong><br>Transporte Maritimo (RORO) &bull; Certificado de Fumigacion &bull; Seguro / Insurance &bull; Gastos Locales Naviera &bull; Congestion Surcharge &bull; THC / BAF / WHARFAGE &bull; Handling Chile &bull; Miami Admin FEE &bull; Escorte (Port Pass)</div>';
            html += '<div style="margin-bottom:6px;"><strong>Servicios en Chile:</strong><br>Inland Puerto - Santiago &bull; Chequeo Mecanico &bull; Pulido y Tratamiento &bull; Entrega / Traslado</div>';
            html += '<div><strong>Agencia de Aduanas & Desembolsos:</strong><br>Autorizaciones &bull; Gastos de Puerto &bull; Agencia de Aduana &bull; IVA Servicios &bull; Gastos de Despachos &bull; Honorarios Agencia</div>';
            html += '</div></div>';

            // Timeline in PDF
            html += '<div style="margin-top:20px;padding:16px 20px;background:linear-gradient(135deg,#f0f9ff,#eef2ff);border:1px solid #bae6fd;border-radius:10px;">';
            html += '<div style="font-size:10px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;text-align:center;">Proceso de Compra USA</div>';
            html += '<div style="display:flex;justify-content:space-between;gap:4px;">';
            var pdfSteps = [
                {n:'1',t:'Busqueda',p:''},
                {n:'2',t:'Inspeccion',p:'1er Pago 10%'},
                {n:'3',t:'Comprar',p:'2do Pago 90%'},
                {n:'4',t:'En Camino',p:''},
                {n:'5',t:'Entrega',p:''}
            ];
            pdfSteps.forEach(function(s) {
                var bg = s.p ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,#0ea5e9,#6366f1)';
                html += '<div style="flex:1;text-align:center;">';
                html += '<div style="width:30px;height:30px;border-radius:50%;background:' + bg + ';color:#fff;font-size:12px;font-weight:800;line-height:30px;margin:0 auto 4px;">'+s.n+'</div>';
                html += '<div style="font-size:9px;font-weight:700;color:#0c1e3d;text-transform:uppercase;">'+s.t+'</div>';
                if (s.p) html += '<div style="font-size:7px;font-weight:700;color:#f59e0b;margin-top:1px;">'+s.p+'</div>';
                html += '</div>';
            });
            html += '</div>';
            html += '<div style="display:flex;justify-content:center;gap:20px;margin-top:10px;padding-top:8px;border-top:1px solid rgba(14,165,233,0.15);">';
            html += '<div style="text-align:center;"><div style="font-size:12px;font-weight:800;color:#0ea5e9;">~58</div><div style="font-size:7px;color:#64748b;text-transform:uppercase;">Dias Totales</div></div>';
            html += '<div style="text-align:center;"><div style="font-size:12px;font-weight:800;color:#0ea5e9;">~25</div><div style="font-size:7px;color:#64748b;text-transform:uppercase;">Dias en Mar</div></div>';
            html += '<div style="text-align:center;"><div style="font-size:12px;font-weight:800;color:#0ea5e9;">8,000+</div><div style="font-size:7px;color:#64748b;text-transform:uppercase;">Millas Nauticas</div></div>';
            html += '</div></div>';

            // Next step in PDF
            html += '<div style="margin-top:16px;padding:16px 20px;background:linear-gradient(135deg,#0c1e3d,#1a3a6e);border-radius:10px;text-align:center;">';
            html += '<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">Siguiente Paso</div>';
            html += '<div style="font-size:12px;color:#e2e8f0;line-height:1.6;margin-bottom:10px;">Al aprobar esta cotizacion, pasamos a la etapa de <strong style="color:#38bdf8;">Inspeccion & Compra</strong>.</div>';
            html += '<div style="display:inline-block;padding:10px 32px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:12px;font-weight:700;border-radius:10px;">APROBAR COTIZACION</div>';
            html += '</div>';

            html += '</div>'; // close content

            html += '<div class="footer-bar"><div class="footer-text">Gracias por su interes en IMPORLAN.<br>Nuestro equipo le contactara a la brevedad.</div>';
            html += '<div class="footer-contact">+56 9 4021 1459 &bull; contacto@imporlan.cl &bull; imporlan.cl</div></div>';
            html += '<div class="disclaimer">* Los valores son referenciales en Pesos Chilenos (CLP) y pueden variar segun tipo de cambio, temporada y condiciones. Esta cotizacion no constituye un compromiso de compra.</div>';

            html += '</body></html>';
            return html;
        }

        /* ── Show Preview ── */
        window.icShowPreview = function() {
            buildSummary();
            document.getElementById('icQuoteDoc').innerHTML = buildQuoteHTML();
            document.getElementById('icPreviewOverlay').classList.add('visible');
            document.body.style.overflow = 'hidden';
        };

        /* ── Close Preview ── */
        window.icClosePreview = function() {
            document.getElementById('icPreviewOverlay').classList.remove('visible');
            document.body.style.overflow = '';
        };
        document.getElementById('icPreviewOverlay').addEventListener('click', function(e) {
            if (e.target === this) icClosePreview();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') icClosePreview();
        });

        /* ── Download PDF ── */
        window.icDownloadPDF = function() {
            var pdfContainer = document.createElement('div');
            pdfContainer.style.cssText = 'position:absolute;left:-9999px;top:0;width:700px;font-family:Arial,Helvetica,sans-serif;';
            pdfContainer.innerHTML = buildPdfHTML();
            document.body.appendChild(pdfContainer);

            var d = collectData();
            var filename = 'Cotizacion-Imporlan-' + d.nombre.replace(/\s+/g, '-') + '.pdf';

            var opt = {
                margin: [8, 8, 8, 8],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opt).from(pdfContainer).save().then(function() {
                document.body.removeChild(pdfContainer);
            });
        };

        /* ── Send Email ── */
        window.icSendEmail = function() {
            var btn = document.getElementById('icSendEmailBtn');
            if (btn.classList.contains('sending')) return;
            btn.classList.add('sending');
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="animation:spin 1s linear infinite"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>Enviando...';

            var d = collectData();
            var qNum = generateQuoteNumber();
            var date = todayStr();
            var pdfHtml = buildPdfHTML();

            var formData = new FormData();
            formData.append('action', 'enviar_cotizacion');
            formData.append('nombre', d.nombre);
            formData.append('email', d.email);
            formData.append('telefono', d.telefono);
            formData.append('empresa', d.empresa);
            formData.append('pais_origen', d.paisOrigen);
            formData.append('tipo_embarcacion', d.tipo);
            formData.append('marca', d.marca);
            formData.append('modelo', d.modelo);
            formData.append('anio', d.anio);
            formData.append('ubicacion', d.ubicacion);
            formData.append('valor_lancha', d.valorLancha);
            formData.append('valor_servicio', d.valorServicio);
            formData.append('valor_iva', d.valorIVA);
            formData.append('valor_lujo', d.valorLujo);
            formData.append('total', d.total);
            formData.append('cotizacion_num', qNum);
            formData.append('fecha', date);
            formData.append('pdf_html', pdfHtml);

            // Append user-uploaded files
            for (var i = 0; i < uploadedFiles.length; i++) {
                formData.append('attachments[]', uploadedFiles[i]);
            }

            fetch(window.location.pathname, {
                method: 'POST',
                body: formData
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                btn.classList.remove('sending');
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>Enviar por Email';
                showToast(data.message, data.success ? 'success' : 'error');
            })
            .catch(function(err) {
                btn.classList.remove('sending');
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>Enviar por Email';
                showToast('Error de conexion. Intente nuevamente.', 'error');
            });
        };

        /* ── Approve Cotizacion ── */
        window.icApproveCotizacion = function() {
            var d = collectData();
            var qNum = generateQuoteNumber();
            var msg = 'Estimado equipo Imporlan,%0A%0AEl cliente ' + encodeURIComponent(d.nombre) + ' desea APROBAR la cotizacion ' + qNum + ' para la embarcacion ' + encodeURIComponent(d.tipo + ' ' + d.marca + ' ' + d.modelo + ' ' + d.anio) + '.%0A%0ASolicito coordinar la etapa de Inspeccion & Compra.%0A%0ADatos de contacto:%0ANombre: ' + encodeURIComponent(d.nombre) + '%0AEmail: ' + encodeURIComponent(d.email) + '%0ATelefono: ' + encodeURIComponent(d.telefono) + '%0A%0ATotal cotizado: $' + encodeURIComponent(d.total) + ' CLP';
            var subject = encodeURIComponent('Aprobacion Cotizacion ' + qNum + ' - ' + d.nombre);
            window.open('mailto:contacto@imporlan.cl?subject=' + subject + '&body=' + msg, '_self');
            showToast('Redirigiendo a su correo para confirmar la aprobacion...', 'success');
        };

        /* ── Toast ── */
        function showToast(message, type) {
            var toast = document.getElementById('icToast');
            toast.textContent = message;
            toast.className = 'ic-toast ' + type;
            setTimeout(function() { toast.classList.add('visible'); }, 50);
            setTimeout(function() { toast.classList.remove('visible'); }, 4000);
        }

        /* ── Spin animation for loading ── */
        var spinStyle = document.createElement('style');
        spinStyle.textContent = '@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
        document.head.appendChild(spinStyle);

    })();
    </script>
</body>
</html>
