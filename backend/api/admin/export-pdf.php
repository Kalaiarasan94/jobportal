<?php
/**
 * API: PDF export
 * GET /api/admin/export-pdf.php?token=...
 *
 * Branded landscape report of every registration: logo header, summary tiles,
 * zebra-striped table and page numbering.
 */

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../lib/SimplePdf.php';

setCorsHeaders();
requireAdmin();

$cfg  = appConfig();
$logo = __DIR__ . '/../../assets/logo.jpeg';

try {
    $pdo  = getDBConnection();
    $rows = $pdo->query(
        'SELECT reg_no, full_name, phone, email, dob, address, payment_amount, payment_status, submitted_at
         FROM eps_registrations ORDER BY submitted_at DESC, id DESC'
    )->fetchAll();
} catch (PDOException $e) {
    error_log('EPS pdf export error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Could not build the export']);
    exit;
}

// ------------------------------------------------------------------- palette
const NAVY   = '1B1B3A';
const BLUE   = '1B9AD6';
const TEAL   = '4FC3C0';
const ZEBRA  = 'F2F8FC';
const LINE   = 'DCE6F0';
const INK    = '243044';
const MUTED  = '7C8AA0';

$pdf = new SimplePdf('A4', 'L');
$W   = $pdf->pageWidth;
$H   = $pdf->pageHeight;
$M   = 36.0;                                   // page margin

// Column layout: [label, width, align]
$columns = [
    ['S.NO',       30,  'C'],
    ['REG NO',     88,  'C'],
    ['NAME',      120,  'L'],
    ['WHATSAPP',   85,  'C'],
    ['MAIL ID',   132,  'L'],
    ['DOB',        62,  'C'],
    ['ADDRESS',   157,  'L'],
    ['AMOUNT',     50,  'C'],
    ['STATUS',     45,  'C'],
];
$tableWidth = array_sum(array_column($columns, 1));

$total     = count($rows);
$collected = array_sum(array_map(fn($r) => (float) $r['payment_amount'], $rows));
$generated = date('d M Y, h:i A');
$rowHeight = 26.0;
$footerY   = $H - 46;

/** Draws the header chrome and returns the y at which the table body starts. */
$startPage = function (bool $first) use ($pdf, $W, $M, $logo, $cfg, $total, $collected, $generated, $columns) {
    $pdf->addPage();

    $bandH = $first ? 92.0 : 58.0;
    $pdf->rect(0, 0, $W, $bandH, NAVY);
    $pdf->rect(0, $bandH, $W * 0.55, 3.5, BLUE);
    $pdf->rect($W * 0.55, $bandH, $W * 0.45, 3.5, TEAL);

    // Logo sits on a white plate so the JCI mark keeps its own background.
    $logoH = $first ? 44.0 : 30.0;
    $logoW = $logoH * 2.33;
    $pdf->rect($M - 6, ($bandH - $logoH) / 2 - 5, $logoW + 12, $logoH + 10, 'FFFFFF');
    $pdf->image($logo, $M, ($bandH - $logoH) / 2, $logoW, $logoH);

    $textX = $M + $logoW + 22;
    if ($first) {
        $pdf->text($textX, 22, strtoupper($cfg['event_name']), 19, true, 'FFFFFF');
        $pdf->text($textX, 48, 'Master Registration Report', 10.5, false, 'A9BBD0');
        $pdf->text($textX, 63, 'Generated ' . $generated, 8.5, false, '7C8FA8');
    } else {
        $pdf->text($textX, 20, strtoupper($cfg['event_name']) . '  —  Master Registration Report', 12, true, 'FFFFFF');
    }

    $y = $bandH + 3.5;

    if ($first) {
        // Summary tiles.
        $y += 18;
        $tiles = [
            ['TOTAL REGISTRATIONS', (string) $total,                            BLUE],
            ['TOTAL COLLECTED',     'Rs. ' . number_format($collected, 2),       TEAL],
            ['REPORT DATE',         date('d M Y'),                               NAVY],
        ];
        $tileW = ($W - 2 * $M - 24) / 3;
        foreach ($tiles as $i => [$label, $value, $accent]) {
            $x = $M + $i * ($tileW + 12);
            $pdf->rect($x, $y, $tileW, 50, 'F6FAFD');
            $pdf->rect($x, $y, 3.5, 50, $accent);
            $pdf->text($x + 14, $y + 11, $label, 7.5, true, MUTED);
            $pdf->text($x + 14, $y + 25, $value, 15, true, NAVY);
        }
        $y += 50 + 22;
    } else {
        $y += 20;
    }

    // Table header band.
    $pdf->rect($M, $y, array_sum(array_column($columns, 1)), 22, NAVY);
    $cx = $M;
    foreach ($columns as [$label, $w, $align]) {
        $pdf->text($cx + 6, $y + 7, $label, 7.5, true, 'FFFFFF', $align, $w - 12);
        $cx += $w;
    }

    return $y + 22;
};

