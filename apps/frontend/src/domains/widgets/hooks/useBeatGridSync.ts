/**
 * useBeatGridSync - Direct DOM Beat Synchronization Hook
 *
 * ## Problem This Solves
 *
 * React state updates cause +/-75-95ms jitter in beat indicator rendering due to:
 * 1. React's batched state updates (setState batching)
 * 2. Virtual DOM diffing overhead
 * 3. Fiber reconciliation timing unpredictability
 *
 * At 69 BPM (434.8ms per 8th note), this manifests as:
 * - Expected: consistent 434.8ms intervals
 * - Actual: alternating ~510ms / ~360ms ("galloping" effect)
 *
 * ## Solution
 *
 * Bypass React entirely for the beat indicator by:
 * 1. Storing refs to each beat indicator DOM element
 * 2. Subscribing directly to AtomicPlaybackClock
 * 3. Toggling CSS classes via classList API (no React re-render)
 *
 * ## Architecture
 *
 * ```
 *   AtomicPlaybackClock (RAF @ 60fps)
 *            │
 *            │ subscribe() callback
 *            ▼
 *   useBeatGridSync hook
 *            │
 *            │ classList.toggle() - DIRECT DOM
 *            ▼
 *   Beat indicator divs (refs[])
 * ```
 *
 * ## Usage
 *
 * ```tsx
 * const { gridRef, registerIndicator } = useBeatGridSync({
 *   rows: 3,
 *   columns: 8,
 *   isPlaying,
 *   activeClass: 'opacity-100',
 *   inactiveClass: 'opacity-0',
 * });
 *
 * // In JSX - register each indicator
 * <div ref={(el) => registerIndicator(rowIndex, colIndex, el)}>
 * ```
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import {
  getAtomicPlaybackClock,
  type AtomicBeatState,
} from '@/domains/playback/services/core/AtomicPlaybackClock';

/**
 * Debug flag - enable in browser console: window.__DEBUG_DOM_TIMING = true
 */
const isDebugEnabled = () =>
  typeof window !== 'undefined' &&
  (window as unknown as { __DEBUG_DOM_TIMING?: boolean }).__DEBUG_DOM_TIMING;

/**
 * Configuration for the beat grid sync
 */
export interface BeatGridSyncConfig {
  /** Number of rows in the grid (e.g., 3 for kick/snare/hihat) */
  rows: number;
  /** Number of columns in the grid (e.g., 8 for 8th notes) */
  columns: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** CSS class to apply when beat is active */
  activeClass?: string;
  /** CSS class to apply when beat is inactive */
  inactiveClass?: string;
  /** Whether the widget is visible (optimization to skip updates when hidden) */
  isVisible?: boolean;
}

/**
 * Result from useBeatGridSync hook
 */
export interface BeatGridSyncResult {
  /**
   * Register a beat indicator element
   * Call this in ref callback: ref={(el) => registerIndicator(row, col, el)}
   */
  registerIndicator: (
    row: number,
    col: number,
    element: HTMLDivElement | null,
  ) => void;
  /**
   * Get the current eighth note index (for external use, not for rendering)
   */
  getCurrentBeat: () => number;
  /**
   * Get the current eighth note duration in ms (for CSS timing calculations)
   */
  getEighthNoteDurationMs: () => number;
}

/**
 * Performance metrics for debugging
 */
interface TimingMetrics {
  lastUpdateTime: number;
  lastBeatIndex: number;
  lastScheduledBeatTime: number; // Audio clock time of last beat (for jitter-free measurement)
  updateCount: number;
  intervals: number[];
  scheduledIntervals: number[]; // Intervals based on scheduled times (should be perfect)
}

/**
 * Direct DOM beat synchronization hook
 *
 * Bypasses React's state management to provide jitter-free beat indication.
 * Updates DOM directly via classList.toggle() in response to AtomicPlaybackClock callbacks.
 *
 * @param config - Configuration for the beat grid
 * @returns Object with registerIndicator function for ref callbacks
 */
