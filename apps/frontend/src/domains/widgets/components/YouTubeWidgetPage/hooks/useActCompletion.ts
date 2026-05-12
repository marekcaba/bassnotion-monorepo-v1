import { useMemo } from 'react';
import { safeString, getExerciseId } from '../utils';
import { LOCKED_DIFFICULTIES, REQUIRED_COMPLETIONS } from '../constants';
import type { PracticeCompletions } from '@/domains/widgets/hooks/usePracticeCompletions';

interface UseActCompletionParams {
  exercises: any[];
  practiceCompletions: PracticeCompletions;
}

interface UseActCompletionResult {
  /** Whether all unlocked exercises are completed (4x each) */
  isComplete: boolean;
  /** Number of unlocked exercises that reached REQUIRED_COMPLETIONS */
  completedCount: number;
  /** Total number of unlocked exercises */
  totalUnlocked: number;
  /** The first locked exercise (the reward groove) */
  rewardExercise: any | null;
}

/**
 * Computes whether Act 2 (Practice) is fully complete —
 * i.e., all unlocked exercises have been practiced REQUIRED_COMPLETIONS times.
 */
export function useActCompletion({
  exercises,
  practiceCompletions,
}: UseActCompletionParams): UseActCompletionResult {
  return useMemo(() => {
    const filtered = exercises.filter((ex) => ex?.id && ex?.title);

    const unlocked = filtered.filter(
      (ex) => !LOCKED_DIFFICULTIES.includes(safeString(ex.difficulty).toLowerCase()),
    );

    const locked = filtered.filter((ex) =>
      LOCKED_DIFFICULTIES.includes(safeString(ex.difficulty).toLowerCase()),
    );

    const completedCount = unlocked.filter((ex) => {
      const exId = getExerciseId(ex);
      return (practiceCompletions[exId]?.count || 0) >= REQUIRED_COMPLETIONS;
    }).length;

    const totalUnlocked = unlocked.length;
    const isComplete = totalUnlocked > 0 && completedCount >= totalUnlocked;
    const rewardExercise = locked[0] || null;

    return { isComplete, completedCount, totalUnlocked, rewardExercise };
  }, [exercises, practiceCompletions]);
}
