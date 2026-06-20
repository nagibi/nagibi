import { useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GRID_EQUIPAMENTO_ID_URL_KEY } from '@/lib/grid-url-state';

/**
 * Syncs equipment id filter from URL when navigating via deep links.
 * Only reacts when the URL `id` param itself changes to avoid fighting
 * with debounced grid → URL updates while the user edits filters.
 */
export function useGridEquipamentoIdFilterSync(
  setFilter: (key: string, value: string) => void,
  clearFilter: (key: string) => void,
): void {
  const [searchParams] = useSearchParams();
  const urlId = searchParams.get(GRID_EQUIPAMENTO_ID_URL_KEY)?.trim() ?? '';
  const previousUrlId = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (urlId === previousUrlId.current) return;

    if (urlId) {
      setFilter(GRID_EQUIPAMENTO_ID_URL_KEY, urlId);
    } else {
      clearFilter(GRID_EQUIPAMENTO_ID_URL_KEY);
    }

    previousUrlId.current = urlId;
  }, [urlId, setFilter, clearFilter]);
}