export function useBeatGridSync(
  config: BeatGridSyncConfig,
): BeatGridSyncResult {
  const {
    rows,
    columns,
    isPlaying,
    activeClass = 'opacity-100',
    inactiveClass = 'opacity-0',
    isVisible = true,
  } = config;

  // 2D array of refs: refs[row][col] = HTMLDivElement
  // Using a flat Map for efficient lookup: key = `${row}-${col}`
  const indicatorRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Current beat state (for getCurrentBeat)
  const currentBeatRef = useRef<number>(0);
  const eighthNoteDurationMsRef = useRef<number>(434.8); // Default at 69 BPM

  // Performance tracking for debug mode
  const metricsRef = useRef<TimingMetrics>({
    lastUpdateTime: 0,
    lastBeatIndex: -1,
    lastScheduledBeatTime: 0,
    updateCount: 0,
    intervals: [],
    scheduledIntervals: [],
  });

  // Ref to track isVisible without re-subscribing
  const isVisibleRef = useRef(isVisible);
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  // Ref to track isPlaying without re-subscribing
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  /**
   * Register a beat indicator element
   * Creates a stable key for the element and stores it in the refs Map
   */
  const registerIndicator = useCallback(
    (row: number, col: number, element: HTMLDivElement | null) => {
      const key = `${row}-${col}`;
      if (element) {
        indicatorRefs.current.set(key, element);
      } else {
        indicatorRefs.current.delete(key);
      }
    },
    [],
  );

  /**
   * Get current beat index (for external use)
   */
  const getCurrentBeat = useCallback(() => currentBeatRef.current, []);

  /**
   * Get current eighth note duration in ms
   */
  const getEighthNoteDurationMs = useCallback(
    () => eighthNoteDurationMsRef.current,
    [],
  );

  /**
   * Direct DOM update function
   * This is called by AtomicPlaybackClock on every beat change
   */
  const updateBeatIndicators = useCallback(
    (state: AtomicBeatState) => {
      // Skip updates if not visible (optimization)
      if (!isVisibleRef.current) {
        return;
      }

      const { eighthNoteDurationMs, isCountdown } = state;

      // During countdown, show beat 0 consistently (first beat highlighted)
      // This ensures all widgets are synchronized and ready at the start line
      const eighthNoteIndex = isCountdown ? 0 : state.eighthNoteIndex;

      // Update refs for external access
      currentBeatRef.current = eighthNoteIndex;
      eighthNoteDurationMsRef.current = eighthNoteDurationMs;

      // Debug timing measurement
      const now = performance.now();
      const { scheduledBeatTime } = state;

      if (isDebugEnabled()) {
        const metrics = metricsRef.current;
        if (
          metrics.lastUpdateTime > 0 &&
          eighthNoteIndex !== metrics.lastBeatIndex
        ) {
          // Detection interval (performance.now based - includes RAF jitter)
          const detectionInterval = now - metrics.lastUpdateTime;
          metrics.intervals.push(detectionInterval);

          // Scheduled interval (audio clock based - should be near-perfect)
          const scheduledInterval =
            (scheduledBeatTime - metrics.lastScheduledBeatTime) * 1000;
          metrics.scheduledIntervals.push(scheduledInterval);

          // Keep last 16 intervals for analysis
          if (metrics.intervals.length > 16) {
            metrics.intervals.shift();
          }
          if (metrics.scheduledIntervals.length > 16) {
            metrics.scheduledIntervals.shift();
          }

          // Log every beat change with BOTH timing sources
          // eslint-disable-next-line no-console, no-restricted-syntax -- Intentional debug logging controlled by window.__DEBUG_DOM_TIMING
          console.log(
            `[DOM_TIMING] Beat ${eighthNoteIndex} | ` +
              `detected: ${detectionInterval.toFixed(1)}ms | ` +
              `scheduled: ${scheduledInterval.toFixed(1)}ms | ` +
              `expected: ${eighthNoteDurationMs.toFixed(1)}ms | ` +
              `detection_delta: ${(detectionInterval - eighthNoteDurationMs).toFixed(1)}ms | ` +
              `scheduled_delta: ${(scheduledInterval - eighthNoteDurationMs).toFixed(1)}ms`,
          );

          // Every 8 beats, log summary statistics for BOTH timing sources
          if (metrics.updateCount % 8 === 0 && metrics.intervals.length >= 8) {
            const recentDetected = metrics.intervals.slice(-8);
            const recentScheduled = metrics.scheduledIntervals.slice(-8);

            const avgDetected =
              recentDetected.reduce((a, b) => a + b, 0) / recentDetected.length;
            const minDetected = Math.min(...recentDetected);
            const maxDetected = Math.max(...recentDetected);
            const jitterDetected = maxDetected - minDetected;

            const avgScheduled =
              recentScheduled.reduce((a, b) => a + b, 0) /
              recentScheduled.length;
            const minScheduled = Math.min(...recentScheduled);
            const maxScheduled = Math.max(...recentScheduled);
            const jitterScheduled = maxScheduled - minScheduled;

            // eslint-disable-next-line no-console, no-restricted-syntax -- Intentional debug logging controlled by window.__DEBUG_DOM_TIMING
            console.log(
              `[DOM_TIMING] === 8-Beat Summary ===\n` +
                `  DETECTED (includes RAF jitter): avg: ${avgDetected.toFixed(1)}ms | min: ${minDetected.toFixed(1)}ms | max: ${maxDetected.toFixed(1)}ms | jitter: ${jitterDetected.toFixed(1)}ms\n` +
                `  SCHEDULED (audio clock based): avg: ${avgScheduled.toFixed(1)}ms | min: ${minScheduled.toFixed(1)}ms | max: ${maxScheduled.toFixed(1)}ms | jitter: ${jitterScheduled.toFixed(1)}ms`,
            );
          }
        }

        metrics.lastUpdateTime = now;
        metrics.lastBeatIndex = eighthNoteIndex;
        metrics.lastScheduledBeatTime = scheduledBeatTime;
        metrics.updateCount++;
      }

      // CRITICAL: Direct DOM manipulation - bypasses React entirely
      // This is the core jitter fix - no setState, no re-render, just classList
      const currentlyPlaying = isPlayingRef.current;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const key = `${row}-${col}`;
          const element = indicatorRefs.current.get(key);

          if (element) {
            const isActive = currentlyPlaying && col === eighthNoteIndex;

            // Use classList for best performance (no style recalculation)
            // toggle(class, force) - force=true adds, force=false removes
            element.classList.toggle(activeClass, isActive);
            element.classList.toggle(inactiveClass, !isActive);
          }
        }
      }
    },
    [rows, columns, activeClass, inactiveClass],
  );

  /**
   * Reset all indicators to inactive state
   * Called when playback stops
   */
  const resetIndicators = useCallback(() => {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const key = `${row}-${col}`;
        const element = indicatorRefs.current.get(key);

        if (element) {
          element.classList.remove(activeClass);
          element.classList.add(inactiveClass);
        }
      }
    }

    // Reset metrics
    metricsRef.current = {
      lastUpdateTime: 0,
      lastBeatIndex: -1,
      lastScheduledBeatTime: 0,
      updateCount: 0,
      intervals: [],
      scheduledIntervals: [],
    };

    if (isDebugEnabled()) {
      // eslint-disable-next-line no-console, no-restricted-syntax -- Intentional debug logging controlled by window.__DEBUG_DOM_TIMING
      console.log('[DOM_TIMING] Indicators reset (playback stopped)');
    }
  }, [rows, columns, activeClass, inactiveClass]);

  /**
   * Subscribe to AtomicPlaybackClock
   * This effect sets up the direct subscription that bypasses React state
   */
  useEffect(() => {
    const clock = getAtomicPlaybackClock();

    // Only subscribe when playing
    if (!isPlaying) {
      resetIndicators();
      return;
    }

    if (isDebugEnabled()) {
      // eslint-disable-next-line no-console, no-restricted-syntax -- Intentional debug logging controlled by window.__DEBUG_DOM_TIMING
      console.log(
        '[DOM_TIMING] Subscribing to AtomicPlaybackClock for direct DOM updates',
      );
    }

    // Subscribe to the clock - updateBeatIndicators will be called on every beat change
    const unsubscribe = clock.subscribe(updateBeatIndicators);

    // If clock already has state, apply it immediately
    const currentState = clock.getCurrentState();
    if (currentState) {
      updateBeatIndicators(currentState);
    }

    return () => {
      unsubscribe();
      resetIndicators();

      if (isDebugEnabled()) {
        // eslint-disable-next-line no-console, no-restricted-syntax -- Intentional debug logging controlled by window.__DEBUG_DOM_TIMING
        console.log('[DOM_TIMING] Unsubscribed from AtomicPlaybackClock');
      }
    };
  }, [isPlaying, updateBeatIndicators, resetIndicators]);

  return {
    registerIndicator,
    getCurrentBeat,
    getEighthNoteDurationMs,
  };
}

