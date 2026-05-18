/**
 * useBeatIndicator - Unified beat indicator timing for all compact widgets
 *
 * This is the SINGLE SOURCE OF TRUTH for visual beat indicators.
 * All widgets (DrummerWidget, MetronomeWidget, HarmonyWidget, BassLineWidget)
 * MUST use this hook to ensure synchronized visual timing across the UI.
 *
 * AUDIO-SYNCHRONIZED ARCHITECTURE (v4.0) - TONE.DRAW INTEGRATION:
 * ==============================================================
 * Previous versions used setTimeout scheduling which had ±30-60ms jitter
 * because it calculated beat positions from performance.now() elapsed time.
 *
 * v4.0 uses TONE.DRAW for perfect audio-visual synchronization:
 * - BeatEmitter uses Tone.Transport.scheduleRepeat() to schedule beat callbacks
 * - Inside those callbacks, Tone.Draw.schedule() queues visual updates
 * - Tone.Draw fires on the nearest animation frame to when audio actually plays
 * - This hook subscribes to 'beat:eighth-note' events from EventBus
 *
 * WHY TONE.DRAW ELIMINATES JITTER:
 * From Tone.js documentation:
 * > "Transport callbacks can be invoked WELL IN ADVANCE of when the event is heard,
 * >  so visuals triggered inside of one of these callbacks might not align with
 * >  the audio event they are triggered with."
 *
 * Tone.Draw.schedule() synchronizes visual updates to when audio actually plays,
 * ensuring visual indicators match audio perfectly.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTransportContext } from '@/domains/playback/contexts/TransportContext';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import type { BeatEvent } from '@/domains/playback/services/core/BeatEmitter';

// Diagnostic logging for timing analysis - disable in production
const DEBUG_TIMING = false;
const logTiming = DEBUG_TIMING
  ? (msg: string, data?: Record<string, unknown>) => {
      console.log(`[BEAT_INDICATOR] ${msg}`, data ?? '');
    }
  : () => {};

export interface BeatIndicatorResult {
  /** Current beat index (0-based within measure) */
  beatIndex: number;
  /** Current eighth note index (0-7 for 8 eighth notes per bar) */
  eighthNoteIndex: number;
  /** Current measure index (0-based) */
  measureIndex: number;
  /** Total beat count since start (for chord progression tracking) */
  totalBeatCount: number;
  /** Current time in seconds (audio time from Tone.Transport) */
  visualSeconds: number;
  /** True if currently in countdown (negative bars) */
  isCountdown: boolean;
}

/**
 * Initial state when playback is stopped or not yet started
 */
const INITIAL_STATE: BeatIndicatorResult = {
  beatIndex: 0,
  eighthNoteIndex: 0,
  measureIndex: 0,
  totalBeatCount: 0,
  visualSeconds: 0,
  isCountdown: false,
};

/**
 * Unified hook for beat indicator timing across all widgets.
 * Uses TONE.DRAW for audio-synchronized visual timing via EventBus.
 *
 * @param beatsPerMeasure - Number of beats per measure (default: 4)
 * @param isPlaying - Whether playback is active (from TransportContext)
 * @param isVisible - Whether the widget is visible (optimization - pauses updates when hidden)
 */
export function useBeatIndicator(
  beatsPerMeasure = 4,
  isPlaying = false,
  isVisible = true,
): BeatIndicatorResult {
  const transport = useTransportContext();
  const position = transport?.position;

  // State for beat indicator values
  const [beatState, setBeatState] =
    useState<BeatIndicatorResult>(INITIAL_STATE);

  // Refs for tracking subscriptions
  const unsubEighthNoteRef = useRef<(() => void) | null>(null);
  const unsubStopRef = useRef<(() => void) | null>(null);
  const isVisibleRef = useRef(isVisible);

  // Keep isVisible ref in sync
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  /**
   * Handle beat events from BeatEmitter (via EventBus)
   * These events are scheduled via Tone.Draw for perfect audio-visual sync
   */
  const handleBeatEvent = useCallback((event: BeatEvent) => {
    // Skip updates if not visible (optimization)
    if (!isVisibleRef.current) {
      return;
    }

    const newState: BeatIndicatorResult = {
      eighthNoteIndex: event.eighthNoteIndex,
      beatIndex: event.beatIndex,
      measureIndex: event.measureIndex,
      totalBeatCount: Math.floor(event.totalEighthNotes / 2),
      visualSeconds: event.audioTime,
      isCountdown: event.isCountdown,
    };

    logTiming('BEAT_EVENT', {
      eighthNote: event.eighthNoteIndex,
      measure: event.measureIndex,
      isCountdown: event.isCountdown,
    });

    setBeatState(newState);
  }, []);

  // ============================================================================
  // EVENTBUS SUBSCRIPTION FOR BEAT EVENTS
  // ============================================================================
  useEffect(() => {
    const RETRY_CONFIG = {
      initialDelayMs: 50,
      maxDelayMs: 500,
      backoffMultiplier: 1.5,
      maxAttempts: 20,
    } as const;

    let attemptCount = 0;
    let currentDelay = RETRY_CONFIG.initialDelayMs;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let isCleanedUp = false;

    const getEventBus = (): any | null => {
      return WindowRegistry.getServiceRegistry()?.get('eventBus') ?? null;
    };

    const subscribeToEvents = (eventBus: any): void => {
      // Subscribe to eighth note events from BeatEmitter
      // These are synchronized via Tone.Draw for perfect audio-visual sync
      unsubEighthNoteRef.current = eventBus.on(
        'beat:eighth-note',
        handleBeatEvent,
      );

      // Subscribe to transport:stop to reset state
      unsubStopRef.current = eventBus.on('transport:stop', () => {
        setBeatState(INITIAL_STATE);
        logTiming('transport:stop - state reset');
      });

      logTiming('EventBus subscribed (beat:eighth-note)', {
        attempts: attemptCount,
      });
    };

    const attemptSubscription = (): void => {
      if (isCleanedUp) return;

      attemptCount++;
      const eventBus = getEventBus();

      if (eventBus) {
        subscribeToEvents(eventBus);
        return;
      }

      if (attemptCount >= RETRY_CONFIG.maxAttempts) {
        logTiming('EventBus not available after max attempts', {
          attempts: attemptCount,
        });
        return;
      }

      retryTimeoutId = setTimeout(attemptSubscription, currentDelay);
      currentDelay = Math.min(
        currentDelay * RETRY_CONFIG.backoffMultiplier,
        RETRY_CONFIG.maxDelayMs,
      );
    };

    attemptSubscription();

    return () => {
      isCleanedUp = true;

      if (retryTimeoutId !== null) {
        clearTimeout(retryTimeoutId);
      }

      if (unsubEighthNoteRef.current) {
        unsubEighthNoteRef.current();
        unsubEighthNoteRef.current = null;
      }
      if (unsubStopRef.current) {
        unsubStopRef.current();
        unsubStopRef.current = null;
      }
    };
  }, [handleBeatEvent]);

  // ============================================================================
  // PLAYBACK STATE MANAGEMENT
  // ============================================================================
  useEffect(() => {
    // Reset state when not playing
    if (!isPlaying) {
      setBeatState(INITIAL_STATE);
      return;
    }

    // Check if we're in countdown (negative bars from TransportContext)
    const isCountdown = position?.bars !== undefined && position.bars < 0;

    if (isCountdown) {
      setBeatState({
        ...INITIAL_STATE,
        isCountdown: true,
      });
    }
  }, [isPlaying, position?.bars]);

  return beatState;
}
