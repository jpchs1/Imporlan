<?php
/**
 * Elegir la lancha e iniciar la importación.
 *
 * Hasta oct-2026 el cliente sólo podía ordenar el ranking y «avisar a su
 * agente»; que había elegido una lancha quedaba en un WhatsApp o un correo
 * (Alberto Lathrop, IMP del Chaparral 21 Sport H2O). Desde aquí la elección
 * es un dato del expediente:
 *
 *   orders.chosen_link_id     la lancha (order_links.id)
 *   orders.chosen_at          cuándo
 *   orders.chosen_by          'cliente' o 'equipo' (si la marcó el agente)
 *   orders.chosen_inspection  1 = quiere inspección técnica antes de comprar
 *   orders.chosen_note        lo que el cliente le dijo al agente al elegir
 *   orders.import_steps       JSON {hito: 'Y-m-d H:i:s'} — lo que el equipo
 *                             fue marcando como hecho (ver impHitos)
 *
 * Reglas, todas aquí para que el panel, el admin y los tests digan lo mismo:
 *   - El cliente elige sólo una lancha suya, con anuncio, disponible y en un
 *     expediente que no esté cerrado.
 *   - Puede cambiar de lancha o deshacer la elección mientras el equipo no
 *     haya marcado ningún hito. Después, se habla con el agente.
 *   - Elegir mueve la etapa: con inspección, a Inspección (3) hasta que esté
 *     aprobada; sin inspección, directo a Compra (4). Los hitos de viaje,
 *     aduana y entrega la llevan a Logística (5).
 */

/** Los hitos que marca el equipo, en orden. La elección misma no es un hito. */
function impHitos() {
    return [
        'disponibilidad' => ['label' => 'Disponibilidad y precio confirmados con el vendedor', 'corto' => 'Disponibilidad confirmada', 'etapa' => 3],
        'inspeccion'     => ['label' => 'Inspección técnica aprobada', 'corto' => 'Inspección aprobada', 'etapa' => 3, 'solo_con_inspeccion' => true],
        'compra'         => ['label' => 'Compra cerrada en Estados Unidos', 'corto' => 'Compra cerrada', 'etapa' => 4],
        'transporte'     => ['label' => 'En camino a Chile', 'corto' => 'En camino', 'etapa' => 5],
        'aduana'         => ['label' => 'Aduana e internación completadas', 'corto' => 'Aduana completada', 'etapa' => 5],
        'entrega'        => ['label' => 'Entregada', 'corto' => 'Entregada', 'etapa' => 5],
    ];
}

/** Hitos hechos de un expediente: [clave => fecha], sólo claves conocidas. */
function impPasos($order) {
    $raw = $order['import_steps'] ?? null;
    if (is_string($raw) && $raw !== '') $raw = json_decode($raw, true);
    if (!is_array($raw)) return [];
    $hitos = impHitos();
    $out = [];
    foreach ($raw as $k => $v) {
        if (isset($hitos[$k]) && $v) $out[$k] = (string) $v;
    }
    return $out;
}

/** No avanzar a logística antes de comprar ni deshacer la base de hitos posteriores. */
function impValidarCambioHito($order, $paso, $hecho) {
    $pasos = impPasos($order);
    if ($hecho && isset($pasos[$paso])) return null;
    if ($hecho && impExpedienteCerrado($order)) return 'Este expediente está cerrado. Revisa su estado antes de avanzar la importación.';
    if ($hecho && $paso !== 'inspeccion' && impInspeccionNoApta($order)) return 'El cliente decidió no seguir con esta lancha. Primero debe elegir otra opción o resolver su devolución.';
    $requisitos = [
        'compra' => !empty($order['chosen_inspection']) ? ['disponibilidad', 'inspeccion'] : ['disponibilidad'],
        'transporte' => ['compra'], 'aduana' => ['transporte'], 'entrega' => ['aduana'],
    ];
    if ($hecho) {
        foreach ($requisitos[$paso] ?? [] as $anterior) {
            if (!isset($pasos[$anterior])) return 'Antes de marcar «' . impHitos()[$paso]['label'] . '», registra «' . impHitos()[$anterior]['label'] . '».';
        }
    } elseif (isset($pasos[$paso])) {
        $posterior = false;
        foreach (impHitos() as $id => $hito) {
            if ($id === $paso) { $posterior = true; continue; }
            if ($posterior && isset($pasos[$id])) return 'Primero deshaz «' . $hito['label'] . '». Los hitos posteriores dependen de este paso.';
        }
    }
    return null;
}

function impTieneEleccion($order) {
    return intval($order['chosen_link_id'] ?? 0) > 0;
}

/** Etapa (1-5) que impone la elección y sus hitos; 0 si no hay elección. */
function impEtapaPorEleccion($order) {
    if (!impTieneEleccion($order)) return 0;
    $pasos = impPasos($order);
    $etapa = 3;
    if (empty($order['chosen_inspection']) || isset($pasos['inspeccion'])) $etapa = 4;
    foreach (impHitos() as $k => $h) {
        if (isset($pasos[$k]) && $h['etapa'] > $etapa) $etapa = $h['etapa'];
    }
    return $etapa;
}

/** El cliente puede cambiar o deshacer su elección hasta que el equipo marque un hito. */
function impClientePuedeCambiar($order) {
    // Inspección no apta: el cliente vuelve a elegir (su Pago 1 se abona a la
    // nueva lancha), salvo que haya pedido la devolución.
    if (impInspeccionNoApta($order)) return empty($order['refund_requested_at']);
    return impPasos($order) === [];
}

/** La inspección recomendó no comprar la lancha elegida. */
function impInspeccionNoApta($order) {
    return impTieneEleccion($order) && ($order['inspection_result'] ?? '') === 'no_apta';
}

function impExpedienteCerrado($order) {
    return in_array($order['status'] ?? '', ['completed', 'expired', 'canceled', 'cancelled'], true);
}

/**
 * ¿Puede el cliente elegir esta lancha? null si sí; si no, [código HTTP, mensaje].
 * $link es la fila de order_links (o null si no existe).
 */
function impValidarEleccionCliente($order, $link) {
    if (!$order) return [404, 'Expediente no encontrado'];
    if (impExpedienteCerrado($order)) return [409, 'Este expediente ya está cerrado. Escríbele a tu agente si quieres retomarlo.'];
    if (!$link || intval($link['order_id'] ?? 0) !== intval($order['id'] ?? -1)) return [404, 'Esa lancha no está en tu expediente'];
    if (trim((string) ($link['url'] ?? '')) === '') return [400, 'Esa opción todavía no tiene anuncio'];
    if (in_array($link['link_status'] ?? 'active', ['sold', 'unavailable'], true)) return [409, 'Esa lancha ya no está disponible'];
    if (in_array(intval($link['id'] ?? 0), impLanchasDeclinadas($order), true)) {
        return [409, 'Decidiste no seguir con esa lancha tras la inspección. Elige otra de tu ranking.'];
    }
    if (impTieneEleccion($order) && !impClientePuedeCambiar($order)) {
        return [409, 'Tu importación ya avanzó. Para cambiar de lancha, habla con tu agente.'];
    }
    return null;
}

