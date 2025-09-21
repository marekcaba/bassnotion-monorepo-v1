/**
 * Instrument-specific Error Classes
 * Phase 5.2.1: Domain-specific error classes for instrument processing
 *
 * Extends the AudioError base class with instrument-specific error types
 * for the refactored instrument modules.
 */

import { AudioError, ErrorMetadata } from '../../errors/AudioErrors.js';
import {
  PlaybackError,
  ErrorSeverity,
  ErrorCategory,
  ErrorDetails,
  createErrorContext,
} from '../../services/errors/base.js';

/**
 * Instrument-specific error codes
 */
export enum InstrumentErrorCode {
  // Initialization errors
  INSTRUMENT_INIT_FAILED = 'INSTRUMENT_INIT_FAILED',
  SAMPLER_INIT_FAILED = 'SAMPLER_INIT_FAILED',
  SYNTH_INIT_FAILED = 'SYNTH_INIT_FAILED',

  // Loading errors
  SAMPLE_MAPPING_FAILED = 'SAMPLE_MAPPING_FAILED',
  DRUM_KIT_LOAD_FAILED = 'DRUM_KIT_LOAD_FAILED',
  PRESET_LOAD_FAILED = 'PRESET_LOAD_FAILED',

  // Playback errors
  NOTE_PLAY_FAILED = 'NOTE_PLAY_FAILED',
  SEQUENCE_PLAY_FAILED = 'SEQUENCE_PLAY_FAILED',
  PATTERN_SCHEDULE_FAILED = 'PATTERN_SCHEDULE_FAILED',

  // Resource errors
  BUFFER_ALLOCATION_FAILED = 'BUFFER_ALLOCATION_FAILED',
  VOICE_LIMIT_EXCEEDED = 'VOICE_LIMIT_EXCEEDED',
  CPU_OVERLOAD = 'CPU_OVERLOAD',

  // Configuration errors
  INVALID_INSTRUMENT_CONFIG = 'INVALID_INSTRUMENT_CONFIG',
  INVALID_EFFECT_CHAIN = 'INVALID_EFFECT_CHAIN',
  INVALID_MIDI_MAPPING = 'INVALID_MIDI_MAPPING',
}

/**
 * Base instrument error class that extends AudioError
 */
export class InstrumentError extends AudioError {
  public readonly instrumentType?: string;
  public readonly instrumentId?: string;

  constructor(
    code: string,
    message: string,
    instrumentType?: string,
    instrumentId?: string,
    originalError?: Error,
    metadata?: Partial<ErrorMetadata>,
  ) {
    super(message, code, originalError, {
      ...metadata,
      details: {
        ...metadata?.details,
        instrumentType,
        instrumentId,
      },
    });

    this.name = 'InstrumentError';
    this.instrumentType = instrumentType;
    this.instrumentId = instrumentId;
  }

  /**
   * Override to provide instrument-specific user messages
   */
  toUserMessage(): string {
    switch (this.code) {
      case InstrumentErrorCode.INSTRUMENT_INIT_FAILED:
        return `Failed to initialize ${this.instrumentType || 'instrument'}. Please refresh the page.`;
      case InstrumentErrorCode.SAMPLE_MAPPING_FAILED:
        return 'Failed to load instrument sounds. Please check your connection and try again.';
      case InstrumentErrorCode.DRUM_KIT_LOAD_FAILED:
        return 'Failed to load drum kit. Some drum sounds may be unavailable.';
      case InstrumentErrorCode.NOTE_PLAY_FAILED:
        return 'Failed to play note. The instrument may need to be reloaded.';
      case InstrumentErrorCode.VOICE_LIMIT_EXCEEDED:
        return 'Too many notes playing. Some notes may be cut off.';
      case InstrumentErrorCode.CPU_OVERLOAD:
        return 'Audio processing overload. Consider reducing the number of active instruments.';
      default:
        return super.toUserMessage();
    }
  }
}

/**
 * Sampler-specific error
 */
export class SamplerError extends InstrumentError {
  constructor(
    message: string,
    public readonly samplePath?: string,
    public readonly noteRange?: { min: number; max: number },
    originalError?: Error,
  ) {
    super(
      InstrumentErrorCode.SAMPLER_INIT_FAILED,
      message,
      'sampler',
      undefined,
      originalError,
      {
        details: {
          samplePath,
          noteRange,
        },
      },
    );
    this.name = 'SamplerError';
  }
}

/**
 * Synthesizer-specific error
 */
