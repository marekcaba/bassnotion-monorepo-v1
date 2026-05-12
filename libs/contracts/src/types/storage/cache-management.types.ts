/**
 * Advanced Multi-Level Cache Management Types
 * Story 2.4 Task 6: Advanced Multi-Level Caching System
 *
 * Types for intelligent caching across multiple storage layers (memory,
 * IndexedDB, ServiceWorker), ML-optimized routing, compression, and
 * synchronization.
 *
 * @module storage/cache-management
 */

import type { CacheLayer } from './base.types.js';
import type { SampleCacheEntry } from './audio-samples.types.js';

// Re-export CacheLayer for convenience
export type { CacheLayer } from './base.types.js';

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Cache conflict resolution strategy
 */
export type CacheConflictResolution =
  | 'last_write_wins'
  | 'first_write_wins'
  | 'merge_changes'
  | 'user_decision'
  | 'ml_optimized';

/**
 * Cache optimization categories for suggestions
 */
export type CacheOptimizationCategory =
  | 'routing_optimization'
  | 'compression_tuning'
  | 'eviction_strategy'
  | 'layer_balancing'
  | 'sync_optimization'
  | 'ml_model_tuning';

// ============================================================================
// Core Configuration Interfaces
// ============================================================================

/**
 * Advanced Multi-Level Cache Manager Configuration
 * Story 2.4 Task 6: Advanced Multi-Level Caching System
 */
export interface AdvancedCacheManagerConfig {
  enabled: boolean;

  // Core cache configuration
  globalConfig: GlobalCacheConfig;

  // Multi-level cache layers
  memoryCache: MemoryCacheLayerConfig;
  indexedDBCache: IndexedDBCacheLayerConfig;
  serviceWorkerCache: ServiceWorkerCacheLayerConfig;

  // Intelligent routing
  routingConfig: CacheRoutingConfig;

  // Machine learning optimization
  mlOptimizationConfig: MLCacheOptimizationConfig;

  // Compression and quality
  compressionConfig: IntelligentCompressionConfig;

  // Synchronization
  syncConfig: CacheSynchronizationConfig;

  // Analytics and monitoring
  analyticsConfig: CacheAnalyticsConfig;

  // Performance settings
  maxConcurrentOperations: number;
  operationTimeout: number; // ms
  enableBackgroundOptimization: boolean;
  optimizationInterval: number; // ms

  // Error handling
  enableErrorRecovery: boolean;
  maxRetryAttempts: number;
  retryBackoffMs: number;
}

/**
 * Global cache configuration
 */
export interface GlobalCacheConfig {
  maxTotalSize: number; // Total cache size across all layers in bytes
  maxTotalItems: number; // Maximum total items across all layers
  enableGlobalEviction: boolean;
  globalEvictionStrategy: 'round_robin' | 'priority_based' | 'ml_optimized';
  enableCrossLayerOptimization: boolean;
  enableGlobalAnalytics: boolean;
}

// ============================================================================
// Cache Layer Configurations
// ============================================================================

/**
 * Memory cache layer configuration
 */
export interface MemoryCacheLayerConfig {
  enabled: boolean;
  maxSize: number; // bytes
  maxItems: number;
  priority: number; // 1-10, higher = more priority
  evictionStrategy: 'lru' | 'lfu' | 'adaptive';
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  persistOnClose: boolean;
}

/**
 * IndexedDB cache layer configuration
 */
export interface IndexedDBCacheLayerConfig {
  enabled: boolean;
  maxSize: number; // bytes
  maxItems: number;
  priority: number; // 1-10
  dbName: string;
  dbVersion: number;
  storeName: string;
  indexedFields: string[];
  enableTransactions: boolean;
  batchSize: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

/**
 * Service Worker cache layer configuration
 */
export interface ServiceWorkerCacheLayerConfig {
  enabled: boolean;
  maxSize: number; // bytes
  maxItems: number;
  priority: number; // 1-10
  cacheName: string;
  enableNetworkFirst: boolean;
  enableCacheFirst: boolean;
  enableStaleWhileRevalidate: boolean;
  maxAge: number; // ms
  compressionEnabled: boolean;
}

// ============================================================================
// Routing Configuration
// ============================================================================

/**
 * Cache routing configuration
 */
export interface CacheRoutingConfig {
  enabled: boolean;
  routingStrategy: 'size_based' | 'frequency_based' | 'ml_optimized' | 'hybrid';

