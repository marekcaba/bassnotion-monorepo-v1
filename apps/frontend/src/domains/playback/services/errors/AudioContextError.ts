/**
 * AudioContextError - Specialized errors for Web Audio API issues
 *
 * Handles AudioContext initialization, state management, and browser
 * compatibility issues with specific recovery strategies.
 *
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import {
  PlaybackError,
  ErrorDetails,
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
  ErrorRecoveryAction,
  createErrorContext,
} from './base';

export enum AudioContextErrorCode {
  // Initialization errors
  NOT_SUPPORTED = 'AUDIO_CONTEXT_NOT_SUPPORTED',
  INITIALIZATION_FAILED = 'AUDIO_CONTEXT_INIT_FAILED',
  CONTEXT_CREATION_FAILED = 'AUDIO_CONTEXT_CREATION_FAILED',

  // State management errors
  RESUME_FAILED = 'AUDIO_CONTEXT_RESUME_FAILED',
  SUSPEND_FAILED = 'AUDIO_CONTEXT_SUSPEND_FAILED',
  CLOSE_FAILED = 'AUDIO_CONTEXT_CLOSE_FAILED',
  INVALID_STATE = 'AUDIO_CONTEXT_INVALID_STATE',

  // User gesture errors
  USER_GESTURE_REQUIRED = 'AUDIO_CONTEXT_USER_GESTURE_REQUIRED',
  GESTURE_ACTIVATION_FAILED = 'AUDIO_CONTEXT_GESTURE_ACTIVATION_FAILED',

  // Browser compatibility
  BROWSER_INCOMPATIBLE = 'AUDIO_CONTEXT_BROWSER_INCOMPATIBLE',
  FEATURE_UNSUPPORTED = 'AUDIO_CONTEXT_FEATURE_UNSUPPORTED',
  SAMPLE_RATE_UNSUPPORTED = 'AUDIO_CONTEXT_SAMPLE_RATE_UNSUPPORTED',

  // Hardware/system errors
  HARDWARE_UNAVAILABLE = 'AUDIO_CONTEXT_HARDWARE_UNAVAILABLE',
  DEVICE_PERMISSIONS = 'AUDIO_CONTEXT_DEVICE_PERMISSIONS',
  SYSTEM_OVERLOAD = 'AUDIO_CONTEXT_SYSTEM_OVERLOAD',

  // Mobile-specific errors
  MOBILE_INTERRUPTION = 'AUDIO_CONTEXT_MOBILE_INTERRUPTION',
  BACKGROUND_SUSPEND = 'AUDIO_CONTEXT_BACKGROUND_SUSPEND',
  MOBILE_LIMITATIONS = 'AUDIO_CONTEXT_MOBILE_LIMITATIONS',
}

export class AudioContextError extends PlaybackError {
  public readonly audioContextState?: string;
  public readonly browserInfo?: {
    name: string;
    version: string;
    hasWebAudioSupport: boolean;
    supportedFeatures: string[];
  };

  constructor(
    code: AudioContextErrorCode,
    message: string,
    context: Partial<ErrorContext> = {},
    cause?: Error,
  ) {
    const recoveryActions = getRecoveryActions(code);
    const severity = getSeverity(code);

    const errorDetails: ErrorDetails = {
      code,
      message,
      severity,
      category: ErrorCategory.AUDIO_CONTEXT,
      context: createErrorContext(context),
      recoveryActions,
      userMessage: getUserMessage(code),
      technicalMessage: getTechnicalMessage(code, message),
      documentationUrl: getDocumentationUrl(code),
    };

    super(errorDetails, cause);
    this.name = 'AudioContextError';

    // Extract additional context
    this.audioContextState = context.audioContextState;
    this.browserInfo = context.deviceInfo
      ? {
          name: this.extractBrowserName(context.deviceInfo.platform),
          version: context.deviceInfo.browserVersion,
          hasWebAudioSupport: this.checkWebAudioSupport(),
          supportedFeatures: this.detectSupportedFeatures(),
        }
      : undefined;
  }

  private extractBrowserName(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private checkWebAudioSupport(): boolean {
    // Check if AudioContext constructors are actually available and callable
    try {
      // Check global AudioContext
      if (typeof AudioContext !== 'undefined' && AudioContext !== null) {
        return true;
      }

      // Check global webkitAudioContext
      if (
        typeof (global as any)?.webkitAudioContext !== 'undefined' &&
        (global as any)?.webkitAudioContext !== null
      ) {
        return true;
      }

      // Check window AudioContext (only if different from global)
      if (
        typeof window !== 'undefined' &&
        (window as any)?.AudioContext !== AudioContext &&
        typeof (window as any)?.AudioContext !== 'undefined' &&
        (window as any)?.AudioContext !== null
      ) {
        return true;
      }

      // Check window webkitAudioContext (only if different from global)
      if (
        typeof window !== 'undefined' &&
        (window as any)?.webkitAudioContext !==
          (global as any)?.webkitAudioContext &&
        typeof (window as any)?.webkitAudioContext !== 'undefined' &&
        (window as any)?.webkitAudioContext !== null
      ) {
        return true;
      }
    } catch {
      // If any check throws, Web Audio is not supported
    }

    return false;
  }

  private detectSupportedFeatures(): string[] {
    const features: string[] = [];

    if (typeof AudioContext !== 'undefined') {
      features.push('AudioContext');
    }

    if (typeof AudioWorkletNode !== 'undefined') {
      features.push('AudioWorklet');
    }

    if (typeof OfflineAudioContext !== 'undefined') {
      features.push('OfflineAudioContext');
    }

    return features;
  }
}

/**
 * Helper function to get recovery actions based on error code
 */
