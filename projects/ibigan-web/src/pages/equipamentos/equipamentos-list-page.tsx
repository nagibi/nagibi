import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { usePageToolbar } from '@/hooks/use-page-toolbar';
import { useEquipamentoUrlSearch } from '@/hooks/use-equipamento-url-search';
import { useGridFilters } from '@/hooks/use-grid-filters';
import { useEquipamentoFilterColumns } from '@/hooks/use-equipamento-filter-columns';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { groupEquipamentosEstoque } from '@/lib/equipamento-utils';
import { useEquipamentoPotencialDevolucao } from '@/hooks/use-equipamento-potencial-devolucao';
import {
  equipamentosService,
  type EquipamentosListParams,
} from '@/services/equipamentos.service';
import type { Equipamento } from '@/types/equipamento';
import {
  EquipamentoCard,
  type EquipamentoCardAction,
} from '@/pages/equipamentos/components/equipamento-card';
import {
  applyContextFilterToParams,
  getDefaultContextFilter,
  resolveContextFilter,
} from '@/lib/equipamento-filters';
import { applyEquipamentoColumnFiltersToParams } from '@/lib/equipamento-column-filters';
import { buildEquipamentoActiveFilters } from '@/lib/equipamento-active-filters';
import { GridHeaderRecordCount } from '@/components/grid/grid-record-count';
import { EquipamentoSearchField } from '@/pages/equipamentos/components/equipamento-search-field';
import { EquipamentoMobileFiltersButton } from '@/pages/equipamentos/components/equipamento-mobile-filters-button';
import { EquipamentoMobileToolbar } from '@/pages/equipamentos/components/equipamento-mobile-toolbar';
import { EquipamentoPageStack } from '@/pages/equipamentos/components/equipamento-page-stack';
import { EquipamentoPotencialDevolucaoBanner } from '@/pages/equipamentos/components/equipamento-potencial-devolucao-banner';
import { EquipamentoStatsBar } from '@/pages/equipamentos/components/equipamento-stats-bar';
import { EquipamentoUtilizacaoBar } from '@/pages/equipamentos/components/equipamento-utilizacao-bar';
import {
  BaixaModal,
  DevolverModal,
  EmprestarModal,
  FinalizarManutencaoModal,
  HistoricoModal,
  ManutencaoModal,
  RenovarModal,
} from '@/pages/equipamentos/components/equipamento-modals';

export type EquipamentoListMode = 'estoque' | 'utilizacao' | 'manutencao' | 'baixados';

const STATUS_BY_MODE: Record<EquipamentoListMode, EquipamentosListParams['status']> = {
  estoque: 'em_estoque',
  utilizacao: 'em_utilizacao',
  manutencao: 'em_manutencao',
  baixados: 'baixados',
};

type ModalKind =
  | 'emprestar'
  | 'manutencao'
  | 'baixa'
  | 'devolver'
  | 'renovar'
  | 'finalizar'
  | 'historico';

type EquipamentosListPageProps = {
  mode: EquipamentoListMode;
  title: string;
  description?: string;
};

