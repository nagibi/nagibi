export interface CatalogPaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface GrupoEquipamento {
  id: number;
  nome: string;
  tipos_count?: number;
  tipos?: Array<{ id: number; nome: string }>;
  created_at?: string;
  updated_at?: string | null;
}

export interface Obra {
  id: number;
  codigo: string;
  nome?: string | null;
  endereco?: string | null;
  responsavel_user_id?: number | null;
  responsavel?: string | null;
  responsavel_user?: { id: number; name: string; email: string } | null;
  is_ativa: boolean;
  created_at?: string;
  updated_at?: string | null;
}

export interface Fornecedor {
  id: number;
  nome: string;
  cnpj?: string | null;
  telefone?: string | null;
  email?: string | null;
  contato_responsavel?: string | null;
  is_ativo: boolean;
  created_at?: string;
  updated_at?: string | null;
}

export interface TipoEquipamentoCatalog {
  id: number;
  grupo_id: number;
  nome: string;
  is_ativo: boolean;
  grupo?: { id: number; nome: string } | null;
  created_at?: string;
  updated_at?: string | null;
}

export interface CatalogListParams {
  page?: number;
  per_page?: number;
  search?: string;
  grupo_id?: number;
  sort?: string | null;
  direction?: 'asc' | 'desc';
  columnFilters?: Record<string, string>;
}
