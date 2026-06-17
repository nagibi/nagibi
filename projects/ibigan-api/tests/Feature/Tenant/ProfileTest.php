<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Storage::fake('public');

    $tenantId = 'tenant-'.uniqid();
    /** @var TestCase&object{tenant: Tenant, user: User} $this */
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
            'email' => 'user@test.com',
            'password' => bcrypt('senha123'),
        ]);
        $user->assignRole('admin');

        return $user;
    });
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

// --- Show ---

it('retorna perfil do usuário autenticado', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->getJson('/api/v1/profile', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.email', 'user@test.com')
        ->assertJsonStructure([
            'result' => ['id', 'name', 'email', 'roles', 'permissions', 'created_at'],
        ]);
});

it('nega acesso ao perfil sem autenticação', function (): void {
    $this->getJson('/api/v1/profile', ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnauthorized();
});

// --- Update ---

it('atualiza nome e email do perfil', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->putJson('/api/v1/profile', [
        'name' => 'Novo Nome',
        'email' => 'novo@test.com',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.name', 'Novo Nome')
        ->assertJsonPath('result.email', 'novo@test.com');
});

it('nega atualização com email já em uso', function (): void {
    $this->tenant->run(function (): void {
        User::factory()->create(['email' => 'outro@test.com']);
    });

    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->putJson('/api/v1/profile', [
        'name' => 'Nome',
        'email' => 'outro@test.com',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'email');
});

it('permite atualizar mantendo o mesmo email', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->putJson('/api/v1/profile', [
        'name' => 'Nome Atualizado',
        'email' => 'user@test.com',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.name', 'Nome Atualizado');
});

// --- Update Password ---

it('atualiza senha com senha atual correta', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->putJson('/api/v1/profile/password', [
        'current_password' => 'senha123',
        'password' => 'novaSenha123',
        'password_confirmation' => 'novaSenha123',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1);
});

it('nega atualização de senha com senha atual incorreta', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->putJson('/api/v1/profile/password', [
        'current_password' => 'senha-errada',
        'password' => 'novaSenha123',
        'password_confirmation' => 'novaSenha123',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'current_password');
});

it('nega atualização de senha fraca', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->putJson('/api/v1/profile/password', [
        'current_password' => 'senha123',
        'password' => '123',
        'password_confirmation' => '123',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'password');
});

// --- Avatar ---

it('faz upload de avatar', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $avatar = UploadedFile::fake()->image('avatar.jpg', 200, 200);

    $response = $this->post('/api/v1/profile/avatar', ['avatar' => $avatar], [
        'X-Tenant-ID' => $this->tenant->id,
        'Accept' => 'application/json',
    ]);

    $response
        ->assertOk()
        ->assertJsonPath('status', 1);

    $avatarUrl = $response->json('result.avatar_url');
    expect($avatarUrl)->toBeString()->not->toBeEmpty();
    expect($avatarUrl)->toContain('?v=');
});

it('nega upload de avatar sem arquivo', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $this->post('/api/v1/profile/avatar', [], [
        'X-Tenant-ID' => $this->tenant->id,
        'Accept' => 'application/json',
    ])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'avatar');
});

it('deleta avatar do perfil', function (): void {
    Sanctum::actingAs($this->user, ['*'], 'sanctum');

    $avatar = UploadedFile::fake()->image('avatar.jpg', 200, 200);
    $this->post('/api/v1/profile/avatar', ['avatar' => $avatar], [
        'X-Tenant-ID' => $this->tenant->id,
        'Accept' => 'application/json',
    ]);

    $this->deleteJson('/api/v1/profile/avatar', [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1);
});
