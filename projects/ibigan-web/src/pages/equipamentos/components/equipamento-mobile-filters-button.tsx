import { GridFiltersControl, type GridActiveFilter, type GridColumnFiltersConfig } from '@/components/grid/grid-filters-control';
import type { EquipamentoFilterMode } from '@/hooks/use-equipamento-filter-columns';
import { getFiltersForMode } from '@/lib/equipamento-filters';
import { EquipamentoQuickFiltersSection } from '@/pages/equipamentos/components/equipamento-quick-filters-section';

type EquipamentoMobileFiltersButtonProps = {
  mode: EquipamentoFilterMode;
  filters: GridActiveFilter[];
  onClearAll?: () => void;
  columnFilters: GridColumnFiltersConfig;
  triggerVariant?: 'ghost' | 'outline';
};

export function EquipamentoMobileFiltersButton({
  mode,
  filters,
  onClearAll,
  columnFilters,
  triggerVariant = 'outline',
}: EquipamentoMobileFiltersButtonProps) {
  const hasQuickFilters =
    getFiltersForMode(mode as Parameters<typeof getFiltersForMode>[0]).length > 0;

  return (
    <GridFiltersControl
      filters={filters}
      onClearAll={onClearAll}
      columnFilters={columnFilters}
      triggerVariant={triggerVariant}
      quickFiltersSection={
        hasQuickFilters ? <EquipamentoQuickFiltersSection mode={mode} /> : undefined
      }
    />
  );
}
