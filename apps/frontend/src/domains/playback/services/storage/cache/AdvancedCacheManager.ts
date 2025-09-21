/**
 * Advanced Cache Manager
 *
 * This file now re-exports from the modular implementation.
 * The original functionality has been moved to modules/storage/advanced/AdvancedCacheManager.ts
 *
 * @deprecated Use imports from '@/domains/playback/modules/storage/advanced' directly
 */

export {
  AdvancedCacheManager,
  type CacheStrategy,
  type CachePriority,
  type CacheEntry,
  type CacheMetadata,
  type AdvancedCacheConfig,
  type CacheStatistics,
  type CachePerformanceReport,
} from '../../../modules/storage/advanced/AdvancedCacheManager.js';
