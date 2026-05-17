<?php
/**
 * Cron: cotizador publisher
 *
 * Hourly job that finds quotes whose 24-hour client-visibility delay has
 * passed and:
 *   1. Sets order_links.quote_published_at = NOW
 *   2. Sends the "tu cotización está lista" email to the customer
 *
 * Idempotent — only acts on rows where quote_published_at IS NULL, so re-runs
 * are safe. Visibility for clients also lazy-publishes when they open the
 * panel (orders_api.php userGetOrderDetail), but this cron makes sure the
 * email goes out promptly even if the client doesn't actively check.
 *
 * cPanel cron entry (run hourly):
 *   0 * * * * /usr/bin/php /home/wwimpo/imporlan.cl/api/cron/cotizador_publish.php >/dev/null 2>&1
 *
 * To trigger manually for testing:
 *   php /home/wwimpo/imporlan.cl/api/cron/cotizador_publish.php
 *
 * Output goes to stdout when run from CLI, or is suppressed under HTTP unless
 * the CRON_DEBUG env var is set.
 */

require_once __DIR__ . '/../db_config.php';
require_once __DIR__ . '/../cotizador_helpers.php';

$isCli = php_sapi_name() === 'cli';
$debug = $isCli || getenv('CRON_DEBUG') === '1';

if (!$isCli) {
    // When hit via HTTP from the cron daemon, return JSON; never expose details
    // unless CRON_DEBUG is set (avoids leaking internals to anyone who guesses
    // the URL).
    header('Content-Type: application/json');
}

try {
    $pdo = getDbConnection();
    if (!$pdo) {
        if ($debug) echo "DB connection failed\n";
        else echo json_encode(['success' => false]);
        exit(1);
    }
    $count = cotizadorPublishDue($pdo);
    $msg = "Published $count quote(s)";
    error_log("[cotizador_publish] $msg");
    if ($debug) {
        echo $msg . "\n";
    } else {
        echo json_encode(['success' => true, 'published' => $count]);
    }
} catch (Throwable $e) {
    error_log('[cotizador_publish] error: ' . $e->getMessage());
    if ($debug) {
        echo 'Error: ' . $e->getMessage() . "\n";
    } else {
        echo json_encode(['success' => false]);
    }
    exit(1);
}
