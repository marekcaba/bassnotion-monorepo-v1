/**
 * Compression and Cache Synchronization Types
 *
 * Types for intelligent data compression across different asset types,
 * cache layer synchronization, conflict resolution, and analytics.
 *
 * @module storage/compression-sync
 */

import type {
  CacheLayer,
  CacheConflictResolution,
} from './cache-management.types.js';
import type { SyncPriority } from './base.types.js';
import type { AssetType } from './predictive-loading.types.js';

// ============================================================================
// Compression Type Aliases
// ============================================================================

/**
 * Conflict types for cache synchronization
 */
export type ConflictType =
  | 'timestamp_conflict'
  | 'version_conflict'
  | 'content_conflict'
  | 'metadata_conflict'
  | 'policy_conflict';

/**
 * Resolution strategy types
 */
export type ResolutionStrategy =
  | 'latest_wins'
  | 'merge_content'
  | 'user_prompt'
  | 'ml_resolution'
  | 'priority_based';

/**
 * Sync event types
 */
export type SyncEventType =
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'layer_registered'
  | 'layer_unregistered'
  | 'engine_initialized';

/**
 * Synchronization strategy
 */
export type SynchronizationStrategy =
  | 'eventual_consistency'
  | 'strong_consistency'
  | 'session_consistency'
  | 'causal_consistency';

// ============================================================================
// Compression Benefit Analysis
// ============================================================================

/**
 * Compression benefit analysis result
 */
export interface CompressionBenefitAnalysis {
  worthCompressing: boolean;
  projectedCompressionRatio: number;
  projectedSpaceSavings: number; // bytes
  projectedTransferTimeSavings: number; // ms
  estimatedCompressionTime: number; // ms
  confidence: number; // 0-1
  analysisMethod: 'quick' | 'detailed' | 'ml_prediction';
  factors: CompressionFactor[];
  recommendation: string;
  alternativeStrategies: CompressionStrategy[];
  recommended: boolean;
  expectedRatio: number;
  qualityImpact: number; // 0-1
  performanceImpact: number; // 0-1
  networkImpact: number; // 0-1
  resourceUsage: number; // 0-1
  timeToCompress: number; // ms
  storageSavings: number; // bytes
  algorithm: string;
  analyzedAt: number; // timestamp
}

/**
 * Compression factor affecting benefit analysis
 */
export interface CompressionFactor {
  factor: string;
  impact: number; // 0-1
  description: string;
  weight: number; // 0-1
}

// ============================================================================
// Compression Strategy Configuration
// ============================================================================

/**
 * Compression strategy definition
 */
export interface CompressionStrategy {
  algorithm:
    | 'gzip'
    | 'brotli'
    | 'zstd'
    | 'lz4'
    | 'audio_specific'
    | 'midi_specific'
    | 'text_optimized';
  level: number; // 1-9 for most algorithms
  qualityTarget: number; // 0-1, target quality preservation
  prioritizeSpeed: boolean;
  prioritizeSize: boolean;
  preserveMetadata: boolean;
  enableDeltaCompression: boolean;
  preset?: string; // optional preset configuration
  customParameters: Record<string, unknown>;
}

/**
 * General configuration for intelligent compression
 */
export interface CompressionConfig {
  enabled: boolean;
  defaultStrategy: CompressionStrategy;
  qualityThreshold: number; // 0-1
  maxCompressionTime: number; // ms
  enableAdaptiveCompression: boolean;
  enableQualityMonitoring: boolean;
  enablePerformanceMonitoring: boolean;
}

/**
 * Compression preset for quick configuration
 */
export interface CompressionPreset {
  name: string;
  description: string;
  strategy: CompressionStrategy;
  targetUseCase:
    | 'web_delivery'
    | 'storage_optimization'
    | 'bandwidth_limited'
    | 'quality_preservation';
  expectedRatio: number;
  expectedQuality: number; // 0-1
}

/**
 * Compression profile for specific scenarios
 */
export interface CompressionProfile {
  profileId: string;
  name: string;
  description: string;
  assetTypes: AssetType[];
  strategies: Record<AssetType, CompressionStrategy>;
  qualityThresholds: Record<AssetType, number>;
  compressionRatio: number; // achieved compression ratio
  qualityScore: number; // 0-1
  processingTime: 'low' | 'medium' | 'high';
  networkRequirement: 'low' | 'medium' | 'high';
  performanceTargets: {
    maxCompressionTime: number; // ms
    minCompressionRatio: number;
    minQualityScore: number; // 0-1
  };
  networkAdaptation: NetworkAdaptiveConfig;
  enabled: boolean;
  priority: number;
}

/**
 * Network adaptive configuration
 */
export interface NetworkAdaptiveConfig {
  bandwidth: number; // bytes/sec
  latency: number; // ms
  reliability: number; // 0-1
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  adaptiveEnabled: boolean;
  qualityScaling: boolean;
  aggressiveCompression: boolean;
}

// ============================================================================
// Compression Operation Results
// ============================================================================

/**
 * Compression operation result
 */
export interface CompressionOperationResult {
  success: boolean;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number; // ms
  compressedData: ArrayBuffer;
  strategy?: CompressionStrategy;
  qualityAssessment?: CompressionQualityAssessment;
  metadata?: Record<string, unknown>;
  error?: string;
}

/**
 * Compression result for internal operations
 */
export interface CompressionResult {
  compressedData: ArrayBuffer;
  metadata: Record<string, unknown>;
  algorithm: string;
  compressionRatio: number;
  qualityScore: number;
}

/**
 * Quality assessment for compressed data
 */
export interface CompressionQualityAssessment {
  qualityScore: number; // 0-1
  qualityPreserved: boolean;
  lossType: 'lossless' | 'lossy' | 'hybrid';
  degradationLevel: number; // 0-1
  recommendations: string[];
  metrics: CompressionQualityMetrics;
}

