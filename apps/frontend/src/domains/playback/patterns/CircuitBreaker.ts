/**
 * Enhanced CircuitBreaker - Advanced Circuit Breaker Pattern
 * Story 3.18.4: Service Architecture Implementation
 * 
 * Extends the base CircuitBreaker with additional features:
 * - Health check probing
 * - Adaptive failure thresholds
 * - Circuit breaker chaining
 * - Monitoring and alerting hooks
 */

import { CircuitBreaker as BaseCircuitBreaker, CircuitBreakerConfig as BaseConfig, CircuitState, CircuitBreakerMetrics } from '../services/errors/CircuitBreaker.js';
import { EventBus } from '../services/core/EventBus.js';

export interface EnhancedCircuitBreakerConfig extends Partial<BaseConfig> {
  healthCheckInterval?: number;
  healthCheckOperation?: () => Promise<boolean>;
  adaptiveThreshold?: {
    enabled: boolean;
    minThreshold: number;
    maxThreshold: number;
    adjustmentRate: number;
  };
  monitoring?: {
    metricsInterval: number;
    alertThresholds: {
      failureRate: number;
      rejectedRate: number;
      uptimePercent: number;
    };
  };
  fallbackOperation?: () => Promise<any>;
}

export interface CircuitBreakerEvent {
  name: string;
  state: CircuitState;
  metrics: CircuitBreakerMetrics;
  timestamp: number;
  reason?: string;
}

export class EnhancedCircuitBreaker extends BaseCircuitBreaker {
  private eventBus: EventBus;
  private config: EnhancedCircuitBreakerConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private chainedBreakers: Map<string, EnhancedCircuitBreaker> = new Map();
  private fallbackOperation?: () => Promise<any>;

  // Adaptive threshold tracking
  private recentFailureRates: number[] = [];
  private currentFailureThreshold: number;

  constructor(
    name: string, 
    eventBus: EventBus,
    config: EnhancedCircuitBreakerConfig = {}
  ) {
    super(name, config);
    this.eventBus = eventBus;
    this.config = config;
    this.fallbackOperation = config.fallbackOperation;

    // Initialize adaptive threshold
    this.currentFailureThreshold = config.failureThreshold || 5;

    // Start health check monitoring if configured
    if (config.healthCheckInterval && config.healthCheckOperation) {
      this.startHealthCheckMonitoring();
    }

    // Start metrics monitoring if configured
    if (config.monitoring) {
      this.startMetricsMonitoring();
    }
  }

  /**
   * Execute operation with enhanced circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationId?: string
  ): Promise<T> {
    try {
      // Check chained breakers first
      for (const [name, breaker] of this.chainedBreakers) {
        if (breaker.getState() === CircuitState.OPEN) {
          throw new Error(`Chained circuit breaker '${name}' is OPEN`);
        }
      }

      // Execute with base circuit breaker
      const result = await super.execute(operation, operationId);

      // Update adaptive threshold on success
      if (this.config.adaptiveThreshold?.enabled) {
        this.updateAdaptiveThreshold(true);
      }

      return result;
    } catch (error) {
      // Update adaptive threshold on failure
      if (this.config.adaptiveThreshold?.enabled) {
        this.updateAdaptiveThreshold(false);
      }

      // Emit state change event if circuit opened
      const currentState = this.getState();
      if (currentState === CircuitState.OPEN) {
        this.emitStateChange('opened', error instanceof Error ? error.message : 'Unknown error');
      }

      // Try fallback operation if available and circuit is open
      if (this.fallbackOperation && currentState === CircuitState.OPEN) {
        try {
          const fallbackResult = await this.fallbackOperation();
          this.eventBus?.emit('circuitbreaker:fallback-used', {
            name: this.name,
            timestamp: Date.now(),
          });
          return fallbackResult;
        } catch (fallbackError) {
          // Fallback also failed
          this.eventBus?.emit('circuitbreaker:fallback-failed', {
            name: this.name,
            error: fallbackError instanceof Error ? fallbackError.message : 'Fallback failed',
            timestamp: Date.now(),
          });
        }
      }

      throw error;
    }
  }

  /**
   * Chain another circuit breaker
   */
  chain(name: string, breaker: EnhancedCircuitBreaker): void {
    this.chainedBreakers.set(name, breaker);
  }

