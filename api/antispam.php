<?php
/**
 * Anti-Spam & Security Middleware - Imporlan.cl
 *
 * Provides rate limiting, input sanitization, bot detection,
 * honeypot validation, and spam logging for the Imporlan API.
 *
 * Include this file at the top of api/index.php to activate protection.
 */

if (!defined('ANTISPAM_LOADED')) {
    define('ANTISPAM_LOADED', true);
}

// =========================================================================
// 1. Rate Limiting by IP (file-based)
// =========================================================================

function imporlan_get_client_ip() {
    $headers = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];
    foreach ($headers as $header) {
        if (!empty($_SERVER[$header])) {
            $ip = explode(',', $_SERVER[$header]);
            return trim($ip[0]);
        }
    }
    return '0.0.0.0';
}

function imporlan_rate_limit($endpoint = 'general', $max_requests = 30, $window_seconds = 60) {
    $ip = imporlan_get_client_ip();
    $rate_dir = sys_get_temp_dir() . '/imporlan_rate_limit';

    if (!is_dir($rate_dir)) {
        @mkdir($rate_dir, 0755, true);
    }

    $key = md5($ip . '_' . $endpoint);
    $file = $rate_dir . '/' . $key . '.json';
    $now = time();
    $requests = [];

    if (file_exists($file)) {
        $data = @json_decode(file_get_contents($file), true);
        if (is_array($data)) {
            $requests = array_filter($data, function($ts) use ($now, $window_seconds) {
                return ($now - $ts) < $window_seconds;
            });
        }
    }

    if (count($requests) >= $max_requests) {
        imporlan_log_spam('rate_limit', "IP: $ip, endpoint: $endpoint, requests: " . count($requests));
        http_response_code(429);
        header('Retry-After: ' . $window_seconds);
        echo json_encode(['error' => 'Demasiadas solicitudes. Intenta de nuevo mas tarde.']);
        exit;
    }

    $requests[] = $now;
    @file_put_contents($file, json_encode(array_values($requests)));
}

// =========================================================================
// 2. Stricter rate limit for sensitive endpoints (login, register, payments)
// =========================================================================

function imporlan_rate_limit_strict($endpoint) {
    imporlan_rate_limit($endpoint, 5, 300); // 5 requests per 5 minutes
}

// =========================================================================
// 3. Honeypot field validation
// =========================================================================

function imporlan_check_honeypot($input) {
    $honeypot_fields = ['imporlan_website_url', 'imporlan_phone_confirm', 'website_url', 'fax_number'];
    foreach ($honeypot_fields as $field) {
        if (isset($input[$field]) && !empty($input[$field])) {
            imporlan_log_spam('honeypot', "Field: $field, Value: " . substr($input[$field], 0, 100));
            http_response_code(403);
            echo json_encode(['error' => 'Solicitud no valida.']);
            exit;
        }
    }
}

// =========================================================================
// 4. Suspicious content detection
// =========================================================================

