/**
 * useTimeTranspose — the FREESTYLE time-based key cycler. We use fake timers and assert the
 * sequence + cadence of setKey() calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTimeTranspose } from './useTimeTranspose';
import type { DynamicLoopConfig } from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/useDynamicLoop';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] });
});
afterEach(() => {
  vi.useRealTimers();
});

const pingPong = (interval: number, everyN: number): DynamicLoopConfig => ({
  intervalSemitones: interval,
  everyN,
  mode: 'ping-pong',
});

describe('useTimeTranspose', () => {
  it('does nothing while inactive', () => {
    const setKey = vi.fn();
    renderHook(() =>
      useTimeTranspose({
        active: false,
        config: pingPong(2, 30),
        homeSemitones: 0,
        maxSemitones: 6,
        setKey,
      }),
    );
    act(() => vi.advanceTimersByTime(120_000));
    expect(setKey).not.toHaveBeenCalled();
  });

  it('ping-pongs home↔away every N SECONDS while active', () => {
    const setKey = vi.fn();
    renderHook(() =>
      useTimeTranspose({
        active: true,
        config: pingPong(2, 30), // every 30s, +2 semitones
        homeSemitones: 0,
        maxSemitones: 6,
        setKey,
      }),
    );
    // Nothing fires before the first interval.
    act(() => vi.advanceTimersByTime(29_000));
    expect(setKey).not.toHaveBeenCalled();
    // 30s → away (+2).
    act(() => vi.advanceTimersByTime(1_500));
    expect(setKey).toHaveBeenLastCalledWith(2);
    // 60s → back home (0).
    act(() => vi.advanceTimersByTime(30_000));
    expect(setKey).toHaveBeenLastCalledWith(0);
    // 90s → away again.
    act(() => vi.advanceTimersByTime(30_000));
    expect(setKey).toHaveBeenLastCalledWith(2);
  });

  it('travel mode climbs by the interval each fire (wrapping into range)', () => {
    const setKey = vi.fn();
    renderHook(() =>
      useTimeTranspose({
        active: true,
        config: { intervalSemitones: 3, everyN: 20, mode: 'travel' },
        homeSemitones: 0,
        maxSemitones: 6,
        setKey,
      }),
    );
    act(() => vi.advanceTimersByTime(20_000));
    expect(setKey).toHaveBeenLastCalledWith(3);
    act(() => vi.advanceTimersByTime(20_000));
    expect(setKey).toHaveBeenLastCalledWith(6);
    // next rung wraps below (6+3=9 → wraps into ±6 range as −3).
    act(() => vi.advanceTimersByTime(20_000));
    expect(setKey).toHaveBeenLastCalledWith(-3);
  });

  it('stops firing when it becomes inactive', () => {
    const setKey = vi.fn();
    const { rerender } = renderHook(
      (props: { active: boolean }) =>
        useTimeTranspose({
          active: props.active,
          config: pingPong(2, 30),
          homeSemitones: 0,
          maxSemitones: 6,
          setKey,
        }),
      { initialProps: { active: true } },
    );
    act(() => vi.advanceTimersByTime(30_000));
    expect(setKey).toHaveBeenCalledTimes(1);
    rerender({ active: false });
    act(() => vi.advanceTimersByTime(120_000));
    expect(setKey).toHaveBeenCalledTimes(1); // no more fires
  });

  it('floors a too-small everyN to 5s (never spins)', () => {
    const setKey = vi.fn();
    renderHook(() =>
      useTimeTranspose({
        active: true,
        config: pingPong(2, 0), // degenerate
        homeSemitones: 0,
        maxSemitones: 6,
        setKey,
      }),
    );
    act(() => vi.advanceTimersByTime(4_000));
    expect(setKey).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1_500)); // past the 5s floor
    expect(setKey).toHaveBeenCalledTimes(1);
  });
});
