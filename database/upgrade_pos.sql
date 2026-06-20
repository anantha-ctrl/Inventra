-- ============================================================================
--  StockHive / Inventra — POS & Billing upgrade
--  Adds: HSN + per-product GST, payment modes & split payments, parked bills,
--        shop expenses, and shop/GST settings.
--  Run in MySQL Workbench on the `stockhive` database. Safe to re-run.
-- ============================================================================
USE stockhive;

-- ---------- products: HSN code, per-product GST %, tax-inclusive flag ----------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS hsn_code      VARCHAR(20)   NULL          AFTER barcode,
  ADD COLUMN IF NOT EXISTS tax_rate      DECIMAL(5,2)  NOT NULL DEFAULT 0.00 AFTER selling_price,
  ADD COLUMN IF NOT EXISTS tax_inclusive TINYINT(1)    NOT NULL DEFAULT 0    AFTER tax_rate;

-- ---------- sales: primary payment mode ----------
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) NOT NULL DEFAULT 'cash' AFTER payment_status;

-- ---------- sale_payments: split / multi-mode payments per invoice ----------
CREATE TABLE IF NOT EXISTS sale_payments (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  sale_id     INT UNSIGNED  NOT NULL,
  mode        ENUM('cash','upi','card','other') NOT NULL DEFAULT 'cash',
  amount      DECIMAL(14,2) NOT NULL,
  reference   VARCHAR(80)   DEFAULT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sale_payments_sale (sale_id),
  KEY idx_sale_payments_mode (mode),
  CONSTRAINT fk_sale_payments_sale FOREIGN KEY (sale_id) REFERENCES sales (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- held_sales: parked carts (hold / resume bill) ----------
CREATE TABLE IF NOT EXISTS held_sales (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  label       VARCHAR(80)   DEFAULT NULL,
  customer_id INT UNSIGNED  DEFAULT NULL,
  cart        LONGTEXT      NOT NULL,            -- JSON snapshot of the cart
  note        VARCHAR(255)  DEFAULT NULL,
  created_by  INT UNSIGNED  DEFAULT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_held_customer (customer_id),
  CONSTRAINT fk_held_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_held_user FOREIGN KEY (created_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- expenses: shop running costs ----------
CREATE TABLE IF NOT EXISTS expenses (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  category      VARCHAR(80)   NOT NULL,
  amount        DECIMAL(14,2) NOT NULL,
  expense_date  DATE          NOT NULL,
  payment_mode  VARCHAR(20)   NOT NULL DEFAULT 'cash',
  note          VARCHAR(255)  DEFAULT NULL,
  created_by    INT UNSIGNED  DEFAULT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenses_date (expense_date),
  KEY idx_expenses_category (category),
  CONSTRAINT fk_expenses_user FOREIGN KEY (created_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- settings: shop / GST details for invoices & receipts ----------
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS gstin        VARCHAR(20)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shop_address VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shop_state   VARCHAR(80)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS upi_id       VARCHAR(120) DEFAULT NULL;

-- Backfill payment_mode for existing paid sales (assume cash).
UPDATE sales SET payment_mode = 'cash' WHERE payment_mode IS NULL OR payment_mode = '';

-- Seed sale_payments for historical paid sales so reports/Z-report stay accurate.
INSERT INTO sale_payments (sale_id, mode, amount)
SELECT s.id, 'cash', s.paid_amount
FROM sales s
LEFT JOIN sale_payments sp ON sp.sale_id = s.id
WHERE sp.id IS NULL AND s.paid_amount > 0;
