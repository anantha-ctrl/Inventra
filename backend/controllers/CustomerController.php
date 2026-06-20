<?php
class CustomerController extends Controller
{
    private Customer $model;
    public function __construct() { $this->model = new Customer(); }

    public function index(Request $req): void
    {
        [$rows, $total] = $this->model->paginateRows(
            $req->page(), $req->perPage(), $req->search(),
            ['name', 'email', 'phone', 'city'],
            ['status' => $req->query('status')],
            'name ASC'
        );
        Response::paginated($rows, $total, $req->page(), $req->perPage());
    }

    public function listAll(Request $req): void
    {
        Response::success($this->model->all('name ASC'));
    }

    public function show(Request $req, array $p): void
    {
        $row = $this->model->find((int) $p['id']);
        if (!$row) Response::error('Customer not found', 404);
        $row['sales_history'] = $this->model->salesHistory((int) $p['id']);
        Response::success($row);
    }

    public function store(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $this->validate($req, ['name' => 'required|max:150', 'email' => 'email', 'status' => 'in:active,inactive']);
        $id = $this->model->create($this->payload($req));
        ActivityLogger::log($this->userId($req), 'create', 'customer', "Created customer " . $req->input('name'));
        Response::success(['id' => $id], 'Customer created', 201);
    }

    public function update(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $id = (int) $p['id'];
        if (!$this->model->find($id)) Response::error('Customer not found', 404);
        $this->validate($req, ['name' => 'required|max:150', 'email' => 'email', 'status' => 'in:active,inactive']);
        $this->model->update($id, $this->payload($req));
        ActivityLogger::log($this->userId($req), 'update', 'customer', "Updated customer #$id");
        Response::success(null, 'Customer updated');
    }

    public function destroy(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $id = (int) $p['id'];
        if (!$this->model->find($id)) Response::error('Customer not found', 404);
        if ((new Sale())->count('customer_id = ?', [$id]) > 0) {
            Response::error('Cannot delete: sales reference this customer', 409);
        }
        $this->model->delete($id);
        ActivityLogger::log($this->userId($req), 'delete', 'customer', "Deleted customer #$id");
        Response::success(null, 'Customer deleted');
    }

    /** Stream all customers as a CSV download. */
    public function export(Request $req): void
    {
        $rows = $this->model->all('name ASC');
        ActivityLogger::log($this->userId($req), 'export', 'customer', 'Exported customers to CSV');
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="customers_export_' . date('Ymd_His') . '.csv"');
        $out = fopen('php://output', 'w');
        fwrite($out, "\xEF\xBB\xBF");
        $cols = ['name','email','phone','address','city','status'];
        fputcsv($out, $cols);
        foreach ($rows as $r) {
            fputcsv($out, array_map(fn($c) => $r[$c] ?? '', $cols));
        }
        fclose($out);
        exit;
    }

    /** Bulk-create customers from an uploaded CSV. */
    public function import(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            Response::error('Please upload a valid CSV file', 400);
        }
        if (($handle = fopen($_FILES['file']['tmp_name'], 'r')) === false) {
            Response::error('Could not open the uploaded file', 400);
        }
        $headers = fgetcsv($handle);
        if (!$headers) { fclose($handle); Response::error('Empty CSV file', 400); }
        $headers = array_map(fn($h) => strtolower(trim(preg_replace('/[\x{FEFF}\x{FFFE}]/u', '', $h))), $headers);
        $idx = fn($name) => array_search($name, $headers);
        if ($idx('name') === false) {
            fclose($handle);
            Response::error('CSV must contain at least a "name" column.', 422);
        }

        $imported = 0; $skipped = 0; $errors = []; $line = 1;
        $db = $this->model->db();
        $db->beginTransaction();
        try {
            while (($row = fgetcsv($handle)) !== false) {
                $line++;
                if (empty($row) || (count($row) === 1 && trim((string) $row[0]) === '')) continue;
                $name = trim($row[$idx('name')] ?? '');
                if ($name === '') { $skipped++; $errors[] = "Line $line: name is required."; continue; }
                $get = fn($k) => $idx($k) !== false ? trim($row[$idx($k)] ?? '') : '';
                $status = strtolower($get('status'));
                $this->model->create([
                    'name'    => $name,
                    'email'   => $get('email') ?: null,
                    'phone'   => $get('phone') ?: null,
                    'address' => $get('address') ?: null,
                    'city'    => $get('city') ?: null,
                    'status'  => in_array($status, ['active','inactive'], true) ? $status : 'active',
                ]);
                $imported++;
            }
            $db->commit();
            fclose($handle);
        } catch (Throwable $e) {
            $db->rollBack(); fclose($handle);
            Response::error('Failed to import customers: ' . $e->getMessage(), 500);
        }
        ActivityLogger::log($this->userId($req), 'create', 'customer', "Bulk imported $imported customers via CSV");
        Response::success(['imported' => $imported, 'skipped' => $skipped, 'errors' => $errors],
            "Import completed: $imported customers added, $skipped skipped.");
    }

    private function payload(Request $req): array
    {
        return [
            'name'    => $req->input('name'),
            'email'   => $req->input('email'),
            'phone'   => $req->input('phone'),
            'address' => $req->input('address'),
            'city'    => $req->input('city'),
            'status'  => $req->input('status', 'active'),
        ];
    }
}
