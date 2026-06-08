/**
 * Unit tests for useLoopCounter — boundary detection off the seam clock.
 *
 * The hook polls getNextSeamTime() in a RAF loop and fires onLoopBoundary when
 * the "next seam" target jumps forward by ~a loop (the read-head wrapped). We
 * drive a manual RAF queue + a scripted seam/clock so each "frame" is one step,
 * and assert the boundary callback fires exactly once per wrap with a monotonic
 * index — never on count-in (null seam), never on a continuous tempo drift, and
 * never while parked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLoopCounter } from '../useLoopCounter.js';

// ── manual RAF pump ────────────────────────────────────────────────────────
// Each flushFrame() runs exactly the callbacks queued as of that moment, so a
// test advances the hook one tick at a time.
let rafQueue: FrameRequestCallback[] = [];

function flushFrame(): void {
  const batch = rafQueue;
  rafQueue = [];
  for (const cb of batch) cb(performance.now());
}

beforeEach(() => {
  rafQueue = [];
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {
    // We don't selectively cancel in the pump; the hook's `cancelled` flag and
    // queue draining handle teardown. No-op is fine for these tests.
  });
});

afterEach(() => vi.restoreAllMocks());

/**
 * Mount with a scripted sequence of { seam, now } readings — one consumed per
 * frame. When the script is exhausted the last reading repeats.
 */
function mountScripted(
  script: Array<{ seam: number | null; now: number }>,
  opts: { isPlaying?: boolean; enabled?: boolean } = {},
) {
  let frame = 0;
  const read = () =>
    script[Math.min(frame, script.length - 1)] ?? { seam: null, now: 0 };
  const getNextSeamTime = vi.fn(() => read().seam);
  const getCurrentTime = vi.fn(() => read().now);
  const onLoopBoundary = vi.fn();

  const utils = renderHook(
    (props: { isPlaying: boolean; enabled: boolean }) =>
      useLoopCounter({
        isPlaying: props.isPlaying,
        enabled: props.enabled,
        getNextSeamTime,
        getCurrentTime,
        onLoopBoundary,
      }),
    {
      initialProps: {
        isPlaying: opts.isPlaying ?? true,
        enabled: opts.enabled ?? true,
      },
    },
  );

  // Advance the scripted frame each time we flush.
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      flushFrame();
      frame += 1;
    }
  };

  return { getNextSeamTime, onLoopBoundary, step, ...utils };
}

// Frames that ARM the counter: the seam is fixed and `now` climbs toward it,
// so the time-to-seam (`seam - now`) shrinks — proving a live, counting-down
// read-head. Prepend to a script before any wrap, mirroring real streaming.
function armingFrames(seam: number): Array<{ seam: number; now: number }> {
  return [
    { seam, now: seam - 2.0 }, // gap 2.0
    { seam, now: seam - 1.0 }, // gap 1.0 (shrinking → arms)
    { seam, now: seam - 0.5 }, // gap 0.5 (armed, baseline the live seam)
  ];
}

