export type ViewMode = 'table' | 'list' | 'cards';

export const VIEW_MODES: ViewMode[] = ['table', 'list', 'cards'];

export const VIEW_PREFERENCE_KEYS = {
  users: 'users.view',
  roles: 'roles.view',
  permissions: 'permissions.view',
  organizations: 'organizations.view',
  menus: 'menus.view',
  reports: 'reports.view',
  campaigns: 'campaigns.view',
  messageTemplates: 'message-templates.view',
  invites: 'invites.view',
  webhooks: 'webhooks.view',
  translations: 'translations.view',
  myExecutions: 'reports.executions.view',
  userApprovals: 'user-approvals.view',
  activityLogs: 'activity-logs.view',
  notifications: 'notifications.view',
  centralUsers: 'central-users.view',
  platformMessageTemplates: 'platform-message-templates.view',
  platformReports: 'platform-reports.view',
  equipamentosEstoque: 'equipamentos.estoque.view',
  equipamentosManutencao: 'equipamentos.manutencao.view',
  equipamentosMovimentacoes: 'equipamentos.movimentacoes.view',
  equipamentosBaixados: 'equipamentos.baixados.view',
  equipamentosTipos: 'equipamentos.tipos.view',
  equipamentosFornecedores: 'equipamentos.fornecedores.view',
  equipamentosObras: 'equipamentos.obras.view',
} as const;

export type ViewPreferenceKey = (typeof VIEW_PREFERENCE_KEYS)[keyof typeof VIEW_PREFERENCE_KEYS];

export function isViewMode(value: string | null | undefined): value is ViewMode {
  return VIEW_MODES.includes(value as ViewMode);
}

export function defaultViewMode(isMobile: boolean): ViewMode {
  return isMobile ? 'cards' : 'table';
}
