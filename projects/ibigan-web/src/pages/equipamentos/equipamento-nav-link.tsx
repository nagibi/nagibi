import {
  EQUIPAMENTO_DESKTOP_NAV_ITEMS,
  EQUIPAMENTO_NAV_ITEMS,
  isEquipamentoNavActive,
  type EquipamentoNavItem,
} from '@/pages/equipamentos/equipamento-nav';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type EquipamentoNavLinkProps = {
  item: EquipamentoNavItem;
  pathname: string;
  variant: 'bottom' | 'desktop';
};

export function EquipamentoNavLink({
  item,
  pathname,
  variant,
}: EquipamentoNavLinkProps) {
  const active = isEquipamentoNavActive(pathname, item.to);
  const Icon = item.icon;

  if (variant === 'bottom') {
    return (
      <Link
        to={item.to}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-[9px] font-medium transition-colors sm:text-[10px]',
          active
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Icon className="size-5 shrink-0" />
        <span className="max-w-full truncate leading-tight">{item.label}</span>
      </Link>
    );
  }

  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

export function EquipamentoNavItems({
  pathname,
  variant,
}: {
  pathname: string;
  variant: 'bottom' | 'desktop';
}) {
  const items =
    variant === 'desktop'
      ? EQUIPAMENTO_DESKTOP_NAV_ITEMS
      : EQUIPAMENTO_NAV_ITEMS;

  return (
    <>
      {items.map((item) => (
        <EquipamentoNavLink
          key={item.to}
          item={item}
          pathname={pathname}
          variant={variant}
        />
      ))}
    </>
  );
}
