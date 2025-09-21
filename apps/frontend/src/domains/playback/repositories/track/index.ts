/**
 * Track Repository Factory
 *
 * Creates the complete track repository stack with caching and error handling
 */

import { ITrackRepository } from '../interfaces/ITrackRepository.js';
import { TrackRepository } from './TrackRepository.js';
import { CachedTrackRepository } from './CachedTrackRepository.js';
import { ResultTrackRepository } from './ResultTrackRepository.js';

/**
 * Create a track repository with all layers
 */
export function createTrackRepository(): ITrackRepository & {
  clearCache?: () => void;
  saveWithResult?: (track: any) => Promise<any>;
  deleteWithResult?: (id: any) => Promise<any>;
  deleteAllWithResult?: () => Promise<any>;
} {
  const base = new TrackRepository();
  const cached = new CachedTrackRepository(base);
  const withResult = new ResultTrackRepository(cached);

  // Return the result repository with additional methods exposed
  return Object.assign(withResult, {
    clearCache: () => cached.clearCache(),
    saveWithResult: withResult.saveWithResult.bind(withResult),
    deleteWithResult: withResult.deleteWithResult.bind(withResult),
    deleteAllWithResult: withResult.deleteAllWithResult.bind(withResult),
  });
}

// Export all repository classes for testing
export { TrackRepository } from './TrackRepository.js';
export { CachedTrackRepository } from './CachedTrackRepository.js';
export { ResultTrackRepository } from './ResultTrackRepository.js';

// Export the store
export { useTrackRepositoryStore } from './TrackRepositoryStore.js';
export type { TrackRepositoryState } from './TrackRepositoryStore.js';
