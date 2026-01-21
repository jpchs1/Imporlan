<?php
/**
 * Email API for Imporlan WebPanel
 * Handles automated email notifications for purchases and other events
 */

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Email configuration
define('ADMIN_EMAIL', 'contacto@imporlan.cl');
define('FROM_EMAIL', 'noreply@imporlan.cl');
define('FROM_NAME', 'Imporlan Chile');
define('SITE_URL', 'https://www.imporlan.cl');

// Get action from query string
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

switch ($action) {
    case 'send_purchase_confirmation':
        sendPurchaseConfirmation($input);
        break;
    case 'send_welcome_email':
        sendWelcomeEmail($input);
        break;
    case 'send_admin_notification':
        sendAdminNotification($input);
        break;
    default:
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
}

/**
 * Send purchase confirmation email to customer
 */
function sendPurchaseConfirmation($data) {
    $userEmail = isset($data['user_email']) ? $data['user_email'] : '';
    $purchaseDescription = isset($data['purchase_description']) ? $data['purchase_description'] : '';
    $amount = isset($data['amount']) ? $data['amount'] : 0;
    $paymentMethod = isset($data['payment_method']) ? $data['payment_method'] : '';
    $paymentId = isset($data['payment_id']) ? $data['payment_id'] : '';
    
    if (empty($userEmail)) {
        echo json_encode(['success' => false, 'error' => 'Email is required']);
        return;
    }
    
    $subject = "Confirmacion de Compra - Imporlan";
    
    $htmlBody = '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0ea5e9, #06b6d4); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .header img { max-width: 150px; margin-bottom: 15px; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
            .success-icon { font-size: 48px; text-align: center; margin-bottom: 20px; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .details-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
            .details-row:last-child { border-bottom: none; }
            .label { color: #64748b; }
            .value { font-weight: bold; color: #1e293b; }
            .amount { color: #10b981; font-size: 1.2em; }
            .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
            .button { display: inline-block; background: linear-gradient(135deg, #0ea5e9, #06b6d4); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>IMPORLAN</h1>
                <p style="color: white; margin: 10px 0 0 0;">WebPanel Cliente</p>
            </div>
            <div class="content">
                <div class="success-icon">&#10004;</div>
                <h2 style="text-align: center; color: #10b981;">Felicitaciones por tu Compra!</h2>
                <p style="text-align: center;">Tu pago ha sido procesado exitosamente.</p>
                
                <div class="details">
                    <div class="details-row">
                        <span class="label">Producto:</span>
                        <span class="value">' . htmlspecialchars($purchaseDescription) . '</span>
                    </div>
                    <div class="details-row">
                        <span class="label">Monto:</span>
                        <span class="value amount">$' . number_format($amount, 0, ',', '.') . ' CLP</span>
                    </div>
                    <div class="details-row">
                        <span class="label">Metodo de Pago:</span>
                        <span class="value">' . htmlspecialchars($paymentMethod) . '</span>
                    </div>
                    <div class="details-row">
                        <span class="label">Fecha:</span>
                        <span class="value">' . date('d/m/Y H:i') . '</span>
                    </div>
                    ' . ($paymentId ? '<div class="details-row">
                        <span class="label">ID de Transaccion:</span>
                        <span class="value">' . htmlspecialchars($paymentId) . '</span>
                    </div>' : '') . '
                </div>
                
                <p style="text-align: center;">Puedes ver tus productos contratados en tu panel de cliente.</p>
                
                <div style="text-align: center;">
                    <a href="' . SITE_URL . '/panel/#myproducts" class="button">Ver Mis Productos</a>
                </div>
            </div>
            <div class="footer">
                <p>Este correo fue enviado automaticamente por Imporlan Chile.</p>
                <p>Si tienes alguna pregunta, contactanos a ' . ADMIN_EMAIL . '</p>
                <p>&copy; ' . date('Y') . ' Imporlan Chile. Todos los derechos reservados.</p>
            </div>
        </div>
    </body>
    </html>';
    
    // Send email to customer
    $customerSent = sendEmail($userEmail, $subject, $htmlBody);
    
    // Also send notification to admin
    $adminSubject = "Nueva Compra - " . $purchaseDescription;
    $adminBody = '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1e293b; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
            .alert { background: #10b981; color: white; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
            .details { background: white; padding: 20px; border-radius: 8px; }
            .details-row { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
            .details-row:last-child { border-bottom: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>IMPORLAN ADMIN</h1>
            </div>
            <div class="content">
                <div class="alert">
                    <strong>Nueva Compra Recibida!</strong>
                </div>
                <div class="details">
                    <div class="details-row">
                        <strong>Cliente:</strong> ' . htmlspecialchars($userEmail) . '
                    </div>
                    <div class="details-row">
                        <strong>Producto:</strong> ' . htmlspecialchars($purchaseDescription) . '
                    </div>
                    <div class="details-row">
                        <strong>Monto:</strong> $' . number_format($amount, 0, ',', '.') . ' CLP
                    </div>
                    <div class="details-row">
                        <strong>Metodo de Pago:</strong> ' . htmlspecialchars($paymentMethod) . '
                    </div>
                    <div class="details-row">
                        <strong>Fecha:</strong> ' . date('d/m/Y H:i') . '
                    </div>
                    ' . ($paymentId ? '<div class="details-row">
                        <strong>ID de Transaccion:</strong> ' . htmlspecialchars($paymentId) . '
                    </div>' : '') . '
                </div>
            </div>
        </div>
    </body>
    </html>';
    
    $adminSent = sendEmail(ADMIN_EMAIL, $adminSubject, $adminBody);
    
    // Log the email attempt
    logEmail([
        'type' => 'purchase_confirmation',
        'to' => $userEmail,
        'subject' => $subject,
        'customer_sent' => $customerSent,
        'admin_sent' => $adminSent,
        'data' => $data,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
    echo json_encode([
        'success' => $customerSent,
        'customer_email_sent' => $customerSent,
        'admin_email_sent' => $adminSent
    ]);
}

/**
 * Send welcome email to new user
 */
function sendWelcomeEmail($data) {
    $userEmail = isset($data['user_email']) ? $data['user_email'] : '';
    $userName = isset($data['user_name']) ? $data['user_name'] : '';
    
    if (empty($userEmail)) {
        echo json_encode(['success' => false, 'error' => 'Email is required']);
        return;
    }
    
    $subject = "Bienvenido a Imporlan - Tu cuenta ha sido creada";
    
    $htmlBody = '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0ea5e9, #06b6d4); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
            .welcome { font-size: 48px; text-align: center; margin-bottom: 20px; }
            .features { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .feature { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
            .feature:last-child { border-bottom: none; }
            .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
            .button { display: inline-block; background: linear-gradient(135deg, #0ea5e9, #06b6d4); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>IMPORLAN</h1>
                <p style="color: white; margin: 10px 0 0 0;">WebPanel Cliente</p>
            </div>
            <div class="content">
                <div class="welcome">&#128075;</div>
                <h2 style="text-align: center; color: #0ea5e9;">Bienvenido, ' . htmlspecialchars($userName ?: 'Usuario') . '!</h2>
                <p style="text-align: center;">Tu cuenta en Imporlan ha sido creada exitosamente.</p>
                
                <div class="features">
                    <h3>Con tu cuenta puedes:</h3>
                    <div class="feature">&#10004; Contratar planes de busqueda de lanchas en USA</div>
                    <div class="feature">&#10004; Cotizar links de lanchas que encuentres</div>
                    <div class="feature">&#10004; Seguir el estado de tus importaciones</div>
                    <div class="feature">&#10004; Acceder a documentos y facturas</div>
                    <div class="feature">&#10004; Recibir alertas y notificaciones</div>
                </div>
                
                <div style="text-align: center;">
                    <a href="' . SITE_URL . '/panel/" class="button">Ir al Panel</a>
                </div>
            </div>
            <div class="footer">
                <p>Este correo fue enviado automaticamente por Imporlan Chile.</p>
                <p>Si tienes alguna pregunta, contactanos a ' . ADMIN_EMAIL . '</p>
                <p>&copy; ' . date('Y') . ' Imporlan Chile. Todos los derechos reservados.</p>
            </div>
        </div>
    </body>
    </html>';
    
    $sent = sendEmail($userEmail, $subject, $htmlBody);
    
    logEmail([
        'type' => 'welcome',
        'to' => $userEmail,
        'subject' => $subject,
        'sent' => $sent,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
    echo json_encode(['success' => $sent]);
}

/**
 * Send notification to admin
 */
function sendAdminNotification($data) {
    $subject = isset($data['subject']) ? $data['subject'] : 'Notificacion del Sistema';
    $message = isset($data['message']) ? $data['message'] : '';
    $type = isset($data['type']) ? $data['type'] : 'info';
    
    $bgColor = $type === 'error' ? '#ef4444' : ($type === 'warning' ? '#f59e0b' : '#10b981');
    
    $htmlBody = '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1e293b; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
            .alert { background: ' . $bgColor . '; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .message { background: white; padding: 20px; border-radius: 8px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>IMPORLAN ADMIN</h1>
            </div>
            <div class="content">
                <div class="alert">
                    <strong>' . htmlspecialchars($subject) . '</strong>
                </div>
                <div class="message">
                    ' . nl2br(htmlspecialchars($message)) . '
                </div>
                <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
                    Fecha: ' . date('d/m/Y H:i:s') . '
                </p>
            </div>
        </div>
    </body>
    </html>';
    
    $sent = sendEmail(ADMIN_EMAIL, $subject, $htmlBody);
    
    echo json_encode(['success' => $sent]);
}

/**
 * Send email using PHP mail() function
 */
function sendEmail($to, $subject, $htmlBody) {
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type: text/html; charset=UTF-8\r\n";
    $headers .= "From: " . FROM_NAME . " <" . FROM_EMAIL . ">\r\n";
    $headers .= "Reply-To: " . ADMIN_EMAIL . "\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();
    
    return @mail($to, $subject, $htmlBody, $headers);
}

/**
 * Log email attempts for debugging
 */
function logEmail($data) {
    $logFile = __DIR__ . '/email_log.json';
    $logs = [];
    
    if (file_exists($logFile)) {
        $content = file_get_contents($logFile);
        $logs = json_decode($content, true) ?: [];
    }
    
    // Keep only last 100 logs
    if (count($logs) >= 100) {
        $logs = array_slice($logs, -99);
    }
    
    $logs[] = $data;
    file_put_contents($logFile, json_encode($logs, JSON_PRETTY_PRINT));
}
?>
