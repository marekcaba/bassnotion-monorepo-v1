/**
 * Playback Logger Integration
 * Phase 5.1.3: Integrates aggregation patterns with existing logging infrastructure
 *
 * Bridges the gap between ProductionLogger and structured logging with
 * enhanced aggregation, batching, and sampling capabilities.
 */

import {
  createStructuredLogger,
  setGlobalLogTransporter,
} from '@bassnotion/contracts';
import { ProductionLogger } from '../../services/logging/ProductionLogger.js';
import { EventBus } from '../../services/core/EventBus.js';
import {
  AggregatingLogTransporter,
  LogAggregationConfig,
  SAMPLING_PRESETS,
  createAggregatingLogger,
} from './LogAggregationPatterns.js';

export interface PlaybackLoggerConfig {
  enableProductionLogger?: boolean;
  enableAggregation?: boolean;
  aggregationConfig?: Partial<LogAggregationConfig>;
  environment?: 'development' | 'production' | 'test';
}

/**
 * Singleton manager for playback domain logging
 */
export class PlaybackLoggerManager {
  private static instance: PlaybackLoggerManager | null = null;

  private eventBus: EventBus;
  private productionLogger?: ProductionLogger;
  private aggregatingTransporter?: AggregatingLogTransporter;
  private config: Required<PlaybackLoggerConfig>;
  private loggers: Map<string, ReturnType<typeof createStructuredLogger>> =
    new Map();

  private constructor(eventBus: EventBus, config: PlaybackLoggerConfig = {}) {
    this.eventBus = eventBus;
    this.config = {
      enableProductionLogger: true,
      enableAggregation: true,
      aggregationConfig: {},
      environment: (process.env.NODE_ENV as any) || 'development',
      ...config,
    };

    this.initialize();
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    eventBus: EventBus,
    config?: PlaybackLoggerConfig,
  ): PlaybackLoggerManager {
    if (!PlaybackLoggerManager.instance) {
      PlaybackLoggerManager.instance = new PlaybackLoggerManager(
        eventBus,
        config,
      );
    }
    return PlaybackLoggerManager.instance;
  }

