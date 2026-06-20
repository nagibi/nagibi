import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  MoreHorizontal,
  Package,
  PackagePlus,
  Plus,
  Repeat2,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CadastroEquipamentoModal } from '@/pages/equipamentos/components/equipamento-modals';
import { cn } from '@/lib/utils';

const SPEED_DIAL_ACTIONS = [
  {
    id: 'emprestimo',
    label: 'Novo empréstimo',
    icon: ArrowUpRight,
    color: 'bg-blue-600 hover:bg-blue-700',
    to: '/equipamentos/estoque',
  },
  {
    id: 'devolucao',
    label: 'Nova devolução',
    icon: ArrowDownLeft,
    color: 'bg-emerald-600 hover:bg-emerald-700',
    to: '/equipamentos/movimentacoes',
  },
  {
    id: 'manutencao',
    label: 'Nova manutenção',
    icon: Wrench,
    color: 'bg-amber-500 hover:bg-amber-600',
    to: '/equipamentos/manutencao',
  },
  {
    id: 'equipamento',
    label: 'Novo equipamento',
    icon: PackagePlus,
    color: 'bg-primary hover:bg-primary/90',
    type: 'modal' as const,
  },
] as const;

const MAIS_SECTION_PATHS = [
  '/equipamentos/mais',
  '/equipamentos/baixados',
  '/equipamentos/tipos',
  '/equipamentos/fornecedores',
  '/equipamentos/obras',
] as const;

export function EquipcontrolBottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const isMaisSectionActive = MAIS_SECTION_PATHS.some((path) => isActive(path));

  const itemClass = (active: boolean) =>
    cn(
      'flex min-w-0 flex-1 flex-col items-center justify-center gap-0 px-0.5 py-1 text-[10px] font-medium leading-none transition-colors',
      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
    );

  const labelClass = 'mt-0.5 max-w-full truncate';

  const handleAction = (action: (typeof SPEED_DIAL_ACTIONS)[number]) => {
    setSpeedDialOpen(false);
    if ('type' in action && action.type === 'modal') {
      setCadastroOpen(true);
      return;
    }
    if ('to' in action) {
      navigate(action.to);
    }
  };

  return (
    <>
      {speedDialOpen ? (
        <button
          type="button"
          aria-label="Fechar ações rápidas"
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px]"
          onClick={() => setSpeedDialOpen(false)}
        />
      ) : null}

      {speedDialOpen ? (
        <div
          className={cn(
            'fixed z-[210] flex flex-col items-end gap-2.5 xl:hidden',
            'end-4 bottom-[calc(6.25rem+env(safe-area-inset-bottom,0px))]',
            'sm:end-6',
          )}
        >
          {SPEED_DIAL_ACTIONS.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                className={cn(
                  'flex items-center gap-2.5 rounded-full border border-border bg-background/95 py-1 ps-3.5 pe-1 shadow-lg backdrop-blur transition-all',
                  'animate-in fade-in slide-in-from-bottom-2 duration-200',
                )}
                style={{ animationDelay: `${index * 40}ms` }}
                onClick={() => handleAction(action)}
              >
                <span className="text-sm font-medium text-foreground">{action.label}</span>
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full text-white shadow-md',
                    action.color,
                  )}
                >
                  <Icon className="size-4" />
                </span>
              </button>
            );
          })}

          <Button
            type="button"
            aria-label="Fechar menu de criação"
            className="h-11 gap-1.5 rounded-full bg-muted px-4 text-foreground shadow-lg hover:bg-muted/90"
            onClick={() => setSpeedDialOpen(false)}
          >
            <X className="size-4" />
            <span className="text-sm font-semibold">Fechar</span>
          </Button>
        </div>
      ) : null}

      <nav
        aria-label="Equipamentos"
        className="fixed inset-x-0 bottom-0 z-40 overflow-visible border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 xl:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-1 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] sm:max-w-2xl">
          <button
            type="button"
            className={itemClass(isActive('/equipamentos/estoque'))}
            onClick={() => navigate('/equipamentos/estoque')}
          >
            <Package className="size-5 shrink-0" />
            <span className={labelClass}>Estoque</span>
          </button>

          <button
            type="button"
            className={itemClass(isActive('/equipamentos/movimentacoes'))}
            onClick={() => navigate('/equipamentos/movimentacoes')}
          >
            <Repeat2 className="size-5 shrink-0" />
            <span className={labelClass}>Movimentações</span>
          </button>

          <button
            type="button"
            aria-expanded={speedDialOpen}
            aria-label={speedDialOpen ? 'Fechar menu de criação' : 'Criar novo registro'}
            className="relative z-10 flex min-w-0 flex-1 items-center justify-center overflow-visible px-0.5 py-1"
            onClick={() => setSpeedDialOpen((current) => !current)}
          >
            <span className="invisible flex flex-col items-center leading-none" aria-hidden>
              <Package className="size-5 shrink-0" />
              <span className="mt-0.5 text-[10px]">+</span>
            </span>
            <span className="absolute inset-x-0 top-0.5 bottom-0.5 flex items-center justify-center">
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-full text-primary-foreground shadow-lg ring-3 transition-transform active:scale-95',
                  speedDialOpen
                    ? 'bg-muted text-foreground ring-muted/50 shadow-md'
                    : 'bg-primary ring-primary/25 shadow-primary/45',
                )}
              >
                {speedDialOpen ? (
                  <X className="size-5" />
                ) : (
                  <Plus className="size-5 stroke-[2.5]" />
                )}
              </span>
            </span>
          </button>

          <button
            type="button"
            className={itemClass(isActive('/equipamentos/manutencao'))}
            onClick={() => navigate('/equipamentos/manutencao')}
          >
            <Wrench className="size-5 shrink-0" />
            <span className={labelClass}>Manutenção</span>
          </button>

          <button
            type="button"
            className={itemClass(isMaisSectionActive)}
            onClick={() => navigate('/equipamentos/mais')}
          >
            <MoreHorizontal className="size-5 shrink-0" />
            <span className={labelClass}>Mais</span>
          </button>
        </div>
      </nav>

      <CadastroEquipamentoModal open={cadastroOpen} onOpenChange={setCadastroOpen} />
    </>
  );
}
