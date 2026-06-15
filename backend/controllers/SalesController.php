<?php
class SalesController extends Controller
{
    private Sale $model;
    public function __construct() { $this->model = new Sale(); }

    public function index(Request $req): void
    {
        [$rows, $total] = $this->model->paginateJoined(
            $req->page(), $req->perPage(), $req->search(),
            ['payment_status' => $req->query('payment_status')]
        );
        Response::paginated($rows, $total, $req->page(), $req->perPage());
    }

    public function show(Request $req, array $p): void
    {
        $row = $this->model->findWithItems((int) $p['id']);
        $row ? Response::success($row) : Response::error('Sale not found', 404);
    }

    public function store(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $this->validate($req, ['sale_date' => 'required']);
        $items = $req->input('items', []);
        if (!is_array($items) || count($items) === 0) {
            Response::error('At least one sale item is required', 422);
        }

        $productModel = new Product();
        // Validate stock availability up-front
        foreach ($items as $it) {
            $product = $productModel->find((int) $it['product_id']);
            if (!$product) Response::error('A selected product no longer exists', 422);
            if ((int) $product['quantity'] < (int) $it['quantity']) {
                Response::error("Insufficient stock for {$product['name']} (have {$product['quantity']})", 422);
            }
        }

        $subtotal = 0;
        foreach ($items as $it) {
            $subtotal += ((int) $it['quantity']) * ((float) $it['unit_price']);
        }
        $discount = (float) $req->input('discount', 0);
        $tax      = (float) $req->input('tax', 0);
        $total    = $subtotal - $discount + $tax;

        $stock = new StockTransaction();
        $db = $this->model->db();
        $db->beginTransaction();
        try {
            $invoiceNo = $this->model->nextInvoice();
            $saleId = $this->model->create([
                'invoice_no'     => $invoiceNo,
                'customer_id'    => $req->input('customer_id') ?: null,
                'sale_date'      => $req->input('sale_date'),
                'subtotal'       => $subtotal,
                'discount'       => $discount,
                'tax'            => $tax,
                'total_amount'   => $total,
                'payment_status' => $req->input('payment_status', 'paid'),
                'notes'          => $req->input('notes'),
                'created_by'     => $this->userId($req),
            ]);

            $itemStmt = $db->prepare(
                'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
                 VALUES (?, ?, ?, ?, ?)'
            );
            foreach ($items as $it) {
                $sub = ((int) $it['quantity']) * ((float) $it['unit_price']);
                $itemStmt->execute([$saleId, (int) $it['product_id'], (int) $it['quantity'], (float) $it['unit_price'], $sub]);
                $stock->record(
                    (int) $it['product_id'], 'out', -((int) $it['quantity']),
                    'sale', $saleId, "Sold via $invoiceNo", $this->userId($req)
                );
            }
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            Response::error('Failed to record sale', 500, APP_ENV === 'development' ? $e->getMessage() : null);
        }

        // Post-sale low stock checks
        foreach ($items as $it) {
            Notifier::checkStock($productModel->find((int) $it['product_id']));
        }
        ActivityLogger::log($this->userId($req), 'create', 'sale', "Created invoice $invoiceNo");
        Response::success(['id' => $saleId, 'invoice_no' => $invoiceNo], 'Sale recorded', 201);
    }

    public function destroy(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin']);
        $id = (int) $p['id'];
        $sale = $this->model->findWithItems($id);
        if (!$sale) Response::error('Sale not found', 404);

        $stock = new StockTransaction();
        $db = $this->model->db();
        $db->beginTransaction();
        try {
            // Restore stock then delete (sale_items cascade on delete)
            foreach ($sale['items'] as $item) {
                $stock->record(
                    (int) $item['product_id'], 'returned', (int) $item['quantity'],
                    'sale', $id, "Reversed sale {$sale['invoice_no']}", $this->userId($req)
                );
            }
            $this->model->delete($id);
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            Response::error('Failed to delete sale', 500, APP_ENV === 'development' ? $e->getMessage() : null);
        }
        ActivityLogger::log($this->userId($req), 'delete', 'sale', "Deleted/reversed {$sale['invoice_no']}");
        Response::success(null, 'Sale reversed and stock restored');
    }
}
