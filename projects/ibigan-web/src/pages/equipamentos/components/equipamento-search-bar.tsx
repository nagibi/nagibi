import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EquipamentoSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  sticky?: boolean;
};

export function EquipamentoSearchBar({
  value,
  onChange,
  placeholder = 'Buscar equipamento',
  sticky = true,
}: EquipamentoSearchBarProps) {
  return (
    <div
      className={cn(
        'relative',
        sticky &&
          'sticky top-[var(--page-content-header-height,0px)] z-20 -mx-1 bg-background px-1 py-2 max-xl:border-b max-xl:border-border max-xl:shadow-sm',
      )}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
          onClick={() => onChange('')}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
