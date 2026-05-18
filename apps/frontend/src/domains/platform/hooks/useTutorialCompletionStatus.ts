'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/infrastructure/supabase/client';

const STORAGE_KEY_PREFIX = 'bassnotion-practice-';
const REQUIRED_COMPLETIONS = 4;

/** Map of tutorialId → isComplete */
export type TutorialCompletionMap = Record<string, boolean>;

interface ExerciseProgress {
  count: number;
  lastTempoBpm?: number;
}

type PracticeCompletions = Record<string, ExerciseProgress>;

/**
 * Reads practice completions from localStorage for a tutorial
 */
function readLocalStorage(tutorialId: string): PracticeCompletions {
  const key = `${STORAGE_KEY_PREFIX}${tutorialId}`;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return {};

    const parsed = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return {};

    const result: PracticeCompletions = {};
    for (const [exId, value] of Object.entries(parsed)) {
      if (typeof value === 'number') {
        result[exId] = { count: value };
      } else if (
        typeof value === 'object' &&
        value !== null &&
        'count' in value
      ) {
        result[exId] = value as ExerciseProgress;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Determines if a tutorial is complete based on practice progress.
 *
 * A tutorial is considered complete when:
 * - There are exercises with completion data
 * - At least (exerciseCount - 1) exercises have count >= REQUIRED_COMPLETIONS
 *   (The -1 accounts for the locked "groove" exercise that gets unlocked upon completion)
 */
function isTutorialComplete(
  practiceCompletions: PracticeCompletions,
  exerciseCount: number,
): boolean {
  if (exerciseCount <= 1) return false;

  const completedExercises = Object.values(practiceCompletions).filter(
    (p) => p.count >= REQUIRED_COMPLETIONS,
  ).length;

  // Tutorial is complete if all exercises except the groove (locked one) are done
  // The groove is typically 1 exercise, so we need exerciseCount - 1 completions
  const requiredCompletions = exerciseCount - 1;

  return completedExercises >= requiredCompletions && requiredCompletions > 0;
}

interface TutorialInfo {
  id: string;
  exerciseCount: number;
}

/**
 * Hook to get completion status for multiple tutorials.
 *
 * Uses localStorage (primary) with background Supabase sync.
 * Returns a map of tutorialId → boolean indicating if the tutorial is complete.
 */
export function useTutorialCompletionStatus(
  tutorials: TutorialInfo[],
): TutorialCompletionMap {
  const [completionMap, setCompletionMap] = useState<TutorialCompletionMap>({});

  // Check localStorage on mount and when tutorials change
  useEffect(() => {
    if (tutorials.length === 0) return;

    const map: TutorialCompletionMap = {};

    for (const tutorial of tutorials) {
      const progress = readLocalStorage(tutorial.id);
      map[tutorial.id] = isTutorialComplete(progress, tutorial.exerciseCount);
    }

    setCompletionMap(map);

    // Background: fetch from Supabase and merge
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const tutorialIds = tutorials.map((t) => t.id);

        const { data, error } = await supabase
          .from('practice_progress')
          .select('tutorial_id, exercise_id, completion_count')
          .eq('user_id', user.id)
          .in('tutorial_id', tutorialIds);

        if (error || !data) return;

        // Group by tutorial_id
        const serverProgress: Record<string, PracticeCompletions> = {};
        for (const row of data) {
          if (!serverProgress[row.tutorial_id]) {
            serverProgress[row.tutorial_id] = {};
          }
          serverProgress[row.tutorial_id][row.exercise_id] = {
            count: row.completion_count ?? 0,
          };
        }

        // Merge with localStorage and recalculate
        const mergedMap: TutorialCompletionMap = {};
        for (const tutorial of tutorials) {
          const local = readLocalStorage(tutorial.id);
          const server = serverProgress[tutorial.id] || {};

          // Merge: take max count for each exercise
          const merged: PracticeCompletions = { ...local };
          for (const [exId, serverData] of Object.entries(server)) {
            if (!merged[exId] || serverData.count > merged[exId].count) {
              merged[exId] = serverData;
            }
          }

          mergedMap[tutorial.id] = isTutorialComplete(
            merged,
            tutorial.exerciseCount,
          );
        }

        setCompletionMap(mergedMap);
      } catch {
        // Keep localStorage-based results on error
      }
    })();
  }, [tutorials]);

  return completionMap;
}
