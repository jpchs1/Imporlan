<?php
/** Post-survey seller price confirmation. All amounts originate with the operator;
 * never read or mutate the buyer's quotation or payment schedule here. */
require_once __DIR__ . '/inspection_price_template.php';

function opuPriceSchema($pdo) {
    static $ready;
    // The public portal runs on PHP 7.4; WeakMap is only available in PHP 8.
    if ($ready === null) $ready = new SplObjectStorage();
    if (isset($ready[$pdo])) return;
    $engine = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    $pdo->exec("CREATE TABLE IF NOT EXISTS order_usa_inspection_prices (
        request_id INT PRIMARY KEY, status VARCHAR(20) NOT NULL DEFAULT 'pending',
        original_cents BIGINT NULL, confirmed_cents BIGINT NULL, reason TEXT NULL,
        revision INT NOT NULL DEFAULT 0, updated_at DATETIME NULL,
        reviewed_at DATETIME NULL, reviewed_by VARCHAR(255) NULL,
        last_attempt_on VARCHAR(10) NULL, last_sent_at DATETIME NULL,
        approved_cents BIGINT NULL, approval_note TEXT NULL, approved_revision INT NULL,
        approval_version INT NOT NULL DEFAULT 0,
        retained_at DATETIME NULL, retained_by VARCHAR(255) NULL, retained_quote_hash VARCHAR(64) NULL
    )$engine");
    $columns = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
        ? array_column($pdo->query('PRAGMA table_info(order_usa_inspection_prices)')->fetchAll(PDO::FETCH_ASSOC), 'name')
        : $pdo->query('SHOW COLUMNS FROM order_usa_inspection_prices')->fetchAll(PDO::FETCH_COLUMN);
    foreach (['approved_cents' => 'BIGINT NULL', 'approval_note' => 'TEXT NULL', 'approved_revision' => 'INT NULL', 'approval_version' => 'INT NOT NULL DEFAULT 0', 'retained_at'=>'DATETIME NULL','retained_by'=>'VARCHAR(255) NULL','retained_quote_hash'=>'VARCHAR(64) NULL'] as $column => $type) {
        if (!in_array($column, $columns, true)) {
            try { $pdo->exec("ALTER TABLE order_usa_inspection_prices ADD COLUMN $column $type"); }
            catch (PDOException $e) {
                // Dos peticiones pueden iniciar la misma migración a la vez.
                if ($e->getCode() !== '42S21' && stripos($e->getMessage(), 'duplicate column') === false) throw $e;
            }
        }
    }
    $ready[$pdo] = true;
}

/** La aprobación comercial pertenece a la cuenta principal configurada, nunca al operador ni a soporte. */
function opuPriceOwnerEmail() {
    if (!defined('IMPORLAN_ADMIN_EMAIL') && file_exists(__DIR__ . '/credentials.php')) require_once __DIR__ . '/credentials.php';
    return strtolower(trim(defined('IMPORLAN_ADMIN_EMAIL') ? IMPORLAN_ADMIN_EMAIL : (getenv('IMPORLAN_ADMIN_EMAIL') ?: 'admin@imporlan.cl')));
}
function opuPriceCanApprove($session) {
    return is_array($session) && ($session['role'] ?? '') === 'admin'
        && hash_equals(opuPriceOwnerEmail(), strtolower(trim((string) ($session['email'] ?? ''))));
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
    foreach (['original_cents', 'confirmed_cents', 'revision', 'request_id', 'approved_cents', 'approved_revision', 'approval_version'] as $key) if ($state[$key] !== null) $state[$key] = intval($state[$key]);
    $state['confirmed'] = in_array($state['status'], ['unchanged', 'adjusted'], true);
    $state['ready'] = $state['confirmed'] && !empty($state['reviewed_at']) && $state['approved_cents'] > 0
        && $state['approved_revision'] === $state['revision']
        && hash_equals(opuPriceOwnerEmail(), strtolower((string) $state['reviewed_by']));
    $state['agreement'] = opuPriceAgreement(impLeerLink($pdo,$order['id'],$order['chosen_link_id']));
    $state['retained'] = !empty($state['retained_at']) && hash_equals(opuPriceOwnerEmail(),strtolower((string)$state['retained_by']));
    if ($state['retained']) $state['ready'] = $state['agreement'] && hash_equals((string)$state['retained_quote_hash'],$state['agreement']['hash']) && $state['approved_cents'] === $state['agreement']['cents'];
    return $state;
}

