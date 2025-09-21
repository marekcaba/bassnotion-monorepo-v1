/**
 * Transport Module Errors
 */

/**
 * Base transport error class
 */
export class TransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransportError';
  }
}

/**
 * Clock synchronization error
 */
export class ClockSyncError extends TransportError {
  constructor(message: string) {
    super(message);
    this.name = 'ClockSyncError';
  }
}

/**
 * Scheduling error
 */
export class SchedulingError extends TransportError {
  constructor(message: string) {
    super(message);
    this.name = 'SchedulingError';
  }
}

/**
 * Timeline error
 */
export class TimelineError extends TransportError {
  constructor(message: string) {
    super(message);
    this.name = 'TimelineError';
  }
}

/**
 * Audio worklet error
 */
export class AudioWorkletError extends TransportError {
  constructor(message: string) {
    super(message);
    this.name = 'AudioWorkletError';
  }
}

/**
 * Latency compensation error
 */
export class LatencyError extends TransportError {
  constructor(message: string) {
    super(message);
    this.name = 'LatencyError';
  }
}
