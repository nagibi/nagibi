import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { useEquipamentoAlertasEnabled } from '@/hooks/use-equipamento-alertas-enabled';
import { EQUIPAMENTO_STATUS_LABELS } from '@/lib/equipamento-labels';
import { getEquipamentoRoute } from '@/lib/equipamento-qr';
import { equipamentosService } from '@/services/equipamentos.service';
import type { Equipamento } from '@/types/equipamento';
import type { SearchHit } from '@/hooks/use-global-search';

function mapEquipamentoToSearchHit(equipamento: Equipamento): SearchHit {
  return {
    id: String(equipamento.id),
    type: 'equipamento',
    title: equipamento.tipo?.nome ?? equipamento.patrimonio,
    subtitle: `${equipamento.patrimonio} · ${EQUIPAMENTO_STATUS_LABELS[equipamento.status]}`,
    path: `${getEquipamentoRoute(equipamento)}?q=${encodeURIComponent(equipamento.patrimonio)}`,
    avatar_url: equipamento.foto_url ?? null,
  };
}

export function useEquipamentoPaletteSearch(term: string, open = true) {
  const debounced = useDebounce(term.trim(), 250);
  const equipamentoEnabled = useEquipamentoAlertasEnabled();
  const hasQuery = debounced.length >= 2;

  return useQuery({
    queryKey: ['equipamentos', 'palette-search', debounced],
    queryFn: async () => {
      const result = await equipamentosService.globalSearch(debounced, 8);
      return result.data.map(mapEquipamentoToSearchHit);
    },
    enabled: open && equipamentoEnabled && hasQuery,
    staleTime: 30_000,
  });
}
