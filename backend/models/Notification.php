<?php
class Notification extends Model
{
    protected string $table = 'notifications';
    protected array $fillable = ['type','title','message','reference_id','is_read'];

    public function unreadCount(): int
    {
        return (int) $this->db->query('SELECT COUNT(*) FROM notifications WHERE is_read = 0')->fetchColumn();
    }

    public function markAllRead(): void
    {
        $this->db->exec('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
    }
}
