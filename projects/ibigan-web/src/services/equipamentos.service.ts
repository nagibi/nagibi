import api from '@/lib/axios';
import type {
  DashboardAlertas,
  DashboardFinanceiro,
  DashboardGraficos,
  DashboardPotencialDevolucao,
  DashboardRankings,
  DashboardResumo,
  Equipamento,
  EquipamentoHistoricoItem,
  EquipamentoLookup,
  LaravelPaginated,
} from '@/types/equipamento';

type ApiResult<T> = { status: number; result: T };

type PaginatedResult<T> = {
  data: T[];
  meta: LaravelPaginated<T>['meta'];
};

export interface TipoLookup extends EquipamentoLookup {
  grupo_id: number;
  grupo?: { id: number; nome: string } | null;
}

export interface Emprestimo {
  id: number;
  equipamento_id: number;
  equipamento?: Equipamento | null;
  obra_id: number;
  obra?: { id: number; codigo: string; nome: string } | null;
  colaborador_nome: string;
  colaborador_matricula: string;
  encarregado_nome: string;
  data_retirada: string;
  data_devolucao?: string | null;
  prazo_dias: number;
  prazo_total_dias?: number;
  data_vencimento?: string;
  is_ativo: boolean;
  is_vencido?: boolean;
  dias_em_uso?: number;
}

export interface Manutencao {
  id: number;
  equipamento_id: number;
  equipamento?: { id: number; patrimonio: string } | null;
  responsabilidade: 'fortes' | 'equipamento';
  motivo: string;
  responsavel_user_id?: number;
  responsavel_manutencao?: string;
  data_entrada: string;
  data_saida?: string | null;
  ativa?: boolean;
  dias_em_manutencao?: number;
}

export interface Baixa {
  id: number;
  equipamento_id: number;
  equipamento?: { id: number; patrimonio: string } | null;
  tipo: 'devolucao' | 'perda';
  data_baixa: string;
  motivo?: string | null;
  responsavel_perda?: string | null;
  valor_reposicao?: number | null;
}

