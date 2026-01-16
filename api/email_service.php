<?php
/**
 * Email Service - Imporlan Panel
 * Handles transactional email sending with templates and logging
 */

require_once __DIR__ . '/db_config.php';

class EmailService {
    private $pdo;
    private $fromEmail = 'contacto@imporlan.cl';
    private $fromName = 'Equipo Imporlan';
    private $panelUrl = 'https://www.imporlan.cl/panel';
    private $myProductsUrl = 'https://www.imporlan.cl/panel/mis-productos';
    
    public function __construct() {
        $this->pdo = getDbConnection();
    }
    
    /**
     * Send welcome email after registration
     */
    public function sendWelcomeEmail($userEmail, $firstName) {
        $subject = "Bienvenido a Imporlan 🚤 | Tu panel ya está activo";
        
        $variables = [
            'first_name' => $firstName,
            'panel_url' => $this->panelUrl
        ];
        
        $htmlContent = $this->renderTemplate('welcome', $variables);
        
        return $this->sendEmail($userEmail, $subject, $htmlContent, 'welcome');
    }
    
    /**
     * Send purchase confirmation email
     */
    public function sendPurchaseConfirmationEmail($userEmail, $firstName, $purchaseData) {
        $subject = "Confirmación de tu contratación en Imporlan ✅ | " . $purchaseData['product_name'];
        
        $variables = [
            'first_name' => $firstName,
            'product_name' => $purchaseData['product_name'],
            'product_type' => $purchaseData['product_type'] ?? 'Plan de Búsqueda',
            'amount' => number_format($purchaseData['price'], 0, ',', '.'),
            'currency' => $purchaseData['currency'] ?? 'CLP',
            'payment_method' => $purchaseData['payment_method'],
            'payment_reference' => $purchaseData['payment_reference'] ?? 'N/A',
            'purchase_date' => $purchaseData['purchase_date'] ?? date('d/m/Y'),
            'my_products_url' => $this->myProductsUrl
        ];
        
        $htmlContent = $this->renderTemplate('purchase_confirmation', $variables);
        
        return $this->sendEmail($userEmail, $subject, $htmlContent, 'purchase_confirmation', $purchaseData);
    }
    
    /**
     * Render email template with variables
     */
    private function renderTemplate($templateName, $variables) {
        $templatePath = __DIR__ . '/templates/' . $templateName . '.html';
        
        if (!file_exists($templatePath)) {
            $template = $this->getInlineTemplate($templateName);
        } else {
            $template = file_get_contents($templatePath);
        }
        
        foreach ($variables as $key => $value) {
            $template = str_replace('{{' . $key . '}}', htmlspecialchars($value), $template);
        }
        
        return $template;
    }
    
    /**
     * Get inline template (fallback)
     */
    private function getInlineTemplate($templateName) {
        $templates = [
            'welcome' => $this->getWelcomeTemplate(),
            'purchase_confirmation' => $this->getPurchaseConfirmationTemplate()
        ];
        
        return $templates[$templateName] ?? '';
    }
    
