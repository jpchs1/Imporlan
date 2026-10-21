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

function impEsPagoDelExpediente($r, $orderId, $n) {
    $meta = $r['metadata'] ?? [];
    if (strval($meta['order_id'] ?? '') !== strval($orderId)) return false;
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
            if (impEsPagoDelExpediente($r, $orderId, $n) && ($r['status'] ?? '') !== 'cancelled') return ['cobro' => $r, 'creado' => false];
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
