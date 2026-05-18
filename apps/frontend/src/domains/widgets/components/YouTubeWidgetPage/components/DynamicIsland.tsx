'use client';

import React, { useMemo, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { safeString, getExerciseId } from '../utils';
import { LOCKED_DIFFICULTIES, REQUIRED_COMPLETIONS } from '../constants';
import type { ActName } from '../hooks/useCurrentAct';
import type { AnyBlock, BlockProgress } from '@bassnotion/contracts';
import type { PracticeCompletions } from '@/domains/widgets/hooks/usePracticeCompletions';

// Legacy hardcoded acts (used when blocks are not available)
const ACTS: { name: ActName; label: string }[] = [
  { name: 'understand', label: 'Understand' },
  { name: 'practice', label: 'Practice' },
  { name: 'apply', label: 'Apply' },
];

interface DynamicIslandProps {
  // Block-based mode
  blocks?: AnyBlock[];
  currentBlockId?: string | null;
  onBlockSelect?: (blockId: string) => void;
  blockProgress?: Record<string, BlockProgress>;
  // Legacy act-based mode
  currentAct?: ActName;
  onActSelect?: (act: ActName) => void;
  // Shared
  exercises?: any[];
  practiceCompletions?: PracticeCompletions;
  selectedExercise?: any;
}

export const DynamicIsland = React.memo(function DynamicIsland({
  blocks,
  currentBlockId,
  onBlockSelect,
  blockProgress = {},
  currentAct,
  onActSelect,
  exercises = [],
  practiceCompletions = {},
}: DynamicIslandProps) {
  const progress = useMemo(() => {
    const filtered = exercises.filter((ex) => ex?.id && ex?.title);
    const unlocked = filtered.filter(
      (ex) =>
        !LOCKED_DIFFICULTIES.includes(safeString(ex.difficulty).toLowerCase()),
    );

    const exerciseStatuses = unlocked.map((ex) => {
      const exId = getExerciseId(ex);
      return (practiceCompletions[exId]?.count || 0) >= REQUIRED_COMPLETIONS;
    });

    const completedCount = exerciseStatuses.filter(Boolean).length;
    const totalUnlocked = unlocked.length;

    return { completedCount, totalUnlocked, exerciseStatuses };
  }, [exercises, practiceCompletions]);

  const handleActClick = useCallback(
    (act: ActName) => {
      onActSelect?.(act);
    },
    [onActSelect],
  );

  const handleBlockClick = useCallback(
    (blockId: string) => {
      onBlockSelect?.(blockId);
    },
    [onBlockSelect],
  );

  // Block-based rendering
  const allBlocks = blocks ?? [];

  const islandBlocks = useMemo(
    () => allBlocks.filter((b) => b.showInIsland !== false),
    [allBlocks],
  );

  // Compute unlock status from the FULL block list (including hidden blocks).
  // A block is unlocked if it's the first, or all previous blocks are completed.
  const blockUnlockMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (let i = 0; i < allBlocks.length; i++) {
      if (i === 0) {
        map[allBlocks[i].id] = true;
      } else {
        map[allBlocks[i].id] = allBlocks
          .slice(0, i)
          .every((b) => blockProgress[b.id]?.completed);
      }
    }
    return map;
  }, [allBlocks, blockProgress]);

  if (islandBlocks.length > 0) {
    return (
      <div className="sticky top-0 flex justify-center pointer-events-none z-[60]">
        <div className="pointer-events-auto inline-flex items-center gap-1 px-1.5 py-1.5 rounded-b-2xl bg-black/80 backdrop-blur-xl border border-t-0 border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
          {islandBlocks.map((block) => {
            const isActive = currentBlockId === block.id;
            const isExerciseBlock = block.type === 'exercise';
            const isBlockCompleted = blockProgress[block.id]?.completed;
            const isUnlocked = blockUnlockMap[block.id] ?? false;

            return (
              <button
                key={block.id}
                onClick={() => isUnlocked && handleBlockClick(block.id)}
                disabled={!isUnlocked}
                className={`
                  relative px-3.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider
                  transition-all duration-200
                  ${
                    !isUnlocked
                      ? 'text-white/20 cursor-not-allowed'
                      : isActive
                        ? 'bg-white/15 text-white shadow-[0_0_8px_rgba(255,255,255,0.08)] cursor-pointer'
                        : isBlockCompleted
                          ? 'text-emerald-400/60 hover:text-emerald-400/80 hover:bg-white/5 cursor-pointer'
                          : 'text-white/40 hover:text-white/60 hover:bg-white/5 cursor-pointer'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  {!isUnlocked && <Lock className="w-2.5 h-2.5" />}
                  {block.title}

                  {/* Exercise block progress dots when active */}
                  {isExerciseBlock &&
                    isActive &&
                    progress.totalUnlocked > 0 && (
                      <>
                        <span className="w-px h-2.5 bg-white/15" />
                        <span className="flex items-center gap-1">
                          {progress.exerciseStatuses.map((isCompleted, i) => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                                isCompleted
                                  ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]'
                                  : 'bg-white/20'
                              }`}
                            />
                          ))}
                        </span>
                        <span className="text-[10px] font-medium text-white/40 tabular-nums normal-case">
                          {progress.completedCount}/{progress.totalUnlocked}
                        </span>
                      </>
                    )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Legacy act-based rendering
  return (
    <div className="sticky top-0 flex justify-center pointer-events-none z-[60]">
      <div className="pointer-events-auto inline-flex items-center gap-1 px-1.5 py-1.5 rounded-b-2xl bg-black/80 backdrop-blur-xl border border-t-0 border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
        {ACTS.map((act) => {
          const isActive = currentAct === act.name;
          const isPractice = act.name === 'practice';

          return (
            <button
              key={act.name}
              onClick={() => handleActClick(act.name)}
              className={`
                relative px-3.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider
                transition-all duration-200 cursor-pointer
                ${
                  isActive
                    ? 'bg-white/15 text-white shadow-[0_0_8px_rgba(255,255,255,0.08)]'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                }
              `}
            >
              <span className="flex items-center gap-2">
                {act.label}

                {isPractice && isActive && progress.totalUnlocked > 0 && (
                  <>
                    <span className="w-px h-2.5 bg-white/15" />
                    <span className="flex items-center gap-1">
                      {progress.exerciseStatuses.map((isCompleted, i) => (
                        <span
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                            isCompleted
                              ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]'
                              : 'bg-white/20'
                          }`}
                        />
                      ))}
                    </span>
                    <span className="text-[10px] font-medium text-white/40 tabular-nums normal-case">
                      {progress.completedCount}/{progress.totalUnlocked}
                    </span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