  /**
   * Remove chained circuit breaker
   */
  unchain(name: string): boolean {
    return this.chainedBreakers.delete(name);
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheckMonitoring(): void {
    if (!this.config.healthCheckOperation) return;

    this.healthCheckTimer = setInterval(async () => {
      if (this.getState() === CircuitState.OPEN) {
        try {
          const isHealthy = await this.config.healthCheckOperation!();
          if (isHealthy) {
            // Force circuit to half-open for testing
            this.forceHalfOpen();
            this.emitStateChange('health-check-passed', 'Service appears healthy');
          }
        } catch (error) {
          // Health check failed, keep circuit open
          this.eventBus?.emit('circuitbreaker:health-check-failed', {
            name: this.name,
            error: error instanceof Error ? error.message : 'Health check failed',
            timestamp: Date.now(),
          });
        }
      }
    }, this.config.healthCheckInterval!);
  }

  /**
   * Start metrics monitoring
   */
  private startMetricsMonitoring(): void {
    if (!this.config.monitoring) return;

    this.metricsTimer = setInterval(() => {
      const metrics = this.getMetrics();

      // Check alert thresholds
      const alerts: string[] = [];

      const failureRate = metrics.totalRequests > 0 
        ? (metrics.failureCount / metrics.totalRequests) * 100 
        : 0;

      if (failureRate > this.config.monitoring!.alertThresholds.failureRate) {
        alerts.push(`High failure rate: ${failureRate.toFixed(2)}%`);
      }

      const rejectedRate = metrics.totalRequests > 0
        ? (metrics.rejectedCount / metrics.totalRequests) * 100
        : 0;
      if (rejectedRate > this.config.monitoring!.alertThresholds.rejectedRate) {
        alerts.push(`High rejection rate: ${rejectedRate.toFixed(2)}%`);
      }

      if (metrics.uptime < this.config.monitoring!.alertThresholds.uptimePercent) {
        alerts.push(`Low uptime: ${metrics.uptime.toFixed(2)}%`);
      }

      // Emit metrics event
      this.eventBus?.emit('circuitbreaker:metrics', {
        name: this.name,
        metrics,
        alerts,
        timestamp: Date.now(),
      });

      // Emit alerts if any
      if (alerts.length > 0) {
        this.eventBus?.emit('circuitbreaker:alert', {
          name: this.name,
          alerts,
          metrics,
          timestamp: Date.now(),
        });
      }
    }, this.config.monitoring.metricsInterval);
  }

  /**
   * Update adaptive threshold based on recent performance
   */
  private updateAdaptiveThreshold(success: boolean): void {
    if (!this.config.adaptiveThreshold?.enabled) return;

    // Track recent failure rate (sliding window of 10 operations)
    this.recentFailureRates.push(success ? 0 : 1);
    if (this.recentFailureRates.length > 10) {
      this.recentFailureRates.shift();
    }

    // Calculate average failure rate
    const avgFailureRate = this.recentFailureRates.reduce((a, b) => a + b, 0) / this.recentFailureRates.length;

    // Adjust threshold based on failure rate
    const { minThreshold, maxThreshold, adjustmentRate } = this.config.adaptiveThreshold;
    if (avgFailureRate > 0.5) {
      // High failure rate - decrease threshold (open circuit sooner)
      this.currentFailureThreshold = Math.max(
        minThreshold,
        this.currentFailureThreshold - adjustmentRate
      );
    } else if (avgFailureRate < 0.1) {
      // Low failure rate - increase threshold (give more chances)
      this.currentFailureThreshold = Math.min(
        maxThreshold,
        this.currentFailureThreshold + adjustmentRate
      );
    }

    // Update the base circuit breaker config
    (this as any).config.failureThreshold = Math.round(this.currentFailureThreshold);
  }

  /**
   * Force circuit to half-open state (for health check recovery)
   */
  private forceHalfOpen(): void {
    (this as any).state = CircuitState.HALF_OPEN;
    (this as any).successCount = 0;
  }

  /**
   * Emit state change event
   */
  private emitStateChange(reason: string, details?: string): void {
    const event: CircuitBreakerEvent = {
      name: this.name,
      state: this.getState(),
      metrics: this.getMetrics(),
      timestamp: Date.now(),
      reason,
    };

    this.eventBus?.emit('circuitbreaker:state-changed', event);

    if (details) {
      this.eventBus?.emit('circuitbreaker:details', {
        ...event,
        details,
      });
    }
  }

  /**
   * Get enhanced metrics including adaptive threshold info
   */
  getEnhancedMetrics(): CircuitBreakerMetrics & {
    adaptiveThreshold?: {
      current: number;
      recentFailureRate: number;
    };
    chainedBreakers: string[];
  } {
    const baseMetrics = this.getMetrics();
    return {
      ...baseMetrics,
      adaptiveThreshold: this.config.adaptiveThreshold?.enabled ? {
        current: this.currentFailureThreshold,
        recentFailureRate: this.recentFailureRates.length > 0
          ? this.recentFailureRates.reduce((a, b) => a + b, 0) / this.recentFailureRates.length
          : 0,
      } : undefined,
      chainedBreakers: Array.from(this.chainedBreakers.keys()),
    };
  }

  /**
   * Cleanup timers and resources
   */
  dispose(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }

    this.chainedBreakers.clear();
    this.reset();
  }
}

