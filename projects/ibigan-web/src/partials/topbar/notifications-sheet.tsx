import type { ReactNode } from 'react';
import { useEquipamentoAlertasTotal } from '@/pages/equipamentos/components/equipamento-alertas-panel';
import { useEquipamentoAlertasEnabled } from '@/hooks/use-equipamento-alertas-enabled';
import { useNotificationsUnreadCount } from '@/hooks/use-notifications-list';
import { useNotificationsSheet } from '@/providers/notifications-sheet-provider';
import { Badge } from '@/components/ui/badge';

export function NotificationsSheet({ trigger }: { trigger: ReactNode }) {
  const { open: openSheet, isOpen } = useNotificationsSheet();
  const unread = useNotificationsUnreadCount(isOpen);
  const equipamentoAlertasEnabled = useEquipamentoAlertasEnabled();
  const alertasTotal = useEquipamentoAlertasTotal(equipamentoAlertasEnabled);
  const badgeCount = unread + (equipamentoAlertasEnabled ? alertasTotal : 0);

  return (
    <div className="relative inline-flex cursor-pointer" onClick={openSheet}>
      {trigger}
      {badgeCount > 0 && (
        <Badge
          variant="destructive"
          shape="circle"
          className="pointer-events-none absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none"
        >
          {badgeCount > 9 ? '9+' : badgeCount}
        </Badge>
      )}
    </div>
  );
}
