import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupEventsByCategory } from '@/lib/notification-catalog-merge';
import { getNotificationEvent } from '@/lib/notification-events';
import { NotificationPreferencesContent } from '@/components/notifications/notification-preferences-content';
import '@/lib/notification-events/index';

const mutateMock = vi.fn();

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/use-notification-event-catalog', () => ({
  useNotificationEventCatalog: () => {
    const loanOverdue = getNotificationEvent('loan.overdue')!;
    const campaignSent = getNotificationEvent('campaign.sent')!;
    const catalog = [loanOverdue, campaignSent];

    return {
      catalog,
      eventsByCategory: groupEventsByCategory(catalog),
      localCatalog: catalog,
      isLoading: false,
      isRemote: false,
      error: null,
    };
  },
}));

vi.mock('@/services/notification-preferences.service', () => ({
  notificationPreferencesService: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );

  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: {
        data: {
          result: {
            'loan.overdue': { app: true, email: false, whatsapp: true },
            'campaign.sent': { app: true, email: false },
          },
        },
      },
      isLoading: false,
    })),
    useMutation: vi.fn(() => ({
      mutate: mutateMock,
      isPending: false,
    })),
  };
});

function renderPreferences(module?: 'equipamento' | 'platform') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationPreferencesContent
        module={module}
        showColumnHeader={false}
      />
    </QueryClientProvider>,
  );
}

describe('NotificationPreferencesContent — app e e-mail', () => {
  beforeEach(() => {
    mutateMock.mockClear();
  });

  it('renderiza toggles de app e e-mail conforme preferências salvas', () => {
    renderPreferences('equipamento');

    const appSwitch = screen.getByRole('switch', {
      name: /Empréstimo vencido — App/i,
    });
    const emailSwitch = screen.getByRole('switch', {
      name: /Empréstimo vencido — E-mail/i,
    });

    expect(appSwitch).toHaveAttribute('data-state', 'checked');
    expect(emailSwitch).toHaveAttribute('data-state', 'unchecked');
  });

  it('mantém e-mail desligado por padrão quando não está nos default_channels', () => {
    renderPreferences();

    expect(
      screen.getByRole('switch', { name: /Campanha enviada — E-mail/i }),
    ).toHaveAttribute('data-state', 'unchecked');
    expect(
      screen.getByRole('switch', { name: /Campanha enviada — App/i }),
    ).toHaveAttribute('data-state', 'checked');
  });

  it('dispara atualização ao alternar app', async () => {
    const user = userEvent.setup();
    renderPreferences('equipamento');

    await user.click(
      screen.getByRole('switch', { name: /Empréstimo vencido — App/i }),
    );

    expect(mutateMock).toHaveBeenCalledWith({
      event: 'loan.overdue',
      channel: 'app',
      enabled: false,
    });
  });

  it('dispara atualização ao alternar e-mail', async () => {
    const user = userEvent.setup();
    renderPreferences('equipamento');

    await user.click(
      screen.getByRole('switch', { name: /Empréstimo vencido — E-mail/i }),
    );

    expect(mutateMock).toHaveBeenCalledWith({
      event: 'loan.overdue',
      channel: 'email',
      enabled: true,
    });
  });

  it('filtra catálogo pelo módulo equipamento', () => {
    renderPreferences('equipamento');

    expect(screen.getByText('Empréstimo vencido')).toBeInTheDocument();
    expect(screen.queryByText('Campanha enviada')).not.toBeInTheDocument();
  });
});
