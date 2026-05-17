'use client';

import { cn } from '@/shared/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

export interface TutorialProgress {
  /** Stage 1: User watched the understand video */
  understood: boolean;
  /** Stage 2: User completed practice exercises */
  practiced: boolean;
  /** Stage 3: User completed the apply stage */
  applied: boolean;
}

/** A single dot representing a block's completion in the sidebar */
export interface BlockDot {
  id: string;
  title: string;
  completed: boolean;
}

interface ProgressPaneProps {
  /** Legacy three-stage progress (used when blockDots is not provided) */
  progress?: TutorialProgress;
  /** Dynamic block-based dots (takes precedence over progress) */
  blockDots?: BlockDot[];
  /** Whether this lesson is currently active/selected */
  isActive?: boolean;
  /** Click handler for the pane */
  onClick?: () => void;
  /** Accessible label */
  ariaLabel?: string;
  /** Size variant */
  size?: 'default' | 'collapsed';
  className?: string;
}

/**
 * Progress pane showing completion dots for a tutorial.
 *
 * Supports two modes:
 * 1. **Block-based** (when `blockDots` is provided): N dots matching the tutorial's
 *    island-visible blocks. Dot size adapts to count.
 * 2. **Legacy 3-dot** (when only `progress` is provided): Fixed 3 dots for
 *    UNDERSTAND → PRACTICE → APPLY stages.
 */
export function ProgressPane({
  progress,
  blockDots,
  isActive = false,
  onClick,
  ariaLabel,
  size = 'default',
  className,
}: ProgressPaneProps) {
  // Normalize to a common dot array
  const dots: BlockDot[] =
    blockDots ??
    (progress
      ? [
          {
            id: 'understood',
            title: 'Understood',
            completed: progress.understood,
          },
          {
            id: 'practiced',
            title: 'Practiced',
            completed: progress.practiced,
          },
          { id: 'applied', title: 'Applied', completed: progress.applied },
        ]
      : []);

  const isFullyComplete = dots.length > 0 && dots.every((d) => d.completed);

  const dotSize = 'size-2';

  // Pane styling — vertical column of dots
  const paneClasses = cn(
    'transition-all duration-200 rounded-full inline-flex flex-col items-center justify-center gap-1 px-1.5 py-1.5',
    // Background
    isFullyComplete
      ? 'bg-emerald-500/15'
      : isActive
        ? 'bg-[#ffc700]/10'
        : 'bg-zinc-800/60',
    // Border/ring
    isFullyComplete
      ? 'ring-1 ring-emerald-500/30'
      : isActive
        ? 'ring-1 ring-[#ffc700]/30'
        : 'ring-1 ring-zinc-700/50',
    // Glow effect when fully complete
    isFullyComplete && 'shadow-sm shadow-emerald-500/20',
    // Hover state
    onClick && 'cursor-pointer hover:ring-zinc-600',
    className,
  );

  // Dot base styling
  const getDotClasses = (isComplete: boolean) =>
    cn(
      'rounded-full transition-all duration-200',
      dotSize,
      isComplete
        ? isFullyComplete
          ? 'bg-emerald-400' // All complete = green glow
          : 'bg-[#ffc700]' // Partial = yellow/gold
        : 'bg-zinc-600/50', // Incomplete = dim
    );

  // Tooltip content
  const tooltipContent = (
    <div className="space-y-1">
      {dots.map((dot) => (
        <div key={dot.id} className="flex items-center gap-2">
          <span
            className={dot.completed ? 'text-emerald-400' : 'text-zinc-500'}
          >
            {dot.completed ? '✓' : '○'}
          </span>
          <span className={dot.completed ? 'text-white' : 'text-zinc-500'}>
            {dot.title}
          </span>
        </div>
      ))}
    </div>
  );

  const paneContent = (
    <div className={cn(paneClasses, 'progress-pane-inner')}>
      {dots.map((dot) => (
        <div key={dot.id} className={getDotClasses(dot.completed)} />
      ))}
    </div>
  );

  if (onClick) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className="relative z-10 cursor-pointer transition-transform hover:scale-105"
            aria-label={ariaLabel}
          >
            {paneContent}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          sideOffset={12}
          className="bg-zinc-900 border-zinc-700 text-white px-3 py-2"
        >
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    );
  }

  return paneContent;
}

/**
 * Helper to convert legacy isComplete boolean to TutorialProgress.
 * For backward compatibility during transition.
 *
 * When isComplete is true, we assume all stages are complete.
 * When false, we assume no stages are complete.
 *
 * TODO: Replace this with actual per-stage tracking.
 */
export function legacyToProgress(isComplete: boolean): TutorialProgress {
  return {
    understood: isComplete,
    practiced: isComplete,
    applied: isComplete,
  };
}
