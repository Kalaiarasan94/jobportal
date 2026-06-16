<?php
/**
 * API: Download Applicants Excel
 * GET /api/admin/download-applicants.php
 * 
 * Replaces: app.get('/api/admin/download-applicants') from server.ts
 * Generates and downloads the master tracking spreadsheet (with City column)
 * 
 * NOTE: This uses CSV export instead of XLSX since PhpSpreadsheet requires Composer.
 * For production XLSX export, install PhpSpreadsheet via Composer.
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cors.php';

// Load env for CORS (still need it for DB connection)
setCorsHeaders();

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    $pdo = getDBConnection();

    $stmt = $pdo->query('SELECT * FROM job_applications ORDER BY submitted_at DESC');
    $rows = $stmt->fetchAll();

    $filename = getenv('EXCEL_FILENAME') ?: 'job_candidate_leads.csv';
    // Change extension to csv for native PHP export
    $filename = str_replace('.xlsx', '.csv', $filename);

    // Set headers for CSV download
    header('Content-Type: text/csv; charset=UTF-8');
    header("Content-Disposition: attachment; filename=\"{$filename}\"");
    // Override the JSON content type set by CORS
    header('Content-Type: text/csv; charset=UTF-8');

    $output = fopen('php://output', 'w');

    // Add BOM for Excel UTF-8 compatibility
    fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));

    // Column headers matching the Node.js ExcelJS columns
    fputcsv($output, [
        'APPLICANT ID',
        'CANDIDATE NAME',
        'EMAIL ID',
        'PHONE NUMBER',
        'CITY',
        'FULL ADDRESS',
        'QUALIFICATION & COLLEGE',
        'APPLIED TIMESTAMP'
    ]);

    // Write data rows
    foreach ($rows as $row) {
        fputcsv($output, [
            $row['id'],
            $row['full_name'],
            $row['email'],
            $row['phone'],
            $row['city'],
            $row['address'],
            $row['qualification_college'],
            $row['submitted_at']
        ]);
    }

    fclose($output);

} catch (PDOException $e) {
    error_log('MySQL Excel Export Error: ' . $e->getMessage());
    http_response_code(500);
    // Override CSV headers for error response
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['error' => 'Error generating export file']);
}
