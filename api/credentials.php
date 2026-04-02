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

// Fallback to environment variables, then to empty defaults that force configuration
if (!defined('IMPORLAN_ADMIN_EMAIL')) {
    define('IMPORLAN_ADMIN_EMAIL', getenv('IMPORLAN_ADMIN_EMAIL') ?: 'admin@imporlan.cl');
}
if (!defined('IMPORLAN_ADMIN_PASSWORD')) {
    $envPass = getenv('IMPORLAN_ADMIN_PASSWORD');
    if (!$envPass) {
        error_log('WARNING: IMPORLAN_ADMIN_PASSWORD not configured. Using insecure default.');
    }
    define('IMPORLAN_ADMIN_PASSWORD', $envPass ?: 'CHANGE_ME_IMMEDIATELY');
}
if (!defined('IMPORLAN_SUPPORT_EMAIL')) {
    define('IMPORLAN_SUPPORT_EMAIL', getenv('IMPORLAN_SUPPORT_EMAIL') ?: 'soporte@imporlan.cl');
}
if (!defined('IMPORLAN_SUPPORT_PASSWORD')) {
    $envSupportPass = getenv('IMPORLAN_SUPPORT_PASSWORD');
    if (!$envSupportPass) {
        error_log('WARNING: IMPORLAN_SUPPORT_PASSWORD not configured. Using insecure default.');
    }
    define('IMPORLAN_SUPPORT_PASSWORD', $envSupportPass ?: 'CHANGE_ME_IMMEDIATELY');
}
if (!defined('IMPORLAN_JWT_SECRET')) {
    $envJwt = getenv('IMPORLAN_JWT_SECRET');
    if (!$envJwt) {
        error_log('WARNING: IMPORLAN_JWT_SECRET not configured. Using insecure default.');
    }
    define('IMPORLAN_JWT_SECRET', $envJwt ?: 'CHANGE_ME_IMMEDIATELY_' . bin2hex(random_bytes(16)));
}
