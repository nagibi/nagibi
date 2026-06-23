import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  FileText,
  HardHat,
  Loader2,
  Settings2,
  Shapes,
  Truck,
  UserRound,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCommandPaletteShortcut } from '@/hooks/use-command-palette-shortcut';
import { type SearchHit, useGlobalSearch } from '@/hooks/use-global-search';

const CATEGORY_LABELS: Record<string, string> = {
  equipamentos: 'Equipamentos',
  tipos: 'Tipos',
  fornecedores: 'Fornecedores',
  obras: 'Obras',
  settings: 'Configurações',
  users: 'Usuários',
  docs: 'Documentação',
};

const CATEGORY_ORDER = [
  'equipamentos',
  'tipos',
  'fornecedores',
  'obras',
  'settings',
  'users',
  'docs',
] as const;

function hitIcon(hit: SearchHit) {
  if (hit.type === 'equipamento') return HardHat;
  if (hit.type === 'tipo_equipamento') return Shapes;
  if (hit.type === 'fornecedor') return Truck;
  if (hit.type === 'obra') return Building2;
  if (hit.type === 'user') return UserRound;
  if (hit.type === 'doc') return FileText;
  return Settings2;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const { data, isFetching, isLoading } = useGlobalSearch(term, open);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setTerm('');
      queryClient.removeQueries({ queryKey: ['global-search'] });
    }
  }, [onOpenChange, queryClient]);

  const handleOpen = useCallback(() => handleOpenChange(true), [handleOpenChange]);
  useCommandPaletteShortcut(handleOpen);

  const handleSelect = (hit: SearchHit) => {
    if (!hit.path) return;

    navigate(hit.path);
    handleOpenChange(false);
  };

  const hasQuery = open && term.trim().length >= 2;
  const groups = useMemo(() => (hasQuery ? (data ?? {}) : {}), [data, hasQuery]);
  const orderedCategories = CATEGORY_ORDER.filter((category) => (groups[category]?.length ?? 0) > 0);
  const isSearching = isLoading || isFetching;

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        value={term}
        onValueChange={setTerm}
        placeholder="Buscar equipamentos, menus, usuários…"
      />
      <CommandList>
        {!hasQuery ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Digite ao menos 2 caracteres para buscar.
            <CommandShortcut className="mt-2 block">⌘K</CommandShortcut>
          </div>
        ) : isSearching ? (
          <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Buscando…
          </div>
        ) : orderedCategories.length === 0 ? (
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        ) : (
          orderedCategories.map((category) => {
            const hits = groups[category] ?? [];

            return (
              <CommandGroup key={category} heading={CATEGORY_LABELS[category] ?? category}>
                {hits.map((hit) => {
                  const ItemIcon = hitIcon(hit);

                  return (
                    <CommandItem
                      key={`${hit.type}-${hit.id}`}
                      value={`${category}-${hit.title}-${hit.subtitle ?? ''}`}
                      onSelect={() => handleSelect(hit)}
                    >
                      {hit.type === 'user' && hit.avatar_url ? (
                        <Avatar className="size-5">
                          <AvatarImage src={hit.avatar_url} alt={hit.title} />
                          <AvatarFallback>{hit.title.slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <ItemIcon className="size-4 text-muted-foreground" />
                      )}
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{hit.title}</span>
                        {hit.subtitle ? (
                          <span className="truncate text-xs text-muted-foreground">{hit.subtitle}</span>
                        ) : null}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })
        )}
      </CommandList>
    </CommandDialog>
  );
}

interface CommandPaletteTriggerProps {
  onOpen: () => void;
}

export function CommandPaletteTrigger({ onOpen }: CommandPaletteTriggerProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hidden items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted md:flex"
    >
      <span>Buscar…</span>
      <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">
        ⌘K
      </kbd>
    </button>
  );
}
