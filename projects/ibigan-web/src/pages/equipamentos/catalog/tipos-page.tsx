import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCatalogActiveFilterOptions,
  buildCatalogActiveFilters,
} from '@/pages/equipamentos/catalog/equipamento-catalog-grid-utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { TipoEquipamentoCatalog } from '@/types/equipamento-catalog';
import type { PageBreadcrumbItem } from '@/lib/build-page-breadcrumbs';
import { parseGridUrlState } from '@/lib/grid-url-state';
import { GRID_VIEW_ICON } from '@/lib/grid-view-action';
import { toggleActiveLabelsFromEntity } from '@/lib/toggle-active-alert';
import { useApiToolbarAlert } from '@/hooks/use-api-toolbar-alert';
import { useGrid } from '@/hooks/use-grid';
import { useGridColumnLabels } from '@/hooks/use-grid-column-labels';
import { useGridColumns, type GridColumnDef } from '@/hooks/use-grid-columns';
import { useGridFilters } from '@/hooks/use-grid-filters';
import { useGridKeyboard } from '@/hooks/use-grid-keyboard';
import { useGridPageActions } from '@/hooks/use-grid-page-actions';
import { useGridViewMode } from '@/hooks/use-grid-view-mode';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import { useSyncGridUrl } from '@/hooks/use-sync-grid-url';
import { tiposCatalogService } from '@/services/equipamento-catalog.service';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { GridStatusSwitch } from '@/components/grid/grid-status-switch';
import { AlertDialogPanelTitle } from '@/components/common/panel-title';
import { PageBody } from '@/components/common/page-body';
import { TipoCatalogCard } from '@/components/cards/equipamento-catalog-cards';
import { GridColumnDataView } from '@/components/grid/grid-column-data-view';
import { GridColumnsControl } from '@/components/grid/grid-columns-control';
import { GridPagination } from '@/components/grid/grid-pagination';
import { GridPanel } from '@/components/grid/grid-panel';
import { getGridRecordCount } from '@/components/grid/grid-record-count';
import { GridResetControl } from '@/components/grid/grid-reset-control';
import { GridViewModeControl } from '@/components/grid/grid-view-mode-control';
import {
  GridRowActions,
  type GridRowAction,
} from '@/components/grid/grid-row-actions';
import {
  GridPanelToolbar,
  StandardGridToolbar,
} from '@/components/grid/grid-toolbar';
import { VIEW_PREFERENCE_KEYS } from '@/types/view-mode';
import { buildServerGridInfiniteScrollProps } from '@/lib/grid-infinite-scroll';
import { useCatalogInfiniteDisplay } from '@/pages/equipamentos/catalog/use-catalog-infinite-display';

const TIPOS_ACTIVITY_LOG_TYPE = 'tipos';
const GRID_COLUMNS_KEY = 'grid-columns:equipamentos-tipos';
const EMPTY_TIPOS: TipoEquipamentoCatalog[] = [];
const TIPOS_TOOLBAR_BREADCRUMBS: PageBreadcrumbItem[] = [
  { title: 'Equipamentos', path: '/equipamentos' },
  { title: 'Tipos' },
];

function formatAuditDate(value?: string | null) {
  if (!value) return '—';
  return format(new Date(value), 'dd/MM/yy HH:mm', { locale: ptBR });
}

