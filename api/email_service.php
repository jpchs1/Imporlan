<?php
/**
 * Email Service - Imporlan Panel
 * Professional SMTP-based email service with templates matching /panel/ design exactly
 * 
 * Design cloned from: https://www.imporlan.cl/panel/
 * Colors: #0a1628 (dark blue bg), #1a365d (gradient), #3b82f6 (primary button), #60a5fa (accent)
 * 
 * Logo: CID inline attachment (multipart/related MIME) - NOT data URI
 * This ensures Gmail renders the logo correctly without corruption
 * 
 * @version 12.0 - CID inline logo with base64 encoding for both HTML and image (fixes Exim line length)
 * @author Imporlan Development Team
 */

require_once __DIR__ . '/db_config.php';

class EmailService {
    protected $pdo;
    
    // SMTP Configuration
    private $smtpHost = 'mail.imporlan.cl';
    private $smtpPort = 465;
    private $smtpSecure = 'ssl';
    private $smtpUsername = 'contacto@imporlan.cl';
    private $smtpPassword = '^IBn?P-Z5@#_';
    
    // Email Configuration
    private $fromEmail = 'contacto@imporlan.cl';
    private $fromName = 'Imporlan';
    private $replyTo = 'contacto@imporlan.cl';
    
    // URLs
    private $panelUrl = 'https://www.imporlan.cl/panel';
    private $myProductsUrl = 'https://www.imporlan.cl/panel/mis-productos';
    protected $websiteUrl = 'https://www.imporlan.cl';
    
    // Internal notification recipients
    protected $adminEmails = ['contacto@imporlan.cl', 'jpchs1@gmail.com'];
    
    // TEST Environment Configuration
    // When isTestEnvironment is true, ALL emails are redirected to testRecipient
    // This allows testing real email flows without sending to actual users
    protected $isTestEnvironment = false;
    private $testRecipient = 'jpchs1@gmail.com';
    
    // Design tokens (matching /panel/ exactly)
    protected $colors = [
        'bg_dark' => '#0a1628',
        'bg_gradient_end' => '#1a365d',
        'primary' => '#3b82f6',
        'primary_hover' => '#2563eb',
        'accent' => '#60a5fa',
        'success' => '#22c55e',
        'error' => '#ef4444',
        'warning' => '#f97316',
        'text_white' => '#ffffff',
        'text_light' => '#94a3b8',
        'text_muted' => '#64748b',
        'text_dark' => '#1e293b',
        'card_bg' => '#ffffff',
        'card_dark' => 'rgba(30, 58, 95, 0.8)',
        'border' => '#e2e8f0'
    ];
    
    public function __construct() {
        $this->pdo = getDbConnection();
        
        // Auto-detect TEST environment based on script path
        // If running from /test/, /panel-test/, or /api-test/ directories, enable test mode
        $scriptPath = $_SERVER['SCRIPT_FILENAME'] ?? __FILE__;
        $requestUri = $_SERVER['REQUEST_URI'] ?? '';
        if (strpos($scriptPath, '/test/') !== false || 
            strpos($scriptPath, '/panel-test/') !== false ||
            strpos($requestUri, '/test/') !== false ||
            strpos($requestUri, '/panel-test/') !== false) {
            $this->isTestEnvironment = true;
        }
    }
    
    /**
     * Get the logo as raw Base64 for CID inline attachment
     * RFC 2045 compliant: max 76 characters per line
     */
    private function getLogoBase64() {
        // Get raw Base64 and normalize line breaks to CRLF for MIME compliance
        $base64 = $this->getLogoDataRaw();
        // Remove any existing line breaks and re-wrap to 76 chars with CRLF
        $base64Clean = str_replace(["\r\n", "\r", "\n"], '', $base64);
        return chunk_split($base64Clean, 76, "\r\n");
    }
    
    /**
     * Get the logo data as raw Base64 (RFC 2045: 76 chars per line)
     */
    private function getLogoDataRaw() {
        $base64 = <<<'BASE64'
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
BASE64;
        
        // Return raw Base64 (with line breaks for RFC 2045 compliance)
        return $base64;
    }
    
    /**
     * Get the logo CID reference for use in HTML
     */
    private function getLogoCid() {
        return 'cid:logo-imporlan';
    }

        public function sendWelcomeEmail($userEmail, $firstName) {
        $subject = "Bienvenido a Imporlan";
        $htmlContent = $this->getWelcomeTemplate($firstName);
        
        $this->sendInternalNotification('new_registration', [
            'user_email' => $userEmail,
            'user_name' => $firstName,
            'registration_date' => date('d/m/Y H:i')
        ]);
        
        return $this->sendEmail($userEmail, $subject, $htmlContent, 'welcome');
    }
    
    /**
     * Send purchase confirmation email
     */
    public function sendPurchaseConfirmationEmail($userEmail, $firstName, $purchaseData) {
        $subject = "Confirmacion de tu compra en Imporlan";
        $htmlContent = $this->getPurchaseConfirmationTemplate($firstName, $purchaseData);
        
        $this->sendInternalNotification('new_purchase', [
            'user_email' => $userEmail,
            'user_name' => $firstName,
            'product_name' => $purchaseData['product_name'],
            'amount' => number_format($purchaseData['price'], 0, ',', '.'),
            'currency' => $purchaseData['currency'] ?? 'CLP',
            'payment_method' => $purchaseData['payment_method'],
            'purchase_date' => $purchaseData['purchase_date'] ?? date('d/m/Y')
        ]);
        
        return $this->sendEmail($userEmail, $subject, $htmlContent, 'purchase_confirmation', $purchaseData);
    }
    
    /**
     * Send payment status change email
     */
    public function sendPaymentStatusEmail($userEmail, $firstName, $statusData) {
        $status = $statusData['status'];
        $subjects = [
            'approved' => 'Pago aprobado - Imporlan',
            'rejected' => 'Pago rechazado - Imporlan',
            'activated' => 'Servicio activado - Imporlan',
            'renewal' => 'Renovacion de servicio - Imporlan'
        ];
        
        $subject = $subjects[$status] ?? 'Actualizacion de tu servicio - Imporlan';
        $htmlContent = $this->getPaymentStatusTemplate($firstName, $statusData);
        
        if ($status === 'rejected') {
            $this->sendInternalNotification('failed_payment', [
                'user_email' => $userEmail,
                'user_name' => $firstName,
                'product_name' => $statusData['product_name'] ?? 'N/A',
                'amount' => isset($statusData['amount']) ? number_format($statusData['amount'], 0, ',', '.') : '',
                'reason' => $statusData['reason'] ?? 'No especificado'
            ]);
        }
        
        return $this->sendEmail($userEmail, $subject, $htmlContent, 'payment_status', $statusData);
    }
    
    /**
     * Send internal notification to admin
     */
    public function sendInternalNotification($type, $data) {
        $notifications = [
            'new_registration' => ['subject' => 'Nuevo registro de usuario', 'template' => 'internal_new_registration'],
            'new_purchase' => ['subject' => 'Nueva compra realizada', 'template' => 'internal_new_purchase'],
            'failed_payment' => ['subject' => 'Pago fallido', 'template' => 'internal_failed_payment'],
            'critical_error' => ['subject' => 'Error critico del sistema', 'template' => 'internal_critical_error'],
            'support_request' => ['subject' => 'Solicitud de soporte/contacto', 'template' => 'internal_support_request'],
            'quotation_request' => ['subject' => 'Nueva solicitud de cotizacion', 'template' => 'internal_quotation_request'],
            'quotation_links_paid' => ['subject' => 'Cotizacion por Links - Pago Confirmado', 'template' => 'internal_quotation_links_paid'],
            'new_chat_message' => ['subject' => 'Nuevo mensaje de chat', 'template' => 'internal_new_chat_message']
        ];
        
        if (!isset($notifications[$type])) {
            return ['success' => false, 'error' => 'Unknown notification type'];
        }
        
        $config = $notifications[$type];
        $htmlContent = $this->getInternalNotificationTemplate($config['template'], $data);
        
        $results = [];
        foreach ($this->adminEmails as $adminEmail) {
            $results[] = $this->sendEmail($adminEmail, $config['subject'], $htmlContent, 'internal_' . $type, $data);
        }
        
        return ['success' => true, 'results' => $results];
    }
    
    public function sendSupportRequestNotification($requestData) {
        return $this->sendInternalNotification('support_request', [
            'name' => $requestData['name'],
            'email' => $requestData['email'],
            'phone' => $requestData['phone'] ?? 'No proporcionado',
            'subject' => $requestData['subject'] ?? 'Consulta general',
            'message' => $requestData['message'],
            'date' => date('d/m/Y H:i')
        ]);
    }
    
