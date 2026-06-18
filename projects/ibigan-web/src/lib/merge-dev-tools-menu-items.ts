import i18n from '@/i18n/i18next';
import { DEV_TOOLS_URLS } from '@/lib/dev-tools-urls';
import { type MenuConfig, type MenuItem } from '@/config/types';

const DEV_TOOLS_PATHS = new Set<string>(Object.values(DEV_TOOLS_URLS));

const DEV_TOOL_TRANSLATION_BY_PATH: Partial<Record<string, string>> = {
  [DEV_TOOLS_URLS.apiDocs]: 'menu.api_docs',
  [DEV_TOOLS_URLS.horizon]: 'menu.horizon',
  [DEV_TOOLS_URLS.telescope]: 'menu.telescope',
  [DEV_TOOLS_URLS.clockwork]: 'menu.clockwork',
  [DEV_TOOLS_URLS.logViewer]: 'menu.log_viewer',
  [DEV_TOOLS_URLS.phpMyAdmin]: 'menu.phpmyadmin',
  [DEV_TOOLS_URLS.mailpit]: 'menu.mailpit',
  [DEV_TOOLS_URLS.grafana]: 'menu.grafana',
  [DEV_TOOLS_URLS.prometheus]: 'menu.prometheus',
  [DEV_TOOLS_URLS.cAdvisor]: 'menu.cadvisor',
  [DEV_TOOLS_URLS.sentry]: 'menu.sentry',
};

const DEV_TOOL_PATH_BY_SLUG: Record<string, string> = {
  'documentacao-api': DEV_TOOLS_URLS.apiDocs,
  'horizon': DEV_TOOLS_URLS.horizon,
  'telescope': DEV_TOOLS_URLS.telescope,
  'clockwork': DEV_TOOLS_URLS.clockwork,
  'log-viewer': DEV_TOOLS_URLS.logViewer,
  'phpmyadmin': DEV_TOOLS_URLS.phpMyAdmin,
  'mailpit': DEV_TOOLS_URLS.mailpit,
  'grafana': DEV_TOOLS_URLS.grafana,
  'prometheus': DEV_TOOLS_URLS.prometheus,
  'cadvisor': DEV_TOOLS_URLS.cAdvisor,
  'sentry': DEV_TOOLS_URLS.sentry,
};

export function isDevToolsChild(item: MenuItem): boolean {
  const slug = (item as MenuItem & { slug?: string }).slug;

  if (slug && DEV_TOOL_PATH_BY_SLUG[slug]) {
    return true;
  }

  return Boolean(item.path && (
    DEV_TOOLS_PATHS.has(item.path)
    || item.path.includes('/docs/api')
    || item.path.includes('/horizon')
    || item.path.includes('/telescope')
    || item.path.includes('/clockwork')
    || item.path.includes('/log-viewer')
  ));
}

function isDevToolsGroup(item: MenuItem): boolean {
  const slug = (item as MenuItem & { slug?: string }).slug;
  if (slug === 'ferramentas') {
    return true;
  }

  return Boolean(item.children?.some(isDevToolsChild));
}

function extractDevToolsGroup(staticMenu: MenuConfig): MenuItem | null {
  return staticMenu.find(isDevToolsGroup) ?? null;
}

function syncDevToolChildPath(child: MenuItem): MenuItem {
  const slug = (child as MenuItem & { slug?: string }).slug;
  const syncedPath = slug && DEV_TOOL_PATH_BY_SLUG[slug]
    ? DEV_TOOL_PATH_BY_SLUG[slug]
    : child.path?.includes('/docs/api')
      ? DEV_TOOLS_URLS.apiDocs
      : child.path?.includes('/horizon')
        ? DEV_TOOLS_URLS.horizon
        : child.path?.includes('/telescope')
          ? DEV_TOOLS_URLS.telescope
          : child.path?.includes('/clockwork')
            ? DEV_TOOLS_URLS.clockwork
            : child.path?.includes('/log-viewer')
              ? DEV_TOOLS_URLS.logViewer
              : child.path?.includes('8080')
                ? DEV_TOOLS_URLS.phpMyAdmin
                : child.path?.includes('8025')
                  ? DEV_TOOLS_URLS.mailpit
                  : child.path?.includes('3001')
                    ? DEV_TOOLS_URLS.grafana
                    : child.path?.includes('9091')
                      ? DEV_TOOLS_URLS.prometheus
                      : child.path?.includes('8086')
                        ? DEV_TOOLS_URLS.cAdvisor
                        : child.path;

  return syncedPath ? { ...child, path: syncedPath, target: '_blank' as const } : child;
}

function localizeDevToolsGroup(group: MenuItem): MenuItem {
  return {
    ...group,
    title: i18n.t('menu.tools'),
    children: group.children?.map((child) => {
      const synced = syncDevToolChildPath(child);

      return {
        ...synced,
        title: synced.path && DEV_TOOL_TRANSLATION_BY_PATH[synced.path]
          ? i18n.t(DEV_TOOL_TRANSLATION_BY_PATH[synced.path])
          : synced.title,
      };
    }),
  };
}

function syncDevToolsInMenu(menu: MenuConfig): MenuConfig {
  return menu.map((item) => {
    if (isDevToolsGroup(item)) {
      return localizeDevToolsGroup({
        ...item,
        children: item.children?.map(syncDevToolChildPath),
      });
    }

    if (item.children?.length) {
      return {
        ...item,
        children: syncDevToolsInMenu(item.children),
      };
    }

    return item;
  });
}

function mergeDevToolsChildren(apiGroup: MenuItem, staticGroup: MenuItem): MenuItem {
  const syncedApiChildren = (apiGroup.children ?? []).map(syncDevToolChildPath);
  const staticChildren = (staticGroup.children ?? []).map(syncDevToolChildPath);

  const apiPaths = new Set(
    syncedApiChildren.map((child) => child.path).filter(Boolean),
  );

  const missing = staticChildren.filter(
    (child) => child.path && !apiPaths.has(child.path),
  );

  return localizeDevToolsGroup({
    ...apiGroup,
    children: [...syncedApiChildren, ...missing],
  });
}

/**
 * Garante o grupo Ferramentas do menu estático e sincroniza URLs com o ambiente atual.
 */
export function mergeDevToolsMenuItems(
  apiMenu: MenuConfig,
  staticMenu: MenuConfig,
  includeDevTools = true,
): MenuConfig {
  const syncedMenu = syncDevToolsInMenu(apiMenu);

  if (!includeDevTools) {
    return syncedMenu.filter((item) => !isDevToolsGroup(item));
  }

  const devTools = extractDevToolsGroup(staticMenu);

  if (!devTools) {
    return syncedMenu;
  }

  if (syncedMenu.some(isDevToolsGroup)) {
    return syncedMenu.map((item) => (
      isDevToolsGroup(item) ? mergeDevToolsChildren(item, devTools) : item
    ));
  }

  return [...syncedMenu, localizeDevToolsGroup(devTools)];
}

/** Remove Ferramentas do menu tenant — acesso exclusivo do painel central. */
export function stripDevToolsFromMenu(menu: MenuConfig): MenuConfig {
  return mergeDevToolsMenuItems(menu, [], false);
}
