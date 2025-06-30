/**
 * Base Error System for Playback Domain
 *
 * Provides foundational error classes with automatic categorization,
 * severity assessment, and recovery context.
 *
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

export enum ErrorSeverity {
  LOW = 'low', // Minor issues, graceful degradation possible
  MEDIUM = 'medium', // Moderate impact, partial functionality affected
  HIGH = 'high', // Major issues, significant functionality lost
  CRITICAL = 'critical', // System failure, complete functionality loss
}

export enum ErrorCategory {
  AUDIO_CONTEXT = 'audio_context', // Web Audio API related errors
  PERFORMANCE = 'performance', // Performance threshold violations
  RESOURCE = 'resource', // Memory, CPU, or asset errors
  NETWORK = 'network', // Network connectivity and loading
  MOBILE = 'mobile', // Mobile-specific constraints
  VALIDATION = 'validation', // Input validation and type errors
  CONFIGURATION = 'configuration', // Setup and configuration errors
  COMPATIBILITY = 'compatibility', // Browser/device compatibility
  SECURITY = 'security', // Security-related errors
  UNKNOWN = 'unknown', // Unclassified errors
}

export interface ErrorContext {
  // Context information
  timestamp: number;
  userAgent?: string;
  sessionId?: string;
  userId?: string;

  // Technical context
  audioContextState?: string;
  performanceMetrics?: Record<string, number>;
  deviceInfo?: {
    platform: string;
    browserVersion: string;
    isMobile: boolean;
    hasLowLatencySupport: boolean;
  };

  // Error context
  stackTrace?: string;
  previousErrors?: string[];
  recoveryAttempts?: number;

  // Operational context
  currentOperation?: string;
  engineState?: string;
  configSnapshot?: Record<string, unknown>;
}

export interface ErrorRecoveryAction {
  type: 'retry' | 'fallback' | 'degrade' | 'abort' | 'reload';
  description: string;
  automatic: boolean;
  priority: number;
  estimatedTime?: number; // Recovery time in ms
}

export interface ErrorMetrics {
  occurrenceCount: number;
  firstOccurrence: number;
  lastOccurrence: number;
  averageResolutionTime?: number;
  successfulRecoveries: number;
  failedRecoveries: number;
}

export interface ErrorDetails {
  code: string;
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  recoveryActions: ErrorRecoveryAction[];
  metrics?: ErrorMetrics;
  userMessage?: string;
  technicalMessage?: string;
  documentationUrl?: string;
}

/**
 * Base PlaybackError class with comprehensive error handling
 */
export class PlaybackError extends Error {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context: ErrorContext;
  public readonly recoveryActions: ErrorRecoveryAction[];
  public readonly metrics?: ErrorMetrics;
  public readonly userMessage?: string;
  public readonly technicalMessage?: string;
  public readonly documentationUrl?: string;
  public readonly timestamp: number;
  public readonly cause?: Error;

