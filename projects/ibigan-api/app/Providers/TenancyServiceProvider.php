<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\Campaign;
use App\Models\Menu;
use App\Models\MessageTemplate;
use App\Models\User;
use App\Models\Webhook;
use App\Support\TenantStoragePermissions;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;
use ReflectionClass;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Permission\PermissionRegistrar;
use Stancl\JobPipeline\JobPipeline;
use Stancl\Tenancy\Contracts\Tenant;
use Stancl\Tenancy\Events;
use Stancl\Tenancy\Jobs;
use Stancl\Tenancy\Listeners;
use Stancl\Tenancy\Middleware;

class TenancyServiceProvider extends ServiceProvider
{
    public static string $controllerNamespace = '';

    /** @var list<class-string<Model>> */
    private const ACTIVITY_LOG_MODELS = [
        User::class,
        Menu::class,
        MessageTemplate::class,
        Webhook::class,
        Campaign::class,
    ];

    private ?string $originalPublicDiskUrl = null;

    public function events(): array
    {
        return [
            // Tenant criado → cria banco + roda migrations automaticamente
            Events\TenantCreated::class => [
                JobPipeline::make([
                    Jobs\CreateDatabase::class,
                    Jobs\MigrateDatabase::class,
                    // Jobs\SeedDatabase::class, // ativar quando tiver seeder de tenant
                ])->send(fn (Events\TenantCreated $event) => $event->tenant)
                    ->shouldBeQueued(false),
            ],

            // Tenant deletado → remove banco
            Events\TenantDeleted::class => [
                JobPipeline::make([
                    Jobs\DeleteDatabase::class,
                ])->send(fn (Events\TenantDeleted $event) => $event->tenant)
                    ->shouldBeQueued(false),
            ],

            // Tenancy inicializado → bootstrap + limpa cache do Spatie Permission
            Events\TenancyInitialized::class => [
                Listeners\BootstrapTenancy::class,
            ],

            // Tenancy encerrado → reverte para contexto central
            Events\TenancyEnded::class => [
                Listeners\RevertToCentralContext::class,
            ],

            // Eventos obrigatórios (não remover)
            Events\CreatingTenant::class => [],
            Events\SavingTenant::class => [],
            Events\TenantSaved::class => [],
            Events\UpdatingTenant::class => [],
            Events\TenantUpdated::class => [],
            Events\DeletingTenant::class => [],
            Events\CreatingDomain::class => [],
            Events\DomainCreated::class => [],
            Events\SavingDomain::class => [],
            Events\DomainSaved::class => [],
            Events\UpdatingDomain::class => [],
            Events\DomainUpdated::class => [],
            Events\DeletingDomain::class => [],
            Events\DomainDeleted::class => [],
            Events\DatabaseCreated::class => [],
            Events\DatabaseMigrated::class => [],
            Events\DatabaseSeeded::class => [],
            Events\DatabaseRolledBack::class => [],
            Events\DatabaseDeleted::class => [],
            Events\InitializingTenancy::class => [],
            Events\EndingTenancy::class => [],
            Events\BootstrappingTenancy::class => [],
            Events\TenancyBootstrapped::class => [],
            Events\RevertingToCentralContext::class => [],
            Events\RevertedToCentralContext::class => [],
        ];
    }

    public function register(): void {}

    public function boot(): void
    {
        $this->bootEvents();
        $this->mapRoutes();
        $this->makeTenancyMiddlewareHighestPriority();
        $this->registerTenancyHooks();
    }

    protected function registerTenancyHooks(): void
    {
        $this->originalPublicDiskUrl = config('filesystems.disks.public.url');

        // Limpa cache do Spatie Permission ao inicializar/encerrar tenant
        Event::listen(Events\TenancyInitialized::class, function (Events\TenancyInitialized $event) {
            app(PermissionRegistrar::class)->forgetCachedPermissions();
            app()->forgetInstance('auth.password');
            $this->configureTenantPublicDiskUrl($event->tenancy->tenant);
            TenantStoragePermissions::ensureReadable(storage_path());

            $this->reregisterActivityLogObservers();
        });

        Event::listen(Events\TenancyEnded::class, function () {
            app(PermissionRegistrar::class)->forgetCachedPermissions();
            app()->forgetInstance('auth.password');
            $this->revertPublicDiskUrl();
        });
    }

    private function configureTenantPublicDiskUrl(Tenant $tenant): void
    {
        $suffixBase = config('tenancy.filesystem.suffix_base', 'tenant');
        $baseUrl = rtrim((string) config('app.url'), '/');

        config([
            'filesystems.disks.public.url' => "{$baseUrl}/storage/{$suffixBase}{$tenant->getTenantKey()}/app/public",
        ]);

        Storage::forgetDisk('public');
    }

    private function revertPublicDiskUrl(): void
    {
        config([
            'filesystems.disks.public.url' => $this->originalPublicDiskUrl,
        ]);

        Storage::forgetDisk('public');
    }

    private function reregisterActivityLogObservers(): void
    {
        $modelReflection = new ReflectionClass(Model::class);
        $booted = $modelReflection->getStaticPropertyValue('booted');

        foreach (self::ACTIVITY_LOG_MODELS as $model) {
            if (! in_array(LogsActivity::class, class_uses_recursive($model), true)) {
                continue;
            }

            $model::flushEventListeners();
            unset($booted[$model]);
        }

        $modelReflection->setStaticPropertyValue('booted', $booted);

        foreach (self::ACTIVITY_LOG_MODELS as $model) {
            if (! in_array(LogsActivity::class, class_uses_recursive($model), true)) {
                continue;
            }

            new $model;
        }
    }

    protected function bootEvents(): void
    {
        foreach ($this->events() as $event => $listeners) {
            foreach ($listeners as $listener) {
                if ($listener instanceof JobPipeline) {
                    $listener = $listener->toListener();
                }
                Event::listen($event, $listener);
            }
        }
    }

    protected function mapRoutes(): void
    {
        $this->app->booted(function () {
            if (file_exists(base_path('routes/tenant.php'))) {
                Route::namespace(static::$controllerNamespace)
                    ->group(base_path('routes/tenant.php'));
            }
        });
    }

    protected function makeTenancyMiddlewareHighestPriority(): void
    {
        $tenancyMiddleware = [
            Middleware\PreventAccessFromCentralDomains::class,
            Middleware\InitializeTenancyByDomain::class,
            Middleware\InitializeTenancyBySubdomain::class,
            Middleware\InitializeTenancyByDomainOrSubdomain::class,
            Middleware\InitializeTenancyByPath::class,
            Middleware\InitializeTenancyByRequestData::class,
        ];

        foreach (array_reverse($tenancyMiddleware) as $middleware) {
            $this->app[Kernel::class]
                ->prependToMiddlewarePriority($middleware);
        }
    }
}
