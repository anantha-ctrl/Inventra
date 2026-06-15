<?php
class NotificationController extends Controller
{
    private Notification $model;
    public function __construct() { $this->model = new Notification(); }

    public function index(Request $req): void
    {
        [$rows, $total] = $this->model->paginateRows(
            $req->page(), $req->perPage(), '', [],
            ['type' => $req->query('type')],
            'id DESC'
        );
        Response::paginated($rows, $total, $req->page(), $req->perPage());
    }

    public function unreadCount(Request $req): void
    {
        Response::success(['count' => $this->model->unreadCount()]);
    }

    public function markRead(Request $req, array $p): void
    {
        $id = (int) $p['id'];
        if (!$this->model->find($id)) Response::error('Notification not found', 404);
        $this->model->update($id, ['is_read' => 1]);
        Response::success(null, 'Marked as read');
    }

    public function markAllRead(Request $req): void
    {
        $this->model->markAllRead();
        Response::success(null, 'All notifications marked as read');
    }

    public function destroy(Request $req, array $p): void
    {
        $this->model->delete((int) $p['id']);
        Response::success(null, 'Notification deleted');
    }
}
