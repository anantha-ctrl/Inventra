<?php
class ProductController extends Controller
{
    private Product $model;
    public function __construct() { $this->model = new Product(); }

    public function index(Request $req): void
    {
        [$rows, $total] = $this->model->paginateJoined(
            $req->page(), $req->perPage(), $req->search(),
            [
                'category_id' => $req->query('category_id'),
                'status'      => $req->query('status'),
                'low_stock'   => $req->query('low_stock'),
            ]
        );
        Response::paginated($rows, $total, $req->page(), $req->perPage());
    }

    public function listAll(Request $req): void
    {
        Response::success($this->model->all('name ASC'));
    }

    public function show(Request $req, array $p): void
    {
        $row = $this->model->findJoined((int) $p['id']);
        $row ? Response::success($row) : Response::error('Product not found', 404);
    }

    /** Suggest a fresh SKU + barcode for the create form. */
    public function generateCodes(Request $req): void
    {
        $prefix  = (string) $req->query('prefix', 'PRD');
        $sku     = $this->model->nextSku($prefix);
        $barcode = $this->generateBarcode();
        Response::success(['sku' => $sku, 'barcode' => $barcode]);
    }

    /** Scanner lookup: resolve a barcode/SKU to a product (used by POS & stock). */
    public function lookup(Request $req): void
    {
        $code = trim((string) $req->query('code', ''));
        if ($code === '') Response::error('No barcode/SKU provided', 422);
        $row = $this->model->findByCode($code);
        $row ? Response::success($row) : Response::error("No product found for \"$code\"", 404);
    }

    /** Stream all products as a CSV download. */
    public function export(Request $req): void
    {
        $rows = $this->model->db()->query(
            'SELECT p.name, c.name AS category, s.name AS supplier, p.sku, p.barcode, p.hsn_code, p.unit,
                    p.cost_price, p.selling_price, p.tax_rate, p.quantity, p.reorder_level, p.status, p.description
             FROM products p
             JOIN categories c ON c.id = p.category_id
             LEFT JOIN suppliers s ON s.id = p.supplier_id
             ORDER BY p.name ASC'
        )->fetchAll();
        ActivityLogger::log($this->userId($req), 'export', 'product', 'Exported products to CSV');
        $this->streamCsv('products_export_' . date('Ymd_His') . '.csv',
            ['name','category','supplier','sku','barcode','hsn_code','unit','cost_price','selling_price','tax_rate','quantity','reorder_level','status','description'],
            $rows);
    }

    /** Shared CSV streamer. */
    private function streamCsv(string $filename, array $headers, array $rows): void
    {
        header('Content-Type: text/csv; charset=utf-8');
        header("Content-Disposition: attachment; filename=\"$filename\"");
        $out = fopen('php://output', 'w');
        fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM for Excel
        fputcsv($out, $headers);
        foreach ($rows as $r) {
            $line = [];
            foreach ($headers as $h) $line[] = $r[$h] ?? '';
            fputcsv($out, $line);
        }
        fclose($out);
        exit;
    }

    public function store(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $data = $this->validate($req, [
            'name'          => 'required|max:180',
            'category_id'   => 'required|numeric',
            'cost_price'    => 'numeric|min:0',
            'selling_price' => 'numeric|min:0',
            'reorder_level' => 'numeric|min:0',
            'status'        => 'in:active,inactive',
        ]);

        $category = (new Category())->find((int) $data['category_id']);
        if (!$category) Response::error('Selected category does not exist', 422);

        $sku = $req->input('sku') ?: $this->model->nextSku($category['name']);
        if ($this->model->findBy('sku', $sku)) Response::error('SKU already exists', 409);

        $barcode = $req->input('barcode') ?: $this->generateBarcode();
        $image   = $this->handleImageUpload();

        $id = $this->model->create([
            'category_id'   => (int) $data['category_id'],
            'supplier_id'   => $req->input('supplier_id') ?: null,
            'name'          => $data['name'],
            'sku'           => $sku,
            'barcode'       => $barcode,
            'hsn_code'      => $req->input('hsn_code') ?: null,
            'description'   => $req->input('description'),
            'unit'          => $req->input('unit', 'pcs'),
            'cost_price'    => (float) $req->input('cost_price', 0),
            'selling_price' => (float) $req->input('selling_price', 0),
            'tax_rate'      => (float) $req->input('tax_rate', 0),
            'tax_inclusive' => (int) ($req->input('tax_inclusive', 0) ? 1 : 0),
            'quantity'      => (int) $req->input('quantity', 0),
            'reorder_level' => (int) $req->input('reorder_level', $this->getDefaultReorderLevel()),
            'image'         => $image,
            'status'        => $req->input('status', 'active'),
            'created_by'    => $this->userId($req),
        ]);

        // Opening stock movement
        if ((int) $req->input('quantity', 0) > 0) {
            (new StockTransaction())->create([
                'product_id'      => $id,
                'type'            => 'in',
                'quantity'        => (int) $req->input('quantity'),
                'quantity_before' => 0,
                'quantity_after'  => (int) $req->input('quantity'),
                'reference_type'  => 'manual',
                'note'            => 'Opening stock',
                'created_by'      => $this->userId($req),
            ]);
        }

        Notifier::checkStock($this->model->find($id));
        ActivityLogger::log($this->userId($req), 'create', 'product', "Created product {$data['name']} ($sku)");
        Response::success(['id' => $id, 'sku' => $sku, 'barcode' => $barcode], 'Product created', 201);
    }

