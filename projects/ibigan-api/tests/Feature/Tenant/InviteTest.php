<?php

declare(strict_types=1);

use App\Enums\InviteStatus;
use App\Jobs\SendInviteEmailJob;
use App\Models\Invite;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

// --- Index ---

it('lista convites paginados para admin', function (): void {
    $this->tenant->run(function (): void {
        Invite::factory()->count(3)->create(['invited_by' => $this->admin->id]);
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/invites', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonStructure([
            'result' => [
                'data' => [['id', 'email', 'role', 'status', 'expires_at']],
                'meta' => ['total'],
            ],
        ]);
});

it('nega listagem de convites para viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->getJson('/api/v1/invites', ['X-Tenant-ID' => $this->tenant->id])
        ->assertForbidden();
});

// --- Store ---

it('cria convite e enfileira email', function (): void {
    Queue::fake();

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/invites', [
        'email' => 'novo@test.com',
        'role' => 'viewer',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertCreated()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.email', 'novo@test.com')
        ->assertJsonPath('result.status', 'pending');

    Queue::assertPushed(SendInviteEmailJob::class);
});

it('nega criação de convite para viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->postJson('/api/v1/invites', [
        'email' => 'novo@test.com',
        'role' => 'viewer',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertForbidden();
});

it('nega convite com role inválida', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/invites', [
        'email' => 'novo@test.com',
        'role' => 'super-hacker',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'role');
});

it('nega convite sem email', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/invites', [
        'role' => 'viewer',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'email');
});

// --- Destroy ---

it('cancela convite pendente', function (): void {
    $invite = $this->tenant->run(
        fn () => Invite::factory()->create(['invited_by' => $this->admin->id])
    );

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->deleteJson("/api/v1/invites/{$invite->id}", [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1);
});

it('nega cancelamento para viewer', function (): void {
    $invite = $this->tenant->run(
        fn () => Invite::factory()->create(['invited_by' => $this->admin->id])
    );

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->deleteJson("/api/v1/invites/{$invite->id}", [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertForbidden();
});

// --- Accept ---

it('aceita convite válido e cria usuário', function (): void {
    $invite = $this->tenant->run(
        fn () => Invite::factory()->create([
            'invited_by' => $this->admin->id,
            'email' => 'convidado@test.com',
            'role' => 'viewer',
        ])
    );

    $this->postJson('/api/v1/invites/accept', [
        'token' => $invite->token,
        'name' => 'Convidado Silva',
        'password' => 'senha123',
        'password_confirmation' => 'senha123',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonStructure(['result' => ['token', 'user']]);

    $this->tenant->run(function () use ($invite): void {
        $fresh = Invite::find($invite->id);
        expect($fresh->status)->toBe(InviteStatus::Accepted);

        $user = User::where('email', 'convidado@test.com')->first();
        expect($user)->not->toBeNull();
        expect($user->hasRole('viewer'))->toBeTrue();
    });
});

it('nega aceitação de token inválido', function (): void {
    $this->postJson('/api/v1/invites/accept', [
        'token' => 'token-invalido',
        'name' => 'Fulano',
        'password' => 'senha123',
        'password_confirmation' => 'senha123',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable();
});

it('nega aceitação de convite expirado', function (): void {
    $invite = $this->tenant->run(
        fn () => Invite::factory()->expired()->create([
            'invited_by' => $this->admin->id,
            'email' => 'expirado@test.com',
        ])
    );

    $this->postJson('/api/v1/invites/accept', [
        'token' => $invite->token,
        'name' => 'Fulano',
        'password' => 'senha123',
        'password_confirmation' => 'senha123',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable();
});

it('nega aceitação de convite já aceito', function (): void {
    $invite = $this->tenant->run(
        fn () => Invite::factory()->accepted()->create([
            'invited_by' => $this->admin->id,
            'email' => 'jaaceito@test.com',
        ])
    );

    $this->postJson('/api/v1/invites/accept', [
        'token' => $invite->token,
        'name' => 'Fulano',
        'password' => 'senha123',
        'password_confirmation' => 'senha123',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable();
});
