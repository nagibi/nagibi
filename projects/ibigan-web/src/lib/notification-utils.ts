import type { AppNotification } from '@/services/notifications.service';
import type {
  NotificationAction,
  NotificationSeverity,
} from '@/types/notification-events';
import { getNotificationEvent } from '@/lib/notification-events';
import { resolveEquipcontrolNotificationActions } from '@/lib/notification-events/equipcontrol-actions';

export function getNotificationType(notification: AppNotification): string {
  return notification.type.split('\\').pop() ?? notification.type;
}

export function formatNotificationBody(body: unknown): string {
  return String(body ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function getNotificationDisplayBody(notification: AppNotification): string {
  const data = notification.data;

  if (data.body_text) {
    return String(data.body_text);
  }

  const rawBody = data.body ? String(data.body) : '';
  if (rawBody.includes('<table') && data.message) {
    return String(data.message);
  }

  if (rawBody) {
    return formatNotificationBody(rawBody);
  }

  if (data.message) {
    return String(data.message);
  }

  return '';
}

export function isReportNotification(notification: AppNotification): boolean {
  const type = getNotificationType(notification);
  return type === 'ReportCompletedNotification' || Boolean(notification.data.template_id);
}

export function getNotificationTitle(notification: AppNotification): string {
  const data = notification.data;
  if (data.subject) return String(data.subject);
  if (data.template_name) return `Relatório "${String(data.template_name)}"`;
  if (data.message) return String(data.message);
  if (data.title) return String(data.title);
  return getNotificationType(notification);
}

export function getReportDownloadMeta(notification: AppNotification) {
  const data = notification.data;
  const templateId = Number(data.template_id);
  const executionId = Number(data.execution_id);
  const templateName = String(data.template_name ?? 'relatorio');
  const rowsCount = data.rows_count ?? 0;
  const durationMs = data.duration_ms ?? 0;

  return {
    templateId: Number.isFinite(templateId) ? templateId : null,
    executionId: Number.isFinite(executionId) ? executionId : null,
    templateName,
    fileName: `${templateName}.csv`,
    fileMeta: `${rowsCount} registros · ${durationMs}ms`,
  };
}

function parseNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value);
  }

  return null;
}

function getEquipcontrolBusinessRecordId(
  slug: string,
  data: Record<string, unknown>,
): number | null {
  if (slug.startsWith('loan.')) {
    return parseNumericId(data.emprestimo_id);
  }

  if (slug.startsWith('maintenance.')) {
    return parseNumericId(data.manutencao_id) ?? parseNumericId(data.equipamento_id);
  }

  if (slug.startsWith('equipment.') || slug.startsWith('critical.')) {
    return parseNumericId(data.equipamento_id);
  }

  return (
    parseNumericId(data.emprestimo_id)
    ?? parseNumericId(data.manutencao_id)
    ?? parseNumericId(data.equipamento_id)
  );
}

/** ID numérico do registro de negócio vinculado à notificação. */
export function getNotificationRecordId(notification: AppNotification): number | null {
  const slug = getNotificationEventSlug(notification);
  const data = notification.data;

  if (slug) {
    const event = getNotificationEvent(slug);
    if (event?.module === 'equipcontrol') {
      const businessId = getEquipcontrolBusinessRecordId(slug, data);
      if (businessId != null) {
        return businessId;
      }
    }
  }

  const candidates = [
    notification.record_id,
    data.record_id,
    data.notification_id,
  ];

  for (const candidate of candidates) {
    const numericId = parseNumericId(candidate);
    if (numericId != null) {
      return numericId;
    }
  }

  return null;
}

export function getNotificationEventSlug(notification: AppNotification): string | null {
  const slug = notification.data.event_slug ?? notification.data.event;
  return slug ? String(slug) : null;
}

export function getNotificationSeverity(notification: AppNotification): NotificationSeverity | null {
  const raw = notification.data.severity;
  if (raw === 'info' || raw === 'warning' || raw === 'critical') {
    return raw;
  }

  const slug = getNotificationEventSlug(notification);
  if (!slug) return null;

  return getNotificationEvent(slug)?.severity ?? null;
}

function parseAction(value: unknown): NotificationAction | null {
  if (!value || typeof value !== 'object') return null;

  const action = value as Record<string, unknown>;
  const id = action.id;
  const label = action.label;
  const type = action.type;

  if (typeof id !== 'string' || typeof label !== 'string' || typeof type !== 'string') {
    return null;
  }

  if (type !== 'navigate' && type !== 'api' && type !== 'modal') {
    return null;
  }

  return {
    id,
    label,
    type,
    payload: (action.payload as Record<string, unknown>) ?? {},
    primary: Boolean(action.primary),
  };
}

export function getNotificationActions(notification: AppNotification): NotificationAction[] {
  const raw = notification.data.actions;
  const fromApi = Array.isArray(raw)
    ? raw.map(parseAction).filter((action): action is NotificationAction => action !== null)
    : [];

  if (fromApi.length > 0) return fromApi;

  const slug = getNotificationEventSlug(notification);
  if (!slug) return [];

  const event = getNotificationEvent(slug);
  if (event?.module === 'equipcontrol') {
    return resolveEquipcontrolNotificationActions(slug, notification.data);
  }

  return [];
}

export function getNotificationCategoryLabel(notification: AppNotification): string | null {
  const slug = getNotificationEventSlug(notification);
  if (!slug) return null;

  const event = getNotificationEvent(slug);
  if (!event) return null;

  return event.label;
}

export function getNotificationCategoryDisplay(notification: AppNotification): string {
  if (isReportNotification(notification)) {
    return 'Relatórios';
  }

  return getNotificationCategoryLabel(notification) ?? getNotificationType(notification);
}
