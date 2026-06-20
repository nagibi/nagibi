import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  invalidateNotifications,
  upsertNotificationInCache,
} from '@/lib/notification-cache';
import { getNotificationDisplayBody, formatNotificationBody } from '@/lib/notification-utils';
import { getEcho } from '@/lib/echo';
import { showAppToast } from '@/lib/show-app-toast';
import { type AppNotification } from '@/services/notifications.service';
import { useAuthStore } from '@/stores/auth.store';

export function useNotifications() {
  const { user, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id || !isAuthenticated) return;

    const echo = getEcho();
    const channel = echo.private(`App.Models.User.${user.id}`);

    const onNotificationUpdated = (notification: AppNotification) => {
      upsertNotificationInCache(queryClient, notification);
    };

    const onNotificationsInvalidated = () => {
      void invalidateNotifications(queryClient);
    };

    channel.listen('.notification.updated', onNotificationUpdated);
    channel.listen('.notifications.invalidated', onNotificationsInvalidated);

    channel.notification((notification: {
      type: string;
      user_name?: string;
      template_name?: string;
      rows_count?: number;
      subject?: string;
      body?: string;
      [key: string]: unknown;
    }) => {
      void invalidateNotifications(queryClient);

      const type = notification.type?.split('\\').pop() ?? '';

      if (type === 'ReportCompletedNotification') {
        const subject = notification.subject
          ? String(notification.subject)
          : 'Relatório pronto';
        const description = notification.body
          ? formatNotificationBody(notification.body).slice(0, 120)
          : undefined;

        showAppToast({
          title: subject,
          description,
          variant: 'success',
        });
        return;
      }

      if (type === 'UserCreatedNotification' && notification.user_name) {
        showAppToast({
          title: 'Novo usuário',
          description: `${notification.user_name} foi criado`,
          variant: 'info',
        });
        return;
      }

      if (notification.subject) {
        showAppToast({
          title: String(notification.subject),
          description: notification.body
            ? formatNotificationBody(notification.body).slice(0, 80)
            : undefined,
          variant: 'info',
        });
        return;
      }

      showAppToast({
        title: 'Nova notificação',
        variant: 'info',
      });
    });

    return () => {
      channel.stopListening('.notification.updated', onNotificationUpdated);
      channel.stopListening('.notifications.invalidated', onNotificationsInvalidated);
      echo.leave(`App.Models.User.${user.id}`);
    };
  }, [user?.id, isAuthenticated, queryClient]);
}
