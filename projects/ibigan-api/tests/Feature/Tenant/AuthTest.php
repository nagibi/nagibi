<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'tenant-'.uniqid();
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Test Corp',
    ]);

    $this->tenant->run(function (): void {
        $this->seed(RolePermissionSeeder::class);
    });

    $this->user = $this->tenant->run(function (): User {
        $user = User::factory()->create([
            'email' => 'admin@test.com',
            'password' => bcrypt('password123'),
        ]);
        $user->assignRole('admin');

        return $user;
    });
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

// --- Login ---

it('realiza login com credenciais válidas', function (): void {
    $this->postJson('/api/v1/auth/login', [
        'email' => 'admin@test.com',
        'password' => 'password123',
        'tenant_id' => $this->tenant->id,
    ])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('message_code', 'auth.login.success')
        ->assertJsonStructure([
            'result' => [
                'token',
                'tenant_id',
                'user' => ['id', 'name', 'email', 'roles', 'permissions'],
            ],
        ]);
});

it('nega login com senha incorreta', function (): void {
    $this->postJson('/api/v1/auth/login', [
        'email' => 'admin@test.com',
        'password' => 'senha-errada',
        'tenant_id' => $this->tenant->id,
    ])
        ->assertUnauthorized()
        ->assertJsonPath('message_code', 'auth.login.invalid_credentials');
});

it('nega login com tenant inexistente', function (): void {
    $this->postJson('/api/v1/auth/login', [
        'email' => 'admin@test.com',
        'password' => 'password123',
        'tenant_id' => 'tenant-inexistente',
    ])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'auth.login.tenant_not_found');
});

it('nega login com email inexistente', function (): void {
    $this->postJson('/api/v1/auth/login', [
        'email' => 'naoexiste@test.com',
        'password' => 'password123',
        'tenant_id' => $this->tenant->id,
    ])
        ->assertUnauthorized()
        ->assertJsonPath('message_code', 'auth.login.invalid_credentials');
});

it('nega login sem campos obrigatórios', function (): void {
    $this->postJson('/api/v1/auth/login', [])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.message_code', 'validation.required')
        ->assertJsonPath('errors.1.message_code', 'validation.required')
        ->assertJsonPath('errors.2.message_code', 'validation.required');
});

// --- Me ---

it('retorna dados do usuário autenticado', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->getJson('/api/v1/auth/me', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.email', 'admin@test.com')
        ->assertJsonStructure([
            'result' => ['id', 'name', 'email', 'roles', 'permissions'],
        ]);
});

it('nega acesso ao me sem autenticação', function (): void {
    $this->getJson('/api/v1/auth/me', ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnauthorized();
});

// --- Logout ---

it('realiza logout e invalida o token', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->postJson('/api/v1/auth/logout', [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('message_code', 'auth.logout.success');
});

it('nega logout sem autenticação', function (): void {
    $this->postJson('/api/v1/auth/logout', [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnauthorized();
});