/** Lo que el panel necesita saber de la elección (va dentro de order). */
function impEleccionPublica($order) {
    if (!impTieneEleccion($order)) return null;
    return [
        'link_id'        => intval($order['chosen_link_id']),
        'at'             => $order['chosen_at'] ?? null,
        'by'             => $order['chosen_by'] ?? 'cliente',
        'inspection'     => !empty($order['chosen_inspection']),
        'note'           => (string) ($order['chosen_note'] ?? ''),
        'steps'          => (object) impPasos($order),
        'client_can_change' => impClientePuedeCambiar($order),
        // Inspección no apta (JP: «si sale no apto se ahorra un problema y
        // conviene ver otra opción»): resultado, nota del equipo y si el
        // cliente pidió la devolución del Pago 1 en vez de elegir otra.
        'inspection_result' => impInspeccionNoApta($order) ? 'no_apta' : null,
        'inspection_result_at' => impInspeccionNoApta($order) ? ($order['inspection_result_at'] ?? null) : null,
        'inspection_note' => impInspeccionNoApta($order) ? (string) ($order['inspection_note'] ?? '') : '',
        'refund_requested_at' => $order['refund_requested_at'] ?? null,
        // JP, 21-oct-2026: «Nosotros cumplimos con cargar el reporte, pero el
        // cliente es el que toma la decisión si aprueba o declina la compra».
        'inspection_stage' => impEtapaInspeccion($order),
        'inspection_decided_by' => impInspeccionNoApta($order) || isset(impPasos($order)['inspeccion']) || impAprobadaEsperaPrecio($order)
            ? ($order['inspection_decided_by'] ?? null) : null,
        // El cliente aprobó, pero el hito y el Pago 2 esperan la validación del
        // precio de compra tras la inspección (opuPriceGate).
        'inspection_waiting_price' => impAprobadaEsperaPrecio($order),
        'inspection_client_ok_at' => impAprobadaEsperaPrecio($order) ? $order['inspection_client_ok_at'] : null,
        'inspection_report' => impReporteInspeccion($order),
    ];
}

/** Lanchas que el cliente declinó tras la inspección: ya no se pueden volver a elegir. */
function impLanchasDeclinadas($order) {
    $raw = $order['declined_link_ids'] ?? null;
    $ids = is_string($raw) && $raw !== '' ? json_decode($raw, true) : $raw;
    $out = [];
    foreach ((array) $ids as $id) if (intval($id) > 0) $out[] = intval($id);
    // La elegida que está declinada también cuenta (aún no elige otra).
    if (impInspeccionNoApta($order)) $out[] = intval($order['chosen_link_id']);
    return array_values(array_unique($out));
}

/**
 * Dónde va la inspección de la lancha elegida:
 *   null           sin elección o sin inspección
 *   'coordinando'  pedida, aún sin reporte
 *   'reporte_listo' el equipo cargó el reporte: el cliente decide
 *   'aprobada'     el cliente aprobó (hito «inspeccion» hecho)
 *   'declinada'    el cliente no sigue con esta lancha
 */
function impEtapaInspeccion($order) {
    if (!impTieneEleccion($order) || empty($order['chosen_inspection'])) return null;
    if (impInspeccionNoApta($order)) return 'declinada';
    if (isset(impPasos($order)['inspeccion']) || impAprobadaEsperaPrecio($order)) return 'aprobada';
    return !empty($order['inspection_report_at']) ? 'reporte_listo' : 'coordinando';
}

/** El cliente aprobó el reporte y falta validar el precio tras la inspección para marcar el hito. */
function impAprobadaEsperaPrecio($order) {
    return impTieneEleccion($order) && !empty($order['chosen_inspection']) && !empty($order['inspection_client_ok_at'])
        && !isset(impPasos($order)['inspeccion']) && !impInspeccionNoApta($order);
}

/** Minutos sin terminar tras los que una traducción en curso se da por caída. */
define('IMP_TRADUCCION_VENCE_MIN', 20);

/** Estado de la traducción al español: 'pendiente' | 'listo' | 'error' | null. */
function impEstadoTraduccion($order) {
    $st = $order['inspection_es_status'] ?? null;
    if ($st === 'pendiente' && !empty($order['inspection_es_at'])
        && strtotime($order['inspection_es_at']) < time() - IMP_TRADUCCION_VENCE_MIN * 60) return 'error';
    return in_array($st, ['pendiente', 'listo', 'error'], true) ? $st : null;
}

/** El reporte de inspección cargado (sin el texto traducido, que va aparte), o null. */
function impReporteInspeccion($order) {
    if (empty($order['inspection_report_at']) || empty($order['chosen_inspection'])) return null;
    return [
        'at' => $order['inspection_report_at'],
        'file_id' => intval($order['inspection_report_file_id'] ?? 0) ?: null,
        'summary' => (string) ($order['inspection_summary'] ?? ''),
        'es_status' => impEstadoTraduccion($order),
        'es_at' => impEstadoTraduccion($order) === 'listo' ? ($order['inspection_es_at'] ?? null) : null,
    ];
}

/**
 * Lo que se limpia al cambiar de lancha o deshacer la elección: el resultado,
 * el reporte y su traducción son de la lancha anterior.
 */
function impSqlLimpiarInspeccion() {
    return "inspection_result = NULL, inspection_result_at = NULL, inspection_note = NULL, inspection_decided_by = NULL, inspection_client_ok_at = NULL, "
        . "inspection_report_file_id = NULL, inspection_report_at = NULL, inspection_summary = NULL, "
        . "inspection_es = NULL, inspection_es_status = NULL, inspection_es_at = NULL, inspection_es_error = NULL";
}

/** La lista de declinadas con la lancha elegida agregada si el cliente la declinó. */
function impDeclinadasAlCambiar($order) {
    $ids = impLanchasDeclinadas($order);
    return $ids ? json_encode($ids) : ($order['declined_link_ids'] ?? null);
}

/** Título legible de una lancha del ranking (igual que tituloEmbarcacion en el panel). */
function impTituloLancha($link) {
    $l = is_array($link) ? $link : [];
    $t = trim((string) ($l['title'] ?? ''));
    if ($t !== '') return $t;
    $armado = trim(implode(' ', array_filter([$l['make'] ?? '', $l['model'] ?? '', $l['year'] ?? ''])));
    return $armado !== '' ? $armado : 'la embarcación';
}

function impLeerLink($pdo, $orderId, $linkId) {
    if (!$linkId) return null;
    $st = $pdo->prepare("SELECT * FROM order_links WHERE id = ? AND order_id = ?");
    $st->execute([intval($linkId), intval($orderId)]);
    return $st->fetch(PDO::FETCH_ASSOC) ?: null;
}

/** Crea las columnas si faltan. Barato: una consulta de columnas. */
function impAsegurarColumnas($pdo) {
    static $hecho = false;
    if ($hecho) return;
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
        $faltan = [
            'chosen_link_id'    => "ALTER TABLE orders ADD COLUMN chosen_link_id INT NULL",
            'chosen_at'         => "ALTER TABLE orders ADD COLUMN chosen_at DATETIME NULL",
            'chosen_by'         => "ALTER TABLE orders ADD COLUMN chosen_by VARCHAR(20) NULL",
            'chosen_inspection' => "ALTER TABLE orders ADD COLUMN chosen_inspection TINYINT(1) NULL",
            'chosen_note'       => "ALTER TABLE orders ADD COLUMN chosen_note TEXT NULL",
            'import_steps'      => "ALTER TABLE orders ADD COLUMN import_steps TEXT NULL",
            'inspection_result' => "ALTER TABLE orders ADD COLUMN inspection_result VARCHAR(10) NULL",
            'inspection_result_at' => "ALTER TABLE orders ADD COLUMN inspection_result_at DATETIME NULL",
            'inspection_note'   => "ALTER TABLE orders ADD COLUMN inspection_note TEXT NULL",
            'refund_requested_at' => "ALTER TABLE orders ADD COLUMN refund_requested_at DATETIME NULL",
            'inspection_decided_by' => "ALTER TABLE orders ADD COLUMN inspection_decided_by VARCHAR(10) NULL",
            'inspection_client_ok_at' => "ALTER TABLE orders ADD COLUMN inspection_client_ok_at DATETIME NULL",
            'inspection_report_file_id' => "ALTER TABLE orders ADD COLUMN inspection_report_file_id INT NULL",
            'inspection_report_at' => "ALTER TABLE orders ADD COLUMN inspection_report_at DATETIME NULL",
            'inspection_summary' => "ALTER TABLE orders ADD COLUMN inspection_summary TEXT NULL",
            'inspection_es' => "ALTER TABLE orders ADD COLUMN inspection_es MEDIUMTEXT NULL",
            'inspection_es_status' => "ALTER TABLE orders ADD COLUMN inspection_es_status VARCHAR(12) NULL",
            'inspection_es_at' => "ALTER TABLE orders ADD COLUMN inspection_es_at DATETIME NULL",
            'inspection_es_error' => "ALTER TABLE orders ADD COLUMN inspection_es_error VARCHAR(255) NULL",
            'declined_link_ids' => "ALTER TABLE orders ADD COLUMN declined_link_ids TEXT NULL",
        ];
        foreach ($faltan as $col => $sql) {
            if (!in_array($col, $cols, true)) $pdo->exec($sql);
        }
        $hecho = true;
    } catch (PDOException $e) {
        error_log('impAsegurarColumnas: ' . $e->getMessage());
    }
}

