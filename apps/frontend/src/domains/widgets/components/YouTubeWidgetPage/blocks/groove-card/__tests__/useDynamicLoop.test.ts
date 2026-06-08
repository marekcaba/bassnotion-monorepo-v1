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
 * A live seam source mirroring real playback. The seam is a fixed future
 * instant; `now` climbs toward it. The loop counter fires onLoopApproaching
 * when `seam - now` enters the lead-time window (≤0.25s), then the loop wraps.
 *  - `far()`     — a frame mid-loop (seam well ahead; no approach fire).
 *  - `nearSeam()`— a frame INSIDE the lead window (seam ≈0.1s ahead → fires).
 *  - `wrap()`    — the read-head wraps (seam jumps forward one loop).
 */
function makeSeamSource(loopSec = 8) {
  let seam = loopSec; // first seam one loop out
  let now = 0; // clock starts well before it (gap = loopSec)
  return {
    getNextSeamTime: () => seam,
    getCurrentTime: () => now,
    /** Mid-loop frame: clock advances but stays > lead window from the seam. */
    far: () => {
      now = seam - 1.0; // gap 1.0 — outside the 0.25 lead window
    },
    /** Frame just inside the lead window → triggers onLoopApproaching. */
    nearSeam: () => {
      now = seam - 0.1; // gap 0.1 — inside the 0.25 lead window
    },
    /** The read-head wraps: seam jumps forward one loop. */
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
        isCountingDown: false,
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
        config: args.config ?? { intervalSemitones: 2, everyN: 2 },
        homeSemitones: args.homeSemitones ?? 0,
        maxSemitones: args.maxSemitones ?? 6,
      },
    },
  );
  // prime(): a couple of mid-loop frames so the counter baselines on loop 0's
  // seam (count-in is off here). No approach fires yet (seam is far).
  const prime = () => {
    seam.far();
    flushFrame();
    seam.far();
    flushFrame();
  };
  // loop(): play out ONE loop — a near-seam frame (fires onLoopApproaching for
  // the UPCOMING loop, which pre-queues its key one loop early via setKey),
  // then the wrap (loop completes). Mirrors real playback: the key for loop N+1
  // is queued while loop N is finishing, so it's audible when loop N+1 starts.
  const loop = () => {
    seam.nearSeam();
    flushFrame();
    seam.wrap();
    flushFrame();
    seam.far();
    flushFrame();
  };
  return { setKey, seam, prime, loop, ...utils };
}

