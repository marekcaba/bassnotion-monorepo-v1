/**
 * MIDI-specific Error Classes
 * Phase 5.2.1: Domain-specific error classes for MIDI processing
 *
 * Extends the PlaybackError base class with MIDI-specific error types
 * for the refactored MIDI processing modules.
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
 * MIDI-specific error codes
 */
export enum MidiErrorCode {
  // Parser errors
  INVALID_MIDI_FILE = 'MIDI_INVALID_FILE',
  CORRUPT_MIDI_DATA = 'MIDI_CORRUPT_DATA',
  UNSUPPORTED_FORMAT = 'MIDI_UNSUPPORTED_FORMAT',
  PARSE_FAILURE = 'MIDI_PARSE_FAILURE',

  // Validation errors
  INVALID_EVENT = 'MIDI_INVALID_EVENT',
  TIMING_ERROR = 'MIDI_TIMING_ERROR',
  SEQUENCE_ERROR = 'MIDI_SEQUENCE_ERROR',

  // Processing errors
  TRANSFORM_FAILURE = 'MIDI_TRANSFORM_FAILURE',
  QUANTIZATION_ERROR = 'MIDI_QUANTIZATION_ERROR',
  TRANSPOSITION_ERROR = 'MIDI_TRANSPOSITION_ERROR',
  VELOCITY_ERROR = 'MIDI_VELOCITY_ERROR',
  TIME_STRETCH_ERROR = 'MIDI_TIME_STRETCH_ERROR',

  // Pipeline errors
  PIPELINE_FAILURE = 'MIDI_PIPELINE_FAILURE',
  MIDDLEWARE_ERROR = 'MIDI_MIDDLEWARE_ERROR',
  STEP_TIMEOUT = 'MIDI_STEP_TIMEOUT',
}

/**
 * Base MIDI error class
 */
export class MidiError extends PlaybackError {
  constructor(
    code: MidiErrorCode,
    message: string,
    severity?: ErrorSeverity,
    cause?: Error,
    additionalContext?: Record<string, any>,
  ) {
    const context = createErrorContext({
      currentOperation: 'midi-processing',
      ...additionalContext,
    });

    const details: ErrorDetails = {
      code,
      message,
      severity:
        severity || determineSeverity(ErrorCategory.VALIDATION, true, false),
      category: ErrorCategory.VALIDATION,
      context,
      recoveryActions: [
        {
          type: 'retry',
          description: 'Retry MIDI operation',
          automatic: true,
          priority: 1,
        },
      ],
      userMessage: getMidiUserMessage(code),
      technicalMessage: `MIDI Error: ${message}`,
      documentationUrl: `/docs/errors/${code.toLowerCase()}`,
    };

    super(details, cause);
    this.name = 'MidiError';
  }
}

/**
 * MIDI parsing error
 */
export class MidiParseError extends MidiError {
  constructor(
    message: string,
    public readonly position?: number,
    public readonly expectedFormat?: string,
    cause?: Error,
  ) {
    super(MidiErrorCode.PARSE_FAILURE, message, ErrorSeverity.HIGH, cause, {
      parsePosition: position,
      expectedFormat,
      operation: 'midi-parse',
    });
    this.name = 'MidiParseError';
  }
}

/**
 * Invalid MIDI file error
 */
export class InvalidMidiFileError extends MidiError {
  constructor(
    message: string,
    public readonly fileSize?: number,
    public readonly detectedFormat?: string,
  ) {
    super(
      MidiErrorCode.INVALID_MIDI_FILE,
      message,
      ErrorSeverity.HIGH,
      undefined,
      {
        fileSize,
        detectedFormat,
        operation: 'midi-file-validation',
      },
    );
    this.name = 'InvalidMidiFileError';
  }
}

/**
 * MIDI validation error
 */
export class MidiValidationError extends MidiError {
  constructor(
    message: string,
    public readonly validationErrors: Array<{
      field: string;
      issue: string;
      severity: 'error' | 'warning';
    }>,
    public readonly eventIndex?: number,
  ) {
    super(
      MidiErrorCode.INVALID_EVENT,
      message,
      ErrorSeverity.MEDIUM,
      undefined,
      {
        validationErrors,
        eventIndex,
        operation: 'midi-validation',
      },
    );
    this.name = 'MidiValidationError';
  }
}

/**
 * MIDI timing error
 */
export class MidiTimingError extends MidiError {
  constructor(
    message: string,
    public readonly expectedTime: number,
    public readonly actualTime: number,
    public readonly drift: number,
  ) {
    super(
      MidiErrorCode.TIMING_ERROR,
      message,
      ErrorSeverity.MEDIUM,
      undefined,
      {
        expectedTime,
        actualTime,
        drift,
        operation: 'midi-timing-validation',
      },
    );
    this.name = 'MidiTimingError';
  }
}

