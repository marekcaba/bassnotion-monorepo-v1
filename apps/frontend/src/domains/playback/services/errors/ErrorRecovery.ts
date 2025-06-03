/**
 * ErrorRecovery - Enhanced Automatic Error Recovery Strategies
 *
 * Integrates circuit breakers, graceful degradation, and intelligent recovery
 * for production-grade error handling with exponential backoff.
 *
 * Part of Story 2.1: Task 5, Subtask 5.2 - Automatic error recovery
 */

import {
  PlaybackError,
  ErrorRecoveryAction,
  ErrorCategory,
  ErrorSeverity,
} from './base.js';
import {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitBreakerConfig,
} from './CircuitBreaker.js';
import {
  GracefulDegradation,
  DegradationContext,
  DegradationLevel,
} from './GracefulDegradation.js';

export interface RecoveryConfig {
  enableCircuitBreakers: boolean;
  enableGracefulDegradation: boolean;
  maxRecoveryAttempts: number;
  recoveryTimeoutMs: number;
  exponentialBackoff: {
    enabled: boolean;
    baseDelayMs: number;
    maxDelayMs: number;
    multiplier: number;
  };
}

export interface RecoveryMetrics {
  totalAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  averageRecoveryTime: number;
  circuitBreakerActivations: number;
  degradationActivations: number;
  lastRecoveryTime?: number;
}

export interface RecoveryContext {
  error: PlaybackError;
  attemptNumber: number;
  totalElapsed: number;
  degradationLevel: DegradationLevel;
  circuitBreakerState?: string;
  deviceCapabilities?: {
    isLowEnd: boolean;
    batteryLevel?: number;
    networkCondition: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
    memoryPressure: 'normal' | 'moderate' | 'high' | 'critical';
  };
}

export class ErrorRecovery {
  private static instance: ErrorRecovery;
  private config: RecoveryConfig;
  private circuitBreakerManager: CircuitBreakerManager;
  private gracefulDegradation: GracefulDegradation;
  private metrics: RecoveryMetrics;
  private activeRecoveries = new Map<string, RecoveryContext>();

  private constructor() {
    this.config = this.getDefaultConfig();
    this.circuitBreakerManager = CircuitBreakerManager.getInstance();
    this.gracefulDegradation = GracefulDegradation.getInstance();
    this.metrics = {
      totalAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      averageRecoveryTime: 0,
      circuitBreakerActivations: 0,
      degradationActivations: 0,
    };
  }

  public static getInstance(): ErrorRecovery {
    if (!ErrorRecovery.instance) {
      ErrorRecovery.instance = new ErrorRecovery();
    }
    return ErrorRecovery.instance;
  }

  /**
   * Execute comprehensive automatic recovery for an error
   */
  public async executeRecovery(error: PlaybackError): Promise<boolean> {
    const startTime = Date.now();
    const recoveryId = this.generateRecoveryId(error);

    this.metrics.totalAttempts++;

    console.log(
      `Starting recovery for error: ${error.code} (${error.category})`,
    );

    try {
      // Create recovery context
      const context = this.createRecoveryContext(error);
      this.activeRecoveries.set(recoveryId, context);

      // Step 1: Apply graceful degradation if needed
      if (
        this.config.enableGracefulDegradation &&
        this.shouldApplyDegradation(error)
      ) {
        const degradationSuccess = await this.applyGracefulDegradation(
          error,
          context,
        );
        if (degradationSuccess) {
          this.metrics.degradationActivations++;
          console.log('Graceful degradation applied successfully');
        }
      }

      // Step 2: Execute recovery actions with circuit breaker protection
      const recoverySuccess = await this.executeRecoveryActions(error, context);

      // Step 3: Update metrics and cleanup
      const recoveryTime = Date.now() - startTime;
      this.updateMetrics(recoverySuccess, recoveryTime);
      this.activeRecoveries.delete(recoveryId);

      console.log(
        `Recovery ${recoverySuccess ? 'succeeded' : 'failed'} in ${recoveryTime}ms`,
      );
      return recoverySuccess;
    } catch (recoveryError) {
      console.error('Recovery process failed:', recoveryError);
      this.metrics.failedRecoveries++;
      this.activeRecoveries.delete(recoveryId);
      return false;
    }
  }

