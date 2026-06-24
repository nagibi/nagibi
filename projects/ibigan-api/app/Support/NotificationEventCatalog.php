<?php

declare(strict_types=1);

namespace App\Support;

final class NotificationEventCatalog
{
    /**
     * @param  array<string, mixed>  $context
     * @return array{subject: string, body: string, severity: string, summary?: string}|null
     */
    public static function content(string $eventSlug, array $context): ?array
    {
        return match ($eventSlug) {
            'campaign.sent' => self::campaignSent($context),
            'invite.accepted' => self::inviteAccepted($context),
            'loan.due_soon' => self::loanDueSoon($context),
            'loan.overdue' => self::loanOverdue($context),
            'loan.renewed' => self::loanRenewed($context),
            'loan.renewal_limit_exceeded' => self::loanRenewalLimitExceeded($context),
            'loan.created' => self::loanCreated($context),
            'loan.returned' => self::loanReturned($context),
            'equipment.idle' => self::equipmentIdle($context),
            'equipment.unused_since_registration' => self::equipmentUnusedSinceRegistration($context),
            'equipment.below_minimum_stock' => self::equipmentBelowMinimumStock($context),
            'maintenance.sent' => self::maintenanceSent($context),
            'maintenance.completed' => self::maintenanceCompleted($context),
            'maintenance.overdue' => self::maintenanceOverdue($context),
            'maintenance.frequency_high' => self::maintenanceFrequencyHigh($context),
            'maintenance.cost_high' => self::maintenanceCostHigh($context),
            'critical.idle' => self::criticalIdle($context),
            'critical.overdue' => self::criticalOverdue($context),
            'critical.in_maintenance' => self::criticalInMaintenance($context),
            'site.idle_equipment' => self::siteIdleEquipment($context),
            'site.overdue_equipment' => self::siteOverdueEquipment($context),
            'site.high_cost' => self::siteHighCost($context),
            'employee.equipment_overload' => self::employeeEquipmentOverload($context),
            'employee.long_possession' => self::employeeLongPossession($context),
            'insight.return' => self::insightReturn($context),
            'insight.reallocation' => self::insightReallocation($context),
            'insight.replacement' => self::insightReplacement($context),
            'insight.cost_reduction' => self::insightCostReduction($context),
            'insight.anomaly' => self::insightAnomaly($context),
            'digest.daily' => self::digestDaily($context),
            'digest.weekly' => self::digestWeekly($context),
            default => null,
        };
    }

    /**
     * @return list<string>
     */
    public static function implementedSlugs(): array
    {
        return [
            'campaign.sent',
            'invite.accepted',
            'loan.due_soon',
            'loan.overdue',
            'loan.renewed',
            'loan.renewal_limit_exceeded',
            'loan.created',
            'loan.returned',
            'equipment.idle',
            'equipment.unused_since_registration',
            'equipment.below_minimum_stock',
            'maintenance.sent',
            'maintenance.completed',
            'maintenance.overdue',
            'maintenance.frequency_high',
            'maintenance.cost_high',
            'critical.idle',
            'critical.overdue',
            'critical.in_maintenance',
            'site.idle_equipment',
            'site.overdue_equipment',
            'site.high_cost',
            'employee.equipment_overload',
            'employee.long_possession',
            'insight.return',
            'insight.reallocation',
            'insight.replacement',
            'insight.cost_reduction',
            'insight.anomaly',
            'digest.daily',
            'digest.weekly',
        ];
    }

