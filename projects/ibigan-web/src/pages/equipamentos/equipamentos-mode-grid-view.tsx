import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import { useApiToolbarAlert } from '@/hooks/use-api-toolbar-alert';
import { useGridColumnLabels } from '@/hooks/use-grid-column-labels';
import { useGrid } from '@/hooks/use-grid';
import { useGridUrlSearchSync } from '@/hooks/use-grid-url-search-sync';
import { useGridEquipamentoIdFilterSync } from '@/hooks/use-grid-url-filters-sync';
import { useSyncGridUrl } from '@/hooks/use-sync-grid-url';
import { useGridKeyboard } from '@/hooks/use-grid-keyboard';
import { useGridColumns, type GridColumnDef } from '@/hooks/use-grid-columns';
import { useGridFilters } from '@/hooks/use-grid-filters';
import { useGridViewMode } from '@/hooks/use-grid-view-mode';
import { GridColumnDataView } from '@/components/grid/grid-column-data-view';
import { GridColumnsControl } from '@/components/grid/grid-columns-control';
import { GridPanel } from '@/components/grid/grid-panel';
import { GridPagination } from '@/components/grid/grid-pagination';
import { GridResetControl } from '@/components/grid/grid-reset-control';
import { GridRowActions } from '@/components/grid/grid-row-actions';
import { GridPanelToolbar, StandardGridToolbar } from '@/components/grid/grid-toolbar';
import { EquipamentoMobileFiltersButton } from '@/pages/equipamentos/components/equipamento-mobile-filters-button';
import { applyEquipamentoColumnFiltersToParams } from '@/lib/equipamento-column-filters';
import { buildEquipamentoActiveFilters } from '@/lib/equipamento-active-filters';
import { GridViewModeControl } from '@/components/grid/grid-view-mode-control';
import { getGridRecordCount } from '@/components/grid/grid-record-count';
import { getApiErrorMessage } from '@/lib/get-api-error-message';
import { showAppToast } from '@/lib/show-app-toast';
import { GridQuickFilters } from '@/components/grid/grid-quick-filters';
import {
  applyContextFilterToParams,
  FILTER_LABELS,
  getDefaultContextFilter,
  getFiltersForMode,
  resolveContextFilter,
  type EquipamentoContextFilter,
} from '@/lib/equipamento-filters';
import { EQUIPAMENTO_SEARCH_PLACEHOLDER } from '@/lib/equipamento-search';
import { parseGridUrlState } from '@/lib/grid-url-state';
import { toggleActiveLabelsFromEntity } from '@/lib/toggle-active-alert';
import { equipamentosService, type EquipamentosListParams } from '@/services/equipamentos.service';
import type { Equipamento } from '@/types/equipamento';
import { EquipamentoPotencialDevolucaoBanner } from '@/pages/equipamentos/components/equipamento-potencial-devolucao-banner';
import { EquipamentoPageStack } from '@/pages/equipamentos/components/equipamento-page-stack';
import { EquipamentoStatsBar } from '@/pages/equipamentos/components/equipamento-stats-bar';
import { EquipamentoThumbnail } from '@/pages/equipamentos/components/equipamento-thumbnail';
import { EquipamentoUtilizacaoBar } from '@/pages/equipamentos/components/equipamento-utilizacao-bar';
import { useEquipamentoPotencialDevolucao } from '@/hooks/use-equipamento-potencial-devolucao';
import { EquipamentoQrModal } from '@/pages/equipamentos/components/equipamento-qr-modal';
import { EquipamentoMobileToolbar } from '@/pages/equipamentos/components/equipamento-mobile-toolbar';
import { EquipamentoSearchField } from '@/pages/equipamentos/components/equipamento-search-field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { AlertDialogPanelTitle } from '@/components/common/panel-title';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BaixaModal,
  CadastroEquipamentoModal,
  DevolverModal,
  EditarEquipamentoModal,
  EmprestarModal,
  FinalizarManutencaoModal,
  HistoricoModal,
  ManutencaoModal,
  RenovarModal,
} from '@/pages/equipamentos/components/equipamento-modals';
import {
  getModeRowActions,
  getModeSpecificColumns,
  MODE_GRID_CONFIG,
  type EquipamentoGridModalKind,
  type EquipamentoGridMode,
} from '@/pages/equipamentos/equipamentos-mode-grid-config';

