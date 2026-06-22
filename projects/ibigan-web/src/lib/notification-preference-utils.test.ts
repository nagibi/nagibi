import { describe, expect, it } from 'vitest';
import { defineNotificationEvent } from '@/lib/notification-events/define-event';
import { getNotificationEvent } from '@/lib/notification-events';
import '@/lib/notification-events/index';
import {
  formatEventHint,
  isChannelAllowed,
  mergeNotificationPreferences,
  resolveEventChannelPrefs,
  resolveEventPreference,
} from '@/lib/notification-preference-utils';

describe('notification-preference-utils — app e e-mail', () => {
  const loanOverdue = getNotificationEvent('loan.overdue')!;
  const campaignSent = getNotificationEvent('campaign.sent')!;

  it('aplica defaults de app e e-mail a partir do catálogo Equipamento', () => {
    const prefs = resolveEventChannelPrefs(loanOverdue, null);

    expect(prefs.app).toBe(true);
    expect(prefs.email).toBe(true);
  });

  it('respeita preferências salvas do usuário para app e e-mail', () => {
    const prefs = resolveEventChannelPrefs(loanOverdue, {
      app: false,
      email: true,
    });

    expect(prefs.app).toBe(false);
    expect(prefs.email).toBe(true);
  });

  it('aplica default somente em app quando e-mail não está nos default_channels', () => {
    const prefs = resolveEventChannelPrefs(campaignSent, null);

    expect(prefs.app).toBe(true);
    expect(prefs.email).toBe(false);
    expect(isChannelAllowed(campaignSent, 'email')).toBe(true);
    expect(isChannelAllowed(campaignSent, 'app')).toBe(true);
  });

  it('ignora canais não permitidos pelo evento', () => {
    const appOnlyEvent = defineNotificationEvent({
      slug: 'test.app_only',
      module: 'platform',
      category: 'platform',
      label: 'Somente app',
      description: 'Evento restrito ao app.',
      severity: 'info',
      default_audience: ['admin'],
      allowed_channels: ['app'],
      default_channels: ['app'],
    });

    const prefs = resolveEventChannelPrefs(appOnlyEvent, {
      app: true,
      email: true,
    });

    expect(prefs.app).toBe(true);
    expect(prefs.email).toBe(false);
    expect(isChannelAllowed(appOnlyEvent, 'email')).toBe(false);
  });

  it('mescla preferências do catálogo com valores persistidos', () => {
    const merged = mergeNotificationPreferences(
      {
        'loan.overdue': { app: false, email: true, whatsapp: false },
      },
      ['loan.overdue'],
    );

    expect(merged['loan.overdue']).toEqual({
      app: false,
      email: true,
      whatsapp: false,
      delivery_mode: 'immediate',
    });
  });

  it('preenche delivery_mode a partir do evento quando ausente', () => {
    const digest = getNotificationEvent('digest.daily')!;
    const resolved = resolveEventPreference('digest.daily', { app: true, email: true });

    expect(resolved?.delivery_mode).toBe(digest.default_delivery);
    expect(resolved?.app).toBe(true);
    expect(resolved?.email).toBe(true);
  });

  it('formata hint com descrição e exemplo', () => {
    const event = defineNotificationEvent({
      slug: 'test.event',
      module: 'platform',
      category: 'platform',
      label: 'Teste',
      description: 'Descrição do evento.',
      example: 'Exemplo ilustrativo.',
      severity: 'info',
      default_audience: ['admin'],
      default_channels: ['app', 'email'],
    });

    expect(formatEventHint(event)).toBe(
      'Descrição do evento.\n\nExemplo: Exemplo ilustrativo.',
    );
  });
});
