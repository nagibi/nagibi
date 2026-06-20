<?php

declare(strict_types=1);

use App\Support\NotificationEventCatalog;
use App\Support\NotificationEventDefaults;

it('garante conteúdo de catálogo para todos os eventos com dispatcher catalog', function (): void {
    $dedicated = [
        'report.completed',
        'user.created',
    ];

    $catalogEvents = array_diff(
        array_keys(NotificationEventDefaults::EVENTS),
        $dedicated,
    );

    expect(NotificationEventCatalog::implementedSlugs())
        ->toHaveCount(count($catalogEvents));

    foreach ($catalogEvents as $eventSlug) {
        expect(NotificationEventCatalog::implementedSlugs())->toContain($eventSlug);
    }

    foreach (NotificationEventCatalog::implementedSlugs() as $eventSlug) {
        expect($catalogEvents)->toContain($eventSlug);
    }

    foreach ($catalogEvents as $eventSlug) {
        $content = NotificationEventCatalog::content($eventSlug, [
            'patrimonio' => 'P-001',
            'equipamento_nome' => 'MARTELETE',
            'colaborador' => 'João Silva',
            'obra_codigo' => '650',
            'motivo' => 'Teste',
            'responsavel' => 'Maria',
            'data_entrada' => '2026-06-17',
            'dias_em_manutencao' => 5,
            'dias_ate_vencimento' => 2,
            'dias_vencido' => 3,
            'dias_parado' => 30,
            'dias_cadastrado' => 20,
            'tipo_nome' => 'MARTELETE SDS',
            'disponiveis' => 1,
            'minimo' => 2,
            'total_manutencoes' => 7,
            'custo_total' => '4.500,00',
            'total_ociosos' => 3,
            'valor_mensal' => '2.680,00',
            'total_vencidos' => 4,
            'total_equipamentos' => 8,
            'media_dias' => 120,
            'economia_mensal' => '7.000,00',
            'obra_origem' => '650',
            'obra_destino' => '720',
            'descricao' => 'Padrão atípico detectado',
            'vencidos' => 2,
            'proximos' => 1,
            'manutencoes' => 3,
            'parados' => 4,
            'manutencoes_concluidas' => 1,
            'campaign_name' => 'Campanha teste',
            'recipients_count' => '10',
            'user_name' => 'Novo Usuário',
            'role' => 'manager',
            'prazo_adicional_dias' => 10,
            'total_renovacoes' => 5,
            'dias_em_uso' => 12,
        ]);

        expect($content)->not->toBeNull("Evento {$eventSlug} sem conteúdo")
            ->and($content)->toHaveKeys(['subject', 'body', 'body_text', 'severity'])
            ->and($content['subject'])->not->toBe('')
            ->and($content['body'])->not->toBe('')
            ->and($content['body_text'])->not->toBe('')
            ->and($content['body_text'])->not->toContain('&nbsp;');
    }
});
