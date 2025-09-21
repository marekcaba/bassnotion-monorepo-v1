/**
 * Playback Domain Error Classes
 * Phase 5.2.1: Centralized export of domain-specific error classes
 *
 * This module exports all error classes for the playback domain,
 * providing a single import point for error handling across the system.
 */

// Base error classes
export {
  PlaybackError,
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
  ErrorRecoveryAction,
  ErrorMetrics,
  ErrorDetails,
  createErrorContext,
  determineSeverity,
} from '../../services/errors/base.js';

// Audio errors (from parent errors directory)
export {
  AudioError,
  AudioInitializationError,
  AudioContextError,
  AudioNotSupportedError,
  AudioPermissionError,
  AudioContextSuspendedError,
  SampleLoadError,
  PluginLoadError,
  TransportError as AudioTransportError,
  MemoryLimitError,
  NetworkError as AudioNetworkError,
  AudioValidationError,
  ErrorMetadata,
} from '../../errors/AudioErrors.js';

// Instrument-specific errors
export {
  InstrumentErrorCode,
  InstrumentError,
  SamplerError,
  SynthError,
  DrumKitError,
  NotePlaybackError,
  PatternScheduleError,
  VoiceLimitError,
  CpuOverloadError,
  ExtendedInstrumentError,
  isInstrumentError,
  isSamplerError,
  isDrumKitError,
  isVoiceLimitError,
  isCpuOverloadError,
} from './InstrumentErrors.js';

// MIDI-specific errors
export {
  MidiErrorCode,
  MidiError,
  MidiParseError,
  InvalidMidiFileError,
  MidiValidationError,
  MidiTimingError,
  MidiTransformError,
  MidiPipelineError,
  MidiQuantizationError,
  MidiTranspositionError,
  isMidiError,
  isMidiParseError,
  isMidiValidationError,
  isMidiPipelineError,
} from './MidiErrors.js';

// Storage-specific errors
export {
  StorageErrorCode,
  StorageError,
  StorageConnectionError,
  StorageAuthError,
  UploadError,
  DownloadError,
  CacheError,
  CacheFullError,
  CDNError,
  BatchOperationError,
  CircuitBreakerOpenError,
  RetryExhaustedError,
  isStorageError,
  isStorageConnectionError,
  isCacheError,
  isCDNError,
  isBatchOperationError,
  isCircuitBreakerOpenError,
} from './StorageErrors.js';

// Transport errors
export {
  TransportErrorCode,
  TransportError,
  ClockSyncError,
  SchedulingError,
  TimelineError,
  AudioWorkletError,
  LatencyError,
  WidgetSyncError,
  EventMissedError,
  ScheduleOverflowError,
  isTransportError,
  isClockSyncError,
  isSchedulingError,
  isAudioWorkletError,
  isLatencyError,
} from './TransportErrors.js';

// Error recovery
export {
  ErrorRecoveryRegistry,
  PrioritizedRecoveryStrategy,
  RecoveryRegistryConfig,
} from './ErrorRecoveryRegistry.js';

/**
 * Utility function to determine error type and return appropriate message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof PlaybackError) {
    return error.getUserMessage();
  }

  if (error instanceof AudioError) {
    return error.toUserMessage();
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred';
}

/**
 * Utility function to get error severity
 */
export function getErrorSeverity(error: unknown): ErrorSeverity {
  if (error instanceof PlaybackError) {
    return error.severity;
  }

  if (error instanceof AudioError) {
    const severityMap: Record<string, ErrorSeverity> = {
      critical: ErrorSeverity.CRITICAL,
      high: ErrorSeverity.HIGH,
      medium: ErrorSeverity.MEDIUM,
      low: ErrorSeverity.LOW,
    };
    return severityMap[error.getSeverity()] || ErrorSeverity.MEDIUM;
  }

  return ErrorSeverity.MEDIUM;
}

/**
 * Utility function to check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof PlaybackError) {
    return error.isRecoverable();
  }

  if (error instanceof AudioError) {
    return error.isRecoverable();
  }

  return false;
}

/**
 * Create a standardized error based on the error type
 */
export function createPlaybackError(
  type: 'instrument' | 'midi' | 'storage' | 'transport' | 'audio',
  code: string,
  message: string,
  cause?: Error,
  context?: Record<string, any>,
): PlaybackError {
  const categoryMap: Record<typeof type, ErrorCategory> = {
    instrument: ErrorCategory.RESOURCE,
    midi: ErrorCategory.VALIDATION,
    storage: ErrorCategory.NETWORK,
    transport: ErrorCategory.AUDIO_CONTEXT,
    audio: ErrorCategory.AUDIO_CONTEXT,
  };

  const severity = determineSeverity(
    categoryMap[type],
    true, // isRecoverable
    type === 'audio' || type === 'transport', // affectsCore
  );

  const errorContext = createErrorContext({
    currentOperation: `${type}-operation`,
    ...context,
  });

  const details: ErrorDetails = {
    code,
    message,
    severity,
    category: categoryMap[type],
    context: errorContext,
    recoveryActions: [
      {
        type: 'retry',
        description: 'Retry operation',
        automatic: true,
        priority: 1,
      },
    ],
    userMessage: message,
    technicalMessage: `${type} Error: ${message}`,
    documentationUrl: `/docs/errors/${code.toLowerCase()}`,
  };

  return new PlaybackError(details, cause);
}
