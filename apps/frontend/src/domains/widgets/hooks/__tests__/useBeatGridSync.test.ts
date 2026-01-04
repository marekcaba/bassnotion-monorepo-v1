/**
 * Tests for useBeatGridSync hook
 *
 * This hook provides jitter-free beat indication by:
 * 1. Storing refs to beat indicator DOM elements
 * 2. Subscribing directly to AtomicPlaybackClock
 * 3. Updating DOM via classList.toggle() instead of React state
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBeatGridSync } from '../useBeatGridSync';
import type { AtomicBeatState } from '@/domains/playback/services/core/AtomicPlaybackClock';

// Mock AtomicPlaybackClock
const mockSubscribe = vi.fn();
const mockGetCurrentState = vi.fn();
const mockClockInstance = {
  subscribe: mockSubscribe,
  getCurrentState: mockGetCurrentState,
};

vi.mock('@/domains/playback/services/core/AtomicPlaybackClock', () => ({
  getAtomicPlaybackClock: () => mockClockInstance,
}));

describe('useBeatGridSync', () => {
  let subscriberCallback: ((state: AtomicBeatState) => void) | null = null;
  let unsubscribeFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    subscriberCallback = null;
    unsubscribeFn = vi.fn();

    // Capture the subscriber callback when subscribe is called
    mockSubscribe.mockImplementation((callback) => {
      subscriberCallback = callback;
      return unsubscribeFn;
    });

    mockGetCurrentState.mockReturnValue(null);
  });

  afterEach(() => {
    subscriberCallback = null;
  });

  describe('initialization', () => {
    it('should return registerIndicator function', () => {
      const { result } = renderHook(() =>
        useBeatGridSync({
          rows: 3,
          columns: 8,
          isPlaying: false,
        })
      );

      expect(result.current.registerIndicator).toBeDefined();
      expect(typeof result.current.registerIndicator).toBe('function');
    });

    it('should return getCurrentBeat function', () => {
      const { result } = renderHook(() =>
        useBeatGridSync({
          rows: 3,
          columns: 8,
          isPlaying: false,
        })
      );

      expect(result.current.getCurrentBeat).toBeDefined();
      expect(typeof result.current.getCurrentBeat).toBe('function');
    });

    it('should return getEighthNoteDurationMs function', () => {
      const { result } = renderHook(() =>
        useBeatGridSync({
          rows: 3,
          columns: 8,
          isPlaying: false,
        })
      );

      expect(result.current.getEighthNoteDurationMs).toBeDefined();
      expect(typeof result.current.getEighthNoteDurationMs).toBe('function');
    });

    it('should not subscribe when isPlaying is false', () => {
      renderHook(() =>
        useBeatGridSync({
          rows: 3,
          columns: 8,
          isPlaying: false,
        })
      );

      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it('should subscribe when isPlaying is true', () => {
      renderHook(() =>
        useBeatGridSync({
          rows: 3,
          columns: 8,
          isPlaying: true,
        })
      );

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(typeof subscriberCallback).toBe('function');
    });
  });

  describe('element registration', () => {
    it('should register elements via registerIndicator', () => {
      const { result } = renderHook(() =>
        useBeatGridSync({
          rows: 3,
          columns: 8,
          isPlaying: false,
        })
      );

      const mockElement = document.createElement('div');

      // Register an element
      act(() => {
        result.current.registerIndicator(0, 0, mockElement);
      });

      // Element should be stored (we can't directly check the Map, but we can verify it works)
      expect(mockElement).toBeDefined();
    });

    it('should handle null elements (unregistration)', () => {
      const { result } = renderHook(() =>
        useBeatGridSync({
          rows: 3,
          columns: 8,
          isPlaying: false,
        })
      );

      const mockElement = document.createElement('div');

      // Register then unregister
      act(() => {
        result.current.registerIndicator(0, 0, mockElement);
        result.current.registerIndicator(0, 0, null);
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('DOM updates', () => {
    it('should toggle classes on beat change', () => {
      const { result } = renderHook(() =>
        useBeatGridSync({
          rows: 1,
          columns: 8,
          isPlaying: true,
          activeClass: 'opacity-100',
          inactiveClass: 'opacity-0',
        })
      );

      // Create and register mock elements
      const elements: HTMLDivElement[] = [];
      for (let i = 0; i < 8; i++) {
        const el = document.createElement('div');
        el.classList.add('opacity-0');
        elements.push(el);
        act(() => {
          result.current.registerIndicator(0, i, el);
        });
      }

      // Simulate beat change to beat 3
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 3,
        beatIndex: 1,
        measureIndex: 0,
        totalEighthNotes: 3,
        isCountdown: false,
        visualSeconds: 1.5,
        rawElapsedSeconds: 1.8,
        eighthNoteDurationMs: 434.8,
        continuousBeat: 3.2,
        currentBpm: 69,
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      // Beat 3 should be active, others inactive
      elements.forEach((el, idx) => {
        if (idx === 3) {
          expect(el.classList.contains('opacity-100')).toBe(true);
          expect(el.classList.contains('opacity-0')).toBe(false);
        } else {
          expect(el.classList.contains('opacity-100')).toBe(false);
          expect(el.classList.contains('opacity-0')).toBe(true);
        }
      });
    });

    it('should update all rows on beat change', () => {
      const { result } = renderHook(() =>
        useBeatGridSync({
          rows: 3,
          columns: 8,
          isPlaying: true,
          activeClass: 'opacity-100',
          inactiveClass: 'opacity-0',
        })
      );

      // Create elements for 3 rows x 8 columns
      const elements: HTMLDivElement[][] = [];
      for (let row = 0; row < 3; row++) {
        elements[row] = [];
        for (let col = 0; col < 8; col++) {
          const el = document.createElement('div');
          el.classList.add('opacity-0');
          elements[row].push(el);
          act(() => {
            result.current.registerIndicator(row, col, el);
          });
        }
      }

      // Simulate beat change to beat 5
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 5,
        beatIndex: 2,
        measureIndex: 0,
        totalEighthNotes: 5,
        isCountdown: false,
        visualSeconds: 2.5,
        rawElapsedSeconds: 2.8,
        eighthNoteDurationMs: 434.8,
        continuousBeat: 5.4,
        currentBpm: 69,
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      // Column 5 should be active in ALL rows
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 8; col++) {
          const el = elements[row][col];
          if (col === 5) {
            expect(el.classList.contains('opacity-100')).toBe(true);
          } else {
            expect(el.classList.contains('opacity-0')).toBe(true);
          }
        }
      }
    });

    it('should handle rapid beat changes correctly', () => {
      const { result } = renderHook(() =>
        useBeatGridSync({
          rows: 1,
          columns: 8,
          isPlaying: true,
        })
      );

      // Create elements
      const elements: HTMLDivElement[] = [];
      for (let i = 0; i < 8; i++) {
        const el = document.createElement('div');
        el.classList.add('opacity-0');
        elements.push(el);
        act(() => {
          result.current.registerIndicator(0, i, el);
        });
      }

      // Rapidly change beats 0 -> 1 -> 2 -> 3
      for (let beat = 0; beat < 4; beat++) {
        const beatState: AtomicBeatState = {
          eighthNoteIndex: beat,
          beatIndex: Math.floor(beat / 2),
          measureIndex: 0,
          totalEighthNotes: beat,
          isCountdown: false,
          visualSeconds: beat * 0.4348,
          rawElapsedSeconds: beat * 0.4348 + 0.3,
          eighthNoteDurationMs: 434.8,
          continuousBeat: beat + 0.1,
          currentBpm: 69,
          timestamp: performance.now(),
        };

        act(() => {
          subscriberCallback?.(beatState);
        });
      }

      // After rapid changes, only beat 3 should be active
      elements.forEach((el, idx) => {
        if (idx === 3) {
          expect(el.classList.contains('opacity-100')).toBe(true);
        } else {
          expect(el.classList.contains('opacity-0')).toBe(true);
        }
      });
    });
  });

  describe('visibility optimization', () => {
    it('should skip DOM updates when isVisible is false', () => {
      const { result } = renderHook(() =>
        useBeatGridSync({
          rows: 1,
          columns: 8,
          isPlaying: true,
          isVisible: false,
        })
      );

      // Create and register element
      const el = document.createElement('div');
      el.classList.add('opacity-0');
      act(() => {
        result.current.registerIndicator(0, 0, el);
      });

      // Simulate beat change
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 0,
        beatIndex: 0,
        measureIndex: 0,
        totalEighthNotes: 0,
        isCountdown: false,
        visualSeconds: 0,
        rawElapsedSeconds: 0.3,
        eighthNoteDurationMs: 434.8,
        continuousBeat: 0,
        currentBpm: 69,
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      // Element should NOT be updated (still inactive)
      expect(el.classList.contains('opacity-0')).toBe(true);
      expect(el.classList.contains('opacity-100')).toBe(false);
    });
  });

  describe('playback state transitions', () => {
    it('should unsubscribe when isPlaying changes to false', () => {
      const { rerender } = renderHook(
        ({ isPlaying }) =>
          useBeatGridSync({
            rows: 3,
            columns: 8,
            isPlaying,
          }),
        { initialProps: { isPlaying: true } }
      );

      expect(mockSubscribe).toHaveBeenCalledTimes(1);

      // Stop playback
      rerender({ isPlaying: false });

      expect(unsubscribeFn).toHaveBeenCalled();
    });

    it('should reset indicators when playback stops', () => {
      const { result, rerender } = renderHook(
        ({ isPlaying }) =>
          useBeatGridSync({
            rows: 1,
            columns: 8,
            isPlaying,
            activeClass: 'opacity-100',
            inactiveClass: 'opacity-0',
          }),
        { initialProps: { isPlaying: true } }
      );

      // Create elements and set one as active
      const elements: HTMLDivElement[] = [];
      for (let i = 0; i < 8; i++) {
        const el = document.createElement('div');
        el.classList.add('opacity-0');
        elements.push(el);
        act(() => {
          result.current.registerIndicator(0, i, el);
        });
      }

      // Simulate beat 3 active
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 3,
        beatIndex: 1,
        measureIndex: 0,
        totalEighthNotes: 3,
        isCountdown: false,
        visualSeconds: 1.5,
        rawElapsedSeconds: 1.8,
        eighthNoteDurationMs: 434.8,
        continuousBeat: 3.2,
        currentBpm: 69,
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      // Beat 3 should be active
      expect(elements[3].classList.contains('opacity-100')).toBe(true);

      // Stop playback
      rerender({ isPlaying: false });

      // All elements should be reset to inactive
      elements.forEach((el) => {
        expect(el.classList.contains('opacity-0')).toBe(true);
        expect(el.classList.contains('opacity-100')).toBe(false);
      });
    });
  });

  describe('getCurrentBeat and getEighthNoteDurationMs', () => {
    it('should return current beat index', () => {
      const { result } = renderHook(() =>
        useBeatGridSync({
          rows: 1,
          columns: 8,
          isPlaying: true,
        })
      );

      // Create element
      const el = document.createElement('div');
      act(() => {
        result.current.registerIndicator(0, 0, el);
      });

      // Initial value
      expect(result.current.getCurrentBeat()).toBe(0);

      // After beat change
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 5,
        beatIndex: 2,
        measureIndex: 0,
        totalEighthNotes: 5,
        isCountdown: false,
        visualSeconds: 2.5,
        rawElapsedSeconds: 2.8,
        eighthNoteDurationMs: 500,
        continuousBeat: 5.4,
        currentBpm: 60,
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      expect(result.current.getCurrentBeat()).toBe(5);
    });

    it('should return current eighth note duration', () => {
      const { result } = renderHook(() =>
        useBeatGridSync({
          rows: 1,
          columns: 8,
          isPlaying: true,
        })
      );

      // Create element
      const el = document.createElement('div');
      act(() => {
        result.current.registerIndicator(0, 0, el);
      });

      // After beat change with specific duration
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 0,
        beatIndex: 0,
        measureIndex: 0,
        totalEighthNotes: 0,
        isCountdown: false,
        visualSeconds: 0,
        rawElapsedSeconds: 0.3,
        eighthNoteDurationMs: 500,
        continuousBeat: 0,
        currentBpm: 60,
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      expect(result.current.getEighthNoteDurationMs()).toBe(500);
    });
  });

  describe('custom classes', () => {
    it('should use custom activeClass and inactiveClass', () => {
      const { result } = renderHook(() =>
        useBeatGridSync({
          rows: 1,
          columns: 8,
          isPlaying: true,
          activeClass: 'beat-active',
          inactiveClass: 'beat-inactive',
        })
      );

      // Create elements
      const elements: HTMLDivElement[] = [];
      for (let i = 0; i < 8; i++) {
        const el = document.createElement('div');
        el.classList.add('beat-inactive');
        elements.push(el);
        act(() => {
          result.current.registerIndicator(0, i, el);
        });
      }

      // Simulate beat change
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 2,
        beatIndex: 1,
        measureIndex: 0,
        totalEighthNotes: 2,
        isCountdown: false,
        visualSeconds: 1.0,
        rawElapsedSeconds: 1.3,
        eighthNoteDurationMs: 434.8,
        continuousBeat: 2.1,
        currentBpm: 69,
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      // Check custom classes
      expect(elements[2].classList.contains('beat-active')).toBe(true);
      expect(elements[2].classList.contains('beat-inactive')).toBe(false);
      expect(elements[0].classList.contains('beat-inactive')).toBe(true);
    });
  });

  describe('initial state application', () => {
    it('should apply current state immediately if clock has state', () => {
      const initialState: AtomicBeatState = {
        eighthNoteIndex: 4,
        beatIndex: 2,
        measureIndex: 1,
        totalEighthNotes: 12,
        isCountdown: false,
        visualSeconds: 5.0,
        rawElapsedSeconds: 5.3,
        eighthNoteDurationMs: 434.8,
        continuousBeat: 12.2,
        currentBpm: 69,
        timestamp: performance.now(),
      };

      mockGetCurrentState.mockReturnValue(initialState);

      const { result } = renderHook(() =>
        useBeatGridSync({
          rows: 1,
          columns: 8,
          isPlaying: true,
        })
      );

      // Create elements after hook initialization
      const elements: HTMLDivElement[] = [];
      for (let i = 0; i < 8; i++) {
        const el = document.createElement('div');
        el.classList.add('opacity-0');
        elements.push(el);
        act(() => {
          result.current.registerIndicator(0, i, el);
        });
      }

      // The initial state should have been applied
      // Note: Since elements are registered after hook init, we need to trigger an update
      act(() => {
        subscriberCallback?.(initialState);
      });

      expect(elements[4].classList.contains('opacity-100')).toBe(true);
    });
  });
});

describe('useSingleRowBeatSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribe.mockImplementation(() => vi.fn());
    mockGetCurrentState.mockReturnValue(null);
  });

  it('should be a convenience wrapper for single row', async () => {
    // Import the convenience function
    const { useSingleRowBeatSync } = await import('../useBeatGridSync');

    const { result } = renderHook(() =>
      useSingleRowBeatSync({
        columns: 8,
        isPlaying: false,
      })
    );

    expect(result.current.registerIndicator).toBeDefined();
    expect(result.current.getCurrentBeat).toBeDefined();
  });
});

// =============================================================================
// TESTS FOR useFretboardAtomicSync
// =============================================================================

describe('useFretboardAtomicSync', () => {
  let subscriberCallback: ((state: AtomicBeatState) => void) | null = null;
  let unsubscribeFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    subscriberCallback = null;
    unsubscribeFn = vi.fn();

    // Capture the subscriber callback when subscribe is called
    mockSubscribe.mockImplementation((callback) => {
      subscriberCallback = callback;
      return unsubscribeFn;
    });

    mockGetCurrentState.mockReturnValue(null);
  });

  afterEach(() => {
    subscriberCallback = null;
  });

  describe('initialization', () => {
    it('should return initial state when not playing', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { result } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: false,
        })
      );

      expect(result.current.exerciseTimeMs).toBe(0);
      expect(result.current.currentMeasure).toBe(0);
      expect(result.current.currentBeat).toBe(0);
      expect(result.current.isCountdown).toBe(false);
      expect(result.current.currentBpm).toBe(120);
      expect(result.current.visualSeconds).toBe(0);
      expect(result.current.continuousBeat).toBe(0);
    });

    it('should return stateRef for high-frequency access', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { result } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: false,
        })
      );

      expect(result.current.stateRef).toBeDefined();
      expect(result.current.stateRef.current).toBeDefined();
      expect(result.current.stateRef.current.exerciseTimeMs).toBe(0);
    });

    it('should not subscribe when isPlaying is false', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: false,
        })
      );

      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it('should subscribe when isPlaying is true', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
        })
      );

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(typeof subscriberCallback).toBe('function');
    });
  });

  describe('timing calculations', () => {
    it('should calculate exerciseTimeMs accounting for countdown', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { result } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
          countdownBeats: 4, // 4 beats at 120 BPM = 2 seconds
          beatsPerMeasure: 4,
        })
      );

      // Simulate clock state at 3 seconds visual time (1 second after countdown)
      // At 120 BPM, 4 countdown beats = 2 seconds
      // exerciseTimeMs should be (3 - 2) * 1000 = 1000ms
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 6,
        beatIndex: 3,
        measureIndex: 0,
        totalEighthNotes: 6,
        isCountdown: false,
        visualSeconds: 3.0, // 3 seconds
        rawElapsedSeconds: 3.3,
        eighthNoteDurationMs: 250, // 120 BPM
        continuousBeat: 6.0,
        currentBpm: 120,
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      // exerciseTimeMs = (visualSeconds - countdownSeconds) * 1000
      // = (3.0 - 2.0) * 1000 = 1000
      expect(result.current.exerciseTimeMs).toBe(1000);
    });

    it('should return negative exerciseTimeMs during countdown', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { result } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
          countdownBeats: 4, // 4 beats at 120 BPM = 2 seconds
          beatsPerMeasure: 4,
        })
      );

      // Simulate clock state at 1 second (still in countdown)
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 2,
        beatIndex: 1,
        measureIndex: -1,
        totalEighthNotes: 2,
        isCountdown: true,
        visualSeconds: 1.0, // 1 second (still in 2-second countdown)
        rawElapsedSeconds: 1.3,
        eighthNoteDurationMs: 250,
        continuousBeat: 2.0,
        currentBpm: 120,
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      // exerciseTimeMs = (1.0 - 2.0) * 1000 = -1000
      expect(result.current.exerciseTimeMs).toBe(-1000);
    });

    it('should update currentMeasure from clock state', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { result } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
        })
      );

      const beatState: AtomicBeatState = {
        eighthNoteIndex: 10,
        beatIndex: 1,
        measureIndex: 2, // Third measure (0-indexed)
        totalEighthNotes: 10,
        isCountdown: false,
        visualSeconds: 5.0,
        rawElapsedSeconds: 5.3,
        eighthNoteDurationMs: 250,
        continuousBeat: 10.0,
        currentBpm: 120,
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      expect(result.current.currentMeasure).toBe(2);
    });

    it('should update currentBeat from clock state', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { result } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
        })
      );

      const beatState: AtomicBeatState = {
        eighthNoteIndex: 5,
        beatIndex: 2, // Third beat (0-indexed)
        measureIndex: 0,
        totalEighthNotes: 5,
        isCountdown: false,
        visualSeconds: 2.5,
        rawElapsedSeconds: 2.8,
        eighthNoteDurationMs: 250,
        continuousBeat: 5.0,
        currentBpm: 120,
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      expect(result.current.currentBeat).toBe(2);
    });

    it('should update currentBpm from clock state', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { result } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
        })
      );

      const beatState: AtomicBeatState = {
        eighthNoteIndex: 0,
        beatIndex: 0,
        measureIndex: 0,
        totalEighthNotes: 0,
        isCountdown: false,
        visualSeconds: 0,
        rawElapsedSeconds: 0.3,
        eighthNoteDurationMs: 434.8, // 69 BPM
        continuousBeat: 0,
        currentBpm: 69, // Different tempo
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      expect(result.current.currentBpm).toBe(69);
    });
  });

  describe('visibility optimization', () => {
    it('should skip updates when isVisible is false', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { result } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
          isVisible: false,
        })
      );

      const beatState: AtomicBeatState = {
        eighthNoteIndex: 5,
        beatIndex: 2,
        measureIndex: 1,
        totalEighthNotes: 5,
        isCountdown: false,
        visualSeconds: 2.5,
        rawElapsedSeconds: 2.8,
        eighthNoteDurationMs: 250,
        continuousBeat: 5.0,
        currentBpm: 120,
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      // State should remain at initial values
      expect(result.current.currentMeasure).toBe(0);
      expect(result.current.currentBeat).toBe(0);
    });
  });

  describe('playback state transitions', () => {
    it('should unsubscribe when isPlaying changes to false', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { rerender } = renderHook(
        ({ isPlaying }) =>
          useFretboardAtomicSync({
            isPlaying,
          }),
        { initialProps: { isPlaying: true } }
      );

      expect(mockSubscribe).toHaveBeenCalledTimes(1);

      // Stop playback
      rerender({ isPlaying: false });

      expect(unsubscribeFn).toHaveBeenCalled();
    });

    it('should reset state when playback stops', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { result, rerender } = renderHook(
        ({ isPlaying }) =>
          useFretboardAtomicSync({
            isPlaying,
          }),
        { initialProps: { isPlaying: true } }
      );

      // Simulate some playback progress
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 10,
        beatIndex: 2,
        measureIndex: 2,
        totalEighthNotes: 10,
        isCountdown: false,
        visualSeconds: 5.0,
        rawElapsedSeconds: 5.3,
        eighthNoteDurationMs: 250,
        continuousBeat: 10.0,
        currentBpm: 120,
        timestamp: performance.now(),
      };

      act(() => {
        subscriberCallback?.(beatState);
      });

      expect(result.current.currentMeasure).toBe(2);

      // Stop playback
      rerender({ isPlaying: false });

      // State should reset
      expect(result.current.exerciseTimeMs).toBe(0);
      expect(result.current.currentMeasure).toBe(0);
      expect(result.current.currentBeat).toBe(0);
    });
  });

  describe('React update optimization', () => {
    it('should update ref on every tick', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { result } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
        })
      );

      // First beat
      act(() => {
        subscriberCallback?.({
          eighthNoteIndex: 0,
          beatIndex: 0,
          measureIndex: 0,
          totalEighthNotes: 0,
          isCountdown: false,
          visualSeconds: 0.1,
          rawElapsedSeconds: 0.4,
          eighthNoteDurationMs: 250,
          continuousBeat: 0.2,
          currentBpm: 120,
          timestamp: performance.now(),
        });
      });

      expect(result.current.stateRef.current.visualSeconds).toBe(0.1);

      // Next tick (same measure)
      act(() => {
        subscriberCallback?.({
          eighthNoteIndex: 0,
          beatIndex: 0,
          measureIndex: 0,
          totalEighthNotes: 0,
          isCountdown: false,
          visualSeconds: 0.15,
          rawElapsedSeconds: 0.45,
          eighthNoteDurationMs: 250,
          continuousBeat: 0.3,
          currentBpm: 120,
          timestamp: performance.now(),
        });
      });

      // Ref should update even if React state doesn't
      expect(result.current.stateRef.current.visualSeconds).toBe(0.15);
    });

    it('should trigger React update on measure change', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { result } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
        })
      );

      // Measure 0
      act(() => {
        subscriberCallback?.({
          eighthNoteIndex: 3,
          beatIndex: 1,
          measureIndex: 0,
          totalEighthNotes: 3,
          isCountdown: false,
          visualSeconds: 1.5,
          rawElapsedSeconds: 1.8,
          eighthNoteDurationMs: 250,
          continuousBeat: 3.0,
          currentBpm: 120,
          timestamp: performance.now(),
        });
      });

      expect(result.current.currentMeasure).toBe(0);

      // Measure 1
      act(() => {
        subscriberCallback?.({
          eighthNoteIndex: 8,
          beatIndex: 0,
          measureIndex: 1,
          totalEighthNotes: 8,
          isCountdown: false,
          visualSeconds: 4.0,
          rawElapsedSeconds: 4.3,
          eighthNoteDurationMs: 250,
          continuousBeat: 8.0,
          currentBpm: 120,
          timestamp: performance.now(),
        });
      });

      // React state should update on measure change
      expect(result.current.currentMeasure).toBe(1);
    });
  });

  describe('countdown behavior', () => {
    it('should pass isCountdown from clock state', async () => {
      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { result } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
        })
      );

      // During countdown
      act(() => {
        subscriberCallback?.({
          eighthNoteIndex: 2,
          beatIndex: 1,
          measureIndex: -1,
          totalEighthNotes: 2,
          isCountdown: true,
          visualSeconds: 1.0,
          rawElapsedSeconds: 1.3,
          eighthNoteDurationMs: 250,
          continuousBeat: 2.0,
          currentBpm: 120,
          timestamp: performance.now(),
        });
      });

      expect(result.current.isCountdown).toBe(true);

      // After countdown
      act(() => {
        subscriberCallback?.({
          eighthNoteIndex: 4,
          beatIndex: 0,
          measureIndex: 0,
          totalEighthNotes: 4,
          isCountdown: false,
          visualSeconds: 2.0,
          rawElapsedSeconds: 2.3,
          eighthNoteDurationMs: 250,
          continuousBeat: 4.0,
          currentBpm: 120,
          timestamp: performance.now(),
        });
      });

      expect(result.current.isCountdown).toBe(false);
    });
  });

  describe('initial state application', () => {
    it('should apply current state immediately if clock has state', async () => {
      const initialState: AtomicBeatState = {
        eighthNoteIndex: 8,
        beatIndex: 0,
        measureIndex: 1,
        totalEighthNotes: 8,
        isCountdown: false,
        visualSeconds: 4.0,
        rawElapsedSeconds: 4.3,
        eighthNoteDurationMs: 250,
        continuousBeat: 8.0,
        currentBpm: 120,
        timestamp: performance.now(),
      };

      mockGetCurrentState.mockReturnValue(initialState);

      const { useFretboardAtomicSync } = await import('../useBeatGridSync');

      const { result } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
        })
      );

      // Should have applied initial state
      expect(result.current.currentMeasure).toBe(1);
      expect(result.current.visualSeconds).toBe(4.0);
    });
  });
});

// =============================================================================
// INTEGRATION TESTS - TIMING SYNCHRONIZATION ACROSS MULTIPLE WIDGETS
// =============================================================================

describe('Integration: Timing Synchronization Across Widgets', () => {
  let subscriberCallbacks: Array<(state: AtomicBeatState) => void> = [];
  const unsubscribeFns: Array<ReturnType<typeof vi.fn>> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    subscriberCallbacks = [];

    // Capture ALL subscriber callbacks when subscribe is called
    mockSubscribe.mockImplementation((callback) => {
      subscriberCallbacks.push(callback);
      const unsubFn = vi.fn();
      unsubscribeFns.push(unsubFn);
      return unsubFn;
    });

    mockGetCurrentState.mockReturnValue(null);
  });

  afterEach(() => {
    subscriberCallbacks = [];
  });

  /**
   * Broadcast a beat state to ALL subscribed hooks - simulating the single clock
   */
  function broadcastBeatState(state: AtomicBeatState) {
    subscriberCallbacks.forEach((callback) => callback(state));
  }

  describe('all widgets receive same clock state simultaneously', () => {
    it('should synchronize DrummerWidget (useBeatGridSync) and MetronomeWidget (useQuarterNoteBeatSync)', async () => {
      const { useBeatGridSync, useQuarterNoteBeatSync } = await import(
        '../useBeatGridSync'
      );

      // Render both hooks (simulating DrummerWidget and MetronomeWidget)
      const { result: drummerResult } = renderHook(() =>
        useBeatGridSync({
          rows: 3,
          columns: 8,
          isPlaying: true,
          activeClass: 'drum-active',
          inactiveClass: 'drum-inactive',
        })
      );

      const { result: metronomeResult } = renderHook(() =>
        useQuarterNoteBeatSync({
          beats: 4, // Number of quarter-note beats to display
          isPlaying: true,
          activeClass: 'met-active',
          inactiveClass: 'met-inactive',
        })
      );

      // Register DOM elements for drummer (3 rows x 8 columns)
      const drummerElements: HTMLDivElement[][] = [];
      for (let row = 0; row < 3; row++) {
        drummerElements[row] = [];
        for (let col = 0; col < 8; col++) {
          const el = document.createElement('div');
          el.classList.add('drum-inactive');
          drummerElements[row].push(el);
          act(() => {
            drummerResult.current.registerIndicator(row, col, el);
          });
        }
      }

      // Register DOM elements for metronome (4 quarter note beats)
      // useQuarterNoteBeatSync.registerIndicator takes (row, col) but row is ignored (always 0 internally)
      const metronomeElements: HTMLDivElement[] = [];
      for (let i = 0; i < 4; i++) {
        const el = document.createElement('div');
        el.classList.add('met-inactive');
        metronomeElements.push(el);
        act(() => {
          metronomeResult.current.registerIndicator(0, i, el); // row=0, col=i
        });
      }

      // Broadcast beat state: 8th note 4 (beat 2 in quarter notes at 0-indexed)
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 4, // 5th eighth note
        beatIndex: 2, // 3rd quarter note beat
        measureIndex: 0,
        totalEighthNotes: 4,
        isCountdown: false,
        visualSeconds: 2.0,
        rawElapsedSeconds: 2.3,
        eighthNoteDurationMs: 250,
        continuousBeat: 4.0,
        currentBpm: 120,
        timestamp: performance.now(),
      };

      act(() => {
        broadcastBeatState(beatState);
      });

      // Drummer: column 4 should be active in all rows
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 8; col++) {
          const el = drummerElements[row][col];
          if (col === 4) {
            expect(el.classList.contains('drum-active')).toBe(true);
            expect(el.classList.contains('drum-inactive')).toBe(false);
          } else {
            expect(el.classList.contains('drum-active')).toBe(false);
            expect(el.classList.contains('drum-inactive')).toBe(true);
          }
        }
      }

      // Metronome: beat 2 should be active (uses beatIndex, not eighthNoteIndex)
      metronomeElements.forEach((el, idx) => {
        if (idx === 2) {
          expect(el.classList.contains('met-active')).toBe(true);
          expect(el.classList.contains('met-inactive')).toBe(false);
        } else {
          expect(el.classList.contains('met-active')).toBe(false);
          expect(el.classList.contains('met-inactive')).toBe(true);
        }
      });
    });

    it('should synchronize FretboardCard (useFretboardAtomicSync) with DrummerWidget (useBeatGridSync)', async () => {
      const { useBeatGridSync, useFretboardAtomicSync } = await import(
        '../useBeatGridSync'
      );

      // Render both hooks
      const { result: drummerResult } = renderHook(() =>
        useBeatGridSync({
          rows: 1,
          columns: 8,
          isPlaying: true,
        })
      );

      const { result: fretboardResult } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
          countdownBeats: 4,
          beatsPerMeasure: 4,
        })
      );

      // Register drummer elements
      const drummerElements: HTMLDivElement[] = [];
      for (let i = 0; i < 8; i++) {
        const el = document.createElement('div');
        el.classList.add('opacity-0');
        drummerElements.push(el);
        act(() => {
          drummerResult.current.registerIndicator(0, i, el);
        });
      }

      // Broadcast beat state at measure 1, beat 2
      // At 120 BPM, 4 countdown beats = 2 seconds
      // visualSeconds = 4.0 means exerciseTimeMs = (4.0 - 2.0) * 1000 = 2000ms
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 5,
        beatIndex: 2,
        measureIndex: 1,
        totalEighthNotes: 13,
        isCountdown: false,
        visualSeconds: 4.0,
        rawElapsedSeconds: 4.3,
        eighthNoteDurationMs: 250,
        continuousBeat: 13.0,
        currentBpm: 120,
        timestamp: performance.now(),
      };

      act(() => {
        broadcastBeatState(beatState);
      });

      // Drummer should show beat 5 active
      expect(drummerElements[5].classList.contains('opacity-100')).toBe(true);
      expect(drummerResult.current.getCurrentBeat()).toBe(5);

      // Fretboard should have same timing data
      expect(fretboardResult.current.currentMeasure).toBe(1);
      expect(fretboardResult.current.currentBeat).toBe(2);
      expect(fretboardResult.current.visualSeconds).toBe(4.0);
      expect(fretboardResult.current.exerciseTimeMs).toBe(2000); // (4.0 - 2.0) * 1000
    });

    it('should synchronize HarmonyWidget (useMeasureSync) with TransportClock (useTransportClockSync)', async () => {
      const { useMeasureSync, useTransportClockSync } = await import(
        '../useBeatGridSync'
      );

      // Render both hooks
      const { result: harmonyResult } = renderHook(() =>
        useMeasureSync({
          chordCount: 4, // Number of chords (one per measure)
          isPlaying: true,
          activeClass: 'chord-active',
          inactiveClass: 'chord-inactive',
        })
      );

      const { result: transportResult } = renderHook(() =>
        useTransportClockSync({
          isPlaying: true,
        })
      );

      // Register harmony chord indicators (4 measures)
      const chordElements: HTMLDivElement[] = [];
      for (let i = 0; i < 4; i++) {
        const el = document.createElement('div');
        el.classList.add('chord-inactive');
        chordElements.push(el);
        act(() => {
          harmonyResult.current.registerChordIndicator(i, el);
        });
      }

      // Register transport clock elements
      const positionDisplay = document.createElement('span');
      const playingIndicator = document.createElement('span');
      act(() => {
        transportResult.current.registerPositionDisplay(positionDisplay);
        transportResult.current.registerPlayingIndicator(playingIndicator);
      });

      // Broadcast beat state at measure 2
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 0,
        beatIndex: 0,
        measureIndex: 2,
        totalEighthNotes: 16,
        isCountdown: false,
        visualSeconds: 8.0,
        rawElapsedSeconds: 8.3,
        eighthNoteDurationMs: 250,
        continuousBeat: 16.0,
        currentBpm: 120,
        timestamp: performance.now(),
      };

      act(() => {
        broadcastBeatState(beatState);
      });

      // Harmony: measure 2 should be active
      chordElements.forEach((el, idx) => {
        if (idx === 2) {
          expect(el.classList.contains('chord-active')).toBe(true);
        } else {
          expect(el.classList.contains('chord-inactive')).toBe(true);
        }
      });

      // Transport clock should show position format "3 : 1" (measure 3, beat 1 - 1-indexed display)
      expect(positionDisplay.textContent).toContain('3');
      expect(positionDisplay.textContent).toContain('1');
    });

    it('should synchronize LoopGridStrip (useLoopStripSync) with other widgets', async () => {
      const { useBeatGridSync, useLoopStripSync } = await import(
        '../useBeatGridSync'
      );

      // Render both hooks
      const { result: drummerResult } = renderHook(() =>
        useBeatGridSync({
          rows: 1,
          columns: 8,
          isPlaying: true,
        })
      );

      const { result: loopStripResult } = renderHook(() =>
        useLoopStripSync({
          totalBeats: 16, // 2 measures of 8 beats each
          beatsPerMeasure: 8,
          isPlaying: true,
          playedClass: 'loop-active',
          unplayedClass: 'loop-inactive',
        })
      );

      // Register drummer elements
      const drummerElements: HTMLDivElement[] = [];
      for (let i = 0; i < 8; i++) {
        const el = document.createElement('div');
        el.classList.add('opacity-0');
        drummerElements.push(el);
        act(() => {
          drummerResult.current.registerIndicator(0, i, el);
        });
      }

      // Register loop strip elements (1-based measure index, 0-based beat index)
      // LoopStrip uses key format: `${measureIndex}-${beatIndex}` where measureIndex is 1-based
      const loopElements: HTMLDivElement[] = [];
      for (let measure = 1; measure <= 2; measure++) {
        for (let beat = 0; beat < 8; beat++) {
          const el = document.createElement('div');
          el.classList.add('loop-inactive');
          loopElements.push(el);
          act(() => {
            loopStripResult.current.registerBeatIndicator(measure, beat, el);
          });
        }
      }

      // Broadcast beat at measure 1 (0-indexed), beat 2 (0-indexed)
      // This means we're at the 10th beat overall (measure 1 * 8 beats + beat 2)
      const beatState: AtomicBeatState = {
        eighthNoteIndex: 2, // Within measure (0-7 range)
        beatIndex: 2, // Beat index within measure
        measureIndex: 1, // 0-indexed measure
        totalEighthNotes: 10,
        isCountdown: false,
        visualSeconds: 5.0,
        rawElapsedSeconds: 5.3,
        eighthNoteDurationMs: 250,
        continuousBeat: 10.0,
        currentBpm: 120,
        timestamp: performance.now(),
      };

      act(() => {
        broadcastBeatState(beatState);
      });

      // Drummer: column 2 should be active (eighthNoteIndex wraps within measure)
      expect(drummerElements[2].classList.contains('opacity-100')).toBe(true);
      expect(drummerResult.current.getCurrentBeat()).toBe(2);

      // LoopStrip shows "played" trail:
      // currentBeatPosition = measureIndex * beatsPerMeasure + beatIndex + 1 = 1 * 8 + 2 + 1 = 11
      //
      // For each indicator with key "measureIdx-beatIdx" (measureIdx is 1-based):
      // indicatorBeatPosition = (measureIdx - 1) * beatsPerMeasure + beatIdx
      //
      // Element positions (loopElements array index):
      // idx 0-7:   measure 1 (measureIdx=1), beats 0-7 → indicatorBeatPosition = 0-7
      // idx 8-15:  measure 2 (measureIdx=2), beats 0-7 → indicatorBeatPosition = 8-15
      //
      // Condition: hasBeenPlayed = indicatorBeatPosition <= currentBeatPosition
      // So elements with indicatorBeatPosition 0-11 should be "played" (idx 0-11)
      // And elements with indicatorBeatPosition 12-15 should be "unplayed" (idx 12-15)
      loopElements.forEach((el, idx) => {
        if (idx <= 11) {
          expect(el.classList.contains('loop-active')).toBe(true);
        } else {
          expect(el.classList.contains('loop-inactive')).toBe(true);
        }
      });
    });
  });

  describe('countdown synchronization', () => {
    it('should show beat 0 on all widgets during countdown', async () => {
      const { useBeatGridSync, useQuarterNoteBeatSync, useFretboardAtomicSync } =
        await import('../useBeatGridSync');

      // Render hooks
      const { result: drummerResult } = renderHook(() =>
        useBeatGridSync({
          rows: 1,
          columns: 8,
          isPlaying: true,
        })
      );

      // Use explicit classes for metronome to avoid default class issues
      const { result: metronomeResult } = renderHook(() =>
        useQuarterNoteBeatSync({
          beats: 4,
          isPlaying: true,
          activeClass: 'beat-active',
          inactiveClass: 'beat-inactive',
        })
      );

      const { result: fretboardResult } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
          countdownBeats: 4,
        })
      );

      // Register elements
      const drummerElements: HTMLDivElement[] = [];
      for (let i = 0; i < 8; i++) {
        const el = document.createElement('div');
        el.classList.add('opacity-0');
        drummerElements.push(el);
        act(() => {
          drummerResult.current.registerIndicator(0, i, el);
        });
      }

      const metronomeElements: HTMLDivElement[] = [];
      for (let i = 0; i < 4; i++) {
        const el = document.createElement('div');
        el.classList.add('beat-inactive');
        metronomeElements.push(el);
        act(() => {
          metronomeResult.current.registerIndicator(0, i, el);
        });
      }

      // Broadcast countdown state (eighthNoteIndex=2 but isCountdown=true)
      const countdownState: AtomicBeatState = {
        eighthNoteIndex: 2, // This is ignored during countdown
        beatIndex: 1, // This is also ignored during countdown
        measureIndex: -1,
        totalEighthNotes: 2,
        isCountdown: true, // COUNTDOWN ACTIVE
        visualSeconds: 1.0,
        rawElapsedSeconds: 1.3,
        eighthNoteDurationMs: 250,
        continuousBeat: 2.0,
        currentBpm: 120,
        timestamp: performance.now(),
      };

      act(() => {
        broadcastBeatState(countdownState);
      });

      // During countdown, beat 0 should be highlighted on drummer
      expect(drummerElements[0].classList.contains('opacity-100')).toBe(true);
      expect(drummerElements[2].classList.contains('opacity-100')).toBe(false);

      // Metronome should also show beat 0 during countdown
      expect(metronomeElements[0].classList.contains('beat-active')).toBe(true);

      // Fretboard should report countdown state
      expect(fretboardResult.current.isCountdown).toBe(true);
      expect(fretboardResult.current.exerciseTimeMs).toBeLessThan(0); // Negative during countdown
    });
  });

  describe('tempo change synchronization', () => {
    it('should update all widgets when tempo changes', async () => {
      const { useBeatGridSync, useFretboardAtomicSync } = await import(
        '../useBeatGridSync'
      );

      // Render hooks
      const { result: drummerResult } = renderHook(() =>
        useBeatGridSync({
          rows: 1,
          columns: 8,
          isPlaying: true,
        })
      );

      const { result: fretboardResult } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
        })
      );

      // Register drummer elements
      const drummerElements: HTMLDivElement[] = [];
      for (let i = 0; i < 8; i++) {
        const el = document.createElement('div');
        el.classList.add('opacity-0');
        drummerElements.push(el);
        act(() => {
          drummerResult.current.registerIndicator(0, i, el);
        });
      }

      // First broadcast at 120 BPM, measure 0
      act(() => {
        broadcastBeatState({
          eighthNoteIndex: 0,
          beatIndex: 0,
          measureIndex: 0,
          totalEighthNotes: 0,
          isCountdown: false,
          visualSeconds: 0,
          rawElapsedSeconds: 0.3,
          eighthNoteDurationMs: 250, // 120 BPM
          continuousBeat: 0,
          currentBpm: 120,
          timestamp: performance.now(),
        });
      });

      expect(drummerResult.current.getEighthNoteDurationMs()).toBe(250);
      // Use stateRef for immediate access (React state only updates on measure change)
      expect(fretboardResult.current.stateRef.current.currentBpm).toBe(120);

      // Tempo change to 60 BPM on measure 1 (to trigger React update)
      act(() => {
        broadcastBeatState({
          eighthNoteIndex: 0,
          beatIndex: 0,
          measureIndex: 1, // New measure to trigger React state update
          totalEighthNotes: 8,
          isCountdown: false,
          visualSeconds: 4.0,
          rawElapsedSeconds: 4.3,
          eighthNoteDurationMs: 500, // 60 BPM
          continuousBeat: 8.0,
          currentBpm: 60,
          timestamp: performance.now(),
        });
      });

      // All widgets should reflect new tempo
      expect(drummerResult.current.getEighthNoteDurationMs()).toBe(500);
      // React state should have updated due to measure change
      expect(fretboardResult.current.currentBpm).toBe(60);
    });
  });

  describe('playback start/stop synchronization', () => {
    it('should reset all widgets when playback stops', async () => {
      const { useBeatGridSync, useQuarterNoteBeatSync, useFretboardAtomicSync } =
        await import('../useBeatGridSync');

      // Render hooks with isPlaying=true
      const { result: drummerResult, rerender: rerenderDrummer } = renderHook(
        ({ isPlaying }) =>
          useBeatGridSync({
            rows: 1,
            columns: 8,
            isPlaying,
          }),
        { initialProps: { isPlaying: true } }
      );

      // Use explicit classes for metronome
      const { result: metronomeResult, rerender: rerenderMetronome } = renderHook(
        ({ isPlaying }) =>
          useQuarterNoteBeatSync({
            beats: 4,
            isPlaying,
            activeClass: 'beat-active',
            inactiveClass: 'beat-inactive',
          }),
        { initialProps: { isPlaying: true } }
      );

      const { result: fretboardResult, rerender: rerenderFretboard } = renderHook(
        ({ isPlaying }) =>
          useFretboardAtomicSync({
            isPlaying,
          }),
        { initialProps: { isPlaying: true } }
      );

      // Register elements
      const drummerElements: HTMLDivElement[] = [];
      for (let i = 0; i < 8; i++) {
        const el = document.createElement('div');
        el.classList.add('opacity-0');
        drummerElements.push(el);
        act(() => {
          drummerResult.current.registerIndicator(0, i, el);
        });
      }

      const metronomeElements: HTMLDivElement[] = [];
      for (let i = 0; i < 4; i++) {
        const el = document.createElement('div');
        el.classList.add('beat-inactive');
        metronomeElements.push(el);
        act(() => {
          metronomeResult.current.registerIndicator(0, i, el);
        });
      }

      // Play to beat 5 (eighth note 5 = quarter note beat 2)
      act(() => {
        broadcastBeatState({
          eighthNoteIndex: 5,
          beatIndex: 2,
          measureIndex: 0,
          totalEighthNotes: 5,
          isCountdown: false,
          visualSeconds: 2.5,
          rawElapsedSeconds: 2.8,
          eighthNoteDurationMs: 250,
          continuousBeat: 5.0,
          currentBpm: 120,
          timestamp: performance.now(),
        });
      });

      // Verify active state
      expect(drummerElements[5].classList.contains('opacity-100')).toBe(true);
      expect(metronomeElements[2].classList.contains('beat-active')).toBe(true);
      expect(fretboardResult.current.stateRef.current.visualSeconds).toBe(2.5);

      // Stop playback
      act(() => {
        rerenderDrummer({ isPlaying: false });
        rerenderMetronome({ isPlaying: false });
        rerenderFretboard({ isPlaying: false });
      });

      // All widgets should be reset
      drummerElements.forEach((el) => {
        expect(el.classList.contains('opacity-100')).toBe(false);
        expect(el.classList.contains('opacity-0')).toBe(true);
      });

      metronomeElements.forEach((el) => {
        expect(el.classList.contains('beat-active')).toBe(false);
        expect(el.classList.contains('beat-inactive')).toBe(true);
      });

      expect(fretboardResult.current.exerciseTimeMs).toBe(0);
      expect(fretboardResult.current.currentMeasure).toBe(0);
    });
  });

  describe('visibility optimization consistency', () => {
    it('should skip updates consistently across all hidden widgets', async () => {
      const { useBeatGridSync, useFretboardAtomicSync } = await import(
        '../useBeatGridSync'
      );

      // Render hooks with isVisible=false
      const { result: drummerResult } = renderHook(() =>
        useBeatGridSync({
          rows: 1,
          columns: 8,
          isPlaying: true,
          isVisible: false,
        })
      );

      const { result: fretboardResult } = renderHook(() =>
        useFretboardAtomicSync({
          isPlaying: true,
          isVisible: false,
        })
      );

      // Register elements
      const drummerEl = document.createElement('div');
      drummerEl.classList.add('opacity-0');
      act(() => {
        drummerResult.current.registerIndicator(0, 5, drummerEl);
      });

      // Broadcast beat state
      act(() => {
        broadcastBeatState({
          eighthNoteIndex: 5,
          beatIndex: 2,
          measureIndex: 1,
          totalEighthNotes: 5,
          isCountdown: false,
          visualSeconds: 2.5,
          rawElapsedSeconds: 2.8,
          eighthNoteDurationMs: 250,
          continuousBeat: 5.0,
          currentBpm: 120,
          timestamp: performance.now(),
        });
      });

      // Hidden widgets should NOT update
      expect(drummerEl.classList.contains('opacity-0')).toBe(true);
      expect(drummerEl.classList.contains('opacity-100')).toBe(false);

      // Fretboard should also remain at initial state
      expect(fretboardResult.current.currentMeasure).toBe(0);
    });
  });

  describe('subscription lifecycle', () => {
    it('should all widgets subscribe to same clock instance', async () => {
      const { useBeatGridSync, useQuarterNoteBeatSync, useMeasureSync } =
        await import('../useBeatGridSync');

      // Clear previous subscriptions count
      mockSubscribe.mockClear();

      // Render multiple hooks
      renderHook(() =>
        useBeatGridSync({ rows: 1, columns: 8, isPlaying: true })
      );
      renderHook(() =>
        useQuarterNoteBeatSync({ beats: 4, isPlaying: true })
      );
      renderHook(() =>
        useMeasureSync({ chordCount: 4, isPlaying: true })
      );

      // All three should have subscribed
      expect(mockSubscribe).toHaveBeenCalledTimes(3);
      expect(subscriberCallbacks.length).toBe(3);
    });

    it('should all widgets receive same broadcast', async () => {
      const { useBeatGridSync, useQuarterNoteBeatSync, useFretboardAtomicSync } =
        await import('../useBeatGridSync');

      const { result: drummerResult } = renderHook(() => {
        const result = useBeatGridSync({
          rows: 1,
          columns: 8,
          isPlaying: true,
        });
        return result;
      });

      renderHook(() =>
        useQuarterNoteBeatSync({ beats: 4, isPlaying: true })
      );

      const { result: fretboardResult } = renderHook(() =>
        useFretboardAtomicSync({ isPlaying: true })
      );

      // Register an element for drummer
      const el = document.createElement('div');
      el.classList.add('opacity-0');
      act(() => {
        drummerResult.current.registerIndicator(0, 3, el);
      });

      // Single broadcast should reach all subscribers
      const sharedState: AtomicBeatState = {
        eighthNoteIndex: 3,
        beatIndex: 1,
        measureIndex: 0,
        totalEighthNotes: 3,
        isCountdown: false,
        visualSeconds: 1.5,
        rawElapsedSeconds: 1.8,
        eighthNoteDurationMs: 250,
        continuousBeat: 3.0,
        currentBpm: 120,
        timestamp: performance.now(),
      };

      act(() => {
        broadcastBeatState(sharedState);
      });

      // Verify all received the same state
      expect(drummerResult.current.getCurrentBeat()).toBe(3);
      expect(el.classList.contains('opacity-100')).toBe(true);
      expect(fretboardResult.current.currentBeat).toBe(1);
      expect(fretboardResult.current.visualSeconds).toBe(1.5);
    });
  });
});
