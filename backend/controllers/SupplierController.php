<?php
class SupplierController extends Controller
{
    private Supplier $model;
    public function __construct() { $this->model = new Supplier(); }

    public function index(Request $req): void
    {
        [$rows, $total] = $this->model->paginateRows(
            $req->page(), $req->perPage(), $req->search(),
            ['name', 'company', 'email', 'phone', 'city'],
            ['status' => $req->query('status')],
            'name ASC'
        );
        Response::paginated($rows, $total, $req->page(), $req->perPage());
    }

    public function listAll(Request $req): void
    {
        Response::success($this->model->all('name ASC'));
    }

    public function show(Request $req, array $p): void
    {
        $row = $this->model->find((int) $p['id']);
        if (!$row) Response::error('Supplier not found', 404);
        $row['purchase_history'] = $this->model->purchaseHistory((int) $p['id']);
        Response::success($row);
    }

    public function store(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $this->validate($req, ['name' => 'required|max:150', 'email' => 'email', 'status' => 'in:active,inactive']);
        $id = $this->model->create($this->payload($req));
        ActivityLogger::log($this->userId($req), 'create', 'supplier', "Created supplier " . $req->input('name'));
        Response::success(['id' => $id], 'Supplier created', 201);
    }

    public function update(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $id = (int) $p['id'];
        if (!$this->model->find($id)) Response::error('Supplier not found', 404);
        $this->validate($req, ['name' => 'required|max:150', 'email' => 'email', 'status' => 'in:active,inactive']);
        $this->model->update($id, $this->payload($req));
        ActivityLogger::log($this->userId($req), 'update', 'supplier', "Updated supplier #$id");
        Response::success(null, 'Supplier updated');
    }

    public function destroy(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $id = (int) $p['id'];
        if (!$this->model->find($id)) Response::error('Supplier not found', 404);
        if ((new Product())->count('supplier_id = ?', [$id]) > 0) {
            Response::error('Cannot delete: products reference this supplier', 409);
        }
        $this->model->delete($id);
        ActivityLogger::log($this->userId($req), 'delete', 'supplier', "Deleted supplier #$id");
        Response::success(null, 'Supplier deleted');
    }

    private function payload(Request $req): array
    {
        return [
            'name'    => $req->input('name'),
            'company' => $req->input('company'),
            'email'   => $req->input('email'),
            'phone'   => $req->input('phone'),
            'address' => $req->input('address'),
            'city'    => $req->input('city'),
            'country' => $req->input('country'),
            'status'  => $req->input('status', 'active'),
        ];
    }
}
