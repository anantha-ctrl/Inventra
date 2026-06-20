<?php
/**
 * Authentication & role middleware factories.
 */
class AuthMiddleware
{
    /** Verify JWT and attach the user payload to the request. */
    public static function authenticate(): callable
    {
        return function (Request $req) {
            $token = $req->bearerToken();
            if (!$token) {
                Response::error('Authorization token missing', 401);
            }
            $payload = JWT::decode($token);
            if (!$payload) {
                Response::error('Invalid or expired token', 401);
            }
            $req->user = [
                'id'    => $payload['sub']  ?? null,
                'name'  => $payload['name'] ?? null,
                'email' => $payload['email'] ?? null,
                'role'  => $payload['role'] ?? null,
            ];
        };
    }

    /** Require the user to hold one of the given roles. */
    public static function role(array $roles): callable
    {
        return function (Request $req) use ($roles) {
            $userRole = $req->user['role'] ?? null;
            if (!$userRole) {
                Response::error('Insufficient role permissions', 403);
            }
            if ($userRole === 'Admin') {
                return; // Admin always has full access
            }

            if (!in_array($userRole, $roles, true)) {
                Response::error('Insufficient role permissions', 403);
            }

            try {
                // Effective permissions for THIS user (per-user overrides role
                // defaults; falls back to the role map when the user has none).
                $userModel = new User();
                $dbUser = $userModel->find((int) ($req->user['id'] ?? 0));
                $perms = [];
                if ($dbUser) {
                    $dbUser['role'] = $userRole;
                    $perms = $userModel->resolvePermissions($dbUser);
                }

                if (!empty($perms)) {
                    $uri = $_SERVER['REQUEST_URI'] ?? '';
                    $uri = parse_url($uri, PHP_URL_PATH);
                    $base = '/Inventra/backend';
                    if (str_starts_with($uri, $base)) {
                        $uri = substr($uri, strlen($base));
                    }
                    $uri = '/' . trim($uri, '/');
                    $parts = explode('/', $uri);
                    $module = $parts[1] ?? '';

                    $map = [
                        'products'      => 'products',
                        'categories'    => 'categories',
                        'stock'         => 'stock',
                        'purchases'     => 'purchases',
                        'sales'         => 'sales',
                        'suppliers'     => 'suppliers',
                        'customers'     => 'customers',
                        'reports'       => 'reports',
                        'notifications' => 'notifications',
                        'activity-logs' => 'activity-logs',
                        'users'         => 'users',
                    ];

                    if (isset($map[$module])) {
                        $permissionKey = $map[$module];
                        $allowed = !empty($perms[$permissionKey]);

                        // The POS terminal must read products & customers and create
                        // sales — so granting "pos" implies access to those endpoints
                        // even when the standalone module pages are switched off.
                        $posImplies = ['products', 'customers', 'sales'];
                        if (!$allowed
                            && !empty($perms['pos'])
                            && in_array($permissionKey, $posImplies, true)) {
                            $allowed = true;
                        }

                        if (!$allowed) {
                            Response::error('Access to ' . $permissionKey . ' is disabled for your account', 403);
                        }
                    }
                }
            } catch (Throwable $e) {
                // Fallback to static check
            }
        };
    }
}
