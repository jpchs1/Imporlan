<?php
/**
 * Script to fix existing WebPay purchases in purchases.json
 * This script migrates WebPay transactions from the incorrect format to the correct format
 * 
 * Run this script ONCE to fix the data, then delete it
 * 
 * Usage: php fix_webpay_purchases.php
 * Or via browser: https://www.imporlan.cl/api/fix_webpay_purchases.php?run=true&key=MIGRATION_KEY_2026
 */

header('Content-Type: application/json');

// Security check - require a key to run via browser
$runKey = $_GET['key'] ?? '';
$expectedKey = 'MIGRATION_KEY_2026';

if (php_sapi_name() !== 'cli' && $runKey !== $expectedKey) {
    echo json_encode(['error' => 'Unauthorized. Provide correct key parameter.']);
    exit();
}

$purchasesFile = __DIR__ . '/purchases.json';

if (!file_exists($purchasesFile)) {
    echo json_encode(['error' => 'purchases.json not found']);
    exit();
}

// Read current data
$rawData = file_get_contents($purchasesFile);
$data = json_decode($rawData, true);

// Backup original file
$backupFile = __DIR__ . '/purchases_backup_' . date('Y-m-d_H-i-s') . '.json';
file_put_contents($backupFile, $rawData);

// Extract existing purchases array
$purchases = $data['purchases'] ?? [];

// Extract WebPay transactions that were saved incorrectly (as numeric keys)
$webpayTransactions = [];
foreach ($data as $key => $value) {
    if (is_numeric($key) && isset($value['method']) && $value['method'] === 'webpay') {
        $webpayTransactions[$key] = $value;
    }
}

// Mapping of WebPay transactions to user emails
// Based on the data we have:
// - webpay_697abfe043e1a: $67,600 - Jan 28 21:03 - info@clasesdeski.cl (user's test purchase - Plan Fragata)
// - webpay_697a3ed52762d: $67,600 - Jan 28 11:52 - Unknown (possibly Alberto Lathrop - Plan Fragata)
// - webpay_6976b94a7bfd2: $9,900 - Jan 26 - Unknown (Cotizacion)
// - webpay_697397a2c3807: $29,700 - Jan 23 - Unknown
// - webpay_69717d4c08845: $19,800 - Jan 22 - Unknown

$emailMapping = [
    'ORD_1769651995624' => 'info@clasesdeski.cl',  // User's Plan Fragata purchase (Jan 28 21:03)
    // Add more mappings as needed when user provides info
];

$migratedCount = 0;
$errors = [];

foreach ($webpayTransactions as $key => $transaction) {
    $buyOrder = $transaction['buy_order'] ?? null;
    $amount = $transaction['amount'] ?? 0;
    
    // Check if already migrated (exists in purchases array)
    $alreadyExists = false;
    foreach ($purchases as $existing) {
        if (isset($existing['order_id']) && $existing['order_id'] === $buyOrder) {
            $alreadyExists = true;
            break;
        }
    }
    
    if ($alreadyExists) {
        continue;
    }
    
    // Get email from mapping or leave empty for manual assignment
    $userEmail = $emailMapping[$buyOrder] ?? '';
    
    // Determine purchase type based on amount
    $purchaseType = 'link';
    $planName = '';
    $planDays = 7;
    $description = 'Cotizacion Online - WebPay';
    
    if ($amount >= 60000) {
        $purchaseType = 'plan';
        $planName = 'Plan Fragata';
        $planDays = 7;
        $description = 'Plan Fragata - WebPay';
    } else if ($amount >= 25000) {
        $purchaseType = 'plan';
        $planName = 'Plan Capitan';
        $planDays = 14;
        $description = 'Plan Capitan - WebPay';
    }
    
    // Create properly formatted purchase
    $purchase = [
        'id' => $transaction['id'] ?? ('pur_' . uniqid()),
        'user_email' => $userEmail,
        'type' => $purchaseType,
        'description' => $description,
        'plan_name' => $planName,
        'url' => '',
        'amount' => floatval($amount),
        'amount_clp' => intval($amount),
        'currency' => 'CLP',
        'payment_method' => 'webpay',
        'payment_id' => $transaction['authorization_code'] ?? null,
        'order_id' => $buyOrder,
        'status' => 'pending',
        'days' => intval($planDays),
        'proposals_total' => 5,
        'proposals_received' => 0,
        'date' => date('d M Y', strtotime($transaction['created_at'] ?? 'now')),
        'timestamp' => date('Y-m-d H:i:s', strtotime($transaction['created_at'] ?? 'now')),
        'webpay_details' => [
            'authorization_code' => $transaction['authorization_code'] ?? null,
            'payment_type' => $transaction['payment_type'] ?? null,
            'card_number' => $transaction['card_number'] ?? null,
            'transaction_date' => $transaction['transaction_date'] ?? null,
            'original_id' => $transaction['id'] ?? null
        ],
        'needs_email_assignment' => empty($userEmail)
    ];
    
    if ($purchase['type'] === 'plan') {
        $startDate = strtotime($transaction['created_at'] ?? 'now');
        $purchase['end_date'] = date('d M Y', strtotime('+' . $purchase['days'] . ' days', $startDate));
    }
    
    $purchases[] = $purchase;
    $migratedCount++;
}

// Create clean data structure with only the purchases array
$cleanData = ['purchases' => $purchases];

// Save the fixed data
file_put_contents($purchasesFile, json_encode($cleanData, JSON_PRETTY_PRINT));

// Generate report
$report = [
    'success' => true,
    'message' => 'WebPay purchases migration completed',
    'backup_file' => $backupFile,
    'webpay_transactions_found' => count($webpayTransactions),
    'migrated_count' => $migratedCount,
    'total_purchases_now' => count($purchases),
    'purchases_needing_email' => array_filter($purchases, function($p) {
        return !empty($p['needs_email_assignment']);
    })
];

echo json_encode($report, JSON_PRETTY_PRINT);
?>
