import { useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GRID_URL_KEYS } from '@/lib/grid-url-state';

/**
 * Keeps grid search in sync when the URL `q` param changes (e.g. deep links
 * from notifications). User typing still flows grid → URL via useSyncGridUrl.
 */
export function useGridUrlSearchSync(setSearch: (value: string) => void): void {
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get(GRID_URL_KEYS.search)?.trim() ?? '';

  useLayoutEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch, setSearch]);
}
