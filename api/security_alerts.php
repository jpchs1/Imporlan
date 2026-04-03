<?php
/**
 * Security Alerts - Imporlan
 *
 * Sends email notifications for security events:
 * - Failed login attempts
 * - Brute force lockouts
 * - New device logins
 * - 2FA failures
 * - Suspicious file changes detected by security scanner
 */

require_once __DIR__ . '/db_config.php';

class SecurityAlerts {
    private $pdo;
    private $alertEmail;
    private $smtpHost = 'mail.imporlan.cl';
    private $smtpPort = 465;
    private $smtpSecure = 'ssl';
    private $smtpUsername = 'contacto@imporlan.cl';
    private $smtpPassword;
    private $fromEmail = 'contacto@imporlan.cl';
    private $fromName = 'Imporlan Security';

    public function __construct() {
        $this->pdo = getDbConnection();
        $this->alertEmail = getenv('SECURITY_ALERT_EMAIL') ?: 'contacto@imporlan.cl';

        // Load SMTP password from email service config
        $configFile = '/home/wwimpo/email_config.php';
        if (file_exists($configFile)) {
            require_once $configFile;
            $this->smtpPassword = defined('SMTP_PASSWORD') ? SMTP_PASSWORD : '';
        }
        if (!$this->smtpPassword) {
            // Fallback: read from email_service.php class
            $this->smtpPassword = '^IBn?P-Z5@#_';
        }

        if ($this->pdo) {
            $this->ensureTable();
        }
    }

