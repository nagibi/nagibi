import type { NotificationAction } from '@/types/notification-events';

function readString(data: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value);
    }
  }
  return null;
}

function buildNavigate(
  id: string,
  label: string,
  path: string,
  primary = true,
): NotificationAction {
  return { id, label, type: 'navigate', payload: { path }, primary };
}

function readEquipamentoId(data: Record<string, unknown>): string | null {
  return readString(data, 'equipamento_id', 'equipment_id');
}

function readStatusAtual(data: Record<string, unknown>): string | null {
  return readString(data, 'status_atual');
}

function withEquipamentoTarget(
  basePath: string,
  options: { equipamentoId: string | null; patrimonio: string | null; filtro?: string },
): string {
  const params = new URLSearchParams();
  if (options.equipamentoId) {
    params.set('id', options.equipamentoId);
  } else if (options.patrimonio) {
    params.set('q', options.patrimonio);
  }
  if (options.filtro) params.set('filtro', options.filtro);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * Monta a URL de Estoque com o filtro de `situacao` real da tela
 * (lista separada por vírgula, ex: situacao=parado_30,parado).
 * Use esta função para qualquer link que precise cair no Estoque já
 * filtrado por situação — não confundir com `filtro=` (usado em outras
 * telas como Movimentações/Manutenção, que têm seu próprio parâmetro
 * e não foi validado contra a implementação real dessas telas).
 */
function withEstoqueSituacao(
  situacoes: string[],
  extra: { obraId?: string | null } = {},
): string {
  const params = new URLSearchParams();
  if (situacoes.length > 0) {
    params.set('situacao', situacoes.join(','));
  }
  if (extra.obraId) {
    params.set('obra_id', extra.obraId);
  }
  const query = params.toString();
  return query ? `/equipamentos/estoque?${query}` : '/equipamentos/estoque';
}

/**
 * Resolve a rota correta para um equipamento com base no seu status REAL
 * (vindo de `Equipamento::status` no backend), em vez de inferir pelo nome
 * do evento. Retorna null para status que não têm uma rota dedicada
 * (ex: baixado, perdido) ou quando o status não é reconhecido — nesses
 * casos o chamador deve usar o fallback por eventSlug.
 */
function pathForStatus(
  status: string,
  options: { equipamentoId: string | null; patrimonio: string | null },
): { path: string; label: string } | null {
  switch (status) {
    case 'em_manutencao':
      return {
        path: withEquipamentoTarget('/equipamentos/manutencao', options),
        label: 'Ver manutenção',
      };
    case 'em_utilizacao':
      return {
        path: withEquipamentoTarget('/equipamentos/movimentacoes', options),
        label: 'Ver movimentação',
      };
    case 'em_estoque':
      return {
        path: withEquipamentoTarget('/equipamentos/estoque', options),
        label: 'Ver equipamento',
      };
    default:
      // baixado, perdido, ou status desconhecido: sem rota dedicada confiável.
      return null;
  }
}

/**
 * Eventos cujo destino natural NÃO é o equipamento em si (obra, colaborador,
 * dashboard). Para esses, o status_atual do equipamento não deve sobrepor
 * a rota — o fallback por eventSlug abaixo é a fonte certa.
 */
function isNonEquipmentEvent(eventSlug: string): boolean {
  return (
    eventSlug.startsWith('site.')
    || eventSlug.startsWith('employee.')
    || eventSlug.startsWith('insight.')
    || eventSlug.startsWith('digest.')
  );
}

/**
 * Ações de navegação padrão para eventos EquipControl quando o backend
 * ainda não envia `data.actions` no payload da notificação.
 */
export function resolveEquipcontrolNotificationActions(
  eventSlug: string,
  data: Record<string, unknown>,
): NotificationAction[] {
  const patrimonio = readString(data, 'patrimonio', 'equipamento_patrimonio', 'codigo');
  const equipamentoId = readEquipamentoId(data);
  const obraId = readString(data, 'obra_id', 'obra');
  const statusAtual = readStatusAtual(data);

  // Prioridade 1: se o backend já informa o status real do equipamento,
  // confiamos nele em vez de adivinhar pelo nome do evento. Isso cobre
  // casos como critical.in_maintenance / critical.overdue, que hoje caem
  // erroneamente no bloco genérico de "estoque" por causa do prefixo do slug.
  if ((equipamentoId || patrimonio) && statusAtual && !isNonEquipmentEvent(eventSlug)) {
    const resolved = pathForStatus(statusAtual, { equipamentoId, patrimonio });
    if (resolved) {
      return [buildNavigate('view-equipment', resolved.label, resolved.path)];
    }
  }

  // A partir daqui: fallback por eventSlug, mantido para notificações
  // antigas já persistidas sem o campo status_atual no payload.

  if (eventSlug.startsWith('loan.')) {
    if (eventSlug === 'loan.returned') {
      const path = withEquipamentoTarget('/equipamentos/estoque', {
        equipamentoId,
        patrimonio,
      });
      return [buildNavigate('view-equipment', 'Ver equipamento', path)];
    }

    const path = withEquipamentoTarget('/equipamentos/movimentacoes', {
      equipamentoId,
      patrimonio,
      filtro:
        eventSlug === 'loan.overdue'
          ? 'vencidos'
          : eventSlug === 'loan.due_soon'
            ? 'proximos_vencimento'
            : undefined,
    });

    const actions = [buildNavigate('view-loan', 'Ver empréstimo', path)];

    if (patrimonio) {
      actions.push(
        buildNavigate(
          'view-equipment',
          'Ver equipamento',
          withEquipamentoTarget('/equipamentos/estoque', { equipamentoId, patrimonio }),
          false,
        ),
      );
    }

    return actions;
  }

  if (eventSlug.startsWith('maintenance.')) {
    if (eventSlug === 'maintenance.completed') {
      const path = withEquipamentoTarget('/equipamentos/estoque', {
        equipamentoId,
        patrimonio,
      });
      return [buildNavigate('view-equipment', 'Ver equipamento', path)];
    }

    const path = withEquipamentoTarget('/equipamentos/manutencao', {
      equipamentoId,
      patrimonio,
      filtro: eventSlug === 'maintenance.overdue' ? 'atrasados' : undefined,
    });
    return [buildNavigate('view-maintenance', 'Ver manutenção', path)];
  }

  if (
    eventSlug.startsWith('equipment.')
    || eventSlug.startsWith('critical.')
    || eventSlug === 'insight.return'
    || eventSlug === 'insight.reallocation'
    || eventSlug === 'insight.replacement'
  ) {
    // Este evento é sobre um TIPO de equipamento, não uma unidade — não há
    // equipamento_id/patrimonio no contexto. Filtra o Estoque por tipo_id.
    if (eventSlug === 'equipment.below_minimum_stock') {
      const tipoId = readString(data, 'tipo_id');
      const path = tipoId ? `/equipamentos/estoque?tipo_id=${tipoId}` : '/equipamentos/estoque';
      return [buildNavigate('view-equipment', 'Ver equipamentos do tipo', path)];
    }

    // equipment.idle/critical.idle referem-se a UM equipamento específico
    // (equipamentoId/patrimonio presentes no contexto). Não combinamos
    // com situacao= ainda — não confirmado se a tela de Estoque aceita
    // os dois parâmetros juntos. Priorizamos levar direto ao equipamento.
    const path = withEquipamentoTarget('/equipamentos/estoque', {
      equipamentoId,
      patrimonio,
    });
    return [buildNavigate('view-equipment', 'Ver equipamento', path)];
  }

  if (eventSlug.startsWith('site.')) {
    if (eventSlug === 'site.idle_equipment') {
      const path = withEstoqueSituacao(['parado_30', 'parado'], { obraId });
      return [buildNavigate('view-equipment', 'Ver equipamentos parados', path)];
    }

    if (eventSlug === 'site.overdue_equipment') {
      const params = new URLSearchParams({ filtro: 'vencidos' });
      if (obraId) params.set('obra_id', obraId);
      const path = `/equipamentos/movimentacoes?${params.toString()}`;
      return [buildNavigate('view-loan', 'Ver empréstimos vencidos', path)];
    }

    // site.high_cost e demais variantes futuras: sem filtro dedicado ainda,
    // a obra em si continua sendo o destino mais útil.
    const path = obraId ? `/equipamentos/obras/${obraId}` : '/equipamentos/dashboard';
    return [buildNavigate('view-site', obraId ? 'Ver obra' : 'Ver dashboard', path)];
  }

  if (eventSlug.startsWith('employee.')) {
    const userId = readString(data, 'user_id', 'colaborador_id');
    if (userId) {
      return [buildNavigate('view-user', 'Ver colaborador', `/users/${userId}`)];
    }
    return [buildNavigate('view-movements', 'Ver movimentações', '/equipamentos/movimentacoes')];
  }

  if (eventSlug.startsWith('insight.') || eventSlug.startsWith('digest.')) {
    return [buildNavigate('view-dashboard', 'Ver dashboard', '/equipamentos/dashboard')];
  }

  if (patrimonio) {
    return [
      buildNavigate(
        'view-equipment',
        'Ver equipamento',
        withEquipamentoTarget('/equipamentos/estoque', { equipamentoId, patrimonio }),
      ),
    ];
  }

  return [buildNavigate('view-dashboard', 'Abrir EquipControl', '/equipamentos/dashboard')];
}