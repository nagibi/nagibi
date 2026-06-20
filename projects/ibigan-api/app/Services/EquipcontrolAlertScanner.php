<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Emprestimo;
use App\Models\Equipamento;
use App\Models\Manutencao;
use Illuminate\Support\Carbon;

final class EquipcontrolAlertScanner
{
    public function __construct(
        private readonly NotificationDispatchService $dispatchService,
        private readonly EquipcontrolNotificationService $equipcontrolNotifications,
    ) {}

    public function scan(): int
    {
        $this->dispatchService->deferEmails(true);

        try {
            $dispatched = 0;

            $dispatched += $this->scanLoans();
            $dispatched += $this->scanEquipment();
            $dispatched += $this->scanMaintenance();
            $dispatched += $this->scanCritical();
            $dispatched += $this->scanSites();
            $dispatched += $this->scanEmployees();
            $dispatched += $this->scanInsights();
            $dispatched += $this->scanDigests();

            $this->dispatchService->flushDeferredEmails();

            return $dispatched;
        } finally {
            $this->dispatchService->deferEmails(false);
        }
    }

    private function scanLoans(): int
    {
        $dispatched = 0;

        $ativos = Emprestimo::query()
            ->with(['equipamento.tipo', 'obra', 'renovacoes'])
            ->whereNull('data_devolucao')
            ->get();

        foreach ($ativos as $emprestimo) {
            $context = $this->equipcontrolNotifications->emprestimoContext($emprestimo);

            if ($emprestimo->is_vencido) {
                $context['dedupe_key'] = "loan.overdue:{$emprestimo->id}";
                $this->dispatchService->dispatch('loan.overdue', $context);
                $dispatched++;
                continue;
            }

            if ($emprestimo->is_proximo_vencimento) {
                $context['dedupe_key'] = "loan.due_soon:{$emprestimo->id}";
                $this->dispatchService->dispatch('loan.due_soon', $context);
                $dispatched++;
            }
        }

        return $dispatched;
    }

    private function scanEquipment(): int
    {
        $dispatched = 0;
        $idleDays = (int) config('equipcontrol.alerts.equipment_idle_days', 30);
        $unusedDays = (int) config('equipcontrol.alerts.equipment_unused_since_registration_days', 20);
        $minimumStock = (int) config('equipcontrol.alerts.equipment_minimum_stock', 2);

        $parados = Equipamento::query()
            ->with(['tipo', 'obra'])
            ->emEstoque()
            ->get()
            ->filter(fn(Equipamento $equipamento) => $equipamento->tempo_em_estoque >= $idleDays);

        foreach ($parados as $equipamento) {
            $context = $this->equipcontrolNotifications->equipamentoContext($equipamento);
            $context['dedupe_key'] = "equipment.idle:{$equipamento->id}";
            $this->dispatchService->dispatch('equipment.idle', $context);
            $dispatched++;
        }

        $semMovimentacao = Equipamento::query()
            ->with(['tipo', 'obra'])
            ->emEstoque()
            ->whereDoesntHave('historico', fn($query) => $query->whereIn('evento', ['emprestado', 'manutencao_aberta', 'devolvido']))
            ->get()
            ->filter(function (Equipamento $equipamento) use ($unusedDays): bool {
                $dias = (int) $equipamento->data_entrada->diffInDays(now()->startOfDay());

                return $dias >= $unusedDays;
            });

        foreach ($semMovimentacao as $equipamento) {
            $context = $this->equipcontrolNotifications->equipamentoContext($equipamento);
            $context['dias_cadastrado'] = (int) $equipamento->data_entrada->diffInDays(now()->startOfDay());
            $context['dedupe_key'] = "equipment.unused_since_registration:{$equipamento->id}";
            $this->dispatchService->dispatch('equipment.unused_since_registration', $context);
            $dispatched++;
        }

        $porTipo = Equipamento::query()
            ->emEstoque()
            ->selectRaw('tipo_id, COUNT(*) as total')
            ->groupBy('tipo_id')
            ->having('total', '<', $minimumStock)
            ->get();

        foreach ($porTipo as $row) {
            $tipo = Equipamento::query()->with('tipo')->where('tipo_id', $row->tipo_id)->first()?->tipo;
            if ($tipo === null) {
                continue;
            }

            $this->dispatchService->dispatch('equipment.below_minimum_stock', [
                'dedupe_key' => "equipment.below_minimum_stock:{$row->tipo_id}",
                'tipo_id' => $row->tipo_id,
                'tipo_nome' => $tipo->nome,
                'disponiveis' => (int) $row->total,
                'minimo' => $minimumStock,
            ]);
            $dispatched++;
        }

        return $dispatched;
    }

