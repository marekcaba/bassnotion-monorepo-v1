/**
 * Log Aggregation Patterns for Playback Domain
 * Phase 5.1.3: Enhanced logging infrastructure
 *
 * Provides patterns for efficient log aggregation, batching, and sampling
 * while integrating with existing structured logging infrastructure.
 */

import {
  createStructuredLogger,
  LogEntry as BaseLogEntry,
  LogLevel as BaseLogLevel,
} from '@bassnotion/contracts';
import { EventBus } from '../../services/core/EventBus.js';

export interface LogAggregationConfig {
  // Batching configuration
  batchSize: number;
  batchTimeout: number;
  maxBatchRetries: number;

  // Sampling configuration
  samplingRate: number; // 0-1, where 1 = 100% sampling
  samplingRules?: SamplingRule[];

  // Aggregation configuration
  enableAggregation: boolean;
  aggregationWindow: number; // ms
  aggregationCategories: string[];

  // Performance configuration
  enableCompression: boolean;
  enableDeduplication: boolean;
  deduplicationWindow: number; // ms
}

export interface SamplingRule {
  category?: string;
  level?: BaseLogLevel;
  pattern?: RegExp;
  rate: number; // Override sampling rate for matching logs
}

export interface AggregatedLogEntry extends BaseLogEntry {
  count: number;
  firstOccurrence: number;
  lastOccurrence: number;
  samples: BaseLogEntry[]; // Sample of individual entries
}

export interface LogBatch {
  id: string;
  entries: BaseLogEntry[];
  timestamp: number;
  retryCount: number;
  compressed?: boolean;
}

/**
 * Enhanced log transporter with aggregation capabilities
 */
export class AggregatingLogTransporter {
  private config: LogAggregationConfig;
  private eventBus: EventBus;
  private batches: Map<string, LogBatch> = new Map();
  private aggregationBuffer: Map<string, AggregatedLogEntry> = new Map();
  private deduplicationCache: Map<string, number> = new Map();
  private batchTimer?: NodeJS.Timeout;
  private aggregationTimer?: NodeJS.Timeout;

  constructor(eventBus: EventBus, config: Partial<LogAggregationConfig> = {}) {
    this.eventBus = eventBus;
    this.config = {
      batchSize: 100,
      batchTimeout: 5000,
      maxBatchRetries: 3,
      samplingRate: 1.0,
      samplingRules: [],
      enableAggregation: true,
      aggregationWindow: 60000, // 1 minute
      aggregationCategories: ['performance', 'audio', 'midi'],
      enableCompression: true,
      enableDeduplication: true,
      deduplicationWindow: 1000, // 1 second
      ...config,
    };

    this.startTimers();
  }

  /**
   * Transport a log entry with aggregation and sampling
   */
  async transport(entry: BaseLogEntry): Promise<void> {
    // Apply sampling
    if (!this.shouldSample(entry)) {
      return;
    }

    // Check deduplication
    if (this.config.enableDeduplication && this.isDuplicate(entry)) {
      return;
    }

    // Check if entry should be aggregated
    if (this.config.enableAggregation && this.shouldAggregate(entry)) {
      this.aggregateEntry(entry);
    } else {
      // Add to batch
      this.addToBatch(entry);
    }
  }

  /**
   * Determine if log should be sampled
   */
  private shouldSample(entry: BaseLogEntry): boolean {
    // Check specific sampling rules first
    for (const rule of this.config.samplingRules || []) {
      if (this.matchesSamplingRule(entry, rule)) {
        return Math.random() < rule.rate;
      }
    }

    // Apply default sampling rate
    return Math.random() < this.config.samplingRate;
  }

  /**
   * Check if entry matches sampling rule
   */
  private matchesSamplingRule(
    entry: BaseLogEntry,
    rule: SamplingRule,
  ): boolean {
    if (rule.category && entry.context?.category !== rule.category) {
      return false;
    }

    if (rule.level && entry.level !== rule.level) {
      return false;
    }

    if (rule.pattern && !rule.pattern.test(entry.message)) {
      return false;
    }

    return true;
  }

  /**
   * Check if entry is a duplicate
   */
  private isDuplicate(entry: BaseLogEntry): boolean {
    const key = this.getDeduplicationKey(entry);
    const lastSeen = this.deduplicationCache.get(key);

    if (lastSeen && Date.now() - lastSeen < this.config.deduplicationWindow) {
      return true;
    }

    this.deduplicationCache.set(key, Date.now());
    this.cleanDeduplicationCache();

    return false;
  }

