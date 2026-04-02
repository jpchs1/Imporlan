<?php
/**
 * CORS Helper - Imporlan
 * Centralized CORS header management.
 * Restricts API access to trusted origins only.
 */

function setCorsHeadersSecure() {
    $allowedOrigins = [
        'https://imporlan.cl',
        'https://www.imporlan.cl',
        'http://localhost:3000',
        'http://localhost:5173',
    ];

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (in_array($origin, $allowedOrigins)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    } else {
        // Default to main domain for non-browser requests (curl, server-to-server)
        header('Access-Control-Allow-Origin: https://www.imporlan.cl');
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Email, X-User-Name');
    header('Access-Control-Max-Age: 86400');
}
