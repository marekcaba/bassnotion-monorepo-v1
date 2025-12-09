/**
 * Position Update Scheduler Types
 *
 * Defines interfaces for the centralized position update scheduling system
 * that ensures mutual exclusion between polling and event-driven strategies.
 *
 * @module transport/scheduling/types
 */

/**
 * Position update event emitted by strategies
 */
export interface PositionUpdate {
  /** Elapsed seconds since transport start */
  seconds: number;
  /** Optional: sample frame number (for AudioWorklet mode) */
  frame?: number;
  /** Source strategy that generated this update */
  source: 'polling' | 'event-driven';
  /** Performance.now() timestamp when update was generated */
  timestamp: number;
}

/**
 * Callback type for position updates
 */
export type PositionUpdateCallback = (update: PositionUpdate) => void;

/**
 * Strategy interface for position update sources
 *
 * Each strategy encapsulates a different method of generating position updates:
 * - PollingStrategy: Uses setInterval at ~50Hz
 * - EventDrivenStrategy: Uses Clock.onTick callback at ~120Hz
 */
export interface PositionUpdateStrategy {
  /** Strategy identifier */
  readonly name: 'polling' | 'event-driven';

  /** Whether the strategy is currently active */
  readonly isActive: boolean;

  /**
   * Set the callback to invoke on position updates
   * @param callback Function to call with position updates
   */
  setCallback(callback: PositionUpdateCallback | undefined): void;

  /**
   * Set the transport start time for elapsed time calculations
   * @param startTime The transport start time in seconds
   */
  setTransportStartTime(startTime: number): void;

  /**
   * Start emitting position updates
   */
  start(): void;

  /**
   * Stop emitting position updates
   */
  stop(): void;

  /**
   * Pause position updates (maintains state for resume)
   */
  pause(): void;

  /**
   * Resume position updates after pause
   */
  resume(): void;

  /**
   * Clean up resources
   */
  dispose(): void;

  /**
   * Handle tempo change during playback
   *
   * Called when tempo changes while the strategy is active. The strategy should:
   * 1. Snapshot accumulated beats at the old tempo
   * 2. Reset timing reference for new tempo calculations
   *
   * This prevents position jumps when converting wall-clock time to beats.
   *
   * @param bpm The new tempo in beats per minute
   */
  onTempoChange?(bpm: number): void;
}

/**
 * Strategy selection options
 */
export type StrategyType = 'polling' | 'event-driven' | 'auto';

/**
 * Options for starting the scheduler
 */
export interface SchedulerStartOptions {
  /** Force a specific strategy instead of auto-selection */
  strategy?: StrategyType;
}

/**
 * Main scheduler interface
 *
 * The PositionUpdateScheduler is the single point of control for all position updates.
 * It enforces mutual exclusion - only ONE strategy can be active at any time.
 */
export interface IPositionUpdateScheduler {
  /**
   * Start emitting position updates
   * @param options Optional configuration for strategy selection
   */
  start(options?: SchedulerStartOptions): void;

  /**
   * Stop emitting position updates
   */
  stop(): void;

  /**
   * Pause position updates
   */
  pause(): void;

  /**
   * Resume position updates after pause
   */
  resume(): void;

  /**
   * Set the transport start time for elapsed time calculations
   * @param startTime The transport start time in seconds
   */
  setTransportStartTime(startTime: number): void;

  /**
   * Set the callback to invoke on position updates
   * @param callback Function to call with position updates
   */
  setUpdateCallback(callback: PositionUpdateCallback | undefined): void;

  /**
   * Get the name of the currently active strategy
   * @returns Strategy name or 'none' if not running
   */
  getActiveStrategy(): string;

  /**
   * Check if the scheduler is currently running
   */
  isRunning(): boolean;

  /**
   * Check if the scheduler is paused
   */
  isPaused(): boolean;

  /**
   * Clean up all resources
   */
  dispose(): void;
}

/**
 * Configuration for the scheduler
 */
export interface SchedulerConfig {
  /** Polling interval in milliseconds (default: 20ms = 50Hz) */
  pollingIntervalMs: number;

  /** Event-driven throttle interval in milliseconds (default: 8.33ms = 120Hz) */
  eventDrivenThrottleMs: number;

  /** Whether to prefer event-driven strategy when available (default: true) */
  preferEventDriven: boolean;
}

/**
 * Default scheduler configuration
 */
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  pollingIntervalMs: 20, // 50 Hz
  eventDrivenThrottleMs: 8.33, // 120 Hz
  preferEventDriven: true,
};