    private function ensureTable() {
        try {
            $this->pdo->exec("
                CREATE TABLE IF NOT EXISTS security_events (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    event_type VARCHAR(50) NOT NULL,
                    severity ENUM('info','warning','critical') DEFAULT 'info',
                    email VARCHAR(255) DEFAULT NULL,
                    ip_address VARCHAR(45) DEFAULT NULL,
                    user_agent VARCHAR(500) DEFAULT NULL,
                    details TEXT DEFAULT NULL,
                    notified TINYINT(1) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_type (event_type),
                    INDEX idx_severity (severity),
                    INDEX idx_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
        } catch (PDOException $e) {
            error_log("Security events table error: " . $e->getMessage());
        }
    }

    /**
     * Log a security event and optionally send alert
     */
    public function log($type, $severity, $email, $details = '') {
        $ip = $this->getClientIp();
        $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500);

        try {
            if ($this->pdo) {
                $stmt = $this->pdo->prepare("
                    INSERT INTO security_events (event_type, severity, email, ip_address, user_agent, details)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([$type, $severity, $email, $ip, $ua, $details]);
            }
        } catch (Exception $e) {
            error_log("Security event logging error: " . $e->getMessage());
        }

        // Send email for warning and critical events
        if ($severity !== 'info') {
            $this->sendAlert($type, $severity, $email, $ip, $ua, $details);
        }
    }

    /**
     * Log failed login attempt
     */
    public function logFailedLogin($email) {
        $this->log('failed_login', 'warning', $email, 'Intento de login fallido');
    }

    /**
     * Log brute force lockout
     */
    public function logBruteForceLockout($email) {
        $this->log('brute_force_lockout', 'critical', $email, 'IP bloqueada por demasiados intentos de login');
    }

    /**
     * Log new device login
     */
    public function logNewDeviceLogin($email) {
        $this->log('new_device_login', 'warning', $email, 'Login desde un nuevo dispositivo');
    }

    /**
     * Log successful login
     */
    public function logSuccessfulLogin($email) {
        $this->log('successful_login', 'info', $email, 'Login exitoso');
    }

    /**
     * Log 2FA verification failure
     */
    public function log2FAFailure($email) {
        $this->log('2fa_failure', 'warning', $email, 'Codigo 2FA incorrecto');
    }

    /**
     * Log malware scan findings
     */
    public function logMalwareFinding($details) {
        $this->log('malware_detected', 'critical', null, $details);
    }

    /**
     * Get recent security events
     */
    public function getRecent($limit = 50, $severity = null) {
        $where = '';
        $params = [];
        if ($severity) {
            $where = 'WHERE severity = ?';
            $params[] = $severity;
        }
        $limit = intval($limit);
        $stmt = $this->pdo->prepare("
            SELECT * FROM security_events $where
            ORDER BY created_at DESC LIMIT ?
        ");
        $params[] = $limit;
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Send email alert
     */
    private function sendAlert($type, $severity, $email, $ip, $ua, $details) {
        $severityLabel = strtoupper($severity);
        $typeLabels = [
            'failed_login' => 'Intento de Login Fallido',
            'brute_force_lockout' => 'IP Bloqueada - Brute Force',
            'new_device_login' => 'Login desde Nuevo Dispositivo',
            '2fa_failure' => 'Codigo 2FA Incorrecto',
            'malware_detected' => 'Archivo Sospechoso Detectado',
            'file_change' => 'Cambio de Archivo Detectado',
        ];

        $subject = "[$severityLabel] " . ($typeLabels[$type] ?? $type) . " - Imporlan Security";

        $body = "
        <html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>
        <div style='background:#0a1628;padding:20px;text-align:center;'>
            <h1 style='color:#fff;margin:0;font-size:20px;'>Imporlan Security Alert</h1>
        </div>
        <div style='padding:20px;background:#f8f9fa;'>
            <div style='background:" . ($severity === 'critical' ? '#dc2626' : '#f59e0b') . ";color:#fff;padding:10px 15px;border-radius:6px;margin-bottom:15px;'>
                <strong>$severityLabel:</strong> " . htmlspecialchars($typeLabels[$type] ?? $type) . "
            </div>
            <table style='width:100%;border-collapse:collapse;'>
                <tr><td style='padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;'>Fecha</td><td style='padding:8px;border-bottom:1px solid #e5e7eb;'>" . date('Y-m-d H:i:s') . "</td></tr>
                <tr><td style='padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;'>Tipo</td><td style='padding:8px;border-bottom:1px solid #e5e7eb;'>" . htmlspecialchars($type) . "</td></tr>
                <tr><td style='padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;'>Email</td><td style='padding:8px;border-bottom:1px solid #e5e7eb;'>" . htmlspecialchars($email ?? 'N/A') . "</td></tr>
                <tr><td style='padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;'>IP</td><td style='padding:8px;border-bottom:1px solid #e5e7eb;'>" . htmlspecialchars($ip) . "</td></tr>
                <tr><td style='padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;'>User Agent</td><td style='padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;'>" . htmlspecialchars(substr($ua, 0, 200)) . "</td></tr>
                <tr><td style='padding:8px;font-weight:bold;'>Detalle</td><td style='padding:8px;'>" . htmlspecialchars($details) . "</td></tr>
            </table>
        </div>
        <div style='padding:15px;text-align:center;color:#6b7280;font-size:12px;'>
            Este es un mensaje automatico del sistema de seguridad de Imporlan.
        </div>
        </body></html>";

        $this->sendEmail($subject, $body);
    }

    private function sendEmail($subject, $htmlBody) {
        try {
            $boundary = md5(time());
            $headers = "From: {$this->fromName} <{$this->fromEmail}>\r\n";
            $headers .= "Reply-To: {$this->fromEmail}\r\n";
            $headers .= "MIME-Version: 1.0\r\n";
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";

            // Try SMTP first
            $errno = 0;
            $errstr = '';
            $smtp = @fsockopen('ssl://' . $this->smtpHost, $this->smtpPort, $errno, $errstr, 10);
            if ($smtp) {
                $this->smtpCommand($smtp);
                $this->smtpCommand($smtp, "EHLO imporlan.cl");
                $this->smtpCommand($smtp, "AUTH LOGIN");
                $this->smtpCommand($smtp, base64_encode($this->smtpUsername));
                $this->smtpCommand($smtp, base64_encode($this->smtpPassword));
                $this->smtpCommand($smtp, "MAIL FROM:<{$this->fromEmail}>");
                $this->smtpCommand($smtp, "RCPT TO:<{$this->alertEmail}>");
                $this->smtpCommand($smtp, "DATA");

                $message = "Subject: $subject\r\n";
                $message .= $headers;
                $message .= "To: {$this->alertEmail}\r\n";
                $message .= "\r\n";
                $message .= $htmlBody;
                $message .= "\r\n.";

                $this->smtpCommand($smtp, $message);
                $this->smtpCommand($smtp, "QUIT");
                fclose($smtp);
            } else {
                // Fallback to PHP mail()
                @mail($this->alertEmail, $subject, $htmlBody, $headers);
            }
        } catch (Exception $e) {
            error_log("Security alert email error: " . $e->getMessage());
        }
    }

    private function smtpCommand($smtp, $command = null) {
        if ($command !== null) {
            fputs($smtp, $command . "\r\n");
        }
        $response = '';
        while ($line = fgets($smtp, 515)) {
            $response .= $line;
            if (substr($line, 3, 1) === ' ') break;
        }
        return $response;
    }

    private function getClientIp() {
        $headers = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];
        foreach ($headers as $h) {
            if (!empty($_SERVER[$h])) {
                $ip = explode(',', $_SERVER[$h])[0];
                return trim($ip);
            }
        }
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }
}

// API endpoint when called directly
if (basename($_SERVER['SCRIPT_FILENAME']) === 'security_alerts.php') {
    require_once __DIR__ . '/cors_helper.php';
    require_once __DIR__ . '/auth_helper.php';
    setCorsHeadersSecure();
    header('Content-Type: application/json');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }

    $payload = requireAdminAuthShared(['admin']);
    $action = $_GET['action'] ?? 'recent';
    $alerts = new SecurityAlerts();

    switch ($action) {
        case 'recent':
            $limit = min(100, intval($_GET['limit'] ?? 50));
            $severity = $_GET['severity'] ?? null;
            echo json_encode(['success' => true, 'events' => $alerts->getRecent($limit, $severity)]);
            break;
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint no encontrado']);
    }
}