export class SynthError extends InstrumentError {
  constructor(
    message: string,
    public readonly synthType: string,
    public readonly oscillatorCount?: number,
    originalError?: Error,
  ) {
    super(
      InstrumentErrorCode.SYNTH_INIT_FAILED,
      message,
      'synthesizer',
      synthType,
      originalError,
      {
        details: {
          synthType,
          oscillatorCount,
        },
      },
    );
    this.name = 'SynthError';
  }
}

/**
 * Drum kit loading error
 */
export class DrumKitError extends InstrumentError {
  constructor(
    message: string,
    public readonly kitName: string,
    public readonly missingPieces?: string[],
    originalError?: Error,
  ) {
    super(
      InstrumentErrorCode.DRUM_KIT_LOAD_FAILED,
      message,
      'drums',
      kitName,
      originalError,
      {
        details: {
          kitName,
          missingPieces,
        },
      },
    );
    this.name = 'DrumKitError';
  }
}

/**
 * Note playback error
 */
export class NotePlaybackError extends InstrumentError {
  constructor(
    message: string,
    public readonly note: number | string,
    public readonly velocity: number,
    public readonly instrumentType: string,
    originalError?: Error,
  ) {
    super(
      InstrumentErrorCode.NOTE_PLAY_FAILED,
      message,
      instrumentType,
      undefined,
      originalError,
      {
        details: {
          note,
          velocity,
        },
      },
    );
    this.name = 'NotePlaybackError';
  }
}

/**
 * Pattern scheduling error
 */
export class PatternScheduleError extends InstrumentError {
  constructor(
    message: string,
    public readonly patternId: string,
    public readonly startTime: number,
    public readonly duration?: number,
    originalError?: Error,
  ) {
    super(
      InstrumentErrorCode.PATTERN_SCHEDULE_FAILED,
      message,
      undefined,
      undefined,
      originalError,
      {
        details: {
          patternId,
          startTime,
          duration,
        },
      },
    );
    this.name = 'PatternScheduleError';
  }
}

/**
 * Voice limit error
 */
export class VoiceLimitError extends InstrumentError {
  constructor(
    public readonly currentVoices: number,
    public readonly maxVoices: number,
    public readonly instrumentType: string,
  ) {
    const message = `Voice limit exceeded: ${currentVoices}/${maxVoices}`;

    super(
      InstrumentErrorCode.VOICE_LIMIT_EXCEEDED,
      message,
      instrumentType,
      undefined,
      undefined,
      {
        details: {
          currentVoices,
          maxVoices,
        },
      },
    );
    this.name = 'VoiceLimitError';
  }
}

/**
 * CPU overload error
 */
export class CpuOverloadError extends InstrumentError {
  constructor(
    public readonly cpuUsage: number,
    public readonly threshold: number,
    public readonly activeInstruments: string[],
  ) {
    const message = `CPU overload: ${cpuUsage.toFixed(1)}% (threshold: ${threshold}%)`;

    super(
      InstrumentErrorCode.CPU_OVERLOAD,
      message,
      undefined,
      undefined,
      undefined,
      {
        details: {
          cpuUsage,
          threshold,
          activeInstruments,
        },
      },
    );
    this.name = 'CpuOverloadError';
  }
}

/**
 * Extended instrument error with PlaybackError features
 */
export class ExtendedInstrumentError extends PlaybackError {
  public readonly instrumentType?: string;
  public readonly instrumentId?: string;

  constructor(
    code: InstrumentErrorCode,
    message: string,
    severity: ErrorSeverity,
    instrumentType?: string,
    instrumentId?: string,
    cause?: Error,
    additionalContext?: Record<string, any>,
  ) {
    const context = createErrorContext({
      currentOperation: 'instrument-operation',
      ...additionalContext,
      instrumentType,
      instrumentId,
    });

    const details: ErrorDetails = {
      code,
      message,
      severity,
      category: ErrorCategory.RESOURCE,
      context,
      recoveryActions: getInstrumentRecoveryActions(code),
      userMessage: getInstrumentUserMessage(code, instrumentType),
      technicalMessage: `Instrument Error: ${message}`,
      documentationUrl: `/docs/errors/${code.toLowerCase()}`,
    };

    super(details, cause);
    this.name = 'ExtendedInstrumentError';
    this.instrumentType = instrumentType;
    this.instrumentId = instrumentId;
  }
}

/**
 * Helper function to get recovery actions for instrument errors
 */
