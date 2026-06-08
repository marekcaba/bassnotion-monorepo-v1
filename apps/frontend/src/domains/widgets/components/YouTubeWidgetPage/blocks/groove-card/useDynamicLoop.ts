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

import { useCallback, useEffect, useReducer, useRef } from 'react';
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
  /** The user's CURRENT manual key (absolute semitones from the original),
   *  i.e. wherever the key stepper sits. This is the "home" the cycle holds
   *  and returns to — NOT necessarily the original key. Captured at the moment
   *  the cycle activates, so the manual key the user dialed in is the one we
   *  play, then transpose away from and back to. */
  homeSemitones: number;
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

/**
 * Build the v1 symmetric 2-segment cycle: HOME (the user's current manual key)
 * for N loops, then the dialed target for N loops, repeating. `home` is the
 * absolute semitone offset the user set on the stepper — the cycle plays THAT
 * key first, not the original key.
 */
function buildSegments(
  config: DynamicLoopConfig,
  home: number,
  max: number,
): Segment[] {
  const loops = Math.max(1, Math.round(config.everyN));
  const homeKey = clampSemitones(home, max);
  const away = clampSemitones(config.targetSemitones, max);
  return [
    { semitones: homeKey, loops },
    { semitones: away, loops },
  ];
}

export function useDynamicLoop({
  engaged,
  isPlaying,
  config,
  homeSemitones,
  maxSemitones,
  setKey,
  getNextSeamTime,
  getCurrentTime,
}: UseDynamicLoopArgs): UseDynamicLoopState {
  // Active = engaged AND playing. When inactive the counter is disabled and no
  // key writes happen.
  const isActive = engaged && isPlaying;

  // The cycle's segments — HOME (the user's manual key, snapshotted at the
  // moment we activate) and the dialed target. Held in a ref + state: the ref
  // is what the boundary callback reads synchronously; the state mirror drives
  // status re-renders. We DON'T rebuild from live `homeSemitones` each render,
  // because once the cycle is running it drives setKey itself — the home must
  // stay pinned to where the user set it at engage time.
  const segmentsRef = useRef<Segment[]>(
    buildSegments(config, homeSemitones, maxSemitones),
  );

  // Runtime cursor: which segment we're in and how many of its loops are left.
  // Refs because the loop-boundary callback must read/write them synchronously
  // without a stale closure.
  const segmentIndexRef = useRef(0);
  const loopsLeftRef = useRef(segmentsRef.current[0]?.loops ?? 1);
  // Armed only after the activation effect has rebuilt the segments from the
  // user's LIVE home key. Guards the React effect-ordering window: the loop
  // counter's RAF could otherwise spend a boundary against the stale initial
  // segments (home seeded at 0 from mount-time currentSemitones) before the
  // activation effect commits the correct home.
  const armedRef = useRef(false);

  // Stable refs for the boundary callback so it never restarts the counter.
  const setKeyRef = useRef(setKey);
  setKeyRef.current = setKey;
  // Live home key + config in refs so the activation effect captures the
  // CURRENT manual key without re-running every time the user steps it.
  const homeSemitonesRef = useRef(homeSemitones);
  homeSemitonesRef.current = homeSemitones;
  const configRef = useRef(config);
  configRef.current = config;
  const maxSemitonesRef = useRef(maxSemitones);
  maxSemitonesRef.current = maxSemitones;

  // Force-update tick: bumped when the cursor advances so the derived status
  // (nextSemitones / loopsRemaining) re-renders.
  const [, forceTick] = useReducer((n: number) => n + 1, 0);

  // (Re)build the segments + reset the cursor whenever the feature activates.
  // We SNAPSHOT the user's current manual key as HOME here, so the cycle plays
  // exactly the key the stepper is on, then transposes to the target and back.
  // We start AT segment 0 (home) with a full loop budget, so the first
  // auto-change lands after `everyN` loops ("engage live, count from the next
  // loop"). segments[0].semitones === home, which the user is already playing,
  // so no setKey on activate.
  //
  // Deps are [isActive] only — when the user re-tunes the dial WHILE engaged,
  // the stepper is locked anyway, and changing everyN/target mid-cycle is a
  // re-engage concern (disengage → reconfigure → engage), matching the spec.
  useEffect(() => {
    if (!isActive) {
      armedRef.current = false;
      return;
    }
    segmentsRef.current = buildSegments(
      configRef.current,
      homeSemitonesRef.current,
      maxSemitonesRef.current,
    );
    segmentIndexRef.current = 0;
    loopsLeftRef.current = segmentsRef.current[0]?.loops ?? 1;
    armedRef.current = true; // only now may boundaries be spent
    forceTick();
  }, [isActive]);

  // On each loop boundary: spend one loop of the current segment. When the
  // segment is exhausted, advance to the next (wrapping) and apply its key.
  const onLoopBoundary = useCallback(() => {
    // Ignore any boundary that fires before activation has rebuilt the segments
    // from the live home key (effect-ordering guard).
    if (!armedRef.current) return;
    if (loopsLeftRef.current > 1) {
      loopsLeftRef.current -= 1;
      forceTick();
      return;
    }
    const segs = segmentsRef.current;
    const nextIndex = (segmentIndexRef.current + 1) % segs.length;
    segmentIndexRef.current = nextIndex;
    loopsLeftRef.current = segs[nextIndex]?.loops ?? 1;
    setKeyRef.current(segs[nextIndex]?.semitones ?? segs[0]?.semitones ?? 0);
    forceTick();
  }, []);

  useLoopCounter({
    isPlaying,
    enabled: engaged,
    getNextSeamTime,
    getCurrentTime,
    onLoopBoundary,
  });

  // On disengage (or stop), snap back to the HOME key (the user's manual key)
  // so they're not left stranded in the transposed key. We watch isActive going
  // true→false. setKey routes through the normal seam-deferral: lands on the
  // next boundary if still playing, applies immediately for the next play if
  // stopped.
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (wasActiveRef.current && !isActive) {
      setKeyRef.current(segmentsRef.current[0]?.semitones ?? 0);
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Derived status (read from the cursor refs; forceTick guarantees a render
  // when they change).
  const segs = segmentsRef.current;
  const curIndex = isActive ? segmentIndexRef.current : 0;
  const nextIndex = (curIndex + 1) % segs.length;
  const nextSemitones = isActive
    ? (segs[nextIndex]?.semitones ?? segs[0]?.semitones ?? 0)
    : 0;
  const loopsRemaining = isActive ? loopsLeftRef.current : 0;

  return { nextSemitones, loopsRemaining, isActive };
}
