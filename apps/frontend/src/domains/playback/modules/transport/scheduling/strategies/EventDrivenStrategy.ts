/**
 * Event-Driven Strategy for Position Updates
 *
 * Uses Clock.onTick subscription to generate position updates at ~120Hz.
 * This is the preferred strategy when AudioWorklet is available.
 *
 * @module transport/scheduling/strategies/EventDrivenStrategy
 */

import * as Tone from 'tone';
import { getLogger } from '@/utils/logger.js';
import type { Clock } from '../../core/Clock.js';
import type {
  PositionUpdate,
  PositionUpdateCallback,
  PositionUpdateStrategy,
  SchedulerConfig,
} from '../types/scheduler.types.js';

const logger = getLogger('EventDrivenStrategy');

/**
 * Event-driven position update strategy
 *
 * Subscribes to Clock.onTick callback and throttles updates to the configured rate.
 * This strategy provides better timing accuracy than polling because it uses
 * the AudioWorklet's sample-accurate timing.
 */
export class EventDrivenStrategy implements PositionUpdateStrategy {
  public readonly name = 'event-driven' as const;

  private _isActive = false;
  private callback: PositionUpdateCallback | undefined;
  private transportStartTime = 0;
  private isPausedState = false;
  private lastEmitTime = 0;
  private previousOnTick: ((time: number, frame?: number) => void) | undefined;

  // TEMPO COMPENSATION: Track accumulated beats across tempo changes
  // This prevents position jumps when tempo changes during playback
  private accumulatedBeats = 0;
  private lastTempoChangeTime = 0;
  private currentBPM = 120;

  constructor(
    private readonly clock: Clock,
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
    logger.debug('Transport start time set', { startTime: startTime.toFixed(6) });
  }

  /**
   * Handle tempo change during playback
   *
   * When tempo changes, we need to snapshot the accumulated beats at the old tempo
   * and reset the timing reference. This prevents position jumps when wall-clock
   * time is converted to beats using the new tempo.
   */
  onTempoChange(newBPM: number): void {
    if (!this._isActive) {
      // Not playing - just update the tempo for next playback
      this.currentBPM = newBPM;
      return;
    }

    // For event-driven, we need to get current time from Clock
    // The Clock.onTick time is already elapsed from start, so we use that reference
    const now = this.clock.getAudioTime();
    const elapsedSinceLastChange = now - this.lastTempoChangeTime;
    const beatsSinceLastChange = elapsedSinceLastChange * (this.currentBPM / 60);
    this.accumulatedBeats += beatsSinceLastChange;

    // Reset timing reference for the new tempo
    this.lastTempoChangeTime = now;
    this.currentBPM = newBPM;

    logger.info('Tempo change compensation applied', {
      newBPM,
      accumulatedBeats: this.accumulatedBeats.toFixed(2),
      elapsedSinceLastChange: elapsedSinceLastChange.toFixed(3),
    });
  }

  start(): void {
    if (this._isActive) {
      logger.warn('EventDrivenStrategy already active, ignoring start()');
      return;
    }

    this._isActive = true;
    this.isPausedState = false;
    this.lastEmitTime = 0;

    // TEMPO COMPENSATION: Initialize tracking for this playback session
    this.accumulatedBeats = 0;
    this.lastTempoChangeTime = this.transportStartTime;
    this.currentBPM = Tone.Transport.bpm.value;

    // Subscribe to Clock.onTick
    this.clock.setOnTick((time: number, frame?: number) => {
      this.handleTick(time, frame);
    });

    logger.info('EventDrivenStrategy started', {
      throttleMs: this.config.eventDrivenThrottleMs,
      targetHz: Math.round(1000 / this.config.eventDrivenThrottleMs),
    });
  }

  stop(): void {
    if (!this._isActive) {
      return;
    }

    // Clear Clock.onTick subscription
    this.clock.setOnTick(undefined as any);

    this._isActive = false;
    this.isPausedState = false;
    this.lastEmitTime = 0;

    logger.info('EventDrivenStrategy stopped');
  }

  pause(): void {
    if (!this._isActive) {
      return;
    }

    this.isPausedState = true;
    logger.debug('EventDrivenStrategy paused');
  }

  resume(): void {
    if (!this._isActive) {
      return;
    }

    this.isPausedState = false;
    logger.debug('EventDrivenStrategy resumed');
  }

  dispose(): void {
    this.stop();
    this.callback = undefined;
    logger.debug('EventDrivenStrategy disposed');
  }

  private handleTick(time: number, frame?: number): void {
    // Skip if not active or paused
    if (!this._isActive || this.isPausedState) {
      return;
    }

    // Throttle updates to configured rate
    const now = performance.now();
    if (now - this.lastEmitTime < this.config.eventDrivenThrottleMs) {
      return; // Drop this update (throttling)
    }

    this.lastEmitTime = now;

    // The time from Clock.onTick is already elapsed time from transport start
    // when using AudioWorklet (it tracks from start)
    const wallClockElapsed = time;

    // Warn on negative elapsed time
    if (wallClockElapsed < 0) {
      logger.warn('Negative elapsed time from Clock.onTick!', {
        time: time.toFixed(6),
        frame,
      });
      // Still emit with 0 to prevent display corruption
      this.emitUpdate(0, frame);
      return;
    }

    // TEMPO COMPENSATION: Calculate total beats across tempo changes
    // Note: For event-driven, time is already elapsed from transportStartTime,
    // but we need to track from lastTempoChangeTime for proper compensation
    const absoluteTime = this.transportStartTime + wallClockElapsed;
    const elapsedSinceLastChange = absoluteTime - this.lastTempoChangeTime;
    const beatsSinceLastChange = elapsedSinceLastChange * (this.currentBPM / 60);
    const totalBeats = this.accumulatedBeats + beatsSinceLastChange;

    // Convert beats to "equivalent seconds" at current tempo for downstream compatibility
    // Downstream: secondsToPosition(seconds) computes seconds * (BPM/60) = totalBeats ✓
    const equivalentSeconds = totalBeats / (this.currentBPM / 60);

    // Emit position update with tempo-compensated time
    this.emitUpdate(equivalentSeconds, frame);
  }

  private emitUpdate(seconds: number, frame?: number): void {
    if (!this.callback) {
      return;
    }

    const update: PositionUpdate = {
      seconds,
      frame,
      source: 'event-driven',
      timestamp: performance.now(),
    };

    this.callback(update);
  }
}
