<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * @property Tenant $tenant
 * @property User $superAdmin
 * @property User $admin
 * @property User $manager
 * @property User $viewer
 */
uses(RefreshDatabase::class);

beforeEach(function (): void {
    /** @var TestCase&object{tenant: Tenant, superAdmin: User, admin: User, manager: User, viewer: User} $this */
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

    $this->manager = $this->tenant->run(function (): User {
        $user = User::factory()->create();
        $user->assignRole('manager');

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

// --- Roles existem ---

it('cria as 4 roles corretamente via seeder', function (): void {
    $this->tenant->run(function (): void {
        expect(Role::pluck('name')->toArray())
            ->toContain('super-admin', 'admin', 'manager', 'viewer');
    });
});

// --- Super-admin ---

it('super-admin tem todas as permissões', function (): void {
    Sanctum::actingAs($this->superAdmin, ['*'], 'sanctum');

    $headers = ['X-Tenant-ID' => $this->tenant->id];

    $this->getJson('/api/v1/users', $headers)->assertOk();
    $this->getJson('/api/v1/menus', $headers)->assertOk();
});

// --- Admin ---

it('admin pode gerenciar usuários', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');
    $headers = ['X-Tenant-ID' => $this->tenant->id];

    $this->getJson('/api/v1/users', $headers)->assertOk();

    $payload = [
        'name' => 'Novo Usuário',
        'email' => 'novo@test.com',
        'password' => 'senha123',
        'password_confirmation' => 'senha123',
        'role' => 'viewer',
    ];
    $this->postJson('/api/v1/users', $payload, $headers)->assertCreated();
});

// --- Manager ---

it('manager pode gerenciar usuários', function (): void {
    Sanctum::actingAs($this->manager, ['*'], 'sanctum');
    $headers = ['X-Tenant-ID' => $this->tenant->id];

    $this->getJson('/api/v1/users', $headers)->assertOk();
});

// --- Viewer ---

it('viewer pode listar mas não criar usuários', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');
    $headers = ['X-Tenant-ID' => $this->tenant->id];

    $this->getJson('/api/v1/users', $headers)->assertOk();

    $this->postJson('/api/v1/users', [
        'name' => 'Teste',
        'email' => 'teste@test.com',
        'password' => 'senha123',
        'password_confirmation' => 'senha123',
        'role' => 'viewer',
    ], $headers)->assertForbidden();
});

it('viewer não pode deletar usuários', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');
    $headers = ['X-Tenant-ID' => $this->tenant->id];

    $target = $this->tenant->run(function (): User {
        return User::factory()->create();
    });

    $this->deleteJson("/api/v1/users/{$target->id}", [], $headers)->assertForbidden();
});