    private function scanMaintenance(): int
    {
        $dispatched = 0;
        $overdueDays = (int) config('equipcontrol.alerts.maintenance_overdue_days', 15);
        $frequencyThreshold = (int) config('equipcontrol.alerts.maintenance_frequency_threshold', 6);
        $frequencyMonths = (int) config('equipcontrol.alerts.maintenance_frequency_months', 12);
        $costThreshold = (float) config('equipcontrol.alerts.maintenance_cost_threshold', 3000);

        $atrasadas = Manutencao::query()
            ->with(['equipamento.tipo'])
            ->whereNull('data_saida')
            ->where('data_entrada', '<', now()->subDays($overdueDays)->toDateString())
            ->get();

        foreach ($atrasadas as $manutencao) {
            $context = [
                'manutencao_id' => $manutencao->id,
                'equipamento_id' => $manutencao->equipamento_id,
                'patrimonio' => $manutencao->equipamento?->patrimonio,
                'equipamento_nome' => $manutencao->equipamento?->tipo?->nome,
                'dias_em_manutencao' => $manutencao->dias_em_manutencao,
                'dedupe_key' => "maintenance.overdue:{$manutencao->id}",
            ];
            $this->dispatchService->dispatch('maintenance.overdue', $context);
            $dispatched++;
        }

        $inicio = now()->subMonths($frequencyMonths)->startOfDay();
        $equipamentos = Equipamento::query()
            ->with('tipo')
            ->whereHas('manutencoes', function ($query) use ($inicio): void {
                $query->where('data_entrada', '>=', $inicio);
            }, '>=', $frequencyThreshold)
            ->withCount([
                'manutencoes as manutencoes_periodo' => fn($query) => $query->where('data_entrada', '>=', $inicio),
            ])
            ->get();

        foreach ($equipamentos as $equipamento) {
            $context = $this->equipcontrolNotifications->equipamentoContext($equipamento);
            $context['total_manutencoes'] = (int) $equipamento->manutencoes_periodo;
            $context['dedupe_key'] = "maintenance.frequency_high:{$equipamento->id}";
            $this->dispatchService->dispatch('maintenance.frequency_high', $context);
            $dispatched++;
        }

        foreach ($equipamentos as $equipamento) {
            $custo = Manutencao::query()
                ->where('equipamento_id', $equipamento->id)
                ->where('data_entrada', '>=', $inicio)
                ->get()
                ->sum(function (Manutencao $manutencao): float {
                    $dias = max(1, $manutencao->dias_em_manutencao);
                    $valorDiario = ((float) $manutencao->valor_mensal_snapshot) / 30;

                    return $dias * $valorDiario;
                });

            if ($custo < $costThreshold) {
                continue;
            }

            $context = $this->equipcontrolNotifications->equipamentoContext($equipamento);
            $context['custo_total'] = number_format($custo, 2, ',', '.');
            $context['dedupe_key'] = "maintenance.cost_high:{$equipamento->id}";
            $this->dispatchService->dispatch('maintenance.cost_high', $context);
            $dispatched++;
        }

        return $dispatched;
    }

