<?php
/**
 * API: Excel export
 * GET /api/admin/export-excel.php?token=...
 *
 * Produces a styled .xlsx workbook of every registration. Falls back to CSV
 * on servers without the zip extension.
 */

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../lib/SimpleXlsx.php';

setCorsHeaders();
requireAdmin();

$cfg = appConfig();

try {
    $pdo  = getDBConnection();
    $rows = $pdo->query(
        'SELECT reg_no, full_name, phone, email, dob, address, payment_amount, payment_status, submitted_at
         FROM eps_registrations ORDER BY submitted_at DESC, id DESC'
    )->fetchAll();
} catch (PDOException $e) {
    error_log('EPS excel export error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Could not build the export']);
    exit;
}

$headers = [
    'S.NO', 'REGISTRATION NO', 'NAME', 'WHATSAPP NUMBER', 'MAIL ID',
    'DATE OF BIRTH', 'ADDRESS', 'AMOUNT PAID', 'PAYMENT STATUS', 'REGISTERED ON',
];

$fmtDate = fn(?string $d) => $d ? date('d M Y', strtotime($d)) : '';
$stamp   = date('d M Y, h:i A');
$base    = 'Malligai_EPS_Registrations_' . date('Y-m-d');

// ------------------------------------------------------- CSV fallback branch
if (!SimpleXlsx::isSupported()) {
    $flat = [];
    foreach ($rows as $i => $r) {
        $flat[] = [
            $i + 1, $r['reg_no'], $r['full_name'], $r['phone'], $r['email'],
            $fmtDate($r['dob']), $r['address'],
            number_format((float) $r['payment_amount'], 2),
            $r['payment_status'], $fmtDate($r['submitted_at']),
        ];
    }
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $base . '.csv"');
    echo SimpleXlsx::toCsv($headers, $flat);
    exit;
}

// ------------------------------------------------------------ styled workbook
$xlsx = new SimpleXlsx('EPS Registrations');
$xlsx->setColumnWidths([1 => 6, 2 => 19, 3 => 26, 4 => 18, 5 => 30, 6 => 15, 7 => 46, 8 => 13, 9 => 15, 10 => 20]);

$total     = count($rows);
$collected = array_sum(array_map(fn($r) => (float) $r['payment_amount'], $rows));

$xlsx->addRow([strtoupper($cfg['event_name'])], SimpleXlsx::S_TITLE, 40);
$xlsx->mergeLastRow(1, 10);

$xlsx->addRow([
    "Master registration report  •  Generated {$stamp}  •  {$total} registration(s)  •  "
    . 'Total collected Rs. ' . number_format($collected, 2),
], SimpleXlsx::S_SUBTITLE, 20);
$xlsx->mergeLastRow(1, 10);

$xlsx->addRow(['']);                                    // spacer
$xlsx->addRow($headers, SimpleXlsx::S_HEADER, 30);
$xlsx->freezeRows(4);

foreach ($rows as $i => $r) {
    $alt    = $i % 2 === 1;
    $body   = $alt ? SimpleXlsx::S_BODY_ALT   : SimpleXlsx::S_BODY;
    $center = $alt ? SimpleXlsx::S_CENTER_ALT : SimpleXlsx::S_CENTER;

    $xlsx->addRow([
        [$i + 1, $center],
        [$r['reg_no'], $center],
        [$r['full_name'], $body],
        [$r['phone'], $center],
        [$r['email'], $body],
        [$fmtDate($r['dob']), $center],
        [$r['address'], $body],
        ['Rs. ' . number_format((float) $r['payment_amount'], 2), $center],
        [$r['payment_status'], $center],
        [date('d M Y, h:i A', strtotime($r['submitted_at'])), $center],
    ], $body, 30);
}

if ($total === 0) {
    $xlsx->addRow(['No registrations recorded yet.'], SimpleXlsx::S_BODY, 24);
    $xlsx->mergeLastRow(1, 10);
}

$xlsx->addRow(['']);
$xlsx->addRow(["Total registrations: {$total}    |    Total collected: Rs. " . number_format($collected, 2)], SimpleXlsx::S_LABEL, 22);
$xlsx->mergeLastRow(1, 10);

$data = $xlsx->output();

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $base . '.xlsx"');
header('Content-Length: ' . strlen($data));
echo $data;
