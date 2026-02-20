<?php
require_once __DIR__ . '/../db_config.php';

$pdo = getDbConnection();
if (!$pdo) {
    echo json_encode(['error' => 'Database connection failed']);
    exit(1);
}

try {
    $arrived = $pdo->query("
        SELECT v.id FROM vessels v
        WHERE v.type='auto' AND v.status='active'
        AND v.destination_label LIKE '%Chile%'
        AND EXISTS (
            SELECT 1 FROM vessel_positions vp
            WHERE vp.vessel_id = v.id
            AND vp.lat < -30
            ORDER BY vp.fetched_at DESC LIMIT 1
        )
    ")->fetchAll(PDO::FETCH_COLUMN);

    $rotatedCount = 0;
    foreach ($arrived as $vid) {
        $pdo->prepare("UPDATE vessels SET status='arrived', is_featured=0 WHERE id=?")->execute([$vid]);
        $rotatedCount++;

        $orders = $pdo->prepare("SELECT id, order_number, customer_email FROM orders WHERE vessel_id = ?");
        $orders->execute([$vid]);
        $affectedOrders = $orders->fetchAll(PDO::FETCH_ASSOC);

        if (count($affectedOrders) > 0) {
            try {
                require_once __DIR__ . '/../email_service.php';
                $emailService = getEmailService();
                $vesselStmt = $pdo->prepare("SELECT display_name FROM vessels WHERE id = ?");
                $vesselStmt->execute([$vid]);
                $vesselName = $vesselStmt->fetchColumn();

                foreach ($affectedOrders as $order) {
                    if (!empty($order['customer_email'])) {
                        $emailService->sendVesselArrived(
                            $order['customer_email'],
                            $order['order_number'],
                            $vesselName
                        );
                    }
                    $pdo->prepare("INSERT INTO order_events (order_id, event_type, meta_json) VALUES (?, 'VESSEL_ARRIVED', ?)")
                        ->execute([$order['id'], json_encode(['vessel_id' => $vid, 'vessel_name' => $vesselName])]);
                }
            } catch (Exception $e) {
                error_log("[CronRotate] Email error for vessel $vid: " . $e->getMessage());
            }
        }
    }

    if ($rotatedCount > 0) {
        $pdo->exec("
            UPDATE vessels SET status='active', is_featured=1
            WHERE type='auto' AND status='scheduled'
            ORDER BY created_at ASC
            LIMIT $rotatedCount
        ");
    }

    $activeCount = $pdo->query("SELECT COUNT(*) FROM vessels WHERE is_featured=1 AND status='active'")->fetchColumn();
    if ($activeCount < 3) {
        $needed = 3 - $activeCount;
        $pdo->exec("
            UPDATE vessels SET is_featured=1, status='active'
            WHERE type='auto' AND status='scheduled' AND is_featured=0
            ORDER BY created_at ASC
            LIMIT $needed
        ");
    }

    $navigatingCount = $pdo->query("
        SELECT COUNT(DISTINCT v.id) FROM vessels v
        INNER JOIN vessel_positions vp ON vp.vessel_id = v.id
        WHERE v.is_featured=1 AND v.status='active'
        AND vp.speed > 0
        AND vp.fetched_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ")->fetchColumn();

    $result = [
        'success' => true,
        'rotated' => $rotatedCount,
        'active_featured' => intval($activeCount),
        'navigating' => intval($navigatingCount),
        'timestamp' => date('Y-m-d H:i:s')
    ];

    echo json_encode($result);
    error_log("[CronRotate] " . json_encode($result));

} catch (PDOException $e) {
    error_log("[CronRotate] Error: " . $e->getMessage());
    echo json_encode(['error' => $e->getMessage()]);
    exit(1);
}
