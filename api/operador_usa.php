<?php
/**
 * Operación en Estados Unidos: actualizaciones de David Morris.
 *
 * JP, 21-oct-2026: «puedes ir solicitándole vía mail a David Morris, quien
 * está a cargo de las operaciones de USA, la actualización continua durante
 * el proceso, y que vaya adjuntando imágenes y videos según corresponda para
 * agregarlos al expediente de importación, y tanto el cliente como nosotros
 * desde el admin podamos estar informados. Lo que sí: no debe existir
 * comunicación alguna entre David y el cliente.»
 *
 * Cómo funciona:
 *   - A David le llegan correos (en inglés) pidiéndole la actualización que
 *     toca en cada momento, con un link privado del expediente (sin usuario ni
 *     clave, uno por expediente, revocable).
 *   - En ese link escribe una nota y sube fotos, videos o documentos.
 *   - Fotos y videos entran al expediente y el cliente los ve (sin saber de
 *     David). Las notas y los documentos quedan internos: el equipo los ve en
 *     el admin y decide qué compartir con el cliente, en español.
 *   - Los correos salen solos: al elegir la lancha, al entrar el Pago 1, al
 *     marcar cada hito del lado de EE. UU., y un recordatorio si pasan días
 *     sin novedades. El equipo también puede pedir una actualización a mano.
 *
 * Aislamiento: el link y los correos a David no traen nombre, correo ni
 * teléfono del cliente, ni precios. El rol «agent» del admin tampoco ve el
 * contacto del cliente ni tiene chat (ver ocultarContactoParaAgente()).
 *
 * Endpoint: /api/operador_usa.php?r=…
 *   portal (GET, ?t=)          página de David
 *   enviar (POST, ?t=)         su actualización (nota + archivos)
 *   admin_estado (GET)         feed y estado, para el admin
 *   admin_pedir (POST)         pedirle una actualización ahora
 *   admin_compartir (POST)     compartir una actualización con el cliente
 *   admin_nuevo_link (POST)    revocar el link y crear otro
 */

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/auth_helper.php';
require_once __DIR__ . '/eleccion_lancha.php';
require_once __DIR__ . '/inspection_upload_followup.php';
require_once __DIR__ . '/inspection_price_followup.php';

/** Quién lleva la operación en EE. UU. */
function opuOperador() {
    return ['nombre' => 'David Morris', 'email' => 'ddm4me25@gmail.com'];
}

/** Días sin novedades antes de recordarle. */
define('OPU_DIAS_RECORDATORIO', 4);

/** Hitos que dependen de EE. UU. (después de éstos, lo hace el equipo en Chile). */
function opuHitosUsa() {
    return ['disponibilidad', 'inspeccion', 'compra', 'transporte'];
}

/** Nombre de cada hito en inglés, para David. */
function opuHitosEn() {
    return [
        'disponibilidad' => 'Availability and price confirmed with the seller',
        'inspeccion' => 'Survey approved',
        'compra' => 'Purchase closed',
        'transporte' => 'In transit to Chile',
        'aduana' => 'Customs in Chile',
        'entrega' => 'Delivered',
    ];
}

/** Lo que se le pide a David según el hito en curso (null: nada del lado de EE. UU.). */
function opuPedidoPara($hito, $priceRetained = false) {
    if ($priceRetained && $hito === 'disponibilidad') return 'Please confirm seller availability, the current location and purchase or pickup timing. The previously agreed price is retained; no new price confirmation is requested.';
    $p = [
        'disponibilidad' => 'Please contact the seller to confirm the boat is still available and the final price. Send recent photos and, if you can, a walk-around video.',
        'inspeccion' => 'Please coordinate the technical survey. Send the survey report, photos and videos as soon as you have them.',
        'compra' => 'Please move forward with the purchase. Send photos of the signed bill of sale and the title when ready.',
        'transporte' => 'Please coordinate pickup and transport to the port. Send photos at pickup and when the boat is loaded, and the shipping documents (B/L) if available.',
    ];
    return $p[$hito] ?? null;
}

