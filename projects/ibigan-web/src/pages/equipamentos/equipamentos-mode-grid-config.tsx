import { GridStatusSwitch } from '@/components/grid/grid-status-switch';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2,
  History,
  PackageMinus,
  Pencil,
  QrCode,
  RefreshCw,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import type { GridRowAction } from '@/components/grid/grid-row-actions';
import type { GridColumnDef } from '@/hooks/use-grid-columns';
import { GridBadge } from '@/components/grid/grid-badge';
import {
  enrichEmprestimoAtivo,
  formatEquipamentoCurrency,
  getEquipamentoTendencia,
} from '@/lib/equipamento-utils';
import { EQUIPAMENTO_STATUS_LABELS } from '@/lib/equipamento-labels';
import type { Equipamento, EquipamentoManutencaoAtiva } from '@/types/equipamento';
import { VIEW_PREFERENCE_KEYS, type ViewPreferenceKey } from '@/types/view-mode';
import type { EquipamentoListMode } from '@/pages/equipamentos/equipamentos-list-page';

export type EquipamentoGridMode =
  Extract<EquipamentoListMode, 'estoque' | 'utilizacao' | 'manutencao' | 'baixados'>;

export type EquipamentoGridModalKind =
  | 'emprestar'
  | 'manutencao'
  | 'baixa'
  | 'devolver'
  | 'renovar'
  | 'finalizar'
  | 'historico'
  | 'editar'
  | 'qr';

export type EquipamentoGridModeConfig = {
  title: string;
  description: string;
  status?: 'em_estoque' | 'em_utilizacao' | 'em_manutencao';
  columnsKey: string;
  viewPreferenceKey: ViewPreferenceKey;
  showCrudToolbar: boolean;
  showStatsOnMobile: boolean;
  showPotencialDevolucao: boolean;
  doubleClickModal: EquipamentoGridModalKind;
};

export const MODE_GRID_CONFIG: Record<EquipamentoGridMode, EquipamentoGridModeConfig> = {
  estoque: {
    title: 'Estoque',
    description: 'Equipamentos disponíveis para empréstimo',
    status: 'em_estoque',
    columnsKey: 'grid-columns:equipamentos-estoque-v2',
    viewPreferenceKey: VIEW_PREFERENCE_KEYS.equipamentosEstoque,
    showCrudToolbar: true,
    showStatsOnMobile: true,
    showPotencialDevolucao: true,
    doubleClickModal: 'emprestar',
  },
  utilizacao: {
    title: 'Movimentações',
    description: 'Equipamentos em uso e devoluções',
    status: 'em_utilizacao',
    columnsKey: 'grid-columns:equipamentos-movimentacoes-v1',
    viewPreferenceKey: VIEW_PREFERENCE_KEYS.equipamentosMovimentacoes,
    showCrudToolbar: false,
    showStatsOnMobile: true,
    showPotencialDevolucao: false,
    doubleClickModal: 'devolver',
  },
  manutencao: {
    title: 'Manutenção',
    description: 'Equipamentos em reparo ou revisão',
    status: 'em_manutencao',
    columnsKey: 'grid-columns:equipamentos-manutencao-v1',
    viewPreferenceKey: VIEW_PREFERENCE_KEYS.equipamentosManutencao,
    showCrudToolbar: false,
    showStatsOnMobile: true,
    showPotencialDevolucao: false,
    doubleClickModal: 'finalizar',
  },
  baixados: {
    title: 'Baixados',
    description: 'Equipamentos devolvidos ao fornecedor ou dados como perdidos',
    columnsKey: 'grid-columns:equipamentos-baixados-v1',
    viewPreferenceKey: VIEW_PREFERENCE_KEYS.equipamentosBaixados,
    showCrudToolbar: false,
    showStatsOnMobile: false,
    showPotencialDevolucao: false,
    doubleClickModal: 'historico',
  },
};

export const CRITICO_FILTER_OPTIONS = [
  { label: 'Sim', value: 'true' },
  { label: 'Não', value: 'false' },
];

export const ATIVO_FILTER_OPTIONS = CRITICO_FILTER_OPTIONS;

