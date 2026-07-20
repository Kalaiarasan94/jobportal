<?php
/**
 * API: Registration ID card
 * GET /api/admin/idcard.php?id=123&token=...[&download=1]
 *
 * Renders a premium, branded PNG ID card (JCI mark, EPS registration heading,
 * gradient header/footer, a verified seal, a faint logo watermark and all the
 * registrant's details) sized for sharing straight into WhatsApp.
 */

require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../../config/cors.php';

setCorsHeaders();
requireAdmin();

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing registration id']);
    exit;
}

try {
    $pdo  = getDBConnection();
    $stmt = $pdo->prepare('SELECT * FROM eps_registrations WHERE id = ?');
    $stmt->execute([$id]);
    $reg = $stmt->fetch();
} catch (PDOException $e) {
    error_log('EPS idcard lookup error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Lookup failed']);
    exit;
}

if (!$reg) {
    http_response_code(404);
    echo json_encode(['error' => 'Registration not found']);
    exit;
}

// ID cards are only issued once a registration is approved (and numbered).
if ($reg['payment_status'] !== 'APPROVED' || empty($reg['reg_no'])) {
    http_response_code(403);
    echo json_encode(['error' => 'This registration is not approved yet. Approve it to generate the ID card.']);
    exit;
}

$cfg = appConfig();

// ---------------------------------------------------------------- typography
/** First readable font from each list wins; null falls back to GD bitmap text. */
function findFont(array $candidates): ?string
{
    foreach ($candidates as $path) {
        if (is_readable($path)) {
            return $path;
        }
    }
    return null;
}

$assetFonts = __DIR__ . '/../../assets/fonts/';
$fontBold = findFont([
    $assetFonts . 'Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/msttcorefonts/Arial_Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/Library/Fonts/Arial Bold.ttf',
]);
$fontRegular = findFont([
    $assetFonts . 'Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/Library/Fonts/Arial.ttf',
]) ?? $fontBold;
$fontBold ??= $fontRegular;

// ------------------------------------------------------------------- canvas
$CW = 780;
$CH = 1180;

$img = imagecreatetruecolor($CW, $CH);
imagealphablending($img, true);
imagesavealpha($img, false);
imageantialias($img, true);

$rgb = function (string $h): array {
    $h = ltrim($h, '#');
    return [
        (int) hexdec(substr($h, 0, 2)),
        (int) hexdec(substr($h, 2, 2)),
        (int) hexdec(substr($h, 4, 2)),
    ];
};

$hex = function (string $h) use ($img, $rgb) {
    [$r, $g, $b] = $rgb($h);
    return imagecolorallocate($img, $r, $g, $b);
};

$C = [
    'white'  => $hex('FFFFFF'),
    'navy'   => $hex('1B1B3A'),
    'navy2'  => $hex('26264E'),
    'blue'   => $hex('1B9AD6'),
    'teal'   => $hex('4FC3C0'),
    'gold'   => $hex('E9B949'),
    'ink'    => $hex('243044'),
    'muted'  => $hex('8593A8'),
    'line'   => $hex('E8EEF6'),
    'chipBg' => $hex('EAF4FB'),
    'payTop' => $hex('E9F9F3'),
    'payInk' => $hex('12805F'),
    'shade'  => $hex('F7FAFD'),
];

imagefilledrectangle($img, 0, 0, $CW, $CH, $C['white']);

// --------------------------------------------------------------- primitives

/** Vertical gradient fill between two hex colours. */
$vGradient = function (int $x, int $y, int $w, int $h, string $top, string $bottom) use ($img, $rgb) {
    [$r1, $g1, $b1] = $rgb($top);
    [$r2, $g2, $b2] = $rgb($bottom);
    for ($i = 0; $i < $h; $i++) {
        $t = $h <= 1 ? 0 : $i / ($h - 1);
        $col = imagecolorallocate(
            $img,
            (int) round($r1 + ($r2 - $r1) * $t),
            (int) round($g1 + ($g2 - $g1) * $t),
            (int) round($b1 + ($b2 - $b1) * $t)
        );
        imagefilledrectangle($img, $x, $y + $i, $x + $w, $y + $i, $col);
    }
};

