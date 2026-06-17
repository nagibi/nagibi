<?php

declare(strict_types=1);

use App\Jobs\DispatchWebhookJob;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Webhook;
use App\Services\WebhookDispatchService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

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

it('lista webhooks para admin', function (): void {
    $this->tenant->run(fn () => Webhook::factory()->count(3)->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/webhooks', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonStructure([
            'result' => [
                'data' => [['id', 'url', 'events', 'is_active', 'created_at']],
                'meta' => ['total'],
            ],
        ]);
});

it('nega listagem para viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->getJson('/api/v1/webhooks', ['X-Tenant-ID' => $this->tenant->id])
        ->assertForbidden();
});

it('cria webhook com eventos válidos', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/webhooks', [
        'url' => 'https://example.com/webhook',
        'events' => ['user.created', 'invite.accepted'],
        'secret' => 'meu-secret',
        'is_active' => true,
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertCreated()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.url', 'https://example.com/webhook');
});

it('nega criação com evento inválido', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/webhooks', [
        'url' => 'https://example.com/webhook',
        'events' => ['evento.inventado'],
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'events.0');
});

it('nega criação com URL inválida', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/webhooks', [
        'url' => 'nao-e-uma-url',
        'events' => ['user.created'],
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'url');
});

it('nega criação para viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->postJson('/api/v1/webhooks', [
        'url' => 'https://example.com/webhook',
        'events' => ['user.created'],
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertForbidden();
});

it('atualiza webhook', function (): void {
    $webhook = $this->tenant->run(fn () => Webhook::factory()->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->putJson("/api/v1/webhooks/{$webhook->id}", [
        'url' => 'https://novo.com/webhook',
        'events' => ['user.created'],
        'is_active' => false,
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.url', 'https://novo.com/webhook')
        ->assertJsonPath('result.is_active', false);
});

it('remove webhook', function (): void {
    $webhook = $this->tenant->run(fn () => Webhook::factory()->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->deleteJson("/api/v1/webhooks/{$webhook->id}", [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk();
});

it('lista entregas do webhook', function (): void {
    $webhook = $this->tenant->run(fn () => Webhook::factory()->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson("/api/v1/webhooks/{$webhook->id}/deliveries", ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1);
});

it('dispara job para webhooks ativos que escutam o evento', function (): void {
    Queue::fake();

    $this->tenant->run(function (): void {
        Webhook::factory()->withEvents(['user.created'])->create();
        Webhook::factory()->withEvents(['invite.accepted'])->create();
        Webhook::factory()->inactive()->withEvents(['user.created'])->create();
    });

    $this->tenant->run(function (): void {
        app(WebhookDispatchService::class)->dispatch('user.created', ['id' => 1]);
    });

    Queue::assertPushed(DispatchWebhookJob::class, 1);
});

it('não dispara job quando não há webhooks ativos para o evento', function (): void {
    Queue::fake();

    $this->tenant->run(function (): void {
        Webhook::factory()->withEvents(['invite.accepted'])->create();
    });

    $this->tenant->run(function (): void {
        app(WebhookDispatchService::class)->dispatch('user.created', ['id' => 1]);
    });

    Queue::assertNothingPushed();
});

it('job registra delivery com sucesso', function (): void {
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $webhook = $this->tenant->run(fn () => Webhook::factory()->withEvents(['user.created'])->create([
        'url' => 'https://example.com/webhook',
    ]));

    $this->tenant->run(function () use ($webhook): void {
        $job = new DispatchWebhookJob($webhook->id, 'user.created', ['id' => 1]);
        $job->handle();

        expect($webhook->deliveries()->where('status', 'success')->count())->toBe(1);
    });
});

it('ativa registro', function (): void {
    $webhook = $this->tenant->run(fn () => Webhook::factory()->inactive()->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/webhooks/{$webhook->id}/toggle-active", [
        'is_active' => true,
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.is_active', true);
});

it('inativa registro', function (): void {
    $webhook = $this->tenant->run(fn () => Webhook::factory()->create(['is_active' => true]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/webhooks/{$webhook->id}/toggle-active", [
        'is_active' => false,
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.is_active', false);
});

it('nega toggle para viewer', function (): void {
    $webhook = $this->tenant->run(fn () => Webhook::factory()->create());

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->patchJson("/api/v1/webhooks/{$webhook->id}/toggle-active", [
        'is_active' => false,
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertForbidden();
});

it('job registra delivery como failed em caso de erro HTTP', function (): void {
    Http::fake(['*' => Http::response('Server Error', 500)]);

    $webhook = $this->tenant->run(fn () => Webhook::factory()->withEvents(['user.created'])->create([
        'url' => 'https://example.com/webhook',
    ]));

    $this->tenant->run(function () use ($webhook): void {
        $job = new DispatchWebhookJob($webhook->id, 'user.created', ['id' => 1]);

        try {
            $job->handle();
        } catch (Throwable) {
            // esperado após resposta HTTP com falha
        }

        expect($webhook->deliveries()->where('status', 'failed')->count())->toBe(1);
    });
});
