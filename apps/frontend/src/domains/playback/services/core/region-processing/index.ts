/**
 * Region Processing Modules
 *
 * Modular architecture for RegionProcessor - broken down from 3902-line god object
 * into focused, testable modules.
 *
 * Architecture:
 * - types/: Shared type definitions
 * - timing/: Musical time conversion and metrics collection
 * - cache/: Per-exercise schedule caching
 * - sustain/: CC64 sustain pedal system
 * - scheduling/: Instrument-specific audio schedulers
 * - core/: Track management and orchestration (TODO)
 * - countdown/: Countdown system (TODO)
 * - buffers/: Buffer registry and management (TODO)
 */

// Type definitions
export type {
  PatternEvent,
  Region,
  Track,
  TransportPosition,
  CachedSchedule,
  ParsedPosition,
  DetailedPosition,
} from './types/index.js';

// Timing modules
export { MusicalTimeConverter, TimingMetricsCollector } from './timing/index.js';

// Cache
export { ScheduleCache } from './cache/index.js';

// Sustain pedal
export { CC64TimelineBuilder, SustainPedalAnalyzer } from './sustain/index.js';

// Schedulers
export { VoiceCueScheduler } from './scheduling/index.js';
