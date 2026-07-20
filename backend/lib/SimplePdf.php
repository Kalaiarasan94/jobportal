<?php
/**
 * SimplePdf — a tiny dependency-free PDF writer.
 *
 * Supports exactly what the Malligai EPS reports need: coloured rectangles,
 * lines, Helvetica text (regular/bold, left/centre/right aligned) and embedded
 * JPEG images. No Composer, no external libraries.
 *
 * All coordinates are in points with the origin at the TOP-LEFT of the page
 * (PDF's native bottom-left origin is handled internally).
 */
class SimplePdf
{
    private const W_HELV = '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584';
    private const W_BOLD = '278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584';

    public float $pageWidth;
    public float $pageHeight;

    /** @var string[] content stream per page */
    private array $pages = [];
    private int $current = -1;
    /** @var array<int,array{data:string,w:int,h:int}> */
    private array $images = [];
    private array $widthsRegular;
    private array $widthsBold;

    public function __construct(string $size = 'A4', string $orientation = 'P')
    {
        $dims = ['A4' => [595.28, 841.89], 'A5' => [419.53, 595.28]];
        [$w, $h] = $dims[$size] ?? $dims['A4'];
        if (strtoupper($orientation) === 'L') {
            [$w, $h] = [$h, $w];
        }
        $this->pageWidth  = $w;
        $this->pageHeight = $h;
        $this->widthsRegular = array_map('floatval', explode(',', self::W_HELV));
        $this->widthsBold    = array_map('floatval', explode(',', self::W_BOLD));
    }

    public function addPage(): void
    {
        $this->pages[] = '';
        $this->current = count($this->pages) - 1;
    }

    public function pageCount(): int
    {
        return count($this->pages);
    }

    /**
     * Re-target drawing at an already-created page (0-indexed). Useful for
     * footers that need the final page count before they can be written.
     */
    public function setPage(int $index): void
    {
        if ($index >= 0 && $index < count($this->pages)) {
            $this->current = $index;
        }
    }

    /** Filled rectangle. */
    public function rect(float $x, float $y, float $w, float $h, string $hex): void
    {
        [$r, $g, $b] = $this->rgb($hex);
        $this->put(sprintf(
            '%.3f %.3f %.3f rg %.2f %.2f %.2f %.2f re f',
            $r, $g, $b, $x, $this->flip($y) - $h, $w, $h
        ));
    }

    /** Straight line. */
    public function line(float $x1, float $y1, float $x2, float $y2, string $hex, float $width = 0.6): void
    {
        [$r, $g, $b] = $this->rgb($hex);
        $this->put(sprintf(
            '%.3f %.3f %.3f RG %.2f w %.2f %.2f m %.2f %.2f l S',
            $r, $g, $b, $width, $x1, $this->flip($y1), $x2, $this->flip($y2)
        ));
    }

    /**
     * Draw a line of text. $y is the TOP of the text box.
     * $align is L, C or R and is resolved inside [$x, $x + $boxWidth].
     */
    public function text(
        float $x,
        float $y,
        string $str,
        float $size = 10,
        bool $bold = false,
        string $hex = '000000',
        string $align = 'L',
        ?float $boxWidth = null
    ): void {
        $str = $this->sanitize($str);
        if ($str === '') {
            return;
        }
        if ($boxWidth !== null && $align !== 'L') {
            $tw = $this->textWidth($str, $size, $bold);
            $x += $align === 'C' ? ($boxWidth - $tw) / 2 : $boxWidth - $tw;
        }
        [$r, $g, $b] = $this->rgb($hex);
        $baseline = $this->flip($y + $size * 0.80);
        $this->put(sprintf(
            'BT /%s %.2f Tf %.3f %.3f %.3f rg %.2f %.2f Td (%s) Tj ET',
            $bold ? 'F2' : 'F1', $size, $r, $g, $b, $x, $baseline, $this->escape($str)
        ));
    }

    /** Width of a string in points at the given size. */
    public function textWidth(string $str, float $size, bool $bold = false): float
    {
        $table = $bold ? $this->widthsBold : $this->widthsRegular;
        $total = 0.0;
        $len = strlen($str);
        for ($i = 0; $i < $len; $i++) {
            $code = ord($str[$i]);
            $total += ($code >= 32 && $code <= 126) ? $table[$code - 32] : 556;
        }
        return $total * $size / 1000;
    }

    /** Break a string into lines that fit $maxWidth. Returns the line array. */
    public function wrap(string $str, float $size, float $maxWidth, bool $bold = false): array
    {
        $str = $this->sanitize($str);
        $lines = [];
        foreach (preg_split('/\r\n|\r|\n/', $str) as $paragraph) {
            $line = '';
            foreach (explode(' ', $paragraph) as $word) {
                $candidate = $line === '' ? $word : $line . ' ' . $word;
                if ($this->textWidth($candidate, $size, $bold) <= $maxWidth || $line === '') {
                    $line = $candidate;
                } else {
                    $lines[] = $line;
                    $line = $word;
                }
            }
            $lines[] = $line;
        }
        return $lines;
    }

    /** Truncate with an ellipsis so the string fits $maxWidth. */
    public function fit(string $str, float $size, float $maxWidth, bool $bold = false): string
    {
        $str = $this->sanitize($str);
        if ($this->textWidth($str, $size, $bold) <= $maxWidth) {
            return $str;
        }
        while ($str !== '' && $this->textWidth($str . '...', $size, $bold) > $maxWidth) {
            $str = substr($str, 0, -1);
        }
        return $str . '...';
    }

