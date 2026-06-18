import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EquipamentoMobileToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="equipamento-mobile-toolbar"
      className={cn(
        'equipamento-mobile-toolbar sticky top-[var(--page-content-header-height,0px)] z-20 -mx-4 flex flex-col gap-3 bg-background px-4 pb-3 pt-3 max-xl:border-b max-xl:border-border max-xl:shadow-sm sm:-mx-5 sm:px-5',
        className,
      )}
    >
      {children}
    </div>
  );
}
