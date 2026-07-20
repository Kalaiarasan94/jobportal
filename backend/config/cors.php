<?php
/**
 * CORS Headers Handler
 * Replaces the Node.js cors() middleware
 */

function setCorsHeaders(): void {
    $allowedOrigins = getenv('CORS_ALLOWED_ORIGINS') ?: '*';
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($allowedOrigins === '*') {
        header('Access-Control-Allow-Origin: *');
    } else {
        $origins = array_map('trim', explode(',', $allowedOrigins));
        if (in_array($origin, $origins)) {
            header("Access-Control-Allow-Origin: {$origin}");
        } else {
            // Allow in development mode
            if (getenv('APP_ENV') === 'development') {
                header('Access-Control-Allow-Origin: *');
            }
        }
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

    // Reflect whatever custom headers the browser asks for in its preflight
    // (e.g. X-Admin-Token) so we never have to keep this list in sync.
    $requested = $_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] ?? '';
    $allowHeaders = $requested !== ''
        ? $requested
        : 'Content-Type, Authorization, X-Requested-With, X-Admin-Token';
    header('Access-Control-Allow-Headers: ' . $allowHeaders);

    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 600');
    header('Content-Type: application/json; charset=UTF-8');

    // Handle preflight OPTIONS requests
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}