    /** @param array<string, mixed> $context */
    private static function campaignSent(array $context): array
    {
        $campaign = (string) ($context['campaign_name'] ?? 'Campanha');

        return self::build('Campanha enviada', 'info', $campaign . ' foi enviada com sucesso.', [
            'A campanha <strong>' . $campaign . '</strong> foi enviada.',
            'Destinatários: ' . (string) ($context['recipients_count'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function inviteAccepted(array $context): array
    {
        $name = (string) ($context['user_name'] ?? 'Usuário');

        return self::build('Convite aceito', 'info', $name . ' aceitou o convite.', [
            '<strong>' . $name . '</strong> aceitou o convite e entrou na organização.',
            'Perfil: ' . (string) ($context['role'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function loanDueSoon(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Próximo do vencimento', 'warning', "{$label} vence em breve", [
            "O empréstimo de <strong>{$label}</strong> vence em " . (string) ($context['dias_ate_vencimento'] ?? '—') . ' dias.',
            'Colaborador: ' . (string) ($context['colaborador'] ?? '—'),
            'Obra: ' . (string) ($context['obra_codigo'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function loanOverdue(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Empréstimo vencido', 'critical', "{$label} está vencido", [
            "O empréstimo de <strong>{$label}</strong> está vencido há " . (string) ($context['dias_vencido'] ?? '—') . ' dias.',
            'Colaborador: ' . (string) ($context['colaborador'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function loanRenewed(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Renovação realizada', 'info', "{$label} foi renovado", [
            "O empréstimo de <strong>{$label}</strong> foi renovado.",
            'Prazo adicional: ' . (string) ($context['prazo_adicional_dias'] ?? '—') . ' dias',
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function loanRenewalLimitExceeded(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Excesso de renovações', 'warning', "{$label} ultrapassou renovações recomendadas", [
            "O empréstimo de <strong>{$label}</strong> atingiu " . (string) ($context['total_renovacoes'] ?? '—') . ' renovações.',
            'Avalie devolução ou substituição do equipamento.',
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function loanCreated(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Novo empréstimo', 'info', "{$label} emprestado", [
            "O equipamento <strong>{$label}</strong> foi emprestado.",
            'Colaborador: ' . (string) ($context['colaborador'] ?? '—'),
            'Obra: ' . (string) ($context['obra_codigo'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function loanReturned(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Devolução registrada', 'info', "{$label} devolvido", [
            "O equipamento <strong>{$label}</strong> foi devolvido.",
            'Dias em uso: ' . (string) ($context['dias_em_uso'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function equipmentIdle(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Equipamento parado', 'warning', "{$label} sem uso prolongado", [
            "O equipamento <strong>{$label}</strong> está parado há " . (string) ($context['dias_parado'] ?? '—') . ' dias.',
            'Custo mensal: R$ ' . (string) ($context['valor_mensal'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function equipmentUnusedSinceRegistration(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Cadastrado sem utilização', 'warning', "{$label} sem movimentação", [
            "O equipamento <strong>{$label}</strong> foi cadastrado há " . (string) ($context['dias_cadastrado'] ?? '—') . ' dias sem movimentação.',
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function equipmentBelowMinimumStock(array $context): array
    {
        $tipo = (string) ($context['tipo_nome'] ?? 'Tipo');

        return self::build('Estoque abaixo do mínimo', 'warning', "{$tipo} com estoque baixo", [
            "O tipo <strong>{$tipo}</strong> possui " . (string) ($context['disponiveis'] ?? '—') . ' disponíveis.',
            'Mínimo configurado: ' . (string) ($context['minimo'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function maintenanceSent(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Enviado para manutenção', 'info', "{$label} enviado para manutenção", [
            "O equipamento <strong>{$label}</strong> foi encaminhado para manutenção.",
            'Motivo: ' . (string) ($context['motivo'] ?? '—'),
            'Responsável: ' . (string) ($context['responsavel'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function maintenanceCompleted(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Manutenção concluída', 'info', "{$label} liberado da manutenção", [
            "O equipamento <strong>{$label}</strong> foi liberado e está pronto para utilização.",
            'Dias em manutenção: ' . (string) ($context['dias_em_manutencao'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function maintenanceOverdue(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Manutenção atrasada', 'critical', "{$label} em manutenção além do prazo", [
            "O equipamento <strong>{$label}</strong> está em manutenção há " . (string) ($context['dias_em_manutencao'] ?? '—') . ' dias.',
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function maintenanceFrequencyHigh(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Excesso de manutenções', 'warning', "{$label} com alta frequência de manutenção", [
            "O equipamento <strong>{$label}</strong> registrou " . (string) ($context['total_manutencoes'] ?? '—') . ' manutenções no período.',
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function maintenanceCostHigh(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Custo elevado de manutenção', 'warning', "{$label} com custo elevado", [
            "O equipamento <strong>{$label}</strong> acumulou custo estimado de R$ " . (string) ($context['custo_total'] ?? '—') . ' no período.',
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function criticalIdle(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Crítico parado', 'critical', "{$label} crítico sem uso", [
            "O equipamento crítico <strong>{$label}</strong> está parado há " . (string) ($context['dias_parado'] ?? '—') . ' dias.',
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function criticalOverdue(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Crítico vencido', 'critical', "{$label} crítico vencido", [
            "O equipamento crítico <strong>{$label}</strong> possui empréstimo vencido.",
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function criticalInMaintenance(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Crítico em manutenção', 'critical', "{$label} crítico indisponível", [
            "O equipamento crítico <strong>{$label}</strong> está em manutenção.",
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function siteIdleEquipment(array $context): array
    {
        $obra = (string) ($context['obra_codigo'] ?? 'Obra');

        return self::build('Equipamentos ociosos na obra', 'warning', "{$obra} com equipamentos ociosos", [
            "A obra <strong>{$obra}</strong> possui " . (string) ($context['total_ociosos'] ?? '—') . ' equipamentos parados.',
            'Custo mensal: R$ ' . (string) ($context['valor_mensal'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function siteOverdueEquipment(array $context): array
    {
        $obra = (string) ($context['obra_codigo'] ?? 'Obra');

        return self::build('Muitos vencimentos na obra', 'critical', "{$obra} com empréstimos vencidos", [
            "A obra <strong>{$obra}</strong> possui " . (string) ($context['total_vencidos'] ?? '—') . ' equipamentos vencidos.',
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function siteHighCost(array $context): array
    {
        $obra = (string) ($context['obra_codigo'] ?? 'Obra');

        return self::build('Custo elevado na obra', 'warning', "{$obra} com custo elevado", [
            "A obra <strong>{$obra}</strong> possui custo mensal de R$ " . (string) ($context['valor_mensal'] ?? '—') . '.',
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function employeeEquipmentOverload(array $context): array
    {
        $colaborador = (string) ($context['colaborador'] ?? 'Colaborador');

        return self::build('Excesso de equipamentos', 'warning', "{$colaborador} com muitos equipamentos", [
            "<strong>{$colaborador}</strong> possui " . (string) ($context['total_equipamentos'] ?? '—') . ' equipamentos ativos.',
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function employeeLongPossession(array $context): array
    {
        $colaborador = (string) ($context['colaborador'] ?? 'Colaborador');

        return self::build('Maior tempo médio de posse', 'info', "{$colaborador} com posse prolongada", [
            "<strong>{$colaborador}</strong> possui média de posse de " . (string) ($context['media_dias'] ?? '—') . ' dias.',
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function insightReturn(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Devolução sugerida', 'info', "Sugestão de devolução: {$label}", [
            'Recomenda-se devolver <strong>' . $label . '</strong> para reduzir custo de ociosidade.',
            'Economia estimada: R$ ' . (string) ($context['economia_mensal'] ?? '—') . '/mês',
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function insightReallocation(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Realocação sugerida', 'info', "Sugestão de realocação: {$label}", [
            "O equipamento <strong>{$label}</strong> está ocioso e pode ser realocado.",
            'Obra origem: ' . (string) ($context['obra_origem'] ?? '—'),
            'Obra destino: ' . (string) ($context['obra_destino'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function insightReplacement(array $context): array
    {
        $label = self::equipamentoLabel($context);

        return self::build('Substituição sugerida', 'warning', "Sugestão de substituição: {$label}", [
            "O equipamento <strong>{$label}</strong> possui histórico que indica substituição.",
            'Manutenções no período: ' . (string) ($context['total_manutencoes'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function insightCostReduction(array $context): array
    {
        return self::build('Redução de custo', 'info', 'Oportunidade de economia identificada', [
            'Foram identificadas oportunidades de redução de custo no parque.',
            'Economia potencial: R$ ' . (string) ($context['economia_mensal'] ?? '—') . '/mês',
            'Equipamentos envolvidos: ' . (string) ($context['total_equipamentos'] ?? '—'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function insightAnomaly(array $context): array
    {
        return self::build('Comportamento atípico', 'warning', 'Padrão atípico detectado', [
            (string) ($context['descricao'] ?? 'Foi detectado um padrão de uso ou custo fora do esperado.'),
        ]);
    }

    /** @param array<string, mixed> $context */
    private static function digestDaily(array $context): array
    {
        $lines = [
            'Vencidos: ' . (string) ($context['vencidos'] ?? '0'),
            'Próximos do vencimento: ' . (string) ($context['proximos'] ?? '0'),
            'Em manutenção: ' . (string) ($context['manutencoes'] ?? '0'),
            'Parados: ' . (string) ($context['parados'] ?? '0'),
        ];

        self::appendDigestList($lines, 'Empréstimos vencidos', $context['lista_vencidos'] ?? null);
        self::appendDigestList($lines, 'Empréstimos próximos do vencimento', $context['lista_proximos'] ?? null);
        self::appendDigestList($lines, 'Equipamentos em manutenção', $context['lista_manutencoes'] ?? null);
        self::appendDigestList($lines, 'Equipamentos parados', $context['lista_parados'] ?? null);

        $summary = sprintf(
            'Vencidos: %d, Próximos: %d, Em manutenção: %d, Parados: %d',
            (int) ($context['vencidos'] ?? 0),
            (int) ($context['proximos'] ?? 0),
            (int) ($context['manutencoes'] ?? 0),
            (int) ($context['parados'] ?? 0),
        );

        return self::build('Resumo diário Equipamento', 'info', $summary, $lines);
    }

    /** @param array<string, mixed> $context */
    private static function digestWeekly(array $context): array
    {
        $lines = [
            'Vencidos: ' . (string) ($context['vencidos'] ?? '0'),
            'Manutenções concluídas: ' . (string) ($context['manutencoes_concluidas'] ?? '0'),
            'Economia potencial: R$ ' . (string) ($context['economia_mensal'] ?? '0') . '/mês',
        ];

        self::appendDigestList($lines, 'Empréstimos vencidos', $context['lista_vencidos'] ?? null);
        self::appendDigestList($lines, 'Equipamentos parados', $context['lista_parados'] ?? null);

        $summary = sprintf(
            'Vencidos: %d, Manutenções concluídas: %d',
            (int) ($context['vencidos'] ?? 0),
            (int) ($context['manutencoes_concluidas'] ?? 0),
        );

        return self::build('Resumo semanal Equipamento', 'info', $summary, $lines);
    }

    /**
     * @param  list<string>  $lines
     * @param  list<string>|null  $items
     */
    private static function appendDigestList(array &$lines, string $title, ?array $items): void
    {
        if ($items === null || $items === []) {
            return;
        }

        $lines[] = '';
        $lines[] = '<strong>' . $title . ':</strong>';

        foreach ($items as $item) {
            $lines[] = '– ' . $item;
        }
    }

    /**
     * @param  list<string>  $lines
     * @return array{subject: string, body: string, body_text: string, severity: string, summary: string}
     */
    private static function build(string $subject, string $severity, string $summary, array $lines): array
    {
        $bodyText = implode("\n", array_map(
            static fn(string $line): string => html_entity_decode(
                strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $line)),
                ENT_QUOTES | ENT_HTML5,
                'UTF-8',
            ),
            $lines,
        ));

        return [
            'subject' => $subject,
            'body' => EmailLayout::render(
                title: $subject,
                contentHtml: EmailLayout::paragraph(implode('<br>', $lines)),
            ),
            'body_text' => $bodyText,
            'severity' => $severity,
            'summary' => $summary,
        ];
    }

    /** @param array<string, mixed> $context */
    private static function equipamentoLabel(array $context): string
    {
        $patrimonio = trim((string) ($context['patrimonio'] ?? ''));
        $nome = trim((string) ($context['equipamento_nome'] ?? ''));

        if ($nome !== '' && $patrimonio !== '') {
            return "{$nome} — {$patrimonio}";
        }

        if ($patrimonio !== '') {
            return $patrimonio;
        }

        return $nome !== '' ? $nome : 'Equipamento';
    }
}
