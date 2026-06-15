<?php
class Product extends Model
{
    protected string $table = 'products';
    protected array $fillable = ['category_id','supplier_id','name','sku','barcode','description','unit',
        'cost_price','selling_price','quantity','reorder_level','image','status','created_by'];

    public function paginateJoined(int $page, int $perPage, string $search, array $filters): array
    {
        $offset  = ($page - 1) * $perPage;
        $clauses = [];
        $params  = [];

        if ($search !== '') {
            $clauses[] = '(p.name LIKE :s1 OR p.sku LIKE :s2 OR p.barcode LIKE :s3)';
            $params[':s1'] = "%$search%";
            $params[':s2'] = "%$search%";
            $params[':s3'] = "%$search%";
        }
        if (!empty($filters['category_id'])) {
            $clauses[] = 'p.category_id = :cat';
            $params[':cat'] = $filters['category_id'];
        }
        if (!empty($filters['status'])) {
            $clauses[] = 'p.status = :st';
            $params[':st'] = $filters['status'];
        }
        if (!empty($filters['low_stock'])) {
            $clauses[] = 'p.quantity <= p.reorder_level';
        }
        $where = $clauses ? 'WHERE ' . implode(' AND ', $clauses) : '';

        $sql = "SELECT p.*, c.name AS category_name, s.name AS supplier_name
                FROM products p
                JOIN categories c ON c.id = p.category_id
                LEFT JOIN suppliers s ON s.id = p.supplier_id
                $where ORDER BY p.id DESC LIMIT :lim OFFSET :off";
        $stmt = $this->db->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue(':lim', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $cStmt = $this->db->prepare("SELECT COUNT(*) FROM products p $where");
        $cStmt->execute($params);
        return [$rows, (int) $cStmt->fetchColumn()];
    }

    public function findJoined(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT p.*, c.name AS category_name, s.name AS supplier_name
             FROM products p
             JOIN categories c ON c.id = p.category_id
             LEFT JOIN suppliers s ON s.id = p.supplier_id
             WHERE p.id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function lowStock(): array
    {
        return $this->db->query(
            'SELECT id, name, sku, quantity, reorder_level FROM products
             WHERE status = "active" AND quantity <= reorder_level ORDER BY quantity ASC'
        )->fetchAll();
    }

    /** Adjust stock and return the resulting quantity. */
    public function adjustQuantity(int $id, int $delta): int
    {
        $this->db->prepare('UPDATE products SET quantity = quantity + ? WHERE id = ?')
                 ->execute([$delta, $id]);
        return (int) $this->find($id)['quantity'];
    }

    /** Generate next SKU for a category, e.g. ELE-0007. */
    public function nextSku(string $prefix): string
    {
        $prefix = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $prefix), 0, 3));
        if ($prefix === '') $prefix = 'PRD';
        $stmt = $this->db->prepare("SELECT sku FROM products WHERE sku LIKE ? ORDER BY id DESC LIMIT 1");
        $stmt->execute(["$prefix-%"]);
        $last = $stmt->fetchColumn();
        $n = $last ? ((int) substr($last, -4)) + 1 : 1;
        return sprintf('%s-%04d', $prefix, $n);
    }
}
