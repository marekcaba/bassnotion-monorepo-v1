/**
 * MIDI Pipeline Middleware
 *
 * Middleware system for MIDI processing pipeline
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { ParsedMidiFile } from '../parser/index.js';
import type {
  PipelineContext,
  ProcessStepResult,
  PipelineStep,
} from './MidiProcessingPipeline.js';

const logger = createStructuredLogger('MidiPipelineMiddleware');

export interface MiddlewareFunction {
  (context: MiddlewareContext, next: () => Promise<void>): Promise<void>;
}

export interface MiddlewareContext {
  file: ParsedMidiFile;
  step: PipelineStep;
  pipelineContext: PipelineContext;
  result?: ProcessStepResult;
}

export interface Middleware {
  name: string;
  before?: MiddlewareFunction;
  after?: MiddlewareFunction;
  error?: (error: Error, context: MiddlewareContext) => Promise<void>;
}

/**
 * Built-in middleware implementations
 */
export class MidiPipelineMiddleware {
  /**
   * Logging middleware
   */
  static logging(): Middleware {
    return {
      name: 'logging',
      before: async (context, next) => {
        logger.info('Processing step', {
          step: context.step.name,
          fileInfo: {
            tracks: context.file.tracks.length,
            events: context.file.tracks.reduce(
              (sum, t) => sum + t.events.length,
              0,
            ),
          },
        });
        await next();
      },
      after: async (context) => {
        if (context.result) {
          logger.info('Step completed', {
            step: context.step.name,
            success: context.result.success,
            duration: context.result.duration,
            warnings: context.result.warnings?.length || 0,
          });
        }
      },
      error: async (error, context) => {
        logger.error('Step failed', error, {
          step: context.step.name,
        });
      },
    };
  }

  /**
   * Performance monitoring middleware
   */
  static performance(thresholdMs = 1000): Middleware {
    const performanceData = new Map<string, number[]>();

    return {
      name: 'performance',
      before: async (context, next) => {
        const startTime = performance.now();
        await next();
        const duration = performance.now() - startTime;

        // Track performance
        const stepData = performanceData.get(context.step.id) || [];
        stepData.push(duration);
        performanceData.set(context.step.id, stepData);

        // Warn if slow
        if (duration > thresholdMs) {
          logger.warn('Slow step detected', {
            step: context.step.name,
            duration,
            threshold: thresholdMs,
          });
        }
      },
      after: async (context) => {
        const stepData = performanceData.get(context.step.id);
        if (stepData && stepData.length > 5) {
          const avg = stepData.reduce((a, b) => a + b, 0) / stepData.length;
          logger.info('Performance statistics', {
            step: context.step.name,
            averageDuration: avg,
            samples: stepData.length,
          });
        }
      },
    };
  }

  /**
   * Validation middleware
   */
  static validation(options?: {
    before?: boolean;
    after?: boolean;
    quick?: boolean;
  }): Middleware {
    const { before = false, after = true, quick = true } = options || {};

    return {
      name: 'validation',
      before: async (context, next) => {
        if (before) {
          const valid = await this.quickValidate(context.file);
          if (!valid) {
            throw new Error('Invalid MIDI file before processing');
          }
        }
        await next();
      },
      after: async (context) => {
        if (after && context.result?.success) {
          const valid = await this.quickValidate(context.result.file);
          if (!valid) {
            logger.warn('Invalid MIDI file after processing', {
              step: context.step.name,
            });
          }
        }
      },
    };
  }

  /**
   * Caching middleware
   */
  static caching(cache: Map<string, ParsedMidiFile>): Middleware {
    return {
      name: 'caching',
      before: async (context, next) => {
        const cacheKey = this.generateCacheKey(context);
        const cached = cache.get(cacheKey);

        if (cached) {
          logger.info('Cache hit', { step: context.step.name });
          context.result = {
            success: true,
            file: cached,
            statistics: { cached: true },
            errors: [],
            warnings: [],
            duration: 0,
          };
          return; // Skip processing
        }

        await next();
      },
      after: async (context) => {
        if (context.result?.success) {
          const cacheKey = this.generateCacheKey(context);
          cache.set(cacheKey, context.result.file);
          logger.info('Cached result', { step: context.step.name });
        }
      },
    };
  }

