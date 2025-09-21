/**
 * Playback Domain Repositories
 *
 * Central export point for all playback domain repositories
 */

// Value Objects
export * from './value-objects/index.js';

// Entities
export * from './entities/index.js';

// Interfaces
export type { ITrackRepository } from './interfaces/ITrackRepository.js';
export type { IPluginPresetRepository } from './interfaces/IPluginPresetRepository.js';
export type { ITransportRepository } from './interfaces/ITransportRepository.js';

// Track Repository
export {
  createTrackRepository,
  useTrackRepositoryStore,
  type TrackRepositoryState,
} from './track/index.js';

// Plugin Preset Repository
export { PluginPresetRepository } from './plugin-preset/PluginPresetRepository.js';

// Transport Repository
export { TransportRepository } from './transport/TransportRepository.js';
export { useTransportRepositoryStore } from './transport/TransportRepositoryStore.js';

// React Hooks
export * from './hooks/useTrack.js';

// Import necessary items for the factory
import { createTrackRepository } from './track/index.js';
import { PluginPresetRepository } from './plugin-preset/PluginPresetRepository.js';
import { TransportRepository } from './transport/TransportRepository.js';

// Factory function to create all repositories
export function createPlaybackRepositories() {
  return {
    track: createTrackRepository(),
    pluginPreset: new PluginPresetRepository(),
    transport: new TransportRepository(),
  };
}

// Service integration
export { RepositoryService } from './services/RepositoryService.js';
export {
  registerPlaybackRepositories,
  getRepositoryService,
  getTrackRepository,
  getPluginPresetRepository,
  getTransportRepository,
} from './services/registerRepositories.js';
