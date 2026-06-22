import type { Equipamento } from '@/types/equipamento';

const QR_PREFIX = 'equipamento:';

export function buildEquipamentoQrValue(patrimonio: string): string {
  return `${QR_PREFIX}${patrimonio}`;
}

export function parseEquipamentoQrValue(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith(QR_PREFIX)) {
    const patrimonio = trimmed.slice(QR_PREFIX.length).trim();
    return patrimonio || null;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const q = url.searchParams.get('q')?.trim();
      if (q) {
        return q;
      }
    } catch {
      return null;
    }
  }

  return trimmed;
}

export function getEquipamentoRoute(equipamento: Equipamento): string {
  switch (equipamento.status) {
    case 'em_utilizacao':
      return '/equipamentos/movimentacoes';
    case 'em_manutencao':
      return '/equipamentos/manutencao';
    case 'baixado':
    case 'perdido':
      return '/equipamentos/baixados';
    default:
      return '/equipamentos/estoque';
  }
}
