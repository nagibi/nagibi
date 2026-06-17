<?php

declare(strict_types=1);

use App\Enums\CampaignStatus;
use App\Models\Campaign;
use App\Models\MessageTemplate;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'tenant-' . uniqid();
    $this->tenant = Tenant::create([
        'id'   => $tenantId,
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

    $this->template = $this->tenant->run(fn() => MessageTemplate::factory()->create([
        'slug'      => 'boas-vindas',
        'subject'   => 'Bem-vindo, {{nome}}!',
        'body'      => 'Olá {{nome}}!',
        'is_active' => true,
    ]));
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

function campaignHeaders(string $tenantId): array
{
    return ['X-Tenant-ID' => $tenantId];
}

function campaignPayload(array $overrides = []): array
{
    return array_merge([
        'name'       => 'Comunicado XPTO',
        'channels'   => ['email', 'notification'],
        'recipients' => [
            ['type' => 'role', 'value' => 'admin'],
        ],
    ], $overrides);
}

// --- Index ---

it('lista campanhas paginadas para admin', function (): void {
    $this->tenant->run(function (): void {
        Campaign::factory()->count(3)->create(['created_by' => $this->admin->id]);
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/campaigns', campaignHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonStructure([
            'result' => [
                'data' => [['id', 'name', 'status', 'channels', 'created_at']],
                'meta' => ['total'],
            ],
        ]);
});

it('viewer pode listar campanhas', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->getJson('/api/v1/campaigns', campaignHeaders($this->tenant->id))
        ->assertOk();
});

// --- Store ---

it('cria campanha com template', function (): void {
    Queue::fake();

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/campaigns', campaignPayload([
        'template_id' => $this->template->id,
    ]), campaignHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.name', 'Comunicado XPTO');
});

it('cria campanha com conteúdo inline sem template', function (): void {
    Queue::fake();

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/campaigns', campaignPayload([
        'subject' => 'Comunicado importante',
        'body'    => 'Prezados, informamos que...',
    ]), campaignHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('result.subject', 'Comunicado importante');
});

it('dispara ProcessCampaignJob ao criar campanha sem agendamento', function (): void {
    Queue::fake();

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/campaigns', campaignPayload([
        'template_id' => $this->template->id,
    ]), campaignHeaders($this->tenant->id))
        ->assertCreated();

    Queue::assertPushed(\App\Jobs\ProcessCampaignJob::class);
});

it('não dispara job ao criar campanha agendada', function (): void {
    Queue::fake();

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/campaigns', campaignPayload([
        'template_id'  => $this->template->id,
        'scheduled_at' => now()->addDay()->toIso8601String(),
    ]), campaignHeaders($this->tenant->id))
        ->assertCreated();

    Queue::assertNotPushed(\App\Jobs\ProcessCampaignJob::class);
});

it('dispara campanhas agendadas vencidas via comando', function (): void {
    Queue::fake();

    $this->tenant->run(function (): void {
        Campaign::factory()->create([
            'status' => CampaignStatus::Scheduled,
            'scheduled_at' => now()->subMinute(),
            'template_id' => $this->template->id,
            'is_active' => true,
        ]);
    });

    expect(Tenant::count())->toBe(1);

    $this->artisan('campaigns:dispatch-scheduled')->assertSuccessful();

    Queue::assertPushed(\App\Jobs\ProcessCampaignJob::class);
    expect(Queue::pushed(\App\Jobs\ProcessCampaignJob::class))->toHaveCount(1);
});

it('nega criação para viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->postJson('/api/v1/campaigns', campaignPayload(), campaignHeaders($this->tenant->id))
        ->assertForbidden();
});

it('nega criação com canal inválido', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/campaigns', campaignPayload([
        'channels' => ['fax'],
    ]), campaignHeaders($this->tenant->id))
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'channels.0');
});

it('nega criação sem recipients', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/campaigns', campaignPayload([
        'recipients' => [],
    ]), campaignHeaders($this->tenant->id))
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'recipients');
});

// --- Show ---

