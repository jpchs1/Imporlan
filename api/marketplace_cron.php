<?php
/**
 * Marketplace Cron Job - Imporlan
 * 
 * Daily tasks:
 *   1. Send expiration reminder emails (D-7 to D-1)
 *   2. Auto-expire listings past their expires_at date
 * 
 * Run via cPanel cron (once daily, e.g. 08:00 Chile time):
 *   php /home/wwimpo/public_html/api/marketplace_cron.php
 * 
 * Or via HTTP with secret key:
 *   GET /api/marketplace_cron.php?key=YOUR_CRON_KEY
 * 
 * Environment variables:
 *   MARKETPLACE_CRON_KEY - Secret key for HTTP access (provision via cPanel env vars)
 * 
 * @version 1.0
 */

header('Content-Type: application/json');

$isCli = (php_sapi_name() === 'cli');

if (!$isCli) {
    $cronKey = getenv('MARKETPLACE_CRON_KEY');
    $providedKey = $_GET['key'] ?? '';
    if (!$cronKey || $providedKey !== $cronKey) {
        http_response_code(403);
        echo json_encode(['error' => 'Acceso no autorizado']);
        exit();
    }
}

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/marketplace_email_service.php';

$log = [];
$startTime = microtime(true);

function cronLog($message) {
    global $log;
    $ts = date('Y-m-d H:i:s');
    $log[] = "[$ts] $message";
    if (php_sapi_name() === 'cli') {
        echo "[$ts] $message\n";
    }
}

try {
    $pdo = getDbConnection();
    $emailService = getMarketplaceEmailService();

    cronLog('Marketplace cron started');

    // =========================================================
    //  1. EXPIRATION REMINDERS (D-7 to D-1)
    // =========================================================

    cronLog('--- Processing expiration reminders ---');

    $stmt = $pdo->prepare("
        SELECT * FROM marketplace_listings
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND DATEDIFF(expires_at, NOW()) BETWEEN 1 AND 7
        ORDER BY expires_at ASC
    ");
    $stmt->execute();
    $expiringListings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    cronLog('Found ' . count($expiringListings) . ' listings expiring within 7 days');

    $remindersSent = 0;
    $remindersSkipped = 0;

    foreach ($expiringListings as $listing) {
        $listingId = $listing['id'];
        $daysRemaining = (int)floor((strtotime($listing['expires_at']) - time()) / 86400);
        if ($daysRemaining < 1) $daysRemaining = 1;
        if ($daysRemaining > 7) continue;

        $templateKey = 'listing_expiry_reminder_d' . $daysRemaining;

        if ($emailService->hasBeenSent($listingId, $templateKey)) {
            $remindersSkipped++;
            continue;
        }

        $fotos = $listing['fotos'] ? json_decode($listing['fotos'], true) : [];
        $listing['fotos'] = $fotos;

        $result = $emailService->sendListingExpiryReminderEmail(
            $listing['user_email'],
            $listing['user_name'],
            $listing,
            $daysRemaining
        );

        if ($result['success'] ?? false) {
            $emailService->markAsSent($listingId, $templateKey);
            $remindersSent++;
            cronLog("Reminder sent: listing #$listingId ({$listing['nombre']}), D-$daysRemaining to {$listing['user_email']}");
        } else {
            cronLog("ERROR sending reminder for listing #$listingId: " . ($result['error'] ?? 'unknown'));
        }
    }

    cronLog("Reminders: $remindersSent sent, $remindersSkipped skipped (already sent)");

    // =========================================================
    //  2. AUTO-EXPIRE LISTINGS
    // =========================================================

    cronLog('--- Processing expired listings ---');

    $stmt = $pdo->prepare("
        SELECT * FROM marketplace_listings
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
        ORDER BY expires_at ASC
    ");
    $stmt->execute();
    $expiredListings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    cronLog('Found ' . count($expiredListings) . ' expired listings to process');

    $expiredCount = 0;

    foreach ($expiredListings as $listing) {
        $listingId = $listing['id'];

        $templateKey = 'listing_auto_expired';
        if ($emailService->hasBeenSent($listingId, $templateKey)) {
            cronLog("Listing #$listingId already processed for expiration, skipping");
            continue;
        }

        $updateStmt = $pdo->prepare("
            UPDATE marketplace_listings SET status = 'expired' WHERE id = ? AND status = 'active'
        ");
        $updateStmt->execute([$listingId]);

        if ($updateStmt->rowCount() === 0) {
            continue;
        }

        $fotos = $listing['fotos'] ? json_decode($listing['fotos'], true) : [];
        $listing['fotos'] = $fotos;

        $userResult = $emailService->sendListingExpiredEmail(
            $listing['user_email'],
            $listing['user_name'],
            $listing
        );

        $adminResult = $emailService->sendAdminListingExpiredEmail($listing);

        $emailService->markAsSent($listingId, $templateKey);
        $expiredCount++;
        cronLog("Expired listing #$listingId ({$listing['nombre']}) - user email: " . ($userResult['success'] ? 'OK' : 'FAIL'));
    }

    cronLog("Auto-expired: $expiredCount listings");

    // =========================================================
    //  SUMMARY
    // =========================================================

    $elapsed = round(microtime(true) - $startTime, 3);
    cronLog("Cron completed in {$elapsed}s");

    echo json_encode([
        'success' => true,
        'summary' => [
            'reminders_sent' => $remindersSent,
            'reminders_skipped' => $remindersSkipped,
            'listings_expired' => $expiredCount,
            'elapsed_seconds' => $elapsed,
        ],
        'log' => $log,
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    cronLog('FATAL ERROR: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'log' => $log,
    ]);
}
