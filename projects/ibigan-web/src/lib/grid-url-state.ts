import type { SortDirection } from '@/hooks/use-grid';
import type { RolesUserFilter } from '@/lib/roles-user-filter';
import {
  GRID_PER_PAGE_ALL,
  isGridPerPageAll,
  resolveGridPerPage,
  resolveGridPerPageForSlice,
} from '@/lib/grid-pagination-config';

export const GRID_URL_DEFAULT_PAGE = 1;
export const GRID_URL_DEFAULT_PER_PAGE = 15;

export const GRID_URL_KEYS = {
  page: 'page',
  perPage: 'per_page',
  search: 'q',
  sort: 'sort',
  sortDir: 'dir',
} as const;

export const GRID_CONTEXT_FILTER_URL_KEY = 'filtro';

/** Filtro exato por equipamento (deep links de notificações). */
export const GRID_EQUIPAMENTO_ID_URL_KEY = 'id';

export const ROLES_USER_URL_KEYS = ['user_id', 'user_name', 'roles'] as const;

const RESERVED_URL_KEYS = new Set<string>([
  ...Object.values(GRID_URL_KEYS),
  ...ROLES_USER_URL_KEYS,
  GRID_CONTEXT_FILTER_URL_KEY,
]);

export interface GridUrlState {
  page: number;
  perPage: number;
  search: string;
  sort: string | null;
  sortDir: SortDirection;
  filters: Record<string, string>;
}

export function parseGridUrlState(searchParams: URLSearchParams): GridUrlState {
  const page = Number(searchParams.get(GRID_URL_KEYS.page));
  const perPageRaw = searchParams.get(GRID_URL_KEYS.perPage);
  const sort = searchParams.get(GRID_URL_KEYS.sort);
  const sortDir = searchParams.get(GRID_URL_KEYS.sortDir);

  let perPage = GRID_URL_DEFAULT_PER_PAGE;
  if (perPageRaw === 'all') {
    perPage = GRID_PER_PAGE_ALL;
  } else {
    const parsedPerPage = Number(perPageRaw);
    if (Number.isFinite(parsedPerPage) && parsedPerPage > 0) {
      perPage = parsedPerPage;
    }
  }

  const filters: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (RESERVED_URL_KEYS.has(key) || !value.trim()) return;
    filters[key] = value;
  });

  return {
    page: Number.isFinite(page) && page > 0 ? page : GRID_URL_DEFAULT_PAGE,
    perPage,
    search: searchParams.get(GRID_URL_KEYS.search) ?? '',
    sort: sort?.trim() ? sort : null,
    sortDir: sortDir === 'desc' ? 'desc' : 'asc',
    filters,
  };
}

export function buildGridUrlSearchParams(state: {
  page?: number;
  perPage?: number;
  search?: string;
  sort?: string | null;
  sortDir?: SortDirection;
  filters?: Record<string, string>;
  userFilter?: RolesUserFilter | null;
  contextFilter?: string | null;
}): URLSearchParams {
  const params = new URLSearchParams();

  if (state.page && state.page !== GRID_URL_DEFAULT_PAGE) {
    params.set(GRID_URL_KEYS.page, String(state.page));
  }

  if (state.perPage && state.perPage !== GRID_URL_DEFAULT_PER_PAGE) {
    params.set(
      GRID_URL_KEYS.perPage,
      isGridPerPageAll(state.perPage) ? 'all' : String(state.perPage),
    );
  }

  if (state.search?.trim()) {
    params.set(GRID_URL_KEYS.search, state.search.trim());
  }

  if (state.sort) {
    params.set(GRID_URL_KEYS.sort, state.sort);
    if (state.sortDir === 'desc') {
      params.set(GRID_URL_KEYS.sortDir, 'desc');
    }
  }

  for (const [key, value] of Object.entries(state.filters ?? {})) {
    if (!value.trim() || RESERVED_URL_KEYS.has(key)) continue;
    params.set(key, value.trim());
  }

  if (state.userFilter) {
    params.set('user_id', String(state.userFilter.userId));
    params.set('user_name', state.userFilter.userName);
    if (state.userFilter.roleNames.length > 0) {
      params.set('roles', state.userFilter.roleNames.join(','));
    }
  }

  if (state.contextFilter?.trim()) {
    params.set(GRID_CONTEXT_FILTER_URL_KEY, state.contextFilter.trim());
  }

  return params;
}

export function gridUrlSearchParamsAreEqual(
  left: URLSearchParams,
  right: URLSearchParams,
): boolean {
  return left.toString() === right.toString();
}
