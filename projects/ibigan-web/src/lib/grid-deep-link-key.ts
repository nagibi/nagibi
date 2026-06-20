import {
  GRID_EQUIPAMENTO_ID_URL_KEY,
  GRID_URL_KEYS,
} from '@/lib/grid-url-state';

/** Forces grid remount when deep-link search params change (notifications). */
export function getGridDeepLinkKey(searchParams: URLSearchParams): string {
  const id = searchParams.get(GRID_EQUIPAMENTO_ID_URL_KEY)?.trim() ?? '';
  const q = searchParams.get(GRID_URL_KEYS.search)?.trim() ?? '';
  return `id:${id}|q:${q}`;
}
