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

    public function build(string $type, array $f = []): array
    {
        return match ($type) {
            'inventory' => $this->inventory($f),
            'purchase'  => $this->purchase($f),
            'sales'     => $this->sales($f),
            'supplier'  => $this->supplier($f),
            'customer'  => $this->customer($f),
            'profit'    => $this->profit($f),
            default     => $this->product($f),
        };
    }
}