/** Horizontal gradient fill. */
$hGradient = function (int $x, int $y, int $w, int $h, string $left, string $right) use ($img, $rgb) {
    [$r1, $g1, $b1] = $rgb($left);
    [$r2, $g2, $b2] = $rgb($right);
    for ($i = 0; $i < $w; $i++) {
        $t = $w <= 1 ? 0 : $i / ($w - 1);
        $col = imagecolorallocate(
            $img,
            (int) round($r1 + ($r2 - $r1) * $t),
            (int) round($g1 + ($g2 - $g1) * $t),
            (int) round($b1 + ($b2 - $b1) * $t)
        );
        imagefilledrectangle($img, $x + $i, $y, $x + $i, $y + $h, $col);
    }
};

/** Soft translucent glow blob (approximation of a radial gradient). */
$glow = function (int $cx, int $cy, int $radius, string $color, float $strength = 0.5) use ($img, $rgb) {
    [$r, $g, $b] = $rgb($color);
    $steps = 26;
    for ($i = $steps; $i > 0; $i--) {
        $rad = (int) ($radius * $i / $steps);
        $alpha = (int) (127 - (127 - 127 * (1 - $strength)) * 0 - ($strength * 110) * (1 - $i / $steps));
        $alpha = max(0, min(127, 127 - (int) ($strength * 90 * ($i / $steps))));
        $col = imagecolorallocatealpha($img, $r, $g, $b, $alpha);
        imagefilledellipse($img, $cx, $cy, $rad * 2, $rad * 2, $col);
    }
};

/** Rounded rectangle (optionally only the top or bottom corners). */
$roundRect = function (int $x, int $y, int $w, int $h, int $r, int $color, string $corners = 'all') use ($img) {
    $r = (int) min($r, floor($w / 2), floor($h / 2));
    imagefilledrectangle($img, $x + $r, $y, $x + $w - $r, $y + $h, $color);
    imagefilledrectangle($img, $x, $y + $r, $x + $w, $y + $h - $r, $color);
    $d = $r * 2;
    $top = $corners === 'all' || $corners === 'top';
    $bot = $corners === 'all' || $corners === 'bottom';
    if ($top) {
        imagefilledellipse($img, $x + $r, $y + $r, $d, $d, $color);
        imagefilledellipse($img, $x + $w - $r, $y + $r, $d, $d, $color);
    } else {
        imagefilledrectangle($img, $x, $y, $x + $r, $y + $r, $color);
        imagefilledrectangle($img, $x + $w - $r, $y, $x + $w, $y + $r, $color);
    }
    if ($bot) {
        imagefilledellipse($img, $x + $r, $y + $h - $r, $d, $d, $color);
        imagefilledellipse($img, $x + $w - $r, $y + $h - $r, $d, $d, $color);
    } else {
        imagefilledrectangle($img, $x, $y + $h - $r, $x + $r, $y + $h, $color);
        imagefilledrectangle($img, $x + $w - $r, $y + $h - $r, $x + $w, $y + $h, $color);
    }
};

$textWidth = function (string $text, float $size, ?string $font): float {
    if ($font === null) {
        return strlen($text) * 9;
    }
    $box = imagettfbbox($size, 0, $font, $text);
    return abs($box[2] - $box[0]);
};

/** Draw text; $y is the TOP of the line, $align resolves in [$x, $x+$boxWidth]. */
$text = function (
    string $str,
    int $x,
    int $y,
    float $size,
    int $color,
    bool $bold = false,
    string $align = 'L',
    ?int $boxWidth = null,
    float $tracking = 0
) use ($img, $fontBold, $fontRegular, $textWidth) {
    $font = $bold ? $fontBold : $fontRegular;

    if ($tracking > 0 && $font !== null) {
        // Manual letter spacing for small uppercase labels.
        $chars = preg_split('//u', $str, -1, PREG_SPLIT_NO_EMPTY);
        $total = 0;
        foreach ($chars as $ch) {
            $total += $textWidth($ch, $size, $font) + $tracking;
        }
        $total -= $tracking;
        if ($boxWidth !== null && $align !== 'L') {
            $x += (int) ($align === 'C' ? ($boxWidth - $total) / 2 : $boxWidth - $total);
        }
        $cx = $x;
        foreach ($chars as $ch) {
            imagettftext($img, $size, 0, $cx, (int) round($y + $size), $color, $font, $ch);
            $cx += (int) round($textWidth($ch, $size, $font) + $tracking);
        }
        return;
    }

    if ($boxWidth !== null && $align !== 'L') {
        $tw = $textWidth($str, $size, $font);
        $x += (int) ($align === 'C' ? ($boxWidth - $tw) / 2 : $boxWidth - $tw);
    }
    if ($font === null) {
        imagestring($img, 5, $x, $y, $str, $color);
        return;
    }
    imagettftext($img, $size, 0, $x, (int) round($y + $size), $color, $font, $str);
};

