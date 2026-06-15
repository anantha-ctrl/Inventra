<?php
/**
 * Wraps the incoming HTTP request (body, query, headers, auth user).
 */
class Request
{
    private array $body;
    private array $query;
    public ?array $user = null;   // populated by AuthMiddleware

    public function __construct()
    {
        $this->query = $_GET;
        $raw = file_get_contents('php://input');
        $json = json_decode($raw, true);
        $this->body = is_array($json) ? $json : $_POST;
    }

    public function input(string $key, $default = null)
    {
        return $this->body[$key] ?? $default;
    }

    public function all(): array
    {
        return $this->body;
    }

    public function query(string $key, $default = null)
    {
        return $this->query[$key] ?? $default;
    }

    /** Pagination helpers */
    public function page(): int
    {
        return max(1, (int) ($this->query['page'] ?? 1));
    }

    public function perPage(int $default = 10): int
    {
        $pp = (int) ($this->query['per_page'] ?? $default);
        return min(100, max(1, $pp));
    }

    public function search(): string
    {
        return trim((string) ($this->query['search'] ?? ''));
    }

    public function bearerToken(): ?string
    {
        $headers = self::headers();
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        if (preg_match('/Bearer\s+(.+)/i', $auth, $m)) {
            return trim($m[1]);
        }
        // Fallback for browser-initiated downloads/prints that cannot set headers.
        if (!empty($this->query['token'])) {
            return (string) $this->query['token'];
        }
        return null;
    }

    public static function headers(): array
    {
        if (function_exists('getallheaders')) {
            return getallheaders() ?: [];
        }
        $out = [];
        foreach ($_SERVER as $k => $v) {
            if (str_starts_with($k, 'HTTP_')) {
                $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($k, 5)))));
                $out[$name] = $v;
            }
        }
        return $out;
    }
}
