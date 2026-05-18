/**
 * BeatEmitter - Audio-Synchronized Visual Beat Events
 *
 * This service uses Tone.Draw to emit beat events at the EXACT moment audio plays.
 * It solves the visual-audio sync problem where visual updates calculated from
 * performance.now() drift ±30-60ms from actual audio playback.
 *
 * ## Why Tone.Draw?
 *
 * From Tone.js documentation:
 * > "Transport callbacks can occur many more times a second than animation frame
 * >  callbacks and can be invoked WELL IN ADVANCE of when the event is heard,
 * >  so visuals triggered inside of one of these callbacks might not align with
 * >  the audio event they are triggered with."
 *
 * Tone.Draw.schedule() invokes the callback on the nearest animation frame to
 * the given audio time, ensuring visual updates happen when audio actually plays.
 *
 * ## Architecture
 *
 * 1. On playback start, this service schedules repeating callbacks at 8th note intervals
 * 2. Inside each callback, Tone.Draw.schedule() queues a visual update
 * 3. The visual update emits 'beat:eighth-note' via EventBus
 * 4. useBeatIndicator subscribes to these events for jitter-free visual sync
 *
 * ## Usage
 *
 * The BeatEmitter is a singleton managed by CoreServices. Widgets don't interact
 * with it directly - they use useBeatIndicator which subscribes to the events.
 */

import { getLogger } from '@/utils/logger.js';
import type { EventBus } from './EventBus.js';

const logger = getLogger('BeatEmitter');

/**
 * Beat event data emitted on each 8th note
 */
export interface BeatEvent {
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
  /** Audio time when this beat occurs (Tone.Transport time) */
  audioTime: number;
}

/**
 * Helper to get Tone.js from window
 * Tone.js must be loaded before BeatEmitter is used
 */
