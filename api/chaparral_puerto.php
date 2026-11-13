<?php
/**
 * Entrega en el puerto de EE. UU. de la Chaparral (IMP-00035), una sola vez
 * (JP, 11-nov-2026): «Carga estas 2 imágenes en el expediente de Alberto
 * Lathrop para la parte de la Entrega en Puerto. Con estas imágenes cargadas
 * se activa la solicitud del 3er pago… Revisa si había quedado algo pendiente
 * de algún paso anterior para dejar eso listo también.»
 *
 * Lo corre el job CLI del cron (api/cron/inspection_upload_followup.php):
 *   1. Sube las 2 fotos del drop-off al expediente (visibles para el cliente).
 *   2. Regulariza, sin avisos ni cobros, los hitos que ya ocurrieron y no
 *      estaban registrados: la compra (bill of sale firmado el 3-nov) y el
 *      retiro (8-nov). Si David mandó fotos del pick-up, quedan como su evidencia.
 *   3. Marca «Entregada en el puerto de EE. UU.»: crea el Pago 3 y le avisa al
 *      cliente con las fotos, el pago y unas líneas del equipo.
 *   4. Le manda al equipo un resumen con lo que hizo y el estado de los pagos.
 * Queda en order_events y no se repite. No toca montos ni confirma ingresos.
 */

require_once __DIR__ . '/operador_usa.php';

const IMP_PUERTO_EVENTO = 'chaparral_puerto_regularizacion';

/** Las fotos del drop-off que mandó JP (sin metadatos). */
function impPuertoFotos() {
    return [
        ['archivo' => __DIR__ . '/cron/datos/chaparral-puerto-1.jpg', 'nombre' => 'Chaparral en el puerto - frente.jpg'],
        ['archivo' => __DIR__ . '/cron/datos/chaparral-puerto-2.jpg', 'nombre' => 'Chaparral en el puerto - costado.jpg'],
    ];
}

function impPuertoMensaje() {
    return '¡Vamos avanzando muy bien! La operación va según lo planeado y cada paso se ha cumplido a tiempo: '
        . 'la compra, el retiro y ahora la entrega en el puerto. Ya sólo queda el último tramo, el embarque y el viaje a Chile. '
        . 'Muy pronto vas a estar disfrutando tu Chaparral en el agua. ¡Ya queda poco! 🚤';
}

/** Sube (o reutiliza, si una corrida anterior ya las subió) las fotos del puerto. Devuelve sus ids. */
function impPuertoSubirFotos($pdo, $order, $dir = null) {
    $dir = $dir ?: __DIR__ . '/expediente_files/';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $ids = [];
    foreach (impPuertoFotos() as $f) {
        $st = $pdo->prepare("SELECT id FROM expediente_files WHERE order_id = ? AND original_name = ? AND uploaded_by = 'equipo_puerto' ORDER BY id DESC LIMIT 1");
        $st->execute([intval($order['id']), $f['nombre']]);
        $id = intval($st->fetchColumn());
        if (!$id) {
            if (!is_file($f['archivo'])) throw new RuntimeException('falta la foto ' . basename($f['archivo']));
            $guardado = 'exp_' . intval($order['id']) . '_' . uniqid() . '_' . time() . '.jpg';
            if (!@copy($f['archivo'], $dir . $guardado)) throw new RuntimeException('no se pudo copiar la foto');
            $pdo->prepare("INSERT INTO expediente_files (order_id, original_name, stored_name, mime_type, file_size, category, description, uploaded_by, visible_to_client) VALUES (?, ?, ?, 'image/jpeg', ?, 'image', ?, 'equipo_puerto', 1)")
                ->execute([intval($order['id']), $f['nombre'], $guardado, filesize($dir . $guardado), 'Entrega en el puerto de EE. UU. (drop-off)']);
            $id = intval($pdo->lastInsertId());
        }
        $ids[] = $id;
    }
    return $ids;
}

