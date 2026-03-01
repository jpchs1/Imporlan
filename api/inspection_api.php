<?php
/**
 * Inspection Pre-Purchase API - Imporlan
 * Handles inspection quotation form submissions for Chile and USA
 * 
 * Features:
 * - Validates and sanitizes all inputs
 * - Stores leads in database
 * - Sends confirmation email to user
 * - Sends notification email to admin
 * - Honeypot anti-spam field
 * - Rate limiting per IP (3 submissions / 10 min)
 * 
 * @version 1.0
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/email_service.php';

// --- Anti-spam: Rate Limiting ---
function checkRateLimit($pdo, $ip) {
    try {
        // Ensure rate limit table exists
        $pdo->exec("CREATE TABLE IF NOT EXISTS wp_inspection_rate_limit (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ip_address VARCHAR(45) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ip_created (ip_address, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // Clean old entries (older than 10 min)
        $pdo->exec("DELETE FROM wp_inspection_rate_limit WHERE created_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)");

        // Count recent submissions from this IP
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM wp_inspection_rate_limit WHERE ip_address = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)");
        $stmt->execute([$ip]);
        $count = (int) $stmt->fetchColumn();

        if ($count >= 3) {
            return false; // Rate limited
        }

        // Record this submission
        $stmt = $pdo->prepare("INSERT INTO wp_inspection_rate_limit (ip_address) VALUES (?)");
        $stmt->execute([$ip]);

        return true;
    } catch (PDOException $e) {
        error_log("[InspectionAPI] Rate limit error: " . $e->getMessage());
        return true; // Allow on error to not block legitimate users
    }
}

// --- Ensure leads table exists ---
function ensureLeadsTable($pdo) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS wp_inspection_leads (
            id INT AUTO_INCREMENT PRIMARY KEY,
            country VARCHAR(10) NOT NULL,
            
            /* Client data */
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(100) NOT NULL,
            city_residence VARCHAR(255) DEFAULT NULL,
            how_found VARCHAR(100) DEFAULT NULL,
            comments TEXT DEFAULT NULL,
            
            /* Vessel data */
            vessel_type VARCHAR(100) NOT NULL,
            brand VARCHAR(255) NOT NULL,
            model VARCHAR(255) NOT NULL,
            vessel_year INT NOT NULL,
            length_value DECIMAL(10,2) NOT NULL,
            length_unit VARCHAR(10) NOT NULL DEFAULT 'pies',
            hull_material VARCHAR(100) NOT NULL,
            published_price VARCHAR(100) DEFAULT NULL,
            price_currency VARCHAR(10) DEFAULT NULL,
            listing_url TEXT DEFAULT NULL,
            
            /* Engines */
            num_engines VARCHAR(10) NOT NULL,
            engine_brand_model VARCHAR(255) DEFAULT NULL,
            engine_hours VARCHAR(50) DEFAULT NULL,
            has_generator VARCHAR(10) DEFAULT NULL,
            electronics TEXT DEFAULT NULL,
            
            /* Inspection types (JSON array) */
            inspection_types JSON DEFAULT NULL,
            wants_recommendation TINYINT(1) DEFAULT 0,
            
            /* Country-specific: Location */
            state_usa VARCHAR(100) DEFAULT NULL,
            city VARCHAR(255) DEFAULT NULL,
            marina VARCHAR(255) DEFAULT NULL,
            water_status VARCHAR(50) DEFAULT NULL,
            region_chile VARCHAR(100) DEFAULT NULL,
            lake_or_sea VARCHAR(50) DEFAULT NULL,
            
            /* Country-specific: Chile motor */
            engine_type_chile VARCHAR(100) DEFAULT NULL,
            
            /* Objective & timeline */
            purchase_objective VARCHAR(100) DEFAULT NULL,
            import_to_chile VARCHAR(50) DEFAULT NULL,
            inspection_timeline VARCHAR(100) NOT NULL,
            
            /* Broker (USA) */
            has_broker VARCHAR(10) DEFAULT NULL,
            broker_name VARCHAR(255) DEFAULT NULL,
            broker_contact VARCHAR(255) DEFAULT NULL,
            
            /* Meta */
            ip_address VARCHAR(45) DEFAULT NULL,
            user_agent TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            INDEX idx_country (country),
            INDEX idx_email (email),
            INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } catch (PDOException $e) {
        error_log("[InspectionAPI] Table creation error: " . $e->getMessage());
    }
}

// --- Input sanitization ---
function sanitize($value) {
    if ($value === null) return null;
    $value = trim($value);
    $value = strip_tags($value);
    $value = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    return $value;
}

function sanitizeUrl($url) {
    if (empty($url)) return null;
    $url = trim($url);
    if (!filter_var($url, FILTER_VALIDATE_URL)) return null;
    return $url;
}

