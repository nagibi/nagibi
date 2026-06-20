import { Check, Filter, FilterX, Search, X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import { GridFilterBadge } from '@/components/grid/grid-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DialogPanelTitle } from '@/components/common/panel-title';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ToolbarTooltip } from '@/components/grid/toolbar-tooltip';
import {
  GridColumnFiltersPanel,
  type GridColumnFiltersConfig,
} from '@/components/grid/grid-column-filters-panel';

export interface GridActiveFilter {
  id: string;
  label: string;
  value: string;
  onRemove?: () => void;
}

export type { GridColumnFiltersConfig };

export function ClearFiltersButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      className={cn('gap-1.5', className)}
      onClick={onClick}
    >
      <FilterX className="size-3.5 shrink-0" />
      {t('grid.clear_filters')}
    </Button>
  );
}

export interface GridFiltersControlProps {
  filters: GridActiveFilter[];
  onClearAll?: () => void;
  columnFilters?: GridColumnFiltersConfig;
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  triggerVariant?: 'ghost' | 'outline';
  triggerClassName?: string;
  quickFiltersSection?: ReactNode;
}

function FiltersTriggerButton({
  hasFilters,
  isMobile,
  label,
  className,
  variant = 'ghost',
  ...props
}: ComponentProps<typeof Button> & {
  hasFilters: boolean;
  isMobile: boolean;
  label: string;
  variant?: 'ghost' | 'outline';
}) {
  const isOutlineIcon = variant === 'outline' && isMobile;

  return (
    <Button
      type="button"
      variant={isOutlineIcon ? 'outline' : variant}
      size={isOutlineIcon ? 'icon' : 'sm'}
      mode={isMobile && !isOutlineIcon ? 'icon' : isOutlineIcon ? undefined : 'default'}
      aria-label={label}
      className={cn(
        'relative shrink-0',
        isOutlineIcon
          ? 'size-9'
          : isMobile
            ? 'size-8'
            : 'h-8 gap-1.5 px-2 text-xs font-medium',
        hasFilters && variant === 'outline'
          ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
          : hasFilters && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
        className,
      )}
      {...props}
    >
      <Filter className={cn('shrink-0', isOutlineIcon ? 'size-4' : 'size-3.5')} />
      {!isMobile && label}
      {hasFilters && (
        <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
      )}
    </Button>
  );
}

function MobileFiltersSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full min-w-0">
      <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full min-w-0 pl-7 text-sm"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          mode="icon"
          className="absolute right-0 top-1/2 size-7 -translate-y-1/2"
          onClick={() => onChange('')}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}

function AppliedFiltersSection({
  filters,
  onClearAll,
  showClearAll = true,
}: {
  filters: GridActiveFilter[];
  onClearAll?: () => void;
  showClearAll?: boolean;
}) {
  const { t } = useTranslation();
  const hasFilters = filters.length > 0;

  if (!hasFilters) {
    return (
      <p className="text-sm text-muted-foreground">{t('grid.no_filters')}</p>
    );
  }

  return (
    <section className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('grid.filters_applied')}
      </p>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <GridFilterBadge
            key={filter.id}
            variant="primary"
            removeLabel={t('grid.remove_filter', { label: filter.label })}
            onRemove={filter.onRemove}
            className="max-w-full"
          >
            <span className="truncate">
              <span className="text-muted-foreground">{filter.label}:</span>{' '}
              {filter.value}
            </span>
          </GridFilterBadge>
        ))}
      </div>
      {showClearAll && onClearAll && (
        <ClearFiltersButton onClick={onClearAll} className="h-8 w-full" />
      )}
    </section>
  );
}

function AppliedFiltersPopoverContent({
  filters,
  onClearAll,
}: {
  filters: GridActiveFilter[];
  onClearAll?: () => void;
}) {
  const { t } = useTranslation();
  const hasFilters = filters.length > 0;

  return (
    <>
      <p className="mb-3 text-sm font-medium">{t('grid.filters_applied')}</p>

      {hasFilters ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <GridFilterBadge
                key={filter.id}
                variant="primary"
                removeLabel={t('grid.remove_filter', { label: filter.label })}
                onRemove={filter.onRemove}
                className="max-w-full"
              >
                <span className="truncate">
                  <span className="text-muted-foreground">{filter.label}:</span>{' '}
                  {filter.value}
                </span>
              </GridFilterBadge>
            ))}
          </div>

          {onClearAll && (
            <ToolbarTooltip
              content={t('grid.tooltip.clear_filters')}
              className="mt-1 flex w-full"
            >
              <ClearFiltersButton
                onClick={onClearAll}
                className="h-8 w-full justify-center px-2"
              />
            </ToolbarTooltip>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('grid.no_filters')}</p>
      )}
    </>
  );
}