/** Fotos del pick-up que David haya mandado como actualización desde el aviso del 8-nov. */
function impPuertoFotosRetiroDeDavid($pdo, $order) {
    $st = $pdo->prepare("SELECT id FROM expediente_files WHERE order_id = ? AND uploaded_by = 'operador_usa' AND (category = 'image' OR mime_type LIKE 'image/%') AND created_at >= '2026-11-08 00:00:00' ORDER BY id");
    $st->execute([intval($order['id'])]);
    return array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
}

/**
 * Registra hitos que ya ocurrieron con su fecha, sin correos, sin cobros y
 * sin pedirle nada a David (eso es para el avance en vivo, no para ponerse al día).
 * Devuelve [hito => fecha] de lo que registró.
 */
function impPuertoRegularizar($pdo, $order) {
    $fechas = [
        'disponibilidad' => '2026-10-22 12:00:00',
        'inspeccion' => !empty($order['inspection_client_ok_at']) ? $order['inspection_client_ok_at'] : '2026-10-29 12:00:00',
        'compra' => '2026-11-03 16:00:00',   // bill of sale firmado y fondos enviados al vendedor
        'retiro' => '2026-11-08 18:00:00',   // retirada por el transportista
    ];
    $pasos = impPasos($order);
    $nuevos = [];
    foreach (impHitos() as $k => $h) {
        if (!isset($fechas[$k]) || isset($pasos[$k])) continue;
        if (!empty($h['solo_con_inspeccion']) && empty($order['chosen_inspection'])) continue;
        $pasos[$k] = $fechas[$k];
        $nuevos[$k] = $fechas[$k];
    }
    if (!$nuevos) return [];
    $ordenados = [];
    foreach (impHitos() as $k => $_) if (isset($pasos[$k])) $ordenados[$k] = $pasos[$k];
    $pdo->prepare("UPDATE orders SET import_steps = ? WHERE id = ?")->execute([json_encode($ordenados), intval($order['id'])]);
    if (isset($nuevos['inspeccion'])) {
        $pdo->prepare("UPDATE orders SET inspection_result = NULL, inspection_result_at = NULL, inspection_note = NULL, inspection_decided_by = COALESCE(inspection_decided_by, 'cliente') WHERE id = ?")->execute([intval($order['id'])]);
    }
    foreach ($nuevos as $k => $fecha) {
        logOrderEvent($pdo, intval($order['id']), 'hito_importacion', ['hito' => $k, 'por' => 'equipo', 'quien' => 'regularización 11-nov', 'fecha' => $fecha]);
    }
    return $nuevos;
}

/** Los cobros del expediente, para el resumen al equipo. */
function impPuertoCobros($order) {
    $res = impConCobros(function (&$data) use ($order) {
        $out = [];
        foreach ($data['requests'] as $r) {
            if (!impCobroDelExpediente($r, intval($order['id']), $order['order_number'] ?? '') || ($r['status'] ?? '') === 'cancelled') continue;
            $b = impPaymentBalance($r);
            $out[] = ['titulo' => (string) ($r['title'] ?? ''), 'estado' => (string) ($r['status'] ?? ''), 'total' => $b['total'], 'confirmado' => $b['confirmed'], 'saldo' => $b['remaining'], 'comprobante' => impPaymentProofPending($r)];
        }
        return ['lista' => $out];
    });
    return $res['lista'] ?? [];
}

/**
 * La corrida única. Devuelve un resumen (array) o null si no corresponde.
 * $dirArchivos sólo para las pruebas.
 */
