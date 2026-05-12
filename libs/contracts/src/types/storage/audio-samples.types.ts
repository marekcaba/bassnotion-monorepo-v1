/**
 * Audio Sample Management Types
 * Types for audio sample metadata, caching, streaming, and analytics.
 * These are the most actively used storage types in the codebase.
 *
 * @module storage/audio-samples
 */

import type { AssetMetadata } from './base.types.js';

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Audio sample formats supported by the system
 */
export type AudioSampleFormat =
  | 'wav'
  | 'mp3'
  | 'ogg'
  | 'flac'
  | 'aac'
  | 'm4a'
  | 'webm';

/**
 * Audio sample quality profiles for different use cases
 */
export type AudioSampleQualityProfile =
  | 'studio' // Highest quality for professional use
  | 'performance' // High quality for live performance
  | 'practice' // Balanced quality for practice sessions
  | 'preview' // Lower quality for quick previews
  | 'mobile' // Optimized for mobile devices
  | 'streaming'; // Optimized for streaming

/**
 * Audio sample categories for organization
 */
export type AudioSampleCategory =
  | 'bass_notes'
  | 'drum_hits'
  | 'ambient_tracks'
  | 'backing_tracks'
  | 'sound_effects'
  | 'instrument_samples'
  | 'vocal_samples'
  | 'percussion'
  | 'synthesized'
  | 'acoustic';

// ============================================================================
// Metadata Interfaces
// ============================================================================

/**
 * Comprehensive metadata for audio samples
 */
export interface AudioSampleMetadata extends AssetMetadata {
  // Audio technical properties
  duration: number; // Duration in seconds
  sampleRate: number; // Sample rate in Hz
  bitDepth: number; // Bit depth (16, 24, 32)
  channels: number; // Number of audio channels
  bitRate: number; // Bit rate in kbps
  format: AudioSampleFormat;

  // Musical properties
  tempo?: number; // BPM if applicable
  key?: string; // Musical key
  timeSignature?: string; // Time signature (e.g., "4/4")
  genre?: string; // Musical genre
  instrument?: string; // Primary instrument

  // Sample classification
  category: AudioSampleCategory;
  tags: string[]; // Searchable tags
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';

  // Quality and processing
  qualityProfile: AudioSampleQualityProfile;
  isProcessed: boolean; // Whether sample has been processed/optimized
  originalFormat?: AudioSampleFormat; // Original format before conversion
  compressionRatio?: number; // Compression ratio applied

  // Usage and analytics
  playCount: number; // Number of times played
  lastPlayed?: number; // Timestamp of last play
  averageRating?: number; // User rating (0-5)
  popularityScore: number; // Calculated popularity (0-1)

  // Professional metadata
  artist?: string; // Artist or creator
  album?: string; // Album or collection
  year?: number; // Year created/recorded
  copyright?: string; // Copyright information
  license?: string; // License type

  // Technical analysis
  peakAmplitude: number; // Peak amplitude (0-1)
  rmsLevel: number; // RMS level (0-1)
  dynamicRange: number; // Dynamic range in dB
  spectralCentroid?: number; // Spectral centroid for timbre analysis
  zeroCrossingRate?: number; // Zero crossing rate

  // Custom metadata
  customProperties: Record<string, unknown>;
}

// ============================================================================
// Library Configuration
// ============================================================================

/**
 * Quality thresholds for audio samples
 */
export interface AudioSampleQualityThresholds {
  minBitRate: number; // Minimum bit rate in kbps
  minDynamicRange: number; // Minimum dynamic range in dB
  maxNoiseFloor: number; // Maximum noise floor in dB
  minDuration: number; // Minimum duration in seconds
  maxDuration: number; // Maximum duration in seconds
}

/**
 * Audio sample library configuration
 */
export interface AudioSampleLibraryConfig {
  libraryId: string;
  name: string;
  description: string;
  version: string;

  // Organization
  categories: AudioSampleCategory[];
  tags: string[];
  defaultQualityProfile: AudioSampleQualityProfile;

  // Access control
  isPublic: boolean;
  accessLevel: 'free' | 'premium' | 'professional';
  requiredSubscription?: string;

