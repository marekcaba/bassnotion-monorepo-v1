/**
 * AtomicPlaybackClock - The SINGLE SOURCE OF TRUTH for Visual Playback Position
 *
 * ## Problem This Solves
 *
 * The previous timing system had MULTIPLE timing sources that weren't properly synchronized:
 * 1. AudioContext.currentTime - The monotonic audio clock
 * 2. Tone.Transport.seconds - Tone.js position (includes scheduling complexity)
 * 3. VisualBeatScheduler.startTime - Captured at different moment than audio scheduling
 * 4. Transport.transportStartTime - Used for position updates
 * 5. PlaybackEngine.transportStartTime - Used for audio event scheduling
 *
 * The root cause of visual-audio desync: Audio is scheduled with a LOOKAHEAD (300ms)
 * so it plays 300ms AFTER transport starts. But visual systems didn't consistently
 * account for this, showing where audio WILL BE, not where it IS.
 *
 * ## The FAA-Grade Atomic Clock Solution
 *
 * This service provides:
 * 1. **Single transportStartTime** - Captured ONCE and shared with ALL consumers
 * 2. **Lookahead-compensated visual time** - Always shows ACTUAL audio position
 * 3. **Dynamic tempo** - Reads BPM from musicalTruth on EVERY tick
 * 4. **High-frequency RAF updates** - 60fps visual position without React batching
 * 5. **Direct DOM/ref compatibility** - No state updates, pure time values
 *
 * ## Architecture
 *
 * ```
 *                    ┌─────────────────────────────────────┐
 *                    │       AtomicPlaybackClock           │
 *                    │   (SINGLE SOURCE OF TRUTH)          │
 *                    │                                     │
 *                    │  transportStartTime (from Engine)   │
 *                    │  audioContext.currentTime           │
 *                    │  musicalTruth.getBPM()              │
 *                    │  TRANSPORT_TIMING_CONFIG            │
 *                    └─────────────────┬───────────────────┘
 *                                      │
 *            ┌─────────────────────────┼─────────────────────────┐
 *            │                         │                         │
 *            ▼                         ▼                         ▼
 *    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
 *    │ DrummerWidget │       │MetronomeWidget│       │ FretboardCard │
 *    │  (subscriber) │       │  (subscriber) │       │  (subscriber) │
 *    └───────────────┘       └───────────────┘       └───────────────┘
 * ```
 *
 * ## Timing Formula
 *
 * ```
 * visualTime = max(0, audioContext.currentTime - transportStartTime)
 *
 * Where:
 * - transportStartTime = audioContext.currentTime + startupLookahead (set by PlaybackEngine)
 * - When currentTime reaches transportStartTime, audio starts playing
 * - So visualTime = 0 exactly when audio begins (already correct!)
 * - NO additional lookahead subtraction needed
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * // In PlaybackEngine.start():
 * atomicClock.setTransportStartTime(this.transportStartTime);
 * atomicClock.start();
 *
 * // In widgets:
 * const { visualSeconds, eighthNoteIndex } = useAtomicBeat();
 * ```
 */

import { TRANSPORT_TIMING_CONFIG } from '../../config/transportTiming.js';
import { musicalTruth } from '../../modules/tempo/MusicalTruthAuthority.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('AtomicPlaybackClock');

// Debug flag - set to true in browser console: window.__DEBUG_ATOMIC_CLOCK = true
const isDebugEnabled = () =>
  typeof window !== 'undefined' && (window as any).__DEBUG_ATOMIC_CLOCK;

/**
 * Visual beat state emitted to subscribers
 * Designed to match VisualBeatState for migration compatibility
 */
export interface AtomicBeatState {
  /** 0-based 8th note index within the measure (0-7 for 4/4) */
  eighthNoteIndex: number;
  /** 0-based beat index within the measure (0-3 for 4/4) */
  beatIndex: number;
  /** 0-based measure index from start of exercise */
  measureIndex: number;
  /** Total 8th note count since exercise start (can be negative during countdown) */
  totalEighthNotes: number;
  /** True if currently in countdown (negative bars) */
  isCountdown: boolean;
  /** Visual time in seconds - LOOKAHEAD COMPENSATED */
  visualSeconds: number;
  /** Raw elapsed audio time (without lookahead compensation) */
  rawElapsedSeconds: number;
  /** Duration of one 8th note in milliseconds (for CSS animation timing) */
  eighthNoteDurationMs: number;
  /** Continuous beat position (e.g., 2.7 means 70% through beat 2) */
  continuousBeat: number;
  /** Current tempo from musicalTruth (dynamic) */
  currentBpm: number;
  /** performance.now() timestamp of this update */
  timestamp: number;
  /**
   * Scheduled beat time in audioContext.currentTime units
   * Used for jitter-free interval measurement - this is WHEN the beat was scheduled,
   * not when it was detected. Measures intervals using this for accurate timing.
   */
  scheduledBeatTime: number;
}