/**
 * MIDI transformation error
 */
export class MidiTransformError extends MidiError {
  constructor(
    message: string,
    public readonly transformType:
      | 'quantize'
      | 'transpose'
      | 'velocity'
      | 'timeStretch',
    public readonly parameters?: Record<string, any>,
    cause?: Error,
  ) {
    super(
      MidiErrorCode.TRANSFORM_FAILURE,
      message,
      ErrorSeverity.MEDIUM,
      cause,
      {
        transformType,
        parameters,
        operation: `midi-transform-${transformType}`,
      },
    );
    this.name = 'MidiTransformError';
  }
}

/**
 * MIDI pipeline error
 */
export class MidiPipelineError extends MidiError {
  constructor(
    message: string,
    public readonly stepName: string,
    public readonly stepIndex: number,
    public readonly pipelineId: string,
    cause?: Error,
  ) {
    super(MidiErrorCode.PIPELINE_FAILURE, message, ErrorSeverity.HIGH, cause, {
      stepName,
      stepIndex,
      pipelineId,
      operation: 'midi-pipeline-execution',
    });
    this.name = 'MidiPipelineError';
  }
}

/**
 * MIDI quantization error
 */
export class MidiQuantizationError extends MidiTransformError {
  constructor(
    message: string,
    public readonly quantizeValue: number,
    public readonly swing?: number,
    cause?: Error,
  ) {
    super(message, 'quantize', { quantizeValue, swing }, cause);
    this.name = 'MidiQuantizationError';
  }
}

/**
 * MIDI transposition error
 */
export class MidiTranspositionError extends MidiTransformError {
  constructor(
    message: string,
    public readonly semitones: number,
    public readonly outOfRangeNotes: number[],
    cause?: Error,
  ) {
    super(
      message,
      'transpose',
      { semitones, outOfRangeNotes: outOfRangeNotes.length },
      cause,
    );
    this.name = 'MidiTranspositionError';
  }
}

/**
 * Helper function to get user-friendly messages for MIDI errors
 */
function getMidiUserMessage(code: MidiErrorCode): string {
  switch (code) {
    case MidiErrorCode.INVALID_MIDI_FILE:
      return 'The file is not a valid MIDI file. Please select a proper MIDI file.';
    case MidiErrorCode.CORRUPT_MIDI_DATA:
      return 'The MIDI file appears to be corrupted. Please try a different file.';
    case MidiErrorCode.UNSUPPORTED_FORMAT:
      return 'This MIDI format is not supported. Please use a standard MIDI file.';
    case MidiErrorCode.PARSE_FAILURE:
      return 'Failed to read the MIDI file. The file may be damaged.';
    case MidiErrorCode.INVALID_EVENT:
      return 'The MIDI file contains invalid events. Some notes may not play correctly.';
    case MidiErrorCode.TIMING_ERROR:
      return 'Timing issues detected in the MIDI file. Playback may sound incorrect.';
    case MidiErrorCode.SEQUENCE_ERROR:
      return 'The MIDI sequence has errors. Some parts may not play as expected.';
    case MidiErrorCode.TRANSFORM_FAILURE:
      return 'Failed to process the MIDI file. Please try again.';
    case MidiErrorCode.QUANTIZATION_ERROR:
      return 'Failed to quantize MIDI notes. The rhythm may not be adjusted.';
    case MidiErrorCode.TRANSPOSITION_ERROR:
      return 'Failed to transpose MIDI notes. Some notes may be out of range.';
    case MidiErrorCode.VELOCITY_ERROR:
      return 'Failed to adjust note velocities. Volume levels may be unchanged.';
    case MidiErrorCode.TIME_STRETCH_ERROR:
      return 'Failed to stretch MIDI timing. The tempo may not be adjusted.';
    case MidiErrorCode.PIPELINE_FAILURE:
      return 'MIDI processing failed. Please try a simpler operation.';
    case MidiErrorCode.MIDDLEWARE_ERROR:
      return 'MIDI processing encountered an error. Some features may be unavailable.';
    case MidiErrorCode.STEP_TIMEOUT:
      return 'MIDI processing took too long. Please try with a smaller file.';
    default:
      return 'An error occurred while processing the MIDI file.';
  }
}

/**
 * Type guard for MIDI errors
 */
export function isMidiError(error: unknown): error is MidiError {
  return error instanceof MidiError;
}

/**
 * Type guards for specific MIDI errors
 */
export function isMidiParseError(error: unknown): error is MidiParseError {
  return error instanceof MidiParseError;
}

export function isMidiValidationError(
  error: unknown,
): error is MidiValidationError {
  return error instanceof MidiValidationError;
}

export function isMidiPipelineError(
  error: unknown,
): error is MidiPipelineError {
  return error instanceof MidiPipelineError;
}
