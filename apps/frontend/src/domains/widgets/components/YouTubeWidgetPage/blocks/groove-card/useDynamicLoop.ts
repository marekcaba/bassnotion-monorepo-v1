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
 * symmetric 2-segment cycle from `{ intervalSemitones, everyN }`, where the
 * interval is RELATIVE to the user's current key:
 *     [ { semitones: home,            loops: N },   // the user's key
 *       { semitones: home + interval, loops: N } ]  // moved by the interval
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

export type DynamicLoopMode = 'ping-pong' | 'travel';

export interface DynamicLoopConfig {
  /** The transpose INTERVAL in semitones, RELATIVE to the user's current key.
   *  Signed: positive = up, negative = down. */
  intervalSemitones: number;
  /** How many loops to hold EACH key before moving. Min 1. */
  everyN: number;
  /** How the cycle travels:
   *   - 'ping-pong': home → home+interval → home → … (2 keys, default).
   *   - 'travel':    keep moving by the interval every N loops, wrapping the
   *     offset into the engine range (+6 = tritone, then −5, −4 … toward home),
   *     so it climbs the chromatic ladder in the interval's direction and laps
   *     back to home after a full octave, forever. e.g. E + m3:
   *     E → G → B♭ → D♭ → E → … */
  mode?: DynamicLoopMode;
}

export interface UseDynamicLoopArgs {
  /** Master switch from the Engage toggle. When false the feature is fully
   *  inert (no counting, no key writes). Flipping false→true while playing
   *  arms it live; the first auto-change lands after `everyN` loops. */
  engaged: boolean;
  /** Whether the groove is playing. The counter only runs while playing. */
  isPlaying: boolean;
  /** True while the 1-2-3-4 count-in bar is playing. Forwarded to the loop
   *  counter so the count-in→loop-1 read-head wrap isn't miscounted as a
   *  completed home loop. */
  isCountingDown: boolean;
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
 * Wrap a semitone offset into the engine's transpose range so that pitch is
 * continuous across the ±cap. Because +6 and −6 are the SAME pitch class (the
 * tritone is its own inverse), a value past the cap isn't clamped — it WRAPS to
 * the other side, which is the same chromatic ladder one octave folded. So an
 * ascending ladder reads 0,3,6,−3,0 and a descending one 0,−3,−6,3,0.
 *
 * `dir` (+1 ascending / −1 descending) only disambiguates the tritone, which
 * could be written +6 or −6: we resolve it toward the travel direction so the
 * displayed sign matches where the journey is heading. Assumes max == 6 (a full
 * octave window); a tighter entitlement band still wraps mod 12 then clamps.
 */
function wrapOffsetIntoRange(offset: number, max: number, dir: number): number {
  const m = Math.max(1, Math.round(max));
  let v = ((Math.round(offset) % 12) + 12) % 12; // 0..11
  if (v > m) v -= 12; // above the cap → wrap to the negative side
  // Tritone (|v| === m): resolve its sign toward the travel direction.
  if (v === m && dir < 0) v = -m;
  return Math.max(-m, Math.min(m, v));
}

/**
 * Build the per-key segment list for one full cycle.
 *
 * PING-PONG: [home, home+interval] — two keys, N loops each (the default).
 *
 * TRAVEL: the chromatic ladder. Start at home, add the interval each step,
 * wrapping the offset into the engine range, until we return to home (a full
 * octave). e.g. home E(0) + m3(+3): E(0) → G(+3) → B♭(+6) → D♭(−3) → home(0).
 * The number of distinct keys is 12 / gcd(12, |interval|); a 0 interval (or a
 * degenerate wrap) collapses to a single home segment (no movement).
 */
function buildSegments(
  config: DynamicLoopConfig,
  home: number,
  max: number,
): Segment[] {
  const loops = Math.max(1, Math.round(config.everyN));
  return buildCycleKeys(config, home, max).map((semitones) => ({
    semitones,
    loops,
  }));
}

/**
 * The DISTINCT key offsets one full cycle visits, in order, starting at home.
 *   - ping-pong: [home, home+interval]
 *   - travel:    [home, home+i, home+2i, …] wrapping into range until it laps
 *     back to home (a full octave). Exposed so the dial can preview the journey
 *     as key-center note names without rebuilding the segment list.
 */
export function buildCycleKeys(
  config: DynamicLoopConfig,
  home: number,
  max: number,
): number[] {
  const homeKey = clampSemitones(home, max);
  const interval = Math.round(config.intervalSemitones);

  if ((config.mode ?? 'ping-pong') === 'ping-pong') {
    return [homeKey, clampSemitones(homeKey + interval, max)];
  }

  // TRAVEL: walk the ladder from home, wrapping, until we lap back to home.
  const dir = Math.sign(interval) || 1;
  const keys: number[] = [homeKey];
  let current = homeKey;
  for (let step = 0; step < 12; step++) {
    const next = wrapOffsetIntoRange(current + interval, max, dir);
    if (next === homeKey) break; // lapped back to home → cycle complete
    if (keys.includes(next)) break; // degenerate (e.g. interval 0) — stop
    keys.push(next);
    current = next;
  }
  return keys;
}

/**
 * The key (semitone offset) that should be AUDIBLE during a given loop, where
 * loop 0 is the first home loop. The segments form a repeating block of total
 * length `sum(loops)`; we map `loopIndex` into that block. This is the flat
 * per-loop schedule — far easier to reason about than a mutable cursor, and the
 * thing the one-loop-ahead pre-queue reads from.
 */
function keyForLoop(segments: Segment[], loopIndex: number): number {
  const period = segments.reduce((sum, s) => sum + Math.max(1, s.loops), 0);
  if (period <= 0) return segments[0]?.semitones ?? 0;
  let pos = ((loopIndex % period) + period) % period; // wrap negatives too
  for (const seg of segments) {
    const len = Math.max(1, seg.loops);
    if (pos < len) return seg.semitones;
    pos -= len;
  }
  return segments[0]?.semitones ?? 0;
}

export function useDynamicLoop({
  engaged,
  isPlaying,
  isCountingDown,
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

  // How many full cycle-loops have COMPLETED since activation. Loop 0 is the
  // first home loop currently playing; after its boundary fires, elapsed = 1,
  // meaning loop 1 is now playing. The boundary callback reads/writes this
  // synchronously, so it's a ref.
  const loopsElapsedRef = useRef(0);
  // The key we've most recently QUEUED via setKey (one loop ahead). Tracked so
  // we only call setKey when the upcoming loop's key actually changes.
  const queuedKeyRef = useRef<number | null>(null);
  // Armed only after the activation effect has set the live home key. Guards
  // the React effect-ordering window: the loop counter's RAF could otherwise
  // spend a boundary before activation commits the correct home.
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
    loopsElapsedRef.current = 0;
    // Loop 0 (home) is already audible (it === the user's current key), so it's
    // our "queued" key. We'll queue loop 1's key at loop 0's boundary.
    queuedKeyRef.current = keyForLoop(segmentsRef.current, 0);
    armedRef.current = true; // only now may boundaries be spent
    forceTick();
  }, [isActive]);

