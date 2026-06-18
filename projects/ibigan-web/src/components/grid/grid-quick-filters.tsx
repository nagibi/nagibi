import type { ElementType } from 'react';
import { GridBadge, GridFilterBadge } from '@/components/grid/grid-badge';
import { cn } from '@/lib/utils';

export interface GridQuickFilterOption<T extends string> {
  value: T;
  label: string;
  icon?: ElementType;
  count?: number;
}

interface GridQuickFiltersProps<T extends string> {
  value: T;
  options: GridQuickFilterOption<T>[];
  onChange: (value: T) => void;
  defaultValue?: T;
  className?: string;
}

export function GridQuickFilters<T extends string>({
  value,
  options,
  onChange,
  defaultValue,
  className,
}: GridQuickFiltersProps<T>) {
  const resetValue = defaultValue ?? options[0]?.value;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;
        const isDefault = option.value === resetValue;
        const label = option.count !== undefined
          ? `${option.label} (${option.count})`
          : option.label;

        if (isActive) {
          if (!isDefault) {
            return (
              <GridFilterBadge
                key={option.value}
                size="md"
                variant="primary"
                removeLabel={`Remover filtro ${option.label}`}
                onRemove={() => onChange(resetValue)}
              >
                {Icon ? <Icon /> : null}
                {label}
              </GridFilterBadge>
            );
          }

          return (
            <GridBadge key={option.value} size="md" variant="primary">
              {Icon ? <Icon /> : null}
              {label}
            </GridBadge>
          );
        }

        return (
          <GridBadge key={option.value} size="md" variant="outline" className="cursor-pointer" asChild>
            <button
              type="button"
              onClick={() => onChange(option.value)}
              className="inline-flex items-center gap-1.5"
            >
              {Icon ? <Icon /> : null}
              {label}
            </button>
          </GridBadge>
        );
      })}
    </div>
  );
}
