<?php
class CustomerController extends Controller
{
    private Customer $model;
    public function __construct() { $this->model = new Customer(); }

    public function index(Request $req): void
    {
        [$rows, $total] = $this->model->paginateRows(
            $req->page(), $req->perPage(), $req->search(),
            ['name', 'email', 'phone', 'city'],
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
        if (!$row) Response::error('Customer not found', 404);
        $row['sales_history'] = $this->model->salesHistory((int) $p['id']);
        Response::success($row);
    }

    public function store(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $this->validate($req, ['name' => 'required|max:150', 'email' => 'email', 'status' => 'in:active,inactive']);
        $id = $this->model->create($this->payload($req));
        ActivityLogger::log($this->userId($req), 'create', 'customer', "Created customer " . $req->input('name'));
        Response::success(['id' => $id], 'Customer created', 201);
    }

    public function update(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $id = (int) $p['id'];
        if (!$this->model->find($id)) Response::error('Customer not found', 404);
        $this->validate($req, ['name' => 'required|max:150', 'email' => 'email', 'status' => 'in:active,inactive']);
        $this->model->update($id, $this->payload($req));
        ActivityLogger::log($this->userId($req), 'update', 'customer', "Updated customer #$id");
        Response::success(null, 'Customer updated');
    }

    public function destroy(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $id = (int) $p['id'];
        if (!$this->model->find($id)) Response::error('Customer not found', 404);
        if ((new Sale())->count('customer_id = ?', [$id]) > 0) {
            Response::error('Cannot delete: sales reference this customer', 409);
        }
        $this->model->delete($id);
        ActivityLogger::log($this->userId($req), 'delete', 'customer', "Deleted customer #$id");
        Response::success(null, 'Customer deleted');
    }

    private function payload(Request $req): array
    {
        return [
            'name'    => $req->input('name'),
            'email'   => $req->input('email'),
            'phone'   => $req->input('phone'),
            'address' => $req->input('address'),
            'city'    => $req->input('city'),
            'status'  => $req->input('status', 'active'),
        ];
    }
}