  // Fired by the loop counter when the CURRENT loop is APPROACHING its seam
  // (lead-time before the wrap, still inside the loop). We pre-queue the NEXT
  // loop's key here: setKey() defers the audible swap to the next seam — which,
  // because we're still inside the current loop, IS this loop's end. So the new
  // key is heard on the very first beat of the next loop. No extra home loop.
  //
  // `completedLoops` is the number of loops fully completed so far (0 while the
  // first loop plays). The loop ABOUT TO START is completedLoops + 1, so we
  // queue keyForLoop(completedLoops + 1).
  const onLoopApproaching = useCallback((completedLoops: number) => {
    if (!armedRef.current) return;
    const segs = segmentsRef.current;
    const upcomingLoop = completedLoops + 1;
    const upcomingKey = keyForLoop(segs, upcomingLoop);
    if (upcomingKey !== queuedKeyRef.current) {
      queuedKeyRef.current = upcomingKey;
      setKeyRef.current(upcomingKey);
    }
    // Advance the status cursor to the loop ABOUT TO PLAY (upcomingLoop). The
    // approach fires a lead-time before the seam, so the status leads the audio
    // by that window — exactly right for a "what's coming next" preview: the
    // moment the upcoming key is queued, the status points PAST it to the one
    // after, so the preview always shows where we're going next.
    loopsElapsedRef.current = upcomingLoop;
    forceTick();
  }, []);

  useLoopCounter({
    isPlaying,
    enabled: engaged,
    isCountingDown,
    getNextSeamTime,
    getCurrentTime,
    onLoopApproaching,
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

  // Derived status for the caption (read from refs; forceTick re-renders when
  // they change). The loop currently playing is `loopsElapsed`; its key is
  // keyForLoop(elapsed). We report the NEXT DIFFERENT key and how many loops
  // until it lands.
  const segs = segmentsRef.current;
  const elapsed = isActive ? loopsElapsedRef.current : 0;
  let nextSemitones = 0;
  let loopsRemaining = 0;
  if (isActive && segs.length > 0) {
    const currentKey = keyForLoop(segs, elapsed);
    const period = segs.reduce((s, seg) => s + Math.max(1, seg.loops), 0);
    // Walk forward to the next loop whose key differs from the current one.
    for (let ahead = 1; ahead <= period; ahead++) {
      const k = keyForLoop(segs, elapsed + ahead);
      if (k !== currentKey) {
        nextSemitones = k;
        loopsRemaining = ahead;
        break;
      }
    }
  }

  return { nextSemitones, loopsRemaining, isActive };
}