/**
 * Convenience hook for a single-row beat indicator (e.g., metronome)
 */
export function useSingleRowBeatSync(config: Omit<BeatGridSyncConfig, 'rows'>) {
  return useBeatGridSync({ ...config, rows: 1 });
}

/**
 * Configuration for quarter-note based beat sync (for metronome)
 */
export interface QuarterNoteSyncConfig {
  /** Number of beats to display (e.g., 4 for 4/4 time) */
  beats: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** CSS class to apply when beat is active */
  activeClass?: string;
  /** CSS class to apply when beat is inactive */
  inactiveClass?: string;
  /** Whether the widget is visible (optimization to skip updates when hidden) */
  isVisible?: boolean;
}

/**
 * Quarter-note based beat synchronization hook (for metronome)
 *
 * Unlike useBeatGridSync which tracks eighth notes, this hook tracks quarter notes.
 * Perfect for metronome displays that show 4 dots for 4/4 time.
 */
export function useQuarterNoteBeatSync(
  config: QuarterNoteSyncConfig,
): BeatGridSyncResult {
  const {
    beats,
    isPlaying,
    activeClass = 'bg-orange-400',
    inactiveClass = 'bg-green-500',
    isVisible = true,
  } = config;

  // Store refs to beat indicator elements
  const indicatorRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const currentBeatRef = useRef<number>(0);
  const eighthNoteDurationMsRef = useRef<number>(434.8);

  // Ref to track isVisible without re-subscribing
  const isVisibleRef = useRef(isVisible);
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  // Ref to track isPlaying without re-subscribing
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  /**
   * Register a beat indicator element
   */
  const registerIndicator = useCallback(
    (_row: number, col: number, element: HTMLDivElement | null) => {
      // For quarter notes, row is always 0
      const key = `0-${col}`;
      if (element) {
        indicatorRefs.current.set(key, element);
      } else {
        indicatorRefs.current.delete(key);
      }
    },
    [],
  );

  const getCurrentBeat = useCallback(() => currentBeatRef.current, []);
  const getEighthNoteDurationMs = useCallback(
    () => eighthNoteDurationMsRef.current,
    [],
  );

  /**
   * Direct DOM update function - uses beatIndex (quarter notes) instead of eighthNoteIndex
   */
  const updateBeatIndicators = useCallback(
    (state: AtomicBeatState) => {
      if (!isVisibleRef.current) {
        return;
      }

      const { eighthNoteDurationMs, isCountdown } = state;

      // During countdown, show beat 0 consistently (first beat highlighted)
      // This ensures all widgets are synchronized and ready at the start line
      const beatIndex = isCountdown ? 0 : state.beatIndex;

      currentBeatRef.current = beatIndex;
      eighthNoteDurationMsRef.current = eighthNoteDurationMs;

      const currentlyPlaying = isPlayingRef.current;

      // Update each quarter-note indicator
      for (let col = 0; col < beats; col++) {
        const key = `0-${col}`;
        const element = indicatorRefs.current.get(key);

        if (element) {
          const isActive = currentlyPlaying && col === beatIndex;

          // Split classes for proper toggle
          activeClass.split(' ').forEach((cls) => {
            if (cls) element.classList.toggle(cls, isActive);
          });
          inactiveClass.split(' ').forEach((cls) => {
            if (cls) element.classList.toggle(cls, !isActive);
          });
        }
      }
    },
    [beats, activeClass, inactiveClass],
  );

  /**
   * Reset all indicators to inactive state
   */
  const resetIndicators = useCallback(() => {
    for (let col = 0; col < beats; col++) {
      const key = `0-${col}`;
      const element = indicatorRefs.current.get(key);

      if (element) {
        activeClass.split(' ').forEach((cls) => {
          if (cls) element.classList.remove(cls);
        });
        inactiveClass.split(' ').forEach((cls) => {
          if (cls) element.classList.add(cls);
        });
      }
    }
  }, [beats, activeClass, inactiveClass]);

  /**
   * Subscribe to AtomicPlaybackClock
   */
  useEffect(() => {
    const clock = getAtomicPlaybackClock();

    if (!isPlaying) {
      resetIndicators();
      return;
    }

    const unsubscribe = clock.subscribe(updateBeatIndicators);

    const currentState = clock.getCurrentState();
    if (currentState) {
      updateBeatIndicators(currentState);
    }

    return () => {
      unsubscribe();
      resetIndicators();
    };
  }, [isPlaying, updateBeatIndicators, resetIndicators]);

  return {
    registerIndicator,
    getCurrentBeat,
    getEighthNoteDurationMs,
  };
}

