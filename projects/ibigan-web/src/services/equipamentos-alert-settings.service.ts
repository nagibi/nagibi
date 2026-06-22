import api from '@/lib/axios';

export interface AlertSettingEntry {
  value: number;
  default: number;
  is_override: boolean;
}

export type AlertSettingsMap = Record<string, AlertSettingEntry>;

export const equipamentosAlertSettingsService = {
  show: () =>
    api.get<{ status: number; result: AlertSettingsMap }>('/v1/equipamentos/alert-settings'),

  update: (payload: Record<string, number>) =>
    api.put<{ status: number; result: AlertSettingsMap }>('/v1/equipamentos/alert-settings', payload),

  reset: (key: string) =>
    api.delete<{ status: number; result: AlertSettingsMap }>(`/v1/equipamentos/alert-settings/${key}`),
};