function MobileFiltersSheetContent({
  filters,
  onClearAll,
  columnFilters,
  hasColumnFilterInputs,
  search,
  onSearch,
  searchPlaceholder,
  quickFiltersSection,
}: {
  filters: GridActiveFilter[];
  onClearAll?: () => void;
  columnFilters?: GridColumnFiltersConfig;
  hasColumnFilterInputs: boolean;
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  quickFiltersSection?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-5 px-4 py-4 pb-2">
      {onSearch && (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('grid.global_search')}
          </p>
          <MobileFiltersSearch
            value={search ?? ''}
            onChange={onSearch}
            placeholder={searchPlaceholder ?? t('grid.search_placeholder')}
          />
        </section>
      )}

      {quickFiltersSection}

      {hasColumnFilterInputs && columnFilters ? (
        <GridColumnFiltersPanel
          columnFilters={columnFilters}
          appliedFilters={filters}
          onClearAll={onClearAll}
          showAppliedClearAll={false}
        />
      ) : (
        <AppliedFiltersSection
          filters={filters}
          onClearAll={onClearAll}
          showClearAll={false}
        />
      )}
    </div>
  );
}

export function GridFiltersControl({
  filters,
  onClearAll,
  columnFilters,
  search,
  onSearch,
  searchPlaceholder,
  triggerVariant = 'ghost',
  triggerClassName,
  quickFiltersSection,
}: GridFiltersControlProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const hasColumnFilterInputs = useMemo(
    () => Boolean(columnFilters?.columns.some((column) => column.filter)),
    [columnFilters?.columns],
  );

  const hasAnyFilters = filters.length > 0 || Boolean(search?.trim());
  const showMobileSheet = isMobile && (
    hasColumnFilterInputs
    || Boolean(onSearch)
    || Boolean(columnFilters)
  );

  if (showMobileSheet) {
    return (
      <Dialog>
        <ToolbarTooltip content={t('grid.tooltip.filters')}>
          <DialogTrigger asChild>
            <FiltersTriggerButton
              hasFilters={hasAnyFilters}
              isMobile={isMobile}
              label={t('grid.filters')}
              variant={triggerVariant}
              className={triggerClassName}
            />
          </DialogTrigger>
        </ToolbarTooltip>
        <DialogContent
          showCloseButton
          className={cn(
            'grid-filters-mobile-panel w-[calc(100vw-2rem)] max-w-md gap-0 overflow-hidden rounded-xl border p-0',
            'max-xl:fixed max-xl:translate-x-[-50%] max-xl:translate-y-0',
          )}
        >
          <DialogHeader className="mb-0 shrink-0 space-y-0 border-b border-border px-4 py-3 pe-12 text-start">
            <DialogPanelTitle icon={Filter} className="text-base">
              {t('grid.filters')}
            </DialogPanelTitle>
          </DialogHeader>
          <DialogBody className="grid-filters-mobile-scroll mb-0 min-h-0 overflow-y-auto overscroll-contain p-0 [-webkit-overflow-scrolling:touch]">
            <MobileFiltersSheetContent
              filters={filters}
              onClearAll={onClearAll}
              columnFilters={columnFilters}
              hasColumnFilterInputs={hasColumnFilterInputs}
              search={search}
              onSearch={onSearch}
              searchPlaceholder={searchPlaceholder}
              quickFiltersSection={quickFiltersSection}
            />
          </DialogBody>
          <DialogFooter className="grid-filters-mobile-footer shrink-0 flex-col gap-2 border-t border-border bg-background px-4 pb-0 pt-3 sm:flex-col sm:space-x-0">
            {hasAnyFilters && onClearAll && (
              <ClearFiltersButton onClick={onClearAll} className="h-9 w-full" />
            )}
            <DialogClose asChild>
              <Button type="button" variant="primary" className="h-9 w-full gap-1.5">
                <Check className="size-3.5 shrink-0" />
                {t('grid.apply')}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover>
      <ToolbarTooltip content={t('grid.tooltip.filters')}>
        <PopoverTrigger asChild>
          <FiltersTriggerButton
            hasFilters={hasAnyFilters}
            isMobile={isMobile}
            label={t('grid.filters')}
            variant={triggerVariant}
            className={triggerClassName}
          />
        </PopoverTrigger>
      </ToolbarTooltip>
      <PopoverContent align="start" className="w-72 p-3">
        <AppliedFiltersPopoverContent filters={filters} onClearAll={onClearAll} />
      </PopoverContent>
    </Popover>
  );
}