export interface EquipamentosListParams {
  id?: number;
  patrimonio?: string;
  status?: 'em_estoque' | 'em_utilizacao' | 'em_manutencao' | 'baixados' | 'perdidos' | 'baixados_todos';
  search?: string;
  obra_id?: number;
  fornecedor_id?: number;
  tipo_id?: number;
  grupo_id?: number;
  parado_dias?: number;
  parado_dias_min?: number;
  parado_dias_max?: number;
  valor_mensal_min?: number;
  valor_mensal_max?: number;
  situacao?: 'disponivel' | 'parado' | 'parado_30';
  is_critico?: boolean;
  is_active?: boolean;
  cadastrado_dias?: number;
  created_at_from?: string;
  created_at_to?: string;
  data_entrada_from?: string;
  data_entrada_to?: string;
  updated_at_from?: string;
  updated_at_to?: string;
  created_by?: string;
  updated_by?: string;
  emprestimo_alerta?: 'normais' | 'proximos' | 'vencidos';
  manutencao_filtro?: 'hoje' | 'atrasados' | 'criticos';
  colaborador?: string;
  encarregado?: string;
  data_retirada_from?: string;
  data_retirada_to?: string;
  dias_em_uso_min?: number;
  dias_em_uso_max?: number;
  motivo?: string;
  responsabilidade?: 'fortes' | 'equipamento';
  manutencao_data_entrada_from?: string;
  manutencao_data_entrada_to?: string;
  dias_em_manutencao_min?: number;
  dias_em_manutencao_max?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

function unwrapPaginated<T>(response: { data: LaravelPaginated<T> }): PaginatedResult<T> {
  return {
    data: response.data.data,
    meta: response.data.meta,
  };
}

function unwrapApiPaginated<T>(response: { data: ApiResult<PaginatedResult<T>> }): PaginatedResult<T> {
  return response.data.result;
}

export const equipamentosService = {
  list: async (params?: EquipamentosListParams) => {
    const response = await api.get<LaravelPaginated<Equipamento>>('/v1/equipamentos', { params });
    return unwrapPaginated(response);
  },

  globalSearch: async (search: string, perPage = 8) => {
    const response = await api.get<LaravelPaginated<Equipamento>>('/v1/equipamentos', {
      params: { search, per_page: perPage },
    });
    return unwrapPaginated(response);
  },

  show: async (id: number) => {
    const response = await api.get<{ data: Equipamento }>(`/v1/equipamentos/${id}`);
    return response.data.data;
  },

  store: async (payload: FormData | Record<string, unknown>) => {
    const response = await api.post<{ data: Equipamento }>('/v1/equipamentos', payload, {
      headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data.data;
  },

  update: async (id: number, payload: FormData | Record<string, unknown>) => {
    if (payload instanceof FormData) {
      const response = await api.post<{ data: Equipamento }>(
        `/v1/equipamentos/${id}/upload`,
        payload,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return response.data.data;
    }

    const response = await api.put<{ data: Equipamento }>(`/v1/equipamentos/${id}`, payload);
    return response.data.data;
  },

  destroy: (id: number) => api.delete(`/v1/equipamentos/${id}`),

  toggleActive: (id: number, isActive: boolean) =>
    api.patch<{ data: Equipamento }>(`/v1/equipamentos/${id}/toggle-active`, {
      is_active: isActive,
    }),

  historico: async (id: number, params?: { page?: number; per_page?: number; evento?: string }) => {
    const response = await api.get<ApiResult<PaginatedResult<EquipamentoHistoricoItem>>>(
      `/v1/equipamentos/${id}/historico`,
      { params },
    );
    return unwrapApiPaginated(response);
  },

  emprestar: async (id: number, payload: FormData | Record<string, unknown>) => {
    const response = await api.post<{ data: Emprestimo }>(
      `/v1/equipamentos/${id}/emprestar`,
      payload,
      {
        headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
      },
    );
    return response.data.data;
  },

  enviarManutencao: async (id: number, payload: Record<string, unknown>) => {
    const response = await api.post<ApiResult<Manutencao>>(
      `/v1/equipamentos/${id}/manutencao`,
      payload,
    );
    return response.data.result;
  },

  baixar: async (id: number, payload: Record<string, unknown>) => {
    const response = await api.post<ApiResult<Baixa>>(`/v1/equipamentos/${id}/baixar`, payload);
    return response.data.result;
  },

  listEmprestimos: async (params?: {
    search?: string;
    obra_id?: number;
    alerta?: 'vencidos' | 'proximos';
    page?: number;
    per_page?: number;
  }) => {
    const response = await api.get<LaravelPaginated<Emprestimo>>('/v1/emprestimos', { params });
    return unwrapPaginated(response);
  },

  devolverEmprestimo: async (id: number, payload?: FormData | Record<string, unknown>) => {
    const response = await api.post<{ data: Emprestimo }>(
      `/v1/emprestimos/${id}/devolver`,
      payload ?? {},
      {
        headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
      },
    );
    return response.data.data;
  },

  renovarEmprestimo: async (
    id: number,
    payload: { prazo_adicional_dias: number; data_renovacao?: string; observacao?: string },
  ) => api.post(`/v1/emprestimos/${id}/renovar`, payload),

  finalizarManutencao: async (id: number, payload?: { data_saida?: string }) => {
    const response = await api.post<ApiResult<Manutencao>>(
      `/v1/manutencoes/${id}/finalizar`,
      payload ?? {},
    );
    return response.data.result;
  },

  dashboardResumo: async () => {
    const response = await api.get<DashboardResumo>('/v1/dashboard/resumo');
    return response.data;
  },

  dashboardAlertas: async () => {
    const response = await api.get<DashboardAlertas>('/v1/dashboard/alertas');
    return response.data;
  },

  dashboardPotencialDevolucao: async () => {
    const response = await api.get<DashboardPotencialDevolucao>('/v1/dashboard/potencial-devolucao');
    return response.data;
  },

  dashboardRankings: async () => {
    const response = await api.get<DashboardRankings & { colaboradores?: unknown[] }>(
      '/v1/dashboard/rankings',
    );
    return response.data;
  },

  dashboardFinanceiro: async () => {
    const response = await api.get<DashboardFinanceiro>('/v1/dashboard/financeiro');
    return response.data;
  },

  dashboardGraficos: async () => {
    const response = await api.get<DashboardGraficos>('/v1/dashboard/graficos');
    return response.data;
  },

  lookupObras: async (search?: string) => {
    const response = await api.get<ApiResult<EquipamentoLookup[]>>('/v1/lookups/obras', {
      params: search ? { search } : undefined,
    });
    return response.data.result;
  },

  lookupFornecedores: async (search?: string) => {
    const response = await api.get<ApiResult<EquipamentoLookup[]>>('/v1/lookups/fornecedores', {
      params: search ? { search } : undefined,
    });
    return response.data.result;
  },

  lookupTipos: async (search?: string) => {
    const response = await api.get<ApiResult<TipoLookup[]>>('/v1/lookups/tipos', {
      params: search ? { search } : undefined,
    });
    return response.data.result;
  },

  lookupGrupos: async (search?: string) => {
    const response = await api.get<ApiResult<EquipamentoLookup[]>>('/v1/lookups/grupos', {
      params: search ? { search } : undefined,
    });
    return response.data.result;
  },
};