export const SITUACAO_ESTOQUE_FILTER_OPTIONS = [
  { label: 'Disponível para empréstimo', value: 'disponivel' },
  { label: 'Parado', value: 'parado' },
  { label: 'Parado 30+ dias', value: 'parado_30' },
];

export const EMPRESTIMO_ALERTA_FILTER_OPTIONS = [
  { label: 'Normais', value: 'normais' },
  { label: 'Próximos do vencimento', value: 'proximos' },
  { label: 'Vencidos', value: 'vencidos' },
];

export const MANUTENCAO_SITUACAO_FILTER_OPTIONS = [
  { label: 'Entrada hoje', value: 'hoje' },
  { label: 'Atrasados (7+ dias)', value: 'atrasados' },
  { label: 'Equipamentos críticos', value: 'criticos' },
];

export const RESPONSABILIDADE_FILTER_OPTIONS = [
  { label: 'Fortes', value: 'fortes' },
  { label: 'Equipamento', value: 'equipamento' },
];

function formatShortDate(value?: string | null) {
  if (!value) return '—';
  return format(parseISO(value), 'dd/MM/yy', { locale: ptBR });
}

function getDiasEmManutencao(manutencao: EquipamentoManutencaoAtiva): number {
  if (manutencao.dias_em_manutencao != null) {
    return manutencao.dias_em_manutencao;
  }

  return Math.max(
    differenceInDays(startOfDay(new Date()), parseISO(manutencao.data_entrada)),
    0,
  );
}

function getTipoBaixaLabel(tipo?: string | null) {
  if (tipo === 'perda') return 'Perda';
  if (tipo === 'devolucao') return 'Devolução';
  return tipo ?? '—';
}

function getResponsabilidadeLabel(value: EquipamentoManutencaoAtiva['responsabilidade']) {
  return value === 'fortes' ? 'Fortes' : 'Equipamento';
}

export function getModeRowActions(
  mode: EquipamentoGridMode,
  equipamento: Equipamento,
  openModal: (equipamento: Equipamento, kind: EquipamentoGridModalKind) => void,
): GridRowAction[] {
  const open = (kind: EquipamentoGridModalKind) => () => openModal(equipamento, kind);

  switch (mode) {
    case 'estoque':
      return [
        { label: 'Enviar para manutenção', icon: Wrench, onClick: open('manutencao') },
        { label: 'Baixar', icon: PackageMinus, onClick: open('baixa'), tone: 'destructive' },
        { label: 'Histórico', icon: History, onClick: open('historico') },
        { label: 'Editar', icon: Pencil, onClick: open('editar') },
        { label: 'QR Code', icon: QrCode, onClick: open('qr') },
      ];
    case 'utilizacao':
      return [
        { label: 'Receber devolução', icon: RotateCcw, onClick: open('devolver') },
        { label: 'Renovar', icon: RefreshCw, onClick: open('renovar') },
        { label: 'Enviar para manutenção', icon: Wrench, onClick: open('manutencao') },
        { label: 'Histórico', icon: History, onClick: open('historico') },
      ];
    case 'manutencao':
      return [
        { label: 'Finalizar', icon: CheckCircle2, onClick: open('finalizar') },
        { label: 'Histórico', icon: History, onClick: open('historico') },
      ];
    case 'baixados':
      return [{ label: 'Histórico', icon: History, onClick: open('historico') }];
    default:
      return [];
  }
}

type ModeColumnDeps = {
  mode: EquipamentoGridMode;
  cols: {
    active: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
  };
  fornecedorOptions: Array<{ label: string; value: string }>;
  grupoOptions: Array<{ label: string; value: string }>;
  obraOptions: Array<{ label: string; value: string }>;
  tipoOptions: Array<{ label: string; value: string }>;
  rowStatusId: number | null;
  onRowStatusChange: (equipamento: Equipamento, active: boolean) => void;
  formatAuditDate: (value?: string | null) => string;
  getAuditUserName: (
    equipamento: Equipamento,
    field: 'created_by' | 'updated_by',
  ) => string;
};

