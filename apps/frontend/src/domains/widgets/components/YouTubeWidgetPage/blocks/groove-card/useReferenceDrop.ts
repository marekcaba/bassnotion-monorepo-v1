'use client';

/**
 * useReferenceDrop — the "Reference-Drop" pulse-steadiness drill (Lock The
 * Pocket). While the groove loops, the chosen reference stem(s) — drums and/or
 * the metronome click — FADE OUT for `dropForBars`, then FADE BACK IN on a bar
 * boundary, every `everyBars`. The return reveals whether the player drifted
 * while the reference was gone. Trains Pulse·Steadiness + Timing·Awareness.
 *
 * It composes the same two pieces as useDynamicLoop and adds NO new audio
 * engine code, scheduler, or clock:
 *   • useLoopCounter — fires a lead-time BEFORE each loop seam (off the seam
 *     clock; tempo-correct by construction).
 *   • per-stem GainNode ramps — engine.getOrCreateInstrumentGainNode(stem)
 *     + gain.setTargetAtTime(target, seamTime, τ), scheduled AT the seam so the
 *     fade lands exactly on the bar boundary (sample-accurate, audio-thread).
 *
 * EVERYTHING is admin-authored via the block's `referenceDrop` config — nothing
 * is hardcoded. The hook is INERT unless `config.enabled`. The only constant is
 * a fallback fade duration when the admin omits `fadeMs`.
 *
 * It does NOT touch the engine's mute-state bookkeeping (instrumentMuteStates)
 * or the user's mute/solo — it ramps the gain node DIRECTLY and restores to the
 * stem's resting volume, so the player's own mute/solo persists underneath the
 * drill. On stop / disable it restores any dropped stem so nothing is left
 * silent.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { ReferenceDropConfig } from '@bassnotion/contracts';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';
import { useLoopCounter } from './useLoopCounter.js';

/** Fade duration (ms) when the admin's config omits `fadeMs`. Short, so the
 *  drop/return reads as a clean musical event, not a slow swell. */
const DEFAULT_FADE_MS = 80;

/** The engine instrument type for each droppable reference target. */
const STEM_FOR_TARGET: Record<'drums' | 'click', string> = {
  drums: 'audio-drums',
  click: 'audio-click',
};

export interface UseReferenceDropArgs {
  /** Admin-authored config from the block. When absent or `enabled === false`
   *  the hook is fully inert. */
  config?: ReferenceDropConfig | null;
  /** Whether the groove is playing — the counter only runs while playing. */
  isPlaying: boolean;
  /** True while the 1-2-3-4 count-in bar plays. Forwarded to the loop counter
   *  so the count-in→loop-1 read-head wrap isn't miscounted as a loop. */
  isCountingDown: boolean;
  /** Seam-clock reader for the loop counter (next-seam wall-clock time / null).
   *  Stable identity expected. */
  getNextSeamTime: () => number | null;
  /** Current audio-context time reader. Stable identity expected. */
  getCurrentTime: () => number | null;
}

export interface UseReferenceDropState {
  /** True while the drill is actively running (enabled + playing). */
  isActive: boolean;
  /** Whether the reference is CURRENTLY dropped (for the UI cue). */
  isDropped: boolean;
  /** Loops until the next drop/return transition (drives a "dropping in N" cue).
   *  null when inactive. */
  loopsUntilChange: number | null;
}

/** Should the reference be DROPPED during loop `loopIndex` (0-based)? The cycle
 *  is `everyBars` loops long; the reference is dropped for the FIRST `dropForBars`
 *  of each cycle. (We count in loops; "bar" = one loop of the groove's region —
 *  the drill loops the brick's loop length.) Exported for unit tests. */
export function isDroppedForLoop(
  loopIndex: number,
  cfg: ReferenceDropConfig,
): boolean {
  const every = Math.max(1, Math.round(cfg.everyBars));
  const dropFor = Math.max(1, Math.min(every, Math.round(cfg.dropForBars)));
  const pos = ((loopIndex % every) + every) % every;
  return pos < dropFor;
}

