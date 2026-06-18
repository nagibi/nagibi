import { useEffect, useMemo } from 'react';
import { useGridInfiniteScroll } from '@/hooks/use-grid-infinite-scroll';
import type { useGrid } from '@/hooks/use-grid';
import type { useGridFilters } from '@/hooks/use-grid-filters';
import type { CatalogPaginationMeta } from '@/types/equipamento-catalog';

type GridState = ReturnType<typeof useGrid>;
type ColumnFiltersState = ReturnType<typeof useGridFilters>;

function catalogItemsSignature<T extends { id?: number | string }>(items: T[]) {
  if (items.length === 0) {
    return '@empty';
  }

  return items.map((item) => String(item.id ?? '')).join(',');
}

export function useCatalogInfiniteDisplay<T extends { id?: number | string }>({
  items,
  meta,
  isLoading,
  infiniteScrollEnabled,
  grid,
  columnFilters,
}: {
  items: T[];
  meta?: CatalogPaginationMeta;
  isLoading: boolean;
  infiniteScrollEnabled: boolean;
  grid: GridState;
  columnFilters: ColumnFiltersState;
}) {
  const resolvedMeta = meta ?? {
    current_page: grid.page,
    last_page: 1,
    per_page: grid.perPage,
    total: items.length,
  };

  const infiniteScroll = useGridInfiniteScroll<T>({
    enabled: infiniteScrollEnabled,
    page: grid.page,
    setPage: grid.setPage,
    loading: isLoading,
    perPage: grid.perPage,
    meta: resolvedMeta,
    resetDeps: [
      grid.debouncedSearch,
      grid.sort,
      grid.sortDir,
      columnFilters.activeFilterParams,
      infiniteScrollEnabled,
    ],
  });

  const itemsSignature = useMemo(
    () => catalogItemsSignature(items),
    [items],
  );

  useEffect(() => {
    infiniteScroll.receivePage(items, grid.page);
  }, [grid.page, infiniteScroll.receivePage, itemsSignature]);

  const displayItems = infiniteScrollEnabled ? infiniteScroll.items : items;

  return {
    displayItems,
    infiniteScroll,
    resolvedMeta,
  };
}
