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
