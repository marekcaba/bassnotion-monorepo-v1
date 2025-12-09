/**
 * Position Update Scheduler
 *
 * Centralized orchestrator for position updates that enforces mutual exclusion
 * between polling and event-driven strategies. Only ONE strategy can be active
 * at any time, eliminating the dual-pathway emission problem.
 *
 * @module transport/scheduling/PositionUpdateScheduler
 */

import { getLogger } from '@/utils/logger.js';
import type { Clock } from '../core/Clock.js';
import type { Timeline } from '../core/Timeline.js';
import { EventDrivenStrategy } from './strategies/EventDrivenStrategy.js';
import { PollingStrategy } from './strategies/PollingStrategy.js';
import type {
  IPositionUpdateScheduler,
  PositionUpdateCallback,
  PositionUpdateStrategy,
  SchedulerConfig,
  SchedulerStartOptions,
} from './types/scheduler.types.js';
import { DEFAULT_SCHEDULER_CONFIG } from './types/scheduler.types.js';

const logger = getLogger('PositionUpdateScheduler');

/**
 * Position Update Scheduler
 *
 * The single point of control for all position updates. Ensures:
 * - Only ONE strategy is active at any time (mutual exclusion)
 * - Clean transitions between strategies
 * - Consistent callback registration
 * - Proper lifecycle management
 */
export class PositionUpdateScheduler implements IPositionUpdateScheduler {
  private pollingStrategy: PollingStrategy;
  private eventDrivenStrategy: EventDrivenStrategy;
  private activeStrategy: PositionUpdateStrategy | null = null;
  private updateCallback: PositionUpdateCallback | undefined;
  private config: SchedulerConfig;
  private _isPaused = false;
  private transportStartTime = 0;

  constructor(
    private readonly clock: Clock,
    private readonly timeline: Timeline,
    config?: Partial<SchedulerConfig>,
  ) {
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };

    // Create strategies
    this.pollingStrategy = new PollingStrategy(clock, timeline, this.config);
    this.eventDrivenStrategy = new EventDrivenStrategy(clock, this.config);

