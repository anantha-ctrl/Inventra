<?php
/**
 * Base controller.
 */
abstract class Controller
{
    protected function validate(Request $req, array $rules): array
    {
        $v = new Validator($req->all());
        if (!$v->validate($rules)) {
            Response::error('Validation failed', 422, $v->errors());
        }
        return $req->all();
    }

    /** Abort unless the authenticated user has one of the given roles. */
    protected function authorize(Request $req, array $roles): void
    {
        $role = $req->user['role'] ?? null;
        if (!in_array($role, $roles, true)) {
            Response::error('You do not have permission to perform this action', 403);
        }
    }

    protected function userId(Request $req): ?int
    {
        return isset($req->user['id']) ? (int) $req->user['id'] : null;
    }
}
