/**
 * Error Recovery Registry
 * Phase 5.2.2: Centralized recovery strategy registry for playback domain
 *
 * Builds upon the existing ErrorRecovery system to provide domain-specific
 * recovery strategies with priority-based selection and success metrics.
 */

import { EventBus } from '../../services/core/EventBus.js';
import {
  ErrorRecovery,
  RecoveryStrategy,
  RecoveryConfig,
} from '../../errors/ErrorRecovery.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import {
  InstrumentError,
  MidiError,
  StorageError,
  TransportError,
  InstrumentErrorCode,
  MidiErrorCode,
  StorageErrorCode,
  TransportErrorCode,
} from './index.js';

const logger = createStructuredLogger('ErrorRecoveryRegistry');

// =============================================================================
// EXTENDED ERROR INTERFACES - For accessing recovery-specific context properties
// =============================================================================

/**
 * Helper to safely extract context properties from errors
 * Since PlaybackError.context is typed as ErrorContext, additional properties
 * are stored in context and need to be accessed via type assertion.
 */
function getErrorContext<T>(error: Error): T | undefined {
  if (
    'context' in error &&
    error.context &&
    typeof error.context === 'object'
  ) {
    return error.context as T;
  }
  return undefined;
}

/** MidiError context with validation errors */
interface MidiValidationContext {
  validationErrors?: unknown[];
}

/** MidiError context with timing drift */
interface MidiTimingContext {
  drift?: number;
}

/** StorageError context with endpoint */
interface StorageConnectionContext {
  endpoint?: string;
}

/** StorageError context with requested size */
interface CacheFullContext {
  requestedSize?: number;
}

/** StorageError context with service name */
interface CircuitBreakerContext {
  serviceName?: string;
}

/** TransportError context with sample rate */
interface ClockSyncContext {
  sampleRate?: number;
}

/** TransportError context with latency info */
interface LatencyContext {
  measuredLatency?: number;
  targetLatency?: number;
}

/**
 * Extended recovery strategy with priority and metrics
 */
export interface PrioritizedRecoveryStrategy extends RecoveryStrategy {
  priority: number;
  name: string;
  successRate?: number;
  averageRecoveryTime?: number;
  lastUsed?: number;
}

/**
 * Recovery metrics for tracking strategy effectiveness
 */
interface RecoveryMetrics {
  attempts: number;
  successes: number;
  failures: number;
  totalRecoveryTime: number;
  lastAttempt?: number;
  lastSuccess?: number;
}

/**
 * Recovery strategy registry configuration
 */
export interface RecoveryRegistryConfig extends RecoveryConfig {
  enableMetrics?: boolean;
  metricsRetentionPeriod?: number; // ms
  strategySelectionMode?: 'priority' | 'adaptive' | 'round-robin';
}

/**
 * Centralized error recovery registry
 */
export class ErrorRecoveryRegistry extends ErrorRecovery {
  private strategies = new Map<string, PrioritizedRecoveryStrategy>();
  private metrics = new Map<string, RecoveryMetrics>();
  private config: RecoveryRegistryConfig;
  private selectionMode: 'priority' | 'adaptive' | 'round-robin';
  private roundRobinIndex = 0;

  constructor(eventBus: EventBus, config: RecoveryRegistryConfig = {}) {
    super(eventBus, config);

    this.config = {
      enableMetrics: true,
      metricsRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      strategySelectionMode: 'priority',
      ...config,
    };

    this.selectionMode = this.config.strategySelectionMode || 'priority';

    // Register domain-specific strategies
    this.registerInstrumentStrategies();
    this.registerMidiStrategies();
    this.registerStorageStrategies();
    this.registerTransportStrategies();

    // Start metrics cleanup if enabled
    if (this.config.enableMetrics) {
      this.startMetricsCleanup();
    }
  }

  /**
   * Register a recovery strategy with priority
   */
  registerStrategy(strategy: PrioritizedRecoveryStrategy): void {
    this.strategies.set(strategy.name, strategy);

    if (this.config.enableMetrics) {
      this.metrics.set(strategy.name, {
        attempts: 0,
        successes: 0,
        failures: 0,
        totalRecoveryTime: 0,
      });
    }

    logger.info('Registered recovery strategy', {
      name: strategy.name,
      priority: strategy.priority,
    });
  }

