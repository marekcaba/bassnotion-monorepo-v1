/**
 * Global Sample Cache - Re-export from modules
 *
 * @deprecated Use import from '@/domains/playback/modules/storage' instead
 */

export {
  GlobalSampleCacheImpl as GlobalSampleCache,
  GlobalSampleCacheImpl,
} from '../../modules/storage/cache/GlobalSampleCache.js';

export type {
  CachedSample,
  CachedInstrument,
  GlobalCacheStats,
} from '../../modules/storage/cache/GlobalSampleCache.js';
