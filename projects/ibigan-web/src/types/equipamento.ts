export type EquipamentoStatus =
  | 'em_estoque'
  | 'em_utilizacao'
  | 'em_manutencao'
  | 'baixado'
  | 'perdido';

export interface EquipamentoLookup {
  id: number;
  codigo?: string;
  nome: string;
}

export interface EquipamentoRenovacao {
  id: number;
  data_renovacao: string;
  prazo_adicional_dias: number;
  observacao?: string | null;
  autorizado_por?: { id: number; name: string } | null;
}

export interface EquipamentoEmprestimoAtivo {
  id: number;
  obra_id?: number;
  obra?: { id: number; codigo: string; nome: string } | null;
  colaborador_nome: string;
  colaborador_matricula: string;
  data_retirada: string;
  prazo_dias: number;
  renovacoes?: EquipamentoRenovacao[];
  dias_em_uso?: number;
  data_vencimento?: string;
  dias_ate_vencimento?: number;
  is_vencido?: boolean;
  is_proximo_vencimento?: boolean;
}

export interface EquipamentoManutencaoAtiva {
  id: number;
  motivo: string;
  responsabilidade: 'fortes' | 'equipamento';
  responsavel_user_id?: number | null;
  responsavel_manutencao?: string;
  responsavel_user?: { id: number; name: string; email?: string } | null;
  data_entrada: string;
  dias_em_manutencao?: number;
  desconto_medicao?: boolean;
  valor_mensal_snapshot?: number;
}

export interface EquipamentoAuditUser {
  id: number;
  name: string;
}

export interface EquipamentoFoto {
  id: number;
  path?: string | null;
  url?: string | null;
  ordem?: number;
  is_principal?: boolean;
}

export interface Equipamento {
  id: number;
  patrimonio: string;
  tipo_id: number;
  tipo?: {
    id: number;
    nome: string;
    grupo?: { id: number; nome: string } | null;
  } | null;
  fornecedor_id: number;
  fornecedor?: { id: number; nome: string } | null;
  obra_id: number;
  obra?: { id: number; codigo: string; nome: string } | null;
  valor_mensal: number;
  valor_diario?: number;
  foto_path?: string | null;
  foto_url?: string | null;
  fotos?: EquipamentoFoto[];
  is_critico: boolean;
  is_active?: boolean;
  data_entrada: string;
  status: EquipamentoStatus;
  status_label?: string;
  tempo_em_estoque?: number;
  emprestimo_ativo?: EquipamentoEmprestimoAtivo | null;
  manutencao_ativa?: EquipamentoManutencaoAtiva | null;
  baixa?: { id: number; tipo: string; data_baixa: string } | null;
  created_at?: string;
  updated_at?: string | null;
  created_by?: EquipamentoAuditUser | null;
  updated_by?: EquipamentoAuditUser | null;
}

export interface EquipamentoHistoricoItem {
  id: number;
  evento: string;
  dados: Record<string, unknown> | null;
  status_resultante: EquipamentoStatus;
  observacao?: string | null;
  registrado_por?: { id: number; name: string } | null;
  created_at: string;
}

export interface DashboardPotencialDevolucao {
  total: number;
  valor_mensal_total: number;
  sugestoes: Array<{
    id: number;
    patrimonio: string;
    tipo?: string | null;
    fornecedor?: string | null;
    dias_parado: number;
    valor_mensal: number;
    mensagem: string;
  }>;
}

export interface DashboardResumo {
  total: number;
  em_estoque: number;
  em_utilizacao: number;
  em_manutencao: number;
  baixados: number;
  perdidos: number;
  criticos?: number;
  parados_30_dias?: number;
  parados_30_dias_valor_mensal?: number;
}

export interface DashboardAlertaEmprestimoItem {
  emprestimo_id: number;
  equipamento_id?: number;
  patrimonio: string;
  tipo?: string | null;
  colaborador: string;
  obra?: string | null;
  data_vencimento?: string;
  data_retirada?: string;
  dias_vencido?: number;
  dias_restantes?: number;
}

export interface DashboardAlertaManutencaoItem {
  manutencao_id: number;
  equipamento_id: number;
  patrimonio: string;
  tipo?: string | null;
  motivo: string;
  dias_em_manutencao: number;
  data_entrada: string;
}

export interface DashboardAlertaParadoItem {
  id: number;
  patrimonio: string;
  tipo?: string | null;
  fornecedor?: string | null;
  dias_parado: number;
  valor_mensal: number;
}

