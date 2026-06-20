<?php
class ExpenseController extends Controller
{
    private Expense $model;
    public function __construct() { $this->model = new Expense(); }

    public function index(Request $req): void
    {
        [$rows, $total] = $this->model->paginateJoined(
            $req->page(), $req->perPage(), $req->search(),
            ['from' => $req->query('from'), 'to' => $req->query('to'), 'category' => $req->query('category')]
        );
        Response::paginated($rows, $total, $req->page(), $req->perPage());
    }

    public function store(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $this->validate($req, [
            'category'     => 'required|max:80',
            'amount'       => 'required|numeric|min:0',
            'expense_date' => 'required',
        ]);
        $id = $this->model->create([
            'category'     => $req->input('category'),
            'amount'       => (float) $req->input('amount'),
            'expense_date' => $req->input('expense_date'),
            'payment_mode' => $req->input('payment_mode', 'cash'),
            'note'         => $req->input('note'),
            'created_by'   => $this->userId($req),
        ]);
        ActivityLogger::log($this->userId($req), 'create', 'expense', 'Recorded expense ' . $req->input('category'));
        Response::success(['id' => $id], 'Expense recorded', 201);
    }

    public function update(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $id = (int) $p['id'];
        if (!$this->model->find($id)) Response::error('Expense not found', 404);
        $this->validate($req, ['category' => 'required|max:80', 'amount' => 'required|numeric|min:0', 'expense_date' => 'required']);
        $this->model->update($id, [
            'category'     => $req->input('category'),
            'amount'       => (float) $req->input('amount'),
            'expense_date' => $req->input('expense_date'),
            'payment_mode' => $req->input('payment_mode', 'cash'),
            'note'         => $req->input('note'),
        ]);
        ActivityLogger::log($this->userId($req), 'update', 'expense', "Updated expense #$id");
        Response::success(null, 'Expense updated');
    }

    public function destroy(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $id = (int) $p['id'];
        if (!$this->model->find($id)) Response::error('Expense not found', 404);
        $this->model->delete($id);
        ActivityLogger::log($this->userId($req), 'delete', 'expense', "Deleted expense #$id");
        Response::success(null, 'Expense deleted');
    }
}