/**
 * Configuration for measure-based chord sync (for HarmonyWidget)
 */
export interface MeasureSyncConfig {
  /** Number of chords in the progression */
  chordCount: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** CSS class to apply when chord is active */
  activeClass?: string;
  /** CSS class to apply when chord is inactive */
  inactiveClass?: string;
  /** Whether the widget is visible (optimization to skip updates when hidden) */
  isVisible?: boolean;
}

/**
 * Result from useMeasureSync hook
 */
export interface MeasureSyncResult {
  /**
   * Register a chord indicator element
   * Call this in ref callback: ref={(el) => registerChordIndicator(chordIndex, el)}
   */
  registerChordIndicator: (
    chordIndex: number,
    element: HTMLDivElement | null,
  ) => void;
  /**
   * Get the current measure index (for external use)
   */
  getCurrentMeasure: () => number;
  /**
   * Get the current chord index (measureIndex % chordCount)
   */
  getCurrentChord: () => number;
}

/**
 * Measure-based chord synchronization hook (for HarmonyWidget)
 *
 * Unlike beat-based hooks that track beats/eighth notes, this hook tracks
 * measures and highlights which chord in the progression is currently playing.
 * Each measure corresponds to one chord in the progression (cycling).
 */
export function useMeasureSync(config: MeasureSyncConfig): MeasureSyncResult {
  const {
    chordCount,
    isPlaying,
    activeClass = 'bg-blue-400 text-white shadow-lg shadow-blue-400/50',
    inactiveClass = 'bg-slate-700 text-slate-400',
    isVisible = true,
  } = config;

  // Store refs to chord indicator elements
  const indicatorRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const currentMeasureRef = useRef<number>(0);
  const currentChordRef = useRef<number>(0);

  // Ref to track isVisible without re-subscribing
  const isVisibleRef = useRef(isVisible);
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  // Ref to track isPlaying without re-subscribing
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  /**
   * Register a chord indicator element
   */
  const registerChordIndicator = useCallback(
    (chordIndex: number, element: HTMLDivElement | null) => {
      if (element) {
        indicatorRefs.current.set(chordIndex, element);
      } else {
        indicatorRefs.current.delete(chordIndex);
      }
    },
    [],
  );

  const getCurrentMeasure = useCallback(() => currentMeasureRef.current, []);
  const getCurrentChord = useCallback(() => currentChordRef.current, []);

  /**
   * Direct DOM update function - uses measureIndex to determine active chord
   */
  const updateChordIndicators = useCallback(
    (state: AtomicBeatState) => {
      if (!isVisibleRef.current) {
        return;
      }

      const { isCountdown } = state;

      // During countdown, show chord 0 consistently (first chord highlighted)
      // This ensures all widgets are synchronized and ready at the start line
      const measureIndex = isCountdown ? 0 : state.measureIndex;
      const currentChord = chordCount > 0 ? measureIndex % chordCount : 0;

      currentMeasureRef.current = measureIndex;
      currentChordRef.current = currentChord;

      const currentlyPlaying = isPlayingRef.current;

      // Update each chord indicator
      for (let idx = 0; idx < chordCount; idx++) {
        const element = indicatorRefs.current.get(idx);

        if (element) {
          const isActive = currentlyPlaying && idx === currentChord;

          // Split classes for proper toggle
          activeClass.split(' ').forEach((cls) => {
            if (cls) element.classList.toggle(cls, isActive);
          });
          inactiveClass.split(' ').forEach((cls) => {
            if (cls) element.classList.toggle(cls, !isActive);
          });
        }
      }
    },
    [chordCount, activeClass, inactiveClass],
  );

  /**
   * Reset all indicators to inactive state
   */
  const resetIndicators = useCallback(() => {
    for (let idx = 0; idx < chordCount; idx++) {
      const element = indicatorRefs.current.get(idx);

      if (element) {
        activeClass.split(' ').forEach((cls) => {
          if (cls) element.classList.remove(cls);
        });
        inactiveClass.split(' ').forEach((cls) => {
          if (cls) element.classList.add(cls);
        });
      }
    }
  }, [chordCount, activeClass, inactiveClass]);

  /**
   * Subscribe to AtomicPlaybackClock
   */
  useEffect(() => {
    const clock = getAtomicPlaybackClock();

    if (!isPlaying) {
      resetIndicators();
      return;
    }

    const unsubscribe = clock.subscribe(updateChordIndicators);

    const currentState = clock.getCurrentState();
    if (currentState) {
      updateChordIndicators(currentState);
    }

    return () => {
      unsubscribe();
      resetIndicators();
    };
  }, [isPlaying, updateChordIndicators, resetIndicators]);

  return {
    registerChordIndicator,
    getCurrentMeasure,
    getCurrentChord,
  };
}