function getTone(): any {
  if (typeof window !== 'undefined') {
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error('BeatEmitter: Tone.js not loaded');
}

/**
 * Configuration for BeatEmitter
 */
export interface BeatEmitterConfig {
  /** Beats per measure (default: 4 for 4/4 time) */
  beatsPerMeasure?: number;
  /** Number of countdown beats before exercise starts */
  countdownBeats?: number;
}

/**
 * BeatEmitter - Emits audio-synchronized beat events using Tone.Draw
 */
export class BeatEmitter {
  private static instance: BeatEmitter | null = null;

  private eventBus: EventBus | null = null;
  private isRunning = false;
  private beatsPerMeasure = 4;
  private countdownBeats = 0;
  private scheduledEventId: number | null = null;

  // Instance tracking for debugging
  private instanceId: string;

  private constructor() {
    this.instanceId = Math.random().toString(36).substring(2, 11);
    logger.info('BeatEmitter created', { instanceId: this.instanceId });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BeatEmitter {
    if (!BeatEmitter.instance) {
      BeatEmitter.instance = new BeatEmitter();
    }
    return BeatEmitter.instance;
  }

  /**
   * Initialize with EventBus
   */
  initialize(eventBus: EventBus): void {
    this.eventBus = eventBus;
    logger.info('BeatEmitter initialized', { instanceId: this.instanceId });
  }

  /**
   * Configure beat parameters
   */
  configure(config: BeatEmitterConfig): void {
    if (config.beatsPerMeasure !== undefined) {
      this.beatsPerMeasure = config.beatsPerMeasure;
    }
    if (config.countdownBeats !== undefined) {
      this.countdownBeats = config.countdownBeats;
    }

    logger.info('BeatEmitter configured', {
      beatsPerMeasure: this.beatsPerMeasure,
      countdownBeats: this.countdownBeats,
    });
  }

  /**
   * Start emitting beat events
   *
   * This schedules a repeating callback on Tone.Transport at 8th note intervals.
   * Each callback uses Tone.Draw to schedule the visual update for the exact
   * moment the audio plays.
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('BeatEmitter already running');
      return;
    }

    if (!this.eventBus) {
      logger.error('BeatEmitter not initialized - missing EventBus');
      return;
    }

    let Tone: any;
    try {
      Tone = getTone();
    } catch (error) {
      logger.error('Cannot start BeatEmitter - Tone.js not loaded');
      return;
    }

    // Verify Tone.Draw exists
    if (!Tone.Draw) {
      logger.error('Tone.Draw not available - using fallback');
      this.startFallback();
      return;
    }

    this.isRunning = true;

    // 8th notes per measure
    const eighthNotesPerMeasure = this.beatsPerMeasure * 2;

    // For timing diagnostics
    let lastDrawTime = 0;
    let lastEighthNote = -1;

    // Calculate countdown duration in Transport time (seconds)
    // This is used to offset beat calculations during countdown
    const bpm = Tone.Transport.bpm.value;
    const eighthNoteDuration = 60 / bpm / 2; // Duration of one 8th note in seconds
    const countdownDuration = this.countdownBeats * 2 * eighthNoteDuration; // Total countdown in seconds

    logger.info('BeatEmitter starting', {
      bpm,
      eighthNoteDuration: (eighthNoteDuration * 1000).toFixed(1) + 'ms',
      countdownBeats: this.countdownBeats,
      countdownDuration: (countdownDuration * 1000).toFixed(1) + 'ms',
    });

    // Schedule repeating callback every 8th note starting at Transport time 0
    // The beat position is calculated from Transport.seconds, not from an incrementing counter
    // This eliminates jitter because even if Tone.Draw fires late, we calculate correct beat
    this.scheduledEventId = Tone.Transport.scheduleRepeat(
      (audioTime: number) => {
        // Use Tone.Draw to schedule visual update at exact audio time
        Tone.Draw.schedule(() => {
          // TIMING DIAGNOSTIC
          const currentAudioContextTime = Tone.getContext().currentTime;
          const drawFiredAt = performance.now();
          const timeSinceLastDraw =
            lastDrawTime > 0 ? drawFiredAt - lastDrawTime : 0;

          // Calculate beat position from Transport.seconds (authoritative source)
          // This is the key fix: instead of incrementing a counter, we calculate
          // the beat from the current transport position, which is always accurate
          const transportSeconds = Tone.Transport.seconds;

          // Adjust for countdown: transportSeconds starts at 0, but we have countdown beats
          // During countdown (negative adjusted time), we emit beat 0
          const adjustedSeconds = transportSeconds - countdownDuration;

          // Calculate total eighth notes from adjusted time
          // Floor to get discrete beat positions
          const totalEighthNotes = Math.floor(
            adjustedSeconds / eighthNoteDuration,
          );

          const isCountdown = adjustedSeconds < 0;

          // During countdown: emit eighthNoteIndex=0 (grid stays at position 0)
          // During normal playback: calculate from transport time
          const eighthNoteIndex = isCountdown
            ? 0
            : totalEighthNotes % eighthNotesPerMeasure;
          const beatIndex = isCountdown ? 0 : Math.floor(eighthNoteIndex / 2);
          const measureIndex = isCountdown
            ? -1
            : Math.floor(totalEighthNotes / eighthNotesPerMeasure);

          // Log timing for debugging (only when beat changes to reduce spam)
          const DEBUG_BEAT_TIMING = false;
          if (
            DEBUG_BEAT_TIMING &&
            eighthNoteIndex !== lastEighthNote &&
            !isCountdown
          ) {
            logger.info('TIMING_SYNC', {
              eighth: eighthNoteIndex,
              measure: measureIndex,
              intervalMs: timeSinceLastDraw.toFixed(1),
              transportSec: transportSeconds.toFixed(3),
              adjustedSec: adjustedSeconds.toFixed(3),
            });
          }
          lastDrawTime = drawFiredAt;
          lastEighthNote = eighthNoteIndex;

          const beatEvent: BeatEvent = {
            eighthNoteIndex,
            beatIndex,
            measureIndex,
            totalEighthNotes,
            isCountdown,
            audioTime,
          };

          // Emit via EventBus
          this.eventBus?.emit('beat:eighth-note', beatEvent);

          // Also emit beat event on downbeats
          if (eighthNoteIndex % 2 === 0) {
            this.eventBus?.emit('beat:quarter-note', beatEvent);
          }

          // Emit measure event on first beat of each measure
          if (eighthNoteIndex === 0 && !isCountdown) {
            this.eventBus?.emit('beat:measure', beatEvent);
          }
        }, audioTime);
      },
      '8n', // Every 8th note
      0, // Start at Transport time 0 (beat position is calculated from Transport.seconds)
    );

    logger.info('BeatEmitter started with Tone.Draw', {
      scheduledEventId: this.scheduledEventId,
      countdownBeats: this.countdownBeats,
      beatsPerMeasure: this.beatsPerMeasure,
      bpm,
    });
  }

  /**
   * Fallback for environments without Tone.Draw
   * Uses direct scheduling without Draw synchronization
   */
  private startFallback(): void {
    if (!this.eventBus) return;

    let Tone: any;
    try {
      Tone = getTone();
    } catch {
      return;
    }

    this.isRunning = true;

    let totalEighthNotes = -this.countdownBeats * 2;
    const eighthNotesPerMeasure = this.beatsPerMeasure * 2;

    this.scheduledEventId = Tone.Transport.scheduleRepeat(
      (audioTime: number) => {
        const isCountdown = totalEighthNotes < 0;

        // During countdown: emit eighthNoteIndex=0 (grid stays at position 0)
        // During normal playback: calculate normally
        const eighthNoteIndex = isCountdown
          ? 0
          : totalEighthNotes % eighthNotesPerMeasure;
        const beatIndex = isCountdown ? 0 : Math.floor(eighthNoteIndex / 2);
        const measureIndex = isCountdown
          ? -1
          : Math.floor(totalEighthNotes / eighthNotesPerMeasure);

        const beatEvent: BeatEvent = {
          eighthNoteIndex,
          beatIndex,
          measureIndex,
          totalEighthNotes,
          isCountdown,
          audioTime,
        };

        // Emit directly without Draw (may have slight timing variance)
        this.eventBus?.emit('beat:eighth-note', beatEvent);

        if (eighthNoteIndex % 2 === 0) {
          this.eventBus?.emit('beat:quarter-note', beatEvent);
        }

        if (eighthNoteIndex === 0 && !isCountdown) {
          this.eventBus?.emit('beat:measure', beatEvent);
        }

        totalEighthNotes++;
      },
      '8n',
      0,
    );

    logger.warn('BeatEmitter started in fallback mode (no Tone.Draw)', {
      scheduledEventId: this.scheduledEventId,
    });
  }

  /**
   * Stop emitting beat events
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.scheduledEventId !== null) {
      try {
        const Tone = getTone();
        Tone.Transport.clear(this.scheduledEventId);
      } catch {
        // Tone not available, ignore
      }
      this.scheduledEventId = null;
    }

    this.isRunning = false;
    logger.info('BeatEmitter stopped');
  }

  /**
   * Check if emitter is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Dispose the emitter
   */
  dispose(): void {
    this.stop();
    this.eventBus = null;
    BeatEmitter.instance = null;
    logger.info('BeatEmitter disposed');
  }
}

// Export singleton accessor
export const getBeatEmitter = (): BeatEmitter => BeatEmitter.getInstance();