function impPuertoChaparralBootstrap($pdo, $ahora = null, $dirArchivos = null) {
    $ahora = $ahora ?: time();
    if ($ahora > strtotime('2026-11-20 00:00:00')) return null; // regularización puntual, no una regla
    require_once __DIR__ . '/orders_api.php';
    require_once __DIR__ . '/payment_balance.php';
    impAsegurarColumnas($pdo);
    $st = $pdo->prepare('SELECT * FROM orders WHERE order_number = ?');
    $st->execute(['IMP-00035']);
    $order = $st->fetch(PDO::FETCH_ASSOC);
    if (!$order || !impTieneEleccion($order) || impExpedienteCerrado($order) || !empty($order['refund_requested_at'])) return null;
    $link = impLeerLink($pdo, $order['id'], $order['chosen_link_id'] ?? 0);
    $titulo = impTituloLancha($link);
    foreach (['chaparral', '21', 'sport', 'h2o'] as $parte) if (strpos(strtolower($titulo), $parte) === false) return null; // nunca otra lancha
    $ya = $pdo->prepare('SELECT COUNT(*) FROM order_events WHERE order_id = ? AND event_type = ?');
    $ya->execute([intval($order['id']), IMP_PUERTO_EVENTO]);
    if (intval($ya->fetchColumn()) > 0) return null;

    $resumen = ['regularizados' => [], 'fotos' => 0, 'fotos_retiro' => 0, 'puerto' => 'ya estaba', 'pago3' => null, 'cliente_avisado' => false];
    $ids = impPuertoSubirFotos($pdo, $order, $dirArchivos);
    $resumen['fotos'] = count($ids);

    $resumen['regularizados'] = impPuertoRegularizar($pdo, $order);
    $st->execute(['IMP-00035']);
    $order = $st->fetch(PDO::FETCH_ASSOC);

    // El pick-up: si David mandó fotos, quedan como evidencia del retiro.
    if (isset(impPasos($order)['retiro']) && empty(impEvidencia($order)['retiro'])) {
        $deDavid = impPuertoFotosRetiroDeDavid($pdo, $order);
        if ($deDavid) {
            [$validas, $err] = impPrepararEvidencia($pdo, $order, 'retiro', $deDavid);
            if (!$err) { impGuardarEvidencia($pdo, $order, 'retiro', $validas, 'operador'); $resumen['fotos_retiro'] = count($validas); }
            $st->execute(['IMP-00035']);
            $order = $st->fetch(PDO::FETCH_ASSOC);
        }
    }

    if (!isset(impPasos($order)['transporte'])) {
        [$validas, $err] = impPrepararEvidencia($pdo, $order, 'transporte', $ids);
        if ($err) throw new RuntimeException('fotos del puerto: ' . $err);
        impGuardarEvidencia($pdo, $order, 'transporte', $validas, 'equipo');
        $st->execute(['IMP-00035']);
        $order = $st->fetch(PDO::FETCH_ASSOC);
        $r = impAplicarHito($pdo, $order, 'transporte', true, true, 'equipo', 'contacto@imporlan.cl', [
            'fotos' => count($validas),
            'mensaje' => impPuertoMensaje(),
        ]);
        $resumen['puerto'] = 'marcada';
        $resumen['cliente_avisado'] = !empty($r['notificado']);
        if (!empty($r['pago']['cobro'])) {
            $c = $r['pago']['cobro'];
            $resumen['pago3'] = ['id' => $c['id'], 'monto' => intval($c['amount_clp']), 'estado' => $c['status'], 'creado' => !empty($r['pago']['creado'])];
        }
    }
    opuLog($pdo, $order['id'], IMP_PUERTO_EVENTO, $resumen);

    try {
        require_once __DIR__ . '/email_service.php';
        (new EmailService())->sendCustomEmail('contacto@imporlan.cl',
            'Chaparral entregada en el puerto: Pago 3 ' . ($resumen['pago3'] ? 'solicitado' : 'sin solicitar') . ' · ' . ($order['order_number'] ?? '') . ' · ' . $titulo,
            opuHtmlCorreo($titulo, impPuertoResumenHtml($resumen, impPuertoCobros($order), intval($order['id'])), 'equipo', 'Entrega en el puerto de EE. UU.'));
    } catch (\Throwable $e) {
        error_log('impPuertoChaparralBootstrap equipo: ' . get_class($e));
    }
    return $resumen;
}

