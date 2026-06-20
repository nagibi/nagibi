<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Baixa;
use App\Models\Emprestimo;
use App\Models\EmprestimoRenovacao;
use App\Models\Equipamento;
use App\Models\HistoricoEquipamento;
use App\Models\Manutencao;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class EquipamentoStatusService
{
    public function __construct(
        private readonly EquipcontrolNotificationService $notificationService,
    ) {}

    public function emprestar(Equipamento $equipamento, array $dados): Emprestimo
    {
        $emprestimo = DB::transaction(function () use ($equipamento, $dados) {
            $this->garantirEmEstoque($equipamento);

            $emprestimo = Emprestimo::create([
                'equipamento_id' => $equipamento->id,
                'obra_id' => $dados['obra_id'],
                'colaborador_nome' => $dados['colaborador_nome'],
                'colaborador_matricula' => $dados['colaborador_matricula'],
                'colaborador_whatsapp' => $dados['colaborador_whatsapp'] ?? null,
                'encarregado_nome' => $dados['encarregado_nome'],
                'data_retirada' => $dados['data_retirada'],
                'prazo_dias' => $dados['prazo_dias'] ?? 15,
                'foto_cracha_path' => $dados['foto_cracha_path'] ?? null,
                'foto_equipamento_retirada_path' => $dados['foto_equipamento_retirada_path'] ?? null,
                'foto_assinatura_path' => $dados['foto_assinatura_path'] ?? null,
                'autorizado_por' => $this->actorId(),
                'observacoes' => $dados['observacoes'] ?? null,
            ]);

            $this->registrarHistorico($equipamento, 'emprestado', 'em_utilizacao', [
                'colaborador' => $dados['colaborador_nome'],
                'matricula' => $dados['colaborador_matricula'],
                'encarregado' => $dados['encarregado_nome'],
                'obra_id' => $dados['obra_id'],
                'data_retirada' => $dados['data_retirada'],
            ]);

            return $emprestimo;
        });

        $this->notificationService->loanCreated($emprestimo);

        return $emprestimo;
    }

    public function devolver(Emprestimo $emprestimo, array $dados = []): Emprestimo
    {
        $emprestimo = DB::transaction(function () use ($emprestimo, $dados) {
            $emprestimo->update([
                'data_devolucao' => $dados['data_devolucao'] ?? now()->toDateString(),
                'foto_equipamento_devolucao_path' => $dados['foto_equipamento_devolucao_path'] ?? null,
            ]);

            $this->registrarHistorico(
                $emprestimo->equipamento,
                'devolvido',
                'em_estoque',
                ['dias_em_uso' => $emprestimo->dias_em_uso]
            );

            return $emprestimo->fresh(['equipamento.tipo', 'obra']);
        });

        $this->notificationService->loanReturned($emprestimo);

        return $emprestimo;
    }

    public function renovar(Emprestimo $emprestimo, array $dados): EmprestimoRenovacao
    {
        $renovacao = DB::transaction(function () use ($emprestimo, $dados) {
            $renovacao = EmprestimoRenovacao::create([
                'emprestimo_id' => $emprestimo->id,
                'data_renovacao' => $dados['data_renovacao'] ?? now()->toDateString(),
                'prazo_adicional_dias' => $dados['prazo_adicional_dias'] ?? 15,
                'autorizado_por' => $this->actorId(),
                'observacao' => $dados['observacao'] ?? null,
            ]);

            $this->registrarHistorico(
                $emprestimo->equipamento,
                'renovado',
                'em_utilizacao',
                ['prazo_adicional_dias' => $renovacao->prazo_adicional_dias]
            );

            return $renovacao;
        });

        $this->notificationService->loanRenewed($emprestimo->fresh(['equipamento.tipo', 'obra', 'renovacoes']), $renovacao);

        return $renovacao;
    }

    public function enviarParaManutencao(Equipamento $equipamento, array $dados): Manutencao
    {
        $this->applyResponsavelUser($dados);

        $manutencao = DB::transaction(function () use ($equipamento, $dados) {
            $origem = 'estoque';
            $emprestimoId = null;

            $equipamento->load('emprestimoAtivo');
            if ($equipamento->emprestimoAtivo) {
                $origem = 'emprestimo';
                $emprestimoId = $equipamento->emprestimoAtivo->id;
                $equipamento->emprestimoAtivo->update([
                    'data_devolucao' => $dados['data_entrada'],
                ]);
            }

            $manutencao = Manutencao::create([
                'equipamento_id' => $equipamento->id,
                'origem' => $origem,
                'emprestimo_id' => $emprestimoId,
                'responsabilidade' => $dados['responsabilidade'],
                'motivo' => $dados['motivo'],
                'responsavel_user_id' => $dados['responsavel_user_id'],
                'responsavel_manutencao' => $dados['responsavel_manutencao'] ?? null,
                'observacoes_tecnicas' => $dados['observacoes_tecnicas'] ?? null,
                'foto_path' => $dados['foto_path'] ?? null,
                'valor_mensal_snapshot' => $equipamento->valor_mensal,
                'data_entrada' => $dados['data_entrada'],
                'registrado_por' => $this->actorId(),
            ]);

            $this->registrarHistorico($equipamento, 'manutencao_aberta', 'em_manutencao', [
                'motivo' => $dados['motivo'],
                'responsabilidade' => $dados['responsabilidade'],
                'responsavel_user_id' => $dados['responsavel_user_id'],
                'responsavel' => $dados['responsavel_manutencao'] ?? null,
            ]);

            return $manutencao;
        });

        $this->notificationService->maintenanceSent($manutencao);

        return $manutencao;
    }

    public function finalizarManutencao(Manutencao $manutencao, array $dados = []): Manutencao
    {
        $manutencao = DB::transaction(function () use ($manutencao, $dados) {
            $manutencao->update([
                'data_saida' => $dados['data_saida'] ?? now()->toDateString(),
            ]);

            $this->registrarHistorico(
                $manutencao->equipamento,
                'manutencao_finalizada',
                'em_estoque',
                ['dias_em_manutencao' => $manutencao->dias_em_manutencao]
            );

            return $manutencao->fresh(['equipamento.tipo', 'responsavelUser']);
        });

        $this->notificationService->maintenanceCompleted($manutencao);

        return $manutencao;
    }

    public function baixar(Equipamento $equipamento, array $dados): Baixa
    {
        return DB::transaction(function () use ($equipamento, $dados) {
            $equipamento->load(['emprestimoAtivo', 'manutencaoAtiva']);

            if ($equipamento->emprestimoAtivo) {
                throw new RuntimeException('Equipamento com empréstimo ativo. Registre a devolução antes de baixar.');
            }
            if ($equipamento->manutencaoAtiva) {
                throw new RuntimeException('Equipamento em manutenção. Finalize a manutenção antes de baixar.');
            }

            $baixa = Baixa::create([
                'equipamento_id' => $equipamento->id,
                'tipo' => $dados['tipo'],
                'data_baixa' => $dados['data_baixa'],
                'motivo' => $dados['motivo'] ?? null,
                'foto_path' => $dados['foto_path'] ?? null,
                'responsavel_perda' => $dados['responsavel_perda'] ?? null,
                'valor_reposicao' => $dados['valor_reposicao'] ?? null,
                'registrado_por' => $this->actorId(),
                'observacoes' => $dados['observacoes'] ?? null,
            ]);

            $evento = $dados['tipo'] === 'perda' ? 'perda_registrada' : 'baixado';
            $statusResultante = $dados['tipo'] === 'perda' ? 'perdido' : 'baixado';

            $this->registrarHistorico($equipamento, $evento, $statusResultante, [
                'tipo' => $dados['tipo'],
                'motivo' => $dados['motivo'] ?? null,
            ]);

            return $baixa;
        });
    }

    private function garantirEmEstoque(Equipamento $equipamento): void
    {
        $equipamento->load(['emprestimoAtivo', 'manutencaoAtiva', 'baixa']);

        if ($equipamento->emprestimoAtivo) {
            throw new RuntimeException("Equipamento #{$equipamento->patrimonio} já está emprestado.");
        }
        if ($equipamento->manutencaoAtiva) {
            throw new RuntimeException("Equipamento #{$equipamento->patrimonio} está em manutenção.");
        }
        if ($equipamento->baixa) {
            throw new RuntimeException("Equipamento #{$equipamento->patrimonio} foi baixado/perdido.");
        }
    }

    private function registrarHistorico(
        Equipamento $equipamento,
        string $evento,
        string $statusResultante,
        array $dados = [],
    ): void {
        HistoricoEquipamento::create([
            'equipamento_id' => $equipamento->id,
            'evento' => $evento,
            'dados' => $dados,
            'status_resultante' => $statusResultante,
            'registrado_por' => $this->actorId(),
        ]);
    }

    private function actorId(): ?int
    {
        /** @var User|null $user */
        $user = Auth::user();

        return $user?->id;
    }

    /**
     * @param  array<string, mixed>  $dados
     */
    private function applyResponsavelUser(array &$dados): void
    {
        if (! array_key_exists('responsavel_user_id', $dados)) {
            return;
        }

        $dados['responsavel_manutencao'] = User::query()
            ->whereKey($dados['responsavel_user_id'])
            ->value('name');
    }
}
