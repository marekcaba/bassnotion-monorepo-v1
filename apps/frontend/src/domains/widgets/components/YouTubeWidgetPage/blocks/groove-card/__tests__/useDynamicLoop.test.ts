/**
 * Unit tests for useDynamicLoop — the auto key-cycle state machine.
 *
 * We drive the same manual-RAF + scripted-seam rig as useLoopCounter (the hook
 * composes it), advancing the seam one wrap per "frame" and asserting the
 * sequence of setKey() calls across a full cycle. Covers: the home×N → away×N →
 * home cycle, the pre-clamp of an out-of-band target, engage-live (first change
 * after N loops), snap-to-home on disengage, and full inertness when not
 * engaged / not playing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDynamicLoop, type DynamicLoopConfig } from '../useDynamicLoop.js';

let rafQueue: FrameRequestCallback[] = [];
// Run the queued RAF callbacks inside act() so the state updates the boundary
// callback triggers (via the hook's force-tick) are committed before the test
// reads result.current. Without act() the rendered status lags a frame and the
// console fills with act() warnings.
function flushFrame(): void {
  act(() => {
    const batch = rafQueue;
    rafQueue = [];
    for (const cb of batch) cb(performance.now());
  });
}

beforeEach(() => {
  rafQueue = [];
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {
    /* no-op: the manual pump drains the queue; nothing to cancel */
  });
});
afterEach(() => vi.restoreAllMocks());

/**
 * A live seam source mirroring real playback:
 *  - `approach()` advances the clock toward a FIXED seam (gap shrinks), which
 *    is how the loop counter ARMS — proving a live, counting-down read-head.
 *  - `wrap()` jumps the seam forward by one loop (the read-head wrapped),
 *    which the armed counter sees as a boundary.
 */
function makeSeamSource(loopSec = 8) {
  let seam = loopSec; // first seam one loop out
  let now = 0; // clock starts well before it (gap = loopSec)
  return {
    getNextSeamTime: () => seam,
    getCurrentTime: () => now,
    /** One frame where the clock climbs toward the seam (gap shrinks). */
    approach: (by = 1.0) => {
      now = Math.min(now + by, seam - 0.05);
    },
    /** Advance one loop boundary (read-head wraps → seam jumps forward). */
    wrap: () => {
      now = seam + 0.1; // we just crossed the old seam
      seam += loopSec; // next seam is one loop further out
    },
  };
}

function mount(args: {
  engaged?: boolean;
  isPlaying?: boolean;
  config?: DynamicLoopConfig;
  homeSemitones?: number;
  maxSemitones?: number;
  seam?: ReturnType<typeof makeSeamSource>;
}) {
  const setKey = vi.fn();
  const seam = args.seam ?? makeSeamSource();
  const utils = renderHook(
    (props: {
      engaged: boolean;
      isPlaying: boolean;
      config: DynamicLoopConfig;
      homeSemitones: number;
      maxSemitones: number;
    }) =>
      useDynamicLoop({
        engaged: props.engaged,
        isPlaying: props.isPlaying,
        config: props.config,
        homeSemitones: props.homeSemitones,
        maxSemitones: props.maxSemitones,
        setKey,
        getNextSeamTime: seam.getNextSeamTime,
        getCurrentTime: seam.getCurrentTime,
      }),
    {
      initialProps: {
        engaged: args.engaged ?? true,
        isPlaying: args.isPlaying ?? true,
        config: args.config ?? { targetSemitones: 2, everyN: 2 },
        homeSemitones: args.homeSemitones ?? 0,
        maxSemitones: args.maxSemitones ?? 6,
      },
    },
  );
  // prime(): drive several approach frames so the loop counter ARMS (the
  // seam-to-now gap shrinks, proving a live read-head) and baselines on the
  // live seam — mirroring the count-in finishing and real streaming starting.
  // No boundary fires during priming. Each boundary() then wraps the seam.
  const prime = () => {
    seam.approach(2.0); // gap shrinks
    flushFrame();
    seam.approach(2.0); // gap shrinks more → arms, baseline
    flushFrame();
    seam.approach(2.0); // settled, armed
    flushFrame();
  };
  const boundary = () => {
    seam.wrap();
    flushFrame();
  };
  return { setKey, seam, prime, boundary, ...utils };
}