function imporlan_check_content($input) {
    if (!is_array($input)) {
        return;
    }

    $text_fields = ['message', 'description', 'comment', 'body', 'name', 'subject', 'nota'];
    $combined_text = '';

    foreach ($text_fields as $field) {
        if (isset($input[$field]) && is_string($input[$field])) {
            $combined_text .= ' ' . $input[$field];
        }
    }

    if (empty(trim($combined_text))) {
        return;
    }

    // Check for email header injection
    if (preg_match('/(\r|\n)(to|cc|bcc|content-type|mime-version):/i', $combined_text)) {
        imporlan_log_spam('header_injection', "Text: " . substr($combined_text, 0, 200));
        http_response_code(403);
        echo json_encode(['error' => 'Contenido no permitido.']);
        exit;
    }

    // Check for excessive URLs (spam indicator)
    $url_count = preg_match_all('/https?:\/\//i', $combined_text);
    if ($url_count > 5) {
        imporlan_log_spam('url_spam', "URL count: $url_count, Text: " . substr($combined_text, 0, 200));
        http_response_code(403);
        echo json_encode(['error' => 'Contenido no permitido.']);
        exit;
    }

    // Check for common spam keywords
    $spam_patterns = [
        '/\b(viagra|cialis|casino|poker|lottery|prize\s*winner|free\s*money)\b/i',
        '/\b(buy\s*now|act\s*now|click\s*here|limited\s*offer|congratulations)\b/i',
        '/\b(crypto\s*invest|bitcoin\s*trading|forex\s*signal)\b/i',
    ];

    foreach ($spam_patterns as $pattern) {
        if (preg_match($pattern, $combined_text)) {
            imporlan_log_spam('spam_keywords', "Pattern matched, Text: " . substr($combined_text, 0, 200));
            http_response_code(403);
            echo json_encode(['error' => 'Contenido no permitido.']);
            exit;
        }
    }

    // Check for Cyrillic/suspicious character blocks (common in spam)
    if (preg_match('/[\x{0400}-\x{04FF}]{5,}/u', $combined_text)) {
        imporlan_log_spam('cyrillic_spam', "Text: " . substr($combined_text, 0, 200));
        http_response_code(403);
        echo json_encode(['error' => 'Contenido no permitido.']);
        exit;
    }
}

// =========================================================================
// 5. Input sanitization helper
// =========================================================================

function imporlan_sanitize_input($input) {
    if (is_string($input)) {
        $input = strip_tags($input);
        $input = htmlspecialchars($input, ENT_QUOTES, 'UTF-8');
        return trim($input);
    }
    if (is_array($input)) {
        return array_map('imporlan_sanitize_input', $input);
    }
    return $input;
}

// =========================================================================
// 6. Dangerous file upload blocking
// =========================================================================

function imporlan_check_upload($files) {
    $dangerous_extensions = [
        'php', 'php3', 'php4', 'php5', 'php7', 'phtml', 'pht', 'phps',
        'cgi', 'pl', 'py', 'jsp', 'asp', 'aspx',
        'exe', 'bat', 'cmd', 'sh', 'bash',
        'htaccess', 'htpasswd',
        'svg', 'swf',
    ];

    foreach ($files as $file_key => $file_data) {
        $filename = is_array($file_data) && isset($file_data['name']) ? $file_data['name'] : '';
        if (empty($filename)) continue;

        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (in_array($ext, $dangerous_extensions)) {
            imporlan_log_spam('dangerous_upload', "File: $filename, Extension: $ext");
            http_response_code(403);
            echo json_encode(['error' => 'Tipo de archivo no permitido.']);
            exit;
        }

        // Double extension check
        if (preg_match('/\.php\./i', $filename) || preg_match('/\.phtml\./i', $filename)) {
            imporlan_log_spam('double_extension', "File: $filename");
            http_response_code(403);
            echo json_encode(['error' => 'Tipo de archivo no permitido.']);
            exit;
        }
    }
}

// =========================================================================
// 7. Bot detection via User-Agent
// =========================================================================

function imporlan_check_bot() {
    $ua = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';

    // Block empty user agents on POST requests
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($ua)) {
        imporlan_log_spam('empty_ua', "IP: " . imporlan_get_client_ip());
        http_response_code(403);
        echo json_encode(['error' => 'Solicitud no valida.']);
        exit;
    }

    // Block known malicious bots
    $bad_bots = [
        'ahrefs', 'semrush', 'mj12bot', 'dotbot', 'blexbot',
        'rogerbot', 'megaindex', 'seopowersuite',
        'python-requests', 'python-urllib', 'curl/',
        'wget/', 'scrapy', 'nikto', 'sqlmap', 'nmap',
    ];

    $ua_lower = strtolower($ua);
    foreach ($bad_bots as $bot) {
        if (strpos($ua_lower, $bot) !== false) {
            imporlan_log_spam('bad_bot', "UA: $ua, IP: " . imporlan_get_client_ip());
            http_response_code(403);
            echo json_encode(['error' => 'Acceso denegado.']);
            exit;
        }
    }
}

// =========================================================================
// 8. Login brute-force protection
// =========================================================================