    private function scanCritical(): int
    {
        $dispatched = 0;
        $idleDays = (int) config('equipcontrol.alerts.equipment_idle_days', 30);

        $criticosParados = Equipamento::query()
            ->with('tipo')
            ->where('is_critico', true)
            ->emEstoque()
            ->get()
            ->filter(fn(Equipamento $equipamento) => $equipamento->tempo_em_estoque >= $idleDays);

        foreach ($criticosParados as $equipamento) {
            $context = $this->equipcontrolNotifications->equipamentoContext($equipamento);
            $context['dedupe_key'] = "critical.idle:{$equipamento->id}";
            $this->dispatchService->dispatch('critical.idle', $context);
            $dispatched++;
        }

        $criticosVencidos = Emprestimo::query()
            ->with(['equipamento.tipo'])
            ->whereNull('data_devolucao')
            ->whereHas('equipamento', fn($query) => $query->where('is_critico', true))
            ->get()
            ->filter(fn(Emprestimo $emprestimo) => $emprestimo->is_vencido);

        foreach ($criticosVencidos as $emprestimo) {
            $context = $this->equipcontrolNotifications->emprestimoContext($emprestimo);
            $context['dedupe_key'] = "critical.overdue:{$emprestimo->id}";
            $this->dispatchService->dispatch('critical.overdue', $context);
            $dispatched++;
        }

        $criticosManutencao = Equipamento::query()
            ->with('tipo')
            ->where('is_critico', true)
            ->emManutencao()
            ->get();

        foreach ($criticosManutencao as $equipamento) {
            $context = $this->equipcontrolNotifications->equipamentoContext($equipamento);
            $context['dedupe_key'] = "critical.in_maintenance:{$equipamento->id}";
            $this->dispatchService->dispatch('critical.in_maintenance', $context);
            $dispatched++;
        }

        return $dispatched;
    }

    private function scanSites(): int
    {
        $dispatched = 0;
        $idleThreshold = (int) config('equipcontrol.alerts.site_idle_equipment_threshold', 2);
        $overdueThreshold = (int) config('equipcontrol.alerts.site_overdue_equipment_threshold', 3);
        $costThreshold = (float) config('equipcontrol.alerts.site_high_cost_threshold', 30000);
        $idleDays = (int) config('equipcontrol.alerts.equipment_idle_days', 30);

        $parados = Equipamento::query()
            ->with('obra')
            ->emEstoque()
            ->get()
            ->filter(fn(Equipamento $equipamento) => $equipamento->tempo_em_estoque >= $idleDays)
            ->groupBy('obra_id');

        foreach ($parados as $obraId => $grupo) {
            if ($grupo->count() < $idleThreshold || $obraId === null) {
                continue;
            }

            $this->dispatchService->dispatch('site.idle_equipment', [
                'dedupe_key' => "site.idle_equipment:{$obraId}",
                'obra_id' => $obraId,
                'obra_codigo' => $grupo->first()->obra?->codigo,
                'total_ociosos' => $grupo->count(),
                'valor_mensal' => number_format($grupo->sum(fn(Equipamento $equipamento) => (float) $equipamento->valor_mensal), 2, ',', '.'),
            ]);
            $dispatched++;
        }

        $vencidos = Emprestimo::query()
            ->with('obra')
            ->whereNull('data_devolucao')
            ->get()
            ->filter(fn(Emprestimo $emprestimo) => $emprestimo->is_vencido)
            ->groupBy('obra_id');

        foreach ($vencidos as $obraId => $grupo) {
            if ($grupo->count() < $overdueThreshold || $obraId === null) {
                continue;
            }

            $this->dispatchService->dispatch('site.overdue_equipment', [
                'dedupe_key' => "site.overdue_equipment:{$obraId}",
                'obra_id' => $obraId,
                'obra_codigo' => $grupo->first()->obra?->codigo,
                'total_vencidos' => $grupo->count(),
            ]);
            $dispatched++;
        }

        $custos = Emprestimo::query()
            ->with(['equipamento', 'obra'])
            ->whereNull('data_devolucao')
            ->get()
            ->groupBy('obra_id')
            ->map(fn($grupo) => $grupo->sum(fn(Emprestimo $emprestimo) => (float) $emprestimo->equipamento->valor_mensal));

        foreach ($custos as $obraId => $valor) {
            if ($valor < $costThreshold || $obraId === null) {
                continue;
            }

            $obra = Emprestimo::query()->with('obra')->where('obra_id', $obraId)->first()?->obra;

            $this->dispatchService->dispatch('site.high_cost', [
                'dedupe_key' => "site.high_cost:{$obraId}",
                'obra_id' => $obraId,
                'obra_codigo' => $obra?->codigo,
                'valor_mensal' => number_format($valor, 2, ',', '.'),
            ]);
            $dispatched++;
        }

        return $dispatched;
    }

