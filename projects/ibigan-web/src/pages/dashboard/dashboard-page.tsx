import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  BarChart3,
  Bell,
  BellOff,
  ExternalLink,
  LayoutList,
  Mail,
  Menu,
  MessageCircle,
  Settings2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useImpersonationEntryAlert } from '@/hooks/use-impersonation-entry-alert';
import { useCanAccessCentralFromTenant } from '@/hooks/use-can-access-central-from-tenant';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import { PageBody } from '@/components/common/page-body';
import { GridDateRangeFilter } from '@/components/grid/grid-date-range-filter';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getInitials } from '@/lib/helpers';
import { useDateLocale } from '@/lib/date-locale';
import { cn } from '@/lib/utils';
import { dashboardService, type DashboardStats } from '@/services/dashboard.service';
import { useAuthStore } from '@/stores/auth.store';
import { useCentralAuthStore } from '@/stores/central-auth.store';
import { DashboardAnalyticsSection } from '@/pages/dashboard/dashboard-analytics-section';
import { DashboardPageSkeleton } from '@/pages/dashboard/dashboard-page-skeleton';
import {
  getDefaultDashboardDateRange,
  type DashboardDateRange,
} from '@/pages/dashboard/dashboard-date-range';

const COLORS = {
  blue: '#378ADD',
  green: '#1D9E75',
  amber: '#EF9F27',
  red: '#E24B4A',
  gray: '#888780',
};

const DASHBOARD_CARD = 'min-w-0 max-w-full overflow-hidden gap-0 py-0';
const DASHBOARD_CARD_CONTENT = 'grow-0 max-w-full p-0';

function DashboardCardContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <CardContent className={cn(DASHBOARD_CARD_CONTENT, className)}>{children}</CardContent>;
}

function ChartBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 w-full max-w-full overflow-hidden', className)}>
      {children}
    </div>
  );
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

function userMomDelta(
  growth: DashboardStats['users']['growth'],
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (growth.length < 2) return '';
  const last = growth[growth.length - 1]?.total ?? 0;
  const prev = growth[growth.length - 2]?.total ?? 0;
  if (prev === 0) return t('dashboard.stats.delta_this_month', { count: last });
  const pct = Math.round(((last - prev) / prev) * 100);
  return t('dashboard.stats.delta_mom', { pct: `${pct >= 0 ? '+' : ''}${pct}` });
}

function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <CardHeader className="min-h-0 shrink-0 flex-col items-start gap-1 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:space-y-0 sm:px-5 sm:py-3.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        {subtitle && (
          <span className="text-muted-foreground line-clamp-2 text-[10px] sm:line-clamp-1 sm:max-w-[220px] sm:text-right sm:text-[11px]">
            {subtitle}
          </span>
        )}
        {action}
      </div>
    </CardHeader>
  );
}

function DashboardColumns({
  primary,
  secondary,
}: {
  primary: React.ReactNode;
  secondary: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-4 xl:flex-row xl:items-start">
      <div className="flex min-w-0 w-full flex-col gap-4 xl:min-w-0 xl:flex-[3]">{primary}</div>
      <div className="flex min-w-0 w-full flex-col gap-4 xl:min-w-0 xl:flex-[2]">{secondary}</div>
    </div>
  );
}

function BottomDashboardCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 max-w-full overflow-hidden">
      <PanelHeader title={title} subtitle={subtitle} />
      <div className="min-w-0 shrink-0 space-y-3 px-4 py-4 sm:px-5">{children}</div>
      {footer ? <CardFooter className="shrink-0 px-5 py-3">{footer}</CardFooter> : null}
    </Card>
  );
}

function MetricRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground flex items-center gap-2">
        {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

const EMPTY_MENUS = { total: 0, active: 0, customized: 0 };
const EMPTY_USER_PREFERENCES = {
  total: 0,
  notifications_enabled: 0,
  notifications_disabled: 0,
  email_pct: 0,
  whatsapp_pct: 0,
};

function StatCard({
  label,
  value,
  delta,
  deltaUp,
  warn,
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaUp?: boolean;
  warn?: boolean;
}) {
  return (
    <Card className="min-w-0 max-w-full gap-0 py-0">
      <CardContent className="grow-0 px-3 py-3 sm:px-4">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          {label}
        </p>
        <p className={cn('mt-1 text-2xl font-semibold tabular-nums', warn && 'text-amber-500')}>
          {value}
        </p>
        {delta && (
          <p
            className={cn(
              'mt-0.5 text-[11px]',
              deltaUp === true && 'text-emerald-500',
              deltaUp === false && 'text-destructive',
              warn && 'text-amber-500',
              deltaUp === undefined && !warn && 'text-muted-foreground',
            )}
          >
            {deltaUp === true && <TrendingUp className="mr-0.5 inline size-3" />}
            {delta}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TenantStatusBadge({ status }: { status: DashboardStats['tenants']['rows'][0]['status'] }) {
  const { t } = useTranslation();
  const map = {
    active: { label: t('dashboard.status.active'), variant: 'success' as const },
    trial: { label: t('dashboard.status.trial'), variant: 'warning' as const },
    inactive: { label: t('dashboard.status.inactive'), variant: 'secondary' as const },
  };
  const cfg = map[status] ?? map.inactive;

  return (
    <Badge variant={cfg.variant} appearance="light" size="sm" className="text-[10px] font-normal">
      {cfg.label}
    </Badge>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    email: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    whatsapp: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    push: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    sms: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    app: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  };

  const channelKey = `dashboard.channel.${channel}` as const;
  const label = ['email', 'whatsapp', 'push', 'sms', 'app'].includes(channel)
    ? t(channelKey)
    : channel;

  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] font-normal capitalize', colors[channel] ?? colors.email)}
    >
      {label}
    </Badge>
  );
}

function ReportStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, string> = {
    concluido: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    rodando: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    falhou: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  const labelKey = `dashboard.status.${status}` as const;
  const label = ['concluido', 'rodando', 'falhou'].includes(status)
    ? t(labelKey)
    : status;

  return (
    <Badge variant="outline" className={cn('text-[10px] font-normal', map[status] ?? map.concluido)}>
      {label}
    </Badge>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-popover border-border rounded-md border px-2.5 py-2 text-xs shadow-md">
      {label && <p className="text-muted-foreground mb-1 font-medium">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function DashboardPage() {
  useImpersonationEntryAlert();

  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const tenantId = useAuthStore((state) => state.tenantId);
  const user = useAuthStore((state) => state.user);
  const hasRole = useAuthStore((state) => state.hasRole);
  const centralUser = useCentralAuthStore((state) => state.centralUser);
  const canAccessCentralFromTenant = useCanAccessCentralFromTenant();
  const isSuperAdmin = hasRole('super-admin') || centralUser?.is_super_admin;
  const showCentralTenantsLink = isSuperAdmin && !canAccessCentralFromTenant;

  const [dateRange, setDateRange] = useState<DashboardDateRange>(getDefaultDashboardDateRange);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-stats', tenantId, dateRange.date_from, dateRange.date_to],
    queryFn: () => dashboardService.stats(dateRange).then((r) => r.data.result),
    staleTime: 1000 * 60 * 5,
    enabled: Boolean(tenantId),
  });

  const periodLabel = useMemo(() => {
    if (!dateRange.date_from && !dateRange.date_to) {
      return format(new Date(), 'MMM yyyy', { locale: dateLocale });
    }
    if (dateRange.date_from && dateRange.date_to) {
      const from = format(new Date(`${dateRange.date_from}T12:00:00`), 'dd MMM yyyy', { locale: dateLocale });
      const to = format(new Date(`${dateRange.date_to}T12:00:00`), 'dd MMM yyyy', { locale: dateLocale });
      return `${from} — ${to}`;
    }
    return format(new Date(), 'MMM yyyy', { locale: dateLocale });
  }, [dateLocale, dateRange.date_from, dateRange.date_to]);

  const roleLabel = isSuperAdmin
    ? t('dashboard.description.super_admin')
    : user?.roles?.[0]
      ? t('dashboard.description.tenant_role', { role: user.roles[0] })
      : t('dashboard.description.tenant');

  const toolbarActions = (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span className="text-foreground shrink-0 text-xs font-medium">{periodLabel}</span>
      <div className="w-full min-w-0 sm:max-w-[280px]">
        <GridDateRangeFilter
          from={dateRange.date_from}
          to={dateRange.date_to}
          onChange={(from, to) => setDateRange({ date_from: from, date_to: to })}
          fullWidth
        />
      </div>
    </div>
  );

  usePageToolbar({
    title: t('dashboard.title'),
    description: roleLabel,
    actions: toolbarActions,
  });

  if (isLoading) {
    return <DashboardPageSkeleton />;
  }

  if (isError || !data) {
    return (
      <PageBody>
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <AlertCircle className="text-destructive size-6" />
          <p className="text-muted-foreground text-sm">{t('dashboard.error.load')}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t('dashboard.error.retry')}
          </Button>
        </div>
      </PageBody>
    );
  }

  const s: DashboardStats = data;
  const menus = s.menus ?? EMPTY_MENUS;
  const userPreferences = s.user_preferences ?? EMPTY_USER_PREFERENCES;
  const centralUsers =
    s.central_users?.length > 0
      ? s.central_users
      : centralUser?.is_super_admin
        ? [{ id: centralUser.id, name: centralUser.name, email: centralUser.email, logins: 0 }]
        : [];
  const userMom = userMomDelta(s.users.growth, t);
  const userMomUp = userMom.includes('+') || userMom.startsWith('0');

  const userApprovalData = [
    { name: t('dashboard.status.approved'), value: s.users.approved, color: COLORS.blue },
    { name: t('dashboard.status.pending'), value: s.users.pending, color: COLORS.amber },
    { name: t('dashboard.status.rejected'), value: s.users.rejected, color: COLORS.red },
  ].filter((d) => d.value > 0);

  const inviteBars = [
    { name: t('dashboard.status.accepted'), value: s.invites.accepted, fill: COLORS.green },
    { name: t('dashboard.status.pending'), value: s.invites.pending, fill: COLORS.amber },
    { name: t('dashboard.status.expired'), value: s.invites.expired, fill: COLORS.gray },
  ];

  const maxDocCount = Math.max(...s.docs.by_tenant.map((d) => d.count), 1);

  return (
    <PageBody className="min-w-0 max-w-full space-y-5">
      <section className="min-w-0 max-w-full">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          <StatCard
            label={t('dashboard.stats.tenants')}
            value={s.tenants.total}
            delta={t('dashboard.stats.delta_this_month', { count: s.tenants.new_this_month })}
            deltaUp={s.tenants.new_this_month > 0}
          />
          <StatCard
            label={t('dashboard.stats.users')}
            value={formatNumber(s.users.total)}
            delta={userMom || t('dashboard.stats.delta_this_month', { count: s.users.new_this_month })}
            deltaUp={userMomUp || s.users.new_this_month > 0}
          />
          <StatCard
            label={t('dashboard.stats.approvals')}
            value={s.user_approvals.pending}
            delta={t('dashboard.stats.approval_pending')}
            warn={s.user_approvals.pending > 0}
          />
          <StatCard
            label={t('dashboard.stats.campaigns')}
            value={s.campaigns.total}
            delta={t('dashboard.stats.delta_this_month', { count: s.campaigns.new_this_month })}
            deltaUp={s.campaigns.new_this_month > 0}
          />
          <StatCard
            label={t('dashboard.stats.webhooks')}
            value={s.webhooks.total}
            delta={t('dashboard.stats.webhooks_active', { count: s.webhooks.active })}
          />
          <StatCard
            label={t('dashboard.stats.invites')}
            value={s.invites.total}
            delta={t('dashboard.stats.invites_pending', { count: s.invites.pending })}
            warn={s.invites.pending > 0}
          />
          <StatCard
            label={t('dashboard.stats.docs')}
            value={formatNumber(s.docs.total)}
            delta={t('dashboard.stats.delta_this_month', { count: s.docs.new_this_month })}
            deltaUp={s.docs.new_this_month > 0}
          />
          <StatCard
            label={t('dashboard.stats.reports')}
            value={s.reports.total}
            delta={t('dashboard.stats.reports_running', { count: s.reports.running })}
          />
        </div>
      </section>

      <DashboardColumns
        primary={
          <>
          <Card className={DASHBOARD_CARD}>
            <PanelHeader
              title={t('dashboard.cards.tenants.title')}
              subtitle={t('dashboard.cards.tenants.subtitle')}
              action={
                showCentralTenantsLink ? (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                    <Link to="/admin/tenants">
                      {t('dashboard.cards.tenants.view_model')}
                      <ExternalLink className="ml-1 size-3" />
                    </Link>
                  </Button>
                ) : undefined
              }
            />
            <DashboardCardContent>
                <div className="divide-y md:hidden">
                  {s.tenants.rows.map((row) => (
                    <div key={row.id} className="flex flex-col gap-2 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="size-7 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                            {row.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
                        <TenantStatusBadge status={row.status} />
                      </div>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {row.plan}
                        </Badge>
                        <span className="tabular-nums">{t('dashboard.cards.tenants.users_count', { count: row.users })}</span>
                        <span className="tabular-nums">{t('dashboard.cards.tenants.tu_count', { count: row.tenant_users })}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <Table className="min-w-[520px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-4 text-xs">{t('dashboard.cards.tenants.company')}</TableHead>
                        <TableHead className="text-xs">{t('dashboard.cards.tenants.status')}</TableHead>
                        <TableHead className="text-xs">{t('dashboard.cards.tenants.plan')}</TableHead>
                        <TableHead className="text-right text-xs">{t('dashboard.cards.tenants.users')}</TableHead>
                        <TableHead className="pr-4 text-right text-xs">{t('dashboard.cards.tenants.tu_links')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.tenants.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="size-7">
                                <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                  {row.initials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{row.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <TenantStatusBadge status={row.status} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {row.plan}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.users}</TableCell>
                          <TableCell className="pr-4 text-right tabular-nums">{row.tenant_users}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
            </DashboardCardContent>
          </Card>

          <Card className={DASHBOARD_CARD}>
            <PanelHeader title={t('dashboard.cards.campaigns.title')} subtitle={t('dashboard.cards.campaigns.subtitle')} />
            <DashboardCardContent className="px-4 py-4">
                <ChartBox className="h-[240px] sm:h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={s.campaigns.monthly}
                      barGap={2}
                      barCategoryGap="18%"
                      margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, width: '100%', left: 0 }} />
                      <Bar dataKey="sent" name={t('dashboard.chart.sent')} fill={COLORS.blue} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="delivered" name={t('dashboard.chart.delivered')} fill={COLORS.green} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="failed" name={t('dashboard.chart.failed')} fill={COLORS.red} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>
            </DashboardCardContent>
          </Card>

          <Card className={DASHBOARD_CARD}>
            <PanelHeader title={t('dashboard.cards.message_templates.title')} subtitle={t('dashboard.cards.message_templates.subtitle')} />
            <DashboardCardContent className="divide-y">
                {s.message_templates.items.length === 0 ? (
                  <p className="text-muted-foreground px-4 py-6 text-sm">{t('dashboard.cards.message_templates.empty')}</p>
                ) : (
                  s.message_templates.items.map((item) => (
                    <div key={item.name} className="flex min-w-0 items-center justify-between gap-2 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <ChannelBadge channel={item.channel} />
                        <span className="text-muted-foreground text-xs tabular-nums">{item.usage}x</span>
                      </div>
                    </div>
                  ))
                )}
            </DashboardCardContent>
          </Card>

          <Card className={DASHBOARD_CARD}>
            <PanelHeader title={t('dashboard.cards.docs.title')} subtitle={t('dashboard.cards.docs.subtitle')} />
            <DashboardCardContent className="space-y-3 px-4 py-4">
                {s.docs.by_tenant.map((doc) => (
                  <div key={doc.tenant} className="flex items-center gap-3">
                    <Avatar className="size-7 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                        {getInitials(doc.tenant, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-sm">{doc.tenant}</span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {doc.count}
                        </span>
                      </div>
                      <Progress
                        value={(doc.count / maxDocCount) * 100}
                        indicatorClassName="bg-[#378ADD]"
                      />
                    </div>
                  </div>
                ))}
            </DashboardCardContent>
          </Card>

          <BottomDashboardCard
            title={t('dashboard.cards.menus.title')}
            subtitle={t('dashboard.cards.menus.subtitle')}
            footer={
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to="/menus">
                  {t('dashboard.cards.menus.view')}
                  <ExternalLink className="ml-1.5 size-3.5" />
                </Link>
              </Button>
            }
          >
            <MetricRow label={t('dashboard.cards.menus.total')} value={menus.total} icon={Menu} />
            <MetricRow label={t('dashboard.cards.menus.active')} value={menus.active} icon={LayoutList} />
            <MetricRow label={t('dashboard.cards.menus.customized')} value={menus.customized} icon={Settings2} />
          </BottomDashboardCard>
          </>
        }
        secondary={
          <>
          <Card className={DASHBOARD_CARD}>
            <PanelHeader title={t('dashboard.cards.users_status.title')} subtitle={t('dashboard.cards.users_status.subtitle')} />
            <DashboardCardContent className="px-4 py-4 sm:pt-4">
              <ChartBox className="h-[200px] sm:h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <Pie
                      data={userApprovalData.length ? userApprovalData : [{ name: t('dashboard.chart.no_data'), value: 1, color: COLORS.gray }]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {(userApprovalData.length ? userApprovalData : [{ color: COLORS.gray }]).map((entry, i) => (
                        <Cell key={i} fill={'color' in entry ? entry.color : COLORS.gray} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10, width: '100%', left: 0 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartBox>
            </DashboardCardContent>
          </Card>

          <Card className={DASHBOARD_CARD}>
            <PanelHeader title={t('dashboard.cards.webhooks.title')} subtitle={t('dashboard.cards.webhooks.subtitle')} />
            <DashboardCardContent className="space-y-4 px-4 py-4">
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">{t('dashboard.cards.webhooks.active')}</span>
                  <p className="text-lg font-semibold tabular-nums text-emerald-500">{s.webhooks.active}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">{t('dashboard.cards.webhooks.inactive')}</span>
                  <p className="text-lg font-semibold tabular-nums">{s.webhooks.inactive}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-[10px] font-medium uppercase tracking-widest">
                  {t('dashboard.cards.webhooks.recent')}
                </p>
                <div className="space-y-2">
                  {s.webhooks.recent_deliveries.length === 0 ? (
                    <p className="text-muted-foreground text-xs">{t('dashboard.cards.webhooks.empty')}</p>
                  ) : (
                    s.webhooks.recent_deliveries.map((delivery, i) => (
                      <div key={i} className="flex flex-col gap-1.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                        <code className="text-muted-foreground truncate font-mono text-[11px]">{delivery.event}</code>
                        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-normal',
                              delivery.status === 'success'
                                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-500'
                                : 'border-red-500/30 bg-red-500/15 text-red-400',
                            )}
                          >
                            {delivery.status === 'success' ? t('dashboard.status.success') : t('dashboard.status.failed')}
                          </Badge>
                          <span className="text-muted-foreground">{delivery.created_at}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </DashboardCardContent>
          </Card>

          <Card className={DASHBOARD_CARD}>
            <PanelHeader title={t('dashboard.cards.invites.title')} subtitle={t('dashboard.cards.invites.subtitle')} />
            <DashboardCardContent className="space-y-3 px-4 py-4">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('dashboard.cards.invites.accepted')}</span>
                  <span className="font-medium tabular-nums text-emerald-500">{s.invites.accepted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('dashboard.cards.invites.pending')}</span>
                  <span className={cn('font-medium tabular-nums', s.invites.pending > 0 && 'text-amber-500')}>
                    {s.invites.pending}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('dashboard.cards.invites.expired')}</span>
                  <span className="font-medium tabular-nums">{s.invites.expired}</span>
                </div>
              </div>
              <ChartBox className="h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inviteBars} layout="vertical" barSize={12} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" hide />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {inviteBars.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
            </DashboardCardContent>
          </Card>

          <Card className={DASHBOARD_CARD}>
            <PanelHeader title={t('dashboard.cards.reports.title')} subtitle={t('dashboard.cards.reports.subtitle')} />
            <DashboardCardContent className="divide-y">
              {s.report_templates.length === 0 ? (
                <p className="text-muted-foreground px-4 py-6 text-sm">{t('dashboard.cards.reports.empty')}</p>
              ) : (
                s.report_templates.map((report) => (
                  <div key={report.name} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <BarChart3 className="text-muted-foreground size-3.5 shrink-0" />
                      <span className="truncate text-sm">{report.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ReportStatusBadge status={report.status} />
                      <span className="text-muted-foreground text-xs tabular-nums">{report.executions}x</span>
                    </div>
                  </div>
                ))
              )}
            </DashboardCardContent>
          </Card>

          <BottomDashboardCard
            title={t('dashboard.cards.user_preferences.title')}
            subtitle={t('dashboard.cards.user_preferences.subtitle')}
          >
            <MetricRow label={t('dashboard.cards.user_preferences.total')} value={formatNumber(userPreferences.total)} icon={Users} />
            <MetricRow
              label={t('dashboard.cards.user_preferences.notifications_on')}
              value={
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/15 font-semibold text-emerald-600">
                  {formatNumber(userPreferences.notifications_enabled)}
                </Badge>
              }
              icon={Bell}
            />
            <MetricRow
              label={t('dashboard.cards.user_preferences.notifications_off')}
              value={userPreferences.notifications_disabled}
              icon={BellOff}
            />
            <MetricRow
              label={t('dashboard.cards.user_preferences.email')}
              value={`${userPreferences.email_pct}%`}
              icon={Mail}
            />
            <MetricRow
              label={t('dashboard.cards.user_preferences.whatsapp')}
              value={`${userPreferences.whatsapp_pct}%`}
              icon={MessageCircle}
            />
          </BottomDashboardCard>

          {centralUsers.length > 0 ? (
            <BottomDashboardCard
              title={t('dashboard.cards.central_users.title')}
              subtitle={t('dashboard.cards.central_users.subtitle')}
              footer={
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to="/admin/super-admins">
                    {t('dashboard.cards.central_users.view')}
                    <ExternalLink className="ml-1.5 size-3.5" />
                  </Link>
                </Button>
              }
            >
              {centralUsers.map((cu) => (
                <div key={cu.id} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {getInitials(cu.name, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{cu.name}</p>
                      <p className="text-muted-foreground truncate text-xs">{cu.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-blue-500/30 bg-blue-500/10 text-blue-600">
                    {t('dashboard.cards.central_users.badge')}
                  </Badge>
                </div>
              ))}
            </BottomDashboardCard>
          ) : (
            <BottomDashboardCard title={t('dashboard.cards.activity.title')} subtitle={t('dashboard.cards.activity.subtitle')}>
              {(s.recent_activity ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('dashboard.cards.activity.empty')}</p>
              ) : (
                (s.recent_activity ?? []).slice(0, 6).map((item) => (
                  <div key={item.id} className="flex items-start gap-2 text-xs">
                    <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                      {item.entity}
                    </Badge>
                    <p className="min-w-0 flex-1 truncate text-foreground">{item.description}</p>
                    <span className="text-muted-foreground shrink-0">{item.created_at}</span>
                  </div>
                ))
              )}
            </BottomDashboardCard>
          )}
          </>
        }
      />

      <DashboardAnalyticsSection stats={s} centralUsers={centralUsers} />
    </PageBody>
  );
}