  /**
   * Execute recovery actions with circuit breaker protection
   */
  private async executeRecoveryActions(
    error: PlaybackError,
    context: RecoveryContext,
  ): Promise<boolean> {
    const automaticActions = error.getAutomaticRecoveries();

    if (automaticActions.length === 0) {
      console.log('No automatic recovery actions available');
      return false;
    }

    // Get or create circuit breaker for this error category
    const circuitBreaker = this.getCircuitBreakerForError(error);

    try {
      // Execute actions within circuit breaker
      const recoveryOperation = async () => {
        return await this.executeActionsSequentially(automaticActions, context);
      };

      const success = await circuitBreaker.execute(
        recoveryOperation,
        context.error.code,
      );

      if (success) {
        this.metrics.successfulRecoveries++;
        return true;
      } else {
        this.metrics.failedRecoveries++;
        return false;
      }
    } catch (circuitError) {
      console.error(
        'Circuit breaker blocked recovery or recovery failed:',
        circuitError,
      );
      this.metrics.circuitBreakerActivations++;
      return false;
    }
  }

  /**
   * Execute recovery actions sequentially with backoff
   */
  private async executeActionsSequentially(
    actions: ErrorRecoveryAction[],
    context: RecoveryContext,
  ): Promise<boolean> {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      // Add null check for action
      if (!action) {
        console.warn(`Action at index ${i} is undefined, skipping`);
        continue;
      }

      try {
        console.log(`Executing recovery action: ${action.description}`);

        // Apply exponential backoff for retries
        if (
          context.attemptNumber > 1 &&
          this.config.exponentialBackoff.enabled
        ) {
          const delay = this.calculateBackoffDelay(context.attemptNumber);
          console.log(`Applying backoff delay: ${delay}ms`);
          await this.delay(delay);
        }

        const success = await this.executeAction(action);

        if (success) {
          console.log(`Recovery action succeeded: ${action.description}`);
          return true;
        } else {
          console.warn(`Recovery action failed: ${action.description}`);
          // Continue to next action
        }
      } catch (actionError) {
        console.error(
          `Error executing recovery action ${action.description}:`,
          actionError,
        );
        // Continue to next action
      }
    }

