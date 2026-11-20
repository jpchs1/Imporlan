<?php
/**
 * Embarque rumbo a Chile: el barco que la trae (JP, 20-nov-2026).
 *
 * «En esta parte del proceso del envío a Chile debe ser obligatorio el paso de
 * poner el nombre del barco, ya sea el Admin o el de Logística, para que el
 * cliente lo pueda trackear.»
 *
 * Marcar el hito «embarque» exige el nombre del barco. Con él se busca (o se
 * crea) la nave en el seguimiento (tabla vessels) y se asocia al expediente
 * (orders.vessel_id): el cliente la ve en «Seguimiento» de su panel. La
 * posición en vivo (AIS) se consulta por IMO o MMSI: si se indica alguno, o si
 * el nombre ya está registrado con ellos, el mapa muestra dónde va el barco;
 * si no, el barco aparece con su ruta y el equipo completa el IMO después
 * desde «Seguimiento» del admin.
 *
 * Nada del cliente (nombre, correo, montos) se guarda en la nave: la ficha del
 * barco es pública dentro del seguimiento.
 */

/** Plazo de desaduanamiento que se le informa al cliente (JP, 20-nov-2026). */
function impNotaDesaduanamiento() {
    return 'El desaduanamiento en Chile demora, en promedio, entre 5 y 9 días aproximadamente.';
}

function impImoValido($imo) {
    if (!preg_match('/^\d{7}$/D', $imo)) return false;
    $sum = 0;
    foreach ([7, 6, 5, 4, 3, 2] as $i => $w) $sum += intval($imo[$i]) * $w;
    return ($sum % 10) === intval($imo[6]);
}

/**
 * Valida los datos del barco. $in: ['name' => .., 'imo' => .., 'mmsi' => ..].
 * Devuelve [datos|null, error|null]. $en: mensajes en inglés (para David).
 */
function impBarcoValidar($in, $en = false) {
    $in = is_array($in) ? $in : [];
    $nombre = is_string($in['name'] ?? null) ? trim(preg_replace('/\s+/u', ' ', $in['name'])) : '';
    $imo = is_string($in['imo'] ?? null) || is_int($in['imo'] ?? null) ? preg_replace('/\s+/', '', (string) $in['imo']) : '';
    $mmsi = is_string($in['mmsi'] ?? null) || is_int($in['mmsi'] ?? null) ? preg_replace('/\s+/', '', (string) $in['mmsi']) : '';
    if (preg_match('/^IMO/i', $imo)) $imo = substr($imo, 3);
    if ($nombre === '') return [null, $en ? 'Please enter the name of the vessel the boat is shipped on.' : 'Indica el nombre del barco en que va embarcada: el cliente lo sigue con ese nombre.'];
    if (mb_strlen($nombre) < 2 || mb_strlen($nombre) > 80 || !preg_match('/^[\p{L}\p{N} .\'\-\/&]+$/u', $nombre)) {
        return [null, $en ? 'The vessel name looks invalid. Use letters and numbers only (2 to 80 characters).' : 'El nombre del barco no es válido: usa letras y números (2 a 80 caracteres).'];
    }
    if ($imo !== '' && !impImoValido($imo)) return [null, $en ? 'The IMO number is not valid (7 digits). Check it or leave it empty.' : 'El IMO no es válido (7 dígitos con su dígito verificador). Revísalo o déjalo vacío.'];
    if ($mmsi !== '' && !preg_match('/^\d{9}$/D', $mmsi)) return [null, $en ? 'The MMSI must have 9 digits. Check it or leave it empty.' : 'El MMSI tiene 9 dígitos. Revísalo o déjalo vacío.'];
    return [['name' => $nombre, 'imo' => $imo, 'mmsi' => $mmsi], null];
}

/**
 * Busca o crea la nave y la asocia al expediente. Devuelve
 * ['id', 'name', 'imo', 'mmsi', 'en_vivo' (tiene IMO o MMSI), 'nuevo'].
 */