export function getModeSpecificColumns(
  deps: ModeColumnDeps,
): GridColumnDef<Equipamento>[] {
  const {
    mode,
    cols,
    fornecedorOptions,
    grupoOptions,
    obraOptions,
    tipoOptions,
    rowStatusId,
    onRowStatusChange,
    formatAuditDate,
    getAuditUserName,
  } = deps;

  const sharedTail: GridColumnDef<Equipamento>[] = [
    {
      id: 'fornecedor',
      label: 'Fornecedor',
      sortable: true,
      filter: {
        type: 'select',
        filterKey: 'fornecedor_id',
        placeholder: 'Todos',
        options: fornecedorOptions,
      },
      render: (row) => row.fornecedor?.nome ?? '—',
      exportValue: (row) => row.fornecedor?.nome ?? '',
    },
    {
      id: 'valor_mensal',
      label: 'Valor/mês',
      sortable: true,
      className: 'text-right',
      filter: {
        type: 'numberRange',
        filterKey: 'valor_mensal',
        placeholder: 'Mín',
        numberRangeFormat: 'currency',
      },
      render: (row) => (
        <span className="tabular-nums">{formatEquipamentoCurrency(row.valor_mensal)}</span>
      ),
      exportValue: (row) => formatEquipamentoCurrency(row.valor_mensal),
    },
    {
      id: 'critico',
      label: 'Crítico',
      sortable: true,
      sortKey: 'is_critico',
      filter: {
        type: 'select',
        filterKey: 'is_critico',
        placeholder: 'Todos',
        options: CRITICO_FILTER_OPTIONS,
      },
      render: (row) =>
        row.is_critico ? (
          <GridBadge tone="destructive">Sim</GridBadge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      exportValue: (row) => (row.is_critico ? 'Sim' : 'Não'),
    },
  ];

  if (mode === 'estoque') {
    return [
      {
        id: 'is_active',
        label: cols.active,
        sortable: true,
        sortKey: 'is_active',
        filter: {
          type: 'select',
          filterKey: 'is_active',
          placeholder: 'Todos',
          options: ATIVO_FILTER_OPTIONS,
        },
        className: 'w-[80px]',
        exportValue: (row) => (row.is_active !== false ? 'Sim' : 'Não'),
        render: (row) => (
          <GridStatusSwitch
            checked={row.is_active !== false}
            disabled={rowStatusId === row.id}
            onCheckedChange={(checked) => void onRowStatusChange(row, checked)}
          />
        ),
      },
      {
        id: 'obra',
        label: 'Obra',
        sortable: true,
        filter: {
          type: 'select',
          filterKey: 'obra_id',
          placeholder: 'Todas',
          options: obraOptions,
        },
        render: (row) => row.obra?.codigo ?? '—',
        exportValue: (row) => row.obra?.codigo ?? '',
      },
      ...sharedTail,
      {
        id: 'tempo_em_estoque',
        label: 'Parado',
        sortable: true,
        className: 'text-right',
        filter: {
          type: 'numberRange',
          filterKey: 'parado_dias',
          placeholder: 'Mín',
        },
        render: (row) => {
          const dias = row.tempo_em_estoque ?? 0;
          if (dias <= 0) return <span className="text-muted-foreground">—</span>;
          return (
            <span
              className={dias >= 30 ? 'text-amber-700 dark:text-amber-400' : 'tabular-nums'}
            >
              {dias}d
            </span>
          );
        },
        exportValue: (row) => row.tempo_em_estoque ?? 0,
      },
      {
        id: 'tendencia',
        label: 'Situação',
        filter: {
          type: 'select',
          filterKey: 'situacao',
          placeholder: 'Todas',
          options: SITUACAO_ESTOQUE_FILTER_OPTIONS,
        },
        render: (row) => renderTendenciaBadge(row),
        exportValue: (row) => getEquipamentoTendencia(row)?.label ?? '',
      },
    ];
  }

  if (mode === 'utilizacao') {
    return [
      {
        id: 'obra',
        label: 'Obra',
        sortable: true,
        filter: {
          type: 'select',
          filterKey: 'obra_id',
          placeholder: 'Todas',
          options: obraOptions,
        },
        render: (row) => row.obra?.codigo ?? '—',
        exportValue: (row) => row.obra?.codigo ?? '',
      },
      ...sharedTail,
      {
        id: 'colaborador',
        label: 'Colaborador',
        filter: {
          type: 'text',
          filterKey: 'colaborador',
          placeholder: 'Nome ou matrícula',
        },
        render: (row) => row.emprestimo_ativo?.colaborador_nome ?? '—',
        exportValue: (row) => row.emprestimo_ativo?.colaborador_nome ?? '',
      },
      {
        id: 'encarregado',
        label: 'Encarregado',
        filter: {
          type: 'text',
          filterKey: 'encarregado',
          placeholder: 'Encarregado',
        },
        render: (row) => row.emprestimo_ativo?.encarregado_nome ?? '—',
        exportValue: (row) => row.emprestimo_ativo?.encarregado_nome ?? '',
      },
      {
        id: 'data_retirada',
        label: 'Retirada',
        sortable: true,
        filter: { type: 'dateRange', filterKey: 'data_retirada' },
        render: (row) => formatShortDate(row.emprestimo_ativo?.data_retirada),
        exportValue: (row) => row.emprestimo_ativo?.data_retirada ?? '',
      },
      {
        id: 'vencimento',
        label: 'Vencimento',
        render: (row) => {
          const emprestimo = row.emprestimo_ativo
            ? enrichEmprestimoAtivo(row.emprestimo_ativo)
            : null;
          if (!emprestimo?.data_vencimento) return '—';
          return formatShortDate(emprestimo.data_vencimento);
        },
        exportValue: (row) => {
          const emprestimo = row.emprestimo_ativo
            ? enrichEmprestimoAtivo(row.emprestimo_ativo)
            : null;
          return emprestimo?.data_vencimento ?? '';
        },
      },
      {
        id: 'dias_em_uso',
        label: 'Em uso',
        className: 'text-right',
        filter: {
          type: 'numberRange',
          filterKey: 'dias_em_uso',
          placeholder: 'Mín',
        },
        render: (row) => {
          const emprestimo = row.emprestimo_ativo
            ? enrichEmprestimoAtivo(row.emprestimo_ativo)
            : null;
          const dias = emprestimo?.dias_em_uso ?? 0;
          if (dias <= 0) return <span className="text-muted-foreground">—</span>;
          return <span className="tabular-nums">{dias}d</span>;
        },
        exportValue: (row) => {
          const emprestimo = row.emprestimo_ativo
            ? enrichEmprestimoAtivo(row.emprestimo_ativo)
            : null;
          return emprestimo?.dias_em_uso ?? 0;
        },
      },
      {
        id: 'tendencia',
        label: 'Situação',
        filter: {
          type: 'select',
          filterKey: 'emprestimo_alerta',
          placeholder: 'Todas',
          options: EMPRESTIMO_ALERTA_FILTER_OPTIONS,
        },
        render: (row) => renderTendenciaBadge(row),
        exportValue: (row) => getEquipamentoTendencia(row)?.label ?? '',
      },
    ];
  }

  if (mode === 'baixados') {
    return [
      {
        id: 'obra',
        label: 'Obra',
        sortable: true,
        filter: {
          type: 'select',
          filterKey: 'obra_id',
          placeholder: 'Todas',
          options: obraOptions,
        },
        render: (row) => row.obra?.codigo ?? '—',
        exportValue: (row) => row.obra?.codigo ?? '',
      },
      ...sharedTail,
      {
        id: 'tipo_baixa',
        label: 'Tipo de baixa',
        render: (row) => getTipoBaixaLabel(row.baixa?.tipo),
        exportValue: (row) => getTipoBaixaLabel(row.baixa?.tipo),
      },
      {
        id: 'data_baixa',
        label: 'Data da baixa',
        sortable: true,
        render: (row) => formatShortDate(row.baixa?.data_baixa),
        exportValue: (row) => row.baixa?.data_baixa ?? '',
      },
      {
        id: 'status',
        label: 'Status',
        render: (row) => renderStatusBadge(row),
        exportValue: (row) => row.status_label ?? EQUIPAMENTO_STATUS_LABELS[row.status] ?? '',
      },
    ];
  }

  if (mode === 'manutencao') {
    return [
    {
      id: 'obra',
      label: 'Obra',
      sortable: true,
      filter: {
        type: 'select',
        filterKey: 'obra_id',
        placeholder: 'Todas',
        options: obraOptions,
      },
      render: (row) => row.obra?.codigo ?? '—',
      exportValue: (row) => row.obra?.codigo ?? '',
    },
    ...sharedTail,
    {
      id: 'motivo',
      label: 'Motivo',
      filter: {
        type: 'text',
        filterKey: 'motivo',
        placeholder: 'Motivo',
      },
      render: (row) => row.manutencao_ativa?.motivo ?? '—',
      exportValue: (row) => row.manutencao_ativa?.motivo ?? '',
    },
    {
      id: 'responsavel',
      label: 'Responsável',
      render: (row) =>
        row.manutencao_ativa?.responsavel_user?.name
        ?? row.manutencao_ativa?.responsavel_manutencao
        ?? '—',
      exportValue: (row) =>
        row.manutencao_ativa?.responsavel_user?.name
        ?? row.manutencao_ativa?.responsavel_manutencao
        ?? '',
    },
    {
      id: 'responsabilidade',
      label: 'Responsabilidade',
      filter: {
        type: 'select',
        filterKey: 'responsabilidade',
        placeholder: 'Todas',
        options: RESPONSABILIDADE_FILTER_OPTIONS,
      },
      render: (row) =>
        row.manutencao_ativa
          ? getResponsabilidadeLabel(row.manutencao_ativa.responsabilidade)
          : '—',
      exportValue: (row) =>
        row.manutencao_ativa
          ? getResponsabilidadeLabel(row.manutencao_ativa.responsabilidade)
          : '',
    },
    {
      id: 'data_entrada_manutencao',
      label: 'Entrada',
      sortable: true,
      filter: { type: 'dateRange', filterKey: 'manutencao_data_entrada' },
      render: (row) => formatShortDate(row.manutencao_ativa?.data_entrada),
      exportValue: (row) => row.manutencao_ativa?.data_entrada ?? '',
    },
    {
      id: 'dias_em_manutencao',
      label: 'Em manutenção',
      className: 'text-right',
      filter: {
        type: 'numberRange',
        filterKey: 'dias_em_manutencao',
        placeholder: 'Mín',
      },
      render: (row) => {
        if (!row.manutencao_ativa) return '—';
        const dias = getDiasEmManutencao(row.manutencao_ativa);
        return (
          <span
            className={
              dias >= 7 ? 'text-amber-700 dark:text-amber-400 tabular-nums' : 'tabular-nums'
            }
          >
            {dias}d
          </span>
        );
      },
      exportValue: (row) =>
        row.manutencao_ativa ? getDiasEmManutencao(row.manutencao_ativa) : 0,
    },
    {
      id: 'tendencia',
      label: 'Situação',
      filter: {
        type: 'select',
        filterKey: 'manutencao_filtro',
        placeholder: 'Todas',
        options: MANUTENCAO_SITUACAO_FILTER_OPTIONS,
      },
      render: (row) => renderTendenciaBadge(row),
      exportValue: (row) => getEquipamentoTendencia(row)?.label ?? '',
    },
  ];
  }

  return [];
}

function renderStatusBadge(row: Equipamento) {
  const label = row.status_label ?? EQUIPAMENTO_STATUS_LABELS[row.status] ?? row.status;
  const tone =
    row.status === 'perdido'
      ? 'destructive'
      : row.status === 'baixado'
        ? 'muted'
        : row.status === 'em_manutencao'
          ? 'warning'
          : row.status === 'em_utilizacao'
            ? 'info'
            : 'success';

  return <GridBadge tone={tone}>{label}</GridBadge>;
}

function renderTendenciaBadge(row: Equipamento) {
  const tendencia = getEquipamentoTendencia(row);
  if (!tendencia) return '—';

  const tone =
    tendencia.tone === 'danger'
      ? 'destructive'
      : tendencia.tone === 'warning'
        ? 'warning'
        : tendencia.tone === 'success'
          ? 'success'
          : 'muted';

  return <GridBadge tone={tone}>{tendencia.label}</GridBadge>;
}