  // Content management
  maxSamples: number;
  allowUserUploads: boolean;
  moderationRequired: boolean;
  autoTagging: boolean;

  // Quality standards
  minSampleRate: number;
  maxFileSize: number; // bytes
  allowedFormats: AudioSampleFormat[];
  qualityThresholds: AudioSampleQualityThresholds;

  // Analytics
  trackUsage: boolean;
  collectRatings: boolean;
  enableRecommendations: boolean;
}

/**
 * Statistics for audio sample libraries
 */
export interface AudioSampleLibraryStatistics {
  totalSamples: number;
  totalDuration: number; // Total duration in seconds
  totalSize: number; // Total size in bytes
  averageQuality: number; // Average quality score (0-1)
  categoryDistribution: Record<AudioSampleCategory, number>;
  formatDistribution: Record<AudioSampleFormat, number>;
  qualityDistribution: Record<AudioSampleQualityProfile, number>;
  popularSamples: string[]; // Sample IDs of most popular samples
  recentlyAdded: string[]; // Sample IDs of recently added samples
  topRated: string[]; // Sample IDs of top rated samples
}

/**
 * Audio sample library information
 */
export interface AudioSampleLibrary {
  config: AudioSampleLibraryConfig;
  samples: AudioSampleMetadata[];
  statistics: AudioSampleLibraryStatistics;
  lastUpdated: number;
  syncStatus: 'synced' | 'syncing' | 'error' | 'outdated';
}

// ============================================================================
// Streaming Configuration
// ============================================================================

/**
 * Bandwidth thresholds for adaptive streaming
 */
export interface BandwidthThresholds {
  excellent: number; // > X kbps
  good: number; // > X kbps
  fair: number; // > X kbps
  poor: number; // < X kbps
}

/**
 * Latency thresholds for adaptive streaming
 */
export interface LatencyThresholds {
  excellent: number; // < X ms
  good: number; // < X ms
  fair: number; // < X ms
  poor: number; // > X ms
}

/**
 * Adaptive audio streaming configuration
 */
export interface AdaptiveAudioStreamingConfig {
  enabled: boolean;

  // Quality adaptation
  enableQualityAdaptation: boolean;
  qualityLevels: AudioSampleQualityProfile[];
  adaptationStrategy: 'bandwidth' | 'device' | 'usage' | 'hybrid';

  // Progressive loading
  enableProgressiveLoading: boolean;
  chunkSize: number; // Chunk size in bytes
  preloadChunks: number; // Number of chunks to preload
  bufferSize: number; // Buffer size in seconds

  // Format optimization
  enableFormatOptimization: boolean;
  preferredFormats: AudioSampleFormat[]; // In order of preference
  fallbackFormats: AudioSampleFormat[];
  enableTranscoding: boolean;

  // Network adaptation
  bandwidthThresholds: BandwidthThresholds;
  latencyThresholds: LatencyThresholds;
  enableNetworkMonitoring: boolean;

  // Caching
  enableStreamingCache: boolean;
  cacheSize: number; // Cache size in bytes
  cacheTTL: number; // Cache TTL in ms

  // Performance
  maxConcurrentStreams: number;
  streamTimeout: number; // Stream timeout in ms
  retryAttempts: number;
  enableMetrics: boolean;
}

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Intelligent sample cache configuration
 */
export interface IntelligentSampleCacheConfig {
  enabled: boolean;

  // Cache sizing
  maxCacheSize: number; // Maximum cache size in bytes
  maxSamples: number; // Maximum number of samples
  reservedSpace: number; // Reserved space in bytes

  // Eviction strategy
  evictionStrategy: 'lru' | 'lfu' | 'usage_based' | 'intelligent';
  evictionThreshold: number; // Threshold to trigger eviction (0-1)

  // Usage-based optimization
  trackUsagePatterns: boolean;
  usageHistoryWindow: number; // Time window for usage tracking (ms)
  popularityWeight: number; // Weight for popularity in caching decisions (0-1)
  recencyWeight: number; // Weight for recency in caching decisions (0-1)

  // Predictive caching
  enablePredictiveCaching: boolean;
  predictionConfidenceThreshold: number; // Minimum confidence for predictive caching (0-1)
  maxPredictiveCacheSize: number; // Maximum size for predictive cache in bytes

