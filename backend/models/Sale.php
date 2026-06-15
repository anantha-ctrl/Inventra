<?php
class Sale extends Model
{
    protected string $table = 'sales';
    protected array $fillable = ['invoice_no','customer_id','sale_date','subtotal','discount','tax','total_amount','payment_status','notes','created_by'];

    public function paginateJoined(int $page, int $perPage, string $search, array $filters): array
    {
        $offset  = ($page - 1) * $perPage;
        $clauses = [];
        $params  = [];
        if ($search !== '') {
            $clauses[] = '(s.invoice_no LIKE :s1 OR c.name LIKE :s2)';
            $params[':s1'] = "%$search%";
            $params[':s2'] = "%$search%";
        }
        if (!empty($filters['payment_status'])) {
            $clauses[] = 's.payment_status = :ps';
            $params[':ps'] = $filters['payment_status'];
        }
        $where = $clauses ? 'WHERE ' . implode(' AND ', $clauses) : '';

        $sql = "SELECT s.*, c.name AS customer_name, u.name AS created_by_name
                FROM sales s
                LEFT JOIN customers c ON c.id = s.customer_id
                LEFT JOIN users u ON u.id = s.created_by
                $where ORDER BY s.id DESC LIMIT :lim OFFSET :off";
        $stmt = $this->db->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue(':lim', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $cStmt = $this->db->prepare("SELECT COUNT(*) FROM sales s LEFT JOIN customers c ON c.id=s.customer_id $where");
        $cStmt->execute($params);
        return [$rows, (int) $cStmt->fetchColumn()];
    }

    public function findWithItems(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT s.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
                    c.address AS customer_address, u.name AS created_by_name
             FROM sales s
             LEFT JOIN customers c ON c.id = s.customer_id
             LEFT JOIN users u ON u.id = s.created_by
             WHERE s.id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        $sale = $stmt->fetch();
        if (!$sale) return null;

        $itemStmt = $this->db->prepare(
            'SELECT si.*, p.name AS product_name, p.sku
             FROM sale_items si JOIN products p ON p.id = si.product_id
             WHERE si.sale_id = ?'
        );
        $itemStmt->execute([$id]);
        $sale['items'] = $itemStmt->fetchAll();
        return $sale;
    }

    public function nextInvoice(): string
    {
        $year = date('Y');
        $stmt = $this->db->prepare("SELECT invoice_no FROM sales WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1");
        $stmt->execute(["INV-$year-%"]);
        $last = $stmt->fetchColumn();
        $n = $last ? ((int) substr($last, -4)) + 1 : 1;
        return sprintf('INV-%s-%04d', $year, $n);
    }
}
