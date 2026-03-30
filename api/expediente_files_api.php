<?php
/**
 * Expediente Files API - Imporlan
 *
 * File upload/management system for expedientes (orders).
 * Supports documents, images, videos, and other file types.
 *
 * Endpoints:
 * - POST ?action=upload          - Upload file(s) to an expediente (admin)
 * - GET  ?action=list&order_id=X - List files for an expediente
 * - GET  ?action=download&id=X   - Download/view a file
 * - POST ?action=delete&id=X     - Delete a file (admin)
 * - GET  ?action=migrate         - Create/update database table
 */

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/auth_helper.php';
require_once __DIR__ . '/email_service.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Email');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'upload':
        requireAdminAuth();
        uploadFiles();
        break;
    case 'list':
        listFiles();
        break;
    case 'download':
        downloadFile();
        break;
    case 'delete':
        requireAdminAuth();
        deleteFile();
        break;
    case 'migrate':
        requireAdminAuth();
        runFilesMigration();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida']);
}

function requireAdminAuth() {
    return requireAdminAuthShared(['admin', 'support', 'agent']);
}

function getUploadDir() {
    $dir = __DIR__ . '/expediente_files/';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    return $dir;
}

function getFileCategory($mimeType, $extension) {
    $imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
    $videoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
    $docTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                 'text/plain', 'text/csv', 'application/rtf'];

    if (in_array($mimeType, $imageTypes)) return 'image';
    if (in_array($mimeType, $videoTypes)) return 'video';
    if (in_array($mimeType, $docTypes)) return 'document';
    return 'other';
}

function getAllowedMimeTypes() {
    return [
        // Images
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
        // Videos
        'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska',
        // Documents
        'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv', 'application/rtf',
        // Archives
        'application/zip', 'application/x-rar-compressed', 'application/gzip',
    ];
}

