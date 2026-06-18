import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart2,
  CheckCircle,
  Clock,
  Eye,
  LoaderCircle,
  XCircle,
} from 'lucide-react';
import { GRID_DOWNLOAD_ICON } from '@/lib/grid-download-action';
import { format, isAfter, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useGridPageActions } from '@/hooks/use-grid-page-actions';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import { useGrid } from '@/hooks/use-grid';
import { useGridColumns, type GridColumnDef } from '@/hooks/use-grid-columns';
import { useGridViewMode } from '@/hooks/use-grid-view-mode';
import { useGridInfiniteScroll } from '@/hooks/use-grid-infinite-scroll';
import { VIEW_PREFERENCE_KEYS } from '@/types/view-mode';
import { buildServerGridInfiniteScrollProps } from '@/lib/grid-infinite-scroll';
import { getColumnFilterDisplayValue, matchesSelectFilterValue } from '@/lib/grid-filter-display';
import {
  dateRangeFilterFromKey,
  dateRangeFilterToKey,
  useGridFilters,
} from '@/hooks/use-grid-filters';
import { formatDateRangeFilterLabel } from '@/components/grid/grid-date-range-filter';
import { parseMultiFilterValue } from '@/components/grid/grid-multi-value-filter';
import { GridColumnDataView } from '@/components/grid/grid-column-data-view';
import { GridColumnsControl } from '@/components/grid/grid-columns-control';
import { getGridRecordCount } from '@/components/grid/grid-record-count';
import { GridResetControl } from '@/components/grid/grid-reset-control';
import { GridViewModeControl } from '@/components/grid/grid-view-mode-control';
import { hasRecentInProgressExecutions } from '@/lib/report-execution-polling';
import {
  downloadReportResultCsvWithToast,
  reportsService,
  type MyReportExecution,
} from '@/services/reports.service';
import { PageBody } from '@/components/common/page-body';
import { GridPanel } from '@/components/grid/grid-panel';
import { GridPagination } from '@/components/grid/grid-pagination';
import { GridRowActions } from '@/components/grid/grid-row-actions';
import { GridPanelToolbar } from '@/components/grid/grid-toolbar';
import { GridBadge } from '@/components/grid/grid-badge';
import { Button } from '@/components/ui/button';

const GRID_COLUMNS_KEY = 'grid-columns:report-executions';

const STATUS_OPTIONS = [
  { label: 'Na fila', value: 'queued' },
  { label: 'Executando', value: 'running' },
  { label: 'Concluído', value: 'completed' },
  { label: 'Falhou', value: 'failed' },
];

const STATUS_CONFIG: Record<string, {
  label: string;
  variant: 'success' | 'secondary' | 'destructive' | 'outline';
}> = {
  queued: { label: 'Na fila', variant: 'secondary' },
  running: { label: 'Executando', variant: 'outline' },
  completed: { label: 'Concluído', variant: 'success' },
  success: { label: 'Concluído', variant: 'success' },
  failed: { label: 'Falhou', variant: 'destructive' },
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'running') return <LoaderCircle className="size-4 animate-spin text-blue-500" />;
  if (status === 'completed' || status === 'success') return <CheckCircle className="size-4 text-green-600" />;
  if (status === 'failed') return <XCircle className="size-4 text-destructive" />;
  return <Clock className="size-4 text-muted-foreground" />;
}

function matchesExecutionFilters(
  execution: MyReportExecution,
  search: string,
  filters: Record<string, string>,
): boolean {
  const q = search.trim().toLowerCase();
  if (q) {
    const matchesSearch =
      execution.template_name.toLowerCase().includes(q)
      || execution.status.toLowerCase().includes(q);
    if (!matchesSearch) return false;
  }

  const idFilter = filters.id?.trim();
  if (idFilter) {
    const ids = parseMultiFilterValue(idFilter);
    if (ids.length > 0 && !ids.includes(String(execution.id))) return false;
  }

  const templateName = filters.template_name?.trim();
  if (templateName && !execution.template_name.toLowerCase().includes(templateName.toLowerCase())) {
    return false;
  }

  const status = filters.status?.trim();
  if (status && !matchesSelectFilterValue(execution.status, status)) return false;

  const from = filters[dateRangeFilterFromKey('executed_at')]?.trim();
  const to = filters[dateRangeFilterToKey('executed_at')]?.trim();
  const executedAt = parseISO(execution.executed_at);

  if (from && isBefore(executedAt, startOfDay(parseISO(from)))) return false;
  if (to && isAfter(executedAt, endOfDay(parseISO(to)))) return false;

  return true;
}

