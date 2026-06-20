import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Espaçamento acima do campo de busca (normal, sticky e após cards). */
export const EQUIPAMENTO_MOBILE_TOOLBAR_COMPACT_CLASSES =
  'gap-0 pb-3 pt-3 max-xl:border-b max-xl:border-border max-xl:shadow-none';

export function EquipamentoMobileToolbar({
  children,
  className,
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      data-slot="equipamento-mobile-toolbar"
      className={cn(
        'equipamento-mobile-toolbar sticky top-[var(--page-content-header-height,0px)] z-20 -mx-4 flex flex-col bg-background px-4 sm:-mx-5 sm:px-5',
        compact
          ? EQUIPAMENTO_MOBILE_TOOLBAR_COMPACT_CLASSES
          : 'gap-3 py-3 max-xl:border-b max-xl:border-border max-xl:shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}
