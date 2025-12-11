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

// Sustain pedal (merged CC64TimelineBuilder + SustainPedalAnalyzer)
export { SustainPedalManager } from './sustain/index.js';
export type {
  CC64TimelineBuilder,
  SustainPedalAnalyzer,
} from './sustain/index.js';

// Simple instrument schedulers (metronome, drums, bass, voice-cue)
export {
  VoiceCueScheduler,
  MetronomeScheduler,
  DrumScheduler,
  BassScheduler,
} from './scheduling/index.js';

// HarmonySchedulerV2 is in ../scheduling/HarmonySchedulerV2.ts (not in region-processing)
// Import directly from there if needed

// Buffer management
// Phase 3.2: BufferManager deleted (was RegionProcessor-specific)
// Buffer management now handled directly by PlaybackEngine

// Countdown system - not yet extracted, handled inline in RegionScheduler
// export { CountdownManager } from './countdown/index.js';
