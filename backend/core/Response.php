<?php
/**
 * JSON response helper.
 */
class Response
{
    public static function json($data, int $code = 200): void
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data);
        exit;
    }

    public static function success($data = null, string $message = 'OK', int $code = 200): void
    {
        self::json(['success' => true, 'message' => $message, 'data' => $data], $code);
    }

    public static function paginated(array $rows, int $total, int $page, int $perPage, string $message = 'OK'): void
    {
        self::json([
            'success'    => true,
            'message'    => $message,
            'data'       => $rows,
            'pagination' => [
                'total'     => $total,
                'page'      => $page,
                'per_page'  => $perPage,
                'last_page' => (int) ceil($total / max(1, $perPage)),
            ],
        ]);
    }

    public static function error(string $message, int $code = 400, $errors = null): void
    {
        self::json(['success' => false, 'message' => $message, 'errors' => $errors], $code);
    }
}
