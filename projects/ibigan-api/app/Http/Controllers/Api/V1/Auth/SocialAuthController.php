<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\Central\CentralUser;
use App\Models\Tenant;
use App\Models\User;
use App\Services\TenantContextResolver;
use App\Support\SocialOAuthUrl;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\Response;

final class SocialAuthController extends Controller
{
    public const CENTRAL_OAUTH_STATE = 'central';

    private const PROVIDERS = ['google', 'apple'];

    public function redirect(Request $request, string $provider): RedirectResponse
    {
        $this->assertProvider($provider);

        $tenantId = $request->query('tenant_id')
            ?? app(TenantContextResolver::class)->resolveTenantId($request);

        $driver = Socialite::driver($provider)
            ->redirectUrl(SocialOAuthUrl::redirectUri($request, $provider))
            ->with(['state' => $tenantId ?? ''])
            ->stateless();

        if ($provider === 'apple') {
            $driver->scopes(['name', 'email']);
        }

        return $driver->redirect();
    }

    public function callback(Request $request, string $provider): RedirectResponse
    {
        $this->assertProvider($provider);

        try {
            $socialUser = Socialite::driver($provider)
                ->redirectUrl(SocialOAuthUrl::redirectUri($request, $provider))
                ->stateless()
                ->user();
            $tenantId = $request->input('state', $request->query('state', ''));
            $frontUrl = SocialOAuthUrl::frontendUrl($request);

            if ($tenantId === self::CENTRAL_OAUTH_STATE) {
                return $this->handleCentralCallback($socialUser, $provider, $frontUrl);
            }

            if ($tenantId) {
                return $this->handleTenantLogin($socialUser, $provider, $tenantId, $frontUrl);
            }

            return $this->handleTenantRegistration($socialUser, $provider, $frontUrl);
        } catch (\Exception $e) {
            \Log::error("{$provider} OAuth error: ".$e->getMessage().' '.$e->getTraceAsString());

            $state = $request->input('state', $request->query('state', ''));
            $loginPath = $state === self::CENTRAL_OAUTH_STATE
                ? '/central/login?error=oauth_failed'
                : '/auth/login?error=oauth_failed&msg='.urlencode($e->getMessage());

            return redirect(SocialOAuthUrl::frontendUrl($request).$loginPath);
        }
    }

    private function handleCentralCallback(
        SocialiteUser $socialUser,
        string $provider,
        string $frontUrl,
    ): RedirectResponse {
        $email = $socialUser->getEmail();

        if (! $email) {
            return redirect("{$frontUrl}/central/login?error=email_not_provided");
        }

        $centralUser = CentralUser::query()
            ->where('email', $email)
            ->where('is_active', true)
            ->first();

        if (! $centralUser || ! $centralUser->is_super_admin) {
            return redirect("{$frontUrl}/central/login?error=unauthorized");
        }

        $token = $centralUser->createToken("{$provider}-oauth-central")->plainTextToken;

        return redirect("{$frontUrl}/central/auth/callback?token={$token}");
    }

    private function handleTenantLogin(
        SocialiteUser $socialUser,
        string $provider,
        string $tenantId,
        string $frontUrl,
    ): RedirectResponse {
        $tenant = $this->findTenant($tenantId);

        if (! $tenant) {
            return redirect("{$frontUrl}/auth/login?error=tenant_not_found");
        }

        $result = $tenant->run(function () use ($socialUser, $provider): array {
            $email = $socialUser->getEmail();

            if (! $email) {
                return ['error' => 'email_not_provided'];
            }

            $user = User::where('email', $email)->first();

            if (! $user) {
                return ['error' => 'user_not_found'];
            }

            $token = $user->createToken("{$provider}-oauth")->plainTextToken;

            return ['token' => $token];
        });

        if (isset($result['error'])) {
            return redirect("{$frontUrl}/auth/login?error={$result['error']}");
        }

        $token = $result['token'];

        return redirect("{$frontUrl}/auth/callback?token={$token}&tenant_id={$tenant->id}");
    }

    private function handleTenantRegistration(
        SocialiteUser $socialUser,
        string $provider,
        string $frontUrl,
    ): RedirectResponse {
        $email = $socialUser->getEmail();

        if (! $email) {
            return redirect("{$frontUrl}/auth/login?error=email_not_provided");
        }

        $displayName = $socialUser->getName() ?: Str::before($email, '@');
        $tenantSlug = Str::slug($displayName).'-'.Str::random(6);
        $tenantName = $displayName."'s Workspace";

        $tenant = Tenant::create([
            'id' => $tenantSlug,
            'slug' => $tenantSlug,
            'name' => $tenantName,
        ]);

        $token = $tenant->run(function () use ($socialUser, $provider, $displayName, $email): string {
            app(RolePermissionSeeder::class)->run();

            $user = User::create([
                'name' => $displayName,
                'email' => $email,
                'password' => bcrypt(Str::random(32)),
            ]);

            $user->assignRole('admin');

            return $user->createToken("{$provider}-oauth")->plainTextToken;
        });

        return redirect("{$frontUrl}/auth/callback?token={$token}&tenant_id={$tenantSlug}");
    }

    private function findTenant(string $tenantId): ?Tenant
    {
        $tenant = Tenant::find($tenantId);

        if ($tenant !== null) {
            return $tenant;
        }

        return Tenant::query()->where('slug', $tenantId)->first();
    }

    private function assertProvider(string $provider): void
    {
        if (! in_array($provider, self::PROVIDERS, true)) {
            abort(Response::HTTP_NOT_FOUND);
        }
    }
}
