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
            'quote_breakdown_sent_at' => 'TIMESTAMP NULL',
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
            // La publicación manual es inmediata, aunque todavía corra la espera.
            $available = !empty($lk['quote_published_at']) || $now >= $availableAt;

            if (!$available) {
                // Inside the delay window — hide everything but keep a flag.
                unset($lk['quote_data']);
                unset($lk['quote_total_clp']);
                unset($lk['quote_total_usd']);
                unset($lk['quote_payments']);
                // El cotizador también replica el total en la matriz de precios.
                // Ocultarlo aquí evita filtrar la cotización por otra columna.
                $lk['value_chile_negotiated_clp'] = null;
                $lk['value_chile_clp'] = null;
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
            $lk['quote_data'] = cotizadorClientQuoteData($lk['quote_data'] ?? null);
        }
        unset($lk);
        return $links;
    }

    /**
     * Reduce a quote_data snapshot to the keys the client panel and the
     * "cotización lista" email need to draw the summary (Lancha, Servicio
     * All-Inclusive, IVA, Lujo). Everything else — each USD/CLP line of the
     * admin sheet and fee_imporlan_clp — is internal and must not leave the
     * server: the client sees the All-Inclusive as one number, but the full
     * sheet used to travel in the order JSON and could be read with F12.
     */
    function cotizadorClientQuoteData($qd): ?string {
        if (is_string($qd)) $qd = json_decode($qd, true);
        if (!is_array($qd)) return null;
        $keys = ['usd_clp_rate', 'valor_lancha_usd', 'transporte_roro_usd', 'iva_pct', 'lujo_pct', 'lujo_aplica'];
        return json_encode(array_intersect_key($qd, array_flip($keys)));
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

            // Hero image — the main listing image scraped/uploaded for this link.
            // Wrapped in an anchor to the original listing URL when present so the
            // client can jump back to the source ad. Skipped silently if either is
            // missing or fails URL validation.
            $imageUrl = trim((string)($link['image_url'] ?? ''));
            $listingUrl = trim((string)($link['url'] ?? ''));
            $imageBlock = '';
            if ($imageUrl !== '' && filter_var($imageUrl, FILTER_VALIDATE_URL)) {
                $img = '<img src="' . htmlspecialchars($imageUrl) . '" alt="' . htmlspecialchars($title) . '" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:10px;object-fit:cover" />';
                if ($listingUrl !== '' && filter_var($listingUrl, FILTER_VALIDATE_URL)) {
                    $img = '<a href="' . htmlspecialchars($listingUrl) . '" target="_blank" style="text-decoration:none;color:inherit">' . $img . '</a>';
                }
                $imageBlock = '<div style="margin:0 0 18px;border-radius:10px;overflow:hidden">' . $img . '</div>';
            }

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
                . '<h2 style="color:#1e293b;margin:0 0 16px">Tu cotización está lista</h2>'
                . $imageBlock
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

    /**
     * Split the All-Inclusive the client already saw into four stages, for
     * the «Enviar desglose» email (JP sends it by hand, only to clients who
     * ask for it).
     *
     * Flete + seguro go at cost: they are printed on the customs declaration
     * (and the freight is part of the IVA base), so they must match. The
     * margin (what's left over the sheet costs, i.e. the FEE) goes whole to
     * its own «Gestión Imporlan» line, and the three logistics stages show
     * their cost. JP, 14-oct-2026: spread over the stages, the FEE made them
     * read expensive for their titles («Gestión Imporlan approx CLP
     * $3.000.000», the whole FEE). Everything adds up, to the peso, to the
     * All-Inclusive the client has in the quote.
     *
     * 'cuadra' is false when the saved total doesn't even cover the freight
     * (a broken quote): the breakdown must not go out like that.
     */
    function cotizadorDesgloseEtapas(array $qd, float $totalClp): array {
        $rate = (float)($qd['usd_clp_rate'] ?? 920) ?: 1;
        $etapas = [
            'flete' => [
                'label'   => 'Flete marítimo y seguro',
                'detalle' => 'Transporte RORO de Estados Unidos a San Antonio y seguro de la carga.',
                'usd'     => ['transporte_roro_usd', 'seguro_usd'],
                'clp'     => [],
            ],
            'usa' => [
                'label'   => 'Inspección, retiro y traslado a puerto (EE.UU.)',
                'detalle' => 'Inspección técnica, retiro, bodegaje y traslado al puerto de embarque, fumigación, transferencia internacional y trámites de exportación.',
                'usd'     => ['trailer_usd', 'inspeccion_usd', 'inland_usa_usd', 'fumigacion_usd', 'miami_admin_usd', 'escorte_usd'],
                'clp'     => ['fee_wire_clp'],
            ],
            'chile' => [
                'label'   => 'Puerto y desaduanaje en Chile',
                'detalle' => 'Naviera y puerto, agencia de aduanas, despacho y autorizaciones de internación.',
                'usd'     => ['gastos_naviera_usd', 'congestion_usd', 'thc_usd', 'baf_usd', 'wharfage_usd', 'handling_chile_usd'],
                'clp'     => ['gastos_puerto_clp', 'agencia_aduana_clp', 'aduana_extra_clp', 'autorizaciones_clp', 'iva_servicios_linea_clp', 'gastos_despachos_clp', 'honorarios_agencia_clp'],
            ],
            'entrega' => [
                'label'   => 'Traslado, revisión y entrega',
                'detalle' => 'Traslado del puerto a Santiago, chequeo mecánico, pulido y tratamiento, y entrega.',
                'usd'     => [],
                'clp'     => ['inland_puerto_clp', 'chequeo_mecanico_clp', 'pulido_clp', 'entrega_clp'],
            ],
        ];
        foreach ($etapas as &$e) {
            $e['costo'] = 0.0;
            foreach ($e['usd'] as $k) $e['costo'] += max(0, (float)($qd[$k] ?? 0)) * $rate;
            foreach ($e['clp'] as $k) $e['costo'] += max(0, (float)($qd[$k] ?? 0));
        }
        unset($e);

        // Same All-Inclusive the client sees in the panel and the first email.
        $lanchaClp = (float)($qd['valor_lancha_usd'] ?? 0) * $rate;
        $cifClp    = $lanchaClp + (float)($qd['transporte_roro_usd'] ?? 0) * $rate;
        $ivaPct    = (float)($qd['iva_pct'] ?? 19);
        $ivaClp    = $cifClp * ($ivaPct / 100);
        $lujoAplica = !empty($qd['lujo_aplica']);
        $lujoClp   = $lujoAplica ? $lanchaClp * ((float)($qd['lujo_pct'] ?? 2) / 100) : 0;
        $allIncl   = round($totalClp - $lanchaClp - $ivaClp - $lujoClp);

        $montos = ['flete' => round($etapas['flete']['costo'])];
        $servicio = ['usa', 'chile', 'entrega'];
        $base = 0.0;
        foreach ($servicio as $k) $base += $etapas[$k]['costo'];
        // The whole margin, to the thousand, in its own line (under $1.000
        // there is no line: it would read as a rounding error). Rounding it up
        // takes up to $500 from the stages; if that would use up all their
        // cost (tiny logistics, Devin on PR 675), it rounds down instead.
        $margen = $allIncl - $montos['flete'] - $base;
        $montos['gestion'] = $margen >= 1000 ? round($margen, -3) : 0;
        if ($montos['gestion'] > $margen && $montos['gestion'] - $margen >= $base) $montos['gestion'] = floor($margen / 1000) * 1000;
        $resto = $allIncl - $montos['flete'] - $montos['gestion'];
        // The costliest stage takes the remainder; the other two are rounded
        // to the thousand so they read as prices. Its share is at least a third
        // of the rest, so their rounding (at most $1.000 between both) can't
        // push it below zero once the rest is $3.000 or more; under that they
        // are floored to the peso, which never overshoots.
        $mayor = 'usa';
        foreach ($servicio as $k) if ($etapas[$k]['costo'] > $etapas[$mayor]['costo']) $mayor = $k;
        $asignado = 0;
        foreach ($servicio as $k) {
            if ($k === $mayor) continue;
            $parte = $base > 0 ? max(0, $resto) * $etapas[$k]['costo'] / $base : 0;
            $montos[$k] = $resto >= 3000 ? round($parte, -3) : floor($parte);
            $asignado += $montos[$k];
        }
        $montos[$mayor] = $resto - $asignado;

        $out = [];
        $etapas['gestion'] = [
            'label'   => 'Gestión Imporlan',
            'detalle' => 'Coordinación de todo el proceso: negociación con el vendedor, compra segura, documentación y seguimiento hasta la entrega, con un solo interlocutor.',
        ];
        foreach (['flete', 'usa', 'chile', 'entrega', 'gestion'] as $k) {
            if ($montos[$k] <= 0) continue;
            $out[] = ['label' => $etapas[$k]['label'], 'detalle' => $etapas[$k]['detalle'], 'clp' => $montos[$k]];
        }
        return [
            'etapas'        => $out,
            'all_inclusive' => $allIncl,
            'cuadra'        => $resto >= 0 && $allIncl > 0 && array_sum(array_column($out, 'clp')) == $allIncl,
            'lancha'        => $lanchaClp,
            'iva'           => $ivaClp,
            'iva_pct'       => $ivaPct,
            'lujo'          => $lujoClp,
            'lujo_aplica'   => $lujoAplica,
            'total'         => $totalClp,
        ];
    }

    function cotizadorLinkTitle(array $link): string {
        $title = trim(($link['year'] ?? '') . ' ' . ($link['make'] ?? '') . ' ' . ($link['model'] ?? ''));
        return $title !== '' ? $title : 'tu embarcación';
    }

    /**
     * The «Desglose de tu cotización» email body, written in JP's voice (he
     * is the one who sends it). Shape approved by JP on 14-oct-2026. Signed
     * with his graphic signature, like every client email that goes out in
     * his name (same image as .github/correo/firma-jp.jpg, served from the
     * site because EmailService only embeds the logo).
     */
    function cotizadorDesgloseHtml(array $link, string $userName): string {
        $qd = $link['quote_data'] ?? null;
        if (is_string($qd)) $qd = json_decode($qd, true);
        $d = cotizadorDesgloseEtapas(is_array($qd) ? $qd : [], (float)($link['quote_total_clp'] ?? 0));
        $title = cotizadorLinkTitle($link);
        $fmt = fn($n) => '$ ' . number_format(max(0, round($n)), 0, ',', '.');
        // The order may have the name in lowercase («alberto lathrop»): JP
        // wouldn't write «Hola alberto».
        $nombre = mb_convert_case(explode(' ', trim($userName))[0], MB_CASE_TITLE, 'UTF-8');

        $etapasHtml = '';
        $i = 0;
        foreach ($d['etapas'] as $e) {
            $i++;
            $etapasHtml .= '<tr>'
                . '<td style="padding:12px 4px;border-bottom:1px solid #e0f2fe;vertical-align:top;width:26px"><div style="width:22px;height:22px;border-radius:11px;background:#0369a1;color:#fff;font-size:12px;font-weight:700;line-height:22px;text-align:center">' . $i . '</div></td>'
                . '<td style="padding:12px 8px;border-bottom:1px solid #e0f2fe;vertical-align:top">'
                . '<div style="color:#0f172a;font-weight:600;font-size:14px">' . htmlspecialchars($e['label']) . '</div>'
                . '<div style="color:#64748b;font-size:12px;line-height:1.45;margin-top:3px">' . htmlspecialchars($e['detalle']) . '</div></td>'
                . '<td style="padding:12px 4px;border-bottom:1px solid #e0f2fe;vertical-align:top;text-align:right;white-space:nowrap;color:#0f172a;font-weight:600;font-size:14px;font-variant-numeric:tabular-nums">' . $fmt($e['clp']) . '</td>'
                . '</tr>';
        }
        $etapasHtml .= '<tr><td></td><td style="padding:12px 8px 2px;color:#0f172a;font-weight:700;font-size:14px">Servicio All-Inclusive</td>'
            . '<td style="padding:12px 4px 2px;text-align:right;white-space:nowrap;color:#1e40af;font-weight:800;font-size:16px;font-variant-numeric:tabular-nums">' . $fmt($d['all_inclusive']) . '</td></tr>';

        $row = function ($label, $value, $muted = false, $bold = false) {
            $cl = $muted ? '#94a3b8' : ($bold ? '#0f172a' : '#475569');
            $vc = $muted ? '#94a3b8' : ($bold ? '#1e40af' : '#0f172a');
            $w = $bold ? '700' : '500';
            return '<tr><td style="padding:6px 4px;color:' . $cl . ';font-size:13px;font-weight:' . $w . '">' . $label . '</td>'
                . '<td style="padding:6px 4px;text-align:right;white-space:nowrap;color:' . $vc . ';font-size:13px;font-weight:' . $w . ';font-variant-numeric:tabular-nums">' . $value . '</td></tr>';
        };
        $ivaPct = rtrim(rtrim(number_format($d['iva_pct'], 2, '.', ''), '0'), '.');
        $resumen = '<table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">'
            . $row('Valor Lancha', $fmt($d['lancha']))
            . $row('Servicio All-Inclusive <span style="color:#94a3b8">(arriba en detalle)</span>', $fmt($d['all_inclusive']))
            . $row('IVA Aduanero (' . $ivaPct . '%)', $fmt($d['iva']))
            . ($d['lujo_aplica'] ? $row('Impuesto al Lujo', $fmt($d['lujo'])) : $row('Impuesto al Lujo', 'N/A', true))
            . '<tr><td colspan="2" style="border-top:1px solid #e2e8f0;padding:0"></td></tr>'
            . $row('TOTAL', $fmt($d['total']), false, true)
            . '</table>';

        return '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:20px;margin:0">'
            . '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">'
            . '<h2 style="color:#1e293b;margin:0 0 6px">Desglose de tu cotización</h2>'
            . '<div style="color:#64748b;font-size:14px;margin:0 0 18px">' . htmlspecialchars($title) . '</div>'
            . '<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 6px">Hola' . ($nombre !== '' ? ' ' . htmlspecialchars($nombre) : '') . ', como me pediste, te dejo el detalle del <strong>Servicio All-Inclusive</strong>: qué cubre cada etapa, desde que vemos la lancha en Estados Unidos hasta que te la entregamos en Santiago.</p>'
            . '<div style="background:#f0f9ff;border:1px solid #bae6fd;padding:12px 16px 14px;border-radius:10px;margin:18px 0">'
            . '<div style="font-size:11px;color:#0369a1;text-transform:uppercase;letter-spacing:.05em;margin:4px 0 2px">Servicio All-Inclusive · por etapa</div>'
            . '<table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">' . $etapasHtml . '</table>'
            . '</div>'
            . '<div style="background:#f8fafc;border-left:4px solid #94a3b8;padding:12px 16px;border-radius:6px;margin:18px 0;color:#475569;font-size:12px;line-height:1.6">'
            . 'El <strong>flete marítimo y el seguro</strong> van a costo. '
            . 'Las etapas siguientes cubren cada tramo de la logística, y la última línea es nuestro trabajo: la gestión de Imporlan de principio a fin.'
            // JP, 14-oct-2026: los montos por etapa se van moviendo unos con
            // otros; lo que se mantiene es el total.
            . '<div style="margin-top:8px"><strong>Los montos de cada etapa son referenciales:</strong> se van moviendo unos con otros (tarifas de naviera y puerto, tipo de cambio), pero el total se mantiene muy cerca de lo cotizado.</div>'
            . '</div>'
            . '<div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin:22px 0 6px">Resumen de la cotización</div>'
            . $resumen
            . '<div style="text-align:center;margin:26px 0 22px"><a href="https://www.imporlan.cl/panel/" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600">Ver mi cotización en el panel</a></div>'
            . '<p style="color:#475569;font-size:14px;line-height:1.6;margin:0">Cualquier duda, respóndeme este correo o escríbeme por WhatsApp.</p>'
            . '<a href="https://www.imporlan.cl" style="text-decoration:none"><img src="https://www.imporlan.cl/images/correo/firma-jp.jpg" alt="Juan Pablo · Imporlan · +56 9 4021 1459 · www.imporlan.cl" width="460" style="display:block;width:460px;max-width:100%;height:auto;border:0;margin-top:14px"></a>'
            . '</div></body></html>';
    }

    /**
     * Revision of what the admin confirmed in the preview: the saved quote and
     * the recipient. The send is refused if it changed in between, so the
     * client never gets numbers nobody looked at.
     */
    function cotizadorDesgloseRevision(array $row): string {
        return substr(sha1(($row['quote_data'] ?? '') . '|' . ($row['quote_total_clp'] ?? '') . '|' . ($row['customer_email'] ?? '')), 0, 16);
    }

    /**
     * Send the breakdown email. Unlike the "ready" email this one reports
     * back, so the admin sees whether it actually went out. EmailService adds
     * the BCC to jpchs1@gmail.com on its own; the sender shows as
     * «Juan Pablo · Imporlan», as in his other emails to clients.
     */
    function cotizadorSendDesgloseEmail(string $userEmail, string $userName, array $link): array {
        if (!filter_var($userEmail, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'error' => 'El expediente no tiene un email de cliente válido'];
        }
        require_once __DIR__ . '/email_service.php';
        $svc = new EmailService();
        $svc->setFromName('Juan Pablo · Imporlan');
        return $svc->sendCustomEmail(
            $userEmail,
            'Desglose de tu cotización — ' . cotizadorLinkTitle($link),
            cotizadorDesgloseHtml($link, $userName)
        );
    }
}
