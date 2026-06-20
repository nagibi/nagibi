import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart2, Check, CheckCheck, ExternalLink, Eye, MailOpen, Settings, Trash2 } from 'lucide-react';
import { GRID_DOWNLOAD_ICON } from '@/lib/grid-download-action';
import { Switch } from '@/components/ui/switch';
import { resolveMenuIcon } from '@/lib/menu-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApiToolbarAlert } from '@/hooks/use-api-toolbar-alert';
import { useGridPageActions } from '@/hooks/use-grid-page-actions';
import { useGridToasts } from '@/hooks/use-grid-toasts';
import { useApiMenuByPath } from '@/hooks/use-api-menu-by-path';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import { useGrid } from '@/hooks/use-grid';
import { useGridColumns, type GridColumnDef } from '@/hooks/use-grid-columns';
import { useGridViewMode } from '@/hooks/use-grid-view-mode';
import { useGridInfiniteScroll } from '@/hooks/use-grid-infinite-scroll';
import { buildServerGridInfiniteScrollProps } from '@/lib/grid-infinite-scroll';
import { getColumnFilterDisplayValue } from '@/lib/grid-filter-display';
import { useReadUnreadFilterOptions } from '@/lib/grid-filter-options';
import { useNotificationCategoryFilterOptions } from '@/lib/notification-category-filter-options';
import { VIEW_PREFERENCE_KEYS } from '@/types/view-mode';
import {
  dateRangeFilterFromKey,
  dateRangeFilterToKey,
  useGridFilters,
} from '@/hooks/use-grid-filters';
import {
  getNotificationCategoryDisplay,
  getNotificationTitle,
  getNotificationRecordId,
  getReportDownloadMeta,
  isReportNotification,
} from '@/lib/notification-utils';
import {
  invalidateNotifications,
  markAllNotificationsReadInCache,
  removeNotificationFromCache,
  upsertNotificationInCache,
} from '@/lib/notification-cache';
import {
  notificationsService,
  type AppNotification,
  type NotificationQuickFilter,
} from '@/services/notifications.service';
import { NOTIFICATION_PREFERENCES_TITLE } from '@/lib/notification-preferences-path';
import { useNotificationPreferencesSheet } from '@/providers/notification-preferences-sheet-provider';
import { downloadReportResultCsvWithToast } from '@/services/reports.service';
import { NotificationDetailSheet } from '@/components/notifications/notification-detail-sheet';
import { PageBody } from '@/components/common/page-body';
import { formatDateRangeFilterLabel } from '@/components/grid/grid-date-range-filter';
import { GridColumnDataView } from '@/components/grid/grid-column-data-view';
import { GridColumnsControl } from '@/components/grid/grid-columns-control';
import { getGridRecordCount } from '@/components/grid/grid-record-count';
import { parseMultiFilterValue } from '@/components/grid/grid-multi-value-filter';
import { GridPanel } from '@/components/grid/grid-panel';
import { GridPagination } from '@/components/grid/grid-pagination';
import { GridQuickFilters } from '@/components/grid/grid-quick-filters';
import { GridResetControl } from '@/components/grid/grid-reset-control';
import { GridRowActions } from '@/components/grid/grid-row-actions';
import { GridViewModeControl } from '@/components/grid/grid-view-mode-control';
import {
  GridPanelToolbar,
  GridToolbarButton,
  GridToolbarGroup,
  StandardGridToolbar,
} from '@/components/grid/grid-toolbar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

const GRID_COLUMNS_KEY = 'grid-columns:notifications';

