<?php
class DashboardController extends Controller
{
    public function stats(Request $req): void
    {
        $db = Database::connection();
        $scalar = fn(string $sql) => (int) $db->query($sql)->fetchColumn();
        $money  = fn(string $sql) => (float) $db->query($sql)->fetchColumn();

        // ----- Date range (today | week | month | year | custom) -----
        [$from, $to, $rangeLabel] = $this->resolveRange($req);
        // Prepared range filter for sales/purchases scoped numbers.
        $rangeMoney = function (string $table, string $dateCol, string $extra = '') use ($db, $from, $to) {
            $stmt = $db->prepare("SELECT COALESCE(SUM(total_amount),0) FROM $table WHERE $dateCol BETWEEN ? AND ? $extra");
            $stmt->execute([$from, $to]);
            return (float) $stmt->fetchColumn();
        };
        $rangeCount = function (string $table, string $dateCol) use ($db, $from, $to) {
            $stmt = $db->prepare("SELECT COUNT(*) FROM $table WHERE $dateCol BETWEEN ? AND ?");
            $stmt->execute([$from, $to]);
            return (int) $stmt->fetchColumn();
        };

        $data = [
            'total_products'    => $scalar('SELECT COUNT(*) FROM products'),
            'total_categories'  => $scalar('SELECT COUNT(*) FROM categories'),
            'total_suppliers'   => $scalar('SELECT COUNT(*) FROM suppliers'),
            'total_customers'   => $scalar('SELECT COUNT(*) FROM customers'),
            'total_purchases'   => $scalar('SELECT COUNT(*) FROM purchases'),
            'total_sales'       => $scalar('SELECT COUNT(*) FROM sales'),
            'low_stock_count'   => $scalar('SELECT COUNT(*) FROM products WHERE quantity <= reorder_level AND status="active"'),
            'out_of_stock'      => $scalar('SELECT COUNT(*) FROM products WHERE quantity <= 0 AND status="active"'),
            'pending_purchases' => $scalar('SELECT COUNT(*) FROM purchases WHERE status="pending"'),
            'revenue'           => $money('SELECT COALESCE(SUM(total_amount),0) FROM sales'),
            'purchase_value'    => $money('SELECT COALESCE(SUM(total_amount),0) FROM purchases WHERE status="received"'),
            'stock_value'       => $money('SELECT COALESCE(SUM(quantity*cost_price),0) FROM products'),
            'total_dues'        => $money('SELECT COALESCE(SUM(total_amount - paid_amount),0) FROM sales WHERE payment_status<>"paid"'),
            // ----- Range-scoped figures (react to the dashboard date filter) -----
            'range' => [
                'label'          => $rangeLabel,
                'from'           => $from,
                'to'             => $to,
                'sales_count'    => $rangeCount('sales', 'sale_date'),
                'sales_total'    => $rangeMoney('sales', 'sale_date'),
                'purchase_count' => $rangeCount('purchases', 'purchase_date'),
                'purchase_total' => $rangeMoney('purchases', 'purchase_date', 'AND status="received"'),
            ],
        ];

        // Sales last 7 days
        $data['sales_trend'] = $db->query(
            'SELECT DATE(sale_date) AS day, SUM(total_amount) AS total
             FROM sales WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
             GROUP BY DATE(sale_date) ORDER BY day ASC'
        )->fetchAll();

        // Monthly sales vs purchases (last 6 months)
        $data['monthly'] = $db->query(
            "SELECT m.ym,
                COALESCE(s.total,0) AS sales,
                COALESCE(p.total,0) AS purchases
             FROM (
                SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL n MONTH), '%Y-%m') AS ym
                FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) nums
             ) m
             LEFT JOIN (SELECT DATE_FORMAT(sale_date,'%Y-%m') ym, SUM(total_amount) total FROM sales GROUP BY ym) s ON s.ym=m.ym
             LEFT JOIN (SELECT DATE_FORMAT(purchase_date,'%Y-%m') ym, SUM(total_amount) total FROM purchases WHERE status='received' GROUP BY ym) p ON p.ym=m.ym
             ORDER BY m.ym ASC"
        )->fetchAll();

        // Products per category (for pie/doughnut)
        $data['category_distribution'] = $db->query(
            'SELECT c.name, COUNT(p.id) AS count
             FROM categories c LEFT JOIN products p ON p.category_id=c.id
             GROUP BY c.id ORDER BY count DESC'
        )->fetchAll();

        // Top 5 selling products
        $data['top_products'] = $db->query(
            'SELECT p.name, SUM(si.quantity) AS sold, SUM(si.subtotal) AS revenue
             FROM sale_items si JOIN products p ON p.id=si.product_id
             GROUP BY p.id ORDER BY sold DESC LIMIT 5'
        )->fetchAll();

        // Low stock products list
        $data['low_stock_products'] = (new Product())->lowStock();

        // Recent activities
        $data['recent_activities'] = $db->query(
            'SELECT a.action, a.module, a.description, a.created_at, u.name AS user_name
             FROM activity_logs a LEFT JOIN users u ON u.id=a.user_id
             ORDER BY a.id DESC LIMIT 8'
        )->fetchAll();

        Response::success($data);
    }

    /** Resolve ?range=today|week|month|year or ?from=&to= into [from, to, label]. */
    private function resolveRange(Request $req): array
    {
        $today = date('Y-m-d');
        $from  = trim((string) $req->query('from', ''));
        $to    = trim((string) $req->query('to', ''));
        if ($from !== '' && $to !== '') {
            return [$from, $to, 'Custom'];
        }
        $range = (string) $req->query('range', 'month');
        switch ($range) {
            case 'today': return [$today, $today, 'Today'];
            case 'week':  return [date('Y-m-d', strtotime('-6 days')), $today, 'Last 7 days'];
            case 'year':  return [date('Y-01-01'), $today, 'This year'];
            case 'month':
            default:      return [date('Y-m-01'), $today, 'This month'];
        }
    }
}
