import { useState } from 'react';
import { CadastroEquipamentoModal } from '@/pages/equipamentos/components/equipamento-modals';
import {
  ArrowDownLeft,
  ArrowUpRight,
  PackagePlus,
  Plus,
  Wrench,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

export function EquipamentoFab() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [cadastroOpen, setCadastroOpen] = useState(false);

  const handleAction = (action: (typeof SPEED_DIAL_ACTIONS)[number]) => {
    setOpen(false);
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
      {open ? (
        <button
          type="button"
          aria-label="Fechar ações rápidas"
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          'fixed z-50 flex flex-col items-end gap-2.5 xl:hidden',
          'end-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))]',
          'sm:end-6',
        )}
      >
        {open
          ? SPEED_DIAL_ACTIONS.map((action, index) => {
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
                  <span className="text-sm font-medium text-foreground">
                    {action.label}
                  </span>
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
            })
          : null}

        <Button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Fechar menu de criação' : 'Criar novo registro'}
          className={cn(
            'h-11 gap-1.5 rounded-full px-4 shadow-lg',
            open && 'bg-muted text-foreground hover:bg-muted/90',
          )}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? (
            <>
              <X className="size-4" />
              <span className="text-sm font-semibold">Fechar</span>
            </>
          ) : (
            <>
              <Plus className="size-4" />
              <span className="text-sm font-semibold">Novo</span>
            </>
          )}
        </Button>
      </div>

      <CadastroEquipamentoModal
        open={cadastroOpen}
        onOpenChange={setCadastroOpen}
      />
    </>
  );
}
