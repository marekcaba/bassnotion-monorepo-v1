import { useState, useEffect, useCallback, useRef } from 'react';
import { REQUIRED_COMPLETIONS } from '../components/YouTubeWidgetPage/constants';
import { supabase } from '@/infrastructure/supabase/client';

const STORAGE_KEY_PREFIX = 'bassnotion-practice-';
const SERVER_SYNC_DEBOUNCE_MS = 500;

/** Progress data tracked per exercise */
export interface ExerciseProgress {
  count: number;
  lastTempoBpm?: number;
}

/** Map of exerciseId → progress */
export type PracticeCompletions = Record<string, ExerciseProgress>;

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

/** Read from localStorage with auto-migration from old `number` format */
function readLocalStorage(tutorialId: string): PracticeCompletions {
  const key = `${STORAGE_KEY_PREFIX}${tutorialId}`;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return {};

    const parsed = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return {};

    // Migrate old format: { "exId": 3 } → { "exId": { count: 3 } }
    const result: PracticeCompletions = {};
    for (const [exId, value] of Object.entries(parsed)) {
      if (typeof value === 'number') {
        result[exId] = { count: value };
      } else if (typeof value === 'object' && value !== null && 'count' in value) {
        result[exId] = value as ExerciseProgress;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function writeLocalStorage(tutorialId: string, data: PracticeCompletions): void {
  const key = `${STORAGE_KEY_PREFIX}${tutorialId}`;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable
  }
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function getUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function fetchServerProgress(
  userId: string,
  tutorialId: string,
): Promise<PracticeCompletions | null> {
  try {
    const { data, error } = await supabase
      .from('practice_progress')
      .select('exercise_id, completion_count, last_tempo_bpm')
      .eq('user_id', userId)
      .eq('tutorial_id', tutorialId);

    if (error || !data) return null;

    const result: PracticeCompletions = {};
    for (const row of data) {
      result[row.exercise_id] = {
        count: row.completion_count ?? 0,
        lastTempoBpm: row.last_tempo_bpm ?? undefined,
      };
    }
    return result;
  } catch {
    return null;
  }
}

async function upsertServerProgress(
  userId: string,
  tutorialId: string,
  exerciseId: string,
  progress: ExerciseProgress,
): Promise<void> {
  try {
    await supabase.from('practice_progress').upsert(
      {
        user_id: userId,
        tutorial_id: tutorialId,
        exercise_id: exerciseId,
        completion_count: progress.count,
        last_tempo_bpm: progress.lastTempoBpm ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,tutorial_id,exercise_id' },
    );
  } catch {
    // Server sync failed — localStorage still has the data
  }
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

function mergeProgress(
  local: PracticeCompletions,
  server: PracticeCompletions,
): PracticeCompletions {
  const allKeys = new Set([...Object.keys(local), ...Object.keys(server)]);
  const merged: PracticeCompletions = {};

  for (const exId of allKeys) {
    const l = local[exId];
    const s = server[exId];

    if (l && s) {
      merged[exId] = {
        count: Math.max(l.count, s.count),
        // Prefer server tempo (more likely up-to-date across devices)
        lastTempoBpm: s.lastTempoBpm ?? l.lastTempoBpm,
      };
    } else {
      merged[exId] = l ?? s;
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook to manage practice progress with localStorage + Supabase hybrid persistence.
 *
 * - State is initialized as `{}` to avoid SSR hydration mismatch,
 *   then populated from localStorage in a client-side useEffect.
 * - If authenticated, background-fetches from Supabase and merges.
 * - Writes are localStorage-first (instant), with debounced server sync.
 */
export function usePracticeCompletions(tutorialId?: string) {
  const [practiceCompletions, setPracticeCompletions] = useState<PracticeCompletions>({});
  const localWriteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverSyncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Read from localStorage + fetch from server on mount / tutorialId change
  useEffect(() => {
    if (!tutorialId) return;
    let cancelled = false;

    // 1. Instant: read localStorage (handles old format migration)
    const local = readLocalStorage(tutorialId);
    if (Object.keys(local).length > 0) {
      setPracticeCompletions(local);
      // Write back migrated format
      writeLocalStorage(tutorialId, local);
    }

    // 2. Background: fetch from Supabase + merge
    (async () => {
      const uid = await getUserId();
      if (cancelled) return;
      userIdRef.current = uid;
      if (!uid) return; // not logged in — localStorage only

      const server = await fetchServerProgress(uid, tutorialId);
      if (cancelled || !server) return;

      const merged = mergeProgress(local, server);
      setPracticeCompletions(merged);
      writeLocalStorage(tutorialId, merged);
    })();

    return () => { cancelled = true; };
  }, [tutorialId]);

  // Debounced write to localStorage on state change
  useEffect(() => {
    if (!tutorialId) return;
    if (Object.keys(practiceCompletions).length === 0) return;

    if (localWriteDebounceRef.current) {
      clearTimeout(localWriteDebounceRef.current);
    }

    localWriteDebounceRef.current = setTimeout(() => {
      writeLocalStorage(tutorialId, practiceCompletions);
    }, 100);

    return () => {
      if (localWriteDebounceRef.current) {
        clearTimeout(localWriteDebounceRef.current);
      }
    };
  }, [practiceCompletions, tutorialId]);

  // Debounced server sync helper
  const scheduleServerSync = useCallback(
    (exerciseId: string, progress: ExerciseProgress) => {
      if (!tutorialId) return;

      if (serverSyncDebounceRef.current) {
        clearTimeout(serverSyncDebounceRef.current);
      }

      serverSyncDebounceRef.current = setTimeout(async () => {
        const uid = userIdRef.current ?? await getUserId();
        if (!uid) return;
        userIdRef.current = uid;
        await upsertServerProgress(uid, tutorialId, exerciseId, progress);
      }, SERVER_SYNC_DEBOUNCE_MS);
    },
    [tutorialId],
  );

  // Cleanup server sync debounce on unmount
  useEffect(() => {
    return () => {
      if (serverSyncDebounceRef.current) {
        clearTimeout(serverSyncDebounceRef.current);
      }
    };
  }, []);

  const incrementCompletion = useCallback(
    (exerciseId: string) => {
      setPracticeCompletions((prev) => {
        const current = prev[exerciseId] || { count: 0 };
        if (current.count >= REQUIRED_COMPLETIONS) return prev;
        const updated = { ...current, count: current.count + 1 };
        scheduleServerSync(exerciseId, updated);
        return { ...prev, [exerciseId]: updated };
      });
    },
    [scheduleServerSync],
  );

  const updateTempo = useCallback(
    (exerciseId: string, bpm: number) => {
      setPracticeCompletions((prev) => {
        const current = prev[exerciseId] || { count: 0 };
        if (current.lastTempoBpm === bpm) return prev;
        const updated = { ...current, lastTempoBpm: bpm };
        scheduleServerSync(exerciseId, updated);
        return { ...prev, [exerciseId]: updated };
      });
    },
    [scheduleServerSync],
  );

  return { practiceCompletions, incrementCompletion, updateTempo };
}