function formatExecutionProgress(execution: MyReportExecution): string {
  if (execution.status === 'completed') {
    return `${execution.rows_count} registros · ${execution.duration_ms}ms`;
  }
  if (execution.status === 'failed') {
    return execution.error_message ?? 'Erro';
  }
  return execution.progress_message ?? 'Aguardando...';
}

export function MyExecutionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { viewMode, setViewMode, infiniteScrollEnabled } = useGridViewMode(VIEW_PREFERENCE_KEYS.myExecutions);
  const grid = useGrid({ defaultSort: 'executed_at', defaultSortDir: 'desc' });
  const columnFilters = useGridFilters(() => grid.setPage(1));
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const [knownTotal, setKnownTotal] = useState(0);
  const requestPerPage = grid.resolvePerPage(knownTotal);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['my-executions', grid.page, grid.perPage, requestPerPage],
    queryFn: () => reportsService.myExecutions(grid.page, requestPerPage),
    refetchInterval: (query) => {
      const items = query.state.data?.data.result.data ?? [];
      return hasRecentInProgressExecutions(items) ? 3000 : false;
    },
  });

  const executions = data?.data.result.data ?? [];
  const meta = data?.data.result.meta ?? {
    current_page: 1,
    last_page: 1,
    per_page: grid.perPage,
    total: 0,
  };

  useEffect(() => {
    if (meta.total > 0) {
      setKnownTotal(meta.total);
    }
  }, [meta.total]);

  const infiniteScroll = useGridInfiniteScroll<MyReportExecution>({
    enabled: infiniteScrollEnabled,
    page: grid.page,
    setPage: grid.setPage,
    loading: isLoading,
    perPage: grid.perPage,
    meta,
    resetDeps: [
      grid.debouncedSearch,
      columnFilters.activeFilterParams,
      infiniteScrollEnabled,
    ],
  });

  useEffect(() => {
    if (!isLoading) {
      infiniteScroll.receivePage(executions, grid.page);
    }
  }, [executions, grid.page, isLoading, infiniteScroll.receivePage]);

  const displayExecutions = infiniteScrollEnabled ? infiniteScroll.items : executions;

  useEffect(() => {
    const prev = queryClient.getQueryData<typeof data>(['my-executions', grid.page, grid.perPage, requestPerPage]);
    if (!prev || !data) return;

    const prevItems = prev.data.result.data ?? [];
    const currentItems = data.data.result.data ?? [];
    const justCompleted = currentItems.some((item) => {
      const was = prevItems.find((p) => p.id === item.id);
      return was?.status !== 'completed' && item.status === 'completed';
    });

    if (justCompleted) {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  }, [data, grid.page, grid.perPage, queryClient, requestPerPage]);

  const handleDownload = useCallback(async (execution: MyReportExecution) => {
    try {
      setDownloadingId(execution.id);
      await downloadReportResultCsvWithToast(
        execution.template_id,
        execution.id,
        `${execution.template_name}-${execution.id}`,
      );
    } catch {
      // Toast de erro já exibido pelo helper de download.
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['my-executions'] });
  }, [queryClient]);

  const columnDefinitions = useMemo<GridColumnDef<MyReportExecution>[]>(
    () => [
      {
        id: 'id',
        label: 'Id',
        className: 'w-[70px] text-sm text-muted-foreground',
        filter: { type: 'multi', filterKey: 'id', placeholder: 'ID', inputMode: 'numeric' },
        render: (execution) => execution.id,
      },
      {
        id: 'actions',
        label: 'Ações',
        hideable: false,
        className: 'min-w-[100px] w-[100px]',
        render: (execution) => (
          <GridRowActions
            actions={[
              ...(execution.status === 'completed'
                ? [{
                    label: 'Download',
                    icon: GRID_DOWNLOAD_ICON,
                    onClick: () => void handleDownload(execution),
                    disabled: downloadingId === execution.id,
                  }]
                : []),
              {
                label: 'Visualizar',
                icon: Eye,
                onClick: () => navigate(`/reports/${execution.template_id}/execute`),
              },
            ]}
          />
        ),
      },
      {
        id: 'template_name',
        label: 'Relatório',
        className: 'min-w-[200px]',
        filter: { type: 'text', filterKey: 'template_name', placeholder: 'Relatório' },
        render: (execution) => (
          <div className="flex items-center gap-2">
            <StatusIcon status={execution.status} />
            <span>{execution.template_name}</span>
          </div>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        className: 'w-[132px] min-w-[132px] max-w-[132px]',
        exportValue: (execution) => (STATUS_CONFIG[execution.status] ?? STATUS_CONFIG.queued).label,
        filter: {
          type: 'select',
          filterKey: 'status',
          placeholder: 'Status',
          options: STATUS_OPTIONS,
        },
        render: (execution) => {
          const cfg = STATUS_CONFIG[execution.status] ?? STATUS_CONFIG.queued;
          return <GridBadge variant={cfg.variant}>{cfg.label}</GridBadge>;
        },
      },
      {
        id: 'progress',
        label: 'Progresso',
        className: 'min-w-[160px] max-w-[28rem]',
        exportValue: formatExecutionProgress,
        render: (execution) => {
          if (execution.status === 'completed') {
            return (
              <span className="block max-w-[28rem] truncate text-sm text-muted-foreground">
                {execution.rows_count} registros · {execution.duration_ms}ms
              </span>
            );
          }
          if (execution.status === 'failed') {
            return (
              <span className="block max-w-[28rem] truncate text-sm text-destructive">
                {execution.error_message ?? 'Erro'}
              </span>
            );
          }
          return (
            <span className="block max-w-[28rem] truncate text-sm text-muted-foreground">
              {execution.progress_message ?? 'Aguardando...'}
            </span>
          );
        },
      },
      {
        id: 'executed_at',
        label: 'Executado em',
        className: 'w-[168px] min-w-[168px] max-w-[168px] whitespace-nowrap text-sm text-muted-foreground',
        filter: { type: 'dateRange', filterKey: 'executed_at' },
        render: (execution) => format(new Date(execution.executed_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR }),
      },
    ],
    [downloadingId, handleDownload, navigate],
  );

  const gridColumns = useGridColumns(GRID_COLUMNS_KEY, columnDefinitions);

  const gridActions = useGridPageActions({
    resetColumns: gridColumns.resetColumns,
    clearAllFilters: columnFilters.clearAllFilters,
    clearSearch: grid.clearSearch,
    resetSettings: grid.resetSettings,
  });

  const filteredExecutions = useMemo(
    () => displayExecutions.filter((execution) =>
      matchesExecutionFilters(execution, grid.debouncedSearch, columnFilters.debouncedFilters),
    ),
    [columnFilters.debouncedFilters, displayExecutions, grid.debouncedSearch],
  );


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
    columnFilters.clearDateRangeFilter,
    columnFilters.clearFilter,
    columnFilters.filters,
    grid.clearSearch,
    grid.search,
  ]);

  const hasActiveFilters = grid.hasFilters || columnFilters.hasFilters;

  const toolbarActions = useMemo(
    () => (
      <Button variant="primary" size="sm" className="h-8 gap-1.5" onClick={() => navigate('/reports')}>
        <BarChart2 className="size-4" />
        Ver relatórios
      </Button>
    ),
    [navigate],
  );

  usePageToolbar({
    title: 'Minhas Execuções',
    description: 'Acompanhe o status dos seus relatórios e baixe os resultados.',
    actions: toolbarActions,
  });

  return (
    <PageBody>
      <GridPanel
        toolbar={(
          <GridPanelToolbar
            onRefresh={refresh}
            isRefreshing={isLoading || isFetching}
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
            columnsControl={(
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
            )}
            resetControl={(
              <GridResetControl
                disabled={!hasActiveFilters && !gridColumns.isCustomized && !grid.isCustomized}
                onReset={gridActions.handleResetGrid}
              />
            )}
            viewModeControl={
              <GridViewModeControl viewMode={viewMode} onViewModeChange={setViewMode} />
            }
            recordCount={getGridRecordCount(meta.total, filteredExecutions.length, infiniteScrollEnabled)}
          />
        )}
        footer={!infiniteScrollEnabled ? (
          <GridPagination
            meta={meta}
            perPage={grid.perPage}
            onPageChange={grid.setPage}
            onPerPageChange={grid.setPerPage}
          />
        ) : undefined}
      >
        <GridColumnDataView
          viewMode={viewMode}
          columns={gridColumns.visibleColumns}
          data={infiniteScrollEnabled ? executions : filteredExecutions}
          cardData={infiniteScrollEnabled ? filteredExecutions : undefined}
          getRowKey={(execution) => execution.id}
          loading={isLoading || isFetching}
          emptyMessage="Nenhuma execução encontrada."
          infiniteScroll={buildServerGridInfiniteScrollProps({
            enabled: infiniteScrollEnabled,
            infiniteScroll,
            loading: isLoading,
          })}
          onColumnOrderChange={gridColumns.reorderDraggableColumns}
          columnFilters={columnFilters.filters}
          onColumnFilterChange={columnFilters.setFilter}
          onDateRangeFilterChange={columnFilters.setDateRangeFilter}
          onColumnFilterClear={columnFilters.clearColumnFilter}
          onRowDoubleClick={(execution) => navigate(`/reports/${execution.template_id}/execute`)}
        />
      </GridPanel>
    </PageBody>
  );
}
