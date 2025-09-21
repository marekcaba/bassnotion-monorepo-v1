/**
 * ErrorRecovery - Automatic error recovery mechanisms
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 *
 * Implements recovery strategies for various error types
 */

import { EventBus } from '../services/core/EventBus.js';
import { ErrorContext } from './ErrorHandler.js';
import {
  AudioError,
  AudioContextSuspendedError,
  SampleLoadError,
  PluginLoadError,
  TransportError,
  NetworkError,
} from './AudioErrors.js';

export interface RecoveryStrategy {
  canHandle(error: Error): boolean;
  recover(error: Error, context: ErrorContext): Promise<boolean>;
}

export interface RecoveryConfig {
  maxRecoveryAttempts?: number;
  recoveryTimeout?: number;
  strategies?: RecoveryStrategy[];
}

interface RecoveryRecord {
  errorType: string;
  attempts: number;
  lastAttempt: number;
  successful: boolean;
}

export class ErrorRecovery {
  private static instance: ErrorRecovery | null = null;
  private eventBus: EventBus;
  private config: Required<RecoveryConfig>;
  private strategies: RecoveryStrategy[] = [];
  private recoveryHistory = new Map<string, RecoveryRecord>();
  private audioEngineRef?: any;
  private transportControllerRef?: any;

