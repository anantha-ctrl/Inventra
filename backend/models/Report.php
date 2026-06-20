<?php
/**
 * Builds report datasets. Each method returns:
 *   ['columns' => [...], 'rows' => [[...]], 'title' => '...', 'summary' => [...]]
 */
class Report extends Model
{
    protected string $table = 'products';

    private function range(array $f): array
    {
        $from = !empty($f['from']) ? $f['from'] : '2000-01-01';
        $to   = !empty($f['to'])   ? $f['to']   : date('Y-m-d');
        return [$from, $to];
    }

    public function product(array $f = []): array
    {
        $rows = $this->db->query(
            'SELECT p.sku, p.name, c.name AS category, s.name AS supplier,
                    p.cost_price, p.selling_price, p.quantity, p.status
             FROM products p
             JOIN categories c ON c.id=p.category_id
             LEFT JOIN suppliers s ON s.id=p.supplier_id
             ORDER BY p.name ASC'
        )->fetchAll();
        return [
            'title'   => 'Product Report',
            'columns' => ['SKU', 'Name', 'Category', 'Supplier', 'Cost', 'Price', 'Qty', 'Status'],
            'rows'    => array_map(fn($r) => array_values($r), $rows),
        ];
    }

    public function inventory(array $f = []): array
    {
        $rows = $this->db->query(
            'SELECT p.sku, p.name, c.name AS category, p.quantity, p.reorder_level,
                    (p.quantity*p.cost_price) AS stock_value,
                    CASE WHEN p.quantity<=0 THEN "Out of stock"
                         WHEN p.quantity<=p.reorder_level THEN "Low"
                         ELSE "OK" END AS stock_status
             FROM products p JOIN categories c ON c.id=p.category_id
             ORDER BY p.quantity ASC'
        )->fetchAll();
        $value = array_sum(array_column($rows, 'stock_value'));
        return [
            'title'   => 'Inventory Report',
            'columns' => ['SKU', 'Name', 'Category', 'Qty', 'Reorder', 'Stock Value', 'Status'],
            'rows'    => array_map(fn($r) => array_values($r), $rows),
            'summary' => ['Total stock value' => number_format($value, 2)],
        ];
    }

    public function purchase(array $f = []): array
    {
        [$from, $to] = $this->range($f);
        $stmt = $this->db->prepare(
            'SELECT po.reference, s.name AS supplier, po.purchase_date, po.total_amount, po.status
             FROM purchases po JOIN suppliers s ON s.id=po.supplier_id
             WHERE po.purchase_date BETWEEN ? AND ? ORDER BY po.purchase_date DESC'
        );
        $stmt->execute([$from, $to]);
        $rows = $stmt->fetchAll();
        return [
            'title'   => "Purchase Report ($from to $to)",
            'columns' => ['Reference', 'Supplier', 'Date', 'Amount', 'Status'],
            'rows'    => array_map(fn($r) => array_values($r), $rows),
            'summary' => ['Total purchases' => number_format(array_sum(array_column($rows, 'total_amount')), 2)],
        ];
    }

