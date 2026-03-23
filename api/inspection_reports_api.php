<?php
/**
 * Inspection Reports API - Imporlan
 * 
 * Full CRUD for vessel inspection reports.
 * Admin creates/fills reports; client views completed ones.
 * Supports 3 tiers: basica, estandar, premium.
 *
 * Endpoints:
 * - GET  ?action=migrate                     - Create/update tables
 * - GET  ?action=admin_list                   - List all inspections (admin)
 * - GET  ?action=admin_detail&id=X            - Get inspection detail (admin)
 * - POST ?action=admin_create                 - Create new inspection (admin)
 * - POST ?action=admin_update                 - Save/update inspection (admin)
 * - POST ?action=admin_send&id=X              - Send to client (admin)
 * - POST ?action=admin_delete&id=X            - Delete inspection (admin)
 * - POST ?action=upload_media                 - Upload photo/video (admin)
 * - GET  ?action=user_list&user_email=X       - List inspections for user
 * - GET  ?action=user_detail&id=X&user_email=X - Get inspection detail (user)
 */

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/auth_helper.php';

if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Email, X-User-Name');
    header('Content-Type: application/json');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }

    $action = $_GET['action'] ?? '';

    // Agent role can view inspections (list, detail) but not create/update/delete
    $agentAllowed = ['admin', 'support', 'agent'];

    switch ($action) {
        case 'migrate':
            requireAdminAuthShared();
            runInspectionMigration();
            break;
        case 'admin_list':
            requireAdminAuthShared($agentAllowed);
            adminListInspections();
            break;
        case 'admin_detail':
            requireAdminAuthShared($agentAllowed);
            adminDetailInspection();
            break;
        case 'admin_create':
            requireAdminAuthShared();
            adminCreateInspection();
            break;
        case 'admin_update':
            requireAdminAuthShared();
            adminUpdateInspection();
            break;
        case 'admin_send':
            requireAdminAuthShared();
            adminSendInspection();
            break;
        case 'admin_delete':
            requireAdminAuthShared();
            adminDeleteInspection();
            break;
        case 'upload_media':
            requireAdminAuthShared();
            uploadInspectionMedia();
            break;
        case 'user_list':
            $userPayload = requireUserAuthShared();
            userListInspections($userPayload);
            break;
        case 'user_detail':
            $userPayload = requireUserAuthShared();
            userDetailInspection($userPayload);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Accion no valida']);
    }
}

// ============================================================
// DATABASE MIGRATION
// ============================================================

function runInspectionMigration() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS wp_inspection_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                user_name VARCHAR(255) DEFAULT NULL,
                report_type ENUM('basica','estandar','premium') NOT NULL DEFAULT 'basica',
                status ENUM('draft','in_progress','completed','sent') NOT NULL DEFAULT 'draft',

                /* Vessel info */
                vessel_type VARCHAR(100) DEFAULT NULL,
                brand VARCHAR(255) DEFAULT NULL,
                model VARCHAR(255) DEFAULT NULL,
                vessel_year INT DEFAULT NULL,
                length_ft DECIMAL(10,2) DEFAULT NULL,
                hull_material VARCHAR(100) DEFAULT NULL,
                engine_brand VARCHAR(255) DEFAULT NULL,
                engine_model VARCHAR(255) DEFAULT NULL,
                engine_hours VARCHAR(100) DEFAULT NULL,
                num_engines INT DEFAULT 1,
                fuel_type VARCHAR(50) DEFAULT NULL,

                /* Location */
                country VARCHAR(10) DEFAULT 'usa',
                state_region VARCHAR(100) DEFAULT NULL,
                city VARCHAR(255) DEFAULT NULL,
                marina VARCHAR(255) DEFAULT NULL,

                /* Inspection sections (JSON) */
                section_hull JSON DEFAULT NULL,
                section_engine JSON DEFAULT NULL,
                section_electrical JSON DEFAULT NULL,
                section_interior JSON DEFAULT NULL,
                section_trailer JSON DEFAULT NULL,
                section_navigation JSON DEFAULT NULL,
                section_safety JSON DEFAULT NULL,
                section_test_drive JSON DEFAULT NULL,
                section_documentation JSON DEFAULT NULL,

                /* Media (JSON arrays of URLs) */
                photos_hull JSON DEFAULT NULL,
                photos_engine JSON DEFAULT NULL,
                photos_electrical JSON DEFAULT NULL,
                photos_interior JSON DEFAULT NULL,
                photos_trailer JSON DEFAULT NULL,
                photos_general JSON DEFAULT NULL,
                photos_test_drive JSON DEFAULT NULL,
                videos_test_drive JSON DEFAULT NULL,

                /* Overall */
                overall_rating DECIMAL(3,1) DEFAULT NULL,
                overall_summary TEXT DEFAULT NULL,
                recommendations TEXT DEFAULT NULL,
                inspector_name VARCHAR(255) DEFAULT NULL,
                inspector_notes TEXT DEFAULT NULL,

                /* Pricing */
                price_usd DECIMAL(10,2) DEFAULT NULL,
                listing_url TEXT DEFAULT NULL,

                /* Meta */
                created_by VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                sent_at TIMESTAMP NULL DEFAULT NULL,

                INDEX idx_user_email (user_email),
                INDEX idx_status (status),
                INDEX idx_report_type (report_type),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        echo json_encode(['success' => true, 'message' => 'Inspection reports table created/updated']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Migration failed: ' . $e->getMessage()]);
    }
}

