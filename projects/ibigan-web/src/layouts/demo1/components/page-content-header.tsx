import { Fragment, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { MENU_SIDEBAR } from '@/config/menu.config';
import { type MenuConfig } from '@/config/types';
import {
  buildPageBreadcrumbs,
  type PageBreadcrumbItem,
} from '@/lib/build-page-breadcrumbs';
import { useCentralMenu } from '@/hooks/use-central-menu';
import { useDynamicMenu } from '@/hooks/use-dynamic-menu';
import { useMenu } from '@/hooks/use-menu';
import { usePageToolbarConfig } from '@/providers/page-toolbar-provider';
import { Container } from '@/components/common/container';

function BreadcrumbItemContent({ item }: { item: PageBreadcrumbItem }) {
  const Icon = item.icon;

  return (
    <span className="inline-flex items-center gap-1.5">
      {Icon ? <Icon className="size-3 shrink-0" aria-hidden="true" /> : null}
      {item.title}
    </span>
  );
}

function PageBreadcrumbs({ menu }: { menu: MenuConfig }) {
  const { pathname } = useLocation();
  const config = usePageToolbarConfig();
  const { getBreadcrumb } = useMenu(pathname);
  const items = buildPageBreadcrumbs({
    menuItems: getBreadcrumb(menu),
    pathname,
    pageTitle: config?.title,
    customItems: config?.breadcrumbs,
  });

  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-1 flex items-center gap-1 text-[0.6875rem] font-normal max-lg:hidden lg:text-xs"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <Fragment key={`${String(item.title)}-${index}`}>
            {isLast ? (
              <span className="text-muted-foreground">
                <BreadcrumbItemContent item={item} />
              </span>
            ) : item.path ? (
              <Link
                to={item.path}
                className="cursor-pointer text-secondary-foreground transition-colors hover:text-primary"
              >
                <BreadcrumbItemContent item={item} />
              </Link>
            ) : (
              <span className="text-secondary-foreground">
                <BreadcrumbItemContent item={item} />
              </span>
            )}
            {!isLast && (
              <ChevronRight className="size-3 text-muted-foreground" />
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

type PageContentHeaderProps = {
  menuSource?: 'tenant' | 'central';
  fallbackMenu?: MenuConfig;
};

export function PageContentHeader({
  menuSource = 'tenant',
  fallbackMenu = MENU_SIDEBAR,
}: PageContentHeaderProps) {
  const config = usePageToolbarConfig();
  const { pathname } = useLocation();
  const dynamicMenu = useDynamicMenu();
  const centralMenu = useCentralMenu();
  const menu = menuSource === 'central' ? centralMenu : dynamicMenu;
  const { getCurrentItem } = useMenu(pathname);
  const menuItem = getCurrentItem(menu) ?? getCurrentItem(fallbackMenu);

  const title = config?.title ?? menuItem?.title;
  const description = config?.description;
  const headerActions = config?.headerActions;
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return undefined;

    const scrollRoot = header.closest<HTMLElement>('.page-content-scroll');
    if (!scrollRoot) return undefined;

    const syncHeight = () => {
      scrollRoot.style.setProperty(
        '--page-content-header-height',
        `${header.offsetHeight}px`,
      );
    };

    syncHeight();

    const resizeObserver = new ResizeObserver(syncHeight);
    resizeObserver.observe(header);

    return () => {
      resizeObserver.disconnect();
      scrollRoot.style.removeProperty('--page-content-header-height');
    };
  }, [description, headerActions, title]);

  const containerClassName =
    'max-xl:shrink-0 max-xl:flex-none max-xl:pb-3 max-xl:pt-2 xl:pb-4 xl:pt-3';

  const content =
    !title && !description ? (
      <PageBreadcrumbs menu={menu} />
    ) : (
      <>
        <PageBreadcrumbs menu={menu} />
        {title ? (
          <h1 className="flex w-full items-center justify-between gap-3 font-medium text-base text-mono max-xl:leading-snug lg:text-lg">
            <span className="min-w-0">{title}</span>
            {headerActions ? (
              <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
            ) : null}
          </h1>
        ) : null}
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground max-lg:hidden">
            {description}
          </p>
        ) : null}
      </>
    );

  return (
    <div
      ref={headerRef}
      className="page-content-header shrink-0 max-xl:bg-background max-xl:shadow-[0_1px_0_0_var(--border)]"
    >
      <Container className={containerClassName}>{content}</Container>
    </div>
  );
}
