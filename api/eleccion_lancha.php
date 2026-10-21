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
        'aduana'         => ['label' => 'Aduana e internación en Chile', 'corto' => 'En aduana', 'etapa' => 5],
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
    return impPasos($order) === [];
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
    ];
}

/** Título legible de una lancha del ranking (igual que tituloEmbarcacion en el panel). */
function impTituloLancha($link) {
    $l = is_array($link) ? $link : [];
    $t = trim((string) ($l['title'] ?? ''));
    if ($t !== '') return $t;
    $armado = trim(implode(' ', array_filter([$l['make'] ?? '', $l['model'] ?? '', $l['year'] ?? ''])));
    return $armado !== '' ? $armado : 'la embarcación';
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

function impEsPago1DelExpediente($r, $orderId) {
    $meta = $r['metadata'] ?? [];
    if (strval($meta['order_id'] ?? '') !== strval($orderId)) return false;
    if (intval($meta['custom_fields']['pago'] ?? 0) === 1) return true;
    return (bool) preg_match('/pago\s*1\b/i', (string) ($r['title'] ?? ''));
}

/** El Pago 1 vigente (pendiente o pagado) del expediente, o null. */
function impPago1($orderId) {
    $res = impConCobros(function (&$data) use ($orderId) {
        foreach ($data['requests'] as $r) {
            if (impEsPago1DelExpediente($r, $orderId) && ($r['status'] ?? '') !== 'cancelled') return ['cobro' => $r];
        }
        return ['cobro' => null];
    });
    return $res['cobro'] ?? null;
}

function impPago1Pagado($orderId) {
    $c = impPago1($orderId);
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
        foreach ($data['requests'] as &$r) {
            if (!impEsPago1DelExpediente($r, $orderId) || ($r['status'] ?? '') === 'cancelled') continue;
            $deEsta = intval($r['metadata']['custom_fields']['link_id'] ?? 0) === $linkId;
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
function impAnularPago1Pendiente($orderId, $motivo) {
    return impConCobros(function (&$data) use ($orderId, $motivo) {
        $n = 0;
        foreach ($data['requests'] as &$r) {
            if (impEsPago1DelExpediente($r, $orderId) && ($r['status'] ?? '') === 'pending') {
                $r['status'] = 'cancelled';
                $r['cancelled_reason'] = $motivo;
                $n++;
            }
        }
        unset($r);
        return ['anulados' => $n, 'guardar' => $n > 0];
    });
}