/** The existing published agreement, never the advertised/list price or a new operator proposal. */
function opuPriceAgreement($link) {
    if (!$link || empty($link['quote_published_at']) || floatval($link['quote_total_clp'] ?? 0)<=0) return null;
    $quote=$link['quote_data'] ?? null; if (is_string($quote)) $quote=json_decode($quote,true);
    $base=is_array($quote) ? ($quote['valor_lancha_usd'] ?? null) : null;
    if (!is_numeric($base) || $base<=0) $base=$link['value_to_negotiate_usd'] ?? null;
    $cents=is_numeric($base) ? opuPriceCents((string)$base) : null;
    if (!$cents) return null;
    $values=[]; foreach (['id','order_id','value_to_negotiate_usd','quote_data','quote_total_clp','quote_total_usd','quote_payments','quote_published_at'] as $key) $values[$key]=$link[$key] ?? null;
    return ['cents'=>$cents,'p2_clp'=>impPlanPago($link,2)['clp'] ?? null,'hash'=>hash('sha256',json_encode($values,JSON_UNESCAPED_UNICODE))];
}

/** Owner exception: keep the actual agreement and stop only this boat's price validation messages. */
function opuPriceRetain($pdo,$order,$input,$session) {
    if (!opuPriceCanApprove($session)) return 'Sólo Juan Pablo puede conservar el acuerdo de precio.';
    $state=opuPriceState($pdo,$order);
    if (!$state || !$state['agreement']) return 'No hay un precio negociado en la cotización publicada que se pueda conservar.';
    if ((string)($input['request_id'] ?? '') !== (string)$state['request_id'] || (string)($input['revision'] ?? '') !== (string)$state['revision'] || (string)($input['approval_version'] ?? '') !== (string)$state['approval_version'] || !is_string($input['agreement_hash'] ?? null) || !hash_equals($state['agreement']['hash'],$input['agreement_hash'])) return 'Cambió el acuerdo o su revisión. Actualiza antes de conservarlo.';
    if ($state['retained'] && $state['ready']) return null;
    $now=gmdate('Y-m-d H:i:s'); $who=strtolower(trim($session['email']));
    $st=$pdo->prepare('UPDATE order_usa_inspection_prices SET retained_at=?,retained_by=?,retained_quote_hash=?,reviewed_at=?,reviewed_by=?,approved_cents=?,approved_revision=revision,approval_note=?,approval_version=approval_version+1 WHERE request_id=? AND revision=? AND approval_version=?');
    $st->execute([$now,$who,$state['agreement']['hash'],$now,$who,$state['agreement']['cents'],'Se conservan los precios previamente acordados; validación y correos de precio desactivados para esta operación.',$state['request_id'],$state['revision'],$state['approval_version']]);
    if (!$st->rowCount()) return 'El precio cambió mientras guardabas. Actualiza la pantalla.';
    opuLog($pdo,$order['id'],'inspeccion_precio_acuerdo_conservado',['request_id'=>$state['request_id'],'link_id'=>intval($order['chosen_link_id']),'approved_cents'=>$state['agreement']['cents'],'reviewer'=>$who]);
    return null;
}

function opuPriceGate($pdo, $order) {
    $state = opuPriceState($pdo, $order);
    if (!$state || $state['ready']) return null;
    if ($state['retained']) return 'Cambió la cotización después de conservar el acuerdo. Juan Pablo debe revisar el precio vigente. Los correos de validación siguen desactivados.';
    return $state['confirmed']
        ? 'La propuesta de precio requiere la aprobación o edición de Juan Pablo en Operación en EE. UU. antes de continuar.'
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
    if ($state && $state['retained']) return ['Juan Pablo has kept the previously agreed prices for this operation. No new price confirmation is requested.'];
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
    $st = $pdo->prepare('UPDATE order_usa_inspection_prices SET status = ?, original_cents = ?, confirmed_cents = ?, reason = ?, revision = revision + 1, updated_at = ?, reviewed_at = NULL, reviewed_by = NULL, approved_cents = NULL, approval_note = NULL, approved_revision = NULL, approval_version = approval_version + 1 WHERE request_id = ? AND revision = ? AND retained_at IS NULL');
    $st->execute([$status, $original, $confirmed, $reason, gmdate('Y-m-d H:i:s'), $state['request_id'], $state['revision']]);
    if (!$st->rowCount()) return ['Another update was saved. Please reopen this page before submitting again.'];
    opuLog($pdo, $order['id'], 'inspeccion_precio_actualizado', ['request_id' => $state['request_id'], 'revision' => $state['revision'] + 1, 'status' => $status, 'original_cents' => $original, 'confirmed_cents' => $confirmed, 'reason' => $reason]);
    return [];
}

