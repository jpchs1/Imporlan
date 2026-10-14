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
 */
function sesionesCerrarAnteriores($email) {
    $email = strtolower(trim((string) $email));
    if ($email === '') return;

    $archivo = sesionesArchivo();
    $dir = dirname($archivo);
    if (!is_dir($dir)) @mkdir($dir, 0750, true);

    // Con candado: dos cambios a la vez no pueden pisarse la lista.
    $fh = @fopen($archivo, 'c+');
    if (!$fh) {
        error_log('sesiones: no pude abrir ' . $archivo);
        return;
    }
    if (!flock($fh, LOCK_EX)) { fclose($fh); return; }

    $lista = json_decode((string) stream_get_contents($fh), true);
    if (!is_array($lista)) $lista = [];

    $ahora = time();
    // Se poda al escribir, que es lo que pasa pocas veces; leer es lo que pasa
    // en cada peticion y conviene que no haga nada mas que leer.
    foreach ($lista as $correo => $ts) {
        if (!is_int($ts) || ($ahora - $ts) > sesionesVentana()) unset($lista[$correo]);
    }
    $lista[$email] = $ahora;

    rewind($fh);
    ftruncate($fh, 0);
    fwrite($fh, json_encode($lista));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);

    sesionesLista(true); // el cache de esta peticion quedo viejo
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

    $cambio = $lista[$email];
    if ((time() - $cambio) > sesionesVentana()) return true; // marca ya inutil

    // Sin iat no hay forma de saber si el token es anterior al cambio. Como la
    // marca existe —o sea, hubo un cambio de clave reciente en esta cuenta—,
    // aqui se opta por lo seguro: ese token no sigue.
    $iat = $payload['iat'] ?? null;
    if (!is_int($iat)) return false;

    return $iat >= $cambio;
}
