<?php
/** State-based, opt-in transactional reminders. No purchase, price, payment or milestone writes. */
require_once __DIR__ . '/operador_usa.php';
require_once __DIR__ . '/import_action_template.php';

function impActionTemplateHash() { return hash('sha256', hash_file('sha256', __FILE__) . hash_file('sha256', __DIR__ . '/import_action_template.php')); }
function impActionOwnerEmail() { return defined('IMPORLAN_WORKFLOW_OWNER_EMAIL') ? IMPORLAN_WORKFLOW_OWNER_EMAIL : 'jpchs1@gmail.com'; }

function impActionSchema($pdo) {
    static $ready;
    if ($ready === null) $ready = new SplObjectStorage();
    if (isset($ready[$pdo])) return;
    $engine = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    $pdo->exec("CREATE TABLE IF NOT EXISTS import_action_settings (id INT PRIMARY KEY, enabled INT NOT NULL DEFAULT 0, template_hash VARCHAR(64) NULL, updated_by VARCHAR(255) NULL, updated_at DATETIME NULL)$engine");
    $pdo->exec("CREATE TABLE IF NOT EXISTS import_action_deliveries (order_id INT NOT NULL, audience VARCHAR(16) NOT NULL, recipient_hash VARCHAR(64) NOT NULL, attempt_on VARCHAR(10) NOT NULL, fingerprint VARCHAR(64) NOT NULL, status VARCHAR(20) NOT NULL, attempted_at DATETIME NOT NULL, sent_at DATETIME NULL, PRIMARY KEY(order_id,audience,recipient_hash,attempt_on))$engine");
    $insert = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
    $pdo->exec("$insert INTO import_action_settings (id) VALUES (1)");
    $ready[$pdo] = true;
}

function impActionSettings($pdo) {
    impActionSchema($pdo);
    $s = $pdo->query('SELECT * FROM import_action_settings WHERE id=1')->fetch(PDO::FETCH_ASSOC);
    return ['enabled' => !empty($s['enabled']) && hash_equals(impActionTemplateHash(), (string) $s['template_hash']), 'template_hash' => impActionTemplateHash(), 'timezone' => 'America/Santiago', 'schedule' => 'Diario, desde las 08:30 hasta las 18:00 de Chile', 'last_changed_at' => $s['updated_at']];
}

function impActionConfigure($pdo, $session, $enabled, $hash) {
    if (!opuPriceCanApprove($session)) return 'Sólo la cuenta principal puede configurar estos correos.';
    if (!is_string($hash) || !hash_equals(impActionTemplateHash(), $hash)) return 'La plantilla cambió. Actualiza la vista previa antes de configurar los recordatorios.';
    impActionSchema($pdo);
    $pdo->prepare('UPDATE import_action_settings SET enabled=?, template_hash=?, updated_by=?, updated_at=? WHERE id=1')->execute([$enabled ? 1 : 0, $hash, $session['email'], gmdate('Y-m-d H:i:s')]);
    return null;
}

function impActionTask($kind, $title, $detail, $button, $url, $extra = []) { return array_merge(compact('kind','title','detail','button','url'), $extra); }

