import { useMemo } from 'react';
import { useMenusNavigationQuery } from '@/hooks/use-menus-navigation-query';
import { findApiMenuByPath } from '@/lib/find-api-menu';
import { type ApiMenu } from '@/services/menus.service';
import { useAuthStore } from '@/stores/auth.store';

export function useApiMenuByPath(path: string): ApiMenu | undefined {
  const tenantId = useAuthStore((state) => state.tenantId);
  const { data } = useMenusNavigationQuery(Boolean(tenantId));

  const menus = data?.data.result ?? [];

  return useMemo(() => findApiMenuByPath(menus, path), [menus, path]);
}