/** Load an image file into a GD resource, or null if unreadable. */
$loadImage = function (string $path) {
    if (!is_readable($path)) {
        return null;
    }
    $info = @getimagesize($path);
    if ($info === false) {
        return null;
    }
    return match ($info[2]) {
        IMAGETYPE_JPEG => @imagecreatefromjpeg($path),
        IMAGETYPE_PNG  => @imagecreatefrompng($path),
        IMAGETYPE_GIF  => @imagecreatefromgif($path),
        IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : null,
        default        => null,
    } ?: null;
};

/** Draw a source image cover-cropped into a circle centred at ($cx,$cy). */
$circleImage = function ($src, int $cx, int $cy, int $r) use ($img) {
    $sw = imagesx($src);
    $sh = imagesy($src);
    $d  = $r * 2;
    $scale = max($d / $sw, $d / $sh);
    $nw = (int) ceil($sw * $scale);
    $nh = (int) ceil($sh * $scale);
    $resized = imagecreatetruecolor($nw, $nh);
    imagecopyresampled($resized, $src, 0, 0, 0, 0, $nw, $nh, $sw, $sh);
    $ox = (int) (($nw - $d) / 2);
    $oy = (int) (($nh - $d) / 2);
    $r2 = $r * $r;
    for ($yy = 0; $yy < $d; $yy++) {
        for ($xx = 0; $xx < $d; $xx++) {
            $dx = $xx - $r;
            $dy = $yy - $r;
            if ($dx * $dx + $dy * $dy <= $r2) {
                imagesetpixel($img, $cx - $r + $xx, $cy - $r + $yy, imagecolorat($resized, $xx + $ox, $yy + $oy));
            }
        }
    }
    imagedestroy($resized);
};

$wrap = function (string $str, float $size, int $maxWidth, bool $bold = false) use ($fontBold, $fontRegular, $textWidth) {
    $font  = $bold ? $fontBold : $fontRegular;
    $lines = [];
    $line  = '';
    foreach (preg_split('/\s+/', trim($str)) as $word) {
        $candidate = $line === '' ? $word : $line . ' ' . $word;
        if ($textWidth($candidate, $size, $font) <= $maxWidth || $line === '') {
            $line = $candidate;
        } else {
            $lines[] = $line;
            $line = $word;
        }
    }
    if ($line !== '') {
        $lines[] = $line;
    }
    return $lines;
};

// --------------------------------------------------------- outer frame band
// A thin brand gradient border around the whole card.
$hGradient(0, 0, $CW, $CH, '1B9AD6', '4FC3C0');
$pad = 10;
imagefilledrectangle($img, $pad, $pad, $CW - $pad, $CH - $pad, $C['white']);

$inX = $pad;
$inW = $CW - 2 * $pad;

// -------------------------------------------------------------------- header
$headerTop = $pad;
$headerH   = 288;
$vGradient($inX, $headerTop, $inW, $headerH, '242456', '141430');

// Ambient glows.
$glow($inX + 90, $headerTop + 60, 150, '1B9AD6', 0.5);
$glow($inX + $inW - 70, $headerTop + $headerH - 30, 160, '4FC3C0', 0.45);

// Faint concentric shield rings, top-right.
$ringCol = imagecolorallocatealpha($img, 255, 255, 255, 116);
for ($i = 0; $i < 5; $i++) {
    imageellipse($img, $inX + $inW - 40, $headerTop + 46, 120 + $i * 40, 120 + $i * 40, $ringCol);
}

// White logo plate.
$plateW = 340;
$plateH = 140;
$plateX = (int) ($inX + ($inW - $plateW) / 2);
$plateY = $headerTop + 34;
// soft shadow
$roundRect($plateX + 4, $plateY + 6, $plateW, $plateH, 20, imagecolorallocatealpha($img, 0, 0, 0, 100));
$roundRect($plateX, $plateY, $plateW, $plateH, 20, $C['white']);