// =============================================================================
// LOOP STRIP SYNC HOOK
// =============================================================================

/**
 * Configuration for loop strip beat trail sync (for LoopGridStrip)
 */
export interface LoopStripSyncConfig {
  /** Total number of beats across all measures */
  totalBeats: number;
  /** Beats per measure (for calculating which beat is current) */
  beatsPerMeasure: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** CSS class to apply when beat has been played (yellow trail) */
  playedClass?: string;
  /** CSS class to apply when beat has not been played yet */
  unplayedClass?: string;
  /** Whether the widget is visible (optimization to skip updates when hidden) */
  isVisible?: boolean;
}

/**
 * Result from useLoopStripSync hook
 */
export interface LoopStripSyncResult {
  /**
   * Register a beat indicator element
   * Call this in ref callback: ref={(el) => registerBeatIndicator(measureIndex, beatIndex, el)}
   * measureIndex is 1-based, beatIndex is 1-based (matching LoopGridStrip convention)
   */
  registerBeatIndicator: (
    measureIndex: number,
    beatIndex: number,
    element: HTMLDivElement | null,
  ) => void;
  /**
   * Get the current total beat position (1-based)
   */
  getCurrentBeatPosition: () => number;
}

/**
 * Loop strip beat trail synchronization hook (for LoopGridStrip)
 *
 * This hook manages the yellow "played" trail that shows which beats
 * have been played. Uses AtomicPlaybackClock for consistent timing
 * with all other widgets.
 */