function uploadFiles() {
    $orderId = intval($_POST['order_id'] ?? 0);
    if (!$orderId) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere order_id']);
        return;
    }

    $description = trim($_POST['description'] ?? '');
    $notifyClient = ($_POST['notify_client'] ?? '1') === '1';

    if (!isset($_FILES['files']) || empty($_FILES['files']['name'][0])) {
        http_response_code(400);
        echo json_encode(['error' => 'No se recibieron archivos']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    // Verify order exists and get customer info
    $orderStmt = $pdo->prepare("SELECT id, order_number, customer_email, customer_name FROM orders WHERE id = ?");
    $orderStmt->execute([$orderId]);
    $order = $orderStmt->fetch(PDO::FETCH_ASSOC);
    if (!$order) {
        http_response_code(404);
        echo json_encode(['error' => 'Expediente no encontrado']);
        return;
    }

    $uploadDir = getUploadDir();
    $allowedMimes = getAllowedMimeTypes();
    $maxFileSize = 100 * 1024 * 1024; // 100MB max per file
    $uploadedFiles = [];
    $errors = [];

    $fileCount = count($_FILES['files']['name']);
    for ($i = 0; $i < $fileCount; $i++) {
        $fileName = $_FILES['files']['name'][$i];
        $tmpName = $_FILES['files']['tmp_name'][$i];
        $fileSize = $_FILES['files']['size'][$i];
        $fileError = $_FILES['files']['error'][$i];
        $mimeType = $_FILES['files']['type'][$i];

        if ($fileError !== UPLOAD_ERR_OK) {
            $errors[] = "Error subiendo '$fileName'";
            continue;
        }

        if ($fileSize > $maxFileSize) {
            $errors[] = "'$fileName' excede el limite de 100MB";
            continue;
        }

        // Verify mime type using finfo for security
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $detectedMime = finfo_file($finfo, $tmpName);
        finfo_close($finfo);

        if (!in_array($detectedMime, $allowedMimes)) {
            $errors[] = "Tipo de archivo no permitido: '$fileName' ($detectedMime)";
            continue;
        }

        $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        $category = getFileCategory($detectedMime, $ext);
        $storedName = 'exp_' . $orderId . '_' . uniqid() . '_' . time() . '.' . $ext;
        $destPath = $uploadDir . $storedName;

        if (!move_uploaded_file($tmpName, $destPath)) {
            $errors[] = "Error guardando '$fileName'";
            continue;
        }

        // Insert into database
        try {
            $stmt = $pdo->prepare("
                INSERT INTO expediente_files (order_id, original_name, stored_name, mime_type, file_size, category, description, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $uploadedBy = 'admin'; // Could be extracted from JWT payload
            $stmt->execute([$orderId, $fileName, $storedName, $detectedMime, $fileSize, $category, $description, $uploadedBy]);

            $uploadedFiles[] = [
                'id' => $pdo->lastInsertId(),
                'original_name' => $fileName,
                'category' => $category,
                'file_size' => $fileSize,
                'mime_type' => $detectedMime,
            ];
        } catch (PDOException $e) {
            error_log("Error inserting file record: " . $e->getMessage());
            $errors[] = "Error registrando '$fileName'";
            // Clean up uploaded file
            if (file_exists($destPath)) unlink($destPath);
        }
    }

    // Send notification + email to client
    if ($notifyClient && count($uploadedFiles) > 0) {
        notifyClientAboutFiles($pdo, $order, $uploadedFiles, $description);
    }

    $result = [
        'success' => true,
        'uploaded' => $uploadedFiles,
        'count' => count($uploadedFiles),
    ];
    if (!empty($errors)) {
        $result['errors'] = $errors;
    }

    echo json_encode($result);
}

function notifyClientAboutFiles($pdo, $order, $files, $description) {
    $userEmail = $order['customer_email'];
    $orderNumber = $order['order_number'];
    $customerName = $order['customer_name'];
    $firstName = explode(' ', $customerName)[0];
    $fileCount = count($files);

    // 1. Create in-app notification
    try {
        $title = 'Nuevos documentos en tu Expediente ' . $orderNumber;
        $message = $fileCount === 1
            ? 'Se ha subido 1 documento a tu expediente. Revisalo en tu panel.'
            : 'Se han subido ' . $fileCount . ' documentos a tu expediente. Revisalos en tu panel.';
        if ($description) {
            $message .= ' Nota: ' . $description;
        }
        $link = '/panel/#myproducts';

        $stmt = $pdo->prepare("INSERT INTO notifications (user_email, type, title, message, link) VALUES (?, 'expediente_files', ?, ?, ?)");
        $stmt->execute([$userEmail, $title, $message, $link]);
    } catch (Exception $e) {
        error_log('File notification record failed: ' . $e->getMessage());
    }

    // 2. Send email
    try {
        $emailService = new EmailService();
        $emailService->sendExpedienteFilesEmail($userEmail, $firstName, [
            'order_number' => $orderNumber,
            'files' => $files,
            'description' => $description,
            'file_count' => $fileCount,
        ]);
    } catch (Exception $e) {
        error_log('File notification email failed: ' . $e->getMessage());
    }
}

function listFiles() {
    $orderId = intval($_GET['order_id'] ?? 0);
    if (!$orderId) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere order_id']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT id, order_id, original_name, stored_name, mime_type, file_size, category, description, uploaded_by, created_at
            FROM expediente_files
            WHERE order_id = ?
            ORDER BY created_at DESC
        ");
        $stmt->execute([$orderId]);
        $files = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Build download URLs
        $isTest = strpos($_SERVER['REQUEST_URI'] ?? '', '/test/') !== false;
        $baseUrl = $isTest ? '/test/api/expediente_files_api.php' : '/api/expediente_files_api.php';
        foreach ($files as &$f) {
            $f['download_url'] = $baseUrl . '?action=download&id=' . $f['id'];
            $f['file_size_formatted'] = formatFileSize($f['file_size']);
        }

        echo json_encode(['success' => true, 'files' => $files]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error: ' . $e->getMessage()]);
    }
}

function downloadFile() {
    $fileId = intval($_GET['id'] ?? 0);
    if (!$fileId) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere id']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM expediente_files WHERE id = ?");
        $stmt->execute([$fileId]);
        $file = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$file) {
            http_response_code(404);
            echo json_encode(['error' => 'Archivo no encontrado']);
            return;
        }

        $filePath = getUploadDir() . $file['stored_name'];
        if (!file_exists($filePath)) {
            http_response_code(404);
            echo json_encode(['error' => 'Archivo no disponible en el servidor']);
            return;
        }

        // Serve file
        header('Content-Type: ' . $file['mime_type']);
        header('Content-Length: ' . filesize($filePath));

        // For images and PDFs, display inline; for others, force download
        $inlineTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf',
                        'video/mp4', 'video/webm'];
        if (in_array($file['mime_type'], $inlineTypes)) {
            header('Content-Disposition: inline; filename="' . $file['original_name'] . '"');
        } else {
            header('Content-Disposition: attachment; filename="' . $file['original_name'] . '"');
        }

        header('Cache-Control: public, max-age=86400');
        readfile($filePath);
        exit();
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error: ' . $e->getMessage()]);
    }
}

function deleteFile() {
    $input = json_decode(file_get_contents('php://input'), true);
    $fileId = intval($input['id'] ?? $_GET['id'] ?? 0);
    if (!$fileId) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere id']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM expediente_files WHERE id = ?");
        $stmt->execute([$fileId]);
        $file = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$file) {
            http_response_code(404);
            echo json_encode(['error' => 'Archivo no encontrado']);
            return;
        }

        // Delete from filesystem
        $filePath = getUploadDir() . $file['stored_name'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }

        // Delete from database
        $stmt = $pdo->prepare("DELETE FROM expediente_files WHERE id = ?");
        $stmt->execute([$fileId]);

        echo json_encode(['success' => true, 'message' => 'Archivo eliminado']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error: ' . $e->getMessage()]);
    }
}

function runFilesMigration() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS expediente_files (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                original_name VARCHAR(500) NOT NULL,
                stored_name VARCHAR(500) NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                file_size BIGINT NOT NULL DEFAULT 0,
                category ENUM('image','video','document','other') DEFAULT 'other',
                description TEXT,
                uploaded_by VARCHAR(100) DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                INDEX idx_order_files (order_id),
                INDEX idx_category (category)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        echo json_encode(['success' => true, 'message' => 'Table expediente_files created/updated']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Migration failed: ' . $e->getMessage()]);
    }
}

function formatFileSize($bytes) {
    if ($bytes >= 1073741824) return number_format($bytes / 1073741824, 2) . ' GB';
    if ($bytes >= 1048576) return number_format($bytes / 1048576, 1) . ' MB';
    if ($bytes >= 1024) return number_format($bytes / 1024, 0) . ' KB';
    return $bytes . ' B';
}