    public function sendSupportConfirmation($userEmail, $userName, $subject) {
        $c = $this->colors;
        
        $content = '
            <div style="text-align: center; margin-bottom: 25px;">
                ' . $this->getStatusBadge('success', 'Recibido') . '
            </div>
            
            <h2 style="margin: 0 0 15px 0; color: ' . $c['text_dark'] . '; font-size: 22px; font-weight: 700; text-align: center;">
                Hemos recibido tu solicitud
            </h2>
            
            <p style="margin: 0 0 25px 0; color: ' . $c['text_muted'] . '; font-size: 15px; text-align: center; line-height: 1.6;">
                Hola ' . htmlspecialchars($userName) . ', tu mensaje sobre <strong style="color: ' . $c['text_dark'] . ';">' . htmlspecialchars($subject) . '</strong> ha sido recibido correctamente.
            </p>
            
            <p style="margin: 0 0 25px 0; color: ' . $c['text_muted'] . '; font-size: 14px; text-align: center; line-height: 1.6;">
                Nuestro equipo revisara tu solicitud y te responderemos a la brevedad posible, generalmente dentro de las proximas 24 horas habiles.
            </p>
            
            <div style="margin: 30px 0; text-align: center;">
                ' . $this->getButton('Ir al Panel', $this->panelUrl) . '
            </div>
            
            <p style="margin: 20px 0 0 0; color: ' . $c['text_muted'] . '; font-size: 13px; text-align: center;">
                Si necesitas asistencia urgente, puedes contactarnos directamente a <a href="mailto:contacto@imporlan.cl" style="color: ' . $c['primary'] . '; text-decoration: none;">contacto@imporlan.cl</a>
            </p>';
        
        $htmlContent = $this->getBaseTemplate($content, 'Solicitud recibida');
        return $this->sendEmail($userEmail, 'Hemos recibido tu solicitud - Imporlan', $htmlContent, 'support_confirmation', ['subject' => $subject]);
    }
    
    public function sendQuotationLinksPaidEmail($userEmail, $firstName, $purchaseData) {
        $isPlan = ($purchaseData['purchase_type'] ?? '') === 'plan';
        $subject = $isPlan
            ? ($purchaseData['plan_name'] ?? 'Plan de Busqueda') . ' - Confirmacion de Pago'
            : 'Cotizacion por Links - Confirmacion de Pago';
        $htmlContent = $this->getQuotationLinksPaidTemplate($firstName, $purchaseData);
        
        $this->sendInternalNotification('quotation_links_paid', [
            'user_email' => $userEmail,
            'user_name' => $firstName,
            'description' => $purchaseData['description'] ?? ($isPlan ? $purchaseData['plan_name'] ?? 'Plan de Busqueda' : 'Cotizacion por Links'),
            'items' => $purchaseData['items'] ?? [],
            'amount' => number_format($purchaseData['price'], 0, ',', '.'),
            'currency' => $purchaseData['currency'] ?? 'CLP',
            'payment_method' => $purchaseData['payment_method'],
            'payment_reference' => $purchaseData['payment_reference'] ?? 'N/A',
            'purchase_date' => $purchaseData['purchase_date'] ?? date('d/m/Y'),
            'purchase_type' => $purchaseData['purchase_type'] ?? 'link',
            'plan_name' => $purchaseData['plan_name'] ?? '',
            'plan_days' => $purchaseData['plan_days'] ?? 0,
            'plan_proposals' => $purchaseData['plan_proposals'] ?? 0
        ]);
        
        return $this->sendEmail($userEmail, $subject, $htmlContent, 'quotation_links_paid', $purchaseData);
    }
    
    public function sendQuotationRequestNotification($requestData) {
        $this->storeQuotationRequest($requestData);
        
        $formData = [
            'name' => $requestData['name'],
            'email' => $requestData['email'],
            'phone' => $requestData['phone'] ?? 'No proporcionado',
            'country' => $requestData['country'] ?? 'Chile',
            'boat_links' => $requestData['boat_links'] ?? [],
            'date' => date('d/m/Y H:i')
        ];
        
        $this->sendInternalNotification('quotation_request', $formData);
        
        $htmlContent = $this->getQuotationFormTemplate($formData['name'], $formData);
        return $this->sendEmail($formData['email'], 'Cotizacion por Links - Formulario de Solicitud', $htmlContent, 'quotation_form', $formData);
    }
    
    public function sendQuotationFormEmail($userEmail, $firstName, $formData) {
        $htmlContent = $this->getQuotationFormTemplate($firstName, $formData);
        $subject = 'Cotizacion por Links - Formulario de Servicios';
        
        $this->sendEmail($userEmail, $subject, $htmlContent, 'quotation_form_client', $formData);
        
        $adminHtml = $this->getQuotationFormAdminTemplate($firstName, $formData);
        $adminSubject = 'Cotizacion por Links - Formulario del Cliente';
        foreach ($this->adminEmails as $adminEmail) {
            $this->sendEmail($adminEmail, $adminSubject, $adminHtml, 'quotation_form_admin', $formData);
        }
        
        return ['success' => true];
    }
    
    private function storeQuotationRequest($requestData) {
        $file = __DIR__ . '/quotation_requests.json';
        $data = file_exists($file) ? json_decode(file_get_contents($file), true) : ['requests' => []];
        if (!is_array($data)) $data = ['requests' => []];
        
        $data['requests'][] = [
            'id' => 'qr_' . uniqid(),
            'name' => $requestData['name'] ?? '',
            'email' => $requestData['email'] ?? '',
            'phone' => $requestData['phone'] ?? '',
            'country' => $requestData['country'] ?? 'Chile',
            'boat_links' => $requestData['boat_links'] ?? [],
            'date' => date('Y-m-d H:i:s')
        ];
        
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
    }
    
    public function getStoredQuotationLinks($email) {
        $file = __DIR__ . '/quotation_requests.json';
        if (!file_exists($file)) return [];
        
        $data = json_decode(file_get_contents($file), true);
        $requests = $data['requests'] ?? [];
        
        $matches = array_filter($requests, function($r) use ($email) {
            return strtolower($r['email'] ?? '') === strtolower($email);
        });
        
        if (empty($matches)) return [];
        $latest = end($matches);
        return $latest['boat_links'] ?? [];
    }
    
    public function sendCriticalErrorNotification($errorData) {
        return $this->sendInternalNotification('critical_error', [
            'error_type' => $errorData['type'] ?? 'Unknown',
            'error_message' => $errorData['message'],
            'file' => $errorData['file'] ?? 'N/A',
            'line' => $errorData['line'] ?? 'N/A',
            'stack_trace' => $errorData['stack_trace'] ?? '',
            'date' => date('d/m/Y H:i:s')
        ]);
    }
    
    /**
     * Send email using SMTP ONLY (no mail() fallback)
     * Uses multipart/related MIME with CID inline image for logo
     * 
     * IMPORTANT: No fallback to mail() - all emails MUST go through SMTP/MailChannels
     * This ensures proper SPF/DKIM authentication. Using mail() would bypass MailChannels.
     * 
     * TEST MODE: When isTestEnvironment is true, all emails are redirected to testRecipient
     * The original recipient is logged but not used for actual delivery
     */
    protected function sendEmail($to, $subject, $htmlContent, $template, $metadata = null) {
        // Store original recipient for logging
        $originalRecipient = $to;
        
        // TEST ENVIRONMENT OVERRIDE: Redirect all emails to test recipient
        if ($this->isTestEnvironment) {
            $to = $this->testRecipient;
            // Add original recipient info to subject for clarity
            $subject = '[TEST - Para: ' . $originalRecipient . '] ' . $subject;
        }
        
        $logId = $this->logEmail($originalRecipient, $template, $subject, 'pending', null, $metadata);
        
        try {
            // Create multipart/related MIME message with CID inline logo
            $boundary = '----=_Part_' . md5(uniqid(time()));
            
            // Get logo as raw Base64 (RFC 2045: 76 chars per line)
            $logoBase64 = $this->getLogoBase64();
            
            // Build multipart body
            // HTML part - use base64 encoding to avoid line length issues
            $htmlBase64 = chunk_split(base64_encode($htmlContent), 76, "\r\n");
            
            $body = "--{$boundary}\r\n";
            $body .= "Content-Type: text/html; charset=UTF-8\r\n";
            $body .= "Content-Transfer-Encoding: base64\r\n";
            $body .= "\r\n";
            $body .= $htmlBase64;
            $body .= "\r\n";
            $body .= "--{$boundary}\r\n";
            $body .= "Content-Type: image/png; name=\"logo.png\"\r\n";
            $body .= "Content-Transfer-Encoding: base64\r\n";
            $body .= "Content-ID: <logo-imporlan>\r\n";
            $body .= "Content-Disposition: inline; filename=\"logo.png\"\r\n";
            $body .= "\r\n";
            $body .= $logoBase64;
            $body .= "--{$boundary}--\r\n";
            
            $headers = [
                'MIME-Version: 1.0',
                'Content-Type: multipart/related; boundary="' . $boundary . '"',
                'From: ' . $this->fromName . ' <' . $this->fromEmail . '>',
                'Reply-To: ' . $this->replyTo,
                'X-Mailer: Imporlan-Mailer/4.0',
                'X-Priority: 3'
            ];
            
            $result = $this->sendViaSMTP($to, $subject, $body, $headers);
            
            if ($result['success']) {
                $this->updateEmailLog($logId, 'sent');
                return ['success' => true, 'message' => 'Email enviado correctamente via SMTP'];
            } else {
                // NO FALLBACK TO mail() - This ensures all emails go through MailChannels for proper SPF/DKIM
                // Using mail() would bypass MailChannels and fail SPF authentication
                $errorMessage = $result['error'] ?? 'SMTP send failed';
                $this->updateEmailLog($logId, 'failed', 'SMTP Error: ' . $errorMessage);
                return ['success' => false, 'error' => 'Error SMTP: ' . $errorMessage];
            }
        } catch (Exception $e) {
            $this->updateEmailLog($logId, 'failed', $e->getMessage());
            return ['success' => false, 'error' => 'Excepcion: ' . $e->getMessage()];
        }
    }
    