  // Size-based routing thresholds
  memoryThreshold: number; // bytes - items smaller go to memory
  indexedDBThreshold: number; // bytes - items larger go to IndexedDB

  // Frequency-based routing
  highFrequencyThreshold: number; // accesses per hour
  mediumFrequencyThreshold: number; // accesses per hour

  // ML-based routing
  enableMLPrediction: boolean;
  predictionConfidenceThreshold: number; // 0-1

  // Fallback configuration
  enableFallbackRouting: boolean;
  fallbackOrder: CacheLayer[];
}

// ============================================================================
// ML Optimization Configuration
// ============================================================================

/**
 * Machine learning cache optimization configuration
 */
export interface MLCacheOptimizationConfig {
  enabled: boolean;

  // Model configuration
  modelType: 'decision_tree' | 'neural_network' | 'ensemble';
  trainingDataRetention: number; // days
  retrainingInterval: number; // ms

  // Feature engineering
  enableTemporalFeatures: boolean;
  enableBehavioralFeatures: boolean;
  enableContextualFeatures: boolean;
  enableContentFeatures: boolean;

  // Prediction targets
  predictAccessProbability: boolean;
  predictOptimalLayer: boolean;
  predictEvictionTiming: boolean;
  predictCompressionBenefit: boolean;

  // Model evaluation
  enableCrossValidation: boolean;
  validationSplitRatio: number; // 0-1
  enableABTesting: boolean;

  // Performance thresholds
  minAccuracy: number; // 0-1
  maxPredictionLatency: number; // ms
  modelUpdateThreshold: number; // accuracy drop threshold
}

// ============================================================================
// Compression Configuration
// ============================================================================

/**
 * Intelligent compression configuration
 */
export interface IntelligentCompressionConfig {
  enabled: boolean;

  // Format-specific compression
  audioCompression: AudioCompressionConfig;
  midiCompression: MIDICompressionConfig;
  metadataCompression: MetadataCompressionConfig;

  // Adaptive compression
  enableAdaptiveCompression: boolean;
  compressionLevelAdaptation:
    | 'bandwidth'
    | 'storage'
    | 'performance'
    | 'quality';

  // Quality preservation
  enableQualityMonitoring: boolean;
  minQualityThreshold: number; // 0-1
  qualityRecoveryEnabled: boolean;

  // Performance optimization
  enableParallelCompression: boolean;
  maxCompressionWorkers: number;
  compressionTimeout: number; // ms

  // Advanced features
  enableDeltaCompression: boolean;
  enableDeduplication: boolean;
  enableContextualCompression: boolean;
}

/**
 * Audio compression configuration
 */
export interface AudioCompressionConfig {
  enabled: boolean;
  defaultLevel: 'lossless' | 'high' | 'medium' | 'low';
  enableAdaptiveQuality: boolean;
  preserveMetadata: boolean;
  enableFrequencyOptimization: boolean;
  enableDynamicRangeCompression: boolean;
  targetBitrates: Record<string, number>; // quality -> bitrate
}

/**
 * MIDI compression configuration
 */
export interface MIDICompressionConfig {
  enabled: boolean;
  enableEventCompression: boolean;
  enableTimingOptimization: boolean;
  enableRedundancyRemoval: boolean;
  preserveMusicalIntegrity: boolean;
  compressionRatio: number; // target compression ratio
}

/**
 * Metadata compression configuration
 */
export interface MetadataCompressionConfig {
  enabled: boolean;
  enableSchemaCompression: boolean;
  enableValueCompression: boolean;
  preserveSearchability: boolean;
  compressionAlgorithm: 'gzip' | 'brotli' | 'zstd';
}

// ============================================================================
// Synchronization Configuration
// ============================================================================

/**
 * Cache synchronization configuration
 */
export interface CacheSynchronizationConfig {
  enabled: boolean;

  // Sync strategy
  syncStrategy:
    | 'eventual_consistency'
    | 'strong_consistency'
    | 'session_consistency';
  conflictResolution: CacheConflictResolution;

  // Sync timing
  syncInterval: number; // ms
  batchSyncEnabled: boolean;
  maxBatchSize: number;

