import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { GRID_VIEW_ICON } from '@/lib/grid-view-action';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { parseGridUrlState } from '@/lib/grid-url-state';
import { gruposCatalogService } from '@/services/equipamento-catalog.service';
import type { GrupoEquipamento } from '@/types/equipamento-catalog';
import { AlertDialogPanelTitle } from '@/components/common/panel-title';
import { PageBody } from '@/components/common/page-body';
import { GrupoCatalogCard } from '@/components/cards/equipamento-catalog-cards';
import { GridColumnDataView } from '@/components/grid/grid-column-data-view';
import { GridColumnsControl } from '@/components/grid/grid-columns-control';
import { GridPanel } from '@/components/grid/grid-panel';
import { GridPagination } from '@/components/grid/grid-pagination';
import { GridResetControl } from '@/components/grid/grid-reset-control';
import { GridViewModeControl } from '@/components/grid/grid-view-mode-control';
import { GridRowActions, type GridRowAction } from '@/components/grid/grid-row-actions';
import { GridPanelToolbar, StandardGridToolbar } from '@/components/grid/grid-toolbar';
import { getGridRecordCount } from '@/components/grid/grid-record-count';
import { Checkbox } from '@/components/ui/checkbox';
import { buildCatalogActiveFilters } from '@/pages/equipamentos/catalog/equipamento-catalog-grid-utils';
import { VIEW_PREFERENCE_KEYS } from '@/types/view-mode';
import { buildServerGridInfiniteScrollProps } from '@/lib/grid-infinite-scroll';
import { useCatalogInfiniteDisplay } from '@/pages/equipamentos/catalog/use-catalog-infinite-display';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';

const GRID_COLUMNS_KEY = 'grid-columns:equipamentos-grupos-v1';

function formatAuditDate(value?: string | null) {
  if (!value) return '—';
  return format(new Date(value), 'dd/MM/yy HH:mm', { locale: ptBR });
}

export function GruposPage() {
  const cols = useGridColumnLabels();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialUrlState = useRef(parseGridUrlState(searchParams)).current;
  const { showError, showSuccess } = useApiToolbarAlert();
  const { viewMode, setViewMode, infiniteScrollEnabled } = useGridViewMode(
    VIEW_PREFERENCE_KEYS.equipamentosGrupos,
  );

  const grid = useGrid({
    defaultPage: initialUrlState.page,
    defaultPerPage: initialUrlState.perPage,
    defaultSearch: initialUrlState.search,
    defaultSort: initialUrlState.sort,
    defaultSortDir: initialUrlState.sortDir,
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
    await queryClient.invalidateQueries({ queryKey: ['equipamentos', 'grupos'] });
    await queryClient.invalidateQueries({ queryKey: ['equipamentos-lookups', 'grupos'] });
  }, [queryClient]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['equipamentos', 'grupos', 'grid', listParams] as const,
    queryFn: async () => {
      const response = await gruposCatalogService.list(
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

  const items = data?.data ?? [];
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

  const handleViewSelected = useCallback(() => {
    if (!grid.singleSelection) return;
    navigate(`/equipamentos/grupos/${grid.selected[0]}`);
  }, [grid.selected, grid.singleSelection, navigate]);

  const getRowActions = useCallback(
    (row: GrupoEquipamento): GridRowAction[] => [
      {
        label: cols.edit,
        icon: GRID_VIEW_ICON,
        onClick: () => navigate(`/equipamentos/grupos/${row.id}`),
      },
    ],
    [cols.edit, navigate],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!grid.hasSelection) return;
    grid.requestDelete(grid.selected);
  }, [grid.hasSelection, grid.requestDelete, grid.selected]);

  const handleEscape = useCallback(() => {
    if (grid.deleteIds.length > 0) grid.clearDeleteRequest();
    if (grid.hasSelection) grid.clearSelection();
  }, [grid.clearDeleteRequest, grid.clearSelection, grid.deleteIds.length, grid.hasSelection]);

  useGridKeyboard({
    canEdit: grid.singleSelection,
    canDelete: grid.hasSelection,
    onEdit: handleViewSelected,
    onDelete: handleDeleteSelected,
    onEscape: handleEscape,
  });

  async function handleDelete() {
    if (grid.deleteIds.length === 0) return;

    try {
      setIsDeleting(true);
      await Promise.all(grid.deleteIds.map((id) => gruposCatalogService.destroy(id)));
      showSuccess(
        grid.deleteIds.length === 1
          ? 'Grupo removido.'
          : `${grid.deleteIds.length} grupos removidos.`,
      );
      grid.clearDeleteRequest();
      grid.clearSelection();
      await invalidate();
      await refetch();
    } catch (error) {
      showError('Erro ao remover grupo.', error);
    } finally {
      setIsDeleting(false);
    }
  }

  const columnDefinitions = useMemo<GridColumnDef<GrupoEquipamento>[]>(
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
        filter: { type: 'multi', filterKey: 'id', placeholder: cols.id, inputMode: 'numeric' },
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
        id: 'nome',
        label: 'Nome',
        hideable: false,
        sortable: true,
        sortKey: 'nome',
        filter: { type: 'text', filterKey: 'nome', placeholder: 'Nome' },
        render: (row) => <span>{row.nome}</span>,
        exportValue: (row) => row.nome,
      },
      {
        id: 'tipos_count',
        label: 'Tipos',
        sortable: true,
        sortKey: 'tipos_count',
        className: 'w-[88px] tabular-nums',
        render: (row) => row.tipos_count ?? 0,
        exportValue: (row) => row.tipos_count ?? 0,
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
        id: 'updated_at',
        label: cols.updatedAt,
        sortable: true,
        sortKey: 'updated_at',
        filter: { type: 'dateRange', filterKey: 'updated_at' },
        className: 'min-w-[160px] text-sm text-muted-foreground whitespace-nowrap',
        render: (row) => formatAuditDate(row.updated_at),
        exportValue: (row) => row.updated_at ?? '',
      },
    ],
    [cols, getRowActions, grid.selected, grid.toggleSelect],
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
  const isGridCustomized = hasActiveFilters || grid.isCustomized || gridColumns.isCustomized;

  const toolbarActions = useMemo(
    () => (
      <StandardGridToolbar
        onNew={() => navigate('/equipamentos/grupos/new')}
        onEdit={handleViewSelected}
        onDelete={handleDeleteSelected}
        hasSelection={grid.hasSelection}
        singleSelection={grid.singleSelection}
      />
    ),
    [grid.hasSelection, grid.singleSelection, handleDeleteSelected, handleViewSelected, navigate],
  );

  usePageToolbar({
    title: 'Grupos',
    description: 'Categorias de equipamento',
    breadcrumbs: [
      { title: 'Equipamentos', path: '/equipamentos' },
      { title: 'Grupos' },
    ],
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
            onSelectAll={() => grid.toggleSelectAll(displayItems.map((item) => item.id))}
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
              <GridResetControl disabled={!isGridCustomized} onReset={handleResetGrid} />
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
          emptyMessage="Nenhum grupo encontrado."
          titleColumnId="nome"
          getRowActions={getRowActions}
          renderCard={(row) => <GrupoCatalogCard item={row} actions={getRowActions(row)} />}
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
          onRowDoubleClick={(row) => navigate(`/equipamentos/grupos/${row.id}`)}
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
                ? 'Remover grupo'
                : `Remover ${grid.deleteIds.length} grupos`}
            </AlertDialogPanelTitle>
            <AlertDialogDescription>
              Grupos com tipos vinculados não podem ser removidos. Esta ação não pode ser desfeita.
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