    /**
     * Send email via SMTP
     */
    private function sendViaSMTP($to, $subject, $body, $headers) {
        try {
            $socket = @fsockopen(
                ($this->smtpSecure === 'ssl' ? 'ssl://' : '') . $this->smtpHost,
                $this->smtpPort,
                $errno,
                $errstr,
                30
            );
            
            if (!$socket) {
                return ['success' => false, 'error' => "Connection failed: $errstr ($errno)"];
            }
            
            $this->smtpGetResponse($socket);
            $this->smtpSendCommand($socket, "EHLO " . gethostname());
            $this->smtpGetResponse($socket);
            $this->smtpSendCommand($socket, "AUTH LOGIN");
            $this->smtpGetResponse($socket);
            $this->smtpSendCommand($socket, base64_encode($this->smtpUsername));
            $this->smtpGetResponse($socket);
            $this->smtpSendCommand($socket, base64_encode($this->smtpPassword));
            $response = $this->smtpGetResponse($socket);
            
            if (strpos($response, '235') === false && strpos($response, '250') === false) {
                fclose($socket);
                return ['success' => false, 'error' => 'Authentication failed: ' . $response];
            }
            
            $this->smtpSendCommand($socket, "MAIL FROM:<{$this->fromEmail}>");
            $this->smtpGetResponse($socket);
            $this->smtpSendCommand($socket, "RCPT TO:<{$to}>");
            $this->smtpGetResponse($socket);
            $this->smtpSendCommand($socket, "DATA");
            $this->smtpGetResponse($socket);
            
            $message = "Subject: {$subject}\r\n";
            $message .= "To: {$to}\r\n";
            foreach ($headers as $header) {
                $message .= $header . "\r\n";
            }
            $message .= "\r\n";
            $message .= $body;
            $message .= "\r\n.";
            
            $this->smtpSendCommand($socket, $message);
            $response = $this->smtpGetResponse($socket);
            
            $this->smtpSendCommand($socket, "QUIT");
            fclose($socket);
            
            if (strpos($response, '250') !== false) {
                return ['success' => true];
            } else {
                return ['success' => false, 'error' => 'Send failed: ' . $response];
            }
            
        } catch (Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
    
    private function smtpSendCommand($socket, $command) {
        fwrite($socket, $command . "\r\n");
    }
    
    private function smtpGetResponse($socket) {
        $response = '';
        while ($line = fgets($socket, 515)) {
            $response .= $line;
            if (substr($line, 3, 1) == ' ') break;
        }
        return $response;
    }
    
    /**
     * =====================================================
     * EMAIL TEMPLATES - Cloned from /panel/ design
     * =====================================================
     */
    
    /**
     * Base Template - Exact clone of /panel/ visual style
     */
    protected function getBaseTemplate($content, $title = 'Imporlan') {
        $c = $this->colors;
        
        return '<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8">
    
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>' . htmlspecialchars($title) . '</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ' . $c['bg_dark'] . '; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
    <!-- Wrapper Table -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(180deg, ' . $c['bg_dark'] . ' 0%, ' . $c['bg_gradient_end'] . ' 100%); min-height: 100vh;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <!-- Main Container -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
                    
                    <!-- Header with Logo -->
                    <tr>
                        <td align="center" style="padding: 0 0 30px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="center" style="padding-bottom: 15px;">
                                        <!-- Logo Container - Gmail compatible (no border-radius on img, no div) -->
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color: ' . $c['bg_dark'] . ';">
                                            <tr>
                                                <td align="center" valign="middle" style="padding: 0;">
                                                    <img src="' . $this->getLogoCid() . '" alt="Imporlan" width="64" height="64" style="display: block; border: 0; outline: none;">
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center">
                                        <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">
                                            <span style="color: ' . $c['accent'] . ';">IMPOR</span><span style="color: ' . $c['text_white'] . ';">LAN</span>
                                        </h1>
                                        <p style="margin: 8px 0 0 0; color: ' . $c['accent'] . '; font-size: 14px; font-weight: 400;">
                                            Tu lancha, puerta a puerta
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Main Content Card - matching /panel/ white card style -->
                    <tr>
                        <td>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ' . $c['card_bg'] . '; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                                <tr>
                                    <td style="padding: 40px 35px;">
                                        ' . $content . '
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 30px 0 0 0;">
                            <p style="margin: 0; color: ' . $c['text_muted'] . '; font-size: 13px;">
                                ' . date('Y') . ' Imporlan. Todos los derechos reservados.
                            </p>
                            <p style="margin: 10px 0 0 0; color: ' . $c['text_muted'] . '; font-size: 12px;">
                                Santiago, Chile
                            </p>
                            <p style="margin: 8px 0 0 0;">
                                <a href="mailto:contacto@imporlan.cl" style="color: ' . $c['accent'] . '; text-decoration: none; font-size: 12px;">contacto@imporlan.cl</a>
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>';
    }
    
    /**
     * Primary CTA Button - matching /panel/ "Entrar" button exactly
     */
    protected function getButton($text, $url, $fullWidth = true) {
        $c = $this->colors;
        $width = $fullWidth ? 'width: 100%;' : '';
        
        return '
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="' . ($fullWidth ? 'width: 100%;' : '') . '">
            <tr>
                <td align="center">
                    <a href="' . htmlspecialchars($url) . '" target="_blank" style="
                        display: inline-block;
                        ' . $width . '
                        background: linear-gradient(135deg, ' . $c['primary'] . ' 0%, ' . $c['primary_hover'] . ' 100%);
                        color: ' . $c['text_white'] . ';
                        text-decoration: none;
                        padding: 14px 32px;
                        border-radius: 8px;
                        font-size: 15px;
                        font-weight: 600;
                        text-align: center;
                        box-sizing: border-box;
                    ">' . htmlspecialchars($text) . '</a>
                </td>
            </tr>
        </table>';
    }
    
    /**
     * Secondary Button - matching /panel/ "Registrar" button style
     */
    protected function getSecondaryButton($text, $url) {
        $c = $this->colors;
        
        return '
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
                <td align="center">
                    <a href="' . htmlspecialchars($url) . '" target="_blank" style="
                        display: inline-block;
                        background: transparent;
                        color: ' . $c['text_dark'] . ';
                        text-decoration: none;
                        padding: 12px 28px;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 500;
                        border: 1px solid ' . $c['border'] . ';
                    ">' . htmlspecialchars($text) . '</a>
                </td>
            </tr>
        </table>';
    }
    
    /**
     * Info Card - matching /panel/ feature cards style
     */
    protected function getInfoCard($title, $items) {
        $c = $this->colors;
        
        $itemsHtml = '';
        foreach ($items as $label => $value) {
            $itemsHtml .= '
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid ' . $c['border'] . ';">
                    <span style="color: ' . $c['text_muted'] . '; font-size: 13px;">' . htmlspecialchars($label) . '</span>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid ' . $c['border'] . '; text-align: right;">
                    <span style="color: ' . $c['text_dark'] . '; font-size: 14px; font-weight: 500;">' . htmlspecialchars($value) . '</span>
                </td>
            </tr>';
        }
        
        return '
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; margin: 20px 0; border-left: 4px solid ' . $c['primary'] . ';">
            <tr>
                <td style="padding: 20px;">
                    <h3 style="margin: 0 0 15px 0; color: ' . $c['text_dark'] . '; font-size: 15px; font-weight: 600;">' . htmlspecialchars($title) . '</h3>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        ' . $itemsHtml . '
                    </table>
                </td>
            </tr>
        </table>';
    }
    
    /**
     * Feature Grid - matching /panel/ feature cards (Tracking, Documentos, etc.)
     * Using solid background color for email client compatibility (gradients not supported)
     */
    private function getFeatureGrid($features) {
        $c = $this->colors;
        
        $html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 25px 0;">';
        
        $chunks = array_chunk($features, 2);
        foreach ($chunks as $row) {
            $html .= '<tr>';
            foreach ($row as $feature) {
                $html .= '
                <td width="50%" style="padding: 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ' . $c['bg_dark'] . '; border-radius: 12px;">
                        <tr>
                            <td align="center" style="padding: 25px 15px; background-color: ' . $c['bg_dark'] . '; border-radius: 12px;">
                                <div style="font-size: 32px; margin-bottom: 12px;">' . $feature['icon'] . '</div>
                                <p style="margin: 0; color: ' . $c['text_white'] . '; font-size: 14px; font-weight: 600; line-height: 1.3;">' . htmlspecialchars($feature['text']) . '</p>
                            </td>
                        </tr>
                    </table>
                </td>';
            }
            if (count($row) === 1) {
                $html .= '<td width="50%" style="padding: 8px;"></td>';
            }
            $html .= '</tr>';
        }
        
        $html .= '</table>';
        return $html;
    }
    
    /**
     * Status Badge
     */
    protected function getStatusBadge($status, $text) {
        $c = $this->colors;
        $colors = [
            'success' => $c['success'],
            'error' => $c['error'],
            'warning' => $c['warning'],
            'info' => $c['primary']
        ];
        $bgColor = $colors[$status] ?? $c['primary'];
        
        return '<span style="display: inline-block; background: ' . $bgColor . '; color: ' . $c['text_white'] . '; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;">' . htmlspecialchars($text) . '</span>';
    }
    
    /**
     * =====================================================
     * USER EMAIL TEMPLATES
     * =====================================================
     */
    
    private function getWelcomeTemplate($firstName) {
        $c = $this->colors;
        
        $content = '
            <h2 style="margin: 0 0 8px 0; color: ' . $c['text_dark'] . '; font-size: 24px; font-weight: 600;">
                Bienvenido a Imporlan
            </h2>
            <p style="margin: 0 0 25px 0; color: ' . $c['text_muted'] . '; font-size: 14px;">
                Hola ' . htmlspecialchars($firstName) . ', gracias por registrarte
            </p>
            
            <p style="margin: 0 0 20px 0; color: ' . $c['text_dark'] . '; font-size: 15px; line-height: 1.6;">
                Ahora tienes acceso a todas las herramientas para importar tu lancha ideal desde USA. Tu panel de cliente esta listo.
            </p>
            
            ' . $this->getFeatureGrid([
                ['icon' => '🚤', 'text' => 'Tracking en Tiempo Real'],
                ['icon' => '📄', 'text' => 'Documentos Digitales'],
                ['icon' => '💰', 'text' => 'Cotizador Online'],
                ['icon' => '💬', 'text' => 'Soporte 24/7']
            ]) . '
            
            <div style="margin: 30px 0;">
                ' . $this->getButton('Ir a mi panel', $this->panelUrl) . '
            </div>
            
            <p style="margin: 25px 0 0 0; color: ' . $c['text_muted'] . '; font-size: 13px; text-align: center;">
                Si tienes alguna pregunta, no dudes en contactarnos.
            </p>';
        
        return $this->getBaseTemplate($content, 'Bienvenido a Imporlan');
    }
    
