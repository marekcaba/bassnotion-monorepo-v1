/**
 * Playback Domain Error System - Comprehensive Error Taxonomy
 *
 * Provides specialized error classes with automatic categorization,
 * severity levels, and recovery suggestions for production-ready error handling.
 *
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

// Base error system
export { PlaybackError } from './base';
export type { ErrorSeverity, ErrorCategory, ErrorContext } from './base';

// Specialized error classes
export { AudioContextError } from './AudioContextError';
export type { AudioContextErrorCode } from './AudioContextError';
export { PerformanceError } from './PerformanceError';
export type { PerformanceErrorCode } from './PerformanceError';
export { ResourceError } from './ResourceError';
export type { ResourceErrorCode } from './ResourceError';
export { NetworkError } from './NetworkError';
export type { NetworkErrorCode } from './NetworkError';
export { MobileError } from './MobileError';
export type { MobileErrorCode } from './MobileError';
export { ValidationError } from './ValidationError';
export type { ValidationErrorCode } from './ValidationError';

// Error utilities
export { ErrorClassifier } from './ErrorClassifier';
export { ErrorRecovery } from './ErrorRecovery';
export { ErrorReporter } from './ErrorReporter';
export { CircuitBreaker, CircuitBreakerManager } from './CircuitBreaker';
export { GracefulDegradation } from './GracefulDegradation';

// Error creation helpers
export { createAudioContextError } from './AudioContextError';
export { createPerformanceError } from './PerformanceError';
export { createResourceError } from './ResourceError';
export { createNetworkError } from './NetworkError';
export { createMobileError } from './MobileError';
export { createValidationError } from './ValidationError';

// Type guards
export {
  isPlaybackError,
  isAudioContextError,
  isPerformanceError,
  isResourceError,
  isNetworkError,
  isMobileError,
  isValidationError,
} from './typeGuards';

// Additional type exports for production error handling
export type {
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitState,
  RetryContext,
} from './CircuitBreaker';
export type {
  DegradationLevel,
  DegradationStrategy,
  DegradationContext,
  DegradationState,
  FeatureCategory,
} from './GracefulDegradation';
export type {
  RecoveryConfig,
  RecoveryMetrics,
  RecoveryContext,
} from './ErrorRecovery';