/** El primer hito sin hacer que aplica a la elección, o null. */
function opuHitoEnCurso($order) {
    $pasos = impPasos($order);
    foreach (impHitos() as $k => $h) {
        if (!empty($h['solo_con_inspeccion']) && empty($order['chosen_inspection'])) continue;
        if (!isset($pasos[$k])) return $k;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

function opuAsegurar($pdo) {
    static $hecho = false;
    if ($hecho) return;
    impAsegurarColumnas($pdo);
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
        $faltan = [
            'usa_token' => "ALTER TABLE orders ADD COLUMN usa_token VARCHAR(64) NULL",
            'usa_link_id' => "ALTER TABLE orders ADD COLUMN usa_link_id INT NULL",
            'usa_requested_at' => "ALTER TABLE orders ADD COLUMN usa_requested_at DATETIME NULL",
            'usa_updated_at' => "ALTER TABLE orders ADD COLUMN usa_updated_at DATETIME NULL",
        ];
        foreach ($faltan as $c => $sql) if (!in_array($c, $cols, true)) $pdo->exec($sql);
        $pdo->exec("CREATE TABLE IF NOT EXISTS order_usa_updates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            note TEXT,
            file_ids TEXT,
            shared_text TEXT NULL,
            shared_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_usa_order (order_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $fcols = $pdo->query("SHOW COLUMNS FROM expediente_files")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('visible_to_client', $fcols, true)) {
            $pdo->exec("ALTER TABLE expediente_files ADD COLUMN visible_to_client TINYINT(1) NOT NULL DEFAULT 1");
        }
        $hecho = true;
    } catch (PDOException $e) {
        error_log('opuAsegurar: ' . $e->getMessage());
    }
}

/** Historial del expediente (order_events), sin depender de orders_api.php. */
function opuLog($pdo, $orderId, $tipo, $meta = []) {
    try {
        $pdo->prepare("INSERT INTO order_events (order_id, event_type, meta_json, user_id) VALUES (?, ?, ?, NULL)")
            ->execute([intval($orderId), $tipo, json_encode($meta)]);
    } catch (\Throwable $e) {
        error_log('opuLog: ' . $e->getMessage());
    }
}

function opuOrden($pdo, $orderId) {
    $st = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
    $st->execute([intval($orderId)]);
    return $st->fetch(PDO::FETCH_ASSOC) ?: null;
}

function opuOrdenPorToken($pdo, $token) {
    $token = (string) $token;
    if (!preg_match('/^[a-f0-9]{48}$/', $token)) return null;
    $st = $pdo->prepare("SELECT * FROM orders WHERE usa_token = ?");
    $st->execute([$token]);
    $o = $st->fetch(PDO::FETCH_ASSOC);
    return ($o && hash_equals((string) $o['usa_token'], $token)) ? $o : null;
}

/** El link privado del expediente (lo crea si no existe). */
function opuToken($pdo, $order, $nuevo = false) {
    $t = (string) ($order['usa_token'] ?? '');
    if ($nuevo || !preg_match('/^[a-f0-9]{48}$/', $t)) {
        $t = bin2hex(random_bytes(24));
        $pdo->prepare("UPDATE orders SET usa_token = ? WHERE id = ?")->execute([$t, intval($order['id'])]);
    }
    return $t;
}

function opuUrlPortal($token) {
    return 'https://www.imporlan.cl/api/operador_usa.php?r=portal&t=' . $token;
}

function opuActualizaciones($pdo, $orderId) {
    $st = $pdo->prepare("SELECT * FROM order_usa_updates WHERE order_id = ? ORDER BY id DESC");
    $st->execute([intval($orderId)]);
    $out = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $u) {
        $u['file_ids'] = array_values(array_map('intval', json_decode((string) $u['file_ids'], true) ?: []));
        $out[] = $u;
    }
    return $out;
}

/** Lo que ve el cliente: sólo lo que el equipo compartió, en sus palabras. */
function opuNovedadesCliente($pdo, $orderId) {
    try {
        $out = [];
        foreach (opuActualizaciones($pdo, $orderId) as $u) {
            if (trim((string) $u['shared_text']) === '') continue;
            $out[] = ['id' => intval($u['id']), 'text' => $u['shared_text'], 'at' => $u['shared_at'] ?: $u['created_at'], 'file_ids' => $u['file_ids']];
        }
        return $out;
    } catch (PDOException $e) {
        return []; // la tabla aún no existe
    }
}

// ---------------------------------------------------------------------------
// Correos a David (en inglés, sin datos del cliente ni precios)
// ---------------------------------------------------------------------------

function opuEsc($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }

/**
 * La carcasa de los correos de la operación en EE. UU., con el mismo diseño
 * que los de la inspección y el precio (inspection_*_template.php).
 * $para: 'operador' (David, en inglés, firmado por Juan Pablo y con el
 * recordatorio de no contactar al cliente) o 'equipo' (aviso interno, en español).
 */
function opuHtmlCorreo($titulo, $cuerpo, $para = 'operador', $etiqueta = '') {
    $equipo = $para === 'equipo';
    $sub = $equipo ? 'OPERACIÓN EN EE. UU. · AVISO INTERNO' : 'US OPERATIONS';
    $pie = $equipo
        ? 'Aviso automático para el equipo Imporlan. Las notas de la operación en EE. UU. son internas: al cliente se le comparte lo que el equipo decida, con su texto.'
        : 'All client communication goes through Imporlan. Please do not contact the client directly. Questions: <a href="mailto:contacto@imporlan.cl" style="color:#087c91;">contacto@imporlan.cl</a>';
    $firma = $equipo ? '' : '<tr><td class="pad" style="padding:0 36px 28px;font-size:13px;line-height:1.8;color:#142c3d;">Thank you,<br><strong>Juan Pablo</strong><br>Commercial &amp; Logistics · Imporlan<br><a href="mailto:contacto@imporlan.cl" style="color:#087c91;">contacto@imporlan.cl</a></td></tr>';
    return '<!DOCTYPE html><html lang="' . ($equipo ? 'es' : 'en') . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . opuEsc($titulo) . '</title>'
        . '<style>table{border-collapse:collapse}a:focus{outline:3px solid #36bdc8;outline-offset:3px}@media(max-width:600px){.outer{padding:12px 8px!important}.pad{padding-left:22px!important;padding-right:22px!important}.headline{font-size:24px!important}}</style></head>'
        . '<body style="margin:0;background:#edf2f5;font-family:Arial,Helvetica,sans-serif;color:#142c3d;">'
        . '<table role="presentation" width="100%" bgcolor="#edf2f5"><tr><td class="outer" align="center" style="padding:32px 16px;"><table role="presentation" width="100%" style="max-width:640px;background:#fff;border:1px solid #dce5eb;">'
        . '<tr><td class="pad" bgcolor="#102c3d" style="padding:25px 36px;color:#fff;font-size:23px;letter-spacing:3px;font-weight:bold;">IMPORLAN<span style="color:#54c5cf;">.</span><p style="font-size:10px;letter-spacing:2px;color:#bdd0da;margin:8px 0 0;font-weight:normal;">' . $sub . '</p></td></tr><tr><td height="4" bgcolor="#36bdc8"></td></tr>'
        . '<tr><td class="pad" style="padding:30px 36px 8px;">'
        . ($etiqueta !== '' ? '<p style="margin:0 0 14px;font-size:11px;font-weight:bold;letter-spacing:2px;color:#087c91;">' . opuEsc(mb_strtoupper($etiqueta)) . '</p>' : '')
        . '<h1 class="headline" style="margin:0 0 18px;font-size:28px;line-height:1.2;letter-spacing:-0.5px;color:#102c3d;">' . opuEsc($titulo) . '</h1>'
        . '<div style="font-size:14px;line-height:1.7;color:#334e5e;">' . $cuerpo . '</div></td></tr>'
        . $firma
        . '<tr><td class="pad" bgcolor="#f5f8fa" style="padding:18px 36px;border-top:1px solid #e2e8f0;font-size:11px;line-height:1.7;color:#526b7b;">' . $pie . '</td></tr>'
        . '</table></td></tr></table></body></html>';
}

function opuFichaLancha($order, $link) {
    $filas = [
        'File' => $order['order_number'] ?? '',
        'Boat' => impTituloLancha($link),
        'Location' => $link['location'] ?? '',
        'Hours' => $link['hours'] ?? '',
        'Engine' => $link['engine'] ?? '',
        'Survey' => !empty($order['chosen_inspection']) ? 'Requested by the client' : 'Not requested',
    ];
    $h = '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:14px">';
    foreach ($filas as $k => $v) {
        if (trim((string) $v) === '') continue;
        $h .= '<tr><td style="padding:6px 0;color:#64748b;width:110px;vertical-align:top">' . $k . '</td><td style="padding:6px 0">' . opuEsc($v) . '</td></tr>';
    }
    if (!empty($link['url'])) {
        $h .= '<tr><td style="padding:6px 0;color:#64748b">Listing</td><td style="padding:6px 0"><a href="' . opuEsc($link['url']) . '">' . opuEsc(mb_substr($link['url'], 0, 70)) . '</a></td></tr>';
    }
    return $h . '</table>';
}

function opuBoton($texto, $url) {
    return '<table role="presentation" width="100%" style="margin:22px 0 6px"><tr><td align="center" bgcolor="#087c91" style="border-radius:8px;"><a href="' . opuEsc($url) . '" style="display:block;padding:16px 20px;border:1px solid #087c91;border-radius:8px;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;">' . opuEsc($texto) . ' &nbsp;&#8594;</a></td></tr></table>';
}

function opuEnviar($subject, $html) {
    try {
        require_once __DIR__ . '/email_service.php';
        $r = (new EmailService())->sendCustomEmail(opuOperador()['email'], $subject, $html);
        return !empty($r['success']);
    } catch (\Throwable $e) {
        error_log('opuEnviar: ' . $e->getMessage());
        return false;
    }
}

/**
 * Le pide a David la actualización que toca. $motivo: una frase en inglés
 * (por qué le escribimos ahora). $mensaje: texto libre del equipo.
 * Devuelve true si salió el correo.
 */
function opuPedirActualizacion($pdo, $order, $motivo, $mensaje = '') {
    if (!impTieneEleccion($order)) return false;
    // A completed survey awaiting uploads has its own daily request. Never
    // ask the operator to arrange the inspection again, or send a second chase.
    if (opuInspectionOwnsStage($pdo, $order) || opuPriceGate($pdo, $order)) return false;
    $link = impLeerLink($pdo, $order['id'], $order['chosen_link_id']);
    if (!$link) return false;
    $hito = opuHitoEnCurso($order);
    $price = opuPriceState($pdo, $order);
    $pedido = opuPedidoPara($hito, !empty($price['retained'])) ?: 'Please send any new photos, videos or documents you have for this boat.';
    $token = opuToken($pdo, $order);
    $titulo = impTituloLancha($link);
    $nombre = explode(' ', opuOperador()['nombre'])[0];

    $cuerpo = '<p style="margin:0 0 12px;font-size:14px;line-height:1.6">Hi ' . opuEsc($nombre) . ', ' . opuEsc($motivo) . '</p>'
        . ($mensaje !== '' ? '<div style="margin:0 0 14px;padding:12px 14px;background:#f8fafc;border-left:4px solid #0e7490;border-radius:6px;font-size:14px;line-height:1.6"><strong>Message from the Imporlan team:</strong><br>' . nl2br(opuEsc($mensaje)) . '</div>' : '')
        . opuFichaLancha($order, $link)
        . '<div style="padding:14px;background:#ecfeff;border:1px solid #a5f3fc;border-radius:8px;font-size:14px;line-height:1.6"><strong>What we need now</strong><br>' . opuEsc($pedido) . '</div>'
        . opuBoton('Send update, photos and videos', opuUrlPortal($token))
        . '<p style="font-size:12px;color:#64748b;margin:8px 0 0">This link is private to this file. You can use it as many times as you need.</p>';

    $ok = opuEnviar('[Imporlan] Update needed · ' . ($order['order_number'] ?? '') . ' · ' . $titulo, opuHtmlCorreo($titulo, $cuerpo, 'operador', 'Update needed · ' . ($order['order_number'] ?? '')));
    if ($ok) {
        $pdo->prepare("UPDATE orders SET usa_requested_at = NOW(), usa_link_id = ? WHERE id = ?")->execute([intval($link['id']), intval($order['id'])]);
        opuLog($pdo, $order['id'], 'operador_usa_pedido', ['hito' => $hito, 'motivo' => $motivo]);
    }
    return $ok;
}

/** Si a David se le pidió trabajar en una lancha que ya no va, se le avisa que pare. */
function opuAvisarPausa($pdo, $order, $linkIdAnterior) {
    if (!intval($linkIdAnterior) || intval($order['usa_link_id'] ?? 0) !== intval($linkIdAnterior) || empty($order['usa_requested_at'])) return false;
    $link = impLeerLink($pdo, $order['id'], $linkIdAnterior);
    if (!$link) return false;
    $cuerpo = '<p style="margin:0 0 12px;font-size:14px;line-height:1.6">Please put this boat on hold: the client is no longer moving forward with it. No further work is needed on it unless we write again.</p>'
        . opuFichaLancha($order, $link);
    $ok = opuEnviar('[Imporlan] On hold · ' . ($order['order_number'] ?? '') . ' · ' . impTituloLancha($link), opuHtmlCorreo(impTituloLancha($link), $cuerpo, 'operador', 'On hold · ' . ($order['order_number'] ?? '')));
    if ($ok) {
        $pdo->prepare("UPDATE orders SET usa_link_id = NULL WHERE id = ?")->execute([intval($order['id'])]);
        opuLog($pdo, $order['id'], 'operador_usa_pausa', ['link_id' => intval($linkIdAnterior)]);
    }
    return $ok;
}

// ---------------------------------------------------------------------------
// Ganchos (los llaman orders_api.php y los pagos)
// ---------------------------------------------------------------------------

/** Se eligió (o cambió) la lancha. */
function opuAlElegir($pdo, $orderId, $linkAnterior = 0) {
    try {
        opuAsegurar($pdo);
        $o = opuOrden($pdo, $orderId);
        if (!$o) return;
        if ($linkAnterior && intval($linkAnterior) !== intval($o['chosen_link_id'])) opuAvisarPausa($pdo, $o, $linkAnterior);
        opuPedirActualizacion($pdo, opuOrden($pdo, $orderId), 'a client has selected this boat and we are starting the import.');
    } catch (\Throwable $e) {
        error_log('opuAlElegir: ' . $e->getMessage());
    }
}

/** Se deshizo la elección. */
function opuAlDeshacer($pdo, $orderAntes) {
    try {
        opuAsegurar($pdo);
        if (impTieneEleccion($orderAntes)) opuAvisarPausa($pdo, $orderAntes, $orderAntes['chosen_link_id']);
    } catch (\Throwable $e) {
        error_log('opuAlDeshacer: ' . $e->getMessage());
    }
}

/** El equipo marcó un hito: se le pide a David lo que sigue, si es de su lado. */
function opuAlMarcarHito($pdo, $orderId, $hito) {
    try {
        opuAsegurar($pdo);
        $o = opuOrden($pdo, $orderId);
        if (!$o || !impTieneEleccion($o)) return false;
        $siguiente = opuHitoEnCurso($o);
        if (!$siguiente || !in_array($siguiente, opuHitosUsa(), true)) return false;
        $en = opuHitosEn();
        return opuPedirActualizacion($pdo, $o, 'milestone completed: ' . ($en[$hito] ?? $hito) . '. Here is the next step.');
    } catch (\Throwable $e) {
        error_log('opuAlMarcarHito: ' . $e->getMessage());
        return false;
    }
}

/** Entró un pago de un cobro. Con el Pago 1, la operación queda confirmada. */
function opuAlPagarCobro($request) {
    try {
        if (intval($request['metadata']['custom_fields']['pago'] ?? 0) !== 1) return false;
        $pdo = getDbConnection();
        if (!$pdo) return false;
        $ref = trim((string) ($request['metadata']['order_id'] ?? $request['metadata']['order_number'] ?? ''));
        $orderId = ctype_digit($ref) ? intval($ref) : 0;
        if (!$orderId && preg_match('/^IMP-[0-9]+$/i', $ref)) {
            $st = $pdo->prepare('SELECT id FROM orders WHERE order_number = ?');
            $st->execute([strtoupper($ref)]);
            $orderId = intval($st->fetchColumn());
        }
        if (!$orderId) return false;
        opuAsegurar($pdo);
        $o = opuOrden($pdo, $orderId);
        if (!$o || !impTieneEleccion($o)) return false;
        return opuPedirActualizacion($pdo, $o, 'the client has made the first payment, so the operation is confirmed. Please go ahead.');
    } catch (\Throwable $e) {
        error_log('opuAlPagarCobro: ' . $e->getMessage());
        return false;
    }
}

/**
 * Recordatorios: una vez por hora como mucho (se llama desde orders_api en
 * cada petición; si no pasó la hora, sale sin tocar la base). A cada
 * importación activa cuyo paso en curso es de EE. UU. y que lleva
 * OPU_DIAS_RECORDATORIO días sin novedades ni pedidos, se le recuerda.
 */
function opuQuizasRecordar() {
    $marca = __DIR__ . '/.operador_usa_ultimo_recordatorio';
    $ultima = @filemtime($marca);
    if ($ultima && (time() - $ultima) < 3600) return;
    @touch($marca);
    try {
        $pdo = getDbConnection();
        if ($pdo) opuRecordar($pdo);
    } catch (\Throwable $e) {
        error_log('opuQuizasRecordar: ' . $e->getMessage());
    }
}

function opuRecordar($pdo, $ahora = null) {
    opuAsegurar($pdo);
    $ahora = $ahora ?: time();
    $limite = date('Y-m-d H:i:s', $ahora - OPU_DIAS_RECORDATORIO * 86400);
    $st = $pdo->query("SELECT * FROM orders WHERE chosen_link_id IS NOT NULL AND status NOT IN ('completed','expired','canceled','cancelled')");
    $enviados = 0;
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $o) {
        if (opuInspectionOwnsStage($pdo, $o)) continue;
        $hito = opuHitoEnCurso($o);
        if (!$hito || !in_array($hito, opuHitosUsa(), true)) continue;
        $ultimo = max((string) ($o['usa_requested_at'] ?? ''), (string) ($o['usa_updated_at'] ?? ''), (string) ($o['chosen_at'] ?? ''));
        if ($ultimo !== '' && $ultimo > $limite) continue;
        if (opuPedirActualizacion($pdo, $o, 'this is a friendly reminder: we have not received an update on this boat in the last ' . OPU_DIAS_RECORDATORIO . ' days.')) $enviados++;
        if ($enviados >= 10) break;
    }
    return $enviados;
}

