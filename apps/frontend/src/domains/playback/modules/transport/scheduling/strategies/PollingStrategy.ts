/**
 * Polling Strategy for Position Updates
 *
 * Uses setInterval to generate position updates at ~50Hz.
 * This is the fallback strategy when AudioWorklet is not available.
 *
 * @module transport/scheduling/strategies/PollingStrategy
 */

import { getLogger } from '@/utils/logger.js';

// Helper to get Tone from window (must be initialized before PollingStrategy is used)
function getTone(): NonNullable<typeof window.Tone> {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error(
    'PollingStrategy: Tone.js not loaded. Ensure AudioEngine is initialized first.',
  );
}
import type { Clock } from '../../core/Clock.js';
import type { Timeline } from '../../core/Timeline.js';
import type {
  PositionUpdate,
  PositionUpdateCallback,
  PositionUpdateStrategy,
  SchedulerConfig,
} from '../types/scheduler.types.js';

const logger = getLogger('PollingStrategy');

/**
 * Polling-based position update strategy
 *
 * Generates position updates using a setInterval loop at the configured rate.
 * Calculates elapsed time from Clock and updates Timeline position.
 */
export class PollingStrategy implements PositionUpdateStrategy {
  public readonly name = 'polling' as const;

  private _isActive = false;
  private intervalId: number | null = null;
  private callback: PositionUpdateCallback | undefined;
  private transportStartTime = 0;
  private isPausedState = false;

  // TEMPO COMPENSATION: Track accumulated beats across tempo changes
  // This prevents position jumps when tempo changes during playback
  private accumulatedBeats = 0;
  private lastTempoChangeTime = 0;
  private currentBPM = 120;

  constructor(
    private readonly clock: Clock,
    private readonly timeline: Timeline,
    private readonly config: SchedulerConfig,
  ) {}

  get isActive(): boolean {
    return this._isActive;
  }

  setCallback(callback: PositionUpdateCallback | undefined): void {
    this.callback = callback;
  }

  setTransportStartTime(startTime: number): void {
    this.transportStartTime = startTime;
    // Also reset tempo tracking when transport start time changes
    this.lastTempoChangeTime = startTime;
    logger.debug('Transport start time set', {
      startTime: startTime.toFixed(6),
    });
  }

  /**
   * Handle tempo change during playback
   *
   * When tempo changes, we need to snapshot the accumulated beats at the old tempo
   * and reset the timing reference. This prevents position jumps when wall-clock
   * time is converted to beats using the new tempo.
   */
  onTempoChange(newBPM: number): void {
    // [TEMPO-DEBUG] logs commented out after fix verification
    // console.log('[TEMPO-DEBUG] Step 6: PollingStrategy.onTempoChange()', {...});

    if (!this._isActive) {
      // Not playing - just update the tempo for next playback
      // console.log('[TEMPO-DEBUG] Step 6a: Not active - updating currentBPM only', {...});
      this.currentBPM = newBPM;
      return;
    }

    // Snapshot beats accumulated at the old tempo
    const now = this.clock.getAudioTime();
    const elapsedSinceLastChange = now - this.lastTempoChangeTime;
    const beatsSinceLastChange =
      elapsedSinceLastChange * (this.currentBPM / 60);
    this.accumulatedBeats += beatsSinceLastChange;

    // Reset timing reference for the new tempo
    this.lastTempoChangeTime = now;
    this.currentBPM = newBPM;

    // console.log('[TEMPO-DEBUG] Step 6b: PollingStrategy - BPM updated (active playback)', {...});

    logger.info('Tempo change compensation applied', {
      newBPM,
      accumulatedBeats: this.accumulatedBeats.toFixed(2),
      elapsedSinceLastChange: elapsedSinceLastChange.toFixed(3),
    });
  }

  start(): void {
    if (this._isActive) {
      logger.warn('PollingStrategy already active, ignoring start()');
      return;
    }

    if (this.intervalId !== null) {
      logger.warn('Clearing stale interval before starting');
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this._isActive = true;
    this.isPausedState = false;

    // TEMPO COMPENSATION: Initialize tracking for this playback session
    this.accumulatedBeats = 0;
    this.lastTempoChangeTime = this.transportStartTime;
    const Tone = getTone();
    this.currentBPM = Tone.Transport.bpm.value;

    // [TEMPO-DEBUG] Step 7 log commented out after fix verification
    // console.log('[TEMPO-DEBUG] Step 7: PollingStrategy.start() - Initializing', {...});

    const update = () => {
      if (!this._isActive || this.isPausedState) {
        return;
      }

      // Calculate elapsed time since transport started
      const absoluteTime = this.clock.getAudioTime();
      const wallClockElapsed = absoluteTime - this.transportStartTime;

      // Warn on negative elapsed time (race condition indicator)
      if (wallClockElapsed < 0) {
        logger.warn('Negative elapsed time detected!', {
          absoluteTime: absoluteTime.toFixed(6),
          transportStartTime: this.transportStartTime.toFixed(6),
          wallClockElapsed: wallClockElapsed.toFixed(6),
        });
        // Still emit with 0 to prevent display corruption
        this.emitUpdate(0);
        return;
      }

      // TEMPO COMPENSATION: Calculate total beats across tempo changes
      // This prevents position jumps when tempo changes during playback
      const elapsedSinceLastChange = absoluteTime - this.lastTempoChangeTime;
      const beatsSinceLastChange =
        elapsedSinceLastChange * (this.currentBPM / 60);
      const totalBeats = this.accumulatedBeats + beatsSinceLastChange;

      // Convert beats to "equivalent seconds" at current tempo for downstream compatibility
      // Downstream: secondsToPosition(seconds) computes seconds * (BPM/60) = totalBeats ✓
      const equivalentSeconds = totalBeats / (this.currentBPM / 60);

      // [TEMPO-DEBUG] Step 8 log commented out after fix verification
      // Sampled update loop logging disabled - uncomment if debugging tempo issues

      // Update timeline with tempo-compensated elapsed time
      this.timeline.updatePositionFromSeconds(equivalentSeconds);

      // Emit position update with tempo-compensated time
      this.emitUpdate(equivalentSeconds);
    };

    // Initial update
    update();

    // Set up periodic updates
    this.intervalId = window.setInterval(update, this.config.pollingIntervalMs);

    logger.info('PollingStrategy started', {
      intervalMs: this.config.pollingIntervalMs,
      frequencyHz: Math.round(1000 / this.config.pollingIntervalMs),
    });
  }

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this._isActive = false;
    this.isPausedState = false;

    logger.info('PollingStrategy stopped');
  }

  pause(): void {
    if (!this._isActive) {
      return;
    }

    this.isPausedState = true;
    logger.debug('PollingStrategy paused');
  }

  resume(): void {
    if (!this._isActive) {
      return;
    }

    this.isPausedState = false;
    logger.debug('PollingStrategy resumed');
  }

  dispose(): void {
    this.stop();
    this.callback = undefined;
    logger.debug('PollingStrategy disposed');
  }

  private emitUpdate(seconds: number): void {
    if (!this.callback) {
      return;
    }

    const update: PositionUpdate = {
      seconds,
      source: 'polling',
      timestamp: performance.now(),
    };

    this.callback(update);
  }
}
