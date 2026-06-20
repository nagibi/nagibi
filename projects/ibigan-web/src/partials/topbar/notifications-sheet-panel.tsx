import { useMemo, useState } from 'react';
import {
  EquipcontrolAlertasPanel,
  useEquipcontrolAlertasTotal,
} from '@/pages/equipamentos/components/equipcontrol-alertas-panel';
import { NotificationItem } from '@/partials/topbar/notifications/notification-item';
import { useAuthStore } from '@/stores/auth.store';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Bell,
  CheckCheck,
  ExternalLink,
  Settings,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  invalidateNotifications,
  markAllNotificationsReadInCache,
  removeNotificationFromCache,
  upsertNotificationInCache,
} from '@/lib/notification-cache';
import { isReportNotification } from '@/lib/notification-utils';
import { useCentralOnlySession } from '@/hooks/use-central-only-session';
import { useEquipcontrolAlertasEnabled } from '@/hooks/use-equipcontrol-alertas-enabled';
import { useNotificationsList } from '@/hooks/use-notifications-list';
import { useNotificationPreferencesSheet } from '@/providers/notification-preferences-sheet-provider';
import { notificationsService } from '@/services/notifications.service';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SheetPanelTitle } from '@/components/common/panel-title';
import { NotificationListSkeleton } from '@/components/common/side-panel-skeleton';

