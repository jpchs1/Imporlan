<?php
/**
 * LiteSpeed Cache Purge Endpoint
 * 
 * Sends X-LiteSpeed-Purge header to clear all cached content.
 * Protected by deploy token.
 * 
 * Usage: /api/lscache-purge.php?token=TOKEN
 */

// Load token
$configFile = '/home/wwimpo/deploy_config.php';
if (file_exists($configFile)) {
    require_once $configFile;
}

if (!defined('DEPLOY_TOKEN')) {
    http_response_code(500);
    die(json_encode(['success' => false, 'error' => 'Token not configured']));
}

header('Content-Type: application/json; charset=utf-8');

// Verify token
$token = $_GET['token'] ?? '';
if ($token !== DEPLOY_TOKEN) {
    http_response_code(403);
    die(json_encode(['success' => false, 'error' => 'Invalid token']));
}

// Send LiteSpeed Cache purge header - this clears ALL cached content
header('X-LiteSpeed-Purge: *');

// Also try to clear LiteSpeed cache directory if it exists
$results = [];
$publicPath = '/home/wwimpo/public_html';

// Clear lscache directory
$lscachePath = $publicPath . '/lscache';
if (is_dir($lscachePath)) {
    shell_exec("rm -rf " . escapeshellarg($lscachePath) . "/*");
    $results[] = 'LiteSpeed cache directory purged';
} else {
    $results[] = 'No lscache directory found';
}

// Touch .htaccess to force config reload
$htaccessPath = $publicPath . '/.htaccess';
if (file_exists($htaccessPath)) {
    touch($htaccessPath);
    $results[] = '.htaccess touched';
}

// Touch key files to update mtime/ETag
$touchCmd = "find " . escapeshellarg($publicPath) . " -maxdepth 2 \\( -name '*.js' -o -name '*.css' -o -name '*.html' \\) -exec touch {} + 2>&1";
$touchOutput = shell_exec($touchCmd);
$results[] = 'All JS/CSS/HTML files touched';

// Clear PHP OPcache if available
if (function_exists('opcache_reset')) {
    opcache_reset();
    $results[] = 'PHP OPcache cleared';
} else {
    $results[] = 'OPcache not available';
}

// Verify current files on disk
$indexContent = @file_get_contents($publicPath . '/index.html');
$hasArriendo = $indexContent ? (strpos($indexContent, 'Arriendo') !== false) : false;
$marketplaceJs = $publicPath . '/assets/marketplace-section.js';
$jsSize = file_exists($marketplaceJs) ? filesize($marketplaceJs) : 0;
$jsHasArriendo = false;
if (file_exists($marketplaceJs)) {
    $jsContent = file_get_contents($marketplaceJs);
    $jsHasArriendo = strpos($jsContent, 'Arriendo') !== false;
}

echo json_encode([
    'success' => true,
    'action' => 'lscache_purge',
    'results' => $results,
    'file_check' => [
        'index_html_has_arriendo' => $hasArriendo,
        'marketplace_js_size' => $jsSize,
        'marketplace_js_has_arriendo' => $jsHasArriendo,
        'index_html_size' => $indexContent ? strlen($indexContent) : 0
    ],
    'timestamp' => date('Y-m-d H:i:s'),
    'server' => php_uname('n')
], JSON_PRETTY_PRINT);
