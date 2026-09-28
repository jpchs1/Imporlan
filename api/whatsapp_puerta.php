<?php
/**
 * Respuestas por WhatsApp de Imporlan · con demora y con la aprobación de JP.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────
 *
 * El +56 9 4021 1459 atiende a Tourevo, Deckeva e Imporlan, y cada negocio se
 * atiende y se cotiza desde su propio sistema (JP, 28-sep-2026). La IA de Meta
 * contesta al instante y no se puede demorar; la regla es esperar 1, 2, 3, 5,
 * 7, 15 o 40 minutos, de 8:00 a 20:00.
 *
 * Meta entrega los mensajes del número a tourevo.cl, que reconoce los chats de
 * Imporlan y los DERIVA acá, firmados. Acá se redacta, se espera, JP aprueba y
 * lo aprobado vuelve firmado a la puerta de tourevo.cl, que lo manda por el
 * mismo número. Tourevo no redacta ni cotiza nada de Imporlan.
 *
 *   POST /api/whatsapp_puerta.php?r=entrada     el chat, cuando el cliente escribe
 *   POST /api/whatsapp_puerta.php?r=tick        cada minuto: acá se decide qué sale
 *   GET  /api/whatsapp_puerta.php?r=panel&k=    los borradores, para aprobar
 *   POST /api/whatsapp_puerta.php?r=panel&k=    aprobar / descartar
 *
 * Por parámetro y no por ruta (…php/entrada): el .htaccess de api/ reescribe
 * lo que no es un archivo, y un PATH_INFO podía terminar en index.php.
 *
 * El link del panel va en el correo a JP; `k` es una firma del secreto, así
 * que sólo lo tiene quien recibe ese correo.
 *
 * ── LA CONFIG ────────────────────────────────────────────────────────────
 *
 * En /home/wwimpo/credentials_config.php (fuera del webroot), o variables de
 * entorno con el mismo nombre:
 *   IMPORLAN_WA_SECRETO     el mismo que PUERTA_IMPORLAN_SECRETO en tourevo-cl
 *   IMPORLAN_WA_ANTHROPIC   la llave de Claude
 *   IMPORLAN_WA_MODO        borrador (por defecto) · automatico
 * Sin secreto ni llave no hace nada.
 *
 * ── LO QUE NO SE NEGOCIA ─────────────────────────────────────────────────
 *
 * - Modo borrador por defecto: nada sale sin que JP lo apruebe.
 * - Nunca un precio por WhatsApp. Un texto con importe, guion largo o voseo
 *   no sale nunca, ni en automático.
 * - Si alguien le contestó al cliente después de su mensaje, no sale.
 * - Pasadas 23 horas no sale: Meta sólo acepta texto libre dentro de 24 h.
 */

$cred = '/home/wwimpo/credentials_config.php';
if (is_file($cred)) require_once $cred;

const IWA_PUERTA_SALIDA = 'https://tourevo.cl/api/whatsapp-puerta.php?negocio=imporlan';
const IWA_ESPERAS = array(1, 2, 3, 5, 7, 15, 40);
const IWA_SILENCIO = 90;
const IWA_VENCE = 82800;
const IWA_MODELO = 'claude-opus-5';
const IWA_APROBADOR = 'jpchs1@gmail.com';

function iwa_cfg($nombre, $def = '') {
    if (defined($nombre)) return trim((string) constant($nombre));
    $v = getenv($nombre);
    return $v !== false && $v !== '' ? trim((string) $v) : $def;
}
function iwa_secreto() { return iwa_cfg('IMPORLAN_WA_SECRETO'); }
function iwa_llave() { return iwa_cfg('IMPORLAN_WA_ANTHROPIC'); }
function iwa_modo() { return iwa_cfg('IMPORLAN_WA_MODO', 'borrador') === 'automatico' ? 'automatico' : 'borrador'; }
function iwa_archivo() { return __DIR__ . '/logs/whatsapp.json'; } // logs/ tiene «Require all denied»
function iwa_llave_panel() { return substr(hash_hmac('sha256', 'panel', iwa_secreto()), 0, 32); }

// ── La firma · la misma que admin/src/Core/WhatsAppPuertas.php de Tourevo ──

