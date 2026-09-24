<?php
require_once __DIR__ . '/auth_helper.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Metodo no permitido']);
    exit();
}

requireAdminAuthShared(['admin', 'support', 'agent']);

$action = $_GET['action'] ?? '';

if ($action === 'upload_link_image') {
    uploadLinkImage();
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Accion no valida']);
}

function uploadLinkImage() {
    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'No se recibio imagen valida']);
        return;
    }

    $file = $_FILES['image'];
    // MIME real del contenido (no el que declara el navegador) y extensión
    // derivada de él: así nunca se guarda un .php en una carpeta pública.
    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if (!isset($allowed[$mime])) {
        http_response_code(400);
        echo json_encode(['error' => 'Tipo de archivo no permitido. Use JPG, PNG, WEBP o GIF']);
        return;
    }
    if ($file['size'] > 5 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['error' => 'Archivo demasiado grande (max 5MB)']);
        return;
    }

    $uploadDir = __DIR__ . '/link_images/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    if (!file_exists($uploadDir . '.htaccess')) {
        @file_put_contents($uploadDir . '.htaccess', "Options -Indexes\n<IfModule mod_php.c>\nphp_flag engine off\n</IfModule>\nRemoveHandler .php .phtml .php5 .php7 .phar\nRemoveType .php .phtml .php5 .php7 .phar\n");
    }

    $ext = $allowed[$mime];
    $filename = 'link_' . uniqid() . '_' . time() . '.' . $ext;
    $destPath = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al guardar archivo']);
        return;
    }

    $isTest = strpos($_SERVER['REQUEST_URI'] ?? '', '/test/') !== false;
    $baseUrl = $isTest ? '/test/api/link_images/' : '/api/link_images/';
    $url = $baseUrl . $filename;

    echo json_encode(['success' => true, 'url' => $url]);
}