export function NotificationsSheetPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { open: openPreferences } = useNotificationPreferencesSheet();
  const isCentralOnly = useCentralOnlySession();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const equipcontrolAlertasEnabled = useEquipcontrolAlertasEnabled();
  const [activeTab, setActiveTab] = useState('all');

  const { t } = useTranslation();
  const { data, isLoading } = useNotificationsList(open);
  const alertasTotal = useEquipcontrolAlertasTotal(
    open && equipcontrolAlertasEnabled,
  );

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: (response) => {
      upsertNotificationInCache(queryClient, response.data.result);
      toast.success(t('notifications.marked_read'));
    },
  });

  const markAsUnreadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markAsUnread(id),
    onSuccess: (response) => {
      upsertNotificationInCache(queryClient, response.data.result);
      toast.success(t('notifications.marked_unread'));
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => {
      markAllNotificationsReadInCache(queryClient);
      toast.success('Todas marcadas como lidas.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsService.destroy(id),
    onSuccess: (_response, id) => {
      removeNotificationFromCache(queryClient, id);
      void invalidateNotifications(queryClient);
    },
  });

  const notifications = data?.data.result.data ?? [];
  const unread =
    data?.data.result.meta.unread ??
    notifications.filter((notification) => !notification.read_at).length;
  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read_at),
    [notifications],
  );
  const reportNotifications = useMemo(
    () => notifications.filter(isReportNotification),
    [notifications],
  );
  const unreadReportNotifications = useMemo(
    () => reportNotifications.filter((notification) => !notification.read_at),
    [reportNotifications],
  );

  function renderNotifications(
    items: typeof notifications,
    emptyLabel = 'Nenhuma notificação',
  ) {
    if (isLoading) {
      return <NotificationListSkeleton />;
    }

    if (items.length === 0) {
      if (!isAuthenticated && isCentralOnly) {
        return (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-muted-foreground">
            <Bell className="size-10 opacity-30" />
            <p className="text-sm">
              Entre em uma empresa para ver e receber notificações.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/profile" onClick={() => onOpenChange(false)}>
                Selecionar empresa
              </Link>
            </Button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bell className="mb-2 size-10 opacity-30" />
          <p className="text-sm">{emptyLabel}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col divide-y divide-border overflow-y-auto">
        {items.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkRead={(id) => markAsReadMutation.mutate(id)}
            onMarkUnread={(id) => markAsUnreadMutation.mutate(id)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onNavigate={() => onOpenChange(false)}
          />
        ))}
      </div>
    );
  }

  const tabTriggerClassName =
    'relative justify-center px-0.5 text-center text-[11px] leading-tight !whitespace-normal sm:px-2 sm:text-sm sm:leading-normal sm:!whitespace-nowrap';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        close={false}
        className="mobile-side-panel-sheet gap-0 rounded-lg p-0 sm:inset-5 sm:start-auto sm:h-auto sm:max-h-[calc(100vh-2.5rem)] sm:w-[500px] sm:max-w-none"
      >
        <SheetHeader className="mb-0 flex-row items-center gap-3 border-b px-5 py-4">
          <SheetPanelTitle icon={Bell} className="min-w-0 flex-1 pe-0">
            Notificações
          </SheetPanelTitle>
          <div className="flex shrink-0 items-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              mode="icon"
              className="size-8 shrink-0"
              aria-label="Preferências de notificações"
              onClick={() => {
                onOpenChange(false);
                window.setTimeout(
                  () =>
                    openPreferences(
                      equipcontrolAlertasEnabled
                        ? { module: 'equipcontrol' }
                        : undefined,
                    ),
                  0,
                );
              }}
            >
              <Settings className="size-4" />
            </Button>
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                mode="icon"
                className="size-8 shrink-0 opacity-60 hover:opacity-100"
              >
                <X className="size-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <SheetBody className="min-h-0 grow p-0">
          <ScrollArea className="h-[calc(100dvh-11rem)] max-xl:h-[calc(100dvh-12rem)] sm:h-[calc(100vh-10.5rem)]">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="relative w-full min-w-0 max-w-full"
            >
              <TabsList
                variant="line"
                size="sm"
                className={`mb-5 w-full min-w-0 max-w-full !grid px-2 sm:!flex sm:justify-start sm:gap-4 sm:px-5 ${
                  equipcontrolAlertasEnabled ? 'grid-cols-4' : 'grid-cols-3'
                }`}
              >
                <TabsTrigger value="all" className={tabTriggerClassName}>
                  Todas
                </TabsTrigger>
                <TabsTrigger value="unread" className={tabTriggerClassName}>
                  Não lidas
                  {unread > 0 && (
                    <span className="absolute end-0 top-0.5 size-1.5 rounded-full bg-green-500 sm:end-0.5 sm:top-1" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="reports" className={tabTriggerClassName}>
                  Relatórios
                  {unreadReportNotifications.length > 0 && (
                    <span className="absolute end-0 top-0.5 size-1.5 rounded-full bg-green-500 sm:end-0.5 sm:top-1" />
                  )}
                </TabsTrigger>
                {equipcontrolAlertasEnabled ? (
                  <TabsTrigger value="alertas" className={tabTriggerClassName}>
                    Alertas
                    {alertasTotal > 0 && (
                      <span className="absolute end-0 top-0.5 size-1.5 rounded-full bg-amber-500 sm:end-0.5 sm:top-1" />
                    )}
                  </TabsTrigger>
                ) : null}
              </TabsList>

              <TabsContent value="all" className="mt-0">
                {renderNotifications(notifications)}
              </TabsContent>

              <TabsContent value="unread" className="mt-0">
                {renderNotifications(
                  unreadNotifications,
                  'Nenhuma notificação não lida',
                )}
              </TabsContent>

              <TabsContent value="reports" className="mt-0">
                <div className="mb-4 flex items-center justify-between gap-2 px-5">
                  <p className="text-xs text-muted-foreground">
                    Relatórios concluídos com download direto.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    asChild
                  >
                    <Link
                      to="/reports/executions"
                      onClick={() => onOpenChange(false)}
                    >
                      <ExternalLink className="mr-1 size-3" />
                      Ver execuções
                    </Link>
                  </Button>
                </div>
                {renderNotifications(
                  reportNotifications,
                  'Nenhuma notificação de relatório',
                )}
              </TabsContent>

              {equipcontrolAlertasEnabled ? (
                <TabsContent value="alertas" className="mt-0">
                  <p className="mb-4 px-5 text-xs text-muted-foreground">
                    Panorama operacional ao vivo de equipamentos — empréstimos,
                    manutenções e equipamentos parados.
                  </p>
                  <EquipcontrolAlertasPanel
                    enabled={open}
                    onNavigate={() => onOpenChange(false)}
                    showDashboardLink={false}
                  />
                </TabsContent>
              ) : null}
            </Tabs>
          </ScrollArea>
        </SheetBody>

        <SheetFooter className="border-t border-border p-5">
          {activeTab === 'alertas' && equipcontrolAlertasEnabled ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                navigate('/equipamentos/dashboard');
              }}
            >
              Ver dashboard
            </Button>
          ) : (
            <div className="grid w-full grid-cols-2 gap-2.5">
              <Button
                variant="destructive"
                onClick={() => {
                  const readIds = notifications
                    .filter((notification) => notification.read_at)
                    .map((n) => n.id);
                  if (readIds.length === 0) {
                    toast.info('Nenhuma notificação lida para arquivar.');
                    return;
                  }
                  Promise.all(
                    readIds.map((id) => notificationsService.destroy(id)),
                  )
                    .then(() => {
                      void invalidateNotifications(queryClient);
                      toast.success('Notificações lidas arquivadas.');
                    })
                    .catch(() => toast.error('Erro ao arquivar notificações.'));
                }}
              >
                <Archive className="mr-1 size-4" />
                Arquivar lidas
              </Button>
              <Button
                variant="outline"
                onClick={() => markAllMutation.mutate()}
                disabled={unread === 0 || markAllMutation.isPending}
              >
                <CheckCheck className="mr-1 size-4" />
                Marcar todas
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
