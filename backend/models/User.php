<?php
class User extends Model
{
    protected string $table = 'users';
    protected array $fillable = ['role_id','name','email','password','phone','avatar','status','reset_token','reset_token_expiry','last_login'];

    /** Find a user joined with role name. */
    public function findWithRole(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function findByEmailWithRole(string $email): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ? LIMIT 1'
        );
        $stmt->execute([$email]);
        return $stmt->fetch() ?: null;
    }

    public function paginate(int $page, int $perPage, string $search = ''): array
    {
        $offset = ($page - 1) * $perPage;
        $where  = '';
        $params = [];
        if ($search !== '') {
            $where = 'WHERE u.name LIKE :s1 OR u.email LIKE :s2';
            $params[':s1'] = "%$search%";
            $params[':s2'] = "%$search%";
        }
        $sql = "SELECT u.id,u.name,u.email,u.phone,u.status,u.last_login,u.created_at,r.name AS role
                FROM users u JOIN roles r ON r.id=u.role_id $where
                ORDER BY u.id DESC LIMIT :lim OFFSET :off";
        $stmt = $this->db->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue(':lim', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows  = $stmt->fetchAll();

        $cStmt = $this->db->prepare("SELECT COUNT(*) FROM users u $where");
        $cStmt->execute($params);
        return [$rows, (int) $cStmt->fetchColumn()];
    }
}
