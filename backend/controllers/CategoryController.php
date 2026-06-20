<?php
class CategoryController extends Controller
{
    private Category $model;
    public function __construct() { $this->model = new Category(); }

    public function index(Request $req): void
    {
        [$rows, $total] = $this->model->paginateRows(
            $req->page(), $req->perPage(), $req->search(),
            ['name', 'description'],
            ['status' => $req->query('status')],
            'name ASC'
        );
        Response::paginated($rows, $total, $req->page(), $req->perPage());
    }

    public function listAll(Request $req): void
    {
        Response::success($this->model->withProductCount());
    }

    public function show(Request $req, array $p): void
    {
        $row = $this->model->find((int) $p['id']);
        $row ? Response::success($row) : Response::error('Category not found', 404);
    }

    public function store(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $data = $this->validate($req, ['name' => 'required|max:120', 'status' => 'in:active,inactive']);
        if ($this->model->findBy('name', $data['name'])) {
            Response::error('A category with this name already exists', 409);
        }
        $id = $this->model->create([
            'name'        => $data['name'],
            'description' => $req->input('description'),
            'status'      => $req->input('status', 'active'),
            'created_by'  => $this->userId($req),
        ]);
        ActivityLogger::log($this->userId($req), 'create', 'category', "Created category {$data['name']}");
        Response::success(['id' => $id], 'Category created', 201);
    }

    public function update(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $id = (int) $p['id'];
        if (!$this->model->find($id)) Response::error('Category not found', 404);
        $this->validate($req, ['name' => 'required|max:120', 'status' => 'in:active,inactive']);
        $this->model->update($id, [
            'name'        => $req->input('name'),
            'description' => $req->input('description'),
            'status'      => $req->input('status', 'active'),
        ]);
        ActivityLogger::log($this->userId($req), 'update', 'category', "Updated category #$id");
        Response::success(null, 'Category updated');
    }

    public function destroy(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $id = (int) $p['id'];
        if (!$this->model->find($id)) Response::error('Category not found', 404);
        $inUse = (new Product())->count('category_id = ?', [$id]);
        if ($inUse > 0) Response::error('Cannot delete: products are assigned to this category', 409);
        $this->model->delete($id);
        ActivityLogger::log($this->userId($req), 'delete', 'category', "Deleted category #$id");
        Response::success(null, 'Category deleted');
    }

    /** Bulk delete — categories that still have products assigned are skipped. */
    public function bulkDestroy(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $ids = $req->input('ids');
        if (!is_array($ids) || empty($ids)) Response::error('No category IDs provided', 422);
        $ids = array_values(array_unique(array_map('intval', $ids)));

        $db = $this->model->db();
        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        // Find categories that are still in use by products — these are skipped.
        $usedStmt = $db->prepare("SELECT DISTINCT category_id FROM products WHERE category_id IN ($placeholders)");
        $usedStmt->execute($ids);
        $usedIds = array_map('intval', $usedStmt->fetchAll(PDO::FETCH_COLUMN));

        $idsToDelete = array_values(array_diff($ids, $usedIds));

        $skippedNames = [];
        if (!empty($usedIds)) {
            $ph = implode(',', array_fill(0, count($usedIds), '?'));
            $nameStmt = $db->prepare("SELECT name FROM categories WHERE id IN ($ph)");
            $nameStmt->execute($usedIds);
            $skippedNames = $nameStmt->fetchAll(PDO::FETCH_COLUMN);
        }

        $deletedCount = 0;
        if (!empty($idsToDelete)) {
            $ph = implode(',', array_fill(0, count($idsToDelete), '?'));
            $db->beginTransaction();
            try {
                $stmt = $db->prepare("DELETE FROM categories WHERE id IN ($ph)");
                $stmt->execute($idsToDelete);
                $deletedCount = $stmt->rowCount();
                $db->commit();
                ActivityLogger::log($this->userId($req), 'delete', 'category', "Bulk deleted $deletedCount categories");
            } catch (Exception $e) {
                $db->rollBack();
                Response::error('Failed to delete categories', 500);
            }
        }

        $msg = "$deletedCount categor" . ($deletedCount === 1 ? 'y' : 'ies') . ' deleted';
        if (!empty($skippedNames)) {
            $msg .= '. Skipped (products assigned): ' . implode(', ', $skippedNames);
        }
        Response::success(['deleted' => $deletedCount, 'skipped' => $skippedNames], $msg);
    }
}
