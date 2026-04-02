<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// Sanitize inputs
$name = htmlspecialchars(strip_tags($input['name'] ?? ''), ENT_QUOTES, 'UTF-8');
$email = filter_var($input['email'] ?? '', FILTER_SANITIZE_EMAIL);
$phone = htmlspecialchars(strip_tags($input['phone'] ?? ''), ENT_QUOTES, 'UTF-8');
$date = htmlspecialchars(strip_tags($input['date'] ?? ''), ENT_QUOTES, 'UTF-8');
$comments = htmlspecialchars(strip_tags($input['comments'] ?? ''), ENT_QUOTES, 'UTF-8');
$summary = htmlspecialchars(strip_tags($input['summary'] ?? ''), ENT_QUOTES, 'UTF-8');
$total = htmlspecialchars(strip_tags($input['total'] ?? ''), ENT_QUOTES, 'UTF-8');
$lang = htmlspecialchars(strip_tags($input['lang'] ?? 'es'), ENT_QUOTES, 'UTF-8');

// Validate
if (empty($name) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid name or email']);
    exit;
}

$adminEmail = 'info@clasesdeski.cl';
$siteName = 'CDSKI - Clases de Ski y Snowboard';

// ─── Build summary lines ───
$summaryLines = explode("\n", $input['summary'] ?? '');
$summaryHtml = '';
foreach ($summaryLines as $line) {
    $line = htmlspecialchars(strip_tags($line), ENT_QUOTES, 'UTF-8');
    if (strpos($line, 'TOTAL:') !== false || strpos($line, '---') !== false) {
        $summaryHtml .= "<strong>{$line}</strong><br>";
    } else {
        $summaryHtml .= "{$line}<br>";
    }
}

// ─── Labels by language ───
$labels = [
    'es' => [
        'adminSubject' => "Nueva Reserva CDSKI - {$name}",
        'userSubject' => "Confirmación de tu reserva - CDSKI",
        'adminTitle' => 'Nueva Solicitud de Reserva',
        'userTitle' => '¡Gracias por tu reserva!',
        'userMsg' => 'Hemos recibido tu solicitud. Nuestro equipo te contactará dentro de las próximas 2 horas para confirmar disponibilidad y coordinar los detalles.',
        'details' => 'Detalles de la reserva',
        'clientInfo' => 'Datos del cliente',
        'totalLabel' => 'Total estimado',
        'dateLabel' => 'Fecha preferida',
        'commentsLabel' => 'Comentarios',
        'footer' => 'Si tienes alguna pregunta, contáctanos por WhatsApp al +56 9 4021 1459 o responde a este email.',
    ],
    'en' => [
        'adminSubject' => "New CDSKI Booking - {$name}",
        'userSubject' => "Your booking confirmation - CDSKI",
        'adminTitle' => 'New Booking Request',
        'userTitle' => 'Thank you for your booking!',
        'userMsg' => "We've received your request. Our team will contact you within the next 2 hours to confirm availability and coordinate the details.",
        'details' => 'Booking details',
        'clientInfo' => 'Client information',
        'totalLabel' => 'Estimated total',
        'dateLabel' => 'Preferred date',
        'commentsLabel' => 'Comments',
        'footer' => 'If you have any questions, contact us via WhatsApp at +56 9 4021 1459 or reply to this email.',
    ],
    'pt' => [
        'adminSubject' => "Nova Reserva CDSKI - {$name}",
        'userSubject' => "Confirmação da sua reserva - CDSKI",
        'adminTitle' => 'Nova Solicitação de Reserva',
        'userTitle' => 'Obrigado pela sua reserva!',
        'userMsg' => 'Recebemos sua solicitação. Nossa equipe entrará em contato nas próximas 2 horas para confirmar disponibilidade e coordenar os detalhes.',
        'details' => 'Detalhes da reserva',
        'clientInfo' => 'Dados do cliente',
        'totalLabel' => 'Total estimado',
        'dateLabel' => 'Data preferida',
        'commentsLabel' => 'Comentários',
        'footer' => 'Se tiver alguma dúvida, entre em contato pelo WhatsApp +56 9 4021 1459 ou responda a este email.',
    ],
];

$l = $labels[$lang] ?? $labels['es'];