  constructor(eventBus: EventBus, config: RecoveryConfig = {}) {
    this.eventBus = eventBus;
    this.config = {
      maxRecoveryAttempts: 3,
      recoveryTimeout: 5000,
      strategies: [],
      ...config,
    };

    // Initialize default strategies
    this.initializeDefaultStrategies();

    // Add custom strategies
    this.strategies.push(...this.config.strategies);
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    eventBus?: EventBus,
    config?: RecoveryConfig,
  ): ErrorRecovery {
    if (!ErrorRecovery.instance) {
      if (!eventBus) {
        // Create a default EventBus if none provided
        eventBus = new EventBus();
      }
      ErrorRecovery.instance = new ErrorRecovery(eventBus, config);
    }
    return ErrorRecovery.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  reset(): void {
    this.clearHistory();
    this.strategies = [];
    this.initializeDefaultStrategies();
    if (this.config.strategies) {
      this.strategies.push(...this.config.strategies);
    }
    this.audioEngineRef = undefined;
    this.transportControllerRef = undefined;
    ErrorRecovery.instance = null;
  }

  /**
   * Set references to core services for recovery operations
   */
  setServiceReferences(audioEngine: any, transportController: any): void {
    this.audioEngineRef = audioEngine;
    this.transportControllerRef = transportController;
  }

  /**
   * Attempt to recover from an error
   */
  async attempt(error: Error, context: ErrorContext): Promise<boolean> {
    const errorKey = this.getErrorKey(error, context);
    const record = this.getOrCreateRecord(errorKey, error);

    // Check if we've exceeded max attempts
    if (record.attempts >= this.config.maxRecoveryAttempts) {
      this.eventBus.emit('recovery:max-attempts-exceeded', {
        error,
        context,
        attempts: record.attempts,
      });
      return false;
    }

    // Update attempt count
    record.attempts++;
    record.lastAttempt = Date.now();

    try {
      // Find appropriate strategy
      const strategy = this.strategies.find((s) => s.canHandle(error));

      if (!strategy) {
        this.eventBus.emit('recovery:no-strategy', { error, context });
        return false;
      }

      // Attempt recovery with timeout
      const recovered = await this.withTimeout(
        strategy.recover(error, context),
        this.config.recoveryTimeout,
      );

      record.successful = recovered;

      if (recovered) {
        this.eventBus.emit('recovery:success', {
          error,
          context,
          strategy: strategy.constructor.name,
          attempts: record.attempts,
        });
      } else {
        this.eventBus.emit('recovery:failed', {
          error,
          context,
          strategy: strategy.constructor.name,
          attempts: record.attempts,
        });
      }

      return recovered;
    } catch (recoveryError) {
      this.eventBus.emit('recovery:error', {
        originalError: error,
        recoveryError,
        context,
      });
      return false;
    }
  }

  /**
   * Check if error can be recovered
   */
  canRecover(error: Error, context: ErrorContext): boolean {
    // Check if error is marked as recoverable
    if (error instanceof AudioError && !error.isRecoverable()) {
      return false;
    }

    // Check recovery history
    const errorKey = this.getErrorKey(error, context);
    const record = this.recoveryHistory.get(errorKey);

    if (record && record.attempts >= this.config.maxRecoveryAttempts) {
      return false;
    }

    // Check if we have a strategy for this error
    return this.strategies.some((s) => s.canHandle(error));
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeDefaultStrategies(): void {
    // AudioContext suspended recovery
    this.strategies.push({
      canHandle: (error) => error instanceof AudioContextSuspendedError,
      recover: async (error, context) => {
        if (!this.audioEngineRef) return false;

        try {
          await this.audioEngineRef.start();
          return true;
        } catch {
          return false;
        }
      },
    });

    // Sample load error recovery
    this.strategies.push({
      canHandle: (error) => error instanceof SampleLoadError,
      recover: async (error, context) => {
        // Wait and retry loading
        await this.delay(1000);

        this.eventBus.emit('recovery:retry-sample-load', {
          error,
          context,
        });

        // The actual retry should be handled by the component that failed
        return true;
      },
    });

    // Plugin load error recovery
    this.strategies.push({
      canHandle: (error) => error instanceof PluginLoadError,
      recover: async (error, context) => {
        // Try to reload the plugin
        if (context.additionalData?.pluginName) {
          this.eventBus.emit('recovery:reload-plugin', {
            pluginName: context.additionalData.pluginName,
            context,
          });
          return true;
        }
        return false;
      },
    });

    // Transport error recovery
    this.strategies.push({
      canHandle: (error) => error instanceof TransportError,
      recover: async (error, context) => {
        if (!this.transportControllerRef) return false;

        try {
          // Stop and reset transport
          await this.transportControllerRef.stop();
          await this.delay(500);

          this.eventBus.emit('recovery:transport-reset', {
            error,
            context,
          });

          return true;
        } catch {
          return false;
        }
      },
    });

    // Network error recovery
    this.strategies.push({
      canHandle: (error) => error instanceof NetworkError,
      recover: async (error, context) => {
        // Wait for network to potentially recover
        await this.delay(2000);

        // Check if we're back online
        if (navigator.onLine) {
          this.eventBus.emit('recovery:network-restored', {
            error,
            context,
          });
          return true;
        }

        return false;
      },
    });

    // Generic audio error recovery
    this.strategies.push({
      canHandle: (error) => error instanceof AudioError,
      recover: async (error, context) => {
        // Try to reinitialize audio if it's a critical error
        if (
          (error as AudioError).getSeverity() === 'critical' &&
          this.audioEngineRef
        ) {
          try {
            await this.audioEngineRef.dispose();
            await this.delay(1000);
            await this.audioEngineRef.initialize();
            return true;
          } catch {
            return false;
          }
        }
        return false;
      },
    });
  }

  /**
   * Get or create recovery record
   */
  private getOrCreateRecord(key: string, error: Error): RecoveryRecord {
    let record = this.recoveryHistory.get(key);

    if (!record) {
      record = {
        errorType: error.constructor.name,
        attempts: 0,
        lastAttempt: 0,
        successful: false,
      };
      this.recoveryHistory.set(key, record);
    }

    return record;
  }

  /**
   * Generate unique key for error
   */
  private getErrorKey(error: Error, context: ErrorContext): string {
    return `${error.constructor.name}-${context.component}-${context.operation}`;
  }

  /**
   * Execute with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeout: number,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Recovery timeout')), timeout),
      ),
    ]);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalAttempts: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    recoveryRate: number;
    byErrorType: Record<string, { attempts: number; successes: number }>;
  } {
    let totalAttempts = 0;
    let successfulRecoveries = 0;
    const byErrorType: Record<string, { attempts: number; successes: number }> =
      {};

    this.recoveryHistory.forEach((record, key) => {
      totalAttempts += record.attempts;
      if (record.successful) successfulRecoveries++;

      if (!byErrorType[record.errorType]) {
        byErrorType[record.errorType] = { attempts: 0, successes: 0 };
      }

      byErrorType[record.errorType].attempts += record.attempts;
      if (record.successful) byErrorType[record.errorType].successes++;
    });

    return {
      totalAttempts,
      successfulRecoveries,
      failedRecoveries: totalAttempts - successfulRecoveries,
      recoveryRate:
        totalAttempts > 0 ? successfulRecoveries / totalAttempts : 0,
      byErrorType,
    };
  }

  /**
   * Clear recovery history
   */
  clearHistory(): void {
    this.recoveryHistory.clear();
    this.eventBus.emit('recovery:history-cleared', { timestamp: Date.now() });
  }

  /**
   * Execute recovery (alias for attempt, for backward compatibility)
   */
  async executeRecovery(
    error: Error,
    context?: ErrorContext,
  ): Promise<boolean> {
    return this.attempt(
      error,
      context || {
        component: 'unknown',
        operation: 'unknown',
        timestamp: Date.now(),
        correlationId: 'test',
      },
    );
  }

  /**
   * Get recovery metrics
   */
  getMetrics(): any {
    const totalAttempts = Array.from(this.recoveryHistory.values()).reduce(
      (sum, record) => sum + record.attempts,
      0,
    );
    const successfulRecoveries = Array.from(
      this.recoveryHistory.values(),
    ).filter((record) => record.successful).length;
    const failedRecoveries = Array.from(this.recoveryHistory.values()).filter(
      (record) => !record.successful && record.attempts > 0,
    ).length;

    return {
      totalRecoveryAttempts: totalAttempts,
      successfulRecoveries,
      failedRecoveries,
      recoverySuccessRate:
        totalAttempts > 0 ? successfulRecoveries / totalAttempts : 0,
      totalErrors: this.recoveryHistory.size,
    };
  }

  /**
   * Get circuit breaker metrics (stub for compatibility)
   */
  getCircuitBreakerMetrics(): any {
    return {
      openCircuits: 0,
      halfOpenCircuits: 0,
      closedCircuits: 0,
    };
  }

  /**
   * Get degradation state (stub for compatibility)
   */
  getDegradationState(): any {
    return {
      isInDegradedMode: false,
      degradationLevel: 0,
      disabledFeatures: [],
    };
  }
}
