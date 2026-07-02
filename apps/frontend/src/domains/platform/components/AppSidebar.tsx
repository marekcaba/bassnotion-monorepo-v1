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
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { MAIN_NAV_ITEMS, BOTTOM_NAV_ITEMS } from '../constants/navigation';
import { useNavPrefetch } from '../hooks/useNavPrefetch';
import { SidebarNav } from './SidebarNav';
import { UserAccountSection } from './UserAccountSection';

interface AppSidebarProps {
  expanded: boolean;
}

// The clean nav targets to warm on idle so the first click on a room is instant
// (see useNavPrefetch). Module-level + stable so the prefetch effect runs once.
// Skip disabled/coming-soon items — there's no route chunk to fetch yet.
const PREFETCH_URLS = [...MAIN_NAV_ITEMS, ...BOTTOM_NAV_ITEMS]
  .filter((item) => !item.disabled)
  .map((item) => item.url);

export function AppSidebar({ expanded }: AppSidebarProps) {
  const { navigateWithTransition } = useViewTransitionRouter();
  const { profile, cachedRole } = useUserProfile();
  const isAdmin = profile?.role === 'admin' || cachedRole === 'admin';

  // Hide adminOnly items (the Admin panel) from non-admins. The route stays AdminGuard-gated
  // regardless — this only removes the nav entry so it doesn't show for members.
  const bottomNavItems = isAdmin
    ? BOTTOM_NAV_ITEMS
    : BOTTOM_NAV_ITEMS.filter((item) => !item.adminOnly);

  // Warm the spine's route chunks after first paint so first-click === re-visit.
  useNavPrefetch(PREFETCH_URLS);

  const handleLogoClick = useCallback(() => {
    // Clean writer URL: the middleware maps the app-host '/' → /app (Backstage).
    navigateWithTransition('/');
  }, [navigateWithTransition]);

  return (
    <div
      className={cn(
        // relative z-10: sit above the shell's z-0 LeatherBackground so the sidebar's solid
        // #141318 reads fully opaque (without a stacking context the screen-blended leather bled
        // through, making it look faintly transparent/textured).
        'relative z-10 flex h-svh shrink-0 flex-col border-r border-white/[0.06] bg-[#141318] transition-[width] duration-200 ease-in-out overflow-hidden',
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

      {/* Main nav — the spine, inset from the rail edge */}
      <div className="flex-1 overflow-y-auto">
        <SidebarNav items={MAIN_NAV_ITEMS} expanded={expanded} insetLeft />
      </div>

      {/* Divider */}
      <div className="mx-2 h-px bg-white/[0.06]" />

      {/* Bottom section */}
      <div className="flex flex-col gap-1 pb-3">
        <SidebarNav items={bottomNavItems} expanded={expanded} />

        {/* User account */}
        <UserAccountSection expanded={expanded} />
      </div>
    </div>
  );
}
