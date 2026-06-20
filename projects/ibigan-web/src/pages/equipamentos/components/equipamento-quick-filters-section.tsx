import { useSearchParams } from 'react-router-dom';
import { GridBadge, GridFilterBadge } from '@/components/grid/grid-badge';
import {
  FILTER_LABELS,
  getDefaultContextFilter,
  getFiltersForMode,
  resolveContextFilter,
  type EquipamentoContextFilter,
} from '@/lib/equipamento-filters';
import type { EquipamentoFilterMode } from '@/hooks/use-equipamento-filter-columns';
import { cn } from '@/lib/utils';

type EquipamentoQuickFiltersSectionProps = {
  mode: EquipamentoFilterMode;
};

export function EquipamentoQuickFiltersSection({ mode }: EquipamentoQuickFiltersSectionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroParam = searchParams.get('filtro');
  const defaultFilter = getDefaultContextFilter(mode as Parameters<typeof getDefaultContextFilter>[0]);
  const activeFilter = resolveContextFilter(mode, filtroParam);
  const filters = getFiltersForMode(mode as Parameters<typeof getFiltersForMode>[0]);

  if (filters.length === 0) {
    return null;
  }

  const setFilter = (filter: EquipamentoContextFilter) => {
    if (filter === activeFilter) {
      return;
    }

    const params = new URLSearchParams(searchParams);
    const isDefaultFilter = filter === defaultFilter;

    if (isDefaultFilter) {
      params.delete('filtro');
    } else {
      params.set('filtro', filter);
    }

    setSearchParams(params, { replace: true });
  };

  return (
    <section className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Filtros rápidos
      </p>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const isActive = filter === activeFilter;
          const isDefault = filter === defaultFilter;
          const label = FILTER_LABELS[filter];

          if (isActive) {
            if (!isDefault) {
              return (
                <GridFilterBadge
                  key={filter}
                  size="md"
                  variant="primary"
                  className="max-w-full"
                  removeLabel={`Remover filtro ${label}`}
                  onRemove={() => setFilter(defaultFilter)}
                >
                  <span className="truncate whitespace-nowrap">{label}</span>
                </GridFilterBadge>
              );
            }

            return (
              <GridBadge key={filter} size="md" variant="primary" className="max-w-full">
                <span className="truncate whitespace-nowrap">{label}</span>
              </GridBadge>
            );
          }

          return (
            <GridBadge
              key={filter}
              size="md"
              variant="outline"
              className={cn('max-w-full cursor-pointer text-muted-foreground')}
              asChild
            >
              <button
                type="button"
                onClick={() => setFilter(filter)}
                className="inline-flex max-w-full items-center whitespace-nowrap"
              >
                {label}
              </button>
            </GridBadge>
          );
        })}
      </div>
    </section>
  );
}
