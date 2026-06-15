<?php
/**
 * StockHive REST API — front controller.
 * All requests are routed through here (see .htaccess).
 */

require_once __DIR__ . '/config/config.php';

// ----- CORS -----
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
// In development, allow any localhost / 127.0.0.1 origin (any port) plus private
// LAN IPs (192.168.x.x, 10.x.x.x, 172.16–31.x.x) so Vite dev servers, preview
// tools, and other devices on the network (e.g. a phone) work regardless of port.
$devOrigin = APP_ENV === 'development'
    && preg_match('#^https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$#', $origin);
if ($devOrigin || in_array($origin, CORS_ORIGINS, true)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ----- Composer autoload (TCPDF / PhpSpreadsheet) if present -----
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
}

// ----- Lightweight class autoloader -----
spl_autoload_register(function (string $class) {
    foreach (['core', 'config', 'models', 'controllers', 'helpers', 'middleware'] as $dir) {
        $file = __DIR__ . "/$dir/$class.php";
        if (file_exists($file)) { require_once $file; return; }
    }
});

// ----- Load Dynamic Settings (Timezone, etc.) -----
try {
    $settingModel = new Setting();
    $dbSettings = $settingModel->get();
    if (!empty($dbSettings['timezone'])) {
        date_default_timezone_set($dbSettings['timezone']);
    }
} catch (Throwable $e) {
    // Fail silently if db isn't set up yet
}

set_exception_handler(function (Throwable $e) {
    Response::error('Server error', 500, APP_ENV === 'development' ? $e->getMessage() : null);
});

$router = new Router();
$auth   = AuthMiddleware::authenticate();

// Define role-specific middleware groups
$adminOnly      = [$auth, AuthMiddleware::role(['Admin'])];
$adminOrManager = [$auth, AuthMiddleware::role(['Admin', 'Manager'])];
$allRoles       = [$auth, AuthMiddleware::role(['Admin', 'Manager', 'Staff'])];

// ===================== PUBLIC =====================
$router->get('/', fn() => Response::success(['name' => 'StockHive API', 'version' => '1.0']));
$router->post('/auth/login',           fn($r) => (new AuthController())->login($r));
$router->post('/auth/forgot-password', fn($r) => (new AuthController())->forgotPassword($r));
$router->post('/auth/reset-password',  fn($r) => (new AuthController())->resetPassword($r));

$router->get('/auth/me',              fn($r) => (new AuthController())->me($r), [$auth]);
$router->put('/auth/me',              fn($r) => (new AuthController())->updateProfile($r), [$auth]);
$router->post('/auth/avatar',         fn($r) => (new AuthController())->uploadAvatar($r), [$auth]);
$router->delete('/auth/avatar',       fn($r) => (new AuthController())->deleteAvatar($r), [$auth]);
$router->post('/auth/logout',         fn($r) => (new AuthController())->logout($r), [$auth]);
$router->post('/auth/change-password',fn($r) => (new AuthController())->changePassword($r), [$auth]);

// Dashboard
$router->get('/dashboard/stats', fn($r) => (new DashboardController())->stats($r), $allRoles);

// Categories
$router->get('/categories',          fn($r) => (new CategoryController())->index($r), $allRoles);
$router->get('/categories/list',     fn($r) => (new CategoryController())->listAll($r), $allRoles);
$router->get('/categories/{id}',     fn($r,$p) => (new CategoryController())->show($r,$p), $allRoles);
$router->post('/categories',         fn($r) => (new CategoryController())->store($r), $adminOrManager);
$router->put('/categories/{id}',     fn($r,$p) => (new CategoryController())->update($r,$p), $adminOrManager);
$router->delete('/categories/{id}',  fn($r,$p) => (new CategoryController())->destroy($r,$p), $adminOrManager);

// Suppliers
$router->get('/suppliers',           fn($r) => (new SupplierController())->index($r), $allRoles);
$router->get('/suppliers/list',      fn($r) => (new SupplierController())->listAll($r), $allRoles);
$router->get('/suppliers/{id}',      fn($r,$p) => (new SupplierController())->show($r,$p), $allRoles);
$router->post('/suppliers',          fn($r) => (new SupplierController())->store($r), $adminOrManager);
$router->put('/suppliers/{id}',      fn($r,$p) => (new SupplierController())->update($r,$p), $adminOrManager);
$router->delete('/suppliers/{id}',   fn($r,$p) => (new SupplierController())->destroy($r,$p), $adminOrManager);

