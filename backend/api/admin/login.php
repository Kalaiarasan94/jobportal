<?php
/**
 * API: Admin Login
 * POST /api/admin/login.php
 *
 * Returns a shared-secret token that every other admin endpoint requires,
 * either as an X-Admin-Token header or a ?token= query parameter.
 */

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../../config/cors.php';

setCorsHeaders();

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Parse JSON body
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON payload']);
    exit;
}

$username = trim($input['username'] ?? '');
$password = trim($input['password'] ?? '');

// Verify credentials from environment variables
$adminUsername = getenv('ADMIN_USERNAME') ?: 'admin';
$adminPassword = getenv('ADMIN_PASSWORD') ?: 'hrpass123';

// hash_equals keeps the comparison timing-independent.
$ok = hash_equals($adminUsername, $username) && hash_equals($adminPassword, $password);

if ($ok) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Authenticated successfully',
        'token'   => adminToken()
    ]);
} else {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid username or password'
    ]);
}
