/**
 * Track - Re-export from modules
 *
 * This file maintains backward compatibility by re-exporting Track
 * from the new modular location.
 */

export { Track } from '../../modules/tracks/core/Track.js';
export type {
  TrackConfig,
  TrackLifecycle,
  TrackMixingState,
  TrackRouting,
  TrackSyncConfig,
  TrackMetrics,
  TrackAutomation,
  TrackSend,
} from '../../types/track.js';
export { TrackState } from '../../types/track.js';
