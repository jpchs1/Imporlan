<?php
/** Post-survey seller price confirmation. All amounts originate with the operator;
 * never read or mutate the buyer's quotation or payment schedule here. */
require_once __DIR__ . '/inspection_price_template.php';

function opuPriceSchema($pdo) {
    static $ready;
    if ($ready === null) $ready = new WeakMap();
    if (isset($ready[$pdo])) return;
    $engine = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    $pdo->exec("CREATE TABLE IF NOT EXISTS order_usa_inspection_prices (
        request_id INT PRIMARY KEY, status VARCHAR(20) NOT NULL DEFAULT 'pending',
        original_cents BIGINT NULL, confirmed_cents BIGINT NULL, reason TEXT NULL,
        revision INT NOT NULL DEFAULT 0, updated_at DATETIME NULL,
        reviewed_at DATETIME NULL, reviewed_by VARCHAR(255) NULL,
        last_attempt_on VARCHAR(10) NULL, last_sent_at DATETIME NULL
    )$engine");
    $ready[$pdo] = true;
}

function opuPriceEligible($order, $request) {
    return $order && $request && impTieneEleccion($order) && !empty($order['chosen_inspection'])
        && !impExpedienteCerrado($order) && !impInspeccionNoApta($order) && empty($order['refund_requested_at'])
        && intval($order['chosen_link_id']) === intval($request['link_id'])
        && intval($order['id']) === intval($request['order_id'])
        && !isset(impPasos($order)['compra']);
}

function opuPriceState($pdo, $order) {
    $request = opuInspectionLatest($pdo, $order);
    if (!opuPriceEligible($order, $request)) return null;
    opuPriceSchema($pdo);
    $insert = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
    $pdo->prepare("$insert INTO order_usa_inspection_prices (request_id) VALUES (?)")->execute([intval($request['id'])]);
    $st = $pdo->prepare('SELECT * FROM order_usa_inspection_prices WHERE request_id = ?');
    $st->execute([intval($request['id'])]);
    $state = $st->fetch(PDO::FETCH_ASSOC);
    foreach (['original_cents', 'confirmed_cents', 'revision', 'request_id'] as $key) if ($state[$key] !== null) $state[$key] = intval($state[$key]);
    $state['confirmed'] = in_array($state['status'], ['unchanged', 'adjusted'], true);
    $state['ready'] = $state['confirmed'] && !empty($state['reviewed_at']);
    return $state;
}

function opuPriceGate($pdo, $order) {
    $state = opuPriceState($pdo, $order);
    if (!$state || $state['ready']) return null;
    return $state['confirmed']
        ? 'Revisa y valida la confirmación de precio de compra en Operación en EE. UU. antes de continuar.'
        : 'Falta que el coordinador confirme si el precio de compra se mantiene o se reajusta después de la inspección.';
}

/** Exact decimal USD input, no floats or silent thousands/decimal conversion. */
function opuPriceCents($value) {
    if (!is_string($value) || !preg_match('/^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$/D', trim($value))) return null;
    $parts = explode('.', trim($value));
    $cents = intval($parts[0]) * 100 + intval(str_pad($parts[1] ?? '', 2, '0'));
    return $cents > 0 ? $cents : null;
}

function opuPriceSave($pdo, $order, $input) {
    $state = opuPriceState($pdo, $order);
    if (!$state || !is_scalar($input['price_request_id'] ?? null) || intval($input['price_request_id']) !== $state['request_id'] || !is_scalar($input['price_revision'] ?? null) || (string) $state['revision'] !== (string) $input['price_revision']) return ['This price confirmation has changed or is no longer active. Please reopen the page.'];
    $status = $input['price_status'] ?? '';
    if (!is_string($status) || !in_array($status, ['unchanged', 'adjusted', 'negotiating'], true)) return ['Choose whether the price is unchanged, adjusted or still being negotiated.'];
    $reason = $input['price_reason'] ?? '';
    if (!is_string($reason) || mb_strlen(trim($reason)) > 2000 || ($status !== 'unchanged' && mb_strlen(trim($reason)) < 15)) return ['Explain the inspection finding and the agreement or next negotiation step (15–2,000 characters).'];
    $reason = trim($reason);
    $original = $status === 'negotiating' ? null : opuPriceCents($input['price_original'] ?? null);
    $confirmed = $status === 'negotiating' ? null : opuPriceCents($input['price_confirmed'] ?? null);
    if ($status !== 'negotiating' && (!$original || !$confirmed)) return ['Enter both purchase prices in USD, without thousands separators (example: 25000.50).'];
    if ($status === 'unchanged' && $original !== $confirmed) return ['For an unchanged price, both amounts must be the same. Otherwise select price adjusted.'];
    if ($status === 'adjusted' && $original === $confirmed) return ['For an adjusted price, enter different previous and revised amounts.'];
    // Exact repeat is harmless: preserve the team's validation and audit history.
    if ($status === $state['status'] && $original === $state['original_cents'] && $confirmed === $state['confirmed_cents'] && $reason === (string) $state['reason']) return [];
    $st = $pdo->prepare('UPDATE order_usa_inspection_prices SET status = ?, original_cents = ?, confirmed_cents = ?, reason = ?, revision = revision + 1, updated_at = ?, reviewed_at = NULL, reviewed_by = NULL WHERE request_id = ? AND revision = ?');
    $st->execute([$status, $original, $confirmed, $reason, gmdate('Y-m-d H:i:s'), $state['request_id'], $state['revision']]);
    if (!$st->rowCount()) return ['Another update was saved. Please reopen this page before submitting again.'];
    opuLog($pdo, $order['id'], 'inspeccion_precio_actualizado', ['request_id' => $state['request_id'], 'revision' => $state['revision'] + 1, 'status' => $status, 'original_cents' => $original, 'confirmed_cents' => $confirmed, 'reason' => $reason]);
    return [];
}

