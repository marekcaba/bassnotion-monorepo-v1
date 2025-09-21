/**
 * Timing Isolation Manager
 *
 * This file now re-exports from the modular implementation.
 * The original functionality has been moved to modules/tracks/timing/TimingIsolationManager.ts
 *
 * @deprecated Use imports from '@/domains/playback/modules/tracks/timing' directly
 */

export {
  TimingIsolationManager,
  type IsolationPolicy,
  type IsolatedTrackInfo,
  type IsolationReport,
} from '../../modules/tracks/timing/TimingIsolationManager.js';
