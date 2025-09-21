/**
 * Transport-specific Error Classes
 * Phase 5.2.1: Domain-specific error classes for transport operations
 *
 * Extends the PlaybackError base class with transport-specific error types
 * for the refactored transport modules.
 */

import {
  PlaybackError,
  ErrorSeverity,
  ErrorCategory,
  ErrorDetails,
  createErrorContext,
  determineSeverity,
} from '../../services/errors/base.js';

/**
 * Transport-specific error codes
 */
export enum TransportErrorCode {
  // Clock errors
  CLOCK_INIT_FAILED = 'TRANSPORT_CLOCK_INIT_FAILED',
  CLOCK_SYNC_FAILED = 'TRANSPORT_CLOCK_SYNC_FAILED',
  CLOCK_DRIFT_EXCEEDED = 'TRANSPORT_CLOCK_DRIFT_EXCEEDED',

  // Scheduling errors
  SCHEDULE_FAILED = 'TRANSPORT_SCHEDULE_FAILED',
  SCHEDULE_OVERFLOW = 'TRANSPORT_SCHEDULE_OVERFLOW',
  EVENT_MISSED = 'TRANSPORT_EVENT_MISSED',

  // Timeline errors
  TIMELINE_INVALID = 'TRANSPORT_TIMELINE_INVALID',
  TIMELINE_OVERFLOW = 'TRANSPORT_TIMELINE_OVERFLOW',
  POSITION_OUT_OF_RANGE = 'TRANSPORT_POSITION_OUT_OF_RANGE',

  // Worklet errors
  WORKLET_INIT_FAILED = 'TRANSPORT_WORKLET_INIT_FAILED',
  WORKLET_COMMUNICATION_FAILED = 'TRANSPORT_WORKLET_COMMUNICATION_FAILED',
  WORKLET_PROCESSING_ERROR = 'TRANSPORT_WORKLET_PROCESSING_ERROR',

  // Sync errors
  WIDGET_SYNC_FAILED = 'TRANSPORT_WIDGET_SYNC_FAILED',
  BROADCAST_FAILED = 'TRANSPORT_BROADCAST_FAILED',
  HEARTBEAT_TIMEOUT = 'TRANSPORT_HEARTBEAT_TIMEOUT',

  // Latency errors
  LATENCY_MEASUREMENT_FAILED = 'TRANSPORT_LATENCY_MEASUREMENT_FAILED',
  LATENCY_COMPENSATION_FAILED = 'TRANSPORT_LATENCY_COMPENSATION_FAILED',
  LATENCY_THRESHOLD_EXCEEDED = 'TRANSPORT_LATENCY_THRESHOLD_EXCEEDED',
}

/**
 * Base transport error class
 */
export class TransportError extends PlaybackError {
  constructor(
    code: TransportErrorCode,
    message: string,
    severity?: ErrorSeverity,
    cause?: Error,
    additionalContext?: Record<string, any>,
  ) {
    const context = createErrorContext({
      currentOperation: 'transport-operation',
      ...additionalContext,
    });

    const details: ErrorDetails = {
      code,
      message,
      severity:
        severity || determineSeverity(ErrorCategory.AUDIO_CONTEXT, true, true),
      category: ErrorCategory.AUDIO_CONTEXT,
      context,
      recoveryActions: getTransportRecoveryActions(code),
      userMessage: getTransportUserMessage(code),
      technicalMessage: `Transport Error: ${message}`,
      documentationUrl: `/docs/errors/${code.toLowerCase()}`,
    };

    super(details, cause);
    this.name = 'TransportError';
  }
}

/**
 * Clock synchronization error
 */
export class ClockSyncError extends TransportError {
  constructor(
    message: string,
    public readonly drift: number,
    public readonly threshold: number,
    public readonly sampleRate: number,
    cause?: Error,
  ) {
    super(
      TransportErrorCode.CLOCK_SYNC_FAILED,
      message,
      ErrorSeverity.HIGH,
      cause,
      {
        drift,
        threshold,
        sampleRate,
        operation: 'clock-sync',
      },
    );
    this.name = 'ClockSyncError';
  }
}

/**
 * Scheduling error
 */
export class SchedulingError extends TransportError {
  constructor(
    message: string,
    public readonly eventTime: number,
    public readonly currentTime: number,
    public readonly eventType?: string,
    cause?: Error,
  ) {
    super(
      TransportErrorCode.SCHEDULE_FAILED,
      message,
      ErrorSeverity.MEDIUM,
      cause,
      {
        eventTime,
        currentTime,
        eventType,
        operation: 'event-scheduling',
      },
    );
    this.name = 'SchedulingError';
  }
}