    logger.info('PositionUpdateScheduler initialized', {
      pollingIntervalMs: this.config.pollingIntervalMs,
      eventDrivenThrottleMs: this.config.eventDrivenThrottleMs,
      preferEventDriven: this.config.preferEventDriven,
    });
  }

  /**
   * Start emitting position updates
   *
   * MUTUAL EXCLUSION: Stops any active strategy before starting the new one.
   * This is the critical fix for the dual-pathway emission problem.
   */
  start(options?: SchedulerStartOptions): void {
    // MUTUAL EXCLUSION: Stop any existing strategy first
    if (this.activeStrategy) {
      logger.info('Stopping active strategy before starting new one', {
        previousStrategy: this.activeStrategy.name,
      });
      this.activeStrategy.stop();
      this.activeStrategy = null;
    }

    // Select strategy
    const strategyType = options?.strategy || 'auto';
    const selectedStrategy = this.selectStrategy(strategyType);

    // Configure and start strategy
    selectedStrategy.setCallback(this.updateCallback);
    selectedStrategy.setTransportStartTime(this.transportStartTime);
    selectedStrategy.start();

    this.activeStrategy = selectedStrategy;
    this._isPaused = false;

    logger.info('PositionUpdateScheduler started', {
      requestedStrategy: strategyType,
      actualStrategy: selectedStrategy.name,
      audioWorkletActive: this.clock.isUsingAudioWorklet(),
    });
  }

  /**
   * Stop emitting position updates
   */
  stop(): void {
    if (this.activeStrategy) {
      this.activeStrategy.stop();
      logger.info('PositionUpdateScheduler stopped', {
        strategy: this.activeStrategy.name,
      });
      this.activeStrategy = null;
    }

    this._isPaused = false;
  }

  /**
   * Pause position updates
   */
  pause(): void {
    if (this.activeStrategy) {
      this.activeStrategy.pause();
      this._isPaused = true;
      logger.debug('PositionUpdateScheduler paused');
    }
  }

  /**
   * Resume position updates after pause
   */
  resume(): void {
    if (this.activeStrategy && this._isPaused) {
      this.activeStrategy.resume();
      this._isPaused = false;
      logger.debug('PositionUpdateScheduler resumed');
    }
  }

  /**
   * Set the transport start time for elapsed time calculations
   */
  setTransportStartTime(startTime: number): void {
    this.transportStartTime = startTime;

    // Update active strategy if running
    if (this.activeStrategy) {
      this.activeStrategy.setTransportStartTime(startTime);
    }

    logger.debug('Transport start time updated', {
      startTime: startTime.toFixed(6),
    });
  }

  /**
   * Handle tempo change during playback
   *
   * Forwards the tempo change to the active strategy so it can compensate
   * for the tempo change and prevent position jumps.
   */
  onTempoChange(bpm: number): void {
    // [TEMPO-DEBUG] logs commented out after fix verification
    // console.log('[TEMPO-DEBUG] Step 5: PositionUpdateScheduler.onTempoChange()', {...});

    if (this.activeStrategy?.onTempoChange) {
      this.activeStrategy.onTempoChange(bpm);
      // console.log('[TEMPO-DEBUG] Step 5b: Tempo change forwarded to strategy', {...});
      logger.debug('Tempo change forwarded to strategy', {
        strategy: this.activeStrategy.name,
        bpm,
      });
    }
    // Note: No warning if no active strategy - it's normal when stopped
  }

  /**
   * Set the callback to invoke on position updates
   */
  setUpdateCallback(callback: PositionUpdateCallback | undefined): void {
    this.updateCallback = callback;

    // Update both strategies so callback is ready when they start
    this.pollingStrategy.setCallback(callback);
    this.eventDrivenStrategy.setCallback(callback);

    logger.debug('Update callback set', {
      hasCallback: callback !== undefined,
    });
  }

  /**
   * Get the name of the currently active strategy
   */
  getActiveStrategy(): string {
    return this.activeStrategy?.name || 'none';
  }

  /**
   * Check if the scheduler is currently running
   */
  isRunning(): boolean {
    return this.activeStrategy !== null && this.activeStrategy.isActive;
  }

  /**
   * Check if the scheduler is paused
   */
  isPaused(): boolean {
    return this._isPaused;
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    this.stop();
    this.pollingStrategy.dispose();
    this.eventDrivenStrategy.dispose();
    this.updateCallback = undefined;

    logger.info('PositionUpdateScheduler disposed');
  }

  /**
   * Select the appropriate strategy based on type and system capabilities
   */
  private selectStrategy(type: string): PositionUpdateStrategy {
    switch (type) {
      case 'polling':
        return this.pollingStrategy;

      case 'event-driven':
        // Only use event-driven if AudioWorklet is active
        if (this.clock.isUsingAudioWorklet()) {
          return this.eventDrivenStrategy;
        }
        logger.warn(
          'Event-driven requested but AudioWorklet not active, falling back to polling',
        );
        return this.pollingStrategy;

      case 'auto':
      default:
        // Auto-select: prefer event-driven if configured and AudioWorklet is active
        if (this.config.preferEventDriven && this.clock.isUsingAudioWorklet()) {
          logger.debug('Auto-selected event-driven strategy (AudioWorklet active)');
          return this.eventDrivenStrategy;
        }
        logger.debug('Auto-selected polling strategy');
        return this.pollingStrategy;
    }
  }
}

// Re-export types for convenience
export type {
  IPositionUpdateScheduler,
  PositionUpdate,
  PositionUpdateCallback,
  PositionUpdateStrategy,
  SchedulerConfig,
  SchedulerStartOptions,
} from './types/scheduler.types.js';
