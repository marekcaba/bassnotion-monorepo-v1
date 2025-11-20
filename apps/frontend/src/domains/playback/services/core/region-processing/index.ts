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
 * - buffers/: Buffer registry and management
 * - countdown/: Countdown pre-roll system
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
export {
  MusicalTimeConverter,
  TimingMetricsCollector,
} from './timing/index.js';

// Cache
export { ScheduleCache } from './cache/index.js';

// Sustain pedal
export { CC64TimelineBuilder, SustainPedalAnalyzer } from './sustain/index.js';

// Schedulers
export {
  VoiceCueScheduler,
  MetronomeScheduler,
  DrumScheduler,
  BassScheduler,
  HarmonyScheduler,
  GrandPianoKeyboardMapper,
} from './scheduling/index.js';
export type { NoteMapping } from './scheduling/index.js';

// Buffer management
export { BufferRegistry } from './buffers/index.js';

// Countdown system
export { CountdownManager } from './countdown/index.js';
