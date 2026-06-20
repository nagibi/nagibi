import { formatDateRangeFilterLabel } from '@/components/grid/grid-date-range-filter';
import { formatNumberRangeFilterLabel } from '@/components/grid/grid-number-range-filter';
import type { GridActiveFilter } from '@/components/grid/grid-filters-control';
import type { GridColumnDef } from '@/hooks/use-grid-columns';
import {
  dateRangeFilterFromKey,
  dateRangeFilterToKey,
  type UseGridFiltersResult,
} from '@/hooks/use-grid-filters';
import { getColumnFilterDisplayValue } from '@/lib/grid-filter-display';
import { FILTER_LABELS, type EquipamentoContextFilter } from '@/lib/equipamento-filters';
import type { Equipamento } from '@/types/equipamento';

type BuildEquipamentoActiveFiltersOptions = {
  columns: GridColumnDef<Equipamento>[];
  columnFilters: Pick<
    UseGridFiltersResult,
    'filters' | 'clearColumnFilter' | 'clearDateRangeFilter'
  >;
  quickFilter?: {
    value: EquipamentoContextFilter;
    defaultValue: EquipamentoContextFilter;
    onChange: (value: EquipamentoContextFilter) => void;
  };
  search?: {
    value: string;
    onClear: () => void;
  };
};

export function buildEquipamentoActiveFilters({
  columns,
  columnFilters,
  quickFilter,
  search,
}: BuildEquipamentoActiveFiltersOptions): GridActiveFilter[] {
  const items: GridActiveFilter[] = [];

  if (quickFilter && quickFilter.value !== quickFilter.defaultValue) {
    items.push({
      id: 'filtro',
      label: 'Filtro rápido',
      value: FILTER_LABELS[quickFilter.value],
      onRemove: () => quickFilter.onChange(quickFilter.defaultValue),
    });
  }

  if (search?.value.trim()) {
    items.push({
      id: 'search',
      label: 'Busca',
      value: search.value.trim(),
      onRemove: search.onClear,
    });
  }

  for (const column of columns) {
    if (!column.filter) continue;

    if (column.filter.type === 'numberRange') {
      const from =
        columnFilters.filters[dateRangeFilterFromKey(column.filter.filterKey)]?.trim() ?? '';
      const to =
        columnFilters.filters[dateRangeFilterToKey(column.filter.filterKey)]?.trim() ?? '';
      if (!from && !to) continue;

      items.push({
        id: column.filter.filterKey,
        label: column.label,
        value: formatNumberRangeFilterLabel(from, to, {
          variant: column.filter.numberRangeFormat === 'currency' ? 'currency' : 'default',
        }),
        onRemove: () => columnFilters.clearDateRangeFilter(column.filter!.filterKey),
      });
      continue;
    }

    if (column.filter.type === 'dateRange') {
      const from =
        columnFilters.filters[dateRangeFilterFromKey(column.filter.filterKey)]?.trim() ?? '';
      const to =
        columnFilters.filters[dateRangeFilterToKey(column.filter.filterKey)]?.trim() ?? '';
      if (!from && !to) continue;

      items.push({
        id: column.filter.filterKey,
        label: column.label,
        value: formatDateRangeFilterLabel(from, to),
        onRemove: () => columnFilters.clearDateRangeFilter(column.filter!.filterKey),
      });
      continue;
    }

    const value = columnFilters.filters[column.filter.filterKey]?.trim();
    if (!value) continue;

    items.push({
      id: column.filter.filterKey,
      label: column.label,
      value: getColumnFilterDisplayValue(column.filter, value),
      onRemove: () => columnFilters.clearColumnFilter(column.filter!),
    });
  }

  return items;
}
