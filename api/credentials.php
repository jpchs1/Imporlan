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

/**
 * Load or auto-generate a persistent secret from a local file.
 * This avoids per-request random values that break JWT verification
 * across the two requests in a login flow (generate token + verify token).
 */
function _loadPersistentSecret(string $name, string $fileSuffix): string {
    // 1. Environment variable
    $val = getenv($name) ?: '';
    if ($val !== '') return $val;

    // 2. Persistent file inside api/ directory
    $file = __DIR__ . '/.' . $fileSuffix;
    if (file_exists($file)) {
        $val = trim(file_get_contents($file));
        if ($val !== '') return $val;
    }

    // 3. Generate, persist, and protect
    $val = bin2hex(random_bytes(32));
    $written = @file_put_contents($file, $val);
    if ($written !== false) {
        @chmod($file, 0600);
    }
    // Also try .htaccess to deny web access to secret files
    $htaccess = __DIR__ . '/.htaccess';
    if (!file_exists($htaccess) || strpos(file_get_contents($htaccess), '.jwt_secret') === false) {
        @file_put_contents($htaccess,
            "\n# Protect secret files\n<FilesMatch \"^\\.(jwt_secret|admin_password|support_password)$\">\n    Deny from all\n</FilesMatch>\n",
            FILE_APPEND
        );
    }
    error_log("WARNING: {$name} not configured. Generated persistent secret at {$file}");
    return $val;
}

// Fallback to environment variables - NO insecure defaults
if (!defined('IMPORLAN_ADMIN_EMAIL')) {
    define('IMPORLAN_ADMIN_EMAIL', getenv('IMPORLAN_ADMIN_EMAIL') ?: 'admin@imporlan.cl');
}
if (!defined('IMPORLAN_ADMIN_PASSWORD')) {
    define('IMPORLAN_ADMIN_PASSWORD', _loadPersistentSecret('IMPORLAN_ADMIN_PASSWORD', 'admin_password'));
}
if (!defined('IMPORLAN_SUPPORT_EMAIL')) {
    define('IMPORLAN_SUPPORT_EMAIL', getenv('IMPORLAN_SUPPORT_EMAIL') ?: 'soporte@imporlan.cl');
}
if (!defined('IMPORLAN_SUPPORT_PASSWORD')) {
    define('IMPORLAN_SUPPORT_PASSWORD', _loadPersistentSecret('IMPORLAN_SUPPORT_PASSWORD', 'support_password'));
}
if (!defined('IMPORLAN_JWT_SECRET')) {
    define('IMPORLAN_JWT_SECRET', _loadPersistentSecret('IMPORLAN_JWT_SECRET', 'jwt_secret'));
}
