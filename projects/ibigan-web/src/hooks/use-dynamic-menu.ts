import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMenusNavigationQuery } from '@/hooks/use-menus-navigation-query';
import { mapApiMenusToConfig } from '@/lib/menu-mapper';
import { filterMenuForUser } from '@/lib/filter-menu-for-user';
import { filterMenuByPermissions } from '@/lib/filter-menu-by-permissions';
import { applyTenantCentralMenuPolicy } from '@/lib/hide-central-panel-from-tenant-menu';
import { stripDevToolsFromMenu } from '@/lib/merge-dev-tools-menu-items';
import { mergeSaasMenuItems } from '@/lib/merge-saas-menu-items';
import { MENU_SIDEBAR } from '@/config/menu.config';
import { SUPER_ADMIN_ROLE } from '@/config/routing';
import { type MenuConfig } from '@/config/types';
import { useCanAccessCentralFromTenant } from '@/hooks/use-can-access-central-from-tenant';
import { useAuthStore } from '@/stores/auth.store';
import { useCentralAuthStore } from '@/stores/central-auth.store';

function buildTenantMenu(
  menu: MenuConfig,
  isSuperAdmin: boolean,
  hasPermission: (permission: string) => boolean,
  canAccessCentralFromTenant: boolean,
): MenuConfig {
  const filtered = filterMenuForUser(menu, isSuperAdmin);

  return applyTenantCentralMenuPolicy(
    filterMenuByPermissions(stripDevToolsFromMenu(filtered), hasPermission),
    canAccessCentralFromTenant,
  );
}

export function useDynamicMenu(): MenuConfig {
  const { t } = useTranslation();
  const tenantId = useAuthStore((state) => state.tenantId);
  const isTenantSuperAdmin = useAuthStore((state) => state.hasRole(SUPER_ADMIN_ROLE));
  const isCentralSuperAdmin = useCentralAuthStore((state) => state.centralUser?.is_super_admin);
  const isSuperAdmin = Boolean(isCentralSuperAdmin || isTenantSuperAdmin);
  const canAccessCentralFromTenant = useCanAccessCentralFromTenant();

  const hasPermission = useAuthStore((state) => state.hasPermission);

  const { data, isSuccess, isPending } = useMenusNavigationQuery(Boolean(tenantId));

  return useMemo(() => {
    const fallbackMenu = buildTenantMenu(
      MENU_SIDEBAR,
      isSuperAdmin,
      hasPermission,
      canAccessCentralFromTenant,
    );

    if (isPending) {
      return [];
    }

    const apiMenus = isSuccess ? data?.data.result ?? [] : [];

    if (!isSuccess || apiMenus.length === 0) {
      return fallbackMenu;
    }

    const baseMenu = stripDevToolsFromMenu(
      mergeSaasMenuItems(
        mapApiMenusToConfig(apiMenus, (key, fallback) => t(key, fallback)),
        MENU_SIDEBAR,
      ),
    );

    return buildTenantMenu(baseMenu, isSuperAdmin, hasPermission, canAccessCentralFromTenant);
  }, [
    canAccessCentralFromTenant,
    data,
    hasPermission,
    isPending,
    isSuccess,
    isSuperAdmin,
    t,
  ]);
}
