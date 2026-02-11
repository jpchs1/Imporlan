<?php
/**
 * Migration: Normalize links for Sebastian Vigueras's expediente
 * 
 * Order ID: 7 (IMP-00007)
 * Customer: Sebastian Vigueras (drsvigueras@gmail.com)
 * 
 * Changes applied (2026-02-10):
 * 1. Updated customer_name from "Dr. Vigueras" to "Sebastian Vigueras"
 * 2. Updated requirement_name to "Búsqueda embarcación – Cobalt (BoatTrader)"
 * 3. Updated asset_name to "Cobalt R4/R5"
 * 4. Updated status to "in_progress"
 * 5. Deleted 4 old links (IDs 59-62):
 *    - https://www.boats.com/boats/2025-yamaha-252se-8345612/
 *    - https://www.boattrader.com/boat/2024-chaparral-23-ssi-7891234/
 *    - https://www.boats.com/boats/2024-boston-whaler-230-vantage-7654321/
 *    - https://www.boattrader.com/boat/2023-sea-ray-250-slx-6543210/
 * 6. Inserted 4 required BoatTrader links (IDs 63-66):
 *    - https://www.boattrader.com/boat/2024-cobalt-r4-10071931/
 *    - https://www.boattrader.com/boat/2024-cobalt-r4-9760941/
 *    - https://www.boattrader.com/boat/2021-cobalt-r5-10010524/
 *    - https://www.boattrader.com/boat/2021-cobalt-r5-9930489/
 * 
 * This script can be re-run safely (idempotent).
 * It will verify the current state and only make changes if needed.
 */

require_once __DIR__ . '/../db_config.php';

header('Content-Type: application/json');

$REQUIRED_LINKS = [
    'https://www.boattrader.com/boat/2024-cobalt-r4-10071931/',
    'https://www.boattrader.com/boat/2024-cobalt-r4-9760941/',
    'https://www.boattrader.com/boat/2021-cobalt-r5-10010524/',
    'https://www.boattrader.com/boat/2021-cobalt-r5-9930489/',
];

$LINK_TITLES = [
    '2024 Cobalt R4',
    '2024 Cobalt R4',
    '2021 Cobalt R5',
    '2021 Cobalt R5',
];

$ORDER_ID = 7;
$CUSTOMER_NAME = 'Sebastian Vigueras';
$REQUIREMENT_NAME = 'Búsqueda embarcación – Cobalt (BoatTrader)';
$ASSET_NAME = 'Cobalt R4/R5';

try {
    $pdo = getDbConnection();
    if (!$pdo) {
        throw new Exception('Database connection failed');
    }

    $pdo->beginTransaction();
    $log = [];

    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->execute([$ORDER_ID]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        throw new Exception("Order $ORDER_ID not found");
    }

    $log[] = "Found order: {$order['order_number']} - {$order['customer_name']}";

    if ($order['customer_name'] !== $CUSTOMER_NAME ||
        $order['requirement_name'] !== $REQUIREMENT_NAME ||
        $order['asset_name'] !== $ASSET_NAME) {

        $stmt = $pdo->prepare("UPDATE orders SET customer_name = ?, requirement_name = ?, asset_name = ?, status = 'in_progress' WHERE id = ?");
        $stmt->execute([$CUSTOMER_NAME, $REQUIREMENT_NAME, $ASSET_NAME, $ORDER_ID]);
        $log[] = "Updated order header";
    } else {
        $log[] = "Order header already correct";
    }

    $linkStmt = $pdo->prepare("SELECT * FROM order_links WHERE order_id = ? ORDER BY row_index ASC");
    $linkStmt->execute([$ORDER_ID]);
    $currentLinks = $linkStmt->fetchAll(PDO::FETCH_ASSOC);
    $currentUrls = array_column($currentLinks, 'url');

    $log[] = "Current links: " . count($currentLinks);

    if ($currentUrls == $REQUIRED_LINKS && count($currentLinks) === 4) {
        $log[] = "Links already normalized - no changes needed";
    } else {
        $deleteStmt = $pdo->prepare("DELETE FROM order_links WHERE order_id = ?");
        $deleteStmt->execute([$ORDER_ID]);
        $log[] = "Deleted " . count($currentLinks) . " existing links";

        foreach ($REQUIRED_LINKS as $i => $url) {
            $insertStmt = $pdo->prepare("
                INSERT INTO order_links (order_id, row_index, url, title, comments)
                VALUES (?, ?, ?, ?, 'BoatTrader - Pendiente de análisis')
            ");
            $insertStmt->execute([$ORDER_ID, $i + 1, $url, $LINK_TITLES[$i]]);
            $log[] = "Inserted link " . ($i + 1) . ": $url";
        }
    }

    $verifyStmt = $pdo->prepare("SELECT url FROM order_links WHERE order_id = ? ORDER BY row_index ASC");
    $verifyStmt->execute([$ORDER_ID]);
    $finalLinks = $verifyStmt->fetchAll(PDO::FETCH_COLUMN);

    if ($finalLinks != $REQUIRED_LINKS || count($finalLinks) !== 4) {
        throw new Exception("Verification failed: links don't match expected state");
    }

    $log[] = "Verification passed: exactly 4 BoatTrader links present";

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'order_id' => $ORDER_ID,
        'customer_name' => $CUSTOMER_NAME,
        'links_count' => count($finalLinks),
        'log' => $log
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
