import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GridCardActions } from '@/components/grid/grid-card-actions';
import { GridStatusSwitch } from '@/components/grid/grid-status-switch';
import type { GridRowAction } from '@/components/grid/grid-row-actions';
import { formatGridMaskedCell } from '@/lib/grid-masked-field';
import type { Fornecedor, GrupoEquipamento, Obra, TipoEquipamentoCatalog } from '@/types/equipamento-catalog';

function formatCatalogCardDate(value?: string | null) {
  if (!value) {
    return '—';
  }

  return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });
}

function CatalogCardShell({
  title,
  subtitle,
  active,
  statusUpdating = false,
  onActiveChange,
  meta,
  actions,
}: {
  title: string;
  subtitle?: string | null;
  active: boolean;
  statusUpdating?: boolean;
  onActiveChange: (active: boolean) => void;
  meta?: string | null;
  actions: GridRowAction[];
}) {
  return (
    <div className="flex h-full min-w-0 w-full max-w-full flex-col gap-3 p-4 font-normal [&_*]:font-normal">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate">{title}</p>
          {subtitle ? (
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <GridStatusSwitch
          checked={active}
          disabled={statusUpdating}
          onCheckedChange={onActiveChange}
        />
      </div>

      {meta ? (
        <div className="min-w-0 space-y-1 text-sm text-muted-foreground">
          <p className="truncate">{meta}</p>
        </div>
      ) : null}

      <GridCardActions actions={actions} />
    </div>
  );
}

export function GrupoCatalogCard({
  item,
  actions,
}: {
  item: GrupoEquipamento;
  actions: GridRowAction[];
}) {
  return (
    <div className="flex h-full min-w-0 w-full max-w-full flex-col gap-3 p-4 font-normal [&_*]:font-normal">
      <div className="min-w-0">
        <p className="truncate">{item.nome}</p>
        <p className="truncate text-sm text-muted-foreground">
          {(item.tipos_count ?? 0) === 1 ? '1 tipo' : `${item.tipos_count ?? 0} tipos`}
        </p>
      </div>

      <div className="text-sm text-muted-foreground">
        {formatCatalogCardDate(item.updated_at ?? item.created_at)}
      </div>

      <GridCardActions actions={actions} />
    </div>
  );
}

export function TipoCatalogCard({
  item,
  actions,
  statusUpdating = false,
  onActiveChange,
}: {
  item: TipoEquipamentoCatalog;
  actions: GridRowAction[];
  statusUpdating?: boolean;
  onActiveChange: (active: boolean) => void;
}) {
  return (
    <CatalogCardShell
      title={item.nome}
      subtitle={item.grupo?.nome ?? 'Sem grupo'}
      active={item.is_ativo}
      statusUpdating={statusUpdating}
      onActiveChange={onActiveChange}
      meta={formatCatalogCardDate(item.updated_at ?? item.created_at)}
      actions={actions}
    />
  );
}

export function FornecedorCatalogCard({
  item,
  actions,
  statusUpdating = false,
  onActiveChange,
}: {
  item: Fornecedor;
  actions: GridRowAction[];
  statusUpdating?: boolean;
  onActiveChange: (active: boolean) => void;
}) {
  const subtitle =
    (item.cnpj ? formatGridMaskedCell(item.cnpj, 'cnpj', '') : '')
    || item.email
    || item.telefone
    || '—';

  return (
    <CatalogCardShell
      title={item.nome}
      subtitle={subtitle}
      active={item.is_ativo}
      statusUpdating={statusUpdating}
      onActiveChange={onActiveChange}
      meta={formatCatalogCardDate(item.updated_at ?? item.created_at)}
      actions={actions}
    />
  );
}

export function ObraCatalogCard({
  item,
  actions,
  statusUpdating = false,
  onActiveChange,
}: {
  item: Obra;
  actions: GridRowAction[];
  statusUpdating?: boolean;
  onActiveChange: (active: boolean) => void;
}) {
  const title = item.codigo
    ? `${item.codigo}${item.nome ? ` — ${item.nome}` : ''}`
    : (item.nome ?? 'Obra');
  const subtitle =
    item.responsavel_user?.name
    ?? item.responsavel
    ?? item.endereco
    ?? '—';

  return (
    <CatalogCardShell
      title={title}
      subtitle={subtitle}
      active={item.is_ativa}
      statusUpdating={statusUpdating}
      onActiveChange={onActiveChange}
      meta={formatCatalogCardDate(item.updated_at ?? item.created_at)}
      actions={actions}
    />
  );
}