    public function sales(array $f = []): array
    {
        [$from, $to] = $this->range($f);
        $stmt = $this->db->prepare(
            'SELECT s.invoice_no, COALESCE(c.name,"Walk-in") AS customer, s.sale_date,
                    s.subtotal, s.discount, s.tax, s.total_amount, s.payment_status
             FROM sales s LEFT JOIN customers c ON c.id=s.customer_id
             WHERE s.sale_date BETWEEN ? AND ? ORDER BY s.sale_date DESC'
        );
        $stmt->execute([$from, $to]);
        $rows = $stmt->fetchAll();
        return [
            'title'   => "Sales Report ($from to $to)",
            'columns' => ['Invoice', 'Customer', 'Date', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment'],
            'rows'    => array_map(fn($r) => array_values($r), $rows),
            'summary' => ['Total sales' => number_format(array_sum(array_column($rows, 'total_amount')), 2)],
        ];
    }

    public function supplier(array $f = []): array
    {
        $rows = $this->db->query(
            'SELECT s.name, s.company, s.phone, s.city,
                    COUNT(po.id) AS orders, COALESCE(SUM(po.total_amount),0) AS total
             FROM suppliers s LEFT JOIN purchases po ON po.supplier_id=s.id
             GROUP BY s.id ORDER BY total DESC'
        )->fetchAll();
        return [
            'title'   => 'Supplier Report',
            'columns' => ['Name', 'Company', 'Phone', 'City', 'Orders', 'Total Value'],
            'rows'    => array_map(fn($r) => array_values($r), $rows),
        ];
    }

    public function customer(array $f = []): array
    {
        $rows = $this->db->query(
            'SELECT c.name, c.phone, c.city,
                    COUNT(s.id) AS purchases, COALESCE(SUM(s.total_amount),0) AS spent
             FROM customers c LEFT JOIN sales s ON s.customer_id=c.id
             GROUP BY c.id ORDER BY spent DESC'
        )->fetchAll();
        return [
            'title'   => 'Customer Report',
            'columns' => ['Name', 'Phone', 'City', 'Purchases', 'Total Spent'],
            'rows'    => array_map(fn($r) => array_values($r), $rows),
        ];
    }

    public function profit(array $f = []): array
    {
        [$from, $to] = $this->range($f);
        $stmt = $this->db->prepare(
            'SELECT p.name, SUM(si.quantity) AS sold,
                    SUM(si.subtotal) AS revenue,
                    SUM(si.quantity*p.cost_price) AS cost,
                    SUM(si.subtotal - si.quantity*p.cost_price) AS profit
             FROM sale_items si
             JOIN sales s ON s.id=si.sale_id
             JOIN products p ON p.id=si.product_id
             WHERE s.sale_date BETWEEN ? AND ?
             GROUP BY p.id ORDER BY profit DESC'
        );
        $stmt->execute([$from, $to]);
        $rows = $stmt->fetchAll();
        $profit = array_sum(array_column($rows, 'profit'));
        return [
            'title'   => "Profit Analysis ($from to $to)",
            'columns' => ['Product', 'Units Sold', 'Revenue', 'Cost', 'Profit'],
            'rows'    => array_map(fn($r) => array_values($r), $rows),
            'summary' => ['Net profit' => number_format($profit, 2)],
        ];
    }

    private function m($v): string { return number_format((float) $v, 2, '.', ''); }

    /** GST/Tax — slab-wise CGST/SGST + B2B/B2C summary. */
    public function gst(array $f = []): array
    {
        [$from, $to] = $this->range($f);
        $stmt = $this->db->prepare(
            'SELECT tax_rate, COUNT(*) invoices, COALESCE(SUM(subtotal-discount),0) taxable, COALESCE(SUM(tax),0) tax
             FROM sales WHERE sale_date BETWEEN ? AND ? GROUP BY tax_rate ORDER BY tax_rate ASC'
        );
        $stmt->execute([$from, $to]);
        $rows = []; $totTaxable = 0; $totTax = 0;
        foreach ($stmt->fetchAll() as $r) {
            $tax = (float) $r['tax'];
            $rows[] = [$r['tax_rate'] . '%', $r['invoices'], $this->m($r['taxable']), $this->m($tax / 2), $this->m($tax / 2), $this->m($tax)];
            $totTaxable += (float) $r['taxable']; $totTax += $tax;
        }
        $bb = $this->db->prepare(
            'SELECT CASE WHEN customer_id IS NULL THEN "B2C" ELSE "B2B" END kind, COUNT(*) c, COALESCE(SUM(total_amount),0) t
             FROM sales WHERE sale_date BETWEEN ? AND ? GROUP BY kind'
        );
        $bb->execute([$from, $to]);
        $b = ['B2B' => ['c' => 0, 't' => 0], 'B2C' => ['c' => 0, 't' => 0]];
        foreach ($bb->fetchAll() as $r) $b[$r['kind']] = ['c' => $r['c'], 't' => $r['t']];
        return [
            'title'   => "GST / Tax Report ($from to $to)",
            'columns' => ['GST Slab', 'Invoices', 'Taxable Value', 'CGST', 'SGST', 'Total Tax'],
            'rows'    => $rows,
            'summary' => [
                'Total taxable' => $this->m($totTaxable),
                'CGST' => $this->m($totTax / 2), 'SGST' => $this->m($totTax / 2),
                'Total GST' => $this->m($totTax),
                'B2B (invoices)' => $b['B2B']['c'] . ' / ' . $this->m($b['B2B']['t']),
                'B2C (invoices)' => $b['B2C']['c'] . ' / ' . $this->m($b['B2C']['t']),
            ],
        ];
    }

    /** HSN/SAC-wise tax summary (for GST filing). */
    public function hsn(array $f = []): array
    {
        [$from, $to] = $this->range($f);
        $stmt = $this->db->prepare(
            'SELECT COALESCE(NULLIF(p.hsn_code,""),"—") hsn, SUM(si.quantity) qty,
                    COALESCE(SUM(si.subtotal),0) taxable,
                    COALESCE(SUM(si.subtotal * s.tax_rate/100),0) tax
             FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id
             WHERE s.sale_date BETWEEN ? AND ?
             GROUP BY p.hsn_code ORDER BY taxable DESC'
        );
        $stmt->execute([$from, $to]);
        $rows = []; $totTax = 0; $totTaxable = 0;
        foreach ($stmt->fetchAll() as $r) {
            $tax = (float) $r['tax'];
            $rows[] = [$r['hsn'], (int) $r['qty'], $this->m($r['taxable']), $this->m($tax / 2), $this->m($tax / 2), $this->m($tax)];
            $totTax += $tax; $totTaxable += (float) $r['taxable'];
        }
        return [
            'title'   => "HSN Summary ($from to $to)",
            'columns' => ['HSN/SAC', 'Qty Sold', 'Taxable', 'CGST', 'SGST', 'Total Tax'],
            'rows'    => $rows,
            'summary' => ['Total taxable' => $this->m($totTaxable), 'Total tax' => $this->m($totTax)],
        ];
    }

    /** Payment-mode collections (cash/upi/card). */
    public function payments(array $f = []): array
    {
        [$from, $to] = $this->range($f);
        $stmt = $this->db->prepare(
            'SELECT sp.mode, COUNT(*) txns, COALESCE(SUM(sp.amount),0) amount
             FROM sale_payments sp JOIN sales s ON s.id=sp.sale_id
             WHERE s.sale_date BETWEEN ? AND ? GROUP BY sp.mode ORDER BY amount DESC'
        );
        $stmt->execute([$from, $to]);
        $rows = []; $tot = 0;
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [ucfirst($r['mode']), $r['txns'], $this->m($r['amount'])];
            $tot += (float) $r['amount'];
        }
        return [
            'title'   => "Payment Mode Report ($from to $to)",
            'columns' => ['Payment Mode', 'Transactions', 'Amount Collected'],
            'rows'    => $rows,
            'summary' => ['Total collected' => $this->m($tot)],
        ];
    }

