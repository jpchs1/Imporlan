<?php
/**
 * API Router - Imporlan
 * 
 * Este archivo actua como router para la API compatible con el backend de Fly.dev.
 * Maneja las rutas de la aplicacion y las redirige a los endpoints de pago correctos.
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get the request URI
$requestUri = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Remove query string from URI
$uriPath = parse_url($requestUri, PHP_URL_PATH);

// Remove /api prefix if present
$uriPath = preg_replace('#^/api#', '', $uriPath);

// Define plans data
$plansData = [
    'fragata' => [
        'id' => 'fragata',
        'name' => 'Plan Fragata',
        'description' => 'Monitoreo por 7 dias',
        'price' => 67600,
        'price_usd' => 67.60,
        'currency' => 'CLP',
        'features' => [
            '1 Requerimiento especifico',
            '5 propuestas/cotizaciones',
            'Analisis ofertas y recomendacion'
        ]
    ],
    'capitan' => [
        'id' => 'capitan',
        'name' => 'Plan Capitan de Navio',
        'description' => 'Monitoreo por 14 dias',
        'price' => 119600,
        'price_usd' => 119.60,
        'currency' => 'CLP',
        'features' => [
            '1 Requerimiento especifico',
            '9 propuestas/cotizaciones',
            'Analisis ofertas y recomendacion'
        ]
    ],
    'almirante' => [
        'id' => 'almirante',
        'name' => 'Plan Almirante',
        'description' => 'Monitoreo por 21 dias',
        'price' => 189600,
        'price_usd' => 189.60,
        'currency' => 'CLP',
        'features' => [
            '1 Requerimiento especifico',
            '15 propuestas/cotizaciones',
            'Analisis ofertas y recomendacion'
        ]
    ]
];

// Route the request
switch (true) {
    // Health check
    case $uriPath === '/healthz':
        echo json_encode(['status' => 'ok']);
        break;
    
    // Get plans
    case ($uriPath === '/api/plans' || $uriPath === '/plans') && $requestMethod === 'GET':
        echo json_encode(['plans' => array_values($plansData)]);
        break;
    
    // Create MercadoPago preference for a plan
    case preg_match('#^(/api)?/plans/([^/]+)/mercadopago$#', $uriPath, $matches) && $requestMethod === 'POST':
        $planId = $matches[2];
        $plan = $plansData[$planId] ?? null;
        
        if (!$plan) {
            http_response_code(404);
            echo json_encode(['error' => 'Plan no encontrado']);
            break;
        }
        
        // Create MercadoPago preference
        $config = getMercadoPagoConfig();
        
        $preferenceData = [
            'items' => [
                [
                    'id' => 'imporlan_' . $planId,
                    'title' => $plan['name'],
                    'description' => $plan['description'],
                    'quantity' => 1,
                    'currency_id' => 'CLP',
                    'unit_price' => $plan['price']
                ]
            ],
            'back_urls' => [
                'success' => 'https://www.imporlan.cl/test/?payment=success&plan=' . $planId,
                'failure' => 'https://www.imporlan.cl/test/?payment=failure&plan=' . $planId,
                'pending' => 'https://www.imporlan.cl/test/?payment=pending&plan=' . $planId
            ],
            'auto_return' => 'approved',
            'notification_url' => 'https://www.imporlan.cl/api/mercadopago.php?action=webhook',
            'statement_descriptor' => 'IMPORLAN',
            'external_reference' => $plan['name'] . '_' . time()
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.mercadopago.com/checkout/preferences');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($preferenceData));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $config['access_token']
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 201 && $httpCode !== 200) {
            http_response_code(500);
            echo json_encode([
                'error' => 'Error al crear preferencia en MercadoPago',
                'details' => json_decode($response, true)
            ]);
            break;
        }
        
        $preference = json_decode($response, true);
        
        // Use sandbox_init_point for sandbox environment
        $checkoutUrl = PAYMENT_ENVIRONMENT === 'sandbox' 
            ? ($preference['sandbox_init_point'] ?? $preference['init_point'])
            : $preference['init_point'];
        
        echo json_encode([
            'success' => true,
            'preference_id' => $preference['id'],
            'init_point' => $checkoutUrl,
            'sandbox_init_point' => $preference['sandbox_init_point'] ?? $preference['init_point']
        ]);
        break;
    
    // Create PayPal order for a plan
    case preg_match('#^(/api)?/plans/([^/]+)/paypal$#', $uriPath, $matches) && $requestMethod === 'POST':
        $planId = $matches[2];
        $plan = $plansData[$planId] ?? null;
        
        if (!$plan) {
            http_response_code(404);
            echo json_encode(['error' => 'Plan no encontrado']);
            break;
        }
        
        // Get PayPal access token
        $config = getPayPalConfig();
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $config['url'] . '/v1/oauth2/token');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, 'grant_type=client_credentials');
        curl_setopt($ch, CURLOPT_USERPWD, $config['client_id'] . ':' . $config['secret']);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/x-www-form-urlencoded'
        ]);
        
        $tokenResponse = curl_exec($ch);
        $tokenHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($tokenHttpCode !== 200) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al obtener token de PayPal']);
            break;
        }
        
        $tokenData = json_decode($tokenResponse, true);
        $accessToken = $tokenData['access_token'];
        
        // Create PayPal order
        $orderData = [
            'intent' => 'CAPTURE',
            'purchase_units' => [
                [
                    'description' => $plan['description'],
                    'custom_id' => $plan['name'],
                    'amount' => [
                        'currency_code' => 'USD',
                        'value' => number_format($plan['price_usd'], 2, '.', '')
                    ]
                ]
            ],
            'application_context' => [
                'brand_name' => 'Imporlan',
                'landing_page' => 'NO_PREFERENCE',
                'user_action' => 'PAY_NOW',
                'return_url' => 'https://www.imporlan.cl/test/?payment=success&plan=' . $planId,
                'cancel_url' => 'https://www.imporlan.cl/test/?payment=cancelled&plan=' . $planId
            ]
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $config['url'] . '/v2/checkout/orders');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderData));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken
        ]);
        
        $orderResponse = curl_exec($ch);
        $orderHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($orderHttpCode !== 201) {
            http_response_code(500);
            echo json_encode([
                'error' => 'Error al crear orden en PayPal',
                'details' => json_decode($orderResponse, true)
            ]);
            break;
        }
        
        $order = json_decode($orderResponse, true);
        
        // Find approval URL
        $approvalUrl = '';
        foreach ($order['links'] as $link) {
            if ($link['rel'] === 'approve') {
                $approvalUrl = $link['href'];
                break;
            }
        }
        
        echo json_encode([
            'success' => true,
            'order_id' => $order['id'],
            'status' => $order['status'],
            'approval_url' => $approvalUrl
        ]);
        break;
    
    // Capture PayPal order
    case preg_match('#^(/api)?/plans/paypal/capture$#', $uriPath) && $requestMethod === 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        $orderId = $input['order_id'] ?? null;
        
        if (!$orderId) {
            http_response_code(400);
            echo json_encode(['error' => 'Falta el order_id']);
            break;
        }
        
        // Get PayPal access token
        $config = getPayPalConfig();
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $config['url'] . '/v1/oauth2/token');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, 'grant_type=client_credentials');
        curl_setopt($ch, CURLOPT_USERPWD, $config['client_id'] . ':' . $config['secret']);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/x-www-form-urlencoded'
        ]);
        
        $tokenResponse = curl_exec($ch);
        curl_close($ch);
        
        $tokenData = json_decode($tokenResponse, true);
        $accessToken = $tokenData['access_token'];
        
        // Capture the order
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $config['url'] . '/v2/checkout/orders/' . $orderId . '/capture');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, '');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken
        ]);
        
        $captureResponse = curl_exec($ch);
        $captureHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($captureHttpCode !== 201 && $captureHttpCode !== 200) {
            http_response_code(500);
            echo json_encode([
                'error' => 'Error al capturar pago en PayPal',
                'details' => json_decode($captureResponse, true)
            ]);
            break;
        }
        
        $capture = json_decode($captureResponse, true);
        echo json_encode([
            'success' => true,
            'status' => $capture['status'],
            'order_id' => $orderId
        ]);
        break;
    
    // Cart checkout with MercadoPago
    case preg_match('#^(/api)?/cart/mercadopago$#', $uriPath) && $requestMethod === 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        $items = $input['items'] ?? [];
        
        if (empty($items)) {
            http_response_code(400);
            echo json_encode(['error' => 'El carrito esta vacio']);
            break;
        }
        
        // Create MercadoPago preference with multiple items
        $config = getMercadoPagoConfig();
        
        $mpItems = [];
        $totalAmount = 0;
        foreach ($items as $item) {
            $mpItems[] = [
                'id' => 'imporlan_' . $item['id'],
                'title' => $item['name'],
                'description' => $item['description'] ?? '',
                'quantity' => (int)($item['quantity'] ?? 1),
                'currency_id' => 'CLP',
                'unit_price' => (float)$item['price']
            ];
            $totalAmount += $item['price'] * ($item['quantity'] ?? 1);
        }
        
        $preferenceData = [
            'items' => $mpItems,
            'back_urls' => [
                'success' => 'https://www.imporlan.cl/panel/?payment=success&source=cart',
                'failure' => 'https://www.imporlan.cl/panel/?payment=failure&source=cart',
                'pending' => 'https://www.imporlan.cl/panel/?payment=pending&source=cart'
            ],
            'auto_return' => 'approved',
            'notification_url' => 'https://www.imporlan.cl/api/mercadopago.php?action=webhook',
            'statement_descriptor' => 'IMPORLAN',
            'external_reference' => 'cart_' . time()
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.mercadopago.com/checkout/preferences');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($preferenceData));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $config['access_token']
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 201 && $httpCode !== 200) {
            http_response_code(500);
            echo json_encode([
                'error' => 'Error al crear preferencia en MercadoPago',
                'details' => json_decode($response, true)
            ]);
            break;
        }
        
        $preference = json_decode($response, true);
        
        $checkoutUrl = PAYMENT_ENVIRONMENT === 'sandbox' 
            ? ($preference['sandbox_init_point'] ?? $preference['init_point'])
            : $preference['init_point'];
        
        echo json_encode([
            'success' => true,
            'preference_id' => $preference['id'],
            'init_point' => $checkoutUrl,
            'total' => $totalAmount
        ]);
        break;
    
    // Cart checkout with PayPal
    case preg_match('#^(/api)?/cart/paypal$#', $uriPath) && $requestMethod === 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        $items = $input['items'] ?? [];
        $totalUSD = $input['totalUSD'] ?? 0;
        
        if (empty($items)) {
            http_response_code(400);
            echo json_encode(['error' => 'El carrito esta vacio']);
            break;
        }
        
        // Calculate total if not provided
        if ($totalUSD <= 0) {
            foreach ($items as $item) {
                $totalUSD += ($item['priceUSD'] ?? 0) * ($item['quantity'] ?? 1);
            }
        }
        
        // Get PayPal access token
        $config = getPayPalConfig();
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $config['url'] . '/v1/oauth2/token');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, 'grant_type=client_credentials');
        curl_setopt($ch, CURLOPT_USERPWD, $config['client_id'] . ':' . $config['secret']);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/x-www-form-urlencoded'
        ]);
        
        $tokenResponse = curl_exec($ch);
        $tokenHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($tokenHttpCode !== 200) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al obtener token de PayPal']);
            break;
        }
        
        $tokenData = json_decode($tokenResponse, true);
        $accessToken = $tokenData['access_token'];
        
        // Build item descriptions
        $itemDescriptions = array_map(function($item) {
            return $item['name'] . ' x' . ($item['quantity'] ?? 1);
        }, $items);
        
        // Create PayPal order
        $orderData = [
            'intent' => 'CAPTURE',
            'purchase_units' => [
                [
                    'description' => 'Carrito Imporlan: ' . implode(', ', $itemDescriptions),
                    'custom_id' => 'cart_' . time(),
                    'amount' => [
                        'currency_code' => 'USD',
                        'value' => number_format($totalUSD, 2, '.', '')
                    ]
                ]
            ],
            'application_context' => [
                'brand_name' => 'Imporlan',
                'landing_page' => 'NO_PREFERENCE',
                'user_action' => 'PAY_NOW',
                'return_url' => 'https://www.imporlan.cl/panel/?payment=success&source=cart',
                'cancel_url' => 'https://www.imporlan.cl/panel/?payment=cancelled&source=cart'
            ]
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $config['url'] . '/v2/checkout/orders');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderData));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken
        ]);
        
        $orderResponse = curl_exec($ch);
        $orderHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($orderHttpCode !== 201) {
            http_response_code(500);
            echo json_encode([
                'error' => 'Error al crear orden en PayPal',
                'details' => json_decode($orderResponse, true)
            ]);
            break;
        }
        
        $order = json_decode($orderResponse, true);
        
        // Find approval URL
        $approvalUrl = '';
        foreach ($order['links'] as $link) {
            if ($link['rel'] === 'approve') {
                $approvalUrl = $link['href'];
                break;
            }
        }
        
        echo json_encode([
            'success' => true,
            'order_id' => $order['id'],
            'status' => $order['status'],
            'approval_url' => $approvalUrl,
            'total_usd' => $totalUSD
        ]);
        break;
    
    // Quote endpoint
    case ($uriPath === '/api/quote' || $uriPath === '/quote') && $requestMethod === 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        echo json_encode([
            'success' => true,
            'message' => 'Cotizacion recibida',
            'data' => $input
        ]);
        break;
    
    // Auth endpoints (placeholder - redirect to panel)
    case preg_match('#^(/api)?/auth/#', $uriPath):
        echo json_encode([
            'error' => 'Auth endpoints not implemented in this version',
            'message' => 'Please use the panel for authentication',
            'redirect' => 'https://www.imporlan.cl/panel/'
        ]);
        break;
    
    // Default - Not found
    default:
        http_response_code(404);
        echo json_encode(['detail' => 'Not Found', 'path' => $uriPath]);
        break;
}

