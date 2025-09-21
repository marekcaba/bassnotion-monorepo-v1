/**
 * Track Timing Module
 *
 * Provides sample-accurate timing synchronization for multi-track playback
 * with drift compensation and error isolation.
 */

export { TrackTimingSynchronizer } from './TrackTimingSynchronizer';
export { DriftCompensator } from './DriftCompensator';
export { TimingStateManager } from './TimingStateManager';
export { SyncMonitor } from './SyncMonitor';
export { TimingIsolationManager } from './TimingIsolationManager';
export {
  OutputLatencyCompensation,
  LatencySource,
} from './OutputLatencyCompensation';

export type {
  // Core types
  TrackTimingState,
  TrackSyncMetrics,
  CrossTrackSyncReport,
  ScheduledTrackEvent,
  TimingSyncConfig,

  // Options
  TrackRegistrationOptions,
  EventSchedulingOptions,
  EventPriority,

  // Interface
  ITrackTimingSynchronizer,

  // Events
  TimingEvents,
} from './types';

// TimingIsolationManager types
export type {
  IsolationPolicy,
  IsolatedTrackInfo,
  IsolationReport,
} from './TimingIsolationManager';

// OutputLatencyCompensation types
export type {
  LatencyMeasurement,
  TrackLatencyInfo,
  LatencyCompensationConfig,
} from './OutputLatencyCompensation';
