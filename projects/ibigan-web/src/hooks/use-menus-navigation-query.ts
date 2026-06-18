import { useQuery } from '@tanstack/react-query';
import { menusService } from '@/services/menus.service';
import { useAuthStore } from '@/stores/auth.store';

export const MENUS_NAVIGATION_QUERY_KEY = ['menus', 'navigation'] as const;

export function useMenusNavigationQuery(enabled = true) {
  const tenantId = useAuthStore((state) => state.tenantId);

  return useQuery({
    queryKey: [...MENUS_NAVIGATION_QUERY_KEY, tenantId],
    queryFn: () => menusService.navigation(),
    staleTime: 5 * 60 * 1000,
    enabled: enabled && Boolean(tenantId),
  });
}
