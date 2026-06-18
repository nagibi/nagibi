import type { ViewMode } from '@/types/view-mode';
import type { GridPaginationMeta } from '@/components/grid/grid-pagination';
import { isGridPerPageAll, resolveGridPerPageForSlice } from '@/lib/grid-pagination-config';

import type { GridInfiniteScrollConfig } from '@/components/grid/data-view';

export function shouldUseGridInfiniteScroll(isMobile: boolean, viewMode: ViewMode) {
  return isMobile && viewMode !== 'table';
}

export function getGridInfiniteHasMore(options: {
  enabled: boolean;
  page: number;
  perPage: number;
  meta?: Pick<GridPaginationMeta, 'current_page' | 'last_page'>;
  clientTotal?: number;
}) {
  if (!options.enabled) return false;

  if (isGridPerPageAll(options.perPage)) {
    return false;
  }

  if (options.meta) {
    return options.meta.current_page < options.meta.last_page;
  }

  if (options.clientTotal != null) {
    return options.page * options.perPage < options.clientTotal;
  }

  return false;
}

export function getClientInfiniteSlice<T>(items: T[], page: number, perPage: number) {
  const effectivePerPage = resolveGridPerPageForSlice(perPage, items.length);
  return items.slice(0, page * effectivePerPage);
}

export function appendGridInfinitePage<T>(previous: T[], pageItems: T[], page: number) {
  if (page === 1) {
    if (previous.length === 0 && pageItems.length === 0) {
      return previous;
    }

    if (
      previous.length === pageItems.length
      && previous.every((item, index) => item === pageItems[index])
    ) {
      return previous;
    }

    return pageItems;
  }

  return [...previous, ...pageItems];
}

export function buildServerGridInfiniteScrollProps(options: {
  enabled: boolean;
  infiniteScroll: {
    hasMore: boolean;
    loadMore: () => void;
    loadingMore: boolean;
    loadedCount: number;
    total: number;
  };
  loading: boolean;
}): GridInfiniteScrollConfig | undefined {
  if (!options.enabled) return undefined;

  return {
    enabled: true,
    hasMore: options.infiniteScroll.hasMore,
    loading: options.loading,
    loadingMore: options.infiniteScroll.loadingMore,
    onLoadMore: options.infiniteScroll.loadMore,
    loadedCount: options.infiniteScroll.loadedCount,
    total: options.infiniteScroll.total,
  };
}

export function buildClientGridInfiniteScrollProps(options: {
  enabled: boolean;
  clientInfinite: {
    hasMore: boolean;
    loadMore: () => void;
    loadedCount: number;
    total: number;
  };
}): GridInfiniteScrollConfig | undefined {
  if (!options.enabled) return undefined;

  return {
    enabled: true,
    hasMore: options.clientInfinite.hasMore,
    onLoadMore: options.clientInfinite.loadMore,
    loadedCount: options.clientInfinite.loadedCount,
    total: options.clientInfinite.total,
  };
}
