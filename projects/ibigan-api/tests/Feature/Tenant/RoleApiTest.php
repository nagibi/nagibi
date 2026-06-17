<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * @property Tenant $tenant
 * @property User $superAdmin
 * @property User $admin
 * @property User $viewer
 */
uses(RefreshDatabase::class);

beforeEach(function (): void {
    /** @var TestCase&object{tenant: Tenant, superAdmin: User, admin: User, viewer: User} $this */
    $tenantId = 'tenant-'.uniqid();

    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Test Corp',
    ]);

    $this->tenant->run(function (): void {
        $this->seed(RolePermissionSeeder::class);
    });

    $this->superAdmin = $this->tenant->run(function (): User {
        $user = User::factory()->create();
        $user->assignRole('super-admin');

        return $user;
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

function roleHeaders(string $tenantId): array
{
    return ['X-Tenant-ID' => $tenantId];
}

// --- Permissions ---

it('super-admin lista permissões', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $this->getJson('/api/v1/permissions', roleHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonStructure([
            'result' => [['id', 'name', 'resource', 'action']],
        ])
        ->assertJsonFragment(['name' => 'usuario-visualizar']);
});

it('admin pode visualizar permissões', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/permissions', roleHeaders($this->tenant->id))
        ->assertOk();
});

it('super-admin cria, atualiza e remove permissão customizada', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $createResponse = $this->postJson('/api/v1/permissions', [
        'name' => 'suporte-visualizar',
    ], roleHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('result.name', 'suporte-visualizar');

    $permissionId = $createResponse->json('result.id');

    $this->putJson("/api/v1/permissions/{$permissionId}", [
        'name' => 'suporte-gerenciar',
    ], roleHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.name', 'suporte-gerenciar');

    $this->deleteJson("/api/v1/permissions/{$permissionId}", [], roleHeaders($this->tenant->id))
        ->assertOk();
});

it('não remove permissão vinculada a papéis', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $permission = $this->tenant->run(fn () => Permission::query()->where('name', 'usuario-visualizar')->first());

    $this->deleteJson("/api/v1/permissions/{$permission->id}", [], roleHeaders($this->tenant->id))
        ->assertStatus(422);
});

it('viewer não pode visualizar nem gerenciar papéis e permissões', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->getJson('/api/v1/permissions', roleHeaders($this->tenant->id))
        ->assertForbidden();

    $this->getJson('/api/v1/roles', roleHeaders($this->tenant->id))
        ->assertForbidden();

    $this->postJson('/api/v1/roles', [
        'name' => 'bloqueado-viewer',
    ], roleHeaders($this->tenant->id))
        ->assertForbidden();
});

// --- Roles index/show ---

it('super-admin lista papéis com permissões', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $this->getJson('/api/v1/roles', roleHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonStructure([
            'result' => [[
                'id',
                'name',
                'is_system',
                'permissions_locked',
                'permissions',
                'users_count',
            ]],
        ])
        ->assertJsonFragment(['name' => 'admin', 'is_system' => true]);
});

it('retorna detalhes de um papel', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $role = $this->tenant->run(fn () => Role::findByName('manager', 'sanctum'));

    $this->getJson("/api/v1/roles/{$role->id}", roleHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.name', 'manager')
        ->assertJsonPath('result.is_system', true);
});

// --- Store ---

it('super-admin cria papel customizado com permissões', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $this->postJson('/api/v1/roles', [
        'name' => 'suporte-nivel-1',
        'permissions' => ['usuario-visualizar', 'notificacao-visualizar'],
    ], roleHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('result.name', 'suporte-nivel-1')
        ->assertJsonPath('result.is_system', false)
        ->assertJsonPath('result.permissions', ['notificacao-visualizar', 'usuario-visualizar']);

    $this->tenant->run(function (): void {
        $role = Role::findByName('suporte-nivel-1', 'sanctum');
        expect($role->permissions->pluck('name')->all())
            ->toContain('usuario-visualizar', 'notificacao-visualizar');
    });
});

