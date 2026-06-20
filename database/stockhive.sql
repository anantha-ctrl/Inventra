-- ============================================================================
--  StockHive — Inventory Management & Stock Monitoring System
--  Fully normalized MySQL schema (MySQL 5.7+ / MariaDB 10.4+)
--  Database Design: MySQL Workbench compatible
-- ============================================================================

DROP DATABASE IF EXISTS stockhive;
CREATE DATABASE stockhive
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE stockhive;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. roles
-- ----------------------------------------------------------------------------
CREATE TABLE roles (
  id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  name            VARCHAR(50)    NOT NULL,
  description     VARCHAR(255)   DEFAULT NULL,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. users
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id                  INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  role_id             INT UNSIGNED   NOT NULL,
  name                VARCHAR(120)   NOT NULL,
  email               VARCHAR(160)   NOT NULL,
  password            VARCHAR(255)   NOT NULL,
  phone               VARCHAR(30)    DEFAULT NULL,
  avatar              VARCHAR(255)   DEFAULT NULL,
  status              ENUM('active','inactive') NOT NULL DEFAULT 'active',
  permissions         TEXT           DEFAULT NULL,
  reset_token         VARCHAR(120)   DEFAULT NULL,
  reset_token_expiry  DATETIME       DEFAULT NULL,
  last_login          DATETIME       DEFAULT NULL,
  created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  KEY idx_users_status (status),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. categories
-- ----------------------------------------------------------------------------
CREATE TABLE categories (
  id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  name            VARCHAR(120)   NOT NULL,
  description     VARCHAR(255)   DEFAULT NULL,
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_by      INT UNSIGNED   DEFAULT NULL,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name),
  KEY idx_categories_status (status),
  CONSTRAINT fk_categories_user FOREIGN KEY (created_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. suppliers
-- ----------------------------------------------------------------------------
CREATE TABLE suppliers (
  id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  name            VARCHAR(150)   NOT NULL,
  company         VARCHAR(150)   DEFAULT NULL,
  email           VARCHAR(160)   DEFAULT NULL,
  phone           VARCHAR(30)    DEFAULT NULL,
  address         VARCHAR(255)   DEFAULT NULL,
  city            VARCHAR(80)    DEFAULT NULL,
  country         VARCHAR(80)    DEFAULT NULL,
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_suppliers_name (name),
  KEY idx_suppliers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. customers
-- ----------------------------------------------------------------------------
CREATE TABLE customers (
  id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  name            VARCHAR(150)   NOT NULL,
  email           VARCHAR(160)   DEFAULT NULL,
  phone           VARCHAR(30)    DEFAULT NULL,
  address         VARCHAR(255)   DEFAULT NULL,
  city            VARCHAR(80)    DEFAULT NULL,
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_customers_name (name),
  KEY idx_customers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. products
-- ----------------------------------------------------------------------------
CREATE TABLE products (
  id                INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  category_id       INT UNSIGNED   NOT NULL,
  supplier_id       INT UNSIGNED   DEFAULT NULL,
  name              VARCHAR(180)   NOT NULL,
  sku               VARCHAR(60)    NOT NULL,
  barcode           VARCHAR(60)    DEFAULT NULL,
  hsn_code          VARCHAR(20)    DEFAULT NULL,
  description       TEXT           DEFAULT NULL,
  unit              VARCHAR(30)    NOT NULL DEFAULT 'pcs',
  cost_price        DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  selling_price     DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  tax_rate          DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
  tax_inclusive     TINYINT(1)     NOT NULL DEFAULT 0,
  quantity          INT            NOT NULL DEFAULT 0,
  reorder_level     INT            NOT NULL DEFAULT 10,
  image             VARCHAR(255)   DEFAULT NULL,
  status            ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_by        INT UNSIGNED   DEFAULT NULL,
  created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  UNIQUE KEY uq_products_barcode (barcode),
  KEY idx_products_category (category_id),
  KEY idx_products_supplier (supplier_id),
  KEY idx_products_status (status),
  KEY idx_products_name (name),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_products_user FOREIGN KEY (created_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. product_images
-- ----------------------------------------------------------------------------
CREATE TABLE product_images (
  id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  product_id      INT UNSIGNED   NOT NULL,
  image_path      VARCHAR(255)   NOT NULL,
  is_primary      TINYINT(1)     NOT NULL DEFAULT 0,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_images_product (product_id),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. purchases  (purchase orders / header)
-- ----------------------------------------------------------------------------
CREATE TABLE purchases (
  id                INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  reference         VARCHAR(40)    NOT NULL,
  supplier_id       INT UNSIGNED   NOT NULL,
  purchase_date     DATE           NOT NULL,
  total_amount      DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  status            ENUM('pending','approved','received','cancelled') NOT NULL DEFAULT 'pending',
  notes             VARCHAR(255)   DEFAULT NULL,
  created_by        INT UNSIGNED   DEFAULT NULL,
  approved_by       INT UNSIGNED   DEFAULT NULL,
  approved_at       DATETIME       DEFAULT NULL,
  created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchases_reference (reference),
  KEY idx_purchases_supplier (supplier_id),
  KEY idx_purchases_status (status),
  KEY idx_purchases_date (purchase_date),
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_purchases_creator FOREIGN KEY (created_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_purchases_approver FOREIGN KEY (approved_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. purchase_items  (line items)
-- ----------------------------------------------------------------------------
CREATE TABLE purchase_items (
  id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  purchase_id     INT UNSIGNED   NOT NULL,
  product_id      INT UNSIGNED   NOT NULL,
  quantity        INT            NOT NULL,
  unit_cost       DECIMAL(12,2)  NOT NULL,
  subtotal        DECIMAL(14,2)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_purchase_items_purchase (purchase_id),
  KEY idx_purchase_items_product (product_id),
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_purchase_items_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. sales  (header)
-- ----------------------------------------------------------------------------
CREATE TABLE sales (
  id                INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  invoice_no        VARCHAR(40)    NOT NULL,
  customer_id       INT UNSIGNED   DEFAULT NULL,
  sale_date         DATE           NOT NULL,
  subtotal          DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  discount          DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  tax               DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  tax_rate          DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
  total_amount      DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  paid_amount       DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  payment_status    ENUM('paid','partial','unpaid') NOT NULL DEFAULT 'paid',
  payment_mode      VARCHAR(20)    NOT NULL DEFAULT 'cash',
  notes             VARCHAR(255)   DEFAULT NULL,
  created_by        INT UNSIGNED   DEFAULT NULL,
  created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sales_invoice (invoice_no),
  KEY idx_sales_customer (customer_id),
  KEY idx_sales_date (sale_date),
  CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_sales_creator FOREIGN KEY (created_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. sale_items  (line items)
-- ----------------------------------------------------------------------------
CREATE TABLE sale_items (
  id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  sale_id         INT UNSIGNED   NOT NULL,
  product_id      INT UNSIGNED   NOT NULL,
  quantity        INT            NOT NULL,
  unit_price      DECIMAL(12,2)  NOT NULL,
  subtotal        DECIMAL(14,2)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sale_items_sale (sale_id),
  KEY idx_sale_items_product (product_id),
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 12. stock_transactions  (immutable ledger of every stock movement)
-- ----------------------------------------------------------------------------
CREATE TABLE stock_transactions (
  id                INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  product_id        INT UNSIGNED   NOT NULL,
  type              ENUM('in','out','adjustment','damaged','returned') NOT NULL,
  quantity          INT            NOT NULL,          -- signed: +in, -out
  quantity_before   INT            NOT NULL,
  quantity_after    INT            NOT NULL,
  reference_type    VARCHAR(30)    DEFAULT NULL,      -- purchase | sale | manual
  reference_id      INT UNSIGNED   DEFAULT NULL,
  note              VARCHAR(255)   DEFAULT NULL,
  created_by        INT UNSIGNED   DEFAULT NULL,
  created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_tx_product (product_id),
  KEY idx_stock_tx_type (type),
  KEY idx_stock_tx_created (created_at),
  CONSTRAINT fk_stock_tx_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_stock_tx_user FOREIGN KEY (created_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 13. notifications
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
  id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  type            ENUM('low_stock','out_of_stock','purchase_approval','info') NOT NULL DEFAULT 'info',
  title           VARCHAR(150)   NOT NULL,
  message         VARCHAR(255)   NOT NULL,
  reference_id    INT UNSIGNED   DEFAULT NULL,
  is_read         TINYINT(1)     NOT NULL DEFAULT 0,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_read (is_read),
  KEY idx_notifications_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 14. activity_logs
-- ----------------------------------------------------------------------------
CREATE TABLE activity_logs (
  id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED   DEFAULT NULL,
  action          VARCHAR(60)    NOT NULL,            -- login | create | update | delete | stock | ...
  module          VARCHAR(60)    NOT NULL,            -- auth | product | sale | ...
  description     VARCHAR(255)   DEFAULT NULL,
  ip_address      VARCHAR(45)    DEFAULT NULL,
  user_agent      VARCHAR(255)   DEFAULT NULL,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_user (user_id),
  KEY idx_activity_module (module),
  KEY idx_activity_created (created_at),
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 15. sale_payments  (split / multi-mode payments per invoice)
-- ----------------------------------------------------------------------------
CREATE TABLE sale_payments (
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

-- ----------------------------------------------------------------------------
-- 16. held_sales  (parked carts — hold / resume bill in POS)
-- ----------------------------------------------------------------------------
CREATE TABLE held_sales (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  label       VARCHAR(80)   DEFAULT NULL,
  customer_id INT UNSIGNED  DEFAULT NULL,
  cart        LONGTEXT      NOT NULL,
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

-- ----------------------------------------------------------------------------
-- 17. expenses  (shop running costs — for true profit)
-- ----------------------------------------------------------------------------
CREATE TABLE expenses (
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

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
--  SEED DATA
-- ============================================================================

INSERT INTO roles (id, name, description) VALUES
  (1, 'Admin',   'Full system access and configuration'),
  (2, 'Manager', 'Manage inventory, purchases, sales and reports'),
  (3, 'Staff',   'Day-to-day stock and sales operations');

-- Default password for ALL seeded users is:  Password@123
-- (bcrypt hash below generated with PHP password_hash, cost 10)
INSERT INTO users (id, role_id, name, email, password, phone, status) VALUES
  (1, 1, 'System Admin', 'admin@stockhive.test',   '$2y$10$IMAKpHb2GnqdvhhvFKHKx..CibI4.V9oAw3FHKTSdTHVNW3gVdBrC', '9000000001', 'active'),
  (2, 2, 'Mary Manager', 'manager@stockhive.test', '$2y$10$IMAKpHb2GnqdvhhvFKHKx..CibI4.V9oAw3FHKTSdTHVNW3gVdBrC', '9000000002', 'active'),
  (3, 3, 'Sam Staff',    'staff@stockhive.test',   '$2y$10$IMAKpHb2GnqdvhhvFKHKx..CibI4.V9oAw3FHKTSdTHVNW3gVdBrC', '9000000003', 'active');

INSERT INTO categories (id, name, description, status, created_by) VALUES
  (1, 'Electronics',   'Phones, laptops and accessories', 'active', 1),
  (2, 'Groceries',     'Food and household items',        'active', 1),
  (3, 'Stationery',    'Office and school supplies',      'active', 1),
  (4, 'Furniture',     'Home and office furniture',       'active', 1);

INSERT INTO suppliers (id, name, company, email, phone, city, country, status) VALUES
  (1, 'John Traders',    'JT Global Pvt Ltd',  'john@jtglobal.test',  '8800000001', 'Mumbai',    'India', 'active'),
  (2, 'Acme Supplies',   'Acme Corp',          'sales@acme.test',     '8800000002', 'Delhi',     'India', 'active'),
  (3, 'Prime Wholesale', 'Prime Distributors', 'info@prime.test',     '8800000003', 'Bangalore', 'India', 'active');

INSERT INTO customers (id, name, email, phone, city, status) VALUES
  (1, 'Walk-in Customer', NULL,                NULL,        NULL,      'active'),
  (2, 'Ravi Kumar',       'ravi@mail.test',    '7700000001','Chennai', 'active'),
  (3, 'Priya Sharma',     'priya@mail.test',   '7700000002','Pune',    'active');

INSERT INTO products (id, category_id, supplier_id, name, sku, barcode, unit, cost_price, selling_price, quantity, reorder_level, status, created_by) VALUES
  (1, 1, 1, 'Wireless Mouse',     'ELE-0001', '8901000000017', 'pcs', 250.00,  450.00, 60,  15, 'active', 1),
  (2, 1, 1, 'USB-C Cable 1m',     'ELE-0002', '8901000000024', 'pcs', 80.00,   150.00, 8,   20, 'active', 1),
  (3, 2, 2, 'Basmati Rice 5kg',   'GRO-0001', '8901000000031', 'bag', 450.00,  620.00, 35,  10, 'active', 1),
  (4, 3, 2, 'A4 Notebook',        'STA-0001', '8901000000048', 'pcs', 30.00,   55.00,  120, 30, 'active', 1),
  (5, 3, 3, 'Ball Pen (Blue)',    'STA-0002', '8901000000055', 'box', 90.00,   140.00, 5,   25, 'active', 1),
  (6, 4, 3, 'Office Chair',       'FUR-0001', '8901000000062', 'pcs', 2200.00, 3500.00,12,  5,  'active', 1);

INSERT INTO purchases (id, reference, supplier_id, purchase_date, total_amount, status, created_by, approved_by, approved_at) VALUES
  (1, 'PO-2026-0001', 1, '2026-05-20', 16000.00, 'received',  3, 1, '2026-05-20 10:30:00'),
  (2, 'PO-2026-0002', 2, '2026-06-01', 13500.00, 'approved',  3, 2, '2026-06-01 09:15:00'),
  (3, 'PO-2026-0003', 3, '2026-06-10', 26400.00, 'pending',   3, NULL, NULL);

INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, subtotal) VALUES
  (1, 1, 40, 250.00, 10000.00),
  (1, 2, 30, 80.00,  2400.00),
  (1, 3, 8,  450.00, 3600.00),
  (2, 3, 30, 450.00, 13500.00),
  (3, 6, 12, 2200.00, 26400.00);

INSERT INTO sales (id, invoice_no, customer_id, sale_date, subtotal, discount, tax, total_amount, payment_status, created_by) VALUES
  (1, 'INV-2026-0001', 2, '2026-06-05', 1200.00, 0.00,   60.00, 1260.00, 'paid', 3),
  (2, 'INV-2026-0002', 3, '2026-06-08', 620.00,  20.00,  30.00, 630.00,  'paid', 3),
  (3, 'INV-2026-0003', 1, '2026-06-11', 700.00,  0.00,   35.00, 735.00,  'paid', 2);

INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES
  (1, 1, 2, 450.00, 900.00),
  (1, 4, 5, 55.00,  275.00),
  (2, 3, 1, 620.00, 620.00),
  (3, 1, 1, 450.00, 450.00),
  (3, 5, 1, 140.00, 140.00);

-- Mark seeded paid invoices as fully paid (cash) so dues/Z-reports are accurate.
UPDATE sales SET paid_amount = total_amount WHERE payment_status = 'paid';
INSERT INTO sale_payments (sale_id, mode, amount)
SELECT id, 'cash', paid_amount FROM sales WHERE paid_amount > 0;

INSERT INTO notifications (type, title, message, reference_id, is_read) VALUES
  ('low_stock',         'Low stock alert',        'USB-C Cable 1m is below reorder level (8/20)', 2, 0),
  ('low_stock',         'Low stock alert',        'Ball Pen (Blue) is below reorder level (5/25)', 5, 0),
  ('purchase_approval', 'Purchase pending',       'PO-2026-0003 is awaiting approval',           3, 0);

INSERT INTO activity_logs (user_id, action, module, description, ip_address) VALUES
  (1, 'login',  'auth',     'Admin logged in',                      '127.0.0.1'),
  (3, 'create', 'sale',     'Created invoice INV-2026-0001',        '127.0.0.1'),
  (1, 'approve','purchase', 'Approved purchase PO-2026-0001',       '127.0.0.1');

-- ============================================================================
--  VIEW: live low-stock products (used by dashboard & notifications)
-- ============================================================================
CREATE OR REPLACE VIEW v_low_stock AS
SELECT p.id, p.name, p.sku, p.quantity, p.reorder_level, c.name AS category
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.status = 'active' AND p.quantity <= p.reorder_level;
