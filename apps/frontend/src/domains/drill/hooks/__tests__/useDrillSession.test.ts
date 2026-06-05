import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDrillSession } from '../useDrillSession';

describe('useDrillSession', () => {
  it('starts on the plan phase', () => {
    const { result } = renderHook(() =>
      useDrillSession({
        isDrill: true,
        brickIds: ['a', 'b'],
        completedIds: new Set(),
      }),
    );
    expect(result.current.phase).toBe('plan');
  });

  it('start() moves plan → running', () => {
    const { result } = renderHook(() =>
      useDrillSession({
        isDrill: true,
        brickIds: ['a', 'b'],
        completedIds: new Set(),
      }),
    );
    act(() => result.current.start());
    expect(result.current.phase).toBe('running');
  });

  it('auto-advances running → summary once every brick is complete', () => {
    const { result, rerender } = renderHook(
      ({ completed }: { completed: Set<string> }) =>
        useDrillSession({
          isDrill: true,
          brickIds: ['a', 'b'],
          completedIds: completed,
        }),
      { initialProps: { completed: new Set<string>() } },
    );

    act(() => result.current.start());
    expect(result.current.phase).toBe('running');

    // Only one brick done → stay running.
    rerender({ completed: new Set(['a']) });
    expect(result.current.phase).toBe('running');

    // Both done → flip to summary.
    rerender({ completed: new Set(['a', 'b']) });
    expect(result.current.phase).toBe('summary');
  });

  it('does NOT auto-advance to summary from the plan phase', () => {
    // All bricks already complete (e.g. re-entering a finished drill): the
    // plan gate must still show, not bounce straight to summary.
    const { result } = renderHook(() =>
      useDrillSession({
        isDrill: true,
        brickIds: ['a', 'b'],
        completedIds: new Set(['a', 'b']),
      }),
    );
    expect(result.current.phase).toBe('plan');
  });

  it('restart() returns summary → plan and re-arms the run', () => {
    const { result, rerender } = renderHook(
      ({ completed }: { completed: Set<string> }) =>
        useDrillSession({
          isDrill: true,
          brickIds: ['a'],
          completedIds: completed,
        }),
      { initialProps: { completed: new Set<string>() } },
    );

    act(() => result.current.start());
    rerender({ completed: new Set(['a']) });
    expect(result.current.phase).toBe('summary');

    // restart → plan, and it must NOT immediately bounce back to summary even
    // though completedIds still has 'a' (the guard only fires from running).
    act(() => result.current.restart());
    expect(result.current.phase).toBe('plan');
    rerender({ completed: new Set(['a']) });
    expect(result.current.phase).toBe('plan');
  });

  it('is inert when isDrill is false (no auto-advance)', () => {
    const { result, rerender } = renderHook(
      ({ completed }: { completed: Set<string> }) =>
        useDrillSession({
          isDrill: false,
          brickIds: ['a'],
          completedIds: completed,
        }),
      { initialProps: { completed: new Set<string>() } },
    );
    act(() => result.current.start());
    rerender({ completed: new Set(['a']) });
    // isDrill=false → the auto-advance effect bails; stays running.
    expect(result.current.phase).toBe('running');
  });

  it('an empty drill (no bricks) does not auto-advance', () => {
    const { result } = renderHook(() =>
      useDrillSession({ isDrill: true, brickIds: [], completedIds: new Set() }),
    );
    act(() => result.current.start());
    expect(result.current.phase).toBe('running');
  });
});
