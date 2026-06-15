'use client';

/**
 * useDrillCriterion — measures a drill brick's completion criterion and reports
 * whether it's met + live progress (for the in-block target UI).
 *
 * It does NOT advance the session — it only measures. The brick component reads
 * `isMet` to enable the Next button.
 *
 *   - 'time'  : elapsed PLAYING seconds (groove brick) or wall-clock (task
 *               block, isPlaying always true). Accumulates only while playing;
 *               pausing freezes it. Excludes the count-in.
 *   - 'loops' : loop iterations, counted by detecting phase WRAP via the
 *               playback hook's getAudioPhase() (robust across pause + tempo
 *               change, unlike floor(elapsed/loopDuration)).
 *   - 'conquer' / 'manual' : not measured here — the brick's button drives them;
 *               this hook reports isMet=false / progress null for those.
 *
 * Post-#99 notes baked in: getAudioPhase() returns null when the worklet isn't
 * streaming (count-in / pre-resolve); loopStartAudioTime resets on pause and
 * re-anchors on tempo change — so we never derive from it directly.
 */

import { useEffect, useRef, useState } from 'react';
import type { DrillCompletionCriterion } from '@bassnotion/contracts';

interface CriterionPlaybackSignals {
  isPlaying: boolean;
  /** Loop read-head phase in [0,1), or null when not streaming. */
  getAudioPhase: () => number | null;
}

export interface CriterionProgress {
  /** Current measured value (seconds for time, loops for loops). */
  current: number;
  /** The target (minutes→seconds for time, count for loops). */
  target: number;
}

export interface UseDrillCriterionResult {
  /** True once the measured criterion is satisfied. */
  isMet: boolean;
  /** Live progress for the in-block UI, or null for non-measured criteria. */
  progress: CriterionProgress | null;
}

/**
 * Optional sink fired ONCE when a measured criterion transitions false→true.
 * This is the training-engine's CompletionSignalSource seam (spec §10 seam 1 /
 * §12): the hook stays a pure measurer, but lets the engine observe the moment
 * a time/loops criterion is met without the hook knowing anything about the
 * engine. Button-driven criteria (conquer/manual) emit at their button
 * handlers, not here. Non-invasive: existing 2-arg callers are unaffected.
 */
export type CriterionMetCallback = (progress: CriterionProgress) => void;

/** ~30fps poll — fine for a countdown / loop counter; cheap. */
const TICK_MS = 250;

export function useDrillCriterion(
  criterion: DrillCompletionCriterion | undefined,
  playback: CriterionPlaybackSignals,
  onMet?: CriterionMetCallback,
): UseDrillCriterionResult {
  const type = criterion?.type;
  const target = criterion?.target ?? 0;

  // Keep the latest getAudioPhase in a ref so the loop effect doesn't depend on
  // a callback identity that callers re-create each render (which would re-arm
  // the interval and reset the phase anchor every render → broken loop count).
  const getAudioPhaseRef = useRef(playback.getAudioPhase);
  getAudioPhaseRef.current = playback.getAudioPhase;

  // ── time: accumulate playing seconds ─────────────────────────────────────
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedRef = useRef(0); // source of truth (avoids stale-closure adds)
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (type !== 'time') return;
    const id = setInterval(() => {
      const now = Date.now();
      const prev = lastTickRef.current;
      lastTickRef.current = now;
      // Only accrue while playing (task blocks pass isPlaying=true to run
      // wall-clock). First tick after a (re)start has no prev delta.
      if (playback.isPlaying && prev != null) {
        elapsedRef.current += (now - prev) / 1000;
        setElapsedSec(elapsedRef.current);
      }
      if (!playback.isPlaying) {
        // Reset the delta anchor so paused time isn't counted on resume.
        lastTickRef.current = null;
      }
    }, TICK_MS);
    return () => clearInterval(id);
    // Re-arm when play-state flips so the anchor logic stays correct.
  }, [type, playback.isPlaying]);

  // ── loops: count phase wraps ─────────────────────────────────────────────
  const [loopCount, setLoopCount] = useState(0);
  const loopCountRef = useRef(0);
  const lastPhaseRef = useRef<number | null>(null);

  useEffect(() => {
    if (type !== 'loops') return;
    const id = setInterval(() => {
      if (!playback.isPlaying) {
        lastPhaseRef.current = null;
        return;
      }
      const phase = getAudioPhaseRef.current();
      if (phase == null) {
        lastPhaseRef.current = null;
        return;
      }
      const prev = lastPhaseRef.current;
      // A wrap is when phase decreases between samples (e.g. 0.95 → 0.05).
      if (prev != null && phase < prev - 0.5) {
        loopCountRef.current += 1;
        setLoopCount(loopCountRef.current);
      }
      lastPhaseRef.current = phase;
    }, TICK_MS);
    return () => clearInterval(id);
  }, [type, playback.isPlaying]);

  // Compute the measured result (single source of truth for the return + the
  // onMet transition effect below).
  let result: UseDrillCriterionResult;
  if (type === 'time') {
    const targetSec = target * 60;
    result = {
      isMet: targetSec > 0 && elapsedSec >= targetSec,
      progress: { current: elapsedSec, target: targetSec },
    };
  } else if (type === 'loops') {
    result = {
      isMet: target > 0 && loopCount >= target,
      progress: { current: loopCount, target },
    };
  } else {
    // conquer / manual / undefined — driven by the brick's button, not measured.
    result = { isMet: false, progress: null };
  }

  // Fire onMet ONCE on the false→true edge. Both the callback and the latest
  // progress live in refs so the effect depends ONLY on the boolean edge (the
  // progress object is a fresh literal each render — depending on it would re-run
  // the effect every tick for no reason).
  const onMetRef = useRef(onMet);
  onMetRef.current = onMet;
  const progressRef = useRef(result.progress);
  progressRef.current = result.progress;
  const wasMetRef = useRef(false);
  useEffect(() => {
    if (result.isMet && !wasMetRef.current) {
      onMetRef.current?.(progressRef.current ?? { current: 0, target: 0 });
    }
    wasMetRef.current = result.isMet;
  }, [result.isMet]);

  return result;
}
