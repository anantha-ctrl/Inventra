<?php
class HeldSale extends Model
{
    protected string $table = 'held_sales';
    protected array $fillable = ['label','customer_id','cart','note','created_by'];

    /** List parked bills with customer name + item count. */
    public function allJoined(): array
    {
        return $this->db->query(
            'SELECT h.id, h.label, h.customer_id, h.cart, h.note, h.created_at,
                    c.name AS customer_name, u.name AS created_by_name
             FROM held_sales h
             LEFT JOIN customers c ON c.id = h.customer_id
             LEFT JOIN users u ON u.id = h.created_by
             ORDER BY h.id DESC'
        )->fetchAll();
    }
}
