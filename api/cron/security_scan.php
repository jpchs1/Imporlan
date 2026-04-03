<?php
/**
 * Security Scanner Cron Job - Imporlan
 *
 * Automated malware detection that runs periodically via cron.
 * Scans for suspicious files, unauthorized changes, and known malware patterns.
 *
 * Usage (cPanel cron, run daily):
 *   php /home/wwimpo/public_html/api/cron/security_scan.php
 *
 * Or via URL with token:
 *   GET /api/cron/security_scan.php?token=YOUR_DEPLOY_TOKEN
 */

// Allow CLI execution
$isCli = (php_sapi_name() === 'cli');

if (!$isCli) {
    header('Content-Type: application/json');

    // Verify token for web access
    $configFile = '/home/wwimpo/deploy_config.php';
    if (file_exists($configFile)) {
        require_once $configFile;
    }
    if (!defined('DEPLOY_TOKEN')) {
        http_response_code(500);
        die(json_encode(['error' => 'Token not configured']));
    }
    $token = $_GET['token'] ?? '';
    if (!$token || !hash_equals(DEPLOY_TOKEN, $token)) {
        http_response_code(403);
        die(json_encode(['error' => 'Invalid token']));
    }
}

require_once dirname(__DIR__) . '/db_config.php';
require_once dirname(__DIR__) . '/security_alerts.php';

$alerts = new SecurityAlerts();
$findings = [];
$basePath = '/home/wwimpo/public_html';

// Adjust base path if not on production server
if (!is_dir($basePath)) {
    $basePath = dirname(dirname(__DIR__));
}

/**
 * 1. Check for PHP files in directories that shouldn't have them
 */
function scanUnauthorizedPhp($basePath) {
    $findings = [];
    $blockedDirs = ['images', 'uploads', 'img', 'fonts', 'css'];

    foreach ($blockedDirs as $dir) {
        $fullPath = $basePath . '/' . $dir;
        if (!is_dir($fullPath)) continue;

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($fullPath, RecursiveDirectoryIterator::SKIP_DOTS)
        );
        foreach ($iterator as $file) {
            if (strtolower($file->getExtension()) === 'php') {
                $findings[] = [
                    'type' => 'unauthorized_php',
                    'severity' => 'critical',
                    'path' => $file->getPathname(),
                    'size' => $file->getSize(),
                    'modified' => date('Y-m-d H:i:s', $file->getMTime())
                ];
            }
        }
    }
    return $findings;
}

/**
 * 2. Check for directories with random names (malware injection pattern)
 */
function scanSuspiciousDirectories($basePath) {
    $findings = [];
    $knownDirs = [
        'api', 'assets', 'admin', 'panel', 'panel-test', 'test', 'marketplace',
        'pago', 'images', 'importaciones', 'embarcaciones', 'embarcaciones-usadas',
        'lanchas', 'lanchas-usadas', 'lanchas-usadas-en-chile-2', 'lanchas-de-pesca-usadas',
        'lanchas-de-ski', 'veleros-usados', 'veleros-usados-a-la-venta-en-chile-o-usa',
        'botes-de-pesca', 'importacion-lanchas-chile', 'importacion-veleros-chile',
        'importacion-embarcaciones-usa-chile', 'importar-embarcaciones-usa',
        'importar-motos-de-agua-desde-usa', 'cotizador-importacion', 'cotizar-importacion',
        'simulacion-cotizacion', 'requisitos-importar-embarcaciones-chile',
        'cuanto-cuesta-importar-una-lancha-a-chile', 'comprar-lanchas-usadas-en-chile-o-en-usa',
        'como-comprar-lancha-usada-chile', 'como-vender-moto-de-agua-chile',
        'costo-mantener-lancha-chile', 'casos-de-importacion', 'servicios',
        'servicios-importacion', 'seguro-embarcaciones-chile',
        'inspeccion-precompra-embarcaciones', 'logistica-maritima-importacion',
        'transporte-logistica-embarcaciones-chile', 'documentos-tramites-vender-embarcacion-chile',
        'preguntas-frecuentes-embarcaciones-usadas', 'tipos-de-lanchas-segun-uso',
        'docs', 't', 'lscache', '.well-known', 'cgi-bin',
    ];

    $dirs = @scandir($basePath);
    if (!$dirs) return $findings;

    foreach ($dirs as $dir) {
        if ($dir === '.' || $dir === '..' || !is_dir($basePath . '/' . $dir)) continue;
        if ($dir[0] === '.') continue; // skip hidden dirs

        if (!in_array($dir, $knownDirs)) {
            // Check if it looks like a random name (6-12 alphanumeric chars)
            if (preg_match('/^[a-z0-9]{6,12}$/', $dir)) {
                $findings[] = [
                    'type' => 'suspicious_directory',
                    'severity' => 'critical',
                    'path' => $basePath . '/' . $dir,
                    'modified' => date('Y-m-d H:i:s', filemtime($basePath . '/' . $dir))
                ];
            }
        }
    }
    return $findings;
}

/**
 * 3. Check for files with obfuscated/malicious PHP patterns
 */
