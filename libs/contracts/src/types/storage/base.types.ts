/**
 * Storage Base Types
 * Foundational types with NO dependencies on other storage types.
 * These are the building blocks used by all other storage type files.
 *
 * @module storage/base
 */

// ============================================================================
// Primitive Type Aliases
// ============================================================================

/**
 * Circuit breaker state for connection resilience
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error category classification
 */
export type ErrorCategory =
  | 'network'
  | 'authentication'
  | 'storage'
  | 'processing'
  | 'configuration'
  | 'resource'
  | 'unknown';

/**
 * Degradation levels for graceful service degradation
 */
export type DegradationLevel = 'none' | 'partial' | 'minimal' | 'emergency';

/**
 * Cache layer identifiers
 */
export type CacheLayer = 'memory' | 'indexeddb' | 'serviceworker';

/**
 * Synchronization priority levels
 */
export type SyncPriority = 'low' | 'normal' | 'high' | 'critical';

// ============================================================================
// Base Interfaces (No Dependencies)
// ============================================================================

/**
 * Base storage error type - extended by all specific error types
 */
export interface StorageError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  retryable: boolean;
  severity: ErrorSeverity;
}

/**
 * Base asset metadata - extended by audio, MIDI, and other asset types
 */
export interface AssetMetadata {
  bucket: string;
  path: string;
  size: number;
  downloadTime: number;
  source: 'supabase-storage' | 'supabase-backup' | 'cdn' | 'cache';
  compressionUsed?: boolean;
  qualityLevel?: number;
  cacheHit?: boolean;
}

/**
 * Device information for security and analytics tracking
 */
export interface DeviceInfo {
  userAgent: string;
  platform: string;
  deviceId: string;
  browserFingerprint: string;
  screenResolution: string;
  timezone: string;
}

/**
 * Location information for security monitoring
 */
export interface LocationInfo {
  country?: string;
  region?: string;
  city?: string;
  ipAddress: string;
  isVpn?: boolean;
  isTrustedLocation: boolean;
}

/**
 * Bandwidth monitoring metrics
 */
export interface BandwidthMonitor {
  currentSpeed: number; // bytes/sec
  averageSpeed: number; // bytes/sec
  peakSpeed: number; // bytes/sec
  stability: number; // 0-1
  networkType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
}

/**
 * Connection health status
 */
export interface ConnectionHealth {
  isHealthy: boolean;
  averageLatency: number;
  errorRate: number;
  lastCheck: number;
  uptime: number;
  activeConnections?: number;
}

/**
 * Storage performance metrics
 */
export interface StorageMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  lastRequestTime: number;
  cacheHitRate: number;
  cdnHitRate: number;
  compressionSavings: number; // Bytes saved through compression
}

/**
 * Basic retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  baseDelay: number; // ms
  maxDelay: number; // ms
  retryCondition: (error: Error) => boolean;
}

/**
 * Cache request configuration
 */
export interface CacheRequestConfig {
  enabled: boolean;
  key: string;
  ttl: number; // ms
  tags: string[];
  invalidateOnError: boolean;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenMaxCalls?: number;
}

/**
 * Enhanced CircuitBreaker interface with additional methods for logging
 */
export interface CircuitBreaker {
  isOpen(): boolean;
  execute<T>(operation: () => Promise<T>): Promise<T>;
  recordSuccess(): void;
  recordFailure(): void;
  getState(): CircuitBreakerState;
  getPreviousState(): CircuitBreakerState;
  getFailureCount(): number;
  reset(): void;
}

/**
 * Geographic optimization settings
 */
export interface GeographicOptimizationConfig {
  enabled: boolean;
  primaryRegion: string;
  fallbackRegions: string[];
  latencyThreshold: number; // ms
  autoFailover: boolean;
}

/**
 * Download options for asset retrieval
 */
export interface DownloadOptions {
  priority?: 'high' | 'medium' | 'low';
  timeout?: number;
  useCache?: boolean;
  allowCDNFallback?: boolean;
  compressionLevel?: 'none' | 'low' | 'medium' | 'high';
  qualityPreference?: 'speed' | 'quality' | 'balanced';
}

/**
 * Download result containing data and metadata
 */
export interface DownloadResult {
  data: Blob;
  metadata: AssetMetadata;
}

/**
 * Storage provider configuration
 */
export interface StorageProvider {
  name: string;
  type: 'primary' | 'backup' | 'cdn';
  url: string;
  region: string;
  availability: number; // 0-1
  latency: number; // ms
  costPerGB: number;
  features: string[];
}

/**
 * Asset delivery optimization settings
 */
export interface DeliveryOptimization {
  compressionEnabled: boolean;
  formatConversion: boolean;
  qualityAdaptation: boolean;
  chunkingEnabled: boolean;
  parallelDownloads: boolean;
  networkOptimization: boolean;
}

/**
 * Advanced caching configuration
 */
export interface AdvancedCacheConfig {
  enabled: boolean;
  maxSize: number; // bytes
  maxAge: number; // ms
  strategy: 'lru' | 'lfu' | 'ttl' | 'smart';
  compressionEnabled: boolean;
  persistToDisk: boolean;
  encryptionEnabled: boolean;
}

/**
 * Predictive loading configuration
 */
export interface PredictiveLoadingConfig {
  enabled: boolean;
  learningEnabled: boolean;
  aggressiveness: 'low' | 'medium' | 'high';
  userBehaviorAnalysis: boolean;
  preloadThreshold: number; // probability 0-1
  maxPreloadSize: number; // bytes
}

/**
 * Asset processing configuration
 */
export interface AssetProcessingConfig {
  audioNormalization: boolean;
  dynamicCompression: boolean;
  formatOptimization: boolean;
  qualityAdaptation: boolean;
  backgroundProcessing: boolean;
}

/**
 * Offline storage configuration
 */
export interface OfflineStorageConfig {
  enabled: boolean;
  maxSize: number; // bytes
  syncStrategy: 'immediate' | 'delayed' | 'manual';
  conflictResolution: 'server-wins' | 'client-wins' | 'merge';
  selectiveSync: boolean;
  compressionEnabled: boolean;
}

/**
 * Asset synchronization status
 */
export interface AssetSyncStatus {
  assetId: string;
  localVersion: string;
  serverVersion: string;
  status: 'synced' | 'pending' | 'conflict' | 'error';
  lastSync: number;
  size: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Asset analytics data
 */
export interface AssetAnalytics {
  assetId: string;
  downloadCount: number;
  averageLoadTime: number;
  successRate: number;
  popularityScore: number;
  lastAccessed: number;
  userEngagement: number;
  qualityFeedback: number;
}

/**
 * Loading experience configuration
 */
export interface LoadingExperienceConfig {
  progressIndicator: boolean;
  predictiveProgress: boolean;
  backgroundLoading: boolean;
  gracefulDegradation: boolean;
  userFeedback: boolean;
  adaptiveQuality: boolean;
}

/**
 * Smart prefetching configuration
 */
export interface SmartPrefetchConfig {
  enabled: boolean;
  userBehaviorWeight: number; // 0-1
  timeBasedWeight: number; // 0-1
  popularityWeight: number; // 0-1
  maxPrefetchCount: number;
  maxPrefetchSize: number; // bytes
  networkAwareThrottling: boolean;
}

/**
 * Asset optimization result
 */
export interface AssetOptimizationResult {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  qualityScore: number;
  processingTime: number;
  optimizationTechniques: string[];
}

/**
 * Asset request configuration
 */
export interface AssetRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  timeout: number;
  retryConfig: RetryConfig;
  cacheConfig: CacheRequestConfig;
}
