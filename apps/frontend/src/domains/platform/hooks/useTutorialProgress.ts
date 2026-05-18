'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/infrastructure/supabase/client';

/**
 * Storage key prefix for tutorial progress (three-stage tracking)
 */
const STORAGE_KEY_PREFIX = 'bassnotion-tutorial-progress-';

/**
 * Required exercise completions for practice stage to be considered complete
 */
const REQUIRED_COMPLETIONS = 4;

/**
 * Debounce time for server sync (ms)
 */
const SERVER_SYNC_DEBOUNCE_MS = 500;

/**
 * Three-stage tutorial progress (Understand → Practice → Apply)
 */
export interface TutorialProgress {
  /** Stage 1: User watched/completed the understand video */
  understood: boolean;
  /** Stage 2: User completed practice exercises */
  practiced: boolean;
  /** Stage 3: User completed the apply/groove stage */
  applied: boolean;
}

/**
 * Stored progress data per tutorial
 */
interface StoredProgress {
  understood: boolean;
  understoodAt?: string;
  applied: boolean;
  appliedAt?: string;
}

/**
 * Map of tutorialId → TutorialProgress
 */
export type TutorialProgressMap = Record<string, TutorialProgress>;

/**
 * Reads tutorial progress from localStorage
 */
function readLocalProgress(tutorialId: string): StoredProgress | null {
  const key = `${STORAGE_KEY_PREFIX}${tutorialId}`;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Writes tutorial progress to localStorage
 */
function writeLocalProgress(
  tutorialId: string,
  progress: StoredProgress,
): void {
  const key = `${STORAGE_KEY_PREFIX}${tutorialId}`;
  try {
    localStorage.setItem(key, JSON.stringify(progress));
  } catch {
    // Silently fail if localStorage is full
  }
}

/**
 * Reads practice completions from localStorage (from usePracticeCompletions)
 */
function readPracticeCompletions(
  tutorialId: string,
): Record<string, { count: number }> {
  const key = `bassnotion-practice-${tutorialId}`;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return {};

    const result: Record<string, { count: number }> = {};
    for (const [exId, value] of Object.entries(parsed)) {
      if (typeof value === 'number') {
        result[exId] = { count: value };
      } else if (
        typeof value === 'object' &&
        value !== null &&
        'count' in value
      ) {
        result[exId] = value as { count: number };
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Checks if practice stage is complete based on exercise completions
 */
function isPracticeComplete(
  practiceCompletions: Record<string, { count: number }>,
  exerciseCount: number,
): boolean {
  if (exerciseCount <= 1) return false;

  const completedExercises = Object.values(practiceCompletions).filter(
    (p) => p.count >= REQUIRED_COMPLETIONS,
  ).length;

  // Tutorial is complete if all exercises except the groove (locked one) are done
  const requiredCompletions = exerciseCount - 1;

  return completedExercises >= requiredCompletions && requiredCompletions > 0;
}

/**
 * Fetches tutorial progress from Supabase for multiple tutorials
 */
async function fetchServerProgress(
  userId: string,
  tutorialIds: string[],
): Promise<Record<string, StoredProgress>> {
  if (tutorialIds.length === 0) return {};

  const { data, error } = await supabase
    .from('tutorial_progress')
    .select('tutorial_id, understood, understood_at, applied, applied_at')
    .eq('user_id', userId)
    .in('tutorial_id', tutorialIds);

  if (error || !data) return {};

  const result: Record<string, StoredProgress> = {};
  for (const row of data) {
    result[row.tutorial_id] = {
      understood: row.understood ?? false,
      understoodAt: row.understood_at ?? undefined,
      applied: row.applied ?? false,
      appliedAt: row.applied_at ?? undefined,
    };
  }
  return result;
}

/**
 * Upserts tutorial progress to Supabase
 */
async function upsertServerProgress(
  userId: string,
  tutorialId: string,
  progress: StoredProgress,
): Promise<void> {
  await supabase.from('tutorial_progress').upsert(
    {
      user_id: userId,
      tutorial_id: tutorialId,
      understood: progress.understood,
      understood_at: progress.understoodAt ?? null,
      applied: progress.applied,
      applied_at: progress.appliedAt ?? null,
    },
    { onConflict: 'user_id,tutorial_id' },
  );
}

/**
 * Merges local and server progress, taking the "most complete" state
 * If either source says a stage is complete, it's complete
 */
function mergeProgress(
  local: StoredProgress | null,
  server: StoredProgress | null,
): StoredProgress {
  return {
    understood: (local?.understood ?? false) || (server?.understood ?? false),
    // Prefer server timestamp if available, fallback to local
    understoodAt: server?.understoodAt ?? local?.understoodAt,
    applied: (local?.applied ?? false) || (server?.applied ?? false),
    appliedAt: server?.appliedAt ?? local?.appliedAt,
  };
}

interface TutorialInfo {
  id: string;
  exerciseCount: number;
}

/**
 * Hook to get three-stage progress for multiple tutorials.
 *
 * Sync Strategy:
 * 1. Instant UI: Read from localStorage immediately
 * 2. Background fetch: Fetch from Supabase in parallel (non-blocking)
 * 3. Merge: Take "most complete" state (if either says true, it's true)
 * 4. Write-back: Update localStorage with merged result
 *
 * Listens for 'tutorial-progress-updated' events to stay in sync.
 *
 * Returns a map of tutorialId → TutorialProgress
 */
export function useTutorialProgress(
  tutorials: TutorialInfo[],
): TutorialProgressMap {
  const [progressMap, setProgressMap] = useState<TutorialProgressMap>({});

  // Function to recalculate progress from localStorage (instant)
  const recalculateProgress = useCallback(() => {
    if (tutorials.length === 0) return;

    const map: TutorialProgressMap = {};

    for (const tutorial of tutorials) {
      const storedProgress = readLocalProgress(tutorial.id);
      const practiceCompletions = readPracticeCompletions(tutorial.id);

      map[tutorial.id] = {
        understood: storedProgress?.understood ?? false,
        practiced: isPracticeComplete(
          practiceCompletions,
          tutorial.exerciseCount,
        ),
        applied: storedProgress?.applied ?? false,
      };
    }

    setProgressMap(map);
  }, [tutorials]);

  // Initial load from localStorage (instant)
  useEffect(() => {
    recalculateProgress();
  }, [recalculateProgress]);

  // Background Supabase sync
  useEffect(() => {
    if (tutorials.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const tutorialIds = tutorials.map((t) => t.id);
        const serverProgress = await fetchServerProgress(user.id, tutorialIds);

        if (cancelled) return;

        // Merge local + server, update state
        const mergedMap: TutorialProgressMap = {};
        for (const tutorial of tutorials) {
          const local = readLocalProgress(tutorial.id);
          const server = serverProgress[tutorial.id] ?? null;
          const merged = mergeProgress(local, server);

          // Write merged back to localStorage if there's progress
          if (merged.understood || merged.applied) {
            writeLocalProgress(tutorial.id, merged);
          }

          const practiceCompletions = readPracticeCompletions(tutorial.id);
          mergedMap[tutorial.id] = {
            understood: merged.understood,
            practiced: isPracticeComplete(
              practiceCompletions,
              tutorial.exerciseCount,
            ),
            applied: merged.applied,
          };
        }

        setProgressMap(mergedMap);
      } catch {
        // Keep localStorage-based results on error
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tutorials]);

  // Listen for progress update events
  useEffect(() => {
    const handleProgressUpdate = () => {
      recalculateProgress();
    };

    window.addEventListener('tutorial-progress-updated', handleProgressUpdate);
    return () => {
      window.removeEventListener(
        'tutorial-progress-updated',
        handleProgressUpdate,
      );
    };
  }, [recalculateProgress]);

  return progressMap;
}

/**
 * Hook to mark a specific stage as complete for a tutorial.
 * Returns functions to mark each stage complete.
 *
 * Write-through strategy:
 * 1. Write to localStorage immediately (instant UI)
 * 2. Sync to Supabase in background (debounced, 500ms)
 */
export function useTutorialProgressActions(tutorialId: string | undefined) {
  const serverSyncRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced sync to server
  const syncToServer = useCallback(
    async (progress: StoredProgress) => {
      if (!tutorialId) return;

      // Clear any pending sync
      if (serverSyncRef.current) {
        clearTimeout(serverSyncRef.current);
      }

      // Debounced server sync
      serverSyncRef.current = setTimeout(async () => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            await upsertServerProgress(user.id, tutorialId, progress);
          }
        } catch {
          // Silently fail - localStorage is source of truth
        }
      }, SERVER_SYNC_DEBOUNCE_MS);
    },
    [tutorialId],
  );

  const markUnderstood = useCallback(() => {
    if (!tutorialId) return;

    const existing = readLocalProgress(tutorialId) || {
      understood: false,
      applied: false,
    };

    const updated: StoredProgress = {
      ...existing,
      understood: true,
      understoodAt: new Date().toISOString(),
    };

    // Write to localStorage immediately
    writeLocalProgress(tutorialId, updated);

    // Sync to server (debounced)
    syncToServer(updated);

    // Dispatch custom event so other components can react
    window.dispatchEvent(
      new CustomEvent('tutorial-progress-updated', {
        detail: { tutorialId, stage: 'understood' },
      }),
    );
  }, [tutorialId, syncToServer]);

  const markApplied = useCallback(() => {
    if (!tutorialId) return;

    const existing = readLocalProgress(tutorialId) || {
      understood: false,
      applied: false,
    };

    const updated: StoredProgress = {
      ...existing,
      applied: true,
      appliedAt: new Date().toISOString(),
    };

    // Write to localStorage immediately
    writeLocalProgress(tutorialId, updated);

    // Sync to server (debounced)
    syncToServer(updated);

    // Dispatch custom event so other components can react
    window.dispatchEvent(
      new CustomEvent('tutorial-progress-updated', {
        detail: { tutorialId, stage: 'applied' },
      }),
    );
  }, [tutorialId, syncToServer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (serverSyncRef.current) {
        clearTimeout(serverSyncRef.current);
      }
    };
  }, []);

  return useMemo(
    () => ({
      markUnderstood,
      markApplied,
    }),
    [markUnderstood, markApplied],
  );
}

/**
 * Hook to get and update progress for a single tutorial.
 * Listens for progress update events to stay in sync.
 */
export function useSingleTutorialProgress(
  tutorialId: string | undefined,
  exerciseCount: number,
): TutorialProgress {
  const [progress, setProgress] = useState<TutorialProgress>({
    understood: false,
    practiced: false,
    applied: false,
  });

  // Load initial progress
  useEffect(() => {
    if (!tutorialId) return;

    const storedProgress = readLocalProgress(tutorialId);
    const practiceCompletions = readPracticeCompletions(tutorialId);

    setProgress({
      understood: storedProgress?.understood ?? false,
      practiced: isPracticeComplete(practiceCompletions, exerciseCount),
      applied: storedProgress?.applied ?? false,
    });
  }, [tutorialId, exerciseCount]);

  // Listen for progress updates
  useEffect(() => {
    if (!tutorialId) return;

    const handleProgressUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        tutorialId: string;
        stage: string;
      }>;
      if (customEvent.detail.tutorialId === tutorialId) {
        // Re-read progress from localStorage
        const storedProgress = readLocalProgress(tutorialId);
        const practiceCompletions = readPracticeCompletions(tutorialId);

        setProgress({
          understood: storedProgress?.understood ?? false,
          practiced: isPracticeComplete(practiceCompletions, exerciseCount),
          applied: storedProgress?.applied ?? false,
        });
      }
    };

    window.addEventListener('tutorial-progress-updated', handleProgressUpdate);
    return () => {
      window.removeEventListener(
        'tutorial-progress-updated',
        handleProgressUpdate,
      );
    };
  }, [tutorialId, exerciseCount]);

  return progress;
}
