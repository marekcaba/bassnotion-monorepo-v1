/**
 * Cache Synchronization Engine - Re-export from modules
 *
 * @deprecated Use import from '@/domains/playback/modules/storage' instead
 */

export { CacheSynchronizationEngine } from '../../../modules/storage/sync/CacheSynchronizationEngine.js';
export type {
  CacheLayer,
  ConflictType,
  SyncEventType,
  SyncPriority,
  SynchronizationStrategy,
  CacheConflictResolution,
  CacheSynchronizationConfig,
  CacheLayerConfig,
  CacheEntry,
  SynchronizationEvent,
  ConflictInfo,
  SynchronizationResult,
  ConflictResolutionResult,
  SyncOperationResult,
  SyncState,
  LayerSyncStatus,
  SyncAnalytics,
} from '../../../modules/storage/sync/CacheSynchronizationEngine.js';