function iwa_firmar($cuerpo, $ts) { return 'sha256=' . hash_hmac('sha256', $ts . '.' . $cuerpo, iwa_secreto()); }
function iwa_firma_valida($cuerpo, $firma, $ts) {
    if (strlen(iwa_secreto()) < 24 || !ctype_digit((string) $ts) || abs(time() - (int) $ts) > 300) return false;
    return hash_equals(iwa_firmar($cuerpo, (int) $ts), (string) $firma);
}

// ── Reglas del texto y de la espera · iguales a Tourevo y Deckeva ──

function iwa_validar($txt) {
    $t = trim((string) $txt);
    if ($t === '') return 'vacío';
    if (mb_strlen($t) > 600) return 'pasa de 600 caracteres';
    if (preg_match('/[\x{2014}\x{2013}\x{2012}\x{2015}]/u', $t)) return 'lleva guion largo';
    if (preg_match('/(USD|US\$|CLP|R\$|\$)\s?\d|\d[\d.,]*\s?(USD|CLP|d[oó]lares|pesos|reais)/iu', $t)) return 'lleva un importe · la cotización va por correo';
    if (preg_match('/\b(vos|tenés|podés|querés|escribinos|avisanos|contame|decime|mirá)(?!\p{L})/iu', $t)) return 'no es chileno (vos/tenés)';
    return '';
}
function iwa_demora($s) {
    $base = IWA_ESPERAS[hexdec(substr(hash('sha256', $s . '|espera'), 0, 8)) % count(IWA_ESPERAS)] * 60;
    return $base + hexdec(substr(hash('sha256', $s . '|seg'), 0, 8)) % max(30, (int) ($base * 0.3));
}
function iwa_hora($t) { return (int) (new DateTimeImmutable('@' . (int) $t))->setTimezone(new DateTimeZone('America/Santiago'))->format('G'); }
function iwa_habil($t) { $h = iwa_hora($t); return $h >= 8 && $h < 20; }
function iwa_en_horario($t, $s) {
    if (iwa_habil($t)) return (int) $t;
    $d = (new DateTimeImmutable('@' . (int) $t))->setTimezone(new DateTimeZone('America/Santiago'));
    $dia = iwa_hora($t) >= 20 ? $d->modify('+1 day') : $d;
    return $dia->setTime(8, 0)->getTimestamp() + 300 + hexdec(substr(hash('sha256', $s . '|abre'), 0, 8)) % 3000;
}
function iwa_legible($t) { return (new DateTimeImmutable('@' . (int) $t))->setTimezone(new DateTimeZone('America/Santiago'))->format('d-m H:i'); }

// ── Estado · un JSON, con candado ──