// ---------------------------------------------------------------------------
// Pago N° 1 al elegir (JP, 21-oct-2026)
// ---------------------------------------------------------------------------
// «Tenemos 3 pagos definidos para la operación, entonces en ese punto se debe
// solicitar el pago N° 1 acorde al 7% de la operación.» La inspección no se
// cobra aparte: va dentro de la operación. Al elegir la lancha (el cliente o
// el equipo por él) se crea el cobro del Pago 1 con el % y el monto de la
// cotización publicada. Sin cotización publicada no hay monto: el Pago 1 lo
// crea el equipo cuando la publique (botón «Crear cobro» del admin).
//
// Los cobros viven en api/payment_requests.json (payment_requests_api.php);
// aquí se leen y escriben con el archivo bloqueado, igual que allá.

/** El Pago 1 según la cotización publicada de la lancha: ['pct','clp','usd'] o null. */
function impPlanPago1($link) {
    if (empty($link['quote_published_at']) || floatval($link['quote_total_clp'] ?? 0) <= 0) return null;
    $pay = $link['quote_payments'] ?? null;
    if (is_string($pay)) $pay = json_decode($pay, true);
    if (!is_array($pay) || floatval($pay['p1_clp'] ?? 0) <= 0) return null;
    $pct = floatval($pay['p1_pct'] ?? 0);
    $usd = floatval($link['quote_total_usd'] ?? 0) > 0 && $pct > 0 ? round(floatval($link['quote_total_usd']) * $pct / 100, 2) : null;
    return ['pct' => $pct, 'clp' => intval(round(floatval($pay['p1_clp']))), 'usd' => $usd];
}

function impArchivoCobros() {
    return __DIR__ . '/payment_requests.json';
}

/**
 * Lee y (si $fn devuelve ['guardar' => true]) escribe payment_requests.json
 * con el archivo bloqueado. $fn recibe &$data y devuelve lo que se retorna.
 */
function impConCobros(callable $fn) {
    $fp = @fopen(impArchivoCobros(), 'c+');
    if (!$fp) return null;
    try {
        if (!flock($fp, LOCK_EX)) return null;
        $data = json_decode(stream_get_contents($fp), true);
        if (!is_array($data) || !isset($data['requests']) || !is_array($data['requests'])) $data = ['requests' => []];
        $res = $fn($data);
        if (is_array($res) && !empty($res['guardar'])) {
            fseek($fp, 0);
            ftruncate($fp, 0);
            fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
            fflush($fp);
        }
        flock($fp, LOCK_UN);
        return $res;
    } finally {
        fclose($fp);
    }
}

function impCobroDelExpediente($r, $orderId, $orderNumber = '') {
    $meta = $r['metadata'] ?? [];
    $ref = strtoupper(trim((string) ($meta['order_id'] ?? $meta['order_number'] ?? '')));
    return $ref !== '' && ($ref === (string) $orderId || ($orderNumber !== '' && $ref === strtoupper(trim($orderNumber))));
}

function impEsPago1DelExpediente($r, $orderId, $orderNumber = '') {
    $meta = $r['metadata'] ?? [];
    if (!impCobroDelExpediente($r, $orderId, $orderNumber)) return false;
    if (intval($meta['custom_fields']['pago'] ?? 0) === 1) return true;
    return (bool) preg_match('/pago\s*1\b/i', (string) ($r['title'] ?? ''));
}

/** El Pago 1 vigente (pendiente o pagado) del expediente, o null. */
function impPago1($orderId, $orderNumber = '') {
    $res = impConCobros(function (&$data) use ($orderId, $orderNumber) {
        $pendiente = null;
        foreach ($data['requests'] as $r) {
            if (!impEsPago1DelExpediente($r, $orderId, $orderNumber) || ($r['status'] ?? '') === 'cancelled') continue;
            if (($r['status'] ?? '') === 'paid') return ['cobro' => $r];
            if (!$pendiente) $pendiente = $r;
        }
        return ['cobro' => $pendiente];
    });
    return $res['cobro'] ?? null;
}

function impPago1Pagado($orderId, $orderNumber = '') {
    $c = impPago1($orderId, $orderNumber);
    return $c && ($c['status'] ?? '') === 'paid';
}

/**
 * Pide el Pago 1 de esta lancha. Si ya hay uno vigente de la misma lancha, lo
 * devuelve; si hay uno PENDIENTE de otra lancha (el cliente cambió), lo anula
 * y crea el nuevo; si el de otra lancha ya está pagado, no crea nada (lo
 * resuelve el equipo). Devuelve ['cobro' => …, 'creado' => bool] o null si
 * la lancha no tiene cotización publicada.
 */
function impSolicitarPago1($order, $link, $creadoPor) {
    $plan = impPlanPago1($link);
    if (!$plan) return null;
    $orderId = intval($order['id']);
    $linkId = intval($link['id']);
    $titulo = impTituloLancha($link);
    $pctTxt = rtrim(rtrim(number_format($plan['pct'], 2, '.', ''), '0'), '.');

    return impConCobros(function (&$data) use ($order, $orderId, $linkId, $titulo, $plan, $pctTxt, $creadoPor) {
        foreach ($data['requests'] as $r) {
            if (impEsPago1DelExpediente($r, $orderId, $order['order_number'] ?? '') && ($r['status'] ?? '') === 'paid') return ['cobro' => $r, 'creado' => false];
        }
        foreach ($data['requests'] as &$r) {
            if (!impEsPago1DelExpediente($r, $orderId, $order['order_number'] ?? '') || ($r['status'] ?? '') === 'cancelled') continue;
            $deEsta = empty($r['metadata']['custom_fields']['link_id']) || intval($r['metadata']['custom_fields']['link_id']) === $linkId;
            if ($deEsta || ($r['status'] ?? '') === 'paid') return ['cobro' => $r, 'creado' => false];
            // Pendiente, de la lancha anterior: se anula.
            $r['status'] = 'cancelled';
            $r['cancelled_reason'] = 'Cambió de lancha';
        }
        unset($r);
        $nuevo = [
            'id' => 'pr_' . uniqid(),
            'user_email' => strtolower(trim((string) ($order['customer_email'] ?? ''))),
            'title' => 'Pago 1 · ' . $titulo . ' (' . $pctTxt . '%)',
            'description' => 'Pago 1 de 3 (' . $pctTxt . '%) de la operación de ' . $titulo . ', expediente ' . ($order['order_number'] ?? '') . '. Con este pago iniciamos la operación.',
            'amount_clp' => $plan['clp'],
            'amount_usd' => $plan['usd'],
            'status' => 'pending',
            'created_by' => $creadoPor,
            'created_at' => date('Y-m-d H:i:s'),
            'paid_at' => null,
            'payment_id' => null,
            'payment_method' => null,
            'purchase_id' => null,
            'cancelled_reason' => null,
            'metadata' => [
                'order_id' => $orderId,
                'boat_name' => $titulo,
                'custom_fields' => ['pago' => 1, 'link_id' => $linkId, 'auto' => 'eleccion'],
            ],
        ];
        $data['requests'][] = $nuevo;
        return ['cobro' => $nuevo, 'creado' => true, 'guardar' => true];
    });
}

