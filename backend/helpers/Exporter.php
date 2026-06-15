<?php
/**
 * Exports a report dataset to CSV, Excel (xlsx) or PDF.
 * Uses PhpSpreadsheet / TCPDF when installed via Composer, otherwise
 * falls back to native CSV and printable-HTML output so the feature
 * always works out of the box.
 */
class Exporter
{
    public static function handle(array $report, string $format): void
    {
        switch (strtolower($format)) {
            case 'excel':
            case 'xlsx':
                self::excel($report); break;
            case 'pdf':
                self::pdf($report); break;
            case 'print':
                self::printable($report); break;
            default:
                self::csv($report);
        }
        exit;
    }

    private static function filename(array $r, string $ext): string
    {
        $slug = preg_replace('/[^a-z0-9]+/i', '_', strtolower($r['title']));
        return trim($slug, '_') . '_' . date('Ymd_His') . '.' . $ext;
    }

    // ---------- CSV ----------
    private static function csv(array $r): void
    {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . self::filename($r, 'csv') . '"');
        $out = fopen('php://output', 'w');
        fputcsv($out, $r['columns']);
        foreach ($r['rows'] as $row) fputcsv($out, $row);
        if (!empty($r['summary'])) {
            fputcsv($out, []);
            foreach ($r['summary'] as $k => $v) fputcsv($out, [$k, $v]);
        }
        fclose($out);
    }

    // ---------- Excel ----------
    private static function excel(array $r): void
    {
        if (class_exists(\PhpOffice\PhpSpreadsheet\Spreadsheet::class)) {
            $ss = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
            $sheet = $ss->getActiveSheet();
            $sheet->fromArray($r['columns'], null, 'A1');
            $sheet->fromArray($r['rows'], null, 'A2');
            $sheet->getStyle('A1:' . $sheet->getHighestColumn() . '1')->getFont()->setBold(true);
            header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            header('Content-Disposition: attachment; filename="' . self::filename($r, 'xlsx') . '"');
            (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($ss))->save('php://output');
            return;
        }
        // Fallback: CSV that Excel opens natively.
        self::csv($r);
    }

    // ---------- PDF ----------
    private static function pdf(array $r): void
    {
        if (class_exists(\TCPDF::class)) {
            $pdf = new \TCPDF();
            $pdf->SetCreator('StockHive');
            $pdf->AddPage();
            $pdf->SetFont('helvetica', 'B', 14);
            $pdf->Cell(0, 10, $r['title'], 0, 1);
            $pdf->SetFont('helvetica', '', 9);
            $pdf->writeHTML(self::tableHtml($r), true, false, false, false, '');
            $pdf->Output(self::filename($r, 'pdf'), 'D');
            return;
        }
        // Fallback: printable HTML (browser → Save as PDF).
        self::printable($r);
    }

    // ---------- Printable HTML ----------
    private static function printable(array $r): void
    {
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html><head><meta charset="utf-8"><title>' . htmlspecialchars($r['title']) . '</title>';
        echo '<style>body{font-family:Arial,sans-serif;margin:24px;color:#222}
              h1{font-size:18px}table{border-collapse:collapse;width:100%;font-size:12px}
              th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
              th{background:#0d6efd;color:#fff}tr:nth-child(even){background:#f6f8fb}
              .summary{margin-top:14px;font-weight:bold}
              @media print{.noprint{display:none}}</style></head><body>';
        echo '<button class="noprint" onclick="window.print()" style="margin-bottom:12px;padding:8px 16px">Print / Save as PDF</button>';
        echo '<h1>' . htmlspecialchars($r['title']) . '</h1>';
        echo '<div style="color:#666;font-size:12px">Generated ' . date('Y-m-d H:i') . ' · StockHive</div>';
        echo self::tableHtml($r);
        if (!empty($r['summary'])) {
            echo '<div class="summary">';
            foreach ($r['summary'] as $k => $v) echo htmlspecialchars("$k: $v") . '<br>';
            echo '</div>';
        }
        echo '</body></html>';
    }

    private static function tableHtml(array $r): string
    {
        $h = '<table><thead><tr>';
        foreach ($r['columns'] as $c) $h .= '<th>' . htmlspecialchars((string) $c) . '</th>';
        $h .= '</tr></thead><tbody>';
        foreach ($r['rows'] as $row) {
            $h .= '<tr>';
            foreach ($row as $cell) $h .= '<td>' . htmlspecialchars((string) $cell) . '</td>';
            $h .= '</tr>';
        }
        $h .= '</tbody></table>';
        return $h;
    }
}
