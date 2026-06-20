import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart2,
  CheckCircle,
  LoaderCircle,
  Mail,
  MailOpen,
  Package,
  Trash2,
  Wrench,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { type AppNotification } from '@/services/notifications.service';
import { getReportDownloadMeta, getNotificationDisplayBody, getNotificationActions, getNotificationCategoryLabel, getNotificationEventSlug, getNotificationSeverity, getNotificationTitle } from '@/lib/notification-utils';
import { getNotificationEvent } from '@/lib/notification-events';
import { downloadReportResultCsvWithToast } from '@/services/reports.service';
import { GridDownloadIcon } from '@/components/icons/grid-download-icon';
import { getInitials } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Avatar,
  AvatarFallback,
  AvatarIndicator,
  AvatarStatus,
} from '@/components/ui/avatar';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';

function getType(notification: AppNotification): string {
  return notification.type.split('\\').pop() ?? '';
}

function NotificationMeta({
  timeAgo,
  category,
}: {
  timeAgo: string;
  category: string;
}) {
  return (
    <span className="flex items-center text-xs font-medium text-muted-foreground">
      {timeAgo}
      <span className="mx-1.5 size-1 rounded-full bg-mono/30" />
      {category}
    </span>
  );
}

function NotificationAvatar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Avatar className="size-10 shrink-0">
      <AvatarFallback className={cn('text-xs font-semibold', className)}>
        {children}
      </AvatarFallback>
      <AvatarIndicator className="-bottom-1.5 -end-1.5">
        <AvatarStatus variant="online" className="size-2.5" />
      </AvatarIndicator>
    </Avatar>
  );
}

function NotificationFileCard({
  icon,
  fileName,
  fileMeta,
  onDownload,
  downloading,
  href,
  onNavigate,
}: {
  icon: string;
  fileName: string;
  fileMeta: string;
  onDownload: () => void;
  downloading?: boolean;
  href?: string;
  onNavigate?: () => void;
}) {
  const fileLabel = href ? (
    <Link
      to={href}
      className="text-xs font-medium text-secondary-foreground hover:text-primary"
      onClick={onNavigate}
    >
      {fileName}
    </Link>
  ) : (
    <button
      type="button"
      className="text-left text-xs font-medium text-secondary-foreground hover:text-primary"
      onClick={onDownload}
      disabled={downloading}
    >
      {downloading ? 'Baixando...' : fileName}
    </button>
  );

  return (
    <Card className="flex min-h-[52px] flex-row items-center justify-between gap-1.5 rounded-lg bg-muted/70 p-2.5 shadow-none">
      <div className="flex min-w-0 items-center gap-1.5">
        <img src={toAbsoluteUrl(icon)} className="h-6 shrink-0" alt="" />
        <div className="flex min-w-0 flex-col gap-0.5">
          {fileLabel}
          <span className="text-xs font-medium text-muted-foreground">{fileMeta}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        mode="icon"
        size="sm"
        className="size-8 shrink-0"
        onClick={onDownload}
        disabled={downloading}
        title="Baixar arquivo"
      >
        {downloading ? (
          <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />
        ) : (
          <GridDownloadIcon className="size-3.5 text-muted-foreground" />
        )}
      </Button>
    </Card>
  );
}

interface NotificationItemProps {
  notification: AppNotification;
  onMarkRead: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate?: () => void;
}