/** Pure planner. Only persisted published charges can be requested; operator proposals never reach the client. */
function impActionPlan($snapshot) {
    $o = $snapshot['order']; $link = $snapshot['link'];
    if (!$o || !$link || !impTieneEleccion($o) || impExpedienteCerrado($o) || isset(impPasos($o)['entrega']) || empty($o['visible_to_client'])) return [];
    if (intval($link['id']) !== intval($o['chosen_link_id']) || intval($link['order_id']) !== intval($o['id'])) return [];
    $email = strtolower(trim((string) ($o['customer_email'] ?? '')));
    $panel = 'https://www.imporlan.cl/panel/#/expedientes?id=' . intval($o['id']);
    $admin = 'https://www.imporlan.cl/panel/admin/#/orders?id=' . intval($o['id']);
    $approved = isset(impPasos($o)['inspeccion']) || !empty($o['inspection_client_ok_at']);
    $client = []; $owner = []; $payments = []; $paid = [];
    foreach ($snapshot['payments'] as $r) {
        if (!impCobroDelExpediente($r, $o['id'], $o['order_number']) || strtolower(trim((string) ($r['user_email'] ?? ''))) !== $email || ($r['status'] ?? '') === 'cancelled') continue;
        $n = intval($r['metadata']['custom_fields']['pago'] ?? 0);
        if (!$n && preg_match('/pago\s*([123])\b/i', $r['title'] ?? '', $m)) $n = intval($m[1]);
        if ($n && ($r['status'] ?? '') === 'paid') $paid[$n] = true;
        $payments[] = ['request' => $r, 'n' => $n];
    }
    usort($payments, function ($a,$b) { return ($a['n'] ?: 99) <=> ($b['n'] ?: 99); });
    if (impInspeccionNoApta($o)) {
        if (empty($o['refund_requested_at'])) $client[] = impActionTask('choice','Elige cómo quieres continuar','Puedes elegir otra lancha de tu ranking o revisar la opción de devolución desde tu expediente.','Ver mis opciones',$panel);
        else $owner[] = impActionTask('refund','Revisar la solicitud de devolución','El cliente solicitó la devolución. Revisa los pagos y los costos de terceros antes de coordinarla.','Revisar solicitud',$admin);
    } else {
        $paymentChosen = false;
        foreach ($payments as $p) {
            $r = $p['request']; $n = $p['n'];
            if (($r['status'] ?? '') !== 'pending' || ($n && isset($paid[$n])) || floatval($r['amount_clp'] ?? 0) <= 0 || empty($r['id'])) continue;
            if (!empty($r['receipt_url']) || !empty($r['voucher_url']) || !empty($r['comprobante_url']) || !empty($r['receipt_received_at'])) {
                $owner[] = impActionTask('receipt','Validar un comprobante de pago','Hay un comprobante registrado y el cobro sigue pendiente. Verifica el ingreso antes de confirmar el pago.','Revisar cobro',$admin);
                $paymentChosen = true; // Wait for validation before asking for a later payment.
                continue;
            }
            if ($paymentChosen) continue;
            $title = $n ? 'Pago ' . $n : 'Pago pendiente';
            $client[] = impActionTask('payment', $title, 'Este pago corresponde a tu operación de compra e importación. Puedes revisar el detalle y elegir el medio de pago en tu panel.', 'Realizar ' . ($n ? 'Pago ' . $n : 'el pago'), 'https://www.imporlan.cl/panel/#/payments?pagar=' . rawurlencode($r['id']), ['payment_id' => $r['id'], 'amount_clp' => intval(round($r['amount_clp']))]);
            $paymentChosen = true; // Keep scanning for receipts requiring an internal review.
        }
        if (empty($snapshot['client_data_complete'])) $client[] = impActionTask('data','Completar tus datos de importación','Necesito tus datos, tu cédula por ambos lados y la aceptación de los términos para comprar e importar a tu nombre. Cárgalos sólo en tu panel seguro.','Completar mis datos',$panel);
        if (!empty($o['chosen_inspection']) && !empty($o['inspection_report_at']) && !$approved) $client[] = impActionTask('inspection','Revisar y decidir sobre la inspección','Lee el reporte y decide si apruebas seguir con la compra o prefieres elegir otra lancha. La decisión se confirma dentro del panel.','Revisar y decidir',$panel);
        $price = $snapshot['price'] ?? null;
        if ($price && !empty($price['confirmed']) && empty($price['ready'])) $owner[] = impActionTask('price','Aprobar o editar el precio de compra','David envió una propuesta interna. Revisa el acuerdo y aprueba o edita el importe desde tu cuenta principal; la propuesta no se publica al cliente.','Revisar propuesta',$admin);
        if (!empty($snapshot['report_received']) && empty($o['inspection_report_at']) && !$approved) $owner[] = impActionTask('report','Revisar y publicar el reporte de inspección','El PDF de la inspección está recibido. Revísalo y regístralo como reporte de la lancha elegida para que el cliente pueda decidir.','Revisar reporte',$admin);
        $steps = impPasos($o);
        foreach ([1,2,3] as $n) {
            $due = $n === 1 || ($n === 2 && (!empty($o['chosen_inspection']) ? isset($steps['inspeccion']) : isset($steps['disponibilidad']))) || ($n === 3 && isset($steps['transporte']));
            if (!$due) continue;
            $found = false; foreach ($payments as $p) if ($p['n'] === $n) $found = true;
            if (!$found && impPlanPago($link,$n)) $owner[] = impActionTask('charge','Revisar la solicitud del Pago ' . $n,'El hito o la elección ya está registrado, pero no hay un cobro vigente de este pago. Revisa el expediente antes de emitirlo.','Revisar cobros',$admin);
        }
        if (empty($link['quote_published_at'])) $owner[] = impActionTask('quote','Revisar la cotización final','La embarcación elegida no tiene una cotización publicada. Revisa el precio y el plan antes de comunicar nuevos importes.','Revisar cotización',$admin);
        $stage = opuHitoEnCurso($o);
        $reply = !empty($o['usa_updated_at']) && !empty($o['usa_requested_at']) && strtotime($o['usa_updated_at']) >= strtotime($o['usa_requested_at']);
        if (($reply && in_array($stage,['disponibilidad','compra','transporte'],true)) || in_array($stage,['aduana','entrega'],true)) {
            $owner[] = impActionTask('milestone','Revisar el siguiente hito de la operación',in_array($stage,['aduana','entrega'],true) ? 'Da seguimiento a la logística en Chile y registra el avance sólo cuando esté confirmado.' : 'Hay una actualización de EE. UU. Revisa la evidencia y registra el hito sólo cuando corresponda.','Revisar avance',$admin);
        }
    }
    $out = [];
    $base = ['order_id'=>intval($o['id']), 'link_id'=>intval($link['id']), 'order_number'=>$o['order_number'], 'boat'=>impTituloLancha($link), 'inspection_approved'=>!empty($o['chosen_inspection']) && $approved];
    if ($client && filter_var($email,FILTER_VALIDATE_EMAIL)) $out[] = array_merge($base, ['audience'=>'client','to'=>$email,'name'=>impNombreSaludo($o) ?: '','tasks'=>$client]);
    if ($owner && filter_var(impActionOwnerEmail(),FILTER_VALIDATE_EMAIL)) $out[] = array_merge($base, ['audience'=>'owner','to'=>impActionOwnerEmail(),'name'=>'Juan Pablo','tasks'=>$owner]);
    return $out;
}

