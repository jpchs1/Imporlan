<?php
/**
 * Test Script - Imporlan Panel
 * Tests the user products API and email functionality
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/user_products.php';
require_once __DIR__ . '/email_service.php';

$action = $_GET['action'] ?? 'test_all';

switch ($action) {
    case 'create_test_product':
        $api = new UserProductsAPI();
        $result = $api->createProduct([
            'user_id' => $_GET['user_id'] ?? '1',
            'product_id' => 'plan_capitan_test',
            'product_name' => 'Plan Capitan - Test',
            'product_type' => 'Plan de Busqueda',
            'status' => 'activo',
            'start_date' => date('Y-m-d H:i:s'),
            'end_date' => date('Y-m-d H:i:s', strtotime('+1 year')),
            'price' => 299000,
            'currency' => 'CLP',
            'payment_method' => 'MercadoPago',
            'payment_reference' => 'MP-TEST-' . time(),
            'metadata' => ['test' => true, 'created_by' => 'test_script']
        ]);
        echo json_encode($result);
        break;
        
    case 'test_welcome_email':
        $email = $_GET['email'] ?? null;
        $name = $_GET['name'] ?? 'Usuario Test';
        
        if (!$email) {
            echo json_encode(['error' => 'Email parameter required']);
            exit;
        }
        
        $emailService = new EmailService();
        $result = $emailService->sendWelcomeEmail($email, $name);
        echo json_encode($result);
        break;
        
    case 'test_purchase_email':
        $email = $_GET['email'] ?? null;
        $name = $_GET['name'] ?? 'Usuario Test';
        
        if (!$email) {
            echo json_encode(['error' => 'Email parameter required']);
            exit;
        }
        
        $emailService = new EmailService();
        $result = $emailService->sendPurchaseConfirmationEmail($email, $name, [
            'product_name' => 'Plan Capitan',
            'product_type' => 'Plan de Busqueda',
            'price' => 299000,
            'currency' => 'CLP',
            'payment_method' => 'MercadoPago',
            'payment_reference' => 'MP-TEST-' . time(),
            'purchase_date' => date('d/m/Y')
        ]);
        echo json_encode($result);
        break;
        
    case 'list_products':
        $api = new UserProductsAPI();
        $result = $api->getUserProducts($_GET['user_id'] ?? '1');
        echo json_encode($result);
        break;
        
    case 'check_email_logs':
        $emailService = new EmailService();
        $result = $emailService->getEmailLogs(10, 0);
        echo json_encode($result);
        break;
        
    case 'test_all':
        echo json_encode([
            'status' => 'ok',
            'message' => 'Test script is working',
            'available_actions' => [
                'create_test_product' => 'Creates a test product for user_id (default: 1)',
                'test_welcome_email' => 'Sends welcome email to specified email address',
                'test_purchase_email' => 'Sends purchase confirmation email to specified email address',
                'list_products' => 'Lists products for user_id (default: 1)',
                'check_email_logs' => 'Shows recent email logs'
            ],
            'examples' => [
                'Create test product: ?action=create_test_product&user_id=1',
                'Send welcome email: ?action=test_welcome_email&email=test@example.com&name=Juan',
                'Send purchase email: ?action=test_purchase_email&email=test@example.com&name=Juan',
                'List products: ?action=list_products&user_id=1',
                'Check email logs: ?action=check_email_logs'
            ]
        ]);
        break;
        
    default:
        echo json_encode(['error' => 'Unknown action']);
}

