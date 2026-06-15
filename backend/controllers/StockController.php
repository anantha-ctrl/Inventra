<?php
class StockController extends Controller
{
    private StockTransaction $model;
    public function __construct() { $this->model = new StockTransaction(); }

    /** Stock movement history (ledger). */
    public function index(Request $req): void
    {
        [$rows, $total] = $this->model->paginateJoined(
            $req->page(), $req->perPage(), $req->search(),
            [
                'type'       => $req->query('type'),
                'product_id' => $req->query('product_id'),
            ]
        );
        Response::paginated($rows, $total, $req->page(), $req->perPage());
    }

    /**
     * Manual stock movement.
     * type: in | out | adjustment | damaged | returned
     * For 'adjustment' the quantity is the new absolute count.
     */
    public function move(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager', 'Staff']);
        $this->validate($req, [
            'product_id' => 'required|numeric',
            'type'       => 'required|in:in,out,adjustment,damaged,returned',
            'quantity'   => 'required|numeric|min:0',
        ]);

        $type = $req->input('type');
        if ($type === 'adjustment') {
            $this->authorize($req, ['Admin', 'Manager']);
        }

        $productModel = new Product();
        $product = $productModel->find((int) $req->input('product_id'));
        if (!$product) Response::error('Product not found', 404);
        $qty  = (int) $req->input('quantity');
        $note = $req->input('note', '');
        $before = (int) $product['quantity'];

        // Determine signed delta per movement type
        switch ($type) {
            case 'in':
            case 'returned':
                $signed = $qty; break;
            case 'out':
            case 'damaged':
                if ($qty > $before) Response::error("Cannot remove $qty — only $before in stock", 422);
                $signed = -$qty; break;
            case 'adjustment':
                $signed = $qty - $before;  // set absolute
                break;
            default:
                Response::error('Invalid movement type', 422);
        }

        $txId = $this->model->record(
            (int) $product['id'], $type, $signed, 'manual', null,
            $note ?: ucfirst($type) . ' adjustment', $this->userId($req)
        );

        Notifier::checkStock($productModel->find((int) $product['id']));
        ActivityLogger::log($this->userId($req), 'stock', 'inventory',
            ucfirst($type) . " for {$product['name']} (qty $qty)");
        Response::success(['transaction_id' => $txId], 'Stock movement recorded', 201);
    }

    /** Movement history for a single product. */
    public function productHistory(Request $req, array $p): void
    {
        [$rows, $total] = $this->model->paginateJoined(
            $req->page(), $req->perPage(), '',
            ['product_id' => (int) $p['id']]
        );
        Response::paginated($rows, $total, $req->page(), $req->perPage());
    }
}
