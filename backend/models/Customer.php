<?php
class Customer extends Model
{
    protected string $table = 'customers';
    protected array $fillable = ['name','email','phone','address','city','status'];

    /** Purchase (sales) history for a customer. */
    public function salesHistory(int $customerId): array
    {
        $stmt = $this->db->prepare(
            'SELECT id, invoice_no, sale_date, total_amount, payment_status
             FROM sales WHERE customer_id = ? ORDER BY sale_date DESC'
        );
        $stmt->execute([$customerId]);
        return $stmt->fetchAll();
    }
}
