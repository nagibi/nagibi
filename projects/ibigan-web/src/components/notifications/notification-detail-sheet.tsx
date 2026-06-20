import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart2, Bell, CheckCircle, Eye, LoaderCircle, Mail, Trash2 } from 'lucide-react';
import { GridDownloadIcon } from '@/components/icons/grid-download-icon';
import {
  getNotificationActions,
  getNotificationCategoryLabel,
  getNotificationSeverity,
  getNotificationTitle,
  getNotificationType,
  getNotificationDisplayBody,
  getReportDownloadMeta,
  formatNotificationBody,
  isReportNotification,
} from '@/lib/notification-utils';
import { type AppNotification } from '@/services/notifications.service';
import { downloadReportResultCsvWithToast } from '@/services/reports.service';
import { NotificationActionsBar } from '@/components/notifications/notification-actions-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { SheetPanelTitle } from '@/components/common/panel-title';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
} from '@/components/ui/sheet';

interface NotificationDetailSheetProps {
  notification: AppNotification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function DetailField({ label, value }: { label: string; value: string }) {
  if (!value) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm break-words">{value}</p>
    </div>
  );
}

export function NotificationDetailSheet({
  notification,
  open,
  onOpenChange,
  onMarkRead,
  onMarkUnread,
  onDelete,
}: NotificationDetailSheetProps) {
  const [downloading, setDownloading] = useState(false);

  if (!notification) {
    return null;
  }

  const title = getNotificationTitle(notification);
  const typeLabel = isReportNotification(notification)
    ? 'Relatórios'
    : getNotificationCategoryLabel(notification) ?? getNotificationType(notification);
  const severity = getNotificationSeverity(notification);
  const actions = getNotificationActions(notification);
  const isUnread = !notification.read_at;
  const reportMeta = isReportNotification(notification)
    ? getReportDownloadMeta(notification)
    : null;

  async function handleDownloadReport() {
    if (!reportMeta?.templateId || !reportMeta.executionId) return;

    setDownloading(true);
    try {
      await downloadReportResultCsvWithToast(
        reportMeta.templateId,
        reportMeta.executionId,
        reportMeta.templateName,
      );
    } finally {
      setDownloading(false);
    }
  }

  const extraFields = Object.entries(notification.data)
    .filter(([key, value]) => {
      if (value === null || value === undefined || value === '') return false;
      return !['template_name', 'message', 'title', 'subject', 'body', 'actions', 'event_slug', 'event', 'severity'].includes(key);
    })
    .map(([key, value]) => ({
      label: key.replace(/_/g, ' '),
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="mobile-side-panel-sheet gap-0 rounded-lg p-0 sm:inset-5 sm:start-auto sm:h-auto sm:max-h-[calc(100vh-2.5rem)] sm:w-[520px] sm:max-w-none [&_[data-slot=sheet-close]]:end-5 [&_[data-slot=sheet-close]]:top-4.5">
        <SheetHeader className="mb-0 border-b px-5 py-4">
          <SheetPanelTitle icon={Bell}>Visualizar notificação</SheetPanelTitle>
        </SheetHeader>

        <SheetBody className="min-h-0 grow p-0">
          <ScrollArea className="h-[calc(100dvh-12rem)] sm:h-[calc(100vh-11rem)]">
            <div className="space-y-5 px-5 py-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isUnread ? 'primary' : 'outline'}>
                    {isUnread ? 'Não lida' : 'Lida'}
                  </Badge>
                  <Badge variant="secondary">{typeLabel}</Badge>
                  {severity === 'critical' ? (
                    <Badge variant="destructive">Crítico</Badge>
                  ) : null}
                  {severity === 'warning' ? (
                    <Badge variant="warning">Atenção</Badge>
                  ) : null}
                </div>
                <h2 className="text-base font-semibold leading-snug">{title}</h2>
                <p className="text-sm text-muted-foreground">
                  Recebida em{' '}
                  {format(new Date(notification.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>

              {getNotificationDisplayBody(notification) ? (
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-sm whitespace-pre-wrap">{getNotificationDisplayBody(notification)}</p>
                </div>
              ) : null}

              {notification.data.message && !getNotificationDisplayBody(notification) ? (
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-sm whitespace-pre-wrap">{String(notification.data.message)}</p>
                </div>
              ) : null}

              <NotificationActionsBar
                actions={actions}
                onActionComplete={() => onOpenChange(false)}
                className="rounded-lg border border-border p-3"
              />

              {reportMeta ? (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BarChart2 className="size-4 text-primary" />
                    Relatório concluído
                  </div>
                  <DetailField label="Arquivo" value={reportMeta.fileName} />
                  <DetailField label="Detalhes" value={reportMeta.fileMeta} />
                </div>
              ) : null}

              {extraFields.length > 0 ? (
                <>
                  <Separator />
                  <div className="grid gap-3">
                    {extraFields.map((field) => (
                      <DetailField key={field.label} label={field.label} value={field.value} />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </ScrollArea>
        </SheetBody>

        <SheetFooter className="grid grid-cols-2 gap-2 border-t border-border p-5 sm:flex sm:flex-wrap">
          {isUnread && onMarkRead ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onMarkRead(notification.id)}
            >
              <CheckCircle className="mr-1 size-3.5" />
              Marcar como lida
            </Button>
          ) : null}
          {!isUnread && onMarkUnread ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onMarkUnread(notification.id)}
            >
              <Mail className="mr-1 size-3.5" />
              Marcar como não lida
            </Button>
          ) : null}
          {reportMeta?.templateId && reportMeta.executionId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleDownloadReport()}
              disabled={downloading}
            >
              {downloading
                ? <LoaderCircle className="mr-1 size-3.5 animate-spin" />
                : <GridDownloadIcon className="mr-1 size-3.5" />
              }
              Download
            </Button>
          ) : null}
          {reportMeta?.templateId ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to={`/reports/${reportMeta.templateId}/execute`} onClick={() => onOpenChange(false)}>
                <Eye className="mr-1 size-3.5" />
                Visualizar
              </Link>
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete(notification.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="mr-1 size-3.5" />
              Remover
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
