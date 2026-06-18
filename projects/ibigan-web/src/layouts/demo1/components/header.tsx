import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StoreClientTopbar } from '@/pages/store-client/components/common/topbar';
import { CommandPalette } from '@/components/search/command-palette';
import { ToolbarTooltip } from '@/components/grid/toolbar-tooltip';
import { NotificationsSheet } from '@/partials/topbar/notifications-sheet';
import { TenantSwitcher } from '@/partials/topbar/tenant-switcher';
import { UserDropdownMenu } from '@/partials/topbar/user-dropdown-menu';
import {
  Bell,
  Menu,
  Search,
  SquareChevronRight,
} from 'lucide-react';
import { useLocation } from 'react-router';
import { Link } from 'react-router-dom';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { type MenuMode } from '@/config/types';
import { useCentralOnlySession } from '@/hooks/use-central-only-session';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSettings } from '@/providers/settings-provider';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Container } from '@/components/common/container';
import { Breadcrumb } from './breadcrumb';
import { HorizontalMenu } from './horizontal-menu';
import { MegaMenu } from './mega-menu';
import { MegaMenuMobile } from './mega-menu-mobile';
import { SidebarMenu } from './sidebar-menu';

export function Header() {
  const { t } = useTranslation();
  const [isSidebarSheetOpen, setIsSidebarSheetOpen] = useState(false);
  const [isMegaMenuSheetOpen, setIsMegaMenuSheetOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const { pathname } = useLocation();
  const { settings } = useSettings();
  const mobileMode = useIsMobile();
  const isCentralOnly = useCentralOnlySession();
  const menuMode = (settings.layouts.demo1.menuMode ?? 'horizontal') as MenuMode;
  const isHorizontalMenu = menuMode === 'horizontal';

  useEffect(() => {
    setIsSidebarSheetOpen(false);
    setIsMegaMenuSheetOpen(false);
  }, [pathname]);

  const showBreadcrumb = pathname.startsWith('/account');
  const showDesktopNav = !mobileMode && !showBreadcrumb;

  return (
    <header
      className={cn(
        'header relative z-20 flex w-full shrink-0 items-stretch border-b border-border bg-background',
      )}
    >
      <Container className="flex h-full w-full items-center gap-x-2 lg:gap-x-4">
        <div className="flex min-w-0 flex-1 items-stretch gap-2 overflow-hidden sm:gap-5">
          <div className="flex items-center gap-1.5 sm:gap-2.5 xl:hidden">
            <Link to="/" className="shrink-0">
              <img
                src={toAbsoluteUrl('/media/app/mini-logo.svg')}
                className="h-[25px] w-full"
                alt="mini-logo"
              />
            </Link>
            <div className="flex items-center">
              {mobileMode && (
                <Sheet
                  open={isSidebarSheetOpen}
                  onOpenChange={setIsSidebarSheetOpen}
                >
                  <SheetTrigger asChild>
                    <Button variant="ghost" mode="icon">
                      <Menu className="text-muted-foreground/70" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    className="mobile-sidebar-sheet p-0 gap-0"
                    side="left"
                    close={false}
                    accessibilityTitle="Menu de navegação"
                  >
                    <SheetHeader className="p-0 space-y-0" />
                    <SheetBody className="p-0">
                      <SidebarMenu />
                    </SheetBody>
                  </SheetContent>
                </Sheet>
              )}
              {mobileMode && !isHorizontalMenu && (
                <Sheet
                  open={isMegaMenuSheetOpen}
                  onOpenChange={setIsMegaMenuSheetOpen}
                >
                  <SheetTrigger asChild>
                    <Button variant="ghost" mode="icon">
                      <SquareChevronRight className="text-muted-foreground/70" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    className="mobile-sidebar-sheet p-0 gap-0"
                    side="left"
                    close={false}
                    accessibilityTitle="Menu de módulos"
                  >
                    <SheetHeader className="p-0 space-y-0" />
                    <SheetBody className="p-0">
                      <MegaMenuMobile />
                    </SheetBody>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>

          {mobileMode && !isCentralOnly && (
            <div className="flex min-w-0 flex-1 items-center overflow-hidden xl:hidden">
              <TenantSwitcher showLabelOnMobile />
            </div>
          )}

          {isHorizontalMenu && !mobileMode && (
            <Link to="/" className="hidden shrink-0 items-center xl:flex">
              <img
                src={toAbsoluteUrl('/media/app/mini-logo.svg')}
                className="h-[22px] max-w-none"
                alt="Ibigan"
              />
            </Link>
          )}

          {showBreadcrumb ? (
            <Breadcrumb />
          ) : (
            showDesktopNav &&
            (isHorizontalMenu ? <HorizontalMenu /> : <MegaMenu />)
          )}
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-3">
          {pathname.startsWith('/store-client') ? (
            <StoreClientTopbar />
          ) : (
            <>
              <CommandPalette
                open={isCommandPaletteOpen}
                onOpenChange={setIsCommandPaletteOpen}
              />
              <div className="flex items-center gap-0.5">
                <ToolbarTooltip content={t('header.tooltip.search')}>
                  <Button
                    variant="ghost"
                    mode="icon"
                    shape="circle"
                    className="size-8 shrink-0 hover:bg-primary/10 hover:[&_svg]:text-primary sm:size-9"
                    onClick={() => setIsCommandPaletteOpen(true)}
                  >
                    <Search className="size-4 sm:size-4.5!" />
                  </Button>
                </ToolbarTooltip>
                <NotificationsSheet
                  trigger={
                    <ToolbarTooltip content={t('header.tooltip.notifications')}>
                      <Button
                        variant="ghost"
                        mode="icon"
                        shape="circle"
                        className="size-8 shrink-0 hover:bg-primary/10 hover:[&_svg]:text-primary sm:size-9"
                      >
                        <Bell className="size-4 sm:size-4.5!" />
                      </Button>
                    </ToolbarTooltip>
                  }
                />
              </div>
              <div className="hidden shrink-0 items-center lg:flex">
                <TenantSwitcher />
              </div>
              <UserDropdownMenu />
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
