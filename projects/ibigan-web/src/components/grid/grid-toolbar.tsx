import type { ReactNode } from 'react';
import i18n from '@/i18n/i18next';
import type { VariantProps } from 'class-variance-authority';
import {
  Eye,
  LoaderCircle,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  GridFiltersControl,
  type GridActiveFilter,
  type GridColumnFiltersConfig,
} from './grid-filters-control';
import {
  GridMobileRecordCountBar,
  type GridRecordCountInfo,
} from './grid-record-count';
import {
  formatToolbarSelectedCount,
  ToolbarAlertHost,
  type ToolbarAlertConfig,
} from './toolbar-alert';
import { ToolbarTooltip } from './toolbar-tooltip';

export interface GridPanelFiltersConfig {
  active: GridActiveFilter[];
  onClearAll?: () => void;
  columnFilters?: GridColumnFiltersConfig;
}

export function GridToolbarRoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-start gap-0.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function GridToolbarGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('flex min-w-0 flex-wrap items-center gap-0.5', className)}
    >
      {children}
    </div>
  );
}

export function GridToolbarSpacer() {
  return <div className="flex-1" />;
}

export function GridToolbarButton({
  label,
  tooltip,
  icon: Icon,
  onClick,
  disabled,
  loading,
  tone,
  className,
}: {
  label: string;
  tooltip?: string;
  icon?: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
}) {
  const isMobile = useIsMobile();
  const toneClass = {
    default: '',
    success: 'text-green-600 hover:text-green-700',
    warning: 'text-orange-500 hover:text-orange-600',
    destructive: 'text-destructive hover:text-destructive/90',
  }[tone ?? 'default'];

  return (
    <ToolbarTooltip content={tooltip ?? label}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        mode={isMobile ? 'icon' : 'default'}
        disabled={disabled || loading}
        onClick={onClick}
        aria-label={label}
        className={cn(
          'h-8 shrink-0 text-xs font-medium',
          isMobile ? 'size-8' : 'gap-1.5 px-2',
          toneClass,
          className,
        )}
      >
        {Icon && <Icon className="size-3.5 shrink-0" />}
        {!isMobile && label}
      </Button>
    </ToolbarTooltip>
  );
}

export function GridToolbarIconButton({
  label,
  tooltip,
  icon: Icon,
  onClick,
  disabled,
  loading,
  tone,
}: {
  label: string;
  tooltip?: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
}) {
  const toneClass = {
    default: '',
    success: 'text-green-600 hover:text-green-700',
    warning: 'text-orange-500 hover:text-orange-600',
    destructive: 'text-destructive hover:text-destructive/90',
  }[tone ?? 'default'];

  return (
    <ToolbarTooltip content={tooltip ?? label}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        mode="icon"
        disabled={disabled || loading}
        onClick={onClick}
        className={cn('size-8 shrink-0', toneClass)}
      >
        <Icon className="size-4" />
      </Button>
    </ToolbarTooltip>
  );
}

export function GridToolbarPrimary({
  label,
  tooltip,
  icon: Icon,
  onClick,
  disabled,
  loading,
  variant = 'primary',
}: {
  label: string;
  tooltip?: string;
  icon?: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: VariantProps<typeof buttonVariants>['variant'];
}) {
  return (
    <ToolbarTooltip content={tooltip ?? label}>
      <Button
        type="button"
        variant={variant}
        size="sm"
        mode="default"
        disabled={disabled || loading}
        onClick={onClick}
        aria-label={label}
        className="h-8 shrink-0 gap-1.5 px-2.5"
      >
        {loading ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin" />
        ) : (
          Icon && <Icon className="size-4 shrink-0" />
        )}
        {label}
      </Button>
    </ToolbarTooltip>
  );
}

export function GridToolbarSearch({
  value,
  onChange,
  placeholder = i18n.t('grid.search_placeholder'),
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative w-full min-w-0', className)}>
      <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 w-full min-w-0 pl-7 text-xs sm:w-56"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          mode="icon"
          className="absolute right-0 top-1/2 size-5 -translate-y-1/2"
          onClick={() => onChange('')}
        >
          <X className="size-2.5" />
        </Button>
      )}
    </div>
  );
}

export function buildSelectionAlert(
  selectedCount: number,
  onClearSelection?: () => void,
): ToolbarAlertConfig | null {
  if (selectedCount <= 0) return null;

  const clearSelectionLabel = i18n.t('grid.clear_selection');

  return {
    variant: 'info',
    title: formatToolbarSelectedCount(selectedCount),
    autoDismissMs: false,
    id: selectedCount,
    onClose: onClearSelection,
    icon: (
      <Checkbox
        checked
        onCheckedChange={(checked) => {
          if (checked === false) onClearSelection?.();
        }}
        aria-label={clearSelectionLabel}
      />
    ),
    actions: onClearSelection ? (
      <GridToolbarIconButton
        label={clearSelectionLabel}
        icon={X}
        onClick={onClearSelection}
      />
    ) : undefined,
  };
}

export interface GridPanelToolbarProps {
  onSelectAll?: () => void;
  isAllSelected?: boolean;
  selectAllLabel?: string;
  selectedCount?: number;
  onClearSelection?: () => void;

  onRefresh?: () => void;
  isRefreshing?: boolean;

  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;

  columnsControl?: ReactNode;
  /** @deprecated Prefer `filters` — search is wired automatically on mobile. */
  filtersControl?: ReactNode;
  filters?: GridPanelFiltersConfig;
  resetControl?: ReactNode;
  quickFiltersControl?: ReactNode;
  viewModeControl?: ReactNode;
  /** Total de registros exibido abaixo da toolbar no mobile. */
  recordCount?: GridRecordCountInfo;
}

