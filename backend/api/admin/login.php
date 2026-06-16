<?php
/**
 * API: Admin Login
 * POST /api/admin/login.php
 * 
 * Replaces: app.post('/api/admin/login') from server.ts
 * Handles secure admin credentials verification
 */

require_once __DIR__ . '/../../config/database.php';
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

if ($username === $adminUsername && $password === $adminPassword) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Authenticated successfully'
    ]);
} else {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid username or password'
    ]);
}
