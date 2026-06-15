<?php
/**
 * Simple regex-based REST router with per-route middleware.
 */
class Router
{
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler, array $middleware = []): void
    {
        // Convert {id} -> named capture group
        $regex = preg_replace('#\{([a-zA-Z_]+)\}#', '(?P<$1>[^/]+)', $pattern);
        $regex = '#^' . $regex . '$#';
        $this->routes[] = compact('method', 'regex', 'handler', 'middleware');
    }

    public function get($p, $h, $m = [])    { $this->add('GET', $p, $h, $m); }
    public function post($p, $h, $m = [])   { $this->add('POST', $p, $h, $m); }
    public function put($p, $h, $m = [])    { $this->add('PUT', $p, $h, $m); }
    public function delete($p, $h, $m = []) { $this->add('DELETE', $p, $h, $m); }

    public function dispatch(string $method, string $uri): void
    {
        // Support method override for multipart uploads (?_method=PUT)
        if ($method === 'POST' && !empty($_GET['_method'])) {
            $override = strtoupper($_GET['_method']);
            if (in_array($override, ['PUT', 'DELETE'], true)) {
                $method = $override;
            }
        }
        $uri = parse_url($uri, PHP_URL_PATH);
        // Strip the base path so routes can be declared cleanly (e.g. /auth/login)
        $base = '/Inventra/backend';
        if (str_starts_with($uri, $base)) {
            $uri = substr($uri, strlen($base));
        }
        $uri = '/' . trim($uri, '/');
        $uri = rtrim($uri, '/') ?: '/';

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) continue;
            if (preg_match($route['regex'], $uri, $matches)) {
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);

                $request = new Request();
                foreach ($route['middleware'] as $mw) {
                    // Middleware may abort (exit) or attach data to $request
                    $mw($request);
                }
                call_user_func($route['handler'], $request, $params);
                return;
            }
        }
        Response::error('Route not found: ' . $method . ' ' . $uri, 404);
    }
}
