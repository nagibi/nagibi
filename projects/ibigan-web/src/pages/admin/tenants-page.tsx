import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { History, LoaderCircle, LogIn, Trash2 } from 'lucide-react';
import { GRID_VIEW_ICON } from '@/lib/grid-view-action';
import { getColumnFilterDisplayValue } from '@/lib/grid-filter-display';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApiToolbarAlert } from '@/hooks/use-api-toolbar-alert';
import { useGridPageActions } from '@/hooks/use-grid-page-actions';
import { useImpersonate } from '@/hooks/use-impersonate';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import { useGrid } from '@/hooks/use-grid';
import { useGridKeyboard } from '@/hooks/use-grid-keyboard';
import { useGridColumns, type GridColumnDef } from '@/hooks/use-grid-columns';
import { useGridStringSelection } from '@/hooks/use-grid-string-selection';
import { parseMultiFilterValue } from '@/components/grid/grid-multi-value-filter';
import {
  dateRangeFilterFromKey,
  dateRangeFilterToKey,
  useGridFilters,
} from '@/hooks/use-grid-filters';
import { formatGridMaskedCell } from '@/lib/grid-masked-field';
import { TOGGLE_ACTIVE_LABELS } from '@/lib/toggle-active-alert';
import { adminTenantsService, type AdminTenant } from '@/services/admin-tenants.service';
import { formatDateRangeFilterLabel } from '@/components/grid/grid-date-range-filter';
import { GridColumnsControl } from '@/components/grid/grid-columns-control';
import { GridResetControl } from '@/components/grid/grid-reset-control';
import { PageBody } from '@/components/common/page-body';
import { GridPanel } from '@/components/grid/grid-panel';
import { getGridRecordCount } from '@/components/grid/grid-record-count';
import { GridPagination, type GridPaginationMeta } from '@/components/grid/grid-pagination';
import { GridTable } from '@/components/grid/grid-table';
import { GridRowActions, type GridRowAction } from '@/components/grid/grid-row-actions';
import { GridPanelToolbar, StandardGridToolbar } from '@/components/grid/grid-toolbar';
import { GridViewModeControl } from '@/components/grid/grid-view-mode-control';
import { DataView } from '@/components/grid/data-view';
import { GridCardsView, GridListView } from '@/components/grid/grid-cards-view';
import { OrganizationCard } from '@/components/cards/organization-card';
import { useViewMode } from '@/hooks/use-view-mode';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGridInfiniteScroll } from '@/hooks/use-grid-infinite-scroll';
import { shouldUseGridInfiniteScroll } from '@/lib/grid-infinite-scroll';
import { VIEW_PREFERENCE_KEYS } from '@/types/view-mode';
import { TenantActivityLogsSheet } from '@/components/activity-logs/tenant-activity-logs-sheet';
import { TenantSlugBadge } from '@/components/tenant/tenant-slug-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { AlertDialogPanelTitle } from '@/components/common/panel-title';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';

const GRID_COLUMNS_KEY = 'grid-columns:admin-tenants-v6';

const STATUS_FILTER_OPTIONS = [
  { label: 'Ativo', value: 'active' },
  { label: 'Inativo', value: 'inactive' },
];

function formatCreatedAt(value?: string | null) {
  if (!value) return '—';
  return format(new Date(value), "dd/MM/yy 'às' HH:mm", { locale: ptBR });
}

