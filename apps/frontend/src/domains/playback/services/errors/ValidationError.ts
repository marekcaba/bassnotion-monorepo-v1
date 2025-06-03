/**
 * ValidationError - Specialized errors for input validation and type errors
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

export enum ValidationErrorCode {
  INVALID_PARAMETER = 'VALIDATION_INVALID_PARAMETER',
  TYPE_MISMATCH = 'VALIDATION_TYPE_MISMATCH',
  RANGE_EXCEEDED = 'VALIDATION_RANGE_EXCEEDED',
  REQUIRED_FIELD_MISSING = 'VALIDATION_REQUIRED_FIELD_MISSING',
}

export class ValidationError extends PlaybackError {
  constructor(
    code: ValidationErrorCode,
    message: string,
    context: Partial<ErrorContext> = {},
    cause?: Error,
  ) {
    const errorDetails: ErrorDetails = {
      code,
      message,
      severity: ErrorSeverity.LOW,
      category: ErrorCategory.VALIDATION,
      context: createErrorContext(context),
      recoveryActions: [
        {
          type: 'fallback',
          description: 'Use default values',
          automatic: true,
          priority: 8,
        },
      ],
      userMessage: 'Invalid configuration detected. Using default settings.',
      technicalMessage: `${code}: ${message}`,
    };

    super(errorDetails, cause);
    this.name = 'ValidationError';
  }
}

export function createValidationError(
  code: ValidationErrorCode,
  message: string,
  additionalContext: Partial<ErrorContext> = {},
  cause?: Error,
): ValidationError {
  return new ValidationError(code, message, additionalContext, cause);
}
