<?php
/**
 * User Products API - Imporlan Panel
 * Handles CRUD operations for user products/services
 */

require_once __DIR__ . '/db_config.php';

class UserProductsAPI {
    private $pdo;
    
    public function __construct() {
        $this->pdo = getDbConnection();
    }
    
    /**
     * Get all products for a specific user
     */
    public function getUserProducts($userId) {
        if (!$this->pdo) {
            return ['error' => 'Database connection failed'];
        }
        
        try {
            $stmt = $this->pdo->prepare("
                SELECT 
                    id,
                    user_id,
                    product_id,
                    product_name,
                    product_type,
                    status,
                    DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
                    DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
                    price,
                    currency,
                    payment_method,
                    payment_reference,
                    metadata,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
                FROM wp_user_products 
                WHERE user_id = ? 
                ORDER BY created_at DESC
            ");
            $stmt->execute([$userId]);
            $products = $stmt->fetchAll();
            
            // Parse JSON metadata
            foreach ($products as &$product) {
                if ($product['metadata']) {
                    $product['metadata'] = json_decode($product['metadata'], true);
                }
            }
            
            return ['success' => true, 'products' => $products];
        } catch (PDOException $e) {
            error_log("Error fetching user products: " . $e->getMessage());
            return ['error' => 'Failed to fetch products'];
        }
    }
    
    /**
     * Get a single product by ID (with user verification)
     */
    public function getProduct($productId, $userId) {
        if (!$this->pdo) {
            return ['error' => 'Database connection failed'];
        }
        
        try {
            $stmt = $this->pdo->prepare("
                SELECT 
                    id,
                    user_id,
                    product_id,
                    product_name,
                    product_type,
                    status,
                    DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
                    DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
                    price,
                    currency,
                    payment_method,
                    payment_reference,
                    metadata,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at,
                    DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
                FROM wp_user_products 
                WHERE id = ? AND user_id = ?
            ");
            $stmt->execute([$productId, $userId]);
            $product = $stmt->fetch();
            
            if (!$product) {
                return ['error' => 'Product not found', 'code' => 404];
            }
            
            if ($product['metadata']) {
                $product['metadata'] = json_decode($product['metadata'], true);
            }
            
            return ['success' => true, 'product' => $product];
        } catch (PDOException $e) {
            error_log("Error fetching product: " . $e->getMessage());
            return ['error' => 'Failed to fetch product'];
        }
    }
    
    /**
     * Create a new user product record
     */
    public function createProduct($data) {
        if (!$this->pdo) {
            return ['error' => 'Database connection failed'];
        }
        
        $required = ['user_id', 'product_id', 'product_name', 'price', 'payment_method'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                return ['error' => "Missing required field: $field"];
            }
        }
        
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO wp_user_products 
                (user_id, product_id, product_name, product_type, status, start_date, end_date, price, currency, payment_method, payment_reference, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $data['user_id'],
                $data['product_id'],
                $data['product_name'],
                $data['product_type'] ?? 'Plan de Busqueda',
                $data['status'] ?? 'en_proceso',
                $data['start_date'] ?? date('Y-m-d H:i:s'),
                $data['end_date'] ?? null,
                $data['price'],
                $data['currency'] ?? 'CLP',
                $data['payment_method'],
                $data['payment_reference'] ?? null,
                isset($data['metadata']) ? json_encode($data['metadata']) : null
            ]);
            
            $productId = $this->pdo->lastInsertId();
            
            return [
                'success' => true, 
                'message' => 'Product created successfully',
                'product_id' => $productId
            ];
        } catch (PDOException $e) {
            error_log("Error creating product: " . $e->getMessage());
            return ['error' => 'Failed to create product'];
        }
    }
    
    /**
     * Update product status
     */
    public function updateProductStatus($productId, $userId, $status) {
        if (!$this->pdo) {
            return ['error' => 'Database connection failed'];
        }
        
        $validStatuses = ['activo', 'en_proceso', 'finalizado', 'vencido'];
        if (!in_array($status, $validStatuses)) {
            return ['error' => 'Invalid status'];
        }
        
        try {
            $stmt = $this->pdo->prepare("
                UPDATE wp_user_products 
                SET status = ? 
                WHERE id = ? AND user_id = ?
            ");
            $stmt->execute([$status, $productId, $userId]);
            
            if ($stmt->rowCount() === 0) {
                return ['error' => 'Product not found or not authorized'];
            }
            
            return ['success' => true, 'message' => 'Status updated successfully'];
        } catch (PDOException $e) {
            error_log("Error updating product status: " . $e->getMessage());
            return ['error' => 'Failed to update status'];
        }
    }
}

// Handle API requests if called directly
if (basename($_SERVER['SCRIPT_FILENAME']) === 'user_products.php') {
    require_once __DIR__ . '/config.php';
    setCorsHeaders();
    
    $api = new UserProductsAPI();
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    
    // Get user_id from request (in production, this should come from session/JWT)
    $userId = $input['user_id'] ?? $_GET['user_id'] ?? null;
    
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['error' => 'User ID required']);
        exit;
    }
    
    $action = $_GET['action'] ?? 'list';
    
    switch ($action) {
        case 'list':
            echo json_encode($api->getUserProducts($userId));
            break;
            
        case 'get':
            $productId = $_GET['id'] ?? $input['id'] ?? null;
            if (!$productId) {
                http_response_code(400);
                echo json_encode(['error' => 'Product ID required']);
                exit;
            }
            echo json_encode($api->getProduct($productId, $userId));
            break;
            
        case 'create':
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
                exit;
            }
            $input['user_id'] = $userId;
            echo json_encode($api->createProduct($input));
            break;
            
        case 'update_status':
            if ($method !== 'POST' && $method !== 'PUT') {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
                exit;
            }
            $productId = $input['id'] ?? null;
            $status = $input['status'] ?? null;
            if (!$productId || !$status) {
                http_response_code(400);
                echo json_encode(['error' => 'Product ID and status required']);
                exit;
            }
            echo json_encode($api->updateProductStatus($productId, $userId, $status));
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
    }
}

