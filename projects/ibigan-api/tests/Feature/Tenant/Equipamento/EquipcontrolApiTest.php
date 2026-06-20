<?php

declare(strict_types=1);

use App\Models\Baixa;
use App\Models\Emprestimo;
use App\Models\Equipamento;
use App\Models\Fornecedor;
use App\Models\GrupoEquipamento;
use App\Models\HistoricoEquipamento;
use App\Models\Manutencao;
use App\Models\Obra;
use App\Models\Tenant;
use App\Models\TipoEquipamento;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $tenantId = 'tenant-' . uniqid();
    /** @var TestCase&object{tenant: Tenant, user: User} $this */
    $this->tenant = Tenant::create([
        'id' => $tenantId,
        'slug' => $tenantId,
        'name' => 'Equipcontrol Test',
        'timezone' => config('app.default_timezone'),
        'is_active' => true,
    ]);

    $this->tenant->run(fn() => $this->seed(RolePermissionSeeder::class));

    $this->user = $this->tenant->run(function (): User {
        $user = User::factory()->create();
        $user->assignRole('admin');

        return $user;
    });

    Sanctum::actingAs($this->user, ['*'], 'sanctum');
});

afterEach(function (): void {
    cleanupTenantDatabaseFiles($this->tenant->id);
});

function equipHeaders(string $tenantId): array
{
    return ['X-Tenant-ID' => $tenantId];
}

function seedEquipamentoBasico(): array
{
    $grupo = GrupoEquipamento::factory()->create(['nome' => 'MARTELETE']);
    $tipo = TipoEquipamento::factory()->create(['grupo_id' => $grupo->id, 'nome' => 'MARTELETE SDS']);
    $fornecedor = Fornecedor::factory()->create();
    $obra = Obra::factory()->create(['codigo' => '650']);

    return compact('grupo', 'tipo', 'fornecedor', 'obra');
}

// ─── Cadastros base ───────────────────────────────────────────────────────────

