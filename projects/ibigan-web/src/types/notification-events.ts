export type NotificationModule =
  | 'platform'
  | 'equipamento'
  | 'hr'
  | 'tickets'
  | 'contracts'
  | 'purchases'
  | 'fleet'
  | 'crm';

export type NotificationEventCategory =
  | 'platform'
  | 'loans'
  | 'inventory'
  | 'maintenance'
  | 'critical'
  | 'sites'
  | 'employees'
  | 'insight'
  | 'digest';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export type NotificationChannel = 'app' | 'email' | 'whatsapp' | 'push';

export type NotificationDeliveryMode = 'immediate' | 'daily' | 'weekly';

export type NotificationTargetAudience =
  | 'manager'
  | 'field_operator'
  | 'finance'
  | 'admin'
  | 'director';

export interface NotificationEventDefinition {
  slug: string;
  module: NotificationModule;
  category: NotificationEventCategory;
  label: string;
  description: string;
  example?: string;
  severity: NotificationSeverity;
  default_audience: NotificationTargetAudience[];
  allowed_channels: NotificationChannel[];
  default_channels: NotificationChannel[];
  default_delivery: NotificationDeliveryMode;
  supports_digest: boolean;
  supports_escalation: boolean;
}

export interface NotificationChannelPrefs {
  app: boolean;
  email: boolean;
  whatsapp: boolean;
  push?: boolean;
}

export interface NotificationPreferenceRecord extends NotificationChannelPrefs {
  delivery_mode?: NotificationDeliveryMode;
}

export type NotificationPreferencesMap = Record<string, NotificationPreferenceRecord>;

export type NotificationActionType = 'navigate' | 'api' | 'modal';

export interface NotificationAction {
  id: string;
  label: string;
  type: NotificationActionType;
  payload: Record<string, unknown>;
  primary?: boolean;
}

/** Regra padrão do tenant para um evento (fase 2 — admin). */
export interface NotificationRule {
  event_slug: string;
  enabled: boolean;
  allowed_channels: NotificationChannel[];
  default_channels?: NotificationChannel[];
  default_delivery?: NotificationDeliveryMode;
  default_audience?: NotificationTargetAudience[];
  params?: Record<string, unknown>;
}

export interface NotificationTenantRules {
  global_allowed_channels?: NotificationChannel[];
  whatsapp_enabled?: boolean;
  events: Record<string, NotificationRule>;
}

/** Payload enviado por módulos ao Dispatcher (contrato backend). */
export interface NotificationDispatchPayload {
  event_slug: string;
  severity?: NotificationSeverity;
  entity?: {
    type: string;
    id: string | number;
  };
  context?: Record<string, unknown>;
  actions?: NotificationAction[];
  user_ids?: number[];
  audiences?: NotificationTargetAudience[];
}

export interface ApiNotificationEventsResponse {
  status: number;
  result: NotificationEventDefinition[];
}

export interface ApiNotificationPreferencesResponse {
  status: number;
  result: NotificationPreferencesMap;
}

export interface ApiNotificationRulesResponse {
  status: number;
  result: NotificationTenantRules;
}
