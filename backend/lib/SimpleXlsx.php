<?php
/**
 * SimpleXlsx — writes a real, styled .xlsx workbook using only ZipArchive.
 *
 * Enough features for a presentable report: a banner title row, coloured and
 * frozen header row, zebra striped body rows, borders, column widths and
 * merged cells. No Composer, no PhpSpreadsheet.
 *
 * Style ids exposed as constants are the values you pass to addRow().
 */
class SimpleXlsx
{
    public const S_DEFAULT   = 0;
    public const S_TITLE     = 1;  // large white on navy
    public const S_SUBTITLE  = 2;  // muted italic
    public const S_HEADER    = 3;  // white on blue, bordered
    public const S_BODY      = 4;  // bordered, left, wrapped
    public const S_BODY_ALT  = 5;  // ditto + zebra fill
    public const S_CENTER    = 6;  // bordered, centred
    public const S_CENTER_ALT= 7;
    public const S_LABEL     = 8;  // bold navy text, no fill

    private array $rows = [];      // each: ['cells' => [[value, style]], 'height' => ?float]
    private array $merges = [];
    private array $widths = [];
    private string $sheetName;
    private int $freezeRow = 0;

    public function __construct(string $sheetName = 'Sheet1')
    {
        $this->sheetName = substr(preg_replace('/[\\\\\/\?\*\[\]:]/', '', $sheetName), 0, 31) ?: 'Sheet1';
    }

    /** @param array<int,float> $widths 1-indexed column => character width */
    public function setColumnWidths(array $widths): void
    {
        $this->widths = $widths;
    }

    /** Keep the first $n rows visible while scrolling. */
    public function freezeRows(int $n): void
    {
        $this->freezeRow = $n;
    }

    /** @param array $cells list of scalars, or [value, styleId] pairs */
    public function addRow(array $cells, int $style = self::S_DEFAULT, ?float $height = null): void
    {
        $normalized = [];
        foreach ($cells as $cell) {
            if (is_array($cell)) {
                $normalized[] = [$cell[0], $cell[1] ?? $style];
            } else {
                $normalized[] = [$cell, $style];
            }
        }
        $this->rows[] = ['cells' => $normalized, 'height' => $height];
    }

    /** Merge across the current last row, e.g. mergeLastRow(1, 8). */
    public function mergeLastRow(int $fromCol, int $toCol): void
    {
        $r = count($this->rows);
        $this->merges[] = self::colName($fromCol) . $r . ':' . self::colName($toCol) . $r;
    }

    /** True when a real .xlsx can be produced on this server. */
    public static function isSupported(): bool
    {
        return class_exists('ZipArchive');
    }

