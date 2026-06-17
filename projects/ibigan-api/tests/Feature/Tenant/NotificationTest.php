<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use App\Notifications\UserCreatedNotification;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'tenant-'.uniqid();

    /** @var TestCase&object{tenant: Tenant, admin: User, viewer: User} $this */
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Test Corp',
    ]);

    $this->tenant->run(function (): void {
        $this->seed(RolePermissionSeeder::class);
    });

    $this->admin = $this->tenant->run(function (): User {
        $user = User::factory()->create();
        $user->assignRole('admin');

        return $user;
    });

    $this->viewer = $this->tenant->run(function (): User {
        $user = User::factory()->create();
        $user->assignRole('viewer');

        return $user;
    });
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

// --- Index ---

it('retorna lista paginada de notificações', function (): void {
    $this->tenant->run(function (): void {
        $this->admin->notify(new UserCreatedNotification($this->admin));
        $this->admin->notify(new UserCreatedNotification($this->admin));
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/notifications', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonStructure([
            'result' => [
                'data' => [['id', 'record_id', 'type', 'data', 'read_at', 'created_at']],
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ],
        ])
        ->assertJsonPath('result.data.0.record_id', 1);
});

it('retorna lista vazia quando não há notificações', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/notifications', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.meta.total', 0);
});

// --- Mark as read ---

it('marca uma notificação como lida', function (): void {
    $notificationId = null;

    $this->tenant->run(function () use (&$notificationId): void {
        $this->admin->notify(new UserCreatedNotification($this->admin));
        $notificationId = $this->admin->notifications()->first()->id;
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/notifications/{$notificationId}/read", [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.read_at', fn ($v) => $v !== null);
});

it('retorna 404 ao marcar notificação inexistente como lida', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson('/api/v1/notifications/'.Str::uuid().'/read', [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertNotFound();
});

// --- Mark as unread ---

it('marca uma notificação como não lida', function (): void {
    $notificationId = null;

    $this->tenant->run(function () use (&$notificationId): void {
        $this->admin->notify(new UserCreatedNotification($this->admin));
        $notificationId = $this->admin->notifications()->first()->id;
        $this->admin->notifications()->first()->markAsRead();
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/notifications/{$notificationId}/unread", [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.read_at', null);

    $this->tenant->run(function (): void {
        expect($this->admin->unreadNotifications()->count())->toBe(1);
    });
});

it('retorna contagem de não lidas no meta da listagem', function (): void {
    $this->tenant->run(function (): void {
        $this->admin->notify(new UserCreatedNotification($this->admin));
        $this->admin->notify(new UserCreatedNotification($this->admin));
        $this->admin->notifications()->first()->markAsRead();
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/notifications', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.meta.unread', 1);
});

// --- Mark all as read ---

it('marca todas as notificações como lidas', function (): void {
    $this->tenant->run(function (): void {
        $this->admin->notify(new UserCreatedNotification($this->admin));
        $this->admin->notify(new UserCreatedNotification($this->admin));
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson('/api/v1/notifications/read-all', [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1);

    $this->tenant->run(function (): void {
        expect($this->admin->unreadNotifications()->count())->toBe(0);
    });
});

// --- Destroy ---

it('deleta uma notificação', function (): void {
    $notificationId = null;

    $this->tenant->run(function () use (&$notificationId): void {
        $this->admin->notify(new UserCreatedNotification($this->admin));
        $notificationId = $this->admin->notifications()->first()->id;
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->deleteJson("/api/v1/notifications/{$notificationId}", [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1);

    $this->tenant->run(function (): void {
        expect($this->admin->notifications()->count())->toBe(0);
    });
});

// --- Filtros ---

it('filtra notificações por status de leitura', function (): void {
    $this->tenant->run(function (): void {
        $this->admin->notify(new UserCreatedNotification($this->admin));
        $this->admin->notify(new UserCreatedNotification($this->admin));
        $this->admin->notifications()->first()->markAsRead();
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/notifications?filter_read_status=unread', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.meta.total', 1);

    $this->getJson('/api/v1/notifications?filter_read_status=read', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.meta.total', 1);
});

it('ordena notificações por coluna', function (): void {
    $olderId = null;
    $newerId = null;

    $this->tenant->run(function () use (&$olderId, &$newerId): void {
        $this->admin->notify(new UserCreatedNotification($this->admin));
        $this->admin->notify(new UserCreatedNotification($this->admin));

        $notifications = $this->admin->notifications()->orderBy('created_at')->get();
        $older = $notifications->first();
        $newer = $notifications->last();

        $older->forceFill(['created_at' => now()->subDays(2)])->save();
        $newer->forceFill(['created_at' => now()])->save();

        $olderId = $older->id;
        $newerId = $newer->id;
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $ascFirstId = $this->getJson('/api/v1/notifications?sort=created_at&direction=asc', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->json('result.data.0.id');

    $descFirstId = $this->getJson('/api/v1/notifications?sort=created_at&direction=desc', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->json('result.data.0.id');

    expect($ascFirstId)->toBe($olderId)
        ->and($descFirstId)->toBe($newerId);
});

it('filtra notificações por categoria', function (): void {
    $this->tenant->run(function (): void {
        $this->admin->notify(new UserCreatedNotification($this->admin));
        $this->admin->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'App\Notifications\ReportCompletedNotification',
            'data' => ['template_id' => 1, 'template_name' => 'Campanhas'],
        ]);
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/notifications?filter_category=report', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.meta.total', 1);

    $this->getJson('/api/v1/notifications?filter_category=type:UserCreatedNotification', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.meta.total', 1);
});

it('filtra notificações por id e título', function (): void {
    $notificationId = null;
    $recordId = null;

    $this->tenant->run(function () use (&$notificationId, &$recordId): void {
        $this->admin->notify(new UserCreatedNotification($this->admin));
        $notification = $this->admin->notifications()->first();
        $notificationId = $notification->id;
        $recordId = $notification->record_id;
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson("/api/v1/notifications?filter_id={$notificationId}", ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.meta.total', 1)
        ->assertJsonPath('result.data.0.id', $notificationId);

    $this->getJson("/api/v1/notifications?filter_id={$recordId}", ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.meta.total', 1)
        ->assertJsonPath('result.data.0.record_id', $recordId);

    $this->getJson('/api/v1/notifications?filter_title='.$this->admin->name, ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.meta.total', 1);
});

// --- Disparo automático ---

it('dispara notificação ao criar usuário', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/users', [
        'name' => 'Novo Usuário',
        'email' => 'novo@test.com',
        'password' => 'senha123',
        'password_confirmation' => 'senha123',
        'role' => 'viewer',
    ], ['X-Tenant-ID' => $this->tenant->id])->assertCreated();

    $this->tenant->run(function (): void {
        expect($this->admin->notifications()->count())->toBeGreaterThan(0);
    });
});