export function useLoopStripSync(
  config: LoopStripSyncConfig,
): LoopStripSyncResult {
  const {
    totalBeats,
    beatsPerMeasure,
    isPlaying,
    playedClass = 'bg-yellow-400 shadow-[0_0_4px_rgba(250,204,21,0.9)]',
    unplayedClass = 'bg-slate-500 shadow-[0_0_1px_rgba(0,0,0,0.8)]',
    isVisible = true,
  } = config;

  // Store refs to beat indicator elements
  // Key format: "measure-beat" (both 1-based)
  const indicatorRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const currentBeatPositionRef = useRef<number>(0);

  // Ref to track isVisible without re-subscribing
  const isVisibleRef = useRef(isVisible);
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  // Ref to track isPlaying without re-subscribing
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  /**
   * Register a beat indicator element
   */
  const registerBeatIndicator = useCallback(
    (
      measureIndex: number,
      beatIndex: number,
      element: HTMLDivElement | null,
    ) => {
      const key = `${measureIndex}-${beatIndex}`;
      if (element) {
        indicatorRefs.current.set(key, element);
      } else {
        indicatorRefs.current.delete(key);
      }
    },
    [],
  );

  const getCurrentBeatPosition = useCallback(
    () => currentBeatPositionRef.current,
    [],
  );

  /**
   * Direct DOM update function - updates beat trail based on playback position
   */
  const updateBeatIndicators = useCallback(
    (state: AtomicBeatState) => {
      if (!isVisibleRef.current) {
        return;
      }

      const { isCountdown, measureIndex, beatIndex } = state;

      // During countdown, show position 0 (first beat highlighted as "ready")
      // This keeps the loop strip consistent with other widgets that show beat 0
      const currentBeatPosition = isCountdown
        ? 1 // Show first beat as "ready" position during countdown
        : measureIndex * beatsPerMeasure + beatIndex + 1;

      currentBeatPositionRef.current = currentBeatPosition;

      const currentlyPlaying = isPlayingRef.current;

      // Update each beat indicator
      indicatorRefs.current.forEach((element, key) => {
        const [measureStr, beatStr] = key.split('-');
        const measureIdx = parseInt(measureStr, 10);
        const beatIdx = parseInt(beatStr, 10);

        // Calculate absolute beat position for this indicator (1-based)
        const indicatorBeatPosition =
          (measureIdx - 1) * beatsPerMeasure + beatIdx;

        // Has this beat been played?
        const hasBeenPlayed =
          currentlyPlaying && indicatorBeatPosition <= currentBeatPosition;

        // Split classes for proper toggle
        playedClass.split(' ').forEach((cls) => {
          if (cls) element.classList.toggle(cls, hasBeenPlayed);
        });
        unplayedClass.split(' ').forEach((cls) => {
          if (cls) element.classList.toggle(cls, !hasBeenPlayed);
        });
      });
    },
    [beatsPerMeasure, playedClass, unplayedClass],
  );

  /**
   * Reset all indicators to unplayed state
   */
  const resetIndicators = useCallback(() => {
    indicatorRefs.current.forEach((element) => {
      playedClass.split(' ').forEach((cls) => {
        if (cls) element.classList.remove(cls);
      });
      unplayedClass.split(' ').forEach((cls) => {
        if (cls) element.classList.add(cls);
      });
    });
  }, [playedClass, unplayedClass]);

  /**
   * Subscribe to AtomicPlaybackClock
   */
  useEffect(() => {
    const clock = getAtomicPlaybackClock();

    if (!isPlaying) {
      resetIndicators();
      return;
    }

    const unsubscribe = clock.subscribe(updateBeatIndicators);

    const currentState = clock.getCurrentState();
    if (currentState) {
      updateBeatIndicators(currentState);
    }

    return () => {
      unsubscribe();
      resetIndicators();
    };
  }, [isPlaying, updateBeatIndicators, resetIndicators]);

  return {
    registerBeatIndicator,
    getCurrentBeatPosition,
  };
}

// =============================================================================
// TRANSPORT CLOCK SYNC HOOK
// =============================================================================

/**
 * Configuration for transport clock position display sync
 */
export interface TransportClockSyncConfig {
  /** Whether playback is active */
  isPlaying: boolean;
  /** Beats per measure for display calculation */
  beatsPerMeasure?: number;
  /** Whether the widget is visible (optimization to skip updates when hidden) */
  isVisible?: boolean;
}

/**
 * Result from useTransportClockSync hook
 */
export interface TransportClockSyncResult {
  /**
   * Register the position display element
   * Call this in ref callback: ref={registerPositionDisplay}
   */
  registerPositionDisplay: (element: HTMLDivElement | null) => void;
  /**
   * Register the playing indicator element (the green dot)
   * Call this in ref callback: ref={registerPlayingIndicator}
   */
  registerPlayingIndicator: (element: HTMLDivElement | null) => void;
  /**
   * Get current position as formatted string
   */
  getFormattedPosition: () => string;
}

/**
 * Transport clock position display synchronization hook
 *
 * Updates the master clock position display directly via DOM manipulation
 * for jitter-free updates. Uses AtomicPlaybackClock for consistent timing.
 */