    /**
     * Welcome email template
     */
    private function getWelcomeTemplate() {
        return '<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8">
    
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido a Imporlan</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif; background-color: #f4f7fa;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f7fa;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #0a1628 0%, #1a365d 100%); padding: 30px 40px; border-radius: 16px 16px 0 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td>
                                        <h1 style="margin: 0; color: #00d4ff; font-size: 28px; font-weight: 700;">IMPORLAN</h1>
                                        <p style="margin: 5px 0 0; color: #94a3b8; font-size: 14px;">Tu socio en importaciones</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                            <h2 style="margin: 0 0 20px; color: #1a365d; font-size: 24px;">Hola {{first_name}}, 👋</h2>
                            <p style="margin: 0 0 20px; color: #1a365d; font-size: 18px; font-weight: 600;">¡Bienvenido a Imporlan!</p>
                            <p style="margin: 0 0 25px; color: #475569; font-size: 16px; line-height: 1.6;">
                                Tu cuenta ya está creada y tu panel está listo para que puedas gestionar todo tu proceso de forma simple y transparente.
                            </p>
                            <p style="margin: 0 0 15px; color: #475569; font-size: 16px; font-weight: 600;">Desde tu panel podrás:</p>
                            <ul style="margin: 0 0 25px; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.8;">
                                <li>Ver tus productos y servicios contratados</li>
                                <li>Hacer seguimiento del avance por etapas</li>
                                <li>Acceder a tu información y documentos del proceso</li>
                                <li>Mantener tu historial y comprobantes ordenados</li>
                            </ul>
                            <p style="margin: 0 0 30px; color: #475569; font-size: 16px;">
                                ✅ <strong>Accede aquí:</strong> <a href="{{panel_url}}" style="color: #00d4ff;">{{panel_url}}</a>
                            </p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center">
                                        <a href="{{panel_url}}" style="display: inline-block; background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(0, 212, 255, 0.4);">
                                            Ir a mi Panel
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 30px 0 0; color: #475569; font-size: 15px; line-height: 1.6;">
                                Si necesitas ayuda en cualquier momento, responde este correo y te apoyamos.
                            </p>
                            <p style="margin: 25px 0 0; color: #1a365d; font-size: 15px;">
                                Saludos,<br>
                                <strong>Equipo Imporlan</strong><br>
                                <a href="mailto:contacto@imporlan.cl" style="color: #00d4ff;">contacto@imporlan.cl</a>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px; text-align: center;">
                            <p style="margin: 0; color: #94a3b8; font-size: 13px;">
                                © 2026 Imporlan. Todos los derechos reservados.
                            </p>
                            <p style="margin: 10px 0 0; color: #94a3b8; font-size: 12px;">
                                Este correo fue enviado a {{first_name}} porque te registraste en Imporlan.
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
     * Purchase confirmation email template
     */
    private function getPurchaseConfirmationTemplate() {
        return '<!DOCTYPE html>
<html lang="es">
<head>
    
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmación de Compra - Imporlan</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif; background-color: #f4f7fa;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f7fa;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #0a1628 0%, #1a365d 100%); padding: 30px 40px; border-radius: 16px 16px 0 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td>
                                        <h1 style="margin: 0; color: #00d4ff; font-size: 28px; font-weight: 700;">IMPORLAN</h1>
                                        <p style="margin: 5px 0 0; color: #94a3b8; font-size: 14px;">Tu socio en importaciones</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                            <h2 style="margin: 0 0 20px; color: #1a365d; font-size: 24px;">Hola {{first_name}}, 👋</h2>
                            <p style="margin: 0 0 25px; color: #475569; font-size: 16px; line-height: 1.6;">
                                Tu contratación en Imporlan fue confirmada exitosamente.
                            </p>
                            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; padding: 25px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
                                <h3 style="margin: 0 0 20px; color: #1a365d; font-size: 18px; font-weight: 600;">📋 Resumen de tu compra</h3>
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                                            <span style="color: #64748b; font-size: 14px;">Producto/Servicio:</span>
                                        </td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                                            <span style="color: #1a365d; font-size: 14px; font-weight: 600;">{{product_name}}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                                            <span style="color: #64748b; font-size: 14px;">Tipo:</span>
                                        </td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                                            <span style="color: #1a365d; font-size: 14px;">{{product_type}}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                                            <span style="color: #64748b; font-size: 14px;">Monto:</span>
                                        </td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                                            <span style="color: #00d4ff; font-size: 16px; font-weight: 700;">{{amount}} {{currency}}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                                            <span style="color: #64748b; font-size: 14px;">Método de pago:</span>
                                        </td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                                            <span style="color: #1a365d; font-size: 14px;">{{payment_method}}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                                            <span style="color: #64748b; font-size: 14px;">Referencia:</span>
                                        </td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                                            <span style="color: #1a365d; font-size: 14px; font-family: monospace;">{{payment_reference}}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0;">
                                            <span style="color: #64748b; font-size: 14px;">Fecha:</span>
                                        </td>
                                        <td style="padding: 10px 0; text-align: right;">
                                            <span style="color: #1a365d; font-size: 14px;">{{purchase_date}}</span>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            <p style="margin: 0 0 25px; color: #475569; font-size: 16px; line-height: 1.6;">
                                📌 Ya puedes ver este servicio en tu panel y seguir su estado paso a paso:
                            </p>
                            <p style="margin: 0 0 30px; color: #475569; font-size: 15px;">
                                <a href="{{my_products_url}}" style="color: #00d4ff;">{{my_products_url}}</a>
                            </p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center">
                                        <a href="{{my_products_url}}" style="display: inline-block; background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(0, 212, 255, 0.4);">
                                            Ver mi servicio en el Panel
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 30px 0 0; color: #475569; font-size: 15px; line-height: 1.6;">
                                Si tienes dudas o necesitas soporte, responde este correo y te ayudamos.
                            </p>
                            <p style="margin: 25px 0 0; color: #1a365d; font-size: 15px;">
                                Saludos,<br>
                                <strong>Equipo Imporlan</strong><br>
                                <a href="mailto:contacto@imporlan.cl" style="color: #00d4ff;">contacto@imporlan.cl</a>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px; text-align: center;">
                            <p style="margin: 0; color: #94a3b8; font-size: 13px;">
                                © 2026 Imporlan. Todos los derechos reservados.
                            </p>
                            <p style="margin: 10px 0 0; color: #94a3b8; font-size: 12px;">
                                Este correo fue enviado porque realizaste una compra en Imporlan.
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
     * Send email using PHP mail() function
     */
    private function sendEmail($to, $subject, $htmlContent, $template, $metadata = null) {
        $headers = [
            'MIME-Version: 1.0',
            'Content-type: text/html; charset=UTF-8',
            'From: ' . $this->fromName . ' <' . $this->fromEmail . '>',
            'Reply-To: ' . $this->fromEmail,
            'X-Mailer: PHP/' . phpversion()
        ];
        
        $headersString = implode("\r\n", $headers);
        
        $logId = $this->logEmail($to, $template, $subject, 'pending', null, $metadata);
        
        try {
            $result = mail($to, $subject, $htmlContent, $headersString);
            
            if ($result) {
                $this->updateEmailLog($logId, 'sent');
                return ['success' => true, 'message' => 'Email sent successfully'];
            } else {
                $error = error_get_last();
                $errorMessage = $error ? $error['message'] : 'Unknown error';
                $this->updateEmailLog($logId, 'failed', $errorMessage);
                return ['success' => false, 'error' => 'Failed to send email: ' . $errorMessage];
            }
        } catch (Exception $e) {
            $this->updateEmailLog($logId, 'failed', $e->getMessage());
            return ['success' => false, 'error' => 'Exception: ' . $e->getMessage()];
        }
    }
    
    /**
     * Log email to database
     */
    private function logEmail($to, $template, $subject, $status, $error = null, $metadata = null) {
        if (!$this->pdo) {
            return null;
        }
        
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO wp_email_logs (to_email, template, subject, status, error_message, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $to,
                $template,
                $subject,
                $status,
                $error,
                $metadata ? json_encode($metadata) : null
            ]);
            return $this->pdo->lastInsertId();
        } catch (PDOException $e) {
            error_log("Error logging email: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Update email log status
     */
    private function updateEmailLog($logId, $status, $error = null) {
        if (!$this->pdo || !$logId) {
            return;
        }
        
        try {
            $stmt = $this->pdo->prepare("
                UPDATE wp_email_logs 
                SET status = ?, error_message = ?
                WHERE id = ?
            ");
            $stmt->execute([$status, $error, $logId]);
        } catch (PDOException $e) {
            error_log("Error updating email log: " . $e->getMessage());
        }
    }
    
    /**
     * Get email logs
     */
    public function getEmailLogs($limit = 100, $offset = 0) {
        if (!$this->pdo) {
            return ['error' => 'Database connection failed'];
        }
        
        try {
            $stmt = $this->pdo->prepare("
                SELECT * FROM wp_email_logs 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            ");
            $stmt->execute([$limit, $offset]);
            return ['success' => true, 'logs' => $stmt->fetchAll()];
        } catch (PDOException $e) {
            return ['error' => 'Failed to fetch logs: ' . $e->getMessage()];
        }
    }
}

