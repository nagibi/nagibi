import { useIsMobile } from '@/hooks/use-mobile';
import { getGridDeepLinkKey } from '@/lib/grid-deep-link-key';
import { EquipamentosListPage } from '@/pages/equipamentos/equipamentos-list-page';
import { EquipamentosModeGridView } from '@/pages/equipamentos/equipamentos-mode-grid-view';
import { useSearchParams } from 'react-router-dom';

export function EquipamentosMovimentacoesPage() {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const gridKey = getGridDeepLinkKey(searchParams);

  if (!isMobile) {
    return <EquipamentosModeGridView key={gridKey} mode="utilizacao" />;
  }

  return (
    <EquipamentosListPage
      mode="utilizacao"
      title="Movimentações"
      description="Equipamentos em uso e devoluções"
    />
  );
}