    public function update(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $id = (int) $p['id'];
        $existing = $this->model->find($id);
        if (!$existing) Response::error('Product not found', 404);

        $this->validate($req, [
            'name'        => 'required|max:180',
            'category_id' => 'required|numeric',
            'status'      => 'in:active,inactive',
        ]);

        $image = $this->handleImageUpload() ?? $existing['image'];

        $this->model->update($id, [
            'category_id'   => (int) $req->input('category_id'),
            'supplier_id'   => $req->input('supplier_id') ?: null,
            'name'          => $req->input('name'),
            'hsn_code'      => $req->input('hsn_code') ?: null,
            'description'   => $req->input('description'),
            'unit'          => $req->input('unit', 'pcs'),
            'cost_price'    => (float) $req->input('cost_price', 0),
            'selling_price' => (float) $req->input('selling_price', 0),
            'tax_rate'      => (float) $req->input('tax_rate', 0),
            'tax_inclusive' => (int) ($req->input('tax_inclusive', 0) ? 1 : 0),
            'reorder_level' => (int) $req->input('reorder_level', $this->getDefaultReorderLevel()),
            'image'         => $image,
            'status'        => $req->input('status', 'active'),
        ]);
        ActivityLogger::log($this->userId($req), 'update', 'product', "Updated product #$id");
        Response::success(null, 'Product updated');
    }

    public function destroy(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $id = (int) $p['id'];
        if (!$this->model->find($id)) Response::error('Product not found', 404);
        if ((new Sale())->db()->query("SELECT 1 FROM sale_items WHERE product_id=$id LIMIT 1")->fetchColumn()
            || (new Purchase())->db()->query("SELECT 1 FROM purchase_items WHERE product_id=$id LIMIT 1")->fetchColumn()) {
            Response::error('Cannot delete: product has purchase/sales history. Set it inactive instead.', 409);
        }
        $this->model->delete($id);
        ActivityLogger::log($this->userId($req), 'delete', 'product', "Deleted product #$id");
        Response::success(null, 'Product deleted');
    }

    public function bulkDestroy(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $ids = $req->input('ids');
        if (!is_array($ids) || empty($ids)) {
            Response::error('No product IDs provided', 422);
        }
        $ids = array_map('intval', $ids);

        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        // Query to find product IDs that have history in sale_items or purchase_items
        $salesStmt = $this->model->db()->prepare("SELECT DISTINCT product_id FROM sale_items WHERE product_id IN ($placeholders)");
        $salesStmt->execute($ids);
        $salesIds = $salesStmt->fetchAll(PDO::FETCH_COLUMN);

        $purchaseStmt = $this->model->db()->prepare("SELECT DISTINCT product_id FROM purchase_items WHERE product_id IN ($placeholders)");
        $purchaseStmt->execute($ids);
        $purchaseIds = $purchaseStmt->fetchAll(PDO::FETCH_COLUMN);

        $idsWithHistory = array_unique(array_merge($salesIds, $purchaseIds));
        $idsToDelete = array_values(array_diff($ids, $idsWithHistory));

        $skippedNames = [];
        if (!empty($idsWithHistory)) {
            $historyPlaceholders = implode(',', array_fill(0, count($idsWithHistory), '?'));
            $nameStmt = $this->model->db()->prepare("SELECT name FROM products WHERE id IN ($historyPlaceholders)");
            $nameStmt->execute(array_values($idsWithHistory));
            $skippedNames = $nameStmt->fetchAll(PDO::FETCH_COLUMN);
        }

        $deletedCount = 0;
        if (!empty($idsToDelete)) {
            $deletePlaceholders = implode(',', array_fill(0, count($idsToDelete), '?'));
            $db = $this->model->db();
            $db->beginTransaction();
            try {
                $deleteStmt = $db->prepare("DELETE FROM products WHERE id IN ($deletePlaceholders)");
                $deleteStmt->execute($idsToDelete);
                $deletedCount = $deleteStmt->rowCount();
                $db->commit();

                ActivityLogger::log($this->userId($req), 'delete', 'product', "Bulk deleted $deletedCount products");
            } catch (Exception $e) {
                $db->rollBack();
                Response::error('Failed to delete products: ' . $e->getMessage(), 500);
            }
        }

        Response::success([
            'deleted_count' => $deletedCount,
            'skipped_count' => count($idsWithHistory),
            'skipped_names' => $skippedNames
        ], 'Bulk delete completed');
    }

