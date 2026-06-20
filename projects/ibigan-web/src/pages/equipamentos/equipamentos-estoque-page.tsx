import { useIsMobile } from '@/hooks/use-mobile';
import { getGridDeepLinkKey } from '@/lib/grid-deep-link-key';
import { EquipamentosListPage } from '@/pages/equipamentos/equipamentos-list-page';
import { EquipamentosEstoqueGridView } from '@/pages/equipamentos/equipamentos-estoque-grid-view';
import { useSearchParams } from 'react-router-dom';

export function EquipamentosEstoquePage() {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const gridKey = getGridDeepLinkKey(searchParams);

  if (!isMobile) {
    return <EquipamentosEstoqueGridView key={gridKey} />;
  }

  return (
    <EquipamentosListPage
      mode="estoque"
      title="Estoque"
      description="Equipamentos disponíveis para empréstimo"
    />
  );
}