it('retorna detalhes da campanha', function (): void {
    $campaign = $this->tenant->run(
        fn() =>
        Campaign::factory()->create(['created_by' => $this->admin->id])
    );

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson("/api/v1/campaigns/{$campaign->id}", campaignHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.id', $campaign->id);
});

// --- Update ---

it('atualiza campanha em draft', function (): void {
    $campaign = $this->tenant->run(
        fn() =>
        Campaign::factory()->create([
            'created_by' => $this->admin->id,
            'status'     => CampaignStatus::Draft,
        ])
    );

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->putJson("/api/v1/campaigns/{$campaign->id}", campaignPayload([
        'name' => 'Nome Atualizado',
    ]), campaignHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.name', 'Nome Atualizado');
});

it('nega atualização de campanha já enviada', function (): void {
    $campaign = $this->tenant->run(
        fn() =>
        Campaign::factory()->create([
            'created_by' => $this->admin->id,
            'status'     => CampaignStatus::Sent,
        ])
    );

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->putJson("/api/v1/campaigns/{$campaign->id}", campaignPayload(), campaignHeaders($this->tenant->id))
        ->assertUnprocessable();
});

// --- Cancel ---

it('cancela campanha em draft', function (): void {
    $campaign = $this->tenant->run(
        fn() =>
        Campaign::factory()->create([
            'created_by' => $this->admin->id,
            'status'     => CampaignStatus::Draft,
        ])
    );

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/campaigns/{$campaign->id}/cancel", [], campaignHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.status', 'cancelled');
});

it('nega cancelar campanha já enviada', function (): void {
    $campaign = $this->tenant->run(
        fn() =>
        Campaign::factory()->create([
            'created_by' => $this->admin->id,
            'status'     => CampaignStatus::Sent,
        ])
    );

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/campaigns/{$campaign->id}/cancel", [], campaignHeaders($this->tenant->id))
        ->assertUnprocessable();
});

// --- Deliveries ---

it('lista deliveries da campanha', function (): void {
    $campaign = $this->tenant->run(
        fn() =>
        Campaign::factory()->create(['created_by' => $this->admin->id])
    );

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson("/api/v1/campaigns/{$campaign->id}/deliveries", campaignHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1);
});

it('calcula stats da campanha a partir das entregas', function (): void {
    $campaign = $this->tenant->run(function () {
        $campaign = Campaign::factory()->sent()->create(['created_by' => $this->admin->id]);

        $campaign->deliveries()->create([
            'user_id' => $this->admin->id,
            'channel' => 'email',
            'status' => 'sent',
            'recipient_email' => $this->admin->email,
            'sent_at' => now(),
        ]);

        $campaign->deliveries()->create([
            'user_id' => $this->admin->id,
            'channel' => 'email',
            'status' => 'failed',
            'recipient_email' => $this->admin->email,
            'error_message' => 'SMTP error',
        ]);

        return $campaign;
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson("/api/v1/campaigns/{$campaign->id}", campaignHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.stats.total', 2)
        ->assertJsonPath('result.stats.sent', 1)
        ->assertJsonPath('result.stats.failed', 1);
});

it('ativa registro', function (): void {
    $campaign = $this->tenant->run(fn () => Campaign::factory()->create([
        'created_by' => $this->admin->id,
        'is_active' => false,
    ]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/campaigns/{$campaign->id}/toggle-active", [
        'is_active' => true,
    ], campaignHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.is_active', true);
});

it('inativa registro', function (): void {
    $campaign = $this->tenant->run(fn () => Campaign::factory()->create([
        'created_by' => $this->admin->id,
        'is_active' => true,
    ]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/campaigns/{$campaign->id}/toggle-active", [
        'is_active' => false,
    ], campaignHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.is_active', false);
});

it('nega toggle para viewer', function (): void {
    $campaign = $this->tenant->run(fn () => Campaign::factory()->create([
        'created_by' => $this->admin->id,
    ]));

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->patchJson("/api/v1/campaigns/{$campaign->id}/toggle-active", [
        'is_active' => false,
    ], campaignHeaders($this->tenant->id))
        ->assertForbidden();
});

// --- ProcessCampaignJob ---

it('resolveContent substitui tags da campanha no template', function (): void {
    $template = $this->tenant->run(fn () => MessageTemplate::factory()->create([
        'subject' => 'Olá {{name}}',
        'body' => '<p>{{name}}, confira a nova campanha {{campaign}}.</p>',
    ]));

    $campaign = $this->tenant->run(fn () => Campaign::factory()->create([
        'name' => 'teste',
        'template_id' => $template->id,
        'created_by' => $this->admin->id,
    ]));

    $content = $this->tenant->run(
        fn () => app(\App\Services\CampaignService::class)->resolveContent($campaign, $this->admin),
    );

    expect($content['body'])
        ->toContain($this->admin->name)
        ->toContain('teste')
        ->not->toContain('{{campaign}}');
});

it('ProcessCampaignJob resolve destinatários por role e cria deliveries', function (): void {
    Queue::fake();

    $campaign = $this->tenant->run(function (): Campaign {
        $c = Campaign::factory()->create([
            'created_by' => $this->admin->id,
            'channels'   => ['email', 'notification'],
            'status'     => CampaignStatus::Draft,
        ]);
        $c->recipients()->create(['type' => 'role', 'value' => 'admin']);
        return $c;
    });

    $this->tenant->run(function () use ($campaign): void {
        $job = new \App\Jobs\ProcessCampaignJob($campaign->id);
        $job->handle(app(\App\Services\CampaignService::class));
    });

    Queue::assertPushed(\App\Jobs\SendCampaignDeliveryJob::class);

    $this->tenant->run(function () use ($campaign): void {
        expect($campaign->fresh()->status)->toBe(CampaignStatus::Sending);
        expect($campaign->deliveries()->count())->toBeGreaterThan(0);
    });
});

it('ProcessCampaignJob resolve destinatários por users e cria deliveries', function (): void {
    Queue::fake();

    $campaign = $this->tenant->run(function (): Campaign {
        $c = Campaign::factory()->create([
            'created_by' => $this->admin->id,
            'channels'   => ['email'],
            'status'     => CampaignStatus::Draft,
        ]);
        $c->recipients()->create([
            'type' => 'users',
            'value' => implode(',', [$this->admin->id, $this->viewer->id]),
        ]);

        return $c;
    });

    $this->tenant->run(function () use ($campaign): void {
        $job = new \App\Jobs\ProcessCampaignJob($campaign->id);
        $job->handle(app(\App\Services\CampaignService::class));
    });

    $this->tenant->run(function () use ($campaign): void {
        expect($campaign->fresh()->deliveries()->count())->toBe(2);
    });
});
