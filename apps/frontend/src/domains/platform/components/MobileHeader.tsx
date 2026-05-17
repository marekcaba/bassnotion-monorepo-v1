'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/shared/components/ui/sheet';
import { MAIN_NAV_ITEMS, BOTTOM_NAV_ITEMS } from '../constants/navigation';
import { SidebarNav } from './SidebarNav';
import { UserAccountSection } from './UserAccountSection';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const { navigateWithTransition } = useViewTransitionRouter();

  const handleLogoClick = useCallback(() => {
    navigateWithTransition('/app');
  }, [navigateWithTransition]);

  return (
    <>
      {/* Fixed top bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#141318] px-3 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center rounded-[7px] p-2 text-[#5A5660] hover:bg-white/[0.04] hover:text-[#E8E4DD] transition-colors"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>

        <button
          onClick={handleLogoClick}
          className="flex items-center justify-center"
          aria-label="Go to home"
        >
          <Image
            src="/BASSICOLOGY BIG.png"
            alt="Bassicology"
            width={120}
            height={20}
            className="h-5 w-auto"
          />
        </button>

        {/* Spacer to balance the hamburger */}
        <div className="w-9" />
      </div>

      {/* Sheet drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[16rem] border-white/[0.06] bg-[#141318] p-0 [&>[data-slot=sheet-close]]:text-[#5A5660] [&>[data-slot=sheet-close]]:hover:text-[#E8E4DD] [&>[data-slot=sheet-close]]:top-3 [&>[data-slot=sheet-close]]:right-3"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>

          {/* Logo */}
          <div className="flex items-center px-3 py-3 border-b border-white/[0.06]">
            <button
              onClick={() => {
                handleLogoClick();
                setOpen(false);
              }}
              className="flex items-center justify-center rounded-[7px] p-1.5 hover:bg-white/[0.04] transition-colors"
              aria-label="Go to home"
            >
              <Image
                src="/BASSICOLOGY BIG.png"
                alt="Bassicology"
                width={140}
                height={24}
                className="h-6 w-auto"
              />
            </button>
          </div>

          {/* Main nav */}
          <div
            className="flex-1 overflow-y-auto"
            onClick={() => setOpen(false)}
          >
            <SidebarNav items={MAIN_NAV_ITEMS} expanded />
          </div>

          {/* Divider */}
          <div className="mx-2 h-px bg-white/[0.06]" />

          {/* Bottom section */}
          <div
            className="flex flex-col gap-1 pb-3"
            onClick={() => setOpen(false)}
          >
            <SidebarNav items={BOTTOM_NAV_ITEMS} expanded />
            <UserAccountSection expanded />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
