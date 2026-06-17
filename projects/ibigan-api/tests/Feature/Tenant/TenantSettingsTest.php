<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Storage::fake('public');

    $tenantId = 'tenant-'.uniqid();
    /** @var TestCase&object{tenant: Tenant, admin: User, viewer: User} $this */
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Test Corp',
        'timezone' => 'UTC',
        'locale' => 'pt_BR',
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

// --- Show ---

it('retorna configurações do tenant', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/tenant/settings', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.name', 'Test Corp')
        ->assertJsonPath('result.timezone', 'UTC')
        ->assertJsonPath('result.locale', 'pt_BR')
        ->assertJsonStructure([
            'result' => [
                'id',
                'name',
                'slug',
                'timezone',
                'locale',
                'logo_url',
                'registration_mode',
                'require_email_verification',
                'require_admin_approval',
                'require_2fa',
                'allowed_email_domains',
            ],
        ])
        ->assertJsonPath('result.registration_mode', 'invite_only')
        ->assertJsonPath('result.require_admin_approval', false);
});

it('viewer pode ver configurações do tenant', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->getJson('/api/v1/tenant/settings', ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk();
});

it('nega acesso sem autenticação', function (): void {
    $this->getJson('/api/v1/tenant/settings', ['X-Tenant-ID' => $this->tenant->id])
        ->assertUnauthorized();
});

// --- Update ---

it('admin atualiza configurações do tenant', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->putJson('/api/v1/tenant/settings', [
        'name' => 'Nova Empresa SA',
        'timezone' => 'America/Sao_Paulo',
        'locale' => 'en',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.name', 'Nova Empresa SA')
        ->assertJsonPath('result.timezone', 'America/Sao_Paulo')
        ->assertJsonPath('result.locale', 'en');
});

it('nega atualização para viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->putJson('/api/v1/tenant/settings', [
        'name' => 'Tentativa',
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertForbidden();
});

it('nega timezone inválida', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    expectApiValidationErrors(
        $this->putJson('/api/v1/tenant/settings', [
            'timezone' => 'America/CidadeInventada',
        ], ['X-Tenant-ID' => $this->tenant->id]),
        'timezone'
    );
});

it('admin atualiza configurações de segurança do tenant', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->putJson('/api/v1/tenant/settings', [
        'registration_mode' => 'open',
        'require_admin_approval' => true,
        'require_2fa' => true,
        'allowed_email_domains' => ['@empresa.com', 'parceiro.com'],
    ], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('result.registration_mode', 'open')
        ->assertJsonPath('result.require_admin_approval', true)
        ->assertJsonPath('result.require_2fa', true)
        ->assertJsonPath('result.allowed_email_domains', ['@empresa.com', 'parceiro.com']);
});

it('nega locale inválido', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    expectApiValidationErrors(
        $this->putJson('/api/v1/tenant/settings', [
            'locale' => 'klingon',
        ], ['X-Tenant-ID' => $this->tenant->id]),
        'locale'
    );
});

// --- Logo ---

it('admin faz upload de logo do tenant', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $logo = UploadedFile::fake()->image('logo.png', 300, 300);

    $this->post('/api/v1/tenant/settings/logo', ['logo' => $logo], [
        'X-Tenant-ID' => $this->tenant->id,
        'Accept' => 'application/json',
    ])
        ->assertOk()
        ->assertJsonPath('status', 1);
});

it('nega upload de logo para viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $logo = UploadedFile::fake()->image('logo.png', 300, 300);

    $this->post('/api/v1/tenant/settings/logo', ['logo' => $logo], [
        'X-Tenant-ID' => $this->tenant->id,
        'Accept' => 'application/json',
    ])
        ->assertForbidden();
});

it('admin deleta logo do tenant', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->deleteJson('/api/v1/tenant/settings/logo', [], ['X-Tenant-ID' => $this->tenant->id])
        ->assertOk()
        ->assertJsonPath('status', 1);
});
