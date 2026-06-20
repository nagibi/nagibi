import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Espaçamento vertical padrão entre blocos nas páginas de equipamentos. */
export const EQUIPAMENTO_PAGE_GAP = 'gap-3';

export function EquipamentoPageStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'equipamento-page-stack flex min-w-0 flex-col max-xl:pt-0 xl:pt-3',
        EQUIPAMENTO_PAGE_GAP,
        className,
      )}
    >
      {children}
    </div>
  );
}
