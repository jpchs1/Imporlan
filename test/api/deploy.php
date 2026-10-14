<?php
/**
 * Deploy desde el espejo /test/api: retirado.
 *
 * Era una copia vieja de api/deploy.php, publicada en /test/api con cada
 * deploy, y podia desplegar a PRODUCCION (?env=prod) con un rsync --delete sin
 * las exclusiones de api/deploy.php: borraba en el servidor lo que no esta en
 * el repo — las sesiones cerradas (.imporlan_sesiones, con lo que un token
 * robado volvia a servir), api/logs con lo que se le ensena al contestador de
 * WhatsApp, los enlaces de recuperacion pendientes.
 *
 * Un espejo de pruebas no tiene por que poder tocar produccion. El deploy es
 * el cron (cron-deploy.sh -> deploy-prod.sh) o, a mano, /api/deploy.php.
 */

http_response_code(410);
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'success' => false,
    'error'   => 'Este endpoint se retiro. El deploy es automatico al mergear a main (o /api/deploy.php).',
]);
