<?php
/** Completed survey: request actual uploads, independently of approval/payment milestones. */
require_once __DIR__ . '/inspection_upload_template.php';

function opuInspectionSchema($pdo) {
    static $ready;
    // The public portal runs on PHP 7.4; WeakMap is only available in PHP 8.
    if ($ready === null) $ready = new SplObjectStorage();
    if (isset($ready[$pdo])) return;
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
    $pdo->exec("CREATE TABLE IF NOT EXISTS order_usa_upload_exceptions (
        request_id INT NOT NULL, requirement VARCHAR(20) NOT NULL,
        reason TEXT NOT NULL, created_at DATETIME NOT NULL,
        PRIMARY KEY (request_id, requirement)
    )$engine");
    $pdo->exec("CREATE TABLE IF NOT EXISTS order_usa_upload_receipts (
        request_id INT PRIMARY KEY,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        claimed_at DATETIME NULL, sent_at DATETIME NULL
    )$engine");
    $ready[$pdo] = true;
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
        opuInspectionSchema($pdo);
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

/** Category evidence comes from persisted, nonempty files for this request and boat. */
function opuInspectionState($pdo, $request) {
    opuInspectionSchema($pdo);
    $requirements = [];
    foreach (opuInspectionItems() as $key => $item) {
        $requirements[$key] = ['received' => false, 'count' => 0, 'files' => [], 'exception' => null, 'resolved' => false];
    }
    $st = $pdo->prepare('SELECT f.id, f.original_name, f.stored_name, f.category, f.mime_type FROM expediente_files f JOIN order_usa_upload_request_files r ON r.file_id = f.id WHERE r.request_id = ? AND f.order_id = ? AND f.file_size > 0');
    $st->execute([intval($request['id']), intval($request['order_id'])]);
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $file) {
        $path = __DIR__ . '/expediente_files/' . basename($file['stored_name']);
        if (!is_file($path) || filesize($path) <= 0) continue;
        $key = null;
        if ($file['category'] === 'document' && $file['mime_type'] === 'application/pdf') $key = 'report';
        if ($file['category'] === 'image' && strpos($file['mime_type'], 'image/') === 0) $key = 'photos';
        if ($file['category'] === 'video' && strpos($file['mime_type'], 'video/') === 0) $key = 'videos';
        if (!$key) continue;
        $requirements[$key]['files'][] = ['id' => intval($file['id']), 'original_name' => $file['original_name'], 'mime_type' => $file['mime_type']];
        $requirements[$key]['count']++;
        $requirements[$key]['received'] = true;
    }
    $st = $pdo->prepare('SELECT requirement, reason, created_at FROM order_usa_upload_exceptions WHERE request_id = ?');
    $st->execute([intval($request['id'])]);
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $exception) {
        $key = $exception['requirement'];
        if (isset($requirements[$key])) $requirements[$key]['exception'] = ['reason' => $exception['reason'], 'created_at' => $exception['created_at']];
    }
    $received = []; $missing = []; $resolvedCount = 0;
    foreach ($requirements as $key => &$item) {
        $received[$key] = $item['received'];
        $item['resolved'] = $item['received'] || !empty($item['exception']['reason']);
        if ($item['resolved']) $resolvedCount++; else $missing[] = $key;
    }
    unset($item);
    $receivedCount = count(array_filter($received));
    return [
        'id' => intval($request['id']), 'status' => $request['status'],
        'received' => $received, 'requirements' => $requirements, 'missing' => $missing,
        'received_count' => $receivedCount, 'resolved_count' => $resolvedCount,
        'completion_mode' => $resolvedCount === 3 ? ($receivedCount === 3 ? 'files' : 'with_exceptions') : null,
        'last_sent_at' => $request['last_sent_at'] ?? null, 'timezone' => 'America/Santiago',
    ];
}

function opuInspectionReceived($pdo, $request) {
    return opuInspectionState($pdo, $request)['received'];
}

/** Validate all reasons before saving any files or reasons. A general note never
 * substitutes for an explicit, scoped unavailability declaration. */
