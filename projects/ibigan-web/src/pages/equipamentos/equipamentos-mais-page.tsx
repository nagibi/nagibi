import {
  Archive,
  BarChart2,
  Bell,
  Building2,
  ChevronRight,
  LayoutDashboard,
  Shapes,
  Truck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import { useNotificationPreferencesSheet } from '@/providers/notification-preferences-sheet-provider';
import { Card, CardContent } from '@/components/ui/card';

const MENU_ITEMS = [
  {
    to: '/equipamentos/dashboard',
    label: 'Dashboard',
    description: 'Indicadores, cadastro e rankings',
    icon: LayoutDashboard,
  },
  {
    to: '/reports',
    label: 'Relatórios',
    description: 'Modelos e execuções',
    icon: BarChart2,
  },
  {
    to: '/equipamentos/baixados',
    label: 'Baixados',
    description: 'Equipamentos devolvidos ou perdidos',
    icon: Archive,
  },
  {
    to: '/equipamentos/tipos',
    label: 'Tipos',
    description: 'Tipos de equipamento por grupo',
    icon: Shapes,
  },
  {
    to: '/equipamentos/fornecedores',
    label: 'Fornecedores',
    description: 'Empresas e contatos de fornecimento',
    icon: Truck,
  },
  {
    to: '/equipamentos/obras',
    label: 'Obras',
    description: 'Cadastro de obras e locais',
    icon: Building2,
  },
] as const;

export function EquipamentosMaisPage() {
  const { open: openPreferences } = useNotificationPreferencesSheet();

  usePageToolbar({
    title: 'Mais',
    description: 'Dashboard, histórico e cadastros do módulo',
  });

  return (
    <div className="flex flex-col gap-2 pt-1.5 max-xl:pt-2">
      {MENU_ITEMS.map(({ to, label, description, icon: Icon }) => (
        <Link key={to} to={to} className="block">
          <Card className="transition-colors hover:bg-muted/30">
            <CardContent className="flex items-center gap-3 px-4 py-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ))}

      <button
        type="button"
        onClick={() => openPreferences({ module: 'equipamento' })}
        className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bell className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Notificações</p>
          <p className="text-xs text-muted-foreground">
            Alertas de empréstimos, estoque, manutenção e mais
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}
