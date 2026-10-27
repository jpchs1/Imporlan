<?php
/** CLI-only. Called by the existing hosting cron, not by public web traffic. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../operador_usa.php';

try {
    $pdo = getDbConnection();
    if (!$pdo) throw new RuntimeException('DB unavailable');
    opuAsegurar($pdo);
    opuInspectionSchema($pdo);
    opuInspectionBootstrap($pdo);
    $result = opuInspectionRun($pdo);
    $result = array_merge($result, opuPriceRun($pdo));
    if (array_sum($result)) echo '[inspection-upload] ' . json_encode($result) . PHP_EOL;
    exit(($result['failed'] || $result['price_failed']) ? 1 : 0);
} catch (Throwable $e) {
    // Counts and generic errors only: never expose the private link or client data in logs.
    error_log('[inspection-upload] job failed: ' . get_class($e));
    exit(1);
}
