import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Mail,
  MessageCircle,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  NotificationChannel,
  NotificationEventCategory,
  NotificationEventDefinition,
  NotificationModule,
  NotificationSeverity,
} from '@/types/notification-events';
import { groupEventsByCategory } from '@/lib/notification-catalog-merge';
import {
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_CATEGORY_ORDER,
} from '@/lib/notification-events';
import {
  formatEventHint,
  isChannelAllowed,
  mergeNotificationPreferences,
  resolveEventChannelPrefs,
} from '@/lib/notification-preference-utils';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNotificationEventCatalog } from '@/hooks/use-notification-event-catalog';
import { notificationPreferencesService } from '@/services/notification-preferences.service';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { NotificationPreferencesSkeleton } from '@/components/common/side-panel-skeleton';

const VISIBLE_CHANNELS: Array<{
  key: NotificationChannel;
  label: string;
  icon: typeof Smartphone;
}> = [
  { key: 'app', label: 'App', icon: Smartphone },
  { key: 'email', label: 'E-mail', icon: Mail },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

const DEFAULT_OPEN_CATEGORIES: NotificationEventCategory[] = ['platform'];

const EQUIPAMENTO_OPEN_CATEGORIES: NotificationEventCategory[] = [
  'loans',
  'inventory',
  'maintenance',
];

export function NotificationPreferencesColumnHeader({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-border/60 bg-background py-2',
        className,
      )}
    >
      <div className="hidden min-w-0 flex-1 text-xs font-medium text-muted-foreground sm:block">
        Evento
      </div>
      <div className="flex w-full shrink-0 items-center justify-around text-[10px] text-muted-foreground sm:w-[9rem]">
        {VISIBLE_CHANNELS.map(({ key, label, icon: Icon }) => (
          <span key={key} className="flex flex-col items-center gap-0.5">
            <Icon className="size-3.5" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SeverityIndicator({
  severity,
  hint,
  side = 'bottom',
}: {
  severity: NotificationSeverity;
  hint: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const isMobile = useIsMobile();
  const config = {
    info: {
      icon: Info,
      className: 'text-blue-600 dark:text-blue-400',
    },
    warning: {
      icon: AlertTriangle,
      className: 'text-amber-600 dark:text-amber-400',
    },
    critical: {
      icon: AlertCircle,
      className: 'text-destructive',
    },
  }[severity];

  const Icon = config.icon;

  const trigger = (
    <button
      type="button"
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        config.className,
      )}
      aria-label={hint}
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  );

  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="start"
          side={side}
          className="w-auto max-w-[min(18rem,calc(100vw-2rem))] p-3 text-xs leading-relaxed whitespace-pre-wrap"
        >
          {hint}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent
        side={side}
        variant="light"
        className="max-w-xs whitespace-pre-wrap text-left"
      >
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

function ChannelToggles({
  event,
  prefs,
  isPending,
  onToggle,
  showLabels = false,
  className,
}: {
  event: NotificationEventDefinition;
  prefs: ReturnType<typeof resolveEventChannelPrefs>;
  isPending: boolean;
  onToggle: (channel: NotificationChannel, enabled: boolean) => void;
  showLabels?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid w-full grid-cols-3 gap-0.5 sm:flex sm:w-[9rem] sm:shrink-0 sm:items-center sm:justify-around',
        className,
      )}
    >
      {VISIBLE_CHANNELS.map(({ key, label, icon: Icon }) => {
        if (!isChannelAllowed(event, key)) {
          return (
            <span
              key={key}
              className="size-8 justify-self-center"
              aria-hidden
            />
          );
        }

        return (
          <div key={key} className="flex flex-col items-center gap-1">
            {showLabels ? (
              <>
                <Icon
                  className="size-3.5 text-muted-foreground sm:hidden"
                  aria-hidden
                />
                <span className="text-[10px] leading-none text-muted-foreground sm:hidden">
                  {label}
                </span>
              </>
            ) : null}
            <Switch
              checked={prefs[key]}
              onCheckedChange={(enabled) => onToggle(key, enabled)}
              disabled={isPending}
              aria-label={`${event.label} — ${label}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function PreferenceRow({
  event,
  prefs,
  isPending,
  onToggle,
}: {
  event: NotificationEventDefinition;
  prefs: ReturnType<typeof resolveEventChannelPrefs>;
  isPending: boolean;
  onToggle: (channel: NotificationChannel, enabled: boolean) => void;
}) {
  return (
    <div className="py-2 sm:py-2.5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <p className="text-sm font-medium leading-snug">{event.label}</p>
            <SeverityIndicator
              severity={event.severity}
              hint={formatEventHint(event)}
            />
            {event.supports_escalation ? (
              <Badge
                variant="primary"
                appearance="light"
                size="sm"
                className="font-semibold"
              >
                Escalonável
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:line-clamp-2">
            {event.description}
          </p>
        </div>
        <ChannelToggles
          event={event}
          prefs={prefs}
          isPending={isPending}
          onToggle={onToggle}
          showLabels
          className="sm:pt-0.5"
        />
      </div>
    </div>
  );
}

interface NotificationPreferencesContentProps {
  module?: NotificationModule;
  showColumnHeader?: boolean;
}

export function NotificationPreferencesContent({
  module,
  showColumnHeader = true,
}: NotificationPreferencesContentProps = {}) {
  const queryClient = useQueryClient();
  const {
    catalog: fullCatalog,
    eventsByCategory: fullEventsByCategory,
    isRemote,
  } = useNotificationEventCatalog();

  const catalog = useMemo(
    () =>
      module
        ? fullCatalog.filter((event) => event.module === module)
        : fullCatalog,
    [fullCatalog, module],
  );

  const eventsByCategory = useMemo(() => {
    if (!module) return fullEventsByCategory;
    return groupEventsByCategory(catalog);
  }, [catalog, fullEventsByCategory, module]);

  const defaultOpenCategories =
    module === 'equipamento'
      ? EQUIPAMENTO_OPEN_CATEGORIES
      : DEFAULT_OPEN_CATEGORIES;

  const { data, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationPreferencesService.get(),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      event,
      channel,
      enabled,
    }: {
      event: string;
      channel: string;
      enabled: boolean;
    }) => notificationPreferencesService.update(event, channel, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
    onError: () => toast.error('Erro ao atualizar preferência.'),
  });

  const preferences = useMemo(
    () =>
      mergeNotificationPreferences(
        data?.data.result ?? {},
        catalog.map((event) => event.slug),
      ),
    [catalog, data?.data.result],
  );

  if (isLoading) {
    return <NotificationPreferencesSkeleton />;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Configure quais eventos deseja receber e por qual canal. As preferências
        respeitam os limites definidos pela sua empresa.
        {isRemote ? (
          <span className="mt-1 block text-[11px] text-muted-foreground/80">
            Catálogo sincronizado com o servidor.
          </span>
        ) : null}
      </p>

      <div>
        {showColumnHeader ? (
          <NotificationPreferencesColumnHeader className="mb-2" />
        ) : null}

        <Accordion
          type="multiple"
          defaultValue={defaultOpenCategories}
          variant="default"
          className="w-full"
        >
          {NOTIFICATION_CATEGORY_ORDER.map((category) => {
            const events = eventsByCategory[category];
            if (events.length === 0) return null;

            return (
              <AccordionItem
                key={category}
                value={category}
                className="border-b border-border/60 last:border-b-0"
              >
                <AccordionTrigger className="px-0 py-2.5 text-sm hover:no-underline sm:py-3">
                  <span className="flex items-center gap-2">
                    {NOTIFICATION_CATEGORY_LABELS[category]}
                    <Badge
                      variant="primary"
                      appearance="light"
                      size="sm"
                      className="font-semibold"
                    >
                      {events.length}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="p-0 pb-2">
                  <div className="divide-y divide-border/60">
                    {events.map((event) => (
                      <PreferenceRow
                        key={event.slug}
                        event={event}
                        prefs={resolveEventChannelPrefs(
                          event,
                          preferences[event.slug],
                        )}
                        isPending={updateMutation.isPending}
                        onToggle={(channel, enabled) =>
                          updateMutation.mutate({
                            event: event.slug,
                            channel,
                            enabled,
                          })
                        }
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}