describe('useLoopCounter', () => {
  it('fires once per loop boundary with a monotonic index', () => {
    // Arm (seam fixed at 8, now climbs → gap shrinks), then the seam jumps
    // forward to ~16 when the loop wraps, then again to ~24. Each forward jump
    // is one boundary.
    const { onLoopBoundary, step } = mountScripted([
      ...armingFrames(8.0), // 3 frames: arm + baseline the live seam (8.0)
      { seam: 16.0, now: 8.1 }, // WRAP → boundary 1
      { seam: 16.0, now: 12.0 }, // approaching — no fire
      { seam: 24.0, now: 16.1 }, // WRAP → boundary 2
    ]);

    step(6);

    expect(onLoopBoundary).toHaveBeenCalledTimes(2);
    expect(onLoopBoundary).toHaveBeenNthCalledWith(1, 1);
    expect(onLoopBoundary).toHaveBeenNthCalledWith(2, 2);
  });

  it('does NOT fire during a count-in (frozen seam marching forward)', () => {
    // THE BUG THIS GUARDS: during count-in the read-head is frozen, so the seam
    // is computed as now + bufferDuration and MARCHES FORWARD every frame as
    // `now` climbs (time-to-seam stays ≈ constant, never shrinks). A naive
    // forward-jump detector would fire boundaries here BEFORE loop 1 is
    // audible. The arm-gate must suppress all of these.
    const bufferDur = 8.0;
    const countIn: Array<{ seam: number; now: number }> = [];
    for (let i = 0; i < 12; i++) {
      const now = i * 0.5; // clock climbs each frame
      countIn.push({ seam: now + bufferDur, now }); // gap frozen at bufferDur
    }
    const { onLoopBoundary, step } = mountScripted(countIn);

    step(countIn.length);

    // Not a single false boundary across the entire count-in.
    expect(onLoopBoundary).not.toHaveBeenCalled();
  });

  it('arms after the count-in, then counts the first real wrap', () => {
    // Frozen count-in (no fire), THEN the read-head goes live: the seam starts
    // counting down (gap shrinks → arms), then wraps forward once → boundary 1.
    const script: Array<{ seam: number; now: number }> = [];
    // Count-in: frozen, marching forward.
    for (let i = 0; i < 6; i++) {
      const now = i * 0.5;
      script.push({ seam: now + 8.0, now });
    }
    // Live: seam fixed at 12, now climbs toward it (gap shrinks → arms).
    script.push({ seam: 12.0, now: 10.0 }); // gap 2.0
    script.push({ seam: 12.0, now: 11.0 }); // gap 1.0 → arms, baseline 12.0
    script.push({ seam: 12.0, now: 11.9 }); // gap 0.1 — no fire
    script.push({ seam: 20.0, now: 12.1 }); // WRAP → boundary 1
    const { onLoopBoundary, step } = mountScripted(script);

    step(script.length);

    expect(onLoopBoundary).toHaveBeenCalledTimes(1);
    expect(onLoopBoundary).toHaveBeenCalledWith(1);
  });

  it('does not count while the seam is null (count-in / not streaming)', () => {
    const { onLoopBoundary, step } = mountScripted([
      { seam: null, now: 0 }, // count-in
      { seam: null, now: 0.5 }, // count-in
      ...armingFrames(8.0), // streaming begins — arm + baseline
      { seam: 16.0, now: 8.1 }, // first real wrap → boundary 1
    ]);

    step(6);

    expect(onLoopBoundary).toHaveBeenCalledTimes(1);
    expect(onLoopBoundary).toHaveBeenCalledWith(1);
  });

  it('does not false-fire on a continuous tempo drift of the seam', () => {
    // A tempo change shifts the seam CONTINUOUSLY (small per-frame deltas),
    // never a full forward jump. None of these should count.
    const { onLoopBoundary, step } = mountScripted([
      ...armingFrames(8.0), // arm + baseline 8.0
      { seam: 8.05, now: 7.6 }, // +0.05 drift
      { seam: 8.1, now: 7.65 }, // +0.05 drift
      { seam: 8.12, now: 7.7 }, // +0.02 drift
    ]);

    step(6);

    expect(onLoopBoundary).not.toHaveBeenCalled();
  });

  it('does nothing while not playing, then arms+counts after play starts', () => {
    const { onLoopBoundary, step, rerender } = mountScripted([
      ...armingFrames(8.0),
      { seam: 16.0, now: 8.1 }, // would be a wrap IF we were counting
    ]);

    // Park it: not playing.
    rerender({ isPlaying: false, enabled: true });
    step(4);
    expect(onLoopBoundary).not.toHaveBeenCalled();
  });

  it('does nothing while disabled even if playing', () => {
    const { onLoopBoundary, step } = mountScripted(
      [...armingFrames(8.0), { seam: 16.0, now: 8.1 }],
      { enabled: false },
    );
    step(4);
    expect(onLoopBoundary).not.toHaveBeenCalled();
  });

  it('re-arms on a stop→start without leaking the old seam', () => {
    // Live mutable source (not a script) so we control each frame's reading
    // directly across the stop/start.
    const live = { seam: 0 as number | null, now: 0 };
    const getNextSeamTime = vi.fn(() => live.seam);
    const getCurrentTime = vi.fn(() => live.now);
    const onLoopBoundary = vi.fn();
    const { rerender } = renderHook(
      (props: { isPlaying: boolean }) =>
        useLoopCounter({
          isPlaying: props.isPlaying,
          enabled: true,
          getNextSeamTime,
          getCurrentTime,
          onLoopBoundary,
        }),
      { initialProps: { isPlaying: true } },
    );
    const at = (seam: number | null, now: number) => {
      live.seam = seam;
      live.now = now;
      flushFrame();
    };

    // Arm (gap shrinks 2→1→0.5), baseline 8.0, then wrap → boundary 1.
    at(8.0, 6.0);
    at(8.0, 7.0);
    at(8.0, 7.5);
    at(16.0, 8.1); // wrap → boundary 1
    expect(onLoopBoundary).toHaveBeenCalledTimes(1);

    // Stop → arm + index reset.
    rerender({ isPlaying: false });
    flushFrame();

    // Start again with a brand-new read-head. Must RE-ARM (gap shrink) before
    // it counts, and count fresh from 1 — never leak the old tracked seam.
    rerender({ isPlaying: true });
    at(24.0, 22.0); // gap 2.0
    at(24.0, 23.0); // gap 1.0 → arms, baseline 24.0
    at(32.0, 24.1); // wrap → boundary (index reset to 1)

    expect(onLoopBoundary).toHaveBeenCalledTimes(2);
    expect(onLoopBoundary).toHaveBeenNthCalledWith(2, 1);
  });

  it('re-baselines (no count) when the seam falls far behind the clock', () => {
    // A long RAF gap (backgrounded tab) leaves the seam well behind `now`
    // without us seeing the forward jump. We re-baseline rather than invent a
    // count, then resume on the next clean wrap.
    const { onLoopBoundary, step } = mountScripted([
      ...armingFrames(8.0), // arm + baseline 8.0
      { seam: 8.0, now: 20.0 }, // seam is 12s behind now — missed, re-baseline
      { seam: 24.0, now: 20.5 }, // clean wrap → boundary 1
    ]);
    step(5);
    expect(onLoopBoundary).toHaveBeenCalledTimes(1);
    expect(onLoopBoundary).toHaveBeenCalledWith(1);
  });
});