function iwa_leer() {
    $f = iwa_archivo();
    $j = is_file($f) ? json_decode((string) file_get_contents($f), true) : null;
    return is_array($j) ? $j : array();
}
function iwa_escribir($chats) {
    uasort($chats, function ($a, $b) { return ((int) ($b['actualizado'] ?? 0)) <=> ((int) ($a['actualizado'] ?? 0)); });
    $chats = array_slice($chats, 0, 200, true);
    if (!is_dir(dirname(iwa_archivo()))) @mkdir(dirname(iwa_archivo()), 0750, true);
    $tmp = iwa_archivo() . '.tmp' . getmypid();
    file_put_contents($tmp, json_encode($chats, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    rename($tmp, iwa_archivo());
}
/**
 * Toda escritura pasa por acá, con un candado corto sobre una lectura fresca:
 * la entrada, el panel y la pasada escriben el mismo archivo, y sin esto la
 * última en guardar pisaba a las otras. Lo lento (Claude) queda FUERA.
 */
function iwa_con_candado($cambio) {
    if (!is_dir(dirname(iwa_archivo()))) @mkdir(dirname(iwa_archivo()), 0750, true);
    $f = @fopen(iwa_archivo() . '.escritura.lock', 'c');
    if ($f) flock($f, LOCK_EX);
    try {
        iwa_escribir($cambio(iwa_leer()));
    } finally {
        if ($f) { flock($f, LOCK_UN); fclose($f); }
    }
}
function iwa_huella($c) { return md5(json_encode(array($c['mensajes'] ?? array(), $c['pendiente'] ?? null))); }

function iwa_anotar(&$c, $que) {
    $c['historial'][] = array('ts' => time(), 'que' => $que);
    $c['historial'] = array_slice($c['historial'], -40);
    $c['actualizado'] = time();
}

// ── Entrada y pasada ──

function iwa_entrada($d) {
    $num = preg_replace('/\D+/', '', (string) ($d['numero'] ?? ''));
    if (!preg_match('/^\d{8,15}$/', $num)) return;
    $msgs = array();
    foreach ((array) ($d['mensajes'] ?? array()) as $m) {
        $ts = (int) ($m['ts'] ?? 0);
        if ($ts <= 0 || $ts > time() + 300) continue; // una hora futura alargaría la ventana de 24 h
        $msgs[] = array('ts' => $ts, 'dir' => ($m['dir'] ?? '') === 'in' ? 'in' : 'out', 'texto' => mb_substr((string) ($m['texto'] ?? ''), 0, 2000));
    }
    if (!$msgs) return;
    $ultimo = max(array_column($msgs, 'ts'));
    iwa_con_candado(function ($chats) use ($num, $msgs, $ultimo) {
        $c = $chats[$num] ?? array('numero' => $num, 'pendiente' => null, 'historial' => array(), 'mensajes' => array());
        $antes = !empty($c['mensajes']) ? max(array_column($c['mensajes'], 'ts')) : 0;
        if ($ultimo < $antes) return $chats; // una entrega más vieja no pisa a una más nueva
        $c['mensajes'] = array_slice($msgs, -30);
        $c['actualizado'] = time();
        $chats[$num] = $c;
        return $chats;
    });
}

function iwa_pasada($fx) {
    if (iwa_llave() === '' || strlen(iwa_secreto()) < 24) return;
    foreach (array_keys(iwa_leer()) as $num) iwa_un_chat((string) $num, $fx); // un número como clave de array PHP lo vuelve entero
}

/**
 * Un chat: se lee, se decide (Claude, si toca, FUERA del candado) y se guarda
 * sólo si nadie lo tocó mientras tanto. Si entró un mensaje o JP aprobó en el
 * medio, no se guarda nada y la próxima pasada lo mira con lo nuevo.
 */
function iwa_un_chat($num, $fx) {
    $ahora = time();
    $chats = iwa_leer();
    if (!isset($chats[$num])) return;
    $c = $chats[$num];
    $original = $c;
    $huella = iwa_huella($c);
    $salida = null;
    $avisar = false;
    do {
            $ultIn = 0; $ultOut = 0;
            foreach ((array) ($c['mensajes'] ?? array()) as $m) {
                if ($m['dir'] === 'in') $ultIn = max($ultIn, (int) $m['ts']); else $ultOut = max($ultOut, (int) $m['ts']);
            }
            $p = $c['pendiente'] ?? null;
            $activo = is_array($p) && in_array($p['estado'] ?? '', array('borrador', 'aprobado'), true);
            if ($ultIn === 0) break;
            if ($ultOut >= $ultIn) {
                if ($activo) { $p['estado'] = 'superado'; $c['pendiente'] = $p; iwa_anotar($c, $p['id'] . ' no sale · alguien le contestó antes'); }
                break;
            }
            if ($ahora - $ultIn > IWA_VENCE) {
                if ($activo) { $p['estado'] = 'vencido'; $c['pendiente'] = $p; iwa_anotar($c, $p['id'] . ' vencido · más de 23 h'); }
                break;
            }
            if ($activo && (int) $p['para_ts'] < $ultIn) { $p['estado'] = 'reemplazado'; iwa_anotar($c, $p['id'] . ' reemplazado · el cliente volvió a escribir'); }

            if (!is_array($p) || (int) $p['para_ts'] < $ultIn) {
                if ($ahora - $ultIn < IWA_SILENCIO) break;
                $r = $fx['redactar']((array) $c['mensajes']);
                if (!$r['ok']) { iwa_anotar($c, 'no se pudo redactar · ' . $r['error']); break; }
                $id = 'I-' . strtoupper(substr(base_convert(substr(hash('sha256', $num . '|' . $ultIn), 0, 10), 16, 36), 0, 4));
                if (!$r['responder'] || $r['texto'] === '') {
                    $c['pendiente'] = array('id' => $id, 'para_ts' => $ultIn, 'estado' => 'sin_respuesta', 'motivo' => $r['motivo']);
                    iwa_anotar($c, 'no hace falta contestar · ' . $r['motivo']);
                    break;
                }
                $regla = iwa_validar($r['texto']);
                $auto = iwa_modo() === 'automatico' && !$r['necesita_humano'] && $regla === '';
                $s = $num . '|' . $ultIn;
                $p = array('id' => $id, 'para_ts' => $ultIn, 'texto' => $r['texto'], 'en' => iwa_en_horario($ultIn + iwa_demora($s), $s),
                    'estado' => $auto ? 'aprobado' : 'borrador', 'necesita_humano' => $r['necesita_humano'], 'motivo' => $r['motivo'], 'regla' => $regla);
                if ($auto) $p['aprobado_por'] = 'automático';
                $c['pendiente'] = $p;
                iwa_anotar($c, $id . ' redactado · ' . ($auto ? 'sale solo ' . iwa_legible($p['en']) : 'espera a JP'));
                $avisar = !$auto;
            }

            if (($p['estado'] ?? '') === 'aprobado' && (int) $p['para_ts'] === $ultIn && $ahora >= (int) $p['en'] && iwa_habil($ahora)) {
                $salida = $p;
            }
    } while (false);

    $guardado = false;
    if ($c !== $original) {
        iwa_con_candado(function ($chats) use ($num, $c, $huella, &$guardado) {
            if (!isset($chats[$num]) || iwa_huella($chats[$num]) !== $huella) return $chats;
            $chats[$num] = $c;
            $guardado = true;
            return $chats;
        });
        if ($guardado && $avisar) $fx['avisar']($c); // después de guardar: si no, se repetiría
        if (!$guardado) return;
    }
    if ($salida === null) return;

    // El ref es el id del borrador y la puerta no encola dos veces el mismo:
    // reintentar después de una caída no duplica el mensaje.
    $w = $fx['mandar']($num, (string) $salida['texto'], (string) $salida['id'], (string) ($salida['aprobado_por'] ?? 'JP'));
    iwa_con_candado(function ($chats) use ($num, $salida, $w, $ahora) {
        $c = $chats[$num] ?? null;
        if (!is_array($c) || ($c['pendiente']['id'] ?? '') !== $salida['id']) return $chats;
        $p = $c['pendiente'];
        if ($w['ok']) {
            $p['estado'] = 'enviado';
            $p['enviado_ts'] = $ahora;
            iwa_anotar($c, $p['id'] . ' entregado a la puerta · sale en el próximo minuto');
        } else {
            // Una caída de la puerta no pierde la respuesta: sigue aprobada y se
            // reintenta en las pasadas siguientes, hasta 10 veces.
            $p['intentos'] = (int) ($p['intentos'] ?? 0) + 1;
            $p['error'] = $w['error'];
            if ($p['intentos'] >= 10) $p['estado'] = 'error';
            iwa_anotar($c, $p['id'] . ' no salió (intento ' . $p['intentos'] . ') · ' . $w['error']);
        }
        $c['pendiente'] = $p;
        $chats[$num] = $c;
        return $chats;
    });
}

// ── Efectos: Claude, la puerta de salida, el correo a JP ──

function iwa_post($url, $headers, $body, $timeout) {
    $h = '';
    foreach ($headers as $k => $v) $h .= $k . ': ' . $v . "\r\n";
    $ctx = stream_context_create(array('http' => array('method' => 'POST', 'header' => $h, 'content' => $body, 'timeout' => $timeout, 'ignore_errors' => true)));
    $resp = @file_get_contents($url, false, $ctx);
    $code = 0;
    foreach ((array) ($http_response_header ?? array()) as $l) if (preg_match('#^HTTP/\S+\s+(\d{3})#', $l, $mm)) $code = (int) $mm[1];
    return array('code' => $code, 'body' => $resp === false ? '' : $resp);
}

function iwa_sistema() {
    return "Contestas el WhatsApp de Imporlan, en Chile. Te paso la conversación con un cliente y redactas UNA respuesta a lo último que escribió.\n\n"
        . "Lo que sabes de Imporlan:\n"
        . "- Importa lanchas, veleros y motos de agua desde Estados Unidos a Chile, puerta a puerta, con un panel de seguimiento online. Es del mismo grupo que Deckeva. Sitio: imporlan.cl, con cotizador de importación.\n"
        . "- Para empezar hace falta: qué embarcación busca (marca, modelo o tamaño si lo tiene, o el link del aviso en USA), el presupuesto aproximado, y el nombre y el email del cliente.\n"
        . "- Los valores, plazos y costos de importación se mandan por correo con el detalle.\n\n"
        . "Cómo se escribe:\n"
        . "- En el idioma del cliente. En castellano, chileno y con tú: tienes, puedes, cuéntame. Nunca vos, tenés, podés.\n"
        . "- Corto, como desde el celular: una a tres frases. Sin listas, sin guiones largos (— o –), a lo más un emoji.\n"
        . "- Nunca escribas un precio, un costo ni un importe. Si pregunta cuánto cuesta, dile que se lo mandas por correo con el detalle y pide lo que falte.\n"
        . "- No inventes. Plazos, disponibilidad de una embarcación, estado de un pedido, pagos, cambios o reclamos: responde que lo revisas y le confirmas, y marca necesita_humano.\n"
        . "- No saludes de nuevo si ya se saludaron. No repitas lo ya dicho.\n"
        . "- Si lo último no necesita respuesta (un gracias, un ok), responder = false y texto vacío.\n"
        . "- motivo: una línea para el equipo, no para el cliente.";
}

$IWA_FX = array(
    'redactar' => function ($mensajes) {
        $tz = new DateTimeZone('America/Santiago');
        $txt = '';
        foreach ($mensajes as $m) {
            $t = trim((string) $m['texto']);
            if ($t !== '') $txt .= '[' . (new DateTimeImmutable('@' . (int) $m['ts']))->setTimezone($tz)->format('Y-m-d H:i') . '] ' . ($m['dir'] === 'in' ? 'Cliente' : 'Imporlan') . ': ' . $t . "\n";
        }
        if ($txt === '') return array('ok' => false, 'error' => 'chat sin texto');
        $esquema = array('type' => 'object', 'additionalProperties' => false, 'required' => array('responder', 'texto', 'necesita_humano', 'motivo'),
            'properties' => array('responder' => array('type' => 'boolean'), 'texto' => array('type' => 'string'), 'necesita_humano' => array('type' => 'boolean'), 'motivo' => array('type' => 'string')));
        $r = iwa_post('https://api.anthropic.com/v1/messages', array('x-api-key' => iwa_llave(), 'anthropic-version' => '2023-06-01', 'anthropic-beta' => 'server-side-fallback-2026-07-01', 'content-type' => 'application/json'),
            json_encode(array('model' => IWA_MODELO, 'max_tokens' => 2000, 'fallbacks' => 'default',
                'output_config' => array('effort' => 'low', 'format' => array('type' => 'json_schema', 'schema' => $esquema)),
                'system' => iwa_sistema(), 'messages' => array(array('role' => 'user', 'content' => "<conversacion>\n" . $txt . '</conversacion>')))), 60);
        $j = json_decode($r['body'], true);
        if ($r['code'] !== 200 || !is_array($j)) return array('ok' => false, 'error' => 'Claude HTTP ' . $r['code']);
        if (in_array($j['stop_reason'] ?? '', array('refusal', 'max_tokens'), true)) return array('ok' => false, 'error' => (string) $j['stop_reason']);
        $out = '';
        foreach ((array) ($j['content'] ?? array()) as $b) if (($b['type'] ?? '') === 'text') $out .= (string) $b['text'];
        $d = json_decode($out, true);
        if (!is_array($d)) return array('ok' => false, 'error' => 'respuesta no es JSON');
        return array('ok' => true, 'responder' => !empty($d['responder']), 'texto' => trim((string) ($d['texto'] ?? '')), 'necesita_humano' => !empty($d['necesita_humano']), 'motivo' => trim((string) ($d['motivo'] ?? '')));
    },
    'mandar' => function ($num, $texto, $ref, $aprobo) {
        $v = iwa_validar($texto);
        if ($v !== '') return array('ok' => false, 'error' => 'el texto no pasa las reglas · ' . $v);
        $cuerpo = json_encode(array('para' => (string) $num, 'texto' => $texto, 'ref' => $ref, 'aprobo' => $aprobo), JSON_UNESCAPED_UNICODE);
        $ts = time();
        $r = iwa_post(IWA_PUERTA_SALIDA, array('Content-Type' => 'application/json', 'X-Puerta-Ts' => (string) $ts, 'X-Puerta-Firma' => iwa_firmar($cuerpo, $ts)), $cuerpo, 20);
        return $r['code'] === 200 ? array('ok' => true) : array('ok' => false, 'error' => 'puerta HTTP ' . $r['code'] . ' ' . substr($r['body'], 0, 120));
    },
    'avisar' => function ($c) {
        $p = $c['pendiente'];
        $lnk = 'https://www.imporlan.cl/api/whatsapp_puerta.php?r=panel&k=' . iwa_llave_panel();
        $h = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111"><p>Borrador de respuesta al WhatsApp de +' . htmlspecialchars($c['numero']) . ' · Imporlan.</p>';
        foreach (array_slice((array) $c['mensajes'], -6) as $m) $h .= '<p style="margin:4px 0"><span style="color:#666">' . ($m['dir'] === 'in' ? 'Cliente' : 'Imporlan') . ' ' . iwa_legible($m['ts']) . ' ·</span> ' . nl2br(htmlspecialchars($m['texto'])) . '</p>';
        $h .= '<p style="margin-top:14px"><b>Respuesta propuesta</b></p><p style="background:#eff6ff;padding:10px;border-radius:6px">' . nl2br(htmlspecialchars($p['texto'])) . '</p>';
        if (!empty($p['necesita_humano'])) $h .= '<p style="color:#b45309">Necesita que lo mires: ' . htmlspecialchars($p['motivo']) . '</p>';
        if (!empty($p['regla'])) $h .= '<p style="color:#b45309">No pasa las reglas (' . htmlspecialchars($p['regla']) . '): corrígelo antes de aprobar.</p>';
        $h .= '<p>Sale ' . iwa_legible($p['en']) . ' si la apruebas antes.</p><p><a href="' . htmlspecialchars($lnk) . '" style="background:#2563eb;color:#fff;padding:9px 16px;border-radius:6px;text-decoration:none">Revisar, corregir o aprobar</a></p></div>';
        try {
            require_once __DIR__ . '/whatsapp_puerta_mailer.php';
            (new ImporlanWaMailer())->mandar(IWA_APROBADOR, ((!empty($p['necesita_humano']) || !empty($p['regla'])) ? '⚠ ' : '') . 'Respuesta ' . $p['id'] . ' · Imporlan · +' . $c['numero'], $h);
        } catch (\Throwable $t) {
            error_log('whatsapp_puerta · correo a JP: ' . $t->getMessage());
        }
    },
);

// ── Rutas ──

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') !== basename(__FILE__)) return; // incluido por un test

$ruta = (string) ($_GET['r'] ?? '');
$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
header('Cache-Control: no-store');

if ($ruta === 'entrada' || $ruta === 'tick') {
    header('Content-Type: application/json; charset=UTF-8');
    if ($metodo !== 'POST') { http_response_code(405); echo '{"ok":false}'; exit; }
    $raw = (string) file_get_contents('php://input');
    if (strlen($raw) > 65536 || !iwa_firma_valida($raw, $_SERVER['HTTP_X_PUERTA_FIRMA'] ?? '', $_SERVER['HTTP_X_PUERTA_TS'] ?? '')) { http_response_code(401); echo '{"ok":false,"error":"firma"}'; exit; }
    $d = json_decode($raw, true);
    if (!is_array($d)) { http_response_code(400); echo '{"ok":false}'; exit; }
    if ($ruta === 'entrada') {
        iwa_entrada($d);
    } else {
        $lock = @fopen(iwa_archivo() . '.lock', 'c');
        if ($lock && flock($lock, LOCK_EX | LOCK_NB)) { iwa_pasada($IWA_FX); flock($lock, LOCK_UN); }
    }
    echo '{"ok":true}';
    exit;
}

if ($ruta === 'panel') {
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Robots-Tag: noindex');
    $k = (string) ($_GET['k'] ?? '');
    if (strlen(iwa_secreto()) < 24 || !hash_equals(iwa_llave_panel(), $k)) { http_response_code(403); echo 'No autorizado'; exit; }
    $msg = '';
    if ($metodo === 'POST') {
        $num = preg_replace('/\D+/', '', (string) ($_POST['numero'] ?? ''));
        $id = (string) ($_POST['id'] ?? '');
        $texto = trim((string) ($_POST['texto'] ?? ''));
        $accion = (string) ($_POST['accion'] ?? '');
        iwa_con_candado(function ($chats) use ($num, $id, $texto, $accion, &$msg) {
            $c = $chats[$num] ?? null;
            $p = is_array($c) ? ($c['pendiente'] ?? null) : null;
            // Se aprueba EL borrador que se mostró: si el cliente volvió a
            // escribir y ya hay otro, el formulario viejo no lo aprueba.
            if (!is_array($p) || ($p['estado'] ?? '') !== 'borrador' || ($p['id'] ?? '') !== $id) {
                $msg = 'Ese borrador ya no está esperando (el cliente pudo volver a escribir). Mira el nuevo.';
                return $chats;
            }
            if ($accion === 'descartar') {
                $p['estado'] = 'descartado'; iwa_anotar($c, $p['id'] . ' descartado'); $msg = 'Descartado · no sale nada.';
            } else {
                $v = iwa_validar($texto);
                if ($v !== '') { $msg = 'No se aprobó: ' . $v . '.'; return $chats; }
                $p['texto'] = $texto; $p['estado'] = 'aprobado'; $p['aprobado_por'] = 'JP · panel';
                iwa_anotar($c, $p['id'] . ' aprobado');
                $msg = 'Aprobado · sale ' . iwa_legible(max((int) $p['en'], time())) . '.';
            }
            $c['pendiente'] = $p;
            $chats[$num] = $c;
            return $chats;
        });
    }
    $e = function ($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); };
    echo '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp Imporlan</title>'
        . '<body style="font-family:Arial,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#111"><h1>WhatsApp Imporlan</h1>'
        . '<p>Se contestan entre 1 y 40 minutos después del mensaje del cliente, de 8:00 a 20:00. ' . (iwa_modo() === 'automatico' ? '<b>Automático</b>.' : '<b>Borrador</b>: nada sale sin tu aprobación.') . '</p>';
    if ($msg !== '') echo '<p style="background:#eff6ff;padding:8px">' . $e($msg) . '</p>';
    $hay = false;
    foreach (iwa_leer() as $num => $c) {
        $p = $c['pendiente'] ?? null;
        if (!is_array($p) || ($p['estado'] ?? '') !== 'borrador') continue;
        $hay = true;
        echo '<div style="border:1px solid #ddd;border-radius:8px;padding:12px;margin:12px 0"><h3>+' . $e($num) . ' · ' . $e($p['id']) . '</h3>';
        foreach (array_slice((array) $c['mensajes'], -6) as $m) echo '<p style="margin:4px 0"><span style="color:#666">' . ($m['dir'] === 'in' ? 'Cliente' : 'Imporlan') . ' ' . $e(iwa_legible($m['ts'])) . ':</span> ' . $e($m['texto']) . '</p>';
        if (!empty($p['necesita_humano'])) echo '<p style="color:#b45309">Necesita que lo mires: ' . $e($p['motivo']) . '</p>';
        if (!empty($p['regla'])) echo '<p style="color:#b45309">No pasa las reglas: ' . $e($p['regla']) . '</p>';
        echo '<form method="post"><input type="hidden" name="numero" value="' . $e($num) . '"><input type="hidden" name="id" value="' . $e($p['id']) . '"><textarea name="texto" rows="4" style="width:100%">' . $e($p['texto']) . '</textarea>'
            . '<p><button name="accion" value="aprobar">Aprobar · sale ' . $e(iwa_legible(max((int) $p['en'], time()))) . '</button> <button name="accion" value="descartar">Descartar</button></p></form></div>';
    }
    if (!$hay) echo '<p>No hay borradores esperando.</p>';
    exit;
}

http_response_code(404);