// ============================================================
// ADMIN ENDPOINTS
// ============================================================

function adminListInspections() {
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }

    try {
        // Ensure table exists
        runSilentMigration($pdo);

        $where = "1=1";
        $params = [];

        if (!empty($_GET['status'])) {
            $where .= " AND status = :status";
            $params[':status'] = $_GET['status'];
        }
        if (!empty($_GET['report_type'])) {
            $where .= " AND report_type = :report_type";
            $params[':report_type'] = $_GET['report_type'];
        }
        if (!empty($_GET['search'])) {
            $where .= " AND (user_email LIKE :search OR user_name LIKE :search2 OR brand LIKE :search3 OR model LIKE :search4)";
            $s = '%' . $_GET['search'] . '%';
            $params[':search'] = $s;
            $params[':search2'] = $s;
            $params[':search3'] = $s;
            $params[':search4'] = $s;
        }

        $stmt = $pdo->prepare("SELECT id, user_email, user_name, report_type, status, vessel_type, brand, model, vessel_year, length_ft, country, state_region, city, overall_rating, price_usd, created_at, updated_at, sent_at FROM wp_inspection_reports WHERE $where ORDER BY created_at DESC");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'inspections' => $rows]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function adminDetailInspection() {
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }

    $id = intval($_GET['id'] ?? 0);
    if ($id <= 0) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); return; }

    try {
        runSilentMigration($pdo);
        $stmt = $pdo->prepare("SELECT * FROM wp_inspection_reports WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Inspeccion no encontrada']);
            return;
        }

        // Decode JSON fields
        $jsonFields = ['section_hull','section_engine','section_electrical','section_interior','section_trailer','section_navigation','section_safety','section_test_drive','section_documentation','photos_hull','photos_engine','photos_electrical','photos_interior','photos_trailer','photos_general','photos_test_drive','videos_test_drive'];
        foreach ($jsonFields as $f) {
            if (isset($row[$f]) && is_string($row[$f])) {
                $row[$f] = json_decode($row[$f], true);
            }
        }

        echo json_encode(['success' => true, 'inspection' => $row]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function adminCreateInspection() {
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) { http_response_code(400); echo json_encode(['error' => 'Datos invalidos']); return; }

    $userEmail = trim($input['user_email'] ?? '');
    if (empty($userEmail)) { http_response_code(400); echo json_encode(['error' => 'Email del cliente requerido']); return; }

    $reportType = $input['report_type'] ?? 'basica';
    if (!in_array($reportType, ['basica', 'estandar', 'premium'])) $reportType = 'basica';

    try {
        runSilentMigration($pdo);

        $stmt = $pdo->prepare("INSERT INTO wp_inspection_reports (
            user_email, user_name, report_type, status, vessel_type, brand, model, vessel_year,
            length_ft, hull_material, engine_brand, engine_model, engine_hours, num_engines, fuel_type,
            country, state_region, city, marina, price_usd, listing_url, inspector_name, created_by
        ) VALUES (
            :user_email, :user_name, :report_type, 'draft', :vessel_type, :brand, :model, :vessel_year,
            :length_ft, :hull_material, :engine_brand, :engine_model, :engine_hours, :num_engines, :fuel_type,
            :country, :state_region, :city, :marina, :price_usd, :listing_url, :inspector_name, :created_by
        )");

        $stmt->execute([
            ':user_email' => $userEmail,
            ':user_name' => trim($input['user_name'] ?? '') ?: null,
            ':report_type' => $reportType,
            ':vessel_type' => trim($input['vessel_type'] ?? '') ?: null,
            ':brand' => trim($input['brand'] ?? '') ?: null,
            ':model' => trim($input['model'] ?? '') ?: null,
            ':vessel_year' => !empty($input['vessel_year']) ? intval($input['vessel_year']) : null,
            ':length_ft' => !empty($input['length_ft']) ? floatval($input['length_ft']) : null,
            ':hull_material' => trim($input['hull_material'] ?? '') ?: null,
            ':engine_brand' => trim($input['engine_brand'] ?? '') ?: null,
            ':engine_model' => trim($input['engine_model'] ?? '') ?: null,
            ':engine_hours' => trim($input['engine_hours'] ?? '') ?: null,
            ':num_engines' => !empty($input['num_engines']) ? intval($input['num_engines']) : 1,
            ':fuel_type' => trim($input['fuel_type'] ?? '') ?: null,
            ':country' => trim($input['country'] ?? 'usa'),
            ':state_region' => trim($input['state_region'] ?? '') ?: null,
            ':city' => trim($input['city'] ?? '') ?: null,
            ':marina' => trim($input['marina'] ?? '') ?: null,
            ':price_usd' => !empty($input['price_usd']) ? floatval($input['price_usd']) : null,
            ':listing_url' => trim($input['listing_url'] ?? '') ?: null,
            ':inspector_name' => trim($input['inspector_name'] ?? '') ?: null,
            ':created_by' => trim($input['created_by'] ?? '') ?: null,
        ]);

        $newId = $pdo->lastInsertId();
        echo json_encode(['success' => true, 'id' => $newId, 'message' => 'Inspeccion creada']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function adminUpdateInspection() {
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['id'])) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); return; }

    $id = intval($input['id']);

    try {
        runSilentMigration($pdo);

        // Build dynamic SET clause
        $allowed = [
            'user_email','user_name','report_type','status',
            'vessel_type','brand','model','vessel_year','length_ft','hull_material',
            'engine_brand','engine_model','engine_hours','num_engines','fuel_type',
            'country','state_region','city','marina',
            'section_hull','section_engine','section_electrical','section_interior',
            'section_trailer','section_navigation','section_safety','section_test_drive','section_documentation',
            'photos_hull','photos_engine','photos_electrical','photos_interior',
            'photos_trailer','photos_general','photos_test_drive','videos_test_drive',
            'overall_rating','overall_summary','recommendations',
            'inspector_name','inspector_notes','price_usd','listing_url'
        ];

        $jsonFields = ['section_hull','section_engine','section_electrical','section_interior','section_trailer','section_navigation','section_safety','section_test_drive','section_documentation','photos_hull','photos_engine','photos_electrical','photos_interior','photos_trailer','photos_general','photos_test_drive','videos_test_drive'];

        $sets = [];
        $params = [':id' => $id];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $input)) {
                $val = $input[$field];
                if (in_array($field, $jsonFields) && is_array($val)) {
                    $val = json_encode($val);
                }
                $sets[] = "$field = :$field";
                $params[":$field"] = $val;
            }
        }

        if (empty($sets)) {
            echo json_encode(['success' => true, 'message' => 'Sin cambios']);
            return;
        }

        $sql = "UPDATE wp_inspection_reports SET " . implode(', ', $sets) . " WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['success' => true, 'message' => 'Inspeccion actualizada']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function adminSendInspection() {
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); return; }

    try {
        runSilentMigration($pdo);

        $stmt = $pdo->prepare("UPDATE wp_inspection_reports SET status = 'sent', sent_at = NOW() WHERE id = :id");
        $stmt->execute([':id' => $id]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Inspeccion no encontrada']);
            return;
        }

        // Get inspection data for notification
        $stmt2 = $pdo->prepare("SELECT user_email, user_name, brand, model, vessel_year, report_type FROM wp_inspection_reports WHERE id = :id");
        $stmt2->execute([':id' => $id]);
        $insp = $stmt2->fetch(PDO::FETCH_ASSOC);

        if ($insp && !empty($insp['user_email'])) {
            // Create notification for user
            try {
                $reportLabel = $insp['report_type'] === 'premium' ? 'Premium' : ($insp['report_type'] === 'estandar' ? 'Estandar' : 'Basica');
                $vesselDesc = trim(($insp['brand'] ?? '') . ' ' . ($insp['model'] ?? '') . ' ' . ($insp['vessel_year'] ?? ''));
                if (empty($vesselDesc)) $vesselDesc = 'Embarcacion';

                $pdo->prepare("INSERT INTO notifications (user_email, type, title, message, created_at) VALUES (:email, 'inspection', :title, :message, NOW())")
                    ->execute([
                        ':email' => $insp['user_email'],
                        ':title' => 'Inspeccion Tecnica Disponible',
                        ':message' => 'Tu reporte de Inspeccion ' . $reportLabel . ' para ' . $vesselDesc . ' ya esta disponible en tu panel.'
                    ]);
            } catch (PDOException $e) {
                error_log("[InspectionReports] Notification error: " . $e->getMessage());
            }

            // Send email notification
            try {
                if (file_exists(__DIR__ . '/email_service.php')) {
                    require_once __DIR__ . '/email_service.php';
                    $emailService = getEmailService();
                    if (method_exists($emailService, 'sendGenericNotification')) {
                        $reportLabel = $insp['report_type'] === 'premium' ? 'Premium' : ($insp['report_type'] === 'estandar' ? 'Estandar' : 'Basica');
                        $emailService->sendGenericNotification(
                            $insp['user_email'],
                            $insp['user_name'] ?? 'Cliente',
                            'Tu Inspeccion Tecnica esta Lista',
                            'Tu reporte de Inspeccion ' . $reportLabel . ' ya esta disponible. Ingresa a tu panel para revisarlo en detalle.'
                        );
                    }
                }
            } catch (Exception $e) {
                error_log("[InspectionReports] Email error: " . $e->getMessage());
            }
        }

        echo json_encode(['success' => true, 'message' => 'Inspeccion enviada al cliente']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function adminDeleteInspection() {
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); return; }

    try {
        $stmt = $pdo->prepare("DELETE FROM wp_inspection_reports WHERE id = :id");
        $stmt->execute([':id' => $id]);
        echo json_encode(['success' => true, 'message' => 'Inspeccion eliminada']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

// ============================================================
// MEDIA UPLOAD
// ============================================================

function uploadInspectionMedia() {
    if (!isset($_FILES['media']) || $_FILES['media']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'No se recibio archivo valido']);
        return;
    }

    $file = $_FILES['media'];
    $allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    $allowedVideos = ['video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg'];
    $allowed = array_merge($allowedImages, $allowedVideos);

    // Server-side MIME validation using finfo (not relying on client-supplied type)
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $realMime = $finfo->file($file['tmp_name']);
    if (!in_array($realMime, $allowed)) {
        http_response_code(400);
        echo json_encode(['error' => 'Tipo de archivo no permitido. Use JPG, PNG, WEBP, GIF, MP4, MOV o WEBM']);
        return;
    }

    $isVideo = in_array($realMime, $allowedVideos);
    $maxSize = $isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024; // 100MB video, 10MB images

    if ($file['size'] > $maxSize) {
        $maxMB = $maxSize / (1024 * 1024);
        http_response_code(400);
        echo json_encode(['error' => "Archivo demasiado grande (max {$maxMB}MB)"]);
        return;
    }

    $uploadDir = __DIR__ . '/inspection_media/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $mimeToExt = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'video/mp4' => 'mp4', 'video/quicktime' => 'mov', 'video/webm' => 'webm', 'video/mpeg' => 'mpeg'];
    $ext = $mimeToExt[$realMime] ?? ($isVideo ? 'mp4' : 'jpg');
    $prefix = $isVideo ? 'vid_' : 'img_';
    $filename = $prefix . 'insp_' . uniqid() . '_' . time() . '.' . $ext;
    $destPath = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al guardar archivo']);
        return;
    }

    $isTest = strpos($_SERVER['REQUEST_URI'] ?? '', '/test/') !== false;
    $baseUrl = $isTest ? '/test/api/inspection_media/' : '/api/inspection_media/';
    $url = $baseUrl . $filename;

    echo json_encode([
        'success' => true,
        'url' => $url,
        'filename' => $filename,
        'type' => $isVideo ? 'video' : 'image',
        'size' => $file['size']
    ]);
}

