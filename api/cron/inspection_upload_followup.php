<?php
/** CLI-only. Called by the existing hosting cron, not by public web traffic. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../operador_usa.php';
require_once __DIR__ . '/../import_action_reminders.php';

try {
    $pdo = getDbConnection();
    if (!$pdo) throw new RuntimeException('DB unavailable');
    opuAsegurar($pdo);
    opuInspectionSchema($pdo);
    opuInspectionBootstrap($pdo);
    opuRetiroAvisoBootstrap($pdo); // aviso único a David: informar el retiro de IMP-00035 (JP, 9-nov-2026)
    try { // IMP-00035 entregada en el puerto de EE. UU.: fotos, pasos al día y Pago 3, una sola vez (JP, 11-nov-2026)
        require_once __DIR__ . '/../chaparral_puerto.php';
        impPuertoChaparralBootstrap($pdo);
    } catch (Throwable $e) {
        error_log('[inspection-upload] puerto IMP-00035: ' . get_class($e));
    }
    $result = opuInspectionRun($pdo);
    $result = array_merge($result, opuPriceRun($pdo));
    $result = array_merge($result, impActionRun($pdo));
    if (array_sum($result)) echo '[inspection-upload] ' . json_encode($result) . PHP_EOL;
    exit(($result['failed'] || $result['price_failed'] || $result['action_failed']) ? 1 : 0);
} catch (Throwable $e) {
    // Counts and generic errors only: never expose the private link or client data in logs.
    error_log('[inspection-upload] job failed: ' . get_class($e));
    exit(1);
}
