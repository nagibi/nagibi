<?php

declare(strict_types=1);

use App\Models\MessageTemplate;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

function templateHeaders(string $tenantId): array
{
    return ['X-Tenant-ID' => $tenantId];
}

function templatePayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'Boas-vindas',
        'slug' => 'boas-vindas',
        'subject' => 'Bem-vindo ao {{empresa}}!',
        'body' => 'Olá {{nome}}, seja bem-vindo!',
        'merge_tags' => ['{{nome}}', '{{empresa}}'],
        'is_active' => true,
    ], $overrides);
}

// --- Index ---

it('retorna lista paginada de templates para quem tem permissão de visualizar', function (): void {
    $this->tenant->run(function (): void {
        MessageTemplate::factory()->count(3)->create();
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/message-templates', templateHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonStructure([
            'result' => [
                'data' => [['id', 'name', 'slug', 'subject', 'body', 'merge_tags', 'is_active', 'created_at']],
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ],
        ]);
});

it('nega listagem para usuário sem autenticação', function (): void {
    $this->getJson('/api/v1/message-templates', templateHeaders($this->tenant->id))
        ->assertUnauthorized();
});

// --- Show ---

it('retorna um template específico', function (): void {
    $template = $this->tenant->run(fn () => MessageTemplate::factory()->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson("/api/v1/message-templates/{$template->id}", templateHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.slug', $template->slug);
});

it('retorna 404 para template inexistente', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/message-templates/999', templateHeaders($this->tenant->id))
        ->assertNotFound();
});

// --- Store ---

it('cria um template para quem tem permissão de gerenciar', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/message-templates', templatePayload(), templateHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.slug', 'boas-vindas');
});

it('nega criação para viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->postJson('/api/v1/message-templates', templatePayload(), templateHeaders($this->tenant->id))
        ->assertForbidden();
});

it('nega criação com slug duplicado', function (): void {
    $this->tenant->run(fn () => MessageTemplate::factory()->create(['slug' => 'boas-vindas']));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/message-templates', templatePayload(), templateHeaders($this->tenant->id))
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'slug');
});

// --- Update ---

it('atualiza um template para quem tem permissão de gerenciar', function (): void {
    $template = $this->tenant->run(fn () => MessageTemplate::factory()->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->putJson("/api/v1/message-templates/{$template->id}", templatePayload([
        'slug' => $template->slug,
        'subject' => 'Assunto Atualizado',
    ]), templateHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.subject', 'Assunto Atualizado');
});

it('nega atualização para viewer', function (): void {
    $template = $this->tenant->run(fn () => MessageTemplate::factory()->create());

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->putJson("/api/v1/message-templates/{$template->id}", templatePayload([
        'slug' => $template->slug,
    ]), templateHeaders($this->tenant->id))
        ->assertForbidden();
});

// --- Duplicate ---

it('duplica um template para quem tem permissão de gerenciar', function (): void {
    $template = $this->tenant->run(fn () => MessageTemplate::factory()->create([
        'name' => 'Boas-vindas',
        'slug' => 'boas-vindas',
        'subject' => 'Assunto original',
        'body' => 'Corpo original',
        'merge_tags' => ['{{nome}}'],
        'is_active' => true,
    ]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson("/api/v1/message-templates/{$template->id}/duplicate", [], templateHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.name', 'Boas-vindas (cópia)')
        ->assertJsonPath('result.slug', 'boas-vindas-copia')
        ->assertJsonPath('result.subject', 'Assunto original')
        ->assertJsonPath('result.body', 'Corpo original')
        ->assertJsonPath('result.is_active', false);

    $this->tenant->run(function (): void {
        expect(MessageTemplate::query()->where('is_system', false)->count())->toBe(2);
    });
});

it('gera slug único ao duplicar template com cópia existente', function (): void {
    $template = $this->tenant->run(fn () => MessageTemplate::factory()->create([
        'slug' => 'boas-vindas',
    ]));

    $this->tenant->run(fn () => MessageTemplate::factory()->create([
        'slug' => 'boas-vindas-copia',
    ]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson("/api/v1/message-templates/{$template->id}/duplicate", [], templateHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('result.slug', 'boas-vindas-copia-2');
});

it('nega duplicação para viewer', function (): void {
    $template = $this->tenant->run(fn () => MessageTemplate::factory()->create());

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->postJson("/api/v1/message-templates/{$template->id}/duplicate", [], templateHeaders($this->tenant->id))
        ->assertForbidden();
});

// --- Destroy ---

it('remove um template para quem tem permissão de gerenciar', function (): void {
    $template = $this->tenant->run(fn () => MessageTemplate::factory()->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->deleteJson("/api/v1/message-templates/{$template->id}", [], templateHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1);
});

it('nega remoção para viewer', function (): void {
    $template = $this->tenant->run(fn () => MessageTemplate::factory()->create());

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->deleteJson("/api/v1/message-templates/{$template->id}", [], templateHeaders($this->tenant->id))
        ->assertForbidden();
});

it('ativa registro', function (): void {
    $template = $this->tenant->run(fn () => MessageTemplate::factory()->create(['is_active' => false]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/message-templates/{$template->id}/toggle-active", [
        'is_active' => true,
    ], templateHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.is_active', true);
});

it('inativa registro', function (): void {
    $template = $this->tenant->run(fn () => MessageTemplate::factory()->create(['is_active' => true]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/message-templates/{$template->id}/toggle-active", [
        'is_active' => false,
    ], templateHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.is_active', false);
});

it('nega toggle para viewer', function (): void {
    $template = $this->tenant->run(fn () => MessageTemplate::factory()->create());

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->patchJson("/api/v1/message-templates/{$template->id}/toggle-active", [
        'is_active' => false,
    ], templateHeaders($this->tenant->id))
        ->assertForbidden();
});