    public function import(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        
        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            Response::error('Please upload a valid CSV file', 400);
        }

        $file = $_FILES['file']['tmp_name'];
        
        if (($handle = fopen($file, 'r')) === false) {
            Response::error('Could not open the uploaded file', 400);
        }

        $headers = fgetcsv($handle);
        if (!$headers) {
            fclose($handle);
            Response::error('Empty CSV file', 400);
        }

        $headers = array_map(function($h) {
            $h = preg_replace('/[\x{FEFF}\x{FFFE}]/u', '', $h);
            return strtolower(trim($h));
        }, $headers);

        $headerMap = [
            'name'          => array_search('name', $headers),
            'category'      => array_search('category', $headers),
            'supplier'      => array_search('supplier', $headers),
            'sku'           => array_search('sku', $headers),
            'barcode'       => array_search('barcode', $headers),
            'hsn_code'      => array_search('hsn_code', $headers),
            'unit'          => array_search('unit', $headers),
            'cost_price'    => array_search('cost_price', $headers),
            'selling_price' => array_search('selling_price', $headers),
            'tax_rate'      => array_search('tax_rate', $headers),
            'tax_inclusive' => array_search('tax_inclusive', $headers),
            'quantity'      => array_search('quantity', $headers),
            'reorder_level' => array_search('reorder_level', $headers),
            'description'   => array_search('description', $headers),
        ];

        if ($headerMap['name'] === false || $headerMap['category'] === false) {
            fclose($handle);
            Response::error('CSV must contain at least "name" and "category" columns.', 422);
        }

        $imported = 0;
        $skipped = 0;
        $errors = [];
        $lineNum = 1;

        $db = $this->model->db();
        $db->beginTransaction();

