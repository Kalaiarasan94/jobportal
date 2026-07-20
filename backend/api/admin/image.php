<?php
/**
 * API: Serve a registration's uploaded image
 * GET /api/admin/image.php?id=123&field=payment|photo&token=...[&download=1]
 *
 * `field=payment` (default) returns the payment screenshot; `field=photo`
 * returns the profile photo. Inline unless `download` is set.
 */

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../../config/cors.php';

setCorsHeaders();
requireAdmin();

$id    = (int) ($_GET['id'] ?? 0);
$field = ($_GET['field'] ?? 'payment') === 'photo' ? 'photo' : 'payment';

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing registration id']);
    exit;
}

$fileCol = $field === 'photo' ? 'photo_file' : 'payment_file';
$mimeCol = $field === 'photo' ? 'photo_mime' : 'payment_mime';

try {
    $pdo  = getDBConnection();
    $stmt = $pdo->prepare("SELECT reg_no, full_name, {$fileCol} AS f, {$mimeCol} AS m FROM eps_registrations WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
} catch (PDOException $e) {
    error_log('EPS image lookup error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Lookup failed']);
    exit;
}

if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'Registration not found']);
    exit;
}

$cfg = appConfig();
// basename() keeps a tampered DB value from escaping the uploads directory.
$path = $cfg['upload_dir'] . '/' . basename($row['f']);

if (!$row['f'] || !is_file($path)) {
    http_response_code(404);
    echo json_encode(['error' => 'Image file is missing on the server']);
    exit;
}

$ext         = pathinfo($path, PATHINFO_EXTENSION);
$label       = $row['reg_no'] ?: ('REG' . $id);
$safeName    = preg_replace('/[^A-Za-z0-9]+/', '_', $row['full_name']);
$outName     = $label . '_' . $safeName . '_' . $field . '.' . $ext;
$disposition = isset($_GET['download']) ? 'attachment' : 'inline';

header('Content-Type: ' . ($row['m'] ?: 'application/octet-stream'));
header('Content-Disposition: ' . $disposition . '; filename="' . $outName . '"');
header('Content-Length: ' . filesize($path));
header('Cache-Control: private, max-age=300');

readfile($path);
