import type { EquipamentoListMode } from '@/pages/equipamentos/equipamentos-list-page';
import type { EquipamentosListParams } from '@/services/equipamentos.service';

export type EstoqueFilter = 'todos' | 'criticos' | 'parados' | 'recem_cadastrados';
export type MovimentacaoFilter = 'todos' | 'normais' | 'proximos_vencimento' | 'vencidos';
export type ManutencaoFilter = 'todos' | 'hoje' | 'atrasados' | 'criticos';
export type BaixadosFilter = 'todos' | 'devolvidos' | 'perdidos';

export type EquipamentoContextFilter =
  | EstoqueFilter
  | MovimentacaoFilter
  | ManutencaoFilter
  | BaixadosFilter;

const ESTOQUE_FILTERS: EstoqueFilter[] = ['todos', 'criticos', 'parados', 'recem_cadastrados'];
const MOVIMENTACAO_FILTERS: MovimentacaoFilter[] = [
  'todos',
  'normais',
  'proximos_vencimento',
  'vencidos',
];
const MANUTENCAO_FILTERS: ManutencaoFilter[] = ['todos', 'hoje', 'atrasados', 'criticos'];
const BAIXADOS_FILTERS: BaixadosFilter[] = ['todos', 'devolvidos', 'perdidos'];

export const ESTOQUE_POTENCIAL_DEVOLUCAO_FILTER: EstoqueFilter = 'parados';

export const FILTER_LABELS: Record<EquipamentoContextFilter, string> = {
  todos: 'Todos',
  criticos: 'Críticos',
  parados: 'Parados',
  recem_cadastrados: 'Recém cadastrados',
  normais: 'Normais',
  proximos_vencimento: 'Próximos do vencimento',
  vencidos: 'Vencidos',
  hoje: 'Hoje',
  atrasados: 'Atrasados',
  devolvidos: 'Devolvidos',
  perdidos: 'Perdidos',
};

export function getFiltersForMode(mode: EquipamentoListMode): EquipamentoContextFilter[] {
  switch (mode) {
    case 'estoque':
      return ESTOQUE_FILTERS;
    case 'utilizacao':
      return MOVIMENTACAO_FILTERS;
    case 'manutencao':
      return MANUTENCAO_FILTERS;
    case 'baixados':
      return BAIXADOS_FILTERS;
    default:
      return [];
  }
}

export function resolveContextFilter(
  mode: EquipamentoListMode,
  filtroParam: string | null,
): EquipamentoContextFilter {
  const allowed = getFiltersForMode(mode);

  if (filtroParam && allowed.includes(filtroParam as EquipamentoContextFilter)) {
    return filtroParam as EquipamentoContextFilter;
  }

  return 'todos';
}

export function getDefaultContextFilter(mode: EquipamentoListMode): EquipamentoContextFilter {
  return 'todos';
}

export function applyContextFilterToParams(
  mode: EquipamentoListMode,
  filtro: EquipamentoContextFilter,
  params: EquipamentosListParams,
): EquipamentosListParams {
  if (mode === 'estoque') {
    if (filtro === 'parados') params.parado_dias = 30;
    if (filtro === 'criticos') params.is_critico = true;
    if (filtro === 'recem_cadastrados') params.cadastrado_dias = 30;
  }

  if (mode === 'utilizacao') {
    if (filtro === 'normais') params.emprestimo_alerta = 'normais';
    if (filtro === 'proximos_vencimento') params.emprestimo_alerta = 'proximos';
    if (filtro === 'vencidos') params.emprestimo_alerta = 'vencidos';
  }

  if (mode === 'manutencao') {
    if (filtro === 'hoje') params.manutencao_filtro = 'hoje';
    if (filtro === 'atrasados') params.manutencao_filtro = 'atrasados';
    if (filtro === 'criticos') params.manutencao_filtro = 'criticos';
  }

  if (mode === 'baixados') {
    if (filtro === 'perdidos') {
      params.status = 'perdidos';
    } else if (filtro === 'devolvidos') {
      params.status = 'baixados';
    } else {
      params.status = 'baixados_todos';
    }
  }

  return params;
}
