/**
 * useAtomicBeat - Hook for consuming the AtomicPlaybackClock
 *
 * ## Why This Hook?
 *
 * This hook provides a clean React interface to the AtomicPlaybackClock singleton.
 * It handles:
 * 1. Subscribing/unsubscribing from the clock
 * 2. Setting up AudioContext when available
 * 3. Syncing with transport start/stop
 * 4. Providing beat state with proper React lifecycle
 *
 * ## Migration from useVisualBeat
 *
 * This hook has the same return type as useVisualBeat, making migration simple:
 * ```typescript
 * // Before:
 * const { eighthNoteIndex, measureIndex } = useVisualBeat(4, isPlaying, isVisible);
 *
 * // After:
 * const { eighthNoteIndex, measureIndex } = useAtomicBeat(4, isPlaying, isVisible);
 * ```
 *
 * ## Key Difference from useVisualBeat
 *
 * useVisualBeat captures its own startTime when playback begins.
 * useAtomicBeat gets the EXACT transportStartTime from PlaybackEngine
 * via AtomicPlaybackClock, ensuring visual and audio are perfectly synced.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTransportContext } from '@/domains/playback/contexts/TransportContext';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import {
  AtomicPlaybackClock,
  getAtomicPlaybackClock,
  type AtomicBeatState,
} from '@/domains/playback/services/core/AtomicPlaybackClock.js';
import { musicalTruth } from '@/domains/playback/modules/tempo/MusicalTruthAuthority.js';

/**
 * Return type matches useVisualBeat for migration compatibility
 */
export interface AtomicBeatResult {
  /** Current beat index (0-based within measure) */
  beatIndex: number;
  /** Current eighth note index (0-7 for 8 eighth notes per bar) */
  eighthNoteIndex: number;
  /** Current measure index (0-based) */
  measureIndex: number;
  /** Total beat count since start (for chord progression tracking) */
  totalBeatCount: number;
  /** Current time in seconds (LOOKAHEAD COMPENSATED visual time) */
  visualSeconds: number;
  /** True if currently in countdown (negative bars) */
  isCountdown: boolean;
  /** Duration of one 8th note in milliseconds (for CSS animation timing) */
  eighthNoteDurationMs: number;
  /** Continuous beat position (e.g., 2.7 means 70% through beat 2) */
  continuousBeat: number;
  /** Current BPM (dynamic from musicalTruth) */
  currentBpm: number;
}

/**
 * Initial state when playback is stopped
 */
const INITIAL_STATE: AtomicBeatResult = {
  beatIndex: 0,
  eighthNoteIndex: 0,
  measureIndex: 0,
  totalBeatCount: 0,
  visualSeconds: 0,
  isCountdown: false,
  eighthNoteDurationMs: 500, // Default 120 BPM
  continuousBeat: 0,
  currentBpm: 120,
};

/**
 * Hook for consuming the AtomicPlaybackClock
 *
 * @param beatsPerMeasure - Number of beats per measure (default: 4)
 * @param isPlaying - Whether playback is active
 * @param isVisible - Whether widget is visible (optimization)
 */
