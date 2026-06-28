import type { EquipamentoStatus } from '@/types/equipamento';

export const EQUIPAMENTO_STATUS_LABELS: Record<EquipamentoStatus, string> = {
  em_estoque: 'Em estoque',
  em_utilizacao: 'Em uso',
  em_manutencao: 'Manutenção',
  baixado: 'Baixado',
  perdido: 'Perdido',
};

export const EQUIPAMENTO_STATUS_STYLES: Record<
  EquipamentoStatus,
  { bar: string; badge: string; dot: string; card: string; value: string }
> = {
  em_estoque: {
    bar: 'bg-emerald-600',
    badge: 'bg-emerald-600 text-white border-emerald-600',
    dot: 'bg-emerald-500',
    card: 'border-emerald-200/80 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/35',
    value: 'text-emerald-800 dark:text-emerald-300',
  },
  em_utilizacao: {
    bar: 'bg-blue-600',
    badge: 'bg-blue-600 text-white border-blue-600',
    dot: 'bg-blue-500',
    card: 'border-blue-200/80 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/35',
    value: 'text-blue-800 dark:text-blue-300',
  },
  em_manutencao: {
    bar: 'bg-amber-500',
    badge: 'bg-amber-500 text-white border-amber-500',
    dot: 'bg-amber-500',
    card: 'border-amber-200/80 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/35',
    value: 'text-amber-800 dark:text-amber-300',
  },
  baixado: {
    bar: 'bg-zinc-600',
    badge: 'bg-zinc-600 text-white border-zinc-600',
    dot: 'bg-zinc-500',
    card: 'border-zinc-200/80 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40',
    value: 'text-zinc-800 dark:text-zinc-300',
  },
  perdido: {
    bar: 'bg-red-600',
    badge: 'bg-red-600 text-white border-red-600',
    dot: 'bg-red-500',
    card: 'border-red-200/80 bg-red-50 dark:border-red-900/60 dark:bg-red-950/35',
    value: 'text-red-800 dark:text-red-300',
  },
};

export const EQUIPAMENTO_TOTAL_CARD_STYLE = {
  card: 'border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40',
  bar: 'bg-slate-500',
  dot: 'bg-slate-400',
  value: 'text-slate-900 dark:text-slate-100',
};

export const EQUIPAMENTO_ALERTA_STYLES = {
  vencido: {
    bar: 'bg-red-600 animate-pulse',
    badge: 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-500/40',
    dot: 'bg-red-500',
    label: 'Vencido',
  },
  proximo_vencimento: {
    bar: 'bg-orange-500',
    badge: 'bg-orange-500 text-white border-orange-500',
    dot: 'bg-orange-500',
    label: 'Vence em breve',
  },
} as const;

export type EquipamentoAlerta = keyof typeof EQUIPAMENTO_ALERTA_STYLES;

export const HISTORICO_EVENTO_LABELS: Record<string, string> = {
  cadastrado: 'Cadastrado',
  editado: 'Editado',
  emprestado: 'Emprestado',
  devolvido: 'Devolvido',
  renovado: 'Renovado',
  manutencao_aberta: 'Enviado para manutenção',
  manutencao_iniciada: 'Manutenção iniciada',
  manutencao_finalizada: 'Manutenção finalizada',
  baixado: 'Baixado',
  perdido: 'Perdido',
};
