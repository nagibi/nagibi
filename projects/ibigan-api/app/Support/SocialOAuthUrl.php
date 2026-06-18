<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\Request;

/**
 * URLs de OAuth derivadas do host da requisição (localhost, IP da LAN, produção).
 * Nginx local serve API e SPA no mesmo host/porta.
 */
final class SocialOAuthUrl
{
    public static function redirectUri(Request $request, string $provider): string
    {
        return rtrim($request->getSchemeAndHttpHost(), '/')."/api/v1/auth/{$provider}/callback";
    }

    public static function frontendUrl(Request $request): string
    {
        return rtrim($request->getSchemeAndHttpHost(), '/');
    }
}
