import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { NotificationsSheetPanel } from '@/partials/topbar/notifications-sheet-panel';
import { useNotificationPreferencesSheet } from '@/providers/notification-preferences-sheet-provider';
import { NotificationPreferencesSheet } from '@/components/notifications/notification-preferences-sheet';

interface NotificationsSheetContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const NotificationsSheetContext =
  createContext<NotificationsSheetContextValue | null>(null);

function NotificationSheetsHost({
  notificationsOpen,
  onNotificationsOpenChange,
}: {
  notificationsOpen: boolean;
  onNotificationsOpenChange: (open: boolean) => void;
}) {
  const {
    isOpen: preferencesOpen,
    moduleFilter,
    setOpen: setPreferencesOpen,
  } = useNotificationPreferencesSheet();

  return (
    <>
      <NotificationsSheetPanel
        open={notificationsOpen}
        onOpenChange={onNotificationsOpenChange}
      />
      <NotificationPreferencesSheet
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        module={moduleFilter ?? undefined}
      />
    </>
  );
}

export function NotificationsSheetProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const openSheet = useCallback(() => setOpen(true), []);
  const closeSheet = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({
      isOpen: open,
      open: openSheet,
      close: closeSheet,
    }),
    [open, openSheet, closeSheet],
  );

  return (
    <NotificationsSheetContext.Provider value={value}>
      {children}
      <NotificationSheetsHost
        notificationsOpen={open}
        onNotificationsOpenChange={setOpen}
      />
    </NotificationsSheetContext.Provider>
  );
}

export function useNotificationsSheet() {
  const context = useContext(NotificationsSheetContext);
  if (!context) {
    return { isOpen: false, open: () => {}, close: () => {} };
  }
  return context;
}
