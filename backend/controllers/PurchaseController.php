<?php
class PurchaseController extends Controller
{
    private Purchase $model;
    public function __construct() { $this->model = new Purchase(); }

    public function index(Request $req): void
    {
        [$rows, $total] = $this->model->paginateJoined(
            $req->page(), $req->perPage(), $req->search(),
            ['status' => $req->query('status')]
        );
        Response::paginated($rows, $total, $req->page(), $req->perPage());
    }

    public function show(Request $req, array $p): void
    {
        $row = $this->model->findWithItems((int) $p['id']);
        $row ? Response::success($row) : Response::error('Purchase not found', 404);
    }

    public function store(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $this->validate($req, [
            'supplier_id'   => 'required|numeric',
            'purchase_date' => 'required',
        ]);
        $items = $req->input('items', []);
        if (!is_array($items) || count($items) === 0) {
            Response::error('At least one purchase item is required', 422);
        }

        $db = $this->model->db();
        $db->beginTransaction();
        try {
            $total = 0;
            foreach ($items as $it) {
                $total += ((int) $it['quantity']) * ((float) $it['unit_cost']);
            }
            $reference = $this->model->nextReference();
            $purchaseId = $this->model->create([
                'reference'     => $reference,
                'supplier_id'   => (int) $req->input('supplier_id'),
                'purchase_date' => $req->input('purchase_date'),
                'total_amount'  => $total,
                'status'        => 'pending',
                'notes'         => $req->input('notes'),
                'created_by'    => $this->userId($req),
            ]);

            $itemStmt = $db->prepare(
                'INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, subtotal)
                 VALUES (?, ?, ?, ?, ?)'
            );
            foreach ($items as $it) {
                $sub = ((int) $it['quantity']) * ((float) $it['unit_cost']);
                $itemStmt->execute([$purchaseId, (int) $it['product_id'], (int) $it['quantity'], (float) $it['unit_cost'], $sub]);
            }
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            Response::error('Failed to create purchase order', 500, APP_ENV === 'development' ? $e->getMessage() : null);
        }

        Notifier::push('purchase_approval', 'Purchase pending', "$reference is awaiting approval", $purchaseId);
        ActivityLogger::log($this->userId($req), 'create', 'purchase', "Created purchase $reference");
        Response::success(['id' => $purchaseId, 'reference' => $reference], 'Purchase order created', 201);
    }

    /** Approve: Admin/Manager only. Moves status pending -> approved. */
    public function approve(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $id = (int) $p['id'];
        $purchase = $this->model->find($id);
        if (!$purchase) Response::error('Purchase not found', 404);
        if ($purchase['status'] !== 'pending') Response::error('Only pending purchases can be approved', 422);

        $this->model->update($id, [
            'status'      => 'approved',
            'approved_by' => $this->userId($req),
            'approved_at' => date('Y-m-d H:i:s'),
        ]);
        ActivityLogger::log($this->userId($req), 'approve', 'purchase', "Approved {$purchase['reference']}");
        Response::success(null, 'Purchase approved');
    }

    /** Receive: adds items into stock. status approved -> received. */
    public function receive(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $id = (int) $p['id'];
        $purchase = $this->model->findWithItems($id);
        if (!$purchase) Response::error('Purchase not found', 404);
        if (!in_array($purchase['status'], ['approved'], true)) {
            Response::error('Only approved purchases can be received', 422);
        }

        $stock = new StockTransaction();
        $db = $this->model->db();
        $db->beginTransaction();
        try {
            foreach ($purchase['items'] as $item) {
                $stock->record(
                    (int) $item['product_id'], 'in', (int) $item['quantity'],
                    'purchase', $id, "Received from {$purchase['reference']}", $this->userId($req)
                );
            }
            $this->model->update($id, ['status' => 'received']);
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            Response::error('Failed to receive stock', 500, APP_ENV === 'development' ? $e->getMessage() : null);
        }
        ActivityLogger::log($this->userId($req), 'stock', 'purchase', "Received stock for {$purchase['reference']}");
        Response::success(null, 'Stock received and inventory updated');
    }

    public function cancel(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $id = (int) $p['id'];
        $purchase = $this->model->find($id);
        if (!$purchase) Response::error('Purchase not found', 404);
        if ($purchase['status'] === 'received') Response::error('Received purchases cannot be cancelled', 422);
        $this->model->update($id, ['status' => 'cancelled']);
        ActivityLogger::log($this->userId($req), 'update', 'purchase', "Cancelled {$purchase['reference']}");
        Response::success(null, 'Purchase cancelled');
    }
}