    /** Outstanding dues / receivables with ageing buckets. */
    public function dues(array $f = []): array
    {
        $rows = $this->db->query(
            'SELECT s.invoice_no, COALESCE(c.name,"Walk-in") customer, s.sale_date,
                    s.total_amount, s.paid_amount, (s.total_amount-s.paid_amount) due,
                    DATEDIFF(CURDATE(), s.sale_date) age
             FROM sales s LEFT JOIN customers c ON c.id=s.customer_id
             WHERE s.payment_status<>"paid" AND (s.total_amount-s.paid_amount)>0
             ORDER BY s.sale_date ASC'
        )->fetchAll();
        $out = []; $b = ['0–30' => 0, '31–60' => 0, '60+' => 0]; $tot = 0;
        foreach ($rows as $r) {
            $age = (int) $r['age'];
            $bucket = $age <= 30 ? '0–30' : ($age <= 60 ? '31–60' : '60+');
            $b[$bucket] += (float) $r['due']; $tot += (float) $r['due'];
            $out[] = [$r['invoice_no'], $r['customer'], $r['sale_date'], $this->m($r['total_amount']),
                      $this->m($r['paid_amount']), $this->m($r['due']), $age . 'd', $bucket];
        }
        return [
            'title'   => 'Outstanding Dues / Receivables',
            'columns' => ['Invoice', 'Customer', 'Date', 'Total', 'Paid', 'Due', 'Age', 'Bucket'],
            'rows'    => $out,
            'summary' => [
                'Total due' => $this->m($tot), 'Invoices' => count($out),
                '0–30 days' => $this->m($b['0–30']), '31–60 days' => $this->m($b['31–60']), '60+ days' => $this->m($b['60+']),
            ],
        ];
    }