/** Anula el Pago 1 pendiente del expediente (cuando se deshace la elección). */
function impAnularPago1Pendiente($orderId, $motivo, $orderNumber = '') {
    return impConCobros(function (&$data) use ($orderId, $motivo, $orderNumber) {
        $n = 0;
        foreach ($data['requests'] as &$r) {
            if (impEsPago1DelExpediente($r, $orderId, $orderNumber) && ($r['status'] ?? '') === 'pending') {
                $r['status'] = 'cancelled';
                $r['cancelled_reason'] = $motivo;
                $n++;
            }
        }
        unset($r);
        return ['anulados' => $n, 'guardar' => $n > 0];
    });
}

// ---------------------------------------------------------------------------
// Datos del cliente, cédula y Términos (JP, 21-oct-2026)
// ---------------------------------------------------------------------------
// «En el momento que el cliente acepta, es necesario pedirle completar un
// pequeño formulario con sus datos y adjuntar su cédula de identidad por ambas
// partes para poder procesar la importación de manera correcta. Y aprovechar
// de aceptar los términos y condiciones.»
//
// Una fila por expediente en order_client_data. La cédula se guarda en
// expediente_files con uploaded_by = 'cliente_identidad' y
// visible_to_client = 0: no se mezcla con las fotos de la lancha, el agente
// (operación en EE. UU.) no la ve, y sólo el equipo la descarga.

/** Versión vigente de los Términos (la fecha de «Última actualización» de la página). */
define('IMP_TERMINOS_VERSION', '2026-10-21');
define('IMP_TERMINOS_URL', 'https://www.imporlan.cl/terminos-y-condiciones/');

/** Campos del formulario: clave => [etiqueta, máximo de caracteres]. Todos obligatorios. */
function impCamposDatos() {
    return [
        'nombre' => ['Nombre completo', 120],
        'rut' => ['RUT', 12],
        'fecha_nacimiento' => ['Fecha de nacimiento', 10],
        'nacionalidad' => ['Nacionalidad', 60],
        'estado_civil' => ['Estado civil', 30],
        'profesion' => ['Profesión u oficio', 80],
        'telefono' => ['Teléfono', 30],
        'direccion' => ['Dirección', 160],
        'comuna' => ['Comuna', 60],
        'region' => ['Región', 60],
    ];
}

function impEstadosCiviles() {
    return ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Conviviente civil', 'Separado/a'];
}

/** RUT chileno válido (módulo 11). Acepta puntos, guion y K. */
function impRutValido($rut) {
    $r = strtoupper(preg_replace('/[^0-9kK]/', '', (string) $rut));
    if (strlen($r) < 2) return false;
    $dv = substr($r, -1);
    $num = substr($r, 0, -1);
    if (!ctype_digit($num) || intval($num) < 1000000) return false;
    $s = 0; $m = 2;
    for ($i = strlen($num) - 1; $i >= 0; $i--) { $s += intval($num[$i]) * $m; $m = $m === 7 ? 2 : $m + 1; }
    $esp = 11 - ($s % 11);
    $esp = $esp === 11 ? '0' : ($esp === 10 ? 'K' : (string) $esp);
    return $esp === $dv;
}

/** 12.345.678-9 */
function impRutFormato($rut) {
    $r = strtoupper(preg_replace('/[^0-9kK]/', '', (string) $rut));
    if (strlen($r) < 2) return $r;
    return number_format(intval(substr($r, 0, -1)), 0, ',', '.') . '-' . substr($r, -1);
}

/**
 * Limpia y valida los datos. Devuelve [datos limpios, errores por campo].
 */
function impValidarDatos($entrada) {
    $entrada = is_array($entrada) ? $entrada : [];
    $datos = [];
    $errores = [];
    foreach (impCamposDatos() as $k => [$etiqueta, $max]) {
        $v = trim(preg_replace('/\s+/u', ' ', (string) ($entrada[$k] ?? '')));
        $v = mb_substr($v, 0, $max);
        if ($v === '') { $errores[$k] = "Falta: $etiqueta"; continue; }
        $datos[$k] = $v;
    }
    if (isset($datos['rut'])) {
        if (!impRutValido($datos['rut'])) $errores['rut'] = 'El RUT no es válido';
        else $datos['rut'] = impRutFormato($datos['rut']);
    }
    if (isset($datos['fecha_nacimiento'])) {
        $f = DateTime::createFromFormat('Y-m-d', $datos['fecha_nacimiento']);
        $ok = $f && $f->format('Y-m-d') === $datos['fecha_nacimiento'];
        $edad = $ok ? (new DateTime())->diff($f)->y : 0;
        if (!$ok || $edad < 18 || $edad > 110) $errores['fecha_nacimiento'] = 'Revisa la fecha de nacimiento (debes ser mayor de edad)';
    }
    if (isset($datos['estado_civil']) && !in_array($datos['estado_civil'], impEstadosCiviles(), true)) $errores['estado_civil'] = 'Elige tu estado civil';
    if (isset($datos['telefono']) && strlen(preg_replace('/\D/', '', $datos['telefono'])) < 8) $errores['telefono'] = 'Revisa el teléfono';

    // A nombre de quién se importa (JP: «si el cliente nos dice a nombre de
    // quién; si no nos indica, por default a su nombre y con los datos del
    // formulario»). Opcional: titular_tipo = 'otro' + nombre o razón social + RUT.
    if (($entrada['titular_tipo'] ?? '') === 'otro') {
        $nombre = mb_substr(trim(preg_replace('/\s+/u', ' ', (string) ($entrada['titular_nombre'] ?? ''))), 0, 160);
        $rut = trim((string) ($entrada['titular_rut'] ?? ''));
        if ($nombre === '') $errores['titular_nombre'] = 'Falta el nombre o la razón social';
        if ($rut === '') $errores['titular_rut'] = 'Falta el RUT';
        elseif (!impRutValido($rut)) $errores['titular_rut'] = 'El RUT no es válido';
        if ($nombre !== '' && $rut !== '' && impRutValido($rut)) {
            $datos['titular_tipo'] = 'otro';
            $datos['titular_nombre'] = $nombre;
            $datos['titular_rut'] = impRutFormato($rut);
        }
    }
    return [$datos, $errores];
}

function impAsegurarDatosCliente($pdo) {
    static $hecho = false;
    if ($hecho) return;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS order_client_data (
            order_id INT PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            data TEXT,
            ci_front_id INT NULL,
            ci_back_id INT NULL,
            terms_version VARCHAR(20) NULL,
            terms_accepted_at DATETIME NULL,
            terms_ip VARCHAR(64) NULL,
            terms_ua VARCHAR(255) NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_ocd_email (user_email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $fcols = $pdo->query("SHOW COLUMNS FROM expediente_files")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('visible_to_client', $fcols, true)) {
            $pdo->exec("ALTER TABLE expediente_files ADD COLUMN visible_to_client TINYINT(1) NOT NULL DEFAULT 1");
        }
        $hecho = true;
    } catch (PDOException $e) {
        error_log('impAsegurarDatosCliente: ' . $e->getMessage());
    }
}

