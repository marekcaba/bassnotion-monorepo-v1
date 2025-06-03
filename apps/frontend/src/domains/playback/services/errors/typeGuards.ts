/**
 * Type Guards for Playback Error System
 *
 * Provides runtime type checking for specialized error classes
 * to enable safe error handling and recovery strategies.
 *
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import { PlaybackError } from './base';
import { AudioContextError } from './AudioContextError';
import { PerformanceError } from './PerformanceError';
import { ResourceError } from './ResourceError';
import { NetworkError } from './NetworkError';
import { MobileError } from './MobileError';
import { ValidationError } from './ValidationError';

/**
 * Check if error is a PlaybackError instance
 */
export function isPlaybackError(error: unknown): error is PlaybackError {
  return error instanceof PlaybackError;
}

/**
 * Check if error is an AudioContextError instance
 */
export function isAudioContextError(
  error: unknown,
): error is AudioContextError {
  return error instanceof AudioContextError;
}

/**
 * Check if error is a PerformanceError instance
 */
export function isPerformanceError(error: unknown): error is PerformanceError {
  return error instanceof PerformanceError;
}

/**
 * Check if error is a ResourceError instance
 */
export function isResourceError(error: unknown): error is ResourceError {
  return error instanceof ResourceError;
}

/**
 * Check if error is a NetworkError instance
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Check if error is a MobileError instance
 */
export function isMobileError(error: unknown): error is MobileError {
  return error instanceof MobileError;
}

/**
 * Check if error is a ValidationError instance
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Get the most specific error type for an error
 */
export function getErrorType(error: unknown): string {
  if (isAudioContextError(error)) return 'AudioContextError';
  if (isPerformanceError(error)) return 'PerformanceError';
  if (isResourceError(error)) return 'ResourceError';
  if (isNetworkError(error)) return 'NetworkError';
  if (isMobileError(error)) return 'MobileError';
  if (isValidationError(error)) return 'ValidationError';
  if (isPlaybackError(error)) return 'PlaybackError';
  if (error instanceof Error) return 'Error';
  return 'Unknown';
}
