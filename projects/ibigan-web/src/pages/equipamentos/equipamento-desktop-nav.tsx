import { EquipamentoNavItems } from '@/pages/equipamentos/equipamento-nav-link';
import { useLocation } from 'react-router-dom';

export function EquipamentoDesktopNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Equipamentos"
      className="hidden min-w-0 border-b border-border pb-3 xl:block"
    >
      <div className="flex min-w-0 gap-1 overflow-x-auto">
        <EquipamentoNavItems pathname={pathname} variant="desktop" />
      </div>
    </nav>
  );
}