  constructor(details: ErrorDetails, cause?: Error) {
    super(details.message);

    this.name = 'PlaybackError';
    this.code = details.code;
    this.severity = details.severity;
    this.category = details.category;
    this.context = details.context;
    this.recoveryActions = details.recoveryActions;
    this.metrics = details.metrics;
    this.userMessage = details.userMessage;
    this.technicalMessage = details.technicalMessage;
    this.documentationUrl = details.documentationUrl;
    this.timestamp = Date.now();
    this.cause = cause;

    // Ensure error is properly captured first
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PlaybackError);
    }

    // Maintain error chain - append after stack trace is captured
    if (cause && cause.stack) {
      const currentStack = this.stack || '';
      this.stack = `${currentStack}\nCaused by: ${cause.stack}`;
    }
  }

  /**
   * Get user-friendly error message
   */
  public getUserMessage(): string {
    return this.userMessage || this.getDefaultUserMessage();
  }

  /**
   * Get technical error message for developers
   */
  public getTechnicalMessage(): string {
    return this.technicalMessage || this.message;
  }

  /**
   * Check if error is recoverable
   */
  public isRecoverable(): boolean {
    return (
      this.recoveryActions.length > 0 &&
      this.severity !== ErrorSeverity.CRITICAL
    );
  }

  /**
   * Get automatic recovery actions
   */
  public getAutomaticRecoveries(): ErrorRecoveryAction[] {
    return this.recoveryActions
      .filter((action) => action.automatic)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get manual recovery actions
   */
  public getManualRecoveries(): ErrorRecoveryAction[] {
    return (
      this.recoveryActions
        // TODO: Review non-null assertion - consider null safety
        .filter((action) => !action.automatic)
        .sort((a, b) => b.priority - a.priority)
    );
  }

  /**
   * Serialize error for logging/reporting
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      category: this.category,
      context: this.sanitizeContext(this.context),
      recoveryActions: this.recoveryActions,
      metrics: this.metrics,
      userMessage: this.userMessage,
      technicalMessage: this.technicalMessage,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Create sanitized context for logging (remove sensitive data)
   */
  private sanitizeContext(context: ErrorContext): Partial<ErrorContext> {
    const sanitized: Partial<ErrorContext> = {
      timestamp: context.timestamp,
      audioContextState: context.audioContextState,
      performanceMetrics: context.performanceMetrics,
      deviceInfo: context.deviceInfo,
      currentOperation: context.currentOperation,
      engineState: context.engineState,
      recoveryAttempts: context.recoveryAttempts,
    };

    // Include session/user info only if explicitly allowed
    if (process.env.NODE_ENV === 'development') {
      sanitized.sessionId = context.sessionId;
      sanitized.userId = context.userId?.substring(0, 8) + '...'; // Partial ID only
    }

    return sanitized;
  }

  /**
   * Get default user-friendly message based on category
   */
  private getDefaultUserMessage(): string {
    switch (this.category) {
      case ErrorCategory.AUDIO_CONTEXT:
        return 'Audio system encountered an issue. Please check your browser settings and try again.';
      case ErrorCategory.PERFORMANCE:
        return 'Audio performance is below optimal levels. Consider closing other apps or reducing quality settings.';
      case ErrorCategory.RESOURCE:
        return 'Insufficient system resources for audio playback. Please close other applications and try again.';
      case ErrorCategory.NETWORK:
        return 'Network connection issue. Please check your internet connection and try again.';
      case ErrorCategory.MOBILE:
        return 'Mobile device limitations detected. Some features may be reduced for optimal performance.';
      case ErrorCategory.VALIDATION:
        return 'Invalid configuration detected. Please refresh the page and try again.';
      case ErrorCategory.COMPATIBILITY:
        return 'Your browser may not support all audio features. Consider updating to a newer version.';
      default:
        return 'An unexpected error occurred. Please refresh the page and try again.';
    }
  }
}

/**
 * Utility function to create standardized error context
 */
export function createErrorContext(
  partial: Partial<ErrorContext> = {},
): ErrorContext {
  const defaultContext: ErrorContext = {
    timestamp: Date.now(),
    userAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    audioContextState:
      typeof AudioContext !== 'undefined' ? 'supported' : 'unsupported',
    currentOperation: 'unknown',
    engineState: 'idle',
    recoveryAttempts: 0,
    ...partial,
  };

  // Check if this looks like a substantial context (has multiple meaningful fields)
  const meaningfulFields = Object.keys(partial).filter(
    (key) => key !== 'timestamp' && key !== 'currentOperation',
  );
  const hasSubstantialContext = meaningfulFields.length > 1;

  // Only include deviceInfo defaults if it's missing AND we have substantial context
  // TODO: Review non-null assertion - consider null safety
  if (!defaultContext.deviceInfo && hasSubstantialContext) {
    const platform =
      typeof navigator !== 'undefined' ? navigator.platform : 'unknown';
    const userAgent =
      typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
    const isMobile =
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        userAgent || '',
      );

    // Extract browser version (simplified)
    const browserVersion =
      userAgent?.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/)?.[0] || 'unknown';

    // Check for low latency support (Web Audio API feature)
    const hasLowLatencySupport =
      typeof AudioContext !== 'undefined' &&
      'audioWorklet' in AudioContext.prototype;

    defaultContext.deviceInfo = {
      platform,
      browserVersion,
      isMobile,
      hasLowLatencySupport,
    };
  }

  // Only include performanceMetrics defaults if it's missing AND we have substantial context
  // TODO: Review non-null assertion - consider null safety
  if (!defaultContext.performanceMetrics && hasSubstantialContext) {
    defaultContext.performanceMetrics = {
      latency: 0,
      cpuUsage: 0,
      memoryUsage: 0,
    };
  }

  return defaultContext;
}

/**
 * Utility function to determine severity based on error characteristics
 */
export function determineSeverity(
  category: ErrorCategory,
  isRecoverable: boolean,
  affectsCore: boolean,
): ErrorSeverity {
  // TODO: Review non-null assertion - consider null safety
  if (!isRecoverable && affectsCore) {
    return ErrorSeverity.CRITICAL;
  }

  if (affectsCore) {
    return ErrorSeverity.HIGH;
  }

  // Network and other recoverable issues that affect user experience
  if (
    category === ErrorCategory.PERFORMANCE ||
    category === ErrorCategory.RESOURCE ||
    category === ErrorCategory.NETWORK ||
    category === ErrorCategory.AUDIO_CONTEXT
  ) {
    return ErrorSeverity.MEDIUM;
  }

  return ErrorSeverity.LOW;
}