function impBarcoAsignar($pdo, $order, $datos, $por) {
    $buscar = function ($sql, $param) use ($pdo) {
        $st = $pdo->prepare($sql);
        $st->execute([$param]);
        return $st->fetch(PDO::FETCH_ASSOC) ?: null;
    };
    $v = null;
    if ($datos['imo'] !== '') $v = $buscar('SELECT * FROM vessels WHERE imo = ? ORDER BY id DESC LIMIT 1', $datos['imo']);
    if (!$v && $datos['mmsi'] !== '') $v = $buscar('SELECT * FROM vessels WHERE mmsi = ? ORDER BY id DESC LIMIT 1', $datos['mmsi']);
    // Por nombre sólo si no trae otro IMO/MMSI que lo contradiga.
    if (!$v) {
        $cand = $buscar('SELECT * FROM vessels WHERE LOWER(display_name) = LOWER(?) ORDER BY (CASE WHEN imo IS NULL AND mmsi IS NULL THEN 1 ELSE 0 END), id DESC LIMIT 1', $datos['name']);
        if ($cand && ($datos['imo'] === '' || empty($cand['imo'])) && ($datos['mmsi'] === '' || empty($cand['mmsi']))) $v = $cand;
    }
    $nuevo = false;
    if ($v) {
        // Completa lo que faltaba y la deja activa en el seguimiento.
        $imo = !empty($v['imo']) ? $v['imo'] : ($datos['imo'] !== '' ? $datos['imo'] : null);
        $mmsi = !empty($v['mmsi']) ? $v['mmsi'] : ($datos['mmsi'] !== '' ? $datos['mmsi'] : null);
        $pdo->prepare("UPDATE vessels SET imo = ?, mmsi = ?, status = 'active' WHERE id = ?")->execute([$imo, $mmsi, intval($v['id'])]);
        $id = intval($v['id']);
        $nombre = (string) $v['display_name'];
    } else {
        $pdo->prepare("INSERT INTO vessels (type, display_name, imo, mmsi, origin_label, destination_label, status, is_featured) VALUES (?, ?, ?, ?, ?, ?, 'active', 0)")
            ->execute([($datos['imo'] !== '' || $datos['mmsi'] !== '') ? 'auto' : 'manual', $datos['name'], $datos['imo'] ?: null, $datos['mmsi'] ?: null, 'Estados Unidos', 'Chile']);
        $id = intval($pdo->lastInsertId());
        $nombre = $datos['name'];
        $imo = $datos['imo'] ?: null;
        $mmsi = $datos['mmsi'] ?: null;
        $nuevo = true;
    }
    $pdo->prepare('UPDATE orders SET vessel_id = ? WHERE id = ?')->execute([$id, intval($order['id'])]);
    // El enlace público (/t/<token>) es opcional: la columna la crea la migración del seguimiento.
    if (empty($order['tracking_public_token'])) {
        try { $pdo->prepare('UPDATE orders SET tracking_public_token = ? WHERE id = ?')->execute([bin2hex(random_bytes(32)), intval($order['id'])]); }
        catch (PDOException $e) { error_log('impBarcoAsignar: sin tracking_public_token'); }
    }
    $pdo->prepare("INSERT INTO order_events (order_id, event_type, meta_json) VALUES (?, 'TRACKING_ASSIGNED', ?)")
        ->execute([intval($order['id']), json_encode(['vessel_id' => $id, 'vessel_name' => $nombre, 'imo' => $imo, 'mmsi' => $mmsi, 'por' => $por, 'nuevo' => $nuevo], JSON_UNESCAPED_UNICODE)]);
    return ['id' => $id, 'name' => $nombre, 'imo' => $imo, 'mmsi' => $mmsi, 'en_vivo' => !empty($imo) || !empty($mmsi), 'nuevo' => $nuevo];
}

/** Enlace del cliente al seguimiento del barco de su expediente. */
function impBarcoUrlCliente($vesselId) {
    return 'https://www.imporlan.cl/panel/#/tracking?barco=' . intval($vesselId);
}

/** La nave asociada al expediente (para el correo y el panel), o null. */
function impBarcoDelExpediente($pdo, $order) {
    $id = intval($order['vessel_id'] ?? 0);
    if (!$id) return null;
    try {
        $st = $pdo->prepare('SELECT id, display_name, imo, mmsi FROM vessels WHERE id = ?');
        $st->execute([$id]);
        $v = $st->fetch(PDO::FETCH_ASSOC);
    } catch (PDOException $e) { return null; }
    if (!$v) return null;
    return ['id' => intval($v['id']), 'name' => (string) $v['display_name'], 'imo' => $v['imo'] ?: null, 'mmsi' => $v['mmsi'] ?: null, 'en_vivo' => !empty($v['imo']) || !empty($v['mmsi']), 'url' => impBarcoUrlCliente($v['id'])];
}
