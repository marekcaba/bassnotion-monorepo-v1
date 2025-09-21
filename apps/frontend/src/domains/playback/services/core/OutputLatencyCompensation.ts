/**
 * Output Latency Compensation System
 *
 * This file now re-exports from the modular implementation.
 * The original functionality has been moved to modules/tracks/timing/OutputLatencyCompensation.ts
 *
 * @deprecated Use imports from '@/domains/playback/modules/tracks/timing' directly
 */

export {
  OutputLatencyCompensation,
  LatencySource,
  type LatencyMeasurement,
  type TrackLatencyInfo,
  type LatencyCompensationConfig,
} from '../../modules/tracks/timing/OutputLatencyCompensation.js';