  /**
   * Generate deduplication key
   */
  private getDeduplicationKey(entry: BaseLogEntry): string {
    return `${entry.level}:${entry.context?.category}:${entry.message}`;
  }

  /**
   * Clean old entries from deduplication cache
   */
  private cleanDeduplicationCache(): void {
    const cutoff = Date.now() - this.config.deduplicationWindow * 2;

    for (const [key, timestamp] of this.deduplicationCache.entries()) {
      if (timestamp < cutoff) {
        this.deduplicationCache.delete(key);
      }
    }
  }

  /**
   * Check if entry should be aggregated
   */
  private shouldAggregate(entry: BaseLogEntry): boolean {
    const category = entry.context?.category || '';
    return this.config.aggregationCategories.includes(category);
  }

  /**
   * Aggregate a log entry
   */
  private aggregateEntry(entry: BaseLogEntry): void {
    const key = this.getAggregationKey(entry);
    const existing = this.aggregationBuffer.get(key);

    if (existing) {
      existing.count++;
      existing.lastOccurrence = entry.timestamp;

      // Keep a sample of entries
      if (existing.samples.length < 5) {
        existing.samples.push(entry);
      }
    } else {
      const aggregated: AggregatedLogEntry = {
        ...entry,
        count: 1,
        firstOccurrence: entry.timestamp,
        lastOccurrence: entry.timestamp,
        samples: [entry],
      };

      this.aggregationBuffer.set(key, aggregated);
    }
  }

  /**
   * Generate aggregation key
   */
  private getAggregationKey(entry: BaseLogEntry): string {
    // Create a key that groups similar log entries
    const category = entry.context?.category || 'unknown';
    const level = entry.level;
    const messagePattern = this.extractMessagePattern(entry.message);

    return `${category}:${level}:${messagePattern}`;
  }

  /**
   * Extract pattern from log message
   */
  private extractMessagePattern(message: string): string {
    // Remove numbers and IDs to group similar messages
    return message
      .replace(/\b\d+\b/g, 'N')
      .replace(
        /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi,
        'UUID',
      )
      .replace(/\b0x[a-f0-9]+\b/gi, 'HEX');
  }

  /**
   * Add entry to batch
   */
  private addToBatch(entry: BaseLogEntry): void {
    const batchId = this.getCurrentBatchId();
    let batch = this.batches.get(batchId);

    if (!batch) {
      batch = {
        id: batchId,
        entries: [],
        timestamp: Date.now(),
        retryCount: 0,
      };
      this.batches.set(batchId, batch);
    }

    batch.entries.push(entry);

    // Check if batch is full
    if (batch.entries.length >= this.config.batchSize) {
      this.flushBatch(batchId);
    }
  }

  /**
   * Get current batch ID
   */
  private getCurrentBatchId(): string {
    // Use time-based batch IDs for easy ordering
    return `batch-${Math.floor(Date.now() / this.config.batchTimeout)}`;
  }

  /**
   * Flush a specific batch
   */
  private async flushBatch(batchId: string): Promise<void> {
    const batch = this.batches.get(batchId);
    if (!batch || batch.entries.length === 0) {
      return;
    }

    try {
      // Compress batch if enabled
      if (this.config.enableCompression) {
        batch.compressed = true;
        // Compression would be implemented here
      }

      // Send batch
      await this.sendBatch(batch);

      // Remove successful batch
      this.batches.delete(batchId);

      // Emit success event
      this.eventBus.emit('log:batch-sent', {
        batchId,
        size: batch.entries.length,
        compressed: batch.compressed,
      });
    } catch (error) {
      // Handle retry logic
      batch.retryCount++;

      if (batch.retryCount >= this.config.maxBatchRetries) {
        // Max retries reached, discard batch
        this.batches.delete(batchId);

        this.eventBus.emit('log:batch-failed', {
          batchId,
          size: batch.entries.length,
          error,
        });
      } else {
        // Retry later
        this.eventBus.emit('log:batch-retry', {
          batchId,
          retryCount: batch.retryCount,
        });
      }
    }
  }