$logoPath = __DIR__ . '/../../assets/logo.jpeg';
if (is_readable($logoPath) && ($logo = @imagecreatefromjpeg($logoPath))) {
    $lw = imagesx($logo);
    $lh = imagesy($logo);
    $scale = min(($plateW - 46) / $lw, ($plateH - 36) / $lh);
    $dw = (int) ($lw * $scale);
    $dh = (int) ($lh * $scale);
    imagecopyresampled(
        $img, $logo,
        $plateX + (int) (($plateW - $dw) / 2), $plateY + (int) (($plateH - $dh) / 2),
        0, 0, $dw, $dh, $lw, $lh
    );
    imagedestroy($logo);
}

$text('EPS REGISTRATION', $inX, $plateY + $plateH + 20, 27, $C['white'], true, 'C', $inW, 2);
$text(strtoupper($cfg['org_name']) . '   •   OFFICIAL ID CARD', $inX, $plateY + $plateH + 58, 11, $hex('9FB2CF'), true, 'C', $inW);

// Accent stripe with a thin gold divider.
$stripeY = $headerTop + $headerH;
$hGradient($inX, $stripeY, $inW, 10, '1B9AD6', '4FC3C0');
imagefilledrectangle($img, $inX, $stripeY - 2, $inX + $inW, $stripeY - 1, $C['gold']);

// ------------------------------------------------------- faint logo watermark
// Stamped low-opacity into the body so the card never looks empty.
if (is_readable($logoPath) && ($wm = @imagecreatefromjpeg($logoPath))) {
    $wmW = 520;
    $wmH = (int) ($wmW * imagesy($wm) / imagesx($wm));
    $tmp = imagecreatetruecolor($wmW, $wmH);
    imagefill($tmp, 0, 0, imagecolorallocate($tmp, 255, 255, 255));
    imagecopyresampled($tmp, $wm, 0, 0, 0, 0, $wmW, $wmH, imagesx($wm), imagesy($wm));
    imagecopymerge($img, $tmp, $inX + (int) (($inW - $wmW) / 2), 640, 0, 0, $wmW, $wmH, 5);
    imagedestroy($tmp);
    imagedestroy($wm);
}

// ------------------------------------------------- profile photo + identity
$padX   = $inX + 54;
$fieldW = $inW - 108;

$bandTop = $stripeY + 34;
$pr      = 78;                       // photo radius
$pcx     = $padX + $pr;
$pcy     = $bandTop + $pr;

// White plate + teal ring behind the photo.
imagefilledellipse($img, $pcx, $pcy, ($pr + 11) * 2, ($pr + 11) * 2, $C['white']);
imagefilledellipse($img, $pcx, $pcy, ($pr + 6) * 2, ($pr + 6) * 2, $C['teal']);

$photoPath = $cfg['upload_dir'] . '/' . basename($reg['photo_file'] ?? '');
$photoSrc  = $loadImage($photoPath);
if ($photoSrc) {
    $circleImage($photoSrc, $pcx, $pcy, $pr);
    imagedestroy($photoSrc);
} else {
    // Placeholder: initials on a navy disc when the photo can't be rendered.
    imagefilledellipse($img, $pcx, $pcy, $pr * 2, $pr * 2, $C['navy2']);
    $initials = '';
    foreach (preg_split('/\s+/', trim($reg['full_name'])) as $part) {
        if ($part !== '') {
            $initials .= strtoupper($part[0]);
        }
        if (strlen($initials) >= 2) {
            break;
        }
    }
    $text($initials ?: 'EPS', $pcx - $pr, $pcy - 26, 44, $C['white'], true, 'C', $pr * 2);
}

// Small verified badge on the photo's lower-right.
$bcx = (int) ($pcx + $pr * 0.68);
$bcy = (int) ($pcy + $pr * 0.68);
imagefilledellipse($img, $bcx, $bcy, 48, 48, $C['white']);
imagefilledellipse($img, $bcx, $bcy, 38, 38, $C['payInk']);
imagefilledpolygon($img, [
    $bcx - 10, $bcy + 0,
    $bcx - 3,  $bcy + 7,
    $bcx + 10, $bcy - 8,
    $bcx + 14, $bcy - 4,
    $bcx - 3,  $bcy + 13,
    $bcx - 14, $bcy + 2,
], 6, $C['white']);

// Right column: registration number pill + name.
$rx = $pcx + $pr + 34;
$rw = $inX + $inW - 54 - $rx;