        try {
            $categoryModel = new Category();
            $supplierModel = new Supplier();
            $stockTxModel = new StockTransaction();

            while (($row = fgetcsv($handle)) !== false) {
                $lineNum++;
                
                if (empty($row) || (count($row) === 1 && empty($row[0]))) {
                    continue;
                }

                $name = trim($row[$headerMap['name']] ?? '');
                $categoryName = trim($row[$headerMap['category']] ?? '');

                if ($name === '' || $categoryName === '') {
                    $skipped++;
                    $errors[] = "Line $lineNum: Product name and category name are required.";
                    continue;
                }

                $category = $categoryModel->findBy('name', $categoryName);
                if (!$category) {
                    $catId = $categoryModel->create([
                        'name' => $categoryName,
                        'description' => 'Automatically created during bulk import',
                        'status' => 'active',
                        'created_by' => $this->userId($req),
                    ]);
                } else {
                    $catId = (int) $category['id'];
                }

                $supplierName = $headerMap['supplier'] !== false ? trim($row[$headerMap['supplier']] ?? '') : '';
                $supplierId = null;
                if ($supplierName !== '') {
                    $supplier = $supplierModel->findBy('name', $supplierName);
                    if (!$supplier) {
                        $supplierId = $supplierModel->create([
                            'name' => $supplierName,
                            'company' => $supplierName,
                            'status' => 'active',
                        ]);
                    } else {
                        $supplierId = (int) $supplier['id'];
                    }
                }

                $sku = $headerMap['sku'] !== false ? trim($row[$headerMap['sku']] ?? '') : '';
                if ($sku !== '') {
                    if ($this->model->findBy('sku', $sku)) {
                        $skipped++;
                        $errors[] = "Line $lineNum: SKU '$sku' already exists.";
                        continue;
                    }
                } else {
                    $sku = $this->model->nextSku($categoryName);
                }

                $barcode = $headerMap['barcode'] !== false ? trim($row[$headerMap['barcode']] ?? '') : '';
                if ($barcode !== '') {
                    if ($this->model->findBy('barcode', $barcode)) {
                        $skipped++;
                        $errors[] = "Line $lineNum: Barcode '$barcode' already exists.";
                        continue;
                    }
                } else {
                    $barcode = $this->generateBarcode();
                }

                $unit = $headerMap['unit'] !== false ? trim($row[$headerMap['unit']] ?? 'pcs') : 'pcs';
                if ($unit === '') $unit = 'pcs';

                $defaultReorder = $this->getDefaultReorderLevel();
                $costPrice = $headerMap['cost_price'] !== false ? (float) ($row[$headerMap['cost_price']] ?? 0) : 0.0;
                $sellingPrice = $headerMap['selling_price'] !== false ? (float) ($row[$headerMap['selling_price']] ?? 0) : 0.0;
                $quantity = $headerMap['quantity'] !== false ? (int) ($row[$headerMap['quantity']] ?? 0) : 0;
                $reorderLevel = $headerMap['reorder_level'] !== false ? (int) ($row[$headerMap['reorder_level']] ?? $defaultReorder) : $defaultReorder;
                $description = $headerMap['description'] !== false ? trim($row[$headerMap['description']] ?? '') : '';
                $hsnCode = $headerMap['hsn_code'] !== false ? trim($row[$headerMap['hsn_code']] ?? '') : '';
                $taxRate = $headerMap['tax_rate'] !== false ? (float) ($row[$headerMap['tax_rate']] ?? 0) : 0.0;
                $taxIncRaw = $headerMap['tax_inclusive'] !== false ? strtolower(trim($row[$headerMap['tax_inclusive']] ?? '')) : '';
                $taxInclusive = in_array($taxIncRaw, ['1', 'yes', 'true', 'y'], true) ? 1 : 0;

                $prodId = $this->model->create([
                    'category_id'   => $catId,
                    'supplier_id'   => $supplierId,
                    'name'          => $name,
                    'sku'           => $sku,
                    'barcode'       => $barcode,
                    'hsn_code'      => $hsnCode ?: null,
                    'description'   => $description,
                    'unit'          => $unit,
                    'cost_price'    => $costPrice,
                    'selling_price' => $sellingPrice,
                    'tax_rate'      => $taxRate,
                    'tax_inclusive' => $taxInclusive,
                    'quantity'      => $quantity,
                    'reorder_level' => $reorderLevel,
                    'status'        => 'active',
                    'created_by'    => $this->userId($req),
                ]);

                if ($quantity > 0) {
                    $stockTxModel->create([
                        'product_id'      => $prodId,
                        'type'            => 'in',
                        'quantity'        => $quantity,
                        'quantity_before' => 0,
                        'quantity_after'  => $quantity,
                        'reference_type'  => 'manual',
                        'note'            => 'Opening stock via CSV bulk import',
                        'created_by'      => $this->userId($req),
                    ]);
                }

                $imported++;
            }

            $db->commit();
            fclose($handle);

            ActivityLogger::log($this->userId($req), 'create', 'product', "Bulk imported $imported products via CSV");

            Response::success([
                'imported' => $imported,
                'skipped'  => $skipped,
                'errors'   => $errors,
            ], "Import completed: $imported products added, $skipped skipped.");

        } catch (Exception $e) {
            $db->rollBack();
            fclose($handle);
            Response::error('Failed to import products: ' . $e->getMessage(), 500);
        }
    }

    /** EAN-13-style 13-digit numeric barcode. */
    private function generateBarcode(): string
    {
        do {
            $code = '890' . str_pad((string) random_int(0, 9999999999), 10, '0', STR_PAD_LEFT);
        } while ($this->model->findBy('barcode', $code));
        return $code;
    }

    private function handleImageUpload(): ?string
    {
        if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            return null;
        }
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
        $mime    = mime_content_type($_FILES['image']['tmp_name']);
        if (!isset($allowed[$mime])) Response::error('Invalid image type', 422);
        if ($_FILES['image']['size'] > 2 * 1024 * 1024) Response::error('Image must be under 2MB', 422);

        $dir = UPLOAD_DIR . DIRECTORY_SEPARATOR . 'products';
        if (!is_dir($dir)) mkdir($dir, 0777, true);
        $name = 'prod_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $allowed[$mime];
        move_uploaded_file($_FILES['image']['tmp_name'], $dir . DIRECTORY_SEPARATOR . $name);
        return 'products/' . $name;
    }

    private function getDefaultReorderLevel(): int
    {
        try {
            $settingModel = new Setting();
            $settings = $settingModel->get();
            if (isset($settings['low_stock_threshold'])) {
                return (int) $settings['low_stock_threshold'];
            }
        } catch (Throwable $e) {
            // Fail silently
        }
        return 10;
    }
}