function opuPriceReview($pdo, $order, $requestId, $revision, $reviewer) {
    if (!is_scalar($requestId) || !is_scalar($revision) || !preg_match('/^[0-9]+$/D', (string) $requestId) || !preg_match('/^[0-9]+$/D', (string) $revision)) return 'La versión de la confirmación no es válida.';
    $state = opuPriceState($pdo, $order);
    if (!$state || $state['request_id'] !== intval($requestId) || $state['revision'] !== intval($revision) || !$state['confirmed']) return 'La confirmación cambió o sigue pendiente. Actualiza y revisa la respuesta vigente.';
    $st = $pdo->prepare("UPDATE order_usa_inspection_prices SET reviewed_at = ?, reviewed_by = ? WHERE request_id = ? AND revision = ? AND status IN ('unchanged','adjusted') AND reviewed_at IS NULL");
    $st->execute([gmdate('Y-m-d H:i:s'), $reviewer, $state['request_id'], $state['revision']]);
    if ($st->rowCount()) opuLog($pdo, $order['id'], 'inspeccion_precio_revisado', ['request_id' => $state['request_id'], 'revision' => $state['revision'], 'reviewer' => $reviewer]);
    elseif (empty($state['reviewed_at'])) return 'La respuesta cambió durante la revisión. Actualiza y revisa la versión vigente.';
    return null;
}

/** Immediate initial request, then one attempt/day AM Chile while unresolved.
 * Atomic claim protects overlapping jobs and uncertain SMTP responses. */