/** Strict reads: a DB failure skips the order rather than inventing missing customer data. */
function impActionPayments() {
    $fp = @fopen(impArchivoCobros(), 'rb');
    if (!$fp) throw new RuntimeException('Payments unavailable');
    try {
        if (!flock($fp, LOCK_SH)) throw new RuntimeException('Payments unavailable');
        $store = json_decode(stream_get_contents($fp),true);
        if (!is_array($store) || !isset($store['requests']) || !is_array($store['requests'])) throw new RuntimeException('Payments unavailable');
        return $store['requests'];
    } finally { flock($fp,LOCK_UN); fclose($fp); }
}

function impActionSnapshot($pdo, $id) {
    $order = opuOrden($pdo,$id);
    if (!$order || !impTieneEleccion($order) || impExpedienteCerrado($order) || empty($order['visible_to_client']) || isset(impPasos($order)['entrega'])) return null;
    $link = impLeerLink($pdo,$id,$order['chosen_link_id']);
    if (!$link) return null;
    $st = $pdo->prepare('SELECT * FROM order_client_data WHERE order_id=?'); $st->execute([$id]);
    $data = $st->fetch(PDO::FETCH_ASSOC) ?: null;
    $payments = impActionPayments();
    $request = opuInspectionLatest($pdo,$order); $received = false;
    if ($request && empty($order['inspection_report_at'])) $received = opuInspectionState($pdo,$request)['requirements']['report']['received'];
    return ['order'=>$order,'link'=>$link,'payments'=>$payments,'client_data_complete'=>impDatosCompletos($data,false),'price'=>opuPriceState($pdo,$order),'report_received'=>$received];
}

function impActionPrepare($plan) {
    $mail = impActionEmail($plan);
    return ['plan'=>$plan, 'mail'=>$mail, 'fingerprint'=>hash('sha256',json_encode([$plan,$mail,impActionTemplateHash()],JSON_UNESCAPED_UNICODE))];
}

function impActionPreview($pdo,$id,$audience='client',$loader=null) {
    $snapshot = $loader ? $loader($id) : impActionSnapshot($pdo,$id);
    if (!$snapshot) return null;
    foreach (impActionPlan($snapshot) as $plan) if ($plan['audience'] === $audience) return impActionPrepare($plan);
    return null;
}

