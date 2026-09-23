<?php
/**
 * PDF de cotización de Deckeva con el MISMO diseño que la autocotización de la
 * web (deckeva/wp-content/mu-plugins/deckeva-assets/pdf-cotizacion.php).
 *
 * Uso (desde la sesión de Claude, con el repo jpchs1/deckeva clonado):
 *   php render.php datos.json /home/user/deckeva > cotizacion.html
 *   node pdf.mjs cotizacion.html Cotizacion-Deckeva-XXXX.pdf
 *
 * datos.json sigue deckeva_pdf_cotizacion_datos_ejemplo() más los campos
 * opcionales de cotización manual: saludo, servicios[], forma_pago[],
 * servicios_incluidos, proximos_pasos[]. Ver ejemplo.json.
 *
 * El JSON y el PDF traen datos del cliente: se trabajan en el scratchpad y el
 * PDF viaja en la rama temporal de adjuntos, nunca a main.
 */
if ($argc < 3) { fwrite(STDERR, "uso: php render.php datos.json /ruta/al/repo/deckeva\n"); exit(1); }
$datos = json_decode(file_get_contents($argv[1]), true);
if (!is_array($datos)) { fwrite(STDERR, "datos.json inválido\n"); exit(1); }
// La plantilla corta si no está dentro de WordPress.
define('ABSPATH', __DIR__ . '/');
$assets = rtrim($argv[2], '/') . '/wp-content/mu-plugins/deckeva-assets';
require $assets . '/pdf-cotizacion.php';
echo deckeva_pdf_cotizacion_html($datos, $assets);