  // Quality optimization
  enableQualityOptimization: boolean;
  cacheMultipleQualities: boolean;
  preferredQualityProfile: AudioSampleQualityProfile;

  // Performance
  enableBackgroundOptimization: boolean;
  optimizationInterval: number; // Optimization interval in ms
  enableCompression: boolean;
  compressionLevel: 'low' | 'medium' | 'high';

  // Analytics
  enableAnalytics: boolean;
  metricsRetentionPeriod: number; // Metrics retention in ms
}

/**
 * Sample cache entry information
 */
export interface SampleCacheEntry {
  sampleId: string;
  metadata: AudioSampleMetadata;
  data: ArrayBuffer;

  // Cache metadata
  cachedAt: number; // Timestamp when cached
  lastAccessed: number; // Timestamp of last access
  accessCount: number; // Number of times accessed
  size: number; // Size in bytes

  // Quality information
  qualityProfile: AudioSampleQualityProfile;
  compressionUsed: boolean;
  originalSize?: number; // Original size before compression

  // Usage analytics
  averagePlayDuration: number; // Average play duration in seconds
  completionRate: number; // How often sample is played to completion (0-1)
  userRating?: number; // User rating (0-5)

  // Predictive information
  predictedNextAccess?: number; // Predicted next access timestamp
  predictionConfidence?: number; // Confidence in prediction (0-1)

  // Status
  isValid: boolean; // Whether cache entry is valid
  needsRefresh: boolean; // Whether entry needs refresh
  isLocked: boolean; // Whether entry is locked (cannot be evicted)
}

// ============================================================================
// Analytics Configuration
// ============================================================================

/**
 * Quality thresholds for sample monitoring
 */
export interface SampleQualityThresholds {
  minAudioQuality: number; // Minimum audio quality score (0-1)
  maxLatency: number; // Maximum acceptable latency in ms
  minSuccessRate: number; // Minimum success rate (0-1)
  maxErrorRate: number; // Maximum error rate (0-1)
}

/**
 * Performance thresholds for sample monitoring
 */
export interface SamplePerformanceThresholds {
  maxLoadTime: number; // Maximum load time in ms
  minThroughput: number; // Minimum throughput in bytes/sec
  maxMemoryUsage: number; // Maximum memory usage in bytes
  maxCpuUsage: number; // Maximum CPU usage (0-1)
}

/**
 * Alert thresholds for sample monitoring
 */
export interface SampleAlertThresholds {
  qualityDegradation: number; // Quality degradation threshold (0-1)
  performanceDegradation: number; // Performance degradation threshold (0-1)
  errorRateIncrease: number; // Error rate increase threshold (0-1)
  usageAnomalies: number; // Usage anomaly threshold (0-1)
}

/**
 * Sample analytics configuration
 */
export interface SampleAnalyticsConfig {
  enabled: boolean;

  // Data collection
  trackPlayback: boolean;
  trackUserInteractions: boolean;
  trackPerformanceMetrics: boolean;
  trackQualityMetrics: boolean;

  // Quality monitoring
  enableQualityMonitoring: boolean;
  qualityCheckInterval: number; // Quality check interval in ms
  qualityThresholds: SampleQualityThresholds;

  // Performance monitoring
  enablePerformanceMonitoring: boolean;
  performanceMetricsInterval: number; // Performance metrics interval in ms
  performanceThresholds: SamplePerformanceThresholds;

  // Usage analytics
  enableUsageAnalytics: boolean;
  usageTrackingInterval: number; // Usage tracking interval in ms
  sessionTrackingEnabled: boolean;

  // Reporting
  enableReporting: boolean;
  reportingInterval: number; // Reporting interval in ms
  reportRetentionPeriod: number; // Report retention in ms

  // Alerts
  enableAlerts: boolean;
  alertThresholds: SampleAlertThresholds;
  alertChannels: string[]; // Alert delivery channels
}

// ============================================================================
// Metrics Interfaces
// ============================================================================

/**
 * Sample playback metrics
 */
