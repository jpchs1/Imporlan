<?php
/**
 * Fix existing MercadoPago purchases that are stuck in `status: pending`
 * even though the payment was approved by MercadoPago.
 *
 * BACKGROUND
 * ----------
 * api/mercadopago.php's handleWebhook() saves a purchase row ONLY when
 * MercadoPago has already confirmed payment.status === 'approved' (the
 * webhook handler does a server-side call to api.mercadopago.com to
 * verify, and only enters the save branch on 'approved'). Despite that,
 * the savePurchase() call hardcoded the local status to 'pending'.
 * Therefore every MP-paid row in purchases.json with status='pending'
 * IS actually paid -- the money is in MercadoPago, only the local label
 * is wrong.
 *
 * This script flips status='pending' -> 'paid' for every row where
 * payment_method === 'mercadopago' AND payment_id is non-empty.
 *
 * SAFETY
 * - Takes a timestamped backup of purchases.json before writing.
 * - Refuses to run if backup write fails.
 * - Idempotent: running twice is harmless (rows already 'paid' are skipped).
 * - Browser invocation gated by a key (same pattern as fix_webpay_purchases.php).
 *
 * USAGE
 *   php fix_mercadopago_purchases.php                          (CLI, dry-run)
 *   php fix_mercadopago_purchases.php --apply                  (CLI, apply)
 *   https://www.imporlan.cl/api/fix_mercadopago_purchases.php?key=MIGRATION_KEY_2026
 *     -> default browser invocation = APPLY
 *   Append &dry=1 to do a browser dry-run.
 */

header('Content-Type: application/json');

$IS_CLI = (php_sapi_name() === 'cli');
$EXPECTED_KEY = 'MIGRATION_KEY_2026';
$runKey = $_GET['key'] ?? '';

if (!$IS_CLI && $runKey !== $EXPECTED_KEY) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized. Provide ?key=<MIGRATION_KEY>']);
    exit;
}

// Determine dry-run vs apply
$DRY_RUN = false;
if ($IS_CLI) {
    $DRY_RUN = !in_array('--apply', $argv);
} else {
    $DRY_RUN = isset($_GET['dry']) && $_GET['dry'] === '1';
}

$purchasesFile = __DIR__ . '/purchases.json';

if (!file_exists($purchasesFile)) {
    echo json_encode(['error' => 'purchases.json not found at ' . $purchasesFile]);
    exit;
}

$raw = file_get_contents($purchasesFile);
$data = json_decode($raw, true);

if (!is_array($data) || !isset($data['purchases']) || !is_array($data['purchases'])) {
    echo json_encode(['error' => 'purchases.json is not in the expected {"purchases":[...]} shape']);
    exit;
}

$report = [
    'dry_run' => $DRY_RUN,
    'backup_file' => null,
    'total_rows' => count($data['purchases']),
    'mp_rows' => 0,
    'mp_pending' => 0,
    'mp_already_paid' => 0,
    'mp_missing_payment_id' => 0,
    'migrated_ids' => [],
    'skipped' => []
];

$nowIso = date('Y-m-d H:i:s');

foreach ($data['purchases'] as $i => $p) {
    $method = strtolower($p['payment_method'] ?? '');
    if ($method !== 'mercadopago') continue;
    $report['mp_rows']++;

    $status = strtolower($p['status'] ?? '');
    if ($status === 'paid') {
        $report['mp_already_paid']++;
        continue;
    }
    if ($status !== 'pending') {
        $report['skipped'][] = ['id' => $p['id'] ?? null, 'reason' => 'status=' . $status];
        continue;
    }
    // Defensive: only migrate rows where we have a payment_id, which means
    // the webhook actually saved the row after MP confirmed 'approved'.
    // A row without payment_id may have come from elsewhere -> skip.
    if (empty($p['payment_id'])) {
        $report['mp_missing_payment_id']++;
        $report['skipped'][] = ['id' => $p['id'] ?? null, 'reason' => 'no payment_id'];
        continue;
    }

    $report['mp_pending']++;
    $report['migrated_ids'][] = [
        'id'         => $p['id'] ?? null,
        'user_email' => $p['user_email'] ?? null,
        'amount_clp' => $p['amount_clp'] ?? $p['amount'] ?? null,
        'description'=> $p['description'] ?? null,
        'payment_id' => $p['payment_id'] ?? null,
        'date'       => $p['date'] ?? null
    ];

    if (!$DRY_RUN) {
        $data['purchases'][$i]['status'] = 'paid';
        $data['purchases'][$i]['status_fixed_by_migration'] = [
            'at' => $nowIso,
            'from' => 'pending',
            'script' => 'fix_mercadopago_purchases.php'
        ];
    }
}

if (!$DRY_RUN && $report['mp_pending'] > 0) {
    // Backup before writing
    $backup = __DIR__ . '/purchases_backup_mp_fix_' . date('Y-m-d_H-i-s') . '.json';
    if (file_put_contents($backup, $raw) === false) {
        echo json_encode(['error' => 'Failed to write backup file. Aborting without changing purchases.json.', 'attempted_backup' => $backup]);
        exit;
    }
    $report['backup_file'] = $backup;
    file_put_contents($purchasesFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

echo json_encode($report, JSON_PRETTY_PRINT);
