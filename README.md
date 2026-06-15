# StockHive — Inventory Management & Stock Monitoring System

A full-stack, role-based inventory management system built with **React.js**, a **PHP REST API** (MVC, JWT auth), and **MySQL**. It covers products, categories, suppliers, customers, purchases (with an approval workflow), sales (with invoicing), real-time stock movements, notifications, analytics dashboards, audit logs, and PDF/Excel/CSV report exports.

---

## ✨ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, Bootstrap 5, Bootstrap Icons, Chart.js, Axios, React Router, React-Toastify |
| Backend | PHP 8 (custom lightweight MVC + REST router), self-contained JWT (HS256) |
| Database | MySQL 8 / MariaDB (fully normalized, 14 tables + a view) |
| Exports | TCPDF (PDF) + PhpSpreadsheet (Excel) when installed via Composer; native CSV & printable-HTML fallbacks otherwise |

---

## 📁 Project Structure

```
Inventra/
├── database/
│   └── stockhive.sql           # Full schema + seed data + low-stock view
├── backend/                    # PHP REST API
│   ├── index.php               # Front controller + all route definitions
│   ├── .htaccess               # Clean-URL rewriting + Authorization passthrough
│   ├── composer.json           # Optional TCPDF / PhpSpreadsheet deps
│   ├── config/                 # config.php (DB/JWT), Database.php (PDO)
│   ├── core/                   # Router, Controller, Model, Request, Response, JWT, Validator
│   ├── controllers/            # One controller per module (incl. SettingController)
│   ├── models/                 # One model per table + Report & Setting models
│   ├── middleware/             # AuthMiddleware (JWT verify + RBAC)
│   ├── helpers/                # ActivityLogger, Notifier, Exporter
│   └── uploads/products/       # Product images
└── frontend/                   # React SPA
    ├── .env                    # VITE_API_BASE
    └── src/
        ├── api/client.js       # Axios instance + interceptors
        ├── context/            # AuthContext (JWT + roles)
        ├── components/         # Layout, Sidebar, Topbar, ProtectedRoute, …
        ├── pages/              # Dashboard, Products, Sales, Purchases, Reports, Settings, AccessDenied
        └── utils/format.js
```

---

## 🚀 Setup

### Prerequisites
- XAMPP (Apache + PHP 8.1+) — or PHP's built-in server
- MySQL 8 / MariaDB
- Node.js 18+

### 1. Database
Import the schema (creates the `stockhive` database, all tables, and demo data):

```bash
# Using MySQL CLI
mysql -u root -p < database/stockhive.sql

# …or import database/stockhive.sql via phpMyAdmin / MySQL Workbench
```

### 2. Backend
Edit **`backend/config/config.php`** and set your DB credentials:

```php
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'stockhive');
define('DB_USER', 'root');
define('DB_PASS', 'your_password');
```

With **XAMPP**, place the project in `htdocs/` (it already is) — the API is served at:
`http://localhost/Inventra/backend`

> Optional (true PDF/XLSX exports): `cd backend && composer install`
> Without Composer, exports still work via CSV and a printable HTML view.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The frontend reads the API URL from **`frontend/.env`**:
```
VITE_API_BASE=http://localhost/Inventra/backend
```
(If you run the backend with PHP's built-in server instead — `php -S 127.0.0.1:8765 backend/index.php` — set this to `http://localhost:8765`.)

---

## 🔑 Demo Accounts

All demo users share the password **`Password@123`**.

| Role | Email | Capabilities |
|------|-------|--------------|
| **Admin** | `admin@stockhive.test` | Everything incl. users, deletes, audit logs |
| **Manager** | `manager@stockhive.test` | Inventory, purchases (approve), sales, reports |
| **Staff** | `staff@stockhive.test` | Sales entry, stock movements, create purchases |

---

## 🧩 Modules

- **Auth & RBAC** — JWT login/logout, forgot/change password, role-based route + API guards, activity logging, and a premium **Access Denied** block display.
- **Dashboard** — totals, revenue, low-stock alerts, recent activity, sales-vs-purchases bar chart, category doughnut, 7-day sales line chart, top products.
- **Categories / Suppliers / Customers** — CRUD, search, status, history tracking.
- **Products** — CRUD, image upload, auto **SKU** + **barcode** generation, reorder levels, category/supplier mapping, filters.
- **Purchases** — purchase orders with **pending → approved → received** workflow; receiving updates stock.
- **Sales** — multi-line sales entry, stock-availability checks, auto invoice numbers, printable invoices.
- **Stock** — stock in/out/adjustment/damaged/returned, immutable movement ledger, real-time quantity updates.
- **Notifications** — low-stock / out-of-stock / purchase-approval alerts.
- **Reports** — product, inventory, purchase, sales, supplier, customer, profit analysis — exportable to **PDF / Excel / CSV / Print**.
- **System Settings** — customizable timezone, currency, business contact information, default thresholds, and read-only support for staff roles.
- **Audit Logs** — login, CRUD, stock, settings, and export activity with IP/user-agent.

---

## 🗄️ Database (normalized)

`roles · users · categories · suppliers · customers · products · product_images · purchases · purchase_items · sales · sale_items · stock_transactions · notifications · activity_logs` + `v_low_stock` view.

All relationships use proper foreign keys with `ON UPDATE/DELETE` rules, plus indexes on lookup/search columns and unique constraints on `email`, `sku`, `barcode`, `invoice_no`, and `reference`.

---

## 🔒 Security Notes

- Passwords hashed with `password_hash` (bcrypt).
- All write endpoints validate input and enforce role permissions server-side (never trust the client).
- Prepared statements (PDO) everywhere — no string-concatenated SQL.
- Change `JWT_SECRET` in `config.php` before any non-local deployment and set `APP_ENV` to `production`.