// ============================================================
// USER ENDPOINTS
// ============================================================

function userListInspections($userPayload) {
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }

    $authenticatedEmail = $userPayload['email'] ?? '';
    $email = trim($_GET['user_email'] ?? '');
    if (empty($email)) { http_response_code(400); echo json_encode(['error' => 'Email requerido']); return; }

    // Verify the authenticated user can only access their own inspections
    if (!empty($authenticatedEmail) && strtolower($authenticatedEmail) !== strtolower($email)) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado para ver inspecciones de otro usuario']);
        return;
    }

    try {
        runSilentMigration($pdo);

        // Only show sent inspections to users
        $stmt = $pdo->prepare("SELECT id, user_email, user_name, report_type, status, vessel_type, brand, model, vessel_year, length_ft, hull_material, country, state_region, city, overall_rating, price_usd, inspector_name, created_at, sent_at FROM wp_inspection_reports WHERE user_email = :email AND status = 'sent' ORDER BY sent_at DESC");
        $stmt->execute([':email' => $email]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'inspections' => $rows]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function userDetailInspection($userPayload) {
    $pdo = getDbConnection();
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'DB error']); return; }

    $authenticatedEmail = $userPayload['email'] ?? '';
    $id = intval($_GET['id'] ?? 0);
    $email = trim($_GET['user_email'] ?? '');
    if ($id <= 0 || empty($email)) { http_response_code(400); echo json_encode(['error' => 'ID y email requeridos']); return; }

    // Verify the authenticated user can only access their own inspections
    if (!empty($authenticatedEmail) && strtolower($authenticatedEmail) !== strtolower($email)) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado para ver inspecciones de otro usuario']);
        return;
    }

    try {
        runSilentMigration($pdo);

        $stmt = $pdo->prepare("SELECT * FROM wp_inspection_reports WHERE id = :id AND user_email = :email AND status = 'sent'");
        $stmt->execute([':id' => $id, ':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Inspeccion no encontrada']);
            return;
        }

        // Decode JSON fields
        $jsonFields = ['section_hull','section_engine','section_electrical','section_interior','section_trailer','section_navigation','section_safety','section_test_drive','section_documentation','photos_hull','photos_engine','photos_electrical','photos_interior','photos_trailer','photos_general','photos_test_drive','videos_test_drive'];
        foreach ($jsonFields as $f) {
            if (isset($row[$f]) && is_string($row[$f])) {
                $row[$f] = json_decode($row[$f], true);
            }
        }

        echo json_encode(['success' => true, 'inspection' => $row]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

// ============================================================
// HELPER
// ============================================================

function runSilentMigration($pdo) {
    static $migrated = false;
    if ($migrated) return;
    $migrated = true;
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS wp_inspection_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                user_name VARCHAR(255) DEFAULT NULL,
                report_type ENUM('basica','estandar','premium') NOT NULL DEFAULT 'basica',
                status ENUM('draft','in_progress','completed','sent') NOT NULL DEFAULT 'draft',
                vessel_type VARCHAR(100) DEFAULT NULL,
                brand VARCHAR(255) DEFAULT NULL,
                model VARCHAR(255) DEFAULT NULL,
                vessel_year INT DEFAULT NULL,
                length_ft DECIMAL(10,2) DEFAULT NULL,
                hull_material VARCHAR(100) DEFAULT NULL,
                engine_brand VARCHAR(255) DEFAULT NULL,
                engine_model VARCHAR(255) DEFAULT NULL,
                engine_hours VARCHAR(100) DEFAULT NULL,
                num_engines INT DEFAULT 1,
                fuel_type VARCHAR(50) DEFAULT NULL,
                country VARCHAR(10) DEFAULT 'usa',
                state_region VARCHAR(100) DEFAULT NULL,
                city VARCHAR(255) DEFAULT NULL,
                marina VARCHAR(255) DEFAULT NULL,
                section_hull JSON DEFAULT NULL,
                section_engine JSON DEFAULT NULL,
                section_electrical JSON DEFAULT NULL,
                section_interior JSON DEFAULT NULL,
                section_trailer JSON DEFAULT NULL,
                section_navigation JSON DEFAULT NULL,
                section_safety JSON DEFAULT NULL,
                section_test_drive JSON DEFAULT NULL,
                section_documentation JSON DEFAULT NULL,
                photos_hull JSON DEFAULT NULL,
                photos_engine JSON DEFAULT NULL,
                photos_electrical JSON DEFAULT NULL,
                photos_interior JSON DEFAULT NULL,
                photos_trailer JSON DEFAULT NULL,
                photos_general JSON DEFAULT NULL,
                photos_test_drive JSON DEFAULT NULL,
                videos_test_drive JSON DEFAULT NULL,
                overall_rating DECIMAL(3,1) DEFAULT NULL,
                overall_summary TEXT DEFAULT NULL,
                recommendations TEXT DEFAULT NULL,
                inspector_name VARCHAR(255) DEFAULT NULL,
                inspector_notes TEXT DEFAULT NULL,
                price_usd DECIMAL(10,2) DEFAULT NULL,
                listing_url TEXT DEFAULT NULL,
                created_by VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                sent_at TIMESTAMP NULL DEFAULT NULL,
                INDEX idx_user_email (user_email),
                INDEX idx_status (status),
                INDEX idx_report_type (report_type),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    } catch (PDOException $e) {
        // Table may already exist, ignore
    }
}
