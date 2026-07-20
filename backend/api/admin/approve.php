<?php
/**
 * API: Approve a registration
 * POST /api/admin/approve.php   { "id": 123 }   (X-Admin-Token required)
 *
 * Allocates the next running registration number (EPS-<year>-001, -002, …),
 * marks the registration APPROVED (i.e. paid & confirmed) and stamps the time.
 * Idempotent: approving an already-approved row returns its existing number.
 */

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../../config/cors.php';

setCorsHeaders();
requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$id    = (int) ($input['id'] ?? 0);

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing registration id']);
    exit;
}

try {
    $pdo = getDBConnection();
    $pdo->beginTransaction();

    $sel = $pdo->prepare('SELECT id, reg_no, payment_status FROM eps_registrations WHERE id = ? FOR UPDATE');
    $sel->execute([$id]);
    $row = $sel->fetch();

    if (!$row) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Registration not found']);
        exit;
    }

    // Already approved — return the existing number.
    if ($row['payment_status'] === 'APPROVED' && $row['reg_no']) {
        $pdo->commit();
        echo json_encode([
            'success' => true,
            'message' => 'Already approved',
            'reg_no'  => $row['reg_no'],
        ]);
        exit;
    }

    // Next running number = current max sequence + 1 (locked above).
    $maxSeq = (int) $pdo->query('SELECT COALESCE(MAX(reg_seq), 0) AS m FROM eps_registrations')->fetch()['m'];
    $seq    = $maxSeq + 1;
    $regNo  = 'EPS-' . date('Y') . '-' . str_pad((string) $seq, 3, '0', STR_PAD_LEFT);

    $upd = $pdo->prepare(
        "UPDATE eps_registrations
            SET reg_no = ?, reg_seq = ?, payment_status = 'APPROVED', approved_at = NOW()
          WHERE id = ?"
    );
    $upd->execute([$regNo, $seq, $id]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Registration approved',
        'reg_no'  => $regNo,
    ]);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('EPS approve error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not approve the registration']);
}
