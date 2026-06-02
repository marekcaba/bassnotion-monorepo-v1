'use client';

/**
 * Drill session store — the collect-and-conquer outcome layer (Phase 1).
 *
 * Phase 1 scope: a single Bronze conquer per groove, gated on a PROXY (clean
 * play-throughs at the groove's default tempo — there's no Bridge/scoring yet).
 * Tiers above Bronze, streaks, and the groove path are Phase 2.
 *
 * Persisted to localStorage so an ANONYMOUS visitor's conquer survives the
 * account gate: when they sign up, the `pendingConquer` is replayed into the
 * real progress record (block_completions) and cleared. Authenticated users
 * write straight through and never populate `pendingConquer`.
 *
 * Store conventions follow MetronomeState.ts (persist + createJSONStorage +
 * partialize) and use-auth.ts (a useShallow selector hook).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

/** The proxy required to reach Bronze: N clean play-throughs at default tempo. */
export const BRONZE_CLEAN_PASSES = 2;

export type MasteryTier = 'bronze'; // Phase 2: | 'silver' | 'gold'

/**
 * A conquer record awaiting persistence — set when an anonymous user conquers
 * and the account gate fires. Replayed through useCompleteBlock after signup.
 */
export interface PendingConquer {
  /** Tutorial slug the groove block lives in (the progress key, with blockId). */
  tutorialSlug: string;
  /** The groove-card block id. */
  blockId: string;
  tier: MasteryTier;
  /** How the conquer was earned (the proxy used — swaps for a real score later). */
  proxy: 'clean_passes';
  /** ISO timestamp captured at conquer time. */
  at: string;
}

interface DrillState {
  /** Per-groove count of clean play-throughs at default tempo (the proxy).
   *  Keyed by blockId. Cleared on conquer. */
  cleanPasses: Record<string, number>;
  /** Block ids conquered THIS session (optimistic; the durable record is
   *  block_completions). Lets the UI show the conquered state immediately. */
  conquered: Record<string, MasteryTier>;
  /** A conquer captured before the user had an account, awaiting replay. */
  pendingConquer: PendingConquer | null;

  /** Record one clean pass for a groove; returns the new count. */
  recordCleanPass: (blockId: string) => number;
  /** Has this groove reached the Bronze proxy threshold? */
  isConquerable: (blockId: string) => boolean;
  /** Mark a groove conquered in-session (optimistic). */
  markConquered: (blockId: string, tier: MasteryTier) => void;
  /** Stash a conquer for replay after signup. */
  setPendingConquer: (pending: PendingConquer) => void;
  clearPendingConquer: () => void;
  /** Reset a groove's proxy progress (e.g. release-valve step-down retry). */
  resetGroove: (blockId: string) => void;
}

export const useDrillStore = create<DrillState>()(
  persist(
    (set, get) => ({
      cleanPasses: {},
      conquered: {},
      pendingConquer: null,

      recordCleanPass: (blockId) => {
        const next = (get().cleanPasses[blockId] ?? 0) + 1;
        set((s) => ({ cleanPasses: { ...s.cleanPasses, [blockId]: next } }));
        return next;
      },

      isConquerable: (blockId) =>
        (get().cleanPasses[blockId] ?? 0) >= BRONZE_CLEAN_PASSES,

      markConquered: (blockId, tier) =>
        set((s) => ({ conquered: { ...s.conquered, [blockId]: tier } })),

      setPendingConquer: (pending) => set({ pendingConquer: pending }),
      clearPendingConquer: () => set({ pendingConquer: null }),

      resetGroove: (blockId) =>
        set((s) => {
          const cleanPasses = { ...s.cleanPasses };
          delete cleanPasses[blockId];
          return { cleanPasses };
        }),
    }),
    {
      name: 'drill-session',
      storage: createJSONStorage(() => localStorage),
      // Persist only what must survive a reload / the account gate. The
      // in-session `conquered` map is optimistic UI and can rehydrate from
      // the server progress record, so it's fine to persist too (cheap).
      partialize: (state) => ({
        cleanPasses: state.cleanPasses,
        conquered: state.conquered,
        pendingConquer: state.pendingConquer,
      }),
    },
  ),
);

/** Selector hook (useShallow) — the house style for read-from-many stores. */
export function useDrill() {
  return useDrillStore(
    useShallow((s) => ({
      pendingConquer: s.pendingConquer,
      recordCleanPass: s.recordCleanPass,
      isConquerable: s.isConquerable,
      markConquered: s.markConquered,
      setPendingConquer: s.setPendingConquer,
      clearPendingConquer: s.clearPendingConquer,
      resetGroove: s.resetGroove,
    })),
  );
}
