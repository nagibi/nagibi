import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import type { PageBreadcrumbItem } from '@/lib/build-page-breadcrumbs';
import type { ToolbarAlertConfig } from '@/components/grid/toolbar-alert';

export type PageToolbarConfig = {
  title?: ReactNode;
  description?: ReactNode;
  headerActions?: ReactNode;
  actions?: ReactNode;
  alert?: ToolbarAlertConfig | null;
  breadcrumbs?: PageBreadcrumbItem[];
};

type Listener = () => void;

function areBreadcrumbsEqual(
  a?: PageBreadcrumbItem[],
  b?: PageBreadcrumbItem[],
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;

  return a.every((item, index) => {
    const other = b[index];
    return (
      item.title === other.title
      && item.path === other.path
      && item.icon === other.icon
    );
  });
}

function areAlertsEqual(
  a?: ToolbarAlertConfig | null,
  b?: ToolbarAlertConfig | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;

  return (
    a.variant === b.variant
    && a.title === b.title
    && a.id === b.id
    && a.autoDismissMs === b.autoDismissMs
    && a.actions === b.actions
    && a.icon === b.icon
    && a.onClose === b.onClose
  );
}

function isSameToolbarConfig(
  current: PageToolbarConfig | null,
  next: PageToolbarConfig | null,
): boolean {
  if (current === next) return true;
  if (!current || !next) return false;

  return (
    current.title === next.title
    && current.description === next.description
    && current.headerActions === next.headerActions
    && current.actions === next.actions
    && areAlertsEqual(current.alert, next.alert)
    && areBreadcrumbsEqual(current.breadcrumbs, next.breadcrumbs)
  );
}

class PageToolbarStore {
  private config: PageToolbarConfig | null = null;
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.config;

  setConfig = (next: PageToolbarConfig | null) => {
    if (isSameToolbarConfig(this.config, next)) return;
    this.config = next;
    queueMicrotask(() => {
      this.listeners.forEach((listener) => listener());
    });
  };

  clearPageAlert = () => {
    if (!this.config?.alert) return;
    this.config = { ...this.config, alert: null };
    queueMicrotask(() => {
      this.listeners.forEach((listener) => listener());
    });
  };
}

const pageToolbarStore = new PageToolbarStore();

const SetPageToolbarContext = createContext<
  ((config: PageToolbarConfig | null) => void) | null
>(null);

export function PageToolbarProvider({ children }: { children: ReactNode }) {
  const setConfig = useCallback((next: PageToolbarConfig | null) => {
    pageToolbarStore.setConfig(next);
  }, []);

  return (
    <SetPageToolbarContext.Provider value={setConfig}>
      {children}
    </SetPageToolbarContext.Provider>
  );
}

export function useSetPageToolbar() {
  const setConfig = useContext(SetPageToolbarContext);

  if (!setConfig) {
    throw new Error('useSetPageToolbar must be used within PageToolbarProvider');
  }

  return setConfig;
}

export function usePageToolbarConfig() {
  return useSyncExternalStore(
    pageToolbarStore.subscribe,
    pageToolbarStore.getSnapshot,
  );
}

export function usePageToolbarActionsVisible() {
  const config = usePageToolbarConfig();
  return Boolean(config?.actions);
}

export function useClearPageToolbarAlert() {
  return useCallback(() => {
    pageToolbarStore.clearPageAlert();
  }, []);
}

export function useClearPageToolbarAlertOnNavigate() {
  const { pathname, key } = useLocation();
  const clearPageAlert = useClearPageToolbarAlert();

  useLayoutEffect(() => {
    clearPageAlert();
  }, [pathname, key, clearPageAlert]);
}
