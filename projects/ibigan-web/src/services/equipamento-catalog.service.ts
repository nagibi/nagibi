import api from '@/lib/axios';
import type {
  CatalogListParams,
  CatalogPaginationMeta,
  Fornecedor,
  GrupoEquipamento,
  Obra,
  TipoEquipamentoCatalog,
} from '@/types/equipamento-catalog';

type ApiResult<T> = { status: number; result: T };

type PaginatedResult<T> = {
  data: T[];
  meta: CatalogPaginationMeta;
};

function buildListParams(page: number, perPage: number, search?: string, extra?: CatalogListParams) {
  const params: Record<string, string | number> = {
    page,
    per_page: perPage,
  };

  const trimmed = search?.trim();
  if (trimmed) params.search = trimmed;
  if (extra?.grupo_id) params.grupo_id = extra.grupo_id;

  if (extra?.sort) {
    params.sort = extra.sort;
    params.direction = extra.direction ?? 'asc';
  }

  for (const [key, value] of Object.entries(extra?.columnFilters ?? {})) {
    if (value.trim()) {
      params[`filter_${key}`] = value.trim();
    }
  }

  return params;
}

export const gruposCatalogService = {
  list: (page = 1, perPage = 15, search?: string, extra?: Omit<CatalogListParams, 'page' | 'per_page' | 'search'>) =>
    api.get<ApiResult<PaginatedResult<GrupoEquipamento>>>('/v1/grupos', {
      params: buildListParams(page, perPage, search, extra),
    }),

  show: (id: number) => api.get<ApiResult<GrupoEquipamento>>(`/v1/grupos/${id}`),

  store: (payload: Pick<GrupoEquipamento, 'nome'>) =>
    api.post<ApiResult<GrupoEquipamento>>('/v1/grupos', payload),

  update: (id: number, payload: Partial<Pick<GrupoEquipamento, 'nome'>>) =>
    api.put<ApiResult<GrupoEquipamento>>(`/v1/grupos/${id}`, payload),

  destroy: (id: number) => api.delete(`/v1/grupos/${id}`),
};

export const obrasCatalogService = {
  list: (page = 1, perPage = 15, search?: string, extra?: Omit<CatalogListParams, 'page' | 'per_page' | 'search'>) =>
    api.get<ApiResult<PaginatedResult<Obra>>>('/v1/obras', {
      params: buildListParams(page, perPage, search, extra),
    }),

  show: (id: number) => api.get<ApiResult<Obra>>(`/v1/obras/${id}`),

  store: (payload: Omit<Obra, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<ApiResult<Obra>>('/v1/obras', payload),

  update: (id: number, payload: Partial<Omit<Obra, 'id' | 'created_at' | 'updated_at'>>) =>
    api.put<ApiResult<Obra>>(`/v1/obras/${id}`, payload),

  destroy: (id: number) => api.delete(`/v1/obras/${id}`),
};

export const fornecedoresCatalogService = {
  list: (page = 1, perPage = 15, search?: string, extra?: Omit<CatalogListParams, 'page' | 'per_page' | 'search'>) =>
    api.get<ApiResult<PaginatedResult<Fornecedor>>>('/v1/fornecedores', {
      params: buildListParams(page, perPage, search, extra),
    }),

  show: (id: number) => api.get<ApiResult<Fornecedor>>(`/v1/fornecedores/${id}`),

  store: (payload: Omit<Fornecedor, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<ApiResult<Fornecedor>>('/v1/fornecedores', payload),

  update: (id: number, payload: Partial<Omit<Fornecedor, 'id' | 'created_at' | 'updated_at'>>) =>
    api.put<ApiResult<Fornecedor>>(`/v1/fornecedores/${id}`, payload),

  destroy: (id: number) => api.delete(`/v1/fornecedores/${id}`),
};

export const tiposCatalogService = {
  list: (
    page = 1,
    perPage = 15,
    search?: string,
    extra?: Omit<CatalogListParams, 'page' | 'per_page' | 'search'>,
  ) =>
    api.get<ApiResult<PaginatedResult<TipoEquipamentoCatalog>>>('/v1/tipos', {
      params: buildListParams(page, perPage, search, {
        ...extra,
        grupo_id: extra?.grupo_id,
      }),
    }),

  show: (id: number) => api.get<ApiResult<TipoEquipamentoCatalog>>(`/v1/tipos/${id}`),

  store: (payload: Pick<TipoEquipamentoCatalog, 'grupo_id' | 'nome'> & { is_ativo?: boolean }) =>
    api.post<ApiResult<TipoEquipamentoCatalog>>('/v1/tipos', payload),

  update: (
    id: number,
    payload: Partial<Pick<TipoEquipamentoCatalog, 'grupo_id' | 'nome' | 'is_ativo'>>,
  ) =>
    api.put<ApiResult<TipoEquipamentoCatalog>>(`/v1/tipos/${id}`, payload),

  destroy: (id: number) => api.delete(`/v1/tipos/${id}`),
};
