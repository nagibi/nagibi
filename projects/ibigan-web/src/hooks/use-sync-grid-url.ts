import { useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SortDirection } from '@/hooks/use-grid';
import {
  buildGridUrlSearchParams,
  gridUrlSearchParamsAreEqual,
} from '@/lib/grid-url-state';
import type { RolesUserFilter } from '@/lib/roles-user-filter';

interface SyncGridUrlInput {
  page?: number;
  perPage?: number;
  search?: string;
  debouncedSearch: string;
  sort?: string | null;
  sortDir?: SortDirection;
  filters?: Record<string, string>;
  debouncedFilters?: Record<string, string>;
  userFilter?: RolesUserFilter | null;
  contextFilter?: string | null;
  syncPagination?: boolean;
  syncSort?: boolean;
  syncColumnFilters?: boolean;
}

function resolveSearchForUrl(immediate = '', debounced = ''): string {
  const debouncedValue = debounced.trim();
  if (debouncedValue) return debouncedValue;
  return immediate.trim();
}

function mergeGridFiltersForUrl(
  immediate?: Record<string, string>,
  debounced?: Record<string, string>,
): Record<string, string> {
  const merged = { ...(debounced ?? {}) };

  for (const [key, value] of Object.entries(immediate ?? {})) {
    if (value.trim()) {
      merged[key] = value.trim();
    } else {
      delete merged[key];
    }
  }

  return merged;
}

export function useSyncGridUrl({
  page,
  perPage,
  search,
  debouncedSearch,
  sort,
  sortDir,
  filters,
  debouncedFilters,
  userFilter,
  contextFilter,
  syncPagination = true,
  syncSort = true,
  syncColumnFilters = true,
}: SyncGridUrlInput): void {
  const [searchParams, setSearchParams] = useSearchParams();

  useLayoutEffect(() => {
    const filtersForUrl = syncColumnFilters
      ? mergeGridFiltersForUrl(filters, debouncedFilters)
      : undefined;

    const next = buildGridUrlSearchParams({
      page: syncPagination ? page : undefined,
      perPage: syncPagination ? perPage : undefined,
      search: resolveSearchForUrl(search, debouncedSearch),
      sort: syncSort ? sort : null,
      sortDir: syncSort ? sortDir : 'asc',
      filters: filtersForUrl,
      userFilter,
      contextFilter,
    });

    if (gridUrlSearchParamsAreEqual(searchParams, next)) return;

    setSearchParams(next, { replace: true });
  }, [
    debouncedFilters,
    debouncedSearch,
    filters,
    page,
    perPage,
    search,
    searchParams,
    setSearchParams,
    sort,
    sortDir,
    syncColumnFilters,
    syncPagination,
    syncSort,
    userFilter,
    contextFilter,
  ]);
}