export interface DashboardAlertasResumoItem {
  id: 'parados' | 'vencidos' | 'manutencoes' | 'proximos_semana';
  total: number;
  label: string;
}

export interface DashboardAlertas {
  total?: number;
  resumo?: DashboardAlertasResumoItem[];
  vencidos: { total: number; itens: DashboardAlertaEmprestimoItem[] };
  proximos_vencimento: { total: number; itens: DashboardAlertaEmprestimoItem[] };
  proximos_semana?: { total: number; itens: DashboardAlertaEmprestimoItem[] };
  manutencoes_atrasadas?: { total: number; itens: DashboardAlertaManutencaoItem[] };
  equipamentos_parados?: {
    total: number;
    valor_mensal_total: number;
    itens: DashboardAlertaParadoItem[];
  };
}

export interface DashboardRankings {
  mais_utilizados: { patrimonio: string; tipo: string; total_dias: number }[];
  mais_manutencao: { patrimonio: string; tipo: string; total_manutencoes: number }[];
}

export interface DashboardObraRankingItem {
  obra_id: number;
  codigo?: string | null;
  nome?: string | null;
  total: number;
  valor_mensal: number;
}

export interface DashboardColaboradorRankingItem {
  colaborador_nome: string;
  colaborador_matricula: string;
  total_emprestimos_ativos?: number;
  total_renovacoes?: number;
  media_dias_em_uso?: number;
}

export interface DashboardRecomendacao {
  id: string;
  icone: 'trending-down' | 'wrench' | 'chart';
  titulo: string;
  descricao: string;
  economia_mensal?: number;
  patrimonio?: string;
}

export interface DashboardFinanceiro {
  custo_mensal_total: number;
  equipamentos_ociosos: {
    total: number;
    valor_mensal: number;
  };
  economia_potencial_mensal: number;
  equipamentos_mais_caros: Array<{
    patrimonio: string;
    tipo?: string | null;
    valor_mensal: number;
  }>;
  obras: {
    maior_consumo: DashboardObraRankingItem[];
    mais_parados: DashboardObraRankingItem[];
    mais_vencidos: DashboardObraRankingItem[];
  };
  colaboradores: {
    media_emprestimos_ativos: number;
    mais_tempo: DashboardColaboradorRankingItem[];
    mais_renovacoes: DashboardColaboradorRankingItem[];
    excesso_equipamentos: DashboardColaboradorRankingItem[];
  };
  recomendacoes: DashboardRecomendacao[];
}

export interface DashboardGraficoMes {
  mes: string;
  mes_key: string;
}

export interface DashboardEvolucaoUtilizacaoItem extends DashboardGraficoMes {
  percentual: number;
}

export interface DashboardEvolucaoOciosidadeItem extends DashboardGraficoMes {
  valor_mensal: number;
}

export interface DashboardCustosMensaisItem extends DashboardGraficoMes {
  total: number;
  em_uso: number;
  ocioso: number;
  manutencao: number;
  estoque: number;
}

export interface DashboardStatusDistribuicaoItem {
  status: EquipamentoStatus;
  label: string;
  total: number;
}

export interface DashboardEmprestimoSituacaoItem {
  id: 'normais' | 'proximos' | 'vencidos';
  label: string;
  total: number;
}

export interface DashboardCustoGrupoItem {
  grupo: string;
  valor_mensal: number;
  total: number;
}

export interface DashboardManutencaoGraficos {
  evolucao_custos: Array<DashboardGraficoMes & { valor_mensal: number }>;
  tempo_medio_dias: number;
  equipamentos_parados: number;
  custo_mensal: number;
}

export interface DashboardGraficos {
  evolucao_utilizacao: DashboardEvolucaoUtilizacaoItem[];
  evolucao_ociosidade: DashboardEvolucaoOciosidadeItem[];
  custos_mensais: DashboardCustosMensaisItem[];
  equipamentos_por_status: DashboardStatusDistribuicaoItem[];
  emprestimos_situacao: DashboardEmprestimoSituacaoItem[];
  custos_por_obra: DashboardObraRankingItem[];
  custos_por_grupo: DashboardCustoGrupoItem[];
  manutencao: DashboardManutencaoGraficos;
  colaboradores_heatmap: DashboardColaboradorRankingItem[];
  recomendacoes: DashboardRecomendacao[];
}

export interface LaravelPaginated<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
