<?php
class ActivityLog extends Model
{
    protected string $table = 'activity_logs';

    public function paginateJoined(int $page, int $perPage, string $search, array $filters): array
    {
        $offset  = ($page - 1) * $perPage;
        $clauses = [];
        $params  = [];
        if ($search !== '') {
            $clauses[] = '(a.description LIKE :s1 OR u.name LIKE :s2)';
            $params[':s1'] = "%$search%";
            $params[':s2'] = "%$search%";
        }
        if (!empty($filters['module'])) {
            $clauses[] = 'a.module = :m';
            $params[':m'] = $filters['module'];
        }
        if (!empty($filters['action'])) {
            $clauses[] = 'a.action = :ac';
            $params[':ac'] = $filters['action'];
        }
        $where = $clauses ? 'WHERE ' . implode(' AND ', $clauses) : '';

        $sql = "SELECT a.*, u.name AS user_name
                FROM activity_logs a
                LEFT JOIN users u ON u.id = a.user_id
                $where ORDER BY a.id DESC LIMIT :lim OFFSET :off";
        $stmt = $this->db->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue(':lim', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $cStmt = $this->db->prepare("SELECT COUNT(*) FROM activity_logs a LEFT JOIN users u ON u.id=a.user_id $where");
        $cStmt->execute($params);
        return [$rows, (int) $cStmt->fetchColumn()];
    }
}
