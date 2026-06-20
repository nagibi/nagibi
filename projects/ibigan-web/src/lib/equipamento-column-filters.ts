import { dateRangeFilterFromKey, dateRangeFilterToKey } from '@/hooks/use-grid-filters';
import type { EquipamentosListParams } from '@/services/equipamentos.service';

export function applyEquipamentoColumnFiltersToParams(
  params: EquipamentosListParams,
  filters: Record<string, string>,
): EquipamentosListParams {
  const next = { ...params };

  if (filters.id?.trim()) {
    const id = Number(filters.id.trim());
    if (!Number.isNaN(id)) next.id = id;
  }

  if (filters.patrimonio?.trim()) {
    next.patrimonio = filters.patrimonio.trim();
  }

  if (filters.tipo_id?.trim()) {
    next.tipo_id = Number(filters.tipo_id);
  }

  if (filters.grupo_id?.trim()) {
    next.grupo_id = Number(filters.grupo_id);
  }

  if (filters.obra_id?.trim()) {
    next.obra_id = Number(filters.obra_id);
  }

  if (filters.fornecedor_id?.trim()) {
    next.fornecedor_id = Number(filters.fornecedor_id);
  }

  if (filters.is_critico === 'true') {
    next.is_critico = true;
  } else if (filters.is_critico === 'false') {
    next.is_critico = false;
  }

  if (filters.is_active === 'true') {
    next.is_active = true;
  } else if (filters.is_active === 'false') {
    next.is_active = false;
  }

  const paradoFrom = filters[dateRangeFilterFromKey('parado_dias')]?.trim();
  const paradoTo = filters[dateRangeFilterToKey('parado_dias')]?.trim();

  if (paradoFrom) {
    const min = Number(paradoFrom);
    if (!Number.isNaN(min)) next.parado_dias_min = min;
  }

  if (paradoTo) {
    const max = Number(paradoTo);
    if (!Number.isNaN(max)) next.parado_dias_max = max;
  }

  const valorFrom = filters[dateRangeFilterFromKey('valor_mensal')]?.trim();
  const valorTo = filters[dateRangeFilterToKey('valor_mensal')]?.trim();

  if (valorFrom) {
    const min = Number(valorFrom);
    if (!Number.isNaN(min)) next.valor_mensal_min = min;
  }

  if (valorTo) {
    const max = Number(valorTo);
    if (!Number.isNaN(max)) next.valor_mensal_max = max;
  }

  if (filters.situacao?.trim()) {
    next.situacao = filters.situacao.trim() as EquipamentosListParams['situacao'];
  }

  if (filters.emprestimo_alerta?.trim()) {
    next.emprestimo_alerta = filters.emprestimo_alerta.trim() as EquipamentosListParams['emprestimo_alerta'];
  }

  if (filters.manutencao_filtro?.trim()) {
    next.manutencao_filtro = filters.manutencao_filtro.trim() as EquipamentosListParams['manutencao_filtro'];
  }

  if (filters.colaborador?.trim()) {
    next.colaborador = filters.colaborador.trim();
  }

  if (filters.encarregado?.trim()) {
    next.encarregado = filters.encarregado.trim();
  }

  const retiradaFrom = filters[dateRangeFilterFromKey('data_retirada')]?.trim();
  const retiradaTo = filters[dateRangeFilterToKey('data_retirada')]?.trim();
  if (retiradaFrom) next.data_retirada_from = retiradaFrom;
  if (retiradaTo) next.data_retirada_to = retiradaTo;

  const diasUsoFrom = filters[dateRangeFilterFromKey('dias_em_uso')]?.trim();
  const diasUsoTo = filters[dateRangeFilterToKey('dias_em_uso')]?.trim();
  if (diasUsoFrom) {
    const min = Number(diasUsoFrom);
    if (!Number.isNaN(min)) next.dias_em_uso_min = min;
  }
  if (diasUsoTo) {
    const max = Number(diasUsoTo);
    if (!Number.isNaN(max)) next.dias_em_uso_max = max;
  }

  if (filters.motivo?.trim()) {
    next.motivo = filters.motivo.trim();
  }

  if (filters.responsabilidade?.trim()) {
    next.responsabilidade = filters.responsabilidade.trim() as EquipamentosListParams['responsabilidade'];
  }

  const manutencaoEntradaFrom = filters[dateRangeFilterFromKey('manutencao_data_entrada')]?.trim();
  const manutencaoEntradaTo = filters[dateRangeFilterToKey('manutencao_data_entrada')]?.trim();
  if (manutencaoEntradaFrom) next.manutencao_data_entrada_from = manutencaoEntradaFrom;
  if (manutencaoEntradaTo) next.manutencao_data_entrada_to = manutencaoEntradaTo;

  const diasManutencaoFrom = filters[dateRangeFilterFromKey('dias_em_manutencao')]?.trim();
  const diasManutencaoTo = filters[dateRangeFilterToKey('dias_em_manutencao')]?.trim();
  if (diasManutencaoFrom) {
    const min = Number(diasManutencaoFrom);
    if (!Number.isNaN(min)) next.dias_em_manutencao_min = min;
  }
  if (diasManutencaoTo) {
    const max = Number(diasManutencaoTo);
    if (!Number.isNaN(max)) next.dias_em_manutencao_max = max;
  }

  const createdFrom = filters[dateRangeFilterFromKey('created_at')]?.trim();
  const createdTo = filters[dateRangeFilterToKey('created_at')]?.trim();
  if (createdFrom) next.created_at_from = createdFrom;
  if (createdTo) next.created_at_to = createdTo;

  const updatedFrom = filters[dateRangeFilterFromKey('updated_at')]?.trim();
  const updatedTo = filters[dateRangeFilterToKey('updated_at')]?.trim();
  if (updatedFrom) next.updated_at_from = updatedFrom;
  if (updatedTo) next.updated_at_to = updatedTo;

  if (filters.created_by?.trim()) {
    next.created_by = filters.created_by.trim();
  }

  if (filters.updated_by?.trim()) {
    next.updated_by = filters.updated_by.trim();
  }

  return next;
}
