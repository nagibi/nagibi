import { useEffect, useRef, type ReactNode } from 'react';
import type { PageBreadcrumbItem } from '@/lib/build-page-breadcrumbs';
import type { ToolbarAlertConfig } from '@/components/grid/toolbar-alert';
import { useSetPageToolbar } from '@/providers/page-toolbar-provider';
import type { PageToolbarConfig } from '@/providers/page-toolbar-provider';

type UsePageToolbarOptions = {
  title: ReactNode;
  description?: ReactNode;
  headerActions?: ReactNode;
  actions?: ReactNode;
  alert?: ToolbarAlertConfig | null;
  breadcrumbs?: PageBreadcrumbItem[];
};

const STABLE_BREADCRUMBS: PageBreadcrumbItem[] = [];

function breadcrumbsSignature(breadcrumbs?: PageBreadcrumbItem[]) {
  if (!breadcrumbs?.length) {
    return '';
  }

  return breadcrumbs
    .map((item) => `${String(item.title)}:${item.path ?? ''}`)
    .join('|');
}

function alertSignature(alert?: ToolbarAlertConfig | null) {
  if (!alert) {
    return '';
  }

  return `${alert.variant ?? 'info'}:${String(alert.title)}:${alert.id ?? ''}`;
}

function toolbarContentSignature({
  title,
  description,
  breadcrumbsKey,
  alertKey,
}: {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbsKey: string;
  alertKey: string;
}) {
  return `${String(title)}|${String(description ?? '')}|${breadcrumbsKey}|${alertKey}`;
}

export function usePageToolbar({
  title,
  description,
  headerActions,
  actions,
  alert,
  breadcrumbs,
}: UsePageToolbarOptions) {
  const setConfig = useSetPageToolbar();
  const configRef = useRef<PageToolbarConfig>({
    title,
    description,
    headerActions,
    actions,
    alert,
    breadcrumbs,
  });

  configRef.current = {
    title,
    description,
    headerActions,
    actions,
    alert,
    breadcrumbs: breadcrumbs ?? STABLE_BREADCRUMBS,
  };

  const breadcrumbsKey = breadcrumbsSignature(breadcrumbs);
  const alertKey = alertSignature(alert);
  const contentSignature = toolbarContentSignature({
    title,
    description,
    breadcrumbsKey,
    alertKey,
  });

  useEffect(() => {
    setConfig(configRef.current);

    return () => setConfig(null);
  }, [setConfig, contentSignature, actions, headerActions]);
}
