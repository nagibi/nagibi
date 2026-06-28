<?php

declare(strict_types=1);

use App\Models\Equipamento;
use App\Models\Fornecedor;
use App\Models\GrupoEquipamento;
use App\Models\Menu;
use App\Models\Obra;
use App\Models\Tenant;
use App\Models\TipoEquipamento;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

uses(RefreshDatabase::class);

/**
 * Cria um tenant com schema + RBAC seeded e um usuário admin dentro dele.
 *
 * @return array{tenant: Tenant, user: User}
 */
function makeTenantWithAdmin(string $label, string $email): array
{
    $tenantId = $label . '-' . uniqid();

    $tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => ucfirst($label),
    ]);

    $tenant->run(function () {
        test()->seed(RolePermissionSeeder::class);
    });

    $user = $tenant->run(function () use ($email): User {
        $user = User::factory()->create([
            'email' => $email,
            'password' => bcrypt('senha123'),
        ]);
        $user->assignRole('admin');

        return $user;
    });

    return ['tenant' => $tenant, 'user' => $user];
}

beforeEach(function (): void {
    /** @var TestCase&object{a: array, b: array} $this */
    $this->a = makeTenantWithAdmin('alpha', 'alice@alpha.com');
    $this->b = makeTenantWithAdmin('beta', 'bob@beta.com');
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->a['tenant']->id, $this->b['tenant']->id);
});

// ─── Endpoint: comportamento básico ──────────────────────────────

it('exige autenticação', function (): void {
    $this->getJson('/api/v1/search?q=alice', [
        'X-Tenant-ID' => $this->a['tenant']->id,
    ])->assertUnauthorized();
});

it('valida o termo mínimo de busca', function (): void {
    Sanctum::actingAs($this->a['user'], ['*'], 'sanctum');

    $this->getJson('/api/v1/search?q=a', [
        'X-Tenant-ID' => $this->a['tenant']->id,
    ])
        ->assertUnprocessable()
        ->assertJsonPath('message_code', 'validation.failed')
        ->assertJsonPath('errors.0.field', 'q');
});

it('retorna resultados agrupados por categoria', function (): void {
    Sanctum::actingAs($this->a['user'], ['*'], 'sanctum');

    $response = $this->getJson('/api/v1/search?q=alice', [
        'X-Tenant-ID' => $this->a['tenant']->id,
    ])
        ->assertOk()
        ->assertJsonPath('status', 1);

    // o usuário alice@alpha.com deve aparecer no grupo "users"
    $result = $response->json('result');

    expect($result)->toHaveKey('users');
    expect(collect($result['users'])->pluck('subtitle'))
        ->toContain('alice@alpha.com');
});

it('cada item traz o shape esperado pelo palette', function (): void {
    Sanctum::actingAs($this->a['user'], ['*'], 'sanctum');

    $this->getJson('/api/v1/search?q=alice', [
        'X-Tenant-ID' => $this->a['tenant']->id,
    ])
        ->assertOk()
        ->assertJsonStructure([
            'status',
            'result' => [
                'users' => [
                    ['id', 'type', 'title', 'subtitle', 'path', 'avatar_url'],
                ],
            ],
        ]);
});

it('retorna equipamentos no resultado global', function (): void {
    Sanctum::actingAs($this->a['user'], ['*'], 'sanctum');

    $this->a['tenant']->run(function (): void {
        Equipamento::factory()->create([
            'patrimonio' => 'MARTELETE-001',
        ]);
    });

    $response = $this->getJson('/api/v1/search?q=MARTELETE', [
        'X-Tenant-ID' => $this->a['tenant']->id,
    ])->assertOk();

    $equipamentos = collect($response->json('result.equipamentos') ?? []);

    expect($equipamentos->pluck('subtitle')->all())->toContain('MARTELETE-001 · Em Estoque')
        ->and($equipamentos->first()['path'] ?? null)->toBe('/equipamentos/estoque?q=MARTELETE-001');
});

it('retorna tipos fornecedores e obras no resultado global', function (): void {
    Sanctum::actingAs($this->a['user'], ['*'], 'sanctum');

    $this->a['tenant']->run(function (): void {
        $grupo = GrupoEquipamento::factory()->create(['nome' => 'Ferramentas']);

        TipoEquipamento::factory()->create([
            'grupo_id' => $grupo->id,
            'nome' => 'Compactador de solo',
        ]);

        Fornecedor::factory()->create([
            'nome' => 'Locadora Atlas',
            'cnpj' => '12.345.678/0001-90',
        ]);

        Obra::factory()->create([
            'codigo' => 'OBRA-650',
            'nome' => 'Residencial Central',
        ]);
    });

    $tipos = $this->getJson('/api/v1/search?q=Compactador', [
        'X-Tenant-ID' => $this->a['tenant']->id,
    ])->assertOk();

    expect($tipos->json('result.tipos.0.title'))->toBe('Compactador de solo')
        ->and($tipos->json('result.tipos.0.subtitle'))->toBe('Ferramentas');

    $fornecedores = $this->getJson('/api/v1/search?q=Atlas', [
        'X-Tenant-ID' => $this->a['tenant']->id,
    ])->assertOk();

    expect($fornecedores->json('result.fornecedores.0.title'))->toBe('Locadora Atlas')
        ->and($fornecedores->json('result.fornecedores.0.path'))->toStartWith('/equipamentos/fornecedores/');

    $obras = $this->getJson('/api/v1/search?q=OBRA-650', [
        'X-Tenant-ID' => $this->a['tenant']->id,
    ])->assertOk();

    expect($obras->json('result.obras.0.title'))->toBe('OBRA-650')
        ->and($obras->json('result.obras.0.subtitle'))->toBe('Residencial Central');
});