// ---------------------------------------------------------------------------
// Lo que manda David
// ---------------------------------------------------------------------------

function opuMimesPermitidos() {
    return [
        'image/jpeg' => ['jpg', 'image'], 'image/png' => ['png', 'image'], 'image/webp' => ['webp', 'image'], 'image/gif' => ['gif', 'image'],
        'image/heic' => ['heic', 'image'], 'image/heif' => ['heif', 'image'],
        'video/mp4' => ['mp4', 'video'], 'video/quicktime' => ['mov', 'video'], 'video/webm' => ['webm', 'video'], 'video/x-msvideo' => ['avi', 'video'], 'video/mpeg' => ['mpeg', 'video'],
        'application/pdf' => ['pdf', 'document'],
    ];
}

/**
 * Guarda una actualización de David. $archivos: lista de
 * ['name','tmp_name','size','error'] (como $_FILES normalizado). $mover es
 * move_uploaded_file en la web; las pruebas pasan copy().
 * Fotos y videos quedan visibles para el cliente; los documentos, no
 * (los comparte el equipo).
 * Devuelve ['update_id', 'files' => [...], 'errores' => [...]].
 */
function opuGuardarActualizacion($pdo, $order, $nota, array $archivos, $mover = 'move_uploaded_file', $inspectionRequestId = 0, array $exceptions = []) {
    opuAsegurar($pdo);
    $inspection = opuInspectionLatest($pdo, $order);
    if (!$inspectionRequestId && $inspection && opuInspectionOwnsStage($pdo, $order)) $inspectionRequestId = intval($inspection['id']);
    if ($inspectionRequestId && (!$inspection || intval($inspection['id']) !== intval($inspectionRequestId) || impExpedienteCerrado($order) || !empty($order['refund_requested_at']))) {
        return ['update_id' => 0, 'files' => [], 'errores' => ['This inspection request is no longer active. Please reopen your private upload page.']];
    }
    $reasonErrors = opuInspectionExceptionErrors($pdo, $order, $inspectionRequestId, $exceptions);
    if ($reasonErrors) return ['update_id' => 0, 'files' => [], 'errores' => $reasonErrors];
    $nota = mb_substr(trim((string) $nota), 0, 5000);
    $dir = __DIR__ . '/expediente_files/';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    if (!file_exists($dir . '.htaccess')) {
        @file_put_contents($dir . '.htaccess', "Require all denied\nOptions -Indexes\n<IfModule mod_php.c>\nphp_flag engine off\n</IfModule>\nRemoveHandler .php .phtml .php5 .php7 .phar\nRemoveType .php .phtml .php5 .php7 .phar\n");
    }
    $mimes = opuMimesPermitidos();
    $guardados = [];
    $errores = [];
    foreach ($archivos as $f) {
        $nombre = basename((string) ($f['name'] ?? 'file'));
        if (($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) continue;
        if (($f['error'] ?? 1) !== UPLOAD_ERR_OK) { $errores[] = "$nombre: upload failed (too large?)"; continue; }
        if (intval($f['size'] ?? 0) > 100 * 1024 * 1024) { $errores[] = "$nombre: over 100 MB"; continue; }
        $fi = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($fi, $f['tmp_name']);
        finfo_close($fi);
        if (!isset($mimes[$mime])) { $errores[] = "$nombre: file type not allowed ($mime)"; continue; }
        [$ext, $cat] = $mimes[$mime];
        $guardado = 'exp_' . intval($order['id']) . '_' . uniqid() . '_' . time() . '.' . $ext;
        if (!$mover($f['tmp_name'], $dir . $guardado)) { $errores[] = "$nombre: could not be saved"; continue; }
        $visible = in_array($cat, ['image', 'video'], true) ? 1 : 0;
        $pdo->prepare("INSERT INTO expediente_files (order_id, original_name, stored_name, mime_type, file_size, category, description, uploaded_by, visible_to_client) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([intval($order['id']), $nombre, $guardado, $mime, intval($f['size'] ?? filesize($dir . $guardado)), $cat, 'Desde Estados Unidos', 'operador_usa', $visible]);
        $guardados[] = ['id' => intval($pdo->lastInsertId()), 'original_name' => $nombre, 'category' => $cat, 'mime_type' => $mime, 'visible' => $visible, 'file_size' => intval($f['size'] ?? 0)];
    }
    if ($nota === '' && !$guardados && !$exceptions) return ['update_id' => 0, 'files' => [], 'errores' => $errores ?: ['Write a note or attach at least one file.']];

    $pdo->prepare("INSERT INTO order_usa_updates (order_id, note, file_ids) VALUES (?, ?, ?)")
        ->execute([intval($order['id']), $nota, json_encode(array_column($guardados, 'id'))]);
    $updateId = intval($pdo->lastInsertId());
    $pdo->prepare("UPDATE orders SET usa_updated_at = NOW() WHERE id = ?")->execute([intval($order['id'])]);
    opuLog($pdo, $order['id'], 'operador_usa_actualizacion', ['update_id' => $updateId, 'archivos' => count($guardados)]);

    // A real PDF submitted while the survey is the current task is evidence
    // the survey has taken place. Enrol future operations as well as the
    // existing explicit request; later purchase/shipping PDFs do not enrol.
    if (!$inspection && !empty($order['chosen_inspection']) && opuHitoEnCurso($order) === 'inspeccion'
        && array_filter($guardados, function ($file) { return $file['mime_type'] === 'application/pdf'; })) {
        $inspection = opuInspectionRequest($pdo, $order);
        $inspectionRequestId = intval($inspection['id'] ?? 0);
    }
    opuInspectionAttach($pdo, $order, $inspectionRequestId, $guardados);
    opuInspectionSaveExceptions($pdo, $order, $inspectionRequestId, $exceptions);

    opuAvisarActualizacion($pdo, $order, $nota, $guardados);
    return ['update_id' => $updateId, 'files' => $guardados, 'errores' => $errores];
}

/** Aviso al equipo (siempre) y al cliente (si hay fotos o videos nuevos). */
function opuAvisarActualizacion($pdo, $order, $nota, $guardados) {
    try {
        require_once __DIR__ . '/email_service.php';
        $svc = new EmailService();
        $link = impLeerLink($pdo, $order['id'], $order['chosen_link_id'] ?? 0);
        $titulo = impTituloLancha($link);
        $visibles = array_values(array_filter($guardados, function ($g) { return $g['visible']; }));
        $internos = count($guardados) - count($visibles);
        $assignedRequest = opuInspectionLatest($pdo, $order);
        $operatorName = $assignedRequest['operator_name'] ?? opuOperador()['nombre'];
        $counts = ['image' => 0, 'video' => 0, 'document' => 0];
        foreach ($guardados as $file) { if (isset($counts[$file['category']])) $counts[$file['category']]++; }
        $batch = $counts['image'] . ' foto(s), ' . $counts['video'] . ' video(s), ' . $counts['document'] . ' documento(s)';
        $svc->sendCustomEmail('contacto@imporlan.cl', $operatorName . ' envió una actualización · ' . ($order['order_number'] ?? '') . ' · ' . $titulo,
            opuHtmlCorreo($titulo,
                '<p style="font-size:14px;margin:0 0 10px">Expediente <strong>' . opuEsc($order['order_number'] ?? '') . '</strong>. '
                . 'En esta actualización: ' . $batch . '. ' . count($visibles) . ' archivo(s) visuales ya visibles para el cliente' . ($internos ? ', ' . $internos . ' documento(s) sólo para el equipo' : '') . '.</p>'
                . opuInspectionStaffSummary($pdo, $order)
                . opuSugerirReporte($order, $guardados)
                . ($nota !== '' ? '<div style="padding:12px 14px;background:#f8fafc;border-left:4px solid #0e7490;border-radius:6px;font-size:14px;line-height:1.6;white-space:pre-wrap">' . opuEsc($nota) . '</div>' : '')
                . '<p style="font-size:13px;color:#64748b;margin:12px 0 0">La nota es interna. Para contarle algo al cliente, usa «Compartir con el cliente» en el expediente.</p>'
                . opuBoton('Abrir expediente en el admin', 'https://www.imporlan.cl/panel/admin/#/orders?id=' . intval($order['id'])), 'equipo', $operatorName . ' envió una actualización'));

        if ($visibles && !empty($order['customer_email'])) {
            $n = count($visibles);
            $visual = [];
            if ($counts['image']) $visual[] = $counts['image'] . ($counts['image'] === 1 ? ' foto' : ' fotos');
            if ($counts['video']) $visual[] = $counts['video'] . ($counts['video'] === 1 ? ' video' : ' videos');
            $msg = 'Agregamos ' . implode(' y ', $visual) . ' de tu lancha desde Estados Unidos.';
            try {
                $pdo->prepare("INSERT INTO notifications (user_email, type, title, message, link) VALUES (?, 'expediente_files', ?, ?, ?)")
                    ->execute([$order['customer_email'], 'Novedades de tu lancha', $msg, '/panel/#/expedientes?id=' . intval($order['id'])]);
            } catch (\Throwable $e) { /* sin tabla de notificaciones */ }
            $nombre = impNombreSaludo($order);
            $svc->sendExpedienteFilesEmail($order['customer_email'], $nombre, [
                'order_number' => $order['order_number'] ?? '',
                'order_id' => intval($order['id']),
                'files' => $visibles,
                'description' => $msg,
                'file_count' => $n,
                // Es la lancha que se está comprando, no «documentos»: que el correo lo diga.
                'asunto' => 'Fotos y videos de tu lancha desde Estados Unidos: ' . $titulo,
                'etiqueta' => 'Desde Estados Unidos',
                'titulo_correo' => $titulo,
                'etiqueta_nota' => 'Novedades de tu lancha',
                'boton' => 'Ver fotos y videos en mi panel',
            ]);
        }
    } catch (\Throwable $e) {
        error_log('opuAvisarActualizacion: ' . $e->getMessage());
    }
}

/**
 * Si llega un PDF mientras la inspección espera su reporte, en el correo al
 * equipo va el paso para cargarlo como reporte del cliente (se traduce al
 * español y el cliente decide). Los PDF de David no se publican solos.
 */
function opuSugerirReporte($order, $guardados) {
    if (impEtapaInspeccion($order) !== 'coordinando') return '';
    $pdfs = array_values(array_filter($guardados, function ($g) { return ($g['mime_type'] ?? '') === 'application/pdf'; }));
    if (!$pdfs) return '';
    return '<div style="margin:12px 0 0;padding:12px 14px;background:#ecfeff;border:1px solid #a5f3fc;border-radius:8px;font-size:14px;line-height:1.6">'
        . '<strong>¿Es el reporte de la inspección?</strong> (' . opuEsc($pdfs[0]['original_name']) . ')<br>'
        . 'Cárgalo para el cliente: en el expediente, Operación → hito «Inspección técnica» → <em>Cargar reporte</em> → <em>Usar uno del expediente</em>. '
        . 'Se traduce al español solo y al cliente le llega el aviso para revisarlo y decidir.</div>';
}

/** El equipo comparte una actualización con el cliente, con su propio texto. */
function opuCompartir($pdo, $updateId, $texto) {
    opuAsegurar($pdo);
    $texto = mb_substr(trim((string) $texto), 0, 2000);
    $st = $pdo->prepare("SELECT * FROM order_usa_updates WHERE id = ?");
    $st->execute([intval($updateId)]);
    $u = $st->fetch(PDO::FETCH_ASSOC);
    if (!$u) return [404, 'Actualización no encontrada'];
    if ($texto === '') return [400, 'Escribe el texto para el cliente'];
    $pdo->prepare("UPDATE order_usa_updates SET shared_text = ?, shared_at = NOW() WHERE id = ?")->execute([$texto, intval($updateId)]);
    $ids = array_map('intval', json_decode((string) $u['file_ids'], true) ?: []);
    if ($ids) {
        $marcas = implode(',', array_fill(0, count($ids), '?'));
        $pdo->prepare("UPDATE expediente_files SET visible_to_client = 1 WHERE order_id = ? AND id IN ($marcas)")->execute(array_merge([intval($u['order_id'])], $ids));
    }
    $o = opuOrden($pdo, $u['order_id']);
    opuLog($pdo, $u['order_id'], 'operador_usa_compartida', ['update_id' => intval($updateId)]);
    if ($o && !empty($o['customer_email'])) {
        try {
            $pdo->prepare("INSERT INTO notifications (user_email, type, title, message, link) VALUES (?, 'expediente_update', ?, ?, ?)")
                ->execute([$o['customer_email'], 'Novedades de tu importación', mb_substr($texto, 0, 240), '/panel/#/expedientes?id=' . intval($o['id'])]);
        } catch (\Throwable $e) { /* sin tabla de notificaciones */ }
        try {
            require_once __DIR__ . '/email_service.php';
            $link = impLeerLink($pdo, $o['id'], $o['chosen_link_id'] ?? 0);
            (new EmailService())->sendNovedadImportacion($o['customer_email'], impNombreSaludo($o), [
                'titulo' => impTituloLancha($link), 'order_number' => $o['order_number'] ?? '', 'order_id' => intval($o['id']), 'texto' => $texto,
            ]);
        } catch (\Throwable $e) {
            error_log('opuCompartir email: ' . $e->getMessage());
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// La página de David
// ---------------------------------------------------------------------------

function opuPaginaPortal($pdo, $order, $aviso = '', $errores = [], $priceDraft = []) {
    $link = impLeerLink($pdo, $order['id'], $order['chosen_link_id'] ?? 0);
    $hito = impTieneEleccion($order) ? opuHitoEnCurso($order) : null;
    $pedido = $hito ? opuPedidoPara($hito) : null;
    $inspectionLatest = opuInspectionLatest($pdo, $order);
    $inspectionRequest = $inspectionLatest && $inspectionLatest['status'] === 'pending' ? $inspectionLatest : null;
    if ($inspectionRequest) {
        $inspectionState = opuInspectionState($pdo, $inspectionRequest);
        $pendingNames = array_map(function ($key) { return strtolower(opuInspectionItems()[$key][0]); }, $inspectionState['missing']);
        $pedido = 'The inspection is complete. Please provide only the remaining items: ' . implode(', ', $pendingNames) . '. If an item is unavailable, select it below and explain why.';
    }
    elseif (opuInspectionOwnsStage($pdo, $order)) $pedido = 'The inspection requirements are resolved. Available files and any unavailability reasons are recorded for the Imporlan team to review.';
    $price = opuPriceState($pdo, $order);
    if (!empty($price['retained']) && !$inspectionRequest && $hito === 'disponibilidad') $pedido = opuPedidoPara($hito, true);
    if ($price && !$price['ready'] && empty($price['retained'])) {
        $pedido = $price['confirmed']
            ? 'Your purchase price confirmation is recorded. Please wait for the Imporlan team to review it and confirm the next step before proceeding with the purchase.'
            : 'Please confirm the purchase price after the technical inspection using the price form below. Also upload any pending inspection material or explain why it is unavailable. Please wait for the Imporlan team before proceeding with the purchase.';
    }
    $pasos = impPasos($order);
    $en = opuHitosEn();
    $updates = opuActualizaciones($pdo, $order['id']);
    $url = '?r=enviar&t=' . opuEsc($order['usa_token']);

    $h = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<meta name="robots" content="noindex,nofollow"><title>Imporlan · ' . opuEsc($order['order_number'] ?? '') . '</title>'
        . '<style>
            :root{--ink:#0f172a;--mute:#64748b;--line:#e2e8f0;--brand:#0e7490;--bg:#f1f5f9;--ok:#047857}
            *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
            main{max-width:720px;margin:0 auto;padding:20px 16px 48px}
            .top{font-size:13px;color:var(--mute);margin-bottom:12px}.top b{color:var(--ink)}
            .card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:16px;overflow-wrap:anywhere}
            h1{font-size:22px;line-height:1.25;margin:0 0 4px}h2{font-size:16px;margin:0 0 10px}
            .mute{color:var(--mute);font-size:13px}
            .boat{display:flex;gap:14px;align-items:flex-start}.boat img{width:132px;height:96px;object-fit:cover;border-radius:8px;border:1px solid var(--line);flex-shrink:0}
            @media(max-width:480px){.boat{flex-direction:column}.boat img{width:100%;height:180px}}
            .ask{background:#ecfeff;border:1px solid #a5f3fc;border-radius:10px;padding:14px;margin-top:14px}
            ol.steps{list-style:none;margin:0;padding:0}ol.steps li{display:flex;gap:10px;padding:6px 0;font-size:14px}
            .dot{width:20px;height:20px;border-radius:50%;border:2px solid #cbd5e1;flex-shrink:0;margin-top:1px}.done .dot{background:var(--ok);border-color:var(--ok)}.now .dot{border-color:var(--brand)}
            .done span{color:var(--ink)}li span{color:var(--mute)}.now span{color:var(--ink);font-weight:600}
            label{display:block;font-weight:600;margin:0 0 6px;font-size:14px}
            textarea{width:100%;min-height:120px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
            input[type=file]{width:100%;padding:12px;border:1px dashed #94a3b8;border-radius:8px;background:#f8fafc;font:inherit}
            textarea:focus,input:focus,button:focus{outline:2px solid var(--brand);outline-offset:2px}
            button{background:var(--brand);color:#fff;border:0;border-radius:8px;padding:12px 20px;font:inherit;font-weight:600;cursor:pointer;width:100%;margin-top:14px}
            .ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:10px;padding:12px 14px;margin-bottom:16px}
            .err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:12px 14px;margin-bottom:16px}
            .upd{border-top:1px solid var(--line);padding:10px 0}.upd:first-of-type{border-top:0}
            .note{white-space:pre-wrap;font-size:14px;margin-top:4px}
          </style></head><body><main>'
        . '<div class="top"><b>Imporlan</b> · US operations · ' . opuEsc($inspectionLatest['operator_name'] ?? opuOperador()['nombre']) . '</div>';

    if ($aviso !== '') $h .= '<div class="ok" role="status">' . opuEsc($aviso) . '</div>';
    if ($errores) $h .= '<div class="err" role="alert">' . implode('<br>', array_map('opuEsc', $errores)) . '</div>';

    $h .= '<section class="card"><p class="mute" style="margin:0 0 6px">File ' . opuEsc($order['order_number'] ?? '') . '</p>';
    if ($link) {
        $spec = array_filter([$link['location'] ?? '', !empty($link['hours']) ? $link['hours'] . ' h' : '', $link['engine'] ?? '']);
        $img = (!empty($link['image_url']) && preg_match('#^https?://#', $link['image_url'])) ? '<img src="' . opuEsc($link['image_url']) . '" alt="">' : '';
        $h .= '<div class="boat">' . $img . '<div><h1>' . opuEsc(impTituloLancha($link)) . '</h1>'
            . ($spec ? '<div class="mute">' . opuEsc(implode(' · ', $spec)) . '</div>' : '')
            . (!empty($link['url']) ? '<div style="margin-top:6px;font-size:14px"><a href="' . opuEsc($link['url']) . '" target="_blank" rel="noopener">Open listing</a></div>' : '')
            . '<div class="mute" style="margin-top:6px">Survey: ' . (!empty($order['chosen_inspection']) ? 'requested by the client' : 'not requested') . '</div></div></div>';
    } else {
        $h .= '<h1>No boat selected right now</h1><p class="mute">There is nothing to work on for this file. We will write when that changes.</p>';
    }
    if ($pedido) $h .= '<div class="ask"><strong>What we need now</strong><br>' . opuEsc($pedido) . '</div>';
    $h .= '</section>';

    $h .= opuInspectionPortalChecklist($pdo, $order);
    $h .= opuPricePortal($pdo, $order, $priceDraft);

    if ($link) {
        $h .= '<section class="card"><h2>Progress</h2><ol class="steps">';
        foreach (impHitos() as $k => $hh) {
            if (!empty($hh['solo_con_inspeccion']) && empty($order['chosen_inspection'])) continue;
            $cls = isset($pasos[$k]) ? 'done' : ($k === $hito ? 'now' : '');
            $h .= '<li class="' . $cls . '"><i class="dot" aria-hidden="true"></i><span>' . opuEsc($en[$k]) . (isset($pasos[$k]) ? ' · ' . opuEsc(date('M j', strtotime($pasos[$k]))) : '') . '</span></li>';
        }
        $h .= '</ol></section>';

        $h .= '<section class="card"><h2>Send an update</h2>'
            . '<form method="post" action="' . $url . '" enctype="multipart/form-data" onsubmit="var b=this.querySelector(\'button\');b.disabled=true;b.textContent=\'Uploading… please keep this page open\';">'
            . '<input type="hidden" name="boat_link_id" value="' . intval($order['chosen_link_id']) . '">'
            . ($inspectionRequest ? '<input type="hidden" name="inspection_request_id" value="' . intval($inspectionRequest['id']) . '">' : '')
            . '<label for="note">Update for the Imporlan team</label>'
            . '<textarea id="note" name="note" maxlength="5000" placeholder="What happened, what is next, anything we should know."></textarea>'
            . '<label for="files" style="margin-top:14px">Photos, videos or documents</label>'
            . '<input id="files" type="file" name="files[]" multiple accept="image/*,video/*,application/pdf">'
            . '<p class="mute" style="margin:6px 0 0">Up to 100 MB per file. Photos and videos are added to the client\'s file; your note and PDFs stay with the Imporlan team. '
            . ($inspectionRequest ? 'For files you cannot supply, use the unavailable-file option and enter a reason below.' : 'You can still upload additional material if it becomes available.') . '</p>'
            . opuInspectionExceptionFields($pdo, $order)
            . '<button type="submit">Send update</button></form></section>';
    }

    if ($updates) {
        $h .= '<section class="card"><h2>Your previous updates</h2>';
        foreach ($updates as $u) {
            $n = count($u['file_ids']);
            $h .= '<div class="upd"><div class="mute">' . opuEsc(date('M j, Y · H:i', strtotime($u['created_at']))) . ($n ? ' · ' . $n . ' file' . ($n === 1 ? '' : 's') : '') . '</div>'
                . ($u['note'] !== '' ? '<div class="note">' . opuEsc($u['note']) . '</div>' : '') . '</div>';
        }
        $h .= '</section>';
    }
    return $h . '</main></body></html>';
}

/** $_FILES['files'] (múltiple) a una lista de archivos. */
function opuArchivosSubidos() {
    $f = $_FILES['files'] ?? null;
    if (!$f || !is_array($f['name'] ?? null)) return [];
    $out = [];
    foreach ($f['name'] as $i => $n) {
        $out[] = ['name' => $n, 'tmp_name' => $f['tmp_name'][$i], 'size' => $f['size'][$i], 'error' => $f['error'][$i]];
    }
    return $out;
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    $r = $_GET['r'] ?? '';
    $pdo = getDbConnection();

    if ($r === 'portal' || $r === 'enviar' || $r === 'precio') {
        header('Content-Type: text/html; charset=utf-8');
        header('X-Robots-Tag: noindex, nofollow');
        header('Referrer-Policy: no-referrer');
        header('Cache-Control: private, no-store');
        if (!$pdo) { http_response_code(500); echo 'Service unavailable, please try again later.'; exit; }
        opuAsegurar($pdo);
        $order = opuOrdenPorToken($pdo, $_GET['t'] ?? '');
        if (!$order) { http_response_code(404); echo '<p style="font-family:sans-serif;padding:24px">This link is not valid anymore. Please ask the Imporlan team for a new one: contacto@imporlan.cl</p>'; exit; }
        if ($r === 'precio') {
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); header('Allow: POST'); exit; }
            if (!isset($_POST['boat_link_id']) || !is_scalar($_POST['boat_link_id']) || intval($_POST['boat_link_id']) !== intval($order['chosen_link_id'] ?? 0)) {
                http_response_code(409);
                echo opuPaginaPortal($pdo, $order, '', ['The selected boat has changed. Please reopen the current operation.']);
                exit;
            }
            $errors = opuPriceSave($pdo, $order, $_POST);
            if ($errors) http_response_code(422);
            else {
                header('Location: ?r=portal&t=' . $order['usa_token'] . '&price_saved=1#purchase-price', true, 303);
                exit;
            }
            echo opuPaginaPortal($pdo, $order, '', $errors, $_POST);
            exit;
        }
        if ($r === 'enviar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($_POST['boat_link_id']) && intval($_POST['boat_link_id']) !== intval($order['chosen_link_id'] ?? 0)) {
                echo opuPaginaPortal($pdo, $order, '', ['The selected boat has changed. Please review the current boat and send a new update.']);
                exit;
            }
            if (empty($_FILES) && empty($_POST) && intval($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
                echo opuPaginaPortal($pdo, $order, '', ['The upload was too large for the server. Please send fewer or smaller files at a time, or paste a link in the note.']);
                exit;
            }
            $exceptions = [];
            $selected = $_POST['unavailable'] ?? [];
            if (!is_array($selected)) $selected = ['unknown'];
            $reasons = is_array($_POST['unavailable_reason'] ?? null) ? $_POST['unavailable_reason'] : [];
            foreach ($selected as $key) {
                $key = is_string($key) ? $key : 'unknown';
                $exceptions[$key] = $reasons[$key] ?? '';
            }
            $res = opuGuardarActualizacion($pdo, $order, $_POST['note'] ?? '', opuArchivosSubidos(), 'move_uploaded_file', intval($_POST['inspection_request_id'] ?? 0), $exceptions);
            $order = opuOrden($pdo, $order['id']);
            $aviso = $res['update_id'] ? 'Thank you, your update was received' . ($res['files'] ? ' with ' . count($res['files']) . ' file' . (count($res['files']) === 1 ? '' : 's') : '') . '.' : '';
            echo opuPaginaPortal($pdo, $order, $aviso, $res['errores']);
            exit;
        }
        echo opuPaginaPortal($pdo, $order, isset($_GET['price_saved']) ? 'Thank you. Your price proposal is recorded for Juan Pablo to approve or edit. It has not been published to the client.' : '');
        exit;
    }

    require_once __DIR__ . '/cors_helper.php';
    setCorsHeadersSecure();
    header('Content-Type: application/json');
    header('Cache-Control: private, no-store');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
    // El equipo en Chile (no el agente: él es quien manda las actualizaciones).
    $sesion = requireAdminAuthShared(['admin', 'support']);
    if (!$pdo) { http_response_code(500); echo json_encode(['error' => 'Database connection failed']); exit; }
    opuAsegurar($pdo);
    $in = json_decode(file_get_contents('php://input'), true) ?: [];

    if ($r === 'admin_estado') {
        $o = opuOrden($pdo, $_GET['order_id'] ?? 0);
        if (!$o) { http_response_code(404); echo json_encode(['error' => 'Expediente no encontrado']); exit; }
        $inspection = opuInspectionLatest($pdo, $o);
        echo json_encode([
            'success' => true,
            'operador' => $inspection ? ['nombre' => $inspection['operator_name'], 'email' => $inspection['operator_email']] : opuOperador(),
            'portal_url' => opuUrlPortal(opuToken($pdo, $o)),
            'requested_at' => $o['usa_requested_at'] ?? null,
            'updated_at' => $o['usa_updated_at'] ?? null,
            'hito_en_curso' => impTieneEleccion($o) ? opuHitoEnCurso($o) : null,
            'es_de_usa' => impTieneEleccion($o) && in_array(opuHitoEnCurso($o), opuHitosUsa(), true),
            'updates' => opuActualizaciones($pdo, $o['id']),
            'inspection_upload' => $inspection ? array_merge(opuInspectionState($pdo, $inspection), ['owns_stage' => opuInspectionOwnsStage($pdo, $o)]) : null,
            'inspection_price' => opuPriceState($pdo, $o),
            'can_approve_price' => opuPriceCanApprove($sesion),
            'pago1_pagado' => impPago1Pagado($o['id'],$o['order_number'] ?? '') > 0,
        ]);
        exit;
    }
    if ($r === 'admin_precio_conservar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!opuPriceCanApprove($sesion)) { http_response_code(403); echo json_encode(['error'=>'Sólo Juan Pablo puede conservar el acuerdo.']); exit; }
        $o=opuOrden($pdo,$in['order_id'] ?? 0);
        if (!$o) { http_response_code(404); echo json_encode(['error'=>'Expediente no encontrado']); exit; }
        $corregir=($in['correct_payment_notice'] ?? false) === true;
        if ($corregir && (empty($o['inspection_client_ok_at']) || impPago1Pagado($o['id'],$o['order_number'])<=0)) { http_response_code(409); echo json_encode(['error'=>'Primero registra el Pago 1 ya realizado y la aprobación del cliente.']); exit; }
        if ($corregir) {
            $plan=impPlanPago(impLeerLink($pdo,$o['id'],$o['chosen_link_id']),2);
            if (!$plan || isset(impPasos($o)['inspeccion'])) { http_response_code(409);echo json_encode(['error'=>'Revisa el hito de inspección y el Pago 2 vigente antes de emitir esta corrección.']);exit; }
            $check=impConCobros(function(&$store)use($o,$plan){
                foreach($store['requests'] as $r)if(impEsPagoDelExpediente($r,$o['id'],2,$o['order_number']) && ($r['status'] ?? '')!=='cancelled') {
                    if (($r['status'] ?? '')==='paid' || strtolower($r['user_email'] ?? '')!==strtolower($o['customer_email']) || intval($r['amount_clp'])!==$plan['clp'] || (!empty($r['metadata']['custom_fields']['link_id']) && intval($r['metadata']['custom_fields']['link_id'])!==intval($o['chosen_link_id']))) return ['valid'=>false];
                }return ['valid'=>true];
            });
            if (empty($check['valid'])) {http_response_code(409);echo json_encode(['error'=>'El Pago 2 ya está pagado o sus datos no coinciden con el acuerdo. Revisa los cobros.']);exit;}
        }
        $error=opuPriceRetain($pdo,$o,$in,$sesion);
        if ($error) { http_response_code(409); echo json_encode(['error'=>$error]); exit; }
        require_once __DIR__.'/orders_api.php';
        $pago=impPago1Pagado($o['id'],$o['order_number'])>0 ? impAprobacionPendiente($pdo,$o['id'],$corregir) : null;
        echo json_encode(['success'=>true,'inspection_price'=>opuPriceState($pdo,opuOrden($pdo,$o['id'])),'inspeccion_aprobada'=>(bool)$pago,'pago'=>$pago,'email_sent'=>$pago['email_sent'] ?? false]); exit;
    }
    if ($r === 'admin_precio_revisar' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!opuPriceCanApprove($sesion)) { http_response_code(403); echo json_encode(['error' => 'Sólo Juan Pablo puede aprobar o editar esta propuesta.']); exit; }
        $o = opuOrden($pdo, $in['order_id'] ?? 0);
        if (!$o) { http_response_code(404); echo json_encode(['error' => 'Expediente no encontrado']); exit; }
        if (!isset($in['revision'], $in['request_id'])) { http_response_code(400); echo json_encode(['error' => 'Se requiere la versión de la confirmación revisada']); exit; }
        $error = opuPriceReview($pdo, $o, $in['request_id'], $in['revision'], $sesion, $in['approved_price_usd'] ?? null, $in['approval_version'] ?? null, $in['approval_note'] ?? '');
        if ($error) { http_response_code(409); echo json_encode(['error' => $error]); exit; }
        // Si el cliente ya había aprobado el reporte, ahora sí se marca la inspección (y sale el Pago 2).
        require_once __DIR__ . '/orders_api.php';
        $pagoAprobacion = impAprobacionPendiente($pdo, $o['id']);
        echo json_encode(['success' => true, 'inspection_price' => opuPriceState($pdo, opuOrden($pdo, $o['id'])), 'inspeccion_aprobada' => (bool) $pagoAprobacion, 'pago' => $pagoAprobacion && !empty($pagoAprobacion['id']) ? $pagoAprobacion : null]);
        exit;
    }
    if ($r === 'admin_pedir' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $o = opuOrden($pdo, $in['order_id'] ?? 0);
        if (!$o) { http_response_code(404); echo json_encode(['error' => 'Expediente no encontrado']); exit; }
        if (!impTieneEleccion($o)) { http_response_code(409); echo json_encode(['error' => 'Primero marca la lancha elegida']); exit; }
        $ok = opuPedirActualizacion($pdo, $o, 'the Imporlan team is asking for an update on this boat.', mb_substr(trim((string) ($in['message'] ?? '')), 0, 2000));
        if (!$ok) { http_response_code(502); echo json_encode(['error' => 'No se pudo enviar el correo a ' . opuOperador()['nombre']]); exit; }
        echo json_encode(['success' => true]);
        exit;
    }
    if ($r === 'admin_compartir' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $err = opuCompartir($pdo, $in['update_id'] ?? 0, $in['text'] ?? '');
        if ($err) { http_response_code($err[0]); echo json_encode(['error' => $err[1]]); exit; }
        echo json_encode(['success' => true]);
        exit;
    }
    if ($r === 'admin_nuevo_link' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $o = opuOrden($pdo, $in['order_id'] ?? 0);
        if (!$o) { http_response_code(404); echo json_encode(['error' => 'Expediente no encontrado']); exit; }
        echo json_encode(['success' => true, 'portal_url' => opuUrlPortal(opuToken($pdo, $o, true))]);
        exit;
    }
    http_response_code(400);
    echo json_encode(['error' => 'Acción no válida']);
}