export function useReferenceDrop({
  config,
  isPlaying,
  isCountingDown,
  getNextSeamTime,
  getCurrentTime,
}: UseReferenceDropArgs): UseReferenceDropState {
  const enabled = !!config?.enabled && (config?.dropTargets?.length ?? 0) > 0;
  const isActive = enabled && isPlaying;

  // Config + active flag in refs so the boundary callback reads current values
  // without re-creating its identity (which would restart the counter).
  const configRef = useRef(config);
  configRef.current = config;
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // Per-stem resting volume snapshot, captured the first time we drop a stem so
  // we can restore EXACTLY where the user had it (respecting their own volume),
  // not assume 0.8. Keyed by instrument type.
  const restingVolumeRef = useRef<Map<string, number>>(new Map());
  // Whether each target is currently dropped (so we only schedule a ramp when
  // the state actually changes — one ramp per transition, like setKey).
  const droppedRef = useRef<Set<string>>(new Set());
  // The drop-state we've QUEUED for the upcoming loop (so we ramp only on change).
  const queuedDroppedRef = useRef<boolean | null>(null);

  // Status mirror for the UI cue.
  const [, forceTick] = useReducer((n: number) => n + 1, 0);
  const isDroppedRef = useRef(false);
  const loopsUntilChangeRef = useRef<number | null>(null);

  /** Ramp one stem's gain to `target` at `whenSeconds` over `fadeMs`. Direct on
   *  the node — does NOT touch engine mute bookkeeping. */
  const rampStem = useCallback(
    (stem: string, target: number, whenSeconds: number, fadeMs: number) => {
      const engine = WindowRegistry.getPlaybackEngine();
      const node = engine?.getOrCreateInstrumentGainNode?.(stem as never);
      if (!node) return;
      // setTargetAtTime's time constant ≈ fade/3 reaches ~95% in `fade`.
      const tau = Math.max(0.001, fadeMs / 1000 / 3);
      try {
        node.gain.setTargetAtTime(target, whenSeconds, tau);
      } catch {
        // A bad/again-stale time is non-fatal; the next boundary re-evaluates.
      }
    },
    [],
  );

  /** Snapshot a stem's current resting volume once (so restore is exact). */
  const snapshotResting = useCallback((stem: string) => {
    if (restingVolumeRef.current.has(stem)) return;
    const node = WindowRegistry.getPlaybackEngine()?.getOrCreateInstrumentGainNode?.(
      stem as never,
    );
    // Prefer the node's resting stamp (set by setInstrumentMuted/Volume), else
    // its live value, else the engine default 0.8.
    const stamped = (node as (GainNode & { __restingVolume?: number }) | null)
      ?.__restingVolume;
    const live = node?.gain.value;
    restingVolumeRef.current.set(
      stem,
      typeof stamped === 'number' ? stamped : (live ?? 0.8),
    );
  }, []);

  /** Restore every dropped stem to its snapshot (used on stop / disable). */
  const restoreAll = useCallback(
    (whenSeconds: number, fadeMs: number) => {
      for (const stem of droppedRef.current) {
        const resting = restingVolumeRef.current.get(stem) ?? 0.8;
        rampStem(stem, resting, whenSeconds, fadeMs);
      }
      droppedRef.current.clear();
      isDroppedRef.current = false;
    },
    [rampStem],
  );

  // Fired a lead-time BEFORE the upcoming loop's seam. We decide whether the
  // UPCOMING loop should be dropped and, if that differs from the current
  // drop-state, schedule the gain ramp at the seam (= this loop's end, so it
  // lands on the first beat of the upcoming loop — exactly like setKey).
  const onLoopApproaching = useCallback(
    (completedLoops: number) => {
      if (!isActiveRef.current) return;
      const cfg = configRef.current;
      if (!cfg) return;

      const fadeMs = cfg.fadeMs ?? DEFAULT_FADE_MS;
      const upcomingLoop = completedLoops + 1;
      const shouldDrop = isDroppedForLoop(upcomingLoop, cfg);

      if (shouldDrop === queuedDroppedRef.current) {
        // No transition for the upcoming loop — just refresh the status cue.
        updateStatus(completedLoops, cfg);
        return;
      }
      queuedDroppedRef.current = shouldDrop;

      const seam = getNextSeamTime();
      const when =
        seam ?? (getCurrentTime() ?? 0) + 0.001; // seam preferred; tiny fallback

      const targets = cfg.dropTargets.map((t) => STEM_FOR_TARGET[t]);
      if (shouldDrop) {
        for (const stem of targets) {
          snapshotResting(stem);
          rampStem(stem, 0, when, fadeMs);
          droppedRef.current.add(stem);
        }
        isDroppedRef.current = true;
      } else {
        for (const stem of targets) {
          const resting = restingVolumeRef.current.get(stem) ?? 0.8;
          rampStem(stem, resting, when, fadeMs);
          droppedRef.current.delete(stem);
        }
        isDroppedRef.current = false;
      }
      updateStatus(completedLoops, cfg);
    },
    [getNextSeamTime, getCurrentTime, rampStem, snapshotResting],
  );

  // Compute "loops until the next drop/return transition" for the cue.
  function updateStatus(completedLoops: number, cfg: ReferenceDropConfig) {
    const here = isDroppedForLoop(completedLoops + 1, cfg);
    let ahead = 1;
    const every = Math.max(1, Math.round(cfg.everyBars));
    for (; ahead <= every; ahead++) {
      if (isDroppedForLoop(completedLoops + 1 + ahead, cfg) !== here) break;
    }
    loopsUntilChangeRef.current = ahead;
    forceTick();
  }

  useLoopCounter({
    isPlaying,
    enabled,
    isCountingDown,
    getNextSeamTime,
    getCurrentTime,
    onLoopApproaching,
  });

  // On stop / disable, restore any dropped stem immediately so nothing is left
  // silent, and reset the cycle so the next play starts clean.
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (wasActiveRef.current && !isActive) {
      const now = getCurrentTime() ?? 0;
      const fadeMs = configRef.current?.fadeMs ?? DEFAULT_FADE_MS;
      restoreAll(now + 0.001, fadeMs);
      queuedDroppedRef.current = null;
      loopsUntilChangeRef.current = null;
      forceTick();
    }
    wasActiveRef.current = isActive;
  }, [isActive, getCurrentTime, restoreAll]);

  return {
    isActive,
    isDropped: isActive ? isDroppedRef.current : false,
    loopsUntilChange: isActive ? loopsUntilChangeRef.current : null,
  };
}
