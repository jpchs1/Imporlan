<?php
/**
 * Temporary deploy helper - fetches latest files from GitHub main branch
 * and copies them to production directories.
 * Self-deletes after execution.
 */

// Simple token auth
$token = isset($_GET['token']) ? $_GET['token'] : '';
if ($token !== 'deploy176x') {
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden']));
}

header('Content-Type: application/json');

$ghBase = 'https://raw.githubusercontent.com/jpchs1/Imporlan/main/';

// Files to deploy: source (GitHub path) => destination (server path relative to public_html)
$files = [
    'panel/assets/marketplace-enhancer.js' => '/home/wwimpo/public_html/panel/assets/marketplace-enhancer.js',
    'assets/marketplace-public.js' => '/home/wwimpo/public_html/assets/marketplace-public.js',
];

$results = [];
foreach ($files as $ghPath => $destPath) {
    $url = $ghBase . $ghPath;
    
    $ctx = stream_context_create(['http' => ['timeout' => 30]]);
    $content = @file_get_contents($url, false, $ctx);
    
    if ($content === false) {
        $results[] = ['file' => basename($destPath), 'status' => 'FAILED to download from GitHub'];
        continue;
    }
    
    // Backup existing file
    if (file_exists($destPath)) {
        @copy($destPath, $destPath . '.bak');
    }
    
    $written = @file_put_contents($destPath, $content);
    if ($written === false) {
        $results[] = ['file' => basename($destPath), 'github_path' => $ghPath, 'status' => 'FAILED to write'];
    } else {
        $results[] = ['file' => basename($destPath), 'github_path' => $ghPath, 'status' => 'OK', 'bytes' => $written];
    }
}

// Also deploy to test environment
$testFiles = [
    'panel/assets/marketplace-enhancer.js' => '/home/wwimpo/public_html/panel-test/assets/marketplace-enhancer.js',
    'assets/marketplace-public.js' => '/home/wwimpo/public_html/test/assets/marketplace-public.js',
];

foreach ($testFiles as $ghPath => $destPath) {
    if (!file_exists(dirname($destPath))) continue;
    $url = $ghBase . $ghPath;
    $ctx = stream_context_create(['http' => ['timeout' => 30]]);
    $content = @file_get_contents($url, false, $ctx);
    if ($content !== false) {
        @file_put_contents($destPath, $content);
    }
}

// Self-delete
$selfPath = __FILE__;
$selfDeleted = @unlink($selfPath);

// Also delete from test location
$testSelf = str_replace('/public_html/api/', '/public_html/test/api/', $selfPath);
@unlink($testSelf);

echo json_encode([
    'results' => $results,
    'self_deleted' => $selfDeleted,
    'timestamp' => date('Y-m-d H:i:s')
], JSON_PRETTY_PRINT);