describe('useDynamicLoop', () => {
  it('cycles home×N → away×N → home, pre-queuing each change one loop early', () => {
    // everyN=2, interval=+2 (home 0 → away +2). Per-loop schedule:
    // home,home,away,away,home,...
    // The away key is pre-queued during the LAST home loop (loop 1), so it's
    // audible at loop 2; home is pre-queued during the last away loop (loop 3).
    const { setKey, prime, loop } = mount({
      config: { intervalSemitones: 2, everyN: 2 },
    });
    prime();

    loop(); // loop 0 (home) approaching → upcoming loop 1 = home → no change
    expect(setKey).not.toHaveBeenCalled();

    loop(); // loop 1 (home) approaching → upcoming loop 2 = away(+2) → setKey(2)
    expect(setKey).toHaveBeenNthCalledWith(1, 2);

    loop(); // loop 2 (away) approaching → upcoming loop 3 = away → no change
    expect(setKey).toHaveBeenCalledTimes(1);

    loop(); // loop 3 (away) approaching → upcoming loop 4 = home(0) → setKey(0)
    expect(setKey).toHaveBeenNthCalledWith(2, 0);

    loop(); // loop 4 (home) approaching → upcoming loop 5 = home → no change
    loop(); // loop 5 (home) approaching → upcoming loop 6 = away(+2) → setKey(2)
    expect(setKey).toHaveBeenNthCalledWith(3, 2);
  });

  it('everyN=1: transposes on the very next loop (no extra home loop)', () => {
    // The reported real bug: with everyN=1 the away key must be heard on loop 2,
    // not loop 3. The pre-queue fires during loop 0 → away queued for loop 1.
    const { setKey, prime, loop } = mount({
      config: { intervalSemitones: 3, everyN: 1 },
    });
    prime();

    loop(); // loop 0 (home) approaching → upcoming loop 1 = away(+3) → setKey(3)
    expect(setKey).toHaveBeenNthCalledWith(1, 3);

    loop(); // loop 1 (away) approaching → upcoming loop 2 = home(0) → setKey(0)
    expect(setKey).toHaveBeenNthCalledWith(2, 0);

    loop(); // loop 2 (home) approaching → upcoming loop 3 = away(+3) → setKey(3)
    expect(setKey).toHaveBeenNthCalledWith(3, 3);
  });

  it('applies the interval RELATIVE to the user manual key (home + interval)', () => {
    // User on +3, interval +2 (up M2) → away = 3+2 = +5. Cycle +3↔+5, never 0.
    const { setKey, prime, loop } = mount({
      config: { intervalSemitones: 2, everyN: 1 },
      homeSemitones: 3,
    });
    prime();

    loop(); // upcoming = away = home(+3) + interval(+2) = +5
    expect(setKey).toHaveBeenNthCalledWith(1, 5);
    loop(); // upcoming = home(+3), NOT 0
    expect(setKey).toHaveBeenNthCalledWith(2, 3);
    loop(); // upcoming = away(+5)
    expect(setKey).toHaveBeenNthCalledWith(3, 5);
  });

  it('snaps back to the USER MANUAL key (not 0) on disengage', () => {
    const { setKey, prime, loop, rerender } = mount({
      config: { intervalSemitones: 2, everyN: 1 },
      homeSemitones: 3,
    });
    prime();
    loop(); // → away = +5 queued
    expect(setKey).toHaveBeenLastCalledWith(5);

    rerender({
      engaged: false,
      isPlaying: true,
      config: { intervalSemitones: 2, everyN: 1 },
      homeSemitones: 3,
      maxSemitones: 6,
    });
    expect(setKey).toHaveBeenLastCalledWith(3); // user's manual key, not 0
  });

  it('clamps home + interval into the ±max range', () => {
    // User on +4, interval +5 → 4+5 = +9 → clamped to +6 (the cap). The away
    // segment must never exceed the engine range / trip setKey's cap path.
    const { setKey, prime, loop } = mount({
      config: { intervalSemitones: 5, everyN: 1 },
      homeSemitones: 4,
      maxSemitones: 6,
    });
    prime();
    loop(); // away = clamp(4 + 5, ±6) = +6, never +9
    expect(setKey).toHaveBeenCalledWith(6);
  });

  it('does NOT setKey on activate (home === the key already playing)', () => {
    const { setKey, prime } = mount({
      config: { intervalSemitones: 5, everyN: 2 },
      homeSemitones: 3,
    });
    prime();
    expect(setKey).not.toHaveBeenCalled();
  });

  it('pre-clamps an out-of-band target so setKey never sees it', () => {
    const { setKey, prime, loop } = mount({
      config: { intervalSemitones: 5, everyN: 1 },
      maxSemitones: 2,
    });
    prime();
    loop(); // upcoming = away, clamped to +2
    expect(setKey).toHaveBeenCalledWith(2); // never +5
  });

  it('is fully inert when not engaged', () => {
    const { setKey, prime, loop } = mount({ engaged: false });
    prime();
    loop();
    loop();
    loop();
    expect(setKey).not.toHaveBeenCalled();
  });

  it('snaps back to home when playback stops while engaged', () => {
    const { setKey, prime, loop, rerender } = mount({
      config: { intervalSemitones: 4, everyN: 1 },
    });
    prime();
    loop(); // → away (+4) queued
    expect(setKey).toHaveBeenLastCalledWith(4);

    rerender({
      engaged: true,
      isPlaying: false,
      config: { intervalSemitones: 4, everyN: 1 },
      homeSemitones: 0,
      maxSemitones: 6,
    });
    expect(setKey).toHaveBeenLastCalledWith(0); // snap home
  });

  it('reports nextSemitones and loopsRemaining for the status caption', () => {
    // The status LEADS the audio by the approach lead-time: each approach
    // advances elapsed to the loop about to play. everyN=3: schedule
    // home,home,home,away,away,away,… loopsRemaining = loops to the next
    // DIFFERENT key.
    const { result, prime, loop } = mount({
      config: { intervalSemitones: 2, everyN: 3 },
    });
    prime();
    // Before any approach (elapsed 0, home): next diff +2 is 3 loops ahead.
    expect(result.current.isActive).toBe(true);
    expect(result.current.nextSemitones).toBe(2);
    expect(result.current.loopsRemaining).toBe(3);

    loop(); // elapsed 1 (home): +2 is 2 ahead
    expect(result.current.loopsRemaining).toBe(2);
    loop(); // elapsed 2 (home): +2 is 1 ahead
    expect(result.current.loopsRemaining).toBe(1);
    loop(); // elapsed 3 (now away): next diff is 0, 3 ahead
    expect(result.current.nextSemitones).toBe(0);
    expect(result.current.loopsRemaining).toBe(3);
  });

  it('keeps reporting the NEXT key every loop (not just once) — preview bug', () => {
    // Regression: the next-key preview vanished after the first change. The hook
    // must alternate nextSemitones EVERY loop so the preview always points at
    // the upcoming key. everyN=1, interval +3 → schedule [0, 3].
    const { result, prime, loop } = mount({
      config: { intervalSemitones: 3, everyN: 1 },
    });
    prime();
    expect(result.current.nextSemitones).toBe(3); // home(0) → next is +3

    loop(); // now on +3 → next is home(0)
    expect(result.current.nextSemitones).toBe(0);
    loop(); // back on home(0) → next is +3 again
    expect(result.current.nextSemitones).toBe(3);
    loop(); // +3 → next 0
    expect(result.current.nextSemitones).toBe(0);
  });
});