function opuPriceReview($pdo, $order, $requestId, $revision, $session, $approvedValue = null, $approvalVersion = null, $note = '') {
    if (!opuPriceCanApprove($session)) return 'Sólo Juan Pablo, desde su cuenta principal, puede aprobar o editar esta propuesta.';
    if (!is_scalar($requestId) || !is_scalar($revision) || !preg_match('/^[0-9]+$/D', (string) $requestId) || !preg_match('/^[0-9]+$/D', (string) $revision)
        || !is_scalar($approvalVersion) || !preg_match('/^[0-9]+$/D', (string) $approvalVersion)) return 'La versión de la propuesta o aprobación no es válida. Actualiza la pantalla.';
    $approved = opuPriceCents($approvedValue);
    if (!$approved) return 'Ingresa el valor que apruebas en USD, con hasta dos decimales.';
    if (!is_string($note) || mb_strlen(trim($note)) > 2000) return 'La nota de aprobación no puede superar 2.000 caracteres.';
    $state = opuPriceState($pdo, $order);
    if (!$state || $state['retained'] || $state['request_id'] !== intval($requestId) || $state['revision'] !== intval($revision) || !$state['confirmed']) return 'La propuesta cambió, se conservó el acuerdo anterior o sigue pendiente. Actualiza y revisa el estado vigente.';
    $reviewer = strtolower(trim($session['email']));
    $st = $pdo->prepare("UPDATE order_usa_inspection_prices SET reviewed_at = ?, reviewed_by = ?, approved_cents = ?, approval_note = ?, approved_revision = revision, approval_version = approval_version + 1 WHERE request_id = ? AND revision = ? AND approval_version = ? AND retained_at IS NULL AND status IN ('unchanged','adjusted')");
    $st->execute([gmdate('Y-m-d H:i:s'), $reviewer, $approved, trim($note), $state['request_id'], $state['revision'], intval($approvalVersion)]);
    if (!$st->rowCount()) return 'La propuesta o su aprobación cambió durante la revisión. Actualiza la pantalla antes de guardar.';
    opuLog($pdo, $order['id'], 'inspeccion_precio_aprobado', [
        'request_id' => $state['request_id'], 'revision' => $state['revision'], 'reviewer' => $reviewer,
        'proposed_cents' => $state['confirmed_cents'], 'approved_cents' => $approved,
        'edited' => $approved !== $state['confirmed_cents'], 'approval_note' => trim($note),
    ]);
    return null;
}

/** Protege también los guardados generales: el operador no cambia precios del comprador;
 * el equipo sólo puede llevar una nueva base de esta operación si JP la aprobó. */
