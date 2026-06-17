<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * @property Tenant $tenant
 * @property User $admin
 * @property User $viewer
 */
uses(RefreshDatabase::class);

beforeEach(function (): void {
    /** @var TestCase&object{tenant: Tenant, admin: User, viewer: User} $this */
    $tenantId = 'tenant-'.uniqid();

    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
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

function tenantHeaders(string $tenantId): array
{
    return ['X-Tenant-ID' => $tenantId];
}

it('retorna lista paginada de usuários para quem tem permissão de visualizar', function (): void {
    $this->tenant->run(fn () => User::factory()->count(3)->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/users', tenantHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonStructure([
            'status',
            'message',
            'result' => [
                'data' => [
                    ['id', 'name', 'email', 'cpf', 'phone', 'birth_date', 'gender', 'bio', 'status', 'is_active', 'roles', 'permissions', 'created_at', 'updated_at', 'created_by', 'updated_by'],
                ],
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ],
        ])
        ->assertJsonPath('status', 1);
});

it('retorna um usuário específico para quem tem permissão de visualizar', function (): void {
    $targetUser = $this->tenant->run(fn () => User::factory()->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson("/api/v1/users/{$targetUser->id}", tenantHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.id', $targetUser->id)
        ->assertJsonPath('result.email', $targetUser->email);
});

it('cria um usuário para quem tem permissão de gerenciar', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $payload = [
        'name' => 'New User',
        'email' => 'newuser@example.com',
        'cpf' => '52998224725',
        'phone' => '11999887766',
        'birth_date' => '1995-06-20',
        'gender' => 'male',
        'bio' => 'Usuário de teste',
        'password' => 'Password1',
        'password_confirmation' => 'Password1',
        'role' => 'viewer',
    ];

    $this->postJson('/api/v1/users', $payload, tenantHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.name', 'New User')
        ->assertJsonPath('result.email', 'newuser@example.com')
        ->assertJsonPath('result.cpf', '52998224725')
        ->assertJsonPath('result.phone', '11999887766')
        ->assertJsonPath('result.birth_date', '1995-06-20')
        ->assertJsonPath('result.gender', 'male')
        ->assertJsonPath('result.bio', 'Usuário de teste')
        ->assertJsonPath('result.roles', ['viewer'])
        ->assertJsonPath('result.created_by.id', $this->admin->id)
        ->assertJsonPath('result.updated_by.id', $this->admin->id);

    $this->tenant->run(function () use ($payload): void {
        expect(User::where('email', $payload['email'])->exists())->toBeTrue();
    });
});

it('atualiza um usuário para quem tem permissão de gerenciar', function (): void {
    $targetUser = $this->tenant->run(function (): User {
        $user = User::factory()->create();
        $user->assignRole('viewer');

        return $user;
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $payload = [
        'name' => 'Updated Name',
        'email' => 'updated@example.com',
        'cpf' => '11144477735',
        'phone' => '21988776655',
        'birth_date' => '1988-03-10',
        'gender' => 'female',
        'bio' => 'Perfil atualizado',
        'roles' => ['manager', 'viewer'],
    ];

    $this->putJson("/api/v1/users/{$targetUser->id}", $payload, tenantHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.name', 'Updated Name')
        ->assertJsonPath('result.email', 'updated@example.com')
        ->assertJsonPath('result.cpf', '11144477735')
        ->assertJsonPath('result.phone', '21988776655')
        ->assertJsonPath('result.birth_date', '1988-03-10')
        ->assertJsonPath('result.gender', 'female')
        ->assertJsonPath('result.bio', 'Perfil atualizado')
        ->assertJsonPath('result.roles', ['manager', 'viewer'])
        ->assertJsonPath('result.updated_by.id', $this->admin->id);
});

it('cria usuário com múltiplos papéis', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $payload = [
        'name' => 'Multi Role User',
        'email' => 'multirole@example.com',
        'password' => 'Password1',
        'password_confirmation' => 'Password1',
        'roles' => ['manager', 'viewer'],
    ];

    $this->postJson('/api/v1/users', $payload, tenantHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('result.roles', ['manager', 'viewer']);
});

it('preserva super-admin ao atualizar papéis do usuário', function (): void {
    $targetUser = $this->tenant->run(function (): User {
        $user = User::factory()->create();
        $user->assignRole('super-admin');

        return $user;
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $response = $this->putJson("/api/v1/users/{$targetUser->id}", [
        'name' => $targetUser->name,
        'email' => $targetUser->email,
        'roles' => ['admin'],
    ], tenantHeaders($this->tenant->id))
        ->assertOk();

    expect($response->json('result.roles'))->toEqualCanonicalizing(['admin', 'super-admin']);
});

it('super-admin pode remover super-admin de outro usuário', function (): void {
    $superAdmin = $this->tenant->run(function (): User {
        $u = User::factory()->create();
        $u->assignRole('super-admin');

        return $u;
    });

    $target = $this->tenant->run(function (): User {
        $u = User::factory()->create();
        $u->assignRole('super-admin');

        return $u;
    });

    Sanctum::actingAs($superAdmin, ['*'], 'sanctum');

    $response = $this->putJson("/api/v1/users/{$target->id}", [
        'name' => $target->name,
        'email' => $target->email,
        'roles' => ['admin'],
    ], tenantHeaders($this->tenant->id))->assertOk();

    expect($response->json('result.roles'))->toEqualCanonicalizing(['admin']);
});

it('nega admin atribuir super-admin via payload', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/users', [
        'name' => 'Blocked Super',
        'email' => 'blocked-super@example.com',
        'password' => 'Password1',
        'password_confirmation' => 'Password1',
        'roles' => ['super-admin', 'admin'],
    ], tenantHeaders($this->tenant->id))
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'roles.0');
});

it('remove um usuário para quem tem permissão de gerenciar', function (): void {
    $targetUser = $this->tenant->run(fn () => User::factory()->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->deleteJson("/api/v1/users/{$targetUser->id}", [], tenantHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result', null);

    $this->tenant->run(function () use ($targetUser): void {
        expect(User::find($targetUser->id))->toBeNull();
    });
});

it('permite listar usuários para perfil viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->getJson('/api/v1/users', tenantHeaders($this->tenant->id))
        ->assertOk();
});

it('nega criação de usuário para perfil viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->postJson('/api/v1/users', [
        'name' => 'Blocked User',
        'email' => 'blocked@example.com',
        'password' => 'Password1',
        'password_confirmation' => 'Password1',
        'role' => 'viewer',
    ], tenantHeaders($this->tenant->id))
        ->assertForbidden();
});

it('nega atualização de usuário para perfil viewer', function (): void {
    $targetUser = $this->tenant->run(fn () => User::factory()->create());

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->putJson("/api/v1/users/{$targetUser->id}", [
        'name' => 'Blocked Update',
        'email' => 'blocked-update@example.com',
    ], tenantHeaders($this->tenant->id))
        ->assertForbidden();
});

it('nega remoção de usuário para perfil viewer', function (): void {
    $targetUser = $this->tenant->run(fn () => User::factory()->create());

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->deleteJson("/api/v1/users/{$targetUser->id}", [], tenantHeaders($this->tenant->id))
        ->assertForbidden();
});

it('ativa registro', function (): void {
    $targetUser = $this->tenant->run(fn () => User::factory()->create([
        'is_active' => false,
        'status' => 'inactive',
    ]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/users/{$targetUser->id}/toggle-active", [
        'is_active' => true,
    ], tenantHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.is_active', true)
        ->assertJsonPath('result.status', 'active');

    $this->tenant->run(function () use ($targetUser): void {
        $user = User::query()->findOrFail($targetUser->id);
        expect($user->is_active)->toBeTrue()
            ->and($user->status)->toBe('active');
    });
});

it('inativa registro', function (): void {
    $targetUser = $this->tenant->run(fn () => User::factory()->create([
        'is_active' => true,
        'status' => 'active',
    ]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/users/{$targetUser->id}/toggle-active", [
        'is_active' => false,
    ], tenantHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.is_active', false)
        ->assertJsonPath('result.status', 'inactive');
});

it('nega toggle para viewer', function (): void {
    $targetUser = $this->tenant->run(fn () => User::factory()->create());

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->patchJson("/api/v1/users/{$targetUser->id}/toggle-active", [
        'is_active' => false,
    ], tenantHeaders($this->tenant->id))
        ->assertForbidden();
});
