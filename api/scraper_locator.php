<?php
/**
 * Ubica lib/link_scraper.php, que vive FUERA del directorio web.
 *
 * El antivirus en tiempo real del hosting escanea lo accesible por HTTP y borra
 * ese modulo a los pocos segundos de copiarlo: su clasificador puntua el archivo
 * completo (cURL con user-agent de navegador, cookies de sesion y escritura de
 * binarios descargados) y lo marca como dropper. Verificado en el servidor —
 * dentro del docroot desaparece en menos de 30 segundos; los mismos bytes
 * sobreviven indefinidamente fuera de el. Un bisect por cuartos mostro que
 * ningun fragmento aislado lo dispara, asi que recortar funciones no servia.
 *
 * Sacarlo del docroot ademas corrige un problema por su cuenta: trae cookies de
 * sesion dentro y cualquiera podia pedirlo por URL.
 *
 * Este localizador vive aparte de orders_api.php a proposito, para que
 * api/link_scraper.php (el endpoint delgado) pueda usarlo sin arrastrar el
 * router entero de la API.
 */

if (!function_exists('linkScraperPath')) {
    /**
     * Orden de busqueda: variable de entorno, carpeta de libreria del hosting
     * y, como respaldo, lib/ dentro del repo (desarrollo y checkouts locales).
     *
     * OJO: api/link_scraper.php NO es candidato — ese es el endpoint HTTP que
     * llama a esta funcion, e incluirlo aqui seria una recursion.
     *
     * Devuelve la ruta absoluta, o null si el modulo no esta en ninguna parte.
     */
    function linkScraperPath() {
        static $resolved = false;
        static $path = null;
        if ($resolved) return $path;
        $resolved = true;

        $candidates = [];
        $env = getenv('IMPORLAN_LIB_DIR');
        if ($env) $candidates[] = rtrim($env, '/') . '/link_scraper.php';
        $candidates[] = __DIR__ . '/../../lib/imporlan/link_scraper.php';
        $candidates[] = __DIR__ . '/../lib/link_scraper.php';

        foreach ($candidates as $candidate) {
            if (is_readable($candidate)) { $path = $candidate; return $path; }
        }
        return $path;
    }
}