function impFilaDatos($pdo, $orderId) {
    try {
        $st = $pdo->prepare("SELECT * FROM order_client_data WHERE order_id = ?");
        $st->execute([intval($orderId)]);
        return $st->fetch(PDO::FETCH_ASSOC) ?: null;
    } catch (PDOException $e) {
        return null; // la tabla aún no existe
    }
}

/** La última fila de datos de ese correo en OTRO expediente (para no pedir dos veces lo mismo). */
function impFilaDatosAnterior($pdo, $email, $orderId) {
    try {
        $st = $pdo->prepare("SELECT * FROM order_client_data WHERE LOWER(user_email) = LOWER(?) AND order_id <> ? ORDER BY updated_at DESC LIMIT 1");
        $st->execute([$email, intval($orderId)]);
        return $st->fetch(PDO::FETCH_ASSOC) ?: null;
    } catch (PDOException $e) {
        return null;
    }
}

/**
 * ¿Están los datos, las dos caras de la cédula y los Términos aceptados?
 * Al elegir se exige la versión vigente; una importación ya en curso sigue
 * con la versión que aceptó (cláusula 13: un cambio no altera una operación
 * iniciada), así que para mostrar pendientes basta con cualquier versión.
 */
function impDatosCompletos($fila, $exigirVigente = true) {
    if (!$fila) return false;
    [, $err] = impValidarDatos(json_decode((string) $fila['data'], true));
    return !$err && intval($fila['ci_front_id']) > 0 && intval($fila['ci_back_id']) > 0
        && !empty($fila['terms_accepted_at']) && (!$exigirVigente || ($fila['terms_version'] ?? '') === IMP_TERMINOS_VERSION);
}

function impArchivoInfo($pdo, $id) {
    if (!intval($id)) return null;
    try {
        $st = $pdo->prepare("SELECT id, original_name, mime_type, file_size, created_at FROM expediente_files WHERE id = ?");
        $st->execute([intval($id)]);
        return $st->fetch(PDO::FETCH_ASSOC) ?: null;
    } catch (PDOException $e) {
        return null;
    }
}

/**
 * Enlace de descarga firmado de un archivo del expediente: la misma firma que
 * fileLinkSignature() de expediente_files_api.php. Para la cédula, una hora.
 */
function impEnlaceArchivo($id, $ttl = 3600) {
    $exp = time() + $ttl;
    $sig = hash_hmac('sha256', 'expediente_file:' . intval($id) . ':' . $exp, getJwtSecret() ?: 'imporlan');
    return '/api/expediente_files_api.php?action=download&id=' . intval($id) . '&exp=' . $exp . '&sig=' . $sig;
}

/**
 * Lo que el panel (y el admin) necesita del formulario. $fila de este
 * expediente; $anterior de otro. Con $enlaces (sólo el equipo) trae los
 * enlaces para ver la cédula, el IP y el navegador de la aceptación.
 */
function impDatosPublicos($pdo, $fila, $anterior = null, $enlaces = false) {
    $base = $fila ?: $anterior;
    return [
        'completo' => impDatosCompletos($fila),
        'datos' => $base ? (json_decode((string) $base['data'], true) ?: (object) []) : (object) [],
        'de_otro_expediente' => !$fila && $anterior ? true : false,
        'ci_frente' => $base ? impArchivoInfo($pdo, $base['ci_front_id']) : null,
        'ci_reverso' => $base ? impArchivoInfo($pdo, $base['ci_back_id']) : null,
        'terminos' => [
            'version' => IMP_TERMINOS_VERSION,
            'url' => IMP_TERMINOS_URL,
            'aceptados_version' => $fila['terms_version'] ?? null,
            'aceptados_at' => $fila['terms_accepted_at'] ?? null,
        ],
        'campos' => array_map(function ($c) { return $c[0]; }, impCamposDatos()),
        'estados_civiles' => impEstadosCiviles(),
    ] + ($enlaces && $base ? [
        'ci_frente_url' => intval($base['ci_front_id']) ? impEnlaceArchivo($base['ci_front_id']) : null,
        'ci_reverso_url' => intval($base['ci_back_id']) ? impEnlaceArchivo($base['ci_back_id']) : null,
        'terminos_ip' => $fila['terms_ip'] ?? null,
        'terminos_navegador' => $fila['terms_ua'] ?? null,
    ] : []);
}

/**
 * Revisa una cara de la cédula sin guardarla. $f = ['name','tmp_name','size','error'].
 * Devuelve [mime, error]; [null, null] si no vino archivo.
 */
function impRevisarCedula($f, $cara) {
    if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return [null, null];
    if (($f['error'] ?? 1) !== UPLOAD_ERR_OK) return [null, "No pudimos recibir la foto del $cara de tu cédula. Intenta con una foto más liviana."];
    if (intval($f['size'] ?? 0) > 10 * 1024 * 1024) return [null, "La foto del $cara de tu cédula pesa más de 10 MB."];
    $fi = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($fi, $f['tmp_name']);
    finfo_close($fi);
    if (!isset(impMimesCedula()[$mime])) return [null, "El $cara de tu cédula debe ser una foto (JPG, PNG) o un PDF."];
    return [$mime, null];
}

function impMimesCedula() {
    return ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/heic' => 'heic', 'image/heif' => 'heif', 'application/pdf' => 'pdf'];
}

/** Guarda una cara ya revisada. Devuelve [id, error]. */
function impGuardarCedula($pdo, $orderId, $f, $mime, $cara, $mover = 'move_uploaded_file') {
    $ext = impMimesCedula()[$mime];
    $dir = __DIR__ . '/expediente_files/';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    if (!file_exists($dir . '.htaccess')) {
        @file_put_contents($dir . '.htaccess', "Require all denied\nOptions -Indexes\n<IfModule mod_php.c>\nphp_flag engine off\n</IfModule>\nRemoveHandler .php .phtml .php5 .php7 .phar\nRemoveType .php .phtml .php5 .php7 .phar\n");
    }
    $guardado = 'exp_' . intval($orderId) . '_ci_' . bin2hex(random_bytes(8)) . '.' . $ext;
    if (!$mover($f['tmp_name'], $dir . $guardado)) return [0, "No pudimos guardar el $cara de tu cédula. Intenta de nuevo."];
    $pdo->prepare("INSERT INTO expediente_files (order_id, original_name, stored_name, mime_type, file_size, category, description, uploaded_by, visible_to_client) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)")
        ->execute([intval($orderId), 'cedula-' . $cara . '.' . $ext, $guardado, $mime, intval($f['size'] ?? 0), $mime === 'application/pdf' ? 'document' : 'image', 'Cédula de identidad (' . $cara . ')', 'cliente_identidad']);
    return [intval($pdo->lastInsertId()), null];
}

/**
 * Guarda el formulario. $entrada: los campos + 'acepta_terminos' +
 * 'reusar_cedula' (usar la cédula ya enviada en otro expediente).
 * $archivos: ['frente' => f, 'reverso' => f]. Devuelve [ok, errores].
 */
