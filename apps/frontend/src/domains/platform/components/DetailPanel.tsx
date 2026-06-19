'use client';

import { useInternalPathname } from '@/lib/hooks/use-internal-pathname';
import { GraduationCap, Home, PanelLeft, PanelLeftClose } from 'lucide-react';
import { cn } from '@/shared/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { BassmentJourneyView } from './BassmentJourneyView';
import { CollapsedTutorialDock } from './CollapsedTutorialDock';
import { SessionCard, ProgressCard } from './NodeMatrix';
import { useFolderOpenState } from '../hooks/useFolderOpenState';
import { useTutorialsByFolder } from '../hooks/useTutorialsByFolder';

interface DetailPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export function DetailPanel({ isOpen, onToggle, className }: DetailPanelProps) {
  const pathname = useInternalPathname();

  // The panel only renders content on /app, /app/bassment and /app/tutorials/*.
  // On every other app route it's hidden — so don't fetch the tutorial library
  // (GET /collections + /tutorials) there; gate the source query on hasContent.
  const hasContent =
    pathname === '/app' ||
    pathname === '/app/bassment' ||
    pathname.startsWith('/app/tutorials');

  // Shared folder open state between expanded and collapsed views. Seed it from
  // the DB-driven folder list so free folders default to open once loaded.
  const { folders } = useTutorialsByFolder({ enabled: hasContent });
  const folderState = useFolderOpenState(folders);

  const showHome = pathname === '/app';

  const showJourneyView =
    pathname === '/app/bassment' || pathname.startsWith('/app/tutorials');

  return (
    <div
      className={cn(
        'shrink-0 transition-[width] duration-200 ease-in-out overflow-hidden flex flex-col h-svh',
        hasContent
          ? showHome || showJourneyView
            ? 'border-r-0'
            : 'bg-[#141318] border-r border-white/[0.06]'
          : 'border-r-0',
        !hasContent
          ? 'w-0 min-w-0'
          : isOpen
            ? 'w-80'
            : 'w-[3.25rem] min-w-[3.25rem]',
        className,
      )}
    >
      {hasContent && (
        <>
          {/* Panel header (hidden on home route) */}
          <div
            className={cn(
              'flex items-center shrink-0',
              showHome
                ? 'h-0 overflow-hidden'
                : 'h-12 border-b border-white/[0.06]',
              isOpen ? 'justify-between px-3' : 'justify-center',
            )}
          >
            {isOpen ? (
              <>
                <div className="flex items-center gap-2">
                  {showHome ? (
                    <>
                      <Home className="size-4 text-[#E8A44A]" />
                      <span className="text-sm font-medium text-[#E8E4DD]">
                        Dashboard
                      </span>
                    </>
                  ) : (
                    <>
                      <GraduationCap className="size-4 text-[#E8A44A]" />
                      <span className="text-sm font-medium text-[#E8E4DD]">
                        Bassment
                      </span>
                    </>
                  )}
                </div>
                <button
                  onClick={onToggle}
                  className="flex items-center justify-center rounded-[7px] p-1.5 text-[#5A5660] hover:bg-white/[0.04] hover:text-[#E8E4DD] transition-colors"
                  aria-label="Collapse panel"
                >
                  <PanelLeftClose className="size-5" />
                </button>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggle}
                    className="flex items-center justify-center rounded-[7px] p-1.5 text-[#5A5660] hover:bg-white/[0.04] hover:text-[#E8E4DD] transition-colors"
                    aria-label="Expand panel"
                  >
                    <PanelLeft className="size-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                  Expand panel
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Scrollable content */}
          {isOpen ? (
            <ScrollArea className="flex-1">
              {showHome && (
                <div className="flex flex-col gap-4 p-3 pt-[150px]">
                  <div style={{ animation: 'panelSlideUp 0.5s ease-out both' }}>
                    <SessionCard />
                  </div>
                  <div
                    style={{
                      animation: 'panelSlideUp 0.5s ease-out 0.2s both',
                    }}
                  >
                    <ProgressCard />
                  </div>
                </div>
              )}
              {showJourneyView && (
                <BassmentJourneyView folderState={folderState} />
              )}
            </ScrollArea>
          ) : (
            /* Collapsed view - show journey dots for navigation */
            showJourneyView && (
              <ScrollArea className="flex-1">
                <CollapsedTutorialDock folderState={folderState} />
              </ScrollArea>
            )
          )}
        </>
      )}
    </div>
  );
}
