<?php
/**
 * Temporary one-time notification email sender
 * DELETE THIS FILE AFTER USE
 * 
 * Usage: /api/send_notification_temp.php?key=imporlan-notify-2026
 */

// Security key to prevent unauthorized access
$key = $_GET['key'] ?? '';
if ($key !== 'imporlan-notify-2026') {
    http_response_code(403);
    die(json_encode(['error' => 'Invalid key']));
}

header('Content-Type: application/json');

require_once __DIR__ . '/email_service.php';

$emailService = new EmailService();

$toEmail = 'samuel.jimenez.brito@gmail.com';
$ccEmail = 'contacto@imporlan.cl';
$subject = 'Solucion aplicada - Descarga de Reporte PDF';

$htmlBody = '
<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
    <div style="background:linear-gradient(135deg,#0a1628,#1a365d);padding:30px;border-radius:16px 16px 0 0;text-align:center">
        <div style="font-size:24px;font-weight:800;color:#fff;margin-bottom:4px">IMPOR<span style="color:#60a5fa">LAN</span></div>
        <div style="font-size:12px;color:#94a3b8;letter-spacing:1px">ESPECIALISTAS EN IMPORTACION DE EMBARCACIONES</div>
    </div>
    <div style="background:#fff;padding:30px;border:1px solid #e2e8f0;border-top:none">
        <h2 style="color:#0f172a;font-size:20px;margin:0 0 8px">Problema solucionado</h2>
        <p style="color:#64748b;font-size:14px;margin:0 0 24px">Descarga de Reporte PDF</p>
        <p style="color:#1e293b;font-size:15px;line-height:1.7;margin-bottom:20px">Estimado Samuel,</p>
        <p style="color:#475569;font-size:14px;line-height:1.7;margin-bottom:20px">Hemos identificado y corregido el error que te impedia descargar el reporte en formato PDF desde tu panel de usuario.</p>
        <p style="color:#475569;font-size:14px;line-height:1.7;margin-bottom:20px">El problema ha sido solucionado exitosamente. Ahora puedes acceder a tu panel y descargar el reporte sin inconvenientes, tanto desde el boton <strong>&quot;Ver Reporte&quot;</strong> como desde el boton <strong>&quot;PDF&quot;</strong>.</p>
        <p style="color:#475569;font-size:14px;line-height:1.7;margin-bottom:24px">Si por algun motivo la descarga no funciona inmediatamente, te recomendamos limpiar la cache de tu navegador o abrir el panel en una ventana de incognito.</p>
        <div style="text-align:center;margin:24px 0">
            <a href="https://www.imporlan.cl/panel/" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">Ir a Mi Panel</a>
        </div>
        <p style="color:#475569;font-size:14px;line-height:1.7;margin-bottom:20px">Lamentamos las molestias ocasionadas. Si tienes alguna otra consulta, no dudes en contactarnos.</p>
    </div>
    <div style="background:#f8fafc;padding:20px 30px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;text-align:center">
        <p style="color:#64748b;font-size:13px;margin:0">Saludos,<br><strong style="color:#0f172a">Equipo Imporlan</strong></p>
        <p style="color:#94a3b8;font-size:11px;margin:12px 0 0"><a href="https://www.imporlan.cl" style="color:#3b82f6;text-decoration:none">www.imporlan.cl</a> | contacto@imporlan.cl</p>
    </div>
</div>';

$results = [];

// Send to Samuel
$result1 = $emailService->sendCustomEmail($toEmail, $subject, $htmlBody);
$results['samuel'] = $result1;

// Send copy to contacto@imporlan.cl
$result2 = $emailService->sendCustomEmail($ccEmail, '[Copia] ' . $subject . ' - Enviado a ' . $toEmail, $htmlBody);
$results['contacto'] = $result2;

echo json_encode([
    'success' => ($result1['success'] ?? false) && ($result2['success'] ?? false),
    'results' => $results,
    'note' => 'DELETE THIS FILE after use: api/send_notification_temp.php'
], JSON_PRETTY_PRINT);