export function AdminTenantsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loadRef = useRef<() => Promise<void>>(async () => {});
  const { showSuccess, showToggleActive, showError } = useApiToolbarAlert();
  const { impersonate, impersonatingId } = useImpersonate();

  const handleImpersonate = useCallback(
    async (tenant: AdminTenant) => {
      try {
        await impersonate(tenant);
      } catch (error) {
        showError('Erro ao entrar na empresa.', error);
      }
    },
    [impersonate, showError],
  );

  const selection = useGridStringSelection({
    onActivate: async (ids) => {
      try {
        await Promise.all(ids.map((id) => adminTenantsService.toggleActive(id, true)));
        showToggleActive(true, TOGGLE_ACTIVE_LABELS.company, ids.length);
        await loadRef.current();
      } catch (error) {
        showError('Erro ao ativar empresa(s).', error);
        throw new Error('toggle-active-failed');
      }
    },
    onDeactivate: async (ids) => {
      try {
        await Promise.all(ids.map((id) => adminTenantsService.toggleActive(id, false)));
        showToggleActive(false, TOGGLE_ACTIVE_LABELS.company, ids.length);
        await loadRef.current();
      } catch (error) {
        showError('Erro ao inativar empresa(s).', error);
        throw new Error('toggle-active-failed');
      }
    },
  });

  const grid = useGrid();
  const { viewMode, setViewMode } = useViewMode(VIEW_PREFERENCE_KEYS.organizations, {
    persist: 'local',
  });
  const columnFilters = useGridFilters(() => grid.setPage(1));

  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [meta, setMeta] = useState<GridPaginationMeta>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rowStatusId, setRowStatusId] = useState<string | null>(null);
  const [activityLogTenant, setActivityLogTenant] = useState<AdminTenant | null>(null);
  const isMobile = useIsMobile();
  const infiniteScrollEnabled = shouldUseGridInfiniteScroll(isMobile, viewMode);
  const infiniteScroll = useGridInfiniteScroll<AdminTenant>({
    enabled: infiniteScrollEnabled,
    page: grid.page,
    setPage: grid.setPage,
    loading,
    perPage: grid.perPage,
    meta,
    resetDeps: [
      grid.debouncedSearch,
      grid.sort,
      grid.sortDir,
      columnFilters.activeFilterParams,
      infiniteScrollEnabled,
    ],
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminTenantsService.list(
        grid.page,
        grid.resolvePerPage(meta.total),
        grid.debouncedSearch,
        grid.sort,
        grid.sortDir,
        columnFilters.activeFilterParams,
      );
      const pageTenants = res.data.result.data;
      setTenants(pageTenants);
      infiniteScroll.receivePage(pageTenants, grid.page);
      setMeta(res.data.result.meta);
    } catch (error) {
      showError('Erro ao carregar empresas.', error);
    } finally {
      setLoading(false);
    }
  }, [
    grid.page,
    grid.perPage,
    grid.debouncedSearch,
    grid.sort,
    grid.sortDir,
    columnFilters.activeFilterParams,
    infiniteScroll.receivePage,
    showError,
  ]);

  const displayTenants = infiniteScrollEnabled ? infiniteScroll.items : tenants;

  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  const handleEditSelected = useCallback(() => {
    if (!selection.singleSelection) return;
    navigate(`/admin/tenants/${selection.selected[0]}`);
  }, [navigate, selection.selected, selection.singleSelection]);

  const handleDeleteSelected = useCallback(() => {
    if (!selection.hasSelection) return;
    selection.requestDelete(selection.selected);
  }, [selection]);

  const handleEditTenant = useCallback(
    (tenantId: string) => navigate(`/admin/tenants/${tenantId}`),
    [navigate],
  );

  const getTenantRowActions = useCallback(
    (tenant: AdminTenant): GridRowAction[] => [
      {
        label: 'Visualizar',
        icon: GRID_VIEW_ICON,
        onClick: () => handleEditTenant(tenant.id),
      },
      {
        label: t('form.activity_log'),
        icon: History,
        onClick: () => setActivityLogTenant(tenant),
      },
      {
        label: 'Remover',
        icon: Trash2,
        tone: 'destructive',
        onClick: () => selection.requestDelete([tenant.id]),
      },
    ],
    [handleEditTenant, selection.requestDelete, t],
  );

  const handleEscape = useCallback(() => {
    if (activityLogTenant !== null) {
      setActivityLogTenant(null);
      return;
    }
    if (selection.deleteIds.length > 0) {
      selection.clearDeleteRequest();
    }
    if (selection.hasSelection) {
      selection.clearSelection();
    }
  }, [activityLogTenant, selection]);

  useGridKeyboard({
    canEdit: selection.singleSelection,
    canDelete: selection.hasSelection,
    onEdit: handleEditSelected,
    onDelete: handleDeleteSelected,
    onEscape: handleEscape,
  });

  async function handleDelete() {
    if (selection.deleteIds.length === 0) return;

    try {
      setIsDeleting(true);
      await Promise.all(selection.deleteIds.map((tenantId) => adminTenantsService.destroy(tenantId)));
      showSuccess(
        selection.deleteIds.length === 1
          ? 'Empresa removida.'
          : `${selection.deleteIds.length} empresas removidas.`,
      );
      selection.clearDeleteRequest();
      selection.clearSelection();
      void load();
    } catch (error) {
      showError('Erro ao remover empresa.', error);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRowStatusChange(tenant: AdminTenant, active: boolean) {
    if (tenant.is_active === active) return;

    try {
      setRowStatusId(tenant.id);
      await adminTenantsService.toggleActive(tenant.id, active);
      showToggleActive(active, TOGGLE_ACTIVE_LABELS.company);
      void load();
    } catch (error) {
      showError('Erro ao atualizar status da empresa.', error);
    } finally {
      setRowStatusId(null);
    }
  }

  const columnDefinitions = useMemo<GridColumnDef<AdminTenant>[]>(
    () => [
      {
        id: 'select',
        label: '#',
        pinned: 'start',
        hideable: false,
        className: 'w-[40px]',
        render: (tenant) => (
          <Checkbox
            checked={selection.selected.includes(tenant.id)}
            onCheckedChange={() => selection.toggleSelect(tenant.id)}
            onClick={(event) => event.stopPropagation()}
          />
        ),
      },
      {
        id: 'id',
        label: 'Id',
        hideable: false,
        sortable: true,
        sortKey: 'id',
        filter: { type: 'text', filterKey: 'id', placeholder: 'ID' },
        className: 'min-w-[140px] max-w-[220px] text-sm text-muted-foreground',
        render: (tenant) => (
          <span className="block truncate font-mono text-xs" title={tenant.id}>
            {tenant.id}
          </span>
        ),
      },
      {
        id: 'enter',
        label: 'Entrar',
        hideable: false,
        className: 'w-[72px]',
        render: (tenant) => (
          <Button
            type="button"
            variant="primary"
            size="sm"
            mode="icon"
            className="size-8"
            aria-label="Entrar na empresa"
            title="Entrar na empresa"
            disabled={Boolean(impersonatingId)}
            data-grid-no-row-select
            onClick={(event) => {
              event.stopPropagation();
              void handleImpersonate(tenant);
            }}
          >
            {impersonatingId === tenant.id ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <LogIn className="size-4" />
            )}
          </Button>
        ),
      },
      {
        id: 'actions',
        label: 'Ações',
        hideable: false,
        className: 'min-w-[100px] w-[100px]',
        render: (tenant) => (
          <GridRowActions actions={getTenantRowActions(tenant)} />
        ),
      },
      {
        id: 'is_active',
        label: 'Ativo',
        sortable: true,
        sortKey: 'is_active',
        filter: {
          type: 'select',
          filterKey: 'status',
          placeholder: 'Todos',
          options: STATUS_FILTER_OPTIONS,
        },
        className: 'w-[80px]',
        render: (tenant) => (
          <Switch
            checked={tenant.is_active}
            disabled={rowStatusId === tenant.id}
            onClick={(event) => event.stopPropagation()}
            onCheckedChange={(checked) => void handleRowStatusChange(tenant, checked)}
          />
        ),
      },
      {
        id: 'name',
        label: 'Empresa',
        sortable: true,
        sortKey: 'name',
        filter: { type: 'text', filterKey: 'name', placeholder: 'Nome' },
        className: 'min-w-[220px]',
        render: (tenant) => (
          <span>{tenant.name ?? tenant.slug}</span>
        ),
      },
      {
        id: 'users_count',
        label: 'Usuários',
        sortable: true,
        sortKey: 'users_count',
        className: 'w-[90px] text-sm text-muted-foreground tabular-nums',
        render: (tenant) => tenant.users_count ?? 0,
      },
      {
        id: 'cnpj',
        label: 'CNPJ',
        sortable: true,
        sortKey: 'cnpj',
        filter: { type: 'text', filterKey: 'cnpj', placeholder: 'CNPJ', mask: 'cnpj' },
        className: 'min-w-[160px] text-sm text-muted-foreground whitespace-nowrap',
        render: (tenant) => formatGridMaskedCell(tenant.cnpj, 'cnpj'),
      },
      {
        id: 'slug',
        label: 'Slug',
        className: 'min-w-[180px]',
        render: (tenant) => <TenantSlugBadge slug={tenant.slug} />,
      },
      {
        id: 'timezone',
        label: 'Timezone',
        className: 'min-w-[160px] text-sm text-muted-foreground',
        render: (tenant) => tenant.timezone,
      },
      {
        id: 'locale',
        label: 'Locale',
        className: 'min-w-[120px] text-sm text-muted-foreground',
        render: (tenant) => tenant.locale,
      },
      {
        id: 'created_at',
        label: 'Data de criação',
        sortable: true,
        sortKey: 'created_at',
        filter: { type: 'dateRange', filterKey: 'created_at' },
        className: 'min-w-[150px] text-sm text-muted-foreground whitespace-nowrap',
        render: (tenant) => formatCreatedAt(tenant.created_at),
      },
      {
        id: 'updated_at',
        label: 'Atualização',
        sortable: true,
        sortKey: 'updated_at',
        filter: { type: 'dateRange', filterKey: 'updated_at' },
        className: 'min-w-[150px] text-sm text-muted-foreground whitespace-nowrap',
        render: (tenant) => formatCreatedAt(tenant.updated_at),
      },
    ],
    [
      getTenantRowActions,
      handleImpersonate,
      impersonatingId,
      rowStatusId,
      selection.selected,
      selection.toggleSelect,
    ],
  );

  const gridColumns = useGridColumns(GRID_COLUMNS_KEY, columnDefinitions);


  const gridActions = useGridPageActions({
    resetColumns: gridColumns.resetColumns,
    clearAllFilters: columnFilters.clearAllFilters,
    clearSearch: grid.clearSearch,
    resetSettings: grid.resetSettings,
  });

  const activeFilters = useMemo(() => {
    const items = [];

    if (grid.search.trim()) {
      items.push({
        id: 'search',
        label: 'Busca',
        value: grid.search.trim(),
        onRemove: grid.clearSearch,
      });
    }

    for (const column of columnDefinitions) {
      if (!column.filter) continue;

      if (column.filter.type === 'dateRange') {
        const from = columnFilters.filters[dateRangeFilterFromKey(column.filter.filterKey)]?.trim() ?? '';
        const to = columnFilters.filters[dateRangeFilterToKey(column.filter.filterKey)]?.trim() ?? '';
        if (!from && !to) continue;

        items.push({
          id: column.filter.filterKey,
          label: column.label,
          value: formatDateRangeFilterLabel(from, to),
          onRemove: () => columnFilters.clearDateRangeFilter(column.filter!.filterKey),
        });
        continue;
      }

      const value = columnFilters.filters[column.filter.filterKey]?.trim();
      if (!value) continue;

      const displayValue = getColumnFilterDisplayValue(column.filter, value);

      items.push({
        id: column.filter.filterKey,
        label: column.label,
        value: displayValue,
        onRemove: () => columnFilters.clearFilter(column.filter!.filterKey),
      });
    }

    return items;
  }, [
    columnDefinitions,
    columnFilters.filters,
    columnFilters.clearFilter,
    columnFilters.clearDateRangeFilter,
    grid.search,
    grid.clearSearch,
  ]);

  const hasActiveFilters = grid.hasFilters || columnFilters.hasFilters;
  const isGridCustomized = hasActiveFilters || grid.isCustomized || gridColumns.isCustomized;

  const toolbarActions = useMemo(
    () => (
      <StandardGridToolbar
        onNew={() => navigate('/admin/tenants/new')}
        onEdit={handleEditSelected}
        onActivate={() => void selection.activateSelected()}
        onDeactivate={() => void selection.deactivateSelected()}
        onDelete={handleDeleteSelected}
        hasSelection={selection.hasSelection && !selection.isTogglingActive}
        singleSelection={selection.singleSelection && !selection.isTogglingActive}
        isTogglingActive={selection.isTogglingActive}
      />
    ),
    [
      navigate,
      handleEditSelected,
      handleDeleteSelected,
      selection.activateSelected,
      selection.deactivateSelected,
      selection.hasSelection,
      selection.isTogglingActive,
      selection.singleSelection,
    ],
  );

  usePageToolbar({
    title: 'Empresas',
    description: 'Gerencie todas as empresas do sistema.',
    actions: toolbarActions,
  });

  return (
    <PageBody>
      <GridPanel
        toolbar={
          <GridPanelToolbar
            onSelectAll={() => selection.toggleSelectAll(tenants.map((tenant) => tenant.id))}
            isAllSelected={selection.isAllSelected(tenants.length)}
            selectedCount={selection.selected.length}
            onClearSelection={selection.clearSelection}
            onRefresh={load}
            isRefreshing={loading}
            search={grid.search}
            onSearch={grid.setSearch}
            filters={{
              active: activeFilters,
              onClearAll: hasActiveFilters ? gridActions.handleClearFilters : undefined,
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
                onResetDefault={gridActions.handleResetColumns}
              />
            }
            resetControl={
              <GridResetControl
                disabled={!isGridCustomized}
                onReset={gridActions.handleResetGrid}
              />
            }
            viewModeControl={
              <GridViewModeControl viewMode={viewMode} onViewModeChange={setViewMode} />
            }
            recordCount={getGridRecordCount(meta.total, displayTenants.length, infiniteScrollEnabled)}
          />
        }
        footer={!infiniteScrollEnabled ? (
          <GridPagination
            meta={meta}
            perPage={grid.perPage}
            onPageChange={grid.setPage}
            onPerPageChange={grid.setPerPage}
          />
        ) : undefined}
      >
        <DataView
          viewMode={viewMode}
          loading={loading}
          isEmpty={!loading && displayTenants.length === 0}
          emptyMessage="Nenhuma empresa encontrada."
          infiniteScroll={infiniteScrollEnabled ? {
            enabled: true,
            hasMore: infiniteScroll.hasMore,
            loading,
            loadingMore: infiniteScroll.loadingMore,
            onLoadMore: infiniteScroll.loadMore,
            loadedCount: infiniteScroll.loadedCount,
            total: infiniteScroll.total,
          } : undefined}
          tableView={(
            <GridTable
              columns={gridColumns.visibleColumns}
              data={tenants}
              getRowKey={(tenant) => tenant.id}
              loading={loading}
              emptyMessage="Nenhuma empresa encontrada."
              sort={grid.sort}
              sortDir={grid.sortDir}
              onSort={grid.toggleSort}
              onColumnOrderChange={gridColumns.reorderDraggableColumns}
              columnFilters={columnFilters.filters}
              onColumnFilterChange={columnFilters.setFilter}
              onDateRangeFilterChange={columnFilters.setDateRangeFilter}
              onColumnFilterClear={columnFilters.clearColumnFilter}
              isRowSelected={(tenant) => selection.selected.includes(tenant.id)}
              onRowClick={(tenant, event) =>
                selection.selectRow(tenant.id, {
                  shift: event.shiftKey,
                  rangeOrder: tenants.map((item) => item.id),
                })
              }
              onRowDoubleClick={(tenant) => handleEditTenant(tenant.id)}
            />
          )}
          listView={(
            <GridListView
              data={displayTenants}
              getRowKey={(tenant) => tenant.id}
              isRowSelected={(tenant) => selection.selected.includes(tenant.id)}
              onRowClick={(tenant) =>
                selection.selectRow(tenant.id, { rangeOrder: displayTenants.map((item) => item.id) })
              }
              onRowDoubleClick={(tenant) => handleEditTenant(tenant.id)}
              renderItem={(tenant) => (
                <OrganizationCard
                  tenant={tenant}
                  actions={getTenantRowActions(tenant)}
                  onEnter={() => void handleImpersonate(tenant)}
                  enterDisabled={Boolean(impersonatingId)}
                  enterLoading={impersonatingId === tenant.id}
                  statusUpdating={rowStatusId === tenant.id}
                  onActiveChange={(active) => void handleRowStatusChange(tenant, active)}
                />
              )}
            />
          )}
          cardView={(
            <GridCardsView
              data={displayTenants}
              getRowKey={(tenant) => tenant.id}
              isRowSelected={(tenant) => selection.selected.includes(tenant.id)}
              onRowClick={(tenant) =>
                selection.selectRow(tenant.id, { rangeOrder: displayTenants.map((item) => item.id) })
              }
              onRowDoubleClick={(tenant) => handleEditTenant(tenant.id)}
              renderCard={(tenant) => (
                <OrganizationCard
                  tenant={tenant}
                  actions={getTenantRowActions(tenant)}
                  onEnter={() => void handleImpersonate(tenant)}
                  enterDisabled={Boolean(impersonatingId)}
                  enterLoading={impersonatingId === tenant.id}
                  statusUpdating={rowStatusId === tenant.id}
                  onActiveChange={(active) => void handleRowStatusChange(tenant, active)}
                />
              )}
            />
          )}
        />
      </GridPanel>

      <TenantActivityLogsSheet
        open={activityLogTenant !== null}
        onOpenChange={(open) => !open && setActivityLogTenant(null)}
        tenantId={activityLogTenant?.id ?? ''}
        tenantLabel={activityLogTenant?.name ?? activityLogTenant?.slug ?? ''}
      />

      <AlertDialog open={selection.deleteIds.length > 0} onOpenChange={selection.clearDeleteRequest}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogPanelTitle icon={Trash2}>Remover empresa</AlertDialogPanelTitle>
            <AlertDialogDescription>
              {selection.deleteIds.length === 1
                ? 'Tem certeza? Todos os dados desta empresa serão removidos permanentemente.'
                : `Tem certeza que deseja remover ${selection.deleteIds.length} empresas? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel />
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void handleDelete()}
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
