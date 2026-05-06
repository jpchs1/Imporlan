<?php
/**
 * Cotizador helpers — shared between orders_api.php (lazy publish on client
 * fetch) and api/cron/cotizador_publish.php (eager publish on schedule).
 */

if (!defined('IMPORLAN_COTIZADOR_HELPERS_LOADED')) {
    define('IMPORLAN_COTIZADOR_HELPERS_LOADED', true);

    /**
     * Idempotently add the per-link quote columns to order_links. Lives here
     * (not in settings_api.php) so the cron / lazy-publish path can self-heal
     * without depending on the admin opening the Cotizador tab first.
     */
    function cotizadorEnsureOrderLinkColumns(PDO $pdo): void {
        $cols = [
            'quote_data'           => 'JSON NULL',
            'quote_total_clp'      => 'DECIMAL(15,0) NULL',
            'quote_total_usd'      => 'DECIMAL(12,2) NULL',
            'quote_payments'       => 'JSON NULL',
            'quote_calculated_at'  => 'TIMESTAMP NULL',
            'quote_published_at'   => 'TIMESTAMP NULL',
        ];
        try {
            $existing = $pdo->query("
                SELECT COLUMN_NAME FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_links'
            ")->fetchAll(PDO::FETCH_COLUMN);
        } catch (PDOException $e) {
            return;  // table may not exist yet — skip gracefully
        }
        $existingSet = array_flip($existing);
        foreach ($cols as $col => $def) {
            if (isset($existingSet[$col])) continue;
            try {
                $pdo->exec("ALTER TABLE order_links ADD COLUMN `$col` $def");
            } catch (PDOException $e) {
                error_log('cotizadorEnsureOrderLinkColumns: ' . $e->getMessage());
            }
        }
    }

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
        cotizadorEnsureOrderLinkColumns($pdo);  // self-heal in case migration hasn't run yet
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
        cotizadorEnsureOrderLinkColumns($pdo);  // self-heal: cron may run before admin opens Cotizador tab
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

            // Decode the quote_data snapshot so we can render the same itemized
            // breakdown the admin sees in the QuoteModal (Lancha, Servicio
            // All-Inclusive, IVA, Lujo, Total + 3 pagos).
            $qd = $link['quote_data'] ?? null;
            if (is_string($qd)) { $qd = json_decode($qd, true); }
            if (!is_array($qd)) $qd = [];
            $payments = $link['quote_payments'] ?? null;
            if (is_string($payments)) { $payments = json_decode($payments, true); }

            $totalClpNum = isset($link['quote_total_clp']) ? (float)$link['quote_total_clp'] : 0;
            $rate        = (float)($qd['usd_clp_rate'] ?? 920) ?: 1;
            $lanchaUsd   = (float)($qd['valor_lancha_usd'] ?? 0);
            $lanchaClp   = $lanchaUsd * $rate;
            $transUsd    = (float)($qd['transporte_roro_usd'] ?? 0);
            $cifClp      = $lanchaClp + $transUsd * $rate;
            $ivaPct      = (float)($qd['iva_pct'] ?? 19);
            $lujoPct     = (float)($qd['lujo_pct'] ?? 2);
            $lujoAplica  = !empty($qd['lujo_aplica']);
            $ivaClp      = $cifClp * ($ivaPct / 100);
            $lujoClp     = $lujoAplica ? $lanchaClp * ($lujoPct / 100) : 0;
            $allIncl     = $totalClpNum - $lanchaClp - $ivaClp - $lujoClp;

            $fmt = fn($n) => '$ ' . number_format(max(0, round($n)), 0, ',', '.');

            $row = function ($label, $value, $bold = false) {
                $w = $bold ? '700' : '500';
                $cl = $bold ? '#0f172a' : '#475569';
                $valc = $bold ? '#1e40af' : '#0f172a';
                return '<tr><td style="padding:8px 4px;color:' . $cl . ';font-weight:' . $w . ';font-size:13px">' . $label . '</td>'
                    . '<td style="padding:8px 4px;text-align:right;color:' . $valc . ';font-weight:' . $w . ';font-size:13px;font-variant-numeric:tabular-nums">' . $value . '</td></tr>';
            };

            $breakdown = '<table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:14px 0">'
                . $row('Valor Lancha', $fmt($lanchaClp))
                . $row('Servicio All-Inclusive', $fmt($allIncl))
                . $row('IVA Aduanero (' . rtrim(rtrim(number_format($ivaPct, 2, '.', ''), '0'), '.') . '%)', $fmt($ivaClp))
                . ($lujoAplica
                    ? $row('Impuesto al Lujo', $fmt($lujoClp))
                    : '<tr><td style="padding:8px 4px;color:#94a3b8;font-size:13px">Impuesto al Lujo</td><td style="padding:8px 4px;text-align:right;color:#94a3b8;font-size:13px">N/A</td></tr>')
                . '<tr><td colspan="2" style="border-top:1px solid #e2e8f0;padding:0"></td></tr>'
                . $row('TOTAL', $fmt($totalClpNum), true)
                . '</table>';

            $pagosBlock = '';
            if (is_array($payments) && !empty($payments['p1_clp'])) {
                $pagosBlock = '<div style="margin:18px 0">'
                    . '<div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Plan de pagos</div>'
                    . '<table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">';
                foreach ([1, 2, 3] as $i) {
                    $pct = $payments['p' . $i . '_pct'] ?? 0;
                    $clp = $payments['p' . $i . '_clp'] ?? 0;
                    if ($clp <= 0) continue;
                    $pagosBlock .= '<tr><td style="padding:6px 0;color:#475569;font-size:12px">Pago ' . $i . ' <span style="color:#94a3b8">(' . $pct . '%)</span></td>'
                        . '<td style="padding:6px 0;text-align:right;color:#0f172a;font-weight:600;font-size:13px;font-variant-numeric:tabular-nums">' . $fmt($clp) . '</td></tr>';
                }
                $pagosBlock .= '</table></div>';
            }

            $ivaNote = '<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;margin:18px 0">'
                . '<div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Sobre el IVA Aduanero</div>'
                . '<div style="color:#78350f;font-size:12px;line-height:1.55">Si lo prefieres, el IVA Aduanero (' . $fmt($ivaClp) . ') puedes pagarlo directamente a la Tesorería General de la República (TGR) — en ese caso queda fuera del monto que abonas a Imporlan. Avísanos al confirmar para ajustar el plan de pagos.</div>'
                . '</div>';

            $html = '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:20px">'
                . '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">'
                . '<h2 style="color:#1e293b;margin:0 0 8px">Tu cotización está lista</h2>'
                . '<p style="color:#475569;font-size:15px;line-height:1.6">Hola' . ($userName ? ' <strong>' . htmlspecialchars($userName) . '</strong>' : '') . ', ya terminamos el análisis de costos para <strong>' . htmlspecialchars($title) . '</strong>. Aquí va el resumen del valor final y el plan de pagos.</p>'
                . '<div style="background:#f0f9ff;border:1px solid #bae6fd;padding:16px 18px;border-radius:10px;margin:18px 0">'
                . '<div style="font-size:11px;color:#0369a1;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Resumen de costos</div>'
                . $breakdown
                . '</div>'
                . $pagosBlock
                . $ivaNote
                . '<div style="text-align:center;margin:24px 0"><a href="' . htmlspecialchars($panelUrl) . '" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600">Ver detalle en mi panel</a></div>'
                . '<p style="color:#94a3b8;font-size:12px;line-height:1.5">Si tienes dudas, contáctanos respondiendo este correo o por WhatsApp. Imporlan.</p>'
                . '</div></body></html>';
            $svc->sendCustomEmail($userEmail, $subject, $html);
        } catch (Exception $e) {
            error_log('cotizadorSendReadyEmail exception: ' . $e->getMessage());
        }
    }
}