/**
 * Timeline error
 */
export class TimelineError extends TransportError {
  constructor(
    message: string,
    public readonly position: number,
    public readonly duration: number,
    public readonly operation: 'seek' | 'loop' | 'marker',
    cause?: Error,
  ) {
    super(
      TransportErrorCode.TIMELINE_INVALID,
      message,
      ErrorSeverity.MEDIUM,
      cause,
      {
        position,
        duration,
        timelineOperation: operation,
      },
    );
    this.name = 'TimelineError';
  }
}

/**
 * Audio worklet error
 */
export class AudioWorkletError extends TransportError {
  constructor(
    message: string,
    public readonly workletType: string,
    public readonly processorState?: string,
    cause?: Error,
  ) {
    super(
      TransportErrorCode.WORKLET_INIT_FAILED,
      message,
      ErrorSeverity.HIGH,
      cause,
      {
        workletType,
        processorState,
        operation: 'worklet-operation',
      },
    );
    this.name = 'AudioWorkletError';
  }
}

/**
 * Latency error
 */
export class LatencyError extends TransportError {
  constructor(
    message: string,
    public readonly measuredLatency: number,
    public readonly targetLatency: number,
    public readonly compensationApplied: boolean,
    cause?: Error,
  ) {
    super(
      TransportErrorCode.LATENCY_THRESHOLD_EXCEEDED,
      message,
      ErrorSeverity.MEDIUM,
      cause,
      {
        measuredLatency,
        targetLatency,
        compensationApplied,
        operation: 'latency-management',
      },
    );
    this.name = 'LatencyError';
  }
}

/**
 * Widget sync error
 */
export class WidgetSyncError extends TransportError {
  constructor(
    message: string,
    public readonly widgetId: string,
    public readonly expectedState: any,
    public readonly actualState: any,
    cause?: Error,
  ) {
    super(
      TransportErrorCode.WIDGET_SYNC_FAILED,
      message,
      ErrorSeverity.LOW,
      cause,
      {
        widgetId,
        expectedState,
        actualState,
        operation: 'widget-sync',
      },
    );
    this.name = 'WidgetSyncError';
  }
}

/**
 * Event missed error
 */
export class EventMissedError extends TransportError {
  constructor(
    public readonly eventId: string,
    public readonly scheduledTime: number,
    public readonly actualTime: number,
    public readonly eventType: string,
  ) {
    const lateness = actualTime - scheduledTime;
    const message = `Event missed by ${lateness.toFixed(2)}ms: ${eventType}`;

    super(
      TransportErrorCode.EVENT_MISSED,
      message,
      ErrorSeverity.LOW,
      undefined,
      {
        eventId,
        scheduledTime,
        actualTime,
        lateness,
        eventType,
        operation: 'event-execution',
      },
    );
    this.name = 'EventMissedError';
  }
}

/**
 * Schedule overflow error
 */
export class ScheduleOverflowError extends TransportError {
  constructor(
    public readonly queueSize: number,
    public readonly maxQueueSize: number,
    public readonly droppedEvents: number,
  ) {
    const message = `Schedule queue overflow: ${queueSize}/${maxQueueSize} events`;

    super(
      TransportErrorCode.SCHEDULE_OVERFLOW,
      message,
      ErrorSeverity.HIGH,
      undefined,
      {
        queueSize,
        maxQueueSize,
        droppedEvents,
        operation: 'schedule-queue',
      },
    );
    this.name = 'ScheduleOverflowError';
  }
}

/**
 * Helper function to get recovery actions for transport errors
 */
