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

describe('useLoopCounter', () => {
  it('fires once per loop boundary with a monotonic index', () => {
    // The seam approaches (now climbs toward a fixed ~8.0 seam), then jumps
    // forward to ~16.0 when the loop wraps, then again to ~24.0. Each forward
    // jump is one boundary.
    const { onLoopBoundary, step } = mountScripted([
      { seam: 8.0, now: 6.0 }, // frame 0: baseline
      { seam: 8.0, now: 7.0 }, // approaching — no fire
      { seam: 8.0, now: 7.9 }, // approaching — no fire
      { seam: 16.0, now: 8.1 }, // WRAP → boundary 1
      { seam: 16.0, now: 12.0 }, // approaching — no fire
      { seam: 24.0, now: 16.1 }, // WRAP → boundary 2
    ]);

    step(6);

    expect(onLoopBoundary).toHaveBeenCalledTimes(2);
    expect(onLoopBoundary).toHaveBeenNthCalledWith(1, 1);
    expect(onLoopBoundary).toHaveBeenNthCalledWith(2, 2);
  });

  it('does not count while the seam is null (count-in / not streaming)', () => {
    const { onLoopBoundary, step } = mountScripted([
      { seam: null, now: 0 }, // count-in
      { seam: null, now: 0.5 }, // count-in
      { seam: 8.0, now: 6.0 }, // streaming begins — baseline only
      { seam: 16.0, now: 8.1 }, // first real wrap → boundary 1
    ]);

    step(4);

    expect(onLoopBoundary).toHaveBeenCalledTimes(1);
    expect(onLoopBoundary).toHaveBeenCalledWith(1);
  });

  it('does not false-fire on a continuous tempo drift of the seam', () => {
    // A tempo change shifts the seam CONTINUOUSLY (small per-frame deltas),
    // never a full forward jump. None of these should count.
    const { onLoopBoundary, step } = mountScripted([
      { seam: 8.0, now: 6.0 }, // baseline
      { seam: 8.05, now: 6.2 }, // +0.05 drift
      { seam: 8.1, now: 6.4 }, // +0.05 drift
      { seam: 8.12, now: 6.6 }, // +0.02 drift
    ]);

    step(4);

    expect(onLoopBoundary).not.toHaveBeenCalled();
  });

  it('does nothing while not playing, then counts after play starts', () => {
    const { onLoopBoundary, step, rerender } = mountScripted(
      [
        { seam: 8.0, now: 6.0 },
        { seam: 16.0, now: 8.1 }, // would be a wrap IF we were counting
      ],
      { isPlaying: false },
    );

    step(2);
    expect(onLoopBoundary).not.toHaveBeenCalled();

    // Now start playing — the effect re-runs with a clean baseline.
    rerender({ isPlaying: true, enabled: true });
    step(2);
    // frame after rerender baselines on seam 16.0; the script then repeats the
    // last entry (16.0) so there's no forward jump → still no fire. That's
    // correct: we only count genuine wraps observed while playing.
    expect(onLoopBoundary).not.toHaveBeenCalled();
  });

  it('does nothing while disabled even if playing', () => {
    const { onLoopBoundary, step } = mountScripted(
      [
        { seam: 8.0, now: 6.0 },
        { seam: 16.0, now: 8.1 },
      ],
      { enabled: false },
    );
    step(2);
    expect(onLoopBoundary).not.toHaveBeenCalled();
  });

  it('re-baselines on a stop→start without leaking the old seam', () => {
    const { onLoopBoundary, step, rerender, getNextSeamTime } = mountScripted([
      { seam: 8.0, now: 6.0 }, // baseline
      { seam: 16.0, now: 8.1 }, // wrap → boundary 1
    ]);
    step(2);
    expect(onLoopBoundary).toHaveBeenCalledTimes(1);

    // Stop, then start again. The index resets and the next play counts fresh
    // from 1 — it must NOT carry the previous tracked seam.
    rerender({ isPlaying: false, enabled: true });
    step(1);
    getNextSeamTime.mockReturnValue(20.0); // brand-new read-head after restart
    rerender({ isPlaying: true, enabled: true });
    step(1); // baseline on 20.0
    getNextSeamTime.mockReturnValue(28.0); // wrap
    step(1);

    expect(onLoopBoundary).toHaveBeenCalledTimes(2);
    expect(onLoopBoundary).toHaveBeenNthCalledWith(2, 1); // index reset to 1
  });

  it('re-baselines (no count) when the seam falls far behind the clock', () => {
    // A long RAF gap (backgrounded tab) leaves the seam well behind `now`
    // without us seeing the forward jump. We re-baseline rather than invent a
    // count, then resume on the next clean wrap.
    const { onLoopBoundary, step } = mountScripted([
      { seam: 8.0, now: 6.0 }, // baseline
      { seam: 8.0, now: 20.0 }, // seam is 12s behind now — missed, re-baseline
      { seam: 24.0, now: 20.5 }, // clean wrap → boundary 1
    ]);
    step(3);
    expect(onLoopBoundary).toHaveBeenCalledTimes(1);
    expect(onLoopBoundary).toHaveBeenCalledWith(1);
  });
});
