/**
 * Storage Module - Intelligent sample storage and asset management
 *
 * This module provides comprehensive storage capabilities including:
 * - Multi-layer caching with intelligent eviction
 * - Memory-aware storage decisions
 * - Predictive preloading strategies
 * - Storage provider abstraction
 * - Usage analytics and optimization
 */

// Cache infrastructure
export { SampleCache } from './cache/SampleCache.js';
export { CacheManager } from './cache/CacheManager.js';
export { MemoryManager } from './cache/MemoryManager.js';
export {
  GlobalSampleCache,
  GlobalSampleCacheImpl,
} from './cache/GlobalSampleCache.js';

// Types
export type {
  SampleCacheEntry,
  CacheConfig,
  CacheStats,
  CacheOperation,
} from './cache/SampleCache.js';

export type {
  CachedSample,
  CachedInstrument,
  GlobalCacheStats,
} from './cache/GlobalSampleCache.js';

export type {
  CacheLayer,
  CacheManagerConfig,
  CacheManagerStats,
} from './cache/CacheManager.js';

export type {
  MemoryPressureLevel,
  MemoryThresholds,
  MemoryManagerConfig,
  MemoryUsageInfo,
  MemoryRecommendation,
  MemorySnapshot,
} from './cache/MemoryManager.js';

// Loaders
export { SampleLoader } from './loaders/SampleLoader.js';
export { AssetLoader } from './loaders/AssetLoader.js';
export { PreloadStrategy } from './loaders/PreloadStrategy.js';
export {
  ToneBufferLoader,
  CachedToneBufferLoader,
} from './loaders/ToneBufferLoader.js';

// Loader types
export type {
  LoadOptions,
  LoadResult,
  SampleLoaderConfig,
} from './loaders/SampleLoader.js';

export type {
  AssetManifest,
  AssetDefinition,
  AssetType,
  QualityProfile,
  AssetLoadResult,
  BatchLoadProgress,
  AssetLoaderConfig,
} from './loaders/AssetLoader.js';

export type {
  PreloadPriority,
  PreloadItem,
  PreloadConfig,
  PreloadProgress,
  PreloadResult,
  UsagePattern,
  StrategyType,
} from './loaders/PreloadStrategy.js';

// Storage Providers
export { SupabaseProvider } from './providers/SupabaseProvider.js';
export { LocalProvider } from './providers/LocalProvider.js';
export {
  StorageProviderFactory,
  StorageProviderType,
} from './providers/StorageProvider.js';

// Provider types
export type {
  StorageProvider,
  StorageResult,
  UploadOptions,
  DownloadOptions,
  ListOptions,
  StorageObject,
  StorageMetrics,
} from './providers/StorageProvider.js';

export type { SupabaseProviderConfig } from './providers/SupabaseProvider.js';

export type {
  LocalProviderConfig,
  LocalStorageResult,
  LocalStorageObject,
} from './providers/LocalProvider.js';

// Analytics
export { UsageAnalytics } from './analytics/UsageAnalytics.js';
export { PerformanceMetrics } from './analytics/PerformanceMetrics.js';
export { CacheAnalyticsEngine } from './analytics/CacheAnalyticsEngine.js';

// Analytics types
export type {
  UsageAnalyticsConfig,
  UsageMetrics,
  UsagePattern,
  UsageAlert,
  UsageReport,
} from './analytics/UsageAnalytics.js';

export type {
  PerformanceMetricsConfig,
  OperationMetrics,
  PerformanceSummary,
  PerformanceTrace,
  TraceSpan,
  BottleneckAnalysis,
} from './analytics/PerformanceMetrics.js';

export type {
  CacheLayer,
  CacheOptimizationCategory,
  CacheAnalyticsConfig,
  CacheUsagePattern,
  CachePerformanceAnalysis,
  LayerPerformanceData,
  PerformanceBottleneck,
  PerformanceTrend,
  PerformancePrediction,
  CacheOptimizationOpportunity,
  CacheOptimizationSuggestion,
  CacheHealthScore,
  HealthFactor,
  AdvancedCacheAnalytics,
} from './analytics/CacheAnalyticsEngine.js';

// Batch Operations
export { BatchProcessor } from './batch/BatchProcessor.js';
export {
  BaseBatchStrategy,
  SizeBasedStrategy,
  PriorityBasedStrategy,
  TypeBasedStrategy,
  ResourceBasedStrategy,
  AdaptiveStrategy,
} from './batch/strategies/BatchStrategy.js';
export {
  StorageBatchExecutor,
  createStorageBatchExecutor,
} from './batch/executors/StorageBatchExecutor.js';

// Batch types
export type {
  BatchOperation,
  BatchResult,
  BatchProgress,
  BatchConfig,
  BatchExecutor,
  BatchProcessor as IBatchProcessor,
  BatchUploadOperation,
  BatchDownloadOperation,
  BatchDeleteOperation,
  BatchTransferResult,
  BatchStrategy,
  BatchMetrics,
} from './batch/types.js';

export {
  BatchError,
  BatchTimeoutError,
  BatchCancelledError,
} from './batch/types.js';

// CDN Optimization
export * from './cdn/index.js';

// Version Management
export * from './versioning/index.js';

// Resilience Patterns
export * from './resilience/index.js';
