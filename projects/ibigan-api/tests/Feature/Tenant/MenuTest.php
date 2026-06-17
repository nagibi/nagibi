<?php

declare(strict_types=1);

use App\Models\Menu;
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

function menuHeaders(string $tenantId): array
{
    return ['X-Tenant-ID' => $tenantId];
}

function menuPayload(array $overrides = []): array
{
    return array_merge([
        'title' => 'Dashboard',
        'slug' => 'dashboard',
        'icon' => 'LayoutDashboard',
        'badge' => null,
        'path' => '/dashboard',
        'target' => '_self',
        'order' => 0,
        'is_active' => true,
        'requires_auth' => true,
        'roles' => ['admin', 'viewer'],
    ], $overrides);
}

// --- Index ---

it('retorna árvore de menus para quem tem permissão', function (): void {
    $this->tenant->run(function (): void {
        $parent = Menu::factory()->create(['title' => 'Gestão', 'slug' => 'gestao', 'order' => 0]);
        Menu::factory()->create(['title' => 'Usuários', 'slug' => 'usuarios', 'parent_id' => $parent->id, 'order' => 1]);
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/menus', menuHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonStructure([
            'result' => [['id', 'title', 'slug', 'badge', 'children']],
        ]);
});

it('nega listagem de menus para viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->getJson('/api/v1/menus', menuHeaders($this->tenant->id))
        ->assertForbidden();
});

it('retorna menu de navegação para viewer autenticado', function (): void {
    $this->tenant->run(function (): void {
        Menu::factory()->create([
            'title' => 'Campanhas',
            'slug' => 'campanhas',
            'path' => '/campaigns',
            'roles' => ['viewer'],
            'is_active' => true,
        ]);
        Menu::factory()->create([
            'title' => 'Administração',
            'slug' => 'administracao',
            'path' => '/menus',
            'roles' => ['admin'],
            'is_active' => true,
        ]);
    });

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->getJson('/api/v1/menus/navigation', menuHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonFragment(['title' => 'Campanhas'])
        ->assertJsonMissing(['title' => 'Administração']);
});

it('menu de navegação exclui itens inativos', function (): void {
    $this->tenant->run(function (): void {
        Menu::factory()->create([
            'title' => 'Ativo',
            'slug' => 'ativo',
            'path' => '/active',
            'roles' => ['viewer'],
            'is_active' => true,
        ]);
        Menu::factory()->create([
            'title' => 'Inativo',
            'slug' => 'inativo',
            'path' => '/inactive',
            'roles' => ['viewer'],
            'is_active' => false,
        ]);
    });

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->getJson('/api/v1/menus/navigation', menuHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonFragment(['title' => 'Ativo'])
        ->assertJsonMissing(['title' => 'Inativo']);
});

it('nega listagem sem autenticação', function (): void {
    $this->getJson('/api/v1/menus', menuHeaders($this->tenant->id))
        ->assertUnauthorized();
});

// --- Show ---

it('retorna um menu específico', function (): void {
    $menu = $this->tenant->run(fn () => Menu::factory()->create(['badge' => 'Novo']));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson("/api/v1/menus/{$menu->id}", menuHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.slug', $menu->slug)
        ->assertJsonPath('result.badge', 'Novo');
});

it('retorna 404 para menu inexistente', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/menus/999', menuHeaders($this->tenant->id))
        ->assertNotFound();
});

// --- Store ---

it('cria menu para quem tem permissão de gerenciar', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/menus', menuPayload(), menuHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.slug', 'dashboard');
});

it('cria menu com badge opcional', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/menus', menuPayload([
        'slug' => 'store-admin',
        'badge' => 'Novo',
    ]), menuHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('result.badge', 'Novo');
});

it('retorna badge na árvore de menus', function (): void {
    $this->tenant->run(function (): void {
        Menu::factory()->create(['slug' => 'relatorios', 'badge' => 'Beta']);
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->getJson('/api/v1/menus', menuHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.0.badge', 'Beta');
});

it('nega criação com badge maior que 50 caracteres', function (): void {
    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/menus', menuPayload([
        'slug' => 'item-badge-longo',
        'badge' => str_repeat('a', 51),
    ]), menuHeaders($this->tenant->id))
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'badge');
});

it('nega criação para viewer', function (): void {
    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->postJson('/api/v1/menus', menuPayload(), menuHeaders($this->tenant->id))
        ->assertForbidden();
});

it('nega criação com slug duplicado', function (): void {
    $this->tenant->run(fn () => Menu::factory()->create(['slug' => 'dashboard']));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/menus', menuPayload(), menuHeaders($this->tenant->id))
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'slug');
});

