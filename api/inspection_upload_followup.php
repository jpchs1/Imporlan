<?php
/** Completed survey: request actual uploads, independently of approval/payment milestones. */
require_once __DIR__ . '/inspection_upload_template.php';

function opuInspectionSchema($pdo) {
    $sqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
    $id = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
    $engine = $sqlite ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    $pdo->exec("CREATE TABLE IF NOT EXISTS order_usa_upload_requests (
        id $id, order_id INT NOT NULL, link_id INT NOT NULL,
        request_key VARCHAR(120) NOT NULL UNIQUE,
        operator_name VARCHAR(100) NOT NULL, operator_email VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL, last_sent_at DATETIME NULL,
        last_attempt_on VARCHAR(10) NULL, completed_at DATETIME NULL
    )$engine");
    $pdo->exec("CREATE TABLE IF NOT EXISTS order_usa_upload_request_files (
        request_id INT NOT NULL, file_id INT NOT NULL,
        PRIMARY KEY (request_id, file_id)
    )$engine");
    $pdo->exec("CREATE TABLE IF NOT EXISTS order_usa_upload_receipts (
        request_id INT PRIMARY KEY,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        claimed_at DATETIME NULL, sent_at DATETIME NULL
    )$engine");
}

function opuInspectionRequest($pdo, $order, $operator = null, $key = null) {
    if (!impTieneEleccion($order) || empty($order['chosen_inspection']) || impExpedienteCerrado($order) || !empty($order['refund_requested_at'])) return null;
    opuInspectionSchema($pdo);
    $key = $key ?: 'inspection:' . intval($order['id']) . ':' . intval($order['chosen_link_id']);
    $st = $pdo->prepare('SELECT * FROM order_usa_upload_requests WHERE request_key = ?');
    $st->execute([$key]);
    if ($existing = $st->fetch(PDO::FETCH_ASSOC)) return $existing;
    $operator = $operator ?: opuOperador();
    if (!filter_var($operator['email'] ?? '', FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('Invalid operator email');
    $pdo->prepare('INSERT INTO order_usa_upload_requests (order_id, link_id, request_key, operator_name, operator_email, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([intval($order['id']), intval($order['chosen_link_id']), $key, $operator['nombre'], $operator['email'], gmdate('Y-m-d H:i:s')]);
    $st->execute([$key]);
    $request = $st->fetch(PDO::FETCH_ASSOC);
    opuLog($pdo, $order['id'], 'inspeccion_carga_solicitada', ['request_id' => intval($request['id']), 'link_id' => intval($order['chosen_link_id'])]);
    return $request;
}

function opuInspectionActive($pdo, $order) {
    $request = opuInspectionLatest($pdo, $order);
    return $request && $request['status'] === 'pending' ? $request : null;
}

function opuInspectionLatest($pdo, $order) {
    try {
        $st = $pdo->prepare("SELECT * FROM order_usa_upload_requests WHERE order_id = ? AND link_id = ? AND status IN ('pending', 'completed') ORDER BY id DESC LIMIT 1");
        $st->execute([intval($order['id']), intval($order['chosen_link_id'] ?? 0)]);
        return $st->fetch(PDO::FETCH_ASSOC) ?: null;
    } catch (PDOException $e) {
        // Existing portals keep working until the CLI creates the new tables.
        return null;
    }
}

function opuInspectionOwnsStage($pdo, $order) {
    $request = opuInspectionLatest($pdo, $order);
    return $request && ($request['status'] === 'pending' || in_array(opuHitoEnCurso($order), ['disponibilidad', 'inspeccion'], true));
}

/** Count only persisted files explicitly submitted for this request and boat. */
function opuInspectionReceived($pdo, $request) {
    $st = $pdo->prepare('SELECT f.category, f.mime_type FROM expediente_files f JOIN order_usa_upload_request_files r ON r.file_id = f.id WHERE r.request_id = ? AND f.order_id = ? AND f.file_size > 0');
    $st->execute([intval($request['id']), intval($request['order_id'])]);
    $received = ['report' => false, 'photos' => false, 'videos' => false];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $f) {
        if ($f['category'] === 'document' && $f['mime_type'] === 'application/pdf') $received['report'] = true;
        if ($f['category'] === 'image' && strpos($f['mime_type'], 'image/') === 0) $received['photos'] = true;
        if ($f['category'] === 'video' && strpos($f['mime_type'], 'video/') === 0) $received['videos'] = true;
    }
    return $received;
}

/** A note or a pasted link never satisfies a required uploaded file. */
function opuInspectionAttach($pdo, $order, $requestId, $files) {
    if (!$requestId || !$files) return;
    $request = opuInspectionActive($pdo, $order);
    if (!$request || intval($request['id']) !== intval($requestId)) return;
    foreach ($files as $file) {
        $st = $pdo->prepare('SELECT id FROM expediente_files WHERE id = ? AND order_id = ? AND uploaded_by = ?');
        $st->execute([intval($file['id']), intval($order['id']), 'operador_usa']);
        if (!$st->fetchColumn()) continue;
        $pdo->prepare('INSERT INTO order_usa_upload_request_files (request_id, file_id) VALUES (?, ?)')->execute([intval($requestId), intval($file['id'])]);
    }
    if (opuInspectionFinish($pdo, $request)) opuInspectionAcknowledge($pdo, $request['id']);
}

function opuInspectionFinish($pdo, $request) {
    $received = opuInspectionReceived($pdo, $request);
    if (in_array(false, $received, true)) return false;
    $st = $pdo->prepare("UPDATE order_usa_upload_requests SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'pending'");
    $st->execute([gmdate('Y-m-d H:i:s'), intval($request['id'])]);
    if ($st->rowCount()) opuLog($pdo, $request['order_id'], 'inspeccion_archivos_completos', ['request_id' => intval($request['id'])]);
    opuInspectionQueueReceipt($pdo, $request['id']);
    return true;
}

/** Durable receipt outbox, including completed uploads from before this release. */
function opuInspectionQueueReceipt($pdo, $requestId) {
    opuInspectionSchema($pdo);
    $insert = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
    $pdo->prepare("$insert INTO order_usa_upload_receipts (request_id) SELECT id FROM order_usa_upload_requests WHERE id = ? AND status = 'completed'")->execute([intval($requestId)]);
}

/** One acknowledgement per completed request, addressed only to its operator. */
function opuInspectionAcknowledge($pdo, $requestId, $send = null) {
    $st = $pdo->prepare("SELECT r.* FROM order_usa_upload_requests r JOIN order_usa_upload_receipts a ON a.request_id = r.id WHERE r.id = ? AND r.status = 'completed' AND a.status = 'pending'");
    $st->execute([intval($requestId)]);
    $request = $st->fetch(PDO::FETCH_ASSOC);
    if (!$request) return null;
    $order = opuOrden($pdo, $request['order_id']);
    if (!$order || impExpedienteCerrado($order) || !empty($order['refund_requested_at']) || intval($order['chosen_link_id'] ?? 0) !== intval($request['link_id'])) {
        $pdo->prepare("UPDATE order_usa_upload_receipts SET status = 'cancelled' WHERE request_id = ? AND status = 'pending'")->execute([intval($requestId)]);
        return null;
    }
    // Recheck persisted files before thanking anyone for a complete package.
    if (in_array(false, opuInspectionReceived($pdo, $request), true)) return null;
    $link = impLeerLink($pdo, $order['id'], $request['link_id']);
    if (!$link) return null;
    $claim = $pdo->prepare("UPDATE order_usa_upload_receipts SET status = 'sending', claimed_at = ? WHERE request_id = ? AND status = 'pending'");
    $claim->execute([gmdate('Y-m-d H:i:s'), intval($requestId)]);
    if (!$claim->rowCount()) return null;
    $metadata = ['event' => 'inspection_upload_received', 'order_id' => intval($order['id']), 'request_id' => intval($requestId), 'link_id' => intval($request['link_id'])];
    try {
        $mail = opuInspectionThankYouEmail([
            'boat' => impTituloLancha($link), 'order_number' => $order['order_number'],
            'portal_url' => opuUrlPortal(opuToken($pdo, $order)),
            'operator_name' => explode(' ', $request['operator_name'])[0],
            'image_url' => $link['image_url'] ?? '', 'location' => $link['location'] ?? '', 'hours' => $link['hours'] ?? '',
        ]);
        if ($send) $ok = (bool) $send($request['operator_email'], $mail, $metadata);
        else {
            require_once __DIR__ . '/email_service.php';
            $result = (new EmailService())->sendInspectionUploadEmail($request['operator_email'], $mail, $metadata);
            $ok = !empty($result['success']);
        }
    } catch (Throwable $e) {
        $ok = false;
        error_log('[inspection-upload] acknowledgement failed for request ' . intval($requestId));
    }
    // Never automatically repeat a claimed send after an uncertain SMTP result.
    $pdo->prepare('UPDATE order_usa_upload_receipts SET status = ?, sent_at = ? WHERE request_id = ?')
        ->execute([$ok ? 'sent' : 'failed', $ok ? gmdate('Y-m-d H:i:s') : null, intval($requestId)]);
    opuLog($pdo, $order['id'], $ok ? 'inspeccion_carga_agradecida' : 'inspeccion_carga_agradecimiento_fallido', $metadata);
    return $ok;
}

function opuInspectionDrainReceipts($pdo, $send = null) {
    $result = ['sent' => 0, 'failed' => 0];
    $requests = $pdo->query("SELECT r.id FROM order_usa_upload_requests r LEFT JOIN order_usa_upload_receipts a ON a.request_id = r.id WHERE r.status = 'completed' AND (a.request_id IS NULL OR a.status = 'pending') ORDER BY r.id LIMIT 50")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($requests as $id) {
        opuInspectionQueueReceipt($pdo, $id);
        $ok = opuInspectionAcknowledge($pdo, $id, $send);
        if ($ok === true) $result['sent']++;
        if ($ok === false) $result['failed']++;
    }
    return $result;
}

/** Local Chile calendar day, including DST. First request goes immediately. */
function opuInspectionDue($request, DateTimeImmutable $now) {
    $local = $now->setTimezone(new DateTimeZone('America/Santiago'));
    if (($request['status'] ?? '') !== 'pending' || ($request['last_attempt_on'] ?? '') === $local->format('Y-m-d')) return false;
    if (empty($request['last_sent_at']) && empty($request['last_attempt_on'])) return true;
    return intval($local->format('G')) >= 8 && intval($local->format('G')) < 12;
}

/** CLI bootstrap authorized by JP on 23-Oct-2026. No client data or private link in git. */
function opuInspectionBootstrap($pdo) {
    $st = $pdo->prepare('SELECT * FROM orders WHERE order_number = ?');
    $st->execute(['IMP-00035']);
    $order = $st->fetch(PDO::FETCH_ASSOC);
    if (!$order) return null;
    $link = impLeerLink($pdo, $order['id'], $order['chosen_link_id'] ?? 0);
    $title = strtolower(impTituloLancha($link));
    foreach (['chaparral', '21', 'sport', 'h2o', '2015'] as $part) {
        if (strpos($title, $part) === false) return null; // never chase a replacement boat
    }
    return opuInspectionRequest($pdo, $order, null, 'inspection-upload-2026-10-23:IMP-00035');
}

/** Safe to invoke every five minutes; one attempt per request per Chile day. */
function opuInspectionRun($pdo, $now = null, $send = null, $sendReceipt = null) {
    $now = $now ?: new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $localDay = $now->setTimezone(new DateTimeZone('America/Santiago'))->format('Y-m-d');
    $utc = $now->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    $result = ['sent' => 0, 'completed' => 0, 'cancelled' => 0, 'failed' => 0];
    $requests = $pdo->query("SELECT * FROM order_usa_upload_requests WHERE status = 'pending' ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($requests as $request) {
        $order = opuOrden($pdo, $request['order_id']);
        if (!$order || impExpedienteCerrado($order) || !empty($order['refund_requested_at']) || intval($order['chosen_link_id'] ?? 0) !== intval($request['link_id'])) {
            $pdo->prepare("UPDATE order_usa_upload_requests SET status = 'cancelled' WHERE id = ? AND status = 'pending'")->execute([intval($request['id'])]);
            $result['cancelled']++;
            continue;
        }
        if (opuInspectionFinish($pdo, $request)) { $result['completed']++; continue; }
        if (!opuInspectionDue($request, $now)) continue;
        $link = impLeerLink($pdo, $order['id'], $request['link_id']);
        if (!$link) continue;
        // Atomic day claim: overlapping cron/manual runs and uncertain SMTP results cannot duplicate it.
        $claim = $pdo->prepare("UPDATE order_usa_upload_requests SET last_attempt_on = ? WHERE id = ? AND status = 'pending' AND (last_attempt_on IS NULL OR last_attempt_on < ?)");
        $claim->execute([$localDay, intval($request['id']), $localDay]);
        if (!$claim->rowCount()) continue;
        $mail = opuInspectionEmail([
            'boat' => impTituloLancha($link), 'order_number' => $order['order_number'],
            'portal_url' => opuUrlPortal(opuToken($pdo, $order)),
            'operator_name' => explode(' ', $request['operator_name'])[0],
            'image_url' => $link['image_url'] ?? '', 'location' => $link['location'] ?? '', 'hours' => $link['hours'] ?? '',
            'received' => opuInspectionReceived($pdo, $request), 'reminder' => !empty($request['last_attempt_on']),
        ]);
        $metadata = ['order_id' => intval($order['id']), 'request_id' => intval($request['id']), 'link_id' => intval($request['link_id']), 'reminder' => !empty($request['last_attempt_on'])];
        try {
            if ($send) {
                $ok = (bool) $send($request['operator_email'], $mail, $metadata);
            } else {
                require_once __DIR__ . '/email_service.php';
                $sent = (new EmailService())->sendInspectionUploadEmail($request['operator_email'], $mail, $metadata);
                $ok = !empty($sent['success']);
            }
        } catch (Throwable $e) {
            $ok = false;
            error_log('[inspection-upload] send failed for request ' . intval($request['id']));
        }
        if ($ok) {
            $pdo->prepare('UPDATE order_usa_upload_requests SET last_sent_at = ? WHERE id = ?')->execute([$utc, intval($request['id'])]);
            $pdo->prepare('UPDATE orders SET usa_requested_at = ?, usa_link_id = ? WHERE id = ?')->execute([$utc, intval($request['link_id']), intval($order['id'])]);
            opuLog($pdo, $order['id'], 'inspeccion_carga_correo', $metadata);
            $result['sent']++;
        } else {
            opuLog($pdo, $order['id'], 'inspeccion_carga_correo_fallido', $metadata);
            $result['failed']++;
        }
    }
    $receipts = opuInspectionDrainReceipts($pdo, $sendReceipt);
    $result['acknowledged'] = $receipts['sent'];
    $result['failed'] += $receipts['failed'];
    return $result;
}

function opuInspectionPortalChecklist($pdo, $order) {
    $request = opuInspectionLatest($pdo, $order);
    if (!$request) return '';
    $received = opuInspectionReceived($pdo, $request);
    $done = $request['status'] === 'completed';
    $html = '<section class="card" aria-labelledby="inspection-uploads"><p class="mute" style="letter-spacing:1px;margin:0 0 6px">INSPECTION COMPLETED · FILES ' . ($done ? 'RECEIVED' : 'PENDING') . '</p><h2 id="inspection-uploads">' . ($done ? 'Inspection package received' : 'Upload the inspection package') . '</h2><p style="font-size:14px">' . ($done ? 'Thank you. The report, photos and videos are in the system. Reminders have stopped; the Imporlan team will review the findings.' : 'The survey has already taken place. Please upload each file type below; you can send them in separate updates.') . '</p><ul style="list-style:none;padding:0;margin:0">';
    foreach (opuInspectionItems() as $key => $item) {
        $html .= '<li style="padding:10px 0;border-top:1px solid #e2e8f0;font-size:14px"><strong>' . opuEsc($item[0]) . '</strong> · ' . (!empty($received[$key]) ? 'Received' : 'To upload') . '<br><span class="mute">' . opuEsc($item[1]) . '</span></li>';
    }
    return $html . '</ul><p class="mute">Reminders stop after the report, photos and videos are uploaded. Notes and emailed attachments do not mark an upload as complete.</p></section>';
}