    private function scanEmployees(): int
    {
        $dispatched = 0;
        $multiplier = (float) config('equipcontrol.alerts.employee_overload_multiplier', 1.5);
        $longPossessionDays = (int) config('equipcontrol.alerts.employee_long_possession_days', 90);

        $ativos = Emprestimo::query()
            ->with('renovacoes')
            ->whereNull('data_devolucao')
            ->get()
            ->groupBy(fn(Emprestimo $emprestimo) => $emprestimo->colaborador_nome . '|' . $emprestimo->colaborador_matricula)
            ->map(fn($grupo) => [
                'colaborador' => $grupo->first()->colaborador_nome,
                'matricula' => $grupo->first()->colaborador_matricula,
                'total' => $grupo->count(),
                'media_dias' => round($grupo->avg(fn(Emprestimo $emprestimo) => $emprestimo->dias_em_uso), 1),
            ]);

        if ($ativos->isEmpty()) {
            return 0;
        }

        $media = $ativos->avg('total') ?: 1;
        $limite = max(1, (int) ceil($media * $multiplier));

        foreach ($ativos as $item) {
            if ($item['total'] < $limite) {
                continue;
            }

            $this->dispatchService->dispatch('employee.equipment_overload', [
                'dedupe_key' => 'employee.equipment_overload:' . $item['matricula'],
                'colaborador' => $item['colaborador'],
                'colaborador_matricula' => $item['matricula'],
                'total_equipamentos' => $item['total'],
            ]);
            $dispatched++;
        }

        foreach ($ativos as $item) {
            if ($item['media_dias'] < $longPossessionDays) {
                continue;
            }

            $this->dispatchService->dispatch('employee.long_possession', [
                'dedupe_key' => 'employee.long_possession:' . $item['matricula'],
                'colaborador' => $item['colaborador'],
                'colaborador_matricula' => $item['matricula'],
                'media_dias' => $item['media_dias'],
            ]);
            $dispatched++;
        }

        return $dispatched;
    }

