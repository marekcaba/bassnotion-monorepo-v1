import { useState, useEffect, useCallback, useRef } from 'react';
import type { AnyBlock, BlockProgress } from '@bassnotion/contracts';
import { supabase } from '@/infrastructure/supabase/client';

const STORAGE_KEY_PREFIX = 'bassnotion-block-progress-';

interface UseBlockProgressParams {
  tutorialId: string | undefined;
  blocks: AnyBlock[];
  userId?: string | null;
}

interface UseBlockProgressResult {
  blockProgress: Record<string, BlockProgress>;
  markBlockComplete: (blockId: string, data?: Record<string, unknown>) => void;
  overallProgress: number;
  /** True once localStorage has been read (safe to use blockProgress for navigation decisions) */
  isHydrated: boolean;
}

/**
 * Manages per-block completion progress with localStorage-first persistence
 * and background Supabase sync.
 *
 * Follows the same hybrid persistence pattern as usePracticeCompletions:
 * - State initializes as `{}` to avoid SSR hydration mismatch
 * - localStorage is loaded in a client-side useEffect (instant)
 * - Supabase is fetched once in the background and merged
 * - Writes go to localStorage first, then sync to Supabase
 */
export function useBlockProgress({
  tutorialId,
  blocks,
  userId,
}: UseBlockProgressParams): UseBlockProgressResult {
  const [blockProgress, setBlockProgress] = useState<Record<string, BlockProgress>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const syncedRef = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (!tutorialId) return;

    const storageKey = `${STORAGE_KEY_PREFIX}${tutorialId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setBlockProgress(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors — localStorage is best-effort
    }
    setIsHydrated(true);
  }, [tutorialId]);

  // Sync from Supabase once when userId becomes available
  useEffect(() => {
    if (!tutorialId || !userId || syncedRef.current) return;

    const loadFromDb = async () => {
      try {
        const { data } = await supabase
          .from('tutorial_progress')
          .select('block_progress')
          .eq('user_id', userId)
          .eq('tutorial_id', tutorialId)
          .single();

        if (data?.block_progress && typeof data.block_progress === 'object') {
          const dbProgress = data.block_progress as Record<string, BlockProgress>;
          setBlockProgress((prev) => {
            // Merge: most complete wins (completed trumps not-completed)
            const merged = { ...prev };
            for (const [blockId, progress] of Object.entries(dbProgress)) {
              if (!merged[blockId]?.completed && progress.completed) {
                merged[blockId] = progress;
              }
            }
            return merged;
          });
        }
        syncedRef.current = true;
      } catch {
        // Ignore fetch errors — localStorage is primary
      }
    };

    loadFromDb();
  }, [tutorialId, userId]);

  const markBlockComplete = useCallback(
    (blockId: string, data?: Record<string, unknown>) => {
      if (!tutorialId) return;

      const progress: BlockProgress = {
        blockId,
        completed: true,
        completedAt: new Date().toISOString(),
        data,
      };

      setBlockProgress((prev) => {
        const updated = { ...prev, [blockId]: progress };

        // Persist to localStorage immediately
        const storageKey = `${STORAGE_KEY_PREFIX}${tutorialId}`;
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // Storage full — state still reflects the update
        }

        return updated;
      });

      // Notify sidebar and other listeners that block progress changed
      window.dispatchEvent(
        new CustomEvent('block-progress-updated', {
          detail: { tutorialId, blockId },
        }),
      );

      // Background sync to Supabase (fire-and-forget)
      if (userId) {
        supabase
          .from('tutorial_progress')
          .upsert(
            {
              user_id: userId,
              tutorial_id: tutorialId,
              block_progress: { [blockId]: progress },
              last_accessed_block_id: blockId,
            },
            { onConflict: 'user_id,tutorial_id' }
          )
          .then(() => {})
          .catch(() => {});
      }
    },
    [tutorialId, userId]
  );

  // Calculate overall progress as percentage of completed blocks
  const overallProgress =
    blocks.length > 0
      ? Math.round(
          (Object.values(blockProgress).filter((p) => p.completed).length /
            blocks.length) *
            100
        )
      : 0;

  return { blockProgress, markBlockComplete, overallProgress, isHydrated };
}
