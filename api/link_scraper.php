<?php
/**
 * Link Scraper API - Imporlan
 * Endpoint HTTP para extraer metadatos de anuncios de embarcaciones.
 *
 * Endpoints:
 * - GET ?action=fetch&url=ENCODED_URL
 *
 * Aqui solo vive la capa HTTP. El scraper de verdad esta en lib/link_scraper.php,
 * fuera del directorio web, porque el antivirus en tiempo real del hosting borra
 * ese archivo a los ~30 segundos de aparecer en una ruta accesible por HTTP.
 * Ver linkScraperPath() en orders_api.php para el orden de busqueda.
 *
 * Mantener este archivo chico y sin cURL es intencional: es lo que lo hace
 * indistinguible de cualquier otro endpoint y lo deja fuera del radar del
 * clasificador, que puntua el archivo completo.
 */

require_once __DIR__ . '/auth_helper.php';
require_once __DIR__ . '/scraper_locator.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'fetch':
        requireAdminAuthShared();

        $scraper = linkScraperPath();
        if (!$scraper) {
            http_response_code(503);
            echo json_encode([
                'error' => 'El modulo de scraping no esta instalado en el servidor. '
                         . 'Debe estar en la carpeta de libreria fuera del directorio web.',
            ]);
            break;
        }

        // El modulo resuelve auth_helper.php, scraper_config.php y la carpeta de
        // imagenes a partir de esta constante, no de su propia ubicacion.
        if (!defined('IMPORLAN_API_DIR')) define('IMPORLAN_API_DIR', __DIR__);
        require_once $scraper;

        fetchLinkMetadata();
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida']);
}
