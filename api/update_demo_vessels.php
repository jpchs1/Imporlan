<?php
/**
 * Update vessels with realistic USA → Chile shipping routes
 * Run once via browser: /api/update_demo_vessels.php?key=imporlan2026
 */

if (($_GET['key'] ?? '') !== 'imporlan2026') {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

require_once __DIR__ . '/db_config.php';

header('Content-Type: application/json');

$pdo = getDbConnection();
if (!$pdo) {
    echo json_encode(['error' => 'DB connection failed']);
    exit;
}

// 4 realistic cargo/transport vessels with USA → Chile routes
$vessels = [
    [
        'display_name' => 'MSC Pamela',
        'imo' => '9777589',
        'mmsi' => '218833000',
        'call_sign' => 'V2RZ2',
        'shipping_line' => 'MSC - Mediterranean Shipping',
        'client_name' => 'Juan Pablo Contreras',
        'origin_label' => 'Miami, FL, USA',
        'destination_label' => 'San Antonio, Chile',
        'eta_manual' => '2026-04-25 14:00:00',
        'status' => 'active',
        'is_featured' => 1,
        // Position: Caribbean Sea, heading south (near Panama)
        'lat' => 9.3521,
        'lon' => -79.8742,
        'speed' => 14.5,
        'course' => 195.0,
        // Route positions (Miami → Caribbean → Panama Canal → Pacific → Chile)
        'positions' => [
            ['lat' => 25.7617, 'lon' => -80.1918],   // Miami
            ['lat' => 23.1136, 'lon' => -82.3666],   // Cuba strait
            ['lat' => 18.4655, 'lon' => -77.8936],   // Jamaica
            ['lat' => 14.6349, 'lon' => -78.9618],   // Caribbean
            ['lat' => 9.3521,  'lon' => -79.8742],   // Panama (current)
        ]
    ],
    [
        'display_name' => 'Maersk Seletar',
        'imo' => '9724614',
        'mmsi' => '220491000',
        'call_sign' => 'OYGF2',
        'shipping_line' => 'Maersk Line',
        'client_name' => 'Carlos Rodriguez',
        'origin_label' => 'Houston, TX, USA',
        'destination_label' => 'Valparaiso, Chile',
        'eta_manual' => '2026-04-20 08:00:00',
        'status' => 'active',
        'is_featured' => 1,
        // Position: Pacific coast of Central America
        'lat' => 2.2137,
        'lon' => -82.3511,
        'speed' => 16.2,
        'course' => 210.0,
        'positions' => [
            ['lat' => 29.7604, 'lon' => -95.3698],   // Houston
            ['lat' => 25.0343, 'lon' => -90.4582],   // Gulf of Mexico
            ['lat' => 18.2208, 'lon' => -88.7317],   // Yucatan
            ['lat' => 9.1200,  'lon' => -79.6800],   // Panama Canal
            ['lat' => 2.2137,  'lon' => -82.3511],   // Pacific (current)
        ]
    ],
    [
        'display_name' => 'CMA CGM Thalassa',
        'imo' => '9399210',
        'mmsi' => '228329700',
        'call_sign' => 'FMDR',
        'shipping_line' => 'CMA CGM',
        'client_name' => 'Maria Lagos',
        'origin_label' => 'Fort Lauderdale, FL, USA',
        'destination_label' => 'San Antonio, Chile',
        'eta_manual' => '2026-04-18 10:00:00',
        'status' => 'active',
        'is_featured' => 1,
        // Position: Pacific coast of Peru, almost arriving
        'lat' => -15.4232,
        'lon' => -78.5618,
        'speed' => 15.8,
        'course' => 195.0,
        'positions' => [
            ['lat' => 26.1224, 'lon' => -80.1373],   // Fort Lauderdale
            ['lat' => 18.0000, 'lon' => -80.0000],   // Caribbean
            ['lat' => 9.0000,  'lon' => -79.5000],   // Panama
            ['lat' => -3.4500, 'lon' => -80.9000],   // Ecuador coast
            ['lat' => -15.4232,'lon' => -78.5618],   // Peru coast (current)
        ]
    ],
    [
        'display_name' => 'Hapag-Lloyd Express',
        'imo' => '9501370',
        'mmsi' => '211331120',
        'call_sign' => 'DAXL',
        'shipping_line' => 'Hapag-Lloyd',
        'client_name' => 'Pedro Silva',
        'origin_label' => 'Jacksonville, FL, USA',
        'destination_label' => 'Valparaiso, Chile',
        'eta_manual' => '2026-04-15 16:00:00',
        'status' => 'active',
        'is_featured' => 1,
        // Position: Off Chilean coast, almost arrived
        'lat' => -30.6210,
        'lon' => -72.1285,
        'speed' => 12.3,
        'course' => 185.0,
        'positions' => [
            ['lat' => 30.3322, 'lon' => -81.6557],   // Jacksonville
            ['lat' => 20.0000, 'lon' => -82.0000],   // Caribbean
            ['lat' => 9.0500,  'lon' => -79.5200],   // Panama
            ['lat' => -12.0000,'lon' => -79.0000],   // Peru
            ['lat' => -23.6345,'lon' => -74.3928],   // Northern Chile
            ['lat' => -30.6210,'lon' => -72.1285],   // Near Valparaiso (current)
        ]
    ],
];

$results = [];

try {
    // Clear existing vessels and positions
    $pdo->exec("DELETE FROM vessel_positions");
    $pdo->exec("DELETE FROM vessels");

    foreach ($vessels as $v) {
        // Insert vessel
        $stmt = $pdo->prepare("
            INSERT INTO vessels (display_name, imo, mmsi, call_sign, shipping_line, client_name,
                               origin_label, destination_label, eta_manual, status, is_featured, type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
        ");
        $stmt->execute([
            $v['display_name'], $v['imo'], $v['mmsi'], $v['call_sign'],
            $v['shipping_line'], $v['client_name'], $v['origin_label'],
            $v['destination_label'], $v['eta_manual'], $v['status'], $v['is_featured']
        ]);
        $vesselId = $pdo->lastInsertId();

        // Insert position history
        $posCount = count($v['positions']);
        foreach ($v['positions'] as $i => $pos) {
            $isLast = ($i === $posCount - 1);
            $speed = $isLast ? $v['speed'] : (12 + rand(0, 8));
            $course = $isLast ? $v['course'] : (180 + rand(-30, 30));
            $daysAgo = ($posCount - 1 - $i) * 2;
            $fetchedAt = date('Y-m-d H:i:s', strtotime("-{$daysAgo} days"));

            $stmt = $pdo->prepare("
                INSERT INTO vessel_positions (vessel_id, lat, lon, speed, course, destination, eta, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)
            ");
            $stmt->execute([
                $vesselId, $pos['lat'], $pos['lon'], $speed, $course,
                $v['destination_label'], $v['eta_manual'], $fetchedAt
            ]);
        }

        $results[] = [
            'vessel' => $v['display_name'],
            'id' => $vesselId,
            'positions' => $posCount,
            'route' => $v['origin_label'] . ' → ' . $v['destination_label']
        ];
    }

    echo json_encode([
        'success' => true,
        'message' => '4 vessels created with realistic routes',
        'vessels' => $results
    ], JSON_PRETTY_PRINT);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
