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
    const path = withEquipamentoTarget('/equipamentos/estoque', {
      equipamentoId,
      patrimonio,
      filtro: eventSlug === 'equipment.idle' || eventSlug === 'critical.idle' ? 'parados' : undefined,
    });
    return [buildNavigate('view-equipment', 'Ver equipamento', path)];
  }

  if (eventSlug.startsWith('site.')) {
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
