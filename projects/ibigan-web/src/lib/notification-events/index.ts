/**
 * Ponto de entrada do motor de eventos de notificação da plataforma Ibigan.
 *
 * Cada módulo registra seus eventos via `registerNotificationEvents`.
 * Na branch `feature/ibigan-controle-equipamentos`, eventos do Equipamento também estão ativos.
 */
import { PLATFORM_NOTIFICATION_EVENTS } from '@/lib/notification-events/platform-events';
import {
  getNotificationEvent,
  getNotificationEventCatalog,
  getNotificationEventsByCategory,
  getRegisteredNotificationModules,
  registerNotificationEvents,
} from '@/lib/notification-events/registry';

import { EQUIPAMENTO_NOTIFICATION_EVENTS } from '@/lib/notification-events/modules/equipamento-events';

registerNotificationEvents(PLATFORM_NOTIFICATION_EVENTS);
registerNotificationEvents(EQUIPAMENTO_NOTIFICATION_EVENTS);

export {
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_CATEGORY_ORDER,
} from '@/lib/notification-events/categories';
export { defineNotificationEvent } from '@/lib/notification-events/define-event';
export {
  getNotificationEvent,
  getNotificationEventCatalog,
  getNotificationEventsByCategory,
  getRegisteredNotificationModules,
  registerNotificationEvents,
};

/** Catálogo ativo após bootstrap dos módulos registrados acima. */
export const NOTIFICATION_EVENT_CATALOG = getNotificationEventCatalog();