// ─── HTML Email Template ───
function buildEmail($title, $bodyContent, $footerText) {
    return "
    <!DOCTYPE html>
    <html>
    <head><meta charset='utf-8'></head>
    <body style='margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;'>
      <table width='100%' cellpadding='0' cellspacing='0' style='background:#f4f4f7;padding:40px 20px;'>
        <tr><td align='center'>
          <table width='600' cellpadding='0' cellspacing='0' style='background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);'>
            <!-- Header -->
            <tr>
              <td style='background:linear-gradient(135deg,#0a1628,#0f2847);padding:32px 40px;text-align:center;'>
                <h1 style='color:#ffffff;margin:0;font-size:28px;'>CD<span style='color:#f97316;'>SKI</span></h1>
                <p style='color:rgba(255,255,255,0.6);margin:8px 0 0;font-size:14px;'>Clases de Ski & Snowboard Chile</p>
              </td>
            </tr>
            <!-- Title -->
            <tr>
              <td style='padding:32px 40px 16px;'>
                <h2 style='color:#0a1628;margin:0;font-size:22px;'>{$title}</h2>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style='padding:0 40px 32px;color:#4a5568;font-size:14px;line-height:1.7;'>
                {$bodyContent}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style='background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;'>
                <p style='color:#94a3b8;font-size:12px;margin:0;line-height:1.6;'>{$footerText}</p>
                <p style='color:#94a3b8;font-size:12px;margin:8px 0 0;'>
                  <a href='https://clasesdeski.cl' style='color:#f97316;text-decoration:none;'>clasesdeski.cl</a> &middot;
                  <a href='https://wa.me/56940211459' style='color:#f97316;text-decoration:none;'>WhatsApp</a> &middot;
                  <a href='https://instagram.com/clasesdeski' style='color:#f97316;text-decoration:none;'>Instagram</a>
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>";
}

// ─── Admin Email ───
$adminBody = "
  <p><strong>{$l['clientInfo']}:</strong></p>
  <table style='width:100%;border-collapse:collapse;margin:12px 0;'>
    <tr><td style='padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:bold;width:140px;'>Nombre</td><td style='padding:8px 12px;border:1px solid #e2e8f0;'>{$name}</td></tr>
    <tr><td style='padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:bold;'>Email</td><td style='padding:8px 12px;border:1px solid #e2e8f0;'><a href='mailto:{$email}'>{$email}</a></td></tr>
    <tr><td style='padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:bold;'>WhatsApp</td><td style='padding:8px 12px;border:1px solid #e2e8f0;'>" . ($phone ?: 'N/A') . "</td></tr>
    <tr><td style='padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:bold;'>{$l['dateLabel']}</td><td style='padding:8px 12px;border:1px solid #e2e8f0;'>" . ($date ?: 'N/A') . "</td></tr>
  </table>
  <p><strong>{$l['details']}:</strong></p>
  <div style='background:#f0f9ff;border-left:4px solid #f97316;padding:16px 20px;margin:12px 0;border-radius:0 8px 8px 0;font-size:13px;line-height:1.8;'>
    {$summaryHtml}
  </div>
  <div style='background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px 20px;margin:16px 0;text-align:center;'>
    <span style='color:#9a3412;font-size:13px;'>{$l['totalLabel']}:</span><br>
    <strong style='color:#c2410c;font-size:24px;'>{$total} CLP</strong>
  </div>" .
  ($comments ? "<p><strong>{$l['commentsLabel']}:</strong> {$comments}</p>" : "");

$adminHtml = buildEmail($l['adminTitle'], $adminBody, "Email generado automáticamente por el sistema de reservas CDSKI.");

// ─── User Email ───
$userBody = "
  <p>{$l['userMsg']}</p>
  <p><strong>{$l['details']}:</strong></p>
  <div style='background:#f0f9ff;border-left:4px solid #f97316;padding:16px 20px;margin:12px 0;border-radius:0 8px 8px 0;font-size:13px;line-height:1.8;'>
    {$summaryHtml}
  </div>
  <div style='background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px 20px;margin:16px 0;text-align:center;'>
    <span style='color:#9a3412;font-size:13px;'>{$l['totalLabel']}:</span><br>
    <strong style='color:#c2410c;font-size:24px;'>{$total} CLP</strong>
  </div>";

$userHtml = buildEmail($l['userTitle'], $userBody, $l['footer']);

// ─── Send Emails ───
$headers  = "MIME-Version: 1.0\r\n";
$headers .= "Content-type: text/html; charset=UTF-8\r\n";
$headers .= "From: CDSKI <noreply@clasesdeski.cl>\r\n";
$headers .= "Reply-To: {$email}\r\n";

$adminSent = mail($adminEmail, $l['adminSubject'], $adminHtml, $headers);

$userHeaders  = "MIME-Version: 1.0\r\n";
$userHeaders .= "Content-type: text/html; charset=UTF-8\r\n";
$userHeaders .= "From: CDSKI <noreply@clasesdeski.cl>\r\n";
$userHeaders .= "Reply-To: {$adminEmail}\r\n";

$userSent = mail($email, $l['userSubject'], $userHtml, $userHeaders);

if ($adminSent && $userSent) {
    echo json_encode(['success' => true, 'message' => 'Emails sent']);
} elseif ($adminSent) {
    echo json_encode(['success' => true, 'message' => 'Admin email sent, user email may be delayed']);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to send emails']);
}
