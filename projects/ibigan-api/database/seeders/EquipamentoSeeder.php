<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Baixa;
use App\Models\Emprestimo;
use App\Models\EmprestimoRenovacao;
use App\Models\Equipamento;
use App\Models\Fornecedor;
use App\Models\GrupoEquipamento;
use App\Models\HistoricoEquipamento;
use App\Models\Manutencao;
use App\Models\Obra;
use App\Models\TipoEquipamento;
use App\Models\User;
use App\Services\EquipamentoStatusService;
use Carbon\Carbon;
use Database\Seeders\Concerns\SeedsEquipamentoDemoImages;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class EquipamentoSeeder extends Seeder
{
    use SeedsEquipamentoDemoImages;

    /** @var array<string, GrupoEquipamento> */
    private array $grupos = [];

    /** @var array<string, TipoEquipamento> */
    private array $tipos = [];

    /** @var array<string, Fornecedor> */
    private array $fornecedores = [];

    /** @var array<string, Obra> */
    private array $obras = [];

    private ?User $registrador = null;

    public function run(): void
    {
        if (! tenancy()->initialized) {
            throw new RuntimeException(
                'EquipamentoSeeder deve ser executado no contexto de um tenant. '
                .'Use: php artisan tenants:seed --class=EquipamentoSeeder',
            );
        }

        $this->registrador = User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', 'admin'))
            ->first()
            ?? User::query()->first();

        if ($this->registrador === null) {
            $this->command?->warn('EquipamentoSeeder ignorado: nenhum usuário encontrado no tenant.');

            return;
        }

        Auth::guard('web')->login($this->registrador);

        DB::transaction(function (): void {
            $this->limparDados();
            $this->seedLookups();
            $this->seedCenarios();
        });

        $this->command?->info('  ✓ Equipamentos populado com lookups, equipamentos, empréstimos, manutenções e baixas.');
    }

    private function limparDados(): void
    {
        HistoricoEquipamento::query()->delete();
        EmprestimoRenovacao::query()->delete();
        Emprestimo::query()->delete();
        Manutencao::query()->delete();
        Baixa::query()->delete();
        Equipamento::query()->forceDelete();
    }

    private function seedLookups(): void
    {
        $catalogo = [
            'MARTELETE' => ['MARTELETE SDS PLUS', 'MARTELETE ROMPEDOR 15KG'],
            'BOMBA MANGOTE' => ['BOMBA MANGOTE 2"', 'BOMBA MANGOTE 3"'],
            'GERADOR' => ['GERADOR 5 KVA', 'GERADOR 10 KVA'],
            'BETONEIRA' => ['BETONEIRA 400L', 'BETONEIRA 320L'],
            'VIBRADOR' => ['VIBRADOR DE CONCRETO', 'VIBRADOR DE IMERSÃO'],
        ];

        foreach ($catalogo as $grupoNome => $tipos) {
            $grupo = GrupoEquipamento::query()->firstOrCreate(['nome' => $grupoNome]);
            $this->grupos[$grupoNome] = $grupo;

            foreach ($tipos as $tipoNome) {
                $this->tipos[$tipoNome] = TipoEquipamento::query()->firstOrCreate([
                    'grupo_id' => $grupo->id,
                    'nome' => $tipoNome,
                ]);
            }
        }

        $fornecedores = [
            'Equipamentos Locação Ltda' => [
                'cnpj' => '12.345.678/0001-90',
                'telefone' => '11987654321',
                'email' => 'contato@equiploc.com.br',
                'contato_responsavel' => 'Ricardo Almeida',
            ],
            'Fortes Engenharia Equipamentos' => [
                'cnpj' => '98.765.432/0001-10',
                'telefone' => '11912345678',
                'email' => 'equipamentos@fortes.com.br',
                'contato_responsavel' => 'Patrícia Mendes',
            ],
            'Locadora Obra Pronta' => [
                'cnpj' => '11.222.333/0001-44',
                'telefone' => '11999887766',
                'email' => 'obra@locadorapronta.com.br',
                'contato_responsavel' => 'Fernando Costa',
            ],
        ];

        foreach ($fornecedores as $nome => $dados) {
            $this->fornecedores[$nome] = Fornecedor::query()->updateOrCreate(
                ['nome' => $nome],
                [...$dados, 'is_ativo' => true],
            );
        }

        $obras = [
            '650' => ['nome' => 'Residencial Horizonte', 'endereco' => 'Av. Paulista, 1200 - São Paulo', 'responsavel' => 'Eng. Marcos Lima'],
            '651' => ['nome' => 'Shopping Litoral Norte', 'endereco' => 'Rod. dos Imigrantes, km 42', 'responsavel' => 'Eng. Carla Souza'],
            '652' => ['nome' => 'Galpão Logístico Interior', 'endereco' => 'Distrito Industrial, Campinas', 'responsavel' => 'Eng. Paulo Ribeiro'],
            '653' => ['nome' => 'Condomínio Vista Verde', 'endereco' => 'Rua das Palmeiras, 88 - Santos', 'responsavel' => 'Eng. Juliana Prado'],
        ];

        foreach ($obras as $codigo => $dados) {
            $this->obras[$codigo] = Obra::query()->updateOrCreate(
                ['codigo' => $codigo],
                [...$dados, 'is_ativa' => true],
            );
        }
    }

    private function seedCenarios(): void
    {
        $service = app(EquipamentoStatusService::class);

        // ── Estoque ───────────────────────────────────────────────────────────
        $estoqueParado = $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-1001',
            'tipo' => 'MARTELETE SDS PLUS',
            'fornecedor' => 'Equipamentos Locação Ltda',
            'obra' => '650',
            'valor_mensal' => 1850.00,
            'data_entrada' => now()->subDays(60),
            'is_critico' => true,
        ]);

        $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-1002',
            'tipo' => 'BOMBA MANGOTE 2"',
            'fornecedor' => 'Fortes Engenharia Equipamentos',
            'obra' => '650',
            'valor_mensal' => 2200.00,
            'data_entrada' => now()->subDays(45),
        ]);

        $estoqueComHistorico = $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-1003',
            'tipo' => 'GERADOR 5 KVA',
            'fornecedor' => 'Locadora Obra Pronta',
            'obra' => '651',
            'valor_mensal' => 3100.00,
            'data_entrada' => now()->subDays(20),
        ]);

        $this->simularEmprestimoEncerrado($service, $estoqueComHistorico, [
            'colaborador_nome' => 'Roberto Nunes',
            'colaborador_matricula' => '44556',
            'obra' => '652',
            'data_retirada' => now()->subDays(35)->toDateString(),
            'prazo_dias' => 10,
            'data_devolucao' => now()->subDays(22)->toDateString(),
        ]);

        $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-1004',
            'tipo' => 'BETONEIRA 400L',
            'fornecedor' => 'Equipamentos Locação Ltda',
            'obra' => '652',
            'valor_mensal' => 980.00,
            'data_entrada' => now()->subDays(12),
        ]);

        $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-1005',
            'tipo' => 'VIBRADOR DE CONCRETO',
            'fornecedor' => 'Fortes Engenharia Equipamentos',
            'obra' => '653',
            'valor_mensal' => 750.00,
            'data_entrada' => now()->subDays(8),
        ]);

        // ── Em utilização ─────────────────────────────────────────────────────
        $emUsoNormal = $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-2001',
            'tipo' => 'MARTELETE ROMPEDOR 15KG',
            'fornecedor' => 'Equipamentos Locação Ltda',
            'obra' => '650',
            'valor_mensal' => 2450.00,
            'data_entrada' => now()->subDays(90),
        ]);

        $service->emprestar($emUsoNormal, $this->dadosEmprestimo([
            'colaborador_nome' => 'João Silva',
            'colaborador_matricula' => '12345',
            'obra' => '651',
            'data_retirada' => now()->subDays(5)->toDateString(),
            'prazo_dias' => 15,
            'fotos' => true,
        ]));

        $vencido = $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-2002',
            'tipo' => 'GERADOR 10 KVA',
            'fornecedor' => 'Locadora Obra Pronta',
            'obra' => '651',
            'valor_mensal' => 4200.00,
            'data_entrada' => now()->subDays(120),
        ]);

        $emprestimoVencido = $service->emprestar($vencido, $this->dadosEmprestimo([
            'colaborador_nome' => 'Maria Santos',
            'colaborador_matricula' => '67890',
            'obra' => '652',
            'data_retirada' => now()->subDays(22)->toDateString(),
            'prazo_dias' => 15,
            'fotos' => true,
        ]));

        $proximoVencimento = $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-2003',
            'tipo' => 'BOMBA MANGOTE 3"',
            'fornecedor' => 'Fortes Engenharia Equipamentos',
            'obra' => '652',
            'valor_mensal' => 2680.00,
            'data_entrada' => now()->subDays(75),
        ]);

        $service->emprestar($proximoVencimento, $this->dadosEmprestimo([
            'colaborador_nome' => 'Carlos Oliveira',
            'colaborador_matricula' => '11111',
            'obra' => '653',
            'data_retirada' => now()->subDays(13)->toDateString(),
            'prazo_dias' => 15,
        ]));

        $comRenovacao = $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-2004',
            'tipo' => 'BETONEIRA 320L',
            'fornecedor' => 'Equipamentos Locação Ltda',
            'obra' => '653',
            'valor_mensal' => 890.00,
            'data_entrada' => now()->subDays(50),
        ]);

        $emprestimoRenovado = $service->emprestar($comRenovacao, $this->dadosEmprestimo([
            'colaborador_nome' => 'Ana Costa',
            'colaborador_matricula' => '22222',
            'obra' => '650',
            'data_retirada' => now()->subDays(18)->toDateString(),
            'prazo_dias' => 10,
        ]));

        $service->renovar($emprestimoRenovado, [
            'prazo_adicional_dias' => 7,
            'data_renovacao' => now()->subDays(8)->toDateString(),
            'observacao' => 'Renovação aprovada pelo encarregado.',
        ]);

        // ── Manutenção ────────────────────────────────────────────────────────
        $emManutencao = $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-3001',
            'tipo' => 'VIBRADOR DE IMERSÃO',
            'fornecedor' => 'Locadora Obra Pronta',
            'obra' => '650',
            'valor_mensal' => 640.00,
            'data_entrada' => now()->subDays(40),
        ]);

        $service->enviarParaManutencao($emManutencao, [
            'responsabilidade' => 'equipamento',
            'motivo' => 'Motor com ruído anormal — revisão preventiva',
            'responsavel_user_id' => $this->registrador->id,
            'data_entrada' => now()->subDays(6)->toDateString(),
            'foto_path' => $this->seedEquipamentoImage('manutencoes', 'EQ-3001'),
        ]);

        $manutencaoFortes = $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-3002',
            'tipo' => 'MARTELETE SDS PLUS',
            'fornecedor' => 'Fortes Engenharia Equipamentos',
            'obra' => '651',
            'valor_mensal' => 1750.00,
            'data_entrada' => now()->subDays(30),
            'is_critico' => true,
        ]);

        $service->enviarParaManutencao($manutencaoFortes, [
            'responsabilidade' => 'fortes',
            'motivo' => 'Troca de escova e revisão elétrica',
            'responsavel_user_id' => $this->registrador->id,
            'data_entrada' => now()->subDays(3)->toDateString(),
            'foto_path' => $this->seedEquipamentoImage('manutencoes', 'EQ-3002'),
        ]);

        // Manutenção já finalizada (equipamento volta ao estoque)
        $manutencaoFinalizada = $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-3003',
            'tipo' => 'GERADOR 5 KVA',
            'fornecedor' => 'Equipamentos Locação Ltda',
            'obra' => '652',
            'valor_mensal' => 2950.00,
            'data_entrada' => now()->subDays(100),
        ]);

        $manutencaoEncerrada = $service->enviarParaManutencao($manutencaoFinalizada, [
            'responsabilidade' => 'equipamento',
            'motivo' => 'Revisão de 500 horas',
            'responsavel_user_id' => $this->registrador->id,
            'data_entrada' => now()->subDays(25)->toDateString(),
            'foto_path' => $this->seedEquipamentoImage('manutencoes', 'EQ-3003'),
        ]);

        $service->finalizarManutencao($manutencaoEncerrada, [
            'data_saida' => now()->subDays(10)->toDateString(),
        ]);

        // ── Baixados e perdidos ───────────────────────────────────────────────
        $baixado = $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-4001',
            'tipo' => 'BOMBA MANGOTE 2"',
            'fornecedor' => 'Locadora Obra Pronta',
            'obra' => '650',
            'valor_mensal' => 1980.00,
            'data_entrada' => now()->subDays(200),
        ]);

        $service->baixar($baixado, [
            'tipo' => 'devolucao',
            'data_baixa' => now()->subDays(15)->toDateString(),
            'observacoes' => 'Devolução ao fornecedor ao fim do contrato.',
            'foto_path' => $this->seedEquipamentoImage('baixas', 'EQ-4001'),
        ]);

        $baixado2 = $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-4002',
            'tipo' => 'BETONEIRA 400L',
            'fornecedor' => 'Fortes Engenharia Equipamentos',
            'obra' => '651',
            'valor_mensal' => 1050.00,
            'data_entrada' => now()->subDays(180),
        ]);

        $service->baixar($baixado2, [
            'tipo' => 'devolucao',
            'data_baixa' => now()->subDays(7)->toDateString(),
            'observacoes' => 'Equipamento substituído por modelo novo.',
            'foto_path' => $this->seedEquipamentoImage('baixas', 'EQ-4002'),
        ]);

        $perdido = $this->cadastrarEquipamento([
            'patrimonio' => 'EQ-5001',
            'tipo' => 'MARTELETE ROMPEDOR 15KG',
            'fornecedor' => 'Equipamentos Locação Ltda',
            'obra' => '653',
            'valor_mensal' => 2550.00,
            'data_entrada' => now()->subDays(150),
        ]);

        $service->baixar($perdido, [
            'tipo' => 'perda',
            'data_baixa' => now()->subDays(30)->toDateString(),
            'motivo' => 'Extravio em obra — não localizado após vistoria',
            'responsavel_perda' => 'João Silva',
            'valor_reposicao' => 4800.00,
            'foto_path' => $this->seedEquipamentoImage('baixas', 'EQ-5001 PERDA'),
        ]);

        // Referências não usadas — evita warnings do analisador
        unset($estoqueParado, $emprestimoVencido, $emprestimoRenovado);
    }

    /**
     * @param  array{
     *     patrimonio: string,
     *     tipo: string,
     *     fornecedor: string,
     *     obra: string,
     *     valor_mensal: float,
     *     data_entrada: Carbon,
     *     is_critico?: bool
     * }  $dados
     */
    private function cadastrarEquipamento(array $dados): Equipamento
    {
        $equipamento = Equipamento::query()->create([
            'patrimonio' => $dados['patrimonio'],
            'tipo_id' => $this->tipos[$dados['tipo']]->id,
            'fornecedor_id' => $this->fornecedores[$dados['fornecedor']]->id,
            'obra_id' => $this->obras[$dados['obra']]->id,
            'valor_mensal' => $dados['valor_mensal'],
            'foto_path' => $this->seedEquipamentoImage('equipamentos', $dados['patrimonio']),
            'is_critico' => $dados['is_critico'] ?? false,
            'data_entrada' => $dados['data_entrada']->toDateString(),
        ]);

        HistoricoEquipamento::query()->create([
            'equipamento_id' => $equipamento->id,
            'evento' => 'cadastrado',
            'dados' => [
                'patrimonio' => $equipamento->patrimonio,
                'fornecedor_id' => $equipamento->fornecedor_id,
                'obra_id' => $equipamento->obra_id,
                'data_entrada' => $equipamento->data_entrada->toDateString(),
            ],
            'status_resultante' => 'em_estoque',
            'registrado_por' => $this->registrador?->id,
            'created_at' => $dados['data_entrada'],
        ]);

        return $equipamento;
    }

    /**
     * @param  array{
     *     colaborador_nome: string,
     *     colaborador_matricula: string,
     *     obra: string,
     *     data_retirada: string,
     *     prazo_dias: int,
     *     fotos?: bool
     * }  $dados
     * @return array<string, mixed>
     */
    private function dadosEmprestimo(array $dados): array
    {
        $payload = [
            'obra_id' => $this->obras[$dados['obra']]->id,
            'colaborador_nome' => $dados['colaborador_nome'],
            'colaborador_matricula' => $dados['colaborador_matricula'],
            'colaborador_whatsapp' => $this->whatsappDemo($dados['colaborador_matricula']),
            'data_retirada' => $dados['data_retirada'],
            'prazo_dias' => $dados['prazo_dias'],
            'observacoes' => 'Empréstimo gerado pelo seed de demonstração.',
        ];

        if ($dados['fotos'] ?? false) {
            $label = $dados['colaborador_matricula'];
            $payload['foto_cracha_path'] = $this->seedEquipamentoImage('emprestimos', "CRACHA {$label}");
            $payload['foto_equipamento_retirada_path'] = $this->seedEquipamentoImage('emprestimos', "RETIRADA {$label}");
            $payload['foto_assinatura_path'] = $this->seedEquipamentoImage('emprestimos', "ASSINATURA {$label}");
        }

        return $payload;
    }

    private function whatsappDemo(string $matricula): string
    {
        return '119'.str_pad($matricula, 8, '0', STR_PAD_LEFT);
    }

    /**
     * @param  array{
     *     colaborador_nome: string,
     *     colaborador_matricula: string,
     *     obra: string,
     *     data_retirada: string,
     *     prazo_dias: int,
     *     data_devolucao: string
     * }  $dados
     */
    private function simularEmprestimoEncerrado(EquipamentoStatusService $service, Equipamento $equipamento, array $dados): void
    {
        $emprestimo = $service->emprestar($equipamento, $this->dadosEmprestimo([
            ...$dados,
            'fotos' => true,
        ]));

        $service->devolver($emprestimo, [
            'data_devolucao' => $dados['data_devolucao'],
            'foto_equipamento_devolucao_path' => $this->seedEquipamentoImage(
                'devolucoes',
                "DEVOLUCAO {$equipamento->patrimonio}",
            ),
        ]);
    }
}