function getTransportRecoveryActions(code: TransportErrorCode) {
  switch (code) {
    case TransportErrorCode.CLOCK_INIT_FAILED:
    case TransportErrorCode.CLOCK_SYNC_FAILED:
      return [
        {
          type: 'retry' as const,
          description: 'Reinitialize clock',
          automatic: true,
          priority: 1,
          estimatedTime: 1000,
        },
        {
          type: 'fallback' as const,
          description: 'Use fallback timing',
          automatic: true,
          priority: 2,
        },
      ];

    case TransportErrorCode.CLOCK_DRIFT_EXCEEDED:
      return [
        {
          type: 'degrade' as const,
          description: 'Adjust timing compensation',
          automatic: true,
          priority: 1,
        },
      ];

    case TransportErrorCode.SCHEDULE_OVERFLOW:
      return [
        {
          type: 'degrade' as const,
          description: 'Drop non-critical events',
          automatic: true,
          priority: 1,
        },
        {
          type: 'abort' as const,
          description: 'Stop playback',
          automatic: false,
          priority: 2,
        },
      ];

    case TransportErrorCode.WORKLET_INIT_FAILED:
      return [
        {
          type: 'fallback' as const,
          description: 'Use ScriptProcessor fallback',
          automatic: true,
          priority: 1,
        },
      ];

    case TransportErrorCode.LATENCY_THRESHOLD_EXCEEDED:
      return [
        {
          type: 'degrade' as const,
          description: 'Increase buffer size',
          automatic: true,
          priority: 1,
        },
      ];

    case TransportErrorCode.WIDGET_SYNC_FAILED:
      return [
        {
          type: 'retry' as const,
          description: 'Resync widget',
          automatic: true,
          priority: 1,
          estimatedTime: 500,
        },
      ];

    default:
      return [
        {
          type: 'retry' as const,
          description: 'Retry operation',
          automatic: true,
          priority: 1,
        },
      ];
  }
}

/**
 * Helper function to get user-friendly messages for transport errors
 */
function getTransportUserMessage(code: TransportErrorCode): string {
  switch (code) {
    case TransportErrorCode.CLOCK_INIT_FAILED:
      return 'Failed to initialize timing system. Audio playback may be affected.';
    case TransportErrorCode.CLOCK_SYNC_FAILED:
      return 'Audio timing synchronization issue. Playback may sound irregular.';
    case TransportErrorCode.CLOCK_DRIFT_EXCEEDED:
      return 'Timing drift detected. Adjusting playback to stay in sync.';
    case TransportErrorCode.SCHEDULE_FAILED:
      return 'Failed to schedule audio event. Some notes may be missed.';
    case TransportErrorCode.SCHEDULE_OVERFLOW:
      return 'Too many audio events. Reducing complexity to maintain performance.';
    case TransportErrorCode.EVENT_MISSED:
      return 'Some audio events were delayed. Playback timing may be affected.';
    case TransportErrorCode.TIMELINE_INVALID:
      return 'Invalid playback position. Returning to valid range.';
    case TransportErrorCode.TIMELINE_OVERFLOW:
      return 'Playback position out of bounds. Resetting to start.';
    case TransportErrorCode.POSITION_OUT_OF_RANGE:
      return 'Requested position is outside the valid range.';
    case TransportErrorCode.WORKLET_INIT_FAILED:
      return 'Failed to initialize audio processor. Using compatibility mode.';
    case TransportErrorCode.WORKLET_COMMUNICATION_FAILED:
      return 'Audio processor communication error. Some features may be limited.';
    case TransportErrorCode.WORKLET_PROCESSING_ERROR:
      return 'Audio processing error. Sound quality may be affected.';
    case TransportErrorCode.WIDGET_SYNC_FAILED:
      return 'Display synchronization issue. Visual feedback may be delayed.';
    case TransportErrorCode.BROADCAST_FAILED:
      return 'Failed to synchronize multiple components. Some features may not update.';
    case TransportErrorCode.HEARTBEAT_TIMEOUT:
      return 'Lost connection to audio engine. Attempting to reconnect.';
    case TransportErrorCode.LATENCY_MEASUREMENT_FAILED:
      return 'Unable to measure audio delay. Timing accuracy may be reduced.';
    case TransportErrorCode.LATENCY_COMPENSATION_FAILED:
      return 'Unable to compensate for audio delay. Slight timing offset may occur.';
    case TransportErrorCode.LATENCY_THRESHOLD_EXCEEDED:
      return 'High audio latency detected. Adjusting settings for better performance.';
    default:
      return 'A timing error occurred. Audio playback may be affected.';
  }
}

/**
 * Type guards for transport errors
 */
export function isTransportError(error: unknown): error is TransportError {
  return error instanceof TransportError;
}

export function isClockSyncError(error: unknown): error is ClockSyncError {
  return error instanceof ClockSyncError;
}

export function isSchedulingError(error: unknown): error is SchedulingError {
  return error instanceof SchedulingError;
}

export function isAudioWorkletError(
  error: unknown,
): error is AudioWorkletError {
  return error instanceof AudioWorkletError;
}

export function isLatencyError(error: unknown): error is LatencyError {
  return error instanceof LatencyError;
}