/**
 * Quality metrics for assessment
 */
export interface CompressionQualityMetrics {
  averageQualityScore: number; // 0-1
  qualityPreservationRate: number; // 0-1
  losslessOperations: number;
  lossyOperations: number;
  totalOperations: number;
}

/**
 * Performance metrics for compression operations
 */
export interface CompressionPerformanceMetrics {
  operationsPerSecond: number;
  averageThroughput: number; // bytes/sec
  averageLatency: number; // ms
  peakLatency: number; // ms
  cpuUsage: number; // 0-1
  memoryUsage: number; // bytes
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  errorRate: number; // 0-1
  operationCount: number;
}

/**
 * Compression analytics data
 */
export interface CompressionAnalytics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageCompressionRatio: number;
  averageCompressionTime: number; // ms
  totalSpaceSaved: number; // bytes
  performanceMetrics: CompressionPerformanceMetrics;
  qualityMetrics: CompressionQualityMetrics;
  operationsByType: Record<AssetType, number>;
  algorithmUsage: Record<string, number>;
  lastUpdated: number;
}

// ============================================================================
// Cache Layer Configuration
// ============================================================================

/**
 * Cache layer configuration
 */
export interface CacheLayerConfig {
  layerId: string;
  type: CacheLayer;
  enabled: boolean;
  priority: number;
  maxSize: number; // bytes
  ttl: number; // ms
  compressionEnabled: boolean;
  syncEnabled: boolean;
  conflictResolutionStrategy: CacheConflictResolution;
}

/**
 * Cache entry for synchronization
 */
export interface CacheEntry {
  key: string;
  value: unknown;
  metadata: CacheMetadata;
  layerId: string;
  timestamp: number;
  ttl: number;
  size: number;
  compressed: boolean;
  syncVersion: number;
}

/**
 * Cache metadata for entries
 */
export interface CacheMetadata {
  contentType: string;
  encoding?: string;
  checksum: string;
  lastModified: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
  tags: string[];
  priority: SyncPriority;
  customMetadata: Record<string, unknown>;
}

// ============================================================================
// Synchronization Results
// ============================================================================

/**
 * Synchronization result
 */
export interface SynchronizationResult {
  success: boolean;
  operationId: string;
  syncedLayers: number;
  failedLayers: number;
  conflicts: ConflictInfo[];
  duration: number; // ms
  metadata: Record<string, unknown>;
}

/**
 * Sync operation result
 */
export interface SyncOperationResult {
  success: boolean;
  operationId: string;
  layerId: string;
  hasConflict: boolean;
  conflictInfo?: ConflictInfo;
  duration: number; // ms
  error?: string;
}

/**
 * Synchronization event
 */
export interface SynchronizationEvent {
  eventId: string;
  type: SyncEventType;
  timestamp: number;
  layerId?: string;
  entryKey?: string;
  data: unknown;
  source: string;
}

// ============================================================================
// Conflict Management
// ============================================================================

/**
 * Conflict information
 */
export interface ConflictInfo {
  conflictId: string;
  type: ConflictType;
  sourceLayerId: string;
  targetLayerId: string;
  entryKey: string;
  sourceValue: unknown;
  targetValue: unknown;
  detectedAt: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolutionStrategy?: CacheConflictResolution;
  autoResolvable: boolean;
  conflictingEntries: CacheEntry[];
}

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
  success: boolean;
  conflictId: string;
  resolution: CacheConflictResolution;
  resolvedValue: unknown;
  affectedLayers: string[];
  resolutionTime: number; // ms
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Merge strategy for conflicts
 */
export interface MergeStrategy {
  strategyId: string;
  name: string;
  description: string;
  applicableConflictTypes: ConflictType[];
  mergeFunction: (
    sourceValue: unknown,
    targetValue: unknown,
    metadata: unknown,
  ) => unknown;
  priority: number;
  enabled: boolean;
}

// ============================================================================
// Sync Analytics and State
// ============================================================================

/**
 * Sync analytics data
 */
export interface SyncAnalytics {
  totalSyncOperations: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflictsDetected: number;
  conflictsResolved: number;
  averageSyncTime: number; // ms
  layerSyncStats: Record<string, LayerSyncStatus>;
  lastSyncTime: number;
  performanceMetrics: SyncPerformanceMetrics;
}

/**
 * Cross-layer sync configuration
 */
export interface CrossLayerSyncConfig {
  enabled: boolean;
  syncPairs: Array<{
    source: CacheLayer;
    target: CacheLayer;
    bidirectional: boolean;
    priority: number;
  }>;
  batchSize: number;
  syncInterval: number; // ms
  conflictResolution: CacheConflictResolution;
}

/**
 * Sync state tracking
 */
export interface SyncState {
  isActive: boolean;
  lastFullSync: number;
  syncVersion: number;
  layerStates: Map<string, LayerSyncStatus>;
  pendingOperations: Map<string, SyncOperationResult[]>;
  conflictQueue: ConflictInfo[];
}

/**
 * Layer sync status
 */
export interface LayerSyncStatus {
  layerId: string;
  status: 'idle' | 'syncing' | 'error' | 'conflict';
  lastSync: number;
  syncVersion: number;
  pendingOperations: number;
  conflictCount: number;
  errorCount: number;
  config: CacheLayerConfig;
}

/**
 * Sync performance metrics
 */
export interface SyncPerformanceMetrics {
  throughput: number; // operations per second
  latency: number; // ms
  errorRate: number; // 0-1
  conflictRate: number; // 0-1
  resourceUsage: {
    cpu: number; // 0-1
    memory: number; // bytes
    network: number; // bytes/sec
  };
}
