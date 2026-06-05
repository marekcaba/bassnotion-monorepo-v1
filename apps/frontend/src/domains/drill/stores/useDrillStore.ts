'use client';

/**
 * Drill session store — local (optimistic) drill state + the anonymous-conquer
 * hand-off.
 *
 * Durable progress lives in `block_completions` (per-user, server). This store
 * holds: the in-session conquered map (instant UI), and a `pendingCompletion`
 * captured when an ANONYMOUS user finishes a brick — replayed into the durable
 * record after signup (see useConquerReplay).
 *
 * Persisted to localStorage so the pending completion survives the account gate.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type {
  MasteryTier,
  DrillCompletionResult,
  DrillCriterionType,
} from '@bassnotion/contracts';

/**
 * A brick completion captured before the user had an account, awaiting replay.
 * Carries the full result shape so any criterion outcome (conquered / completed
 * / released) persists correctly after signup, not just bronze conquers.
 */
export interface PendingCompletion {
  /** Tutorial slug the block lives in (the progress key, with blockId). */
  tutorialSlug: string;
  /** The block id. */
  blockId: string;
  /** How the brick ended. */
  result: DrillCompletionResult;
  /** The criterion that drove it (time/loops/conquer/manual). */
  criterion?: DrillCriterionType;
  /** Tier earned on a conquer (null for completed/released). */
  achievedTier?: MasteryTier | null;
  /** ISO timestamp captured at completion time. */
  at: string;
}

interface DrillState {
  /** Block ids conquered/completed THIS session (optimistic; the durable
   *  record is block_completions). Lets the UI show the done state instantly. */
  conquered: Record<string, MasteryTier | 'done'>;
  /** A completion captured before the user had an account, awaiting replay. */
  pendingCompletion: PendingCompletion | null;

  /** Mark a brick done in-session (optimistic). */
  markConquered: (blockId: string, tier: MasteryTier | 'done') => void;
  /** Stash a completion for replay after signup. */
  setPendingCompletion: (pending: PendingCompletion) => void;
  clearPendingCompletion: () => void;
}

export const useDrillStore = create<DrillState>()(
  persist(
    (set) => ({
      conquered: {},
      pendingCompletion: null,

      markConquered: (blockId, tier) =>
        set((s) => ({ conquered: { ...s.conquered, [blockId]: tier } })),

      setPendingCompletion: (pending) => set({ pendingCompletion: pending }),
      clearPendingCompletion: () => set({ pendingCompletion: null }),
    }),
    {
      name: 'drill-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        conquered: state.conquered,
        pendingCompletion: state.pendingCompletion,
      }),
    },
  ),
);

/** Selector hook (useShallow) — the house style for read-from-many stores. */
export function useDrill() {
  return useDrillStore(
    useShallow((s) => ({
      conquered: s.conquered,
      pendingCompletion: s.pendingCompletion,
      markConquered: s.markConquered,
      setPendingCompletion: s.setPendingCompletion,
      clearPendingCompletion: s.clearPendingCompletion,
    })),
  );
}
