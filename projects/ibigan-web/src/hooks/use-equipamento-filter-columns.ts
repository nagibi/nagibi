import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGridColumnLabels } from '@/hooks/use-grid-column-labels';
import type { GridColumnDef } from '@/hooks/use-grid-columns';
import { equipamentosService } from '@/services/equipamentos.service';
import type { Equipamento } from '@/types/equipamento';
import { getModeSpecificColumns } from '@/pages/equipamentos/equipamentos-mode-grid-config';
import type { EquipamentoGridMode } from '@/pages/equipamentos/equipamentos-mode-grid-config';
import type { EquipamentoListMode } from '@/pages/equipamentos/equipamentos-list-page';

function toSelectOptions(items: Array<{ id: number; nome: string; codigo?: string }>) {
  return items.map((item) => ({
    label: item.codigo ? `${item.codigo} · ${item.nome}` : item.nome,
    value: String(item.id),
  }));
}

export type EquipamentoFilterMode = EquipamentoListMode | EquipamentoGridMode;

export function useEquipamentoFilterColumns(mode: EquipamentoFilterMode) {
  const cols = useGridColumnLabels();

  const { data: obras = [] } = useQuery({
    queryKey: ['equipamentos-lookups', 'obras'],
    queryFn: () => equipamentosService.lookupObras(),
    staleTime: 60_000,
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['equipamentos-lookups', 'fornecedores'],
    queryFn: () => equipamentosService.lookupFornecedores(),
    staleTime: 60_000,
  });

  const { data: tipos = [] } = useQuery({
    queryKey: ['equipamentos-lookups', 'tipos'],
    queryFn: () => equipamentosService.lookupTipos(),
    staleTime: 60_000,
  });

  const { data: grupos = [] } = useQuery({
    queryKey: ['equipamentos-lookups', 'grupos'],
    queryFn: () => equipamentosService.lookupGrupos(),
    staleTime: 60_000,
  });

  const obraOptions = useMemo(() => toSelectOptions(obras), [obras]);
  const fornecedorOptions = useMemo(() => toSelectOptions(fornecedores), [fornecedores]);
  const tipoOptions = useMemo(() => toSelectOptions(tipos), [tipos]);
  const grupoOptions = useMemo(() => toSelectOptions(grupos), [grupos]);

  const columns = useMemo<GridColumnDef<Equipamento>[]>(
    () => [
      {
        id: 'id',
        label: cols.id,
        filter: {
          type: 'text',
          filterKey: 'id',
          placeholder: cols.id,
          inputMode: 'numeric',
        },
      },
      {
        id: 'patrimonio',
        label: 'Patrimônio',
        filter: {
          type: 'text',
          filterKey: 'patrimonio',
          placeholder: 'Patrimônio',
        },
      },
      {
        id: 'tipo',
        label: 'Equipamento',
        filter: {
          type: 'select',
          filterKey: 'tipo_id',
          placeholder: 'Todos',
          options: tipoOptions,
        },
      },
      {
        id: 'grupo',
        label: 'Categoria',
        filter: {
          type: 'select',
          filterKey: 'grupo_id',
          placeholder: 'Todas',
          options: grupoOptions,
        },
      },
      ...getModeSpecificColumns({
        mode,
        cols,
        fornecedorOptions,
        grupoOptions,
        obraOptions,
        tipoOptions,
        rowStatusId: null,
        onRowStatusChange: () => undefined,
        formatAuditDate: () => '—',
        getAuditUserName: () => '—',
      }),
      {
        id: 'data_entrada',
        label: cols.registrationDate,
        filter: { type: 'dateRange', filterKey: 'data_entrada' },
      },
      {
        id: 'created_at',
        label: cols.createdAt,
        filter: { type: 'dateRange', filterKey: 'created_at' },
      },
      {
        id: 'created_by',
        label: cols.createdBy,
        filter: { type: 'text', filterKey: 'created_by', placeholder: 'Usuário' },
      },
      {
        id: 'updated_at',
        label: cols.updatedAt,
        filter: { type: 'dateRange', filterKey: 'updated_at' },
      },
      {
        id: 'updated_by',
        label: cols.updatedBy,
        filter: { type: 'text', filterKey: 'updated_by', placeholder: 'Usuário' },
      },
    ],
    [cols, fornecedorOptions, grupoOptions, mode, obraOptions, tipoOptions],
  );

  const filterableColumns = useMemo(
    () => columns.filter((column) => column.filter),
    [columns],
  );

  return {
    columns,
    filterableColumns,
  };
}
