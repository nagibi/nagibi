import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  NotificationPreferencesSheetProvider,
  useNotificationPreferencesSheet,
} from '@/providers/notification-preferences-sheet-provider';

describe('NotificationPreferencesSheetProvider', () => {
  it('armazena filtro de módulo ao abrir preferências', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NotificationPreferencesSheetProvider>
        {children}
      </NotificationPreferencesSheetProvider>
    );

    const { result } = renderHook(() => useNotificationPreferencesSheet(), {
      wrapper,
    });

    expect(result.current.moduleFilter).toBeNull();
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.open({ module: 'equipamento' });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.moduleFilter).toBe('equipamento');

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.moduleFilter).toBeNull();
  });
});
