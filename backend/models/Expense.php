<?php
class Expense extends Model
{
    protected string $table = 'expenses';
    protected array $fillable = ['category','amount','expense_date','payment_mode','note','created_by'];

    public function paginateJoined(int $page, int $perPage, string $search, array $filters): array
    {
        $offset  = ($page - 1) * $perPage;
        $clauses = [];
        $params  = [];
        if ($search !== '') {
            $clauses[] = '(e.category LIKE :s1 OR e.note LIKE :s2)';
            $params[':s1'] = "%$search%";
            $params[':s2'] = "%$search%";
        }
        if (!empty($filters['from'])) { $clauses[] = 'e.expense_date >= :from'; $params[':from'] = $filters['from']; }
        if (!empty($filters['to']))   { $clauses[] = 'e.expense_date <= :to';   $params[':to']   = $filters['to']; }
        if (!empty($filters['category'])) { $clauses[] = 'e.category = :cat'; $params[':cat'] = $filters['category']; }
        $where = $clauses ? 'WHERE ' . implode(' AND ', $clauses) : '';

        $sql = "SELECT e.*, u.name AS created_by_name
                FROM expenses e LEFT JOIN users u ON u.id = e.created_by
                $where ORDER BY e.expense_date DESC, e.id DESC LIMIT :lim OFFSET :off";
        $stmt = $this->db->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue(':lim', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $cStmt = $this->db->prepare("SELECT COUNT(*) FROM expenses e $where");
        $cStmt->execute($params);
        return [$rows, (int) $cStmt->fetchColumn()];
    }

    /** Total expenses between two dates (inclusive). */
    public function totalBetween(string $from, string $to): float
    {
        $stmt = $this->db->prepare('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date BETWEEN ? AND ?');
        $stmt->execute([$from, $to]);
        return (float) $stmt->fetchColumn();
    }
}
