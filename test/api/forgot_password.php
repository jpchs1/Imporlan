<?php
/**
 * Retirado.
 *
 * Reseteaba contrasenas a traves de un backend de Fly.io que ya no existe
 * (con credenciales de administrador por defecto en fly_config.php). Se deja
 * este stub en vez de borrarlo porque el deploy de /test/api es un overlay:
 * lo que no esta en el repositorio se queda en el servidor tal cual.
 *
 * La recuperacion de contrasena vive en api/user_forgot_password.php.
 */
header('Content-Type: application/json');
http_response_code(410);
echo json_encode(['error' => 'Endpoint retirado']);
