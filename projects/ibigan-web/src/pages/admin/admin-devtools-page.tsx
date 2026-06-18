import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Bug, Clock, Container, ExternalLink, Flame, Gauge, LineChart, ScrollText, Telescope } from 'lucide-react';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import { PageBody } from '@/components/common/page-body';
import { buildDevToolsHref } from '@/lib/dev-tools-link';
import { DEV_TOOLS_URLS, isLocalDevEnvironment, resolveLocalServiceUrl } from '@/lib/dev-tools-urls';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';

type DevToolItem = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  url: string;
  icon: typeof Gauge;
};

export function AdminDevToolsPage() {
  const { t } = useTranslation();

  usePageToolbar({
    title: t('admin.devtools.title'),
    description: t('admin.devtools.description'),
  });

  const tools = useMemo<DevToolItem[]>(() => {
    const mailpitUrl = resolveLocalServiceUrl(
      import.meta.env.VITE_DEV_MAILPIT_URL,
      8025,
    );
    const phpMyAdminUrl = resolveLocalServiceUrl(
      import.meta.env.VITE_DEV_PHPMYADMIN_URL,
      8080,
    );

    const items: DevToolItem[] = [
      {
        id: 'horizon',
        titleKey: 'menu.horizon',
        descriptionKey: 'admin.devtools.horizon_description',
        url: DEV_TOOLS_URLS.horizon,
        icon: Gauge,
      },
      {
        id: 'telescope',
        titleKey: 'menu.telescope',
        descriptionKey: 'admin.devtools.telescope_description',
        url: DEV_TOOLS_URLS.telescope,
        icon: Telescope,
      },
      {
        id: 'clockwork',
        titleKey: 'menu.clockwork',
        descriptionKey: 'admin.devtools.clockwork_description',
        url: DEV_TOOLS_URLS.clockwork,
        icon: Clock,
      },
      {
        id: 'log-viewer',
        titleKey: 'menu.log_viewer',
        descriptionKey: 'admin.devtools.log_viewer_description',
        url: DEV_TOOLS_URLS.logViewer,
        icon: ScrollText,
      },
      {
        id: 'api-docs',
        titleKey: 'menu.api_docs',
        descriptionKey: 'admin.devtools.api_docs_description',
        url: DEV_TOOLS_URLS.apiDocs,
        icon: BookOpen,
      },
      {
        id: 'grafana',
        titleKey: 'menu.grafana',
        descriptionKey: 'admin.devtools.grafana_description',
        url: DEV_TOOLS_URLS.grafana,
        icon: LineChart,
      },
      {
        id: 'prometheus',
        titleKey: 'menu.prometheus',
        descriptionKey: 'admin.devtools.prometheus_description',
        url: DEV_TOOLS_URLS.prometheus,
        icon: Flame,
      },
      {
        id: 'cadvisor',
        titleKey: 'menu.cadvisor',
        descriptionKey: 'admin.devtools.cadvisor_description',
        url: DEV_TOOLS_URLS.cAdvisor,
        icon: Container,
      },
      {
        id: 'sentry',
        titleKey: 'menu.sentry',
        descriptionKey: 'admin.devtools.sentry_description',
        url: DEV_TOOLS_URLS.sentry,
        icon: Bug,
      },
    ];

    if (isLocalDevEnvironment()) {
      items.push(
        {
          id: 'phpmyadmin',
          titleKey: 'menu.phpmyadmin',
          descriptionKey: 'admin.devtools.phpmyadmin_description',
          url: phpMyAdminUrl,
          icon: ExternalLink,
        },
        {
          id: 'mailpit',
          titleKey: 'menu.mailpit',
          descriptionKey: 'admin.devtools.mailpit_description',
          url: mailpitUrl,
          icon: ExternalLink,
        },
      );
    }

    return items;
  }, []);

  return (
    <PageBody>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const href = buildDevToolsHref(tool.url);

          return (
            <Card key={tool.id} className="h-full">
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base">{t(tool.titleKey)}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {t(tool.descriptionKey)}
                    </CardDescription>
                  </div>
                </div>

                <Button asChild className="mt-auto w-full">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('admin.devtools.open')}
                    <ExternalLink className="ms-2 size-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        {t('admin.devtools.hint')}
      </p>
    </PageBody>
  );
}