export function GridPanelToolbar({
  onSelectAll,
  isAllSelected = false,
  selectAllLabel,
  selectedCount = 0,
  onClearSelection,
  onRefresh,
  isRefreshing,
  search,
  onSearch,
  searchPlaceholder,
  columnsControl,
  filtersControl,
  filters,
  resetControl,
  quickFiltersControl,
  viewModeControl,
  recordCount,
}: GridPanelToolbarProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const resolvedSelectAllLabel = selectAllLabel ?? t('grid.select_all');
  const resolvedSearchPlaceholder =
    searchPlaceholder ?? t('grid.search_placeholder');
  const selectionAlert = buildSelectionAlert(selectedCount, onClearSelection);
  const resolvedFiltersControl =
    filtersControl ??
    (filters ? (
      <GridFiltersControl
        filters={filters.active}
        onClearAll={filters.onClearAll}
        columnFilters={filters.columnFilters}
        search={search}
        onSearch={onSearch}
        searchPlaceholder={resolvedSearchPlaceholder}
      />
    ) : null);
  const hideToolbarSearchOnMobile = isMobile && Boolean(filters);

  return (
    <div className="border-b border-border">
      <ToolbarAlertHost
        alert={selectionAlert}
        contentClassName="px-3 py-1.5 xl:px-4 xl:py-2.5"
      >
        <div className="flex w-full flex-col gap-1.5 xl:flex-row xl:items-center xl:gap-3">
          <div className="flex w-full min-w-0 flex-wrap items-center gap-0.5 xl:flex-1">
            {onSelectAll && (
              <ToolbarTooltip content={t('grid.tooltip.select_all')}>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 pe-1 text-xs font-medium text-muted-foreground">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={onSelectAll}
                  />
                  <span className="hidden sm:inline">
                    {resolvedSelectAllLabel}
                  </span>
                </label>
              </ToolbarTooltip>
            )}
            {onRefresh && !isMobile && (
              <GridToolbarButton
                label={t('grid.refresh')}
                tooltip={t('grid.tooltip.refresh')}
                icon={RefreshCw}
                onClick={onRefresh}
                loading={isRefreshing}
              />
            )}
            {resolvedFiltersControl}
            {columnsControl}
            {resetControl}
            {viewModeControl}
          </div>

          {quickFiltersControl || (onSearch && !hideToolbarSearchOnMobile) ? (
            <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:shrink-0">
              {quickFiltersControl}
              {onSearch && !hideToolbarSearchOnMobile ? (
                <div className="min-w-0 flex-1 xl:w-56">
                  <GridToolbarSearch
                    value={search ?? ''}
                    onChange={onSearch}
                    placeholder={resolvedSearchPlaceholder}
                    className="w-full"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </ToolbarAlertHost>
      {recordCount != null ? (
        <GridMobileRecordCountBar
          total={recordCount.total}
          loaded={recordCount.loaded}
        />
      ) : null}
    </div>
  );
}

export interface StandardGridToolbarProps {
  onNew?: () => void;
  newLabel?: string;
  newVariant?: VariantProps<typeof buttonVariants>['variant'];

  onEdit?: () => void;
  onDelete?: () => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
  hasSelection?: boolean;
  singleSelection?: boolean;
  isTogglingActive?: boolean;

  onRefresh?: () => void;
  isRefreshing?: boolean;

  search?: string;
  onSearch?: (v: string) => void;

  extra?: ReactNode;
}

export function StandardGridToolbar({
  onNew,
  newLabel,
  newVariant = 'primary',
  onEdit,
  onDelete,
  onActivate,
  onDeactivate,
  hasSelection = false,
  singleSelection = false,
  isTogglingActive = false,
  onRefresh,
  isRefreshing,
  search,
  onSearch,
  extra,
}: StandardGridToolbarProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const resolvedNewLabel = newLabel ?? t('common.new');

  return (
    <GridToolbarRoot>
      {onNew && (
        <GridToolbarPrimary
          label={resolvedNewLabel}
          tooltip={t('grid.tooltip.new')}
          icon={Plus}
          onClick={onNew}
          variant={newVariant}
        />
      )}
      {onEdit && (
        <GridToolbarButton
          label={t('common.view')}
          tooltip={t('grid.tooltip.view')}
          icon={Eye}
          disabled={!singleSelection}
          onClick={onEdit}
        />
      )}
      {onActivate && (
        <GridToolbarButton
          label={t('common.activate')}
          tooltip={t('grid.tooltip.activate')}
          icon={Power}
          disabled={!hasSelection || isTogglingActive}
          loading={isTogglingActive}
          onClick={onActivate}
        />
      )}
      {onDeactivate && (
        <GridToolbarButton
          label={t('common.deactivate')}
          tooltip={t('grid.tooltip.deactivate')}
          icon={PowerOff}
          disabled={!hasSelection || isTogglingActive}
          loading={isTogglingActive}
          onClick={onDeactivate}
        />
      )}
      {onDelete && (
        <GridToolbarButton
          label={t('common.delete')}
          tooltip={t('grid.tooltip.delete')}
          icon={Trash2}
          disabled={!hasSelection}
          onClick={onDelete}
        />
      )}
      {onRefresh && !isMobile && (
        <GridToolbarButton
          label={t('grid.refresh')}
          tooltip={t('grid.tooltip.refresh')}
          icon={RefreshCw}
          onClick={onRefresh}
          loading={isRefreshing}
        />
      )}
      {onSearch && (
        <GridToolbarSearch
          value={search ?? ''}
          onChange={onSearch}
          placeholder={t('grid.search_placeholder')}
        />
      )}
      {extra}
    </GridToolbarRoot>
  );
}