    /** Expenses grouped by category. */
    public function expense(array $f = []): array
    {
        [$from, $to] = $this->range($f);
        $stmt = $this->db->prepare(
            'SELECT category, COUNT(*) entries, COALESCE(SUM(amount),0) total
             FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY category ORDER BY total DESC'
        );
        $stmt->execute([$from, $to]);
        $rows = []; $tot = 0;
        foreach ($stmt->fetchAll() as $r) { $rows[] = [$r['category'], $r['entries'], $this->m($r['total'])]; $tot += (float) $r['total']; }
        return [
            'title'   => "Expense Report ($from to $to)",
            'columns' => ['Category', 'Entries', 'Total'],
            'rows'    => $rows,
            'summary' => ['Total expenses' => $this->m($tot)],
        ];
    }

    /** Real Profit & Loss: Net Sales − COGS − Expenses. */
    public function pnl(array $f = []): array
    {
        [$from, $to] = $this->range($f);
        $s = $this->db->prepare('SELECT COALESCE(SUM(total_amount),0) total, COALESCE(SUM(subtotal-discount),0) net, COALESCE(SUM(tax),0) tax, COALESCE(SUM(discount),0) disc FROM sales WHERE sale_date BETWEEN ? AND ?');
        $s->execute([$from, $to]); $sa = $s->fetch();
        $c = $this->db->prepare('SELECT COALESCE(SUM(si.quantity*p.cost_price),0) cogs FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id WHERE s.sale_date BETWEEN ? AND ?');
        $c->execute([$from, $to]); $cogs = (float) $c->fetchColumn();
        $e = $this->db->prepare('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date BETWEEN ? AND ?');
        $e->execute([$from, $to]); $exp = (float) $e->fetchColumn();
        $net = (float) $sa['net']; $gross = $net - $cogs; $netProfit = $gross - $exp;
        return [
            'title'   => "Profit & Loss ($from to $to)",
            'columns' => ['Particulars', 'Amount'],
            'rows'    => [
                ['Gross Sales (incl. tax)', $this->m($sa['total'])],
                ['Less: Discounts given', $this->m($sa['disc'])],
                ['Net Sales (taxable)', $this->m($net)],
                ['Less: Cost of Goods Sold', $this->m($cogs)],
                ['Gross Profit', $this->m($gross)],
                ['Less: Expenses', $this->m($exp)],
                ['NET PROFIT', $this->m($netProfit)],
                ['GST Collected (payable)', $this->m($sa['tax'])],
            ],
            'summary' => ['Net profit' => $this->m($netProfit), 'Gross profit' => $this->m($gross), 'Expenses' => $this->m($exp)],
        ];
    }