export interface SamplePlaybackMetrics {
  totalPlays: number;
  totalDuration: number; // Total playback duration in seconds
  averagePlayDuration: number; // Average play duration in seconds
  completionRate: number; // Completion rate (0-1)
  skipRate: number; // Skip rate (0-1)
  repeatRate: number; // Repeat rate (0-1)
  lastPlayed: number; // Timestamp of last play
}

/**
 * Sample quality metrics
 */
export interface SampleQualityMetrics {
  audioQualityScore: number; // Audio quality score (0-1)
  compressionEfficiency: number; // Compression efficiency (0-1)
  dynamicRange: number; // Dynamic range in dB
  signalToNoiseRatio: number; // Signal to noise ratio in dB
  totalHarmonicDistortion: number; // THD percentage
  frequencyResponse: number[]; // Frequency response data
  qualityTrend: 'improving' | 'stable' | 'degrading';
}

/**
 * Sample performance metrics
 */
export interface SamplePerformanceMetrics {
  loadTime: number; // Load time in ms
  firstByteTime: number; // Time to first byte in ms
  throughput: number; // Throughput in bytes/sec
  memoryUsage: number; // Memory usage in bytes
  cpuUsage: number; // CPU usage (0-1)
  cacheHitRate: number; // Cache hit rate (0-1)
  errorRate: number; // Error rate (0-1)
  successRate: number; // Success rate (0-1)
}

/**
 * Sample usage metrics
 */
export interface SampleUsageMetrics {
  uniqueUsers: number; // Number of unique users
  sessionsWithSample: number; // Number of sessions including this sample
  averageSessionDuration: number; // Average session duration with sample in seconds
  peakUsageTime: number; // Peak usage time (hour of day)
  usageFrequency: number; // Usage frequency (plays per day)
  userRetention: number; // User retention rate (0-1)
  popularityRank: number; // Popularity rank among all samples
}

/**
 * Sample interaction metrics
 */
export interface SampleInteractionMetrics {
  likes: number; // Number of likes
  dislikes: number; // Number of dislikes
  shares: number; // Number of shares
  downloads: number; // Number of downloads
  bookmarks: number; // Number of bookmarks
  comments: number; // Number of comments
  averageRating: number; // Average user rating (0-5)
  ratingCount: number; // Number of ratings
  feedbackCount: number; // Number of feedback submissions
}

/**
 * Sample analytics data
 */
export interface SampleAnalyticsData {
  sampleId: string;
  timestamp: number;

  // Playback analytics
  playbackMetrics: SamplePlaybackMetrics;

  // Quality metrics
  qualityMetrics: SampleQualityMetrics;

  // Performance metrics
  performanceMetrics: SamplePerformanceMetrics;

  // Usage metrics
  usageMetrics: SampleUsageMetrics;

  // User interaction metrics
  interactionMetrics: SampleInteractionMetrics;
}

// ============================================================================
// Manager Configuration
// ============================================================================

/**
 * Audio sample manager configuration
 * Main configuration for the AudioSampleManager service
 */
export interface AudioSampleManagerConfig {
  // Core configuration
  enabled: boolean;
  libraryConfig: AudioSampleLibraryConfig;

  // Streaming
  streamingConfig: AdaptiveAudioStreamingConfig;

  // Caching
  cacheConfig: IntelligentSampleCacheConfig;

  // Analytics
  analyticsConfig: SampleAnalyticsConfig;

  // Processing
  enableBackgroundProcessing: boolean;
  processingConcurrency: number;
  processingTimeout: number; // ms

  // Quality
  defaultQualityProfile: AudioSampleQualityProfile;
  enableQualityOptimization: boolean;
  qualityOptimizationInterval: number; // ms

  // Performance
  maxConcurrentLoads: number;
  loadTimeout: number; // ms
  retryAttempts: number;
  retryDelay: number; // ms

  // Error handling
  enableErrorRecovery: boolean;
  maxErrorsBeforeDisable: number;
  errorRecoveryDelay: number; // ms
}

/**
 * Audio sample operation result
 */
export interface AudioSampleOperationResult {
  success: boolean;
  sampleId?: string;
  metadata?: AudioSampleMetadata;
  data?: ArrayBuffer;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metrics: {
    duration: number; // Operation duration in ms
    size?: number; // Data size in bytes
    cached: boolean;
    quality: AudioSampleQualityProfile;
  };
}
