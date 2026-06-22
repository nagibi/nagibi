<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Emprestimo;
use App\Models\EmprestimoRenovacao;
use App\Models\Equipamento;
use App\Models\Manutencao;

final class EquipamentoNotificationService
{
    public function __construct(
        private readonly NotificationDispatchService $dispatchService,
    ) {}

    public function loanCreated(Emprestimo $emprestimo): void
    {
        $this->dispatchService->dispatch('loan.created', $this->emprestimoContext($emprestimo));
    }

    public function loanReturned(Emprestimo $emprestimo): void
    {
        $context = $this->emprestimoContext($emprestimo);
        $context['dias_em_uso'] = $emprestimo->dias_em_uso;

        $this->dispatchService->dispatch('loan.returned', $context);
    }

    public function loanRenewed(Emprestimo $emprestimo, EmprestimoRenovacao $renovacao): void
    {
        $context = $this->emprestimoContext($emprestimo);
        $context['renovacao_id'] = $renovacao->id;
        $context['prazo_adicional_dias'] = $renovacao->prazo_adicional_dias;
        $context['total_renovacoes'] = $emprestimo->renovacoes()->count();

        $this->dispatchService->dispatch('loan.renewed', $context);

        $limite = (int) config('equipamento.alerts.max_renovacoes_recomendadas', 4);
        if ($context['total_renovacoes'] > $limite) {
            $context['dedupe_key'] = "loan.renewal_limit_exceeded:{$emprestimo->id}";
            $this->dispatchService->dispatch('loan.renewal_limit_exceeded', $context);
        }
    }

    public function maintenanceSent(Manutencao $manutencao): void
    {
        $this->dispatchService->dispatch('maintenance.sent', $this->manutencaoContext($manutencao));
    }

    public function maintenanceCompleted(Manutencao $manutencao): void
    {
        $context = $this->manutencaoContext($manutencao);
        $context['dias_em_manutencao'] = $manutencao->dias_em_manutencao;
        $context['data_saida'] = $manutencao->data_saida?->toDateString();

        $this->dispatchService->dispatch('maintenance.completed', $context);
    }

    /**
     * @return array<string, mixed>
     */
    public function emprestimoContext(Emprestimo $emprestimo): array
    {
        $emprestimo->loadMissing(['equipamento.tipo', 'equipamento.manutencaoAtiva', 'equipamento.emprestimoAtivo', 'equipamento.baixa', 'obra']);

        return [
            'emprestimo_id' => $emprestimo->id,
            'equipamento_id' => $emprestimo->equipamento_id,
            'patrimonio' => $emprestimo->equipamento?->patrimonio,
            'equipamento_nome' => $emprestimo->equipamento?->tipo?->nome,
            'colaborador' => $emprestimo->colaborador_nome,
            'obra_id' => $emprestimo->obra_id,
            'obra_codigo' => $emprestimo->obra?->codigo,
            'dias_ate_vencimento' => $emprestimo->dias_ate_vencimento,
            'dias_vencido' => $emprestimo->is_vencido ? abs($emprestimo->dias_ate_vencimento) : 0,
            'status_atual' => $emprestimo->equipamento?->status,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function equipamentoContext(Equipamento $equipamento): array
    {
        $equipamento->loadMissing(['tipo', 'obra', 'manutencaoAtiva', 'emprestimoAtivo', 'baixa']);

        return [
            'equipamento_id' => $equipamento->id,
            'patrimonio' => $equipamento->patrimonio,
            'equipamento_nome' => $equipamento->tipo?->nome,
            'obra_id' => $equipamento->obra_id,
            'obra_codigo' => $equipamento->obra?->codigo,
            'valor_mensal' => number_format((float) $equipamento->valor_mensal, 2, ',', '.'),
            'dias_parado' => $equipamento->tempo_em_estoque,
            'status_atual' => $equipamento->status,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function manutencaoContext(Manutencao $manutencao): array
    {
        $manutencao->loadMissing(['equipamento.tipo', 'equipamento.manutencaoAtiva', 'equipamento.emprestimoAtivo', 'equipamento.baixa', 'responsavelUser']);
        $equipamento = $manutencao->equipamento;

        return [
            'manutencao_id' => $manutencao->id,
            'equipamento_id' => $manutencao->equipamento_id,
            'patrimonio' => $equipamento?->patrimonio,
            'equipamento_nome' => $equipamento?->tipo?->nome,
            'motivo' => $manutencao->motivo,
            'responsavel' => $manutencao->responsavel_manutencao ?? $manutencao->responsavelUser?->name,
            'data_entrada' => $manutencao->data_entrada->toDateString(),
            'status_atual' => $equipamento?->status,
        ];
    }
}
