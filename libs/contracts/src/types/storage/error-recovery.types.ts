/**
 * Error Handling and Recovery Types
 * Comprehensive error handling with circuit breakers and automatic recovery.
 * Story 2.4 Subtask 1.4
 *
 * @module storage/error-recovery
 */

import type {
  ErrorSeverity,
  ErrorCategory,
  DegradationLevel,
} from './base.types.js';

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Error types for classification
 */
export type ErrorType =
  | 'network_error'
  | 'authentication_error'
  | 'authorization_error'
  | 'rate_limit_error'
  | 'server_error'
  | 'client_error'
  | 'timeout_error'
  | 'circuit_breaker_error'
  | 'validation_error'
  | 'storage_error'
  | 'unknown_error';

/**
 * Recovery strategy types
 */
export type RecoveryStrategyType =
  | 'retry'
  | 'fallback'
  | 'circuit_breaker'
  | 'graceful_degradation'
  | 'fail_fast'
  | 'cache_fallback'
  | 'manual_intervention';

// ============================================================================
// Retry Configuration
// ============================================================================

/**
 * Retry budget management
 */
export interface RetryBudget {
  maxRetriesPerMinute: number;
  maxRetriesPerHour: number;
  budgetResetInterval: number;
  currentBudget: number;
  budgetExhaustedAction: 'fail' | 'queue' | 'degrade';
}

/**
 * Advanced retry policy configuration
 */
export interface RetryPolicy {
  strategy: 'exponential' | 'linear' | 'fixed' | 'custom';
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterEnabled: boolean;
  jitterMaxMs: number;
  retryBudget: RetryBudget;
  contextAwareRetries: boolean;
  errorTypeSpecificPolicies: Record<string, Partial<RetryPolicy>>;
}

// ============================================================================
// Circuit Breaker Configuration
// ============================================================================

/**
 * Enhanced circuit breaker configuration
 */
export interface EnhancedCircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenMaxCalls: number;
  halfOpenSuccessThreshold: number;
  errorTypeWeights: Record<string, number>;
  healthCheckInterval: number;
  automaticRecoveryEnabled: boolean;
  degradationMode: 'fail_fast' | 'fallback' | 'cache_only';
}

// ============================================================================
// Health Check Configuration
// ============================================================================

/**
 * Health check endpoint
 */
export interface HealthCheckEndpoint {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  expectedStatus: number;
  timeout: number;
  weight: number;
}

/**
 * Custom health check function
 */
export interface CustomHealthCheck {
  name: string;
  checkFunction: () => Promise<boolean>;
  weight: number;
  timeout: number;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  endpoints: HealthCheckEndpoint[];
  customHealthChecks: CustomHealthCheck[];
}

// ============================================================================
// Error Recovery Configuration
// ============================================================================

/**
 * Error recovery configuration
 */
export interface ErrorRecoveryConfig {
  enabled: boolean;
  maxRetryAttempts: number;
  retryPolicy: RetryPolicy;
  circuitBreakerConfig: EnhancedCircuitBreakerConfig;
  healthCheckConfig: HealthCheckConfig;
  errorClassificationEnabled: boolean;
  automaticRecoveryEnabled: boolean;
  gracefulDegradationEnabled: boolean;
  errorAnalyticsEnabled: boolean;
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Fallback options for recovery
 */
export interface FallbackOption {
  type: 'cache' | 'backup_service' | 'default_value' | 'alternative_endpoint';
  priority: number;
  configuration: Record<string, unknown>;
  healthCheck?: () => Promise<boolean>;
}

/**
 * Recovery strategies
 */
export interface RecoveryStrategy {
  strategy: RecoveryStrategyType;
  fallbackOptions: FallbackOption[];
  degradationLevel: DegradationLevel;
  automaticRecovery: boolean;
  userNotificationRequired: boolean;
  dataIntegrityChecks: boolean;
}

/**
 * Error classification system
 */
export interface ErrorClassification {
  errorType: ErrorType;
  severity: ErrorSeverity;
  category: ErrorCategory;
  isRetryable: boolean;
  isTransient: boolean;
  requiresUserAction: boolean;
  recoveryStrategy: RecoveryStrategy;
  userMessage: string;
  technicalMessage: string;
}

// ============================================================================
// Error Analytics
// ============================================================================

/**
 * Error pattern detection
 */
export interface ErrorPattern {
  patternId: string;
  description: string;
  frequency: number;
  severity: ErrorSeverity;
  suggestedAction: string;
  autoFixAvailable: boolean;
  lastOccurrence: number;
}

/**
 * Error analytics and monitoring
 */
export interface ErrorAnalytics {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  circuitBreakerActivations: number;
  retryBudgetExhaustions: number;
  lastErrorTime: number;
  errorPatterns: ErrorPattern[];
  healthScore: number;
}

/**
 * Recovery operation result
 */
export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategyType;
  attemptsUsed: number;
  timeTaken: number;
  fallbackUsed?: FallbackOption;
  degradationLevel: DegradationLevel;
  errorDetails?: ErrorClassification;
  nextAction?: string;
}

// ============================================================================
// Health Status
// ============================================================================

/**
 * Health trend analysis
 */
export interface HealthTrend {
  component: string;
  metric: string;
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number;
  prediction: string;
}

/**
 * Component health status
 */
export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number;
  lastCheck: number;
  errorCount: number;
  responseTime: number;
  details: Record<string, unknown>;
}

/**
 * Health status with detailed information
 */
export interface DetailedHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  score: number; // 0-100
  components: ComponentHealth[];
  lastCheck: number;
  nextCheck: number;
  trends: HealthTrend[];
  recommendations: string[];
}
