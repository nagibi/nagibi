import {
  Archive,
  Building2,
  Layers,
  LayoutDashboard,
  Package,
  Repeat2,
  Shapes,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type EquipamentoNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export const EQUIPAMENTO_DESKTOP_NAV_ITEMS: EquipamentoNavItem[] = [
  { to: '/equipamentos/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/equipamentos/estoque', label: 'Estoque', icon: Package },
  { to: '/equipamentos/movimentacoes', label: 'Movimentações', icon: Repeat2 },
  { to: '/equipamentos/manutencao', label: 'Manutenções', icon: Wrench },
  { to: '/equipamentos/baixados', label: 'Baixados', icon: Archive },
];

/** Cadastros (Grupos, Tipos, Fornecedores, Obras) ficam no hub Mais no mobile. */
export const EQUIPAMENTO_NAV_ITEMS: EquipamentoNavItem[] = [
  ...EQUIPAMENTO_DESKTOP_NAV_ITEMS,
  { to: '/equipamentos/grupos', label: 'Grupos', icon: Layers },
  { to: '/equipamentos/tipos', label: 'Tipos', icon: Shapes },
  { to: '/equipamentos/fornecedores', label: 'Fornecedores', icon: Truck },
  { to: '/equipamentos/obras', label: 'Obras', icon: Building2 },
];

export function isEquipamentoNavActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}
