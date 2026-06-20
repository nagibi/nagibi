import { useIsMobile } from '@/hooks/use-mobile';
import { getGridDeepLinkKey } from '@/lib/grid-deep-link-key';
import { EquipamentosListPage } from '@/pages/equipamentos/equipamentos-list-page';
import { EquipamentosModeGridView } from '@/pages/equipamentos/equipamentos-mode-grid-view';
import { useSearchParams } from 'react-router-dom';

export function EquipamentosManutencaoPage() {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const gridKey = getGridDeepLinkKey(searchParams);

  if (!isMobile) {
    return <EquipamentosModeGridView key={gridKey} mode="manutencao" />;
  }

  return (
    <EquipamentosListPage
      mode="manutencao"
      title="Manutenção"
      description="Equipamentos em reparo ou revisão"
    />
  );
}