  /**
   * Override attempt method to use priority-based selection
   */
  async attempt(error: Error, context: any): Promise<boolean> {
    const startTime = Date.now();
    const strategy = this.selectStrategy(error);

    if (!strategy) {
      logger.warn('No recovery strategy found', {
        error: error.name,
        message: error.message,
      });
      return false;
    }

    logger.info('Attempting recovery', {
      error: error.name,
      strategy: strategy.name,
      priority: strategy.priority,
    });

    try {
      const result = await strategy.recover(error, context);

      if (this.config.enableMetrics) {
        this.updateMetrics(strategy.name, result, Date.now() - startTime);
      }

      if (result) {
        this.eventBus.emit('recovery:strategy-success', {
          error: error.name,
          strategy: strategy.name,
          recoveryTime: Date.now() - startTime,
        });
      } else {
        this.eventBus.emit('recovery:strategy-failed', {
          error: error.name,
          strategy: strategy.name,
        });
      }

      return result;
    } catch (recoveryError) {
      logger.error('Recovery strategy threw error', recoveryError as Error, {
        originalError: error.name,
        strategy: strategy.name,
      });

      if (this.config.enableMetrics) {
        this.updateMetrics(strategy.name, false, Date.now() - startTime);
      }

      return false;
    }
  }

  /**
   * Select strategy based on configured mode
   */
  private selectStrategy(error: Error): PrioritizedRecoveryStrategy | null {
    const candidates = Array.from(this.strategies.values()).filter((s) =>
      s.canHandle(error),
    );

    if (candidates.length === 0) return null;

    switch (this.selectionMode) {
      case 'adaptive':
        return this.selectAdaptiveStrategy(candidates);

      case 'round-robin':
        return this.selectRoundRobinStrategy(candidates);

      case 'priority':
      default:
        return this.selectPriorityStrategy(candidates);
    }
  }

  /**
   * Select strategy based on priority
   */
  private selectPriorityStrategy(
    candidates: PrioritizedRecoveryStrategy[],
  ): PrioritizedRecoveryStrategy {
    return candidates.sort((a, b) => b.priority - a.priority)[0];
  }