function formatAuditDate(value?: string | null) {
  if (!value) return '—';
  return format(new Date(value), 'dd/MM/yy HH:mm', { locale: ptBR });
}

function formatRegistrationDate(value?: string | null) {
  if (!value) return '—';
  return format(parseISO(value), 'dd/MM/yy', { locale: ptBR });
}

function getAuditUserName(
  equipamento: Equipamento,
  field: 'created_by' | 'updated_by',
) {
  return equipamento[field]?.name ?? '—';
}

function toSelectOptions(items: Array<{ id: number; nome: string; codigo?: string }>) {
  return items.map((item) => ({
    label: item.codigo ? `${item.codigo} · ${item.nome}` : item.nome,
    value: String(item.id),
  }));
}

type EquipamentosModeGridViewProps = {
  mode: EquipamentoGridMode;
};

export function EquipamentosModeGridView({ mode }: EquipamentosModeGridViewProps) {
  const config = MODE_GRID_CONFIG[mode];
  const isMobile = useIsMobile();
  const showMobileSearch = isMobile && !config.showStatsOnMobile;
  const defaultQuickFilter = getDefaultContextFilter(mode);
  const { t } = useTranslation();
  const cols = useGridColumnLabels();
  const { showError, showToggleActive } = useApiToolbarAlert();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialUrlState = useRef(parseGridUrlState(searchParams)).current;

  const invalidateEquipamentos = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['equipamentos'] });
  }, [queryClient]);

  const grid = useGrid({
    defaultPage: initialUrlState.page,
    defaultPerPage: initialUrlState.perPage,
    defaultSearch: initialUrlState.search,
    defaultSort: initialUrlState.sort,
    defaultSortDir: initialUrlState.sortDir,
    ...(config.showCrudToolbar
      ? {
          onActivate: async (ids: number[]) => {
            try {
              await Promise.all(ids.map((id) => equipamentosService.toggleActive(id, true)));
              showAppToast({
                title:
                  ids.length === 1
                    ? 'Equipamento ativado.'
                    : `${ids.length} equipamentos ativados.`,
              });
              invalidateEquipamentos();
            } catch (error) {
              showAppToast({
                title: getApiErrorMessage(error, 'Erro ao ativar equipamento.'),
                variant: 'destructive',
              });
              throw error;
            }
          },
          onDeactivate: async (ids: number[]) => {
            try {
              await Promise.all(ids.map((id) => equipamentosService.toggleActive(id, false)));
              showAppToast({
                title:
                  ids.length === 1
                    ? 'Equipamento inativado.'
                    : `${ids.length} equipamentos inativados.`,
              });
              invalidateEquipamentos();
            } catch (error) {
              showAppToast({
                title: getApiErrorMessage(error, 'Erro ao inativar equipamento.'),
                variant: 'destructive',
              });
              throw error;
            }
          },
        }
      : {}),
  });
  useGridUrlSearchSync(grid.setSearch);
  const { viewMode, setViewMode } = useGridViewMode(config.viewPreferenceKey);
  const { setPage } = grid;
  const columnFilters = useGridFilters(() => setPage(1), {
    defaultFilters: initialUrlState.filters,
  });
  useGridEquipamentoIdFilterSync(columnFilters.setFilter, columnFilters.clearFilter);

  const [filtro, setFiltro] = useState<EquipamentoContextFilter>(() =>
    resolveContextFilter(mode, searchParams.get('filtro')),
  );

  useSyncGridUrl({
    page: grid.page,
    perPage: grid.perPage,
    search: grid.search,
    debouncedSearch: grid.debouncedSearch,
    sort: grid.sort,
    sortDir: grid.sortDir,
    filters: columnFilters.filters,
    debouncedFilters: columnFilters.debouncedFilters,
    contextFilter: filtro !== defaultQuickFilter ? filtro : null,
  });

  useEffect(() => {
    setFiltro(resolveContextFilter(mode, searchParams.get('filtro')));
  }, [mode, searchParams]);

  const [selected, setSelected] = useState<Equipamento | null>(null);
  const [activeModal, setActiveModal] = useState<EquipamentoGridModalKind | null>(null);
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rowStatusId, setRowStatusId] = useState<number | null>(null);

  const handleQuickFilterChange = useCallback(
    (value: EquipamentoContextFilter) => {
      setFiltro(value);
      setPage(1);
    },
    [setPage],
  );

  const quickFilterOptions = useMemo(
    () =>
      getFiltersForMode(mode as Parameters<typeof getFiltersForMode>[0]).map((filter) => ({
        value: filter,
        label: FILTER_LABELS[filter],
      })),
    [mode],
  );

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

  useEffect(() => {
    setPage(1);
  }, [grid.debouncedSearch, grid.sort, grid.sortDir, filtro, columnFilters.debouncedFilters, setPage]);

  const listParams = useMemo((): EquipamentosListParams => {
    const search = grid.debouncedSearch.trim();
    const params: EquipamentosListParams = {
      search: search || undefined,
      page: grid.page,
      per_page: grid.perPage,
      sort: grid.sort ?? undefined,
      direction: grid.sort ? grid.sortDir : undefined,
    };

    if (config.status) {
      params.status = config.status;
    }

    const withContext = applyContextFilterToParams(mode, filtro, params);
    return applyEquipamentoColumnFiltersToParams(withContext, columnFilters.debouncedFilters);
  }, [
    grid.debouncedSearch,
    grid.page,
    grid.perPage,
    grid.sort,
    grid.sortDir,
    filtro,
    columnFilters.debouncedFilters,
    mode,
    config.status,
  ]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['equipamentos', mode, 'grid', listParams] as const,
    queryFn: () => equipamentosService.list(listParams),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: potencialDevolucao, isLoading: loadingPotencialDevolucao } =
    useEquipamentoPotencialDevolucao(config.showPotencialDevolucao);

  const items = data?.data ?? [];
  const meta = data?.meta;

  const openModal = useCallback((equipamento: Equipamento, kind: EquipamentoGridModalKind) => {
    setSelected(equipamento);
    setActiveModal(kind);
  }, []);

  const closeModal = () => {
    setActiveModal(null);
    setSelected(null);
  };

  const refresh = () => {
    invalidateEquipamentos();
  };

  const handleEditSelected = useCallback(() => {
    if (!grid.singleSelection) return;

    const equipamento = items.find((item) => item.id === grid.selected[0]);
    if (equipamento) {
      openModal(equipamento, 'editar');
    }
  }, [grid.selected, grid.singleSelection, items, openModal]);

  const handleDeleteSelected = useCallback(() => {
    if (!grid.hasSelection) return;
    grid.requestDelete(grid.selected);
  }, [grid.hasSelection, grid.requestDelete, grid.selected]);

  const handleEscape = useCallback(() => {
    if (grid.deleteIds.length > 0) {
      grid.clearDeleteRequest();
    }
    if (grid.hasSelection) {
      grid.clearSelection();
    }
  }, [grid.clearDeleteRequest, grid.clearSelection, grid.deleteIds.length, grid.hasSelection]);

  useGridKeyboard({
    canEdit: config.showCrudToolbar && grid.singleSelection,
    canDelete: config.showCrudToolbar && grid.hasSelection,
    onEdit: handleEditSelected,
    onDelete: handleDeleteSelected,
    onEscape: handleEscape,
  });

  async function handleDelete() {
    if (grid.deleteIds.length === 0) return;

    try {
      setIsDeleting(true);
      await Promise.all(grid.deleteIds.map((id) => equipamentosService.destroy(id)));
      showAppToast({
        title:
          grid.deleteIds.length === 1
            ? 'Equipamento removido.'
            : `${grid.deleteIds.length} equipamentos removidos.`,
      });
      grid.clearDeleteRequest();
      grid.clearSelection();
      refresh();
    } catch (error) {
      showAppToast({
        title: getApiErrorMessage(error, 'Erro ao remover equipamento.'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  const toolbarActions = useMemo(
    () =>
      config.showCrudToolbar ? (
        <StandardGridToolbar
          onNew={() => setCadastroOpen(true)}
          newLabel="Novo"
          onEdit={handleEditSelected}
          onActivate={() => void grid.activateSelected()}
          onDeactivate={() => void grid.deactivateSelected()}
          onDelete={handleDeleteSelected}
          hasSelection={grid.hasSelection && !grid.isTogglingActive}
          singleSelection={grid.singleSelection && !grid.isTogglingActive}
          isTogglingActive={grid.isTogglingActive}
        />
      ) : null,
    [
      config.showCrudToolbar,
      grid.activateSelected,
      grid.deactivateSelected,
      grid.hasSelection,
      grid.isTogglingActive,
      grid.singleSelection,
      handleDeleteSelected,
      handleEditSelected,
    ],
  );

  usePageToolbar({
    title: config.title,
    description: config.description,
    actions: toolbarActions,
  });

  async function handleRowStatusChange(equipamento: Equipamento, active: boolean) {
    const currentlyActive = equipamento.is_active !== false;
    if (currentlyActive === active) return;

    try {
      setRowStatusId(equipamento.id);
      await equipamentosService.toggleActive(equipamento.id, active);
      showToggleActive(active, toggleActiveLabelsFromEntity('equipamento'));
      invalidateEquipamentos();
    } catch (error) {
      showError('Erro ao atualizar status do equipamento.', error);
    } finally {
      setRowStatusId(null);
    }
  }

  const columnDefinitions = useMemo<GridColumnDef<Equipamento>[]>(
    () => [
      {
        id: 'select',
        label: cols.select,
        pinned: 'start',
        hideable: false,
        className: 'w-[40px]',
        render: (row) => (
          <Checkbox
            checked={grid.selected.includes(row.id)}
            onCheckedChange={() => grid.toggleSelect(row.id)}
            onClick={(event) => event.stopPropagation()}
          />
        ),
      },
      {
        id: 'id',
        label: cols.id,
        sortable: true,
        className: 'w-[72px] tabular-nums text-muted-foreground',
        filter: {
          type: 'text',
          filterKey: 'id',
          placeholder: cols.id,
          inputMode: 'numeric',
        },
        render: (row) => row.id,
        exportValue: (row) => row.id,
      },
      {
        id: 'actions',
        label: cols.actions,
        hideable: false,
        className: 'min-w-[100px] w-[100px]',
        render: (row) => (
          <GridRowActions actions={getModeRowActions(mode, row, openModal)} />
        ),
      },
      {
        id: 'patrimonio',
        label: 'Patrimônio',
        sortable: true,
        pinned: 'start',
        hideable: false,
        filter: {
          type: 'text',
          filterKey: 'patrimonio',
          placeholder: 'Patrimônio',
        },
        render: (row) => (
          <div className="flex items-center gap-2">
            <EquipamentoThumbnail equipamento={row} size="sm" previewEnabled />
            <span>{row.patrimonio}</span>
          </div>
        ),
        exportValue: (row) => row.patrimonio,
      },
      {
        id: 'tipo',
        label: 'Equipamento',
        sortable: true,
        filter: {
          type: 'select',
          filterKey: 'tipo_id',
          placeholder: 'Todos',
          options: tipoOptions,
        },
        render: (row) => row.tipo?.nome ?? '—',
        exportValue: (row) => row.tipo?.nome ?? '',
      },
      {
        id: 'grupo',
        label: 'Categoria',
        sortable: true,
        filter: {
          type: 'select',
          filterKey: 'grupo_id',
          placeholder: 'Todas',
          options: grupoOptions,
        },
        render: (row) => row.tipo?.grupo?.nome ?? '—',
        exportValue: (row) => row.tipo?.grupo?.nome ?? '',
      },
      ...getModeSpecificColumns({
        mode,
        cols,
        fornecedorOptions,
        grupoOptions,
        obraOptions,
        tipoOptions,
        rowStatusId,
        onRowStatusChange: handleRowStatusChange,
        formatAuditDate,
        getAuditUserName,
      }),
      {
        id: 'data_entrada',
        label: cols.registrationDate,
        sortable: true,
        sortKey: 'data_entrada',
        filter: { type: 'dateRange', filterKey: 'data_entrada' },
        className: 'min-w-[130px] text-sm text-muted-foreground whitespace-nowrap',
        render: (row) => formatRegistrationDate(row.data_entrada),
        exportValue: (row) => row.data_entrada ?? '',
      },
      {
        id: 'created_at',
        label: cols.createdAt,
        sortable: true,
        sortKey: 'created_at',
        filter: { type: 'dateRange', filterKey: 'created_at' },
        className: 'min-w-[150px] text-sm text-muted-foreground whitespace-nowrap',
        render: (row) => formatAuditDate(row.created_at),
        exportValue: (row) => row.created_at ?? '',
      },
      {
        id: 'created_by',
        label: cols.createdBy,
        filter: { type: 'text', filterKey: 'created_by', placeholder: 'Usuário' },
        className: 'min-w-[160px] text-sm text-muted-foreground',
        render: (row) => getAuditUserName(row, 'created_by'),
        exportValue: (row) => row.created_by?.name ?? '',
      },
      {
        id: 'updated_at',
        label: cols.updatedAt,
        sortable: true,
        sortKey: 'updated_at',
        filter: { type: 'dateRange', filterKey: 'updated_at' },
        className: 'min-w-[160px] text-sm text-muted-foreground whitespace-nowrap',
        render: (row) => formatAuditDate(row.updated_at),
        exportValue: (row) => row.updated_at ?? '',
      },
      {
        id: 'updated_by',
        label: cols.updatedBy,
        filter: { type: 'text', filterKey: 'updated_by', placeholder: 'Usuário' },
        className: 'min-w-[170px] text-sm text-muted-foreground',
        render: (row) => getAuditUserName(row, 'updated_by'),
        exportValue: (row) => row.updated_by?.name ?? '',
      },
    ],
    [
      cols,
      fornecedorOptions,
      grid.selected,
      grid.toggleSelect,
      grupoOptions,
      mode,
      obraOptions,
      openModal,
      rowStatusId,
      tipoOptions,
    ],
  );

  const gridColumns = useGridColumns(config.columnsKey, columnDefinitions);

  const handleResetGrid = () => {
    columnFilters.clearAllFilters();
    grid.clearSearch();
    grid.resetSettings();
    gridColumns.resetColumns();
    setFiltro(defaultQuickFilter);
    setPage(1);
  };

  const handleClearAllFilters = () => {
    columnFilters.clearAllFilters();
    grid.clearSearch();
    setFiltro(defaultQuickFilter);
  };

  const activeFilters = useMemo(
    () =>
      buildEquipamentoActiveFilters({
        columns: columnDefinitions,
        columnFilters,
        quickFilter:
          filtro !== defaultQuickFilter
            ? {
                value: filtro,
                defaultValue: defaultQuickFilter,
                onChange: handleQuickFilterChange,
              }
            : undefined,
        search: showMobileSearch
          ? undefined
          : {
              value: grid.search,
              onClear: grid.clearSearch,
            },
      }),
    [
      columnDefinitions,
      columnFilters,
      defaultQuickFilter,
      filtro,
      grid.clearSearch,
      grid.search,
      handleQuickFilterChange,
      showMobileSearch,
    ],
  );

  const hasActiveFilters =
    columnFilters.hasFilters || grid.hasFilters || filtro !== defaultQuickFilter;
  const isGridCustomized = hasActiveFilters || grid.isCustomized || gridColumns.isCustomized;

  const pagination = meta ? (
    <GridPagination
      meta={meta}
      perPage={grid.perPage}
      onPageChange={grid.setPage}
      onPerPageChange={grid.setPerPage}
    />
  ) : null;

  const gridPanelFilters = showMobileSearch
    ? undefined
    : {
        active: activeFilters,
        onClearAll: hasActiveFilters ? handleClearAllFilters : undefined,
        columnFilters: {
          columns: gridColumns.visibleColumns,
          values: columnFilters.filters,
          onFilterChange: columnFilters.setFilter,
          onDateRangeChange: columnFilters.setDateRangeFilter,
          onFilterClear: columnFilters.clearColumnFilter,
        },
      };

  const gridPanel = (
    <GridPanel
      className="min-h-0 flex-1"
      toolbar={
        <GridPanelToolbar
          onSelectAll={() => grid.toggleSelectAll(items.map((item) => item.id))}
          isAllSelected={grid.isAllSelected(items.length)}
          selectedCount={grid.selected.length}
          onClearSelection={grid.clearSelection}
          onRefresh={refresh}
          isRefreshing={isFetching}
          search={showMobileSearch ? undefined : grid.search}
          onSearch={showMobileSearch ? undefined : grid.setSearch}
          searchPlaceholder={EQUIPAMENTO_SEARCH_PLACEHOLDER}
          quickFiltersControl={
            quickFilterOptions.length > 0 ? (
              <GridQuickFilters
                value={filtro}
                onChange={handleQuickFilterChange}
                defaultValue={defaultQuickFilter}
                options={quickFilterOptions}
              />
            ) : null
          }
          filters={gridPanelFilters}
          columnsControl={
            <GridColumnsControl
              columns={columnDefinitions}
              order={gridColumns.order}
              hidden={gridColumns.hidden}
              visibleCount={gridColumns.visibleCount}
              totalCount={gridColumns.totalCount}
              isCustomized={gridColumns.isCustomized}
              onOrderChange={gridColumns.setColumnOrder}
              onSetVisibility={gridColumns.setColumnVisibility}
              canHideColumn={gridColumns.canHideColumn}
              onShowAll={gridColumns.showAllColumns}
              onHideAll={gridColumns.hideAllColumns}
              onResetDefault={gridColumns.resetColumns}
            />
          }
          resetControl={
            <GridResetControl disabled={!isGridCustomized} onReset={handleResetGrid} />
          }
          viewModeControl={
            <GridViewModeControl viewMode={viewMode} onViewModeChange={setViewMode} />
          }
          recordCount={getGridRecordCount(meta?.total ?? 0, items.length, false)}
        />
      }
      footer={pagination}
    >
      <GridColumnDataView
        viewMode={viewMode}
        columns={gridColumns.visibleColumns}
        data={items}
        getRowKey={(row) => row.id}
        loading={isLoading}
        emptyMessage="Nenhum equipamento encontrado."
        titleColumnId="patrimonio"
        getRowActions={(row) => getModeRowActions(mode, row, openModal)}
        columnFilters={columnFilters.filters}
        onColumnFilterChange={columnFilters.setFilter}
        onDateRangeFilterChange={columnFilters.setDateRangeFilter}
        onColumnFilterClear={columnFilters.clearColumnFilter}
        isRowSelected={(row) => grid.selected.includes(row.id)}
        onRowClick={(row, event) =>
          grid.selectRow(row.id, {
            shift: event.shiftKey,
            rangeOrder: items.map((item) => item.id),
          })
        }
        onRowDoubleClick={(row) => openModal(row, config.doubleClickModal)}
        sort={grid.sort}
        sortDir={grid.sortDir}
        onSort={grid.toggleSort}
      />
    </GridPanel>
  );

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden max-xl:flex-none max-xl:gap-3 xl:h-[calc(100dvh-var(--header-height)-var(--page-content-header-height,0px)-0.75rem)] xl:gap-3">
      {showMobileSearch ? (
        <EquipamentoPageStack className="min-h-0 flex-1">
          <EquipamentoMobileToolbar compact>
            <EquipamentoSearchField
              value={grid.search}
              onChange={grid.setSearch}
              filterSlot={
                <EquipamentoMobileFiltersButton
                  mode={mode}
                  filters={activeFilters}
                  onClearAll={hasActiveFilters ? handleClearAllFilters : undefined}
                  columnFilters={{
                    columns: gridColumns.visibleColumns,
                    values: columnFilters.filters,
                    onFilterChange: columnFilters.setFilter,
                    onDateRangeChange: columnFilters.setDateRangeFilter,
                    onFilterClear: columnFilters.clearColumnFilter,
                  }}
                />
              }
            />
          </EquipamentoMobileToolbar>
          {gridPanel}
        </EquipamentoPageStack>
      ) : (
        gridPanel
      )}

      <EmprestarModal
        equipamento={selected}
        open={activeModal === 'emprestar'}
        onOpenChange={(open) => (open ? setActiveModal('emprestar') : closeModal())}
      />
      <ManutencaoModal
        equipamento={selected}
        open={activeModal === 'manutencao'}
        onOpenChange={(open) => (open ? setActiveModal('manutencao') : closeModal())}
      />
      <BaixaModal
        equipamento={selected}
        open={activeModal === 'baixa'}
        onOpenChange={(open) => (open ? setActiveModal('baixa') : closeModal())}
      />
      <DevolverModal
        equipamento={selected}
        open={activeModal === 'devolver'}
        onOpenChange={(open) => (open ? setActiveModal('devolver') : closeModal())}
      />
      <RenovarModal
        equipamento={selected}
        open={activeModal === 'renovar'}
        onOpenChange={(open) => (open ? setActiveModal('renovar') : closeModal())}
      />
      <FinalizarManutencaoModal
        equipamento={selected}
        open={activeModal === 'finalizar'}
        onOpenChange={(open) => (open ? setActiveModal('finalizar') : closeModal())}
      />
      <HistoricoModal
        equipamento={selected}
        open={activeModal === 'historico'}
        onOpenChange={(open) => (open ? setActiveModal('historico') : closeModal())}
      />
      {config.showCrudToolbar ? (
        <>
          <EditarEquipamentoModal
            equipamento={selected}
            open={activeModal === 'editar'}
            onOpenChange={(open) => (open ? setActiveModal('editar') : closeModal())}
          />
          <EquipamentoQrModal
            equipamento={selected}
            open={activeModal === 'qr'}
            onOpenChange={(open) => (open ? setActiveModal('qr') : closeModal())}
          />
          <CadastroEquipamentoModal open={cadastroOpen} onOpenChange={setCadastroOpen} />
          <AlertDialog
            open={grid.deleteIds.length > 0}
            onOpenChange={(open) => !open && grid.clearDeleteRequest()}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogPanelTitle icon={Trash2}>
                  {grid.deleteIds.length === 1
                    ? 'Remover equipamento'
                    : `Remover ${grid.deleteIds.length} equipamentos`}
                </AlertDialogPanelTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel />
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}
