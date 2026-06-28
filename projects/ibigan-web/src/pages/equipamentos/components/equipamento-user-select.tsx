import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandCheck,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  equipamentosService,
  type EquipamentoUserLookup,
} from '@/services/equipamentos.service';

type EquipamentoUserSelectProps = {
  value?: string;
  onSelect: (user: EquipamentoUserLookup) => void;
  enabled?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function getUserMatricula(user: Pick<EquipamentoUserLookup, 'id' | 'cpf'>): string {
  if (user.cpf?.trim()) {
    return user.cpf.replace(/\D/g, '');
  }

  return String(user.id);
}

function formatUserSearchValue(user: EquipamentoUserLookup): string {
  const matricula = getUserMatricula(user);

  return `${user.name} ${user.email} ${matricula} ${user.cpf ?? ''}`;
}

function isSuperUser(user: EquipamentoUserLookup): boolean {
  return Boolean(user.is_super_admin) || (user.roles?.includes('super-admin') ?? false);
}

export function EquipamentoUserSelect({
  value,
  onSelect,
  enabled = true,
  disabled = false,
  placeholder = 'Selecione o usuário',
  className,
}: EquipamentoUserSelectProps) {
  const [open, setOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['equipamentos-users-lookup'],
    queryFn: () => equipamentosService.lookupUsers(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const selectedUser = users.find((user) => String(user.id) === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn(
            'h-8.5 w-full justify-between px-3 font-normal shadow-xs shadow-black/5',
            !selectedUser && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">
            {isLoading ? 'Carregando usuários...' : (selectedUser?.name ?? placeholder)}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por nome, e-mail ou matrícula..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'Carregando...' : 'Nenhum usuário encontrado.'}
            </CommandEmpty>
            <CommandGroup>
              {users.map((user) => {
                const matricula = getUserMatricula(user);
                const isSelected = value === String(user.id);
                const superUser = isSuperUser(user);

                return (
                  <CommandItem
                    key={user.id}
                    value={formatUserSearchValue(user)}
                    onSelect={() => {
                      onSelect(user);
                      setOpen(false);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {matricula} · {user.email}
                        {superUser ? ' · Super-usuário' : ''}
                      </p>
                    </div>
                    <CommandCheck className={cn(!isSelected && 'opacity-0')} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
