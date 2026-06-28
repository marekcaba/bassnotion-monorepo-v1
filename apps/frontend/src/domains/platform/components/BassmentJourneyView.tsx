'use client';

import { useCallback } from 'react';
import { useInternalPathname } from '@/lib/hooks/use-internal-pathname';
import { CheckCircle2, ChevronDown, Library, Lock, Play } from 'lucide-react';
import { cn } from '@/shared/utils';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/shared/components/ui/collapsible';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
// ProgressPane (the dot column next to each card) was removed in favour of
// a thin progress bar inside the card. The dot pane lives in
// CollapsedJourneyPath where it doubles as the nav handle.
import {
  useTutorialsByFolder,
  type TutorialItem,
} from '../hooks/useTutorialsByFolder';
import type { FolderOpenState } from '../hooks/useFolderOpenState';

/** Color mapping for difficulty levels — matching SessionCard's tag style */
const DIFFICULTY_COLORS: Record<string, { base: string; glow: string }> = {
  beginner: { base: '#6BCF8E', glow: 'rgba(107,207,142,0.25)' },
  intermediate: { base: '#E8A44A', glow: 'rgba(232,164,74,0.25)' },
  advanced: { base: '#FF7EB3', glow: 'rgba(255,126,179,0.25)' },
};

// ─── Single Tutorial Card (styled like SessionCard/ProgressCard) ────
function TutorialCard({
  tutorial,
  isActive,
  index,
  onClick,
}: {
  tutorial: TutorialItem;
  isActive: boolean;
  index: number;
  onClick: () => void;
}) {
  const isCompleted = tutorial.isComplete;
  const isActiveAndCompleted = isActive && isCompleted;
  const diffColors =
    DIFFICULTY_COLORS[tutorial.difficulty?.toLowerCase() ?? ''];
  const displayTitle = tutorial.sidebarTitle || tutorial.title;

  // Progress ratio for the thin bar at the bottom of the card. Computed from
  // the per-block completion map populated by useTutorialsByFolder from the
  // server's tutorial-completions summary. Falls back to 0/100% based on the
  // legacy isComplete flag when a tutorial has no blocks at all.
  const islandBlocks = tutorial.islandBlocks ?? [];
  const completedBlocks = islandBlocks.filter(
    (b) => tutorial.blockProgress?.[b.id]?.completed,
  ).length;
  const totalBlocks = islandBlocks.length;
  const progressPercent =
    totalBlocks > 0
      ? Math.round((completedBlocks / totalBlocks) * 100)
      : isCompleted
        ? 100
        : 0;

  // Accent color: completed = emerald, active = gold, default = subtle
  const accentColor = isCompleted
    ? '#6BCF8E'
    : isActive
      ? '#E8A44A'
      : undefined;

  return (
    <div
      className="tutorial-journey-row"
      style={{ animation: `panelSlideUp 0.5s ease-out ${index * 0.12}s both` }}
    >
      {/* Card — styled like SessionCard */}
      <button
        onClick={onClick}
        className={cn(
          'group relative w-full overflow-hidden rounded-[14px] border px-[18px] py-3 text-left transition-all duration-200',
          isActiveAndCompleted
            ? 'border-emerald-500/10 bg-[#141318]'
            : isActive
              ? 'border-[#E8A44A]/10 bg-[#141318]'
              : isCompleted
                ? 'border-emerald-500/10 bg-[#141318] hover:border-emerald-500/20 hover:bg-[#181720]'
                : 'border-white/[0.03] bg-[#141318] hover:border-white/[0.10] hover:bg-[#181720]',
        )}
      >
        {/* Bottom-right orange glow for active card */}
        {isActive && !isCompleted && (
          <div
            className="absolute bottom-0 right-0 w-20 h-20 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 100% 100%, rgba(232,164,74,0.08) 0%, transparent 70%)',
            }}
          />
        )}

        {/* Top accent line — like SessionCard */}
        <div
          className="absolute left-0 right-0 top-0 h-px opacity-40"
          style={{
            background: accentColor
              ? `linear-gradient(to right, transparent, ${accentColor}, transparent)`
              : 'linear-gradient(to right, transparent, rgba(90,86,96,0.4), transparent)',
          }}
        />

        {/* Header: mono label */}
        <div className="mb-2 flex items-center justify-between">
          <div
            className="font-mono text-[10px] uppercase tracking-[2px]"
            style={{
              color: isActiveAndCompleted
                ? '#6BCF8E'
                : isActive
                  ? '#E8A44A'
                  : '#5A5660',
            }}
          >
            {isCompleted ? 'Completed' : isActive ? 'Now Playing' : 'Lesson'}
          </div>
          {/* Status icon */}
          <div className="shrink-0">
            {isCompleted ? (
              <CheckCircle2 className="size-4 text-emerald-400" />
            ) : isActive ? (
              <Play className="size-4 text-[#E8A44A] fill-[#E8A44A]" />
            ) : (
              <Play className="size-4 text-[#5A5660] opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>

        {/* Title — serif like SessionCard */}
        <h4
          className={cn(
            'font-serif text-[17px] leading-snug transition-colors',
            isActiveAndCompleted
              ? 'text-emerald-400'
              : isActive
                ? 'text-[#E8E4DD]'
                : 'text-[#E8E4DD] group-hover:text-white',
          )}
        >
          {displayTitle}
        </h4>

        {/* Difficulty tag — styled like SessionCard skill tags */}
        {diffColors && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span
              className="rounded-full px-2.5 py-[3px] font-mono text-[10px] uppercase tracking-[0.5px]"
              style={{
                color: diffColors.base,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: diffColors.glow,
                background: `${diffColors.base}08`,
              }}
            >
              {tutorial.difficulty}
            </span>
          </div>
        )}

        {/* Thin progress bar — replaces the per-block dot indicators. Shows
            completedBlocks / totalBlocks as a single horizontal fill. Emerald
            when fully complete, gold when in progress, dim when untouched.
            Only rendered when the tutorial has a known block count; legacy
            tutorials without blocks skip this. */}
        {totalBlocks > 0 && (
          <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPercent}%`,
                background: isCompleted
                  ? '#6BCF8E'
                  : isActive
                    ? '#E8A44A'
                    : 'rgba(232,164,74,0.5)',
              }}
              aria-label={`${progressPercent}% complete`}
            />
          </div>
        )}
      </button>
    </div>
  );
}

// ─── Folder Section with Journey Tree ───────────────────────────────
function JourneyFolder({
  title,
  tutorials,
  isLocked,
  isOpen,
  onOpenChange,
  defaultOpen,
}: {
  title: string;
  tutorials: TutorialItem[];
  isLocked?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}) {
  const pathname = useInternalPathname();
  const { navigateWithTransition } = useViewTransitionRouter();

  // The connector-line positioning useEffect (and its containerRef) was
  // removed when the per-card ProgressPane went away. Connectors visually
  // joined the dot panes; without panes there's nothing to connect.

  const handleTutorialClick = useCallback(
    (slug: string) => {
      // Room-scoped: opened from the College room → /college/<slug> (middleware rewrites
      // it to the same internal /app/tutorials/<slug> page).
      navigateWithTransition(`/college/${slug}`);
    },
    [navigateWithTransition],
  );

  const completedCount = tutorials.filter((t) => t.isComplete).length;
  const totalCount = tutorials.length;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={onOpenChange}
      defaultOpen={defaultOpen}
    >
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-all duration-200',
            isOpen
              ? 'bg-white/[0.04] text-[#E8E4DD]'
              : 'text-[#8A8690] hover:bg-white/[0.03] hover:text-[#E8E4DD]',
          )}
        >
          <Library
            className={cn(
              'size-4 shrink-0 transition-colors',
              isOpen ? 'text-[#E8A44A]' : 'text-[#5A5660]',
            )}
          />
          <span className="flex-1 truncate text-left font-serif">{title}</span>

          {/* Progress counter */}
          {!isLocked && totalCount > 0 && (
            <span className="font-mono text-[10px] text-[#5A5660] tabular-nums">
              {completedCount}/{totalCount}
            </span>
          )}

          {isLocked && <Lock className="size-3.5 shrink-0 text-[#5A5660]" />}
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-[#5A5660] transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 pl-0.5">
          {isLocked ? (
            <div className="flex items-center gap-2 px-2 py-3 text-xs text-[#5A5660]">
              <Lock className="size-3" />
              <span>Upgrade to unlock</span>
            </div>
          ) : (
            <div className="space-y-3">
              {tutorials.map((tutorial, index) => {
                const isActive = pathname === `/app/tutorials/${tutorial.slug}`;
                return (
                  <TutorialCard
                    key={tutorial.slug}
                    tutorial={tutorial}
                    isActive={isActive}
                    index={index}
                    onClick={() => handleTutorialClick(tutorial.slug)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main BassmentJourneyView ───────────────────────────────────────
interface BassmentJourneyViewProps {
  folderState?: FolderOpenState;
}

export function BassmentJourneyView({ folderState }: BassmentJourneyViewProps) {
  const { folders, tutorialsByFolder, isLoading } = useTutorialsByFolder();

  if (isLoading) {
    return (
      <div className="px-3 py-3 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 rounded-full shrink-0" />
            <Skeleton className="h-24 flex-1 rounded-[14px]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-2 py-2 space-y-1">
      {folders.map((folder) => (
        <JourneyFolder
          key={folder.id}
          title={folder.title}
          tutorials={tutorialsByFolder[folder.id] || []}
          isOpen={folderState?.isFolderOpen(folder.id)}
          onOpenChange={(open) => {
            if (open !== folderState?.isFolderOpen(folder.id)) {
              folderState?.toggleFolder(folder.id);
            }
          }}
          defaultOpen={folder.isFree}
          isLocked={folder.isLocked}
        />
      ))}
    </div>
  );
}
