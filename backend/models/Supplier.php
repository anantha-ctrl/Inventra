<?php
class Supplier extends Model
{
    protected string $table = 'suppliers';
    protected array $fillable = ['name','company','email','phone','address','city','country','status'];

    /** Purchase history for a supplier. */
    public function purchaseHistory(int $supplierId): array
    {
        $stmt = $this->db->prepare(
            'SELECT id, reference, purchase_date, total_amount, status
             FROM purchases WHERE supplier_id = ? ORDER BY purchase_date DESC'
        );
        $stmt->execute([$supplierId]);
        return $stmt->fetchAll();
    }
}