// Customers
$router->get('/customers',           fn($r) => (new CustomerController())->index($r), $allRoles);
$router->get('/customers/list',      fn($r) => (new CustomerController())->listAll($r), $allRoles);
$router->get('/customers/{id}',      fn($r,$p) => (new CustomerController())->show($r,$p), $allRoles);
$router->post('/customers',          fn($r) => (new CustomerController())->store($r), $allRoles);
$router->put('/customers/{id}',      fn($r,$p) => (new CustomerController())->update($r,$p), $allRoles);
$router->delete('/customers/{id}',   fn($r,$p) => (new CustomerController())->destroy($r,$p), $allRoles);

// Products
$router->get('/products',            fn($r) => (new ProductController())->index($r), $allRoles);
$router->get('/products/list',       fn($r) => (new ProductController())->listAll($r), $allRoles);
$router->get('/products/generate-codes', fn($r) => (new ProductController())->generateCodes($r), $adminOrManager);
$router->post('/products/import',    fn($r) => (new ProductController())->import($r), $adminOrManager);
$router->get('/products/{id}',       fn($r,$p) => (new ProductController())->show($r,$p), $allRoles);
$router->post('/products',           fn($r) => (new ProductController())->store($r), $adminOrManager);
$router->put('/products/{id}',       fn($r,$p) => (new ProductController())->update($r,$p), $adminOrManager);
$router->delete('/products/{id}',    fn($r,$p) => (new ProductController())->destroy($r,$p), $adminOrManager);

// Purchases
$router->get('/purchases',           fn($r) => (new PurchaseController())->index($r), $allRoles);
$router->get('/purchases/{id}',      fn($r,$p) => (new PurchaseController())->show($r,$p), $allRoles);
$router->post('/purchases',          fn($r) => (new PurchaseController())->store($r), $allRoles);
$router->post('/purchases/{id}/approve', fn($r,$p) => (new PurchaseController())->approve($r,$p), $adminOrManager);
$router->post('/purchases/{id}/receive', fn($r,$p) => (new PurchaseController())->receive($r,$p), $allRoles);
$router->post('/purchases/{id}/cancel',  fn($r,$p) => (new PurchaseController())->cancel($r,$p), $adminOrManager);

// Sales
$router->get('/sales',               fn($r) => (new SalesController())->index($r), $allRoles);
$router->get('/sales/{id}',          fn($r,$p) => (new SalesController())->show($r,$p), $allRoles);
$router->post('/sales',              fn($r) => (new SalesController())->store($r), $allRoles);
$router->delete('/sales/{id}',       fn($r,$p) => (new SalesController())->destroy($r,$p), $adminOnly);

// Stock / inventory
$router->get('/stock',               fn($r) => (new StockController())->index($r), $allRoles);
$router->post('/stock/move',         fn($r) => (new StockController())->move($r), $allRoles);
$router->get('/stock/product/{id}',  fn($r,$p) => (new StockController())->productHistory($r,$p), $allRoles);

// Notifications
$router->get('/notifications',             fn($r) => (new NotificationController())->index($r), $allRoles);
$router->get('/notifications/unread-count',fn($r) => (new NotificationController())->unreadCount($r), $allRoles);
$router->put('/notifications/{id}/read',   fn($r,$p) => (new NotificationController())->markRead($r,$p), $allRoles);
$router->put('/notifications/read-all',    fn($r) => (new NotificationController())->markAllRead($r), $allRoles);
$router->delete('/notifications/{id}',     fn($r,$p) => (new NotificationController())->destroy($r,$p), $allRoles);

// Reports & exports
$router->get('/reports/{type}',        fn($r,$p) => (new ReportController())->data($r,$p), $allRoles);
$router->get('/reports/{type}/export', fn($r,$p) => (new ReportController())->export($r,$p), $adminOrManager);

// Users (admin)
$router->get('/users',        fn($r) => (new UserController())->index($r), $adminOnly);
$router->get('/users/roles',  fn($r) => (new UserController())->roles($r), $adminOnly);
$router->get('/users/{id}',   fn($r,$p) => (new UserController())->show($r,$p), $adminOnly);
$router->post('/users',       fn($r) => (new UserController())->store($r), $adminOnly);
$router->put('/users/{id}',   fn($r,$p) => (new UserController())->update($r,$p), $adminOnly);
$router->delete('/users/{id}',fn($r,$p) => (new UserController())->destroy($r,$p), $adminOnly);

// Settings
$router->get('/settings',  fn($r) => (new SettingController())->show($r), $allRoles);
$router->put('/settings',  fn($r) => (new SettingController())->update($r), $adminOnly);

// Activity logs
$router->get('/activity-logs', fn($r) => (new ActivityLogController())->index($r), $adminOrManager);

$router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