$text('REGISTRATION NUMBER', $rx, $bandTop + 4, 9, $C['muted'], true, 'L', null, 1);
$regTextW = (int) $textWidth($reg['reg_no'], 18, $fontBold);
$pillW    = min($rw, $regTextW + 40);
$roundRect($rx, $bandTop + 20, $pillW, 42, 21, $C['chipBg']);
$roundRect($rx, $bandTop + 20, 8, 42, 4, $C['blue']);
$text($reg['reg_no'], $rx + 22, $bandTop + 31, 18, $C['blue'], true);

$nameSize = 30.0;
while ($textWidth($reg['full_name'], $nameSize, $fontBold) > $rw && $nameSize > 15) {
    $nameSize -= 1.0;
}
$text($reg['full_name'], $rx, $bandTop + 82, $nameSize, $C['navy'], true);
$hGradient($rx, $bandTop + 84 + (int) $nameSize + 10, 120, 4, '1B9AD6', '4FC3C0');

// ------------------------------------------------------------------- details
$y       = $bandTop + $pr * 2 + 34;
$fmtDate = fn(?string $d) => $d ? date('d M Y', strtotime($d)) : '-';

$fields = [
    ['WHATSAPP NUMBER', $reg['phone']],
    ['MAIL ID',         $reg['email']],
    ['DATE OF BIRTH',   $fmtDate($reg['dob'])],
    ['ADDRESS',         $reg['address']],
];

foreach ($fields as [$label, $value]) {
    // little brand tick before each label
    $roundRect($padX, $y + 2, 4, 12, 2, $C['blue']);
    $text($label, $padX + 14, $y, 10.5, $C['muted'], true, 'L', null, 1.5);

    $lines = array_slice($wrap((string) $value, 17, $fieldW), 0, 3);
    $ly = $y + 22;
    foreach ($lines as $line) {
        $text($line, $padX + 14, $ly, 17, $C['ink'], false);
        $ly += 26;
    }
    $y = $ly + 16;
    imagefilledrectangle($img, $padX, $y - 8, $inX + $inW - 54, $y - 7, $C['line']);
}

// ------------------------------------------------------------------- payment
$payY = max($y + 14, 858);
$payH = 118;
$vGradient($padX, $payY, $fieldW, $payH, 'EAFAF2', 'DFF6EC');
$roundRect($padX, $payY, $fieldW, $payH, 20, $C['payTop']);            // rounds corners
$vGradient($padX, $payY, 8, $payH, '2FB08A', '12805F');                // accent bar left is overwritten below
$roundRect($padX, $payY, 8, $payH, 4, $C['payInk']);

$text('PAYMENT RECEIVED', $padX + 30, $payY + 24, 10.5, $C['payInk'], true, 'L', null, 1.5);
$text('Rs. ' . number_format((float) $reg['payment_amount'], 2), $padX + 30, $payY + 48, 30, $C['payInk'], true);

$badgeW = 122;
$badgeX = $inX + $inW - 54 - 30 - $badgeW;
$roundRect($badgeX, $payY + 40, $badgeW, 42, 21, $C['payInk']);
$text('PAID', $badgeX, $payY + 51, 15, $C['white'], true, 'C', $badgeW, 2);

// -------------------------------------------------------------------- footer
$footerH = 96;
$footerY = $CH - $pad - $footerH;
$vGradient($inX, $footerY, $inW, $footerH, '242456', '141430');
$hGradient($inX, $footerY - 6, $inW, 6, '4FC3C0', '1B9AD6');
$glow($inX + $inW - 60, $footerY + $footerH, 120, '1B9AD6', 0.4);

$text($cfg['event_name'], $padX, $footerY + 26, 15, $C['white'], true);
$text(
    'Registered on ' . date('d M Y', strtotime($reg['submitted_at'])),
    $padX, $footerY + 52, 11, $hex('9FB2CF')
);
$text('MALLIGAI', $inX, $footerY + 26, 13, $hex('4FC3C0'), true, 'R', $inW - 54, 2);
$text('EPS', $inX, $footerY + 46, 13, $hex('9FB2CF'), true, 'R', $inW - 54, 4);

// --------------------------------------------------------------------- send
$safeName = preg_replace('/[^A-Za-z0-9]+/', '_', $reg['full_name']);
$fileName = $reg['reg_no'] . '_' . $safeName . '_EPS_IDCard.png';

header('Content-Type: image/png');
header('Content-Disposition: ' . (isset($_GET['download']) ? 'attachment' : 'inline') . '; filename="' . $fileName . '"');
header('Cache-Control: private, max-age=120');

imagepng($img, null, 6);
imagedestroy($img);
