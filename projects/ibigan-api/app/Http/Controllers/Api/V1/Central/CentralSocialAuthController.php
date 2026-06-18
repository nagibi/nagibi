<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Central;

use App\Http\Controllers\Api\V1\Auth\SocialAuthController;
use App\Http\Controllers\Controller;
use App\Support\SocialOAuthUrl;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\Response;

final class CentralSocialAuthController extends Controller
{
    private const PROVIDERS = ['google', 'apple'];

    public function redirect(Request $request, string $provider): RedirectResponse
    {
        $this->assertProvider($provider);

        $driver = Socialite::driver($provider)
            ->redirectUrl(SocialOAuthUrl::redirectUri($request, $provider))
            ->with(['state' => SocialAuthController::CENTRAL_OAUTH_STATE])
            ->stateless();

        if ($provider === 'apple') {
            $driver->scopes(['name', 'email']);
        }

        return $driver->redirect();
    }

    private function assertProvider(string $provider): void
    {
        if (! in_array($provider, self::PROVIDERS, true)) {
            abort(Response::HTTP_NOT_FOUND);
        }
    }
}