function opuPriceBuyerBaseGuard($pdo, $link, $nextBase, $session = null) {
    $session = $session === null ? requireAdminAuthShared(['admin', 'support', 'agent']) : $session;
    if (($session['role'] ?? '') === 'agent') return 'El coordinador no puede modificar precios ni cotizaciones del cliente. Envía la propuesta para aprobación de Juan Pablo.';
    if (opuPriceCanApprove($session)) return null;
    if (round((float) ($link['value_to_negotiate_usd'] ?? 0), 2) === round((float) $nextBase, 2)) return null;
    $order = opuOrden($pdo, $link['order_id'] ?? 0);
    if (!$order || intval($order['chosen_link_id'] ?? 0) !== intval($link['id'] ?? 0)) return null;
    $state = opuPriceState($pdo, $order);
    if (!$state) return null;
    if (!$state['ready'] || !is_numeric($nextBase) || intval(round((float) $nextBase * 100)) !== $state['approved_cents']) {
        return 'Este valor requiere la aprobación o edición de Juan Pablo. La propuesta del coordinador no se publica directamente.';
    }
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
        if (!$state || $state['retained'] || $state['request_id'] !== intval($request['id']) || $state['confirmed']) continue;
        if (!opuInspectionDue(array_merge($state, ['status' => 'pending']), $now)) continue;
        $link = impLeerLink($pdo, $order['id'], $request['link_id']);
        if (!$link) continue;
        $st = $pdo->prepare("UPDATE order_usa_inspection_prices SET last_attempt_on = ? WHERE request_id = ? AND retained_at IS NULL AND status IN ('pending','negotiating') AND (last_attempt_on IS NULL OR last_attempt_on < ?)");
        $st->execute([$day, $state['request_id'], $day]);
        if (!$st->rowCount()) continue;
        $fresh=opuPriceState($pdo,opuOrden($pdo,$order['id']));
        if (!$fresh || $fresh['retained'] || $fresh['confirmed'] || $fresh['request_id']!==$state['request_id']) continue;
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
    if ($state['retained']) return '<section class="card" id="purchase-price"><h2>Previously agreed price retained</h2><p>Juan Pablo has kept the existing agreement for this operation. Price confirmation emails are disabled. No further price submission is required. Continue with the operational instructions; this does not authorize a purchase.</p></section>';
    $values = array_merge(['price_status' => $state['status'], 'price_original' => opuPriceAmount($state['original_cents']), 'price_confirmed' => opuPriceAmount($state['confirmed_cents']), 'price_reason' => $state['reason']], $draft);
    $status = $state['ready'] ? 'Approved by Juan Pablo' : ($state['confirmed'] ? 'Received · awaiting Juan Pablo approval' : 'Your confirmation is required');
    $html = '<section class="card" id="purchase-price" aria-labelledby="purchase-price-heading"><p class="mute" style="letter-spacing:1px;margin:0 0 6px">POST-INSPECTION · PURCHASE PRICE</p><h2 id="purchase-price-heading">Confirm the purchase price</h2><p class="mute"><strong>' . $status . '</strong></p><p style="font-size:14px">Does any finding in the technical inspection change the price previously agreed with the seller? Record the current situation here, even if the price stays the same. Your submission is an internal proposal only. Juan Pablo must approve or edit it before it can be used. It is not published to the client.</p><form method="post" action="?r=precio&amp;t=' . opuEsc($order['usa_token']) . '#purchase-price">'
        . '<input type="hidden" name="boat_link_id" value="' . intval($order['chosen_link_id']) . '"><input type="hidden" name="price_request_id" value="' . $state['request_id'] . '"><input type="hidden" name="price_revision" value="' . $state['revision'] . '">';
    $html .= '<fieldset style="border:0;padding:0;margin:0 0 16px"><legend style="font-size:14px;font-weight:600;margin-bottom:8px">Current situation</legend>';
    foreach (['unchanged' => 'Price unchanged · confirmed with the seller', 'adjusted' => 'Price adjusted · revised price confirmed with the seller', 'negotiating' => 'Still being negotiated · confirmation pending'] as $key => $label) $html .= '<label style="display:flex;gap:9px;align-items:flex-start;font-weight:400;margin:12px 0"><input type="radio" name="price_status" required value="' . $key . '"' . ($values['price_status'] === $key ? ' checked' : '') . '>' . $label . '</label>';
    $html .= '</fieldset>';
    foreach (['price_original' => 'Previously agreed purchase price (USD)', 'price_confirmed' => 'Current confirmed purchase price (USD)'] as $key => $label) $html .= '<label for="' . $key . '">' . $label . '</label><input id="' . $key . '" name="' . $key . '" type="text" inputmode="decimal" maxlength="11" value="' . opuEsc(is_string($values[$key]) ? $values[$key] : '') . '" placeholder="25000.50" style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;margin-bottom:14px">';
    return $html . '<p class="mute">Use USD with a decimal point and no thousands separators. Both amounts are required for a confirmed price; they must match if unchanged. Leave them blank while negotiation is pending.</p><label for="price_reason">Inspection finding, seller agreement or pending negotiation</label><textarea id="price_reason" name="price_reason" maxlength="2000" placeholder="If adjusted: explain the specific inspection finding and the seller agreement. If pending: explain what is unresolved and when you expect an update.">' . opuEsc(is_string($values['price_reason']) ? $values['price_reason'] : '') . '</textarea><p class="mute">A reason of 15–2,000 characters is required for an adjustment or pending negotiation. Recording a price does not modify the buyer’s quotation or authorize a purchase. Any correction requires a new approval by Juan Pablo. Your submission never publishes a client price.</p><button type="submit">Save price update</button></form></section>';
}