it('cria menu filho com parent_id válido', function (): void {
    $parent = $this->tenant->run(fn () => Menu::factory()->create(['slug' => 'gestao']));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->postJson('/api/v1/menus', menuPayload([
        'slug' => 'usuarios',
        'parent_id' => $parent->id,
    ]), menuHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('result.parent_id', $parent->id);
});

// --- Update ---

it('atualiza menu para quem tem permissão', function (): void {
    $menu = $this->tenant->run(fn () => Menu::factory()->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->putJson("/api/v1/menus/{$menu->id}", menuPayload([
        'slug' => $menu->slug,
        'title' => 'Dashboard Atualizado',
    ]), menuHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.title', 'Dashboard Atualizado');
});

it('atualiza badge do menu', function (): void {
    $menu = $this->tenant->run(fn () => Menu::factory()->create(['badge' => null]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->putJson("/api/v1/menus/{$menu->id}", menuPayload([
        'slug' => $menu->slug,
        'badge' => 'Soon',
    ]), menuHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.badge', 'Soon');
});

it('remove badge do menu ao enviar null', function (): void {
    $menu = $this->tenant->run(fn () => Menu::factory()->create(['badge' => 'Novo']));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->putJson("/api/v1/menus/{$menu->id}", menuPayload([
        'slug' => $menu->slug,
        'badge' => null,
    ]), menuHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.badge', null);
});

it('nega atualização para viewer', function (): void {
    $menu = $this->tenant->run(fn () => Menu::factory()->create());

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->putJson("/api/v1/menus/{$menu->id}", menuPayload([
        'slug' => $menu->slug,
    ]), menuHeaders($this->tenant->id))
        ->assertForbidden();
});

// --- Destroy ---

it('remove menu para quem tem permissão', function (): void {
    $menu = $this->tenant->run(fn () => Menu::factory()->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->deleteJson("/api/v1/menus/{$menu->id}", [], menuHeaders($this->tenant->id))
        ->assertOk();
});

it('nega remoção para viewer', function (): void {
    $menu = $this->tenant->run(fn () => Menu::factory()->create());

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->deleteJson("/api/v1/menus/{$menu->id}", [], menuHeaders($this->tenant->id))
        ->assertForbidden();
});

// --- Reorder ---

it('reordena menus para quem tem permissão', function (): void {
    [$m1, $m2, $m3] = $this->tenant->run(fn () => Menu::factory()->count(3)->create());

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson('/api/v1/menus/reorder', [
        'items' => [
            ['id' => $m1->id, 'order' => 2],
            ['id' => $m2->id, 'order' => 0],
            ['id' => $m3->id, 'order' => 1],
        ],
    ], menuHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1);
});

it('nega reorder para viewer', function (): void {
    $menu = $this->tenant->run(fn () => Menu::factory()->create());

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->patchJson('/api/v1/menus/reorder', [
        'items' => [['id' => $menu->id, 'order' => 0]],
    ], menuHeaders($this->tenant->id))
        ->assertForbidden();
});

it('super-admin vê menu de empresas com role restrita', function (): void {
    $superAdmin = $this->tenant->run(function (): User {
        $user = User::factory()->create();
        $user->assignRole('super-admin');

        return $user;
    });

    $this->tenant->run(function (): void {
        $plataforma = Menu::factory()->create([
            'title' => 'Plataforma',
            'slug' => 'plataforma',
            'path' => null,
            'roles' => ['super-admin'],
        ]);

        Menu::factory()->create([
            'title' => 'Empresas',
            'slug' => 'empresas',
            'path' => '/admin/tenants',
            'icon' => 'Building2',
            'parent_id' => $plataforma->id,
            'roles' => ['super-admin'],
        ]);
    });

    Sanctum::actingAs($superAdmin, ['*'], 'sanctum');

    $this->getJson('/api/v1/menus', menuHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonFragment(['title' => 'Empresas', 'path' => '/admin/tenants']);
});

it('admin comum não vê menu de empresas restrito a super-admin', function (): void {
    $this->tenant->run(function (): void {
        $plataforma = Menu::factory()->create([
            'title' => 'Plataforma',
            'slug' => 'plataforma',
            'path' => null,
            'roles' => ['super-admin'],
        ]);

        Menu::factory()->create([
            'title' => 'Empresas',
            'slug' => 'empresas',
            'path' => '/admin/tenants',
            'parent_id' => $plataforma->id,
            'roles' => ['super-admin'],
        ]);
    });

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $response = $this->getJson('/api/v1/menus', menuHeaders($this->tenant->id))
        ->assertOk();

    expect(collect($response->json('result'))->pluck('title'))->not->toContain('Empresas');
});

it('ativa menu', function (): void {
    $menu = $this->tenant->run(fn () => Menu::factory()->create(['is_active' => false]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/menus/{$menu->id}/toggle-active", [
        'is_active' => true,
    ], menuHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.is_active', true);
});

it('inativa menu', function (): void {
    $menu = $this->tenant->run(fn () => Menu::factory()->create(['is_active' => true]));

    Sanctum::actingAs($this->admin, ['*'], 'sanctum');

    $this->patchJson("/api/v1/menus/{$menu->id}/toggle-active", [
        'is_active' => false,
    ], menuHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.is_active', false);
});

it('nega toggle de menu para viewer', function (): void {
    $menu = $this->tenant->run(fn () => Menu::factory()->create());

    Sanctum::actingAs($this->viewer, ['*'], 'sanctum');

    $this->patchJson("/api/v1/menus/{$menu->id}/toggle-active", [
        'is_active' => false,
    ], menuHeaders($this->tenant->id))
        ->assertForbidden();
});
