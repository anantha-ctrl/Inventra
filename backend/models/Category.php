<?php
class Category extends Model
{
    protected string $table = 'categories';
    protected array $fillable = ['name', 'description', 'status', 'created_by'];

    public function withProductCount(): array
    {
        return $this->db->query(
            'SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
             FROM categories c ORDER BY c.name ASC'
        )->fetchAll();
    }
}
