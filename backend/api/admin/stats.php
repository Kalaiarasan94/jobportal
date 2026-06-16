<?php
/**
 * API: Admin Dashboard Stats
 * GET /api/admin/stats.php
 * 
 * Replaces: app.get('/api/admin/stats') from server.ts
 * Returns metrics counts and the last 5 applicants for the dashboard feed
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cors.php';

setCorsHeaders();

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    $pdo = getDBConnection();

    // Get total submissions count
    $countStmt = $pdo->query('SELECT COUNT(*) as total FROM job_applications');
    $countResult = $countStmt->fetch();

    // Get last 5 applicants
    $latestStmt = $pdo->query(
        'SELECT full_name, email, submitted_at FROM job_applications ORDER BY submitted_at DESC LIMIT 5'
    );
    $latestResults = $latestStmt->fetchAll();

    echo json_encode([
        'totalSubmissions'    => (int) $countResult['total'],
        'recentApplications'  => $latestResults
    ]);
} catch (PDOException $e) {
    error_log('MySQL Stats Fetch Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database stats retrieval failed']);
}
