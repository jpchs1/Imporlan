<?php
/**
 * Limpieza de la bandeja de contacto@imporlan.cl (JP, 20-nov-2026).
 *
 * «Limpia su basura que ha llegado y deja todo para que no vuelva a llegar
 * mail spam/basura a la bandeja de entrada.»
 *
 * El servidor ya manda a «spam» lo que SpamAssassin marca, pero con su umbral
 * (5,0) se colaban publicidad masiva, ofertas no pedidas y suplantaciones con
 * puntajes de 1,5 a 4,9. El cron del hosting (cron-deploy.sh, cada 5 minutos)
 * corre api/cron/correo_limpieza.php: revisa los encabezados recientes de la
 * bandeja y MUEVE a la carpeta de spam lo que coincide con
 * api/cron/correo-spam.json. Nunca borra nada: si algo bueno cae ahí, se
 * devuelve desde el webmail y su remitente se agrega a «confiables».
 *
 * Sólo lee encabezados (De, Asunto, puntaje de spam). No abre cuerpos ni
 * adjuntos, no marca como leído y no responde a nadie.
 */

function ccsReglas($archivo = null) {
    $archivo = $archivo ?: __DIR__ . '/cron/correo-spam.json';
    $r = json_decode((string) @file_get_contents($archivo), true);
    if (!is_array($r)) throw new RuntimeException('reglas de correo ilegibles');
    $lista = function ($k) use ($r) { return array_values(array_filter(array_map(function ($x) { return strtolower(trim((string) $x)); }, (array) ($r[$k] ?? [])))); };
    return [
        'umbral' => isset($r['umbral_puntaje']) ? (float) $r['umbral_puntaje'] : 5.0,
        'confiables' => $lista('confiables'),
        'dominios' => $lista('dominios_bloqueados'),
        'remitentes' => $lista('remitentes_bloqueados'),
        'suplantacion' => $lista('suplantacion'),
        'gratuitos' => $lista('correo_gratuito'),
    ];
}

/** ¿$dominio es $d o un subdominio suyo? */
function ccsEnDominio($dominio, array $lista) {
    foreach ($lista as $d) {
        if ($dominio === $d || substr($dominio, -strlen($d) - 1) === '.' . $d) return true;
    }
    return false;
}

/** Puntaje de SpamAssassin desde los encabezados (cPanel: X-Spam-Score viene ×10). */
function ccsPuntaje(array $h) {
    if (preg_match('/score=(-?\d+(?:\.\d+)?)/i', $h['x-spam-status'] ?? '', $m)) return (float) $m[1];
    $s = trim($h['x-spam-score'] ?? '');
    if (preg_match('/^-?\d+(\.\d+)?$/', $s)) return strpos($s, '.') !== false ? (float) $s : ((float) $s) / 10;
    return null;
}

