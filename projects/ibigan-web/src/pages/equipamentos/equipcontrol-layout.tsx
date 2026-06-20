import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { PageBody } from '@/components/common/page-body';
import { EquipcontrolBottomNav } from '@/pages/equipamentos/equipcontrol-bottom-nav';

export function EquipControlLayout() {
  useEffect(() => {
    const scrollRoot = document.querySelector('.page-content-scroll');
    scrollRoot?.classList.add('equipcontrol-page');

    return () => {
      scrollRoot?.classList.remove('equipcontrol-page');
    };
  }, []);

  return (
    <>
      <PageBody className="mx-auto w-full min-w-0 max-w-lg max-xl:gap-3 pb-28 max-xl:!pt-0 sm:max-w-3xl sm:pb-24 lg:max-w-5xl xl:mx-0 xl:max-w-none xl:min-h-0 xl:flex-1 xl:gap-3 xl:overflow-hidden xl:pb-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col max-xl:flex-none xl:min-h-0 xl:flex-1 xl:overflow-x-hidden xl:overflow-y-auto">
          <Outlet />
        </div>
      </PageBody>
      <EquipcontrolBottomNav />
    </>
  );
}