/**
 * Subscriber callback type
 */
type AtomicBeatSubscriber = (state: AtomicBeatState) => void;

/**
 * AtomicPlaybackClock - Singleton service for FAA-grade visual timing
 */
export class AtomicPlaybackClock {
  private static instance: AtomicPlaybackClock | null = null;

  // Core timing state
  private audioContext: AudioContext | null = null;
  private transportStartTime: number = 0;
  private isRunning: boolean = false;
  private rafId: number | null = null;

  // Musical configuration
  private beatsPerMeasure: number = 4;
  private countdownBeats: number = 4; // Default 1 bar countdown

  // Subscribers
  private subscribers = new Set<AtomicBeatSubscriber>();
  private currentState: AtomicBeatState | null = null;

  // Performance tracking
  private lastEighthNoteIndex: number = -1;
  private lastMeasureIndex: number = -1;
  private frameCount: number = 0;

  // Pre-calculated beat schedule for jitter-free detection
  // Key insight: Instead of detecting when Math.floor() changes (frame-dependent),
  // we pre-calculate exact beat times and check if we've crossed them.
  private nextBeatTime: number = 0; // audioContext.currentTime when next beat should occur
  private currentBeatStartTime: number = 0; // When current beat started (for interval measurement)

  private constructor() {
    logger.info('AtomicPlaybackClock singleton created');
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): AtomicPlaybackClock {
    if (!AtomicPlaybackClock.instance) {
      AtomicPlaybackClock.instance = new AtomicPlaybackClock();
    }
    return AtomicPlaybackClock.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static resetInstance(): void {
    if (AtomicPlaybackClock.instance) {
      AtomicPlaybackClock.instance.stop();
      AtomicPlaybackClock.instance = null;
    }
  }

  /**
   * Set the AudioContext reference
   * MUST be called before start()
   */
  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
    logger.debug('AudioContext set', { state: context.state });
  }

  /**
   * CRITICAL: Set the transport start time from PlaybackEngine
   *
   * This MUST be the SAME value that PlaybackEngine uses to schedule audio.
   * Without this synchronization, visual and audio will be out of sync.
   *
   * @param time - audioContext.currentTime + startupLookahead from PlaybackEngine.start()
   */
  setTransportStartTime(time: number): void {
    this.transportStartTime = time;

    if (isDebugEnabled()) {
      console.log('[AtomicPlaybackClock] transportStartTime SET', {
        transportStartTime: time.toFixed(6),
        currentAudioTime: this.audioContext?.currentTime?.toFixed(6) ?? 'N/A',
        startupLookahead: TRANSPORT_TIMING_CONFIG.startupLookahead,
      });
    }

    logger.info('Transport start time synchronized', {
      transportStartTime: time.toFixed(6),
      startupLookahead: TRANSPORT_TIMING_CONFIG.startupLookahead,
    });
  }

  /**
   * Configure musical parameters
   * @param beatsPerMeasure - Time signature numerator (e.g., 4 for 4/4)
   * @param countdownBeats - Number of countdown beats before exercise
   */
  configure(beatsPerMeasure: number = 4, countdownBeats: number = 4): void {
    this.beatsPerMeasure = beatsPerMeasure;
    this.countdownBeats = countdownBeats;

    logger.debug('AtomicPlaybackClock configured', {
      beatsPerMeasure,
      countdownBeats,
    });
  }