    private function scanInsights(): int
    {
        $dispatched = 0;
        $idleDays = (int) config('equipcontrol.alerts.equipment_idle_days', 30);

        $ociosos = Equipamento::query()
            ->with(['tipo', 'obra'])
            ->emEstoque()
            ->get()
            ->filter(fn(Equipamento $equipamento) => $equipamento->tempo_em_estoque >= $idleDays);

        if ($ociosos->isNotEmpty()) {
            $economia = $ociosos->sum(fn(Equipamento $equipamento) => (float) $equipamento->valor_mensal);

            $this->dispatchService->dispatch('insight.cost_reduction', [
                'dedupe_key' => 'insight.cost_reduction:' . now()->toDateString(),
                'economia_mensal' => number_format($economia, 2, ',', '.'),
                'total_equipamentos' => $ociosos->count(),
            ]);
            $dispatched++;

            $primeiro = $ociosos->first();
            if ($primeiro !== null) {
                $context = $this->equipcontrolNotifications->equipamentoContext($primeiro);
                $context['economia_mensal'] = number_format((float) $primeiro->valor_mensal, 2, ',', '.');
                $context['dedupe_key'] = "insight.return:{$primeiro->id}";
                $this->dispatchService->dispatch('insight.return', $context);
                $dispatched++;
            }
        }

        $porObra = $ociosos->groupBy('obra_id');
        if ($porObra->count() >= 2) {
            $origem = $porObra->sortByDesc(fn($grupo) => $grupo->count())->first()?->first();
            $destinoObraId = $porObra->keys()->first(fn($obraId) => $obraId !== $origem?->obra_id);

            if ($origem !== null && $destinoObraId !== null) {
                $context = $this->equipcontrolNotifications->equipamentoContext($origem);
                $context['obra_origem'] = $origem->obra?->codigo;
                $context['obra_destino'] = Equipamento::query()->with('obra')->where('obra_id', $destinoObraId)->first()?->obra?->codigo;
                $context['dedupe_key'] = "insight.reallocation:{$origem->id}";
                $this->dispatchService->dispatch('insight.reallocation', $context);
                $dispatched++;
            }
        }

        $problematico = Equipamento::query()
            ->with('tipo')
            ->withCount('manutencoes')
            ->whereDoesntHave('baixa')
            ->orderByDesc('manutencoes_count')
            ->first();

        if ($problematico !== null && $problematico->manutencoes_count >= 3) {
            $context = $this->equipcontrolNotifications->equipamentoContext($problematico);
            $context['total_manutencoes'] = $problematico->manutencoes_count;
            $context['dedupe_key'] = "insight.replacement:{$problematico->id}";
            $this->dispatchService->dispatch('insight.replacement', $context);
            $dispatched++;
        }

        if ($ociosos->count() >= 3) {
            $this->dispatchService->dispatch('insight.anomaly', [
                'dedupe_key' => 'insight.anomaly:' . now()->toDateString(),
                'descricao' => $ociosos->count() . ' equipamentos parados simultaneamente — padrão acima do esperado.',
            ]);
            $dispatched++;
        }

        return $dispatched;
    }

    private function scanDigests(): int
    {
        $dispatched = 0;
        $today = now()->toDateString();

        $vencidos = Emprestimo::query()->whereNull('data_devolucao')->get()->filter(fn(Emprestimo $e) => $e->is_vencido)->count();
        $proximos = Emprestimo::query()->whereNull('data_devolucao')->get()->filter(fn(Emprestimo $e) => $e->is_proximo_vencimento)->count();
        $manutencoes = Manutencao::query()->whereNull('data_saida')->count();
        $parados = Equipamento::query()->emEstoque()->get()->filter(
            fn(Equipamento $equipamento) => $equipamento->tempo_em_estoque >= (int) config('equipcontrol.alerts.equipment_idle_days', 30)
        )->count();
        $concluidas = Manutencao::query()->whereDate('data_saida', Carbon::today())->count();
        $economia = Equipamento::query()->emEstoque()->get()->filter(
            fn(Equipamento $equipamento) => $equipamento->tempo_em_estoque >= (int) config('equipcontrol.alerts.equipment_idle_days', 30)
        )->sum('valor_mensal');

        $this->dispatchService->dispatch('digest.daily', [
            'dedupe_key' => "digest.daily:{$today}",
            'vencidos' => $vencidos,
            'proximos' => $proximos,
            'manutencoes' => $manutencoes,
            'parados' => $parados,
        ]);
        $dispatched++;

        if (now()->isMonday()) {
            $this->dispatchService->dispatch('digest.weekly', [
                'dedupe_key' => 'digest.weekly:' . now()->startOfWeek()->toDateString(),
                'vencidos' => $vencidos,
                'manutencoes_concluidas' => $concluidas,
                'economia_mensal' => number_format((float) $economia, 2, ',', '.'),
            ]);
            $dispatched++;
        }

        return $dispatched;
    }
}
