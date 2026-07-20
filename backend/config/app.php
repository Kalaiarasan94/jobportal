<?php
/**
 * Application-wide constants for Malligai EPS Registration.
 * Values fall back to the .env file where one is provided.
 */

require_once __DIR__ . '/database.php'; // also loads .env

function appConfig(): array {
    return [
        'org_name'        => getenv('ORG_NAME') ?: 'Malligai EPS',
        'event_name'      => getenv('EVENT_NAME') ?: 'Malligai EPS Registration',
        'fee'             => (float) (getenv('REGISTRATION_FEE') ?: 250),
        'contact_phone'   => getenv('CONTACT_PHONE') ?: '+919876543210',
        'contact_whatsapp'=> getenv('CONTACT_WHATSAPP') ?: '919876543210',
        'upload_dir'      => __DIR__ . '/../uploads/payments',
        'max_upload_mb'   => (int) (getenv('MAX_UPLOAD_MB') ?: 8),
    ];
}

/** Shared secret handed to the admin UI on successful login. */
function adminToken(): string {
    $user = getenv('ADMIN_USERNAME') ?: 'admin';
    $pass = getenv('ADMIN_PASSWORD') ?: 'hrpass123';
    $salt = getenv('ADMIN_TOKEN_SALT') ?: 'malligai-eps';
    return hash('sha256', $user . '|' . $pass . '|' . $salt);
}

/**
 * Guard an admin endpoint. Accepts the token from the X-Admin-Token header
 * or a `token` query param (needed for plain <a href> download links).
 */
function requireAdmin(): void {
    $sent = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ($_GET['token'] ?? '');
    if (!hash_equals(adminToken(), (string) $sent)) {
        http_response_code(401);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        exit;
    }
}
