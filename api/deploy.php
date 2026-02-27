<?php
/**
 * Deploy Endpoint - Imporlan
 * 
 * Endpoint web para desplegar cambios desde GitHub.
 * PROTEGIDO por token de seguridad.
 * 
 * Configuración:
 * - El token debe estar en /home/wwimpo/deploy_config.php
 * - O como variable de entorno DEPLOY_TOKEN
 * 
 * Uso:
 * - Deploy a TEST: /api/deploy.php?env=test&token=TOKEN
 * - Deploy a PROD: /api/deploy.php?env=prod&token=TOKEN&confirm=yes
 * 
 * @version 1.0
 */

// Cargar token desde archivo de configuración (no versionado)
$configFile = '/home/wwimpo/deploy_config.php';
if (file_exists($configFile)) {
    require_once $configFile;
}

// Token de seguridad (debe estar definido en deploy_config.php)
if (!defined('DEPLOY_TOKEN')) {
    http_response_code(500);
    die(json_encode(['success' => false, 'error' => 'Deploy token not configured']));
}

// Configuración del repositorio
define('REPO_URL', 'https://github.com/jpchs1/Imporlan.git');
define('BRANCH', 'main');

// Rutas
define('PATH_TEST', '/home/wwimpo/public_html/test');
define('PATH_PROD', '/home/wwimpo/public_html');

// Archivos protegidos (no se sobrescriben)
$protectedFiles = [
    'api/config.php',
    'api/db_config.php'
];

header('Content-Type: application/json; charset=utf-8');

// Verificar token
$token = $_GET['token'] ?? '';
if ($token !== DEPLOY_TOKEN) {
    http_response_code(403);
    die(json_encode(['success' => false, 'error' => 'Invalid token']));
}

// Action: sync_files - fetch specific files from GitHub raw content
$action = $_GET['action'] ?? '';
if ($action === 'sync_files') {
    $env = $_GET['env'] ?? 'prod';
    $targetPath = ($env === 'test') ? PATH_TEST : PATH_PROD;
    
    $filesToSync = [
        'assets/marketplace-public.js',
        'panel/assets/marketplace-enhancer.js',
    ];
    
    $ghRawBase = 'https://raw.githubusercontent.com/jpchs1/Imporlan/main/';
    $results = [];
    
    foreach ($filesToSync as $file) {
        $url = $ghRawBase . $file . '?t=' . time();
        $ctx = stream_context_create(['http' => ['timeout' => 30, 'header' => "Cache-Control: no-cache\r\n"]]);
        $content = @file_get_contents($url, false, $ctx);
        
        if ($content === false) {
            $results[] = ['file' => $file, 'status' => 'FAILED to download'];
            continue;
        }
        
        $destPath = $targetPath . '/' . $file;
        $dir = dirname($destPath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        
        if (file_exists($destPath)) {
            @copy($destPath, $destPath . '.bak');
        }
        
        $written = @file_put_contents($destPath, $content);
        $results[] = [
            'file' => $file,
            'status' => ($written !== false) ? 'OK' : 'FAILED to write',
            'bytes' => $written,
            'dest' => $destPath
        ];
    }
    
    echo json_encode([
        'success' => true,
        'action' => 'sync_files',
        'environment' => $env,
        'results' => $results,
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT);
    exit;
}

// Verificar ambiente
$env = $_GET['env'] ?? '';
if (!in_array($env, ['test', 'prod'])) {
    http_response_code(400);
    die(json_encode([
        'success' => false, 
        'error' => 'Invalid environment',
        'usage' => [
            'test' => '?env=test&token=TOKEN',
            'prod' => '?env=prod&token=TOKEN&confirm=yes'
        ]
    ]));
}

// Producción requiere confirmación
if ($env === 'prod' && ($_GET['confirm'] ?? '') !== 'yes') {
    http_response_code(400);
    die(json_encode([
        'success' => false,
        'error' => 'Production requires explicit confirmation',
        'usage' => '?env=prod&token=TOKEN&confirm=yes',
        'warning' => 'This will update the LIVE site'
    ]));
}

$targetPath = ($env === 'test') ? PATH_TEST : PATH_PROD;
$tempPath = '/home/wwimpo/deploy_temp_' . time();
$log = [];

try {
    $log[] = ['step' => 'init', 'message' => 'Starting deploy to ' . strtoupper($env)];
    
    if (!is_dir($tempPath)) {
        mkdir($tempPath, 0755, true);
    }
    
    $log[] = ['step' => 'clone', 'message' => 'Cloning from GitHub...'];
    $cloneCmd = "cd " . escapeshellarg($tempPath) . " && git clone --depth 1 --branch " . BRANCH . " " . REPO_URL . " . 2>&1";
    $cloneOutput = shell_exec($cloneCmd);
    
    if (!file_exists("$tempPath/index.html")) {
        throw new Exception("Clone failed: " . $cloneOutput);
    }
    
    $commitHash = trim(shell_exec("cd " . escapeshellarg($tempPath) . " && git rev-parse --short HEAD 2>&1"));
    $commitMsg = trim(shell_exec("cd " . escapeshellarg($tempPath) . " && git log -1 --format='%s' 2>&1"));
    $log[] = ['step' => 'commit', 'hash' => $commitHash, 'message' => $commitMsg];
    
    $backups = [];
    foreach ($protectedFiles as $file) {
        $fullPath = "$targetPath/$file";
        if (file_exists($fullPath)) {
            $backups[$file] = file_get_contents($fullPath);
        }
    }
    $log[] = ['step' => 'backup', 'files' => array_keys($backups)];
    
    $excludes = "--exclude='.git' --exclude='api/config.php' --exclude='api/db_config.php'";
    if ($env === 'prod') {
        $excludes .= " --exclude='test' --exclude='panel-test'";
    }
    
    $rsyncCmd = "rsync -av --delete $excludes " . escapeshellarg($tempPath) . "/ " . escapeshellarg($targetPath) . "/ 2>&1";
    shell_exec($rsyncCmd);
    $log[] = ['step' => 'sync', 'message' => 'Files synchronized'];
    
    foreach ($backups as $file => $content) {
        $fullPath = "$targetPath/$file";
        $dir = dirname($fullPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents($fullPath, $content);
    }
    $log[] = ['step' => 'restore', 'message' => 'Sensitive files restored'];
    
    shell_exec("rm -rf " . escapeshellarg($tempPath));
    
    $historyFile = '/home/wwimpo/deploy_history.json';
    $history = file_exists($historyFile) ? json_decode(file_get_contents($historyFile), true) : [];
    $history[] = [
        'timestamp' => date('Y-m-d H:i:s'),
        'environment' => $env,
        'commit' => $commitHash,
        'message' => $commitMsg,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'cli'
    ];
    $history = array_slice($history, -100);
    file_put_contents($historyFile, json_encode($history, JSON_PRETTY_PRINT));
    
    echo json_encode([
        'success' => true,
        'environment' => $env,
        'commit' => ['hash' => $commitHash, 'message' => $commitMsg],
        'timestamp' => date('Y-m-d H:i:s'),
        'log' => $log
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    if (is_dir($tempPath)) {
        shell_exec("rm -rf " . escapeshellarg($tempPath));
    }
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'log' => $log
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
