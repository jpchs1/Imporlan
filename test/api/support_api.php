<?php
/**
 * Support API - Imporlan Panel
 * Handles support form submissions and sends emails to contacto@imporlan.cl
 */

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
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

require_once __DIR__ . '/email_service.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
    exit();
}

$name = trim($input['name'] ?? '');
$email = trim($input['email'] ?? '');
$phone = trim($input['phone'] ?? '');
$subject = trim($input['subject'] ?? '');
$message = trim($input['message'] ?? '');

$errors = [];
if (empty($name)) $errors[] = 'El nombre es obligatorio';
if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Email valido es obligatorio';
if (empty($subject)) $errors[] = 'El asunto es obligatorio';
if (empty($message)) $errors[] = 'El mensaje es obligatorio';

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'errors' => $errors]);
    exit();
}

try {
    $emailService = getEmailService();
    
    $result = $emailService->sendSupportRequestNotification([
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'subject' => $subject,
        'message' => $message
    ]);
    
    $confirmationSent = $emailService->sendSupportConfirmation($email, $name, $subject);
    
    echo json_encode([
        'success' => true,
        'message' => 'Solicitud enviada correctamente',
        'notification_sent' => $result['success'] ?? false,
        'confirmation_sent' => $confirmationSent['success'] ?? false
    ]);
} catch (Exception $e) {
    error_log("[SupportAPI] Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno del servidor']);
}
