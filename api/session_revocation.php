<?php
/**
 * Cortar las sesiones viejas al cambiar la contrasena
 * ===================================================
 *
 * El caso que esto resuelve es justo el que hace existir la recuperacion de
 * contrasena: a alguien le entraron a la cuenta. Cambia la clave, y hasta
 * ahora el que habia entrado seguia dentro — los JWT valen siete dias y
 * verifyJWTLocal()/verifyJWTToken() solo miran la firma y el vencimiento, asi
 * que el token que ya tenia en la mano seguia siendo bueno. Cambiar la clave
 * no echaba a nadie: solo cerraba la puerta de entrada con el intruso adentro.
 *
 * Ahora cada cuenta puede tener una marca de "nada emitido antes de este
 * momento sirve", y la verificacion del token la mira. Al grabar una clave
 * nueva se pone esa marca, y todos los JWT anteriores dejan de valer de golpe.
 *
 * En archivos y no en una columna nueva, por lo mismo que los tokens de
 * recuperacion: una migracion que no corre deja el sistema roto en silencio, y
 * eso ya nos paso. Sin archivo, nada cambia; es decir, el dia que el disco no
 * este, el panel sigue funcionando como funcionaba.
 */

/** Carpeta de las marcas, fuera del alcance de una URL. */
function impDirSesiones() {
    // IMP_DIR_SESIONES solo lo define la bateria de tests.
    $dir = defined('IMP_DIR_SESIONES') ? IMP_DIR_SESIONES : __DIR__ . '/../.imporlan_sesiones';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    $htaccess = $dir . '/.htaccess';
    if (is_dir($dir) && !file_exists($htaccess)) {
        @file_put_contents($htaccess, "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    }
    return is_dir($dir) ? $dir : null;
}

/** El id de la cuenta se hashea para no dejar la lista de ids en el directorio. */
function impRutaSesiones($idCuenta) {
    $dir = impDirSesiones();
    $id = trim((string) $idCuenta);
    if (!$dir || $id === '') return null;
    return $dir . '/' . hash('sha256', 'cuenta:' . $id) . '.json';
}

/**
 * "Todo lo emitido antes de ahora deja de valer."
 *
 * Devuelve false si no se pudo escribir, para que quien llame pueda dejarlo en
 * el log: no es motivo para fallarle al cliente —su clave nueva ya quedo
 * guardada— pero si para que se sepa.
 */
function impInvalidarSesionesDe($idCuenta) {
    $ruta = impRutaSesiones($idCuenta);
    if (!$ruta) return false;
    $ok = @file_put_contents($ruta, json_encode([
        'desde'  => time(),
        'cuando' => date('Y-m-d H:i:s'),
    ]), LOCK_EX);
    if ($ok === false) return false;
    @chmod($ruta, 0600);
    return true;
}

/** El momento desde el que valen los tokens de esta cuenta. 0 = siempre valieron. */
function impSesionesInvalidasDesde($idCuenta) {
    $ruta = impRutaSesiones($idCuenta);
    if (!$ruta || !is_file($ruta)) return 0;
    $datos = json_decode((string) @file_get_contents($ruta), true);
    return is_array($datos) ? intval($datos['desde'] ?? 0) : 0;
}

/**
 * Si este payload de JWT ya no sirve porque la cuenta cambio de clave despues
 * de que se emitiera.
 *
 * La comparacion es estricta ('<'): un token emitido en el mismo segundo que
 * el cambio se deja pasar a proposito. Si fuera '<=', un cliente que cambia la
 * clave y entra en ese mismo segundo se encontraria con que su sesion recien
 * creada no vale. Al intruso no le sirve ese segundo: su token es de antes.
 */
function impTokenRevocado($payload) {
    if (!is_array($payload)) return false;
    $sub = $payload['sub'] ?? null;
    $iat = $payload['iat'] ?? null;
    // Sin iat no se puede saber si es anterior al cambio. Los tokens que emite
    // el panel siempre lo llevan (auth_local.php), asi que esto solo alcanza a
    // tokens de otra forma, y para esos se mantiene lo de antes.
    if ($sub === null || !is_numeric($iat)) return false;
    $desde = impSesionesInvalidasDesde($sub);
    return $desde > 0 && intval($iat) < $desde;
}
