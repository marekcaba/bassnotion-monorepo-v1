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
  script: Array<{ seam: number | null; now: number; countdown?: boolean }>,
  opts: { isPlaying?: boolean; enabled?: boolean } = {},
) {
  let frame = 0;
  const read = () =>
    script[Math.min(frame, script.length - 1)] ?? { seam: null, now: 0 };
  const getNextSeamTime = vi.fn(() => read().seam);
  const getCurrentTime = vi.fn(() => read().now);
  const onLoopApproaching = vi.fn();

  const utils = renderHook(
    // `tick` is a dummy prop bumped each step so React re-renders the component
    // body — this updates the hook's internal refs (e.g. isCountingDown) to the
    // CURRENT scripted frame, mirroring how countdownState re-renders the real
    // component. Without it the refs freeze at their mount values.
    (props: { isPlaying: boolean; enabled: boolean; tick: number }) =>
      useLoopCounter({
        isPlaying: props.isPlaying,
        enabled: props.enabled,
        // The count-in flag is read live off the current scripted frame.
        isCountingDown: read().countdown ?? false,
        getNextSeamTime,
        getCurrentTime,
        onLoopApproaching,
      }),
    {
      initialProps: {
        isPlaying: opts.isPlaying ?? true,
        enabled: opts.enabled ?? true,
        tick: 0,
      },
    },
  );

  // Advance the scripted frame each time we flush. We re-render BEFORE flushing
  // so the component body (and its refs) reflect the new frame, then run the
  // RAF tick which reads those refs.
  let renderTick = 0;
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      renderTick += 1;
      utils.rerender({
        isPlaying: opts.isPlaying ?? true,
        enabled: opts.enabled ?? true,
        tick: renderTick,
      });
      flushFrame();
      frame += 1;
    }
  };

  return { getNextSeamTime, onLoopApproaching, step, ...utils };
}

// One loop's worth of scripted frames (countdown off): a FAR frame (seam well
// ahead — no approach fire), a NEAR frame (seam within the 0.25s lead window —
// fires onLoopApproaching once), then the WRAP (seam jumps forward a loop).
function loopFrames(
  seamBefore: number,
  seamAfter: number,
): Array<{ seam: number; now: number }> {
  return [
    { seam: seamBefore, now: seamBefore - 1.0 }, // FAR — outside lead window
    { seam: seamBefore, now: seamBefore - 0.1 }, // NEAR — fires approach
    { seam: seamAfter, now: seamBefore + 0.1 }, // WRAP — loop completed
  ];
}