export function useAtomicBeat(
  beatsPerMeasure: number = 4,
  isPlaying: boolean = false,
  isVisible: boolean = true
): AtomicBeatResult {
  const transport = useTransportContext();

  // State for beat indicator values
  const [beatState, setBeatState] = useState<AtomicBeatResult>(INITIAL_STATE);

  // Refs for clock management
  const clockRef = useRef<AtomicPlaybackClock | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isVisibleRef = useRef(isVisible);
  const wasPlayingRef = useRef(false);

  // Keep isVisible ref in sync
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  /**
   * Handle beat state updates from AtomicPlaybackClock
   */
  const handleBeatUpdate = useCallback((state: AtomicBeatState) => {
    // Skip updates if not visible (optimization)
    if (!isVisibleRef.current) {
      return;
    }

    const newState: AtomicBeatResult = {
      eighthNoteIndex: state.eighthNoteIndex,
      beatIndex: state.beatIndex,
      measureIndex: state.measureIndex,
      totalBeatCount: Math.floor(state.totalEighthNotes / 2),
      visualSeconds: state.visualSeconds,
      isCountdown: state.isCountdown,
      eighthNoteDurationMs: state.eighthNoteDurationMs,
      continuousBeat: state.continuousBeat,
      currentBpm: state.currentBpm,
    };

    setBeatState(newState);
  }, []);

  /**
   * Initialize the AtomicPlaybackClock
   */
  useEffect(() => {
    // Get or create the clock singleton
    const clock = getAtomicPlaybackClock();
    clockRef.current = clock;

    // Get AudioContext from CoreServices
    const coreServices = WindowRegistry.getCoreServices();
    if (coreServices) {
      const audioEngine = coreServices.getAudioEngine?.();
      if (audioEngine) {
        try {
          const context = audioEngine.getContext() as AudioContext;
          if (context) {
            clock.setAudioContext(context);
          }
        } catch (e) {
          // AudioContext not ready yet - will be set when playback starts
        }
      }
    }

    // Subscribe to beat updates
    unsubscribeRef.current = clock.subscribe(handleBeatUpdate);

    // Get initial state if available
    const initialState = clock.getCurrentState();
    if (initialState) {
      handleBeatUpdate(initialState);
    }

    return () => {
      // Unsubscribe on unmount
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [handleBeatUpdate]);

  /**
   * Start/stop the clock based on playback state
   *
   * IMPORTANT: We don't start the clock here - PlaybackEngine starts it
   * with the correct transportStartTime. We only configure and stop.
   */
  useEffect(() => {
    const clock = clockRef.current;
    if (!clock) {
      return;
    }

    // Handle playback start
    if (isPlaying && !wasPlayingRef.current) {
      // Get countdown beats from transport position
      const countdownBeats = transport.position?.bars < 0
        ? Math.abs(transport.position.bars) * beatsPerMeasure
        : musicalTruth.getCountdownBeats();

      // Configure the clock with musical parameters
      clock.configure(beatsPerMeasure, countdownBeats);

      // Ensure AudioContext is set
      const coreServices = WindowRegistry.getCoreServices();
      const audioEngine = coreServices?.getAudioEngine?.();
      if (audioEngine) {
        try {
          const context = audioEngine.getContext() as AudioContext;
          if (context) {
            clock.setAudioContext(context);
          }
        } catch (e) {
          // Context not ready
        }
      }

      // NOTE: We do NOT call clock.start() here!
      // PlaybackEngine.start() is responsible for:
      // 1. Calculating transportStartTime
      // 2. Calling clock.setTransportStartTime(transportStartTime)
      // 3. Calling clock.start()
      // This ensures visual is perfectly synced with audio scheduling.

      wasPlayingRef.current = true;
    }

    // Handle playback stop
    if (!isPlaying && wasPlayingRef.current) {
      clock.stop();
      wasPlayingRef.current = false;

      // Reset to initial state
      setBeatState(INITIAL_STATE);
    }
  }, [isPlaying, beatsPerMeasure, transport.position?.bars]);

  /**
   * Handle tempo changes during playback
   * The clock reads BPM dynamically, but we update local state for rendering
   */
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    // No need to reconfigure - clock reads musicalTruth.getBPM() on every tick
    // Just update local state's eighthNoteDurationMs for CSS timing
    const bpm = musicalTruth.getBPM();
    const secondsPerEighth = (60 / bpm) / 2;
    const eighthNoteDurationMs = secondsPerEighth * 1000;

    setBeatState((prev) => ({
      ...prev,
      eighthNoteDurationMs,
      currentBpm: bpm,
    }));
  }, [transport.tempo, isPlaying]);

  return beatState;
}

/**
 * Convenience hook that only returns the eighth note index
 * Useful for simple beat indicators that just need the column
 */
export function useAtomicEighthNoteIndex(
  isPlaying: boolean = false,
  isVisible: boolean = true
): number {
  const { eighthNoteIndex } = useAtomicBeat(4, isPlaying, isVisible);
  return eighthNoteIndex;
}

/**
 * Convenience hook that only returns measure info
 * Useful for components tracking measure progression
 */
export function useAtomicMeasureIndex(
  isPlaying: boolean = false,
  isVisible: boolean = true
): { measureIndex: number; isCountdown: boolean } {
  const { measureIndex, isCountdown } = useAtomicBeat(4, isPlaying, isVisible);
  return { measureIndex, isCountdown };
}

/**
 * Low-level hook for direct clock access (for advanced use cases)
 * Returns the clock instance and current state without React state updates
 */
export function useAtomicClockDirect(): {
  clock: AtomicPlaybackClock;
  getVisualTime: () => number;
  isRunning: () => boolean;
} {
  const clock = getAtomicPlaybackClock();

  return {
    clock,
    getVisualTime: () => clock.getVisualTime(),
    isRunning: () => clock.getIsRunning(),
  };
}
