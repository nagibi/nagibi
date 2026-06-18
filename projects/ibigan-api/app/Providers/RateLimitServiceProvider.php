<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

final class RateLimitServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->configureRateLimiters();
    }

    private function configureRateLimiters(): void
    {
        // Login: 5 tentativas por IP por minuto
        RateLimiter::for('login', function (Request $request): Limit {
            return Limit::perMinute(5)
                ->by($request->ip())
                ->response(function () {
                    return response()->json([
                        'status' => 0,
                        'message' => 'MSG000429',
                        'errors' => ['rate_limit' => ['Muitas tentativas de login. Tente novamente em breve.']],
                    ], 429);
                });
        });

        // Register: 3 por IP por hora
        RateLimiter::for('register', function (Request $request): Limit {
            return Limit::perHour(3)
                ->by($request->ip())
                ->response(function () {
                    return response()->json([
                        'status' => 0,
                        'message' => 'MSG000429',
                        'errors' => ['rate_limit' => ['Limite de registros atingido. Tente novamente em 1 hora.']],
                    ], 429);
                });
        });

        // Forgot password: 3 por IP por hora
        RateLimiter::for('forgot-password', function (Request $request): Limit {
            return Limit::perHour(3)
                ->by($request->ip())
                ->response(function () {
                    return response()->json([
                        'status' => 0,
                        'message' => 'MSG000429',
                        'errors' => ['rate_limit' => ['Limite de solicitações atingido. Tente novamente em 1 hora.']],
                    ], 429);
                });
        });

        // 2FA challenge: 5 por IP por minuto
        RateLimiter::for('two-factor', function (Request $request): Limit {
            return Limit::perMinute(5)
                ->by($request->ip())
                ->response(function () {
                    return response()->json([
                        'status' => 0,
                        'message' => 'MSG000429',
                        'errors' => ['rate_limit' => ['Muitas tentativas. Tente novamente em breve.']],
                    ], 429);
                });
        });

        // Invite accept: 10 por IP por minuto
        RateLimiter::for('invite-accept', function (Request $request): Limit {
            return Limit::perMinute(10)
                ->by($request->ip())
                ->response(function () {
                    return response()->json([
                        'status' => 0,
                        'message' => 'MSG000429',
                        'errors' => ['rate_limit' => ['Muitas tentativas. Tente novamente em breve.']],
                    ], 429);
                });
        });

        // API geral: por usuário autenticado (ou tenant/IP anônimo)
        RateLimiter::for('api', function (Request $request): Limit {
            if (app()->environment('local')) {
                return Limit::none();
            }

            $user = $request->user();
            $tenantId = $request->header('X-Tenant-ID');

            $key = $user
                ? 'user:'.$user->getAuthIdentifier().':tenant:'.($tenantId ?? 'central')
                : ($tenantId ? 'tenant:'.$tenantId : 'ip:'.$request->ip());

            return Limit::perMinute((int) env('API_RATE_LIMIT_PER_MINUTE', 300))
                ->by($key)
                ->response(function () {
                    return response()->json([
                        'status' => 0,
                        'message' => 'MSG000429',
                        'errors' => ['rate_limit' => ['Limite de requisições atingido. Tente novamente em breve.']],
                    ], 429);
                });
        });
    }
}