function opuPriceRun($pdo, $now = null, $send = null) {
    opuPriceSchema($pdo);
    $now = $now ?: new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $day = $now->setTimezone(new DateTimeZone('America/Santiago'))->format('Y-m-d');
    $result = ['price_sent' => 0, 'price_failed' => 0];
    $requests = $pdo->query("SELECT * FROM order_usa_upload_requests WHERE status IN ('pending','completed') ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($requests as $request) {
        $order = opuOrden($pdo, $request['order_id']);
        if (!opuPriceEligible($order, $request)) continue;
        $state = opuPriceState($pdo, $order);
        // Only the latest request for the current boat may send.
        if (!$state || $state['request_id'] !== intval($request['id']) || $state['confirmed']) continue;
        if (!opuInspectionDue(array_merge($state, ['status' => 'pending']), $now)) continue;
        $link = impLeerLink($pdo, $order['id'], $request['link_id']);
        if (!$link) continue;
        $st = $pdo->prepare("UPDATE order_usa_inspection_prices SET last_attempt_on = ? WHERE request_id = ? AND status IN ('pending','negotiating') AND (last_attempt_on IS NULL OR last_attempt_on < ?)");
        $st->execute([$day, $state['request_id'], $day]);
        if (!$st->rowCount()) continue;
        $meta = ['event' => 'inspection_price_confirmation', 'order_id' => intval($order['id']), 'request_id' => $state['request_id'], 'link_id' => intval($request['link_id']), 'reminder' => !empty($state['last_attempt_on'])];
        try {
            $mail = opuInspectionPriceEmail(['operator_name' => explode(' ', $request['operator_name'])[0], 'order_number' => $order['order_number'], 'boat' => impTituloLancha($link), 'portal_url' => opuUrlPortal(opuToken($pdo, $order)) . '#purchase-price', 'reminder' => $meta['reminder']]);
            if ($send) $ok = (bool) $send($request['operator_email'], $mail, $meta);
            else {
                require_once __DIR__ . '/email_service.php';
                $sent = (new EmailService())->sendInspectionPriceEmail($request['operator_email'], $mail, $meta);
                $ok = !empty($sent['success']);
            }
        } catch (Throwable $e) { $ok = false; error_log('[inspection-price] send failed for request ' . $state['request_id']); }
        if ($ok) $pdo->prepare('UPDATE order_usa_inspection_prices SET last_sent_at = ? WHERE request_id = ?')->execute([$now->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'), $state['request_id']]);
        opuLog($pdo, $order['id'], $ok ? 'inspeccion_precio_correo' : 'inspeccion_precio_correo_fallido', $meta);
        $result[$ok ? 'price_sent' : 'price_failed']++;
    }
    return $result;
}

function opuPriceAmount($cents) {
    return $cents === null ? '' : sprintf('%d.%02d', intdiv(intval($cents), 100), intval($cents) % 100);
}

function opuPricePortal($pdo, $order, $draft = []) {
    $state = opuPriceState($pdo, $order);
    if (!$state) return '';
    $values = array_merge(['price_status' => $state['status'], 'price_original' => opuPriceAmount($state['original_cents']), 'price_confirmed' => opuPriceAmount($state['confirmed_cents']), 'price_reason' => $state['reason']], $draft);
    $status = $state['ready'] ? 'Reviewed by Imporlan' : ($state['confirmed'] ? 'Received · awaiting team review' : 'Your confirmation is required');
    $html = '<section class="card" id="purchase-price" aria-labelledby="purchase-price-heading"><p class="mute" style="letter-spacing:1px;margin:0 0 6px">POST-INSPECTION · PURCHASE PRICE</p><h2 id="purchase-price-heading">Confirm the purchase price</h2><p class="mute"><strong>' . $status . '</strong></p><p style="font-size:14px">Does any finding in the technical inspection change the price previously agreed with the seller? Record the current situation here, even if the price stays the same. This response is internal to the Imporlan team.</p><form method="post" action="?r=precio&amp;t=' . opuEsc($order['usa_token']) . '#purchase-price">'
        . '<input type="hidden" name="boat_link_id" value="' . intval($order['chosen_link_id']) . '"><input type="hidden" name="price_request_id" value="' . $state['request_id'] . '"><input type="hidden" name="price_revision" value="' . $state['revision'] . '">';
    $html .= '<fieldset style="border:0;padding:0;margin:0 0 16px"><legend style="font-size:14px;font-weight:600;margin-bottom:8px">Current situation</legend>';
    foreach (['unchanged' => 'Price unchanged · confirmed with the seller', 'adjusted' => 'Price adjusted · revised price confirmed with the seller', 'negotiating' => 'Still being negotiated · confirmation pending'] as $key => $label) $html .= '<label style="display:flex;gap:9px;align-items:flex-start;font-weight:400;margin:12px 0"><input type="radio" name="price_status" required value="' . $key . '"' . ($values['price_status'] === $key ? ' checked' : '') . '>' . $label . '</label>';
    $html .= '</fieldset>';
    foreach (['price_original' => 'Previously agreed purchase price (USD)', 'price_confirmed' => 'Current confirmed purchase price (USD)'] as $key => $label) $html .= '<label for="' . $key . '">' . $label . '</label><input id="' . $key . '" name="' . $key . '" type="text" inputmode="decimal" maxlength="11" value="' . opuEsc(is_string($values[$key]) ? $values[$key] : '') . '" placeholder="25000.50" style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;margin-bottom:14px">';
    return $html . '<p class="mute">Use USD with a decimal point and no thousands separators. Both amounts are required for a confirmed price; they must match if unchanged. Leave them blank while negotiation is pending.</p><label for="price_reason">Inspection finding, seller agreement or pending negotiation</label><textarea id="price_reason" name="price_reason" maxlength="2000" placeholder="If adjusted: explain the specific inspection finding and the seller agreement. If pending: explain what is unresolved and when you expect an update.">' . opuEsc(is_string($values['price_reason']) ? $values['price_reason'] : '') . '</textarea><p class="mute">A reason of 15–2,000 characters is required for an adjustment or pending negotiation. Recording a price does not modify the buyer’s quotation or authorize a purchase. Any correction requires a new team review.</p><button type="submit">Save price update</button></form></section>';
}
