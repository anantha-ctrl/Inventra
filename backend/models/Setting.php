<?php
class Setting extends Model
{
    protected string $table = 'settings';
    protected array $fillable = [
        'company_name',
        'company_email',
        'company_phone',
        'currency',
        'currency_symbol',
        'low_stock_threshold',
        'timezone',
        'date_format',
        'enable_alerts',
        'enable_email',
        'role_permissions',
        'gstin',
        'shop_address',
        'shop_state',
        'upi_id'
    ];

    public function __construct()
    {
        parent::__construct();
        $this->ensureTableExists();
    }

    /** Helper to get settings. Since it's a single row, it always uses ID 1. */
    public function get(): array
    {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE id = 1 LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch();
        if (!$row) {
            // Seed defaults and refetch
            $this->seedDefaults();
            $stmt->execute();
            $row = $stmt->fetch();
        }
        if ($row) {
            if (empty($row['role_permissions'])) {
                $row['role_permissions'] = $this->defaultRolePermissions();
            } else {
                $row['role_permissions'] = json_decode($row['role_permissions'], true);
            }
        }
        return $row;
    }

    private function defaultRolePermissions(): array
    {
        return [
            'Staff' => [
                'products'      => true,
                'categories'    => true,
                'stock'         => true,
                'pos'           => true,
                'purchases'     => true,
                'sales'         => true,
                'suppliers'     => true,
                'customers'     => true,
                'reports'       => true,
                'notifications' => true,
                'activity-logs' => false,
                'users'         => false,
            ],
            'Manager' => [
                'products'      => true,
                'categories'    => true,
                'stock'         => true,
                'pos'           => true,
                'purchases'     => true,
                'sales'         => true,
                'suppliers'     => true,
                'customers'     => true,
                'reports'       => true,
                'notifications' => true,
                'activity-logs' => true,
                'users'         => false,
            ]
        ];
    }

    /** Save settings. Always updates ID 1. */
    public function saveSettings(array $data): bool
    {
        if (isset($data['role_permissions'])) {
            $data['role_permissions'] = is_array($data['role_permissions']) 
                ? json_encode($data['role_permissions']) 
                : $data['role_permissions'];
        }
        $data = $this->only($data);
        if (empty($data)) return false;
        
        $set = implode(', ', array_map(fn($c) => "$c = :$c", array_keys($data)));
        $stmt = $this->db->prepare("UPDATE {$this->table} SET {$set} WHERE id = 1");
        return $stmt->execute($data);
    }

    private function ensureTableExists(): void
    {
        try {
            $this->db->query("SELECT 1 FROM {$this->table} LIMIT 1");
            
            // Check and append missing columns dynamically
            $stmt = $this->db->query("DESCRIBE {$this->table}");
            $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            if (!in_array('date_format', $columns)) {
                $this->db->exec("ALTER TABLE {$this->table} ADD COLUMN date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD'");
            }
            if (!in_array('enable_alerts', $columns)) {
                $this->db->exec("ALTER TABLE {$this->table} ADD COLUMN enable_alerts TINYINT(1) DEFAULT 1");
            }
            if (!in_array('enable_email', $columns)) {
                $this->db->exec("ALTER TABLE {$this->table} ADD COLUMN enable_email TINYINT(1) DEFAULT 0");
            }
            if (!in_array('role_permissions', $columns)) {
                $this->db->exec("ALTER TABLE {$this->table} ADD COLUMN role_permissions TEXT NULL");
            }
            if (!in_array('gstin', $columns)) {
                $this->db->exec("ALTER TABLE {$this->table} ADD COLUMN gstin VARCHAR(20) NULL");
            }
            if (!in_array('shop_address', $columns)) {
                $this->db->exec("ALTER TABLE {$this->table} ADD COLUMN shop_address VARCHAR(255) NULL");
            }
            if (!in_array('shop_state', $columns)) {
                $this->db->exec("ALTER TABLE {$this->table} ADD COLUMN shop_state VARCHAR(80) NULL");
            }
            if (!in_array('upi_id', $columns)) {
                $this->db->exec("ALTER TABLE {$this->table} ADD COLUMN upi_id VARCHAR(120) NULL");
            }
        } catch (PDOException $e) {
            // Table doesn't exist, create it
            $sql = "CREATE TABLE IF NOT EXISTS {$this->table} (
                id INT PRIMARY KEY DEFAULT 1,
                company_name VARCHAR(150) NOT NULL DEFAULT 'StockHive',
                company_email VARCHAR(150) DEFAULT 'support@stockhive.test',
                company_phone VARCHAR(50) DEFAULT '9000000001',
                currency VARCHAR(10) DEFAULT 'INR',
                currency_symbol VARCHAR(10) DEFAULT '₹',
                low_stock_threshold INT DEFAULT 10,
                timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
                date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
                enable_alerts TINYINT(1) DEFAULT 1,
                enable_email TINYINT(1) DEFAULT 0,
                role_permissions TEXT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
            $this->db->exec($sql);
            $this->seedDefaults();
        }
    }

    private function seedDefaults(): void
    {
        $rolePermsJson = json_encode($this->defaultRolePermissions());
        $stmt = $this->db->prepare("INSERT IGNORE INTO {$this->table} (id, company_name, company_email, company_phone, currency, currency_symbol, low_stock_threshold, timezone, date_format, enable_alerts, enable_email, role_permissions) 
            VALUES (1, 'StockHive', 'support@stockhive.test', '9000000001', 'INR', '₹', 10, 'Asia/Kolkata', 'YYYY-MM-DD', 1, 0, ?)");
        $stmt->execute([$rolePermsJson]);
    }
}