function impActionDelivery($pdo,$prepared,$now=null) {
    if (!$prepared) return null;
    impActionSchema($pdo); $plan=$prepared['plan'];
    $now=$now ?: new DateTimeImmutable('now',new DateTimeZone('UTC'));
    $st=$pdo->prepare('SELECT status,attempted_at,sent_at FROM import_action_deliveries WHERE order_id=? AND audience=? AND recipient_hash=? AND attempt_on=?');
    $st->execute([$plan['order_id'],$plan['audience'],hash('sha256',strtolower($plan['to'])),$now->setTimezone(new DateTimeZone('America/Santiago'))->format('Y-m-d')]);
    return $st->fetch(PDO::FETCH_ASSOC) ?: null;
}

function impActionSend($pdo,$id,$audience,$expected,$now=null,$sender=null,$loader=null) {
    impActionSchema($pdo);
    $now = $now ?: new DateTimeImmutable('now',new DateTimeZone('UTC'));
    $prepared = impActionPreview($pdo,$id,$audience,$loader);
    if (!$prepared || !is_string($expected) || !hash_equals($prepared['fingerprint'],$expected)) return ['sent'=>false,'reason'=>'changed'];
    $plan = $prepared['plan']; $day = $now->setTimezone(new DateTimeZone('America/Santiago'))->format('Y-m-d');
    $recipient = hash('sha256',strtolower($plan['to']));
    $insert = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
    $st = $pdo->prepare("$insert INTO import_action_deliveries (order_id,audience,recipient_hash,attempt_on,fingerprint,status,attempted_at) VALUES (?,?,?,?,?,'reserved',?)");
    $st->execute([$id,$audience,$recipient,$day,$expected,$now->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s')]);
    if (!$st->rowCount()) return ['sent'=>false,'reason'=>'already_attempted'];
    // Re-read after claiming the daily slot. Never send a stale approval or a paid/cancelled charge.
    $fresh = impActionPreview($pdo,$id,$audience,$loader);
    $status = 'skipped';
    if ($fresh && hash_equals($expected,$fresh['fingerprint'])) {
        try {
            if ($sender) $ok = (bool) $sender($plan['to'],$fresh['mail'],$plan);
            else { require_once __DIR__ . '/email_service.php'; $r = (new EmailService())->sendImportActionEmail($plan['to'],$fresh['mail'],['order_id'=>$id,'audience'=>$audience,'fingerprint'=>$expected]); $ok = !empty($r['success']); }
            $status = $ok ? 'sent' : 'failed';
        } catch (Throwable $e) { $status = 'failed'; error_log('[import-actions] send failure for order ' . intval($id)); }
    }
    $pdo->prepare('UPDATE import_action_deliveries SET status=?,sent_at=? WHERE order_id=? AND audience=? AND recipient_hash=? AND attempt_on=?')->execute([$status,$status==='sent'?$now->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'):null,$id,$audience,$recipient,$day]);
    return ['sent'=>$status==='sent','reason'=>$status];
}

function impActionRun($pdo,$now=null,$sender=null,$loader=null) {
    $result = ['action_sent'=>0,'action_failed'=>0];
    if (!impActionSettings($pdo)['enabled']) return $result;
    $now = $now ?: new DateTimeImmutable('now',new DateTimeZone('UTC'));
    $local = $now->setTimezone(new DateTimeZone('America/Santiago'));
    if ($local->format('H:i') < '08:30' || $local->format('H:i') >= '18:00') return $result;
    $ids = $pdo->query("SELECT id FROM orders WHERE chosen_link_id IS NOT NULL AND visible_to_client=1 AND status NOT IN ('completed','expired','canceled','cancelled') ORDER BY id")->fetchAll(PDO::FETCH_COLUMN);
    $deadline = microtime(true)+75; $attempts=0;
    foreach ($ids as $id) {
        if (microtime(true)>$deadline || $attempts>=10) break;
        try {
            $snapshot = $loader ? $loader($id) : impActionSnapshot($pdo,$id);
            if (!$snapshot) continue;
            foreach (impActionPlan($snapshot) as $plan) {
                if ($attempts>=10 || microtime(true)>$deadline) break;
                $prepared=impActionPrepare($plan);
                $r=impActionSend($pdo,$id,$plan['audience'],$prepared['fingerprint'],$now,$sender,$loader);
                if (in_array($r['reason'],['sent','failed'],true)) { $attempts++; $result[$r['sent']?'action_sent':'action_failed']++; }
            }
        } catch (Throwable $e) { $result['action_failed']++; error_log('[import-actions] skipped order ' . intval($id)); }
    }
    return $result;
}
