<?php
class ActivityLogController extends Controller
{
    private ActivityLog $model;
    public function __construct() { $this->model = new ActivityLog(); }

    public function index(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        [$rows, $total] = $this->model->paginateJoined(
            $req->page(), $req->perPage(), $req->search(),
            [
                'module' => $req->query('module'),
                'action' => $req->query('action'),
            ]
        );
        Response::paginated($rows, $total, $req->page(), $req->perPage());
    }
}
