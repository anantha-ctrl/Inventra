<?php
/**
 * Base model — thin active-record-ish helper around PDO.
 */
abstract class Model
{
    protected PDO $db;
    protected string $table;
    protected array $fillable = [];

    public function __construct()
    {
        $this->db = Database::connection();
    }

    public function all(string $orderBy = 'id DESC'): array
    {
        return $this->db->query("SELECT * FROM {$this->table} ORDER BY {$orderBy}")->fetchAll();
    }

    public function find(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findBy(string $column, $value): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE {$column} = ? LIMIT 1");
        $stmt->execute([$value]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(array $data): int
    {
        $data    = $this->only($data);
        $cols    = array_keys($data);
        $place   = array_map(fn($c) => ":$c", $cols);
        $sql     = "INSERT INTO {$this->table} (" . implode(',', $cols) . ") VALUES (" . implode(',', $place) . ")";
        $stmt    = $this->db->prepare($sql);
        $stmt->execute($data);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool
    {
        $data = $this->only($data);
        if (empty($data)) return false;
        $set  = implode(', ', array_map(fn($c) => "$c = :$c", array_keys($data)));
        $data['id'] = $id;
        $stmt = $this->db->prepare("UPDATE {$this->table} SET {$set} WHERE id = :id");
        return $stmt->execute($data);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM {$this->table} WHERE id = ?");
        return $stmt->execute([$id]);
    }

    public function count(string $where = '', array $params = []): int
    {
        $sql = "SELECT COUNT(*) FROM {$this->table}" . ($where ? " WHERE $where" : '');
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Generic paginated listing with optional LIKE search across columns
     * and optional equality filters.
     *
     * @param string[] $searchCols  columns to OR-search with LIKE
     * @param array    $filters     column => value equality filters
     */
    public function paginateRows(int $page, int $perPage, string $search = '', array $searchCols = [], array $filters = [], string $orderBy = 'id DESC'): array
    {
        $offset = ($page - 1) * $perPage;
        $clauses = [];
        $params  = [];

        if ($search !== '' && $searchCols) {
            $likes = [];
            foreach ($searchCols as $i => $col) {
                $likes[] = "$col LIKE :s$i";
                $params[":s$i"] = "%$search%";
            }
            $clauses[] = '(' . implode(' OR ', $likes) . ')';
        }
        foreach ($filters as $col => $val) {
            if ($val === null || $val === '') continue;
            $key = ':f_' . preg_replace('/\W/', '', $col);
            $clauses[] = "$col = $key";
            $params[$key] = $val;
        }
        $where = $clauses ? 'WHERE ' . implode(' AND ', $clauses) : '';

        $stmt = $this->db->prepare("SELECT * FROM {$this->table} $where ORDER BY $orderBy LIMIT :lim OFFSET :off");
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue(':lim', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $cStmt = $this->db->prepare("SELECT COUNT(*) FROM {$this->table} $where");
        $cStmt->execute($params);
        return [$rows, (int) $cStmt->fetchColumn()];
    }

    /** Keep only fillable columns. */
    protected function only(array $data): array
    {
        if (empty($this->fillable)) return $data;
        return array_intersect_key($data, array_flip($this->fillable));
    }

    public function db(): PDO
    {
        return $this->db;
    }
}
