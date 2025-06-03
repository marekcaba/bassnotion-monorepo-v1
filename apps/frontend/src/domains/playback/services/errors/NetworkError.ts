/**
 * NetworkError - Specialized errors for network and connectivity issues
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

export enum NetworkErrorCode {
  CONNECTION_LOST = 'NETWORK_CONNECTION_LOST',
  TIMEOUT = 'NETWORK_TIMEOUT',
  ASSET_LOAD_FAILED = 'NETWORK_ASSET_LOAD_FAILED',
  CDN_UNAVAILABLE = 'NETWORK_CDN_UNAVAILABLE',
}

export class NetworkError extends PlaybackError {
  constructor(
    code: NetworkErrorCode,
    message: string,
    context: Partial<ErrorContext> = {},
    cause?: Error,
  ) {
    const errorDetails: ErrorDetails = {
      code,
      message,
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.NETWORK,
      context: createErrorContext(context),
      recoveryActions: [
        {
          type: 'retry',
          description: 'Retry network operation',
          automatic: true,
          priority: 8,
          estimatedTime: 2000,
        },
      ],
      userMessage:
        'Network connection issue. Please check your internet connection.',
      technicalMessage: `${code}: ${message}`,
    };

    super(errorDetails, cause);
    this.name = 'NetworkError';
  }
}

export function createNetworkError(
  code: NetworkErrorCode,
  message: string,
  additionalContext: Partial<ErrorContext> = {},
  cause?: Error,
): NetworkError {
  return new NetworkError(code, message, additionalContext, cause);
}