function getRecoveryActions(
  code: AudioContextErrorCode,
): ErrorRecoveryAction[] {
  const actions: ErrorRecoveryAction[] = [];

  switch (code) {
    case AudioContextErrorCode.NOT_SUPPORTED:
      actions.push({
        type: 'fallback',
        description: 'Use legacy audio fallback',
        automatic: true,
        priority: 10,
      });
      break;

    case AudioContextErrorCode.USER_GESTURE_REQUIRED:
      actions.push({
        type: 'retry',
        description: 'Wait for user interaction and retry',
        automatic: false,
        priority: 10,
      });
      break;

    case AudioContextErrorCode.RESUME_FAILED:
      actions.push({
        type: 'retry',
        description: 'retry AudioContext resume',
        automatic: true,
        priority: 9,
        estimatedTime: 1000,
      });
      actions.push({
        type: 'fallback',
        description: 'Create new AudioContext',
        automatic: true,
        priority: 5,
        estimatedTime: 2000,
      });
      break;

    case AudioContextErrorCode.MOBILE_INTERRUPTION:
      actions.push({
        type: 'retry',
        description: 'Resume after interruption',
        automatic: true,
        priority: 8,
        estimatedTime: 500,
      });
      break;

    case AudioContextErrorCode.HARDWARE_UNAVAILABLE:
      actions.push({
        type: 'degrade',
        description: 'Switch to software audio processing',
        automatic: true,
        priority: 7,
      });
      break;

    case AudioContextErrorCode.SYSTEM_OVERLOAD:
      actions.push({
        type: 'degrade',
        description: 'Reduce audio quality and processing',
        automatic: true,
        priority: 8,
      });
      actions.push({
        type: 'retry',
        description: 'Retry with reduced buffer size',
        automatic: true,
        priority: 6,
        estimatedTime: 1500,
      });
      break;

    default:
      actions.push({
        type: 'retry',
        description: 'Generic retry with exponential backoff',
        automatic: true,
        priority: 5,
        estimatedTime: 2000,
      });
  }

  // Always add manual reload as last resort
  actions.push({
    type: 'reload',
    description: 'Reload the page to reset audio system',
    automatic: false,
    priority: 1,
  });

  return actions;
}

/**
 * Determine severity based on error code
 */
function getSeverity(code: AudioContextErrorCode): ErrorSeverity {
  const criticalErrors = [
    AudioContextErrorCode.BROWSER_INCOMPATIBLE,
    AudioContextErrorCode.HARDWARE_UNAVAILABLE,
  ];

  const highErrors = [
    AudioContextErrorCode.NOT_SUPPORTED,
    AudioContextErrorCode.INITIALIZATION_FAILED,
    AudioContextErrorCode.CONTEXT_CREATION_FAILED,
    AudioContextErrorCode.SYSTEM_OVERLOAD,
  ];

  if (criticalErrors.includes(code)) {
    return ErrorSeverity.CRITICAL;
  }

  if (highErrors.includes(code)) {
    return ErrorSeverity.HIGH;
  }

  return ErrorSeverity.MEDIUM;
}

/**
 * Get user-friendly message
 */
function getUserMessage(code: AudioContextErrorCode): string {
  switch (code) {
    case AudioContextErrorCode.NOT_SUPPORTED:
      return 'Your browser does not support advanced audio features. Please update to a newer version.';

    case AudioContextErrorCode.USER_GESTURE_REQUIRED:
      return 'Please click anywhere on the page to enable audio playback.';

    case AudioContextErrorCode.MOBILE_INTERRUPTION:
      return 'Audio was interrupted by another app. Tap to resume playback.';

    case AudioContextErrorCode.HARDWARE_UNAVAILABLE:
      return 'Audio hardware is not available. Please check your audio devices and try again.';

    case AudioContextErrorCode.SYSTEM_OVERLOAD:
      return 'Your system is under heavy load. Please close other applications and try again.';

    default:
      return 'An audio system error occurred. Please refresh the page and try again.';
  }
}

/**
 * Get technical message for developers
 */
function getTechnicalMessage(
  code: AudioContextErrorCode,
  originalMessage: string,
): string {
  return `${code}: ${originalMessage}`;
}

/**
 * Get documentation URL for error code
 */
function getDocumentationUrl(code: AudioContextErrorCode): string {
  const baseUrl = '/docs/troubleshooting/audio-context';

  switch (code) {
    case AudioContextErrorCode.NOT_SUPPORTED:
      return `${baseUrl}#browser-compatibility`;

    case AudioContextErrorCode.USER_GESTURE_REQUIRED:
      return `${baseUrl}#user-gesture-policy`;

    case AudioContextErrorCode.MOBILE_INTERRUPTION:
      return `${baseUrl}#mobile-audio-handling`;

    default:
      return `${baseUrl}#general-troubleshooting`;
  }
}

/**
 * Factory function to create AudioContextError with proper context
 */
export function createAudioContextError(
  code: AudioContextErrorCode,
  message: string,
  additionalContext: Partial<ErrorContext> = {},
  cause?: Error,
): AudioContextError {
  // Automatically detect current AudioContext state if available
  const context: Partial<ErrorContext> = {
    currentOperation: 'AudioContext management',
    ...additionalContext,
  };

  // Try to get current AudioContext state
  if (typeof window !== 'undefined' && window.AudioContext) {
    try {
      const audioContext = new AudioContext();
      context.audioContextState = audioContext.state;
      audioContext.close(); // Clean up test context
    } catch {
      // AudioContext creation failed, this info is useful for the error
      context.audioContextState = 'creation_failed';
    }
  }

  return new AudioContextError(code, message, context, cause);
}
