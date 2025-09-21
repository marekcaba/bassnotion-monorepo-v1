/**
 * Playback Domain Logging Module
 * Phase 5.1.3 & 5.1.4: Enhanced logging infrastructure
 *
 * Provides enhanced logging infrastructure with aggregation, batching,
 * sampling, and correlation ID support for the playback domain.
 */

// Core aggregation patterns
export {
  AggregatingLogTransporter,
  LogAggregationConfig,
  SamplingRule,
  AggregatedLogEntry,
  LogBatch,
  createAggregatingLogger,
  SAMPLING_PRESETS,
} from './LogAggregationPatterns.js';

// Integration with existing infrastructure
export {
  PlaybackLoggerManager,
  PlaybackLoggerConfig,
  createPlaybackLogger,
  createPerformanceLogger,
} from './PlaybackLoggerIntegration.js';

// Correlation ID support
export {
  PlaybackCorrelationManager,
  CorrelationContext,
  CorrelatedOperation,
  CorrelationPropagator,
  usePlaybackCorrelation,
  Correlated,
  correlationMiddleware,
  createCorrelatedEventEmitter,
} from './CorrelationIdSupport.js';

// Re-export commonly used types from contracts
export type { LogEntry, LogLevel } from '@bassnotion/contracts';
