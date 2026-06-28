'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useInternalPathname } from '@/lib/hooks/use-internal-pathname';
import { cn } from '@/shared/utils';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import {
  ProgressPane,
  type TutorialProgress,
  type BlockDot,
} from './ProgressPane';
import type { IslandBlock } from '../hooks/useTutorialsByFolder';

interface TutorialDot {
  slug: string;
  title: string;
  sidebarTitle?: string;
  isComplete?: boolean;
  /** Three-stage progress tracking */
  progress?: TutorialProgress;
  /** Block-based progress fields */
  islandBlocks?: IslandBlock[];
  blockProgress?: Record<string, { completed: boolean }>;
}

interface CollapsedJourneyPathProps {
  tutorials: TutorialDot[];
  className?: string;
}

/**
 * Collapsed journey path showing progress panes for navigation.
 * Used when the detail panel is collapsed to save screen real estate
 * while maintaining navigation capability.
 */
export function CollapsedJourneyPath({
  tutorials,
  className,
}: CollapsedJourneyPathProps) {
  const pathname = useInternalPathname();
  const { navigateWithTransition } = useViewTransitionRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTutorialClick = useCallback(
    (slug: string) => {
      // Room-scoped: opened from the College room → /college/<slug> (middleware rewrites
      // it to the same internal /app/tutorials/<slug> page).
      navigateWithTransition(`/college/${slug}`);
    },
    [navigateWithTransition],
  );

  // Position connector lines between panes after render
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    // Measure the actual rendered pane element, not the wrapper
    const paneInners = container.querySelectorAll(
      '.collapsed-journey-pane .progress-pane-inner',
    );
    const connectors = container.querySelectorAll(
      '.collapsed-journey-connector',
    );

    // Use first pane's horizontal center as the fixed X for all connectors
    const containerRect = container.getBoundingClientRect();
    const firstInner = paneInners[0] as HTMLElement | undefined;
    const fixedX = firstInner
      ? firstInner.getBoundingClientRect().left -
        containerRect.left +
        firstInner.getBoundingClientRect().width / 2
      : 0;

    connectors.forEach((connector, index) => {
      const fromInner = paneInners[index] as HTMLElement;
      const toInner = paneInners[index + 1] as HTMLElement;

      if (fromInner && toInner) {
        const fromRect = fromInner.getBoundingClientRect();
        const toRect = toInner.getBoundingClientRect();

        // Connect between pane edges, inset by 1px to avoid overlapping the ring border
        const fromY = fromRect.bottom - containerRect.top + 1;
        const toY = toRect.top - containerRect.top - 1;

        const connectorEl = connector as HTMLElement;
        connectorEl.style.top = `${fromY}px`;
        connectorEl.style.height = `${Math.max(0, toY - fromY)}px`;
        connectorEl.style.left = `${fixedX}px`;
      }
    });
  }, [tutorials]);

  if (tutorials.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex flex-col items-center pt-6 pb-3 gap-4',
        className,
      )}
    >
      {/* Connector lines - rendered separately for single continuous lines */}
      <div className="absolute top-0 bottom-0 pointer-events-none z-0">
        {tutorials.slice(0, -1).map((tutorial, index) => {
          const isFullyComplete = tutorial.isComplete;
          return (
            <div
              key={`connector-${tutorial.slug}`}
              className={cn(
                'collapsed-journey-connector absolute left-0 w-0.5 -translate-x-1/2',
                isFullyComplete ? 'bg-emerald-500/50' : 'bg-zinc-700',
              )}
              style={
                !isFullyComplete
                  ? {
                      backgroundImage:
                        'linear-gradient(to bottom, rgb(63 63 70) 50%, transparent 50%)',
                      backgroundSize: '4px 8px',
                    }
                  : undefined
              }
              data-from={index}
              data-to={index + 1}
            />
          );
        })}
      </div>

      {/* Progress panes */}
      {tutorials.map((tutorial) => {
        const isActive = pathname === `/app/tutorials/${tutorial.slug}`;
        const isCompleted = tutorial.isComplete;
        const displayTitle = tutorial.sidebarTitle || tutorial.title;

        // Block-based dots take precedence over legacy 3-stage progress
        const blockDots: BlockDot[] | undefined = tutorial.islandBlocks?.map(
          (b) => ({
            id: b.id,
            title: b.title,
            completed: tutorial.blockProgress?.[b.id]?.completed ?? false,
          }),
        );

        // Legacy fallback when no blocks
        const progress = !blockDots
          ? (tutorial.progress ?? {
              understood: isCompleted ?? false,
              practiced: isCompleted ?? false,
              applied: isCompleted ?? false,
            })
          : undefined;

        return (
          <div
            key={tutorial.slug}
            className="collapsed-journey-pane relative z-10"
          >
            <ProgressPane
              blockDots={blockDots}
              progress={progress}
              isActive={isActive}
              onClick={() => handleTutorialClick(tutorial.slug)}
              ariaLabel={`Go to ${displayTitle}`}
              size="collapsed"
            />
          </div>
        );
      })}
    </div>
  );
}