  // Conflict detection
  enableConflictDetection: boolean;
  conflictDetectionMethod: 'timestamp' | 'checksum' | 'version_vector';

  // Merge strategies
  enableIntelligentMerging: boolean;
  mergePreference:
    | 'latest'
    | 'most_accessed'
    | 'highest_quality'
    | 'user_preference';

  // Cross-layer synchronization
  enableCrossLayerSync: boolean;
  syncPriority: CacheLayer[];

  // Network optimization
  enableDeltaSync: boolean;
  compressionEnabled: boolean;
  enableBandwidthAdaptation: boolean;
}

// ============================================================================
// Analytics Configuration
// ============================================================================

/**
 * Cache analytics configuration
 */
export interface CacheAnalyticsConfig {
  enabled: boolean;

  // Data collection
  trackLayerPerformance: boolean;
  trackRoutingDecisions: boolean;
  trackCompressionEfficiency: boolean;
  trackSyncOperations: boolean;
  trackMLPredictions: boolean;

  // Performance monitoring
  enableRealTimeMonitoring: boolean;
  monitoringInterval: number; // ms
  performanceThresholds: CachePerformanceThresholds;

  // Usage analytics
  enableUsagePatternAnalysis: boolean;
  usageAnalysisWindow: number; // ms
  enableCrossLayerAnalysis: boolean;

  // Optimization recommendations
  enableOptimizationSuggestions: boolean;
  suggestionCategories: CacheOptimizationCategory[];

  // Reporting
  enableReporting: boolean;
  reportingInterval: number; // ms
  reportRetentionPeriod: number; // ms
}

/**
 * Cache performance thresholds
 */
export interface CachePerformanceThresholds {
  maxLatency: Record<CacheLayer, number>; // ms per layer
  minHitRate: Record<CacheLayer, number>; // 0-1 per layer
  maxMemoryUsage: Record<CacheLayer, number>; // bytes per layer
  maxEvictionRate: Record<CacheLayer, number>; // evictions per minute
}

// ============================================================================
// Advanced Cache Entry Interfaces
// ============================================================================

/**
 * Advanced cache entry extending SampleCacheEntry with multi-level caching features
 */
export interface AdvancedCacheEntry extends SampleCacheEntry {
  // Layer distribution
  layers: CacheLayerDistribution;

  // ML predictions
  accessPrediction: AccessPrediction;
  layerPrediction: LayerPrediction;
  compressionBenefit: CompressionBenefit;

  // Synchronization tracking
  syncStatus: CacheSyncStatus;
  syncOperations: SyncOperation[];

  // Quality tracking
  qualityScore: number; // 0-1
  compressionRatio?: number;

  // Performance tracking
  layerAccessTimes: Record<CacheLayer, number>; // ms per layer
  totalTransferTime: number; // ms for cross-layer transfers

  // Advanced metadata
  contentType: string;
  optimizationLevel: number; // 0-1
  isPriority: boolean;