it('nega criação de papel com nome reservado', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $this->postJson('/api/v1/roles', [
        'name' => 'admin',
    ], roleHeaders($this->tenant->id))
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'name');
});

it('nega criação de papel com permissão inválida', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $this->postJson('/api/v1/roles', [
        'name' => 'papel-invalido',
        'permissions' => ['permissao-inexistente'],
    ], roleHeaders($this->tenant->id))
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'permissions.0');
});

it('admin comum não pode criar papéis', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/roles', [
        'name' => 'bloqueado',
    ], roleHeaders($this->tenant->id))
        ->assertForbidden();
});

// --- Sync permissions ---

it('super-admin sincroniza permissões de papel customizado', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $role = $this->tenant->run(function (): Role {
        $role = Role::create(['name' => 'auditor', 'guard_name' => 'sanctum']);
        $role->syncPermissions(['usuario-visualizar']);

        return $role;
    });

    $this->putJson("/api/v1/roles/{$role->id}/permissions", [
        'permissions' => ['relatorio-visualizar', 'relatorio-gerenciar'],
    ], roleHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.permissions', ['relatorio-gerenciar', 'relatorio-visualizar']);
});

it('super-admin sincroniza permissões de papel manager', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $role = $this->tenant->run(fn () => Role::findByName('manager', 'sanctum'));

    $this->putJson("/api/v1/roles/{$role->id}/permissions", [
        'permissions' => ['usuario-visualizar', 'campanha-visualizar'],
    ], roleHeaders($this->tenant->id))
        ->assertOk();

    $this->tenant->run(function (): void {
        $permissions = Role::findByName('manager', 'sanctum')->permissions->pluck('name')->all();
        expect($permissions)->toContain('usuario-visualizar', 'campanha-visualizar');
    });
});

it('nega sincronização de permissões do super-admin', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $role = $this->tenant->run(fn () => Role::findByName('super-admin', 'sanctum'));

    $this->putJson("/api/v1/roles/{$role->id}/permissions", [
        'permissions' => ['usuario-visualizar'],
    ], roleHeaders($this->tenant->id))
        ->assertUnprocessable();
});

// --- Update ---

it('super-admin renomeia papel customizado', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $role = $this->tenant->run(
        fn () => Role::create(['name' => 'temporario', 'guard_name' => 'sanctum'])
    );

    $this->putJson("/api/v1/roles/{$role->id}", [
        'name' => 'temporario-v2',
    ], roleHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.name', 'temporario-v2');
});

it('nega renomear papel do sistema', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $role = $this->tenant->run(fn () => Role::findByName('viewer', 'sanctum'));

    $this->putJson("/api/v1/roles/{$role->id}", [
        'name' => 'visualizador',
    ], roleHeaders($this->tenant->id))
        ->assertUnprocessable();
});

// --- Destroy ---

it('super-admin remove papel customizado sem usuários', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $role = $this->tenant->run(
        fn () => Role::create(['name' => 'descartavel', 'guard_name' => 'sanctum'])
    );

    $this->deleteJson("/api/v1/roles/{$role->id}", [], roleHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1);

    $this->tenant->run(function (): void {
        expect(Role::where('name', 'descartavel')->exists())->toBeFalse();
    });
});

it('nega remoção de papel do sistema', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $role = $this->tenant->run(fn () => Role::findByName('admin', 'sanctum'));

    $this->deleteJson("/api/v1/roles/{$role->id}", [], roleHeaders($this->tenant->id))
        ->assertUnprocessable();
});

it('nega remoção de papel com usuários vinculados', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $role = $this->tenant->run(function (): Role {
        $role = Role::create(['name' => 'com-usuarios', 'guard_name' => 'sanctum']);
        User::factory()->create()->assignRole($role);

        return $role;
    });

    $this->deleteJson("/api/v1/roles/{$role->id}", [], roleHeaders($this->tenant->id))
        ->assertUnprocessable();
});