export function useTransportClockSync(
  config: TransportClockSyncConfig,
): TransportClockSyncResult {
  const { isPlaying, beatsPerMeasure = 4, isVisible = true } = config;

  // Store refs to display elements
  const positionDisplayRef = useRef<HTMLDivElement | null>(null);
  const playingIndicatorRef = useRef<HTMLDivElement | null>(null);
  const formattedPositionRef = useRef<string>('1:1:00');

  // Ref to track isVisible without re-subscribing
  const isVisibleRef = useRef(isVisible);
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  // Ref to track isPlaying without re-subscribing
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  /**
   * Register the position display element
   */
  const registerPositionDisplay = useCallback(
    (element: HTMLDivElement | null) => {
      positionDisplayRef.current = element;
    },
    [],
  );

  /**
   * Register the playing indicator element
   */
  const registerPlayingIndicator = useCallback(
    (element: HTMLDivElement | null) => {
      playingIndicatorRef.current = element;
    },
    [],
  );

  const getFormattedPosition = useCallback(
    () => formattedPositionRef.current,
    [],
  );

  /**
   * Format position for display
   * Converts AtomicBeatState to DAW-style "bar:beat:sixteenths" format
   */
  const formatPosition = useCallback((state: AtomicBeatState): string => {
    const { measureIndex, beatIndex, isCountdown, continuousBeat } = state;

    if (isCountdown) {
      // During countdown, show negative bar with beat position
      // measureIndex is -1 during countdown, beatIndex is 0
      const countdownBar = Math.abs(measureIndex);
      const displayBeat = beatIndex + 1;
      // Calculate sixteenths from continuousBeat fractional part
      const sixteenths = Math.floor((continuousBeat % 1) * 4);
      return `-${countdownBar}:${displayBeat}:${sixteenths.toString().padStart(2, '0')}`;
    }

    // Normal playback - convert 0-based to 1-based display
    const displayBar = measureIndex + 1;
    const displayBeat = beatIndex + 1;
    // Calculate sixteenths from continuousBeat fractional part
    const sixteenths = Math.floor((continuousBeat % 1) * 4);

    return `${displayBar}:${displayBeat}:${sixteenths.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Direct DOM update function - updates position display text
   */
  const updateDisplay = useCallback(
    (state: AtomicBeatState) => {
      if (!isVisibleRef.current) {
        return;
      }

      // Update position display text
      const formatted = formatPosition(state);
      formattedPositionRef.current = formatted;

      if (positionDisplayRef.current) {
        positionDisplayRef.current.textContent = formatted;
      }

      // Update playing indicator
      if (playingIndicatorRef.current) {
        const currentlyPlaying = isPlayingRef.current;
        playingIndicatorRef.current.classList.toggle(
          'bg-green-500',
          currentlyPlaying,
        );
        playingIndicatorRef.current.classList.toggle(
          'bg-slate-600',
          !currentlyPlaying,
        );
      }
    },
    [formatPosition],
  );

  /**
   * Reset display to default state
   */
  const resetDisplay = useCallback(() => {
    formattedPositionRef.current = '1:1:00';
    if (positionDisplayRef.current) {
      positionDisplayRef.current.textContent = '1:1:00';
    }
    if (playingIndicatorRef.current) {
      playingIndicatorRef.current.classList.remove('bg-green-500');
      playingIndicatorRef.current.classList.add('bg-slate-600');
    }
  }, []);

  /**
   * Subscribe to AtomicPlaybackClock
   */
  useEffect(() => {
    const clock = getAtomicPlaybackClock();

    if (!isPlaying) {
      resetDisplay();
      return;
    }

    const unsubscribe = clock.subscribe(updateDisplay);

    const currentState = clock.getCurrentState();
    if (currentState) {
      updateDisplay(currentState);
    }

    return () => {
      unsubscribe();
      resetDisplay();
    };
  }, [isPlaying, updateDisplay, resetDisplay]);

  return {
    registerPositionDisplay,
    registerPlayingIndicator,
    getFormattedPosition,
  };
}

// =============================================================================
// FRETBOARD ATOMIC SYNC HOOK
// =============================================================================

/**
 * Configuration for fretboard timing sync
 */
export interface FretboardAtomicSyncConfig {
  /** Whether playback is active */
  isPlaying: boolean;
  /** Whether the widget is visible (optimization to skip updates when hidden) */
  isVisible?: boolean;
  /** Number of countdown beats (default: 4 for 1 bar) */
  countdownBeats?: number;
  /** Beats per measure (default: 4 for 4/4 time) */
  beatsPerMeasure?: number;
}

/**
 * Result from useFretboardAtomicSync hook
 */
export interface FretboardAtomicSyncResult {
  /** Current exercise time in milliseconds (negative during countdown) */
  exerciseTimeMs: number;
  /** Current measure index (0-based, -1 during countdown) */
  currentMeasure: number;
  /** Current beat within measure (0-based) */
  currentBeat: number;
  /** Whether currently in countdown period */
  isCountdown: boolean;
  /** Current tempo in BPM */
  currentBpm: number;
  /** Visual seconds from AtomicPlaybackClock (lookahead compensated) */
  visualSeconds: number;
  /** Continuous beat position (e.g., 2.7 = 70% through beat 2) */
  continuousBeat: number;
  /** Ref to access current state without re-renders */
  stateRef: React.MutableRefObject<FretboardAtomicSyncResult>;
}

/**
 * Initial state for fretboard atomic sync
 */
const FRETBOARD_INITIAL_STATE: Omit<FretboardAtomicSyncResult, 'stateRef'> = {
  exerciseTimeMs: 0,
  currentMeasure: 0,
  currentBeat: 0,
  isCountdown: false,
  currentBpm: 120,
  visualSeconds: 0,
  continuousBeat: 0,
};

/**
 * useFretboardAtomicSync - Unified timing for FretboardCard from AtomicPlaybackClock
 *
 * This hook provides timing data for FretboardCard's exercise logic,
 * replacing the previous EventBus-based useAnimationTime approach.
 *
 * ## Why This Hook Exists
 *
 * Previously, useFretboardExercise used:
 * 1. EventBus 'transport:position-updated' events (~30Hz)
 * 2. A custom RAF loop for interpolation
 *
 * This was redundant because useFretboardNoteSync already subscribes to
 * AtomicPlaybackClock. This hook ensures all FretboardCard timing uses
 * the same clock source as other widgets (DrummerWidget, MetronomeWidget, etc.).
 *
 * ## Usage
 *
 * ```tsx
 * const atomicSync = useFretboardAtomicSync({
 *   isPlaying,
 *   isVisible: true,
 *   countdownBeats: 4,
 *   beatsPerMeasure: 4,
 * });
 *
 * // For React state (triggers re-renders on measure change)
 * const exerciseTimeMs = atomicSync.exerciseTimeMs;
 *
 * // For refs (no re-renders, always current)
 * const currentTime = atomicSync.stateRef.current.exerciseTimeMs;
 * ```
 */
export function useFretboardAtomicSync(
  config: FretboardAtomicSyncConfig,
): FretboardAtomicSyncResult {
  const {
    isPlaying,
    isVisible = true,
    countdownBeats = 4,
    beatsPerMeasure = 4,
  } = config;

  // Ref for 60fps updates without React re-renders
  const stateRef = useRef<Omit<FretboardAtomicSyncResult, 'stateRef'>>({
    ...FRETBOARD_INITIAL_STATE,
  });

  // State to trigger React updates on significant changes (measure transitions)
  const [reactState, setReactState] = useState<
    Omit<FretboardAtomicSyncResult, 'stateRef'>
  >({
    ...FRETBOARD_INITIAL_STATE,
  });

  // Track last measure to detect measure changes
  const lastMeasureRef = useRef<number>(-999);

  // Refs to track config without re-subscribing
  const isVisibleRef = useRef(isVisible);
  const countdownBeatsRef = useRef(countdownBeats);
  const beatsPerMeasureRef = useRef(beatsPerMeasure);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    countdownBeatsRef.current = countdownBeats;
  }, [countdownBeats]);

  useEffect(() => {
    beatsPerMeasureRef.current = beatsPerMeasure;
  }, [beatsPerMeasure]);

  // Subscribe to AtomicPlaybackClock
  useEffect(() => {
    const clock = getAtomicPlaybackClock();

    if (!isPlaying) {
      // Reset state when not playing
      stateRef.current = { ...FRETBOARD_INITIAL_STATE };
      lastMeasureRef.current = -999;
      setReactState({ ...FRETBOARD_INITIAL_STATE });
      return;
    }

    const handleBeatUpdate = (clockState: AtomicBeatState) => {
      // Skip updates if not visible (optimization)
      if (!isVisibleRef.current) {
        return;
      }

      // Calculate exercise time (accounting for countdown)
      // Countdown duration in seconds = countdownBeats * (60 / bpm)
      const countdownSeconds =
        countdownBeatsRef.current * (60 / clockState.currentBpm);
      const exerciseSeconds = clockState.visualSeconds - countdownSeconds;
      const exerciseTimeMs = exerciseSeconds * 1000;

      const newState: Omit<FretboardAtomicSyncResult, 'stateRef'> = {
        exerciseTimeMs,
        currentMeasure: clockState.measureIndex,
        currentBeat: clockState.beatIndex,
        isCountdown: clockState.isCountdown,
        currentBpm: clockState.currentBpm,
        visualSeconds: clockState.visualSeconds,
        continuousBeat: clockState.continuousBeat,
      };

      // Always update ref (for high-frequency access)
      stateRef.current = newState;

      // Only trigger React update on measure change (optimization)
      // This prevents 60 re-renders per second while still updating on significant changes
      if (clockState.measureIndex !== lastMeasureRef.current) {
        lastMeasureRef.current = clockState.measureIndex;
        setReactState(newState);
      }
    };

    const unsubscribe = clock.subscribe(handleBeatUpdate);

    // Apply initial state if clock is already running
    const currentClockState = clock.getCurrentState();
    if (currentClockState) {
      handleBeatUpdate(currentClockState);
    }

    return () => {
      unsubscribe();
    };
  }, [isPlaying]);

  // Return both React state (for re-renders) and ref (for high-frequency access)
  return {
    ...reactState,
    stateRef: stateRef as React.MutableRefObject<FretboardAtomicSyncResult>,
  };
}