  // Version tracking
  version: string;
  lastOptimized: number;
}

/**
 * Cache layer distribution tracking
 */
export interface CacheLayerDistribution {
  memory?: {
    present: boolean;
    size: number;
    compressed: boolean;
    lastAccessed: number;
  };
  indexeddb?: {
    present: boolean;
    size: number;
    compressed: boolean;
    lastAccessed: number;
    tableName: string;
  };
  serviceworker?: {
    present: boolean;
    size: number;
    compressed: boolean;
    lastAccessed: number;
    cacheName: string;
  };
}

// ============================================================================
// ML Prediction Types
// ============================================================================

/**
 * ML access prediction
 */
export interface AccessPrediction {
  probability: number; // 0-1 probability of access in next period
  confidence: number; // 0-1 confidence in prediction
  timeframe: number; // ms prediction timeframe
  factors: CachePredictionFactor[];
  modelVersion: string;
  predictedAt: number;
}

/**
 * ML layer prediction for optimal storage
 */
export interface LayerPrediction {
  recommendedLayer: CacheLayer;
  confidence: number; // 0-1
  reasoning: string[];
  alternativeLayers: {
    layer: CacheLayer;
    score: number;
    pros: string[];
    cons: string[];
  }[];
  modelVersion: string;
  predictedAt: number;
}

/**
 * Compression benefit analysis
 */
export interface CompressionBenefit {
  recommended: boolean;
  expectedRatio: number; // expected compression ratio
  qualityImpact: number; // 0-1, 0 = no impact, 1 = significant impact
  performanceImpact: number; // ms overhead
  storageSavings: number; // bytes saved
  confidence: number; // 0-1
  algorithm: string;
  analyzedAt: number;
}

/**
 * Cache-specific prediction factors for ML models
 */
export interface CachePredictionFactor {
  name: string;
  weight: number; // 0-1
  value: number;
  description: string;
}

// ============================================================================
// Synchronization Types
// ============================================================================

/**
 * Cache synchronization status
 */
export interface CacheSyncStatus {
  isConsistent: boolean;
  lastSyncTime: number;
  pendingOperations: number;
  conflicts: CacheSyncConflict[];
  version: string;
  checksums: Record<CacheLayer, string>;
}

/**
 * Cache synchronization operation
 */
export interface SyncOperation {
  operationId: string;
  type: 'sync' | 'merge' | 'resolve_conflict' | 'update';
  sourceLayer: CacheLayer;
  targetLayer: CacheLayer;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Cache synchronization conflict
 */
export interface CacheSyncConflict {
  conflictId: string;
  layers: CacheLayer[];
  type: 'version_mismatch' | 'data_corruption' | 'timestamp_conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: number;
  resolution?: CacheConflictResolution;
  resolvedAt?: number;
  description: string;
}

// ============================================================================
// Operation Result Types
// ============================================================================

/**
 * Advanced cache operation result
 */
export interface AdvancedCacheOperationResult {
  success: boolean;
  operation: 'get' | 'set' | 'delete' | 'sync' | 'optimize' | 'route';
  sampleId: string;

  // Layer information
  layersAccessed: CacheLayer[];
  primaryLayer: CacheLayer;
  fallbackUsed: boolean;

  // Performance metrics
  totalTime: number; // ms
  layerTimes: Record<CacheLayer, number>; // ms per layer
  transferTime?: number; // ms for cross-layer transfers

  // Quality and efficiency
  qualityScore?: number; // 0-1
  compressionUsed: boolean;
  compressionRatio?: number;

  // ML predictions used
  predictionsUsed: {
    access: AccessPrediction;
    layer: LayerPrediction;
    compression: CompressionBenefit;
  };

  // Routing decisions
  routingDecision: {
    strategy: string;
    reasoning: string[];
    confidence: number;
    alternatives: string[];
  };

  // Error information
  error?: Error;
  warnings: string[];

  // Metadata
  timestamp: number;
  version: string;
  context?: Record<string, unknown>;
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Advanced cache analytics
 */
export interface AdvancedCacheAnalytics {
  // Overall metrics
  totalEntries: number;
  totalSize: number;
  layerDistribution: Record<CacheLayer, { count: number; size: number }>;

  // Performance metrics
  averageAccessTime: Record<CacheLayer, number>; // ms per layer
  hitRates: Record<CacheLayer, number>; // 0-1 per layer
  compressionEfficiency: number; // average compression ratio

  // ML model performance
  predictionAccuracy: {
    access: number; // 0-1
    layer: number; // 0-1
    compression: number; // 0-1
  };

  // Synchronization health
  syncHealth: {
    consistency: number; // 0-1
    conflictRate: number; // conflicts per hour
    averageSyncTime: number; // ms
  };

  // Quality metrics
  averageQualityScore: number; // 0-1
  qualityDistribution: number[]; // histogram

  // Optimization opportunities
  optimizationSuggestions: CacheOptimizationSuggestion[];

  // Trending data
  trends: {
    accessPatterns: Record<string, number>;
    layerPreferences: Record<CacheLayer, number>;
    compressionTrends: number[];
  };

  // Timestamp
  generatedAt: number;
  reportingPeriod: number; // ms
}

/**
 * Cache optimization suggestion
 */
export interface CacheOptimizationSuggestion {
  type: CacheOptimizationCategory;
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedBenefit: string;
  implementationEffort: 'low' | 'medium' | 'high';
  estimatedImpact: {
    performance: number; // 0-1 improvement
    storage: number; // bytes saved
    cost: number; // relative cost
  };
  actionItems: string[];
  detectedAt: number;
}
