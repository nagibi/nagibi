import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Outlet, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { MENU_SIDEBAR } from '@/config/menu.config';
import { type MenuMode } from '@/config/types';
import { useMenu } from '@/hooks/use-menu';
import { useNotifications } from '@/hooks/use-notifications';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSettings } from '@/providers/settings-provider';
import {
  PageToolbarProvider,
  useClearPageToolbarAlertOnNavigate,
} from '@/providers/page-toolbar-provider';
import { NotificationPreferencesSheetProvider } from '@/providers/notification-preferences-sheet-provider';
import { NotificationsSheetProvider } from '@/providers/notifications-sheet-provider';
import { Footer } from './components/footer';
import { ScrollToTopButton } from '@/components/common/scroll-to-top-button';
import { ScrollTopAnchor } from '@/components/common/scroll-top-anchor';
import { PageScrollContainer, PageScrollProvider } from '@/providers/page-scroll-provider';
import { Header } from './components/header';
import { PageContentHeader } from './components/page-content-header';
import { PageToolbarBar } from './components/page-toolbar-bar';
import { Sidebar } from './components/sidebar';

function Demo1LayoutContent() {
  useClearPageToolbarAlertOnNavigate();

  return (
    <PageScrollProvider>
      <div className="wrapper flex h-dvh min-w-0 grow flex-col overflow-y-hidden">
        <Header />
        <PageToolbarBar />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" role="content">
          <PageScrollContainer className="page-content-scroll flex min-h-0 min-w-0 flex-1 flex-col">
            <ScrollTopAnchor />
            <PageContentHeader />
            <Outlet />
          </PageScrollContainer>
        </main>

        <Footer />
        <ScrollToTopButton />
      </div>
    </PageScrollProvider>
  );
}

export function Demo1Layout() {
  useNotifications();

  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const { getCurrentItem } = useMenu(pathname);
  const item = getCurrentItem(MENU_SIDEBAR);
  const { settings, setOption } = useSettings();
  const { resolvedTheme } = useTheme();

  const menuMode = (settings.layouts.demo1.menuMode ?? 'horizontal') as MenuMode;
  const isSidebarMode = menuMode !== 'horizontal';

  useEffect(() => {
    const bodyClass = document.body.classList;

    if (isSidebarMode && settings.layouts.demo1.sidebarCollapse) {
      bodyClass.add('sidebar-collapse');
    } else {
      bodyClass.remove('sidebar-collapse');
    }
  }, [settings.layouts.demo1.sidebarCollapse, isSidebarMode]);

  useEffect(() => {
    const bodyClass = document.body.classList;

    if (isSidebarMode && settings.layouts.demo1.sidebarTransparent) {
      bodyClass.add('sidebar-transparent');
    } else {
      bodyClass.remove('sidebar-transparent');
    }
  }, [settings.layouts.demo1.sidebarTransparent, isSidebarMode]);

  useEffect(() => {
    if (!resolvedTheme) return;
    const sidebarTheme = resolvedTheme === 'dark' ? 'dark' : 'light';
    if (settings.layouts.demo1.sidebarTheme !== sidebarTheme) {
      setOption('layouts.demo1.sidebarTheme', sidebarTheme);
    }
  }, [resolvedTheme, setOption, settings.layouts.demo1.sidebarTheme]);

  useEffect(() => {
    if (settings.layout === 'demo1') {
      return;
    }

    setOption('layout', 'demo1');
  }, [setOption, settings.layout]);

  useEffect(() => {
    const bodyClass = document.body.classList;

    bodyClass.add('demo1');
    bodyClass.add('header-fixed');

    if (isSidebarMode) {
      bodyClass.add('sidebar-fixed');
      bodyClass.remove('menu-horizontal');
    } else {
      bodyClass.remove('sidebar-fixed');
      bodyClass.remove('sidebar-collapse');
      bodyClass.add('menu-horizontal');
    }

    const timer = setTimeout(() => {
      bodyClass.add('layout-initialized');
    }, 300);

    return () => {
      bodyClass.remove('demo1');
      bodyClass.remove('sidebar-fixed');
      bodyClass.remove('sidebar-collapse');
      bodyClass.remove('sidebar-transparent');
      bodyClass.remove('menu-horizontal');
      bodyClass.remove('header-fixed');
      bodyClass.remove('layout-initialized');
      clearTimeout(timer);
    };
  }, [isSidebarMode]);

  return (
    <NotificationPreferencesSheetProvider>
      <NotificationsSheetProvider>
        <Helmet>
          <title>{item?.title}</title>
        </Helmet>

        {!isMobile && isSidebarMode && <Sidebar />}

        <PageToolbarProvider>
            <Demo1LayoutContent />
          </PageToolbarProvider>
      </NotificationsSheetProvider>
    </NotificationPreferencesSheetProvider>
  );
}