  /**
   * Initialize logging infrastructure
   */
  private initialize(): void {
    // Setup production logger if enabled
    if (this.config.enableProductionLogger) {
      this.productionLogger = ProductionLogger.getInstance(this.eventBus, {
        enabled: true,
        minLevel: this.config.environment === 'production' ? 'info' : 'debug',
        enableRemote: this.config.environment === 'production',
      });
    }

    // Setup aggregating transporter
    if (this.config.enableAggregation) {
      const presetConfig = SAMPLING_PRESETS[this.config.environment] || {};

      this.aggregatingTransporter = new AggregatingLogTransporter(
        this.eventBus,
        {
          ...presetConfig,
          ...this.config.aggregationConfig,
        },
      );

      // Set as global transporter for structured logging
      this.setupGlobalTransporter();
    }

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup global log transporter integration
   */
  private setupGlobalTransporter(): void {
    if (!this.aggregatingTransporter) return;

    // Create a transporter that integrates both systems
    setGlobalLogTransporter(async (entry) => {
      // Send to aggregating transporter
      if (this.aggregatingTransporter) {
        await this.aggregatingTransporter.transport(entry);
      }

      // Also send to production logger for immediate logging
      if (
        this.productionLogger &&
        this.shouldForwardToProductionLogger(entry)
      ) {
        const category = entry.context?.category || 'unknown';

        switch (entry.level) {
          case 'debug':
            this.productionLogger.debug(category, entry.message, entry.context);
            break;
          case 'info':
            this.productionLogger.info(category, entry.message, entry.context);
            break;
          case 'warn':
            this.productionLogger.warn(category, entry.message, entry.context);
            break;
          case 'error':
            if (entry.error) {
              this.productionLogger.error(
                category,
                entry.message,
                new Error(entry.error.message),
                entry.context,
              );
            } else {
              this.productionLogger.error(
                category,
                entry.message,
                undefined,
                entry.context,
              );
            }
            break;
        }
      }
    });
  }

  /**
   * Determine if log should be forwarded to production logger
   */
  private shouldForwardToProductionLogger(entry: any): boolean {
    // Always forward errors and warnings
    if (entry.level === 'error' || entry.level === 'warn') {
      return true;
    }

    // Forward critical categories
    const criticalCategories = ['audio', 'transport', 'instrument'];
    if (
      entry.context?.category &&
      criticalCategories.includes(entry.context.category)
    ) {
      return true;
    }

    // In development, forward everything
    if (this.config.environment === 'development') {
      return true;
    }

    return false;
  }

  /**
   * Setup event listeners for log-related events
   */
  private setupEventListeners(): void {
    // Monitor batch processing
    this.eventBus.on('log:batch-sent', (data) => {
      this.logInternal('info', 'Log batch sent', data);
    });

    this.eventBus.on('log:batch-failed', (data) => {
      this.logInternal('error', 'Log batch failed', data);
    });

    this.eventBus.on('log:batch-retry', (data) => {
      this.logInternal('warn', 'Log batch retry', data);
    });

    // Monitor aggregation
    if (this.aggregatingTransporter) {
      setInterval(() => {
        const stats = this.aggregatingTransporter!.getStats();

        if (stats.pendingBatches > 10 || stats.pendingEntries > 1000) {
          this.logInternal('warn', 'High log buffer size', stats);
        }
      }, 30000); // Check every 30 seconds
    }
  }

  /**
   * Internal logging (avoid recursion)
   */
  private logInternal(level: string, message: string, data?: any): void {
    if (this.productionLogger) {
      (this.productionLogger as any)[level]('logger-manager', message, data);
    }
  }

  /**
   * Create a logger for a specific component
   */
  createLogger(
    name: string,
    options?: {
      aggregation?: Partial<LogAggregationConfig>;
      correlationId?: string;
    },
  ): ReturnType<typeof createStructuredLogger> {
    // Check cache
    const cacheKey = `${name}:${options?.correlationId || 'default'}`;
    const cached = this.loggers.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Create logger based on configuration
    let logger: ReturnType<typeof createStructuredLogger>;

    if (this.config.enableAggregation && this.aggregatingTransporter) {
      // Create aggregating logger
      logger = createAggregatingLogger(
        name,
        this.eventBus,
        options?.aggregation,
      );
    } else {
      // Create standard structured logger
      logger = createStructuredLogger(name);
    }

    // Add correlation ID if provided
    if (options?.correlationId) {
      // Wrap logger methods to include correlation ID
      const wrappedLogger = this.wrapWithCorrelationId(
        logger,
        options.correlationId,
      );
      this.loggers.set(cacheKey, wrappedLogger);
      return wrappedLogger;
    }

    this.loggers.set(cacheKey, logger);
    return logger;
  }

  /**
   * Wrap logger with correlation ID
   */
  private wrapWithCorrelationId(
    logger: ReturnType<typeof createStructuredLogger>,
    correlationId: string,
  ): ReturnType<typeof createStructuredLogger> {
    return new Proxy(logger, {
      get(target, prop) {
        if (['debug', 'info', 'warn', 'error'].includes(prop as string)) {
          return (message: string, context?: any) => {
            return (target as any)[prop](message, {
              ...context,
              correlationId,
            });
          };
        }
        return (target as any)[prop];
      },
    });
  }

  /**
   * Get aggregation statistics
   */
  getAggregationStats(): any {
    if (!this.aggregatingTransporter) {
      return null;
    }

    return this.aggregatingTransporter.getStats();
  }

  /**
   * Get production logger stats
   */
  getProductionLoggerStats(): any {
    if (!this.productionLogger) {
      return null;
    }

    return this.productionLogger.getStats();
  }

  /**
   * Flush all pending logs
   */
  async flush(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.productionLogger) {
      promises.push(this.productionLogger.flush());
    }

    if (this.aggregatingTransporter) {
      // Trigger manual flush
      this.aggregatingTransporter.dispose();

      // Recreate transporter
      this.aggregatingTransporter = new AggregatingLogTransporter(
        this.eventBus,
        this.config.aggregationConfig,
      );
    }

    await Promise.all(promises);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PlaybackLoggerConfig>): void {
    this.config = { ...this.config, ...config };

    // Reinitialize if needed
    if (config.enableAggregation !== undefined || config.aggregationConfig) {
      this.dispose();
      this.initialize();
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.productionLogger) {
      this.productionLogger.dispose();
    }

    if (this.aggregatingTransporter) {
      this.aggregatingTransporter.dispose();
    }

    this.loggers.clear();
    PlaybackLoggerManager.instance = null;
  }
}

/**
 * Helper function to create a playback domain logger
 */
export function createPlaybackLogger(
  name: string,
  options?: {
    correlationId?: string;
    aggregation?: Partial<LogAggregationConfig>;
  },
): ReturnType<typeof createStructuredLogger> {
  // Get or create event bus (would be injected in real usage)
  const eventBus = EventBus.getInstance();

  // Get logger manager
  const manager = PlaybackLoggerManager.getInstance(eventBus);

  // Create logger
  return manager.createLogger(name, options);
}

/**
 * Performance-aware logging helper
 */
export function createPerformanceLogger(
  name: string,
  thresholds: {
    warning: number;
    error: number;
  } = { warning: 100, error: 500 },
): {
  logger: ReturnType<typeof createStructuredLogger>;
  startTimer: (operation: string) => () => void;
} {
  const logger = createPlaybackLogger(name);

  const startTimer = (operation: string): (() => void) => {
    const start = performance.now();

    return () => {
      const duration = performance.now() - start;

      if (duration > thresholds.error) {
        logger.error(`Performance critical: ${operation}`, {
          duration,
          threshold: thresholds.error,
          operation,
        });
      } else if (duration > thresholds.warning) {
        logger.warn(`Performance warning: ${operation}`, {
          duration,
          threshold: thresholds.warning,
          operation,
        });
      } else {
        logger.debug(`Performance OK: ${operation}`, {
          duration,
          operation,
        });
      }
    };
  };

  return { logger, startTimer };
}
