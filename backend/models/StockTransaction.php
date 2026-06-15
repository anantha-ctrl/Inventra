<?php
class StockTransaction extends Model
{
    protected string $table = 'stock_transactions';
    protected array $fillable = ['product_id','type','quantity','quantity_before','quantity_after','reference_type','reference_id','note','created_by'];

    /**
     * Record a stock movement and update the product quantity atomically.
     * $signedQty: positive for additions, negative for removals.
     */
    public function record(int $productId, string $type, int $signedQty, string $refType = 'manual', ?int $refId = null, string $note = '', ?int $userId = null): int
    {
        $product = (new Product())->find($productId);
        $before  = (int) $product['quantity'];
        $after   = $before + $signedQty;

        $this->db->prepare('UPDATE products SET quantity = ? WHERE id = ?')->execute([$after, $productId]);

        return $this->create([
            'product_id'      => $productId,
            'type'            => $type,
            'quantity'        => $signedQty,
            'quantity_before' => $before,
            'quantity_after'  => $after,
            'reference_type'  => $refType,
            'reference_id'    => $refId,
            'note'            => $note,
            'created_by'      => $userId,
        ]);
    }

    public function paginateJoined(int $page, int $perPage, string $search, array $filters): array
    {
        $offset  = ($page - 1) * $perPage;
        $clauses = [];
        $params  = [];
        if ($search !== '') {
            $clauses[] = '(p.name LIKE :s1 OR p.sku LIKE :s2 OR st.note LIKE :s3)';
            $params[':s1'] = "%$search%";
            $params[':s2'] = "%$search%";
            $params[':s3'] = "%$search%";
        }
        if (!empty($filters['type'])) {
            $clauses[] = 'st.type = :ty';
            $params[':ty'] = $filters['type'];
        }
        if (!empty($filters['product_id'])) {
            $clauses[] = 'st.product_id = :pid';
            $params[':pid'] = $filters['product_id'];
        }
        $where = $clauses ? 'WHERE ' . implode(' AND ', $clauses) : '';

        $sql = "SELECT st.*, p.name AS product_name, p.sku, u.name AS created_by_name
                FROM stock_transactions st
                JOIN products p ON p.id = st.product_id
                LEFT JOIN users u ON u.id = st.created_by
                $where ORDER BY st.id DESC LIMIT :lim OFFSET :off";
        $stmt = $this->db->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue(':lim', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $cStmt = $this->db->prepare("SELECT COUNT(*) FROM stock_transactions st JOIN products p ON p.id=st.product_id $where");
        $cStmt->execute($params);
        return [$rows, (int) $cStmt->fetchColumn()];
    }
}
