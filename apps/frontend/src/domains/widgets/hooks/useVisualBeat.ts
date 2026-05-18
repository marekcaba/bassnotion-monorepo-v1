/**
 * useVisualBeat - Jitter-Free Visual Beat Hook
 *
 * Replaces useBeatIndicator with a jitter-free implementation that:
 * 1. Calculates beat position directly from AudioContext.currentTime
 * 2. Runs its own RAF loop (not dependent on Tone.Draw)
 * 3. Ensures each visual beat displays for EXACTLY the same duration
 *
 * ## Why This Exists
 * The previous useBeatIndicator relied on Tone.Draw which schedules callbacks
 * on the "nearest animation frame" to the audio time. This causes jitter when
 * beat intervals don't align with animation frame intervals.
 *
 * ## How It Works
 * - Subscribes to VisualBeatScheduler (singleton RAF loop)
 * - VisualBeatScheduler reads AudioContext.currentTime on each frame
 * - Calculates beat position from audio time (not from callbacks)
 * - Updates state only when beat actually changes
 *
 * ## Migration from useBeatIndicator
 * This hook has the same return type as useBeatIndicator, making migration simple:
 * - Replace: useBeatIndicator(beatsPerMeasure, isPlaying, isVisible)
 * - With: useVisualBeat(beatsPerMeasure, isPlaying, isVisible)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTransportContext } from '@/domains/playback/contexts/TransportContext';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import {
  VisualBeatScheduler,
  getVisualBeatScheduler,
  type VisualBeatState,
} from '@/domains/playback/services/core/VisualBeatScheduler.js';
import { musicalTruth } from '@/domains/playback/modules/tempo/MusicalTruthAuthority.js';

// Diagnostic logging - set to true to see jitter-free timing diagnostics
const DEBUG_VISUAL_BEAT = false;
const logDebug = DEBUG_VISUAL_BEAT
  ? (msg: string, data?: Record<string, unknown>) => {
      console.log(`[useVisualBeat] ${msg}`, data ?? '');
    }
  : () => {};

/**
 * Return type matches useBeatIndicator for easy migration
 */
export interface VisualBeatResult {
  /** Current beat index (0-based within measure) */
  beatIndex: number;
  /** Current eighth note index (0-7 for 8 eighth notes per bar) */
  eighthNoteIndex: number;
  /** Current measure index (0-based) */
  measureIndex: number;
  /** Total beat count since start (for chord progression tracking) */
  totalBeatCount: number;
  /** Current time in seconds (audio time from AudioContext) */
  visualSeconds: number;
  /** True if currently in countdown (negative bars) */
  isCountdown: boolean;
  /** Duration of one 8th note in milliseconds (for CSS animation timing) */
  eighthNoteDurationMs: number;
  /** Continuous beat position (e.g., 2.7 means 70% through beat 2) - for smooth animations */
  continuousBeat: number;
}

/**
 * Initial state when playback is stopped or not yet started
 */
const INITIAL_STATE: VisualBeatResult = {
  beatIndex: 0,
  eighthNoteIndex: 0,
  measureIndex: 0,
  totalBeatCount: 0,
  visualSeconds: 0,
  isCountdown: false,
  eighthNoteDurationMs: 500, // Default 120 BPM
  continuousBeat: 0,
};

/**
 * Hook for jitter-free visual beat synchronization.
 *
 * @param beatsPerMeasure - Number of beats per measure (default: 4)
 * @param isPlaying - Whether playback is active
 * @param isVisible - Whether the widget is visible (optimization - pauses updates when hidden)
 */
