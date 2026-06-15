<?php
class Purchase extends Model
{
    protected string $table = 'purchases';
    protected array $fillable = ['reference','supplier_id','purchase_date','total_amount','status','notes','created_by','approved_by','approved_at'];

    public function paginateJoined(int $page, int $perPage, string $search, array $filters): array
    {
        $offset  = ($page - 1) * $perPage;
        $clauses = [];
        $params  = [];
        if ($search !== '') {
            $clauses[] = '(po.reference LIKE :s1 OR s.name LIKE :s2)';
            $params[':s1'] = "%$search%";
            $params[':s2'] = "%$search%";
        }
        if (!empty($filters['status'])) {
            $clauses[] = 'po.status = :st';
            $params[':st'] = $filters['status'];
        }
        $where = $clauses ? 'WHERE ' . implode(' AND ', $clauses) : '';

        $sql = "SELECT po.*, s.name AS supplier_name, u.name AS created_by_name
                FROM purchases po
                JOIN suppliers s ON s.id = po.supplier_id
                LEFT JOIN users u ON u.id = po.created_by
                $where ORDER BY po.id DESC LIMIT :lim OFFSET :off";
        $stmt = $this->db->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue(':lim', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $cStmt = $this->db->prepare("SELECT COUNT(*) FROM purchases po JOIN suppliers s ON s.id=po.supplier_id $where");
        $cStmt->execute($params);
        return [$rows, (int) $cStmt->fetchColumn()];
    }

    public function findWithItems(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT po.*, s.name AS supplier_name, s.company, s.email AS supplier_email,
                    u.name AS created_by_name, a.name AS approved_by_name
             FROM purchases po
             JOIN suppliers s ON s.id = po.supplier_id
             LEFT JOIN users u ON u.id = po.created_by
             LEFT JOIN users a ON a.id = po.approved_by
             WHERE po.id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        $purchase = $stmt->fetch();
        if (!$purchase) return null;

        $itemStmt = $this->db->prepare(
            'SELECT pi.*, p.name AS product_name, p.sku
             FROM purchase_items pi JOIN products p ON p.id = pi.product_id
             WHERE pi.purchase_id = ?'
        );
        $itemStmt->execute([$id]);
        $purchase['items'] = $itemStmt->fetchAll();
        return $purchase;
    }

    public function nextReference(): string
    {
        $year = date('Y');
        $stmt = $this->db->prepare("SELECT reference FROM purchases WHERE reference LIKE ? ORDER BY id DESC LIMIT 1");
        $stmt->execute(["PO-$year-%"]);
        $last = $stmt->fetchColumn();
        $n = $last ? ((int) substr($last, -4)) + 1 : 1;
        return sprintf('PO-%s-%04d', $year, $n);
    }
}
