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
            'description'   => $req->input('description'),
            'unit'          => $req->input('unit', 'pcs'),
            'cost_price'    => (float) $req->input('cost_price', 0),
            'selling_price' => (float) $req->input('selling_price', 0),
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
            'description'   => $req->input('description'),
            'unit'          => $req->input('unit', 'pcs'),
            'cost_price'    => (float) $req->input('cost_price', 0),
            'selling_price' => (float) $req->input('selling_price', 0),
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
            'unit'          => array_search('unit', $headers),
            'cost_price'    => array_search('cost_price', $headers),
            'selling_price' => array_search('selling_price', $headers),
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

                $prodId = $this->model->create([
                    'category_id'   => $catId,
                    'supplier_id'   => $supplierId,
                    'name'          => $name,
                    'sku'           => $sku,
                    'barcode'       => $barcode,
                    'description'   => $description,
                    'unit'          => $unit,
                    'cost_price'    => $costPrice,
                    'selling_price' => $sellingPrice,
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
