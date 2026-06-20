import { describe, expect, it } from 'vitest';
import { resolveEquipcontrolNotificationActions } from '@/lib/notification-events/equipcontrol-actions';

describe('resolveEquipcontrolNotificationActions', () => {
  it('gera navegação para empréstimo vencido com patrimônio', () => {
    const actions = resolveEquipcontrolNotificationActions('loan.overdue', {
      patrimonio: 'EQ-001',
    });

    expect(actions[0]).toMatchObject({
      id: 'view-loan',
      type: 'navigate',
      payload: { path: '/equipamentos/movimentacoes?q=EQ-001&filtro=vencidos' },
      primary: true,
    });
    expect(actions[1]).toMatchObject({
      id: 'view-equipment',
      payload: { path: '/equipamentos/estoque?q=EQ-001' },
    });
  });

  it('gera navegação direta por equipamento quando emprestimo_id está presente', () => {
    const actions = resolveEquipcontrolNotificationActions('loan.due_soon', {
      emprestimo_id: '42',
      equipamento_id: '7',
      patrimonio: 'EQ-001',
    });

    expect(actions[0].payload.path).toBe('/equipamentos/movimentacoes?id=7&filtro=proximos_vencimento');
  });

  it('gera navegação para manutenção atrasada com patrimônio', () => {
    const actions = resolveEquipcontrolNotificationActions('maintenance.overdue', {
      patrimonio: 'GER-10',
    });

    expect(actions[0]).toMatchObject({
      id: 'view-maintenance',
      payload: { path: '/equipamentos/manutencao?q=GER-10&filtro=atrasados' },
    });
  });

  it('prioriza equipamento_id para manutenção enviada', () => {
    const actions = resolveEquipcontrolNotificationActions('maintenance.sent', {
      equipamento_id: 1002,
      patrimonio: 'EQ-1002',
    });

    expect(actions[0]).toMatchObject({
      id: 'view-maintenance',
      payload: { path: '/equipamentos/manutencao?id=1002' },
    });
  });

  it('direciona manutenção concluída para o estoque', () => {
    const actions = resolveEquipcontrolNotificationActions('maintenance.completed', {
      equipamento_id: 3,
      patrimonio: 'EQ-1002',
    });

    expect(actions[0]).toMatchObject({
      id: 'view-equipment',
      label: 'Ver equipamento',
      payload: { path: '/equipamentos/estoque?id=3' },
    });
  });

  it('direciona devolução registrada para o estoque', () => {
    const actions = resolveEquipcontrolNotificationActions('loan.returned', {
      equipamento_id: 12,
      emprestimo_id: 45,
      patrimonio: 'EQ-2001',
    });

    expect(actions[0]).toMatchObject({
      id: 'view-equipment',
      label: 'Ver equipamento',
      payload: { path: '/equipamentos/estoque?id=12' },
    });
  });

  it('prioriza equipamento_id em empréstimo vencido', () => {
    const actions = resolveEquipcontrolNotificationActions('loan.overdue', {
      equipamento_id: '55',
      patrimonio: 'EQ-001',
    });

    expect(actions[0].payload.path).toBe('/equipamentos/movimentacoes?id=55&filtro=vencidos');
  });

  it('gera navegação de renovação com equipamento_id', () => {
    const actions = resolveEquipcontrolNotificationActions('loan.renewed', {
      emprestimo_id: 15,
      equipamento_id: 3,
      renovacao_id: 8,
      patrimonio: 'EQ-1002',
    });

    expect(actions[0]).toMatchObject({
      id: 'view-loan',
      payload: { path: '/equipamentos/movimentacoes?id=3' },
    });
  });

  it('cai no dashboard quando não há contexto suficiente', () => {
    const actions = resolveEquipcontrolNotificationActions('digest.daily', {});

    expect(actions[0]).toMatchObject({
      id: 'view-dashboard',
      payload: { path: '/equipamentos/dashboard' },
    });
  });
});
