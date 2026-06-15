<?php
class ReportController extends Controller
{
    private Report $report;
    public function __construct() { $this->report = new Report(); }

    private array $valid = ['product', 'inventory', 'purchase', 'sales', 'supplier', 'customer', 'profit'];

    /** JSON report data for on-screen rendering. */
    public function data(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $type = in_array($p['type'], $this->valid, true) ? $p['type'] : 'product';
        $filters = ['from' => $req->query('from'), 'to' => $req->query('to')];
        Response::success($this->report->build($type, $filters));
    }

    /** File export: /reports/{type}/export?format=pdf|excel|csv|print */
    public function export(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $type = in_array($p['type'], $this->valid, true) ? $p['type'] : 'product';
        $filters = ['from' => $req->query('from'), 'to' => $req->query('to')];
        $format  = (string) $req->query('format', 'csv');

        $dataset = $this->report->build($type, $filters);
        ActivityLogger::log($this->userId($req), 'export', 'report', "Exported $type report as $format");
        Exporter::handle($dataset, $format);
    }
}
