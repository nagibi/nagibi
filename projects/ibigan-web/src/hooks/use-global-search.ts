import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchService } from '@/services/search.service';
import { useAuthStore } from '@/stores/auth.store';

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export type SearchGroup = Record<string, SearchHit[]>;

export interface SearchHit {
  id: string;
  type:
    | 'menu'
    | 'user'
    | 'doc'
    | 'equipamento'
    | 'tipo_equipamento'
    | 'fornecedor'
    | 'obra';
  title: string;
  subtitle: string | null;
  path: string | null;
  avatar_url: string | null;
}

export function useGlobalSearch(term: string, open = true) {
  const debounced = useDebounced(term, 250);
  const tenantId = useAuthStore((state) => state.tenantId);
  const hasQuery = debounced.trim().length >= 2;

  return useQuery({
    queryKey: ['global-search', tenantId, debounced],
    queryFn: () => searchService.search(debounced),
    enabled: open && hasQuery,
    staleTime: 30_000,
  });
}
