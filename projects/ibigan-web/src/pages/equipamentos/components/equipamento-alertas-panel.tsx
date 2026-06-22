import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  Package,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type {
  DashboardAlertaEmprestimoItem,
  DashboardAlertaManutencaoItem,
  DashboardAlertaParadoItem,
  DashboardAlertasResumoItem,
} from '@/types/equipamento';
import { formatEquipamentoCurrency } from '@/lib/equipamento-utils';
import { cn } from '@/lib/utils';
import { useEquipamentoCentralAlertas } from '@/hooks/use-equipamento-central-alertas';
import { Button } from '@/components/ui/button';

const RESUMO_ICON: Record<
  DashboardAlertasResumoItem['id'],
  typeof AlertTriangle
> = {
  parados: Package,
  vencidos: AlertTriangle,
  manutencoes: Wrench,
  proximos_semana: CalendarClock,
};

const RESUMO_TONE: Record<DashboardAlertasResumoItem['id'], string> = {
  parados: 'text-amber-700 dark:text-amber-300',
  vencidos: 'text-red-700 dark:text-red-300',
  manutencoes: 'text-orange-700 dark:text-orange-300',
  proximos_semana: 'text-blue-700 dark:text-blue-300',
};

const RESUMO_LINK: Record<DashboardAlertasResumoItem['id'], string> = {
  parados: '/equipamentos/estoque?filtro=parados',
  vencidos: '/equipamentos/movimentacoes?filtro=vencidos',
  manutencoes: '/equipamentos/manutencao?filtro=atrasados',
  proximos_semana: '/equipamentos/movimentacoes?filtro=proximos_vencimento',
};

function AlertSection({
  title,
  toneClass,
  children,
}: {
  title: string;
  toneClass?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3
        className={cn('text-sm font-semibold', toneClass ?? 'text-foreground')}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function AlertItemButton({
  title,
  subtitle,
  meta,
  onClick,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {subtitle ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
      {meta ? (
        <p className="mt-1 text-xs font-medium text-muted-foreground">{meta}</p>
      ) : null}
    </button>
  );
}

type EquipamentoAlertasPanelProps = {
  enabled?: boolean;
  onNavigate?: () => void;
  showDashboardLink?: boolean;
  className?: string;
};

export function EquipamentoAlertasPanel({
  enabled = true,
  onNavigate,
  showDashboardLink = true,
  className,
}: EquipamentoAlertasPanelProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useEquipamentoCentralAlertas(enabled);

  const goTo = (path: string) => {
    onNavigate?.();
    navigate(path);
  };

  const goToEquipamento = (
    patrimonio: string,
    status: 'estoque' | 'movimentacoes' | 'manutencao',
  ) => {
    goTo(`/equipamentos/${status}?q=${encodeURIComponent(patrimonio)}`);
  };

  const resumo = (data?.resumo ?? []).filter((item) => item.total > 0);
  const total = data?.total ?? 0;

  if (isLoading) {
    return (
      <div className={cn('flex justify-center py-12', className)}>
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div
        className={cn(
          'px-5 py-8 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        Tudo em dia. Nenhum equipamento requer atenção imediata.
      </div>
    );
  }

  return (
    <div className={cn('space-y-6 px-5 py-4', className)}>
      {resumo.length > 0 ? (
        <ul className="space-y-2">
          {resumo.map((item) => {
            const Icon = RESUMO_ICON[item.id];

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => goTo(RESUMO_LINK[item.id])}
                  className="flex w-full items-start gap-2.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/40"
                >
                  <Icon
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      RESUMO_TONE[item.id],
                    )}
                  />
                  <span
                    className={cn('text-sm font-medium', RESUMO_TONE[item.id])}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {(data?.vencidos.total ?? 0) > 0 ? (
        <AlertSection
          title="Empréstimos vencidos"
          toneClass="text-red-700 dark:text-red-300"
        >
          <div className="space-y-2">
            {data!.vencidos.itens
              .slice(0, 5)
              .map((item: DashboardAlertaEmprestimoItem) => (
                <AlertItemButton
                  key={item.emprestimo_id}
                  title={item.tipo ?? item.patrimonio}
                  subtitle={`${item.patrimonio} · Vencido há ${item.dias_vencido} dias`}
                  meta={`${item.colaborador}${item.obra ? ` · Obra ${item.obra}` : ''}`}
                  onClick={() =>
                    goToEquipamento(item.patrimonio, 'movimentacoes')
                  }
                />
              ))}
          </div>
        </AlertSection>
      ) : null}

      {(data?.proximos_semana?.total ?? 0) > 0 ? (
        <AlertSection
          title="Vencem esta semana"
          toneClass="text-blue-700 dark:text-blue-300"
        >
          <div className="space-y-2">
            {data!.proximos_semana!.itens.slice(0, 5).map((item) => (
              <AlertItemButton
                key={item.emprestimo_id}
                title={item.tipo ?? item.patrimonio}
                subtitle={`${item.patrimonio} · Vence em ${item.dias_restantes} dias`}
                meta={`Responsável: ${item.colaborador}`}
                onClick={() =>
                  goToEquipamento(item.patrimonio, 'movimentacoes')
                }
              />
            ))}
          </div>
        </AlertSection>
      ) : null}

      {(data?.manutencoes_atrasadas?.total ?? 0) > 0 ? (
        <AlertSection
          title="Manutenção parada"
          toneClass="text-orange-700 dark:text-orange-300"
        >
          <div className="space-y-2">
            {data!
              .manutencoes_atrasadas!.itens.slice(0, 5)
              .map((item: DashboardAlertaManutencaoItem) => (
                <AlertItemButton
                  key={item.manutencao_id}
                  title={item.tipo ?? item.patrimonio}
                  subtitle={`${item.patrimonio} · há ${item.dias_em_manutencao} dias`}
                  meta={item.motivo}
                  onClick={() => goToEquipamento(item.patrimonio, 'manutencao')}
                />
              ))}
          </div>
        </AlertSection>
      ) : null}

      {(data?.equipamentos_parados?.total ?? 0) > 0 ? (
        <AlertSection
          title="Equipamentos parados"
          toneClass="text-amber-700 dark:text-amber-300"
        >
          <p className="text-xs text-muted-foreground">
            Potencial de devolução:{' '}
            <span className="font-semibold text-foreground">
              {formatEquipamentoCurrency(
                data!.equipamentos_parados!.valor_mensal_total,
              )}
              /mês
            </span>
          </p>
          <div className="space-y-2">
            {data!
              .equipamentos_parados!.itens.slice(0, 5)
              .map((item: DashboardAlertaParadoItem) => (
                <AlertItemButton
                  key={item.id}
                  title={item.tipo ?? item.patrimonio}
                  subtitle={`${item.patrimonio} · Parado há ${item.dias_parado} dias`}
                  meta={formatEquipamentoCurrency(item.valor_mensal) + '/mês'}
                  onClick={() => goToEquipamento(item.patrimonio, 'estoque')}
                />
              ))}
          </div>
        </AlertSection>
      ) : null}

      {showDashboardLink ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => goTo('/equipamentos/dashboard')}
        >
          Ver dashboard completo
        </Button>
      ) : null}
    </div>
  );
}

export function useEquipamentoAlertasTotal(enabled = true) {
  const { data } = useEquipamentoCentralAlertas(enabled);
  return data?.total ?? 0;
}
