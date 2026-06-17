<?php

declare(strict_types=1);

use App\Models\Central\CentralUser;
use App\Models\Central\PlatformTranslation;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->centralAdmin = CentralUser::create([
        'name' => 'Super Admin',
        'email' => 'super-translations@ibigan.com',
        'password' => 'senha123',
        'is_super_admin' => true,
        'is_active' => true,
    ]);

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

    $this->headers = ['X-Tenant-ID' => $this->tenant->id];
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

it('lista sobrescritas publicas por locale a partir do banco central', function (): void {
    PlatformTranslation::query()->create([
        'tenant_id' => $this->tenant->id,
        'key' => 'menu.users',
        'locale' => 'pt',
        'value' => 'Colaboradores',
        'is_active' => true,
    ]);

    $response = $this->getJson('/api/v1/translations?locale=pt', $this->headers)
        ->assertOk()
        ->assertJsonPath('result.locale', 'pt');

    expect($response->json('result.overrides')['menu.users'])->toBe('Colaboradores');
});

it('nega gerenciamento de traducoes no tenant', function (): void {
    Sanctum::actingAs($this->user);

    $this->getJson('/api/v1/translations/manage', $this->headers)
        ->assertNotFound();
});

it('super admin central gerencia traducoes da empresa no banco central', function (): void {
    Sanctum::actingAs($this->centralAdmin, ['*'], 'central');

    $this->getJson("/api/central/v1/admin/tenants/{$this->tenant->id}/translations")
        ->assertOk()
        ->assertJsonPath('status', 1);

    $this->postJson("/api/central/v1/admin/tenants/{$this->tenant->id}/translations", [
        'key' => 'menu.users',
        'locale' => 'en',
        'value' => 'Collaborators',
        'is_active' => true,
    ])
        ->assertCreated()
        ->assertJsonPath('message_code', 'translation.created_successfully')
        ->assertJsonPath('result.key', 'menu.users')
        ->assertJsonPath('result.value', 'Collaborators');

    expect(
        PlatformTranslation::query()
            ->forTenant($this->tenant->id)
            ->where('key', 'menu.users')
            ->where('locale', 'en')
            ->value('value'),
    )->toBe('Collaborators');
});