  /**
   * Select strategy based on success rate and recovery time
   */
  private selectAdaptiveStrategy(
    candidates: PrioritizedRecoveryStrategy[],
  ): PrioritizedRecoveryStrategy {
    // Calculate scores based on success rate and average recovery time
    const scored = candidates.map((strategy) => {
      const metrics = this.metrics.get(strategy.name);

      if (!metrics || metrics.attempts === 0) {
        // New strategy, give it a chance
        return { strategy, score: strategy.priority };
      }

      const successRate = metrics.successes / metrics.attempts;
      const avgRecoveryTime = metrics.totalRecoveryTime / metrics.attempts;

      // Score = priority * success rate * (1 / avg recovery time)
      // Normalize recovery time to seconds
      const score = strategy.priority * successRate * (1000 / avgRecoveryTime);

      return { strategy, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored[0].strategy;
  }

  /**
   * Select strategy using round-robin
   */
  private selectRoundRobinStrategy(
    candidates: PrioritizedRecoveryStrategy[],
  ): PrioritizedRecoveryStrategy {
    const strategy = candidates[this.roundRobinIndex % candidates.length];
    this.roundRobinIndex++;
    return strategy;
  }

  /**
   * Update strategy metrics
   */
  private updateMetrics(
    strategyName: string,
    success: boolean,
    recoveryTime: number,
  ): void {
    const metrics = this.metrics.get(strategyName);
    if (!metrics) return;

    metrics.attempts++;
    if (success) {
      metrics.successes++;
      metrics.lastSuccess = Date.now();
    } else {
      metrics.failures++;
    }
    metrics.totalRecoveryTime += recoveryTime;
    metrics.lastAttempt = Date.now();

    // Update strategy with computed metrics
    const strategy = this.strategies.get(strategyName);
    if (strategy) {
      strategy.successRate = metrics.successes / metrics.attempts;
      strategy.averageRecoveryTime =
        metrics.totalRecoveryTime / metrics.attempts;
      strategy.lastUsed = Date.now();
    }
  }

  /**
   * Register instrument-specific recovery strategies
   */
  private registerInstrumentStrategies(): void {
    // Instrument initialization recovery
    this.registerStrategy({
      name: 'instrument-init-recovery',
      priority: 10,
      canHandle: (error) =>
        error instanceof InstrumentError &&
        error.code === InstrumentErrorCode.INSTRUMENT_INIT_FAILED,
      recover: async (error, context) => {
        logger.info('Attempting instrument initialization recovery');

        // Emit event for instrument to reinitialize
        this.eventBus.emit('instrument:reinitialize', {
          instrumentType: (error as InstrumentError).instrumentType,
          instrumentId: (error as InstrumentError).instrumentId,
        });

        // Wait for initialization
        await this.delay(2000);

        return true;
      },
    });

    // Sample loading recovery
    this.registerStrategy({
      name: 'sample-loading-recovery',
      priority: 8,
      canHandle: (error) =>
        error instanceof InstrumentError &&
        error.code === InstrumentErrorCode.SAMPLE_MAPPING_FAILED,
      recover: async (error, context) => {
        logger.info('Attempting sample loading recovery');

        // Try fallback samples
        this.eventBus.emit('instrument:use-fallback-samples', {
          instrumentType: (error as InstrumentError).instrumentType,
        });

        return true;
      },
    });

    // Voice limit recovery
    this.registerStrategy({
      name: 'voice-limit-recovery',
      priority: 7,
      canHandle: (error) =>
        error instanceof InstrumentError &&
        error.code === InstrumentErrorCode.VOICE_LIMIT_EXCEEDED,
      recover: async (error, context) => {
        logger.info('Attempting voice limit recovery');

        // Request voice stealing
        this.eventBus.emit('instrument:enable-voice-stealing', {
          instrumentType: (error as InstrumentError).instrumentType,
        });

        return true;
      },
    });

    // CPU overload recovery
    this.registerStrategy({
      name: 'cpu-overload-recovery',
      priority: 9,
      canHandle: (error) =>
        error instanceof InstrumentError &&
        error.code === InstrumentErrorCode.CPU_OVERLOAD,
      recover: async (error, context) => {
        logger.info('Attempting CPU overload recovery');

        // Reduce quality settings
        this.eventBus.emit('system:reduce-quality', {
          reason: 'cpu-overload',
          targetCpuUsage: 70,
        });

        return true;
      },
    });
  }

  /**
   * Register MIDI-specific recovery strategies
   */
  private registerMidiStrategies(): void {
    // MIDI parse error recovery
    this.registerStrategy({
      name: 'midi-parse-recovery',
      priority: 6,
      canHandle: (error) =>
        error instanceof MidiError &&
        error.code === MidiErrorCode.PARSE_FAILURE,
      recover: async (error, context) => {
        logger.info('Attempting MIDI parse recovery');

        // Try with relaxed parsing rules
        this.eventBus.emit('midi:retry-with-relaxed-parsing', {
          context,
        });

        return true;
      },
    });

    // MIDI validation recovery
    this.registerStrategy({
      name: 'midi-validation-recovery',
      priority: 5,
      canHandle: (error) =>
        error instanceof MidiError &&
        error.code === MidiErrorCode.INVALID_EVENT,
      recover: async (error, context) => {
        logger.info('Attempting MIDI validation recovery');

        // Skip invalid events
        const midiContext = getErrorContext<MidiValidationContext>(error);
        this.eventBus.emit('midi:skip-invalid-events', {
          validationErrors: midiContext?.validationErrors,
        });

        return true;
      },
    });

    // MIDI timing recovery
    this.registerStrategy({
      name: 'midi-timing-recovery',
      priority: 7,
      canHandle: (error) =>
        error instanceof MidiError && error.code === MidiErrorCode.TIMING_ERROR,
      recover: async (error, context) => {
        logger.info('Attempting MIDI timing recovery');

        // Apply timing correction
        const timingContext = getErrorContext<MidiTimingContext>(error);
        this.eventBus.emit('midi:apply-timing-correction', {
          drift: timingContext?.drift,
        });

        return true;
      },
    });
  }

  /**
   * Register storage-specific recovery strategies
   */
  private registerStorageStrategies(): void {
    // Storage connection recovery
    this.registerStrategy({
      name: 'storage-connection-recovery',
      priority: 10,
      canHandle: (error) =>
        error instanceof StorageError &&
        error.code === StorageErrorCode.STORAGE_CONNECTION_FAILED,
      recover: async (error, context) => {
        logger.info('Attempting storage connection recovery');

        // Wait and retry
        await this.delay(3000);

        const storageContext = getErrorContext<StorageConnectionContext>(error);
        this.eventBus.emit('storage:retry-connection', {
          endpoint: storageContext?.endpoint,
        });

        return true;
      },
    });

    // CDN fallback recovery
    this.registerStrategy({
      name: 'cdn-fallback-recovery',
      priority: 8,
      canHandle: (error) =>
        error instanceof StorageError &&
        error.code === StorageErrorCode.CDN_UNREACHABLE,
      recover: async (error, context) => {
        logger.info('Attempting CDN fallback recovery');

        // Use direct storage
        this.eventBus.emit('storage:use-direct-access', {
          reason: 'cdn-unreachable',
        });

        return true;
      },
    });

    // Cache recovery
    this.registerStrategy({
      name: 'cache-full-recovery',
      priority: 6,
      canHandle: (error) =>
        error instanceof StorageError &&
        error.code === StorageErrorCode.CACHE_FULL,
      recover: async (error, context) => {
        logger.info('Attempting cache full recovery');

        // Clear old entries
        const cacheContext = getErrorContext<CacheFullContext>(error);
        this.eventBus.emit('cache:evict-old-entries', {
          targetSize: cacheContext?.requestedSize,
        });

        return true;
      },
    });

    // Circuit breaker recovery
    this.registerStrategy({
      name: 'circuit-breaker-recovery',
      priority: 5,
      canHandle: (error) =>
        error instanceof StorageError &&
        error.code === StorageErrorCode.CIRCUIT_BREAKER_OPEN,
      recover: async (error, context) => {
        logger.info('Attempting circuit breaker recovery');

        // Use fallback service
        const circuitContext = getErrorContext<CircuitBreakerContext>(error);
        this.eventBus.emit('storage:use-fallback-service', {
          serviceName: circuitContext?.serviceName,
        });

        return true;
      },
    });
  }

  /**
   * Register transport-specific recovery strategies
   */
  private registerTransportStrategies(): void {
    // Clock sync recovery
    this.registerStrategy({
      name: 'clock-sync-recovery',
      priority: 10,
      canHandle: (error) =>
        error instanceof TransportError &&
        error.code === TransportErrorCode.CLOCK_SYNC_FAILED,
      recover: async (error, context) => {
        logger.info('Attempting clock sync recovery');

        // Reinitialize clock
        const clockContext = getErrorContext<ClockSyncContext>(error);
        this.eventBus.emit('transport:reinitialize-clock', {
          sampleRate: clockContext?.sampleRate,
        });

        await this.delay(1000);

        return true;
      },
    });

    // Schedule overflow recovery
    this.registerStrategy({
      name: 'schedule-overflow-recovery',
      priority: 9,
      canHandle: (error) =>
        error instanceof TransportError &&
        error.code === TransportErrorCode.SCHEDULE_OVERFLOW,
      recover: async (error, context) => {
        logger.info('Attempting schedule overflow recovery');

        // Drop non-critical events
        this.eventBus.emit('transport:drop-non-critical-events', {
          threshold: 0.8,
        });

        return true;
      },
    });

    // Worklet fallback recovery
    this.registerStrategy({
      name: 'worklet-fallback-recovery',
      priority: 8,
      canHandle: (error) =>
        error instanceof TransportError &&
        error.code === TransportErrorCode.WORKLET_INIT_FAILED,
      recover: async (error, context) => {
        logger.info('Attempting worklet fallback recovery');

        // Use ScriptProcessor fallback
        this.eventBus.emit('transport:use-script-processor', {
          reason: 'worklet-init-failed',
        });

        return true;
      },
    });

    // Latency compensation recovery
    this.registerStrategy({
      name: 'latency-compensation-recovery',
      priority: 7,
      canHandle: (error) =>
        error instanceof TransportError &&
        error.code === TransportErrorCode.LATENCY_THRESHOLD_EXCEEDED,
      recover: async (error, context) => {
        logger.info('Attempting latency compensation recovery');

        // Increase buffer size
        const latencyContext = getErrorContext<LatencyContext>(error);
        this.eventBus.emit('transport:increase-buffer-size', {
          currentLatency: latencyContext?.measuredLatency,
          targetLatency: latencyContext?.targetLatency,
        });

        return true;
      },
    });
  }

  /**
   * Get recovery statistics by strategy
   */
  getStrategyStats(): Array<{
    name: string;
    priority: number;
    attempts: number;
    successRate: number;
    averageRecoveryTime: number;
    lastUsed?: number;
  }> {
    return Array.from(this.strategies.entries())
      .map(([name, strategy]) => {
        const metrics = this.metrics.get(name);

        return {
          name,
          priority: strategy.priority,
          attempts: metrics?.attempts || 0,
          successRate: strategy.successRate || 0,
          averageRecoveryTime: strategy.averageRecoveryTime || 0,
          lastUsed: strategy.lastUsed,
        };
      })
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Reset metrics for a specific strategy
   */
  resetStrategyMetrics(strategyName: string): void {
    const metrics = this.metrics.get(strategyName);
    if (metrics) {
      metrics.attempts = 0;
      metrics.successes = 0;
      metrics.failures = 0;
      metrics.totalRecoveryTime = 0;
      delete metrics.lastAttempt;
      delete metrics.lastSuccess;
    }

    const strategy = this.strategies.get(strategyName);
    if (strategy) {
      delete strategy.successRate;
      delete strategy.averageRecoveryTime;
      delete strategy.lastUsed;
    }
  }

  /**
   * Start periodic cleanup of old metrics
   */
  private startMetricsCleanup(): void {
    setInterval(
      () => {
        const cutoff = Date.now() - this.config.metricsRetentionPeriod!;

        this.metrics.forEach((metrics, strategyName) => {
          if (metrics.lastAttempt && metrics.lastAttempt < cutoff) {
            this.resetStrategyMetrics(strategyName);
          }
        });
      },
      60 * 60 * 1000,
    ); // Run every hour
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