  /**
   * Flush aggregated entries
   */
  private flushAggregated(): void {
    if (this.aggregationBuffer.size === 0) {
      return;
    }

    const aggregatedEntries = Array.from(this.aggregationBuffer.values());
    this.aggregationBuffer.clear();

    // Convert aggregated entries to regular log entries
    for (const aggregated of aggregatedEntries) {
      const summaryEntry: BaseLogEntry = {
        ...aggregated,
        message: `${aggregated.message} (occurred ${aggregated.count} times)`,
        context: {
          ...aggregated.context,
          aggregation: {
            count: aggregated.count,
            firstOccurrence: aggregated.firstOccurrence,
            lastOccurrence: aggregated.lastOccurrence,
            duration: aggregated.lastOccurrence - aggregated.firstOccurrence,
          },
        },
      };

      this.addToBatch(summaryEntry);
    }
  }

  /**
   * Send batch to backend
   */
  private async sendBatch(batch: LogBatch): Promise<void> {
    // This would integrate with the backend log aggregator
    const response = await fetch('/api/v1/logs/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-batch-id': batch.id,
        'x-compressed': batch.compressed ? 'true' : 'false',
      },
      body: JSON.stringify({
        entries: batch.entries,
        metadata: {
          batchId: batch.id,
          timestamp: batch.timestamp,
          compressed: batch.compressed,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Batch send failed: ${response.status}`);
    }
  }

  /**
   * Start timers for batch and aggregation flushing
   */
  private startTimers(): void {
    // Batch flush timer
    this.batchTimer = setInterval(() => {
      this.flushAllBatches();
    }, this.config.batchTimeout);

    // Aggregation flush timer
    if (this.config.enableAggregation) {
      this.aggregationTimer = setInterval(() => {
        this.flushAggregated();
      }, this.config.aggregationWindow);
    }
  }

  /**
   * Flush all pending batches
   */
  private async flushAllBatches(): Promise<void> {
    const batchIds = Array.from(this.batches.keys());

    for (const batchId of batchIds) {
      await this.flushBatch(batchId);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    pendingBatches: number;
    pendingEntries: number;
    aggregatedEntries: number;
    deduplicationCacheSize: number;
  } {
    let pendingEntries = 0;
    for (const batch of this.batches.values()) {
      pendingEntries += batch.entries.length;
    }

    return {
      pendingBatches: this.batches.size,
      pendingEntries,
      aggregatedEntries: this.aggregationBuffer.size,
      deduplicationCacheSize: this.deduplicationCache.size,
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }

    // Flush remaining data
    this.flushAggregated();
    this.flushAllBatches();

    this.batches.clear();
    this.aggregationBuffer.clear();
    this.deduplicationCache.clear();
  }
}

/**
 * Factory function to create an enhanced logger with aggregation
 */
export function createAggregatingLogger(
  name: string,
  eventBus: EventBus,
  config?: Partial<LogAggregationConfig>,
): ReturnType<typeof createStructuredLogger> {
  const baseLogger = createStructuredLogger(name);
  const transporter = new AggregatingLogTransporter(eventBus, config);

  // Create a proxy that intercepts log calls
  return new Proxy(baseLogger, {
    get(target, prop) {
      if (['debug', 'info', 'warn', 'error'].includes(prop as string)) {
        return (...args: any[]) => {
          // Call original logger
          const result = (target as any)[prop](...args);

          // Extract log entry from the call
          // This assumes the structured logger creates an entry
          // In practice, we'd hook into the global transporter
          const entry: BaseLogEntry = {
            timestamp: Date.now(),
            level: prop as BaseLogLevel,
            message: args[0],
            context: {
              category: name,
              ...args[1],
            },
          };

          // Transport through aggregator
          transporter.transport(entry);

          return result;
        };
      }

      return (target as any)[prop];
    },
  });
}

/**
 * Sampling strategies for different scenarios
 */
export const SAMPLING_PRESETS = {
  // High-frequency events - aggressive sampling
  performance: {
    samplingRate: 0.1, // 10% sampling
    samplingRules: [
      { level: 'error' as BaseLogLevel, rate: 1.0 }, // Always sample errors
      { pattern: /critical|fatal/i, rate: 1.0 }, // Always sample critical messages
    ],
  },

  // Development - full logging
  development: {
    samplingRate: 1.0,
    enableDeduplication: false,
    enableAggregation: false,
  },

  // Production - balanced approach
  production: {
    samplingRate: 0.5,
    samplingRules: [
      { level: 'debug' as BaseLogLevel, rate: 0.01 }, // 1% debug logs
      { level: 'info' as BaseLogLevel, rate: 0.5 }, // 50% info logs
      { level: 'warn' as BaseLogLevel, rate: 0.9 }, // 90% warnings
      { level: 'error' as BaseLogLevel, rate: 1.0 }, // 100% errors
    ],
    enableDeduplication: true,
    enableAggregation: true,
  },
};