  /**
   * Backup middleware - saves intermediate results
   */
  static backup(storage: Map<string, ParsedMidiFile>): Middleware {
    return {
      name: 'backup',
      after: async (context) => {
        if (context.result?.success) {
          const backupKey = `${context.step.id}_${Date.now()}`;
          storage.set(backupKey, context.result.file);
          logger.info('Backed up result', {
            step: context.step.name,
            key: backupKey,
          });
        }
      },
      error: async (error, context) => {
        // Save the last good state
        const backupKey = `error_${context.step.id}_${Date.now()}`;
        storage.set(backupKey, context.file);
        logger.info('Backed up file before error', {
          step: context.step.name,
          key: backupKey,
        });
      },
    };
  }

  /**
   * Retry middleware
   */
  static retry(
    options: {
      maxRetries?: number;
      retryDelay?: number;
      retryableErrors?: string[];
    } = {},
  ): Middleware {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      retryableErrors = ['ECONNRESET', 'ETIMEDOUT'],
    } = options;

    return {
      name: 'retry',
      error: async (error, context) => {
        const isRetryable = retryableErrors.some((e) =>
          error.message.includes(e),
        );

        if (!isRetryable) {
          throw error;
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          logger.info('Retrying step', {
            step: context.step.name,
            attempt,
            maxRetries,
          });

          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * attempt),
          );

          try {
            const result = await context.step.process(
              context.file,
              context.pipelineContext,
            );
            context.result = result;
            return; // Success
          } catch (retryError) {
            if (attempt === maxRetries) {
              throw retryError;
            }
          }
        }
      },
    };
  }

  /**
   * Progress reporting middleware
   */
  static progress(
    callback: (progress: {
      step: string;
      percentage: number;
      message: string;
    }) => void,
  ): Middleware {
    return {
      name: 'progress',
      before: async (context, next) => {
        callback({
          step: context.step.name,
          percentage: 0,
          message: `Starting ${context.step.name}...`,
        });
        await next();
      },
      after: async (context) => {
        callback({
          step: context.step.name,
          percentage: 100,
          message: `Completed ${context.step.name}`,
        });
      },
    };
  }

  /**
   * Quick validation helper
   */
  private static async quickValidate(file: ParsedMidiFile): Promise<boolean> {
    try {
      // Basic checks
      if (!file.header || !file.tracks) return false;
      if (file.tracks.length === 0) return false;

      for (const track of file.tracks) {
        if (!Array.isArray(track.events)) return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate cache key
   */
  private static generateCacheKey(context: MiddlewareContext): string {
    const fileHash = this.hashFile(context.file);
    const optionsHash = JSON.stringify(context.step.options || {});
    return `${context.step.id}_${fileHash}_${optionsHash}`;
  }

  /**
   * Simple file hash for caching
   */
  private static hashFile(file: ParsedMidiFile): string {
    // Simple hash based on file structure
    const trackCount = file.tracks.length;
    const eventCount = file.tracks.reduce((sum, t) => sum + t.events.length, 0);
    const firstEvents =
      file.tracks[0]?.events
        .slice(0, 5)
        .map((e) => e.type)
        .join(',') || '';
    return `${trackCount}_${eventCount}_${firstEvents}`;
  }
}

/**
 * Middleware runner
 */
export class MiddlewareRunner {
  private middlewares: Middleware[] = [];

  /**
   * Add middleware
   */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Run before middleware
   */
  async runBefore(context: MiddlewareContext): Promise<void> {
    const runNext = async (index: number): Promise<void> => {
      if (index >= this.middlewares.length) return;

      const middleware = this.middlewares[index];
      if (middleware.before) {
        await middleware.before(context, () => runNext(index + 1));
      } else {
        await runNext(index + 1);
      }
    };

    await runNext(0);
  }

  /**
   * Run after middleware
   */
  async runAfter(context: MiddlewareContext): Promise<void> {
    for (const middleware of this.middlewares) {
      if (middleware.after) {
        try {
          await middleware.after(context);
        } catch (error) {
          logger.error('After middleware failed', error, {
            middleware: middleware.name,
          });
        }
      }
    }
  }

  /**
   * Run error middleware
   */
  async runError(error: Error, context: MiddlewareContext): Promise<void> {
    for (const middleware of this.middlewares) {
      if (middleware.error) {
        try {
          await middleware.error(error, context);
        } catch (middlewareError) {
          logger.error('Error middleware failed', middlewareError, {
            middleware: middleware.name,
          });
        }
      }
    }
  }
}