function impGuardarDatosCliente($pdo, $order, $email, $entrada, $archivos, $ip, $ua, $mover = 'move_uploaded_file') {
    impAsegurarDatosCliente($pdo);
    $orderId = intval($order['id']);
    [$datos, $errores] = impValidarDatos($entrada);
    if (empty($entrada['acepta_terminos']) || ($entrada['terminos_version'] ?? IMP_TERMINOS_VERSION) !== IMP_TERMINOS_VERSION) {
        $errores['terminos'] = 'Debes aceptar los Términos y Condiciones';
    }
    $actual = impFilaDatos($pdo, $orderId);
    $anterior = !empty($entrada['reusar_cedula']) ? impFilaDatosAnterior($pdo, $email, $orderId) : null;
    $frenteId = intval($actual['ci_front_id'] ?? 0) ?: intval($anterior['ci_front_id'] ?? 0);
    $reversoId = intval($actual['ci_back_id'] ?? 0) ?: intval($anterior['ci_back_id'] ?? 0);
    if ($errores) return [false, $errores];

    // Primero se revisan las dos caras; sólo si todo está bien se guarda algo
    // (así un intento fallido no deja una cédula a medias en el expediente).
    $mimes = [];
    foreach (['frente', 'reverso'] as $cara) {
        [$mime, $err] = impRevisarCedula($archivos[$cara] ?? null, $cara);
        if ($err) $errores['ci_' . $cara] = $err;
        elseif ($mime) $mimes[$cara] = $mime;
    }
    if (!$frenteId && !isset($mimes['frente']) && !isset($errores['ci_frente'])) $errores['ci_frente'] = 'Falta la foto del frente de tu cédula';
    if (!$reversoId && !isset($mimes['reverso']) && !isset($errores['ci_reverso'])) $errores['ci_reverso'] = 'Falta la foto del reverso de tu cédula';
    if ($errores) return [false, $errores];
    foreach ($mimes as $cara => $mime) {
        [$id, $err] = impGuardarCedula($pdo, $orderId, $archivos[$cara], $mime, $cara, $mover);
        if ($err) return [false, ['ci_' . $cara => $err]];
        if ($cara === 'frente') $frenteId = $id; else $reversoId = $id;
    }

    $valores = [json_encode($datos, JSON_UNESCAPED_UNICODE), $frenteId, $reversoId, IMP_TERMINOS_VERSION, date('Y-m-d H:i:s'), mb_substr((string) $ip, 0, 64), mb_substr((string) $ua, 0, 255)];
    if ($actual) {
        $pdo->prepare("UPDATE order_client_data SET data = ?, ci_front_id = ?, ci_back_id = ?, terms_version = ?, terms_accepted_at = ?, terms_ip = ?, terms_ua = ?, user_email = ? WHERE order_id = ?")
            ->execute(array_merge($valores, [strtolower($email), $orderId]));
    } else {
        $pdo->prepare("INSERT INTO order_client_data (data, ci_front_id, ci_back_id, terms_version, terms_accepted_at, terms_ip, terms_ua, user_email, order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute(array_merge($valores, [strtolower($email), $orderId]));
    }
    return [true, []];
}

// ---------------------------------------------------------------------------
// Pagos 2 y 3 por hito (JP, 21-oct-2026)
// ---------------------------------------------------------------------------
// «El pago 2 lo gatilla la carga de la inspección con resultado positivo, y
// el pago 3 la carga de la foto en sistema de la embarcación entregada en el
// puerto de USA con destino a Chile.» Si el cliente compra sin inspección,
// el Pago 2 sale al confirmar el vendedor la disponibilidad y el precio.

/** Qué pago del plan dispara un hito (0 = ninguno). */
function impPagoPorHito($order, $hito) {
    if ($hito === 'inspeccion') return 2;
    if ($hito === 'disponibilidad' && empty($order['chosen_inspection'])) return 2;
    if ($hito === 'transporte') return 3;
    return 0;
}

/** El pago N según la cotización publicada de la lancha: ['pct','clp','usd'] o null. */
function impPlanPago($link, $n) {
    if (empty($link['quote_published_at']) || floatval($link['quote_total_clp'] ?? 0) <= 0) return null;
    $pay = $link['quote_payments'] ?? null;
    if (is_string($pay)) $pay = json_decode($pay, true);
    if (!is_array($pay) || floatval($pay["p{$n}_clp"] ?? 0) <= 0) return null;
    $pct = floatval($pay["p{$n}_pct"] ?? 0);
    $usd = floatval($link['quote_total_usd'] ?? 0) > 0 && $pct > 0 ? round(floatval($link['quote_total_usd']) * $pct / 100, 2) : null;
    return ['pct' => $pct, 'clp' => intval(round(floatval($pay["p{$n}_clp"]))), 'usd' => $usd];
}

function impEsPagoDelExpediente($r, $orderId, $n, $orderNumber = '') {
    $meta = $r['metadata'] ?? [];
    if (!impCobroDelExpediente($r, $orderId, $orderNumber)) return false;
    if (intval($meta['custom_fields']['pago'] ?? 0) === intval($n)) return true;
    return (bool) preg_match('/pago\s*' . intval($n) . '\b/i', (string) ($r['title'] ?? ''));
}

/**
 * Pide el pago N (2 o 3) de la lancha elegida. Si ya hay uno vigente (creado
 * a mano o antes), no crea otro. Devuelve ['cobro', 'creado'] o null si la
 * lancha no tiene cotización publicada con ese pago.
 */
function impSolicitarPago($order, $link, $n, $creadoPor) {
    $plan = impPlanPago($link, $n);
    if (!$plan) return null;
    $orderId = intval($order['id']);
    $titulo = impTituloLancha($link);
    $pctTxt = rtrim(rtrim(number_format($plan['pct'], 2, '.', ''), '0'), '.');
    return impConCobros(function (&$data) use ($order, $orderId, $link, $n, $titulo, $plan, $pctTxt, $creadoPor) {
        foreach ($data['requests'] as $r) {
            if (impEsPagoDelExpediente($r, $orderId, $n, $order['order_number'] ?? '') && ($r['status'] ?? '') === 'paid') return ['cobro' => $r, 'creado' => false];
        }
        foreach ($data['requests'] as $r) {
            if (impEsPagoDelExpediente($r, $orderId, $n, $order['order_number'] ?? '') && ($r['status'] ?? '') !== 'cancelled') return ['cobro' => $r, 'creado' => false];
        }
        $nuevo = [
            'id' => 'pr_' . uniqid(),
            'user_email' => strtolower(trim((string) ($order['customer_email'] ?? ''))),
            'title' => 'Pago ' . $n . ' · ' . $titulo . ' (' . $pctTxt . '%)',
            'description' => 'Pago ' . $n . ' de 3 (' . $pctTxt . '%) de la operación de ' . $titulo . ', expediente ' . ($order['order_number'] ?? '') . '.',
            'amount_clp' => $plan['clp'],
            'amount_usd' => $plan['usd'],
            'status' => 'pending',
            'created_by' => $creadoPor,
            'created_at' => date('Y-m-d H:i:s'),
            'paid_at' => null,
            'payment_id' => null,
            'payment_method' => null,
            'purchase_id' => null,
            'cancelled_reason' => null,
            'metadata' => [
                'order_id' => $orderId,
                'boat_name' => $titulo,
                'custom_fields' => ['pago' => $n, 'link_id' => intval($link['id']), 'auto' => 'hito'],
            ],
        ];
        $data['requests'][] = $nuevo;
        return ['cobro' => $nuevo, 'creado' => true, 'guardar' => true];
    });
}

// ---------------------------------------------------------------------------
// Reporte de inspección: lo carga el equipo, el cliente lo lee y decide
// (JP, 21-oct-2026)
// ---------------------------------------------------------------------------
// «Nosotros cumplimos con cargarlo pero el cliente es el que toma la decisión
// si aprueba o declina la compra. La inspección siempre vendrá en inglés:
// ¿puede él verlo en español o descargarlo en español?»
//
// El equipo sube el PDF del inspector (o elige uno que ya está en el
// expediente, como el que manda David). Queda visible para el cliente tal
// cual, y una IA lo traduce al español completo: el panel lo muestra y lo
// deja descargar. Después el cliente aprueba (hito «inspeccion» → Pago 2) o
// declina (elige otra lancha con el Pago 1 abonado, o pide la devolución).

/** El PDF más pesado que se manda a traducir (el pedido a la API tope 32 MB, en base64). */
define('IMP_TRADUCCION_MAX_BYTES', 22 * 1024 * 1024);
define('IMP_TRADUCCION_MODELO', 'claude-opus-5-5');

function impMimesReporte() {
    return ['application/pdf' => 'pdf'];
}

/** Guarda el PDF del reporte, visible para el cliente. Devuelve [file_id, error]. */
function impGuardarReporte($pdo, $orderId, $f, $mover = 'move_uploaded_file') {
    if (!is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || empty($f['tmp_name'])) {
        return [0, 'No llegó el archivo. Sube el PDF del reporte.'];
    }
    if (intval($f['size'] ?? 0) > 60 * 1024 * 1024) return [0, 'El PDF pesa más de 60 MB.'];
    $mime = function_exists('finfo_open') ? (finfo_file(finfo_open(FILEINFO_MIME_TYPE), $f['tmp_name']) ?: '') : '';
    if (!isset(impMimesReporte()[$mime])) return [0, 'El reporte tiene que ser un PDF.'];
    $dir = __DIR__ . '/expediente_files/';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    if (!file_exists($dir . '.htaccess')) {
        @file_put_contents($dir . '.htaccess', "Require all denied\nOptions -Indexes\n<IfModule mod_php.c>\nphp_flag engine off\n</IfModule>\nRemoveHandler .php .phtml .php5 .php7 .phar\nRemoveType .php .phtml .php5 .php7 .phar\n");
    }
    $guardado = 'exp_' . intval($orderId) . '_inspeccion_' . bin2hex(random_bytes(8)) . '.pdf';
    if (!$mover($f['tmp_name'], $dir . $guardado)) return [0, 'No se pudo guardar el PDF. Intenta de nuevo.'];
    $nombre = trim((string) ($f['name'] ?? '')) ?: 'reporte-inspeccion.pdf';
    $pdo->prepare("INSERT INTO expediente_files (order_id, original_name, stored_name, mime_type, file_size, category, description, uploaded_by, visible_to_client) VALUES (?, ?, ?, ?, ?, 'document', ?, 'inspeccion_reporte', 1)")
        ->execute([intval($orderId), mb_substr($nombre, 0, 200), $guardado, $mime, intval($f['size'] ?? 0), 'Reporte de la inspección técnica (original en inglés)']);
    return [intval($pdo->lastInsertId()), null];
}

/** Un PDF que ya está en el expediente pasa a ser el reporte (y el cliente lo ve). */
function impUsarArchivoComoReporte($pdo, $orderId, $fileId) {
    $st = $pdo->prepare("SELECT id, mime_type FROM expediente_files WHERE id = ? AND order_id = ?");
    $st->execute([intval($fileId), intval($orderId)]);
    $f = $st->fetch(PDO::FETCH_ASSOC);
    if (!$f) return [0, 'Ese archivo no está en este expediente.'];
    if (!isset(impMimesReporte()[$f['mime_type']])) return [0, 'El reporte tiene que ser un PDF.'];
    $pdo->prepare("UPDATE expediente_files SET visible_to_client = 1 WHERE id = ?")->execute([intval($f['id'])]);
    return [intval($f['id']), null];
}

function impRutaArchivo($pdo, $fileId) {
    $st = $pdo->prepare("SELECT stored_name FROM expediente_files WHERE id = ?");
    $st->execute([intval($fileId)]);
    $n = $st->fetchColumn();
    return $n ? __DIR__ . '/expediente_files/' . basename($n) : null;
}

/** La llave de Claude: la misma de la puerta de WhatsApp (credentials_config.php). */
function impLlaveClaude() {
    $cred = '/home/wwimpo/credentials_config.php';
    if (is_file($cred)) require_once $cred;
    foreach (['IMPORLAN_ANTHROPIC', 'IMPORLAN_WA_ANTHROPIC'] as $n) {
        if (defined($n) && trim((string) constant($n)) !== '') return trim((string) constant($n));
        $v = getenv($n);
        if ($v !== false && trim($v) !== '') return trim($v);
    }
    return '';
}

function impInstruccionesTraduccion() {
    return "Eres traductor técnico náutico. Te paso el reporte de una inspección técnica (marine survey) de una embarcación en Estados Unidos, en inglés. "
        . "Tradúcelo al español de Chile para el comprador, que no lee inglés.\n\n"
        . "Reglas:\n"
        . "- Completo y fiel: todo el contenido, en el mismo orden. No resumas, no omitas hallazgos ni advertencias, no agregues opiniones, conclusiones ni recomendaciones que no estén en el original.\n"
        . "- Respeta cifras, unidades, valores, fechas, nombres propios, marcas, modelos y números de serie tal como están. Si el original da un valor de mercado o de reposición, tradúcelo igual, con su moneda.\n"
        . "- Usa los términos náuticos habituales en español (survey → inspección, surveyor → inspector, hull → casco, transom → espejo de popa, bilge → sentina, stringers → largueros, moisture → humedad, delamination → delaminación, gelcoat → gelcoat, outdrive → pata o cola, trailer → carro).\n"
        . "- Formato Markdown simple: '# ' para el título, '## ' para secciones, '### ' para subsecciones, párrafos, listas con '- ', tablas con '|' y **negrita** para lo que el original destaca. Nada de HTML, imágenes ni enlaces.\n"
        . "- Fotos: si una foto tiene leyenda, escribe la leyenda traducida como '- Foto: …'. Sin leyenda, omítela.\n"
        . "- Si algo no se lee, escribe [ilegible]. Omite encabezados y pies de página que se repiten en cada hoja.\n"
        . "- Empieza directo con el contenido, sin presentarte ni comentar la traducción.";
}

/**
 * Traduce el PDF. Devuelve ['ok' => bool, 'texto' => markdown, 'error' => ''].
 * $http (para las pruebas): function($url, $headers, $body, $timeout) → ['code', 'body'].
 */
function impTraducirReporte($rutaPdf, $http = null) {
    if (!$rutaPdf || !is_file($rutaPdf)) return ['ok' => false, 'error' => 'No se encontró el PDF'];
    if (filesize($rutaPdf) > IMP_TRADUCCION_MAX_BYTES) return ['ok' => false, 'error' => 'El PDF es muy pesado para traducirlo automáticamente (más de 22 MB)'];
    $http = $http ?: ($GLOBALS['impClaudeHttp'] ?? null);
    $llave = impLlaveClaude();
    if ($llave === '' && !$http) return ['ok' => false, 'error' => 'Falta la llave de Claude en el servidor'];
    $http = $http ?: 'impPostClaude';
    $cuerpo = json_encode([
        'model' => IMP_TRADUCCION_MODELO,
        'max_tokens' => 64000,
        'stream' => true,
        'fallbacks' => 'default',
        'output_config' => ['effort' => 'low'],
        'system' => impInstruccionesTraduccion(),
        'messages' => [['role' => 'user', 'content' => [
            ['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => base64_encode(file_get_contents($rutaPdf))]],
            ['type' => 'text', 'text' => 'Traduce este reporte de inspección al español, completo.'],
        ]]],
    ]);
    $r = $http('https://api.anthropic.com/v1/messages', [
        'x-api-key' => $llave, 'anthropic-version' => '2023-06-01',
        'anthropic-beta' => 'server-side-fallback-2026-07-01', 'content-type' => 'application/json',
    ], $cuerpo, 600);
    if (($r['code'] ?? 0) !== 200) {
        $j = json_decode((string) ($r['body'] ?? ''), true);
        return ['ok' => false, 'error' => 'Claude HTTP ' . intval($r['code'] ?? 0) . (isset($j['error']['message']) ? ': ' . mb_substr($j['error']['message'], 0, 150) : '')];
    }
    [$texto, $fin, $err] = impLeerStreamClaude((string) $r['body']);
    if ($err !== '') return ['ok' => false, 'error' => $err];
    if ($fin === 'refusal') return ['ok' => false, 'error' => 'La IA no tradujo este documento'];
    $texto = trim($texto);
    if ($texto === '') return ['ok' => false, 'error' => 'La traducción salió vacía'];
    if ($fin === 'max_tokens') $texto .= "\n\n[La traducción llega hasta aquí por el largo del reporte. El resto está en el original en inglés.]";
    return ['ok' => true, 'texto' => $texto];
}

/** Lee la respuesta en stream (SSE): [texto, stop_reason, error]. Si hubo cambio de modelo, vale lo del último. */
function impLeerStreamClaude($sse) {
    $texto = '';
    $fin = '';
    foreach (preg_split('/\r?\n/', $sse) as $linea) {
        if (strncmp($linea, 'data:', 5) !== 0) continue;
        $e = json_decode(trim(substr($linea, 5)), true);
        if (!is_array($e)) continue;
        $tipo = $e['type'] ?? '';
        if ($tipo === 'error') return ['', '', 'Claude: ' . ($e['error']['message'] ?? 'error')];
        if ($tipo === 'content_block_start' && ($e['content_block']['type'] ?? '') === 'fallback') $texto = '';
        if ($tipo === 'content_block_delta' && ($e['delta']['type'] ?? '') === 'text_delta') $texto .= (string) $e['delta']['text'];
        if ($tipo === 'message_delta' && !empty($e['delta']['stop_reason'])) $fin = $e['delta']['stop_reason'];
    }
    return [$texto, $fin, ''];
}

function impPostClaude($url, $headers, $body, $timeout) {
    $h = '';
    foreach ($headers as $k => $v) $h .= $k . ': ' . $v . "\r\n";
    $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => $h, 'content' => $body, 'timeout' => $timeout, 'ignore_errors' => true]]);
    $resp = @file_get_contents($url, false, $ctx);
    $code = 0;
    foreach ((array) ($http_response_header ?? []) as $l) if (preg_match('#^HTTP/\S+\s+(\d{3})#', $l, $m)) $code = (int) $m[1];
    return ['code' => $code, 'body' => $resp === false ? '' : $resp];
}

