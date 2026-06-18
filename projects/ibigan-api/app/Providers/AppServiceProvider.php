<?php

declare(strict_types=1);

namespace App\Providers;

use App\Http\Middleware\AuthenticateDevTools;
use App\Repositories\Contracts\ActivityLogRepositoryInterface;
use App\Repositories\Contracts\CentralUserRepositoryInterface;
use App\Repositories\Contracts\InviteRepositoryInterface;
use App\Repositories\Contracts\MessageTemplateRepositoryInterface;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Repositories\Eloquent\EloquentActivityLogRepository;
use App\Repositories\Eloquent\EloquentCentralUserRepository;
use App\Repositories\Eloquent\EloquentInviteRepository;
use App\Repositories\Eloquent\EloquentMessageTemplateRepository;
use App\Models\MultiTenantPersonalAccessToken;
use App\Repositories\Eloquent\EloquentUserRepository;
use App\Support\DevToolsAccess;
use App\Support\SentryContext;
use App\Support\TimezoneResolver;
use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\Server;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;
use SocialiteProviders\Apple\Provider as AppleProvider;
use SocialiteProviders\Manager\SocialiteWasCalled;
use Stancl\Tenancy\Events\TenancyEnded;
use Stancl\Tenancy\Events\TenancyInitialized;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        if (class_exists(\Laravel\Telescope\TelescopeApplicationServiceProvider::class)) {
            $this->app->register(TelescopeServiceProvider::class);
        }

        $this->app->bind(CentralUserRepositoryInterface::class, EloquentCentralUserRepository::class);
        $this->app->bind(InviteRepositoryInterface::class, EloquentInviteRepository::class);
        $this->app->bind(MessageTemplateRepositoryInterface::class, EloquentMessageTemplateRepository::class);
        $this->app->bind(ActivityLogRepositoryInterface::class, EloquentActivityLogRepository::class);
        $this->app->bind(UserRepositoryInterface::class, EloquentUserRepository::class);

        Scramble::ignoreDefaultRoutes();
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        TimezoneResolver::applyDefault();

        Sanctum::usePersonalAccessTokenModel(MultiTenantPersonalAccessToken::class);

        Scramble::ignoreDefaultRoutes();

        Scramble::configure()->expose(
            ui: 'docs/api',
            document: 'docs/api.json',
        );

        Scramble::extendOpenApi(function (OpenApi $openApi): void {
            $openApi->info->title = config('scramble.ui.title', 'Ibigan API');
            $openApi->info->version = config('scramble.info.version', '1.0.0');
            $openApi->info->description = config('scramble.info.description', '');

            $openApi->servers = [
                Server::make(rtrim((string) config('app.url'), '/'))
                    ->setDescription('Servidor atual'),
            ];
        });

        Gate::define('viewApiDocs', fn ($user = null) => DevToolsAccess::canViewDevTools($user));

        Gate::define('viewLogViewer', fn ($user = null) => DevToolsAccess::canViewDevTools($user));
        Gate::define('downloadLogFile', fn ($user) => DevToolsAccess::canViewDevTools($user));
        Gate::define('downloadLogFolder', fn ($user) => DevToolsAccess::canViewDevTools($user));
        Gate::define('deleteLogFile', fn ($user) => DevToolsAccess::canViewDevTools($user));
        Gate::define('deleteLogFolder', fn ($user) => DevToolsAccess::canViewDevTools($user));

        Event::listen(TenancyInitialized::class, function (TenancyInitialized $event): void {
            $timezone = $event->tenancy->tenant->timezone ?? null;

            TimezoneResolver::apply(
                is_string($timezone) && $timezone !== ''
                    ? $timezone
                    : (string) config('app.default_timezone'),
            );
        });

        Event::listen(TenancyEnded::class, function (): void {
            TimezoneResolver::applyDefault();
        });

        Event::listen(JobProcessing::class, function (): void {
            SentryContext::applyForQueue();
        });

        Event::listen(function (SocialiteWasCalled $event): void {
            $event->extendSocialite('apple', AppleProvider::class);
        });

        DatabaseNotification::creating(function (DatabaseNotification $notification): void {
            if ($notification->record_id !== null) {
                return;
            }

            $nextRecordId = (int) DatabaseNotification::query()->max('record_id');

            $notification->record_id = $nextRecordId + 1;
        });

        $this->registerClockworkDevToolsMiddleware();
    }

    private function registerClockworkDevToolsMiddleware(): void
    {
        if (! class_exists(\Clockwork\Support\Laravel\ClockworkSupport::class)) {
            return;
        }

        $this->app->booted(function (): void {
            $middleware = ['web', AuthenticateDevTools::class];

            foreach (Route::getRoutes() as $route) {
                $uri = $route->uri();

                if (! str_starts_with($uri, 'clockwork') && ! str_starts_with($uri, '__clockwork')) {
                    continue;
                }

                $route->middleware(array_values(array_unique([
                    ...$route->middleware(),
                    ...$middleware,
                ])));
            }
        });
    }
}