describe('useDynamicLoop', () => {
  it('cycles home×N → away×N → home, calling setKey at each segment edge', () => {
    // everyN=2, target=+2: hold 0 for 2 loops, then +2 for 2 loops, repeat.
    const { setKey, prime, boundary } = mount({
      config: { targetSemitones: 2, everyN: 2 },
    });
    prime(); // baseline the counter (no boundary yet)

    boundary(); // loop 1 of home segment spent (2→1 left), no key change
    expect(setKey).not.toHaveBeenCalled();

    boundary(); // home segment exhausted → switch to away (+2)
    expect(setKey).toHaveBeenNthCalledWith(1, 2);

    boundary(); // loop 1 of away spent
    expect(setKey).toHaveBeenCalledTimes(1);

    boundary(); // away exhausted → back to home (0)
    expect(setKey).toHaveBeenNthCalledWith(2, 0);

    boundary(); // loop 1 of home
    boundary(); // home exhausted → away again (+2)
    expect(setKey).toHaveBeenNthCalledWith(3, 2);
  });

  it('holds the USER MANUAL key as home (not the original key)', () => {
    // The user dialed the stepper to +3. Engaging must keep +3 as home — play
    // +3 for N, transpose to the target (+5) for N, then BACK to +3, not 0.
    const { setKey, prime, boundary } = mount({
      config: { targetSemitones: 5, everyN: 1 },
      homeSemitones: 3,
    });
    prime();

    boundary(); // home (+3) exhausted → away (+5)
    expect(setKey).toHaveBeenNthCalledWith(1, 5);

    boundary(); // away exhausted → back to HOME = +3 (NOT 0)
    expect(setKey).toHaveBeenNthCalledWith(2, 3);

    boundary(); // home exhausted → away (+5) again
    expect(setKey).toHaveBeenNthCalledWith(3, 5);
  });

  it('snaps back to the USER MANUAL key (not 0) on disengage', () => {
    const { setKey, prime, boundary, rerender } = mount({
      config: { targetSemitones: 5, everyN: 1 },
      homeSemitones: 3,
    });
    prime();
    boundary(); // → away (+5)
    expect(setKey).toHaveBeenLastCalledWith(5);

    rerender({
      engaged: false,
      isPlaying: true,
      config: { targetSemitones: 5, everyN: 1 },
      homeSemitones: 3,
      maxSemitones: 6,
    });
    // Snaps to the user's manual key +3, NOT 0.
    expect(setKey).toHaveBeenLastCalledWith(3);
  });

  it('does NOT setKey on activate (home === the key already playing)', () => {
    // Engaging while the user sits on +3 must not fire setKey — they're already
    // playing +3; the first auto-change is the transpose after N loops.
    const { setKey, prime } = mount({
      config: { targetSemitones: 5, everyN: 2 },
      homeSemitones: 3,
    });
    prime();
    expect(setKey).not.toHaveBeenCalled();
  });

  it('pre-clamps an out-of-band target so setKey never sees it', () => {
    // Dial +5 but the entitlement band is ±2 → the away segment must be +2.
    const { setKey, prime, boundary } = mount({
      config: { targetSemitones: 5, everyN: 1 },
      maxSemitones: 2,
    });
    prime();
    boundary(); // everyN=1 → home exhausted immediately → away
    expect(setKey).toHaveBeenCalledWith(2); // clamped, never +5
  });

  it('engages live: first change lands after everyN loops (not immediately)', () => {
    const { setKey, prime, boundary } = mount({
      engaged: false,
      config: { targetSemitones: 3, everyN: 3 },
    });
    prime();
    // Not engaged yet — boundaries do nothing.
    boundary();
    boundary();
    expect(setKey).not.toHaveBeenCalled();
  });

  it('snaps back to home (setKey(0)) on disengage', () => {
    const { setKey, prime, boundary, rerender } = mount({
      config: { targetSemitones: 2, everyN: 1 },
    });
    prime();
    boundary(); // → away (+2)
    expect(setKey).toHaveBeenLastCalledWith(2);

    // Disengage — must snap home (0, the default manual key here).
    rerender({
      engaged: false,
      isPlaying: true,
      config: { targetSemitones: 2, everyN: 1 },
      homeSemitones: 0,
      maxSemitones: 6,
    });
    expect(setKey).toHaveBeenLastCalledWith(0);
  });

  it('snaps back to home when playback stops while engaged', () => {
    const { setKey, prime, boundary, rerender } = mount({
      config: { targetSemitones: 4, everyN: 1 },
    });
    prime();
    boundary(); // → away (+4)
    expect(setKey).toHaveBeenLastCalledWith(4);

    // Stop while still engaged — isActive goes false → snap home.
    rerender({
      engaged: true,
      isPlaying: false,
      config: { targetSemitones: 4, everyN: 1 },
      homeSemitones: 0,
      maxSemitones: 6,
    });
    expect(setKey).toHaveBeenLastCalledWith(0);
  });

  it('is fully inert when not engaged', () => {
    const { setKey, prime, boundary } = mount({ engaged: false });
    prime();
    boundary();
    boundary();
    boundary();
    expect(setKey).not.toHaveBeenCalled();
  });

  it('reports nextSemitones and loopsRemaining for the status caption', () => {
    const { result, prime, boundary } = mount({
      config: { targetSemitones: 2, everyN: 3 },
    });
    prime();
    // Start of home segment: next change is to +2, in 3 loops.
    expect(result.current.isActive).toBe(true);
    expect(result.current.nextSemitones).toBe(2);
    expect(result.current.loopsRemaining).toBe(3);

    boundary(); // home loop spent: 3 → 2 left
    expect(result.current.loopsRemaining).toBe(2);
    boundary(); // 2 → 1 left
    expect(result.current.loopsRemaining).toBe(1);
    boundary(); // segment exhausted → away; next change is back to 0, 3 left
    expect(result.current.nextSemitones).toBe(0);
    expect(result.current.loopsRemaining).toBe(3);
  });
});
