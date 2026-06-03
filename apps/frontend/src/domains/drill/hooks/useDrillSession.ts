'use client';

/**
 * useDrillSession — drives the session frame phase for a drill tutorial:
 *
 *   plan  ──(Start)──▶  running  ──(all bricks complete)──▶  summary
 *
 * The opening plan is a GATE: blocks render only after Start. The summary shows
 * once every drill brick in the tutorial is completed. Phase is per-visit (not
 * persisted) — leaving and returning re-opens the plan, which is the intended
 * "start a fresh session" feel.
 *
 * Completion is read from the server progress response (the player marks blocks
 * via useCompleteBlock, which updates the same cache), so this hook only needs
 * the brick ids + the completion map.
 */

import { useCallback, useEffect, useState } from 'react';

export type DrillPhase = 'plan' | 'running' | 'summary';

interface UseDrillSessionArgs {
  /** Whether this tutorial is a drill at all. When false the hook is inert. */
  isDrill: boolean;
  /** Ordered drill brick ids in this tutorial. */
  brickIds: string[];
  /** Set of completed block ids (from the progress response). */
  completedIds: Set<string>;
}

interface UseDrillSessionResult {
  phase: DrillPhase;
  /** plan → running (call from the plan screen's Start button). */
  start: () => void;
  /** summary → plan (call from the summary's "run it again"). */
  restart: () => void;
}

export function useDrillSession({
  isDrill,
  brickIds,
  completedIds,
}: UseDrillSessionArgs): UseDrillSessionResult {
  const [phase, setPhase] = useState<DrillPhase>('plan');

  const allComplete =
    brickIds.length > 0 && brickIds.every((id) => completedIds.has(id));

  // Auto-advance running → summary once every brick is complete. Guarded so it
  // only fires from the running phase (re-opening the plan after a restart
  // shouldn't immediately bounce to summary just because progress persists).
  useEffect(() => {
    if (!isDrill) return;
    if (phase === 'running' && allComplete) {
      setPhase('summary');
    }
  }, [isDrill, phase, allComplete]);

  const start = useCallback(() => setPhase('running'), []);
  const restart = useCallback(() => setPhase('plan'), []);

  return { phase, start, restart };
}
