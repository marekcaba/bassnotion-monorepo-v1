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

import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureAudioReady } from '@/domains/playback/services/ensureAudioReady';

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
  /** running → summary, EXPLICITLY (the last brick's "Complete the rep" click). Bypasses the
   *  completedThisAttempt replay guard — the guard only prevents an AUTOMATIC mount-time bounce;
   *  an explicit user click should always flip once every brick is complete, replay or not. */
  complete: () => void;
}

export function useDrillSession({
  isDrill,
  brickIds,
  completedIds,
}: UseDrillSessionArgs): UseDrillSessionResult {
  const [phase, setPhase] = useState<DrillPhase>('plan');

  // The set of bricks ALREADY completed when this attempt started (the carried-
  // in DB baseline). A daily rep is REPLAYABLE: completing it persists (streak
  // counted, idempotent per day), so on a second visit / "run it again" the
  // bricks are still completed in the DB. Without this baseline the running
  // phase would see allComplete=true immediately and bounce straight to the
  // summary — the loop. We only auto-advance to summary once a brick is
  // completed AFRESH this attempt (i.e. beyond the baseline), so a replay
  // requires actually playing through again. (Replaying is a DB no-op — that's
  // the intended "wanna repeat? go ahead, it doesn't change anything" feel.)
  const baselineRef = useRef<Set<string>>(new Set());

  // A fresh in-attempt completion = a brick completed now that was NOT already
  // done at start. Reaching summary needs every brick complete AND at least one
  // completed this attempt.
  const completedThisAttempt = brickIds.some(
    (id) => completedIds.has(id) && !baselineRef.current.has(id),
  );
  const allComplete =
    brickIds.length > 0 && brickIds.every((id) => completedIds.has(id));

  // Explicit "Complete the rep" intent (set by complete()). Once armed, the effect below flips to
  // summary as soon as allComplete is true — which may be a tick AFTER the click (the last brick's
  // completion has to propagate through the progress cache first). This makes the flip robust to
  // the async gap between marking the brick done and allComplete becoming true.
  const [completeIntent, setCompleteIntent] = useState(false);

  useEffect(() => {
    if (!isDrill || phase !== 'running' || !allComplete) return;
    // Flip on a fresh in-attempt completion (auto) OR an explicit Complete click (intent).
    if (completedThisAttempt || completeIntent) {
      setPhase('summary');
      setCompleteIntent(false);
    }
  }, [isDrill, phase, allComplete, completedThisAttempt, completeIntent]);

  // Entering the running phase snapshots the current completions as the
  // baseline for THIS attempt. Both the first run and every "run it again" go
  // through here, so a replay always starts from a clean baseline.
  const start = useCallback(() => {
    // On-demand safety net: guarantee the engine is warming/ready before the
    // 'running' phase mounts YouTubeWidgetPage (whose hooks read the audio
    // context). Idempotent + deduped — a no-op if the background warm-up already
    // ran. Fire-and-forget: the player's own CoreServicesGate covers the gap on
    // a cold/slow start. Don't block the phase flip.
    void ensureAudioReady();
    baselineRef.current = new Set(completedIds);
    setPhase('running');
  }, [completedIds]);
  const restart = useCallback(() => setPhase('plan'), []);

  // Explicit completion (the last brick's "Complete the rep" click). Arm the intent; the effect
  // above flips to summary once allComplete is true (immediately if already so, or a tick later
  // after the just-completed last brick propagates). Bypasses the completedThisAttempt guard —
  // that guard only stops an AUTOMATIC mount-time bounce, not a user's explicit request.
  const complete = useCallback(() => setCompleteIntent(true), []);

  return { phase, start, restart, complete };
}