function impPuertoResumenHtml($resumen, $cobros, $orderId) {
    $nombres = ['disponibilidad' => 'Disponibilidad confirmada', 'inspeccion' => 'Inspección técnica aprobada', 'compra' => 'Compra cerrada', 'retiro' => 'Retirada por el transportista'];
    $p = function ($t) { return '<p style="margin:0 0 10px">' . $t . '</p>'; };
    $clp = function ($n) { return '$' . number_format((float) $n, 0, ',', '.'); };
    $h = $p('Subimos las <strong>' . intval($resumen['fotos']) . ' fotos del drop-off</strong> al expediente (visibles para el cliente) y '
        . ($resumen['puerto'] === 'marcada' ? 'marcamos <strong>«Entregada en el puerto de EE. UU.»</strong>.' : 'el hito «Entregada en el puerto de EE. UU.» ya estaba registrado, así que no se repitió el aviso.'));
    if ($resumen['regularizados']) {
        $li = '';
        foreach ($resumen['regularizados'] as $k => $f) $li .= '<li>' . opuEsc($nombres[$k] ?? $k) . ' · ' . opuEsc(date('d-m-Y', strtotime($f))) . '</li>';
        $h .= $p('Dejamos al día los pasos anteriores que ya habían ocurrido y no estaban registrados (sin correos ni cobros):') . '<ul style="margin:0 0 10px;padding-left:20px">' . $li . '</ul>';
    } else {
        $h .= $p('Los pasos anteriores ya estaban registrados.');
    }
    if ($resumen['fotos_retiro']) $h .= $p('El retiro quedó con las ' . intval($resumen['fotos_retiro']) . ' fotos del pick-up que mandó David.');
    if ($resumen['pago3']) {
        $h .= $p('<strong>Pago 3:</strong> ' . ($resumen['pago3']['creado'] ? 'solicitado' : 'ya existía') . ' por ' . $clp($resumen['pago3']['monto']) . '. '
            . ($resumen['cliente_avisado'] ? 'A Alberto le llegó el aviso con las fotos, el botón para pagarlo y un mensaje del equipo.' : 'El correo al cliente no salió: conviene reenviarlo desde el expediente.'));
    } elseif ($resumen['puerto'] === 'marcada') {
        $h .= $p('<strong>Ojo:</strong> no se pudo crear el Pago 3 (la cotización publicada no tiene ese pago). Créalo desde el expediente.');
    }
    if ($cobros) {
        $filas = '';
        foreach ($cobros as $c) {
            $estado = $c['saldo'] <= 0 ? 'Pagado' : ($c['comprobante'] ? 'Comprobante por revisar' : ($c['confirmado'] > 0 ? 'Abono parcial' : 'Pendiente'));
            $filas .= '<tr><td style="padding:6px 8px;border-top:1px solid #e2e8f0">' . opuEsc($c['titulo']) . '</td><td style="padding:6px 8px;border-top:1px solid #e2e8f0;text-align:right">' . $clp($c['total']) . '</td><td style="padding:6px 8px;border-top:1px solid #e2e8f0;text-align:right">' . $clp($c['confirmado']) . '</td><td style="padding:6px 8px;border-top:1px solid #e2e8f0">' . $estado . '</td></tr>';
        }
        $h .= '<table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;margin:4px 0 12px"><tr style="color:#64748b;text-align:left"><th style="padding:6px 8px">Cobro</th><th style="padding:6px 8px;text-align:right">Total</th><th style="padding:6px 8px;text-align:right">Confirmado</th><th style="padding:6px 8px">Estado</th></tr>' . $filas . '</table>';
        $h .= $p('<span style="font-size:12px;color:#64748b">Sólo cuentan los ingresos confirmados; los comprobantes por revisar se concilian desde el expediente.</span>');
    }
    return $h . opuBoton('Abrir expediente en el admin', 'https://www.imporlan.cl/panel/admin/#/orders?id=' . intval($orderId));
}

/**
 * Aviso único a David (JP, 11-nov-2026: «Avísale a David que la Chaparral ya
 * está en puerto»). En inglés, sin datos del cliente ni montos. Le agradece,
 * le dice que la entrega en el puerto quedó registrada con fotos y que por
 * ahora no tiene nada pendiente; si tiene fotos del pick-up o del drop-off,
 * puede sumarlas desde su link. Copia al equipo. Devuelve true, null (no
 * corresponde) o false (falló el envío: el cron lo reintenta).
 */
