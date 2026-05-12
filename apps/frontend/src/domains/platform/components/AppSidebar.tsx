'use client';

import { useCallback } from 'react';
import Image from 'next/image';
import { Music } from 'lucide-react';
import { cn } from '@/shared/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { MAIN_NAV_ITEMS, BOTTOM_NAV_ITEMS } from '../constants/navigation';
import { SidebarNav } from './SidebarNav';
import { UserAccountSection } from './UserAccountSection';

interface AppSidebarProps {
  expanded: boolean;
}

export function AppSidebar({ expanded }: AppSidebarProps) {
  const { navigateWithTransition } = useViewTransitionRouter();

  const handleLogoClick = useCallback(() => {
    navigateWithTransition('/app');
  }, [navigateWithTransition]);

  return (
    <div
      className={cn(
        'flex h-svh shrink-0 flex-col border-r border-white/[0.06] bg-[#141318] transition-[width] duration-200 ease-in-out overflow-hidden',
        expanded ? 'w-[11rem]' : 'w-[3.25rem] min-w-[3.25rem]',
      )}
    >
      {/* Logo */}
      <div className="flex items-center py-1.5 px-1.5 shrink-0">
        {expanded ? (
          <button
            onClick={handleLogoClick}
            className="flex w-full items-center justify-center rounded-[7px] p-1.5 hover:bg-white/[0.04] transition-colors"
            aria-label="Go to home"
          >
            <Image
              src="/BASSICOLOGY BIG.png"
              alt="Bassicology"
              width={160}
              height={26}
              className="w-[90%] h-auto"
            />
          </button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogoClick}
                className="flex w-full items-center rounded-[7px] p-2 gap-3 hover:bg-white/[0.04] transition-colors whitespace-nowrap"
                aria-label="Go to home"
              >
                <Music className="size-5 shrink-0 text-[#ffc700]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
              Home
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Divider */}
      <div className="mx-2 h-px bg-white/[0.06]" />

      {/* Main nav */}
      <div className="flex-1 overflow-y-auto">
        <SidebarNav items={MAIN_NAV_ITEMS} expanded={expanded} />
      </div>

      {/* Divider */}
      <div className="mx-2 h-px bg-white/[0.06]" />

      {/* Bottom section */}
      <div className="flex flex-col gap-1 pb-3">
        <SidebarNav items={BOTTOM_NAV_ITEMS} expanded={expanded} />

        {/* User account */}
        <UserAccountSection expanded={expanded} />
      </div>
    </div>
  );
}
