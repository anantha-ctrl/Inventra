<?php
/**
 * Creates notification rows (low stock, out of stock, purchase approval).
 */
class Notifier
{
    public static function push(string $type, string $title, string $message, ?int $referenceId = null): void
    {
        try {
            $db = Database::connection();
            $stmt = $db->prepare(
                'INSERT INTO notifications (type, title, message, reference_id) VALUES (?, ?, ?, ?)'
            );
            $stmt->execute([$type, $title, $message, $referenceId]);
        } catch (Throwable $e) {
            // swallow
        }
    }

    /** Inspect a product and raise low/out-of-stock notifications when needed. */
    public static function checkStock(array $product): void
    {
        try {
            $settingModel = new Setting();
            $settings = $settingModel->get();
            $enableAlerts = isset($settings['enable_alerts']) ? (bool)$settings['enable_alerts'] : true;
            if (!$enableAlerts) return;
        } catch (Throwable $e) {
            if (!LOW_STOCK_ENABLED) return;
        }
        $qty   = (int) $product['quantity'];
        $level = (int) $product['reorder_level'];
        $name  = $product['name'];
        $id    = (int) $product['id'];

        if ($qty <= 0) {
            self::push('out_of_stock', 'Out of stock', "$name is out of stock", $id);
        } elseif ($qty <= $level) {
            self::push('low_stock', 'Low stock alert', "$name is below reorder level ($qty/$level)", $id);
        }
    }
}
