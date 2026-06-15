<?php
/**
 * StockHive — global configuration
 * Edit the database credentials below to match your MySQL server.
 */

// ----- Database -----
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'stockhive');
define('DB_USER', 'root');
define('DB_PASS', 'anantha');      // <-- set your MySQL root/user password here

// ----- JWT -----
define('JWT_SECRET', 'sh_2f8a1c9d4e7b6a35f0c1d2e3a4b5c6d7_change_in_prod');
define('JWT_ISSUER', 'stockhive');
define('JWT_TTL', 60 * 60 * 8);      // token lifetime in seconds (8 hours)

// ----- App -----
define('APP_ENV', 'development');    // development | production
define('UPLOAD_DIR', dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads');
define('UPLOAD_URL', '/Inventra/backend/uploads');
define('LOW_STOCK_ENABLED', true);

// ----- CORS (React dev server origins) -----
define('CORS_ORIGINS', [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5175',
    'http://localhost:3000',
]);

date_default_timezone_set('Asia/Kolkata');

if (APP_ENV === 'production') {
    error_reporting(0);
    ini_set('display_errors', '0');
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
}
