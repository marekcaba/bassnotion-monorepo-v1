/**
 * Multi-Track Timing Synchronizer
 *
 * This file now re-exports from the modular implementation.
 * The original functionality has been moved to modules/tracks/timing/TrackTimingSynchronizer.ts
 *
 * @deprecated Use imports from '@/domains/playback/modules/tracks/timing' directly
 */

export {
  TrackTimingSynchronizer as MultiTrackTimingSynchronizer,
  type TrackTimingState,
  type CrossTrackSyncReport as TrackSyncMetrics,
  type ScheduledTrackEvent,
  type TimingSyncConfig,
  type TrackRegistrationOptions,
  type EventSchedulingOptions,
  type EventPriority,
} from '../../modules/tracks/timing/TrackTimingSynchronizer.js';

export type { ITrackTimingSynchronizer } from '../../modules/tracks/timing/types.js';

// For backward compatibility - the new implementation uses different naming
export type TrackSyncReport =
  import('../../modules/tracks/timing/types.js').CrossTrackSyncReport;

// Note: The new TrackTimingSynchronizer in modules has all the functionality of the
// original MultiTrackTimingSynchronizer including:
// - Sample-accurate synchronization across tracks
// - AudioWorklet master clock integration
// - Timing isolation to prevent cascade failures
// - Per-track drift compensation
// - Track timing state management
// - Cross-track sync monitoring
