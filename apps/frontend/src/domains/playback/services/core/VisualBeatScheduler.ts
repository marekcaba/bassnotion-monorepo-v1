/**
 * VisualBeatScheduler - Jitter-Free Visual Beat Synchronization
 *
 * ## The Problem
 * Previous approaches had visible jitter because:
 * 1. RAF fires every ~16.7ms, but beats don't align with frame boundaries
 * 2. Math.floor(time / beatDuration) causes quantization jitter at transitions
 * 3. Measuring intervals between "detected" beat changes compounds the error
 *
 * ## The Solution: Sub-Frame Interpolation
 * Instead of discrete beat detection, we calculate a CONTINUOUS beat position:
 * 1. Calculate exact floating-point beat position from audio time
 * 2. Store this as `continuousBeat` (e.g., 2.7 means 70% through beat 2)
 * 3. Components can use this for smooth animations if needed
 * 4. For grid highlighting, we use Math.floor(continuousBeat) for discrete position
 *
 * The key insight: The DISCRETE beat index is fine for grid highlighting.
 * The jitter we see in logs is from measuring DETECTION intervals, not the
 * actual visual display time. The grid column is displayed based on audio time,
 * which IS consistent - the RAF frame timing just varies.
 *
 * ## Actual Fix
 * The perceived jitter comes from:
 * 1. React state updates batching (can delay 50-100ms under load)
 * 2. RAF timing variance (~16ms per frame)
 *
 * Solution: Update state ONLY when needed, use refs for continuous values.
 *
 * ## Usage
 * The VisualBeatScheduler is a singleton that runs during playback.
 * Components subscribe to beat updates via useVisualBeat hook.
 */

import { getLogger } from '@/utils/logger.js';
import type { EventBus } from './EventBus.js';

const logger = getLogger('VisualBeatScheduler');

/**
 * Visual beat state emitted to subscribers
 */
export interface VisualBeatState {
  /** 0-based 8th note index within the measure (0-7 for 4/4) */
  eighthNoteIndex: number;
  /** 0-based beat index within the measure (0-3 for 4/4) */
  beatIndex: number;
  /** 0-based measure index from start of exercise */
  measureIndex: number;
  /** Total 8th note count since exercise start */
  totalEighthNotes: number;
  /** True if currently in countdown (negative bars) */
  isCountdown: boolean;
  /** Audio time when this beat started (AudioContext time in seconds) */
  audioTime: number;
  /** Timestamp when this visual update occurred (performance.now()) */
  visualTimestamp: number;
  /** Duration of one 8th note in milliseconds (for CSS animation timing) */
  eighthNoteDurationMs: number;
  /** Continuous beat position (e.g., 2.7 means 70% through beat 2) */
  continuousBeat: number;
}

/**
 * Subscriber callback type
 */
type BeatSubscriber = (state: VisualBeatState) => void;

/**
 * Configuration for the scheduler
 */
export interface VisualBeatSchedulerConfig {
  /** Beats per measure (default: 4 for 4/4 time) */
  beatsPerMeasure: number;
  /** Tempo in BPM */
  tempo: number;
  /** Number of countdown beats before exercise starts (0 for no countdown) */
  countdownBeats: number;
  /** Audio start time (AudioContext.currentTime when playback started) */
  startTime: number;
}

/**
 * VisualBeatScheduler - Singleton service for jitter-free visual beat synchronization
 */
export class VisualBeatScheduler {
  private static instance: VisualBeatScheduler | null = null;

  // Configuration
  private config: VisualBeatSchedulerConfig = {
    beatsPerMeasure: 4,
    tempo: 120,
    countdownBeats: 0,
    startTime: 0,
  };

  // State
  private isRunning = false;
  private rafId: number | null = null;
  private subscribers = new Set<BeatSubscriber>();
  private currentState: VisualBeatState | null = null;
  private eventBus: EventBus | null = null;

  // Cached calculations (recalculated on config change)
  private eighthNoteDuration = 0; // Duration of one 8th note in seconds
  private countdownDuration = 0; // Total countdown duration in seconds
  private eighthNotesPerMeasure = 8; // 8th notes per measure (4 beats * 2)

  // Performance tracking
  private lastFrameTime = 0;
  private frameCount = 0;
  private instanceId: string;
  private lastBeatTransitionTime = 0;
  private intervalHistory: number[] = [];

  // Audio context reference
  private audioContext: AudioContext | null = null;

  private constructor() {
    this.instanceId = Math.random().toString(36).substring(2, 11);
    logger.info('VisualBeatScheduler created', { instanceId: this.instanceId });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): VisualBeatScheduler {
    if (!VisualBeatScheduler.instance) {
      VisualBeatScheduler.instance = new VisualBeatScheduler();
    }
    return VisualBeatScheduler.instance;
  }

