'use client';

/**
 * useDynamicLoop — the "Dynamic Loop" feature state machine.
 *
 * The groove already loops forever (that's just play). Dynamic Loop makes the
 * KEY change automatically across loops: hold the home key for N loops, the
 * transposed key for N loops, back to home, repeat — each change landing
 * cleanly on the loop seam.
 *
 * It composes two existing pieces and adds NO audio-engine code:
 *   • useLoopCounter — tells us when a loop boundary passes (off the seam clock).
 *   • setKey(semitones) — the groove-card hook's existing transpose, which
 *     already defers the audible swap to the next seam.
 *
 * SHAPE: a generic SEGMENT SEQUENCE `{ semitones, loops }[]`. v1 builds a
 * symmetric 2-segment cycle from `{ targetSemitones, everyN }`:
 *     [ { semitones: 0,            loops: N },   // home
 *       { semitones: target,       loops: N } ]  // away
 * Modelling it as a sequence (not a hard-coded A/B flip) means V2 asymmetric
 * phrasing, longer sequences, and verse/chorus drop into the same skeleton.
 *
 * GOTCHAS HANDLED (see the pre-build investigation):
 *  1. Pre-clamp `target` to the effective transpose range BEFORE engaging, so
 *     setKey never trips its cap path (which would swallow the change and fire
 *     the upgrade popover + cap_hit telemetry on EVERY cycle).
 *  2. Only run while playing; tear down on stop/pause (the caller flips
 *     isPlaying). No boundaries exist when stopped.
 *  3. On disengage, snap back to the home key (setKey(0)) — stop does NOT reset
 *     the key, so without this the user is stranded in the transposed key.
 *  4. One setKey call per boundary, separated by renders (never coalesced into
 *     one tick) — the loop counter fires at most once per loop.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useLoopCounter } from './useLoopCounter.js';

export interface DynamicLoopConfig {
  /** Target transpose in semitones for the "away" segment, relative to the
   *  original key. The caller passes the value the user dialed; this hook
   *  re-clamps it to `maxSemitones` defensively. */
  targetSemitones: number;
  /** How many loops to hold each key (symmetric: N home, N away). Min 1. */
  everyN: number;
}

export interface UseDynamicLoopArgs {
  /** Master switch from the Engage toggle. When false the feature is fully
   *  inert (no counting, no key writes). Flipping false→true while playing
   *  arms it live; the first auto-change lands after `everyN` loops. */
  engaged: boolean;
  /** Whether the groove is playing. The counter only runs while playing. */
  isPlaying: boolean;
  /** The dialed cycle config. */
  config: DynamicLoopConfig;
  /** The effective transpose range edge (e.g. 6, or the entitlement band).
   *  The target is clamped into ±maxSemitones so an auto-cycle can never trip
   *  setKey's cap path. */
  maxSemitones: number;
  /** The groove-card hook's setKey — transposes the whole band to an ABSOLUTE
   *  offset from the original key, deferring the audible swap to the next seam.
   *  Stable identity expected. */
  setKey: (semitonesFromOriginal: number) => void;
  /** Seam clock reader for the loop counter (next-seam wall-clock time, or
   *  null while not streaming). Stable identity expected. */
  getNextSeamTime: () => number | null;
  /** Current audio-context time reader for the loop counter. Stable identity
   *  expected. */
  getCurrentTime: () => number | null;
}

export interface UseDynamicLoopState {
  /** The semitone offset the NEXT auto-change will move to (the segment after
   *  the current one). Drives the status caption ("→ F♯ in 2"). */
  nextSemitones: number;
  /** Loops remaining in the CURRENT segment before the next auto-change. */
  loopsRemaining: number;
  /** True while the feature is actively cycling (engaged + playing). The view
   *  uses this to lock the manual key stepper + arrow-key transpose and to
   *  show the status caption. */
  isActive: boolean;
}

interface Segment {
  semitones: number;
  loops: number;
}

