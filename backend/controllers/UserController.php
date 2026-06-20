<?php
class UserController extends Controller
{
    private User $model;
    public function __construct() { $this->model = new User(); }

    public function index(Request $req): void
    {
        $this->authorize($req, ['Admin']);
        [$rows, $total] = $this->model->paginate($req->page(), $req->perPage(), $req->search());
        Response::paginated($rows, $total, $req->page(), $req->perPage());
    }

    public function roles(Request $req): void
    {
        Response::success((new Role())->all('id ASC'));
    }

    public function show(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin']);
        $user = $this->model->findWithRole((int) $p['id']);
        if (!$user) Response::error('User not found', 404);
        $user['permissions'] = !empty($user['permissions']) ? json_decode($user['permissions'], true) : null;
        unset($user['password'], $user['reset_token']);
        Response::success($user);
    }

    /** Normalize a permissions map → JSON string, or null to inherit role. */
    private function normalizePermissions($val): ?string
    {
        return (is_array($val) && count($val)) ? json_encode($val) : null;
    }

    public function store(Request $req): void
    {
        $this->authorize($req, ['Admin']);
        $this->validate($req, [
            'name'     => 'required|max:120',
            'email'    => 'required|email',
            'password' => 'required|min:6',
            'role_id'  => 'required|numeric',
        ]);
        if ($this->model->findBy('email', $req->input('email'))) {
            Response::error('Email already registered', 409);
        }
        $id = $this->model->create([
            'role_id'  => (int) $req->input('role_id'),
            'name'     => $req->input('name'),
            'email'    => $req->input('email'),
            'password' => password_hash($req->input('password'), PASSWORD_BCRYPT),
            'phone'    => $req->input('phone'),
            'status'   => $req->input('status', 'active'),
            'permissions' => $this->normalizePermissions($req->input('permissions')),
        ]);
        ActivityLogger::log($this->userId($req), 'create', 'user', "Created user " . $req->input('email'));
        Response::success(['id' => $id], 'User created', 201);
    }

    public function update(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin']);
        $id = (int) $p['id'];
        $user = $this->model->find($id);
        if (!$user) Response::error('User not found', 404);
        $this->validate($req, ['name' => 'required|max:120', 'email' => 'required|email', 'role_id' => 'required|numeric']);

        $data = [
            'role_id' => (int) $req->input('role_id'),
            'name'    => $req->input('name'),
            'email'   => $req->input('email'),
            'phone'   => $req->input('phone'),
            'status'  => $req->input('status', 'active'),
            'permissions' => $this->normalizePermissions($req->input('permissions')),
        ];
        if ($req->input('password')) {
            $data['password'] = password_hash($req->input('password'), PASSWORD_BCRYPT);
        }
        $this->model->update($id, $data);
        ActivityLogger::log($this->userId($req), 'update', 'user', "Updated user #$id");
        Response::success(null, 'User updated');
    }

    public function destroy(Request $req, array $p): void
    {
        $this->authorize($req, ['Admin']);
        $id = (int) $p['id'];
        if ($id === $this->userId($req)) Response::error('You cannot delete your own account', 422);
        if (!$this->model->find($id)) Response::error('User not found', 404);
        $this->model->delete($id);
        ActivityLogger::log($this->userId($req), 'delete', 'user', "Deleted user #$id");
        Response::success(null, 'User deleted');
    }
}
