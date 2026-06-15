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
            if (!in_array($req->user['role'] ?? null, $roles, true)) {
                Response::error('Insufficient role permissions', 403);
            }
        };
    }
}