function opuInspectionExceptionErrors($pdo, $order, $requestId, $reasons) {
    if (!$reasons) return [];
    if (!is_array($reasons)) return ['Choose the unavailable file type and enter its reason.'];
    $request = opuInspectionLatest($pdo, $order);
    if (!$request || intval($request['id']) !== intval($requestId) || impExpedienteCerrado($order) || !empty($order['refund_requested_at']) || empty($order['chosen_inspection'])) {
        return ['This inspection request is no longer active. Please reopen your private upload page.'];
    }
    $errors = [];
    foreach ($reasons as $key => $reason) {
        if (!isset(opuInspectionItems()[$key])) { $errors[] = 'Unknown inspection requirement.'; continue; }
        if (!is_string($reason) || mb_strlen(trim($reason)) < 15 || mb_strlen(trim($reason)) > 2000) {
            $errors[] = opuInspectionItems()[$key][0] . ': explain why it is unavailable (15 to 2,000 characters).';
        }
    }
    return $errors;
}

function opuInspectionSaveExceptions($pdo, $order, $requestId, $reasons) {
    $errors = opuInspectionExceptionErrors($pdo, $order, $requestId, $reasons);
    if ($errors || !$reasons) return $errors;
    $request = opuInspectionLatest($pdo, $order);
    $state = opuInspectionState($pdo, $request);
    foreach ($reasons as $key => $reason) {
        if ($state['requirements'][$key]['received']) continue;
        $reason = trim($reason);
        $old = $state['requirements'][$key]['exception']['reason'] ?? null;
        if ($reason === $old) continue;
        $insert = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
            ? 'INSERT INTO order_usa_upload_exceptions (request_id, requirement, reason, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(request_id, requirement) DO UPDATE SET reason=excluded.reason, created_at=excluded.created_at'
            : 'INSERT INTO order_usa_upload_exceptions (request_id, requirement, reason, created_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE reason=VALUES(reason), created_at=VALUES(created_at)';
        $pdo->prepare($insert)->execute([intval($requestId), $key, $reason, gmdate('Y-m-d H:i:s')]);
        opuLog($pdo, $order['id'], 'inspeccion_requisito_no_disponible', ['request_id' => intval($requestId), 'requirement' => $key, 'reason' => $reason, 'previous_reason' => $old]);
    }
    if (opuInspectionFinish($pdo, $request)) opuInspectionAcknowledge($pdo, $request['id']);
    return [];
}

/** A note or a pasted link never satisfies a required uploaded file. */
function opuInspectionAttach($pdo, $order, $requestId, $files) {
    if (!$requestId || !$files) return;
    $request = opuInspectionLatest($pdo, $order);
    if (!$request || intval($request['id']) !== intval($requestId) || impExpedienteCerrado($order) || !empty($order['refund_requested_at'])) return;
    $insert = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
    foreach ($files as $file) {
        $st = $pdo->prepare('SELECT id FROM expediente_files WHERE id = ? AND order_id = ? AND uploaded_by = ?');
        $st->execute([intval($file['id']), intval($order['id']), 'operador_usa']);
        if (!$st->fetchColumn()) continue;
        $pdo->prepare("$insert INTO order_usa_upload_request_files (request_id, file_id) VALUES (?, ?)")->execute([intval($requestId), intval($file['id'])]);
    }
    if (opuInspectionFinish($pdo, $request)) opuInspectionAcknowledge($pdo, $request['id']);
}