function opuPuertoAvisoBootstrap($pdo, $ahora = null) {
    $ahora = $ahora ?: time();
    if ($ahora > strtotime('2026-11-20 00:00:00')) return null;
    $st = $pdo->prepare('SELECT * FROM orders WHERE order_number = ?');
    $st->execute(['IMP-00035']);
    $order = $st->fetch(PDO::FETCH_ASSOC);
    if (!$order || !impTieneEleccion($order) || impExpedienteCerrado($order)) return null;
    $link = impLeerLink($pdo, $order['id'], $order['chosen_link_id'] ?? 0);
    $titulo = impTituloLancha($link);
    foreach (['chaparral', '21', 'sport', 'h2o'] as $parte) if (strpos(strtolower($titulo), $parte) === false) return null;
    if (!isset(impPasos($order)['transporte'])) return null; // primero tiene que estar registrada en el puerto
    $ya = $pdo->prepare("SELECT COUNT(*) FROM order_events WHERE order_id = ? AND event_type = 'operador_usa_puerto_aviso'");
    $ya->execute([intval($order['id'])]);
    if (intval($ya->fetchColumn()) > 0) return null;

    $url = opuUrlPortal(opuToken($pdo, $order));
    $nombre = explode(' ', opuOperador()['nombre'])[0];
    $sinPickup = empty(impEvidencia($order)['retiro']);
    $cuerpo = '<p style="margin:0 0 12px">Hi ' . opuEsc($nombre) . ', good news: the boat is now at the US port, ready to ship to Chile. We registered the port delivery with the drop-off photos. Thank you for your help getting it there.</p>'
        . opuFichaLancha($order, $link)
        . '<div style="padding:14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;line-height:1.6"><strong>Registered</strong><br>'
        . 'Purchase · Picked up by the carrier · Delivered at the US port, ready to ship.<br>'
        . '<strong>What we need now:</strong> nothing for the moment. The ocean shipping to Chile is coordinated by our team; we will let you know if anything comes up.'
        . ($sinPickup ? '<br>If you have the pickup photos (boat on the trailer or truck), please add them from your private link so the file is complete.' : '')
        . '</div>'
        . opuBoton('Open your private link', $url)
        . '<p style="font-size:12px;color:#64748b;margin:8px 0 0">This link is private to this file. You can use it as many times as you need.</p>';
    $ok = opuEnviar('[Imporlan] The boat is at the port · ' . ($order['order_number'] ?? '') . ' · ' . $titulo,
        opuHtmlCorreo($titulo, $cuerpo, 'operador', 'Port delivery · ' . ($order['order_number'] ?? '')));
    if (!$ok) return false;
    opuLog($pdo, $order['id'], 'operador_usa_puerto_aviso', ['sin_pickup' => $sinPickup]);
    try {
        require_once __DIR__ . '/email_service.php';
        (new EmailService())->sendCustomEmail('contacto@imporlan.cl', 'Le avisamos a David que la Chaparral está en el puerto · ' . ($order['order_number'] ?? '') . ' · ' . $titulo,
            opuHtmlCorreo($titulo,
                '<p style="margin:0 0 10px">Le escribimos a ' . opuEsc(opuOperador()['nombre']) . ' que la lancha ya está en el puerto de EE. UU., lista para embarcar, y que la entrega quedó registrada con fotos.</p>'
                . '<p style="margin:0 0 10px">Le dijimos que por ahora no tiene nada pendiente: el embarque a Chile lo coordina el equipo.'
                . ($sinPickup ? ' También le pedimos que, si tiene las fotos del pick-up, las sume desde su link para completar el expediente.' : '') . '</p>'
                . '<p style="margin:0 0 10px;font-size:13px;color:#64748b">Sin datos del cliente ni montos.</p>'
                . opuBoton('Abrir expediente en el admin', 'https://www.imporlan.cl/panel/admin/#/orders?id=' . intval($order['id'])), 'equipo', 'Entrega en el puerto de EE. UU.'));
    } catch (\Throwable $e) {
        error_log('opuPuertoAvisoBootstrap equipo: ' . get_class($e));
    }
    return true;
}

