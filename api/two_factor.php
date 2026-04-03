<?php
/**
 * Two-Factor Authentication (TOTP) - Imporlan
 *
 * Implements Google Authenticator compatible 2FA with trusted device support.
 *
 * Features:
 * - TOTP (Time-based One-Time Password) RFC 6238
 * - Trusted device cookie (skip 2FA for known browsers)
 * - QR code generation for setup
 * - Backup codes for recovery
 */

require_once __DIR__ . '/db_config.php';

class TwoFactorAuth {
    private $pdo;
    private $issuer = 'Imporlan';
    private $codeLength = 6;
    private $period = 30; // seconds
    private $trustedDeviceDays = 30;

    public function __construct() {
        $this->pdo = getDbConnection();
        if ($this->pdo) {
            $this->ensureTables();
        }
    }

    private function ensureTables() {
        try {
            $this->pdo->exec("
                CREATE TABLE IF NOT EXISTS two_factor_auth (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_email VARCHAR(255) NOT NULL UNIQUE,
                    secret VARCHAR(64) NOT NULL,
                    enabled TINYINT(1) DEFAULT 0,
                    backup_codes TEXT DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
            $this->pdo->exec("
                CREATE TABLE IF NOT EXISTS trusted_devices (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_email VARCHAR(255) NOT NULL,
                    device_token VARCHAR(128) NOT NULL UNIQUE,
                    device_info VARCHAR(500) DEFAULT NULL,
                    ip_address VARCHAR(45) DEFAULT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_email (user_email),
                    INDEX idx_token (device_token),
                    INDEX idx_expires (expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
        } catch (PDOException $e) {
            error_log("2FA table creation error: " . $e->getMessage());
        }
    }

    /**
     * Generate a random base32 secret for TOTP
     */
    public function generateSecret($length = 32) {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = '';
        $bytes = random_bytes($length);
        for ($i = 0; $i < $length; $i++) {
            $secret .= $chars[ord($bytes[$i]) % 32];
        }
        return $secret;
    }

    /**
     * Generate TOTP code for a given secret and time
     */
    public function generateCode($secret, $time = null) {
        if ($time === null) $time = time();
        $timeSlice = floor($time / $this->period);

        $secretKey = $this->base32Decode($secret);
        $time = pack('N*', 0, $timeSlice);

        $hash = hash_hmac('sha1', $time, $secretKey, true);
        $offset = ord($hash[strlen($hash) - 1]) & 0x0F;

        $code = (
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF)
        ) % pow(10, $this->codeLength);

        return str_pad($code, $this->codeLength, '0', STR_PAD_LEFT);
    }

    /**
     * Verify a TOTP code (allows 1 period drift)
     */
    public function verifyCode($secret, $code) {
        $code = str_pad(trim($code), $this->codeLength, '0', STR_PAD_LEFT);
        $time = time();

        // Check current period and adjacent periods (±30 seconds)
        for ($i = -1; $i <= 1; $i++) {
            $checkTime = $time + ($i * $this->period);
            if (hash_equals($this->generateCode($secret, $checkTime), $code)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Setup 2FA for a user - returns secret and QR URL
     */
    public function setup($email) {
        $secret = $this->generateSecret(16);
        $backupCodes = $this->generateBackupCodes();

        $stmt = $this->pdo->prepare("
            INSERT INTO two_factor_auth (user_email, secret, enabled, backup_codes)
            VALUES (?, ?, 0, ?)
            ON DUPLICATE KEY UPDATE secret = VALUES(secret), enabled = 0, backup_codes = VALUES(backup_codes)
        ");
        $stmt->execute([$email, $secret, json_encode($backupCodes)]);

        $otpauthUrl = 'otpauth://totp/' . urlencode($this->issuer . ':' . $email)
            . '?secret=' . $secret
            . '&issuer=' . urlencode($this->issuer)
            . '&digits=' . $this->codeLength
            . '&period=' . $this->period;

        return [
            'secret' => $secret,
            'qr_url' => 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' . urlencode($otpauthUrl),
            'otpauth_url' => $otpauthUrl,
            'backup_codes' => $backupCodes
        ];
    }

    /**
     * Confirm 2FA setup by verifying the first code
     */
    public function confirmSetup($email, $code) {
        $stmt = $this->pdo->prepare("SELECT secret FROM two_factor_auth WHERE user_email = ? AND enabled = 0");
        $stmt->execute([$email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) return false;

        if ($this->verifyCode($row['secret'], $code)) {
            $this->pdo->prepare("UPDATE two_factor_auth SET enabled = 1 WHERE user_email = ?")->execute([$email]);
            return true;
        }
        return false;
    }

    /**
     * Check if user has 2FA enabled
     */
    public function isEnabled($email) {
        if (!$this->pdo) return false;
        try {
            $stmt = $this->pdo->prepare("SELECT enabled FROM two_factor_auth WHERE user_email = ? AND enabled = 1");
            $stmt->execute([$email]);
            return (bool)$stmt->fetchColumn();
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Verify 2FA code or backup code for login
     */
    public function verifyLogin($email, $code) {
        $stmt = $this->pdo->prepare("SELECT secret, backup_codes FROM two_factor_auth WHERE user_email = ? AND enabled = 1");
        $stmt->execute([$email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) return false;

        // Try TOTP code first
        if ($this->verifyCode($row['secret'], $code)) {
            return true;
        }

        // Try backup code
        $backupCodes = json_decode($row['backup_codes'] ?? '[]', true);
        $code = trim($code);
        $index = array_search($code, $backupCodes);
        if ($index !== false) {
            // Remove used backup code
            unset($backupCodes[$index]);
            $this->pdo->prepare("UPDATE two_factor_auth SET backup_codes = ? WHERE user_email = ?")
                ->execute([json_encode(array_values($backupCodes)), $email]);
            return true;
        }

        return false;
    }

    /**
     * Disable 2FA for a user
     */
    public function disable($email) {
        $this->pdo->prepare("DELETE FROM two_factor_auth WHERE user_email = ?")->execute([$email]);
        $this->pdo->prepare("DELETE FROM trusted_devices WHERE user_email = ?")->execute([$email]);
        return true;
    }

    /**
     * Get 2FA status for a user
     */
    public function getStatus($email) {
        $stmt = $this->pdo->prepare("SELECT enabled, created_at FROM two_factor_auth WHERE user_email = ?");
        $stmt->execute([$email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $deviceCount = 0;
        $stmtDevices = $this->pdo->prepare("SELECT COUNT(*) FROM trusted_devices WHERE user_email = ? AND expires_at > NOW()");
        $stmtDevices->execute([$email]);
        $deviceCount = (int)$stmtDevices->fetchColumn();

        return [
            'enabled' => $row ? (bool)$row['enabled'] : false,
            'configured_at' => $row['created_at'] ?? null,
            'trusted_devices' => $deviceCount
        ];
    }

    // ==========================================
    // Trusted Device Management
    // ==========================================

    /**
     * Check if current device is trusted for this user
     */
    public function isTrustedDevice($email) {
        if (!$this->pdo) return false;
        $token = $_COOKIE['imporlan_trusted_device'] ?? '';
        if (!$token || strlen($token) < 64) return false;

        try {
            // Clean expired devices
            $this->pdo->exec("DELETE FROM trusted_devices WHERE expires_at < NOW()");

            $stmt = $this->pdo->prepare("
                SELECT id FROM trusted_devices
                WHERE user_email = ? AND device_token = ? AND expires_at > NOW()
            ");
            $stmt->execute([$email, hash('sha256', $token)]);
            return (bool)$stmt->fetchColumn();
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Register current device as trusted
     */
    public function trustDevice($email) {
        $rawToken = bin2hex(random_bytes(32));
        $hashedToken = hash('sha256', $rawToken);
        $expiresAt = date('Y-m-d H:i:s', time() + ($this->trustedDeviceDays * 86400));

        $deviceInfo = substr(($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'), 0, 500);
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

        $stmt = $this->pdo->prepare("
            INSERT INTO trusted_devices (user_email, device_token, device_info, ip_address, expires_at)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$email, $hashedToken, $deviceInfo, $ip, $expiresAt]);

        // Return the raw token - caller should set it as cookie
        return [
            'token' => $rawToken,
            'expires' => $this->trustedDeviceDays * 86400
        ];
    }

    /**
     * Revoke all trusted devices for a user
     */
    public function revokeAllDevices($email) {
        $this->pdo->prepare("DELETE FROM trusted_devices WHERE user_email = ?")->execute([$email]);
        return true;
    }

    /**
     * List trusted devices for a user
     */
    public function listDevices($email) {
        $stmt = $this->pdo->prepare("
            SELECT id, device_info, ip_address, created_at, expires_at
            FROM trusted_devices WHERE user_email = ? AND expires_at > NOW()
            ORDER BY created_at DESC
        ");
        $stmt->execute([$email]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Revoke a specific trusted device
     */
    public function revokeDevice($email, $deviceId) {
        $this->pdo->prepare("DELETE FROM trusted_devices WHERE id = ? AND user_email = ?")->execute([$deviceId, $email]);
        return true;
    }

    // ==========================================
    // Helper Methods
    // ==========================================

    private function generateBackupCodes($count = 8) {
        $codes = [];
        for ($i = 0; $i < $count; $i++) {
            $codes[] = strtoupper(bin2hex(random_bytes(4))); // 8-char hex codes
        }
        return $codes;
    }

    private function base32Decode($input) {
        $map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $input = strtoupper(rtrim($input, '='));
        $buffer = 0;
        $bitsLeft = 0;
        $output = '';

        for ($i = 0; $i < strlen($input); $i++) {
            $val = strpos($map, $input[$i]);
            if ($val === false) continue;
            $buffer = ($buffer << 5) | $val;
            $bitsLeft += 5;
            if ($bitsLeft >= 8) {
                $bitsLeft -= 8;
                $output .= chr(($buffer >> $bitsLeft) & 0xFF);
            }
        }
        return $output;
    }
}

// ==========================================
// API Endpoint Handler
// ==========================================

function handle2FAEndpoint() {
    require_once __DIR__ . '/auth_helper.php';

    $action = $_GET['action'] ?? '';

    switch ($action) {
        case 'status':
            $payload = requireAdminAuthShared(['admin', 'support', 'agent', 'user']);
            $tfa = new TwoFactorAuth();
            echo json_encode(['success' => true, '2fa' => $tfa->getStatus($payload['email'])]);
            break;

        case 'setup':
            $payload = requireAdminAuthShared(['admin', 'support', 'agent', 'user']);
            $tfa = new TwoFactorAuth();
            $result = $tfa->setup($payload['email']);
            echo json_encode(['success' => true, '2fa' => $result]);
            break;

        case 'confirm':
            $payload = requireAdminAuthShared(['admin', 'support', 'agent', 'user']);
            $input = json_decode(file_get_contents('php://input'), true);
            $code = $input['code'] ?? '';
            $tfa = new TwoFactorAuth();
            if ($tfa->confirmSetup($payload['email'], $code)) {
                echo json_encode(['success' => true, 'message' => '2FA activado correctamente']);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Codigo invalido']);
            }
            break;

        case 'disable':
            $payload = requireAdminAuthShared(['admin', 'support', 'agent', 'user']);
            $input = json_decode(file_get_contents('php://input'), true);
            $code = $input['code'] ?? '';
            $tfa = new TwoFactorAuth();
            if ($tfa->verifyLogin($payload['email'], $code)) {
                $tfa->disable($payload['email']);
                echo json_encode(['success' => true, 'message' => '2FA desactivado']);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Codigo invalido']);
            }
            break;

        case 'devices':
            $payload = requireAdminAuthShared(['admin', 'support', 'agent', 'user']);
            $tfa = new TwoFactorAuth();
            echo json_encode(['success' => true, 'devices' => $tfa->listDevices($payload['email'])]);
            break;

        case 'revoke_device':
            $payload = requireAdminAuthShared(['admin', 'support', 'agent', 'user']);
            $input = json_decode(file_get_contents('php://input'), true);
            $deviceId = intval($input['device_id'] ?? 0);
            $tfa = new TwoFactorAuth();
            $tfa->revokeDevice($payload['email'], $deviceId);
            echo json_encode(['success' => true]);
            break;

        case 'revoke_all':
            $payload = requireAdminAuthShared(['admin', 'support', 'agent', 'user']);
            $tfa = new TwoFactorAuth();
            $tfa->revokeAllDevices($payload['email']);
            echo json_encode(['success' => true]);
            break;

        default:
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint no encontrado']);
    }
}

// Run if called directly
if (basename($_SERVER['SCRIPT_FILENAME']) === 'two_factor.php') {
    require_once __DIR__ . '/cors_helper.php';
    setCorsHeadersSecure();
    header('Content-Type: application/json');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }

    handle2FAEndpoint();
}