function clampSemitones(value: number, max: number): number {
  const m = Math.max(0, Math.round(max));
  return Math.max(-m, Math.min(m, Math.round(value)));
}

/** Build the v1 symmetric 2-segment cycle from the dialed config. */
function buildSegments(config: DynamicLoopConfig, max: number): Segment[] {
  const loops = Math.max(1, Math.round(config.everyN));
  const away = clampSemitones(config.targetSemitones, max);
  return [
    { semitones: 0, loops },
    { semitones: away, loops },
  ];
}

export function useDynamicLoop({
  engaged,
  isPlaying,
  config,
  maxSemitones,
  setKey,
  getNextSeamTime,
  getCurrentTime,
}: UseDynamicLoopArgs): UseDynamicLoopState {
  const segments = useMemo(
    () => buildSegments(config, maxSemitones),
    [config, maxSemitones],
  );

  // Active = engaged AND playing. When inactive the counter is disabled and no
  // key writes happen.
  const isActive = engaged && isPlaying;

  // Runtime cursor: which segment we're in and how many of its loops are left.
  // Refs (not state) because the loop-boundary callback must read/write them
  // synchronously without a stale closure, and the counter is the source of
  // truth for advancing.
  const segmentIndexRef = useRef(0);
  const loopsLeftRef = useRef(segments[0]?.loops ?? 1);

  // Stable refs for the boundary callback so it never restarts the counter.
  const setKeyRef = useRef(setKey);
  setKeyRef.current = setKey;
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  // Force-update tick: bumped when the cursor advances so the derived status
  // (nextSemitones / loopsRemaining, read from the refs below) re-renders.
  const [, forceTick] = useReducer((n: number) => n + 1, 0);

  // (Re)initialise the cursor whenever the feature (re)activates or the
  // segments change. We start AT segment 0 (the current/home key) with a full
  // loop budget, so the first auto-change happens after `everyN` loops — the
  // "engage live, count from the next loop" behaviour. segments[0].semitones
  // is 0 by construction, matching the home start, so no setKey on activate.
  useEffect(() => {
    if (!isActive) return;
    segmentIndexRef.current = 0;
    loopsLeftRef.current = segmentsRef.current[0]?.loops ?? 1;
    forceTick();
  }, [isActive, segments]);

  // On each loop boundary: spend one loop of the current segment. When the
  // segment is exhausted, advance to the next (wrapping) and apply its key.
  const onLoopBoundary = useCallback(() => {
    if (loopsLeftRef.current > 1) {
      loopsLeftRef.current -= 1;
      forceTick();
      return;
    }
    const segs = segmentsRef.current;
    const nextIndex = (segmentIndexRef.current + 1) % segs.length;
    segmentIndexRef.current = nextIndex;
    loopsLeftRef.current = segs[nextIndex]?.loops ?? 1;
    setKeyRef.current(segs[nextIndex]?.semitones ?? 0);
    forceTick();
  }, []);

  useLoopCounter({
    isPlaying,
    enabled: engaged,
    getNextSeamTime,
    getCurrentTime,
    onLoopBoundary,
  });

  // On disengage (or stop), snap back to the home key so the user isn't left in
  // the transposed key. We watch isActive going true→false. setKey(0) routes
  // through the normal seam-deferral: lands on the next boundary if still
  // playing, applies immediately for the next play if stopped.
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (wasActiveRef.current && !isActive) {
      setKeyRef.current(0);
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Derived status (read from the cursor refs; forceTick guarantees a render
  // when they change).
  const segs = segments;
  const curIndex = isActive ? segmentIndexRef.current : 0;
  const nextIndex = (curIndex + 1) % segs.length;
  const nextSemitones = isActive ? (segs[nextIndex]?.semitones ?? 0) : 0;
  const loopsRemaining = isActive ? loopsLeftRef.current : 0;

  return { nextSemitones, loopsRemaining, isActive };
}