    /**
     * Embed an image file. Re-encoded through GD so the PDF always receives a
     * clean RGB JPEG regardless of the source format or colour space.
     */
    public function image(string $path, float $x, float $y, float $w, float $h): bool
    {
        $jpeg = $this->toJpeg($path);
        if ($jpeg === null) {
            return false;
        }
        $this->images[] = $jpeg;
        $index = count($this->images) - 1;
        $this->put(sprintf(
            'q %.2f 0 0 %.2f %.2f %.2f cm /I%d Do Q',
            $w, $h, $x, $this->flip($y) - $h, $index
        ));
        return true;
    }

    /** Assemble the finished document. */
    public function output(): string
    {
        if ($this->current < 0) {
            $this->addPage();
        }

        $objects   = [];   // 1-indexed object bodies
        $pageCount = count($this->pages);

        // Object layout: 1 = catalog, 2 = pages tree, 3 = font F1, 4 = font F2,
        // then one image object per image, then page/content pairs.
        $firstImage   = 5;
        $firstPageObj = $firstImage + count($this->images);

        $kids = [];
        for ($i = 0; $i < $pageCount; $i++) {
            $kids[] = ($firstPageObj + $i * 2) . ' 0 R';
        }

        $objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
        $objects[2] = "<< /Type /Pages /Count {$pageCount} /Kids [" . implode(' ', $kids) . "] >>";
        $objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
        $objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

        $xobjects = [];
        foreach ($this->images as $i => $img) {
            $id = $firstImage + $i;
            $objects[$id] = "<< /Type /XObject /Subtype /Image /Width {$img['w']} /Height {$img['h']}"
                . " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode"
                . " /Length " . strlen($img['data']) . " >>\nstream\n" . $img['data'] . "\nendstream";
            $xobjects[] = "/I{$i} {$id} 0 R";
        }

        $resources = "<< /Font << /F1 3 0 R /F2 4 0 R >>"
            . ($xobjects ? " /XObject << " . implode(' ', $xobjects) . " >>" : '')
            . " >>";

        foreach ($this->pages as $i => $content) {
            $pageId    = $firstPageObj + $i * 2;
            $contentId = $pageId + 1;
            $objects[$pageId] = sprintf(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] /Resources %s /Contents %d 0 R >>",
                $this->pageWidth, $this->pageHeight, $resources, $contentId
            );
            $objects[$contentId] = "<< /Length " . strlen($content) . " >>\nstream\n" . $content . "\nendstream";
        }

        ksort($objects);
        $pdf     = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [];
        foreach ($objects as $id => $body) {
            $offsets[$id] = strlen($pdf);
            $pdf .= "{$id} 0 obj\n{$body}\nendobj\n";
        }

        $xrefPos = strlen($pdf);
        $max     = max(array_keys($objects));
        $pdf .= "xref\n0 " . ($max + 1) . "\n0000000000 65535 f \n";
        for ($i = 1; $i <= $max; $i++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$i] ?? 0);
        }
        $pdf .= "trailer\n<< /Size " . ($max + 1) . " /Root 1 0 R >>\nstartxref\n{$xrefPos}\n%%EOF";

        return $pdf;
    }

    // ---------------------------------------------------------------- helpers

    private function put(string $op): void
    {
        if ($this->current < 0) {
            $this->addPage();
        }
        $this->pages[$this->current] .= $op . "\n";
    }

    private function flip(float $y): float
    {
        return $this->pageHeight - $y;
    }

    private function rgb(string $hex): array
    {
        $hex = ltrim($hex, '#');
        return [
            hexdec(substr($hex, 0, 2)) / 255,
            hexdec(substr($hex, 2, 2)) / 255,
            hexdec(substr($hex, 4, 2)) / 255,
        ];
    }

    /** Collapse anything outside the WinAnsi printable range. */
    private function sanitize(string $str): string
    {
        $str = str_replace(["\xE2\x82\xB9"], ['Rs.'], $str); // rupee sign
        $str = preg_replace('/[^\x20-\x7E\r\n]/', '', $str);
        return trim($str ?? '');
    }

    private function escape(string $str): string
    {
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $str);
    }

    /** @return array{data:string,w:int,h:int}|null */
    private function toJpeg(string $path): ?array
    {
        if (!is_readable($path)) {
            return null;
        }
        $info = @getimagesize($path);
        if ($info === false) {
            return null;
        }
        $src = match ($info[2]) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($path),
            IMAGETYPE_PNG  => @imagecreatefrompng($path),
            IMAGETYPE_GIF  => @imagecreatefromgif($path),
            IMAGETYPE_WEBP => @imagecreatefromwebp($path),
            default        => false,
        };
        if (!$src) {
            return null;
        }

        $w = imagesx($src);
        $h = imagesy($src);

        // Flatten onto white so transparent PNGs do not turn black.
        $flat = imagecreatetruecolor($w, $h);
        imagefill($flat, 0, 0, imagecolorallocate($flat, 255, 255, 255));
        imagecopy($flat, $src, 0, 0, 0, 0, $w, $h);
        imagedestroy($src);

        ob_start();
        imagejpeg($flat, null, 90);
        $data = ob_get_clean();
        imagedestroy($flat);

        return ['data' => $data, 'w' => $w, 'h' => $h];
    }
}
