<?php
/**
 * Credentials Configuration - Imporlan
 *
 * Centralizes all authentication credentials.
 * In production, these MUST be loaded from environment variables
 * or from a config file OUTSIDE the web root (e.g. /home/wwimpo/credentials_config.php).
 *
 * NEVER commit real passwords to version control.
 */

// Try to load credentials from file outside web root (cPanel)
$credentialsConfigFile = '/home/wwimpo/credentials_config.php';
if (file_exists($credentialsConfigFile)) {
    require_once $credentialsConfigFile;
}

// Fallback to environment variables - NO insecure defaults
if (!defined('IMPORLAN_ADMIN_EMAIL')) {
    define('IMPORLAN_ADMIN_EMAIL', getenv('IMPORLAN_ADMIN_EMAIL') ?: 'admin@imporlan.cl');
}
if (!defined('IMPORLAN_ADMIN_PASSWORD')) {
    $envPass = getenv('IMPORLAN_ADMIN_PASSWORD');
    if (!$envPass) {
        error_log('CRITICAL: IMPORLAN_ADMIN_PASSWORD not configured. Login will fail.');
    }
    define('IMPORLAN_ADMIN_PASSWORD', $envPass ?: bin2hex(random_bytes(32)));
}
if (!defined('IMPORLAN_SUPPORT_EMAIL')) {
    define('IMPORLAN_SUPPORT_EMAIL', getenv('IMPORLAN_SUPPORT_EMAIL') ?: 'soporte@imporlan.cl');
}
if (!defined('IMPORLAN_SUPPORT_PASSWORD')) {
    $envSupportPass = getenv('IMPORLAN_SUPPORT_PASSWORD');
    if (!$envSupportPass) {
        error_log('CRITICAL: IMPORLAN_SUPPORT_PASSWORD not configured. Login will fail.');
    }
    define('IMPORLAN_SUPPORT_PASSWORD', $envSupportPass ?: bin2hex(random_bytes(32)));
}
if (!defined('IMPORLAN_JWT_SECRET')) {
    $envJwt = getenv('IMPORLAN_JWT_SECRET');
    if (!$envJwt) {
        // Try to load or generate a persistent secret file so the secret
        // survives across requests (avoids "Token invalido" errors).
        $jwtSecretFile = __DIR__ . '/.jwt_secret';
        if (file_exists($jwtSecretFile)) {
            $envJwt = trim(file_get_contents($jwtSecretFile));
        }
        if (!$envJwt) {
            $envJwt = bin2hex(random_bytes(32));
            // Attempt to persist so all requests share the same secret
            @file_put_contents($jwtSecretFile, $envJwt);
            error_log('WARNING: IMPORLAN_JWT_SECRET not configured. Generated persistent secret at ' . $jwtSecretFile);
        }
    }
    define('IMPORLAN_JWT_SECRET', $envJwt);
}
