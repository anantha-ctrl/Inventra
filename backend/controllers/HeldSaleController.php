<?php
class HeldSaleController extends Controller
{
    private HeldSale $model;
    public function __construct() { $this->model = new HeldSale(); }

    public function index(Request $req): void
    {
        $rows = $this->model->allJoined();
        foreach ($rows as &$r) { $r['cart'] = json_decode($r['cart'], true); }
        Response::success($rows);
    }

    public function store(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $cart = $req->input('cart', []);
        if (!is_array($cart) || count($cart) === 0) Response::error('Cannot hold an empty cart', 422);
        $id = $this->model->create([
            'label'       => $req->input('label') ?: ('Bill ' . date('H:i')),
            'customer_id' => $req->input('customer_id') ?: null,
            'cart'        => json_encode($cart),
            'note'        => $req->input('note'),
            'created_by'  => $this->userId($req),
        ]);
        Response::success(['id' => $id], 'Bill held', 201);
    }

    public function destroy(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $id = (int) $p['id'];
        if (!$this->model->find($id)) Response::error('Held bill not found', 404);
        $this->model->delete($id);
        Response::success(null, 'Held bill removed');
    }
}