    /** Date-wise sales summary. */
    public function sales_summary(array $f = []): array
    {
        [$from, $to] = $this->range($f);
        $stmt = $this->db->prepare(
            'SELECT sale_date, COUNT(*) invoices, COALESCE(SUM(total_amount),0) total,
                    COALESCE(AVG(total_amount),0) avg_bill, COALESCE(SUM(total_amount-paid_amount),0) due
             FROM sales WHERE sale_date BETWEEN ? AND ? GROUP BY sale_date ORDER BY sale_date DESC'
        );
        $stmt->execute([$from, $to]);
        $rows = []; $tot = 0; $inv = 0;
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [$r['sale_date'], $r['invoices'], $this->m($r['total']), $this->m($r['avg_bill']), $this->m($r['due'])];
            $tot += (float) $r['total']; $inv += (int) $r['invoices'];
        }
        return [
            'title'   => "Sales Summary ($from to $to)",
            'columns' => ['Date', 'Invoices', 'Total Sales', 'Avg Bill', 'Dues'],
            'rows'    => $rows,
            'summary' => ['Total sales' => $this->m($tot), 'Total invoices' => $inv, 'Avg/bill' => $this->m($inv ? $tot / $inv : 0)],
        ];
    }

    /** Stock valuation at cost & selling price. */
    public function stock_valuation(array $f = []): array
    {
        $rows = $this->db->query(
            'SELECT p.sku, p.name, c.name category, p.quantity,
                    (p.quantity*p.cost_price) cost_value, (p.quantity*p.selling_price) sell_value,
                    (p.quantity*(p.selling_price-p.cost_price)) margin
             FROM products p JOIN categories c ON c.id=p.category_id
             WHERE p.status="active" ORDER BY cost_value DESC'
        )->fetchAll();
        $tc = 0; $ts = 0; $out = [];
        foreach ($rows as $r) {
            $out[] = [$r['sku'], $r['name'], $r['category'], $r['quantity'], $this->m($r['cost_value']), $this->m($r['sell_value']), $this->m($r['margin'])];
            $tc += (float) $r['cost_value']; $ts += (float) $r['sell_value'];
        }
        return [
            'title'   => 'Stock Valuation Report',
            'columns' => ['SKU', 'Name', 'Category', 'Qty', 'Cost Value', 'Sell Value', 'Potential Margin'],
            'rows'    => $out,
            'summary' => ['Total cost value' => $this->m($tc), 'Total sell value' => $this->m($ts), 'Potential margin' => $this->m($ts - $tc)],
        ];
    }

    /** Items at/below reorder level with a suggested order quantity. */
    public function low_stock(array $f = []): array
    {
        $rows = $this->db->query(
            'SELECT p.sku, p.name, c.name category, p.quantity, p.reorder_level,
                    GREATEST(p.reorder_level*2 - p.quantity, p.reorder_level) suggested
             FROM products p JOIN categories c ON c.id=p.category_id
             WHERE p.status="active" AND p.quantity<=p.reorder_level ORDER BY p.quantity ASC'
        )->fetchAll();
        return [
            'title'   => 'Low Stock / Reorder Report',
            'columns' => ['SKU', 'Name', 'Category', 'In Stock', 'Reorder Level', 'Suggested Order Qty'],
            'rows'    => array_map(fn($r) => array_values($r), $rows),
            'summary' => ['Items to reorder' => count($rows)],
        ];
    }

    /** Slow-moving / dead stock — in stock but not sold in the period. */
    public function dead_stock(array $f = []): array
    {
        [$from, $to] = $this->range($f);
        $stmt = $this->db->prepare(
            'SELECT p.sku, p.name, c.name category, p.quantity, p.selling_price, (p.quantity*p.cost_price) capital
             FROM products p JOIN categories c ON c.id=p.category_id
             WHERE p.status="active" AND p.quantity>0
               AND p.id NOT IN (SELECT si.product_id FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.sale_date BETWEEN ? AND ?)
             ORDER BY capital DESC'
        );
        $stmt->execute([$from, $to]);
        $rows = $stmt->fetchAll(); $cap = 0; $out = [];
        foreach ($rows as $r) { $out[] = [$r['sku'], $r['name'], $r['category'], $r['quantity'], $this->m($r['selling_price']), $this->m($r['capital'])]; $cap += (float) $r['capital']; }
        return [
            'title'   => "Dead / Slow Stock (no sales $from to $to)",
            'columns' => ['SKU', 'Name', 'Category', 'Qty', 'Price', 'Capital Locked'],
            'rows'    => $out,
            'summary' => ['Dead items' => count($out), 'Capital locked' => $this->m($cap)],
        ];
    }

    /** Stock movement ledger for the period. */
    public function stock_ledger(array $f = []): array
    {
        [$from, $to] = $this->range($f);
        $stmt = $this->db->prepare(
            'SELECT st.created_at, p.sku, p.name, st.type, st.quantity, st.quantity_before, st.quantity_after, COALESCE(u.name,"System") by_user
             FROM stock_transactions st JOIN products p ON p.id=st.product_id LEFT JOIN users u ON u.id=st.created_by
             WHERE DATE(st.created_at) BETWEEN ? AND ? ORDER BY st.id DESC'
        );
        $stmt->execute([$from, $to]);
        return [
            'title'   => "Stock Movement Ledger ($from to $to)",
            'columns' => ['Date', 'SKU', 'Product', 'Type', 'Change', 'Before', 'After', 'By'],
            'rows'    => array_map(fn($r) => array_values($r), $stmt->fetchAll()),
        ];
    }

    /** Cashier / salesperson performance (who billed how much). */
    public function cashier(array $f = []): array
    {
        [$from, $to] = $this->range($f);
        $stmt = $this->db->prepare(
            'SELECT COALESCE(u.name,"Unknown") cashier, COALESCE(r.name,"—") role, COUNT(s.id) invoices,
                    COALESCE(SUM(s.total_amount),0) total, COALESCE(SUM(s.total_amount-s.paid_amount),0) dues
             FROM sales s LEFT JOIN users u ON u.id=s.created_by LEFT JOIN roles r ON r.id=u.role_id
             WHERE s.sale_date BETWEEN ? AND ? GROUP BY s.created_by ORDER BY total DESC'
        );
        $stmt->execute([$from, $to]);
        $rows = []; $tot = 0;
        foreach ($stmt->fetchAll() as $r) { $rows[] = [$r['cashier'], $r['role'], $r['invoices'], $this->m($r['total']), $this->m($r['dues'])]; $tot += (float) $r['total']; }
        return [
            'title'   => "Cashier / Salesperson Report ($from to $to)",
            'columns' => ['Cashier', 'Role', 'Invoices', 'Total Sales', 'Dues Pending'],
            'rows'    => $rows,
            'summary' => ['Total sales' => $this->m($tot)],
        ];
    }

    /** Customer ledger — billed vs paid vs balance. */
    public function customer_ledger(array $f = []): array
    {
        $rows = $this->db->query(
            'SELECT c.name, c.phone, COUNT(s.id) bills, COALESCE(SUM(s.total_amount),0) billed,
                    COALESCE(SUM(s.paid_amount),0) paid, COALESCE(SUM(s.total_amount-s.paid_amount),0) balance
             FROM customers c JOIN sales s ON s.customer_id=c.id
             GROUP BY c.id ORDER BY balance DESC, billed DESC'
        )->fetchAll();
        $bal = 0; $out = [];
        foreach ($rows as $r) { $out[] = [$r['name'], $r['phone'] ?: '—', $r['bills'], $this->m($r['billed']), $this->m($r['paid']), $this->m($r['balance'])]; $bal += (float) $r['balance']; }
        return [
            'title'   => 'Customer Ledger',
            'columns' => ['Customer', 'Phone', 'Bills', 'Total Billed', 'Paid', 'Balance Due'],
            'rows'    => $out,
            'summary' => ['Total receivable' => $this->m($bal)],
        ];
    }

    public function build(string $type, array $f = []): array
    {
        return match ($type) {
            'inventory'        => $this->inventory($f),
            'purchase'         => $this->purchase($f),
            'sales'            => $this->sales($f),
            'supplier'         => $this->supplier($f),
            'customer'         => $this->customer($f),
            'profit'           => $this->profit($f),
            'gst'              => $this->gst($f),
            'hsn'              => $this->hsn($f),
            'payments'         => $this->payments($f),
            'dues'             => $this->dues($f),
            'expense'          => $this->expense($f),
            'pnl'              => $this->pnl($f),
            'sales_summary'    => $this->sales_summary($f),
            'stock_valuation'  => $this->stock_valuation($f),
            'low_stock'        => $this->low_stock($f),
            'dead_stock'       => $this->dead_stock($f),
            'stock_ledger'     => $this->stock_ledger($f),
            'cashier'          => $this->cashier($f),
            'customer_ledger'  => $this->customer_ledger($f),
            default            => $this->product($f),
        };
    }
}
