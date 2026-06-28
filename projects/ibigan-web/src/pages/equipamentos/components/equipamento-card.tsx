import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  Handshake,
  History,
  Hourglass,
  MapPin,
  QrCode,
  TrendingDown,
  TrendingUp,
  User,
  Wrench,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  enrichEmprestimoAtivo,
  formatEquipamentoCurrency,
  getEquipamentoAlerta,
  getEquipamentoTendencia,
  type EquipamentoTendencia,
  type EquipamentoTendenciaIcon,
  type EquipamentoTendenciaTone,
} from '@/lib/equipamento-utils';
import { EQUIPAMENTO_STATUS_LABELS } from '@/lib/equipamento-labels';
import { cn } from '@/lib/utils';
import type { Equipamento } from '@/types/equipamento';
import {
  EquipamentoStatusBadge,
  EquipamentoStatusBar,
} from '@/pages/equipamentos/components/equipamento-status-badge';
import { EquipamentoThumbnail } from '@/pages/equipamentos/components/equipamento-thumbnail';
import { EquipamentoQrModal } from '@/pages/equipamentos/components/equipamento-qr-modal';
import { EditarEquipamentoModal } from '@/pages/equipamentos/components/equipamento-modals';

export type EquipamentoCardAction = {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline';
  primary?: boolean;
};

const PRIMARY_ACTION_ICONS: Record<string, typeof Handshake> = {
  emprestar: Handshake,
  devolver: ArrowDownLeft,
  finalizar: CheckCircle2,
  historico: History,
};

/** Tendências que repetem o CTA principal — ocultar no rodapé (Opção 1). */
const TENDENCIA_REDUNDANTE_POR_ACAO: Record<string, string[]> = {
  emprestar: ['Disponível para empréstimo'],
};

function isTendenciaRedundanteComAcao(
  actionId: string | undefined,
  tendencia: EquipamentoTendencia | null,
): boolean {
  if (!actionId || !tendencia) {
    return false;
  }

  return TENDENCIA_REDUNDANTE_POR_ACAO[actionId]?.includes(tendencia.label) ?? false;
}

type EquipamentoCardProps = {
  equipamento: Equipamento;
  actions?: EquipamentoCardAction[];
};

type EquipamentoHighlight = {
  tone: 'danger' | 'warning';
  message: string;
  detail?: string;
};

function getHighlight(equipamento: Equipamento): EquipamentoHighlight | null {
  const emprestimo = equipamento.emprestimo_ativo
    ? enrichEmprestimoAtivo(equipamento.emprestimo_ativo)
    : null;

  if (emprestimo?.is_vencido) {
    return {
      tone: 'danger' as const,
      message: `Vencido há ${Math.abs(emprestimo.dias_ate_vencimento ?? 0)} dias`,
    };
  }

  if (emprestimo?.is_proximo_vencimento) {
    return {
      tone: 'warning' as const,
      message: `Vence em ${emprestimo.dias_ate_vencimento} dias`,
    };
  }

  if (equipamento.status === 'em_estoque' && (equipamento.tempo_em_estoque ?? 0) >= 30) {
    return {
      tone: 'warning' as const,
      message: `Parado há ${equipamento.tempo_em_estoque} dias`,
      detail: 'Considere realocar ou devolver ao fornecedor',
    };
  }

  return null;
}

const TENDENCIA_ICON: Record<EquipamentoTendenciaIcon, typeof TrendingUp> = {
  'trending-up': TrendingUp,
  hourglass: Hourglass,
  'trending-down': TrendingDown,
  wrench: Wrench,
};

const TENDENCIA_TONE_CLASS: Record<EquipamentoTendenciaTone, string> = {
  default: 'text-muted-foreground',
  success: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-700 dark:text-amber-300',
  danger: 'text-red-700 dark:text-red-300',
};

function EquipamentoTendenciaLinha({ tendencia }: { tendencia: EquipamentoTendencia }) {
  const Icon = TENDENCIA_ICON[tendencia.icon];

  return (
    <p
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium',
        TENDENCIA_TONE_CLASS[tendencia.tone],
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {tendencia.label}
    </p>
  );
}