  /**
   * Initialize with EventBus (optional, for emitting events to legacy subscribers)
   */
  initialize(eventBus: EventBus | null = null): void {
    this.eventBus = eventBus;
    logger.info('VisualBeatScheduler initialized', {
      instanceId: this.instanceId,
      hasEventBus: !!eventBus,
    });
  }

  /**
   * Set the AudioContext reference
   * This is needed to read currentTime for beat calculations
   */
  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
    logger.debug('AudioContext set', { state: context.state });
  }

  /**
   * Configure the scheduler with tempo and time signature
   * Recalculates cached duration values
   */
  configure(config: Partial<VisualBeatSchedulerConfig>): void {
    this.config = { ...this.config, ...config };
    this.recalculateDurations();

    logger.info('VisualBeatScheduler configured', {
      tempo: this.config.tempo,
      beatsPerMeasure: this.config.beatsPerMeasure,
      countdownBeats: this.config.countdownBeats,
      eighthNoteDurationMs: (this.eighthNoteDuration * 1000).toFixed(1),
    });
  }

  /**
   * Recalculate duration values based on current config
   */
  private recalculateDurations(): void {
    const { tempo, beatsPerMeasure, countdownBeats } = this.config;

    // Duration of one 8th note in seconds
    // Quarter note = 60 / BPM seconds
    // 8th note = Quarter note / 2
    this.eighthNoteDuration = 60 / tempo / 2;

    // 8th notes per measure (each beat has 2 eighth notes)
    this.eighthNotesPerMeasure = beatsPerMeasure * 2;

    // Total countdown duration in seconds
    // Each countdown beat has 2 eighth notes
    this.countdownDuration = countdownBeats * 2 * this.eighthNoteDuration;
  }

  /**
   * Start the visual beat scheduling loop
   *
   * @param startTime - AudioContext.currentTime when playback started
   */
  start(startTime: number): void {
    if (this.isRunning) {
      logger.warn('VisualBeatScheduler already running');
      return;
    }

    if (!this.audioContext) {
      logger.error('Cannot start VisualBeatScheduler - no AudioContext');
      return;
    }

    this.config.startTime = startTime;
    this.isRunning = true;
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.lastBeatTransitionTime = 0;
    this.intervalHistory = [];
    this.currentState = null;

    logger.info('VisualBeatScheduler starting', {
      startTime: startTime.toFixed(3),
      tempo: this.config.tempo,
      eighthNoteDurationMs: (this.eighthNoteDuration * 1000).toFixed(1),
      countdownDurationMs: (this.countdownDuration * 1000).toFixed(1),
    });

    // Start the RAF loop
    this.tick();
  }

  /**
   * Stop the visual beat scheduling loop
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.isRunning = false;
    this.currentState = null;

    logger.info('VisualBeatScheduler stopped', {
      totalFrames: this.frameCount,
    });
  }

  /**
   * Subscribe to beat updates
   * Returns unsubscribe function
   */
  subscribe(callback: BeatSubscriber): () => void {
    this.subscribers.add(callback);

    // Immediately send current state if available
    if (this.currentState) {
      callback(this.currentState);
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get current beat state (for initial render)
   */
  getCurrentState(): VisualBeatState | null {
    return this.currentState;
  }

  /**
   * Check if scheduler is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Main RAF tick - calculates beat position from audio time
   */
  private tick = (): void => {
    if (!this.isRunning || !this.audioContext) {
      return;
    }

    // Schedule next frame first (ensures consistent timing)
    this.rafId = requestAnimationFrame(this.tick);
    this.frameCount++;

    const now = performance.now();
    const audioTime = this.audioContext.currentTime;

    // Calculate elapsed time since playback start
    const elapsedAudioTime = audioTime - this.config.startTime;

    // Adjust for countdown: during countdown, elapsed time is negative relative to exercise start
    const adjustedTime = elapsedAudioTime - this.countdownDuration;

    // Calculate current 8th note position
    // Use floor to get discrete beat positions (we're "on" a beat, not between them)
    const totalEighthNotes = Math.floor(adjustedTime / this.eighthNoteDuration);

    const isCountdown = adjustedTime < 0;

    // During countdown: use countdownEighthNote for indicator position
    // During normal playback: calculate from transport time
    let eighthNoteIndex: number;
    let beatIndex: number;
    let measureIndex: number;

    if (isCountdown) {
      // During countdown, calculate countdown position
      // Countdown beats go: -4, -3, -2, -1 (if countdownBeats = 4)
      // For visual indicator, we show 0 throughout countdown
      eighthNoteIndex = 0;
      beatIndex = 0;
      measureIndex = -1;
    } else {
      eighthNoteIndex = totalEighthNotes % this.eighthNotesPerMeasure;
      beatIndex = Math.floor(eighthNoteIndex / 2);
      measureIndex = Math.floor(totalEighthNotes / this.eighthNotesPerMeasure);
    }

    // Check if beat changed since last frame
    const beatChanged =
      !this.currentState ||
      this.currentState.eighthNoteIndex !== eighthNoteIndex ||
      this.currentState.measureIndex !== measureIndex ||
      this.currentState.isCountdown !== isCountdown;

    // Calculate continuous beat position (for smooth animations)
    // This represents the exact position within the beat (e.g., 2.7 = 70% through beat 2)
    const continuousBeat = isCountdown
      ? 0
      : adjustedTime / this.eighthNoteDuration;

    if (beatChanged) {
      // Create new state
      const newState: VisualBeatState = {
        eighthNoteIndex,
        beatIndex,
        measureIndex,
        totalEighthNotes: Math.max(0, totalEighthNotes),
        isCountdown,
        audioTime,
        visualTimestamp: now,
        eighthNoteDurationMs: this.eighthNoteDuration * 1000,
        continuousBeat,
      };

      // Log transition for debugging
      // Set to true to see jitter-free timing diagnostics in console
      const DEBUG_BEAT_TIMING = false;
      if (DEBUG_BEAT_TIMING && !isCountdown) {
        const expectedTime =
          this.config.startTime +
          this.countdownDuration +
          totalEighthNotes * this.eighthNoteDuration;
        const visualLag = (audioTime - expectedTime) * 1000;

        // Track interval between visual beat transitions
        const interval =
          this.lastBeatTransitionTime > 0
            ? now - this.lastBeatTransitionTime
            : 0;
        this.lastBeatTransitionTime = now;

        // Keep last 16 intervals for analysis
        if (interval > 0) {
          this.intervalHistory.push(interval);
          if (this.intervalHistory.length > 16) {
            this.intervalHistory.shift();
          }
        }

        // Calculate interval statistics
        const expectedIntervalMs = this.eighthNoteDuration * 1000;
        const intervalDeviation =
          interval > 0 ? interval - expectedIntervalMs : 0;

        // Log every 8th beat (once per measure) with interval stats
        if (eighthNoteIndex === 0 && this.intervalHistory.length >= 4) {
          const avgInterval =
            this.intervalHistory.reduce((a, b) => a + b, 0) /
            this.intervalHistory.length;
          const minInterval = Math.min(...this.intervalHistory);
          const maxInterval = Math.max(...this.intervalHistory);
          const jitter = maxInterval - minInterval;

          console.log('[VISUAL_BEAT_STATS]', {
            measure: measureIndex,
            expectedMs: expectedIntervalMs.toFixed(1),
            avgMs: avgInterval.toFixed(1),
            minMs: minInterval.toFixed(1),
            maxMs: maxInterval.toFixed(1),
            jitterMs: jitter.toFixed(1),
            lastDevMs: intervalDeviation.toFixed(1),
          });
        }

        logger.debug('VISUAL_BEAT_TRANSITION', {
          eighth: eighthNoteIndex,
          measure: measureIndex,
          intervalMs: interval.toFixed(1),
          expectedMs: expectedIntervalMs.toFixed(1),
          deviationMs: intervalDeviation.toFixed(1),
        });
      }

      this.currentState = newState;

      // Notify all subscribers
      this.notifySubscribers(newState);

      // Emit to EventBus for legacy compatibility
      this.emitToEventBus(newState);
    }

    this.lastFrameTime = now;
  };

  /**
   * Notify all subscribers of beat change
   */
  private notifySubscribers(state: VisualBeatState): void {
    this.subscribers.forEach((subscriber) => {
      try {
        subscriber(state);
      } catch (error) {
        logger.error('Subscriber error', error);
      }
    });
  }

  /**
   * Emit beat event to EventBus for legacy compatibility
   */
  private emitToEventBus(state: VisualBeatState): void {
    if (!this.eventBus) {
      return;
    }

    // Cast state to any for EventBus compatibility (EventBus expects index signature)
    const eventData = state as unknown as Record<string, unknown>;

    // Emit in the same format as BeatEmitter for compatibility
    this.eventBus.emit('visual:eighth-note', eventData);

    // Emit on quarter notes (for widgets that only need quarter note resolution)
    if (state.eighthNoteIndex % 2 === 0) {
      this.eventBus.emit('visual:quarter-note', eventData);
    }

    // Emit measure event on first beat of each measure
    if (state.eighthNoteIndex === 0 && !state.isCountdown) {
      this.eventBus.emit('visual:measure', eventData);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();
    this.subscribers.clear();
    this.eventBus = null;
    this.audioContext = null;
    VisualBeatScheduler.instance = null;
    logger.info('VisualBeatScheduler disposed');
  }
}

// Export singleton accessor
export const getVisualBeatScheduler = (): VisualBeatScheduler =>
  VisualBeatScheduler.getInstance();