it('lista obras autenticado', function (): void {
    $this->tenant->run(fn() => Obra::factory()->count(2)->create());

    $this->getJson('/api/v1/obras', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonStructure(['result' => ['data', 'meta']]);
});

it('cria obra via api', function (): void {
    $this->postJson('/api/v1/obras', [
        'codigo' => '651',
        'nome' => 'Obra Teste',
        'is_ativa' => true,
    ], equipHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('result.codigo', '651');

    $this->tenant->run(fn() => expect(Obra::query()->where('codigo', '651')->exists())->toBeTrue());
});

it('retorna lookup de obras', function (): void {
    $this->tenant->run(fn() => Obra::factory()->create(['codigo' => '700', 'is_ativa' => true]));

    $this->getJson('/api/v1/lookups/obras', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.0.codigo', '700');
});

it('gerencia fornecedores', function (): void {
    $create = $this->postJson('/api/v1/fornecedores', [
        'nome' => 'Locadora XYZ',
        'is_ativo' => true,
    ], equipHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('result.nome', 'Locadora XYZ');

    $id = $create->json('result.id');

    $this->getJson("/api/v1/fornecedores/{$id}", equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.nome', 'Locadora XYZ');

    $this->getJson('/api/v1/lookups/fornecedores', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.0.nome', 'Locadora XYZ');
});

it('gerencia grupos e tipos de equipamento', function (): void {
    $grupo = $this->postJson('/api/v1/grupos', [
        'nome' => 'BOMBA MANGOTE',
    ], equipHeaders($this->tenant->id))
        ->assertCreated()
        ->json('result');

    $tipo = $this->postJson('/api/v1/tipos', [
        'grupo_id' => $grupo['id'],
        'nome' => 'BOMBA MANGOTE 3"',
    ], equipHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('result.nome', 'BOMBA MANGOTE 3"');

    $this->getJson('/api/v1/lookups/grupos', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.0.nome', 'BOMBA MANGOTE');

    $this->getJson('/api/v1/lookups/tipos?grupo_id=' . $grupo['id'], equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.0.nome', 'BOMBA MANGOTE 3"');
});

// ─── Equipamentos ─────────────────────────────────────────────────────────────

it('cria equipamento e registra historico de cadastro', function (): void {
    $dados = $this->tenant->run(fn() => seedEquipamentoBasico());

    $response = $this->postJson('/api/v1/equipamentos', [
        'patrimonio' => '8715',
        'tipo_id' => $dados['tipo']->id,
        'fornecedor_id' => $dados['fornecedor']->id,
        'obra_id' => $dados['obra']->id,
        'valor_mensal' => 1500,
        'data_entrada' => now()->subDays(10)->toDateString(),
        'is_critico' => false,
    ], equipHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('data.patrimonio', '8715')
        ->assertJsonPath('data.status', 'em_estoque');

    $equipamentoId = $response->json('data.id');

    $this->tenant->run(function () use ($equipamentoId): void {
        expect(HistoricoEquipamento::query()
            ->where('equipamento_id', $equipamentoId)
            ->where('evento', 'cadastrado')
            ->exists())->toBeTrue();
    });
});

it('lista equipamentos filtrando por status em estoque', function (): void {
    $this->tenant->run(function (): void {
        Equipamento::factory()->create();
        $comEmprestimo = Equipamento::factory()->create();
        Emprestimo::factory()->create([
            'equipamento_id' => $comEmprestimo->id,
            'obra_id' => $comEmprestimo->obra_id,
            'data_devolucao' => null,
        ]);
    });

    $this->getJson('/api/v1/equipamentos?status=em_estoque', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

it('ordena equipamentos por patrimonio', function (): void {
    $this->tenant->run(function (): void {
        Equipamento::factory()->create(['patrimonio' => 'EQ-300']);
        Equipamento::factory()->create(['patrimonio' => 'EQ-100']);
        Equipamento::factory()->create(['patrimonio' => 'EQ-200']);
    });

    $response = $this->getJson(
        '/api/v1/equipamentos?status=em_estoque&sort=patrimonio&direction=asc',
        equipHeaders($this->tenant->id),
    )->assertOk();

    expect(collect($response->json('data'))->pluck('patrimonio')->all())
        ->toBe(['EQ-100', 'EQ-200', 'EQ-300']);
});

it('lista equipamentos filtrando por faixa de valor mensal', function (): void {
    $this->tenant->run(function (): void {
        Equipamento::factory()->create(['valor_mensal' => 500]);
        Equipamento::factory()->create(['valor_mensal' => 1500]);
        Equipamento::factory()->create(['valor_mensal' => 3000]);
    });

    $this->getJson(
        '/api/v1/equipamentos?status=em_estoque&valor_mensal_min=1000&valor_mensal_max=2000',
        equipHeaders($this->tenant->id),
    )
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.valor_mensal', '1500.00');
});

it('lista equipamentos filtrando por situacao em estoque', function (): void {
    $this->tenant->run(function (): void {
        Equipamento::factory()->create([
            'data_entrada' => now()->toDateString(),
        ]);
        Equipamento::factory()->create([
            'data_entrada' => now()->subDays(5)->toDateString(),
        ]);
        Equipamento::factory()->create([
            'data_entrada' => now()->subDays(40)->toDateString(),
        ]);
    });

    $this->getJson('/api/v1/equipamentos?status=em_estoque&situacao=disponivel', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonCount(1, 'data');

    $this->getJson('/api/v1/equipamentos?status=em_estoque&situacao=parado', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonCount(1, 'data');

    $this->getJson('/api/v1/equipamentos?status=em_estoque&situacao=parado_30', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

it('lista equipamentos filtrando por dias parados usando historico', function (): void {
    $paradoHaMaisDe12 = $this->tenant->run(function (): Equipamento {
        return Equipamento::factory()->create([
            'patrimonio' => 'P-PARADO-40',
            'data_entrada' => now()->subDays(40)->toDateString(),
        ]);
    });

    $this->tenant->run(function (): void {
        $equipamento = Equipamento::factory()->create([
            'patrimonio' => 'P-RECENTE',
            'data_entrada' => now()->subDays(40)->toDateString(),
        ]);

        HistoricoEquipamento::query()->create([
            'equipamento_id' => $equipamento->id,
            'evento' => 'devolvido',
            'status_resultante' => 'em_estoque',
            'created_at' => now()->subDays(2),
        ]);
    });

    $this->getJson('/api/v1/equipamentos?status=em_estoque&parado_dias=12', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $paradoHaMaisDe12->id);
});

it('lista equipamentos filtrando por faixa de dias parados', function (): void {
    $parado15 = $this->tenant->run(fn() => Equipamento::factory()->create([
        'patrimonio' => 'P-PARADO-15',
        'data_entrada' => now()->subDays(15)->toDateString(),
    ]));

    $this->tenant->run(function (): void {
        Equipamento::factory()->create([
            'patrimonio' => 'P-PARADO-40',
            'data_entrada' => now()->subDays(40)->toDateString(),
        ]);
        Equipamento::factory()->create([
            'patrimonio' => 'P-PARADO-5',
            'data_entrada' => now()->subDays(5)->toDateString(),
        ]);
    });

    $this->getJson(
        '/api/v1/equipamentos?status=em_estoque&parado_dias_min=10&parado_dias_max=20',
        equipHeaders($this->tenant->id),
    )
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $parado15->id);
});

it('lista equipamentos filtrando por faixa exata de dias parados', function (): void {
    $parado12 = $this->tenant->run(fn() => Equipamento::factory()->create([
        'patrimonio' => 'P-PARADO-12',
        'data_entrada' => now()->subDays(12)->toDateString(),
    ]));

    $this->tenant->run(fn() => Equipamento::factory()->create([
        'patrimonio' => 'P-PARADO-11',
        'data_entrada' => now()->subDays(11)->toDateString(),
    ]));

    $response = $this->getJson(
        '/api/v1/equipamentos?status=em_estoque&parado_dias_min=12&parado_dias_max=12',
        equipHeaders($this->tenant->id),
    )
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $parado12->id);

    expect($response->json('data.0.tempo_em_estoque'))->toBe(12);
});

it('nega alteracao de patrimonio com historico de movimentacao', function (): void {
    $equipamento = $this->tenant->run(function (): Equipamento {
        $equipamento = Equipamento::factory()->create(['patrimonio' => 'P-100']);
        Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
            'data_devolucao' => now()->toDateString(),
        ]);

        return $equipamento;
    });

    $this->putJson("/api/v1/equipamentos/{$equipamento->id}", [
        'patrimonio' => 'P-999',
    ], equipHeaders($this->tenant->id))
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Não é possível alterar o patrimônio de um equipamento com histórico de movimentações.');
});

it('ativa e inativa equipamento via api', function (): void {
    $equipamento = $this->tenant->run(fn() => Equipamento::factory()->create());

    $this->patchJson("/api/v1/equipamentos/{$equipamento->id}/toggle-active", [
        'is_active' => false,
    ], equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('data.is_active', false);

    $this->getJson('/api/v1/equipamentos?status=em_estoque', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonCount(0, 'data');

    $this->patchJson("/api/v1/equipamentos/{$equipamento->id}/toggle-active", [
        'is_active' => true,
    ], equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('data.is_active', true);

    $this->getJson('/api/v1/equipamentos?status=em_estoque', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

it('nega inativacao de equipamento com emprestimo ativo', function (): void {
    $equipamento = $this->tenant->run(function (): Equipamento {
        $equipamento = Equipamento::factory()->create();
        Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
            'data_devolucao' => null,
        ]);

        return $equipamento;
    });

    $this->patchJson("/api/v1/equipamentos/{$equipamento->id}/toggle-active", [
        'is_active' => false,
    ], equipHeaders($this->tenant->id))
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Equipamento com empréstimo ativo não pode ser inativado.');
});

it('nega remocao de equipamento com emprestimo ativo', function (): void {
    $equipamento = $this->tenant->run(function (): Equipamento {
        $equipamento = Equipamento::factory()->create();
        Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
            'data_devolucao' => null,
        ]);

        return $equipamento;
    });

    $this->deleteJson("/api/v1/equipamentos/{$equipamento->id}", [], equipHeaders($this->tenant->id))
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Equipamento com empréstimo ativo não pode ser removido.');
});

// ─── Ciclo de vida ────────────────────────────────────────────────────────────

it('empresta equipamento em estoque', function (): void {
    $equipamento = $this->tenant->run(fn() => Equipamento::factory()->create());
    $obraDestino = $this->tenant->run(fn() => Obra::factory()->create(['codigo' => '652']));

    $this->postJson("/api/v1/equipamentos/{$equipamento->id}/emprestar", [
        'obra_id' => $obraDestino->id,
        'colaborador_nome' => 'João Silva',
        'colaborador_matricula' => '12345',
        'encarregado_nome' => 'Carlos Líder',
        'data_retirada' => now()->toDateString(),
        'prazo_dias' => 15,
    ], equipHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('data.colaborador_nome', 'João Silva')
        ->assertJsonPath('data.is_ativo', true);

    $this->tenant->run(function () use ($equipamento): void {
        expect(Emprestimo::query()
            ->where('equipamento_id', $equipamento->id)
            ->whereNull('data_devolucao')
            ->exists())->toBeTrue();
    });
});

it('devolve emprestimo ativo', function (): void {
    $emprestimo = $this->tenant->run(function (): Emprestimo {
        $equipamento = Equipamento::factory()->create();
        return Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
            'data_devolucao' => null,
        ]);
    });

    $this->postJson("/api/v1/emprestimos/{$emprestimo->id}/devolver", [
        'data_devolucao' => now()->toDateString(),
    ], equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('data.is_ativo', false);

    $this->tenant->run(fn() => expect($emprestimo->fresh()->data_devolucao)->not->toBeNull());
});

it('renova emprestimo ativo', function (): void {
    $emprestimo = $this->tenant->run(function (): Emprestimo {
        $equipamento = Equipamento::factory()->create();
        return Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
            'data_devolucao' => null,
        ]);
    });

    $this->postJson("/api/v1/emprestimos/{$emprestimo->id}/renovar", [
        'prazo_adicional_dias' => 10,
    ], equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('message', 'Empréstimo renovado com sucesso.')
        ->assertJsonPath('renovacao.prazo_adicional', 10);
});

it('envia equipamento para manutencao e finaliza', function (): void {
    $equipamento = $this->tenant->run(fn() => Equipamento::factory()->create());

    $manutencao = $this->postJson("/api/v1/equipamentos/{$equipamento->id}/manutencao", [
        'responsabilidade' => 'equipamento',
        'motivo' => 'Não liga',
        'responsavel_user_id' => $this->user->id,
        'data_entrada' => now()->toDateString(),
    ], equipHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('result.responsabilidade', 'equipamento')
        ->assertJsonPath('result.responsavel_user_id', $this->user->id);

    $manutencaoId = $manutencao->json('result.id');

    $this->postJson("/api/v1/manutencoes/{$manutencaoId}/finalizar", [
        'data_saida' => now()->toDateString(),
    ], equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('result.ativa', false);
});

it('baixa equipamento em estoque', function (): void {
    $equipamento = $this->tenant->run(fn() => Equipamento::factory()->create());

    $this->postJson("/api/v1/equipamentos/{$equipamento->id}/baixar", [
        'tipo' => 'devolucao',
        'data_baixa' => now()->toDateString(),
    ], equipHeaders($this->tenant->id))
        ->assertCreated()
        ->assertJsonPath('result.tipo', 'devolucao');

    $this->tenant->run(fn() => expect(Baixa::query()->where('equipamento_id', $equipamento->id)->exists())->toBeTrue());
});

it('lista baixados e perdidos com status baixados_todos', function (): void {
    $this->tenant->run(function (): void {
        Baixa::factory()->create(['tipo' => 'devolucao']);
        Baixa::factory()->perda()->create();
        Equipamento::factory()->create();
    });

    $this->getJson('/api/v1/equipamentos?status=baixados', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonCount(1, 'data');

    $this->getJson('/api/v1/equipamentos?status=perdidos', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonCount(1, 'data');

    $this->getJson('/api/v1/equipamentos?status=baixados_todos', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

it('nega baixa com emprestimo ativo', function (): void {
    $equipamento = $this->tenant->run(function (): Equipamento {
        $equipamento = Equipamento::factory()->create();
        Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
            'data_devolucao' => null,
        ]);

        return $equipamento;
    });

    $this->postJson("/api/v1/equipamentos/{$equipamento->id}/baixar", [
        'tipo' => 'devolucao',
        'data_baixa' => now()->toDateString(),
    ], equipHeaders($this->tenant->id))
        ->assertStatus(500);
});

it('lista historico do equipamento', function (): void {
    $equipamento = $this->tenant->run(function (): Equipamento {
        $equipamento = Equipamento::factory()->create();
        HistoricoEquipamento::query()->create([
            'equipamento_id' => $equipamento->id,
            'evento' => 'cadastrado',
            'status_resultante' => 'em_estoque',
        ]);

        return $equipamento;
    });

    $this->getJson("/api/v1/equipamentos/{$equipamento->id}/historico", equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1)
        ->assertJsonPath('result.data.0.evento', 'cadastrado');
});

it('lista emprestimos ativos', function (): void {
    $this->tenant->run(function (): void {
        $equipamento = Equipamento::factory()->create();
        Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
            'data_devolucao' => null,
        ]);
        Emprestimo::factory()->encerrado()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
        ]);
    });

    $this->getJson('/api/v1/emprestimos', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

it('lista manutencoes e baixas', function (): void {
    $this->tenant->run(function (): void {
        Manutencao::factory()->create();
        Baixa::factory()->create();
    });

    $this->getJson('/api/v1/manutencoes', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1);

    $this->getJson('/api/v1/baixas', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('status', 1);
});

// ─── Dashboard e medição ──────────────────────────────────────────────────────

it('retorna resumo do dashboard de equipamentos', function (): void {
    $this->tenant->run(fn() => Equipamento::factory()->count(2)->create());

    $this->getJson('/api/v1/dashboard/resumo', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonPath('total', 2)
        ->assertJsonStructure([
            'total',
            'em_estoque',
            'em_utilizacao',
            'em_manutencao',
            'baixados',
            'perdidos',
            'criticos',
            'parados_30_dias',
            'parados_30_dias_valor_mensal',
        ]);
});

it('retorna alertas do dashboard de equipamentos', function (): void {
    $this->tenant->run(function (): void {
        $equipamento = Equipamento::factory()->create();
        Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
            'data_retirada' => now()->subDays(20)->toDateString(),
            'prazo_dias' => 15,
            'data_devolucao' => null,
        ]);
    });

    $this->getJson('/api/v1/dashboard/alertas', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonStructure([
            'total',
            'resumo',
            'vencidos' => ['total', 'itens'],
            'proximos_vencimento' => ['total', 'itens'],
            'proximos_semana' => ['total', 'itens'],
            'manutencoes_atrasadas' => ['total', 'itens'],
            'equipamentos_parados' => ['total', 'valor_mensal_total', 'itens'],
        ])
        ->assertJsonPath('vencidos.total', 1);
});

it('retorna rankings do dashboard de equipamentos', function (): void {
    $this->tenant->run(function (): void {
        $equipamento = Equipamento::factory()->create();
        Emprestimo::factory()->count(2)->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
        ]);
        Manutencao::factory()->create(['equipamento_id' => $equipamento->id]);
    });

    $this->getJson('/api/v1/dashboard/rankings', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonStructure([
            'mais_utilizados',
            'mais_manutencao',
            'colaboradores',
        ]);
});

it('retorna dashboard financeiro de equipamentos', function (): void {
    $this->tenant->run(function (): void {
        Equipamento::factory()->create([
            'valor_mensal' => 1500,
            'data_entrada' => now()->subDays(45)->toDateString(),
        ]);
        Equipamento::factory()->create([
            'valor_mensal' => 3000,
            'data_entrada' => now()->subDays(10)->toDateString(),
        ]);
    });

    $this->getJson('/api/v1/dashboard/financeiro', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonStructure([
            'custo_mensal_total',
            'equipamentos_ociosos' => ['total', 'valor_mensal'],
            'economia_potencial_mensal',
            'equipamentos_mais_caros',
            'obras' => [
                'maior_consumo',
                'mais_parados',
                'mais_vencidos',
            ],
            'colaboradores' => [
                'media_emprestimos_ativos',
                'mais_tempo',
                'mais_renovacoes',
                'excesso_equipamentos',
            ],
            'recomendacoes',
        ])
        ->assertJsonPath('equipamentos_ociosos.total', 1)
        ->assertJsonPath('custo_mensal_total', 4500);
});

it('retorna graficos do dashboard de equipamentos', function (): void {
    $this->tenant->run(function (): void {
        $equipamento = Equipamento::factory()->create([
            'valor_mensal' => 2000,
            'data_entrada' => now()->subDays(45)->toDateString(),
        ]);
        Emprestimo::factory()->create([
            'equipamento_id' => $equipamento->id,
            'obra_id' => $equipamento->obra_id,
            'data_devolucao' => null,
        ]);
    });

    $this->getJson('/api/v1/dashboard/graficos', equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonStructure([
            'evolucao_utilizacao',
            'evolucao_ociosidade',
            'custos_mensais',
            'equipamentos_por_status',
            'emprestimos_situacao',
            'custos_por_obra',
            'custos_por_grupo',
            'manutencao' => [
                'evolucao_custos',
                'tempo_medio_dias',
                'equipamentos_parados',
                'custo_mensal',
            ],
            'colaboradores_heatmap',
            'recomendacoes',
        ])
        ->assertJsonCount(6, 'evolucao_utilizacao');
});

it('calcula medicao do periodo', function (): void {
    $this->tenant->run(fn() => Equipamento::factory()->create([
        'data_entrada' => now()->subDays(60)->toDateString(),
        'valor_mensal' => 3000,
    ]));

    $this->postJson('/api/v1/medicao/calcular', [
        'data_inicio' => now()->subDays(30)->toDateString(),
        'data_fim' => now()->toDateString(),
    ], equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonStructure([
            'periodo' => ['inicio', 'fim', 'dias'],
            'totais' => ['quantidade_equipamentos', 'valor_total'],
            'itens',
        ])
        ->assertJsonPath('totais.quantidade_equipamentos', 1);
});

it('agrupa medicao por fornecedor', function (): void {
    $this->tenant->run(fn() => Equipamento::factory()->create([
        'data_entrada' => now()->subDays(10)->toDateString(),
    ]));

    $this->postJson('/api/v1/medicao/calcular', [
        'data_inicio' => now()->subDays(5)->toDateString(),
        'data_fim' => now()->toDateString(),
        'agrupar_fornecedor' => true,
    ], equipHeaders($this->tenant->id))
        ->assertOk()
        ->assertJsonStructure(['periodo', 'totais', 'grupos']);
});

it('exporta medicao em excel', function (): void {
    $this->tenant->run(fn() => Equipamento::factory()->create([
        'data_entrada' => now()->subDays(10)->toDateString(),
    ]));

    $response = $this->postJson('/api/v1/medicao/exportar', [
        'data_inicio' => now()->subDays(5)->toDateString(),
        'data_fim' => now()->toDateString(),
    ], equipHeaders($this->tenant->id));

    $response->assertOk();
    expect($response->headers->get('content-type'))->toContain('spreadsheetml.sheet');
});