/**
 * Factory for creating circuit breakers with common configurations
 */
export class CircuitBreakerFactory {
  private eventBus: EventBus;
  private defaultConfigs: Map<string, EnhancedCircuitBreakerConfig> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupDefaultConfigs();
  }

  /**
   * Setup default configurations for common use cases
   */
  private setupDefaultConfigs(): void {
    // High-throughput services
    this.defaultConfigs.set('high-throughput', {
      failureThreshold: 10,
      recoveryTimeout: 30000,
      successThreshold: 5,
      timeout: 5000,
      adaptiveThreshold: {
        enabled: true,
        minThreshold: 5,
        maxThreshold: 20,
        adjustmentRate: 1,
      },
    });

    // Critical services (fail fast)
    this.defaultConfigs.set('critical', {
      failureThreshold: 3,
      recoveryTimeout: 60000,
      successThreshold: 3,
      timeout: 3000,
      monitoring: {
        metricsInterval: 10000,
        alertThresholds: {
          failureRate: 10,
          rejectedRate: 5,
          uptimePercent: 95,
        },
      },
    });

    // Background services (more tolerant)
    this.defaultConfigs.set('background', {
      failureThreshold: 20,
      recoveryTimeout: 120000,
      successThreshold: 2,
      timeout: 30000,
      exponentialBackoff: {
        baseDelay: 2000,
        maxDelay: 60000,
        multiplier: 2,
        jitter: true,
      },
    });
  }

  /**
   * Create circuit breaker with preset configuration
   */
  create(
    name: string,
    preset: 'high-throughput' | 'critical' | 'background' | 'custom',
    customConfig?: EnhancedCircuitBreakerConfig
  ): EnhancedCircuitBreaker {
    const baseConfig = preset === 'custom' 
      ? {} 
      : (this.defaultConfigs.get(preset) || {});

    const config = {
      ...baseConfig,
      ...customConfig,
    };

    return new EnhancedCircuitBreaker(name, this.eventBus, config);
  }

  /**
   * Create chained circuit breakers
   */
  createChain(
    configs: Array<{
      name: string;
      preset: 'high-throughput' | 'critical' | 'background' | 'custom';
      customConfig?: EnhancedCircuitBreakerConfig;
    }>
  ): EnhancedCircuitBreaker {
    if (configs.length === 0) {
      throw new Error('At least one circuit breaker configuration required');
    }

    const breakers = configs.map(config => 
      this.create(config.name, config.preset, config.customConfig)
    );

    // Chain breakers together
    for (let i = 1; i < breakers.length; i++) {
      breakers[0].chain(configs[i].name, breakers[i]);
    }

    return breakers[0];
  }
}