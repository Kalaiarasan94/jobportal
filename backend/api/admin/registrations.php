<?php
/**
 * API: Registrations list + dashboard summary
 * GET /api/admin/registrations.php[?search=&status=&limit=&offset=]
 */

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../../config/cors.php';

setCorsHeaders();
requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$search = trim($_GET['search'] ?? '');
$status = strtoupper(trim($_GET['status'] ?? ''));
$limit  = min(max((int) ($_GET['limit'] ?? 300), 1), 1000);
$offset = max((int) ($_GET['offset'] ?? 0), 0);

try {
    $pdo = getDBConnection();

    $conds  = [];
    $params = [];
    if ($search !== '') {
        $conds[] = '(full_name LIKE ? OR phone LIKE ? OR email LIKE ? OR reg_no LIKE ?)';
        $like    = '%' . $search . '%';
        array_push($params, $like, $like, $like, $like);
    }
    if (in_array($status, ['PENDING', 'APPROVED'], true)) {
        $conds[] = 'payment_status = ?';
        $params[] = $status;
    }
    $where = $conds ? 'WHERE ' . implode(' AND ', $conds) : '';

    $countStmt = $pdo->prepare("SELECT COUNT(*) AS total FROM eps_registrations {$where}");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetch()['total'];

    $listStmt = $pdo->prepare(
        "SELECT id, reg_no, reg_seq, full_name, phone, email, dob, address,
                photo_file, payment_file, payment_amount, payment_status,
                submitted_at, approved_at
         FROM eps_registrations {$where}
         ORDER BY (payment_status = 'PENDING') DESC, submitted_at DESC, id DESC
         LIMIT {$limit} OFFSET {$offset}"
    );
    $listStmt->execute($params);
    $rows = $listStmt->fetchAll();

    // Global counters (independent of the current filter).
    $counts = $pdo->query(
        "SELECT
            COUNT(*) AS total,
            SUM(payment_status = 'PENDING')  AS pending,
            SUM(payment_status = 'APPROVED') AS approved,
            COALESCE(SUM(CASE WHEN payment_status = 'APPROVED' THEN payment_amount ELSE 0 END), 0) AS collected
         FROM eps_registrations"
    )->fetch();

    echo json_encode([
        'total'         => $total,
        'pending'       => (int) $counts['pending'],
        'approved'      => (int) $counts['approved'],
        'collected'     => (float) $counts['collected'],
        'allTotal'      => (int) $counts['total'],
        'registrations' => $rows,
    ]);
} catch (PDOException $e) {
    error_log('EPS list error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Could not load registrations']);
}