describe('useLoopCounter', () => {
  it('fires onLoopApproaching once per loop with the completed-loops count', () => {
    // Loop 0 (seam 8) approaches → fire(0). Wrap to 16. Loop 1 (seam 16)
    // approaches → fire(1). Wrap to 24. The count is loops COMPLETED before the
    // approaching loop's own wrap.
    const { onLoopApproaching, step } = mountScripted([
      { seam: 8.0, now: 6.0 }, // baseline (far)
      ...loopFrames(8.0, 16.0), // loop 0: near→fire(0), wrap
      ...loopFrames(16.0, 24.0), // loop 1: near→fire(1), wrap
    ]);

    step(7);

    expect(onLoopApproaching).toHaveBeenCalledTimes(2);
    expect(onLoopApproaching).toHaveBeenNthCalledWith(1, 0);
    expect(onLoopApproaching).toHaveBeenNthCalledWith(2, 1);
  });

  it('does NOT fire during a count-in (frozen seam marching forward)', () => {
    // During count-in the read-head is frozen, so the seam = now + bufferDur and
    // MARCHES FORWARD every frame. The isCountingDown gate suppresses all of
    // these (flagged countdown:true) — including any moment the gap is small.
    const bufferDur = 0.2; // tiny, so the gap is always inside the lead window
    const countIn: Array<{ seam: number; now: number; countdown: boolean }> =
      [];
    for (let i = 0; i < 12; i++) {
      const now = i * 0.5;
      countIn.push({ seam: now + bufferDur, now, countdown: true });
    }
    const { onLoopApproaching, step } = mountScripted(countIn);

    step(countIn.length);

    expect(onLoopApproaching).not.toHaveBeenCalled();
  });

  it('suppresses the count-in→loop-1 wrap, then fires for loop 1', () => {
    // The bass stem streams during the count-in and wraps once at the count-in→
    // loop-1 boundary. While countdown:true that wrap is suppressed (held at
    // null). Once the count-in ends, the FIRST counted loop is loop 0, and its
    // approach fires(0) — never counting the count-in wrap.
    const script: Array<{ seam: number; now: number; countdown?: boolean }> =
      [];
    // Count-in: live read-head approaching + wrapping, but countdown:true.
    script.push({ seam: 9.0, now: 8.9, countdown: true }); // near (suppressed)
    script.push({ seam: 26.0, now: 9.1, countdown: true }); // count-in WRAP (suppressed)
    // Count-in over → loop 0 plays (seam 26), approaches, wraps.
    script.push({ seam: 26.0, now: 11.0 }); // baseline (far)
    script.push(...loopFrames(26.0, 43.0)); // loop 0: near→fire(0), wrap
    const { onLoopApproaching, step } = mountScripted(script);

    step(script.length);

    expect(onLoopApproaching).toHaveBeenCalledTimes(1);
    expect(onLoopApproaching).toHaveBeenNthCalledWith(1, 0);
  });

  it('does not fire while the seam is null (not streaming)', () => {
    const { onLoopApproaching, step } = mountScripted([
      { seam: null, now: 0 },
      { seam: null, now: 0.5 },
      { seam: 8.0, now: 6.0 }, // streaming begins — baseline (far)
      ...loopFrames(8.0, 16.0), // loop 0: near→fire(0), wrap
    ]);

    step(6);

    expect(onLoopApproaching).toHaveBeenCalledTimes(1);
    expect(onLoopApproaching).toHaveBeenCalledWith(0);
  });

  it('fires at most once per loop (not every near-seam frame)', () => {
    // Several consecutive frames inside the lead window must yield ONE fire.
    const { onLoopApproaching, step } = mountScripted([
      { seam: 8.0, now: 6.0 }, // baseline (far)
      { seam: 8.0, now: 7.85 }, // near → fire(0)
      { seam: 8.0, now: 7.9 }, // still near — no second fire
      { seam: 8.0, now: 7.95 }, // still near — no second fire
    ]);
    step(4);
    expect(onLoopApproaching).toHaveBeenCalledTimes(1);
    expect(onLoopApproaching).toHaveBeenCalledWith(0);
  });

  it('does nothing while not playing', () => {
    const { onLoopApproaching, step } = mountScripted(
      [{ seam: 8.0, now: 6.0 }, ...loopFrames(8.0, 16.0)],
      { isPlaying: false },
    );
    step(4);
    expect(onLoopApproaching).not.toHaveBeenCalled();
  });

  it('does nothing while disabled even if playing', () => {
    const { onLoopApproaching, step } = mountScripted(
      [{ seam: 8.0, now: 6.0 }, ...loopFrames(8.0, 16.0)],
      { enabled: false },
    );
    step(4);
    expect(onLoopApproaching).not.toHaveBeenCalled();
  });

  it('re-baselines on a stop→start without leaking the old seam', () => {
    const live = { seam: 0 as number | null, now: 0, cd: false };
    const getNextSeamTime = vi.fn(() => live.seam);
    const getCurrentTime = vi.fn(() => live.now);
    const onLoopApproaching = vi.fn();
    const { rerender } = renderHook(
      (props: { isPlaying: boolean }) =>
        useLoopCounter({
          isPlaying: props.isPlaying,
          enabled: true,
          isCountingDown: live.cd,
          getNextSeamTime,
          getCurrentTime,
          onLoopApproaching,
        }),
      { initialProps: { isPlaying: true } },
    );
    const at = (seam: number | null, now: number) => {
      live.seam = seam;
      live.now = now;
      flushFrame();
    };

    at(8.0, 6.0); // baseline (far)
    at(8.0, 7.9); // near → fire(0)
    expect(onLoopApproaching).toHaveBeenCalledTimes(1);
    expect(onLoopApproaching).toHaveBeenLastCalledWith(0);

    // Stop → state reset.
    rerender({ isPlaying: false });
    flushFrame();

    // Start again with a brand-new read-head; count resets to 0.
    rerender({ isPlaying: true });
    at(24.0, 22.0); // baseline (far)
    at(24.0, 23.9); // near → fire(0) fresh
    expect(onLoopApproaching).toHaveBeenCalledTimes(2);
    expect(onLoopApproaching).toHaveBeenNthCalledWith(2, 0);
  });
});