  /**
   * Start the RAF timing loop
   * Called by PlaybackEngine.start() AFTER setTransportStartTime()
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('AtomicPlaybackClock already running');
      return;
    }

    if (!this.audioContext) {
      logger.error('Cannot start - no AudioContext');
      return;
    }

    if (this.transportStartTime === 0) {
      logger.warn('Starting without transportStartTime set - visual sync may be off');
    }

    this.isRunning = true;
    this.frameCount = 0;
    this.lastEighthNoteIndex = -1;
    this.lastMeasureIndex = -1;

    // Initialize beat schedule
    // First beat occurs at transportStartTime (audio scheduled to play there)
    this.nextBeatTime = this.transportStartTime;
    this.currentBeatStartTime = this.transportStartTime;

    logger.info('AtomicPlaybackClock starting', {
      transportStartTime: this.transportStartTime.toFixed(6),
      currentAudioTime: this.audioContext.currentTime.toFixed(6),
      startupLookahead: TRANSPORT_TIMING_CONFIG.startupLookahead,
    });

    // Start the RAF loop
    this.tick();
  }

  /**
   * Stop the RAF timing loop
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
    this.transportStartTime = 0;
    this.nextBeatTime = 0;
    this.currentBeatStartTime = 0;

    logger.info('AtomicPlaybackClock stopped', {
      totalFrames: this.frameCount,
    });
  }

  /**
   * Subscribe to beat updates
   * @returns Unsubscribe function
   */
  subscribe(callback: AtomicBeatSubscriber): () => void {
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
   * Get current state (for immediate access without subscription)
   */
  getCurrentState(): AtomicBeatState | null {
    return this.currentState;
  }

  /**
   * Check if clock is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the current visual time (already synced to audio)
   * Can be called directly without subscription for ref-based updates
   *
   * NOTE: transportStartTime is ALREADY set to `audioContext.currentTime + startupLookahead`
   * by PlaybackEngine.start(). This means when `currentTime` reaches `transportStartTime`,
   * that's exactly when audio begins playing. So:
   *   elapsedTime = currentTime - transportStartTime
   *   elapsedTime = 0 when audio starts (correct!)
   *
   * We do NOT subtract startupLookahead again - that would cause visual to lag ~300ms behind audio.
   */
  getVisualTime(): number {
    if (!this.audioContext || !this.isRunning) {
      return 0;
    }

    const currentAudioTime = this.audioContext.currentTime;
    const elapsedTime = currentAudioTime - this.transportStartTime;

    // No additional compensation needed - transportStartTime already includes lookahead
    const visualTime = Math.max(0, elapsedTime);

    return visualTime;
  }

  /**
   * Main RAF tick - THE CORE TIMING CALCULATION
   *
   * JITTER-FREE APPROACH: Instead of detecting when Math.floor() changes
   * (which depends on RAF frame timing), we:
   * 1. Pre-calculate exact beat transition times
   * 2. Check if audioContext.currentTime has crossed nextBeatTime
   * 3. This ensures beat detection is based on audio clock, not RAF frames
   *
   * This eliminates the ±40ms jitter caused by RAF frame quantization at beat boundaries.
   */
  private tick = (): void => {
    if (!this.isRunning || !this.audioContext) {
      return;
    }

    // Schedule next frame FIRST for consistent timing
    this.rafId = requestAnimationFrame(this.tick);
    this.frameCount++;

    const now = performance.now();
    const currentAudioTime = this.audioContext.currentTime;

    // STEP 1: Get DYNAMIC tempo from musicalTruth (always current)
    const currentBpm = musicalTruth.getBPM();

    // STEP 2: Calculate beat timing values
    const secondsPerBeat = 60 / currentBpm; // Quarter note duration
    const secondsPerEighth = secondsPerBeat / 2; // Eighth note duration
    const eighthNoteDurationMs = secondsPerEighth * 1000;

    // STEP 3: Check if we've crossed the next beat time
    // This is the KEY to jitter-free detection - we compare against pre-calculated times
    // instead of relying on Math.floor() which depends on when RAF happens to fire
    const beatChanged = currentAudioTime >= this.nextBeatTime;

    if (beatChanged) {
      // Advance to next beat
      // Store the exact scheduled beat time for interval measurement (not detection time!)
      this.currentBeatStartTime = this.nextBeatTime;
      this.nextBeatTime = this.nextBeatTime + secondsPerEighth;
    }

    // STEP 4: Calculate elapsed time (no additional lookahead compensation needed)
    // NOTE: transportStartTime is ALREADY set to `audioContext.currentTime + startupLookahead`
    // by PlaybackEngine.start(). When currentTime reaches transportStartTime, audio starts.
    // So elapsedSeconds = 0 when audio begins - this is already correct!
    const rawElapsedSeconds = currentAudioTime - this.transportStartTime;
    const visualSeconds = Math.max(0, rawElapsedSeconds);

    // STEP 5: Calculate countdown duration
    const countdownSeconds = this.countdownBeats * secondsPerBeat;

    // STEP 6: Adjust for countdown (visual time starts negative during countdown)
    const adjustedSeconds = visualSeconds - countdownSeconds;
    const isCountdown = adjustedSeconds < 0;

    // STEP 7: Calculate beat positions from adjusted time
    let eighthNoteIndex: number;
    let beatIndex: number;
    let measureIndex: number;
    let totalEighthNotes: number;
    let continuousBeat: number;

    const eighthNotesPerMeasure = this.beatsPerMeasure * 2;

    if (isCountdown) {
      // During countdown, show position 0 (first beat of first measure)
      eighthNoteIndex = 0;
      beatIndex = 0;
      measureIndex = -1; // Negative measure indicates countdown
      totalEighthNotes = Math.floor(adjustedSeconds / secondsPerEighth);
      continuousBeat = 0;
    } else {
      // Normal playback - calculate position from adjusted time
      totalEighthNotes = Math.floor(adjustedSeconds / secondsPerEighth);
      eighthNoteIndex = totalEighthNotes % eighthNotesPerMeasure;
      beatIndex = Math.floor(eighthNoteIndex / 2);
      measureIndex = Math.floor(totalEighthNotes / eighthNotesPerMeasure);
      continuousBeat = adjustedSeconds / secondsPerEighth;
    }

    // STEP 8: Track beat index changes (for widgets that only need beat-level updates)
    const indexChanged =
      eighthNoteIndex !== this.lastEighthNoteIndex ||
      measureIndex !== this.lastMeasureIndex;

    if (indexChanged) {
      this.lastEighthNoteIndex = eighthNoteIndex;
      this.lastMeasureIndex = measureIndex;
    }

    // STEP 9: Create state object - ALWAYS create fresh state for 60fps updates
    // This enables sub-beat precision for fretboard visualization where notes
    // may start at fractional beat positions (e.g., 0.75 beats = dotted eighth)
    const state: AtomicBeatState = {
      eighthNoteIndex,
      beatIndex,
      measureIndex,
      totalEighthNotes,
      isCountdown,
      visualSeconds,
      rawElapsedSeconds,
      eighthNoteDurationMs,
      continuousBeat,
      currentBpm,
      timestamp: now,
      scheduledBeatTime: this.currentBeatStartTime,
    };

    // Debug logging if enabled (only on beat changes to avoid log spam)
    if (isDebugEnabled() && !isCountdown && indexChanged) {
      // Log the SCHEDULED beat time, not detection time, for accurate interval measurement
      console.log('[AtomicPlaybackClock] BEAT', {
        eighth: eighthNoteIndex,
        measure: measureIndex,
        scheduledAt: this.currentBeatStartTime.toFixed(6),
        detectedAt: currentAudioTime.toFixed(6),
        detectionDelay: ((currentAudioTime - this.currentBeatStartTime) * 1000).toFixed(1) + 'ms',
        visualSec: visualSeconds.toFixed(3),
        bpm: currentBpm,
        durationMs: eighthNoteDurationMs.toFixed(1),
      });
    }

    // STEP 10: Update current state
    this.currentState = state;

    // STEP 11: Notify subscribers on EVERY frame (60fps)
    // Previously only notified on beat index changes, causing ~200ms delays
    // for notes at fractional beat positions (dotted eighths, syncopation, etc.)
    this.notifySubscribers(state);
  };

  /**
   * Notify all subscribers of state update
   */
  private notifySubscribers(state: AtomicBeatState): void {
    this.subscribers.forEach((subscriber) => {
      try {
        subscriber(state);
      } catch (error) {
        logger.error('Subscriber error', error);
      }
    });
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stop();
    this.subscribers.clear();
    this.audioContext = null;
    AtomicPlaybackClock.instance = null;
    logger.info('AtomicPlaybackClock disposed');
  }
}

// Export singleton accessor
export const getAtomicPlaybackClock = (): AtomicPlaybackClock =>
  AtomicPlaybackClock.getInstance();
