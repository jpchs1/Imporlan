<?php
/**
 * Retirado.
 *
 * Este archivo cambiaba la contrasena de CUALQUIER cuenta con solo mandar
 * {email, new_password}, sin sesion ni contrasena actual, contra un backend
 * de Fly.io que ya no existe. Se deja este stub en vez de borrarlo porque
 * el deploy de /test/api es un overlay: lo que no esta en el repositorio se
 * queda en el servidor tal cual.
 *
 * Cambiar la contrasena se hace desde el panel (api/auth/update-profile y
 * api/admin_profile.php) o con el enlace de recuperacion
 * (api/user_forgot_password.php).
 */
header('Content-Type: application/json');
http_response_code(410);
echo json_encode(['error' => 'Endpoint retirado']);