export function NotificationItem({
  notification,
  onMarkRead,
  onMarkUnread,
  onDelete,
  onNavigate,
}: NotificationItemProps) {
  const [downloading, setDownloading] = useState(false);
  const type = getType(notification);
  const data = notification.data;
  const isUnread = !notification.read_at;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  async function handleDownloadReport() {
    const { templateId, executionId, templateName } = getReportDownloadMeta(notification);

    if (!templateId || !executionId) {
      toast.error('Dados do relatório indisponíveis.');
      return;
    }

    setDownloading(true);
    try {
      await downloadReportResultCsvWithToast(templateId, executionId, templateName);
      if (isUnread) onMarkRead(notification.id);
    } catch {
      // Toast de erro já exibido pelo helper de download.
    } finally {
      setDownloading(false);
    }
  }

  const actions = (
    <div className="flex shrink-0 gap-1 self-start">
      {isUnread ? (
        <Button
          variant="ghost"
          mode="icon"
          size="sm"
          className="size-7"
          onClick={() => onMarkRead(notification.id)}
          title="Marcar como lida"
        >
          <CheckCircle className="size-3.5" />
        </Button>
      ) : onMarkUnread ? (
        <Button
          variant="ghost"
          mode="icon"
          size="sm"
          className="size-7"
          onClick={() => onMarkUnread(notification.id)}
          title="Marcar como não lida"
        >
          <MailOpen className="size-3" />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        mode="icon"
        size="sm"
        className="size-7"
        onClick={() => onDelete(notification.id)}
        title="Remover"
      >
        <Trash2 className="size-3 text-destructive" />
      </Button>
    </div>
  );

  if (type === 'ReportCompletedNotification') {
    const { templateId, templateName, fileName, fileMeta } = getReportDownloadMeta(notification);
    const headline = data.subject ? String(data.subject) : templateName;

    return (
      <div className={cn('flex grow items-start gap-2.5 px-5 py-4', isUnread && 'bg-primary/5')}>
        <NotificationAvatar className="bg-green-500/10 text-green-700">
          <BarChart2 className="size-4" />
        </NotificationAvatar>
        <div className="relative flex min-w-0 grow flex-col gap-3.5">
          <div className="absolute end-0 top-0 z-10">{actions}</div>

          <div className="flex flex-col gap-1 pe-14">
            <div className="mb-px text-sm font-medium">
              {templateId ? (
                <Link
                  to={`/reports/${templateId}/execute`}
                  className="font-semibold text-mono hover:text-primary"
                  onClick={() => isUnread && onMarkRead(notification.id)}
                >
                  {headline}
                </Link>
              ) : (
                <span className="font-semibold text-mono">{headline}</span>
              )}
              {!data.subject ? (
                <span className="text-secondary-foreground"> disponibilizou 1 anexo</span>
              ) : null}
            </div>
            <NotificationMeta timeAgo={timeAgo} category="Relatórios" />
          </div>

          <div className="flex flex-col gap-2.5">
            <NotificationFileCard
              icon="/media/file-types/xls.svg"
              fileName={fileName}
              fileMeta={fileMeta}
              onDownload={handleDownloadReport}
              downloading={downloading}
              href={templateId ? `/reports/${templateId}/execute` : undefined}
              onNavigate={() => isUnread && onMarkRead(notification.id)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => void handleDownloadReport()}
                disabled={downloading}
              >
                {downloading ? 'Downloading...' : 'Download'}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link
                  to="/reports/executions"
                  onClick={() => isUnread && onMarkRead(notification.id)}
                >
                  Ver execuções
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'UserCreatedNotification') {
    const userName = String(data.user_name ?? 'Usuário');
    const userEmail = String(data.user_email ?? '');
    const userId = data.user_id;

    return (
      <div className={cn('flex grow items-start gap-2.5 px-5 py-4', isUnread && 'bg-primary/5')}>
        <NotificationAvatar className="bg-primary/10 text-primary">
          {getInitials(userName, 2)}
        </NotificationAvatar>
        <div className="relative flex min-w-0 grow flex-col gap-3.5">
          <div className="absolute end-0 top-0 z-10">{actions}</div>
          <div className="flex flex-col gap-1 pe-14">
            <div className="text-sm font-medium">
              <span className="font-semibold text-mono">{userName}</span>
              <span className="text-secondary-foreground"> foi adicionado como usuário</span>
            </div>
            <NotificationMeta timeAgo={timeAgo} category="Usuários" />
          </div>

          <Card className="flex min-h-[52px] flex-row items-center justify-between gap-2 rounded-lg bg-muted/70 p-2.5 shadow-none">
            <div className="min-w-0">
              <span className="block truncate text-xs font-medium text-mono">{userName}</span>
              {userEmail && (
                <span className="block truncate text-xs font-medium text-muted-foreground">
                  {userEmail}
                </span>
              )}
            </div>
            {userId && (
              <Link
                to={`/users/${userId}`}
                className="shrink-0 text-xs font-medium text-primary hover:text-primary/80"
                onClick={() => isUnread && onMarkRead(notification.id)}
              >
                Ver perfil
              </Link>
            )}
          </Card>
        </div>
      </div>
    );
  }

  const eventSlug = getNotificationEventSlug(notification);
  const equipcontrolEvent = eventSlug ? getNotificationEvent(eventSlug) : null;
  const notificationActions = getNotificationActions(notification);

  if (equipcontrolEvent?.module === 'equipcontrol') {
    const title = getNotificationTitle(notification);
    const category = getNotificationCategoryLabel(notification) ?? 'EquipControl';
    const severity = getNotificationSeverity(notification);
    const primaryAction = notificationActions.find((action) => action.primary) ?? notificationActions[0];
    const primaryPath =
      primaryAction?.type === 'navigate' ? String(primaryAction.payload.path ?? '') : '';
    const body =
      getNotificationDisplayBody(notification) || equipcontrolEvent.example || '';

    const SeverityIcon =
      severity === 'critical' || severity === 'warning' ? AlertTriangle : Package;
    const avatarClass =
      severity === 'critical'
        ? 'bg-red-500/10 text-red-700'
        : severity === 'warning'
          ? 'bg-amber-500/10 text-amber-700'
          : 'bg-primary/10 text-primary';

    const handleNavigate = () => {
      if (isUnread) onMarkRead(notification.id);
      onNavigate?.();
    };

    return (
      <div className={cn('flex grow items-start gap-2.5 px-5 py-4', isUnread && 'bg-primary/5')}>
        <NotificationAvatar className={avatarClass}>
          {eventSlug?.startsWith('maintenance.') ? <Wrench className="size-4" /> : <SeverityIcon className="size-4" />}
        </NotificationAvatar>
        <div className="relative flex min-w-0 grow flex-col gap-3.5">
          <div className="absolute end-0 top-0 z-10">{actions}</div>
          <div className="flex flex-col gap-1 pe-14">
            <div className={cn('text-sm font-medium', isUnread && 'font-semibold')}>
              {primaryPath ? (
                <Link
                  to={primaryPath}
                  className="hover:text-primary"
                  onClick={handleNavigate}
                >
                  {title}
                </Link>
              ) : (
                title
              )}
            </div>
            <NotificationMeta timeAgo={timeAgo} category={category} />
          </div>
          {body ? (
            <Card className="rounded-lg bg-muted/70 p-2.5 shadow-none">
              <p className="line-clamp-3 text-xs text-secondary-foreground">{body}</p>
            </Card>
          ) : null}
          {primaryPath && primaryAction ? (
            <Button variant="outline" size="sm" className="h-7 w-fit text-xs" asChild>
              <Link
                to={primaryPath}
                onClick={handleNavigate}
              >
                {primaryAction.label}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (type === 'TemplateNotification' || data.subject) {
    const subject = String(data.subject ?? 'Nova mensagem');
    const body = data.body ? formatNotificationBody(data.body) : '';

    return (
      <div className={cn('flex grow items-start gap-2.5 px-5 py-4', isUnread && 'bg-primary/5')}>
        <NotificationAvatar className="bg-blue-500/10 text-blue-600">
          <Mail className="size-4" />
        </NotificationAvatar>
        <div className="relative flex min-w-0 grow flex-col gap-3.5">
          <div className="absolute end-0 top-0 z-10">{actions}</div>
          <div className="flex flex-col gap-1 pe-14">
            <div className={cn('text-sm font-medium', isUnread && 'font-semibold')}>{subject}</div>
            <NotificationMeta timeAgo={timeAgo} category="Mensagens" />
          </div>
          {body && (
            <Card className="rounded-lg bg-muted/70 p-2.5 shadow-none">
              <p className="line-clamp-3 text-xs text-secondary-foreground">{body}</p>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex grow items-start gap-2.5 px-5 py-4', isUnread && 'bg-primary/5')}>
      <NotificationAvatar className="border border-green-500/20 bg-green-500/10 text-green-600">
        <CheckCircle className="size-4" />
      </NotificationAvatar>
      <div className="relative flex min-w-0 grow flex-col gap-1">
        <div className="absolute end-0 top-0 z-10">{actions}</div>
        <span className={cn('pe-14 text-sm font-medium text-secondary-foreground', isUnread && 'font-semibold')}>
          Nova notificação
        </span>
        <NotificationMeta timeAgo={timeAgo} category="Sistema" />
      </div>
    </div>
  );
}
