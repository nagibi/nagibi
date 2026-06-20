import {
  Archive,
  Building2,
  LayoutDashboard,
  Package,
  Repeat2,
  Shapes,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type EquipcontrolNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export const EQUIPCONTROL_DESKTOP_NAV_ITEMS: EquipcontrolNavItem[] = [
  { to: '/equipamentos/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/equipamentos/estoque', label: 'Estoque', icon: Package },
  { to: '/equipamentos/movimentacoes', label: 'Movimentações', icon: Repeat2 },
  { to: '/equipamentos/manutencao', label: 'Manutenções', icon: Wrench },
  { to: '/equipamentos/baixados', label: 'Baixados', icon: Archive },
];

/** Cadastros (Tipos, Fornecedores, Obras) ficam no hub Mais no mobile. */
export const EQUIPCONTROL_NAV_ITEMS: EquipcontrolNavItem[] = [
  ...EQUIPCONTROL_DESKTOP_NAV_ITEMS,
  { to: '/equipamentos/tipos', label: 'Tipos', icon: Shapes },
  { to: '/equipamentos/fornecedores', label: 'Fornecedores', icon: Truck },
  { to: '/equipamentos/obras', label: 'Obras', icon: Building2 },
];

export function isEquipcontrolNavActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}