export function TiposPage() {
  const cols = useGridColumnLabels();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialUrlState = useRef(parseGridUrlState(searchParams)).current;
  const { showError, showSuccess, showToggleActive } = useApiToolbarAlert();
  const { viewMode, setViewMode, infiniteScrollEnabled } = useGridViewMode(
    VIEW_PREFERENCE_KEYS.equipamentosTipos,
  );

  const handleActivate = useCallback(
    async (ids: number[]) => {
      try {
        await Promise.all(
          ids.map((itemId) =>
            tiposCatalogService.update(itemId, { is_ativo: true }),
          ),
        );
        showToggleActive(
          true,
          toggleActiveLabelsFromEntity('tipo'),
          ids.length,
        );
        await queryClient.invalidateQueries({
          queryKey: ['equipamentos', 'tipos'],
        });
        await queryClient.invalidateQueries({
          queryKey: ['equipamentos-lookups', 'tipos'],
        });
      } catch (error) {
        showError('Erro ao ativar tipo(s).', error);
        throw error;
      }
    },
    [queryClient, showError, showToggleActive],
  );

  const handleDeactivate = useCallback(
    async (ids: number[]) => {
      try {
        await Promise.all(
          ids.map((itemId) =>
            tiposCatalogService.update(itemId, { is_ativo: false }),
          ),
        );
        showToggleActive(
          false,
          toggleActiveLabelsFromEntity('tipo'),
          ids.length,
        );
        await queryClient.invalidateQueries({
          queryKey: ['equipamentos', 'tipos'],
        });
        await queryClient.invalidateQueries({
          queryKey: ['equipamentos-lookups', 'tipos'],
        });
      } catch (error) {
        showError('Erro ao inativar tipo(s).', error);
        throw error;
      }
    },
    [queryClient, showError, showToggleActive],
  );

  const grid = useGrid({
    defaultPage: initialUrlState.page,
    defaultPerPage: initialUrlState.perPage,
    defaultSearch: initialUrlState.search,
    defaultSort: initialUrlState.sort,
    defaultSortDir: initialUrlState.sortDir,
    onActivate: handleActivate,
    onDeactivate: handleDeactivate,
  });

  const columnFilters = useGridFilters(() => grid.setPage(1), {
    defaultFilters: initialUrlState.filters,
  });

  useSyncGridUrl({
    page: grid.page,
    perPage: grid.perPage,
    debouncedSearch: grid.debouncedSearch,
    sort: grid.sort,
    sortDir: grid.sortDir,
    debouncedFilters: columnFilters.debouncedFilters,
  });

  const [rowStatusId, setRowStatusId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const listParams = useMemo(
    () => ({
      page: grid.page,
      perPage: grid.perPage,
      search: grid.debouncedSearch.trim() || undefined,
      sort: grid.sort,
      direction: grid.sortDir,
      columnFilters: columnFilters.activeFilterParams,
    }),
    [
      columnFilters.activeFilterParams,
      grid.debouncedSearch,
      grid.page,
      grid.perPage,
      grid.sort,
      grid.sortDir,
    ],
  );

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ['equipamentos', 'tipos'],
    });
    await queryClient.invalidateQueries({
      queryKey: ['equipamentos-lookups', 'tipos'],
    });
  }, [queryClient]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['equipamentos', 'tipos', 'grid', listParams] as const,
    queryFn: async () => {
      const response = await tiposCatalogService.list(
        listParams.page,
        listParams.perPage,
        listParams.search,
        {
          sort: listParams.sort,
          direction: listParams.direction,
          columnFilters: listParams.columnFilters,
        },
      );
      return response.data.result;
    },
    staleTime: 30_000,
  });

  const items = data?.data ?? EMPTY_TIPOS;
  const meta = data?.meta;
  const { displayItems, infiniteScroll, resolvedMeta } = useCatalogInfiniteDisplay({
    items,
    meta,
    isLoading,
    infiniteScrollEnabled,
    grid,
    columnFilters,
  });

  useEffect(() => {
    grid.setPage(1);
  }, [
    grid.debouncedSearch,
    columnFilters.debouncedFilters,
    grid.sort,
    grid.sortDir,
    grid.setPage,
  ]);

  const activeFilterOptions = useMemo(
    () => buildCatalogActiveFilterOptions(),
    [],
  );

  const handleViewSelected = useCallback(() => {
    if (!grid.singleSelection) return;
    navigate(`/equipamentos/tipos/${grid.selected[0]}`);
  }, [grid.selected, grid.singleSelection, navigate]);

  const getRowActions = useCallback(
    (row: TipoEquipamentoCatalog): GridRowAction[] => [
      {
        label: cols.edit,
        icon: GRID_VIEW_ICON,
        onClick: () => navigate(`/equipamentos/tipos/${row.id}`),
      },
    ],
    [cols.edit, navigate],
  );

  const handleEditSelected = handleViewSelected;

  async function handleRowStatusChange(
    tipo: TipoEquipamentoCatalog,
    active: boolean,
  ) {
    if (tipo.is_ativo === active) return;

    try {
      setRowStatusId(tipo.id);
      await tiposCatalogService.update(tipo.id, { is_ativo: active });
      showToggleActive(active, toggleActiveLabelsFromEntity('tipo'));
      await invalidate();
      await refetch();
    } catch (error) {
      showError('Erro ao atualizar status do tipo.', error);
    } finally {
      setRowStatusId(null);
    }
  }

  const handleDeleteSelected = useCallback(() => {
    if (!grid.hasSelection) return;
    grid.requestDelete(grid.selected);
  }, [grid.hasSelection, grid.requestDelete, grid.selected]);

  const handleEscape = useCallback(() => {
    if (grid.deleteIds.length > 0) grid.clearDeleteRequest();
    if (grid.hasSelection) grid.clearSelection();
  }, [
    grid.clearDeleteRequest,
    grid.clearSelection,
    grid.deleteIds.length,
    grid.hasSelection,
  ]);

  useGridKeyboard({
    canEdit: grid.singleSelection,
    canDelete: grid.hasSelection,
    onEdit: handleEditSelected,
    onDelete: handleDeleteSelected,
    onEscape: handleEscape,
  });

  async function handleDelete() {
    if (grid.deleteIds.length === 0) return;

    try {
      setIsDeleting(true);
      await Promise.all(
        grid.deleteIds.map((id) => tiposCatalogService.destroy(id)),
      );
      showSuccess(
        grid.deleteIds.length === 1
          ? 'Tipo removido.'
          : `${grid.deleteIds.length} tipos removidos.`,
      );
      grid.clearDeleteRequest();
      grid.clearSelection();
      await invalidate();
      await refetch();
    } catch (error) {
      showError('Erro ao remover tipo.', error);
    } finally {
      setIsDeleting(false);
    }
  }

  const columnDefinitions = useMemo<GridColumnDef<TipoEquipamentoCatalog>[]>(
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
        sortKey: 'id',
        filter: {
          type: 'multi',
          filterKey: 'id',
          placeholder: cols.id,
          inputMode: 'numeric',
        },
        className: 'w-[72px] tabular-nums text-muted-foreground',
        render: (row) => row.id,
        exportValue: (row) => row.id,
      },
      {
        id: 'actions',
        label: cols.actions,
        hideable: false,
        className: 'min-w-[100px] w-[100px]',
        render: (row) => <GridRowActions actions={getRowActions(row)} />,
      },
      {
        id: 'is_ativo',
        label: cols.active,
        sortable: true,
        sortKey: 'is_ativo',
        filter: {
          type: 'select',
          filterKey: 'is_ativo',
          placeholder: cols.all,
          options: activeFilterOptions,
        },
        className: 'w-[80px]',
        exportValue: (row) => (row.is_ativo ? 'Sim' : 'Não'),
        render: (row) => (
          <GridStatusSwitch
            checked={row.is_ativo}
            disabled={rowStatusId === row.id}
            onCheckedChange={(checked) =>
              void handleRowStatusChange(row, checked)
            }
          />
        ),
      },
      {
        id: 'nome',
        label: 'Nome',
        //pinned: 'start',
        hideable: false,
        sortable: true,
        sortKey: 'nome',
        filter: { type: 'text', filterKey: 'nome', placeholder: 'Nome' },
        render: (row) => <span>{row.nome}</span>,
        exportValue: (row) => row.nome,
      },
      {
        id: 'grupo',
        label: 'Grupo',
        sortable: true,
        sortKey: 'grupo',
        filter: { type: 'text', filterKey: 'grupo', placeholder: 'Grupo' },
        render: (row) => row.grupo?.nome ?? '—',
        exportValue: (row) => row.grupo?.nome ?? '',
      },
      {
        id: 'created_at',
        label: cols.createdAt,
        sortable: true,
        sortKey: 'created_at',
        filter: { type: 'dateRange', filterKey: 'created_at' },
        className:
          'min-w-[150px] text-sm text-muted-foreground whitespace-nowrap',
        render: (row) => formatAuditDate(row.created_at),
        exportValue: (row) => row.created_at ?? '',
      },
      {
        id: 'updated_at',
        label: cols.updatedAt,
        sortable: true,
        sortKey: 'updated_at',
        filter: { type: 'dateRange', filterKey: 'updated_at' },
        className:
          'min-w-[160px] text-sm text-muted-foreground whitespace-nowrap',
        render: (row) => formatAuditDate(row.updated_at),
        exportValue: (row) => row.updated_at ?? '',
      },
    ],
    [
      activeFilterOptions,
      cols,
      getRowActions,
      grid.selected,
      grid.toggleSelect,
      rowStatusId,
    ],
  );

  const gridColumns = useGridColumns(GRID_COLUMNS_KEY, columnDefinitions);
  const { handleResetGrid, handleClearFilters } = useGridPageActions({
    resetColumns: gridColumns.resetColumns,
    clearAllFilters: columnFilters.clearAllFilters,
    clearSearch: grid.clearSearch,
    resetSettings: grid.resetSettings,
  });

  const activeFilters = useMemo(
    () =>
      buildCatalogActiveFilters({
        columnDefinitions,
        columnFilters,
        search: grid.search,
        clearSearch: grid.clearSearch,
      }),
    [columnDefinitions, columnFilters, grid.clearSearch, grid.search],
  );

  const hasActiveFilters = columnFilters.hasFilters || grid.hasFilters;
  const isGridCustomized =
    hasActiveFilters || grid.isCustomized || gridColumns.isCustomized;

  const toolbarActions = useMemo(
    () => (
      <StandardGridToolbar
        onNew={() => navigate('/equipamentos/tipos/new')}
        onEdit={handleViewSelected}
        onActivate={() => void grid.activateSelected()}
        onDeactivate={() => void grid.deactivateSelected()}
        onDelete={handleDeleteSelected}
        hasSelection={grid.hasSelection && !grid.isTogglingActive}
        singleSelection={grid.singleSelection && !grid.isTogglingActive}
        isTogglingActive={grid.isTogglingActive}
      />
    ),
    [
      grid.activateSelected,
      grid.deactivateSelected,
      grid.hasSelection,
      grid.isTogglingActive,
      grid.singleSelection,
      handleDeleteSelected,
      handleViewSelected,
      navigate,
    ],
  );

  usePageToolbar({
    title: 'Tipos',
    description: 'Cadastro de tipos de equipamento',
    breadcrumbs: TIPOS_TOOLBAR_BREADCRUMBS,
    actions: toolbarActions,
  });

  const pagination = (
    <GridPagination
      meta={resolvedMeta}
      perPage={grid.perPage}
      onPageChange={grid.setPage}
      onPerPageChange={grid.setPerPage}
    />
  );

  return (
    <PageBody>
      <GridPanel
        toolbar={
          <GridPanelToolbar
            onSelectAll={() =>
              grid.toggleSelectAll(displayItems.map((item) => item.id))
            }
            isAllSelected={grid.isAllSelected(displayItems.length)}
            selectedCount={grid.selected.length}
            onClearSelection={grid.clearSelection}
            onRefresh={() => void refetch()}
            isRefreshing={isFetching}
            search={grid.search}
            onSearch={grid.setSearch}
            filters={{
              active: activeFilters,
              onClearAll: hasActiveFilters ? handleClearFilters : undefined,
              columnFilters: {
                columns: gridColumns.visibleColumns,
                values: columnFilters.filters,
                onFilterChange: columnFilters.setFilter,
                onDateRangeChange: columnFilters.setDateRangeFilter,
                onFilterClear: columnFilters.clearColumnFilter,
              },
            }}
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
              <GridResetControl
                disabled={!isGridCustomized}
                onReset={handleResetGrid}
              />
            }
            viewModeControl={
              <GridViewModeControl viewMode={viewMode} onViewModeChange={setViewMode} />
            }
            recordCount={getGridRecordCount(
              resolvedMeta.total,
              displayItems.length,
              infiniteScrollEnabled,
            )}
          />
        }
        footer={!infiniteScrollEnabled ? pagination : undefined}
      >
        <GridColumnDataView
          viewMode={viewMode}
          columns={gridColumns.visibleColumns}
          data={items}
          cardData={infiniteScrollEnabled ? displayItems : undefined}
          getRowKey={(row) => row.id}
          loading={isLoading}
          emptyMessage="Nenhum tipo encontrado."
          titleColumnId="nome"
          getRowActions={getRowActions}
          renderCard={(row) => (
            <TipoCatalogCard
              item={row}
              actions={getRowActions(row)}
              statusUpdating={rowStatusId === row.id}
              onActiveChange={(active) => void handleRowStatusChange(row, active)}
            />
          )}
          infiniteScroll={buildServerGridInfiniteScrollProps({
            enabled: infiniteScrollEnabled,
            infiniteScroll,
            loading: isLoading,
          })}
          isRowSelected={(row) => grid.selected.includes(row.id)}
          onRowClick={(row, event) =>
            grid.selectRow(row.id, {
              shift: event.shiftKey,
              rangeOrder: displayItems.map((item) => item.id),
            })
          }
          onRowDoubleClick={(row) => navigate(`/equipamentos/tipos/${row.id}`)}
          sort={grid.sort}
          sortDir={grid.sortDir}
          onSort={grid.toggleSort}
          columnFilters={columnFilters.filters}
          onColumnFilterChange={columnFilters.setFilter}
          onColumnFilterClear={columnFilters.clearColumnFilter}
        />
      </GridPanel>

      <AlertDialog
        open={grid.deleteIds.length > 0}
        onOpenChange={(open) => !open && grid.clearDeleteRequest()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogPanelTitle icon={Trash2}>
              {grid.deleteIds.length === 1
                ? 'Remover tipo'
                : `Remover ${grid.deleteIds.length} tipos`}
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
    </PageBody>
  );
}
