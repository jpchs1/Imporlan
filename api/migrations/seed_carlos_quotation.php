<?php
/**
 * Migration: Seed Carlos's quotation with 4 BoatTrader links
 * 
 * Carlos (carlosdavid@hotmail.com) requested a quotation for 4 boats
 * and paid 19,800 CLP via Transferencia Bancaria.
 * 
 * Usage: GET /api/migrations/seed_carlos_quotation.php?action=seed&key=imporlan2026
 * Check: GET /api/migrations/seed_carlos_quotation.php?action=check&key=imporlan2026
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$action = $_GET['action'] ?? '';
$key = $_GET['key'] ?? '';

if ($key !== 'imporlan2026') {
    http_response_code(403);
    echo json_encode(['error' => 'Clave invalida']);
    exit();
}

if ($action === 'seed') {
    seedCarlosQuotation();
} elseif ($action === 'check') {
    checkCarlosData();
} else {
    echo json_encode(['error' => 'Use ?action=seed or ?action=check']);
}

function seedCarlosQuotation() {
    $purchasesFile = __DIR__ . '/../purchases.json';
    $quotationFile = __DIR__ . '/../quotation_requests.json';

    // Carlos's boat links
    $boatLinks = [
        [
            'url' => 'https://www.boattrader.com/boat/2009-crownline-ls-210-9979916/',
            'title' => '2009 Crownline LS 210'
        ],
        [
            'url' => 'https://www.boattrader.com/boat/2019-sea-doo-gti-9565875/',
            'title' => '2019 Sea-Doo GTI'
        ],
        [
            'url' => 'https://www.boattrader.com/boat/2013-sea-doo-gti-9951836/',
            'title' => '2013 Sea-Doo GTI'
        ],
        [
            'url' => 'https://www.boattrader.com/boat/2013-sea-doo-gti-9953824/',
            'title' => '2013 Sea-Doo GTI'
        ]
    ];

    // ── 1. Add quotation request ──
    $qrData = ['requests' => []];
    if (file_exists($quotationFile)) {
        $qrData = json_decode(file_get_contents($quotationFile), true) ?: ['requests' => []];
    }

    // Check if Carlos's quotation already exists
    $exists = false;
    foreach (($qrData['requests'] ?? []) as $req) {
        if (strtolower($req['email'] ?? '') === 'carlosdavid@hotmail.com') {
            $exists = true;
            break;
        }
    }

    $quotationId = 'qr_carlos_' . date('Ymd');

    if (!$exists) {
        $linkUrls = array_map(function($l) { return $l['url']; }, $boatLinks);
        $qrData['requests'][] = [
            'id' => $quotationId,
            'name' => 'Carlos David',
            'email' => 'carlosdavid@hotmail.com',
            'phone' => '',
            'boat_links' => $linkUrls,
            'links_text' => implode("\n", $linkUrls),
            'num_links' => 4,
            'date' => date('Y-m-d H:i:s'),
            'status' => 'paid',
            'payment_status' => 'paid',
            'amount_clp' => 19800,
            'payment_method' => 'transferencia_bancaria'
        ];
        file_put_contents($quotationFile, json_encode($qrData, JSON_PRETTY_PRINT));
    }

    // ── 2. Add purchase record ──
    $pData = ['purchases' => []];
    if (file_exists($purchasesFile)) {
        $pData = json_decode(file_get_contents($purchasesFile), true) ?: ['purchases' => []];
    }

    // Check if Carlos's purchase already exists
    $purchaseExists = false;
    foreach (($pData['purchases'] ?? []) as $p) {
        if (strtolower($p['user_email'] ?? '') === 'carlosdavid@hotmail.com' 
            && ($p['payment_method'] ?? '') === 'transferencia_bancaria') {
            $purchaseExists = true;
            break;
        }
    }

    $purchaseId = 'pur_carlos_transfer_' . date('Ymd');

    if (!$purchaseExists) {
        $linksDescription = implode(' | ', array_map(function($l) { 
            return $l['title'] . ': ' . $l['url']; 
        }, $boatLinks));

        $pData['purchases'][] = [
            'id' => $purchaseId,
            'user_email' => 'carlosdavid@hotmail.com',
            'type' => 'cotizacion',
            'description' => 'Cotizacion por Links - ' . $linksDescription,
            'plan_name' => 'Cotizacion por Links',
            'url' => $boatLinks[0]['url'],
            'amount' => 19800,
            'amount_clp' => 19800,
            'currency' => 'CLP',
            'payment_method' => 'transferencia_bancaria',
            'payment_id' => null,
            'order_id' => null,
            'status' => 'active',
            'days' => 30,
            'proposals_total' => 4,
            'proposals_received' => 0,
            'date' => date('d M Y'),
            'timestamp' => date('Y-m-d H:i:s'),
            'links' => $boatLinks
        ];
        file_put_contents($purchasesFile, json_encode($pData, JSON_PRETTY_PRINT));
    }

    // ── 3. Create order in database (if DB is available) ──
    $orderId = null;
    try {
        $dbConfig = __DIR__ . '/../db_config.php';
        if (file_exists($dbConfig)) {
            require_once $dbConfig;
            require_once __DIR__ . '/../orders_api.php';

            if (function_exists('createOrderFromQuotation')) {
                $purchaseData = [
                    'id' => $purchaseId,
                    'user_email' => 'carlosdavid@hotmail.com',
                    'customer_name' => 'Carlos David',
                    'customer_email' => 'carlosdavid@hotmail.com',
                    'plan_name' => 'Cotizacion por Links',
                    'description' => 'Cotizacion 4 links BoatTrader - Transferencia Bancaria $19.800 CLP'
                ];
                $orderId = createOrderFromQuotation($purchaseData, $boatLinks);
            }
        }
    } catch (Exception $e) {
        error_log("seed_carlos: order creation error: " . $e->getMessage());
    }

    echo json_encode([
        'success' => true,
        'message' => 'Datos de Carlos creados exitosamente',
        'quotation_id' => $quotationId,
        'purchase_id' => $purchaseId,
        'order_id' => $orderId,
        'quotation_existed' => $exists,
        'purchase_existed' => $purchaseExists,
        'boat_links' => count($boatLinks),
        'amount_clp' => 19800,
        'payment_method' => 'transferencia_bancaria'
    ]);
}

function checkCarlosData() {
    $purchasesFile = __DIR__ . '/../purchases.json';
    $quotationFile = __DIR__ . '/../quotation_requests.json';

    $result = [
        'quotation_request' => null,
        'purchase' => null,
        'order' => null
    ];

    // Check quotation requests
    if (file_exists($quotationFile)) {
        $qrData = json_decode(file_get_contents($quotationFile), true);
        foreach (($qrData['requests'] ?? []) as $req) {
            if (strtolower($req['email'] ?? '') === 'carlosdavid@hotmail.com') {
                $result['quotation_request'] = $req;
                break;
            }
        }
    }

    // Check purchases
    if (file_exists($purchasesFile)) {
        $pData = json_decode(file_get_contents($purchasesFile), true);
        foreach (($pData['purchases'] ?? []) as $p) {
            if (strtolower($p['user_email'] ?? '') === 'carlosdavid@hotmail.com') {
                $result['purchase'] = $p;
                break;
            }
        }
    }

    // Check orders in database
    try {
        $dbConfig = __DIR__ . '/../db_config.php';
        if (file_exists($dbConfig)) {
            require_once $dbConfig;
            $pdo = getDbConnection();
            if ($pdo) {
                $stmt = $pdo->prepare("SELECT * FROM orders WHERE customer_email = ? ORDER BY id DESC LIMIT 1");
                $stmt->execute(['carlosdavid@hotmail.com']);
                $order = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($order) {
                    $result['order'] = $order;
                }
            }
        }
    } catch (Exception $e) {
        $result['order_error'] = $e->getMessage();
    }

    echo json_encode([
        'success' => true,
        'data' => $result
    ]);
}