/**
 * Traduce el reporte cargado y guarda el resultado. Se llama después de
 * contestarle al panel (la traducción tarda minutos). Si el reporte cambió
 * mientras tanto, no pisa nada.
 */
function impTraducirYGuardar($pdo, $orderId, $fileId) {
    @set_time_limit(900);
    $res = impTraducirReporte(impRutaArchivo($pdo, $fileId));
    $pdo->prepare("UPDATE orders SET inspection_es = ?, inspection_es_status = ?, inspection_es_at = NOW(), inspection_es_error = ? WHERE id = ? AND inspection_report_file_id = ?")
        ->execute([$res['ok'] ? $res['texto'] : null, $res['ok'] ? 'listo' : 'error', $res['ok'] ? null : mb_substr($res['error'], 0, 250), intval($orderId), intval($fileId)]);
    if (!$res['ok']) error_log('impTraducirYGuardar ' . $orderId . ': ' . $res['error']);
    return $res['ok'];
}

/**
 * El Markdown de la traducción en bloques para el panel, sin HTML:
 * {t:'h', n:1-3, x} · {t:'p', x} · {t:'ul', items:[x]} · {t:'table', rows:[[x]]}.
 * Los ** de negrita quedan en el texto; el panel los pinta.
 */
function impMarkdownABloques($md) {
    $bloques = [];
    $parrafo = [];
    $lista = null;
    $tabla = null;
    $cerrar = function () use (&$bloques, &$parrafo, &$lista, &$tabla) {
        if ($parrafo) { $bloques[] = ['t' => 'p', 'x' => implode(' ', $parrafo)]; $parrafo = []; }
        if ($lista !== null) { $bloques[] = ['t' => 'ul', 'items' => $lista]; $lista = null; }
        if ($tabla !== null) { if ($tabla) $bloques[] = ['t' => 'table', 'rows' => $tabla]; $tabla = null; }
    };
    foreach (preg_split('/\r?\n/', (string) $md) as $l) {
        $l = rtrim($l);
        $t = trim($l);
        if ($t === '') { $cerrar(); continue; }
        if (preg_match('/^(#{1,6})\s+(.*)$/', $t, $m)) {
            $cerrar();
            $bloques[] = ['t' => 'h', 'n' => min(3, strlen($m[1])), 'x' => trim($m[2], " #")];
            continue;
        }
        if ($t[0] === '|') {
            if ($tabla === null) { $cerrar(); $tabla = []; }
            $celdas = array_map('trim', explode('|', trim($t, '|')));
            if (preg_match('/^[\s:|-]+$/', $t)) continue; // la línea |---|---|
            $tabla[] = $celdas;
            continue;
        }
        if (preg_match('/^[-*•]\s+(.*)$/u', $t, $m) || preg_match('/^\d+[.)]\s+(.*)$/', $t, $m)) {
            if ($lista === null) { $cerrar(); $lista = []; }
            $lista[] = $m[1];
            continue;
        }
        if ($lista !== null && preg_match('/^\s{2,}/', $l)) { $lista[count($lista) - 1] .= ' ' . $t; continue; }
        if ($lista !== null || $tabla !== null) $cerrar();
        $parrafo[] = $t;
    }
    $cerrar();
    return $bloques;
}

