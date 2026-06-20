import type { ReactNode } from 'react';
import { GridToolbarSearch } from '@/components/grid/grid-toolbar';
import { EQUIPAMENTO_SEARCH_PLACEHOLDER } from '@/lib/equipamento-search';
import { cn } from '@/lib/utils';
import { EquipcontrolQrButton } from '@/pages/equipamentos/components/equipcontrol-qr-button';

export function EquipamentoSearchField({
  value,
  onChange,
  showQr = true,
  filterSlot,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  showQr?: boolean;
  filterSlot?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <GridToolbarSearch
        value={value}
        onChange={onChange}
        placeholder={EQUIPAMENTO_SEARCH_PLACEHOLDER}
        className="min-w-0 flex-1 [&_input]:h-9 [&_input]:text-sm"
      />
      {filterSlot}
      {showQr ? <EquipcontrolQrButton /> : null}
    </div>
  );
}