function getInstrumentRecoveryActions(code: InstrumentErrorCode) {
  switch (code) {
    case InstrumentErrorCode.INSTRUMENT_INIT_FAILED:
    case InstrumentErrorCode.SAMPLER_INIT_FAILED:
    case InstrumentErrorCode.SYNTH_INIT_FAILED:
      return [
        {
          type: 'retry' as const,
          description: 'Retry instrument initialization',
          automatic: true,
          priority: 1,
          estimatedTime: 2000,
        },
        {
          type: 'reload' as const,
          description: 'Reload the page',
          automatic: false,
          priority: 2,
        },
      ];

    case InstrumentErrorCode.SAMPLE_MAPPING_FAILED:
    case InstrumentErrorCode.DRUM_KIT_LOAD_FAILED:
      return [
        {
          type: 'retry' as const,
          description: 'Retry loading samples',
          automatic: true,
          priority: 1,
          estimatedTime: 5000,
        },
        {
          type: 'fallback' as const,
          description: 'Use default samples',
          automatic: true,
          priority: 2,
        },
      ];

    case InstrumentErrorCode.VOICE_LIMIT_EXCEEDED:
    case InstrumentErrorCode.CPU_OVERLOAD:
      return [
        {
          type: 'degrade' as const,
          description: 'Reduce audio quality',
          automatic: true,
          priority: 1,
        },
        {
          type: 'abort' as const,
          description: 'Stop some instruments',
          automatic: false,
          priority: 2,
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
 * Helper function to get user-friendly messages
 */
function getInstrumentUserMessage(
  code: InstrumentErrorCode,
  instrumentType?: string,
): string {
  const instrument = instrumentType || 'instrument';

  switch (code) {
    case InstrumentErrorCode.INSTRUMENT_INIT_FAILED:
      return `Failed to initialize ${instrument}. Please refresh the page.`;
    case InstrumentErrorCode.SAMPLER_INIT_FAILED:
      return 'Failed to load instrument samples. Some sounds may be unavailable.';
    case InstrumentErrorCode.SYNTH_INIT_FAILED:
      return 'Failed to initialize synthesizer. Electronic sounds may be unavailable.';
    case InstrumentErrorCode.SAMPLE_MAPPING_FAILED:
      return 'Failed to load instrument configuration. Default sounds will be used.';
    case InstrumentErrorCode.DRUM_KIT_LOAD_FAILED:
      return 'Failed to load drum kit. Some drum sounds may be missing.';
    case InstrumentErrorCode.PRESET_LOAD_FAILED:
      return 'Failed to load instrument preset. Default settings will be used.';
    case InstrumentErrorCode.NOTE_PLAY_FAILED:
      return 'Failed to play note. The instrument may need to be reloaded.';
    case InstrumentErrorCode.SEQUENCE_PLAY_FAILED:
      return 'Failed to play sequence. Please try again.';
    case InstrumentErrorCode.PATTERN_SCHEDULE_FAILED:
      return 'Failed to schedule pattern. Timing may be affected.';
    case InstrumentErrorCode.BUFFER_ALLOCATION_FAILED:
      return 'Insufficient memory for audio. Please close other applications.';
    case InstrumentErrorCode.VOICE_LIMIT_EXCEEDED:
      return 'Too many notes playing. Some notes may be cut off.';
    case InstrumentErrorCode.CPU_OVERLOAD:
      return 'Audio processing overload. Consider reducing active instruments.';
    case InstrumentErrorCode.INVALID_INSTRUMENT_CONFIG:
      return 'Invalid instrument settings. Default configuration will be used.';
    case InstrumentErrorCode.INVALID_EFFECT_CHAIN:
      return 'Invalid effect settings. Effects may be disabled.';
    case InstrumentErrorCode.INVALID_MIDI_MAPPING:
      return 'Invalid MIDI configuration. MIDI control may not work correctly.';
    default:
      return `An error occurred with the ${instrument}.`;
  }
}

/**
 * Type guards for instrument errors
 */
export function isInstrumentError(error: unknown): error is InstrumentError {
  return error instanceof InstrumentError;
}

export function isSamplerError(error: unknown): error is SamplerError {
  return error instanceof SamplerError;
}

export function isDrumKitError(error: unknown): error is DrumKitError {
  return error instanceof DrumKitError;
}

export function isVoiceLimitError(error: unknown): error is VoiceLimitError {
  return error instanceof VoiceLimitError;
}

export function isCpuOverloadError(error: unknown): error is CpuOverloadError {
  return error instanceof CpuOverloadError;
}
