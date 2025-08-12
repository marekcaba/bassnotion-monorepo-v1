/**
 * AudioErrors - Custom audio error classes
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 * 
 * Professional error handling for all audio operations
 */

export interface ErrorMetadata {
  timestamp: number;
  operation?: string;
  details?: Record<string, unknown>;
  retryCount?: number;
  userAgent?: string;
}

/**
 * Base audio error class with user-friendly message support
 */
export class AudioError extends Error {
  public readonly timestamp: number;
  public readonly metadata: ErrorMetadata;

  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error,
    metadata?: Partial<ErrorMetadata>
  ) {
    super(message);
    this.name = 'AudioError';
    this.timestamp = Date.now();
    this.metadata = {
      timestamp: this.timestamp,
      ...metadata
    };

    // Preserve stack trace
    if (originalError?.stack) {
      this.stack = originalError.stack;
    }
  }

  /**
   * Convert technical error to user-friendly message
   */
  toUserMessage(): string {
    switch (this.code) {
      case 'AUDIO_CONTEXT_FAILED':
        return 'Unable to initialize audio. Please check your browser settings and try again.';
      case 'AUDIO_NOT_SUPPORTED':
        return 'Your browser does not support the required audio features. Please try a different browser.';
      case 'AUDIO_PERMISSION_DENIED':
        return 'Audio access was denied. Please allow audio permissions and refresh the page.';
      case 'AUDIO_INITIALIZATION_FAILED':
        return 'Failed to start audio system. Please refresh the page and try again.';
      case 'AUDIO_CONTEXT_SUSPENDED':
        return 'Audio playback requires user interaction. Please click to continue.';
      case 'SAMPLE_LOAD_FAILED':
        return 'Failed to load audio samples. Please check your internet connection.';
      case 'PLUGIN_LOAD_FAILED':
        return 'Failed to load audio plugin. Some features may be unavailable.';
      case 'TRANSPORT_ERROR':
        return 'Playback error occurred. Please try restarting playback.';
      case 'MEMORY_LIMIT_EXCEEDED':
        return 'Memory limit exceeded. Please reload the page to continue.';
      case 'NETWORK_ERROR':
        return 'Network connection issue. Please check your internet and try again.';
      default:
        return 'An audio error occurred. Please try again or contact support if the problem persists.';
    }
  }

  /**
   * Get error severity level
   */
  getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.code) {
      case 'AUDIO_CONTEXT_FAILED':
      case 'AUDIO_NOT_SUPPORTED':
      case 'AUDIO_INITIALIZATION_FAILED':
        return 'critical';
      case 'MEMORY_LIMIT_EXCEEDED':
      case 'TRANSPORT_ERROR':
        return 'high';
      case 'SAMPLE_LOAD_FAILED':
      case 'PLUGIN_LOAD_FAILED':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    return [
      'AUDIO_CONTEXT_SUSPENDED',
      'SAMPLE_LOAD_FAILED',
      'PLUGIN_LOAD_FAILED',
      'TRANSPORT_ERROR',
      'NETWORK_ERROR'
    ].includes(this.code);
  }
}

/**
 * Audio initialization error
 */
export class AudioInitializationError extends AudioError {
  constructor(message: string, originalError?: Error, metadata?: Partial<ErrorMetadata>) {
    super(message, 'AUDIO_INITIALIZATION_FAILED', originalError, metadata);
    this.name = 'AudioInitializationError';
  }
}

/**
 * AudioContext specific error
 */
export class AudioContextError extends AudioError {
  constructor(message: string, originalError?: Error, metadata?: Partial<ErrorMetadata>) {
    super(message, 'AUDIO_CONTEXT_FAILED', originalError, metadata);
    this.name = 'AudioContextError';
  }
}

/**
 * Audio not supported error
 */
export class AudioNotSupportedError extends AudioError {
  constructor(message: string, metadata?: Partial<ErrorMetadata>) {
    super(message, 'AUDIO_NOT_SUPPORTED', undefined, metadata);
    this.name = 'AudioNotSupportedError';
  }
}

/**
 * Audio permission error
 */
export class AudioPermissionError extends AudioError {
  constructor(message: string, metadata?: Partial<ErrorMetadata>) {
    super(message, 'AUDIO_PERMISSION_DENIED', undefined, metadata);
    this.name = 'AudioPermissionError';
  }
}

/**
 * Audio context suspended error
 */
export class AudioContextSuspendedError extends AudioError {
  constructor(message: string, metadata?: Partial<ErrorMetadata>) {
    super(message, 'AUDIO_CONTEXT_SUSPENDED', undefined, metadata);
    this.name = 'AudioContextSuspendedError';
  }
}

/**
 * Sample loading error
 */
export class SampleLoadError extends AudioError {
  constructor(message: string, originalError?: Error, metadata?: Partial<ErrorMetadata>) {
    super(message, 'SAMPLE_LOAD_FAILED', originalError, metadata);
    this.name = 'SampleLoadError';
  }
}

/**
 * Plugin loading error
 */
export class PluginLoadError extends AudioError {
  constructor(message: string, originalError?: Error, metadata?: Partial<ErrorMetadata>) {
    super(message, 'PLUGIN_LOAD_FAILED', originalError, metadata);
    this.name = 'PluginLoadError';
  }
}

/**
 * Transport operation error
 */
export class TransportError extends AudioError {
  constructor(message: string, originalError?: Error, metadata?: Partial<ErrorMetadata>) {
    super(message, 'TRANSPORT_ERROR', originalError, metadata);
    this.name = 'TransportError';
  }
}

/**
 * Memory limit error
 */
export class MemoryLimitError extends AudioError {
  constructor(message: string, metadata?: Partial<ErrorMetadata>) {
    super(message, 'MEMORY_LIMIT_EXCEEDED', undefined, metadata);
    this.name = 'MemoryLimitError';
  }
}

/**
 * Network error
 */
export class NetworkError extends AudioError {
  constructor(message: string, originalError?: Error, metadata?: Partial<ErrorMetadata>) {
    super(message, 'NETWORK_ERROR', originalError, metadata);
    this.name = 'NetworkError';
  }
}

/**
 * Audio validation error
 */
export class AudioValidationError extends AudioError {
  constructor(message: string, metadata?: Partial<ErrorMetadata>) {
    super(message, 'AUDIO_VALIDATION_FAILED', undefined, metadata);
    this.name = 'AudioValidationError';
  }
}