/**
 * Las fotos del pick-up que David suba después del aviso del puerto (se las
 * pedimos sólo si el retiro no tenía fotos) quedan como evidencia del retiro:
 * su link ya no muestra la sección «Pickup», así que llegan como actualización.
 * Corre en cada turno del cron hasta el 20-nov; deja de actuar cuando el
 * retiro ya tiene fotos.
 */
function impPuertoFotosRetiroTardias($pdo, $ahora = null) {
    $ahora = $ahora ?: time();
    if ($ahora > strtotime('2026-11-20 00:00:00')) return null;
    $st = $pdo->prepare('SELECT * FROM orders WHERE order_number = ?');
    $st->execute(['IMP-00035']);
    $order = $st->fetch(PDO::FETCH_ASSOC);
    if (!$order || !isset(impPasos($order)['retiro']) || !empty(impEvidencia($order)['retiro'])) return null;
    $ev = $pdo->prepare("SELECT meta_json, created_at FROM order_events WHERE order_id = ? AND event_type = 'operador_usa_puerto_aviso' ORDER BY id DESC LIMIT 1");
    $ev->execute([intval($order['id'])]);
    $aviso = $ev->fetch(PDO::FETCH_ASSOC);
    if (!$aviso || empty(json_decode((string) $aviso['meta_json'], true)['sin_pickup'])) return null;
    $f = $pdo->prepare("SELECT id FROM expediente_files WHERE order_id = ? AND uploaded_by = 'operador_usa' AND (category = 'image' OR mime_type LIKE 'image/%') AND created_at >= ? ORDER BY id");
    $f->execute([intval($order['id']), $aviso['created_at']]);
    $ids = array_map('intval', $f->fetchAll(PDO::FETCH_COLUMN));
    if (!$ids) return null;
    [$validas, $err] = impPrepararEvidencia($pdo, $order, 'retiro', $ids);
    if ($err) return null;
    impGuardarEvidencia($pdo, $order, 'retiro', $validas, 'operador');
    opuLog($pdo, $order['id'], 'operador_usa_retiro_fotos', ['fotos' => count($validas)]);
    return count($validas);
}

/**
 * Abonos de Alberto al Pago 3, cada uno confirmado por JP antes de registrarlo:
 *  1) 12-nov-2026: «Recibí los 5.000.000 para que lo registres», con la línea de
 *     su cartola Santander: 12/11/2026 · $5.000.000 · 007355442K Transf. LATHROP
 *     ERNST ALBERTO EDUARDO.
 *  2) 13-nov-2026: «Si correcto recibido!» sobre el aviso de Scotiabank de las
 *     10:53 (Alberto → cuenta Santander de Imporlan, $4.500.000, «pago 3- abono
 *     2- lathrop»).
 * Se registran como ingreso confirmado por JP con impPaymentAddCredit, igual que
 * «Registrar abono» del admin: idempotente, sin tocar el monto del cobro; el saldo
 * queda para los recordatorios. Cada uno una sola vez; resumen al equipo.
 */
function impPuertoAbonosPago3() {
    return [
        [
            'evento' => 'chaparral_abono_pago3',
            'monto' => 5000000,
            'fecha' => '2026-11-12',
            'fecha_txt' => '12-11-2026',
            'referencia' => '007355442K',
            'mensaje' => 'abono a cuota 3 - alberto lathrop',
            'nota' => 'Transferencia de ALBERTO EDUARDO LATHROP ERNST (Scotiabank) a la cuenta Santander de Imporlan, mensaje «abono a cuota 3 - alberto lathrop». Ingreso confirmado por JP en la cartola Santander del 12-11-2026.',
            'clave' => 'imp00035-p3-007355442K',
            'respaldo' => 'Falta asociar el comprobante que Alberto mandó por correo a contacto@imporlan.cl (foto adjunta, 11-11 21:05); mientras, el seguimiento le pide adjuntarlo en su panel, sin volver a cobrarle el abono.',
        ],
        [
            'evento' => 'chaparral_abono2_pago3',
            'monto' => 4500000,
            'fecha' => '2026-11-13',
            'fecha_txt' => '13-11-2026',
            'referencia' => 'Scotiabank 13-11-2026 10:53',
            'mensaje' => 'pago 3- abono 2- lathrop',
            'nota' => 'Transferencia de ALBERTO EDUARDO LATHROP ERNST (Scotiabank, 13-11-2026 10:53) a la cuenta Santander de Imporlan, mensaje «pago 3- abono 2- lathrop». Ingreso confirmado por JP el 13-11-2026.',
            'clave' => 'imp00035-p3-abono2-20261113',
            'respaldo' => 'Alberto mandó el aviso de Scotiabank y una foto a contacto@imporlan.cl (13-11, 10:54 y 13:53); falta asociarlos al abono. Mientras, el seguimiento le pide adjuntarlo en su panel, sin volver a cobrarle el abono.',
        ],
    ];
}