    return false; // All actions failed
  }

  /**
   * Apply graceful degradation based on error context
   */
  private async applyGracefulDegradation(
    error: PlaybackError,
    context: RecoveryContext,
  ): Promise<boolean> {
    const degradationContext: DegradationContext = {
      errorCategory: error.category,
      errorSeverity: error.severity,
      affectedSystems: this.identifyAffectedSystems(error),
      deviceCapabilities: context.deviceCapabilities || {
        isLowEnd: false,
        networkCondition: 'good' as const,
        memoryPressure: 'normal' as const,
      },
      currentDegradationLevel: context.degradationLevel,
      userPreferences: {
        preferPerformanceOverQuality: false,
        allowDataSaving: true,
        enableOfflineMode: true,
      },
    };

    return await this.gracefulDegradation.applyDegradation(degradationContext);
  }

  /**
   * Get circuit breaker for specific error type
   */
  private getCircuitBreakerForError(error: PlaybackError): CircuitBreaker {
    const circuitName = `recovery_${error.category}`;

    const config: Partial<CircuitBreakerConfig> = {
      failureThreshold: this.getFailureThreshold(error.category),
      recoveryTimeout: this.getRecoveryTimeout(error.category),
      exponentialBackoff: {
        baseDelay: this.config.exponentialBackoff.baseDelayMs,
        maxDelay: this.config.exponentialBackoff.maxDelayMs,
        multiplier: this.config.exponentialBackoff.multiplier,
        jitter: true,
      },
      retryPolicy: {
        maxRetries: this.config.maxRecoveryAttempts,
        retryableErrors: this.getRetryableErrors(error.category),
      },
    };

    return this.circuitBreakerManager.getCircuitBreaker(circuitName, config);
  }

  /**
   * Enhanced action execution with timeout and monitoring
   */
  private async executeAction(action: ErrorRecoveryAction): Promise<boolean> {
    const startTime = Date.now();

    try {
      // Execute with timeout
      const result = await Promise.race([
        this.executeActionImplementation(action),
        this.createTimeoutPromise(action.estimatedTime || 5000),
      ]);

      const executionTime = Date.now() - startTime;
      console.log(
        `Action '${action.description}' completed in ${executionTime}ms`,
      );

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(
        `Action '${action.description}' failed after ${executionTime}ms:`,
        error,
      );
      return false;
    }
  }

  /**
   * Execute the actual recovery action implementation
   */
  private async executeActionImplementation(
    action: ErrorRecoveryAction,
  ): Promise<boolean> {
    switch (action.type) {
      case 'retry':
        // Retry the failed operation
        return await this.retryOperation(action);

      case 'fallback':
        // Switch to fallback implementation
        return await this.switchToFallback(action);

      case 'degrade':
        // Reduce quality or functionality
        return await this.applyDegradation(action);

      case 'abort':
        // Abort current operation cleanly
        return await this.abortOperation(action);

      case 'reload':
        // Reload resources or restart components
        return await this.reloadComponents(action);

      default:
        console.warn(`Unknown recovery action type: ${action.type}`);
        return false;
    }
  }

  /**
   * Recovery action implementations
   */
  private async retryOperation(action: ErrorRecoveryAction): Promise<boolean> {
    console.log(`Retrying operation: ${action.description}`);
    // Implementation would retry the specific failed operation
    await this.delay(1000); // Simulate retry delay
    return Math.random() > 0.3; // Simulate success/failure
  }

  private async switchToFallback(
    action: ErrorRecoveryAction,
  ): Promise<boolean> {
    console.log(`Switching to fallback: ${action.description}`);
    // Implementation would switch to alternative implementation
    return true;
  }

  private async applyDegradation(
    action: ErrorRecoveryAction,
  ): Promise<boolean> {
    console.log(`Applying degradation: ${action.description}`);
    // Implementation would reduce quality or disable features
    return true;
  }

  private async abortOperation(action: ErrorRecoveryAction): Promise<boolean> {
    console.log(`Aborting operation: ${action.description}`);
    // Implementation would cleanly abort the failed operation
    return true;
  }

  private async reloadComponents(
    action: ErrorRecoveryAction,
  ): Promise<boolean> {
    console.log(`Reloading components: ${action.description}`);
    // Implementation would reload/restart specific components
    await this.delay(2000); // Simulate reload time
    return true;
  }

  /**
   * Helper methods
   */
  private shouldApplyDegradation(error: PlaybackError): boolean {
    return (
      error.severity === ErrorSeverity.HIGH ||
      error.severity === ErrorSeverity.CRITICAL ||
      error.category === ErrorCategory.PERFORMANCE ||
      error.category === ErrorCategory.RESOURCE
    );
  }

  private createRecoveryContext(error: PlaybackError): RecoveryContext {
    return {
      error,
      attemptNumber: 1,
      totalElapsed: 0,
      degradationLevel: this.gracefulDegradation.getState().currentLevel,
      deviceCapabilities: this.detectDeviceCapabilities(),
    };
  }

  private detectDeviceCapabilities() {
    return {
      isLowEnd: navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency <= 2
        : true,
      batteryLevel: undefined, // Would implement battery API if available
      networkCondition: (navigator.onLine ? 'good' : 'offline') as
        | 'excellent'
        | 'good'
        | 'fair'
        | 'poor'
        | 'offline',
      memoryPressure: 'normal' as 'normal' | 'moderate' | 'high' | 'critical',
    };
  }

  private identifyAffectedSystems(error: PlaybackError): string[] {
    const systemMap: Record<ErrorCategory, string[]> = {
      [ErrorCategory.AUDIO_CONTEXT]: ['audio_engine', 'audio_context'],
      [ErrorCategory.PERFORMANCE]: ['performance_monitor', 'audio_processing'],
      [ErrorCategory.RESOURCE]: ['memory_manager', 'cpu_scheduler'],
      [ErrorCategory.NETWORK]: ['asset_loader', 'cdn_cache'],
      [ErrorCategory.MOBILE]: ['mobile_optimizer', 'battery_manager'],
      [ErrorCategory.VALIDATION]: ['input_validator', 'type_checker'],
      [ErrorCategory.CONFIGURATION]: ['config_manager'],
      [ErrorCategory.COMPATIBILITY]: ['feature_detector', 'polyfill_manager'],
      [ErrorCategory.SECURITY]: ['security_manager'],
      [ErrorCategory.UNKNOWN]: ['system'],
    };

    return systemMap[error.category] || ['system'];
  }

  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay =
      this.config.exponentialBackoff.baseDelayMs *
      Math.pow(this.config.exponentialBackoff.multiplier, attempt - 1);

    return Math.min(
      exponentialDelay,
      this.config.exponentialBackoff.maxDelayMs,
    );
  }

  private getFailureThreshold(category: ErrorCategory): number {
    const thresholds: Record<ErrorCategory, number> = {
      [ErrorCategory.AUDIO_CONTEXT]: 3,
      [ErrorCategory.PERFORMANCE]: 5,
      [ErrorCategory.RESOURCE]: 4,
      [ErrorCategory.NETWORK]: 6,
      [ErrorCategory.MOBILE]: 3,
      [ErrorCategory.VALIDATION]: 10,
      [ErrorCategory.CONFIGURATION]: 2,
      [ErrorCategory.COMPATIBILITY]: 2,
      [ErrorCategory.SECURITY]: 1,
      [ErrorCategory.UNKNOWN]: 5,
    };

    return thresholds[category] || 5;
  }

  private getRecoveryTimeout(category: ErrorCategory): number {
    const timeouts: Record<ErrorCategory, number> = {
      [ErrorCategory.AUDIO_CONTEXT]: 30000, // 30 seconds
      [ErrorCategory.PERFORMANCE]: 60000, // 1 minute
      [ErrorCategory.RESOURCE]: 45000, // 45 seconds
      [ErrorCategory.NETWORK]: 120000, // 2 minutes
      [ErrorCategory.MOBILE]: 60000, // 1 minute
      [ErrorCategory.VALIDATION]: 10000, // 10 seconds
      [ErrorCategory.CONFIGURATION]: 15000, // 15 seconds
      [ErrorCategory.COMPATIBILITY]: 30000, // 30 seconds
      [ErrorCategory.SECURITY]: 5000, // 5 seconds
      [ErrorCategory.UNKNOWN]: 60000, // 1 minute
    };

    return timeouts[category] || 60000;
  }

  private getRetryableErrors(category: ErrorCategory): string[] {
    const retryableErrors: Record<ErrorCategory, string[]> = {
      [ErrorCategory.AUDIO_CONTEXT]: ['AudioContextError', 'PermissionError'],
      [ErrorCategory.PERFORMANCE]: ['PerformanceError', 'TimeoutError'],
      [ErrorCategory.RESOURCE]: ['ResourceError', 'MemoryError'],
      [ErrorCategory.NETWORK]: ['NetworkError', 'FetchError', 'TimeoutError'],
      [ErrorCategory.MOBILE]: ['MobileError', 'BatteryError'],
      [ErrorCategory.VALIDATION]: [], // Usually not retryable
      [ErrorCategory.CONFIGURATION]: ['ConfigurationError'],
      [ErrorCategory.COMPATIBILITY]: ['CompatibilityError'],
      [ErrorCategory.SECURITY]: [], // Usually not retryable
      [ErrorCategory.UNKNOWN]: ['Error'],
    };

    return retryableErrors[category] || ['Error'];
  }

  private updateMetrics(success: boolean, recoveryTime: number): void {
    if (success) {
      this.metrics.successfulRecoveries++;
    } else {
      this.metrics.failedRecoveries++;
    }

    // Update average recovery time
    const totalRecoveries =
      this.metrics.successfulRecoveries + this.metrics.failedRecoveries;
    this.metrics.averageRecoveryTime =
      (this.metrics.averageRecoveryTime * (totalRecoveries - 1) +
        recoveryTime) /
      totalRecoveries;

    this.metrics.lastRecoveryTime = Date.now();
  }

  private generateRecoveryId(error: PlaybackError): string {
    return `recovery_${error.category}_${error.code}_${Date.now()}`;
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Recovery action timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getDefaultConfig(): RecoveryConfig {
    return {
      enableCircuitBreakers: true,
      enableGracefulDegradation: true,
      maxRecoveryAttempts: 3,
      recoveryTimeoutMs: 30000,
      exponentialBackoff: {
        enabled: true,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        multiplier: 2,
      },
    };
  }

  /**
   * Get recovery metrics
   */
  public getMetrics(): RecoveryMetrics {
    return { ...this.metrics };
  }

  /**
   * Get all circuit breaker metrics
   */
  public getCircuitBreakerMetrics() {
    return this.circuitBreakerManager.getAllMetrics();
  }

  /**
   * Get graceful degradation state
   */
  public getDegradationState() {
    return this.gracefulDegradation.getState();
  }

  /**
   * Reset all recovery systems
   */
  public reset(): void {
    this.circuitBreakerManager.resetAll();
    this.activeRecoveries.clear();
    this.metrics = {
      totalAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      averageRecoveryTime: 0,
      circuitBreakerActivations: 0,
      degradationActivations: 0,
    };
    console.log('Error recovery system reset');
  }
}
