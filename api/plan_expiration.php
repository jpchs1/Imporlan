<?php
/**
 * Cierre automatico de planes de busqueda - Imporlan
 *
 * Un plan (Fragata, Capitan de Navio, Almirante) que lleva mas de
 * PLAN_AUTO_CLOSE_DAYS dias desde su compra se marca como 'expired' en
 * purchases.json y su expediente (tabla orders) pasa a 'expired'. Asi el
 * cliente deja de aparecer con un plan activo y puede contratar uno nuevo.
 *
 * Se ejecuta de dos formas:
 * - maybeExpireStalePlans(): liviano, a lo mas una vez cada 6 horas. Lo
 *   llaman purchases.php, admin_api.php, orders_api.php y el cron de
 *   chat_auto_messages.php, asi no depende de configurar un cron nuevo.
 * - CLI: php api/plan_expiration.php [--dry-run]  (fuerza la ejecucion)
 */

if (!defined('PLAN_AUTO_CLOSE_DAYS')) {
    define('PLAN_AUTO_CLOSE_DAYS', 60);
}
define('PLAN_EXPIRATION_INTERVAL', 6 * 3600);

/**
 * Fecha de compra de un plan (unix time) o null si no se puede determinar.
 */
function planPurchaseTime(array $purchase) {
    // Si un admin lo reactivó a mano, el plazo corre desde esa fecha.
    foreach (['reactivated_at', 'timestamp', 'date'] as $field) {
        if (!empty($purchase[$field])) {
            $t = strtotime($purchase[$field]);
            if ($t) {
                return $t;
            }
        }
    }
    return null;
}

/**
 * Cierra los planes con mas de PLAN_AUTO_CLOSE_DAYS dias.
 * Devuelve ['purchases' => [...ids], 'orders' => n].
 */
function expireStalePlans($dryRun = false) {
    $purchasesFile = __DIR__ . '/purchases.json';
    $cutoff = time() - PLAN_AUTO_CLOSE_DAYS * 86400;
    $expiredIds = [];

    if (file_exists($purchasesFile)) {
        $fp = fopen($purchasesFile, 'c+');
        if ($fp && flock($fp, LOCK_EX)) {
            $data = json_decode(stream_get_contents($fp), true);
            if (is_array($data) && isset($data['purchases']) && is_array($data['purchases'])) {
                foreach ($data['purchases'] as &$purchase) {
                    if (($purchase['type'] ?? '') !== 'plan') {
                        continue;
                    }
                    if (!in_array($purchase['status'] ?? '', ['paid', 'active'], true)) {
                        continue;
                    }
                    $boughtAt = planPurchaseTime($purchase);
                    if ($boughtAt === null || $boughtAt > $cutoff) {
                        continue;
                    }
                    $expiredIds[] = $purchase['id'];
                    $purchase['status'] = 'expired';
                    $purchase['expired_at'] = date('Y-m-d H:i:s');
                    $purchase['expired_reason'] = 'auto_' . PLAN_AUTO_CLOSE_DAYS . 'd';
                }
                unset($purchase);

                if ($expiredIds && !$dryRun) {
                    ftruncate($fp, 0);
                    rewind($fp);
                    fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
                    fflush($fp);
                }
            }
            flock($fp, LOCK_UN);
        }
        if ($fp) {
            fclose($fp);
        }
    }

    $ordersClosed = 0;
    try {
        if (file_exists(__DIR__ . '/db_config.php')) {
            require_once __DIR__ . '/db_config.php';
            $pdo = getDbConnection();
            if ($pdo) {
                // Expedientes de plan abiertos: los de las compras recien
                // cerradas y cualquier plan_busqueda con mas de N dias.
                $params = [PLAN_AUTO_CLOSE_DAYS];
                $where = "(service_type = 'plan_busqueda' AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY))";
                if ($expiredIds) {
                    $where .= " OR purchase_id IN (" . implode(',', array_fill(0, count($expiredIds), '?')) . ")";
                    $params = array_merge($params, $expiredIds);
                }
                $stmt = $pdo->prepare("SELECT id FROM orders
                    WHERE status IN ('new', 'pending_admin_fill', 'in_progress') AND ($where)");
                $stmt->execute($params);
                $orderIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

                if ($orderIds && !$dryRun) {
                    $upd = $pdo->prepare("UPDATE orders SET status = 'expired' WHERE id = ?");
                    $evt = $pdo->prepare("INSERT INTO order_events (order_id, event_type, meta_json, user_id) VALUES (?, 'status_change', ?, 'system')");
                    $meta = json_encode(['new_status' => 'expired', 'reason' => 'Cierre automatico: plan con mas de ' . PLAN_AUTO_CLOSE_DAYS . ' dias']);
                    foreach ($orderIds as $orderId) {
                        $upd->execute([$orderId]);
                        $evt->execute([$orderId, $meta]);
                    }
                }
                $ordersClosed = count($orderIds);
            }
        }
    } catch (Exception $e) {
        error_log('plan_expiration: error cerrando expedientes: ' . $e->getMessage());
    }

    if (($expiredIds || $ordersClosed) && !$dryRun) {
        error_log('plan_expiration: planes cerrados=' . implode(',', $expiredIds) . ' expedientes=' . $ordersClosed);
    }

    return ['purchases' => $expiredIds, 'orders' => $ordersClosed];
}

/**
 * Ejecuta expireStalePlans() a lo mas una vez cada PLAN_EXPIRATION_INTERVAL.
 * Nunca interrumpe la peticion que lo llama.
 */
function maybeExpireStalePlans() {
    $marker = __DIR__ . '/.plan_expiration_last_run';
    $last = @filemtime($marker);
    if ($last && (time() - $last) < PLAN_EXPIRATION_INTERVAL) {
        return;
    }
    @touch($marker);
    try {
        expireStalePlans();
    } catch (Throwable $e) {
        error_log('plan_expiration: ' . $e->getMessage());
    }
}

if (php_sapi_name() === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $dryRun = in_array('--dry-run', $argv, true);
    $result = expireStalePlans($dryRun);
    echo ($dryRun ? '[dry-run] ' : '') . 'Planes cerrados: ' . count($result['purchases'])
        . ' (' . implode(', ', $result['purchases']) . '), expedientes: ' . $result['orders'] . PHP_EOL;
}
