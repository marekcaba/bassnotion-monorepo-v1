/**
 * Examples of using the enhanced logging patterns
 * Phase 5.1.3: Demonstrating log aggregation integration
 */

import {
  createPlaybackLogger,
  createPerformanceLogger,
} from '../PlaybackLoggerIntegration.js';
import { SAMPLING_PRESETS } from '../LogAggregationPatterns.js';

/**
 * Example 1: Basic component logging with aggregation
 */
export class AudioComponent {
  private logger = createPlaybackLogger('AudioComponent');

  async initialize(): Promise<void> {
    this.logger.info('Initializing audio component');

    try {
      // Some initialization logic
      await this.loadSamples();
      this.logger.info('Audio component initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize audio component', { error });
      throw error;
    }
  }

  private async loadSamples(): Promise<void> {
    // These logs will be aggregated if they happen frequently
    this.logger.debug('Loading samples', {
      category: 'performance',
      sampleCount: 10,
    });
  }
}

/**
 * Example 2: Performance-aware logging
 */
export class MidiProcessor {
  private logger;
  private startTimer;

  constructor() {
    const { logger, startTimer } = createPerformanceLogger('MidiProcessor', {
      warning: 50, // Warn if processing takes > 50ms
      error: 200, // Error if processing takes > 200ms
    });
    this.logger = logger;
    this.startTimer = startTimer;
  }

  async processMidiFile(file: File): Promise<void> {
    const timer = startTimer('midi-processing');

    try {
      this.logger.info('Processing MIDI file', {
        fileName: file.name,
        size: file.size,
      });

      // Simulate processing
      await this.parseMidi(file);

      timer(); // This will log performance metrics
    } catch (error) {
      timer(); // Still measure even on error
      this.logger.error('MIDI processing failed', { error });
      throw error;
    }
  }

  private async parseMidi(file: File): Promise<void> {
    // High-frequency logs that will be sampled
    for (let i = 0; i < 1000; i++) {
      this.logger.debug('Parsing MIDI event', {
        eventIndex: i,
        category: 'midi', // Will be aggregated
      });
    }
  }
}

/**
 * Example 3: Correlation ID usage
 */
export class TransportController {
  private correlationId: string;
  private logger: ReturnType<typeof createPlaybackLogger>;

  constructor(correlationId: string) {
    this.correlationId = correlationId;
    this.logger = createPlaybackLogger('TransportController', {
      correlationId,
    });
  }

  play(): void {
    this.logger.info('Transport play initiated');

    // All logs will include the correlation ID automatically
    this.logger.debug('Starting audio context');
    this.logger.debug('Scheduling events');
    this.logger.info('Transport playing');
  }

  stop(): void {
    this.logger.info('Transport stop initiated');
    this.logger.debug('Cancelling scheduled events');
    this.logger.info('Transport stopped');
  }
}

/**
 * Example 4: Custom aggregation configuration
 */
export class HighFrequencyComponent {
  private logger = createPlaybackLogger('HighFrequencyComponent', {
    aggregation: {
      samplingRate: 0.01, // Only sample 1% of logs
      samplingRules: [
        { level: 'error' as any, rate: 1.0 }, // But always log errors
        { pattern: /critical/i, rate: 1.0 }, // And critical messages
      ],
      enableDeduplication: true,
      deduplicationWindow: 5000, // 5 second window
    },
  });

  onAudioTick(): void {
    // This will be heavily sampled - only 1% will be logged
    this.logger.debug('Audio tick processed');
  }

  onError(error: Error): void {
    // This will always be logged due to sampling rules
    this.logger.error('Audio processing error', { error });
  }
}

/**
 * Example 5: Production vs Development logging
 */
export class AdaptiveLogger {
  private logger: ReturnType<typeof createPlaybackLogger>;

  constructor() {
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Use different presets based on environment
    this.logger = createPlaybackLogger('AdaptiveLogger', {
      aggregation: isDevelopment
        ? SAMPLING_PRESETS.development
        : SAMPLING_PRESETS.production,
    });
  }

  performOperation(): void {
    // In development: all logs are captured
    // In production: logs are sampled and aggregated
    this.logger.debug('Starting operation');

    for (let i = 0; i < 100; i++) {
      this.logger.debug('Processing item', { index: i });
    }

    this.logger.info('Operation completed');
  }
}

/**
 * Example 6: Structured error logging with context
 */
export class ErrorHandler {
  private logger = createPlaybackLogger('ErrorHandler');

  handlePlaybackError(
    error: Error,
    context: {
      userId?: string;
      sessionId?: string;
      trackId?: string;
      timestamp?: number;
    },
  ): void {
    // Rich error context for debugging
    this.logger.error('Playback error occurred', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context: {
        ...context,
        browserInfo: navigator.userAgent,
        audioContextState: this.getAudioContextState(),
        memoryUsage: this.getMemoryUsage(),
      },
    });
  }

  private getAudioContextState(): string {
    // Would get from actual audio context
    return 'running';
  }

  private getMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      return Math.round(
        (performance as any).memory.usedJSHeapSize / (1024 * 1024),
      );
    }
    return undefined;
  }
}

/**
 * Example 7: Batch operation logging
 */
export class BatchProcessor {
  private logger = createPlaybackLogger('BatchProcessor');

  async processBatch(items: any[]): Promise<void> {
    const batchId = crypto.randomUUID();

    this.logger.info('Starting batch processing', {
      batchId,
      itemCount: items.length,
    });

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
    };

    for (const item of items) {
      try {
        await this.processItem(item);
        results.success++;

        // These will be aggregated
        this.logger.debug('Item processed', {
          batchId,
          category: 'performance',
        });
      } catch (error) {
        results.failed++;

        // Errors are always logged
        this.logger.error('Item processing failed', {
          batchId,
          itemId: item.id,
          error,
        });
      }
    }

    // Summary log
    this.logger.info('Batch processing completed', {
      batchId,
      results,
      duration: performance.now(),
    });
  }

  private async processItem(item: any): Promise<void> {
    // Processing logic
  }
}

/**
 * Example 8: Integration with existing patterns
 */
export class IntegratedComponent {
  private logger = createPlaybackLogger('IntegratedComponent');
  private performanceLogger = createPerformanceLogger(
    'IntegratedComponent-Performance',
  );

  async complexOperation(): Promise<void> {
    const correlationId = crypto.randomUUID();
    const contextLogger = createPlaybackLogger('IntegratedComponent', {
      correlationId,
    });

    contextLogger.info('Starting complex operation');

    // Measure overall performance
    const timer = this.performanceLogger.startTimer('complex-operation');

    try {
      // Step 1
      const step1Timer = this.performanceLogger.startTimer('step-1');
      await this.step1();
      step1Timer();

      // Step 2
      const step2Timer = this.performanceLogger.startTimer('step-2');
      await this.step2();
      step2Timer();

      contextLogger.info('Complex operation completed');
    } catch (error) {
      contextLogger.error('Complex operation failed', { error });
      throw error;
    } finally {
      timer();
    }
  }

  private async step1(): Promise<void> {
    this.logger.debug('Executing step 1');
  }

  private async step2(): Promise<void> {
    this.logger.debug('Executing step 2');
  }
}