export function NotificationsPage() {
  const { t } = useTranslation();
  const readStatusFilterOptions = useReadUnreadFilterOptions();
  const categoryFilterOptions = useNotificationCategoryFilterOptions();
  const navigate = useNavigate();
  const { open: openPreferences } = useNotificationPreferencesSheet();
  const notificationsMenu = useApiMenuByPath('/notifications');
  const notificationPreferencesMenu = useApiMenuByPath('/notification-preferences');
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useApiToolbarAlert();
  const { viewMode, setViewMode, infiniteScrollEnabled } = useGridViewMode(VIEW_PREFERENCE_KEYS.notifications);
  const grid = useGrid();
  const columnFilters = useGridFilters(() => grid.setPage(1));
  const [activeFilter, setActiveFilter] = useState<NotificationQuickFilter>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewingNotification, setViewingNotification] = useState<AppNotification | null>(null);
  const selectedRef = useRef<string[]>([]);
  selectedRef.current = selected;

  const [knownTotal, setKnownTotal] = useState(0);

  const listParams = useMemo(
    () => ({
      page: grid.page,
      perPage: grid.resolvePerPage(knownTotal),
      search: grid.debouncedSearch,
      quickFilter: activeFilter,
      columnFilters: columnFilters.activeFilterParams,
      sort: grid.sort,
      direction: grid.sortDir,
    }),
    [
      activeFilter,
      columnFilters.activeFilterParams,
      grid.debouncedSearch,
      grid.page,
      grid.perPage,
      grid.resolvePerPage,
      grid.sort,
      grid.sortDir,
      knownTotal,
    ],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['notifications', listParams],
    queryFn: () => notificationsService.list(listParams),
    refetchInterval: 30000,
  });

  const notifications = data?.data.result.data ?? [];
  const meta = data?.data.result.meta ?? {
    current_page: 1,
    last_page: 1,
    per_page: grid.perPage,
    total: 0,
    unread: 0,
  };

  useEffect(() => {
    if (meta.total > 0) {
      setKnownTotal(meta.total);
    }
  }, [meta.total]);

  const infiniteScroll = useGridInfiniteScroll<AppNotification>({
    enabled: infiniteScrollEnabled,
    page: grid.page,
    setPage: grid.setPage,
    loading: isLoading,
    perPage: grid.perPage,
    meta,
    resetDeps: [
      grid.debouncedSearch,
      grid.sort,
      grid.sortDir,
      columnFilters.activeFilterParams,
      activeFilter,
      infiniteScrollEnabled,
    ],
  });

  useEffect(() => {
    if (!isLoading) {
      infiniteScroll.receivePage(notifications, grid.page);
    }
  }, [notifications, grid.page, isLoading, infiniteScroll.receivePage]);

  const displayNotifications = infiniteScrollEnabled ? infiniteScroll.items : notifications;

  const reportCount = useMemo(
    () => notifications.filter(isReportNotification).length,
    [notifications],
  );
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications],
  );
  const readCount = useMemo(
    () => notifications.filter((notification) => Boolean(notification.read_at)).length,
    [notifications],
  );

  const PreferencesIcon = notificationPreferencesMenu
    ? resolveMenuIcon({
      icon: notificationPreferencesMenu.icon,
      path: notificationPreferencesMenu.path,
      slug: notificationPreferencesMenu.slug,
      title: notificationPreferencesMenu.title,
    })
    : Settings;

  const activeViewNotification = useMemo(() => {
    if (!viewingNotification) return null;
    return notifications.find((item) => item.id === viewingNotification.id) ?? viewingNotification;
  }, [notifications, viewingNotification]);

  const syncViewingNotification = useCallback((notification: AppNotification) => {
    setViewingNotification((current) => (
      current?.id === notification.id ? notification : current
    ));
  }, []);

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: (response) => {
      const updated = response.data.result;
      upsertNotificationInCache(queryClient, updated);
      syncViewingNotification(updated);
      showSuccess(t('notifications.marked_read'));
    },
    onError: (error) => showError('Erro ao marcar notificação como lida.', error),
  });

  const markAsUnreadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markAsUnread(id),
    onSuccess: (response) => {
      const updated = response.data.result;
      upsertNotificationInCache(queryClient, updated);
      syncViewingNotification(updated);
      showSuccess(t('notifications.marked_unread'));
    },
    onError: (error) => showError('Erro ao marcar notificação como não lida.', error),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => {
      markAllNotificationsReadInCache(queryClient);
      setSelected([]);
      showSuccess('Todas marcadas como lidas.');
    },
    onError: (error) => showError('Erro ao marcar notificações.', error),
  });

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const clearSelection = useCallback(() => setSelected([]), []);

  const toggleSelectAll = useCallback((ids: string[]) => {
    setSelected((prev) => (prev.length === ids.length ? [] : ids));
  }, []);

  const handleDownloadReport = useCallback(async (notification: AppNotification) => {
    const { templateId, executionId, templateName } = getReportDownloadMeta(notification);
    if (!templateId || !executionId) {
      showError('Dados do relatório indisponíveis.');
      return;
    }

    try {
      setDownloadingId(notification.id);
      await downloadReportResultCsvWithToast(templateId, executionId, templateName);
      if (!notification.read_at) {
        const response = await notificationsService.markAsRead(notification.id);
        upsertNotificationInCache(queryClient, response.data.result);
      }
    } catch {
      // Toast de erro já exibido pelo helper de download.
    } finally {
      setDownloadingId(null);
    }
  }, [queryClient, showError]);

  const handleMarkSelectedRead = useCallback(async () => {
    const ids = selectedRef.current;
    if (ids.length === 0) return;

    try {
      const responses = await Promise.all(ids.map((id) => notificationsService.markAsRead(id)));
      responses.forEach((response) => {
        upsertNotificationInCache(queryClient, response.data.result);
      });
      showSuccess(ids.length === 1 ? 'Notificação marcada como lida.' : 'Notificações marcadas como lidas.');
      clearSelection();
    } catch (error) {
      showError('Erro ao marcar notificações.', error);
      void invalidateNotifications(queryClient);
    }
  }, [clearSelection, queryClient, showError, showSuccess]);

  const handleMarkSelectedUnread = useCallback(async () => {
    const ids = selectedRef.current;
    if (ids.length === 0) return;

    try {
      const responses = await Promise.all(ids.map((id) => notificationsService.markAsUnread(id)));
      responses.forEach((response) => {
        upsertNotificationInCache(queryClient, response.data.result);
      });
      showSuccess(
        ids.length === 1
          ? 'Notificação marcada como não lida.'
          : 'Notificações marcadas como não lidas.',
      );
      clearSelection();
    } catch (error) {
      showError('Erro ao marcar notificações.', error);
      void invalidateNotifications(queryClient);
    }
  }, [clearSelection, queryClient, showError, showSuccess]);

  const handleViewNotification = useCallback((notification: AppNotification) => {
    setViewingNotification(notification);
  }, []);

  const handleDelete = useCallback(async () => {
    if (deleteIds.length === 0) return;
    try {
      setIsDeleting(true);
      await Promise.all(deleteIds.map((id) => {
        removeNotificationFromCache(queryClient, id);
        return notificationsService.destroy(id);
      }));
      void invalidateNotifications(queryClient);
      showSuccess(deleteIds.length === 1 ? 'Notificação removida.' : 'Notificações removidas.');
      setDeleteIds([]);
      clearSelection();
    } catch (error) {
      showError('Erro ao remover notificações.', error);
    } finally {
      setIsDeleting(false);
    }
  }, [clearSelection, deleteIds, queryClient, showError, showSuccess]);

  const visibleIds = notifications.map((notification) => notification.id);
  const allVisibleSelected = visibleIds.length > 0
    && visibleIds.every((id) => selected.includes(id));

  const columnDefinitions = useMemo<GridColumnDef<AppNotification>[]>(
    () => [
      {
        id: 'select',
        label: '#',
        pinned: 'start',
        hideable: false,
        className: 'w-[40px]',
        render: (notification) => (
          <Checkbox
            checked={selected.includes(notification.id)}
            onCheckedChange={() => toggleSelect(notification.id)}
            onClick={(event) => event.stopPropagation()}
          />
        ),
      },
      {
        id: 'id',
        label: 'Id',
        sortable: true,
        sortKey: 'record_id',
        className: 'w-[70px] text-sm text-muted-foreground',
        filter: { type: 'multi', filterKey: 'id', placeholder: 'ID', inputMode: 'numeric' },
        render: (notification) => {
          const recordId = getNotificationRecordId(notification);

          return (
            <span className="tabular-nums">{recordId ?? '—'}</span>
          );
        },
      },
      {
        id: 'actions',
        label: 'Ações',
        hideable: false,
        className: 'min-w-[100px] w-[100px]',
        render: (notification) => (
          <GridRowActions
            actions={[
              {
                label: 'Visualizar',
                icon: Eye,
                onClick: () => handleViewNotification(notification),
              },
              ...(isReportNotification(notification)
                ? [
                    {
                      label: 'Download',
                      icon: GRID_DOWNLOAD_ICON,
                      onClick: () => void handleDownloadReport(notification),
                      disabled: downloadingId === notification.id,
                    },
                    {
                      label: 'Ver execuções',
                      icon: ExternalLink,
                      onClick: () => navigate('/reports/executions'),
                    },
                  ]
                : []),
              {
                label: 'Remover',
                icon: Trash2,
                tone: 'destructive' as const,
                onClick: () => setDeleteIds([notification.id]),
              },
            ]}
          />
        ),
      },
      {
        id: 'read',
        label: 'Lida',
        sortable: true,
        sortKey: 'read_at',
        className: 'w-[80px]',
        filter: {
          type: 'select',
          filterKey: 'read_status',
          placeholder: 'Lida',
          options: readStatusFilterOptions,
        },
        render: (notification) => {
          const isToggling = (
            (markAsReadMutation.isPending && markAsReadMutation.variables === notification.id)
            || (markAsUnreadMutation.isPending && markAsUnreadMutation.variables === notification.id)
          );

          return (
            <div
              className="flex justify-start"
              onClick={(event) => event.stopPropagation()}
            >
              <Switch
                checked={Boolean(notification.read_at)}
                disabled={isToggling}
                onCheckedChange={(checked) => {
                  if (checked) {
                    markAsReadMutation.mutate(notification.id);
                  } else {
                    markAsUnreadMutation.mutate(notification.id);
                  }
                }}
              />
            </div>
          );
        },
      },
      {
        id: 'title',
        label: 'Notificação',
        sortable: true,
        sortKey: 'title',
        className: 'min-w-[240px]',
        filter: { type: 'text', filterKey: 'title', placeholder: 'Notificação' },
        render: (notification) => (
          <p
            className={`truncate text-sm ${
              notification.read_at ? 'text-muted-foreground' : 'text-foreground'
            }`}
          >
            {getNotificationTitle(notification)}
          </p>
        ),
      },
      {
        id: 'category',
        label: 'Categoria',
        sortable: true,
        sortKey: 'category',
        className: 'min-w-[8rem] w-[10rem]',
        filter: {
          type: 'select',
          filterKey: 'category',
          placeholder: 'Categoria',
          options: categoryFilterOptions,
        },
        render: (notification) => (
          <p className="truncate text-sm text-muted-foreground">
            {getNotificationCategoryDisplay(notification)}
          </p>
        ),
      },
      {
        id: 'created_at',
        label: 'Recebida',
        sortable: true,
        sortKey: 'created_at',
        className: 'min-w-[11rem] w-[11rem] whitespace-nowrap',
        filter: { type: 'dateRange', filterKey: 'created_at', placeholder: 'Período' },
        render: (notification) => (
          <span className="whitespace-nowrap">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        ),
      },
    ],
    [categoryFilterOptions, downloadingId, handleDownloadReport, handleViewNotification, markAsReadMutation, markAsUnreadMutation, navigate, readStatusFilterOptions, selected, toggleSelect],
  );

  const gridColumns = useGridColumns(GRID_COLUMNS_KEY, columnDefinitions);


  const gridActions = useGridPageActions({
    resetColumns: gridColumns.resetColumns,
    clearAllFilters: columnFilters.clearAllFilters,
    clearSearch: grid.clearSearch,
  });

  const gridToasts = useGridToasts();

  const handleResetGrid = useCallback(() => {
    gridColumns.resetColumns();
    grid.resetSettings();
    columnFilters.clearAllFilters();
    setActiveFilter('all');
    clearSelection();
    gridToasts.gridRestored();
  }, [clearSelection, columnFilters, grid, gridColumns, gridToasts]);

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

  const handleFilterChange = useCallback((value: NotificationQuickFilter) => {
    setActiveFilter(value);
    clearSelection();
    grid.setPage(1);
  }, [clearSelection, grid]);

  const isGridCustomized = grid.isCustomized
    || gridColumns.isCustomized
    || columnFilters.hasFilters
    || activeFilter !== 'all';

  usePageToolbar({
    title: notificationsMenu?.title ?? 'Minhas notificações',
    description: 'Central de notificações do sistema.',
    headerActions: (
      <Button
        type="button"
        variant="primary"
        size="sm"
        aria-label={notificationPreferencesMenu?.title ?? NOTIFICATION_PREFERENCES_TITLE}
        onClick={() => openPreferences()}
      >
        <PreferencesIcon className="size-4" />
        {NOTIFICATION_PREFERENCES_TITLE}
      </Button>
    ),
    actions: (
      <StandardGridToolbar
        onDelete={() => selectedRef.current.length > 0 && setDeleteIds([...selectedRef.current])}
        hasSelection={selected.length > 0}
        extra={(
          <GridToolbarGroup>
            <GridToolbarButton
              label="Marcar todas como lidas"
              icon={CheckCheck}
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending || meta.unread === 0}
              loading={markAllMutation.isPending}
            />
            <GridToolbarButton
              label="Marcar selecionadas como lidas"
              icon={Check}
              onClick={() => void handleMarkSelectedRead()}
              disabled={selected.length === 0}
            />
            <GridToolbarButton
              label="Marcar selecionadas como não lidas"
              icon={MailOpen}
              onClick={() => void handleMarkSelectedUnread()}
              disabled={selected.length === 0}
            />
            {activeFilter === 'reports' && (
              <Button variant="outline" size="sm" className="h-8" asChild>
                <Link to="/reports/executions">
                  <ExternalLink className="mr-1 size-3.5" />
                  Ver execuções
                </Link>
              </Button>
            )}
          </GridToolbarGroup>
        )}
      />
    ),
  });

  const emptyMessage = activeFilter === 'reports'
    ? 'Nenhuma notificação de relatório encontrada.'
    : activeFilter === 'unread'
      ? 'Nenhuma notificação não lida encontrada.'
      : activeFilter === 'read'
        ? 'Nenhuma notificação lida encontrada.'
        : 'Nenhuma notificação encontrada.';

  return (
    <PageBody>
      <GridPanel
        toolbar={(
          <GridPanelToolbar
            onSelectAll={() => toggleSelectAll(visibleIds)}
            isAllSelected={allVisibleSelected}
            selectedCount={selected.length}
            onClearSelection={clearSelection}
            onRefresh={() => void invalidateNotifications(queryClient)}
            isRefreshing={isLoading || isFetching}
            search={grid.search}
            onSearch={grid.setSearch}
            filters={{
              active: activeFilters,
              onClearAll: activeFilters.length > 0 ? gridActions.handleClearFilters : undefined,
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
                onResetDefault={gridColumns.resetColumns}
              />
            )}
            resetControl={(
              <GridResetControl
                disabled={!isGridCustomized}
                onReset={handleResetGrid}
              />
            )}
            viewModeControl={
              <GridViewModeControl viewMode={viewMode} onViewModeChange={setViewMode} />
            }
            quickFiltersControl={(
              <GridQuickFilters
                value={activeFilter}
                onChange={handleFilterChange}
                defaultValue="all"
                options={[
                  { value: 'all', label: 'Todas', count: notifications.length },
                  { value: 'unread', label: 'Não lidas', count: unreadCount },
                  { value: 'read', label: 'Lidas', count: readCount },
                  { value: 'reports', label: 'Relatórios', icon: BarChart2, count: reportCount },
                ]}
              />
            )}
            recordCount={getGridRecordCount(knownTotal || meta.total, displayNotifications.length, infiniteScrollEnabled)}
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
          data={notifications}
          cardData={infiniteScrollEnabled ? displayNotifications : undefined}
          getRowKey={(notification) => notification.id}
          loading={isLoading}
          emptyMessage={emptyMessage}
          infiniteScroll={buildServerGridInfiniteScrollProps({
            enabled: infiniteScrollEnabled,
            infiniteScroll,
            loading: isLoading,
          })}
          onColumnOrderChange={gridColumns.reorderDraggableColumns}
          sort={grid.sort}
          sortDir={grid.sortDir}
          onSort={grid.toggleSort}
          isRowSelected={(notification) => selected.includes(notification.id)}
          onRowClick={handleViewNotification}
          columnFilters={columnFilters.filters}
          onColumnFilterChange={columnFilters.setFilter}
          onDateRangeFilterChange={columnFilters.setDateRangeFilter}
          onColumnFilterClear={columnFilters.clearColumnFilter}
        />
      </GridPanel>

      <NotificationDetailSheet
        notification={activeViewNotification}
        open={activeViewNotification !== null}
        onOpenChange={(open) => {
          if (!open) setViewingNotification(null);
        }}
        onMarkRead={(id) => markAsReadMutation.mutate(id)}
        onMarkUnread={(id) => markAsUnreadMutation.mutate(id)}
        onDelete={(id) => setDeleteIds([id])}
      />

      <AlertDialog open={deleteIds.length > 0} onOpenChange={(open) => !open && setDeleteIds([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogPanelTitle icon={Trash2}>
              Remover {deleteIds.length === 1 ? 'notificação' : `${deleteIds.length} notificações`}
            </AlertDialogPanelTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação não pode ser desfeita.
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
