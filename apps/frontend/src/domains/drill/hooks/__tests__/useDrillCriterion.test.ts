import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DrillCompletionCriterion } from '@bassnotion/contracts';
import { useDrillCriterion } from '../useDrillCriterion';

// The hook polls on a 250ms interval and accrues (now - prevTick)/1000 seconds
// while isPlaying. With fake timers, advancing the clock also advances Date.now,
// so elapsed tracks wall-clock advanced. We use act() around timer advances so
// React flushes the setState the interval triggers.
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useDrillCriterion — time', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const crit: DrillCompletionCriterion = { type: 'time', target: 0.05 }; // 3s

  it('accrues elapsed seconds only while playing, and meets at target', () => {
    const { result } = renderHook(() =>
      useDrillCriterion(crit, {
        isPlaying: true,
        getAudioPhase: () => null,
      }),
    );
    expect(result.current.isMet).toBe(false);
    expect(result.current.progress?.target).toBeCloseTo(3, 5);

    advance(4000); // 4s of playing > 3s target
    expect(result.current.progress?.current).toBeGreaterThanOrEqual(3);
    expect(result.current.isMet).toBe(true);
  });

  it('freezes accrual while paused, resumes without losing progress', () => {
    const { result, rerender } = renderHook(
      ({ playing }: { playing: boolean }) =>
        useDrillCriterion(crit, {
          isPlaying: playing,
          getAudioPhase: () => null,
        }),
      { initialProps: { playing: true } },
    );

    advance(1000); // ~1s accrued
    const afterFirst = result.current.progress?.current ?? 0;
    expect(afterFirst).toBeGreaterThanOrEqual(0.75);
    expect(result.current.isMet).toBe(false);

    // Pause and let wall-clock pass — must NOT accrue.
    rerender({ playing: false });
    advance(5000);
    const afterPause = result.current.progress?.current ?? 0;
    expect(afterPause).toBeCloseTo(afterFirst, 1); // unchanged
    expect(result.current.isMet).toBe(false);

    // Resume — continues from where it left off, not from zero.
    rerender({ playing: true });
    advance(3000);
    expect(result.current.progress?.current ?? 0).toBeGreaterThan(afterPause);
    expect(result.current.isMet).toBe(true); // ~1s + ~3s ≥ 3s
  });
});

describe('useDrillCriterion — loops', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts a loop each time phase WRAPS (decreases), meets at target', () => {
    // Drive phase manually: ramps up, then wraps to a low value = one loop.
    let phase = 0;
    const { result } = renderHook(() =>
      useDrillCriterion(
        { type: 'loops', target: 2 },
        { isPlaying: true, getAudioPhase: () => phase },
      ),
    );

    expect(result.current.progress).toEqual({ current: 0, target: 2 });

    // First lap: 0.2 → 0.9 (no wrap)
    phase = 0.2;
    advance(250);
    phase = 0.9;
    advance(250);
    expect(result.current.progress?.current).toBe(0);

    // Wrap → loop 1
    phase = 0.05;
    advance(250);
    expect(result.current.progress?.current).toBe(1);
    expect(result.current.isMet).toBe(false);

    // Second lap up then wrap → loop 2 → met
    phase = 0.9;
    advance(250);
    phase = 0.05;
    advance(250);
    expect(result.current.progress?.current).toBe(2);
    expect(result.current.isMet).toBe(true);
  });

  it('does not count while paused or when phase is null (not streaming)', () => {
    let phase: number | null = null;
    const { result, rerender } = renderHook(
      ({ playing }: { playing: boolean }) =>
        useDrillCriterion(
          { type: 'loops', target: 1 },
          { isPlaying: playing, getAudioPhase: () => phase },
        ),
      { initialProps: { playing: true } },
    );

    // phase null (count-in / not streaming) → no counting even though a "wrap"
    // pattern would otherwise occur.
    phase = 0.9;
    advance(250);
    phase = null;
    advance(250);
    phase = 0.05;
    advance(250);
    expect(result.current.progress?.current).toBe(0);

    // Paused → no counting.
    rerender({ playing: false });
    phase = 0.9;
    advance(250);
    phase = 0.05;
    advance(250);
    expect(result.current.progress?.current).toBe(0);
  });
});

describe('useDrillCriterion — onMet (training-engine signal seam)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const crit: DrillCompletionCriterion = { type: 'time', target: 0.05 }; // 3s

  it('fires once on the false→true edge with the progress payload', () => {
    const onMet = vi.fn();
    const { result } = renderHook(() =>
      useDrillCriterion(
        crit,
        { isPlaying: true, getAudioPhase: () => null },
        onMet,
      ),
    );
    expect(onMet).not.toHaveBeenCalled();

    advance(4000); // crosses the 3s target
    expect(result.current.isMet).toBe(true);
    expect(onMet).toHaveBeenCalledTimes(1);
    expect(onMet.mock.calls[0][0]).toMatchObject({ target: 3 });
    expect(onMet.mock.calls[0][0].current).toBeGreaterThanOrEqual(3);

    // Stays met on subsequent ticks — must NOT re-fire.
    advance(2000);
    expect(onMet).toHaveBeenCalledTimes(1);
  });

  it('does not fire while the criterion is unmet', () => {
    const onMet = vi.fn();
    renderHook(() =>
      useDrillCriterion(
        crit,
        { isPlaying: true, getAudioPhase: () => null },
        onMet,
      ),
    );
    advance(1000); // 1s < 3s target
    expect(onMet).not.toHaveBeenCalled();
  });

  it('omitting onMet is safe (existing 2-arg callers unaffected)', () => {
    const { result } = renderHook(() =>
      useDrillCriterion(crit, { isPlaying: true, getAudioPhase: () => null }),
    );
    advance(4000);
    expect(result.current.isMet).toBe(true); // no throw without a callback
  });
});

describe('useDrillCriterion — conquer / manual / none', () => {
  it('is button-driven: isMet false, no progress', () => {
    const { result: conquer } = renderHook(() =>
      useDrillCriterion(
        { type: 'conquer' },
        { isPlaying: true, getAudioPhase: () => null },
      ),
    );
    expect(conquer.current).toEqual({ isMet: false, progress: null });

    const { result: manual } = renderHook(() =>
      useDrillCriterion(
        { type: 'manual' },
        { isPlaying: true, getAudioPhase: () => null },
      ),
    );
    expect(manual.current).toEqual({ isMet: false, progress: null });

    const { result: none } = renderHook(() =>
      useDrillCriterion(undefined, {
        isPlaying: true,
        getAudioPhase: () => null,
      }),
    );
    expect(none.current).toEqual({ isMet: false, progress: null });
  });
});
