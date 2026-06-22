import { useApiMenuByPath } from '@/hooks/use-api-menu-by-path';

export function useEquipamentoAlertasEnabled() {
  return Boolean(useApiMenuByPath('/equipamentos'));
}
