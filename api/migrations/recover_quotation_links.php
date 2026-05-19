<?php
/**
 * Recover Quotation Links - Manual fix for orders that lost their boat_links
 *
 * When a Cotizacion por Links payment goes through but boat_links arrives
 * empty (frontend bug where extractBoatLinksFromPage() returns []),
 * the order is created with 10 empty rows in `order_links` and the
 * purchases.json entry has no `boat_links` field.
 *
 * This script takes a purchase_id + an array of URLs (provided by the
 * customer manually, e.g. via WhatsApp) and:
 *   1. Updates the corresponding rows in `order_links` with the URLs
 *   2. Patches purchases.json to add the boat_links field
 *   3. Logs an order_event for audit
 *
 * Usage (CLI only):
 *   php recover_quotation_links.php <purchase_id> '<json_array_of_urls>'
 *
 * Example:
 *   php recover_quotation_links.php pur_6a0ba0f4bd058 \
 *     '["https://www.boattrader.com/boat/abc","https://www.boats.com/xyz"]'
 *
 * Safety:
 *   - Refuses to run if the order already has non-empty URLs in the target
 *     row_indexes (prevents accidental overwrite).
 *   - Only the first N row_indexes (where N = number of URLs provided) are
 *     touched. Remaining empty slots stay empty.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("This script must be run from the CLI only.\n");
}

if ($argc < 3) {
    fwrite(STDERR, "Usage: php recover_quotation_links.php <purchase_id> '<json_array_of_urls>'\n");
    fwrite(STDERR, "Example: php recover_quotation_links.php pur_6a0ba0f4bd058 '[\"https://link1\",\"https://link2\"]'\n");
    exit(1);
}

$purchaseId = $argv[1];
$linksJson  = $argv[2];

$links = json_decode($linksJson, true);
if (!is_array($links) || empty($links)) {
    fwrite(STDERR, "ERROR: second argument must be a non-empty JSON array of URLs.\n");
    exit(1);
}

foreach ($links as $i => $url) {
    if (!is_string($url) || trim($url) === '') {
        fwrite(STDERR, "ERROR: link #" . ($i + 1) . " is empty or not a string.\n");
        exit(1);
    }
}

require_once __DIR__ . '/../db_config.php';
require_once __DIR__ . '/../orders_api.php';

$pdo = getDbConnection();
if (!$pdo) {
    fwrite(STDERR, "ERROR: cannot connect to the database.\n");
    exit(1);
}

$stmt = $pdo->prepare("SELECT id, order_number, customer_email, status FROM orders WHERE purchase_id = ? LIMIT 1");
$stmt->execute([$purchaseId]);
$order = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$order) {
    fwrite(STDERR, "ERROR: no order found with purchase_id={$purchaseId}.\n");
    exit(1);
}

$orderId = intval($order['id']);
echo "Order found: #{$order['order_number']} (id={$orderId}, customer={$order['customer_email']}, status={$order['status']})\n";

$existingStmt = $pdo->prepare("SELECT row_index, url FROM order_links WHERE order_id = ? AND row_index <= ? ORDER BY row_index ASC");
$existingStmt->execute([$orderId, count($links)]);
$existing = $existingStmt->fetchAll(PDO::FETCH_ASSOC);

$conflicts = [];
foreach ($existing as $row) {
    if (!empty(trim((string)$row['url']))) {
        $conflicts[] = "row_index={$row['row_index']} already has url={$row['url']}";
    }
}
if (!empty($conflicts)) {
    fwrite(STDERR, "ERROR: refusing to overwrite existing URLs:\n  - " . implode("\n  - ", $conflicts) . "\n");
    fwrite(STDERR, "If you really want to overwrite, clear the rows manually first.\n");
    exit(1);
}

$pdo->beginTransaction();
try {
    $updateStmt = $pdo->prepare("UPDATE order_links SET url = ? WHERE order_id = ? AND row_index = ?");
    foreach ($links as $i => $url) {
        $rowIndex = $i + 1;
        $updateStmt->execute([trim($url), $orderId, $rowIndex]);
        echo "  - row_index={$rowIndex}: " . trim($url) . "\n";
    }

    logOrderEvent($pdo, $orderId, 'links_recovered_manually', [
        'links_count' => count($links),
        'purchase_id' => $purchaseId,
        'source' => 'recover_quotation_links.php',
        'recovered_at' => date('Y-m-d H:i:s')
    ]);

    $pdo->commit();
    echo "DB updated successfully.\n";
} catch (Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, "ERROR updating DB: " . $e->getMessage() . "\n");
    exit(1);
}

$purchasesFile = __DIR__ . '/../purchases.json';
if (file_exists($purchasesFile)) {
    $raw = file_get_contents($purchasesFile);
    $data = json_decode($raw, true);
    if (is_array($data) && isset($data['purchases']) && is_array($data['purchases'])) {
        $patched = false;
        foreach ($data['purchases'] as &$p) {
            if (($p['id'] ?? null) === $purchaseId) {
                $p['boat_links'] = array_map('trim', $links);
                $p['boat_links_recovered_at'] = date('Y-m-d H:i:s');
                $patched = true;
                break;
            }
        }
        unset($p);
        if ($patched) {
            $backupFile = $purchasesFile . '.bak-' . date('Ymd-His');
            copy($purchasesFile, $backupFile);
            file_put_contents($purchasesFile, json_encode($data, JSON_PRETTY_PRINT));
            echo "purchases.json patched (backup at " . basename($backupFile) . ").\n";
        } else {
            echo "WARNING: purchase id={$purchaseId} not found in purchases.json (skipped).\n";
        }
    }
}

echo "Done. Order #{$order['order_number']} now has " . count($links) . " links restored.\n";
