/**
 * MobileError - Specialized errors for mobile device constraints
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import {
  PlaybackError,
  ErrorDetails,
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
  createErrorContext,
} from './base';

export enum MobileErrorCode {
  BATTERY_LOW = 'MOBILE_BATTERY_LOW',
  BACKGROUND_RESTRICTION = 'MOBILE_BACKGROUND_RESTRICTION',
  MEMORY_CONSTRAINT = 'MOBILE_MEMORY_CONSTRAINT',
  AUDIO_INTERRUPTION = 'MOBILE_AUDIO_INTERRUPTION',
}

export class MobileError extends PlaybackError {
  constructor(
    code: MobileErrorCode,
    message: string,
    context: Partial<ErrorContext> = {},
    cause?: Error,
  ) {
    const errorDetails: ErrorDetails = {
      code,
      message,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.MOBILE,
      context: createErrorContext(context),
      recoveryActions: [
        {
          type: 'degrade',
          description: 'Enable mobile optimization mode',
          automatic: true,
          priority: 8,
        },
      ],
      userMessage:
        'Mobile device limitation detected. Performance may be optimized.',
      technicalMessage: `${code}: ${message}`,
    };

    super(errorDetails, cause);
    this.name = 'MobileError';
  }
}

export function createMobileError(
  code: MobileErrorCode,
  message: string,
  additionalContext: Partial<ErrorContext> = {},
  cause?: Error,
): MobileError {
  return new MobileError(code, message, additionalContext, cause);
}