export function useVisualBeat(
  beatsPerMeasure = 4,
  isPlaying = false,
  isVisible = true,
): VisualBeatResult {
  const transport = useTransportContext();

  // State for beat indicator values
  const [beatState, setBeatState] = useState<VisualBeatResult>(INITIAL_STATE);

  // Refs for scheduler management
  const schedulerRef = useRef<VisualBeatScheduler | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isVisibleRef = useRef(isVisible);
  const wasPlayingRef = useRef(false);

  // Keep isVisible ref in sync
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  /**
   * Handle beat state updates from VisualBeatScheduler
   */
  const handleBeatUpdate = useCallback((state: VisualBeatState) => {
    // Skip updates if not visible (optimization)
    if (!isVisibleRef.current) {
      return;
    }

    const newState: VisualBeatResult = {
      eighthNoteIndex: state.eighthNoteIndex,
      beatIndex: state.beatIndex,
      measureIndex: state.measureIndex,
      totalBeatCount: Math.floor(state.totalEighthNotes / 2),
      visualSeconds: state.audioTime,
      isCountdown: state.isCountdown,
      eighthNoteDurationMs: state.eighthNoteDurationMs,
      continuousBeat: state.continuousBeat,
    };

    logDebug('Beat update', {
      eighth: state.eighthNoteIndex,
      measure: state.measureIndex,
      isCountdown: state.isCountdown,
      durationMs: state.eighthNoteDurationMs,
    });

    setBeatState(newState);
  }, []);

  /**
   * Initialize/cleanup the VisualBeatScheduler
   */
  useEffect(() => {
    // Get or create the scheduler singleton
    const scheduler = getVisualBeatScheduler();
    schedulerRef.current = scheduler;

    // Get AudioContext from CoreServices
    const coreServices = WindowRegistry.getCoreServices();
    if (coreServices) {
      const audioEngine = coreServices.getAudioEngine?.();
      if (audioEngine) {
        try {
          const context = audioEngine.getContext() as AudioContext;
          if (context) {
            scheduler.setAudioContext(context);
            logDebug('AudioContext set', { state: context.state });
          }
        } catch (e) {
          logDebug('AudioContext not ready yet');
        }
      }

      // Initialize with EventBus for legacy compatibility
      const eventBus = coreServices.getEventBus?.();
      if (eventBus) {
        scheduler.initialize(eventBus);
      }
    }

    // Subscribe to beat updates
    unsubscribeRef.current = scheduler.subscribe(handleBeatUpdate);

    // Get initial state if available
    const initialState = scheduler.getCurrentState();
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
   * Start/stop the scheduler based on playback state
   */
  useEffect(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler) {
      return;
    }

    // Handle playback start
    if (isPlaying && !wasPlayingRef.current) {
      logDebug('Playback started, configuring scheduler');

      // Get current tempo from musicalTruth (single source of truth)
      const tempo = musicalTruth.getBPM();

      // Get countdown beats from transport position
      // During countdown, position.bars is negative
      const countdownBeats =
        transport.position?.bars < 0
          ? Math.abs(transport.position.bars) * beatsPerMeasure
          : 0;

      // Configure with current tempo and time signature
      scheduler.configure({
        beatsPerMeasure,
        tempo,
        countdownBeats,
        startTime: 0, // Will be set in start()
      });

      // Get AudioContext start time
      const coreServices = WindowRegistry.getCoreServices();
      const audioEngine = coreServices?.getAudioEngine?.();
      let startTime = 0;

      if (audioEngine) {
        try {
          const context = audioEngine.getContext() as AudioContext;
          if (context) {
            startTime = context.currentTime;
            scheduler.setAudioContext(context);
          }
        } catch (e) {
          logDebug('Could not get AudioContext time');
        }
      }

      // Start the scheduler
      scheduler.start(startTime);
      wasPlayingRef.current = true;
    }

    // Handle playback stop
    if (!isPlaying && wasPlayingRef.current) {
      logDebug('Playback stopped, stopping scheduler');
      scheduler.stop();
      wasPlayingRef.current = false;

      // Reset to initial state
      setBeatState(INITIAL_STATE);
    }
  }, [isPlaying, beatsPerMeasure, transport.position?.bars]);

  /**
   * Update tempo when it changes during playback
   */
  useEffect(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler || !isPlaying) {
      return;
    }

    const tempo = musicalTruth.getBPM();
    logDebug('Tempo update', { tempo });

    // Reconfigure with new tempo (keeps scheduler running)
    scheduler.configure({
      tempo,
    });
  }, [transport.tempo, isPlaying]);

  return beatState;
}

/**
 * Convenience hook that only returns the eighth note index
 * Useful for simple beat indicators that just need the column
 */
export function useEighthNoteIndex(
  isPlaying = false,
  isVisible = true,
): number {
  const { eighthNoteIndex } = useVisualBeat(4, isPlaying, isVisible);
  return eighthNoteIndex;
}

/**
 * Convenience hook that only returns measure info
 * Useful for components tracking measure progression
 */
export function useMeasureIndex(
  isPlaying = false,
  isVisible = true,
): { measureIndex: number; isCountdown: boolean } {
  const { measureIndex, isCountdown } = useVisualBeat(4, isPlaying, isVisible);
  return { measureIndex, isCountdown };
}
