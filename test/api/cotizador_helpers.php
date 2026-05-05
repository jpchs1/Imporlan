<?php
/**
 * Cotizador helpers — shared between orders_api.php (lazy publish on client
 * fetch) and api/cron/cotizador_publish.php (eager publish on schedule).
 */

if (!defined('IMPORLAN_COTIZADOR_HELPERS_LOADED')) {
    define('IMPORLAN_COTIZADOR_HELPERS_LOADED', true);

    /**
     * Read the configurable delay (hours) before a saved quote is shown to
     * the client. Falls back to 24 if the row is missing.
     */
    function cotizadorClientDelayHours(PDO $pdo): int {
        try {
            $stmt = $pdo->prepare("SELECT config_value FROM pricing_config WHERE config_key = 'cot_client_delay_hours' LIMIT 1");
            $stmt->execute();
            $v = $stmt->fetchColumn();
            $n = intval($v);
            return $n > 0 ? $n : 24;
        } catch (PDOException $e) {
            return 24;
        }
    }

    /**
     * Strip a link row's quote_* fields when the quote is still inside the
     * client-visibility delay window. Adds a "quote_pending" flag so the panel
     * can render an "en análisis" badge instead of leaking numbers.
     *
     * Also lazy-publishes any quote whose delay just expired: stamps
     * quote_published_at = NOW and triggers the "tu cotización está lista"
     * email. Idempotent — only fires the first time the row is seen after the
     * window closes, because it gates on quote_published_at IS NULL.
     */
    function cotizadorApplyClientVisibility(PDO $pdo, array $links): array {
        if (empty($links)) return $links;
        $delayHours = cotizadorClientDelayHours($pdo);
        $now = time();
        $orderCustomer = null;  // lazily loaded if we need to send an email
        $orderInfo = [];        // cache by order_id

        foreach ($links as &$lk) {
            if (empty($lk['quote_calculated_at'])) {
                // No quote saved at all; clear any ghost columns and continue.
                $lk['quote_data'] = null;
                $lk['quote_total_clp'] = null;
                $lk['quote_total_usd'] = null;
                $lk['quote_payments'] = null;
                $lk['quote_pending'] = false;
                continue;
            }

            $calcTs = strtotime($lk['quote_calculated_at']);
            $availableAt = $calcTs + ($delayHours * 3600);
            $available = $now >= $availableAt;

            if (!$available) {
                // Inside the delay window — hide everything but keep a flag.
                unset($lk['quote_data']);
                unset($lk['quote_total_clp']);
                unset($lk['quote_total_usd']);
                unset($lk['quote_payments']);
                $lk['quote_pending'] = true;
                $lk['quote_available_at'] = date('c', $availableAt);
                continue;
            }

            // Window expired. If we haven't published yet, do it now and email.
            if (empty($lk['quote_published_at'])) {
                try {
                    $upd = $pdo->prepare("UPDATE order_links SET quote_published_at = NOW() WHERE id = ? AND quote_published_at IS NULL");
                    $upd->execute([$lk['id']]);
                    if ($upd->rowCount() > 0) {
                        // Look up customer email for notification.
                        $orderId = $lk['order_id'] ?? null;
                        if ($orderId && !isset($orderInfo[$orderId])) {
                            $oStmt = $pdo->prepare("SELECT customer_email, customer_name, order_number FROM orders WHERE id = ? LIMIT 1");
                            $oStmt->execute([$orderId]);
                            $orderInfo[$orderId] = $oStmt->fetch(PDO::FETCH_ASSOC) ?: null;
                        }
                        $info = $orderInfo[$orderId] ?? null;
                        if ($info && !empty($info['customer_email'])) {
                            cotizadorSendReadyEmail(
                                $info['customer_email'],
                                $info['customer_name'] ?? '',
                                $info['order_number'] ?? '',
                                $lk
                            );
                        }
                        $lk['quote_published_at'] = date('Y-m-d H:i:s');
                    }
                } catch (PDOException $e) {
                    error_log('cotizadorApplyClientVisibility publish failed: ' . $e->getMessage());
                }
            }

            $lk['quote_pending'] = false;
        }
        unset($lk);
        return $links;
    }

    /**
     * Publish all due quotes (used by cron). Returns the count of quotes
     * published in this run.
     */
    function cotizadorPublishDue(PDO $pdo): int {
        $delayHours = cotizadorClientDelayHours($pdo);
        $stmt = $pdo->prepare("
            SELECT ol.*, o.customer_email, o.customer_name, o.order_number
            FROM order_links ol
            JOIN orders o ON o.id = ol.order_id
            WHERE ol.quote_calculated_at IS NOT NULL
              AND ol.quote_published_at IS NULL
              AND ol.quote_calculated_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)
        ");
        $stmt->execute([$delayHours]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $count = 0;
        foreach ($rows as $row) {
            try {
                $upd = $pdo->prepare("UPDATE order_links SET quote_published_at = NOW() WHERE id = ? AND quote_published_at IS NULL");
                $upd->execute([$row['id']]);
                if ($upd->rowCount() > 0) {
                    if (!empty($row['customer_email'])) {
                        cotizadorSendReadyEmail(
                            $row['customer_email'],
                            $row['customer_name'] ?? '',
                            $row['order_number'] ?? '',
                            $row
                        );
                    }
                    $count++;
                }
            } catch (PDOException $e) {
                error_log('cotizadorPublishDue row failed: ' . $e->getMessage());
            }
        }
        return $count;
    }

    /**
     * Send "your quotation is ready" email. Uses EmailService when available,
     * otherwise logs a warning. Failures don't abort publishing — the worst
     * case is the customer notices via the panel without an email.
     */
    function cotizadorSendReadyEmail(string $userEmail, string $userName, string $orderNumber, array $link): void {
        if (!filter_var($userEmail, FILTER_VALIDATE_EMAIL)) return;
        try {
            require_once __DIR__ . '/email_service.php';
            if (!class_exists('EmailService')) {
                error_log('cotizadorSendReadyEmail: EmailService class not available');
                return;
            }
            $svc = new EmailService();
            $title = trim(($link['year'] ?? '') . ' ' . ($link['make'] ?? '') . ' ' . ($link['model'] ?? ''));
            if (!$title) $title = 'tu embarcación';
            $subject = 'Tu cotización está lista — ' . $title;
            $panelUrl = 'https://www.imporlan.cl/panel/';
            $totalClp = isset($link['quote_total_clp']) ? '$ ' . number_format((float)$link['quote_total_clp'], 0, ',', '.') : '';
            $html = '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:20px">'
                . '<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">'
                . '<h2 style="color:#1e293b;margin:0 0 8px">Tu cotización está lista</h2>'
                . '<p style="color:#475569;font-size:15px;line-height:1.6">Hola' . ($userName ? ' <strong>' . htmlspecialchars($userName) . '</strong>' : '') . ', ya terminamos el análisis de costos para <strong>' . htmlspecialchars($title) . '</strong> y la cotización está disponible en tu panel.</p>'
                . ($totalClp ? '<div style="background:#f0f9ff;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:8px;margin:18px 0"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Total cotización</div><div style="font-size:24px;font-weight:700;color:#1e40af;margin-top:4px">' . $totalClp . '</div></div>' : '')
                . '<div style="text-align:center;margin:24px 0"><a href="' . htmlspecialchars($panelUrl) . '" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600">Ver mi cotización</a></div>'
                . '<p style="color:#94a3b8;font-size:12px;line-height:1.5">Si tienes dudas, contáctanos respondiendo este correo o por WhatsApp. Imporlan.</p>'
                . '</div></body></html>';
            $svc->sendCustomEmail($userEmail, $subject, $html);
        } catch (Exception $e) {
            error_log('cotizadorSendReadyEmail exception: ' . $e->getMessage());
        }
    }
}