function opuInspectionFinish($pdo, $request) {
    $state = opuInspectionState($pdo, $request);
    if ($state['missing']) return false;
    $st = $pdo->prepare("UPDATE order_usa_upload_requests SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'pending'");
    $st->execute([gmdate('Y-m-d H:i:s'), intval($request['id'])]);
    if ($st->rowCount()) opuLog($pdo, $request['order_id'], $state['completion_mode'] === 'files' ? 'inspeccion_archivos_completos' : 'inspeccion_entrega_resuelta_con_motivos', ['request_id' => intval($request['id']), 'received' => $state['received'], 'completion_mode' => $state['completion_mode']]);
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
    $state = opuInspectionState($pdo, $request);
    if ($state['missing']) return null;
    $link = impLeerLink($pdo, $order['id'], $request['link_id']);
    if (!$link) return null;
    $claim = $pdo->prepare("UPDATE order_usa_upload_receipts SET status = 'sending', claimed_at = ? WHERE request_id = ? AND status = 'pending'");
    $claim->execute([gmdate('Y-m-d H:i:s'), intval($requestId)]);
    if (!$claim->rowCount()) return null;
    $metadata = ['completion_mode' => $state['completion_mode'], 'received' => $state['received'], 'event' => 'inspection_upload_received', 'order_id' => intval($order['id']), 'request_id' => intval($requestId), 'link_id' => intval($request['link_id'])];
    try {
        $mail = opuInspectionThankYouEmail(array_merge($state, [
            'boat' => impTituloLancha($link), 'order_number' => $order['order_number'],
            'portal_url' => opuUrlPortal(opuToken($pdo, $order)),
            'operator_name' => explode(' ', $request['operator_name'])[0],
            'image_url' => $link['image_url'] ?? '', 'location' => $link['location'] ?? '', 'hours' => $link['hours'] ?? '',
        ]));
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
        $state = opuInspectionState($pdo, $request);
        $mail = opuInspectionEmail(array_merge($state, [
            'boat' => impTituloLancha($link), 'order_number' => $order['order_number'],
            'portal_url' => opuUrlPortal(opuToken($pdo, $order)),
            'operator_name' => explode(' ', $request['operator_name'])[0],
            'image_url' => $link['image_url'] ?? '', 'location' => $link['location'] ?? '', 'hours' => $link['hours'] ?? '',
            'reminder' => !empty($request['last_attempt_on']),
        ]));
        $metadata = ['order_id' => intval($order['id']), 'request_id' => intval($request['id']), 'link_id' => intval($request['link_id']), 'reminder' => !empty($request['last_attempt_on']), 'missing' => $state['missing'], 'received' => $state['received']];
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

/** Internal-only status for each upload notice; never reused in client emails. */
function opuInspectionStaffSummary($pdo, $order) {
    $request = opuInspectionLatest($pdo, $order);
    if (!$request) return '';
    $state = opuInspectionState($pdo, $request);
    $labels = ['report' => 'Informe PDF', 'photos' => 'Fotos', 'videos' => 'Videos'];
    $html = '<h3 style="font-size:16px;margin:18px 0 8px">Antecedentes de inspección · ' . $state['resolved_count'] . '/3 requisitos resueltos</h3><ul style="padding-left:20px;font-size:14px;line-height:1.7">';
    foreach ($state['requirements'] as $key => $item) {
        $html .= '<li><strong>' . $labels[$key] . '</strong>: ';
        if ($item['received']) {
            $html .= 'Recibido · ' . $item['count'] . ' archivo(s)';
            $names = array_slice(array_column($item['files'], 'original_name'), 0, 4);
            $html .= ' (' . implode(', ', array_map('opuEsc', $names)) . (count($item['files']) > 4 ? ', …' : '') . ')';
        } elseif ($item['exception']) {
            $html .= 'No disponible · motivo registrado: ' . opuEsc($item['exception']['reason']);
        } else {
            $html .= 'Pendiente · se solicita en el próximo aviso diario AM';
        }
        $html .= '</li>';
    }
    return $html . '</ul><p style="font-size:13px;color:#64748b">' . ($state['missing'] ? 'Se solicitan sólo los requisitos que faltan, una vez al día entre 08:00 y 12:00 de Chile.' : 'Entrega resuelta; recordatorios detenidos. El equipo puede continuar la revisión. Esto no aprueba la inspección ni autoriza pagos o compra.') . '</p>';
}

function opuInspectionPortalChecklist($pdo, $order) {
    $request = opuInspectionLatest($pdo, $order);
    if (!$request) return '';
    $state = opuInspectionState($pdo, $request);
    $done = $request['status'] === 'completed';
    $exceptions = $state['completion_mode'] === 'with_exceptions';
    $heading = !$done ? 'Upload the inspection package' : ($exceptions ? 'Inspection requirements resolved' : 'Inspection package received');
    $intro = !$done
        ? 'The survey has already taken place. Upload each missing file type, or explicitly explain why it is not available. You can send files in separate updates.'
        : ($exceptions ? 'Thank you. The available files and your unavailability reasons are recorded. Reminders have stopped; the Imporlan team can continue the review.' : 'Thank you. The report, photos and videos are in the system. Reminders have stopped; the Imporlan team will review the findings.');
    $html = '<section class="card" aria-labelledby="inspection-uploads"><p class="mute" style="letter-spacing:1px;margin:0 0 6px">INSPECTION COMPLETED · REQUIREMENTS ' . ($done ? 'RESOLVED' : 'PENDING') . '</p><h2 id="inspection-uploads">' . $heading . '</h2><p style="font-size:14px">' . $intro . '</p><p class="mute"><strong>' . $state['received_count'] . ' of 3 file types received · ' . $state['resolved_count'] . ' of 3 requirements resolved</strong></p><ul style="list-style:none;padding:0;margin:0">';
    foreach (opuInspectionItems() as $key => $item) {
        $status = $state['requirements'][$key];
        $label = $status['received'] ? 'Received · ' . $status['count'] . ' file(s)' : ($status['exception'] ? 'Not available · reason recorded' : 'To upload');
        $html .= '<li style="padding:12px 0;border-top:1px solid #e2e8f0;font-size:14px"><strong>' . opuEsc($item[0]) . '</strong><br><span style="color:' . ($status['received'] ? '#047857' : '#805719') . '">' . $label . '</span><br><span class="mute">' . opuEsc($item[1]) . '</span>';
        if ($status['received']) {
            $html .= '<ul class="mute" style="padding-left:20px;margin:6px 0">';
            foreach (array_slice($status['files'], 0, 4) as $file) $html .= '<li>' . opuEsc($file['original_name']) . '</li>';
            $html .= '</ul>';
        } elseif ($status['exception']) {
            $html .= '<p class="mute" style="margin:6px 0;white-space:pre-wrap">Reason: ' . opuEsc($status['exception']['reason']) . '</p>';
        }
        $html .= '</li>';
    }
    $hint = $done ? 'Recorded reasons remain available on this checklist. You can still upload additional material if it becomes available.' : 'Daily morning reminders ask only for unresolved requirements. A reason must be saved using the unavailable-file option below; a general note or emailed attachment does not resolve a requirement.';
    return $html . '</ul><p class="mute">' . $hint . ' Resolving this checklist does not approve the inspection or authorize a purchase.</p></section>';
}

/** Explicit declarations live inside the authenticated-by-token multipart form. */
function opuInspectionExceptionFields($pdo, $order) {
    $request = opuInspectionActive($pdo, $order);
    if (!$request) return '';
    $state = opuInspectionState($pdo, $request);
    $html = '<fieldset style="margin:18px 0 0;padding:16px;border:1px solid #cbd5e1;border-radius:10px"><legend style="font-weight:600;font-size:14px;padding:0 5px">A file is not available?</legend><p class="mute" style="margin-top:0">Select only what you cannot supply and explain why (15–2,000 characters). Your reason is recorded for the Imporlan team and resolves that requirement so the review can continue. It does not mean the file was received.</p>';
    foreach (opuInspectionItems() as $key => $item) {
        if ($state['requirements'][$key]['received']) continue;
        $reason = $state['requirements'][$key]['exception']['reason'] ?? '';
        $html .= '<details style="border-top:1px solid #e2e8f0;padding:12px 0"><summary style="cursor:pointer;font-size:14px">' . opuEsc($item[0]) . '</summary><label style="display:flex;gap:8px;align-items:flex-start;margin-top:12px"><input type="checkbox" name="unavailable[]" value="' . $key . '" style="margin-top:4px">I cannot provide ' . strtolower(opuEsc($item[0])) . '</label><label class="mute" for="reason-' . $key . '">Why is it unavailable?</label><textarea id="reason-' . $key . '" name="unavailable_reason[' . $key . ']" minlength="15" maxlength="2000" style="min-height:90px" placeholder="Explain what is missing and why, or whether it was not recorded.">' . opuEsc($reason) . '</textarea></details>';
    }
    return $html . '</fieldset>';
}
