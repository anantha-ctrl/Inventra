-- ============================================================================
--  StockHive — Feature upgrade migration
--  Adds: GST tax-rate + payment/due tracking on sales.
--  Safe to run multiple times (guards via INFORMATION_SCHEMA).
-- ============================================================================
USE stockhive;

-- ----- sales.tax_rate (GST % entered on the invoice) -----
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'tax_rate');
SET @sql := IF(@col = 0,
  'ALTER TABLE sales ADD COLUMN tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER tax',
  'SELECT "tax_rate already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----- sales.paid_amount (how much the customer has actually paid) -----
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'paid_amount');
SET @sql := IF(@col = 0,
  'ALTER TABLE sales ADD COLUMN paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER total_amount',
  'SELECT "paid_amount already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill paid_amount for existing rows so dues are accurate:
--   paid   -> fully paid, partial -> half (best guess), unpaid -> 0
UPDATE sales SET paid_amount = total_amount      WHERE payment_status = 'paid'    AND paid_amount = 0;
UPDATE sales SET paid_amount = ROUND(total_amount/2,2) WHERE payment_status = 'partial' AND paid_amount = 0;

-- ----- index to speed up the dues report -----
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND INDEX_NAME = 'idx_sales_payment');
SET @sql := IF(@idx = 0,
  'ALTER TABLE sales ADD INDEX idx_sales_payment (payment_status)',
  'SELECT "idx_sales_payment already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
