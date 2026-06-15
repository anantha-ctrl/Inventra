<?php
/**
 * Writes audit/activity log rows.
 */
class ActivityLogger
{
    public static function log(?int $userId, string $action, string $module, string $description = ''): void
    {
        try {
            $db = Database::connection();
            $stmt = $db->prepare(
                'INSERT INTO activity_logs (user_id, action, module, description, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $userId,
                $action,
                $module,
                $description,
                $_SERVER['REMOTE_ADDR'] ?? null,
                substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
            ]);
        } catch (Throwable $e) {
            // Never let logging break the request
        }
    }
}
