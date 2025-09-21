/**
 * Playback Hooks Exports
 * Story 3.18.6: Widget Integration & Enhancement
 *
 * Professional React hooks for audio operations.
 * These hooks provide clean abstractions over the core services
 * and hide Tone.js complexity from widget developers.
 */

export { useAudio } from './useAudio.js';
export type { UseAudioResult } from './useAudio.js';

export { useTransport } from './useTransport.js';
export type { UseTransportResult } from './useTransport.js';

export { usePlugins } from './usePlugins.js';
export type { UsePluginsResult } from './usePlugins.js';

export { useTrack } from './useTrack.js';
export type { UseTrackOptions, UseTrackResult } from './useTrack.js';

// Modern hook - use this instead of useCorePlaybackEngine
export { useCoreServices } from './useCoreServices.js';
export type {
  UseCoreServicesOptions,
  UseCoreServicesReturn,
  CoreServicesState,
} from './useCoreServices.js';

// Migration support
export {
  useTrackMigration,
  usePlaybackStateMigrated,
} from './useTrackMigration.js';
export type {
  UseTrackMigrationOptions,
  UseTrackMigrationReturn,
} from './useTrackMigration.js';

// Legacy hooks (will be deprecated)
export { useAssetLoading } from './useAssetLoading.js';
export { useCorePlaybackEngine } from './useCorePlaybackEngine.js';
export { usePlaybackState } from './usePlaybackState.js';
export { useToneInit } from './useToneInit.js';
