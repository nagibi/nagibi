import type {
  NotificationEventCategory,
  NotificationEventDefinition,
} from '@/types/notification-events';
import { NOTIFICATION_CATEGORY_ORDER } from '@/lib/notification-events/categories';

const registeredEvents: NotificationEventDefinition[] = [];
const slugIndex = new Map<string, NotificationEventDefinition>();

function indexEvent(event: NotificationEventDefinition) {
  if (slugIndex.has(event.slug)) {
    console.warn(`[notification-events] slug duplicado ignorado: ${event.slug}`);
    return;
  }

  registeredEvents.push(event);
  slugIndex.set(event.slug, event);
}

/** Registra eventos de um módulo (platform, equipamento, hr, …). */
export function registerNotificationEvents(events: NotificationEventDefinition[]) {
  for (const event of events) {
    indexEvent(event);
  }
}

export function getNotificationEventCatalog(): NotificationEventDefinition[] {
  return [...registeredEvents];
}

export function getNotificationEvent(slug: string): NotificationEventDefinition | undefined {
  return slugIndex.get(slug);
}

export function getNotificationEventsByCategory(): Record<
  NotificationEventCategory,
  NotificationEventDefinition[]
> {
  const grouped = {} as Record<NotificationEventCategory, NotificationEventDefinition[]>;

  for (const category of NOTIFICATION_CATEGORY_ORDER) {
    grouped[category] = [];
  }

  for (const event of registeredEvents) {
    grouped[event.category].push(event);
  }

  return grouped;
}

export function getRegisteredNotificationModules(): string[] {
  return [...new Set(registeredEvents.map((event) => event.module))];
}