    /** Returns the binary .xlsx contents. */
    public function output(): string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'xlsx');
        $zip = new ZipArchive();
        $zip->open($tmp, ZipArchive::OVERWRITE);

        $zip->addFromString('[Content_Types].xml', $this->contentTypes());
        $zip->addFromString('_rels/.rels', $this->rootRels());
        $zip->addFromString('xl/workbook.xml', $this->workbook());
        $zip->addFromString('xl/_rels/workbook.xml.rels', $this->workbookRels());
        $zip->addFromString('xl/styles.xml', $this->styles());
        $zip->addFromString('xl/worksheets/sheet1.xml', $this->sheet());
        $zip->close();

        $data = file_get_contents($tmp);
        @unlink($tmp);
        return $data;
    }

    /** CSV fallback for servers without ZipArchive. */
    public static function toCsv(array $header, array $rows): string
    {
        $out = fopen('php://temp', 'r+');
        fwrite($out, chr(0xEF) . chr(0xBB) . chr(0xBF));
        fputcsv($out, $header);
        foreach ($rows as $row) {
            fputcsv($out, $row);
        }
        rewind($out);
        return stream_get_contents($out);
    }

    public static function colName(int $index): string
    {
        $name = '';
        while ($index > 0) {
            $mod = ($index - 1) % 26;
            $name = chr(65 + $mod) . $name;
            $index = (int) (($index - $mod) / 26);
        }
        return $name;
    }

    // ------------------------------------------------------------- xml parts

    private function sheet(): string
    {
        $cols = '';
        if ($this->widths) {
            $cols = '<cols>';
            foreach ($this->widths as $i => $w) {
                $cols .= '<col min="' . $i . '" max="' . $i . '" width="' . $w . '" customWidth="1"/>';
            }
            $cols .= '</cols>';
        }

        $sheetData = '<sheetData>';
        foreach ($this->rows as $r => $row) {
            $rowNum = $r + 1;
            $attrs  = ' r="' . $rowNum . '"';
            if ($row['height'] !== null) {
                $attrs .= ' ht="' . $row['height'] . '" customHeight="1"';
            }
            $sheetData .= '<row' . $attrs . '>';
            foreach ($row['cells'] as $c => [$value, $style]) {
                $ref = self::colName($c + 1) . $rowNum;
                if (is_int($value) || is_float($value)) {
                    $sheetData .= '<c r="' . $ref . '" s="' . $style . '"><v>' . $value . '</v></c>';
                } else {
                    $text = self::escape((string) $value);
                    $sheetData .= '<c r="' . $ref . '" s="' . $style . '" t="inlineStr"><is><t xml:space="preserve">'
                        . $text . '</t></is></c>';
                }
            }
            $sheetData .= '</row>';
        }
        $sheetData .= '</sheetData>';

        $merge = '';
        if ($this->merges) {
            $merge = '<mergeCells count="' . count($this->merges) . '">';
            foreach ($this->merges as $m) {
                $merge .= '<mergeCell ref="' . $m . '"/>';
            }
            $merge .= '</mergeCells>';
        }

        $pane = '';
        if ($this->freezeRow > 0) {
            $cell = 'A' . ($this->freezeRow + 1);
            $pane = '<pane ySplit="' . $this->freezeRow . '" topLeftCell="' . $cell
                . '" activePane="bottomLeft" state="frozen"/>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<sheetViews><sheetView showGridLines="0" workbookViewId="0">' . $pane . '</sheetView></sheetViews>'
            . '<sheetFormatPr defaultRowHeight="16"/>'
            . $cols . $sheetData . $merge
            . '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>'
            . '</worksheet>';
    }

    private function styles(): string
    {
        // Palette pulled from the JCI mark: navy, blue, teal.
        $fonts = '<fonts count="6">'
            . '<font><sz val="11"/><name val="Calibri"/></font>'                                                 // 0
            . '<font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'                      // 1
            . '<font><i/><sz val="10"/><color rgb="FF8592A6"/><name val="Calibri"/></font>'                      // 2
            . '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'                      // 3
            . '<font><sz val="10.5"/><color rgb="FF243044"/><name val="Calibri"/></font>'                        // 4
            . '<font><b/><sz val="11"/><color rgb="FF1B1B3A"/><name val="Calibri"/></font>'                      // 5
            . '</fonts>';

        $fills = '<fills count="6">'
            . '<fill><patternFill patternType="none"/></fill>'
            . '<fill><patternFill patternType="gray125"/></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FF1B1B3A"/><bgColor indexed="64"/></patternFill></fill>' // 2 navy
            . '<fill><patternFill patternType="solid"><fgColor rgb="FF1B9AD6"/><bgColor indexed="64"/></patternFill></fill>' // 3 blue
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F7FC"/><bgColor indexed="64"/></patternFill></fill>' // 4 zebra
            . '<fill><patternFill patternType="solid"><fgColor rgb="FF4FC3C0"/><bgColor indexed="64"/></patternFill></fill>' // 5 teal
            . '</fills>';

        $thin = '<left style="thin"><color rgb="FFD8E2EC"/></left><right style="thin"><color rgb="FFD8E2EC"/></right>'
            . '<top style="thin"><color rgb="FFD8E2EC"/></top><bottom style="thin"><color rgb="FFD8E2EC"/></bottom>';
        $borders = '<borders count="2">'
            . '<border><left/><right/><top/><bottom/><diagonal/></border>'
            . '<border>' . $thin . '<diagonal/></border>'
            . '</borders>';

        $xfs = '<cellXfs count="9">'
            . '<xf xfId="0" fontId="0" fillId="0" borderId="0"/>'
            . '<xf xfId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
            . '<xf xfId="0" fontId="2" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
            . '<xf xfId="0" fontId="3" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            . '<xf xfId="0" fontId="4" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>'
            . '<xf xfId="0" fontId="4" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>'
            . '<xf xfId="0" fontId="4" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            . '<xf xfId="0" fontId="4" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            . '<xf xfId="0" fontId="5" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>'
            . '</cellXfs>';

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . $fonts . $fills . $borders
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . $xfs
            . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
            . '</styleSheet>';
    }

    private function workbook(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
            . ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets><sheet name="' . self::escape($this->sheetName) . '" sheetId="1" r:id="rId1"/></sheets>'
            . '</workbook>';
    }

    private function workbookRels(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            . '</Relationships>';
    }

    private function rootRels(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>';
    }

    private function contentTypes(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . '</Types>';
    }

    private static function escape(string $s): string
    {
        // Strip control characters that are illegal in XML 1.0.
        $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $s) ?? '';
        return htmlspecialchars($s, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }
}
