import { useCallback, useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  scrollAllPageContainersToTop,
  usePageScrollPosition,
} from '@/hooks/use-page-scroll-containers';
import { usePageScrollRef } from '@/providers/page-scroll-provider';
import { Button } from '@/components/ui/button';

const SCROLL_VISIBILITY_OFFSET = 16;

export function ScrollToTopButton() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const scrollRef = usePageScrollRef();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const aboveEquipamentoBottomNav =
    isMobile &&
    (pathname === '/equipamentos' || pathname.startsWith('/equipamentos/'));

  const handleScrollPosition = useCallback((scrollTop: number) => {
    setVisible(scrollTop > SCROLL_VISIBILITY_OFFSET);
  }, []);

  usePageScrollPosition(handleScrollPosition);

  useEffect(() => {
    setMounted(true);
  }, []);

  function scrollToTop() {
    scrollAllPageContainersToTop(scrollRef?.current);
  }

  if (!mounted) {
    return null;
  }

  return createPortal(
    <Button
      type="button"
      variant="primary"
      size="sm"
      mode="icon"
      shape="circle"
      data-testid="scroll-to-top-button"
      data-visible={visible ? 'true' : 'false'}
      aria-label={t('common.scroll_to_top')}
      title={t('common.scroll_to_top')}
      onClick={scrollToTop}
      className={cn(
        'fixed z-[200] size-10 shadow-lg ring-1 ring-primary/25',
        'end-[max(1rem,env(safe-area-inset-right))]',
        aboveEquipamentoBottomNav
          ? 'bottom-[calc(3.25rem+env(safe-area-inset-bottom,0px))]'
          : 'bottom-[max(1rem,env(safe-area-inset-bottom))]',
        'transition-[opacity,transform,visibility] duration-200 hover:shadow-lg active:scale-95',
        visible
          ? 'visible translate-y-0 opacity-100'
          : 'invisible pointer-events-none translate-y-3 opacity-0',
      )}
    >
      <ArrowUp className="size-4" strokeWidth={2.25} />
    </Button>,
    document.body,
  );
}