function scanMaliciousPatterns($basePath) {
    $findings = [];
    $patterns = [
        'eval(base64_decode(' => 'Obfuscated eval/base64',
        'eval(gzinflate(' => 'Obfuscated eval/gzinflate',
        'eval(str_rot13(' => 'Obfuscated eval/str_rot13',
        'eval(gzuncompress(' => 'Obfuscated eval/gzuncompress',
        'assert(base64' => 'Assert-based backdoor',
        'create_function(' => 'Dynamic function creation',
        '$_GET[' => null, // only flag if combined with eval/exec
        'preg_replace(\'/.*/' => 'preg_replace /e modifier backdoor',
    ];

    $dangerousCombos = [
        '/eval\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)/i',
        '/assert\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)/i',
        '/\$\w+\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)/i', // variable function calls
    ];

    // Scan PHP files (skip wp-admin, wp-includes, vendor, node_modules)
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($basePath, RecursiveDirectoryIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if (strtolower($file->getExtension()) !== 'php') continue;
        $path = $file->getPathname();

        // Skip known safe directories
        if (preg_match('#/(wp-admin|wp-includes|vendor|node_modules)/#', $path)) continue;

        $content = @file_get_contents($path);
        if (!$content || strlen($content) < 10) continue;

        // Check for dangerous patterns
        foreach ($dangerousCombos as $regex) {
            if (preg_match($regex, $content)) {
                $findings[] = [
                    'type' => 'malicious_pattern',
                    'severity' => 'critical',
                    'path' => $path,
                    'pattern' => $regex,
                    'size' => $file->getSize(),
                    'modified' => date('Y-m-d H:i:s', $file->getMTime())
                ];
                break; // One finding per file is enough
            }
        }

        // Check for very long single lines (common in obfuscated malware)
        $lines = explode("\n", $content);
        foreach ($lines as $lineNum => $line) {
            if (strlen($line) > 5000 && preg_match('/[a-zA-Z0-9+\/=]{1000,}/', $line)) {
                $findings[] = [
                    'type' => 'obfuscated_code',
                    'severity' => 'warning',
                    'path' => $path,
                    'line' => $lineNum + 1,
                    'line_length' => strlen($line),
                    'modified' => date('Y-m-d H:i:s', $file->getMTime())
                ];
                break;
            }
        }
    }
    return $findings;
}

/**
 * 4. Check .htaccess files for suspicious modifications
 */
function scanHtaccess($basePath) {
    $findings = [];
    $suspiciousPatterns = [
        '/RewriteCond.*HTTP_USER_AGENT.*Googlebot.*\[NC\].*\n.*RewriteRule.*http/im', // Cloaking
        '/auto_prepend_file/i',
        '/auto_append_file/i',
        '/php_value.*auto_prepend/i',
    ];

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($basePath, RecursiveDirectoryIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if ($file->getFilename() !== '.htaccess') continue;
        $content = @file_get_contents($file->getPathname());
        if (!$content) continue;

        foreach ($suspiciousPatterns as $pattern) {
            if (preg_match($pattern, $content)) {
                $findings[] = [
                    'type' => 'suspicious_htaccess',
                    'severity' => 'critical',
                    'path' => $file->getPathname(),
                    'pattern' => $pattern,
                    'modified' => date('Y-m-d H:i:s', $file->getMTime())
                ];
            }
        }
    }
    return $findings;
}

// ==========================================
// Run the scan
// ==========================================

$startTime = microtime(true);

$findings = array_merge(
    scanUnauthorizedPhp($basePath),
    scanSuspiciousDirectories($basePath),
    scanMaliciousPatterns($basePath),
    scanHtaccess($basePath)
);

$duration = round(microtime(true) - $startTime, 2);

// Log findings
$criticalCount = 0;
foreach ($findings as $f) {
    if ($f['severity'] === 'critical') {
        $criticalCount++;
        $alerts->logMalwareFinding(
            "Tipo: {$f['type']} | Archivo: {$f['path']} | " .
            (isset($f['pattern']) ? "Patron: {$f['pattern']}" : "Modificado: {$f['modified']}")
        );
    }
}

$result = [
    'success' => true,
    'scan_date' => date('Y-m-d H:i:s'),
    'duration_seconds' => $duration,
    'base_path' => $basePath,
    'total_findings' => count($findings),
    'critical_findings' => $criticalCount,
    'findings' => $findings,
    'status' => count($findings) === 0 ? 'CLEAN' : 'ISSUES_FOUND'
];

if ($isCli) {
    echo "=== Imporlan Security Scan ===\n";
    echo "Date: " . $result['scan_date'] . "\n";
    echo "Duration: {$duration}s\n";
    echo "Status: {$result['status']}\n";
    echo "Findings: " . count($findings) . " (Critical: $criticalCount)\n";
    if (count($findings) > 0) {
        echo "\n--- Findings ---\n";
        foreach ($findings as $f) {
            echo "[{$f['severity']}] {$f['type']}: {$f['path']}\n";
        }
    }
    echo "\n";
} else {
    echo json_encode($result, JSON_PRETTY_PRINT);
}
