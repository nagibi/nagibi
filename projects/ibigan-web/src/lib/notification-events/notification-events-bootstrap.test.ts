import { describe, expect, it } from 'vitest';
import { EQUIPAMENTO_NOTIFICATION_EVENTS } from '@/lib/notification-events/modules/equipamento-events';
import {
  getNotificationEvent,
  getNotificationEventCatalog,
  getRegisteredNotificationModules,
} from '@/lib/notification-events';
import '@/lib/notification-events/index';

describe('catálogo de eventos de notificação', () => {
  it('registra eventos Equipamento junto com a plataforma', () => {
    const modules = getRegisteredNotificationModules();

    expect(modules).toContain('platform');
    expect(modules).toContain('equipamento');
  });

  it('expõe loan.overdue com app e e-mail nos canais padrão', () => {
    const event = getNotificationEvent('loan.overdue');

    expect(event).toBeDefined();
    expect(event?.module).toBe('equipamento');
    expect(event?.allowed_channels).toEqual(expect.arrayContaining(['app', 'email']));
    expect(event?.default_channels).toEqual(expect.arrayContaining(['app', 'email']));
  });

  it('contém todos os slugs declarados no módulo Equipamento', () => {
    const catalogSlugs = new Set(getNotificationEventCatalog().map((event) => event.slug));
    const moduleSlugs = EQUIPAMENTO_NOTIFICATION_EVENTS.map((event) => event.slug);

    for (const slug of moduleSlugs) {
      expect(catalogSlugs.has(slug)).toBe(true);
    }
  });
});
