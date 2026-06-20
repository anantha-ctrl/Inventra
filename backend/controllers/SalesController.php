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
        $taxRate  = (float) $req->input('tax_rate', 0);   // GST %
        // If a GST rate is supplied, derive the tax amount from the taxable base;
        // otherwise fall back to a flat tax amount (backward compatible).
        $taxable  = max(0, $subtotal - $discount);
        $tax      = $taxRate > 0 ? round($taxable * $taxRate / 100, 2) : (float) $req->input('tax', 0);
        $total    = $subtotal - $discount + $tax;

        // Payment / dues — supports split payments (cash + upi + card …).
        $payments = $req->input('payments', null);   // [{mode, amount, reference}]
        $validModes = ['cash', 'upi', 'card', 'other'];
        if (is_array($payments) && count($payments)) {
            $payments = array_values(array_filter($payments, fn($pm) => (float) ($pm['amount'] ?? 0) > 0));
            $paid = 0;
            foreach ($payments as $pm) $paid += (float) ($pm['amount'] ?? 0);
        } else {
            $payments = null;
            $paid = $req->input('paid_amount', null);
            $paid = $paid === null ? $total : (float) $paid;   // default: fully paid
        }
        $paid = max(0, min($paid, $total));
        $payStatus = $paid <= 0 ? 'unpaid' : ($paid >= $total ? 'paid' : 'partial');

        // Primary payment mode label
        if ($payments && count($payments) > 1)      $payMode = 'split';
        elseif ($payments && count($payments) === 1) $payMode = in_array($payments[0]['mode'] ?? 'cash', $validModes, true) ? $payments[0]['mode'] : 'cash';
        else $payMode = in_array($req->input('payment_mode', 'cash'), $validModes, true) ? $req->input('payment_mode', 'cash') : 'cash';

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
                'tax_rate'       => $taxRate,
                'total_amount'   => $total,
                'paid_amount'    => $paid,
                'payment_status' => $payStatus,
                'payment_mode'   => $payMode,
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

            // Record payment breakdown (split or single).
            $payStmt = $db->prepare('INSERT INTO sale_payments (sale_id, mode, amount, reference) VALUES (?, ?, ?, ?)');
            if ($payments) {
                foreach ($payments as $pm) {
                    $mode = in_array($pm['mode'] ?? 'cash', $validModes, true) ? $pm['mode'] : 'cash';
                    $payStmt->execute([$saleId, $mode, (float) $pm['amount'], $pm['reference'] ?? null]);
                }
            } elseif ($paid > 0) {
                $payStmt->execute([$saleId, $payMode, $paid, null]);
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

    /** Outstanding dues across all unpaid/partial invoices. */
    public function dues(Request $req): void
    {
        $rows = $this->model->dues();
        $total = array_sum(array_map(fn($r) => (float) $r['due'], $rows));
        Response::success(['rows' => $rows, 'total_due' => $total, 'count' => count($rows)]);
    }

    /** Record a payment against an invoice; recomputes payment status. */
    public function recordPayment(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $id   = (int) $p['id'];
        $sale = $this->model->find($id);
        if (!$sale) Response::error('Sale not found', 404);

        $amount = (float) $req->input('amount', 0);
        if ($amount <= 0) Response::error('Payment amount must be greater than zero', 422);

        $newPaid = (float) $sale['paid_amount'] + $amount;
        $total   = (float) $sale['total_amount'];
        if ($newPaid > $total + 0.001) {
            Response::error('Payment exceeds the outstanding balance', 422);
        }
        $status = $newPaid <= 0 ? 'unpaid' : ($newPaid >= $total ? 'paid' : 'partial');
        $validModes = ['cash', 'upi', 'card', 'other'];
        $mode = in_array($req->input('mode', 'cash'), $validModes, true) ? $req->input('mode', 'cash') : 'cash';

        $this->model->update($id, ['paid_amount' => round($newPaid, 2), 'payment_status' => $status]);
        $this->model->db()->prepare('INSERT INTO sale_payments (sale_id, mode, amount, reference) VALUES (?, ?, ?, ?)')
            ->execute([$id, $mode, $amount, $req->input('reference')]);
        ActivityLogger::log($this->userId($req), 'update', 'sale',
            "Recorded $mode payment of $amount on {$sale['invoice_no']}");
        Response::success([
            'paid_amount'    => round($newPaid, 2),
            'due'            => round($total - $newPaid, 2),
            'payment_status' => $status,
        ], 'Payment recorded');
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
