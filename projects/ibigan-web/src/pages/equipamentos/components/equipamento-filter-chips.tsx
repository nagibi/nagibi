import type { EquipamentoListMode } from '@/pages/equipamentos/equipamentos-list-page';
import { useSearchParams } from 'react-router-dom';
import {
  FILTER_LABELS,
  getFiltersForMode,
  resolveContextFilter,
  type EquipamentoContextFilter,
} from '@/lib/equipamento-filters';
import { cn } from '@/lib/utils';
import { GridBadge } from '@/components/grid/grid-badge';

type EquipamentoFilterChipsProps = {
  mode: EquipamentoListMode;
};

export function EquipamentoFilterChips({ mode }: EquipamentoFilterChipsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroParam = searchParams.get('filtro');
  const activeFilter = resolveContextFilter(mode, filtroParam);
  const filters = getFiltersForMode(mode);

  if (filters.length === 0) {
    return null;
  }

  const handleSelect = (filter: EquipamentoContextFilter) => {
    if (filter === activeFilter) {
      return;
    }

    const params = new URLSearchParams(searchParams);

    if (filter === 'todos') {
      params.delete('filtro');
    } else {
      params.set('filtro', filter);
    }

    setSearchParams(params, { replace: true });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => {
        const isActive = filter === activeFilter;

        return (
          <GridBadge
            key={filter}
            size="md"
            variant={isActive ? 'primary' : 'outline'}
            className={cn('max-w-full', !isActive && 'text-muted-foreground')}
            asChild
          >
            <button
              type="button"
              aria-pressed={isActive}
              onClick={() => handleSelect(filter)}
              className="inline-flex max-w-full items-center whitespace-nowrap"
            >
              {FILTER_LABELS[filter]}
            </button>
          </GridBadge>
        );
      })}
    </div>
  );
}