function impPuertoAbonoPago3Bootstrap($pdo, $ahora = null) {
    $ahora = $ahora ?: time();
    if ($ahora > strtotime('2026-11-20 00:00:00')) return null;
    $ultimo = null;
    foreach (impPuertoAbonosPago3() as $abono) {
        $r = impPuertoRegistrarAbonoPago3($pdo, $abono);
        if ($r !== null) $ultimo = $r;
        if ($r === false || (is_array($r) && empty($r['ok']))) break; // en orden: el siguiente espera al anterior
    }
    return $ultimo;
}

function impPuertoRegistrarAbonoPago3($pdo, $abono) {
    require_once __DIR__ . '/payment_balance.php';
    $st = $pdo->prepare('SELECT * FROM orders WHERE order_number = ?');
    $st->execute(['IMP-00035']);
    $order = $st->fetch(PDO::FETCH_ASSOC);
    if (!$order || !impTieneEleccion($order)) return null;
    if (strpos(strtolower(impTituloLancha(impLeerLink($pdo, $order['id'], $order['chosen_link_id'] ?? 0))), 'chaparral') === false) return null; // nunca otra lancha
    $evento = $abono['evento'];
    $ya = $pdo->prepare("SELECT COUNT(*) FROM order_events WHERE order_id = ? AND event_type = ?");
    $ya->execute([intval($order['id']), $evento]);
    if (intval($ya->fetchColumn()) > 0) return null;
    // Sólo el Pago 3 vigente de Alberto: su correo, la lancha elegida y pendiente. Si no hay
    // exactamente uno, no se acredita nada (nunca a un cobro ambiguo).
    $candidatos = impConCobros(function (&$data) use ($order) {
        $out = [];
        foreach ($data['requests'] as $r) {
            if (!impEsPagoDelExpediente($r, intval($order['id']), 3, $order['order_number'] ?? '') || ($r['status'] ?? '') === 'cancelled') continue;
            if (strtolower(trim((string) ($r['user_email'] ?? ''))) !== strtolower(trim((string) $order['customer_email']))) continue;
            $link = intval($r['metadata']['custom_fields']['link_id'] ?? 0);
            if ($link && $link !== intval($order['chosen_link_id'])) continue;
            $out[] = $r;
        }
        return ['lista' => $out];
    });
    $candidatos = $candidatos['lista'] ?? [];
    if (!$candidatos) return null;
    $cobro = count($candidatos) === 1 ? $candidatos[0] : null;
    $yaRegistrado = false;
    if ($cobro) {
        foreach ($cobro['payment_credits'] ?? [] as $c) if (($c['idempotency_key'] ?? '') === $abono['clave']) $yaRegistrado = true;
    }
    if (!$cobro || (($cobro['status'] ?? '') !== 'pending' && !$yaRegistrado)) {
        $code = 409;
        $res = $cobro ? 'El Pago 3 ya no está pendiente.' : 'Hay más de un Pago 3 vigente de Alberto; elige a cuál va el abono.';
    } else {
    $antes = impPaymentBalance($cobro);
    [$code, $res] = impPaymentAddCredit($cobro['id'], [
        'amount_clp' => $abono['monto'],
        'received_on' => $abono['fecha'],
        'bank' => 'santander',
        'reference' => $abono['referencia'],
        'note' => $abono['nota'],
        'receipt_id' => '',
        'idempotency_key' => $abono['clave'],
        'expected_amount_clp' => $antes['total'],
        'expected_remaining_clp' => $antes['remaining'],
    ], 'jpchs1@gmail.com');
    }
    if ($code !== 200) {
        // Sin el evento de éxito: el próximo turno del cron reintenta (la clave de registro evita duplicarlo).
        // Al equipo se le avisa del problema sólo la primera vez.
        $errores = $pdo->prepare("SELECT COUNT(*) FROM order_events WHERE order_id = ? AND event_type = ?");
        $errores->execute([intval($order['id']), $evento . '_error']);
        $primera = intval($errores->fetchColumn()) === 0;
        opuLog($pdo, $order['id'], $evento . '_error', ['code' => $code, 'error' => is_string($res) ? $res : 'error']);
        if (!$primera) return false;
        $resumen = ['ok' => false, 'error' => is_string($res) ? $res : 'No se pudo registrar.'];
    } else {
        $despues = impPaymentBalance($res['request']);
        if (!empty($res['newly_paid'])) impPaymentNotifyCompleted($res['request']);
        opuLog($pdo, $order['id'], $evento, ['ok' => true, 'duplicado' => !empty($res['duplicate']), 'saldo' => $despues['remaining']]);
        $resumen = ['ok' => true, 'total' => $despues['total'], 'confirmado' => $despues['confirmed'], 'saldo' => $despues['remaining'], 'pagado' => !empty($res['newly_paid'])];
    }
    try {
        require_once __DIR__ . '/email_service.php';
        $clp = function ($n) { return '$' . number_format((float) $n, 0, ',', '.'); };
        $titulo = impTituloLancha(impLeerLink($pdo, $order['id'], $order['chosen_link_id'] ?? 0));
        $cuerpo = $resumen['ok']
            ? '<p style="margin:0 0 10px">Registramos el abono de Alberto al <strong>Pago 3</strong> como ingreso confirmado por ti:</p>'
                . '<ul style="margin:0 0 10px;padding-left:20px"><li>' . opuEsc($abono['fecha_txt']) . ' · ' . $clp($abono['monto']) . ' · Santander · ref. ' . opuEsc($abono['referencia']) . '</li><li>Mensaje: «' . opuEsc($abono['mensaje']) . '»</li></ul>'
                . '<p style="margin:0 0 10px">Pago 3: total ' . $clp($resumen['total']) . ' · confirmado ' . $clp($resumen['confirmado']) . ' · <strong>saldo ' . $clp($resumen['saldo']) . '</strong>. Los recordatorios, la transferencia y Webpay le piden sólo el saldo.</p>'
                . '<p style="margin:0 0 10px;font-size:13px;color:#64748b">' . opuEsc($abono['respaldo']) . '</p>'
            : '<p style="margin:0 0 10px"><strong>Todavía no se pudo registrar el abono de ' . $clp($abono['monto']) . ' al Pago 3:</strong> ' . opuEsc($resumen['error']) . '</p><p style="margin:0 0 10px">El sistema lo reintenta solo cada pocos minutos (sin duplicarlo). Si prefieres, regístralo desde el expediente (Pago 3 → Registrar abono).</p>';
        (new EmailService())->sendCustomEmail('contacto@imporlan.cl',
            ($resumen['ok'] ? 'Abono registrado al Pago 3: ' . $clp($abono['monto']) . ' · saldo ' . $clp($resumen['saldo']) : 'No se pudo registrar el abono al Pago 3') . ' · ' . ($order['order_number'] ?? ''),
            opuHtmlCorreo($titulo, $cuerpo . opuBoton('Abrir expediente en el admin', 'https://www.imporlan.cl/panel/admin/#/orders?id=' . intval($order['id'])), 'equipo', 'Pago 3 · abono'));
    } catch (\Throwable $e) {
        error_log('impPuertoAbonoPago3Bootstrap equipo: ' . get_class($e));
    }
    return $resumen;
}