    private function getPurchaseConfirmationTemplate($firstName, $purchaseData) {
        $c = $this->colors;
        
        $content = '
            <div style="text-align: center; margin-bottom: 25px;">
                ' . $this->getStatusBadge('success', 'Compra confirmada') . '
            </div>
            
            <h2 style="margin: 0 0 8px 0; color: ' . $c['text_dark'] . '; font-size: 24px; font-weight: 600; text-align: center;">
                Gracias por tu compra
            </h2>
            <p style="margin: 0 0 25px 0; color: ' . $c['text_muted'] . '; font-size: 14px; text-align: center;">
                Hola ' . htmlspecialchars($firstName) . ', hemos recibido tu pago correctamente
            </p>
            
            ' . $this->getInfoCard('Detalles de la compra', [
                'Producto' => $purchaseData['product_name'],
                'Tipo' => $purchaseData['product_type'] ?? 'Plan de Busqueda',
                'Monto' => '$' . number_format($purchaseData['price'], 0, ',', '.') . ' ' . ($purchaseData['currency'] ?? 'CLP'),
                'Metodo de pago' => $purchaseData['payment_method'],
                'Referencia' => $purchaseData['payment_reference'] ?? 'N/A',
                'Fecha' => $purchaseData['purchase_date'] ?? date('d/m/Y')
            ]) . '
            
            <div style="margin: 30px 0;">
                ' . $this->getButton('Ver mi compra', $this->myProductsUrl) . '
            </div>
            
            <p style="margin: 25px 0 0 0; color: ' . $c['text_muted'] . '; font-size: 13px; text-align: center;">
                Nuestro equipo comenzara a trabajar en tu solicitud de inmediato.
            </p>';
        
        return $this->getBaseTemplate($content, 'Confirmacion de compra - Imporlan');
    }
    
    private function getQuotationLinksPaidTemplate($firstName, $purchaseData) {
        $c = $this->colors;
        $isPlan = ($purchaseData['purchase_type'] ?? '') === 'plan';
        $emailTitle = $isPlan ? htmlspecialchars($purchaseData['plan_name'] ?? 'Plan de Busqueda') : 'Cotizacion por Links';
        $emailSubtitle = $isPlan ? 'Plan Contratado' : 'Pago Confirmado';
        $heroMessage = $isPlan
            ? 'Hola ' . htmlspecialchars($firstName) . ', tu plan ha sido activado exitosamente. Nuestro equipo comenzara la busqueda de inmediato.'
            : 'Hola ' . htmlspecialchars($firstName) . ', hemos recibido tu pago exitosamente. Nuestro equipo comenzara a trabajar en tu cotizacion de inmediato.';
        
        $planDetailsHtml = '';
        if ($isPlan) {
            $planDays = $purchaseData['plan_days'] ?? 7;
            $planProposals = $purchaseData['plan_proposals'] ?? 5;
            $planEnd = $purchaseData['plan_end_date'] ?? date('d/m/Y', strtotime('+' . $planDays . ' days'));
            $planDetailsHtml = '
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 25px 0;">
                <tr>
                    <td>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; border: 1px solid #bae6fd;">
                            <tr>
                                <td style="padding: 20px;">
                                    <h3 style="margin: 0 0 16px 0; color: ' . $c['text_dark'] . '; font-size: 16px; font-weight: 700; text-align: center;">Detalles del Plan</h3>
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td width="33%" align="center" style="padding: 10px 5px;">
                                                <p style="margin: 0 0 4px 0; color: ' . $c['primary'] . '; font-size: 24px; font-weight: 700;">' . $planDays . '</p>
                                                <p style="margin: 0; color: ' . $c['text_muted'] . '; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Dias Monitoreo</p>
                                            </td>
                                            <td width="34%" align="center" style="padding: 10px 5px; border-left: 1px solid #bae6fd; border-right: 1px solid #bae6fd;">
                                                <p style="margin: 0 0 4px 0; color: ' . $c['primary'] . '; font-size: 24px; font-weight: 700;">' . $planProposals . '</p>
                                                <p style="margin: 0; color: ' . $c['text_muted'] . '; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Propuestas</p>
                                            </td>
                                            <td width="33%" align="center" style="padding: 10px 5px;">
                                                <p style="margin: 0 0 4px 0; color: ' . $c['success'] . '; font-size: 13px; font-weight: 700;">Activo</p>
                                                <p style="margin: 0; color: ' . $c['text_muted'] . '; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Estado</p>
                                            </td>
                                        </tr>
                                    </table>
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 12px; border-top: 1px solid #bae6fd;">
                                        <tr>
                                            <td style="padding: 12px 0 0 0; text-align: center;">
                                                <p style="margin: 0; color: ' . $c['text_muted'] . '; font-size: 12px;">Vigente hasta: <strong style="color: ' . $c['text_dark'] . ';">' . htmlspecialchars($planEnd) . '</strong></p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>';

            $planFeatures = $purchaseData['plan_features'] ?? [];
            if (!empty($planFeatures)) {
                $planDetailsHtml .= '
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 25px 0;">
                    <tr>
                        <td>
                            <h3 style="margin: 0 0 14px 0; color: ' . $c['text_dark'] . '; font-size: 16px; font-weight: 700; text-align: center;">Incluido en tu Plan</h3>
                        </td>
                    </tr>';
                foreach ($planFeatures as $feature) {
                    $planDetailsHtml .= '
                    <tr>
                        <td style="padding: 4px 0;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td width="28" align="center" valign="top" style="padding-top: 2px;">
                                        <span style="color: ' . $c['success'] . '; font-size: 16px;">&#10003;</span>
                                    </td>
                                    <td style="padding-left: 8px;">
                                        <p style="margin: 0; color: ' . $c['text_dark'] . '; font-size: 14px; line-height: 1.5;">' . htmlspecialchars($feature) . '</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>';
                }
                $planDetailsHtml .= '</table>';
            }
        }
        
        $itemsHtml = '';
        $items = $purchaseData['items'] ?? [];
        if (!empty($items) && is_array($items)) {
            $sectionTitle = $isPlan ? 'Servicios Contratados' : 'Links Contratados';
            $itemsHtml = '
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 25px 0;">
                <tr>
                    <td>
                        <h3 style="margin: 0 0 16px 0; color: ' . $c['text_dark'] . '; font-size: 16px; font-weight: 700; text-align: center;">
                            ' . $sectionTitle . '
                        </h3>
                    </td>
                </tr>';
            
            foreach ($items as $i => $item) {
                $title = is_array($item) ? ($item['title'] ?? $item['description'] ?? 'Servicio ' . ($i + 1)) : $item;
                $url = is_array($item) ? ($item['url'] ?? '') : '';
                $isUrl = !empty($url) && (strpos($url, 'http') === 0);
                if (!$isUrl && strpos($title, 'http') === 0) {
                    $url = $title;
                    $isUrl = true;
                }
                
                $titleHtml = $isUrl
                    ? '<a href="' . htmlspecialchars($url) . '" style="color: ' . $c['primary'] . '; text-decoration: none; font-weight: 500; word-break: break-all;" target="_blank">' . htmlspecialchars($title) . '</a>'
                    : '<span style="color: ' . $c['text_dark'] . '; font-weight: 500;">' . htmlspecialchars($title) . '</span>';
                
                $urlLine = '';
                if ($isUrl && $url !== $title) {
                    $urlLine = '<p style="margin: 4px 0 0 0; font-size: 12px; line-height: 1.3;"><a href="' . htmlspecialchars($url) . '" style="color: ' . $c['primary'] . '; text-decoration: none; word-break: break-all;" target="_blank">' . htmlspecialchars($url) . '</a></p>';
                }
                
                $itemsHtml .= '
                <tr>
                    <td style="padding: 6px 0;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-radius: 10px; border: 1px solid #bbf7d0;">
                            <tr>
                                <td width="48" align="center" valign="middle" style="padding: 14px 0 14px 14px;">
                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td align="center" valign="middle" style="width: 32px; height: 32px; background: linear-gradient(135deg, ' . $c['success'] . ' 0%, #16a34a 100%); border-radius: 50%; color: white; font-size: 14px; font-weight: 700;">
                                                ' . ($i + 1) . '
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                                <td style="padding: 14px 14px 14px 12px;">
                                    <p style="margin: 0; font-size: 14px; line-height: 1.4;">' . $titleHtml . '</p>
                                    ' . $urlLine . '
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>';
            }
            
            $itemsHtml .= '</table>';
        }
        
        $nextStepsMsg = $isPlan
            ? 'Nuestro equipo comenzara el monitoreo y te enviara<br>las mejores propuestas dentro del plazo de tu plan.'
            : 'Nuestro equipo revisara tu cotizacion y te contactara<br>en las proximas 24 horas con los detalles.';
        
        $content = '
            <div style="text-align: center; margin-bottom: 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                    <tr>
                        <td align="center" style="padding: 12px 24px; background: linear-gradient(135deg, ' . $c['success'] . ' 0%, #16a34a 100%); border-radius: 50px;">
                            <span style="color: white; font-size: 22px; line-height: 1;">&#10003;</span>
                        </td>
                    </tr>
                </table>
            </div>
            
            <h2 style="margin: 0 0 6px 0; color: ' . $c['text_dark'] . '; font-size: 26px; font-weight: 700; text-align: center; letter-spacing: -0.5px;">
                ' . $emailTitle . '
            </h2>
            <p style="margin: 0 0 8px 0; color: ' . $c['success'] . '; font-size: 14px; font-weight: 600; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
                ' . $emailSubtitle . '
            </p>
            <p style="margin: 0 0 28px 0; color: ' . $c['text_muted'] . '; font-size: 14px; text-align: center; line-height: 1.6;">
                ' . $heroMessage . '
            </p>
            
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 25px 0;">
                <tr>
                    <td align="center">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, ' . $c['bg_dark'] . ' 0%, ' . $c['bg_gradient_end'] . ' 100%); border-radius: 14px; width: 100%;">
                            <tr>
                                <td align="center" style="padding: 28px 20px;">
                                    <p style="margin: 0 0 4px 0; color: ' . $c['text_light'] . '; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500;">Total Pagado</p>
                                    <p style="margin: 0; color: ' . $c['text_white'] . '; font-size: 36px; font-weight: 700; letter-spacing: -1px;">$' . number_format($purchaseData['price'], 0, ',', '.') . '</p>
                                    <p style="margin: 4px 0 0 0; color: ' . $c['accent'] . '; font-size: 14px; font-weight: 500;">' . ($purchaseData['currency'] ?? 'CLP') . '</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
            
            ' . $planDetailsHtml . '
            
            ' . $itemsHtml . '
            
            ' . $this->getInfoCard('Datos del Cliente', [
                'Nombre' => $firstName,
                'Email' => $purchaseData['user_email'] ?? '',
                'Metodo de pago' => $purchaseData['payment_method'],
                'Referencia de pago' => $purchaseData['payment_reference'] ?? 'N/A',
                'Descripcion' => $purchaseData['description'] ?? $emailTitle,
                'Fecha' => $purchaseData['purchase_date'] ?? date('d/m/Y')
            ]) . '
            
            <div style="margin: 30px 0;">
                ' . $this->getButton('Ir a mi Panel', $this->panelUrl) . '
            </div>
            
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 25px 0 0 0; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px;">
                <tr>
                    <td style="padding: 20px; text-align: center;">
                        <p style="margin: 0 0 4px 0; color: ' . $c['primary'] . '; font-size: 14px; font-weight: 600;">Proximos Pasos</p>
                        <p style="margin: 0; color: ' . $c['text_muted'] . '; font-size: 13px; line-height: 1.6;">
                            ' . $nextStepsMsg . '
                        </p>
                    </td>
                </tr>
            </table>
            
            <p style="margin: 20px 0 0 0; color: ' . $c['text_muted'] . '; font-size: 13px; text-align: center;">
                Si tienes alguna consulta, contactanos a <a href="mailto:contacto@imporlan.cl" style="color: ' . $c['primary'] . '; text-decoration: none; font-weight: 500;">contacto@imporlan.cl</a>
            </p>';
        
        return $this->getBaseTemplate($content, $emailTitle . ' - Imporlan');
    }
    
    private function getQuotationFormTemplate($firstName, $formData) {
        $c = $this->colors;
        
        $items = $formData['items'] ?? [];
        $boatLinks = $formData['boat_links'] ?? [];
        $description = $formData['description'] ?? 'Cotizacion por Links';
        $price = $formData['price'] ?? 0;
        $currency = $formData['currency'] ?? 'CLP';
        $paymentMethod = $formData['payment_method'] ?? '';
        $paymentRef = $formData['payment_reference'] ?? '';
        $purchaseDate = $formData['purchase_date'] ?? date('d/m/Y');
        $userEmail = $formData['user_email'] ?? $formData['email'] ?? '';
        
        $linksHtml = '';
        $allLinks = [];
        
        if (!empty($boatLinks) && is_array($boatLinks)) {
            foreach ($boatLinks as $link) {
                if (!empty($link)) $allLinks[] = $link;
            }
        }
        
        if (!empty($items) && is_array($items)) {
            foreach ($items as $item) {
                $title = is_array($item) ? ($item['title'] ?? '') : $item;
                $url = is_array($item) ? ($item['url'] ?? '') : '';
                if (!empty($url) && strpos($url, 'http') === 0) {
                    if (!in_array($url, $allLinks)) $allLinks[] = $url;
                } elseif (strpos($title, 'http') === 0) {
                    if (!in_array($title, $allLinks)) $allLinks[] = $title;
                }
            }
        }
        
        if (!empty($allLinks)) {
            $linksHtml = '
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 25px 0;">
                <tr>
                    <td>
                        <h3 style="margin: 0 0 16px 0; color: ' . $c['text_dark'] . '; font-size: 16px; font-weight: 700; text-align: center;">
                            Links Solicitados para Cotizar
                        </h3>
                    </td>
                </tr>';
            
            foreach ($allLinks as $i => $link) {
                $domain = parse_url($link, PHP_URL_HOST) ?: $link;
                $linksHtml .= '
                <tr>
                    <td style="padding: 6px 0;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 10px; border: 1px solid #93c5fd;">
                            <tr>
                                <td width="48" align="center" valign="middle" style="padding: 14px 0 14px 14px;">
                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td align="center" valign="middle" style="width: 32px; height: 32px; background: linear-gradient(135deg, ' . $c['primary'] . ' 0%, ' . $c['primary_hover'] . ' 100%); border-radius: 50%; color: white; font-size: 14px; font-weight: 700;">
                                                ' . ($i + 1) . '
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                                <td style="padding: 14px 14px 14px 12px;">
                                    <p style="margin: 0 0 4px 0; color: ' . $c['text_muted'] . '; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Enlace ' . ($i + 1) . '</p>
                                    <a href="' . htmlspecialchars($link) . '" style="color: ' . $c['primary'] . '; text-decoration: none; font-size: 13px; font-weight: 500; word-break: break-all; line-height: 1.4;" target="_blank">' . htmlspecialchars($link) . '</a>
                                    <p style="margin: 4px 0 0 0; color: ' . $c['text_light'] . '; font-size: 11px;">' . htmlspecialchars($domain) . '</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>';
            }
            
            $linksHtml .= '</table>';
        }
        
        $itemsTextHtml = '';
        $nonLinkItems = [];
        if (!empty($items) && is_array($items)) {
            foreach ($items as $item) {
                $title = is_array($item) ? ($item['title'] ?? '') : $item;
                $url = is_array($item) ? ($item['url'] ?? '') : '';
                if (empty($url) && strpos($title, 'http') !== 0 && !empty($title)) {
                    $nonLinkItems[] = $title;
                }
            }
        }
        if (!empty($nonLinkItems)) {
            $itemsTextHtml = '
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
                <tr>
                    <td>
                        <h3 style="margin: 0 0 14px 0; color: ' . $c['text_dark'] . '; font-size: 16px; font-weight: 700; text-align: center;">Servicios Contratados</h3>
                    </td>
                </tr>';
            foreach ($nonLinkItems as $i => $itemText) {
                $itemsTextHtml .= '
                <tr>
                    <td style="padding: 4px 0;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-radius: 10px; border: 1px solid #bbf7d0;">
                            <tr>
                                <td width="36" align="center" valign="middle" style="padding: 12px 0 12px 12px;">
                                    <span style="color: ' . $c['success'] . '; font-size: 18px;">&#10003;</span>
                                </td>
                                <td style="padding: 12px 12px 12px 8px;">
                                    <p style="margin: 0; color: ' . $c['text_dark'] . '; font-size: 14px; font-weight: 500;">' . htmlspecialchars($itemText) . '</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>';
            }
            $itemsTextHtml .= '</table>';
        }
        
        $priceHtml = '';
        if ($price > 0) {
            $priceHtml = '
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 25px 0;">
                <tr>
                    <td align="center">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, ' . $c['bg_dark'] . ' 0%, ' . $c['bg_gradient_end'] . ' 100%); border-radius: 14px; width: 100%;">
                            <tr>
                                <td align="center" style="padding: 24px 20px;">
                                    <p style="margin: 0 0 4px 0; color: ' . $c['text_light'] . '; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500;">Total Cotizacion</p>
                                    <p style="margin: 0; color: ' . $c['text_white'] . '; font-size: 32px; font-weight: 700; letter-spacing: -1px;">$' . number_format($price, 0, ',', '.') . '</p>
                                    <p style="margin: 4px 0 0 0; color: ' . $c['accent'] . '; font-size: 14px; font-weight: 500;">' . htmlspecialchars($currency) . '</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>';
        }
        
        $detailItems = ['Nombre' => $firstName, 'Email' => $userEmail];
        if (!empty($formData['phone']) && $formData['phone'] !== 'No proporcionado') {
            $detailItems['Telefono'] = $formData['phone'];
        }
        if (!empty($formData['country'])) {
            $detailItems['Pais destino'] = $formData['country'];
        }
        $detailItems['Servicio'] = $description;
        if (!empty($paymentMethod)) {
            $detailItems['Metodo de pago'] = $paymentMethod;
        }
        if (!empty($paymentRef)) {
            $detailItems['Referencia'] = $paymentRef;
        }
        $detailItems['Fecha'] = $purchaseDate;
        
        $linkCount = count($allLinks);
        $summaryText = $linkCount > 0
            ? 'Hemos recibido tu solicitud con ' . $linkCount . ' enlace' . ($linkCount > 1 ? 's' : '') . ' para cotizar. Nuestro equipo revisara cada uno y te contactara con los detalles.'
            : 'Hemos recibido tu solicitud de cotizacion. Nuestro equipo la revisara y te contactara con los detalles a la brevedad.';
        
        $content = '
            <div style="text-align: center; margin-bottom: 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                    <tr>
                        <td align="center" style="padding: 12px 24px; background: linear-gradient(135deg, ' . $c['primary'] . ' 0%, ' . $c['primary_hover'] . ' 100%); border-radius: 50px;">
                            <span style="color: white; font-size: 22px; line-height: 1;">&#9993;</span>
                        </td>
                    </tr>
                </table>
            </div>
            
            <h2 style="margin: 0 0 6px 0; color: ' . $c['text_dark'] . '; font-size: 24px; font-weight: 700; text-align: center; letter-spacing: -0.5px;">
                Cotizacion por Links
            </h2>
            <p style="margin: 0 0 8px 0; color: ' . $c['primary'] . '; font-size: 14px; font-weight: 600; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
                Formulario de Solicitud
            </p>
            <p style="margin: 0 0 28px 0; color: ' . $c['text_muted'] . '; font-size: 14px; text-align: center; line-height: 1.6;">
                Hola ' . htmlspecialchars($firstName) . ', ' . $summaryText . '
            </p>
            
            ' . $priceHtml . '
            
            ' . $linksHtml . '
            
            ' . $itemsTextHtml . '
            
            ' . $this->getInfoCard('Datos de la Solicitud', $detailItems) . '
            
            <div style="margin: 30px 0;">
                ' . $this->getButton('Ir a mi Panel', $this->panelUrl) . '
            </div>
            
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 25px 0 0 0; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px;">
                <tr>
                    <td style="padding: 20px; text-align: center;">
                        <p style="margin: 0 0 4px 0; color: ' . $c['primary'] . '; font-size: 14px; font-weight: 600;">Proximos Pasos</p>
                        <p style="margin: 0; color: ' . $c['text_muted'] . '; font-size: 13px; line-height: 1.6;">
                            Nuestro equipo revisara tu cotizacion y te contactara<br>en las proximas 24 horas con los detalles y propuestas.
                        </p>
                    </td>
                </tr>
            </table>
            
            <p style="margin: 20px 0 0 0; color: ' . $c['text_muted'] . '; font-size: 13px; text-align: center;">
                Si tienes alguna consulta, contactanos a <a href="mailto:contacto@imporlan.cl" style="color: ' . $c['primary'] . '; text-decoration: none; font-weight: 500;">contacto@imporlan.cl</a>
            </p>';
        
        return $this->getBaseTemplate($content, 'Cotizacion por Links - Imporlan');
    }
    
    private function getQuotationFormAdminTemplate($firstName, $formData) {
        $c = $this->colors;
        
        $items = $formData['items'] ?? [];
        $boatLinks = $formData['boat_links'] ?? [];
        $description = $formData['description'] ?? 'Cotizacion por Links';
        $price = $formData['price'] ?? 0;
        $currency = $formData['currency'] ?? 'CLP';
        $userEmail = $formData['user_email'] ?? $formData['email'] ?? '';
        
        $allLinks = [];
        if (!empty($boatLinks) && is_array($boatLinks)) {
            foreach ($boatLinks as $link) {
                if (!empty($link)) $allLinks[] = $link;
            }
        }
        if (!empty($items) && is_array($items)) {
            foreach ($items as $item) {
                $title = is_array($item) ? ($item['title'] ?? '') : $item;
                $url = is_array($item) ? ($item['url'] ?? '') : '';
                if (!empty($url) && strpos($url, 'http') === 0 && !in_array($url, $allLinks)) {
                    $allLinks[] = $url;
                } elseif (strpos($title, 'http') === 0 && !in_array($title, $allLinks)) {
                    $allLinks[] = $title;
                }
            }
        }
        
        $linksHtml = '';
        if (!empty($allLinks)) {
            $linksHtml = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #eff6ff; border-radius: 12px; margin: 20px 0; border-left: 4px solid ' . $c['primary'] . ';">
                <tr>
                    <td style="padding: 20px;">
                        <h3 style="margin: 0 0 15px 0; color: ' . $c['text_dark'] . '; font-size: 15px; font-weight: 600;">Links Solicitados (' . count($allLinks) . ')</h3>';
            foreach ($allLinks as $i => $link) {
                $linksHtml .= '<p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: ' . $c['primary'] . ';">Link ' . ($i + 1) . ':</strong> <a href="' . htmlspecialchars($link) . '" style="color: ' . $c['primary'] . '; word-break: break-all;">' . htmlspecialchars($link) . '</a></p>';
            }
            $linksHtml .= '</td></tr></table>';
        }
        
        $itemsHtml = '';
        if (!empty($items) && is_array($items)) {
            $nonLinks = [];
            foreach ($items as $item) {
                $title = is_array($item) ? ($item['title'] ?? '') : $item;
                $url = is_array($item) ? ($item['url'] ?? '') : '';
                if (empty($url) && strpos($title, 'http') !== 0 && !empty($title)) {
                    $nonLinks[] = $title;
                }
            }
            if (!empty($nonLinks)) {
                $itemsHtml = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f0fdf4; border-radius: 12px; margin: 20px 0; border-left: 4px solid ' . $c['success'] . ';">
                    <tr><td style="padding: 20px;">
                        <h3 style="margin: 0 0 15px 0; color: ' . $c['text_dark'] . '; font-size: 15px; font-weight: 600;">Servicios</h3>';
                foreach ($nonLinks as $i => $t) {
                    $itemsHtml .= '<p style="margin: 0 0 6px 0; font-size: 13px; color: ' . $c['text_dark'] . ';">' . ($i + 1) . '. ' . htmlspecialchars($t) . '</p>';
                }
                $itemsHtml .= '</td></tr></table>';
            }
        }
        
        $detailItems = [
            'Cliente' => $firstName,
            'Email' => $userEmail,
            'Descripcion' => $description,
        ];
        if ($price > 0) {
            $detailItems['Monto'] = '$' . number_format($price, 0, ',', '.') . ' ' . $currency;
        }
        if (!empty($formData['payment_method'])) {
            $detailItems['Metodo'] = $formData['payment_method'];
        }
        if (!empty($formData['payment_reference'])) {
            $detailItems['Referencia'] = $formData['payment_reference'];
        }
        $detailItems['Fecha'] = $formData['purchase_date'] ?? $formData['date'] ?? date('d/m/Y');
        
        $content = '
            <div style="text-align: center; margin-bottom: 25px;">
                ' . $this->getStatusBadge('info', 'Formulario Cotizacion') . '
            </div>
            
            <h2 style="margin: 0 0 25px 0; color: ' . $c['text_dark'] . '; font-size: 20px; font-weight: 600; text-align: center;">
                Formulario de Cotizacion por Links
            </h2>
            
            ' . $this->getInfoCard('Datos del Cliente', $detailItems) . '
            
            ' . $linksHtml . '
            
            ' . $itemsHtml . '
            
            <p style="margin: 20px 0 0 0; color: ' . $c['primary'] . '; font-size: 13px; text-align: center; font-weight: 600;">
                Procesar cotizacion y responder al cliente a la brevedad
            </p>';
        
        return $this->getBaseTemplate($content, 'Formulario Cotizacion - Admin');
    }
    
    private function getPaymentStatusTemplate($firstName, $statusData) {
        $c = $this->colors;
        $status = $statusData['status'];
        
        $statusConfig = [
            'approved' => ['badge' => 'success', 'text' => 'Pago aprobado', 'title' => 'Tu pago fue aprobado'],
            'rejected' => ['badge' => 'error', 'text' => 'Pago rechazado', 'title' => 'Tu pago fue rechazado'],
            'activated' => ['badge' => 'success', 'text' => 'Servicio activo', 'title' => 'Tu servicio esta activo'],
            'renewal' => ['badge' => 'info', 'text' => 'Renovado', 'title' => 'Tu servicio fue renovado']
        ];
        
        $config = $statusConfig[$status] ?? $statusConfig['approved'];
        
        $content = '
            <div style="text-align: center; margin-bottom: 25px;">
                ' . $this->getStatusBadge($config['badge'], $config['text']) . '
            </div>
            
            <h2 style="margin: 0 0 8px 0; color: ' . $c['text_dark'] . '; font-size: 24px; font-weight: 600; text-align: center;">
                ' . $config['title'] . '
            </h2>
            <p style="margin: 0 0 25px 0; color: ' . $c['text_muted'] . '; font-size: 14px; text-align: center;">
                Hola ' . htmlspecialchars($firstName) . '
            </p>';
        
        if (!empty($statusData['product_name'])) {
            $items = ['Producto' => $statusData['product_name']];
            
            if (!empty($statusData['amount'])) {
                $items['Monto'] = '$' . number_format($statusData['amount'], 0, ',', '.') . ' ' . ($statusData['currency'] ?? 'CLP');
            }
            
            if ($status === 'rejected' && !empty($statusData['reason'])) {
                $items['Motivo'] = $statusData['reason'];
            }
            
            $content .= $this->getInfoCard('Detalles', $items);
        }
        
        $content .= '
            <div style="margin: 30px 0;">
                ' . $this->getButton('Acceder a Imporlan', $this->panelUrl) . '
            </div>';
        
        return $this->getBaseTemplate($content, $config['title'] . ' - Imporlan');
    }
    
    /**
     * =====================================================
     * INTERNAL NOTIFICATION TEMPLATES
     * =====================================================
     */
    
    private function getInternalNotificationTemplate($template, $data) {
        switch ($template) {
            case 'internal_new_registration':
                return $this->getInternalNewRegistrationTemplate($data);
            case 'internal_new_purchase':
                return $this->getInternalNewPurchaseTemplate($data);
            case 'internal_failed_payment':
                return $this->getInternalFailedPaymentTemplate($data);
            case 'internal_critical_error':
                return $this->getInternalCriticalErrorTemplate($data);
            case 'internal_support_request':
                return $this->getInternalSupportRequestTemplate($data);
            case 'internal_quotation_request':
                return $this->getInternalQuotationRequestTemplate($data);
            case 'internal_quotation_links_paid':
                return $this->getInternalQuotationLinksPaidTemplate($data);
            case 'internal_new_chat_message':
                return $this->getInternalNewChatMessageTemplate($data);
            default:
                return '';
        }
    }
    
    private function getInternalNewRegistrationTemplate($data) {
        $c = $this->colors;
        
        $content = '
            <div style="text-align: center; margin-bottom: 25px;">
                ' . $this->getStatusBadge('success', 'Nuevo registro') . '
            </div>
            
            <h2 style="margin: 0 0 25px 0; color: ' . $c['text_dark'] . '; font-size: 20px; font-weight: 600; text-align: center;">
                Nuevo usuario registrado
            </h2>
            
            ' . $this->getInfoCard('Datos del usuario', [
                'Nombre' => $data['user_name'],
                'Email' => $data['user_email'],
                'Fecha' => $data['registration_date']
            ]) . '
            
            <p style="margin: 20px 0 0 0; color: ' . $c['text_muted'] . '; font-size: 13px; text-align: center;">
                Notificacion automatica del sistema
            </p>';
        
        return $this->getBaseTemplate($content, 'Nuevo registro - Admin');
    }
    
    private function getInternalNewPurchaseTemplate($data) {
        $c = $this->colors;
        
        $content = '
            <div style="text-align: center; margin-bottom: 25px;">
                ' . $this->getStatusBadge('success', 'Nueva venta') . '
            </div>
            
            <h2 style="margin: 0 0 25px 0; color: ' . $c['text_dark'] . '; font-size: 20px; font-weight: 600; text-align: center;">
                Nueva compra realizada
            </h2>
            
            ' . $this->getInfoCard('Detalles de la compra', [
                'Cliente' => $data['user_name'],
                'Email' => $data['user_email'],
                'Producto' => $data['product_name'],
                'Monto' => '$' . $data['amount'] . ' ' . $data['currency'],
                'Metodo' => $data['payment_method'],
                'Fecha' => $data['purchase_date']
            ]) . '
            
            <p style="margin: 20px 0 0 0; color: ' . $c['text_muted'] . '; font-size: 13px; text-align: center;">
                Notificacion automatica del sistema
            </p>';
        
        return $this->getBaseTemplate($content, 'Nueva compra - Admin');
    }
    
    private function getInternalFailedPaymentTemplate($data) {
        $c = $this->colors;
        
        $content = '
            <div style="text-align: center; margin-bottom: 25px;">
                ' . $this->getStatusBadge('error', 'Pago fallido') . '
            </div>
            
            <h2 style="margin: 0 0 25px 0; color: ' . $c['text_dark'] . '; font-size: 20px; font-weight: 600; text-align: center;">
                Un pago ha fallado
            </h2>
            
            ' . $this->getInfoCard('Detalles del pago fallido', [
                'Cliente' => $data['user_name'],
                'Email' => $data['user_email'],
                'Producto' => $data['product_name'],
                'Monto' => '$' . $data['amount'],
                'Motivo' => $data['reason']
            ]) . '
            
            <p style="margin: 20px 0 0 0; color: ' . $c['error'] . '; font-size: 13px; text-align: center; font-weight: 600;">
                Se recomienda contactar al cliente
            </p>';
        
        return $this->getBaseTemplate($content, 'Pago fallido - Admin');
    }
    
    private function getInternalCriticalErrorTemplate($data) {
        $c = $this->colors;
        
        $content = '
            <div style="text-align: center; margin-bottom: 25px;">
                ' . $this->getStatusBadge('error', 'Error critico') . '
            </div>
            
            <h2 style="margin: 0 0 25px 0; color: ' . $c['text_dark'] . '; font-size: 20px; font-weight: 600; text-align: center;">
                Error critico del sistema
            </h2>
            
            ' . $this->getInfoCard('Detalles del error', [
                'Tipo' => $data['error_type'],
                'Mensaje' => $data['error_message'],
                'Archivo' => $data['file'],
                'Linea' => $data['line'],
                'Fecha' => $data['date']
            ]) . '
            
            <p style="margin: 20px 0 0 0; color: ' . $c['error'] . '; font-size: 14px; text-align: center; font-weight: 700;">
                ATENCION INMEDIATA REQUERIDA
            </p>';
        
        return $this->getBaseTemplate($content, 'Error critico - Admin');
    }
    
    private function getInternalSupportRequestTemplate($data) {
        $c = $this->colors;
        
        $content = '
            <div style="text-align: center; margin-bottom: 25px;">
                ' . $this->getStatusBadge('info', 'Soporte') . '
            </div>
            
            <h2 style="margin: 0 0 25px 0; color: ' . $c['text_dark'] . '; font-size: 20px; font-weight: 600; text-align: center;">
                Nueva solicitud de soporte
            </h2>
            
            ' . $this->getInfoCard('Datos del contacto', [
                'Nombre' => $data['name'],
                'Email' => $data['email'],
                'Telefono' => $data['phone'],
                'Asunto' => $data['subject'],
                'Fecha' => $data['date']
            ]) . '
            
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8fafc; border-radius: 12px; margin: 20px 0; border-left: 4px solid ' . $c['accent'] . ';">
                <tr>
                    <td style="padding: 20px;">
                        <h3 style="margin: 0 0 10px 0; color: ' . $c['text_dark'] . '; font-size: 15px; font-weight: 600;">Mensaje</h3>
                        <p style="margin: 0; color: ' . $c['text_dark'] . '; font-size: 14px; line-height: 1.6;">' . nl2br(htmlspecialchars($data['message'])) . '</p>
                    </td>
                </tr>
            </table>
            
            <p style="margin: 20px 0 0 0; color: ' . $c['primary'] . '; font-size: 13px; text-align: center; font-weight: 600;">
                Responder a la brevedad
            </p>';
        
        return $this->getBaseTemplate($content, 'Solicitud de soporte - Admin');
    }
    
    private function getInternalQuotationRequestTemplate($data) {
        $c = $this->colors;
        
        $boatLinksHtml = '';
        if (!empty($data['boat_links']) && is_array($data['boat_links'])) {
            $boatLinksHtml = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #fff7ed; border-radius: 12px; margin: 20px 0; border-left: 4px solid ' . $c['warning'] . ';">
                <tr>
                    <td style="padding: 20px;">
                        <h3 style="margin: 0 0 15px 0; color: ' . $c['text_dark'] . '; font-size: 15px; font-weight: 600;">Links de lanchas</h3>';
            
            foreach ($data['boat_links'] as $i => $link) {
                if (!empty($link)) {
                    $boatLinksHtml .= '<p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Lancha ' . ($i + 1) . ':</strong> <a href="' . htmlspecialchars($link) . '" style="color: ' . $c['primary'] . '; word-break: break-all;">' . htmlspecialchars($link) . '</a></p>';
                }
            }
            
            $boatLinksHtml .= '</td></tr></table>';
        }
        
        $content = '
            <div style="text-align: center; margin-bottom: 25px;">
                ' . $this->getStatusBadge('warning', 'Cotizacion') . '
            </div>
            
            <h2 style="margin: 0 0 25px 0; color: ' . $c['text_dark'] . '; font-size: 20px; font-weight: 600; text-align: center;">
                Solicitar Cotizacion por Links Online
            </h2>
            
            ' . $this->getInfoCard('Datos del solicitante', [
                'Nombre' => $data['name'],
                'Email' => $data['email'],
                'Telefono' => $data['phone'],
                'Pais destino' => $data['country'],
                'Fecha' => $data['date']
            ]) . '
            
            ' . $boatLinksHtml . '
            
            <p style="margin: 20px 0 0 0; color: ' . $c['warning'] . '; font-size: 13px; text-align: center; font-weight: 600;">
                Responder con cotizacion en menos de 24 horas
            </p>';
        
        return $this->getBaseTemplate($content, 'Nueva cotizacion - Admin');
    }
    
    private function getInternalQuotationLinksPaidTemplate($data) {
        $c = $this->colors;
        $isPlan = ($data['purchase_type'] ?? '') === 'plan';
        $adminTitle = $isPlan
            ? ($data['plan_name'] ?? 'Plan de Busqueda') . ' - Pago Recibido'
            : 'Cotizacion por Links - Pago Recibido';
        
        $planInfoHtml = '';
        if ($isPlan && !empty($data['plan_days'])) {
            $planInfoHtml = '
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f0f9ff; border-radius: 12px; margin: 20px 0; border-left: 4px solid ' . $c['primary'] . ';">
                <tr>
                    <td style="padding: 20px;">
                        <h3 style="margin: 0 0 10px 0; color: ' . $c['text_dark'] . '; font-size: 15px; font-weight: 600;">Detalles del Plan</h3>
                        <p style="margin: 0 0 6px 0; font-size: 13px; color: ' . $c['text_dark'] . ';"><strong>Duracion:</strong> ' . $data['plan_days'] . ' dias</p>
                        <p style="margin: 0; font-size: 13px; color: ' . $c['text_dark'] . ';"><strong>Propuestas:</strong> ' . $data['plan_proposals'] . '</p>
                    </td>
                </tr>
            </table>';
        }
        
        $itemsHtml = '';
        if (!empty($data['items']) && is_array($data['items'])) {
            $sectionLabel = $isPlan ? 'Servicios Contratados' : 'Links Contratados';
            $itemsHtml = '
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-radius: 12px; margin: 20px 0; border-left: 4px solid ' . $c['success'] . ';">
                <tr>
                    <td style="padding: 20px;">
                        <h3 style="margin: 0 0 15px 0; color: ' . $c['text_dark'] . '; font-size: 15px; font-weight: 600;">' . $sectionLabel . '</h3>';
            
            foreach ($data['items'] as $i => $item) {
                $title = is_array($item) ? ($item['title'] ?? $item['description'] ?? 'Servicio ' . ($i + 1)) : $item;
                $url = is_array($item) ? ($item['url'] ?? '') : '';
                $isUrl = !empty($url) && (strpos($url, 'http') === 0);
                if (!$isUrl && strpos($title, 'http') === 0) {
                    $url = $title;
                    $isUrl = true;
                }
                
                $displayContent = $isUrl
                    ? '<a href="' . htmlspecialchars($url ?: $title) . '" style="color: ' . $c['primary'] . '; word-break: break-all;">' . htmlspecialchars($title) . '</a>'
                    : htmlspecialchars($title);
                
                $itemsHtml .= '<p style="margin: 0 0 8px 0; font-size: 13px; color: ' . $c['text_dark'] . ';"><span style="display: inline-block; width: 20px; height: 20px; background: ' . $c['success'] . '; color: white; border-radius: 50%; text-align: center; line-height: 20px; font-size: 11px; margin-right: 8px; font-weight: 700;">' . ($i + 1) . '</span>' . $displayContent . '</p>';
            }
            
            $itemsHtml .= '</td></tr></table>';
        }
        
        $content = '
            <div style="text-align: center; margin-bottom: 25px;">
                ' . $this->getStatusBadge('success', 'Pago Confirmado') . '
            </div>
            
            <h2 style="margin: 0 0 25px 0; color: ' . $c['text_dark'] . '; font-size: 20px; font-weight: 600; text-align: center;">
                ' . htmlspecialchars($adminTitle) . '
            </h2>
            
            ' . $this->getInfoCard('Datos del Cliente', [
                'Cliente' => $data['user_name'],
                'Email' => $data['user_email'],
                'Descripcion' => $data['description'],
                'Monto' => '$' . $data['amount'] . ' ' . $data['currency'],
                'Metodo de pago' => $data['payment_method'],
                'Referencia' => $data['payment_reference'],
                'Fecha' => $data['purchase_date']
            ]) . '
            
            ' . $planInfoHtml . '
            
            ' . $itemsHtml . '
            
            <p style="margin: 20px 0 0 0; color: ' . $c['success'] . '; font-size: 13px; text-align: center; font-weight: 600;">
                ' . ($isPlan ? 'Iniciar monitoreo del plan' : 'Procesar cotizacion a la brevedad') . '
            </p>';
        
        return $this->getBaseTemplate($content, $adminTitle . ' - Admin');
    }
    
    private function getInternalNewChatMessageTemplate($data) {
        $c = $this->colors;
        
        $content = '
            <div style="text-align: center; margin-bottom: 25px;">
                ' . $this->getStatusBadge('info', 'Nuevo mensaje') . '
            </div>
            
            <h2 style="margin: 0 0 25px 0; color: ' . $c['text_dark'] . '; font-size: 20px; font-weight: 600; text-align: center;">
                Nuevo mensaje de chat
            </h2>
            
            ' . $this->getInfoCard('Detalles del mensaje', [
                'Usuario' => $data['user_name'],
                'Email' => $data['user_email'],
                'Conversacion ID' => $data['conversation_id'],
                'Fecha' => $data['date']
            ]) . '
            
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f0f9ff; border-radius: 12px; margin: 20px 0; border-left: 4px solid ' . $c['primary'] . ';">
                <tr>
                    <td style="padding: 20px;">
                        <h3 style="margin: 0 0 10px 0; color: ' . $c['text_dark'] . '; font-size: 15px; font-weight: 600;">Mensaje</h3>
                        <p style="margin: 0; color: ' . $c['text_dark'] . '; font-size: 14px; line-height: 1.6;">' . nl2br(htmlspecialchars($data['message'])) . '</p>
                    </td>
                </tr>
            </table>
            
            <div style="margin: 30px 0; text-align: center;">
                ' . $this->getButton('Responder en el Panel', 'https://www.imporlan.cl/panel/admin/') . '
            </div>
            
            <p style="margin: 20px 0 0 0; color: ' . $c['primary'] . '; font-size: 13px; text-align: center; font-weight: 600;">
                Responder a la brevedad para mantener la satisfaccion del cliente
            </p>';
        
        return $this->getBaseTemplate($content, 'Nuevo mensaje de chat - Admin');
    }
    
    /**
     * =====================================================
     * LOGGING
     * =====================================================
     */
    
    private function logEmail($to, $template, $subject, $status, $error = null, $metadata = null) {
        if (!$this->pdo) return null;
        try {
            $this->ensureEmailLogsTable();
            $stmt = $this->pdo->prepare("INSERT INTO wp_email_logs (to_email, template, subject, status, error_message, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
            $stmt->execute([$to, $template, $subject, $status, $error, $metadata ? json_encode($metadata) : null]);
            return $this->pdo->lastInsertId();
        } catch (PDOException $e) {
            error_log("[EmailService] Error logging email: " . $e->getMessage());
            return null;
        }
    }
    
    private function updateEmailLog($logId, $status, $error = null) {
        if (!$this->pdo || !$logId) return;
        try {
            $stmt = $this->pdo->prepare("UPDATE wp_email_logs SET status = ?, error_message = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$status, $error, $logId]);
        } catch (PDOException $e) {
            error_log("[EmailService] Error updating email log: " . $e->getMessage());
        }
    }
    
    private function ensureEmailLogsTable() {
        try {
            $this->pdo->exec("CREATE TABLE IF NOT EXISTS wp_email_logs (id INT AUTO_INCREMENT PRIMARY KEY, to_email VARCHAR(255) NOT NULL, template VARCHAR(100), subject VARCHAR(255), status ENUM('pending', 'sent', 'failed') DEFAULT 'pending', error_message TEXT, metadata JSON, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_to_email (to_email), INDEX idx_status (status), INDEX idx_created_at (created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        } catch (PDOException $e) {
            error_log("[EmailService] Error creating email_logs table: " . $e->getMessage());
        }
    }
    
    public function getEmailLogs($limit = 100, $offset = 0, $filters = []) {
        if (!$this->pdo) return ['error' => 'Database connection failed'];
        try {
            $where = []; $params = [];
            if (!empty($filters['status'])) { $where[] = 'status = ?'; $params[] = $filters['status']; }
            if (!empty($filters['template'])) { $where[] = 'template LIKE ?'; $params[] = '%' . $filters['template'] . '%'; }
            if (!empty($filters['email'])) { $where[] = 'to_email LIKE ?'; $params[] = '%' . $filters['email'] . '%'; }
            $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';
            $stmt = $this->pdo->prepare("SELECT * FROM wp_email_logs {$whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?");
            $params[] = (int)$limit; $params[] = (int)$offset;
            $stmt->execute($params);
            $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM wp_email_logs {$whereClause}");
            $countStmt->execute(array_slice($params, 0, -2));
            $total = $countStmt->fetchColumn();
            return ['success' => true, 'logs' => $logs, 'total' => $total, 'limit' => $limit, 'offset' => $offset];
        } catch (PDOException $e) {
            return ['error' => 'Failed to fetch logs: ' . $e->getMessage()];
        }
    }
    
    public function getEmailStats() {
        if (!$this->pdo) return ['error' => 'Database connection failed'];
        try {
            $stats = [];
            $stmt = $this->pdo->query("SELECT COUNT(*) FROM wp_email_logs"); $stats['total'] = (int)$stmt->fetchColumn();
            $stmt = $this->pdo->query("SELECT status, COUNT(*) as count FROM wp_email_logs GROUP BY status"); $stats['by_status'] = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
            $stmt = $this->pdo->query("SELECT COUNT(*) FROM wp_email_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"); $stats['last_24h'] = (int)$stmt->fetchColumn();
            return ['success' => true, 'stats' => $stats];
        } catch (PDOException $e) {
            return ['error' => 'Failed to fetch stats: ' . $e->getMessage()];
        }
    }
}

function getEmailService() {
    static $instance = null;
    if ($instance === null) $instance = new EmailService();
    return $instance;
}