/** Contesta al panel y cierra la conexión; el script sigue (traducción). */
function impContestarYSeguir($json) {
    ignore_user_abort(true);
    @set_time_limit(900);
    if (!headers_sent()) {
        header('Content-Length: ' . strlen($json));
        header('Connection: close');
    }
    while (ob_get_level() > 0) @ob_end_clean();
    echo $json;
    if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
    elseif (function_exists('litespeed_finish_request')) @litespeed_finish_request();
    else @flush();
}

/** Correo al cliente: el reporte está listo, revísalo y decide. */
function impAvisarReporteListo($pdo, $order) {
    try {
        require_once __DIR__ . '/email_service.php';
        $link = impLeerLink($pdo, $order['id'], $order['chosen_link_id']);
        $nombre = impNombreSaludo($order);
        (new EmailService())->sendInspeccionReporte($order['customer_email'], $nombre, [
            'titulo' => impTituloLancha($link),
            'order_number' => $order['order_number'] ?? '',
            'order_id' => $order['id'],
            'resumen' => (string) ($order['inspection_summary'] ?? ''),
            'en_espanol' => impEstadoTraduccion($order) === 'listo',
            'pago1_pagado' => impPago1Pagado($order['id'], $order['order_number'] ?? ''),
        ]);
    } catch (\Throwable $e) {
        error_log('impAvisarReporteListo: ' . $e->getMessage());
    }
}

/** El PDF $fileId pasa a ser el reporte de la inspección, con la traducción por hacer. */
function impRegistrarReporte($pdo, $orderId, $fileId, $resumen) {
    $pdo->prepare("UPDATE orders SET inspection_report_file_id = ?, inspection_report_at = NOW(), inspection_summary = ?, inspection_es = NULL, inspection_es_status = 'pendiente', inspection_es_at = NOW(), inspection_es_error = NULL WHERE id = ?")
        ->execute([intval($fileId), (string) $resumen, intval($orderId)]);
}

/** El primer nombre del cliente para el saludo, con mayúscula («alberto lathrop» → «Alberto»). */
function impNombreSaludo($order) {
    $n = trim((string) ($order['customer_name'] ?? ''));
    if ($n === '') return '';
    $primero = preg_split('/\s+/u', $n)[0];
    return mb_strtoupper(mb_substr($primero, 0, 1)) . mb_substr($primero, 1);
}
