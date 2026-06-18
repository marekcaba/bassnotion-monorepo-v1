'use client';

import { useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import type { NavItem } from '../constants/navigation';

interface SidebarNavProps {
  items: NavItem[];
  expanded?: boolean;
  /** Bigger left padding for the main rooms (the spine) so the labels sit
   *  inset from the rail edge. Off for the bottom nav. */
  insetLeft?: boolean;
}

export function SidebarNav({
  items,
  expanded = false,
  insetLeft = false,
}: SidebarNavProps) {
  const pathname = usePathname();
  const { navigateWithTransition } = useViewTransitionRouter();

  const handleNavClick = useCallback(
    (item: NavItem) => {
      if (item.disabled) return;
      navigateWithTransition(item.url);
    },
    [navigateWithTransition],
  );

  return (
    <div
      className={cn(
        'flex flex-col gap-1 py-2 px-2',
        // The spine sits lower from the top edge (breathing room above Backstage)
        // with more space between the rooms.
        insetLeft && 'gap-2.5 pt-6',
      )}
    >
      {items.map((item) => {
        const isActive = item.activePatterns
          ? item.activePatterns.some(
              (p) => pathname === p || pathname.startsWith(p + '/'),
            )
          : pathname === item.url;
        const Icon = item.icon;

        const button = (
          <button
            onClick={() => handleNavClick(item)}
            className={cn(
              'flex w-full items-center rounded-[7px] p-2 gap-3 transition-all whitespace-nowrap',
              // The spine rooms sit inset from the rail edge when expanded.
              insetLeft && expanded && 'pl-5',
              item.disabled
                ? 'opacity-35 cursor-not-allowed'
                : 'hover:bg-white/[0.04]',
              isActive && 'bg-white/[0.04] border border-white/[0.06]',
              !isActive && 'border border-transparent',
            )}
            aria-label={item.title}
            aria-disabled={item.disabled}
          >
            <Icon
              className={cn(
                'size-5 shrink-0',
                isActive ? 'text-[#E8A44A]' : 'text-[#5A5660]',
              )}
            />
            <span
              className={cn(
                'text-sm truncate',
                isActive ? 'text-[#E8E4DD] font-medium' : 'text-[#8A8690]',
                item.disabled && 'text-[#5A5660]',
              )}
            >
              {item.title}
            </span>
          </button>
        );

        if (expanded) {
          return <div key={item.title}>{button}</div>;
        }

        return (
          <Tooltip key={item.title}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right" align="center">
              {item.disabled ? `${item.title} (Coming Soon)` : item.title}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
