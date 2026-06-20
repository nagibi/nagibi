import { useIsMobile } from '@/hooks/use-mobile';
import { getGridDeepLinkKey } from '@/lib/grid-deep-link-key';
import { EquipamentosListPage } from '@/pages/equipamentos/equipamentos-list-page';
import { EquipamentosModeGridView } from '@/pages/equipamentos/equipamentos-mode-grid-view';
import { useSearchParams } from 'react-router-dom';

export function EquipamentosBaixadosPage() {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const gridKey = getGridDeepLinkKey(searchParams);

  if (!isMobile) {
    return <EquipamentosModeGridView key={gridKey} mode="baixados" />;
  }

  return (
    <EquipamentosListPage
      mode="baixados"
      title="Baixados"
      description="Equipamentos devolvidos ao fornecedor ou dados como perdidos"
    />
  );
}
