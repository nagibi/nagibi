import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, LayoutList, Table2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/types/view-mode';
import { GridToolbarGroup } from './grid-toolbar';
import { ToolbarTooltip } from './toolbar-tooltip';
import { Button } from '@/components/ui/button';

const VIEW_OPTIONS: Array<{
  mode: ViewMode;
  icon: typeof Table2;
  labelKey: string;
  tooltipKey: string;
}> = [
  {
    mode: 'list',
    icon: LayoutList,
    labelKey: 'grid.view.list',
    tooltipKey: 'grid.view.list_tooltip',
  },
  {
    mode: 'cards',
    icon: LayoutGrid,
    labelKey: 'grid.view.cards',
    tooltipKey: 'grid.view.cards_tooltip',
  },
  {
    mode: 'table',
    icon: Table2,
    labelKey: 'grid.view.table',
    tooltipKey: 'grid.view.table_tooltip',
  },
];

export function GridViewModeControl({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <GridToolbarGroup>
      {VIEW_OPTIONS.map(({ mode, icon: Icon, labelKey, tooltipKey }) => (
        <ToolbarTooltip key={mode} content={t(tooltipKey)}>
          <Button
            type="button"
            variant={viewMode === mode ? 'secondary' : 'ghost'}
            size="sm"
            mode={isMobile ? 'icon' : undefined}
            aria-label={t(labelKey)}
            aria-pressed={viewMode === mode}
            onClick={() => onViewModeChange(mode)}
            className={cn(
              isMobile ? 'size-8' : 'h-8 gap-1.5 px-2',
              viewMode === mode && 'bg-muted',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {!isMobile ? (
              <span className="text-xs font-medium">{t(labelKey)}</span>
            ) : null}
          </Button>
        </ToolbarTooltip>
      ))}
    </GridToolbarGroup>
  );
}