function imporlan_login_protection() {
    $ip = imporlan_get_client_ip();
    $lockout_dir = sys_get_temp_dir() . '/imporlan_lockout';

    if (!is_dir($lockout_dir)) {
        @mkdir($lockout_dir, 0755, true);
    }

    $key = md5($ip . '_login');
    $file = $lockout_dir . '/' . $key . '.json';
    $now = time();
    $lockout_window = 1800; // 30 minutes
    $max_attempts = 5;

    $data = ['attempts' => [], 'locked_until' => 0];

    if (file_exists($file)) {
        $stored = @json_decode(file_get_contents($file), true);
        if (is_array($stored)) {
            $data = $stored;
        }
    }

    // Check if currently locked out
    if ($data['locked_until'] > $now) {
        $remaining = $data['locked_until'] - $now;
        imporlan_log_spam('login_lockout', "IP: $ip, locked for $remaining more seconds");
        http_response_code(429);
        header('Retry-After: ' . $remaining);
        echo json_encode(['error' => 'Demasiados intentos de login. Intenta en ' . ceil($remaining / 60) . ' minutos.']);
        exit;
    }

    // Clean old attempts
    $data['attempts'] = array_filter($data['attempts'], function($ts) use ($now, $lockout_window) {
        return ($now - $ts) < $lockout_window;
    });

    // Record this attempt
    $data['attempts'][] = $now;

    // Lock if exceeded
    if (count($data['attempts']) >= $max_attempts) {
        $data['locked_until'] = $now + $lockout_window;
        imporlan_log_spam('login_locked', "IP: $ip, attempts: " . count($data['attempts']));
    }

    @file_put_contents($file, json_encode($data));
}

// =========================================================================
// 9. Spam logging
// =========================================================================

function imporlan_log_spam($type, $details) {
    $log_dir = __DIR__ . '/logs';
    if (!is_dir($log_dir)) {
        @mkdir($log_dir, 0755, true);
        // Protect logs directory
        @file_put_contents($log_dir . '/.htaccess', "Require all denied\n");
    }

    $log_file = $log_dir . '/antispam_' . date('Y-m') . '.log';
    $timestamp = date('Y-m-d H:i:s');
    $ip = imporlan_get_client_ip();
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $method = $_SERVER['REQUEST_METHOD'] ?? '';

    $entry = "[$timestamp] [$type] IP=$ip METHOD=$method URI=$uri $details\n";
    @file_put_contents($log_file, $entry, FILE_APPEND | LOCK_EX);
}

// =========================================================================
// 10. Main middleware function - call this from api/index.php
// =========================================================================

function imporlan_antispam_protect($endpoint = 'general') {
    // Always check for bots
    imporlan_check_bot();

    // Rate limit all requests
    imporlan_rate_limit($endpoint);

    // For POST requests, apply additional checks
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (is_array($input)) {
            // Check honeypot
            imporlan_check_honeypot($input);

            // Check for spam content
            imporlan_check_content($input);
        }

        // Check file uploads
        if (!empty($_FILES)) {
            imporlan_check_upload($_FILES);
        }
    }
}

/**
 * Apply strict protection for auth endpoints (login, register)
 */
function imporlan_antispam_protect_auth($endpoint = 'auth') {
    imporlan_check_bot();
    imporlan_login_protection();
    imporlan_rate_limit_strict($endpoint);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (is_array($input)) {
            imporlan_check_honeypot($input);
            imporlan_check_content($input);
        }
    }
}

// =========================================================================
// 11. Cleanup old rate limit / lockout files (call periodically via cron)
// =========================================================================

function imporlan_antispam_cleanup() {
    $dirs = [
        sys_get_temp_dir() . '/imporlan_rate_limit',
        sys_get_temp_dir() . '/imporlan_lockout',
    ];

    $max_age = 3600; // 1 hour
    $now = time();

    foreach ($dirs as $dir) {
        if (!is_dir($dir)) continue;
        $files = glob($dir . '/*.json');
        foreach ($files as $file) {
            if (($now - filemtime($file)) > $max_age) {
                @unlink($file);
            }
        }
    }
}