$fmtDate = fn(?string $d) => $d ? date('d M Y', strtotime($d)) : '-';

$y = $startPage(true);

foreach ($rows as $i => $r) {
    if ($y + $rowHeight > $footerY - 10) {
        $y = $startPage(false);
    }

    if ($i % 2 === 1) {
        $pdf->rect($M, $y, $tableWidth, $rowHeight, ZEBRA);
    }
    $pdf->line($M, $y + $rowHeight, $M + $tableWidth, $y + $rowHeight, LINE, 0.5);

    $values = [
        (string) ($i + 1),
        $r['reg_no'],
        $r['full_name'],
        $r['phone'],
        $r['email'],
        $fmtDate($r['dob']),
        $r['address'],
        'Rs. ' . number_format((float) $r['payment_amount'], 0),
        $r['payment_status'],
    ];

    $cx = $M;
    foreach ($columns as $c => [$label, $w, $align]) {
        $inner = $w - 12;
        $value = (string) $values[$c];

        if ($label === 'ADDRESS') {
            // The one field worth wrapping — two lines, then ellipsis.
            $lines = $pdf->wrap($value, 6.8, $inner);
            $shown = array_slice($lines, 0, 2);
            if (count($lines) > 2) {
                $shown[1] = $pdf->fit($shown[1] . ' ' . $lines[2], 6.8, $inner);
            }
            $ty = $y + ($rowHeight - count($shown) * 9) / 2;
            foreach ($shown as $line) {
                $pdf->text($cx + 6, $ty, $line, 6.8, false, INK, 'L', $inner);
                $ty += 9;
            }
        } elseif ($label === 'STATUS') {
            $pdf->rect($cx + 6, $y + 7.5, $inner, 12, strtoupper($value) === 'PAID' ? 'E4F7F0' : 'FDECEC');
            $pdf->text(
                $cx + 6, $y + 10, strtoupper($value), 7, true,
                strtoupper($value) === 'PAID' ? '1B8A6B' : 'C0392B', 'C', $inner
            );
        } else {
            $size = $label === 'REG NO' ? 7.2 : 7.6;
            $bold = in_array($label, ['NAME', 'AMOUNT'], true);
            $pdf->text(
                $cx + 6, $y + ($rowHeight - $size * 1.2) / 2,
                $pdf->fit($value, $size, $inner, $bold),
                $size, $bold, $label === 'NAME' ? NAVY : INK, $align, $inner
            );
        }
        $cx += $w;
    }

    $y += $rowHeight;
}

if ($total === 0) {
    $pdf->text($M, $y + 24, 'No registrations recorded yet.', 11, false, MUTED, 'C', $tableWidth);
}

// Footers, added once the total page count is known.
for ($p = 0; $p < $pdf->pageCount(); $p++) {
    // Re-target the content stream of page $p by appending through a fresh call.
    $pdf->setPage($p);
    $pdf->line($M, $footerY, $W - $M, $footerY, LINE, 0.6);
    $pdf->text($M, $footerY + 8, $cfg['org_name'] . '  |  Confidential registration data', 7.5, false, MUTED);
    $pdf->text(
        $M, $footerY + 8, 'Page ' . ($p + 1) . ' of ' . $pdf->pageCount(),
        7.5, false, MUTED, 'R', $W - 2 * $M
    );
}

$data = $pdf->output();

header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="Malligai_EPS_Registrations_' . date('Y-m-d') . '.pdf"');
header('Content-Length: ' . strlen($data));
echo $data;