export function EquipamentoCard({ equipamento, actions = [] }: EquipamentoCardProps) {
  const [qrOpen, setQrOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const emprestimo = equipamento.emprestimo_ativo
    ? enrichEmprestimoAtivo(equipamento.emprestimo_ativo)
    : null;
  const alerta = getEquipamentoAlerta(equipamento);
  const highlight = getHighlight(equipamento);
  const tendencia = getEquipamentoTendencia(equipamento);
  const tendenciaOcultaPorDestaque =
    Boolean(highlight) &&
    ((emprestimo?.is_vencido ?? false) ||
      (emprestimo?.is_proximo_vencimento ?? false) ||
      (equipamento.status === 'em_estoque' && (equipamento.tempo_em_estoque ?? 0) >= 30));
  const primaryAction = actions.find((action) => action.primary) ?? actions[0];
  const menuActions = actions.filter((action) => action.id !== primaryAction?.id);
  const tendenciaVisivel =
    tendencia &&
    !tendenciaOcultaPorDestaque &&
    !isTendenciaRedundanteComAcao(primaryAction?.id, tendencia);
  const PrimaryIcon = primaryAction ? PRIMARY_ACTION_ICONS[primaryAction.id] : null;

  return (
    <Card
      className={cn(
        'overflow-hidden py-0 gap-0',
        alerta === 'vencido' && 'ring-2 ring-red-500/60 shadow-md shadow-red-500/10',
      )}
    >
      <EquipamentoStatusBar
        status={equipamento.status}
        alerta={alerta}
        subdued={Boolean(highlight)}
      />

      <CardContent className="space-y-3 px-4 pt-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <EquipamentoThumbnail equipamento={equipamento} previewEnabled />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight">
                {equipamento.tipo?.nome ?? 'Equipamento'}
              </p>
              <p className="text-sm font-medium text-muted-foreground">{equipamento.patrimonio}</p>
              <p className="mt-0.5 text-sm font-bold text-foreground">
                {formatEquipamentoCurrency(equipamento.valor_mensal)}
                <span className="font-medium text-muted-foreground">/mês</span>
              </p>
              {equipamento.is_critico ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                  <span className="size-2 shrink-0 rounded-full bg-red-500" aria-hidden />
                  Equipamento crítico
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <EquipamentoStatusBadge
              status={equipamento.status}
              label={equipamento.status_label ?? EQUIPAMENTO_STATUS_LABELS[equipamento.status]}
              alerta={alerta}
              subdued={Boolean(highlight) && !alerta}
              size="sm"
            />
            {equipamento.tipo?.grupo?.nome ? (
              <span
                className="max-w-[8.5rem] truncate rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                title={equipamento.tipo.grupo.nome}
              >
                {equipamento.tipo.grupo.nome}
              </span>
            ) : null}
          </div>
        </div>

        {highlight ? (
          <div
            className={cn(
              'rounded-lg border px-3 py-2.5',
              highlight.tone === 'danger'
                ? 'border-red-500/50 bg-red-500/15'
                : 'border-amber-500/40 bg-amber-500/10',
              alerta === 'vencido' && 'animate-pulse border-red-600/60 bg-red-600/10',
            )}
          >
            <p
              className={cn(
                'inline-flex items-center gap-1.5 text-sm font-semibold',
                highlight.tone === 'danger'
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-amber-800 dark:text-amber-200',
              )}
            >
              <AlertTriangle className="size-4 shrink-0" />
              {highlight.message}
            </p>
            {highlight.detail ? (
              <p className="mt-1 text-xs text-muted-foreground">{highlight.detail}</p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2 text-sm text-muted-foreground">
          {emprestimo && equipamento.status === 'em_utilizacao' ? (
            <p className="inline-flex items-center gap-1.5">
              <User className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate text-foreground">
                {emprestimo.colaborador_nome}
                {emprestimo.colaborador_matricula
                  ? ` · ${emprestimo.colaborador_matricula}`
                  : ''}
              </span>
            </p>
          ) : null}
          {emprestimo?.encarregado_nome && equipamento.status === 'em_utilizacao' ? (
            <p className="inline-flex items-center gap-1.5">
              <User className="size-3.5 shrink-0 opacity-60" />
              Encarregado: {emprestimo.encarregado_nome}
            </p>
          ) : null}
          {equipamento.obra ? (
            <p className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              Obra {equipamento.obra.codigo}
              {equipamento.obra.nome ? ` · ${equipamento.obra.nome}` : ''}
            </p>
          ) : null}
          {equipamento.fornecedor?.nome ? (
            <p className="inline-flex items-center gap-1.5">
              <Building2 className="size-3.5 shrink-0" />
              {equipamento.fornecedor.nome}
            </p>
          ) : null}
        </div>

        {equipamento.manutencao_ativa ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
            <p className="font-medium text-foreground">{equipamento.manutencao_ativa.motivo}</p>
          </div>
        ) : null}

        {tendenciaVisivel ? <EquipamentoTendenciaLinha tendencia={tendencia} /> : null}
      </CardContent>

      {primaryAction || menuActions.length > 0 ? (
        <div className="border-t border-border/80 bg-background px-4 pb-3.5 pt-3">
          <div className="flex items-center gap-2">
            {primaryAction ? (
              <Button
                type="button"
                variant={primaryAction.variant === 'destructive' ? 'destructive' : 'secondary'}
                size="lg"
                className="flex-1"
                onClick={primaryAction.onClick}
              >
                {PrimaryIcon ? <PrimaryIcon className="size-4 shrink-0" /> : null}
                {primaryAction.label}
              </Button>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className={cn('gap-1.5', primaryAction ? 'shrink-0' : 'flex-1')}
                >
                  Ações
                  <ChevronDown className="size-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {menuActions.map((action) => (
                  <DropdownMenuItem key={action.id} onClick={action.onClick}>
                    {action.label}
                  </DropdownMenuItem>
                ))}
                {menuActions.length > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQrOpen(true)}>
                  <QrCode className="size-4" />
                  QR Code
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : null}

      <EquipamentoQrModal
        equipamento={equipamento}
        open={qrOpen}
        onOpenChange={setQrOpen}
      />
      <EditarEquipamentoModal
        equipamento={equipamento}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </Card>
  );
}