/** Remitente de un encabezado From: [dirección, nombre]. */
function ccsRemitente($from) {
    $from = trim((string) $from);
    if (function_exists('iconv_mime_decode')) {
        $dec = @iconv_mime_decode($from, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');
        if ($dec !== false) $from = $dec;
    }
    $dir = '';
    if (preg_match('/<\s*([^<>\s]+@[^<>\s]+)\s*>/', $from, $m)) $dir = $m[1];
    elseif (preg_match('/([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/', $from, $m)) $dir = $m[1];
    $nombre = trim(preg_replace('/<[^>]*>/', '', $from), " \t\"'");
    return [strtolower($dir), $nombre];
}

/**
 * Por qué un correo es basura, o null si se queda en la bandeja.
 * $h: encabezados en minúsculas (from, subject, x-spam-status, x-spam-score, x-spam-flag).
 */
function ccsMotivo(array $h, array $r) {
    list($dir, $nombre) = ccsRemitente($h['from'] ?? '');
    $dominio = strpos($dir, '@') !== false ? substr($dir, strrpos($dir, '@') + 1) : '';
    // Un confiable nunca cae por las listas. Pero el From se puede falsificar:
    // firmado por su dominio (DKIM/DMARC) no se mueve nunca; sin firma (hay
    // proveedores reales que no firman) se le aplica el umbral del servidor,
    // 5,0, y no el bajo: así un «banco» falsificado que SpamAssassin marca se va.
    $confiable = $dominio !== '' && ccsEnDominio($dominio, $r['confiables']);
    if ($confiable) return ccsAutenticado($h, $dominio) ? null : ccsMotivoSpam($h, max(5.0, $r['umbral']));
    $spam = ccsMotivoSpam($h, $r['umbral']);
    if ($dir !== '' && in_array($dir, $r['remitentes'], true)) return 'remitente bloqueado';
    if ($dominio !== '' && ccsEnDominio($dominio, $r['dominios'])) return 'dominio bloqueado';
    if ($dominio !== '' && in_array($dominio, $r['gratuitos'], true)) {
        $quien = mb_strtolower($nombre . ' ' . $dir, 'UTF-8');
        foreach ($r['suplantacion'] as $s) if ($s !== '' && strpos($quien, $s) !== false) return 'suplantación';
    }
    return $spam;
}

/** Lo que dice SpamAssassin: marcado o sobre el umbral, o null. */
function ccsMotivoSpam(array $h, $umbral) {
    if (preg_match('/^\s*yes/i', $h['x-spam-flag'] ?? '') || preg_match('/^\s*yes/i', $h['x-spam-status'] ?? '')) return 'marcado como spam';
    $p = ccsPuntaje($h);
    if ($p !== null && $p >= $umbral) return 'puntaje de spam ' . number_format($p, 1, '.', '');
    return null;
}

/** ¿El servidor verificó DKIM o DMARC del dominio del remitente (o de su dominio padre)? */
function ccsAutenticado(array $h, $dominio) {
    $ar = strtolower($h['authentication-results'] ?? '');
    if ($ar === '') return false;
    foreach ([['dkim', 'header\.d'], ['dmarc', 'header\.from']] as $p) {
        if (!preg_match_all('/\b' . $p[0] . '=pass\b[^;]*?\b' . $p[1] . '=@?([a-z0-9.\-]+)/', $ar, $mm)) continue;
        foreach ($mm[1] as $firmante) {
            if ($firmante === $dominio || ccsEnDominio($dominio, [$firmante])) return true;
        }
    }
    return false;
}

/** Encabezados crudos → [nombre en minúsculas => valor], desplegando líneas. */
function ccsEncabezados($crudo) {
    $out = [];
    $crudo = preg_replace("/\r?\n[ \t]+/", ' ', (string) $crudo);
    foreach (preg_split("/\r?\n/", $crudo) as $l) {
        if (!preg_match('/^([A-Za-z0-9\-]+):\s*(.*)$/', $l, $m)) continue;
        $k = strtolower($m[1]);
        if (!isset($out[$k])) $out[$k] = trim($m[2]);
        elseif ($k === 'authentication-results') $out[$k] .= '; ' . trim($m[2]);
    }
    return $out;
}

/**
 * Revisa la bandeja y mueve la basura. $imap: CcsImap (o un doble en pruebas)
 * con buscarDesde(), encabezados(), carpetaSpam() y mover().
 */
function ccsLimpiar($imap, array $r, $dias, $simular = false) {
    $uids = $imap->buscarDesde(time() - max(1, (int) $dias) * 86400);
    $res = ['revisados' => count($uids), 'movidos' => [], 'carpeta' => null];
    if (!$uids) return $res;
    $basura = [];
    foreach (array_chunk($uids, 200) as $grupo) {
        foreach ($imap->encabezados($grupo) as $uid => $h) {
            $motivo = ccsMotivo($h, $r);
            if ($motivo === null) continue;
            list($dir) = ccsRemitente($h['from'] ?? '');
            $basura[$uid] = ['uid' => $uid, 'de' => $dir, 'motivo' => $motivo];
        }
    }
    if (!$basura) return $res;
    $carpeta = $imap->carpetaSpam();
    if (!$carpeta) throw new RuntimeException('no hay carpeta de spam');
    $res['carpeta'] = $carpeta;
    if (!$simular) $imap->mover(array_keys($basura), $carpeta);
    $res['movidos'] = array_values($basura);
    return $res;
}

/** Cliente IMAP mínimo (LOGIN, SELECT, UID SEARCH/FETCH/MOVE). */
class CcsImap {
    private $s;
    private $n = 0;
    private $caps = '';

    /** $stream: para pruebas, un socket ya abierto con las respuestas del servidor. */
    public function __construct($host, $port = 993, $stream = null) {
        if ($stream) $this->s = $stream;
        else {
            $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $host, 'SNI_enabled' => true]]);
            $this->s = @stream_socket_client('ssl://' . $host . ':' . intval($port), $eno, $estr, 20, STREAM_CLIENT_CONNECT, $ctx);
            if (!$this->s) throw new RuntimeException('IMAP: no se pudo conectar (' . $estr . ')');
            stream_set_timeout($this->s, 30);
        }
        $saludo = $this->linea();
        if (stripos($saludo, '* OK') !== 0) throw new RuntimeException('IMAP: saludo inesperado');
    }

    private function linea() {
        $l = fgets($this->s);
        if ($l === false) throw new RuntimeException('IMAP: el servidor no respondió');
        return $l;
    }

    private function leer($n) {
        $b = '';
        while (strlen($b) < $n) {
            $c = fread($this->s, $n - strlen($b));
            if ($c === false || $c === '') throw new RuntimeException('IMAP: respuesta cortada');
            $b .= $c;
        }
        return $b;
    }

    /** Respuestas sin etiqueta: [['texto' => línea sin literales, 'lits' => [literales]]]. */
    public function cmd($c) {
        $tag = 'C' . (++$this->n);
        fwrite($this->s, $tag . ' ' . $c . "\r\n");
        $out = [];
        while (true) {
            $l = $this->linea();
            $texto = $l;
            $lits = [];
            while (preg_match('/\{(\d+)\}\r?\n$/', $texto, $m)) {
                $lits[] = $this->leer((int) $m[1]);
                $texto = substr($texto, 0, -strlen($m[0])) . '{L}' . $this->linea();
            }
            if (strpos($texto, $tag . ' ') === 0) {
                if (!preg_match('/^' . $tag . ' OK/i', $texto)) throw new RuntimeException('IMAP: ' . trim(substr($texto, strlen($tag) + 1, 160)));
                return $out;
            }
            if (preg_match('/^\* CAPABILITY (.*)$/i', trim($texto), $m)) $this->caps = ' ' . strtoupper($m[1]) . ' ';
            $out[] = ['texto' => $texto, 'lits' => $lits];
        }
    }

    private static function q($s) {
        if (preg_match('/[\r\n\x00]|[^\x20-\x7e]/', $s)) throw new RuntimeException('IMAP: credencial con caracteres no soportados');
        return '"' . addcslashes($s, "\"\\") . '"';
    }

    public function entrar($usuario, $clave) {
        $this->cmd('LOGIN ' . self::q($usuario) . ' ' . self::q($clave));
        $this->cmd('CAPABILITY');
        $this->cmd('SELECT INBOX');
    }

    public function buscarDesde($ts) {
        $uids = [];
        foreach ($this->cmd('UID SEARCH SINCE ' . gmdate('j-M-Y', $ts)) as $r) {
            if (preg_match('/^\* SEARCH\b(.*)$/i', trim($r['texto']), $m)) foreach (preg_split('/\s+/', trim($m[1])) as $u) if (ctype_digit($u)) $uids[] = (int) $u;
        }
        sort($uids);
        return $uids;
    }

    public function encabezados(array $uids) {
        $out = [];
        if (!$uids) return $out;
        $campos = 'FROM SUBJECT X-SPAM-STATUS X-SPAM-SCORE X-SPAM-FLAG AUTHENTICATION-RESULTS';
        foreach ($this->cmd('UID FETCH ' . implode(',', array_map('intval', $uids)) . ' (UID BODY.PEEK[HEADER.FIELDS (' . $campos . ')])') as $r) {
            if (!preg_match('/^\* \d+ FETCH /i', $r['texto']) || !preg_match('/\bUID (\d+)/i', $r['texto'], $m)) continue;
            $out[(int) $m[1]] = ccsEncabezados($r['lits'][0] ?? '');
        }
        return $out;
    }

    public function carpetaSpam() {
        $nombres = [];
        foreach ($this->cmd('LIST "" "*"') as $r) {
            if (!preg_match('/^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (.+)$/i', trim($r['texto']), $m)) continue;
            $nombre = trim($m[2]);
            if ($nombre === '{L}') $nombre = trim($r['lits'][0] ?? '');
            $nombre = trim($nombre, '"');
            if (stripos($m[1], '\\Junk') !== false) return $nombre;
            $nombres[] = $nombre;
        }
        foreach (['INBOX.spam', 'INBOX.Junk', 'Junk', 'Spam'] as $n) if (in_array($n, $nombres, true)) return $n;
        return null;
    }

    public function mover(array $uids, $carpeta) {
        if (strpos($this->caps, ' MOVE ') === false) throw new RuntimeException('IMAP: el servidor no permite MOVE');
        foreach (array_chunk($uids, 200) as $g) $this->cmd('UID MOVE ' . implode(',', array_map('intval', $g)) . ' ' . self::q($carpeta));
    }

    public function salir() {
        try { $this->cmd('LOGOUT'); } catch (Throwable $e) { /* el servidor cierra */ }
        @fclose($this->s);
    }
}
