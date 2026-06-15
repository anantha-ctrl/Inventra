<?php
/**
 * Minimal self-contained JWT (HS256) implementation — no external dependency.
 */
class JWT
{
    public static function encode(array $payload): string
    {
        $header  = ['typ' => 'JWT', 'alg' => 'HS256'];
        $now     = time();
        $payload = array_merge([
            'iss' => JWT_ISSUER,
            'iat' => $now,
            'exp' => $now + JWT_TTL,
        ], $payload);

        $segments   = [];
        $segments[] = self::b64UrlEncode(json_encode($header));
        $segments[] = self::b64UrlEncode(json_encode($payload));
        $signing    = implode('.', $segments);
        $signature  = hash_hmac('sha256', $signing, JWT_SECRET, true);
        $segments[] = self::b64UrlEncode($signature);

        return implode('.', $segments);
    }

    /** Returns the decoded payload array, or null when invalid/expired. */
    public static function decode(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        [$h, $p, $s] = $parts;

        $expected = self::b64UrlEncode(hash_hmac('sha256', "$h.$p", JWT_SECRET, true));
        if (!hash_equals($expected, $s)) {
            return null;
        }

        $payload = json_decode(self::b64UrlDecode($p), true);
        if (!is_array($payload)) {
            return null;
        }
        if (isset($payload['exp']) && time() >= $payload['exp']) {
            return null;
        }
        return $payload;
    }

    private static function b64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function b64UrlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
