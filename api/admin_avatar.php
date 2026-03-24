<?php
/**
 * Admin Avatar Server - Imporlan Admin Panel
 * Serves avatar images from the protected .admin_profiles/avatars directory.
 */

$email = $_GET['u'] ?? '';
if (empty($email)) {
    http_response_code(404);
    exit();
}

$avatarDir = __DIR__ . '/../.admin_profiles/avatars';
$profileFile = __DIR__ . '/../.admin_profiles/profiles.json';

if (!file_exists($profileFile)) {
    http_response_code(404);
    exit();
}

$profiles = json_decode(file_get_contents($profileFile), true);
if (!is_array($profiles) || !isset($profiles[$email]['avatar_file'])) {
    http_response_code(404);
    exit();
}

$filename = $profiles[$email]['avatar_file'];
$filePath = $avatarDir . '/' . $filename;

if (!$filename || !file_exists($filePath)) {
    http_response_code(404);
    exit();
}

// Determine content type
$ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
$mimeTypes = [
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'webp' => 'image/webp'
];

$contentType = $mimeTypes[$ext] ?? 'image/jpeg';

header('Content-Type: ' . $contentType);
header('Cache-Control: public, max-age=3600');
header('Content-Length: ' . filesize($filePath));
readfile($filePath);
