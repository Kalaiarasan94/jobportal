<?php
/**
 * API: Register Candidate
 * POST /api/register-candidate.php
 * 
 * Replaces: app.post('/api/register-candidate') from server.ts
 * Saves candidate submissions with both merged address & separate city
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/cors.php';

setCorsHeaders();

// Temporarily enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Parse JSON body (replaces express.json() middleware)
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
    exit;
}

// Extract fields from request body
$full_name              = trim($input['full_name'] ?? '');
$email                  = trim($input['email'] ?? '');
$phone                  = trim($input['phone'] ?? '');
$city                   = trim($input['city'] ?? '');
$address                = trim($input['address'] ?? '');
$qualification_college  = trim($input['qualification_college'] ?? '');

// Basic validation
if (empty($full_name) || empty($email) || empty($phone)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Full name, email, and phone are required']);
    exit;
}

try {
    $pdo = getDBConnection();
    
    $stmt = $pdo->prepare(
        'INSERT INTO job_applications (full_name, email, phone, city, address, qualification_college) VALUES (?, ?, ?, ?, ?, ?)'
    );
    
    $stmt->execute([$full_name, $email, $phone, $city, $address, $qualification_college]);

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Application saved successfully'
    ]);
} catch (PDOException $e) {
    error_log('MySQL Insert Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Database error saving applicant'
    ]);
}
