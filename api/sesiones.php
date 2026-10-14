<?php
/**
 * Cerrar las sesiones abiertas cuando cambia la contrasena
 * ========================================================
 *
 * Un token de Imporlan vale siete dias y se verifica mirando solo su firma y
 * su vencimiento. Eso significa que cambiar la contrasena no echaba a nadie:
 * si a un cliente le robaban la sesion, el ladron seguia dentro una semana por
 * mas que el cliente cambiara su clave. Justo el caso en que uno la cambia.
 *
 * COMO SE CORTA, SIN COBRARLE A TODAS LAS PETICIONES
 *
 * Lo normal seria guardar la fecha del ultimo cambio en la cuenta y
 * consultarla al verificar cada token. Pero hoy la verificacion es pura
 * criptografia: no toca la base de datos ni una vez. Meterle una consulta
 * encarece TODAS las peticiones autenticadas del sitio y, peor, crea un modo
 * de fallo nuevo — con la base caida nadie podria ni autenticarse, cuando hoy
 * la sesion sigue viva y solo fallan los datos.
 *
 * Asi que se guarda en un archivo chico: correo -> momento del cambio. Leerlo
 * cuesta lo que leer un archivo de unos pocos kilobytes, y se cachea por
 * peticion. Un token emitido ANTES de esa marca ya no sirve.
 *
 * Las marcas de mas de siete dias se podan solas: pasado el plazo del token,
 * guardarlas no protege de nada porque esos tokens ya vencieron por su cuenta.
 *
 * SI EL ARCHIVO NO SE PUEDE LEER, NO SE ECHA A NADIE. Es a proposito: un disco
 * lleno no puede dejar a los clientes fuera de su panel. En ese caso el
 * comportamiento es el de antes de este archivo, que es el que hubo siempre.
 */

/** Donde vive la lista. logs/ no se sirve por URL (.htaccess del api/). */
function sesionesArchivo() {
    return __DIR__ . '/logs/sesiones-cerradas.json';
}

/** Lo que dura un token; pasado eso, la marca ya no hace falta. */
function sesionesVentana() {
    return 7 * 24 * 3600;
}

/**
 * Deja constancia de que las sesiones de este correo abiertas hasta ahora ya
 * no valen. Se llama al cambiar una contrasena.
 *
 * Devuelve el momento del corte en milisegundos, o false si no pudo
 * escribirse. La clave igual quedo cambiada —eso ya
 * paso—, pero las sesiones viejas siguen abiertas, y quien llama tiene que
 * poder saberlo en vez de anunciar un exito a medias.
 */
function sesionesCerrarAnteriores($email) {
    $email = strtolower(trim((string) $email));
    if ($email === '') return false;

    $archivo = sesionesArchivo();
    $dir = dirname($archivo);
    if (!is_dir($dir)) @mkdir($dir, 0750, true);

    // El candado va sobre un archivo aparte, no sobre la lista. Asi la lista
    // se puede reemplazar entera de un golpe (ver abajo) sin que dos
    // escritores se pisen.
    $fhCandado = @fopen($archivo . '.lock', 'c');
    if (!$fhCandado || !flock($fhCandado, LOCK_EX)) {
        if ($fhCandado) fclose($fhCandado);
        error_log('sesiones: no pude tomar el candado de ' . $archivo);
        return false;
    }

    $lista = is_file($archivo) ? json_decode((string) @file_get_contents($archivo), true) : [];
    if (!is_array($lista)) $lista = [];

    // En milisegundos. `iat` va en segundos y con eso no se distingue un token
    // nacido antes del cambio de uno nacido despues, si los dos caen en el
    // mismo segundo — que es justo lo que pasa con el token nuevo que se le da
    // a quien cambia su propia clave.
    $ahoraMs = (int) floor(microtime(true) * 1000);

    // Se poda al escribir, que pasa pocas veces; leer pasa en cada peticion.
    foreach ($lista as $correo => $ms) {
        if (!is_int($ms) || ($ahoraMs - $ms) > sesionesVentana() * 1000) unset($lista[$correo]);
    }
    $lista[$email] = $ahoraMs;

    // ESCRITURA ATOMICA: se escribe a un temporal y se renombra encima. Quien
    // lee sin candado —que es cada peticion del sitio— ve la lista vieja o la
    // nueva, nunca una a medias. Truncar y reescribir en el mismo archivo
    // dejaba un instante en que la lista estaba vacia, y en ese instante un
    // token revocado pasaba como bueno.
    $tmp = $archivo . '.tmp' . getmypid();
    $escrito = @file_put_contents($tmp, json_encode($lista)) !== false && @rename($tmp, $archivo);
    if (!$escrito) @unlink($tmp);

    flock($fhCandado, LOCK_UN);
    fclose($fhCandado);

    if (!$escrito) {
        error_log('sesiones: NO se pudo registrar el cierre de sesiones de ' . $email);
        return false;
    }

    sesionesLista(true); // el cache de esta peticion quedo viejo

    // Se devuelve el corte para que quien emita un token nuevo lo pueda
    // poner ESTRICTAMENTE despues (ver admin_profile.php).
    return $ahoraMs;
}

/** La lista, leida una sola vez por peticion. */
function sesionesLista($recargar = false) {
    static $cache = null;
    if ($recargar) $cache = null;
    if ($cache !== null) return $cache;

    $archivo = sesionesArchivo();
    if (!is_file($archivo)) return $cache = [];

    $lista = json_decode((string) @file_get_contents($archivo), true);
    return $cache = (is_array($lista) ? $lista : []);
}

/**
 * ¿Sigue valiendo este token?
 *
 * Devuelve false solo cuando consta que la contrasena de ese correo cambio
 * despues de emitirse. Ante cualquier duda —sin marca, sin archivo, sin
 * correo en el payload— se deja pasar: este archivo esta para cerrar sesiones
 * robadas, no para inventar motivos de expulsion.
 */
function sesionSigueValiendo($payload) {
    if (!is_array($payload)) return true;

    $email = strtolower(trim((string) ($payload['email'] ?? '')));
    if ($email === '') return true;

    $lista = sesionesLista();
    if (!isset($lista[$email]) || !is_int($lista[$email])) return true;

    $cambioMs = $lista[$email];
    $ahoraMs = (int) floor(microtime(true) * 1000);
    if (($ahoraMs - $cambioMs) > sesionesVentana() * 1000) return true; // marca ya inutil

    // Los tokens nuevos traen iat_ms y se comparan al milisegundo.
    if (isset($payload['iat_ms']) && is_int($payload['iat_ms'])) {
        return $payload['iat_ms'] > $cambioMs;
    }

    // Los emitidos antes de que existiera iat_ms solo tienen segundos. Si su
    // segundo empieza antes del cambio no se puede probar que sea posterior, y
    // como la marca existe —hubo un cambio de clave reciente—, se opta por lo
    // seguro. Al nuevo de quien cambia su propia clave no le afecta: ese ya
    // nace con iat_ms.
    $iat = $payload['iat'] ?? null;
    if (!is_int($iat)) return false;

    return ($iat * 1000) > $cambioMs;
}