// ─── Isolamento entre tenants (a garantia central) ───────────────

it('retorna usuarios ao buscar por cpf com ou sem mascara', function (): void {
    Sanctum::actingAs($this->a['user'], ['*'], 'sanctum');

    $this->a['tenant']->run(function (): void {
        User::factory()->create([
            'name' => 'Usuario CPF Teste',
            'email' => 'cpf.teste@alpha.com',
            'cpf' => '52998224725',
        ]);
    });

    $digits = $this->getJson('/api/v1/search?q=52998224725', [
        'X-Tenant-ID' => $this->a['tenant']->id,
    ])->assertOk();

    expect(collect($digits->json('result.users') ?? [])->pluck('title')->all())
        ->toContain('Usuario CPF Teste');

    $masked = $this->getJson('/api/v1/search?q=529.982.247-25', [
        'X-Tenant-ID' => $this->a['tenant']->id,
    ])->assertOk();

    expect(collect($masked->json('result.users') ?? [])->pluck('title')->all())
        ->toContain('Usuario CPF Teste');
});

it('não retorna usuários de outro tenant', function (): void {
    // logado no tenant A, busca pelo email do usuário do tenant B
    Sanctum::actingAs($this->a['user'], ['*'], 'sanctum');

    $response = $this->getJson('/api/v1/search?q=bob', [
        'X-Tenant-ID' => $this->a['tenant']->id,
    ])->assertOk();

    $emails = collect($response->json('result.users') ?? [])
        ->pluck('subtitle');

    // bob@beta.com NÃO pode vazar para o tenant A
    expect($emails)->not->toContain('bob@beta.com');
});

it('busca o mesmo termo retorna dados distintos por tenant', function (): void {
    // tenant A enxerga alice, não bob
    Sanctum::actingAs($this->a['user'], ['*'], 'sanctum');
    $fromA = collect(
        $this->getJson('/api/v1/search?q=com', [
            'X-Tenant-ID' => $this->a['tenant']->id,
        ])->json('result.users') ?? []
    )->pluck('subtitle');

    expect($fromA)->toContain('alice@alpha.com')
        ->and($fromA)->not->toContain('bob@beta.com');

    // tenant B enxerga bob, não alice
    Sanctum::actingAs($this->b['user'], ['*'], 'sanctum');
    $fromB = collect(
        $this->getJson('/api/v1/search?q=com', [
            'X-Tenant-ID' => $this->b['tenant']->id,
        ])->json('result.users') ?? []
    )->pluck('subtitle');

    expect($fromB)->toContain('bob@beta.com')
        ->and($fromB)->not->toContain('alice@alpha.com');
});

// ─── Permission: filtro pós-busca ────────────────────────────────

it('esconde usuários de quem não tem a permission usuario-visualizar', function (): void {
    $limited = $this->a['tenant']->run(function (): User {
        // papel explicitamente vazio — zero permissions, garantido
        $role = \Spatie\Permission\Models\Role::firstOrCreate([
            'name' => 'sem-acesso',
            'guard_name' => 'sanctum',
        ]);

        $user = User::factory()->create([
            'email' => 'limitado@alpha.com',
            'password' => bcrypt('senha123'),
        ]);
        $user->assignRole($role);

        // sanity: confirma que o filtro de permission está em jogo
        expect($user->can('usuario-visualizar'))->toBeFalse();

        return $user;
    });

    Sanctum::actingAs($limited, ['*'], 'sanctum');

    $response = $this->getJson('/api/v1/search?q=alice', [
        'X-Tenant-ID' => $this->a['tenant']->id,
    ])->assertOk();

    $users = collect($response->json('result.users') ?? [])->pluck('subtitle');
    expect($users)->not->toContain('alice@alpha.com');
});

it('mostra usuários para quem tem a permission', function (): void {
    Sanctum::actingAs($this->a['user'], ['*'], 'sanctum'); // admin tem tudo

    $response = $this->getJson('/api/v1/search?q=alice', [
        'X-Tenant-ID' => $this->a['tenant']->id,
    ])->assertOk();

    $users = collect($response->json('result.users') ?? [])->pluck('subtitle');
    expect($users)->toContain('alice@alpha.com');
});
