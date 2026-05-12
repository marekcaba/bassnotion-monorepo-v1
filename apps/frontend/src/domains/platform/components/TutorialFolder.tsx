'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  CheckCircle2,
  ChevronDown,
  Library,
  Lock,
  Play,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/shared/components/ui/collapsible';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { ProgressPane, type TutorialProgress } from './ProgressPane';

/** Color mapping for difficulty levels */
const DIFFICULTY_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  beginner: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
  },
  intermediate: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
  },
  advanced: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    glow: 'shadow-red-500/20',
  },
};

interface TutorialItem {
  slug: string;
  title: string;
  sidebarTitle?: string;
  difficulty: string;
  isComplete?: boolean;
  /** Three-stage progress tracking */
  progress?: TutorialProgress;
}

interface TutorialFolderProps {
  title: string;
  tutorials: TutorialItem[];
  isLocked?: boolean;
  /** Controlled open state - if provided, component becomes controlled */
  isOpen?: boolean;
  /** Callback when open state changes - required if isOpen is provided */
  onOpenChange?: (open: boolean) => void;
  /** Default open state - only used if isOpen is not provided (uncontrolled mode) */
  defaultOpen?: boolean;
}

export function TutorialFolder({
  title,
  tutorials,
  isLocked = false,
  isOpen: controlledIsOpen,
  onOpenChange,
  defaultOpen = false,
}: TutorialFolderProps) {
  const pathname = usePathname();
  const { navigateWithTransition } = useViewTransitionRouter();
  // Support both controlled and uncontrolled modes
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(defaultOpen);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : uncontrolledIsOpen;
  const containerRef = useRef<HTMLDivElement>(null);

  // Position connector lines between panes after render
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const container = containerRef.current;
    const panes = container.querySelectorAll('.journey-pane');
    const connectors = container.querySelectorAll('.journey-connector');

    connectors.forEach((connector, index) => {
      const fromPane = panes[index] as HTMLElement;
      const toPane = panes[index + 1] as HTMLElement;

      if (fromPane && toPane) {
        const fromRect = fromPane.getBoundingClientRect();
        const toRect = toPane.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Calculate positions relative to container - connect pane center-bottom to pane center-top
        const fromY = fromRect.bottom - containerRect.top;
        const toY = toRect.top - containerRect.top;

        // Get horizontal center of the panes
        const fromCenterX = fromRect.left - containerRect.left + fromRect.width / 2;

        const connectorEl = connector as HTMLElement;
        connectorEl.style.top = `${fromY}px`;
        connectorEl.style.height = `${Math.max(0, toY - fromY)}px`;
        connectorEl.style.left = `${fromCenterX}px`;
      }
    });
  }, [isOpen, tutorials]);

  const handleTutorialClick = useCallback(
    (slug: string) => {
      navigateWithTransition(`/app/tutorials/${slug}`);
    },
    [navigateWithTransition],
  );

  const handleToggle = useCallback((open: boolean) => {
    if (isControlled) {
      onOpenChange?.(open);
    } else {
      setUncontrolledIsOpen(open);
    }
  }, [isControlled, onOpenChange]);

  // Calculate completion progress
  const completedCount = tutorials.filter((t) => t.isComplete).length;
  const totalCount = tutorials.length;

  return (
    <Collapsible open={isOpen} onOpenChange={handleToggle}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-all duration-200',
            isOpen
              ? 'bg-zinc-800/50 text-zinc-100'
              : 'text-zinc-300 hover:bg-zinc-800/30',
          )}
        >
          <Library
            className={cn(
              'size-4 shrink-0 transition-colors',
              isOpen ? 'text-[#ffc700]' : 'text-zinc-500',
            )}
          />
          <span className="flex-1 truncate text-left">{title}</span>

          {/* Progress indicator */}
          {!isLocked && totalCount > 0 && (
            <span className="text-xs text-zinc-500 tabular-nums">
              {completedCount}/{totalCount}
            </span>
          )}

          {isLocked && <Lock className="size-3.5 shrink-0 text-zinc-500" />}
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-zinc-500 transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 pl-1">
          {isLocked ? (
            <div className="flex items-center gap-2 px-2 py-3 text-xs text-zinc-500">
              <Lock className="size-3" />
              <span>Upgrade to unlock</span>
            </div>
          ) : (
            <div ref={containerRef} className="relative">
              {/* Connector lines between panes - rendered separately for animation support */}
              <div className="absolute top-0 bottom-0 pointer-events-none z-0">
                {tutorials.slice(0, -1).map((tutorial, index) => {
                  const isFullyComplete = tutorial.isComplete;
                  return (
                    <div
                      key={`connector-${tutorial.slug}`}
                      className={cn(
                        'journey-connector absolute left-0 w-0.5 -translate-x-1/2',
                        isFullyComplete
                          ? 'bg-emerald-500/50' // Solid for fully complete
                          : 'bg-zinc-700 bg-[length:4px_8px] bg-repeat-y',
                      )}
                      style={!isFullyComplete ? {
                        backgroundImage: 'linear-gradient(to bottom, rgb(63 63 70) 50%, transparent 50%)',
                      } : undefined}
                      data-from={index}
                      data-to={index + 1}
                      data-completed={tutorial.isComplete}
                    />
                  );
                })}
              </div>

              {/* Tutorial cards with progress panes */}
              <div className="space-y-2">
                {tutorials.map((tutorial) => {
                  const isActive = pathname === `/app/tutorials/${tutorial.slug}`;
                  const isCompleted = tutorial.isComplete;
                  const difficultyColors = DIFFICULTY_COLORS[tutorial.difficulty?.toLowerCase() ?? ''];
                  const displayTitle = tutorial.sidebarTitle || tutorial.title;

                  // Use actual three-stage progress if available, fallback to legacy
                  const progress = tutorial.progress ?? {
                    understood: isCompleted ?? false,
                    practiced: isCompleted ?? false,
                    applied: isCompleted ?? false,
                  };

                  // Active + completed = green theme, Active only = yellow theme
                  const isActiveAndCompleted = isActive && isCompleted;

                  return (
                    <div key={tutorial.slug} className="flex gap-2 tutorial-card-row">
                      {/* Journey path column - the progress pane */}
                      <div className="relative flex items-center justify-center shrink-0">
                        <div className="journey-pane">
                          <ProgressPane
                            progress={progress}
                            isActive={isActive}
                            onClick={() => handleTutorialClick(tutorial.slug)}
                            ariaLabel={`Go to ${displayTitle}`}
                          />
                        </div>
                      </div>

                      {/* Card */}
                      <button
                        onClick={() => handleTutorialClick(tutorial.slug)}
                        className={cn(
                          'group flex-1 rounded-lg p-2.5 text-left transition-all duration-200 border',
                          isActiveAndCompleted
                            ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                            : isActive
                              ? 'bg-[#ffc700]/10 border-[#ffc700]/30 shadow-lg shadow-[#ffc700]/5'
                              : isCompleted
                                ? 'bg-zinc-800/30 border-zinc-700/50 hover:bg-zinc-800/50 hover:border-zinc-600/50'
                                : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700',
                        )}
                      >
                        {/* Card header: title + status icon */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {/* Title */}
                            <h4
                              className={cn(
                                'text-sm font-medium leading-snug transition-colors',
                                isActiveAndCompleted
                                  ? 'text-emerald-400'
                                  : isActive
                                    ? 'text-[#ffc700]'
                                    : isCompleted
                                      ? 'text-zinc-300'
                                      : 'text-zinc-300 group-hover:text-white',
                              )}
                            >
                              {displayTitle}
                            </h4>
                          </div>

                          {/* Status icon */}
                          <div className="shrink-0 mt-0.5">
                            {isCompleted ? (
                              <CheckCircle2 className="size-4 text-emerald-400" />
                            ) : isActive ? (
                              <Play className="size-4 text-[#ffc700] fill-[#ffc700]" />
                            ) : (
                              <Play className="size-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                        </div>

                        {/* Difficulty badge */}
                        {difficultyColors && (
                          <div className="mt-2 flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider',
                                difficultyColors.bg,
                                difficultyColors.text,
                              )}
                            >
                              {tutorial.difficulty}
                            </span>
                            {isCompleted && (
                              <span className="text-[10px] text-emerald-400/70">
                                Completed
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