// --- Main logic ---
try {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Datos JSON invalidos']);
        exit();
    }

    // Honeypot check
    if (!empty($input['website_url'])) {
        // Bot detected - return fake success
        echo json_encode(['success' => true, 'message' => 'Solicitud enviada correctamente']);
        exit();
    }

    $pdo = getDbConnection();

    // Rate limit check
    $clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $clientIp = explode(',', $clientIp)[0]; // Take first IP if multiple
    $clientIp = trim($clientIp);

    if (!checkRateLimit($pdo, $clientIp)) {
        http_response_code(429);
        echo json_encode(['success' => false, 'error' => 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.']);
        exit();
    }

    // --- Validate required fields ---
    $errors = [];
    $country = sanitize($input['country'] ?? '');
    if (!in_array($country, ['chile', 'usa'])) {
        $errors[] = 'Selecciona un pais valido (Chile o USA)';
    }

    // Client fields
    $fullName = sanitize($input['full_name'] ?? '');
    $email = trim($input['email'] ?? '');
    $phone = sanitize($input['phone'] ?? '');

    if (empty($fullName)) $errors[] = 'El nombre completo es obligatorio';
    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Un email valido es obligatorio';
    if (empty($phone)) $errors[] = 'El telefono/WhatsApp es obligatorio';

    // Vessel fields
    $vesselType = sanitize($input['vessel_type'] ?? '');
    $brand = sanitize($input['brand'] ?? '');
    $model = sanitize($input['model'] ?? '');
    $vesselYear = intval($input['vessel_year'] ?? 0);
    $lengthValue = floatval($input['length_value'] ?? 0);
    $lengthUnit = sanitize($input['length_unit'] ?? 'pies');
    $hullMaterial = sanitize($input['hull_material'] ?? '');

    if (empty($vesselType)) $errors[] = 'El tipo de embarcacion es obligatorio';
    if (empty($brand)) $errors[] = 'La marca es obligatoria';
    if (empty($model)) $errors[] = 'El modelo es obligatorio';
    if ($vesselYear < 1900 || $vesselYear > (int)date('Y') + 2) $errors[] = 'El ano debe ser valido';
    if ($lengthValue <= 0) $errors[] = 'La eslora debe ser mayor a 0';
    if (empty($hullMaterial)) $errors[] = 'El material del casco es obligatorio';

    // Engines
    $numEngines = sanitize($input['num_engines'] ?? '');
    if (empty($numEngines)) $errors[] = 'El numero de motores es obligatorio';

    // Inspection timeline
    $inspectionTimeline = sanitize($input['inspection_timeline'] ?? '');
    if (empty($inspectionTimeline)) $errors[] = 'El plazo de inspeccion es obligatorio';

    // Country-specific required fields
    if ($country === 'usa') {
        $stateUsa = sanitize($input['state_usa'] ?? '');
        $city = sanitize($input['city'] ?? '');
        $waterStatus = sanitize($input['water_status'] ?? '');
        $importToChile = sanitize($input['import_to_chile'] ?? '');
        if (empty($stateUsa)) $errors[] = 'El estado (USA) es obligatorio';
        if (empty($city)) $errors[] = 'La ciudad es obligatoria';
        if (empty($waterStatus)) $errors[] = 'Indica si la embarcacion esta en agua o en seco';
        if (empty($importToChile)) $errors[] = 'Indica si planeas importar a Chile';
    } elseif ($country === 'chile') {
        $regionChile = sanitize($input['region_chile'] ?? '');
        $city = sanitize($input['city'] ?? '');
        $waterStatus = sanitize($input['water_status'] ?? '');
        if (empty($regionChile)) $errors[] = 'La region es obligatoria';
        if (empty($city)) $errors[] = 'La ciudad es obligatoria';
        if (empty($waterStatus)) $errors[] = 'Indica si la embarcacion esta en agua o en seco';
    }

    if (!empty($errors)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'errors' => $errors]);
        exit();
    }

    // --- Collect all sanitized data ---
    $data = [
        'country' => $country,
        'full_name' => $fullName,
        'email' => $email,
        'phone' => $phone,
        'city_residence' => sanitize($input['city_residence'] ?? ''),
        'how_found' => sanitize($input['how_found'] ?? ''),
        'comments' => sanitize($input['comments'] ?? ''),
        'vessel_type' => $vesselType,
        'brand' => $brand,
        'model' => $model,
        'vessel_year' => $vesselYear,
        'length_value' => $lengthValue,
        'length_unit' => $lengthUnit,
        'hull_material' => $hullMaterial,
        'published_price' => sanitize($input['published_price'] ?? ''),
        'price_currency' => sanitize($input['price_currency'] ?? ''),
        'listing_url' => sanitizeUrl($input['listing_url'] ?? ''),
        'num_engines' => $numEngines,
        'engine_brand_model' => sanitize($input['engine_brand_model'] ?? ''),
        'engine_hours' => sanitize($input['engine_hours'] ?? ''),
        'has_generator' => sanitize($input['has_generator'] ?? ''),
        'electronics' => sanitize($input['electronics'] ?? ''),
        'inspection_types' => $input['inspection_types'] ?? [],
        'wants_recommendation' => !empty($input['wants_recommendation']) ? 1 : 0,
        'state_usa' => sanitize($input['state_usa'] ?? ''),
        'city' => sanitize($input['city'] ?? ''),
        'marina' => sanitize($input['marina'] ?? ''),
        'water_status' => sanitize($input['water_status'] ?? ''),
        'region_chile' => sanitize($input['region_chile'] ?? ''),
        'lake_or_sea' => sanitize($input['lake_or_sea'] ?? ''),
        'engine_type_chile' => sanitize($input['engine_type_chile'] ?? ''),
        'purchase_objective' => sanitize($input['purchase_objective'] ?? ''),
        'import_to_chile' => sanitize($input['import_to_chile'] ?? ''),
        'inspection_timeline' => $inspectionTimeline,
        'has_broker' => sanitize($input['has_broker'] ?? ''),
        'broker_name' => sanitize($input['broker_name'] ?? ''),
        'broker_contact' => sanitize($input['broker_contact'] ?? ''),
        'ip_address' => $clientIp,
        'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500)
    ];

    // --- Save to DB ---
    ensureLeadsTable($pdo);

    $stmt = $pdo->prepare("INSERT INTO wp_inspection_leads (
        country, full_name, email, phone, city_residence, how_found, comments,
        vessel_type, brand, model, vessel_year, length_value, length_unit, hull_material,
        published_price, price_currency, listing_url,
        num_engines, engine_brand_model, engine_hours, has_generator, electronics,
        inspection_types, wants_recommendation,
        state_usa, city, marina, water_status, region_chile, lake_or_sea,
        engine_type_chile, purchase_objective, import_to_chile, inspection_timeline,
        has_broker, broker_name, broker_contact,
        ip_address, user_agent
    ) VALUES (
        :country, :full_name, :email, :phone, :city_residence, :how_found, :comments,
        :vessel_type, :brand, :model, :vessel_year, :length_value, :length_unit, :hull_material,
        :published_price, :price_currency, :listing_url,
        :num_engines, :engine_brand_model, :engine_hours, :has_generator, :electronics,
        :inspection_types, :wants_recommendation,
        :state_usa, :city, :marina, :water_status, :region_chile, :lake_or_sea,
        :engine_type_chile, :purchase_objective, :import_to_chile, :inspection_timeline,
        :has_broker, :broker_name, :broker_contact,
        :ip_address, :user_agent
    )");

    $stmt->execute([
        ':country' => $data['country'],
        ':full_name' => $data['full_name'],
        ':email' => $data['email'],
        ':phone' => $data['phone'],
        ':city_residence' => $data['city_residence'] ?: null,
        ':how_found' => $data['how_found'] ?: null,
        ':comments' => $data['comments'] ?: null,
        ':vessel_type' => $data['vessel_type'],
        ':brand' => $data['brand'],
        ':model' => $data['model'],
        ':vessel_year' => $data['vessel_year'],
        ':length_value' => $data['length_value'],
        ':length_unit' => $data['length_unit'],
        ':hull_material' => $data['hull_material'],
        ':published_price' => $data['published_price'] ?: null,
        ':price_currency' => $data['price_currency'] ?: null,
        ':listing_url' => $data['listing_url'],
        ':num_engines' => $data['num_engines'],
        ':engine_brand_model' => $data['engine_brand_model'] ?: null,
        ':engine_hours' => $data['engine_hours'] ?: null,
        ':has_generator' => $data['has_generator'] ?: null,
        ':electronics' => $data['electronics'] ?: null,
        ':inspection_types' => json_encode($data['inspection_types']),
        ':wants_recommendation' => $data['wants_recommendation'],
        ':state_usa' => $data['state_usa'] ?: null,
        ':city' => $data['city'] ?: null,
        ':marina' => $data['marina'] ?: null,
        ':water_status' => $data['water_status'] ?: null,
        ':region_chile' => $data['region_chile'] ?: null,
        ':lake_or_sea' => $data['lake_or_sea'] ?: null,
        ':engine_type_chile' => $data['engine_type_chile'] ?: null,
        ':purchase_objective' => $data['purchase_objective'] ?: null,
        ':import_to_chile' => $data['import_to_chile'] ?: null,
        ':inspection_timeline' => $data['inspection_timeline'],
        ':has_broker' => $data['has_broker'] ?: null,
        ':broker_name' => $data['broker_name'] ?: null,
        ':broker_contact' => $data['broker_contact'] ?: null,
        ':ip_address' => $data['ip_address'],
        ':user_agent' => $data['user_agent']
    ]);

    $leadId = $pdo->lastInsertId();

    // --- Send emails ---
    $emailService = getEmailService();

    // Email to user (confirmation)
    $userEmailResult = $emailService->sendInspectionConfirmation($data);

    // Email to admin (lead notification)
    $adminEmailResult = $emailService->sendInspectionAdminNotification($data, $leadId);

    echo json_encode([
        'success' => true,
        'message' => 'Solicitud enviada correctamente',
        'lead_id' => $leadId,
        'email_sent' => $userEmailResult['success'] ?? false,
        'admin_notified' => $adminEmailResult['success'] ?? false
    ]);

} catch (Exception $e) {
    error_log("[InspectionAPI] Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno del servidor. Intenta de nuevo.']);
}