export function EquipamentosListPage({ mode, title, description }: EquipamentosListPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroParam = searchParams.get('filtro');
  const equipamentoIdParam = searchParams.get('id')?.trim() ?? '';
  const equipamentoId = equipamentoIdParam ? Number(equipamentoIdParam) : undefined;
  const { search, setSearch, qParam } = useEquipamentoUrlSearch();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Equipamento | null>(null);
  const [activeModal, setActiveModal] = useState<ModalKind | null>(null);

  const filtro = resolveContextFilter(mode, filtroParam);
  const defaultQuickFilter = getDefaultContextFilter(mode);
  const columnFilters = useGridFilters(() => setPage(1));
  const { filterableColumns } = useEquipamentoFilterColumns(mode);

  useEffect(() => {
    setPage(1);
  }, [qParam, filtro, equipamentoIdParam, columnFilters.debouncedFilters]);

  const listParams = useMemo((): EquipamentosListParams => {
    const params: EquipamentosListParams = {
      status: STATUS_BY_MODE[mode],
      ...(equipamentoId && !Number.isNaN(equipamentoId) ? { id: equipamentoId } : {}),
      search: qParam || undefined,
      page,
      per_page: 20,
    };

    const withContext = applyContextFilterToParams(mode, filtro, params);
    return applyEquipamentoColumnFiltersToParams(withContext, columnFilters.debouncedFilters);
  }, [mode, qParam, page, filtro, equipamentoId, equipamentoIdParam, columnFilters.debouncedFilters]);

  const queryKey = useMemo(
    () => ['equipamentos', mode, listParams] as const,
    [mode, listParams],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => equipamentosService.list(listParams),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: potencialDevolucao, isLoading: loadingPotencialDevolucao } =
    useEquipamentoPotencialDevolucao(mode === 'estoque');

  const openModal = (equipamento: Equipamento, kind: ModalKind) => {
    setSelected(equipamento);
    setActiveModal(kind);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelected(null);
  };

  const getActions = (equipamento: Equipamento): EquipamentoCardAction[] => {
    const open = (kind: ModalKind) => () => openModal(equipamento, kind);

    switch (mode) {
      case 'estoque':
        return [
          { id: 'emprestar', label: 'Emprestar', onClick: open('emprestar'), primary: true },
          { id: 'manutencao', label: 'Enviar para manutenção', onClick: open('manutencao') },
          { id: 'baixa', label: 'Baixar', onClick: open('baixa') },
          { id: 'historico', label: 'Histórico', onClick: open('historico') },
        ];
      case 'utilizacao':
        return [
          { id: 'devolver', label: 'Receber devolução', onClick: open('devolver'), primary: true },
          { id: 'renovar', label: 'Renovar', onClick: open('renovar') },
          { id: 'manutencao', label: 'Enviar para manutenção', onClick: open('manutencao') },
          { id: 'historico', label: 'Histórico', onClick: open('historico') },
        ];
      case 'manutencao':
        return [
          { id: 'finalizar', label: 'Finalizar', onClick: open('finalizar'), primary: true },
          { id: 'historico', label: 'Histórico', onClick: open('historico') },
        ];
      case 'baixados':
        return [
          { id: 'historico', label: 'Histórico', onClick: open('historico'), primary: true },
        ];
      default:
        return [];
    }
  };

  const items = data?.data ?? [];
  const meta = data?.meta;

  const recordCountLabel = useMemo(
    () =>
      typeof meta?.total === 'number' ? (
        <GridHeaderRecordCount total={meta.total} />
      ) : null,
    [meta?.total],
  );

  usePageToolbar({
    title,
    description,
    headerActions: recordCountLabel,
  });

  const handleClearQuickFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete('filtro');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleClearAllFilters = () => {
    columnFilters.clearAllFilters();
    if (filtro !== defaultQuickFilter) {
      handleClearQuickFilter();
    }
  };

  const activeFilters = useMemo(
    () =>
      buildEquipamentoActiveFilters({
        columns: filterableColumns,
        columnFilters,
        quickFilter:
          filtro !== defaultQuickFilter
            ? {
                value: filtro,
                defaultValue: defaultQuickFilter,
                onChange: () => handleClearQuickFilter(),
              }
            : undefined,
      }),
    [
      columnFilters,
      defaultQuickFilter,
      filtro,
      filterableColumns,
      handleClearQuickFilter,
    ],
  );

  const hasActiveFilters = columnFilters.hasFilters || filtro !== defaultQuickFilter;

  const showGroupedSections =
    mode === 'estoque'
    && filtro === 'todos'
    && !qParam
    && !columnFilters.hasFilters
    && items.length > 0;
  const sections = showGroupedSections ? groupEquipamentosEstoque(items) : [];

  const renderCard = (equipamento: Equipamento) => (
    <EquipamentoCard
      key={equipamento.id}
      equipamento={equipamento}
      actions={getActions(equipamento)}
    />
  );

  const listContent = isLoading ? (
    Array.from({ length: 4 }).map((_, index) => (
      <Skeleton key={index} className="h-48 w-full rounded-xl" />
    ))
  ) : items.length === 0 ? (
    <p className="py-12 text-center text-sm text-muted-foreground">
      Nenhum equipamento encontrado.
    </p>
  ) : showGroupedSections ? (
    sections.map((section) => (
      <section key={section.key} className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
        <div className="flex flex-col gap-3">{section.items.map(renderCard)}</div>
      </section>
    ))
  ) : (
    <div className="flex flex-col gap-3">{items.map(renderCard)}</div>
  );

  const pagination = meta && meta.last_page > 1 ? (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1 || isFetching}
        onClick={() => setPage((current) => Math.max(1, current - 1))}
      >
        Anterior
      </Button>
      <span className="text-xs text-muted-foreground">
        Página {meta.current_page} de {meta.last_page}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= meta.last_page || isFetching}
        onClick={() => setPage((current) => current + 1)}
      >
        Próxima
      </Button>
    </div>
  ) : null;

  return (
    <>
    <EquipamentoPageStack>
      {mode === 'estoque' ? (
        <div className="-mx-4 min-w-0 overflow-x-hidden px-4 max-xl:pt-3 sm:-mx-5 sm:px-5 xl:hidden">
          <EquipamentoStatsBar />
        </div>
      ) : null}
      {mode === 'estoque' ? (
        <div className="xl:hidden">
          <EquipamentoUtilizacaoBar />
        </div>
      ) : null}
      {mode === 'estoque' && !loadingPotencialDevolucao && potencialDevolucao && potencialDevolucao.total > 0 ? (
        <div className="xl:hidden">
          <EquipamentoPotencialDevolucaoBanner
            data={potencialDevolucao}
            isLoading={loadingPotencialDevolucao}
          />
        </div>
      ) : null}

      <EquipamentoMobileToolbar compact>
        <EquipamentoSearchField
          value={search}
          onChange={setSearch}
          filterSlot={
            <EquipamentoMobileFiltersButton
              mode={mode}
              filters={activeFilters}
              onClearAll={hasActiveFilters ? handleClearAllFilters : undefined}
              columnFilters={{
                columns: filterableColumns,
                values: columnFilters.filters,
                onFilterChange: columnFilters.setFilter,
                onDateRangeChange: columnFilters.setDateRangeFilter,
                onFilterClear: columnFilters.clearColumnFilter,
              }}
            />
          }
        />
      </EquipamentoMobileToolbar>

      {listContent}
      {pagination}
    </EquipamentoPageStack>

      <EmprestarModal
        equipamento={selected}
        open={activeModal === 'emprestar'}
        onOpenChange={(open) => (open ? setActiveModal('emprestar') : closeModal())}
      />
      <ManutencaoModal
        equipamento={selected}
        open={activeModal === 'manutencao'}
        onOpenChange={(open) => (open ? setActiveModal('manutencao') : closeModal())}
      />
      <BaixaModal
        equipamento={selected}
        open={activeModal === 'baixa'}
        onOpenChange={(open) => (open ? setActiveModal('baixa') : closeModal())}
      />
      <DevolverModal
        equipamento={selected}
        open={activeModal === 'devolver'}
        onOpenChange={(open) => (open ? setActiveModal('devolver') : closeModal())}
      />
      <RenovarModal
        equipamento={selected}
        open={activeModal === 'renovar'}
        onOpenChange={(open) => (open ? setActiveModal('renovar') : closeModal())}
      />
      <FinalizarManutencaoModal
        equipamento={selected}
        open={activeModal === 'finalizar'}
        onOpenChange={(open) => (open ? setActiveModal('finalizar') : closeModal())}
      />
      <HistoricoModal
        equipamento={selected}
        open={activeModal === 'historico'}
        onOpenChange={(open) => (open ? setActiveModal('historico') : closeModal())}
      />
  </>
  );
}
