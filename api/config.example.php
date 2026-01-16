<?php
/**
 * Configuración de APIs de Pago - Imporlan
 * Copy this file to config.php and fill in your credentials
 */

// Determinar el ambiente (cambiar a 'production' para producción)
define('PAYMENT_ENVIRONMENT', 'sandbox');

// ============================================
// PAYPAL CONFIGURATION
// ============================================

// Sandbox (Pruebas)
define('PAYPAL_SANDBOX_CLIENT_ID', 'your_sandbox_client_id');
define('PAYPAL_SANDBOX_SECRET', 'your_sandbox_secret');
define('PAYPAL_SANDBOX_URL', 'https://api-m.sandbox.paypal.com');

// Producción
define('PAYPAL_LIVE_CLIENT_ID', 'your_live_client_id');
define('PAYPAL_LIVE_SECRET', 'your_live_secret');
define('PAYPAL_LIVE_URL', 'https://api-m.paypal.com');

// Obtener credenciales según ambiente
function getPayPalConfig() {
    if (PAYMENT_ENVIRONMENT === 'production') {
        return [
            'client_id' => PAYPAL_LIVE_CLIENT_ID,
            'secret' => PAYPAL_LIVE_SECRET,
            'url' => PAYPAL_LIVE_URL
        ];
    }
    return [
        'client_id' => PAYPAL_SANDBOX_CLIENT_ID,
        'secret' => PAYPAL_SANDBOX_SECRET,
        'url' => PAYPAL_SANDBOX_URL
    ];
}

// ============================================
// MERCADOPAGO CONFIGURATION
// ============================================

define('MP_SANDBOX_ACCESS_TOKEN', 'your_sandbox_access_token');
define('MP_LIVE_ACCESS_TOKEN', 'your_live_access_token');

function getMercadoPagoConfig() {
    if (PAYMENT_ENVIRONMENT === 'production') {
        return ['access_token' => MP_LIVE_ACCESS_TOKEN];
    }
    return ['access_token' => MP_SANDBOX_ACCESS_TOKEN];
}
