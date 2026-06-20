<?php
/**
 * Global search — one query, results grouped by module
 * (products, customers, invoices). Powers the Topbar omni-search.
 */
class SearchController extends Controller
{
    public function global(Request $req): void
    {
        $q = trim((string) $req->query('q', ''));
        if (mb_strlen($q) < 2) {
            Response::success(['products' => [], 'customers' => [], 'sales' => [], 'query' => $q]);
        }

        $db   = Database::connection();
        $like = "%$q%";

        $products = $db->prepare(
            'SELECT p.id, p.name, p.sku, p.barcode, p.selling_price, p.quantity, c.name AS category_name
             FROM products p JOIN categories c ON c.id = p.category_id
             WHERE p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?
             ORDER BY p.name ASC LIMIT 6'
        );
        $products->execute([$like, $like, $like]);

        $customers = $db->prepare(
            'SELECT id, name, email, phone, city FROM customers
             WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?
             ORDER BY name ASC LIMIT 6'
        );
        $customers->execute([$like, $like, $like]);

        $sales = $db->prepare(
            'SELECT s.id, s.invoice_no, s.sale_date, s.total_amount, s.payment_status, c.name AS customer_name
             FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
             WHERE s.invoice_no LIKE ? OR c.name LIKE ?
             ORDER BY s.id DESC LIMIT 6'
        );
        $sales->execute([$like, $like]);

        Response::success([
            'query'     => $q,
            'products'  => $products->fetchAll(),
            'customers' => $customers->fetchAll(),
            'sales'     => $sales->fetchAll(),
        ]);
    }
}
