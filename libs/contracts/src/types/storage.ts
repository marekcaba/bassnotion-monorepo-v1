/**
 * Story 2.4: Advanced Asset Management & CDN Integration
 * Storage contracts for enterprise-grade asset management
 */

// Core storage client configuration
export interface SupabaseAssetClientConfig {
  supabaseUrl: string;
  supabaseKey: string;
  maxConnections?: number;
  failoverTimeout?: number;
  healthCheckInterval?: number;
  circuitBreakerThreshold?: number;
  retryAttempts?: number;
  retryBackoffMs?: number;
  enableGeographicOptimization?: boolean;
  primaryRegion?: string;
  backupRegions?: string[];
  backupUrls?: string[];
  requestTimeout?: number;
  authenticationConfig?: AuthenticationConfig;
  errorRecoveryConfig?: ErrorRecoveryConfig;
  bucketManagementConfig?: BucketManagementConfig;
  // Story 2.4 Subtask 1.5: Real-time monitoring configuration
  realTimeMonitoringConfig?: RealTimeMonitoringConfig;
  healthMonitoringConfig?: HealthMonitoringConfig;
  performanceAnalyticsConfig?: PerformanceAnalyticsConfig;
  alertingConfig?: AlertingConfig;
  monitoringIntegrations?: MonitoringIntegration[];

  // Story 2.4 Task 2: Global CDN Optimization System configuration
  cdnOptimizationConfig?: CDNOptimizationConfig;
}

// Asset download configuration
export interface DownloadOptions {
  priority?: 'high' | 'medium' | 'low';
  timeout?: number;
  useCache?: boolean;
  allowCDNFallback?: boolean;
  compressionLevel?: 'none' | 'low' | 'medium' | 'high';
  qualityPreference?: 'speed' | 'quality' | 'balanced';
}

// Asset download result
export interface DownloadResult {
  data: Blob;
  metadata: AssetMetadata;
}

// Asset metadata
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

// Storage performance metrics
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

// Connection health monitoring
export interface ConnectionHealth {
  isHealthy: boolean;
  averageLatency: number;
  errorRate: number;
  lastCheck: number;
  uptime: number;
  activeConnections?: number;
}

// CDN optimization configuration - removed duplicate, using comprehensive system below

// Geographic optimization settings
export interface GeographicOptimizationConfig {
  enabled: boolean;
  primaryRegion: string;
  fallbackRegions: string[];
  latencyThreshold: number; // ms
  autoFailover: boolean;
}

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenMaxCalls?: number;
}

// Enhanced CircuitBreaker interface with additional methods for logging
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

// Advanced caching configuration
export interface AdvancedCacheConfig {
  enabled: boolean;
  maxSize: number; // bytes
  maxAge: number; // ms
  strategy: 'lru' | 'lfu' | 'ttl' | 'smart';
  compressionEnabled: boolean;
  persistToDisk: boolean;
  encryptionEnabled: boolean;
}

// Predictive loading configuration
export interface PredictiveLoadingConfig {
  enabled: boolean;
  learningEnabled: boolean;
  aggressiveness: 'low' | 'medium' | 'high';
  userBehaviorAnalysis: boolean;
  preloadThreshold: number; // probability 0-1
  maxPreloadSize: number; // bytes
}

// Asset processing configuration
export interface AssetProcessingConfig {
  audioNormalization: boolean;
  dynamicCompression: boolean;
  formatOptimization: boolean;
  qualityAdaptation: boolean;
  backgroundProcessing: boolean;
}

// Storage error types
export interface StorageError {
  code: string;
  message: string;
  context?: Record<string, any>;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Offline storage configuration
export interface OfflineStorageConfig {
  enabled: boolean;
  maxSize: number; // bytes
  syncStrategy: 'immediate' | 'delayed' | 'manual';
  conflictResolution: 'server-wins' | 'client-wins' | 'merge';
  selectiveSync: boolean;
  compressionEnabled: boolean;
}

// Asset synchronization status
export interface AssetSyncStatus {
  assetId: string;
  localVersion: string;
  serverVersion: string;
  status: 'synced' | 'pending' | 'conflict' | 'error';
  lastSync: number;
  size: number;
  priority: 'high' | 'medium' | 'low';
}

// Analytics and monitoring
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

// Loading experience configuration
export interface LoadingExperienceConfig {
  progressIndicator: boolean;
  predictiveProgress: boolean;
  backgroundLoading: boolean;
  gracefulDegradation: boolean;
  userFeedback: boolean;
  adaptiveQuality: boolean;
}

// Smart prefetching configuration
export interface SmartPrefetchConfig {
  enabled: boolean;
  userBehaviorWeight: number; // 0-1
  timeBasedWeight: number; // 0-1
  popularityWeight: number; // 0-1
  maxPrefetchCount: number;
  maxPrefetchSize: number; // bytes
  networkAwareThrottling: boolean;
}

// Asset optimization result
export interface AssetOptimizationResult {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  qualityScore: number;
  processingTime: number;
  optimizationTechniques: string[];
}

// Storage provider interface
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

// Asset request configuration
export interface AssetRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  timeout: number;
  retryConfig: RetryConfig;
  cacheConfig: CacheRequestConfig;
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  baseDelay: number; // ms
  maxDelay: number; // ms
  retryCondition: (error: Error) => boolean;
}

// Cache request configuration
export interface CacheRequestConfig {
  enabled: boolean;
  key: string;
  ttl: number; // ms
  tags: string[];
  invalidateOnError: boolean;
}

// Bandwidth monitoring
export interface BandwidthMonitor {
  currentSpeed: number; // bytes/sec
  averageSpeed: number; // bytes/sec
  peakSpeed: number; // bytes/sec
  stability: number; // 0-1
  networkType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
}

// Asset delivery optimization
export interface DeliveryOptimization {
  compressionEnabled: boolean;
  formatConversion: boolean;
  qualityAdaptation: boolean;
  chunkingEnabled: boolean;
  parallelDownloads: boolean;
  networkOptimization: boolean;
}

// Authentication and Security Management Interfaces
// Story 2.4 Subtask 1.2: Sophisticated Authentication

// Authentication configuration
export interface AuthenticationConfig {
  enabled: boolean;
  tokenRefreshEnabled: boolean;
  sessionManagementEnabled: boolean;
  securityMonitoringEnabled: boolean;
  tokenRefreshConfig: TokenRefreshConfig;
  sessionConfig: SessionManagementConfig;
  securityConfig: SecurityMonitoringConfig;
}

// Token refresh configuration
export interface TokenRefreshConfig {
  enabled: boolean;
  refreshThresholdMinutes: number; // Refresh token X minutes before expiry
  maxRetryAttempts: number;
  retryBackoffMs: number;
  proactiveRefreshEnabled: boolean;
  refreshOnFailureEnabled: boolean;
  tokenValidationInterval: number; // ms
}

// Session management configuration
export interface SessionManagementConfig {
  enabled: boolean;
  persistSession: boolean;
  sessionTimeoutMinutes: number;
  multiTabSyncEnabled: boolean;
  sessionValidationInterval: number; // ms
  autoExtendSession: boolean;
  sessionStorageKey: string;
}

// Security monitoring configuration
export interface SecurityMonitoringConfig {
  enabled: boolean;
  trackAuthAttempts: boolean;
  trackSuspiciousActivity: boolean;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  reportToBackend: boolean;
  backendReportingUrl?: string;
  alertThresholds: SecurityAlertThresholds;
}

// Security alert thresholds
export interface SecurityAlertThresholds {
  failedAttemptsPerMinute: number;
  suspiciousActivityScore: number;
  multipleSessionsThreshold: number;
  unusualLocationAccess: boolean;
}

// Authentication metrics
export interface AuthenticationMetrics {
  totalAuthAttempts: number;
  successfulAuths: number;
  failedAuths: number;
  tokenRefreshCount: number;
  sessionExtensions: number;
  securityIncidents: number;
  averageSessionDuration: number; // ms
  lastAuthTime: number;
  lastTokenRefresh: number;
  suspiciousActivityScore: number;
}

// Session state information
export interface SessionState {
  isActive: boolean;
  sessionId: string;
  userId?: string;
  startTime: number;
  lastActivity: number;
  expiresAt: number;
  isValid: boolean;
  deviceInfo: DeviceInfo;
  location?: LocationInfo;
  multiTabSessions: number;
}

// Token information and status
export interface TokenInfo {
  accessToken?: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt: number;
  issuedAt: number;
  isValid: boolean;
  needsRefresh: boolean;
  refreshInProgress: boolean;
  lastRefreshAttempt?: number;
  refreshFailureCount: number;
}

// Device information for security tracking
export interface DeviceInfo {
  userAgent: string;
  platform: string;
  deviceId: string;
  browserFingerprint: string;
  screenResolution: string;
  timezone: string;
}

// Location information for security monitoring
export interface LocationInfo {
  country?: string;
  region?: string;
  city?: string;
  ipAddress: string;
  isVpn?: boolean;
  isTrustedLocation: boolean;
}

// Authentication error types
export interface AuthenticationError extends StorageError {
  authErrorType:
    | 'token_expired'
    | 'token_invalid'
    | 'session_expired'
    | 'session_invalid'
    | 'refresh_failed'
    | 'security_violation'
    | 'rate_limited'
    | 'account_locked';
  tokenInfo?: TokenInfo;
  sessionInfo?: SessionState;
  securityContext?: SecurityContext;
  canRetry: boolean;
  retryAfter?: number; // seconds
}

// Security context for error reporting
export interface SecurityContext {
  attemptCount: number;
  lastAttemptTime: number;
  deviceInfo: DeviceInfo;
  locationInfo?: LocationInfo;
  suspiciousActivityFlags: string[];
  riskScore: number; // 0-100
}

// Authentication event for logging and monitoring
export interface AuthenticationEvent {
  eventId: string;
  eventType:
    | 'auth_attempt'
    | 'auth_success'
    | 'auth_failure'
    | 'token_refresh'
    | 'session_start'
    | 'session_end'
    | 'security_incident';
  timestamp: number;
  userId?: string;
  sessionId?: string;
  deviceInfo: DeviceInfo;
  locationInfo?: LocationInfo;
  details: Record<string, any>;
  riskScore: number;
}

// Security incident report
export interface SecurityIncident {
  incidentId: string;
  incidentType:
    | 'multiple_failed_attempts'
    | 'suspicious_location'
    | 'unusual_device'
    | 'token_abuse'
    | 'session_hijacking'
    | 'rate_limit_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  userId?: string;
  sessionId?: string;
  deviceInfo: DeviceInfo;
  locationInfo?: LocationInfo;
  evidence: Record<string, any>;
  actionTaken: string;
  resolved: boolean;
}

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

// Error Handling and Recovery Management Interfaces
// Story 2.4 Subtask 1.4: Comprehensive Error Handling with Circuit Breakers and Automatic Recovery

// Error recovery configuration
export interface ErrorRecoveryConfig {
  enabled: boolean;
  maxRetryAttempts: number;
  retryPolicy: RetryPolicy;
  circuitBreakerConfig: EnhancedCircuitBreakerConfig;
  healthCheckConfig: HealthCheckConfig;
  errorClassificationEnabled: boolean;
  automaticRecoveryEnabled: boolean;
  gracefulDegradationEnabled: boolean;
  errorAnalyticsEnabled: boolean;
}

// Advanced retry policy configuration
export interface RetryPolicy {
  strategy: 'exponential' | 'linear' | 'fixed' | 'custom';
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterEnabled: boolean;
  jitterMaxMs: number;
  retryBudget: RetryBudget;
  contextAwareRetries: boolean;
  errorTypeSpecificPolicies: Record<string, Partial<RetryPolicy>>;
}

// Retry budget management
export interface RetryBudget {
  maxRetriesPerMinute: number;
  maxRetriesPerHour: number;
  budgetResetInterval: number;
  currentBudget: number;
  budgetExhaustedAction: 'fail' | 'queue' | 'degrade';
}

// Enhanced circuit breaker configuration
export interface EnhancedCircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenMaxCalls: number;
  halfOpenSuccessThreshold: number;
  errorTypeWeights: Record<string, number>;
  healthCheckInterval: number;
  automaticRecoveryEnabled: boolean;
  degradationMode: 'fail_fast' | 'fallback' | 'cache_only';
}

// Health check configuration
export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  endpoints: HealthCheckEndpoint[];
  customHealthChecks: CustomHealthCheck[];
}

// Health check endpoint
export interface HealthCheckEndpoint {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  expectedStatus: number;
  timeout: number;
  weight: number;
}

// Custom health check function
export interface CustomHealthCheck {
  name: string;
  checkFunction: () => Promise<boolean>;
  weight: number;
  timeout: number;
}

// Error classification system
export interface ErrorClassification {
  errorType: ErrorType;
  severity: ErrorSeverity;
  category: ErrorCategory;
  isRetryable: boolean;
  isTransient: boolean;
  requiresUserAction: boolean;
  recoveryStrategy: RecoveryStrategy;
  userMessage: string;
  technicalMessage: string;
}

// Error types
export type ErrorType =
  | 'network_error'
  | 'authentication_error'
  | 'authorization_error'
  | 'rate_limit_error'
  | 'server_error'
  | 'client_error'
  | 'timeout_error'
  | 'circuit_breaker_error'
  | 'validation_error'
  | 'storage_error'
  | 'unknown_error';

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error categories
export type ErrorCategory =
  | 'transient'
  | 'permanent'
  | 'configuration'
  | 'security'
  | 'resource';

// Recovery strategies
export interface RecoveryStrategy {
  strategy: RecoveryStrategyType;
  fallbackOptions: FallbackOption[];
  degradationLevel: DegradationLevel;
  automaticRecovery: boolean;
  userNotificationRequired: boolean;
  dataIntegrityChecks: boolean;
}

// Recovery strategy types
export type RecoveryStrategyType =
  | 'retry'
  | 'fallback'
  | 'circuit_breaker'
  | 'graceful_degradation'
  | 'fail_fast'
  | 'cache_fallback'
  | 'manual_intervention';

// Fallback options
export interface FallbackOption {
  type: 'cache' | 'backup_service' | 'default_value' | 'alternative_endpoint';
  priority: number;
  configuration: Record<string, any>;
  healthCheck?: () => Promise<boolean>;
}

// Degradation levels
export type DegradationLevel = 'none' | 'partial' | 'minimal' | 'emergency';

// Error analytics and monitoring
export interface ErrorAnalytics {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  circuitBreakerActivations: number;
  retryBudgetExhaustions: number;
  lastErrorTime: number;
  errorPatterns: ErrorPattern[];
  healthScore: number;
}

// Error pattern detection
export interface ErrorPattern {
  patternId: string;
  description: string;
  frequency: number;
  severity: ErrorSeverity;
  suggestedAction: string;
  autoFixAvailable: boolean;
  lastOccurrence: number;
}

// Recovery operation result
export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategyType;
  attemptsUsed: number;
  timeTaken: number;
  fallbackUsed?: FallbackOption;
  degradationLevel: DegradationLevel;
  errorDetails?: ErrorClassification;
  nextAction?: string;
}

// Health status with detailed information
export interface DetailedHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  score: number; // 0-100
  components: ComponentHealth[];
  lastCheck: number;
  nextCheck: number;
  trends: HealthTrend[];
  recommendations: string[];
}

// Component health status
export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number;
  lastCheck: number;
  errorCount: number;
  responseTime: number;
  details: Record<string, any>;
}

// Health trend analysis
export interface HealthTrend {
  component: string;
  metric: string;
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number;
  prediction: string;
}

// ===================================================================
// Story 2.4 Subtask 1.3: Advanced Bucket Organization & Management
// ===================================================================

// Bucket management configuration
export interface BucketManagementConfig {
  enabled: boolean;
  organizationStrategy: 'hierarchical' | 'flat' | 'hybrid';
  autoOrganization: boolean;
  categoryBasedBuckets: boolean;
  userBasedIsolation: boolean;
  multiTenantSupport: boolean;
  bucketNamingConvention: string;
  maxBucketsPerUser: number;
  bucketSizeLimit: number; // bytes
  bucketRetentionPolicy: RetentionPolicy;
}

// Bucket information and metadata
export interface BucketInfo {
  bucketId: string;
  name: string;
  displayName: string;
  description?: string;
  category: BucketCategory;
  owner: string;
  tenantId?: string;
  createdAt: number;
  updatedAt: number;
  size: number; // bytes
  assetCount: number;
  isPublic: boolean;
  permissions: BucketPermissions;
  tags: string[];
  metadata: Record<string, any>;
  healthStatus: BucketHealthStatus;
}

// Bucket categories for organization
export type BucketCategory =
  | 'audio_samples'
  | 'midi_files'
  | 'ambient_tracks'
  | 'user_recordings'
  | 'exercise_assets'
  | 'backing_tracks'
  | 'system_assets'
  | 'temporary'
  | 'archive';

// Bucket permissions and access control
export interface BucketPermissions {
  read: string[]; // User IDs or roles
  write: string[];
  delete: string[];
  admin: string[];
  publicRead: boolean;
  publicWrite: boolean;
  inheritFromParent: boolean;
}

// Bucket health monitoring
export interface BucketHealthStatus {
  isHealthy: boolean;
  lastCheck: number;
  issues: BucketIssue[];
  storageUtilization: number; // 0-1
  accessFrequency: number;
  errorRate: number;
  averageResponseTime: number;
}

// Bucket issues and problems
export interface BucketIssue {
  issueId: string;
  type:
    | 'storage_full'
    | 'access_denied'
    | 'corruption'
    | 'orphaned_assets'
    | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: number;
  autoFixAvailable: boolean;
  suggestedAction: string;
}

// Asset versioning configuration
export interface VersioningConfig {
  enabled: boolean;
  maxVersionsPerAsset: number;
  versionRetentionDays: number;
  automaticVersioning: boolean;
  versionCompressionEnabled: boolean;
  diffTrackingEnabled: boolean;
  rollbackEnabled: boolean;
  conflictResolutionStrategy:
    | 'latest_wins'
    | 'manual_merge'
    | 'branch_versions';
}

// Asset version information
export interface AssetVersion {
  versionId: string;
  assetId: string;
  versionNumber: string; // e.g., "1.0.0", "1.0.1"
  parentVersionId?: string;
  createdAt: number;
  createdBy: string;
  size: number;
  checksum: string;
  changeDescription?: string;
  tags: string[];
  metadata: AssetVersionMetadata;
  isActive: boolean;
  isDraft: boolean;
  branchName?: string;
}

// Version-specific metadata
export interface AssetVersionMetadata {
  contentType: string;
  encoding?: string;
  compression?: string;
  quality?: number;
  duration?: number; // for audio/video assets
  sampleRate?: number; // for audio assets
  bitRate?: number;
  channels?: number;
  format?: string;
  customMetadata: Record<string, any>;
}

// Version comparison and diff
export interface VersionDiff {
  fromVersion: string;
  toVersion: string;
  diffType: 'binary' | 'text' | 'audio' | 'midi';
  changes: VersionChange[];
  similarity: number; // 0-1
  diffSize: number; // bytes
  generatedAt: number;
}

// Individual version changes
export interface VersionChange {
  changeId: string;
  type: 'added' | 'modified' | 'deleted' | 'moved';
  path: string;
  oldValue?: any;
  newValue?: any;
  description: string;
  impact: 'minor' | 'major' | 'breaking';
}

// Metadata indexing configuration
export interface MetadataIndexingConfig {
  enabled: boolean;
  indexingStrategy: 'real_time' | 'batch' | 'hybrid';
  fullTextSearchEnabled: boolean;
  semanticSearchEnabled: boolean;
  autoTaggingEnabled: boolean;
  contentAnalysisEnabled: boolean;
  indexUpdateInterval: number; // ms
  maxIndexSize: number; // bytes
  searchResultLimit: number;
}

// Asset metadata index entry
export interface AssetMetadataIndex {
  assetId: string;
  bucketId: string;
  path: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  lastAccessed: number;
  accessCount: number;
  tags: string[];
  categories: string[];
  searchableContent: string;
  extractedMetadata: ExtractedMetadata;
  relationships: AssetRelationship[];
  searchScore?: number;
}

// Extracted metadata from content analysis
export interface ExtractedMetadata {
  // Audio metadata
  duration?: number;
  sampleRate?: number;
  bitRate?: number;
  channels?: number;
  genre?: string;
  tempo?: number;
  key?: string;

  // MIDI metadata
  trackCount?: number;
  instrumentCount?: number;
  timeSignature?: string;
  keySignature?: string;

  // General metadata
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  description?: string;
  language?: string;

  // Technical metadata
  encoding?: string;
  compression?: string;
  quality?: number;

  // Custom metadata
  customFields: Record<string, any>;
}

// Asset relationships for discovery
export interface AssetRelationship {
  relationshipId: string;
  type: 'similar' | 'derived_from' | 'part_of' | 'used_in' | 'references';
  targetAssetId: string;
  strength: number; // 0-1
  description?: string;
  createdAt: number;
  metadata: Record<string, any>;
}

// Search query and filters
export interface AssetSearchQuery {
  query?: string;
  filters: AssetSearchFilters;
  sorting: AssetSearchSorting;
  pagination: SearchPagination;
  includeMetadata: boolean;
  includeRelationships: boolean;
}

// Search filters
export interface AssetSearchFilters {
  buckets?: string[];
  categories?: BucketCategory[];
  contentTypes?: string[];
  tags?: string[];
  sizeRange?: { min: number; max: number };
  dateRange?: { from: number; to: number };
  owners?: string[];
  customFilters?: Record<string, any>;
}

// Search result sorting
export interface AssetSearchSorting {
  field:
    | 'relevance'
    | 'name'
    | 'size'
    | 'created_at'
    | 'updated_at'
    | 'access_count';
  direction: 'asc' | 'desc';
  secondarySort?: AssetSearchSorting;
}

// Search pagination
export interface SearchPagination {
  page: number;
  pageSize: number;
  totalResults?: number;
  totalPages?: number;
}

// Search results
export interface AssetSearchResult {
  results: AssetMetadataIndex[];
  totalResults: number;
  totalPages: number;
  currentPage: number;
  searchTime: number; // ms
  suggestions?: string[];
  facets?: SearchFacet[];
}

// Search facets for filtering
export interface SearchFacet {
  field: string;
  values: FacetValue[];
}

// Facet values with counts
export interface FacetValue {
  value: string;
  count: number;
  selected: boolean;
}

// Automated cleanup configuration
export interface AutomatedCleanupConfig {
  enabled: boolean;
  cleanupSchedule: CleanupSchedule;
  retentionPolicies: RetentionPolicy[];
  orphanedAssetCleanup: OrphanedAssetCleanupConfig;
  duplicateDetection: DuplicateDetectionConfig;
  storageOptimization: StorageOptimizationConfig;
  archivalConfig: ArchivalConfig;
  notificationConfig: CleanupNotificationConfig;
}

// Cleanup scheduling
export interface CleanupSchedule {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time?: string; // HH:MM format
  dayOfWeek?: number; // 0-6, Sunday = 0
  dayOfMonth?: number; // 1-31
  timezone: string;
}

// Retention policies for different asset types
export interface RetentionPolicy {
  policyId: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: RetentionCondition[];
  actions: RetentionAction[];
  createdAt: number;
  updatedAt: number;
}

// Retention conditions
export interface RetentionCondition {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'greater_than'
    | 'less_than'
    | 'contains'
    | 'regex';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

// Retention actions
export interface RetentionAction {
  type: 'delete' | 'archive' | 'compress' | 'move' | 'notify';
  parameters: Record<string, any>;
  delay?: number; // ms to wait before executing
}

// Orphaned asset cleanup
export interface OrphanedAssetCleanupConfig {
  enabled: boolean;
  detectionInterval: number; // ms
  gracePeriod: number; // ms before cleanup
  autoCleanup: boolean;
  notifyBeforeCleanup: boolean;
  backupBeforeCleanup: boolean;
}

// Duplicate detection and cleanup
export interface DuplicateDetectionConfig {
  enabled: boolean;
  detectionMethod: 'checksum' | 'content_analysis' | 'metadata' | 'hybrid';
  similarityThreshold: number; // 0-1
  autoMerge: boolean;
  keepStrategy: 'newest' | 'oldest' | 'largest' | 'most_accessed';
  notifyOnDuplicates: boolean;
}

// Storage optimization settings
export interface StorageOptimizationConfig {
  enabled: boolean;
  compressionEnabled: boolean;
  compressionLevel: 'low' | 'medium' | 'high' | 'adaptive';
  formatOptimization: boolean;
  qualityOptimization: boolean;
  batchOptimization: boolean;
  optimizationSchedule: CleanupSchedule;
}

// Archival configuration
export interface ArchivalConfig {
  enabled: boolean;
  archiveLocation: string;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  archiveAfterDays: number;
  deleteAfterArchival: boolean;
  archivalSchedule: CleanupSchedule;
  restoreOnAccess: boolean;
}

// Cleanup notifications
export interface CleanupNotificationConfig {
  enabled: boolean;
  notifyOnStart: boolean;
  notifyOnComplete: boolean;
  notifyOnError: boolean;
  emailNotifications: boolean;
  webhookNotifications: boolean;
  recipients: string[];
  webhookUrl?: string;
}

// Cleanup operation result
export interface CleanupResult {
  operationId: string;
  type: 'retention' | 'orphaned' | 'duplicate' | 'optimization' | 'archival';
  startTime: number;
  endTime: number;
  status: 'success' | 'partial' | 'failed';
  itemsProcessed: number;
  itemsDeleted: number;
  itemsArchived: number;
  itemsOptimized: number;
  spaceSaved: number; // bytes
  errors: CleanupError[];
  summary: string;
}

// Cleanup errors
export interface CleanupError {
  errorId: string;
  assetId?: string;
  errorType: string;
  message: string;
  timestamp: number;
  retryable: boolean;
}

// Bucket analytics and insights
export interface BucketAnalytics {
  bucketId: string;
  period: AnalyticsPeriod;
  storageUsage: StorageUsageAnalytics;
  accessPatterns: AccessPatternAnalytics;
  performanceMetrics: BucketPerformanceMetrics;
  costAnalytics: StorageCostAnalytics;
  recommendations: BucketRecommendation[];
  generatedAt: number;
}

// Analytics time period
export interface AnalyticsPeriod {
  startTime: number;
  endTime: number;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

// Storage usage analytics
export interface StorageUsageAnalytics {
  totalSize: number;
  assetCount: number;
  averageAssetSize: number;
  growthRate: number; // bytes per day
  utilizationTrend: DataPoint[];
  categoryBreakdown: CategoryUsage[];
  largestAssets: AssetSizeInfo[];
}

// Data points for trends
export interface DataPoint {
  timestamp: number;
  value: number;
}

// Category usage breakdown
export interface CategoryUsage {
  category: BucketCategory;
  size: number;
  count: number;
  percentage: number;
}

// Asset size information
export interface AssetSizeInfo {
  assetId: string;
  name: string;
  size: number;
  lastAccessed: number;
}

// Access pattern analytics
export interface AccessPatternAnalytics {
  totalAccesses: number;
  uniqueUsers: number;
  averageAccessesPerDay: number;
  peakAccessTime: string;
  accessTrend: DataPoint[];
  popularAssets: PopularAssetInfo[];
  userAccessPatterns: UserAccessPattern[];
}

// Popular asset information
export interface PopularAssetInfo {
  assetId: string;
  name: string;
  accessCount: number;
  uniqueUsers: number;
  lastAccessed: number;
}

// User access patterns
export interface UserAccessPattern {
  userId: string;
  accessCount: number;
  favoriteCategories: BucketCategory[];
  accessTimes: number[]; // hours of day
  averageSessionDuration: number;
}

// Bucket performance metrics
export interface BucketPerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  throughput: number; // requests per second
  cacheHitRate: number;
  performanceTrend: DataPoint[];
  slowestOperations: SlowOperationInfo[];
}

// Slow operation information
export interface SlowOperationInfo {
  operation: string;
  averageTime: number;
  count: number;
  lastOccurrence: number;
}

// Storage cost analytics
export interface StorageCostAnalytics {
  totalCost: number;
  costPerGB: number;
  costTrend: DataPoint[];
  costByCategory: CategoryCost[];
  projectedMonthlyCost: number;
  costOptimizationPotential: number;
}

// Category cost breakdown
export interface CategoryCost {
  category: BucketCategory;
  cost: number;
  percentage: number;
}

// Bucket recommendations
export interface BucketRecommendation {
  recommendationId: string;
  type: 'optimization' | 'cleanup' | 'organization' | 'performance' | 'cost';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  potentialSavings?: number; // bytes or cost
  implementationEffort: 'low' | 'medium' | 'high';
  autoImplementable: boolean;
  createdAt: number;
}

// Extended storage token info for bucket operations
export interface StorageTokenInfo extends TokenInfo {
  bucketPermissions?: Record<string, string[]>; // bucket -> permissions
  scopedAccess?: string[]; // specific scopes for bucket operations
}

// Bucket operation audit log
export interface BucketAuditLog {
  logId: string;
  bucketId: string;
  operation: BucketOperation;
  userId: string;
  timestamp: number;
  details: Record<string, any>;
  result: 'success' | 'failure';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}

// Bucket operations for auditing
export type BucketOperation =
  | 'create_bucket'
  | 'delete_bucket'
  | 'update_bucket'
  | 'upload_asset'
  | 'download_asset'
  | 'delete_asset'
  | 'update_permissions'
  | 'create_version'
  | 'rollback_version'
  | 'cleanup_operation'
  | 'archive_operation';

// ============================================================================
// Story 2.4 Subtask 1.5: Real-time Health Monitoring & Performance Analytics
// ============================================================================

// Real-time monitoring configuration
export interface RealTimeMonitoringConfig {
  enabled: boolean;
  connectionType: 'websocket' | 'eventsource' | 'polling';
  reconnectEnabled: boolean;
  reconnectInterval: number; // ms
  maxReconnectAttempts: number;
  heartbeatInterval: number; // ms
  bufferSize: number; // number of events to buffer
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  monitoringEndpoint?: string;
  authenticationRequired: boolean;
}

// Advanced health monitoring configuration
export interface HealthMonitoringConfig {
  enabled: boolean;
  monitoringInterval: number; // ms
  healthCheckTimeout: number; // ms
  componentMonitoring: ComponentMonitoringConfig[];
  thresholdConfig: HealthThresholdConfig;
  trendAnalysisEnabled: boolean;
  anomalyDetectionEnabled: boolean;
  predictiveAnalysisEnabled: boolean;
  historicalDataRetention: number; // days
}

// Component monitoring configuration
export interface ComponentMonitoringConfig {
  componentName: string;
  enabled: boolean;
  checkInterval: number; // ms
  healthCheckFunction?: string; // function name or endpoint
  criticalityLevel: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[]; // other component names
  customMetrics: string[];
}

// Health threshold configuration
export interface HealthThresholdConfig {
  responseTimeThresholds: {
    warning: number; // ms
    critical: number; // ms
  };
  errorRateThresholds: {
    warning: number; // percentage
    critical: number; // percentage
  };
  resourceUtilizationThresholds: {
    memory: { warning: number; critical: number }; // percentage
    cpu: { warning: number; critical: number }; // percentage
    storage: { warning: number; critical: number }; // percentage
  };
  customThresholds: Record<string, { warning: number; critical: number }>;
}

// Performance analytics configuration
export interface PerformanceAnalyticsConfig {
  enabled: boolean;
  metricsCollectionInterval: number; // ms
  trendAnalysisWindow: number; // ms
  anomalyDetectionSensitivity: 'low' | 'medium' | 'high';
  performancePredictionEnabled: boolean;
  benchmarkingEnabled: boolean;
  customMetricsEnabled: boolean;
  dataRetentionPeriod: number; // days
  aggregationLevels: ('minute' | 'hour' | 'day' | 'week' | 'month')[];
}

// Extended performance metrics
export interface PerformanceMetrics {
  // Basic metrics (extends existing StorageMetrics)
  timestamp: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;

  // Advanced metrics
  throughput: number; // requests per second
  concurrentConnections: number;
  queueDepth: number;
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
  networkBandwidth: number; // bytes per second
  cacheHitRate: number;
  cacheSize: number; // bytes

  // Component-specific metrics
  circuitBreakerState: CircuitBreakerState;
  circuitBreakerFailures: number;
  retryAttempts: number;
  fallbackActivations: number;

  // Custom metrics
  customMetrics: Record<string, number>;
}

// Performance trend analysis
export interface PerformanceTrend {
  metricName: string;
  timeWindow: {
    startTime: number;
    endTime: number;
    granularity: 'minute' | 'hour' | 'day';
  };
  dataPoints: PerformanceDataPoint[];
  trendDirection: 'improving' | 'stable' | 'degrading';
  changeRate: number; // percentage change
  volatility: number; // measure of variance
  seasonalPatterns: SeasonalPattern[];
  predictions: PerformancePrediction[];
}

// Performance data point
export interface PerformanceDataPoint {
  timestamp: number;
  value: number;
  metadata?: Record<string, any>;
}

// Seasonal pattern detection
export interface SeasonalPattern {
  patternType: 'daily' | 'weekly' | 'monthly';
  strength: number; // 0-1
  peakTimes: number[]; // timestamps or hours
  description: string;
}

// Performance anomaly detection
export interface PerformanceAnomaly {
  anomalyId: string;
  detectedAt: number;
  metricName: string;
  anomalyType: 'spike' | 'drop' | 'trend_change' | 'pattern_break';
  severity: 'low' | 'medium' | 'high' | 'critical';
  actualValue: number;
  expectedValue: number;
  deviation: number; // percentage
  confidence: number; // 0-1
  context: AnomalyContext;
  resolved: boolean;
  resolvedAt?: number;
}

// Anomaly context
export interface AnomalyContext {
  correlatedMetrics: string[];
  possibleCauses: string[];
  impactAssessment: string;
  recommendedActions: string[];
  historicalOccurrences: number;
}

// Performance prediction
export interface PerformancePrediction {
  predictionId: string;
  generatedAt: number;
  metricName: string;
  predictionHorizon: number; // ms into the future
  predictedValues: PredictedValue[];
  confidence: number; // 0-1
  methodology: 'linear_regression' | 'arima' | 'neural_network' | 'ensemble';
  factors: PredictionFactor[];
}

// Predicted value
export interface PredictedValue {
  timestamp: number;
  value: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

// Prediction factor
export interface PredictionFactor {
  factorName: string;
  importance: number; // 0-1
  description: string;
}

// Alerting system configuration
export interface AlertingConfig {
  enabled: boolean;
  alertRules: AlertRule[];
  notificationChannels: AlertChannel[];
  escalationPolicies: EscalationPolicy[];
  alertGrouping: AlertGroupingConfig;
  suppressionRules: AlertSuppressionRule[];
  maintenanceWindows: MaintenanceWindow[];
}

// Alert rule definition
export interface AlertRule {
  ruleId: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  conditions: AlertCondition[];
  logicalOperator: 'AND' | 'OR';
  evaluationInterval: number; // ms
  evaluationWindow: number; // ms
  cooldownPeriod: number; // ms
  notificationChannels: string[]; // channel IDs
  escalationPolicy?: string; // policy ID
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

// Alert condition
export interface AlertCondition {
  conditionId: string;
  metricName: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains' | 'regex';
  threshold: number | string;
  aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count' | 'rate';
  timeWindow: number; // ms
  missingDataTreatment: 'ignore' | 'treat_as_zero' | 'treat_as_breach';
}

// Alert threshold configuration
export interface AlertThreshold {
  thresholdId: string;
  name: string;
  metricName: string;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
  direction: 'above' | 'below' | 'outside_range';
  hysteresis?: number; // prevent flapping
  adaptiveThreshold: boolean;
}

// Alert notification
export interface AlertNotification {
  notificationId: string;
  alertRuleId: string;
  alertId: string;
  timestamp: number;
  severity: 'warning' | 'critical';
  status: 'firing' | 'resolved';
  title: string;
  message: string;
  details: AlertDetails;
  channels: string[]; // channel IDs where sent
  acknowledgments: AlertAcknowledgment[];
  escalated: boolean;
  escalationLevel: number;
}

// Alert details
export interface AlertDetails {
  metricName: string;
  currentValue: number;
  thresholdValue: number;
  duration: number; // how long the condition has been true
  affectedComponents: string[];
  possibleCauses: string[];
  recommendedActions: string[];
  runbookUrl?: string;
  dashboardUrl?: string;
}

// Alert acknowledgment
export interface AlertAcknowledgment {
  acknowledgedBy: string;
  acknowledgedAt: number;
  comment?: string;
  autoAcknowledged: boolean;
}

// Alert notification channel
export interface AlertChannel {
  channelId: string;
  name: string;
  type: 'email' | 'webhook' | 'slack' | 'teams' | 'pagerduty' | 'sms';
  enabled: boolean;
  configuration: AlertChannelConfig;
  rateLimiting: RateLimitConfig;
  retryPolicy: NotificationRetryPolicy;
  filterRules: AlertFilterRule[];
}

// Alert channel configuration
export interface AlertChannelConfig {
  // Email configuration
  emailAddresses?: string[];
  emailTemplate?: string;

  // Webhook configuration
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;
  webhookPayloadTemplate?: string;

  // Slack configuration
  slackWebhookUrl?: string;
  slackChannel?: string;
  slackUsername?: string;

  // Teams configuration
  teamsWebhookUrl?: string;

  // PagerDuty configuration
  pagerDutyIntegrationKey?: string;
  pagerDutyServiceKey?: string;

  // SMS configuration
  phoneNumbers?: string[];
  smsProvider?: string;
  smsApiKey?: string;

  // Custom configuration
  customConfig?: Record<string, any>;
}

// Rate limiting for notifications
export interface RateLimitConfig {
  enabled: boolean;
  maxNotificationsPerMinute: number;
  maxNotificationsPerHour: number;
  burstLimit: number;
  backoffStrategy: 'linear' | 'exponential';
}

// Notification retry policy
export interface NotificationRetryPolicy {
  enabled: boolean;
  maxRetries: number;
  retryInterval: number; // ms
  backoffMultiplier: number;
  maxRetryInterval: number; // ms
}

// Alert filter rule
export interface AlertFilterRule {
  ruleId: string;
  condition: string; // expression to evaluate
  action: 'include' | 'exclude' | 'modify';
  priority: number;
}

// Escalation policy
export interface EscalationPolicy {
  policyId: string;
  name: string;
  description: string;
  enabled: boolean;
  escalationLevels: EscalationLevel[];
  repeatInterval?: number; // ms
  maxEscalations?: number;
}

// Escalation level
export interface EscalationLevel {
  level: number;
  delayMinutes: number;
  channels: string[]; // channel IDs
  conditions?: EscalationCondition[];
}

// Escalation condition
export interface EscalationCondition {
  type: 'time_based' | 'acknowledgment_based' | 'severity_based';
  parameters: Record<string, any>;
}

// Alert grouping configuration
export interface AlertGroupingConfig {
  enabled: boolean;
  groupingKeys: string[]; // fields to group by
  groupingWindow: number; // ms
  maxGroupSize: number;
  groupingStrategy: 'time_based' | 'similarity_based' | 'rule_based';
}

// Alert suppression rule
export interface AlertSuppressionRule {
  ruleId: string;
  name: string;
  enabled: boolean;
  conditions: AlertCondition[];
  suppressionDuration: number; // ms
  reason: string;
}

// Maintenance window
export interface MaintenanceWindow {
  windowId: string;
  name: string;
  description: string;
  startTime: number;
  endTime: number;
  recurring: boolean;
  recurrencePattern?: RecurrencePattern;
  affectedComponents: string[];
  suppressAlerts: boolean;
  notifyBeforeStart: boolean;
  notificationLeadTime?: number; // ms
}

// Recurrence pattern
export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number; // every N days/weeks/months
  daysOfWeek?: number[]; // for weekly recurrence
  dayOfMonth?: number; // for monthly recurrence
  endDate?: number; // when recurrence ends
}

// Health dashboard configuration
export interface HealthDashboard {
  dashboardId: string;
  name: string;
  description: string;
  isDefault: boolean;
  layout: DashboardLayout;
  widgets: HealthWidget[];
  refreshInterval: number; // ms
  autoRefresh: boolean;
  permissions: DashboardPermissions;
  filters: DashboardFilter[];
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

// Dashboard layout
export interface DashboardLayout {
  type: 'grid' | 'flex' | 'custom';
  columns: number;
  rows: number;
  responsive: boolean;
  breakpoints?: Record<string, LayoutBreakpoint>;
}

// Layout breakpoint
export interface LayoutBreakpoint {
  columns: number;
  rows: number;
  widgetSizes: Record<string, WidgetSize>;
}

// Widget size
export interface WidgetSize {
  width: number;
  height: number;
  x: number;
  y: number;
}

// Health dashboard widget
export interface HealthWidget {
  widgetId: string;
  type: WidgetType;
  title: string;
  description?: string;
  position: WidgetPosition;
  size: WidgetSize;
  configuration: WidgetConfiguration;
  dataSource: WidgetDataSource;
  refreshInterval?: number; // ms, overrides dashboard default
  visible: boolean;
  permissions?: WidgetPermissions;
}

// Widget type
export type WidgetType =
  | 'metric_chart'
  | 'status_indicator'
  | 'alert_list'
  | 'performance_graph'
  | 'health_score'
  | 'component_status'
  | 'trend_analysis'
  | 'anomaly_detection'
  | 'prediction_chart'
  | 'custom';

// Widget position
export interface WidgetPosition {
  x: number;
  y: number;
  z?: number; // layer order
}

// Widget configuration
export interface WidgetConfiguration {
  // Chart configuration
  chartType?: 'line' | 'bar' | 'pie' | 'gauge' | 'heatmap';
  timeRange?: TimeRange;
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';

  // Display configuration
  showLegend?: boolean;
  showGrid?: boolean;
  colorScheme?: string;
  thresholds?: WidgetThreshold[];

  // Alert configuration
  alertSeverityFilter?: ('warning' | 'critical')[];
  maxAlerts?: number;

  // Custom configuration
  customConfig?: Record<string, any>;
}

// Time range
export interface TimeRange {
  type: 'relative' | 'absolute';
  // Relative time
  duration?: number; // ms
  // Absolute time
  startTime?: number;
  endTime?: number;
}

// Widget threshold
export interface WidgetThreshold {
  value: number;
  color: string;
  label?: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte';
}

// Widget data source
export interface WidgetDataSource {
  type: 'metrics' | 'alerts' | 'health_status' | 'custom';
  query: string;
  parameters?: Record<string, any>;
  cacheEnabled?: boolean;
  cacheTtl?: number; // ms
}

// Widget permissions
export interface WidgetPermissions {
  view: string[]; // user IDs or roles
  edit: string[];
  delete: string[];
}

// Dashboard permissions
export interface DashboardPermissions {
  view: string[]; // user IDs or roles
  edit: string[];
  delete: string[];
  share: string[];
}

// Dashboard filter
export interface DashboardFilter {
  filterId: string;
  name: string;
  type: 'dropdown' | 'text' | 'date_range' | 'multi_select';
  field: string;
  defaultValue?: any;
  options?: FilterOption[];
  required: boolean;
}

// Filter option
export interface FilterOption {
  label: string;
  value: any;
}

// Health report
export interface HealthReport {
  reportId: string;
  generatedAt: number;
  reportType: 'summary' | 'detailed' | 'incident' | 'performance';
  timeRange: TimeRange;
  overallHealth: OverallHealthStatus;
  componentHealth: ComponentHealthReport[];
  performanceSummary: PerformanceSummary;
  alertSummary: AlertSummary;
  recommendations: HealthRecommendation[];
  trends: HealthTrendSummary[];
  incidents: IncidentSummary[];
  customSections?: CustomReportSection[];
}

// Overall health status
export interface OverallHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  score: number; // 0-100
  uptime: number; // percentage
  availability: number; // percentage
  reliability: number; // percentage
  performance: number; // percentage
  lastIncident?: number; // timestamp
}

// Component health report
export interface ComponentHealthReport {
  componentName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number; // 0-100
  uptime: number; // percentage
  errorRate: number; // percentage
  averageResponseTime: number; // ms
  throughput: number; // requests per second
  lastCheck: number;
  issues: ComponentIssue[];
  metrics: ComponentMetrics;
}

// Component issue
export interface ComponentIssue {
  issueId: string;
  type: 'performance' | 'availability' | 'error' | 'configuration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: number;
  resolved: boolean;
  resolvedAt?: number;
  impact: string;
  recommendedAction: string;
}

// Component metrics
export interface ComponentMetrics {
  requestCount: number;
  errorCount: number;
  averageLatency: number;
  p95Latency: number;
  throughput: number;
  memoryUsage?: number;
  cpuUsage?: number;
  customMetrics: Record<string, number>;
}

// Performance summary
export interface PerformanceSummary {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
  availability: number;
  performanceTrends: PerformanceTrendSummary[];
  bottlenecks: PerformanceBottleneck[];
}

// Performance trend summary
export interface PerformanceTrendSummary {
  metricName: string;
  trend: 'improving' | 'stable' | 'degrading';
  changePercentage: number;
  significance: 'low' | 'medium' | 'high';
}

// Performance bottleneck
export interface PerformanceBottleneck {
  component: string;
  operation: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
  recommendedAction: string;
}

// Alert summary
export interface AlertSummary {
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  alertsByseverity: Record<string, number>;
  alertsByComponent: Record<string, number>;
  averageResolutionTime: number; // ms
  topAlertRules: TopAlertRule[];
}

// Top alert rule
export interface TopAlertRule {
  ruleId: string;
  ruleName: string;
  alertCount: number;
  averageResolutionTime: number;
}

// Health recommendation
export interface HealthRecommendation {
  recommendationId: string;
  type: 'performance' | 'reliability' | 'cost' | 'security' | 'maintenance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  potentialImprovement: string;
  implementationSteps: string[];
  relatedComponents: string[];
  estimatedTimeToImplement: number; // hours
}

// Health trend summary
export interface HealthTrendSummary {
  component: string;
  metric: string;
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number;
  timeframe: string;
  significance: 'low' | 'medium' | 'high';
}

// Incident summary
export interface IncidentSummary {
  incidentId: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved';
  startTime: number;
  endTime?: number;
  duration?: number; // ms
  affectedComponents: string[];
  rootCause?: string;
  resolution?: string;
  impact: string;
}

// Custom report section
export interface CustomReportSection {
  sectionId: string;
  title: string;
  content: string;
  data?: Record<string, any>;
  charts?: ReportChart[];
}

// Report chart
export interface ReportChart {
  chartId: string;
  type: 'line' | 'bar' | 'pie' | 'gauge';
  title: string;
  data: ChartDataPoint[];
  configuration: ChartConfiguration;
}

// Chart data point
export interface ChartDataPoint {
  x: number | string;
  y: number;
  label?: string;
  metadata?: Record<string, any>;
}

// Chart configuration
export interface ChartConfiguration {
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend: boolean;
  colorScheme: string;
  thresholds?: WidgetThreshold[];
}

// Health insight (AI-generated)
export interface HealthInsight {
  insightId: string;
  generatedAt: number;
  type: 'pattern' | 'anomaly' | 'prediction' | 'optimization' | 'risk';
  confidence: number; // 0-1
  title: string;
  description: string;
  evidence: InsightEvidence[];
  recommendations: string[];
  impact: 'low' | 'medium' | 'high' | 'critical';
  timeframe: string;
  relatedComponents: string[];
  actionable: boolean;
}

// Insight evidence
export interface InsightEvidence {
  type: 'metric' | 'alert' | 'trend' | 'correlation';
  description: string;
  data: Record<string, any>;
  confidence: number; // 0-1
}

// Monitoring integration configuration
export interface MonitoringIntegration {
  integrationId: string;
  name: string;
  type:
    | 'datadog'
    | 'newrelic'
    | 'prometheus'
    | 'grafana'
    | 'splunk'
    | 'elastic'
    | 'custom';
  enabled: boolean;
  configuration: MonitoringIntegrationConfig;
  exportConfig: MetricsExportConfig;
  webhookConfig?: HealthWebhook;
  syncInterval: number; // ms
  lastSync?: number;
  status: 'active' | 'inactive' | 'error';
  errorMessage?: string;
}

// Monitoring integration configuration
export interface MonitoringIntegrationConfig {
  // Datadog configuration
  datadogApiKey?: string;
  datadogAppKey?: string;
  datadogSite?: string;

  // New Relic configuration
  newRelicApiKey?: string;
  newRelicAccountId?: string;

  // Prometheus configuration
  prometheusEndpoint?: string;
  prometheusAuth?: AuthConfig;

  // Grafana configuration
  grafanaUrl?: string;
  grafanaApiKey?: string;

  // Splunk configuration
  splunkUrl?: string;
  splunkToken?: string;
  splunkIndex?: string;

  // Elastic configuration
  elasticUrl?: string;
  elasticApiKey?: string;
  elasticIndex?: string;

  // Custom configuration
  customEndpoint?: string;
  customHeaders?: Record<string, string>;
  customAuth?: AuthConfig;
  customConfig?: Record<string, any>;
}

// Authentication configuration
export interface AuthConfig {
  type: 'basic' | 'bearer' | 'api_key' | 'oauth2';
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  oauthConfig?: OAuth2Config;
}

// OAuth2 configuration
export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scopes?: string[];
}

// Metrics export configuration
export interface MetricsExportConfig {
  enabled: boolean;
  exportInterval: number; // ms
  batchSize: number;
  retryPolicy: ExportRetryPolicy;
  filterRules: MetricsFilterRule[];
  transformationRules: MetricsTransformationRule[];
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

// Export retry policy
export interface ExportRetryPolicy {
  enabled: boolean;
  maxRetries: number;
  retryInterval: number; // ms
  backoffStrategy: 'linear' | 'exponential';
  maxRetryInterval: number; // ms
}

// Metrics filter rule
export interface MetricsFilterRule {
  ruleId: string;
  condition: string; // expression to evaluate
  action: 'include' | 'exclude';
  priority: number;
}

// Metrics transformation rule
export interface MetricsTransformationRule {
  ruleId: string;
  sourceField: string;
  targetField: string;
  transformation: 'rename' | 'scale' | 'convert_unit' | 'aggregate' | 'custom';
  parameters?: Record<string, any>;
}

// Health webhook configuration
export interface HealthWebhook {
  webhookId: string;
  name: string;
  url: string;
  enabled: boolean;
  events: HealthWebhookEvent[];
  headers: Record<string, string>;
  authentication?: AuthConfig;
  retryPolicy: WebhookRetryPolicy;
  rateLimiting: RateLimitConfig;
  payloadTemplate?: string;
  signatureSecret?: string;
}

// Health webhook event
export type HealthWebhookEvent =
  | 'health_status_change'
  | 'alert_triggered'
  | 'alert_resolved'
  | 'anomaly_detected'
  | 'performance_degradation'
  | 'component_failure'
  | 'maintenance_window'
  | 'custom_event';

// Webhook retry policy
export interface WebhookRetryPolicy {
  enabled: boolean;
  maxRetries: number;
  retryInterval: number; // ms
  backoffStrategy: 'linear' | 'exponential';
  retryOnStatusCodes: number[];
}

// Real-time monitoring event
export interface RealTimeMonitoringEvent {
  eventId: string;
  timestamp: number;
  eventType: RealTimeEventType;
  source: string; // component or service name
  severity: 'info' | 'warning' | 'error' | 'critical';
  data: Record<string, any>;
  correlationId?: string;
  tags: string[];
}

// Real-time event type
export type RealTimeEventType =
  | 'metric_update'
  | 'health_change'
  | 'alert_triggered'
  | 'alert_resolved'
  | 'anomaly_detected'
  | 'performance_threshold_breach'
  | 'component_status_change'
  | 'error_occurred'
  | 'recovery_completed'
  | 'maintenance_started'
  | 'maintenance_completed'
  | 'custom_event';

// Monitoring session
export interface MonitoringSession {
  sessionId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  connectionType: 'websocket' | 'eventsource' | 'polling';
  subscriptions: MonitoringSubscription[];
  filters: SessionFilter[];
  status: 'active' | 'inactive' | 'error';
  lastActivity: number;
  eventCount: number;
}

// Monitoring subscription
export interface MonitoringSubscription {
  subscriptionId: string;
  eventTypes: RealTimeEventType[];
  components: string[];
  severityFilter: ('info' | 'warning' | 'error' | 'critical')[];
  customFilters: Record<string, any>;
  bufferSize: number;
  compressionEnabled: boolean;
}

// Session filter
export interface SessionFilter {
  filterId: string;
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'regex' | 'gt' | 'lt';
  value: any;
  active: boolean;
}

// ============================================================================
// Story 2.4 Task 2: Global CDN Optimization System Interfaces
// ============================================================================

// CDN Optimization Configuration
export interface CDNOptimizationConfig {
  enabled: boolean;
  provider: CDNProvider;
  edgeConfiguration: CDNEdgeConfig;
  contentOptimization: ContentOptimizationConfig;
  performanceMonitoring: CDNPerformanceMonitoringConfig;
  geographicDistribution: GeographicDistributionConfig;
  adaptiveStreaming: AdaptiveStreamingConfig;
  analytics: CDNAnalyticsConfig;
  fallbackStrategy: CDNFallbackStrategy;
}

// CDN Provider Configuration
export interface CDNProvider {
  name: 'cloudflare' | 'amazon' | 'google' | 'azure' | 'custom';
  primaryEndpoint: string;
  backupEndpoints: string[];
  apiKey?: string;
  apiSecret?: string;
  zoneId?: string;
  customConfig?: Record<string, any>;
}

// CDN Edge Configuration
export interface CDNEdgeConfig {
  enabled: boolean;
  edgeLocations: EdgeLocation[];
  routingStrategy: EdgeRoutingStrategy;
  loadBalancing: LoadBalancingConfig;
  healthChecking: EdgeHealthCheckConfig;
  failoverConfig: EdgeFailoverConfig;
  cachingStrategy: EdgeCachingStrategy;
}

// Edge Location Information
export interface EdgeLocation {
  locationId: string;
  name: string;
  region: string;
  country: string;
  city: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  endpoint: string;
  capacity: number; // requests per second
  currentLoad: number; // 0-1
  latency: number; // ms
  availability: number; // 0-1
  features: EdgeFeature[];
  status: 'active' | 'maintenance' | 'offline';
  lastHealthCheck: number;
}

// Edge Features
export type EdgeFeature =
  | 'compression'
  | 'image_optimization'
  | 'video_optimization'
  | 'audio_optimization'
  | 'format_conversion'
  | 'caching'
  | 'ssl_termination'
  | 'ddos_protection'
  | 'rate_limiting';

// Geographic Distribution Configuration
export interface GeographicDistributionConfig {
  enabled: boolean;
  regions: string[];
  edgeSelection: EdgeSelectionStrategy;
  loadBalancing: GeographicLoadBalancingConfig;
  failoverStrategy: GeographicFailoverStrategy;
  latencyOptimization: boolean;
  geolocationEnabled: boolean;
}

// Edge Selection Strategy
export interface EdgeSelectionStrategy {
  algorithm: 'nearest' | 'performance_based' | 'load_based' | 'hybrid';
  fallbackOrder: string[];
  selectionCriteria: EdgeSelectionCriteria;
}

// Edge Selection Criteria
export interface EdgeSelectionCriteria {
  latencyWeight: number; // 0-1
  loadWeight: number; // 0-1
  availabilityWeight: number; // 0-1
  costWeight: number; // 0-1
}

// Geographic Load Balancing Configuration
export interface GeographicLoadBalancingConfig {
  enabled: boolean;
  strategy: 'regional' | 'global' | 'hybrid';
  regionWeights: Record<string, number>;
  crossRegionFailover: boolean;
}

// Geographic Failover Strategy
export interface GeographicFailoverStrategy {
  enabled: boolean;
  failoverOrder: string[]; // region order
  automaticFailover: boolean;
  failoverThreshold: number; // error rate percentage
  recoveryThreshold: number; // success rate percentage
}

// Edge Routing Strategy
export interface EdgeRoutingStrategy {
  algorithm:
    | 'latency_based'
    | 'geographic'
    | 'load_based'
    | 'hybrid'
    | 'custom';
  weights: RoutingWeights;
  fallbackOrder: string[]; // edge location IDs
  stickySession: boolean;
  sessionAffinityDuration: number; // ms
  customRoutingRules: RoutingRule[];
}

// Routing Weights
export interface RoutingWeights {
  latency: number; // 0-1
  load: number; // 0-1
  geographic: number; // 0-1
  availability: number; // 0-1
  cost: number; // 0-1
  custom: Record<string, number>;
}

// Routing Rule
export interface RoutingRule {
  ruleId: string;
  condition: string; // expression to evaluate
  targetEdge: string; // edge location ID
  priority: number;
  enabled: boolean;
}

// Load Balancing Configuration
export interface LoadBalancingConfig {
  algorithm:
    | 'round_robin'
    | 'weighted'
    | 'least_connections'
    | 'ip_hash'
    | 'adaptive';
  healthCheckEnabled: boolean;
  healthCheckInterval: number; // ms
  maxConnections: number;
  connectionTimeout: number; // ms
  retryPolicy: LoadBalancingRetryPolicy;
}

// Load Balancing Retry Policy
export interface LoadBalancingRetryPolicy {
  maxRetries: number;
  retryInterval: number; // ms
  backoffStrategy: 'linear' | 'exponential';
  retryOnStatusCodes: number[];
}

// Edge Health Check Configuration
export interface EdgeHealthCheckConfig {
  enabled: boolean;
  interval: number; // ms
  timeout: number; // ms
  healthyThreshold: number;
  unhealthyThreshold: number;
  checkPath: string;
  expectedStatus: number;
  customChecks: CustomEdgeHealthCheck[];
}

// Custom Edge Health Check
export interface CustomEdgeHealthCheck {
  checkId: string;
  name: string;
  checkFunction: string; // function name or endpoint
  weight: number;
  timeout: number;
  parameters: Record<string, any>;
}

// Edge Failover Configuration
export interface EdgeFailoverConfig {
  enabled: boolean;
  failoverThreshold: number; // error rate percentage
  failoverDelay: number; // ms
  recoveryThreshold: number; // success rate percentage
  recoveryDelay: number; // ms
  automaticFailback: boolean;
  notificationEnabled: boolean;
}

// Edge Caching Strategy
export interface EdgeCachingStrategy {
  enabled: boolean;
  defaultTtl: number; // seconds
  maxTtl: number; // seconds
  cacheRules: CacheRule[];
  compressionEnabled: boolean;
  compressionLevel: 'low' | 'medium' | 'high' | 'adaptive';
  purgeStrategy: CachePurgeStrategy;
}

// Cache Rule
export interface CacheRule {
  ruleId: string;
  pattern: string; // URL pattern or regex
  ttl: number; // seconds
  cacheKey: string; // custom cache key pattern
  varyHeaders: string[];
  enabled: boolean;
  priority: number;
}

// Cache Purge Strategy
export interface CachePurgeStrategy {
  enabled: boolean;
  purgeOnUpdate: boolean;
  purgePatterns: string[];
  batchPurging: boolean;
  purgeDelay: number; // ms
}

// Content Optimization Configuration
export interface ContentOptimizationConfig {
  enabled: boolean;
  imageOptimization: ImageOptimizationConfig;
  audioOptimization: AudioOptimizationConfig;
  compressionConfig: CompressionConfig;
  formatConversion: FormatConversionConfig;
  bandwidthAdaptation: BandwidthAdaptationConfig;
  qualityAdaptation: QualityAdaptationConfig;
}

// Image Optimization Configuration
export interface ImageOptimizationConfig {
  enabled: boolean;
  formats: ('webp' | 'avif' | 'jpeg' | 'png')[];
  qualityLevels: QualityLevel[];
  resizing: boolean;
  compression: boolean;
  lazyLoading: boolean;
}

// Audio Optimization Configuration
export interface AudioOptimizationConfig {
  enabled: boolean;
  formats: ('mp3' | 'aac' | 'ogg' | 'webm')[];
  qualityLevels: AudioQualityLevel[];
  compression: boolean;
  normalization: boolean;
  dynamicRange: boolean;
}

// Quality Level
export interface QualityLevel {
  name: string;
  quality: number; // 0-100
  maxSize: number; // bytes
  targetBitrate?: number; // for audio/video
}

// Audio Quality Level
export interface AudioQualityLevel {
  name: string;
  bitrate: number; // kbps
  sampleRate: number; // Hz
  channels: number;
  format: string;
}

// Compression Configuration
export interface CompressionConfig {
  enabled: boolean;
  algorithms: ('gzip' | 'brotli' | 'deflate')[];
  level: number; // 1-9
  minSize: number; // bytes - minimum file size to compress
  contentTypes: string[]; // MIME types to compress
  adaptiveCompression: boolean;
}

// Format Conversion Configuration
export interface FormatConversionConfig {
  enabled: boolean;
  imageConversion: ImageConversionRule[];
  audioConversion: AudioConversionRule[];
  automaticConversion: boolean;
  fallbackFormats: Record<string, string>;
}

// Image Conversion Rule
export interface ImageConversionRule {
  ruleId: string;
  sourceFormat: string;
  targetFormat: string;
  condition: string; // when to apply conversion
  quality: number;
  enabled: boolean;
}

// Audio Conversion Rule
export interface AudioConversionRule {
  ruleId: string;
  sourceFormat: string;
  targetFormat: string;
  condition: string; // when to apply conversion
  bitrate: number;
  sampleRate: number;
  enabled: boolean;
}

// Bandwidth Adaptation Configuration
export interface BandwidthAdaptationConfig {
  enabled: boolean;
  networkDetection: NetworkDetectionConfig;
  adaptationRules: BandwidthAdaptationRule[];
  fallbackStrategy: 'lower_quality' | 'progressive_loading' | 'compression';
  bufferManagement: BufferManagementConfig;
}

// Network Detection Configuration
export interface NetworkDetectionConfig {
  enabled: boolean;
  detectionInterval: number; // ms
  speedTestEnabled: boolean;
  speedTestUrl?: string;
  connectionTypeDetection: boolean;
  latencyMeasurement: boolean;
}

// Bandwidth Adaptation Rule
export interface BandwidthAdaptationRule {
  ruleId: string;
  networkCondition: NetworkCondition;
  qualityLevel: string;
  compressionLevel: string;
  enabled: boolean;
  priority: number;
}

// Network Condition
export interface NetworkCondition {
  minBandwidth?: number; // bytes/sec
  maxBandwidth?: number; // bytes/sec
  maxLatency?: number; // ms
  connectionType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  connectionQuality?: 'excellent' | 'good' | 'fair' | 'poor';
}

// Buffer Management Configuration
export interface BufferManagementConfig {
  enabled: boolean;
  bufferSize: number; // bytes
  preloadSize: number; // bytes
  adaptiveBuffering: boolean;
  bufferHealthThreshold: number; // 0-1
}

// Quality Adaptation Configuration
export interface QualityAdaptationConfig {
  enabled: boolean;
  adaptationStrategy:
    | 'bandwidth_based'
    | 'device_based'
    | 'user_preference'
    | 'hybrid';
  deviceDetection: DeviceDetectionConfig;
  userPreferences: UserPreferenceConfig;
  adaptationRules: QualityAdaptationRule[];
}

// Device Detection Configuration
export interface DeviceDetectionConfig {
  enabled: boolean;
  screenResolutionDetection: boolean;
  deviceTypeDetection: boolean;
  performanceDetection: boolean;
  batteryLevelDetection: boolean;
}

// User Preference Configuration
export interface UserPreferenceConfig {
  enabled: boolean;
  allowUserOverride: boolean;
  persistPreferences: boolean;
  preferenceCategories: ('quality' | 'speed' | 'data_saving')[];
}

// Quality Adaptation Rule
export interface QualityAdaptationRule {
  ruleId: string;
  condition: AdaptationCondition;
  targetQuality: string;
  enabled: boolean;
  priority: number;
}

// Adaptation Condition
export interface AdaptationCondition {
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  screenResolution?: { width: number; height: number };
  networkCondition?: NetworkCondition;
  batteryLevel?: number; // 0-100
  userPreference?: string;
  customCondition?: string;
}

// Adaptive Streaming Configuration
export interface AdaptiveStreamingConfig {
  enabled: boolean;
  streamingProtocol: 'hls' | 'dash' | 'progressive' | 'adaptive';
  qualityLevels: StreamingQualityLevel[];
  bitrateAdaptation: BitrateAdaptationConfig;
  bufferConfig: StreamingBufferConfig;
  fallbackConfig: StreamingFallbackConfig;
}

// Streaming Quality Level
export interface StreamingQualityLevel {
  levelId: string;
  name: string;
  bitrate: number; // kbps
  resolution?: { width: number; height: number };
  framerate?: number;
  codec: string;
  enabled: boolean;
}

// Bitrate Adaptation Configuration
export interface BitrateAdaptationConfig {
  enabled: boolean;
  adaptationAlgorithm: 'throughput_based' | 'buffer_based' | 'hybrid';
  switchingThreshold: number; // percentage
  stabilityPeriod: number; // ms
  maxSwitchesPerMinute: number;
}

// Streaming Buffer Configuration
export interface StreamingBufferConfig {
  initialBuffer: number; // seconds
  maxBuffer: number; // seconds
  rebufferThreshold: number; // seconds
  seekBuffer: number; // seconds
}

// Streaming Fallback Configuration
export interface StreamingFallbackConfig {
  enabled: boolean;
  fallbackProtocol: string;
  fallbackQuality: string;
  maxFallbackAttempts: number;
  fallbackDelay: number; // ms
}

// CDN Performance Monitoring Configuration
export interface CDNPerformanceMonitoringConfig {
  enabled: boolean;
  metricsCollection: CDNMetricsCollectionConfig;
  performanceThresholds: CDNPerformanceThresholds;
  alerting: CDNAlertingConfig;
  reporting: CDNReportingConfig;
  realTimeMonitoring: CDNRealTimeMonitoringConfig;
}

// CDN Metrics Collection Configuration
export interface CDNMetricsCollectionConfig {
  enabled: boolean;
  collectionInterval: number; // ms
  metricsToCollect: CDNMetricType[];
  aggregationLevels: ('minute' | 'hour' | 'day')[];
  retentionPeriod: number; // days
  customMetrics: CustomCDNMetric[];
}

// CDN Metric Types
export type CDNMetricType =
  | 'response_time'
  | 'throughput'
  | 'cache_hit_rate'
  | 'bandwidth_usage'
  | 'error_rate'
  | 'availability'
  | 'edge_performance'
  | 'geographic_performance'
  | 'content_optimization_savings'
  | 'user_experience_score';

// Custom CDN Metric
export interface CustomCDNMetric {
  metricId: string;
  name: string;
  description: string;
  unit: string;
  collectionMethod: string;
  aggregationType: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

// CDN Performance Thresholds
export interface CDNPerformanceThresholds {
  responseTime: {
    warning: number; // ms
    critical: number; // ms
  };
  cacheHitRate: {
    warning: number; // percentage
    critical: number; // percentage
  };
  errorRate: {
    warning: number; // percentage
    critical: number; // percentage
  };
  availability: {
    warning: number; // percentage
    critical: number; // percentage
  };
  customThresholds: Record<string, { warning: number; critical: number }>;
}

// CDN Alerting Configuration
export interface CDNAlertingConfig {
  enabled: boolean;
  alertRules: CDNAlertRule[];
  notificationChannels: string[]; // channel IDs
  escalationEnabled: boolean;
  suppressionRules: CDNAlertSuppressionRule[];
}

// CDN Alert Rule
export interface CDNAlertRule {
  ruleId: string;
  name: string;
  metricType: CDNMetricType;
  condition: AlertCondition;
  severity: 'warning' | 'critical';
  enabled: boolean;
  edgeLocationFilter?: string[];
  regionFilter?: string[];
}

// CDN Alert Suppression Rule
export interface CDNAlertSuppressionRule {
  ruleId: string;
  condition: string;
  suppressionDuration: number; // ms
  reason: string;
  enabled: boolean;
}

// CDN Reporting Configuration
export interface CDNReportingConfig {
  enabled: boolean;
  reportTypes: CDNReportType[];
  reportSchedule: ReportSchedule;
  recipients: string[];
  customReports: CustomCDNReport[];
}

// CDN Report Types
export type CDNReportType =
  | 'performance_summary'
  | 'cache_efficiency'
  | 'geographic_analysis'
  | 'cost_analysis'
  | 'optimization_recommendations'
  | 'sla_compliance';

// Report Schedule
export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM
  timezone: string;
  enabled: boolean;
}

// Custom CDN Report
export interface CustomCDNReport {
  reportId: string;
  name: string;
  description: string;
  metrics: string[];
  filters: Record<string, any>;
  schedule: ReportSchedule;
}

// CDN Real-time Monitoring Configuration
export interface CDNRealTimeMonitoringConfig {
  enabled: boolean;
  updateInterval: number; // ms
  dashboardEnabled: boolean;
  alertingEnabled: boolean;
  metricsStreaming: boolean;
  geographicVisualization: boolean;
}

// CDN Analytics Configuration
export interface CDNAnalyticsConfig {
  enabled: boolean;
  dataCollection: CDNDataCollectionConfig;
  analysis: CDNAnalysisConfig;
  optimization: CDNOptimizationAnalysisConfig;
  reporting: CDNAnalyticsReportingConfig;
  integration: CDNAnalyticsIntegrationConfig;
}

// CDN Data Collection Configuration
export interface CDNDataCollectionConfig {
  enabled: boolean;
  userBehaviorTracking: boolean;
  performanceTracking: boolean;
  errorTracking: boolean;
  geographicTracking: boolean;
  deviceTracking: boolean;
  networkTracking: boolean;
  contentTracking: boolean;
  samplingRate: number; // 0-1
}

// CDN Analysis Configuration
export interface CDNAnalysisConfig {
  enabled: boolean;
  trendAnalysis: boolean;
  anomalyDetection: boolean;
  performancePrediction: boolean;
  userSegmentation: boolean;
  geographicAnalysis: boolean;
  contentAnalysis: boolean;
  optimizationAnalysis: boolean;
}

// CDN Optimization Analysis Configuration
export interface CDNOptimizationAnalysisConfig {
  enabled: boolean;
  cacheOptimization: boolean;
  routingOptimization: boolean;
  contentOptimization: boolean;
  performanceOptimization: boolean;
  costOptimization: boolean;
  automaticOptimization: boolean;
  optimizationRecommendations: boolean;
}

// CDN Analytics Reporting Configuration
export interface CDNAnalyticsReportingConfig {
  enabled: boolean;
  dashboardEnabled: boolean;
  scheduledReports: boolean;
  realTimeReports: boolean;
  customReports: boolean;
  dataExport: boolean;
  apiAccess: boolean;
}

// CDN Analytics Integration Configuration
export interface CDNAnalyticsIntegrationConfig {
  enabled: boolean;
  googleAnalytics?: GoogleAnalyticsIntegration;
  datadog?: DatadogIntegration;
  newRelic?: NewRelicIntegration;
  customIntegrations?: CustomAnalyticsIntegration[];
}

// Google Analytics Integration
export interface GoogleAnalyticsIntegration {
  enabled: boolean;
  trackingId: string;
  customDimensions: Record<string, string>;
  eventTracking: boolean;
}

// Datadog Integration
export interface DatadogIntegration {
  enabled: boolean;
  apiKey: string;
  tags: string[];
  customMetrics: boolean;
}

// New Relic Integration
export interface NewRelicIntegration {
  enabled: boolean;
  licenseKey: string;
  appName: string;
  customAttributes: Record<string, string>;
}

// Custom Analytics Integration
export interface CustomAnalyticsIntegration {
  integrationId: string;
  name: string;
  endpoint: string;
  authentication: AuthConfig;
  dataMapping: Record<string, string>;
  enabled: boolean;
}

// CDN Fallback Strategy
export interface CDNFallbackStrategy {
  enabled: boolean;
  fallbackOrder: CDNFallbackOption[];
  automaticFailover: boolean;
  failoverThreshold: number; // error rate percentage
  recoveryThreshold: number; // success rate percentage
  healthCheckInterval: number; // ms
  notificationEnabled: boolean;
}

// CDN Fallback Option
export interface CDNFallbackOption {
  optionId: string;
  type: 'origin_server' | 'backup_cdn' | 'cache' | 'local_storage';
  priority: number;
  configuration: Record<string, any>;
  healthCheck?: () => Promise<boolean>;
  enabled: boolean;
}

// CDN Performance Metrics
export interface CDNPerformanceMetrics {
  timestamp: number;

  // Response metrics
  averageResponseTime: number; // ms
  p50ResponseTime: number; // ms
  p95ResponseTime: number; // ms
  p99ResponseTime: number; // ms

  // Throughput metrics
  requestsPerSecond: number;
  bytesPerSecond: number;
  totalRequests: number;
  totalBytes: number;

  // Cache metrics
  cacheHitRate: number; // percentage
  cacheMissRate: number; // percentage
  cacheSize: number; // bytes
  cacheEvictions: number;

  // Error metrics
  errorRate: number; // percentage
  timeoutRate: number; // percentage
  errorsByType: Record<string, number>;

  // Geographic metrics
  edgePerformance: EdgePerformanceMetric[];
  geographicDistribution: GeographicMetric[];

  // Optimization metrics
  compressionSavings: number; // bytes
  formatConversionSavings: number; // bytes
  optimizationRatio: number; // 0-1

  // User experience metrics
  userExperienceScore: number; // 0-100
  loadTimePercentiles: Record<string, number>;

  // Custom metrics
  customMetrics: Record<string, number>;
}

// Edge Performance Metric
export interface EdgePerformanceMetric {
  edgeLocationId: string;
  responseTime: number; // ms
  throughput: number; // requests/sec
  errorRate: number; // percentage
  cacheHitRate: number; // percentage
  load: number; // 0-1
  availability: number; // 0-1
}

// Geographic Metric
export interface GeographicMetric {
  region: string;
  country: string;
  requestCount: number;
  averageResponseTime: number; // ms
  errorRate: number; // percentage
  userCount: number;
}

// CDN Optimization Recommendation
export interface CDNOptimizationRecommendation {
  recommendationId: string;
  type:
    | 'cache_optimization'
    | 'routing_optimization'
    | 'content_optimization'
    | 'performance_optimization'
    | 'cost_optimization';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: OptimizationImpact;
  implementation: OptimizationImplementation;
  metrics: OptimizationMetrics;
  createdAt: number;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
}

// Optimization Impact
export interface OptimizationImpact {
  performanceImprovement: number; // percentage
  costSavings: number; // currency amount
  userExperienceImprovement: number; // percentage
  bandwidthSavings: number; // bytes
  cacheEfficiencyImprovement: number; // percentage
}

// Optimization Implementation
export interface OptimizationImplementation {
  effort: 'low' | 'medium' | 'high';
  timeToImplement: number; // hours
  requiredResources: string[];
  risks: string[];
  steps: string[];
  autoImplementable: boolean;
}

// Optimization Metrics
export interface OptimizationMetrics {
  baselineMetrics: Record<string, number>;
  projectedMetrics: Record<string, number>;
  actualMetrics?: Record<string, number>;
  improvementPercentage: Record<string, number>;
}

// CDN Health Status
export interface CDNHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  score: number; // 0-100
  components: CDNComponentHealth[];
  edgeLocations: EdgeLocationHealth[];
  lastCheck: number;
  issues: CDNHealthIssue[];
  recommendations: string[];
}

// CDN Component Health
export interface CDNComponentHealth {
  component:
    | 'routing'
    | 'caching'
    | 'optimization'
    | 'monitoring'
    | 'analytics';
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number; // 0-100
  metrics: Record<string, number>;
  lastCheck: number;
  issues: string[];
}

// Edge Location Health
export interface EdgeLocationHealth {
  edgeLocationId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  score: number; // 0-100
  responseTime: number; // ms
  errorRate: number; // percentage
  load: number; // 0-1
  lastCheck: number;
}

// CDN Health Issue
export interface CDNHealthIssue {
  issueId: string;
  type: 'performance' | 'availability' | 'configuration' | 'capacity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  description: string;
  detectedAt: number;
  resolved: boolean;
  resolvedAt?: number;
  impact: string;
  recommendedAction: string;
}

/**
 * ================================================================================
 * Story 2.4 Task 3: Predictive Asset Loading Engine - Advanced ML-Based Contracts
 * ================================================================================
 */

// Enhanced Predictive Loading Engine Configuration
export interface PredictiveLoadingEngineConfig {
  enabled: boolean;
  learningConfig: MachineLearningConfig;
  behaviorAnalysisConfig: BehaviorAnalysisConfig;
  prefetchingConfig: IntelligentPrefetchingConfig;
  modelConfig: PredictiveModelConfig;
  adaptiveLearningConfig: AdaptiveLearningConfig;
  performanceOptimization: PredictivePerformanceConfig;
  analyticsIntegration: AnalyticsIntegrationConfig;
}

// Machine Learning Configuration
export interface MachineLearningConfig {
  enabled: boolean;
  modelType: 'neural_network' | 'decision_tree' | 'ensemble' | 'hybrid';
  trainingConfig: ModelTrainingConfig;
  featureEngineering: FeatureEngineeringConfig;
  modelPersistence: ModelPersistenceConfig;
  predictionThresholds: PredictionThresholds;
  crossValidation: CrossValidationConfig;
}

// Model Training Configuration
export interface ModelTrainingConfig {
  batchSize: number;
  maxEpochs: number;
  learningRate: number;
  regularization: RegularizationConfig;
  earlyStopping: EarlyStoppingConfig;
  optimizerType: 'adam' | 'sgd' | 'rmsprop' | 'adagrad';
  lossFunction: 'mse' | 'binary_crossentropy' | 'categorical_crossentropy';
  trainingSchedule: TrainingSchedule;
}

// Feature Engineering Configuration
export interface FeatureEngineeringConfig {
  enabled: boolean;
  temporalFeatures: TemporalFeatureConfig;
  behavioralFeatures: BehavioralFeatureConfig;
  contextualFeatures: ContextualFeatureConfig;
  assetFeatures: AssetFeatureConfig;
  sequentialFeatures: SequentialFeatureConfig;
  featureNormalization: FeatureNormalizationConfig;
}

// Behavior Analysis Configuration
export interface BehaviorAnalysisConfig {
  enabled: boolean;
  patternRecognition: PatternRecognitionConfig;
  sessionAnalysis: SessionAnalysisConfig;
  practiceRoutineAnalysis: PracticeRoutineAnalysisConfig;
  userSegmentation: UserSegmentationConfig;
  temporalPatterns: TemporalPatternConfig;
  correlationAnalysis: CorrelationAnalysisConfig;
}

// Intelligent Prefetching Configuration
export interface IntelligentPrefetchingConfig {
  enabled: boolean;
  strategy: PrefetchingStrategy;
  prioritization: PrefetchPrioritizationConfig;
  resourceManagement: PrefetchResourceManagementConfig;
  networkAware: NetworkAwarePrefetchingConfig;
  backgroundPrefetching: BackgroundPrefetchingConfig;
  prefetchValidation: PrefetchValidationConfig;
}

// Predictive Model Configuration
export interface PredictiveModelConfig {
  exerciseProgressionModel: ExerciseProgressionModelConfig;
  assetDemandModel: AssetDemandModelConfig;
  userIntentModel: UserIntentModelConfig;
  sessionLengthModel: SessionLengthModelConfig;
  skillDevelopmentModel: SkillDevelopmentModelConfig;
  modelEnsembleConfig: ModelEnsembleConfig;
}

// Adaptive Learning Configuration
export interface AdaptiveLearningConfig {
  enabled: boolean;
  feedbackLoop: FeedbackLoopConfig;
  modelUpdateStrategy: ModelUpdateStrategy;
  performanceThresholds: AdaptivePerformanceThresholds;
  onlineLearning: OnlineLearningConfig;
  transferLearning: TransferLearningConfig;
  continuousImprovement: ContinuousImprovementConfig;
}

// Predictive Performance Configuration
export interface PredictivePerformanceConfig {
  accuracyMetrics: AccuracyMetricsConfig;
  latencyRequirements: LatencyRequirementsConfig;
  resourceLimits: ResourceLimitsConfig;
  optimizationTargets: OptimizationTargetsConfig;
  monitoringConfig: PredictiveMonitoringConfig;
}

// Analytics Integration Configuration
export interface AnalyticsIntegrationConfig {
  story23AnalyticsEngine: boolean; // Integration with completed Story 2.3 AnalyticsEngine
  behaviorPatternIntegration: BehaviorPatternIntegrationConfig;
  practiceSessionIntegration: PracticeSessionIntegrationConfig;
  progressAnalysisIntegration: ProgressAnalysisIntegrationConfig;
  dataExchangeProtocol: DataExchangeProtocolConfig;
}

// ================================================================================
// Core Prediction Types
// ================================================================================

// Asset Prediction Result
export interface AssetPrediction {
  predictionId: string;
  assetId: string;
  assetPath: string;
  bucket: string;
  confidence: number; // 0-1
  timeToNeed: number; // milliseconds until asset is likely needed
  priority: PredictionPriority;
  context: PredictionContext;
  triggers: PredictionTrigger[];
  metadata: PredictionMetadata;
  validUntil: number; // timestamp
}

// User Behavior Profile
export interface UserBehaviorProfile {
  userId: string;
  profileId: string;
  createdAt: number;
  lastUpdated: number;
  practicePatterns: PracticePattern[];
  assetUsagePatterns: AssetUsagePattern[];
  learningCharacteristics: LearningCharacteristics;
  preferences: UserPreferences;
  skillProgression: SkillProgression;
  sessionCharacteristics: SessionCharacteristics;
  predictiveMetrics: PredictiveMetrics;
}

// Practice Pattern
export interface PracticePattern {
  patternId: string;
  type: PracticePatternType;
  frequency: number;
  consistency: number; // 0-1
  timeOfDay: TimeOfDayPattern;
  duration: DurationPattern;
  intensity: IntensityPattern;
  assetPreference: AssetPreferencePattern;
  progressionStyle: ProgressionStylePattern;
  confidence: number; // 0-1
  lastObserved: number;
}

// Asset Usage Pattern
export interface AssetUsagePattern {
  patternId: string;
  assetType: AssetType;
  usageFrequency: number;
  accessSequence: AssetAccessSequence[];
  contextualUsage: ContextualUsage[];
  seasonalTrends: SeasonalTrend[];
  correlatedAssets: CorrelatedAsset[];
  predictiveValue: number; // how useful this pattern is for prediction
}

// Learning Event
export interface LearningEvent {
  eventId: string;
  timestamp: number;
  eventType: LearningEventType;
  context: LearningEventContext;
  assets: LearningEventAsset[];
  outcome: LearningOutcome;
  features: LearningEventFeatures;
  labels: LearningEventLabels;
}

// Prefetch Request
export interface PrefetchRequest {
  requestId: string;
  userId: string;
  predictions: AssetPrediction[];
  priority: PredictionPriority;
  networkCondition: NetworkCondition;
  resourceLimits: PrefetchResourceLimits;
  validationRules: PrefetchValidationRule[];
  metadata: PrefetchRequestMetadata;
}

// Prefetch Result
export interface PrefetchResult {
  requestId: string;
  results: PrefetchAssetResult[];
  totalSize: number; // bytes
  totalTime: number; // ms
  successRate: number; // 0-1
  networkEfficiency: number; // 0-1
  cacheUtilization: number; // 0-1
  resourceUsage: PrefetchResourceUsage;
  performance: PrefetchPerformance;
}

// Model Performance Metrics
export interface ModelPerformanceMetrics {
  modelId: string;
  accuracy: number; // 0-1
  precision: number; // 0-1
  recall: number; // 0-1
  f1Score: number; // 0-1
  auc: number; // 0-1 Area Under Curve
  confusionMatrix: ConfusionMatrix;
  crossValidationScore: number; // 0-1
  generalizationError: number;
  trainingHistory: TrainingHistoryEntry[];
  predictionLatency: number; // ms
  lastEvaluated: number;
}

// Adaptive Learning Metrics
export interface AdaptiveLearningMetrics {
  adaptationRate: number; // how quickly the model adapts
  improvementTrend: 'improving' | 'stable' | 'degrading';
  feedbackIncorporation: number; // 0-1 how well feedback is used
  modelStability: number; // 0-1
  knowledgeRetention: number; // 0-1
  transferEffectiveness: number; // 0-1
  continuousAccuracy: number; // 0-1
  adaptationHistory: AdaptationHistoryEntry[];
}

// ================================================================================
// Detailed Configuration Types
// ================================================================================

// Regularization Configuration
export interface RegularizationConfig {
  l1Penalty: number;
  l2Penalty: number;
  dropoutRate: number;
  batchNormalization: boolean;
  weightDecay: number;
}

// Early Stopping Configuration
export interface EarlyStoppingConfig {
  enabled: boolean;
  patience: number; // epochs to wait for improvement
  minImprovement: number; // minimum improvement required
  monitorMetric: 'loss' | 'accuracy' | 'val_loss' | 'val_accuracy';
  restoreBestWeights: boolean;
}

// Training Schedule
export interface TrainingSchedule {
  frequency: 'continuous' | 'hourly' | 'daily' | 'weekly';
  batchTraining: boolean;
  incrementalLearning: boolean;
  retrainingTriggers: RetrainingTrigger[];
  maintenanceWindow: MaintenanceWindow;
}

// Temporal Feature Configuration
export interface TemporalFeatureConfig {
  timeOfDay: boolean;
  dayOfWeek: boolean;
  seasonality: boolean;
  timeSinceLastPractice: boolean;
  practiceSessionLength: boolean;
  sequencePosition: boolean;
  historicalTrends: boolean;
  cyclicalPatterns: boolean;
}

// Behavioral Feature Configuration
export interface BehavioralFeatureConfig {
  practiceConsistency: boolean;
  skillProgressionRate: boolean;
  errorPatterns: boolean;
  preferenceShifts: boolean;
  engagementLevel: boolean;
  difficultyProgression: boolean;
  exerciseTypePreference: boolean;
  controlUsagePatterns: boolean;
}

// Contextual Feature Configuration
export interface ContextualFeatureConfig {
  deviceType: boolean;
  networkCondition: boolean;
  sessionContext: boolean;
  environmentalFactors: boolean;
  userState: boolean;
  applicationState: boolean;
  externalFactors: boolean;
  socialContext: boolean;
}

// Asset Feature Configuration
export interface AssetFeatureConfig {
  assetType: boolean;
  assetComplexity: boolean;
  assetPopularity: boolean;
  assetRelationships: boolean;
  assetMetadata: boolean;
  historicalPerformance: boolean;
  technicalProperties: boolean;
  contentCharacteristics: boolean;
}

// Sequential Feature Configuration
export interface SequentialFeatureConfig {
  sequenceLength: number;
  lookbackWindow: number; // time window to consider
  sequenceEncoding: 'rnn' | 'lstm' | 'transformer' | 'attention';
  sequenceWeighting: 'linear' | 'exponential' | 'attention_based';
  paddingStrategy: 'zero' | 'repeat' | 'interpolate';
}

// Feature Normalization Configuration
export interface FeatureNormalizationConfig {
  method: 'min_max' | 'z_score' | 'robust' | 'quantile';
  perFeature: boolean;
  onlineNormalization: boolean;
  adaptiveNormalization: boolean;
}

// Pattern Recognition Configuration
export interface PatternRecognitionConfig {
  algorithmType:
    | 'clustering'
    | 'classification'
    | 'association_rules'
    | 'ensemble';
  minPatternSupport: number; // 0-1
  confidenceThreshold: number; // 0-1
  patternTypes: PatternType[];
  temporalPatterns: boolean;
  hierarchicalPatterns: boolean;
  crossDomainPatterns: boolean;
}

// Session Analysis Configuration
export interface SessionAnalysisConfig {
  sessionSegmentation: boolean;
  transitionAnalysis: boolean;
  intentRecognition: boolean;
  goalInference: boolean;
  anomalyDetection: boolean;
  sessionSimilarity: boolean;
  outcomePredicition: boolean;
}

// Practice Routine Analysis Configuration
export interface PracticeRoutineAnalysisConfig {
  routineIdentification: boolean;
  routineEvolution: boolean;
  routineEffectiveness: boolean;
  routinePersonalization: boolean;
  routineRecommendation: boolean;
  routineOptimization: boolean;
}

// User Segmentation Configuration
export interface UserSegmentationConfig {
  segmentationMethod: 'behavioral' | 'demographic' | 'skill_based' | 'hybrid';
  numberOfSegments: number;
  segmentStability: boolean;
  dynamicSegmentation: boolean;
  personalization: boolean;
  segmentTransitions: boolean;
}

// Temporal Pattern Configuration
export interface TemporalPatternConfig {
  circadianPatterns: boolean;
  weeklyPatterns: boolean;
  seasonalPatterns: boolean;
  learningCurvePatterns: boolean;
  motivationPatterns: boolean;
  performancePatterns: boolean;
}

// Correlation Analysis Configuration
export interface CorrelationAnalysisConfig {
  featureCorrelations: boolean;
  assetCorrelations: boolean;
  behaviorCorrelations: boolean;
  outcomeCorrelations: boolean;
  crossModalCorrelations: boolean;
  temporalCorrelations: boolean;
}

// Prefetching Strategy
export interface PrefetchingStrategy {
  primaryStrategy: 'proactive' | 'reactive' | 'hybrid' | 'adaptive';
  lookAheadWindow: number; // milliseconds
  confidenceThreshold: number; // 0-1
  resourceAwareness: boolean;
  networkAwareness: boolean;
  userAwareness: boolean;
  contextAwareness: boolean;
}

// Prefetch Prioritization Configuration
export interface PrefetchPrioritizationConfig {
  primaryCriteria:
    | 'confidence'
    | 'time_to_need'
    | 'asset_size'
    | 'user_importance';
  weightingFactors: PrioritizationWeights;
  dynamicPriorities: boolean;
  userPreferences: boolean;
  contextualFactors: boolean;
  systemConstraints: boolean;
}

// Prefetch Resource Management Configuration
export interface PrefetchResourceManagementConfig {
  maxConcurrentPrefetches: number;
  maxPrefetchBandwidth: number; // bytes/sec
  maxPrefetchMemory: number; // bytes
  maxPrefetchStorage: number; // bytes
  resourceAllocation: ResourceAllocationStrategy;
  quotaManagement: QuotaManagementConfig;
  throttling: ThrottlingConfig;
}

// Network Aware Prefetching Configuration
export interface NetworkAwarePrefetchingConfig {
  enabled: boolean;
  networkQualityThresholds: NetworkQualityThresholds;
  adaptiveQuality: boolean;
  connectionTypeOptimization: boolean;
  latencyOptimization: boolean;
  bandwidthOptimization: boolean;
  costAwareness: boolean;
}

// Background Prefetching Configuration
export interface BackgroundPrefetchingConfig {
  enabled: boolean;
  idleTimeDetection: boolean;
  lowPriorityPrefetching: boolean;
  opportunisticPrefetching: boolean;
  backgroundLimits: BackgroundLimits;
  interruptibility: boolean;
  powerAwareness: boolean;
}

// Prefetch Validation Configuration
export interface PrefetchValidationConfig {
  enabled: boolean;
  validationRules: ValidationRule[];
  checksumValidation: boolean;
  integrityChecks: boolean;
  expiredAssetHandling: ExpirationHandlingStrategy;
  corruptionDetection: boolean;
  rollbackCapability: boolean;
}

// Model Ensemble Configuration
export interface ModelEnsembleConfig {
  enabled: boolean;
  ensembleMethod: 'voting' | 'averaging' | 'stacking' | 'blending';
  modelWeights: Record<string, number>;
  dynamicWeighting: boolean;
  diversityMaintenance: boolean;
  adaptiveEnsemble: boolean;
}

// Feedback Loop Configuration
export interface FeedbackLoopConfig {
  enabled: boolean;
  feedbackSources: FeedbackSource[];
  feedbackAggregation: FeedbackAggregationStrategy;
  feedbackWeighting: FeedbackWeightingConfig;
  rewardSignals: RewardSignalConfig;
  penaltySignals: PenaltySignalConfig;
  feedbackValidation: FeedbackValidationConfig;
}

// Model Update Strategy
export interface ModelUpdateStrategy {
  updateTriggers: ModelUpdateTrigger[];
  updateFrequency: UpdateFrequency;
  incrementalUpdates: boolean;
  batchUpdates: boolean;
  gradualRollout: boolean;
  rollbackStrategy: RollbackStrategy;
  versionControl: ModelVersionControl;
}

// Online Learning Configuration
export interface OnlineLearningConfig {
  enabled: boolean;
  learningRate: number;
  adaptationSpeed: 'slow' | 'medium' | 'fast' | 'adaptive';
  forgettingFactor: number; // 0-1
  conceptDriftDetection: boolean;
  distributionShiftHandling: boolean;
  catastrophicForgettingPrevention: boolean;
}

// Transfer Learning Configuration
export interface TransferLearningConfig {
  enabled: boolean;
  sourceModels: SourceModelConfig[];
  transferStrategy: 'feature_extraction' | 'fine_tuning' | 'domain_adaptation';
  similarityThreshold: number; // 0-1
  knowledgeDistillation: boolean;
  multitaskLearning: boolean;
}

// Continuous Improvement Configuration
export interface ContinuousImprovementConfig {
  enabled: boolean;
  improvementMetrics: ImprovementMetric[];
  experimentationFramework: ExperimentationConfig;
  abTesting: ABTestingConfig;
  performanceBaseline: PerformanceBaselineConfig;
  innovationRate: number; // 0-1
  conservativeness: number; // 0-1
}

// ================================================================================
// Enum Types
// ================================================================================

export type PredictionPriority =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'background';

export type PracticePatternType =
  | 'tempo_progression'
  | 'key_exploration'
  | 'difficulty_advancement'
  | 'exercise_sequencing'
  | 'session_structure'
  | 'break_patterns'
  | 'repetition_patterns'
  | 'exploration_patterns';

export type AssetType =
  | 'midi_file'
  | 'audio_sample'
  | 'backing_track'
  | 'exercise_asset'
  | 'ambient_track'
  | 'user_recording'
  | 'system_asset';

export type LearningEventType =
  | 'asset_access'
  | 'practice_session'
  | 'skill_demonstration'
  | 'error_correction'
  | 'achievement_unlock'
  | 'preference_update'
  | 'context_change';

export type PatternType =
  | 'sequential'
  | 'temporal'
  | 'frequency'
  | 'association'
  | 'clustering'
  | 'anomaly';

export type FeedbackSource =
  | 'user_explicit'
  | 'user_implicit'
  | 'system_performance'
  | 'accuracy_metrics'
  | 'usage_analytics'
  | 'error_analysis';

export type ModelUpdateTrigger =
  | 'performance_degradation'
  | 'new_data_available'
  | 'scheduled_update'
  | 'concept_drift_detected'
  | 'user_feedback'
  | 'external_event';

// ================================================================================
// Supporting Types
// ================================================================================

export interface PredictionContext {
  sessionId: string;
  userId: string;
  currentAsset?: string;
  practiceGoal?: string;
  sessionPhase: 'warmup' | 'main' | 'cooldown';
  timeRemaining: number; // estimated ms remaining in session
  skillLevel: string;
  environmentalFactors: Record<string, any>;
}

export interface PredictionTrigger {
  triggerType: 'pattern_match' | 'time_based' | 'event_based' | 'contextual';
  confidence: number; // 0-1
  evidence: string[];
  triggerTime: number;
}

export interface PredictionMetadata {
  modelVersion: string;
  predictionTime: number;
  features: Record<string, number>;
  explanations: string[];
  debugInfo?: Record<string, any>;
}

export interface LearningCharacteristics {
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  pacePreference: 'slow' | 'moderate' | 'fast' | 'variable';
  challengePreference: 'incremental' | 'steep' | 'plateau' | 'mixed';
  feedbackPreference: 'immediate' | 'periodic' | 'minimal';
  attentionSpan: number; // minutes
  retentionRate: number; // 0-1
  transferAbility: number; // 0-1
}

export interface UserPreferences {
  assetTypePreferences: Record<AssetType, number>; // 0-1
  qualityVsSpeed: number; // 0-1, 0=speed, 1=quality
  dataUsageAwareness: number; // 0-1
  batteryAwareness: number; // 0-1
  privacyLevel: 'minimal' | 'moderate' | 'strict';
  adaptationConsent: boolean;
}

export interface SkillProgression {
  currentLevel: Record<string, number>; // skill -> level (0-100)
  progressionRate: Record<string, number>; // skill -> rate per week
  strengthAreas: string[];
  improvementAreas: string[];
  learningVelocity: number; // overall rate of improvement
  consistencyScore: number; // 0-1
  plateauIndicators: PlateauIndicator[];
}

export interface SessionCharacteristics {
  averageDuration: number; // ms
  preferredStartTime: number; // hour of day
  typicalBreakPattern: BreakPattern[];
  intensityProfile: IntensityProfile;
  focusPattern: FocusPattern;
  motivationLevel: number; // 0-1
  dropoffRisk: number; // 0-1
}

export interface PredictiveMetrics {
  predictionAccuracy: number; // 0-1
  confidenceCalibration: number; // 0-1
  adaptationRate: number; // how quickly user patterns change
  predictabilityScore: number; // 0-1, how predictable this user is
  modelFitness: number; // 0-1, how well the model fits this user
  lastModelUpdate: number;
  predictionHistory: PredictionHistoryEntry[];
}

export interface AssetAccessSequence {
  assetId: string;
  accessOrder: number;
  timeOffset: number; // ms from session start
  duration: number; // ms spent with asset
  context: string;
}

export interface ContextualUsage {
  context: string;
  frequency: number;
  effectiveness: number; // 0-1
  userSatisfaction: number; // 0-1
}

export interface SeasonalTrend {
  season: 'spring' | 'summer' | 'fall' | 'winter';
  usageMultiplier: number; // relative to baseline
  confidence: number; // 0-1
}

export interface CorrelatedAsset {
  assetId: string;
  correlationStrength: number; // 0-1
  correlationType: 'sequential' | 'simultaneous' | 'alternative';
  confidence: number; // 0-1
}

export interface LearningEventContext {
  sessionId: string;
  sessionPhase: string;
  timeInSession: number; // ms
  practiceGoal: string;
  difficulty: number; // 0-100
  userState: string;
  environmentalFactors: Record<string, any>;
}

export interface LearningEventAsset {
  assetId: string;
  role: 'primary' | 'secondary' | 'reference' | 'fallback';
  interactionType: 'view' | 'play' | 'practice' | 'study';
  duration: number; // ms
  effectiveness: number; // 0-1
}

export interface LearningOutcome {
  outcomeType: 'success' | 'partial_success' | 'failure' | 'abandoned';
  metrics: Record<string, number>;
  userFeedback?: number; // 0-1
  objectively_measured?: boolean;
}

export interface LearningEventFeatures {
  temporal: Record<string, number>;
  behavioral: Record<string, number>;
  contextual: Record<string, number>;
  asset: Record<string, number>;
  sequential: number[];
}

export interface LearningEventLabels {
  nextAssetNeeded?: string;
  timeToNextAsset?: number;
  sessionContinuation?: boolean;
  skillImprovement?: number;
  satisfactionLevel?: number;
}

// Continue with remaining supporting types...
export interface PrefetchResourceLimits {
  maxBandwidth: number; // bytes/sec
  maxMemory: number; // bytes
  maxStorage: number; // bytes
  maxConcurrentDownloads: number;
  timeLimit: number; // ms
}

export interface PrefetchValidationRule {
  ruleId: string;
  condition: string;
  action: 'allow' | 'deny' | 'warn';
  priority: number;
}

export interface PrefetchRequestMetadata {
  requestedAt: number;
  requestSource:
    | 'user_action'
    | 'pattern_prediction'
    | 'scheduled'
    | 'fallback';
  urgency: 'immediate' | 'soon' | 'eventual' | 'background';
  context: Record<string, any>;
}

export interface PrefetchAssetResult {
  assetId: string;
  status: 'success' | 'failed' | 'partial' | 'skipped';
  downloadTime: number; // ms
  size: number; // bytes
  source: string;
  quality: number; // 0-1
  cacheLocation: string;
  error?: string;
}

export interface PrefetchResourceUsage {
  bandwidthUsed: number; // bytes
  memoryUsed: number; // bytes
  storageUsed: number; // bytes
  cpuTime: number; // ms
  powerConsumption: number; // estimated mWh
}

export interface PrefetchPerformance {
  hitRate: number; // 0-1, how many prefetched assets were actually used
  wasteRate: number; // 0-1, how many were prefetched but not used
  timeToFirstByte: number; // ms
  timeToFullDownload: number; // ms
  networkEfficiency: number; // 0-1
  userPerceptionScore: number; // 0-1
}

export interface ConfusionMatrix {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface TrainingHistoryEntry {
  epoch: number;
  loss: number;
  accuracy: number;
  valLoss: number;
  valAccuracy: number;
  timestamp: number;
  learningRate: number;
}

export interface AdaptationHistoryEntry {
  timestamp: number;
  adaptationType: 'gradual' | 'sudden' | 'correction';
  triggerEvent: string;
  performanceBefore: number;
  performanceAfter: number;
  adaptationSuccess: boolean;
  userFeedback?: number;
}

// ================================================================================
// Missing Interface Definitions (Referenced but not defined)
// ================================================================================

// Model Persistence Configuration
export interface ModelPersistenceConfig {
  enabled: boolean;
  storageLocation: 'local' | 'cloud' | 'distributed';
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
  versioning: boolean;
  backupStrategy: 'incremental' | 'full' | 'differential';
  retentionPolicy: ModelRetentionPolicy;
  syncInterval: number; // ms
}

// Prediction Thresholds
export interface PredictionThresholds {
  minimumConfidence: number; // 0-1
  optimalConfidence: number; // 0-1
  highConfidenceThreshold: number; // 0-1
  uncertaintyThreshold: number; // 0-1
  actionThresholds: ActionThreshold[];
  contextualThresholds: ContextualThreshold[];
}

// Cross Validation Configuration
export interface CrossValidationConfig {
  enabled: boolean;
  folds: number;
  stratified: boolean;
  timeSeriesSplit: boolean;
  validationStrategy: 'k_fold' | 'stratified_k_fold' | 'time_series' | 'custom';
  testSize: number; // 0-1
  randomState?: number;
  shuffle: boolean;
}

// Exercise Progression Model Configuration
export interface ExerciseProgressionModelConfig {
  enabled: boolean;
  modelType: 'sequence_prediction' | 'classification' | 'regression';
  features: ExerciseProgressionFeatures;
  predictionHorizon: number; // exercises to predict ahead
  difficultyModeling: boolean;
  skillTransferModeling: boolean;
  personalizedProgression: boolean;
}

// Asset Demand Model Configuration
export interface AssetDemandModelConfig {
  enabled: boolean;
  modelType:
    | 'time_series'
    | 'collaborative_filtering'
    | 'content_based'
    | 'hybrid';
  features: AssetDemandFeatures;
  temporalModeling: boolean;
  popularityModeling: boolean;
  contextualModeling: boolean;
  coldStartHandling: boolean;
}

// User Intent Model Configuration
export interface UserIntentModelConfig {
  enabled: boolean;
  modelType: 'classification' | 'clustering' | 'neural_network';
  features: UserIntentFeatures;
  intentCategories: IntentCategory[];
  realTimeInference: boolean;
  contextWindow: number; // ms
  uncertaintyHandling: boolean;
}

// Session Length Model Configuration
export interface SessionLengthModelConfig {
  enabled: boolean;
  modelType: 'regression' | 'survival_analysis' | 'time_series';
  features: SessionLengthFeatures;
  predictionInterval: number; // minutes
  dynamicUpdates: boolean;
  attentionModeling: boolean;
  fatigueModeling: boolean;
}

// Skill Development Model Configuration
export interface SkillDevelopmentModelConfig {
  enabled: boolean;
  modelType: 'bayesian' | 'neural_network' | 'knowledge_tracing';
  features: SkillDevelopmentFeatures;
  skillHierarchy: boolean;
  prerequisites: boolean;
  forgettingCurve: boolean;
  masteryThresholds: MasteryThreshold[];
}

// Adaptive Performance Thresholds
export interface AdaptivePerformanceThresholds {
  accuracyThresholds: PerformanceThreshold;
  latencyThresholds: PerformanceThreshold;
  resourceThresholds: ResourceThreshold;
  userSatisfactionThresholds: PerformanceThreshold;
  adaptationTriggers: AdaptationTrigger[];
  degradationThresholds: DegradationThreshold[];
}

// Accuracy Metrics Configuration
export interface AccuracyMetricsConfig {
  enabled: boolean;
  primaryMetrics: AccuracyMetric[];
  secondaryMetrics: AccuracyMetric[];
  realTimeTracking: boolean;
  historicalComparison: boolean;
  benchmarkComparison: boolean;
  reportingInterval: number; // ms
  alertThresholds: AccuracyAlertThreshold[];
}

// Additional Missing Supporting Types
export interface TimeOfDayPattern {
  preferredHours: number[]; // 0-23
  peakPerformanceHours: number[];
  consistencyScore: number; // 0-1
  flexibilityScore: number; // 0-1
}

export interface DurationPattern {
  averageDuration: number; // ms
  minimumDuration: number; // ms
  maximumDuration: number; // ms
  variabilityScore: number; // 0-1
  attentionDecay: number; // rate of attention decline
}

export interface IntensityPattern {
  averageIntensity: number; // 0-1
  peakIntensity: number; // 0-1
  intensityProgression: 'increasing' | 'decreasing' | 'stable' | 'variable';
  focusDistribution: number[]; // intensity over time
}

export interface AssetPreferencePattern {
  assetTypePreferences: Record<AssetType, number>; // 0-1
  complexityPreference: number; // 0-1
  noveltyPreference: number; // 0-1
  familiarityBalance: number; // 0-1
}

export interface ProgressionStylePattern {
  style: 'linear' | 'exponential' | 'plateau' | 'cyclical';
  pacePreference: 'slow' | 'moderate' | 'fast' | 'variable';
  challengeSeekingBehavior: number; // 0-1
  riskTolerance: number; // 0-1
}

export interface PlateauIndicator {
  skillArea: string;
  plateauStart: number; // timestamp
  plateauDuration: number; // ms
  confidenceLevel: number; // 0-1
  interventionSuggested: boolean;
}

export interface BreakPattern {
  frequency: number; // breaks per hour
  averageDuration: number; // ms
  timing: 'regular' | 'fatigue_based' | 'achievement_based';
  effectiveness: number; // 0-1
}

export interface IntensityProfile {
  warmupIntensity: number; // 0-1
  peakIntensity: number; // 0-1
  cooldownIntensity: number; // 0-1
  sustainedIntensity: number; // 0-1
  intensityVariability: number; // 0-1
}

export interface FocusPattern {
  attentionSpan: number; // minutes
  distractionSusceptibility: number; // 0-1
  deepFocusPeriods: number[]; // timestamps during session
  multitaskingTendency: number; // 0-1
}

export interface PredictionHistoryEntry {
  predictionId: string;
  timestamp: number;
  actualOutcome: boolean;
  confidence: number; // 0-1
  accuracy: number; // 0-1
  timeToActual: number; // ms
}

export interface PrioritizationWeights {
  confidenceWeight: number; // 0-1
  urgencyWeight: number; // 0-1
  sizeWeight: number; // 0-1
  popularityWeight: number; // 0-1
  userValueWeight: number; // 0-1
  resourceCostWeight: number; // 0-1
}

export interface ResourceAllocationStrategy {
  strategy: 'greedy' | 'weighted' | 'optimization' | 'adaptive';
  priorityBased: boolean;
  fairnessConstraints: boolean;
  dynamicAdjustment: boolean;
  resourceReservation: boolean;
}

export interface QuotaManagementConfig {
  enabled: boolean;
  bandwidthQuota: number; // bytes per time period
  storageQuota: number; // bytes
  requestQuota: number; // requests per time period
  quotaPeriod: number; // ms
  quotaExceededAction: 'throttle' | 'defer' | 'reject';
}

export interface ThrottlingConfig {
  enabled: boolean;
  maxRequestsPerSecond: number;
  maxConcurrentRequests: number;
  backoffStrategy: 'linear' | 'exponential' | 'adaptive';
  priorityBased: boolean;
  gracefulDegradation: boolean;
}

export interface NetworkQualityThresholds {
  excellent: NetworkQualityRange;
  good: NetworkQualityRange;
  fair: NetworkQualityRange;
  poor: NetworkQualityRange;
}

export interface NetworkQualityRange {
  minBandwidth: number; // bytes/sec
  maxLatency: number; // ms
  minReliability: number; // 0-1
  connectionTypes: string[];
}

export interface BackgroundLimits {
  maxBackgroundTasks: number;
  maxBackgroundBandwidth: number; // bytes/sec
  maxBackgroundMemory: number; // bytes
  maxBackgroundTime: number; // ms
  batteryThreshold: number; // 0-100
}

export interface ValidationRule {
  ruleId: string;
  ruleType: 'size' | 'format' | 'checksum' | 'expiration' | 'signature';
  parameters: Record<string, any>;
  severity: 'warning' | 'error' | 'critical';
  enabled: boolean;
}

export interface ExpirationHandlingStrategy {
  strategy: 'refresh' | 'remove' | 'mark_stale' | 'extend_ttl';
  gracePerioD: number; // ms
  backgroundRefresh: boolean;
  userNotification: boolean;
}

// Additional configurations to complete the missing types
export interface ModelRetentionPolicy {
  maxVersions: number;
  retentionPeriod: number; // ms
  autoCleanup: boolean;
  archiveOldVersions: boolean;
}

export interface ActionThreshold {
  action: string;
  threshold: number; // 0-1
  hysteresis: number; // 0-1 to prevent oscillation
}

export interface ContextualThreshold {
  context: string;
  thresholds: Record<string, number>;
  adaptiveAdjustment: boolean;
}

export interface ExerciseProgressionFeatures {
  currentSkillLevel: boolean;
  practiceHistory: boolean;
  difficultyHistory: boolean;
  errorPatterns: boolean;
  timeSpent: boolean;
  userPreferences: boolean;
}

export interface AssetDemandFeatures {
  historical: boolean;
  seasonal: boolean;
  contextual: boolean;
  collaborative: boolean;
  content: boolean;
  popularity: boolean;
}

export interface UserIntentFeatures {
  currentActivity: boolean;
  sessionContext: boolean;
  historicalBehavior: boolean;
  timePatterns: boolean;
  deviceContext: boolean;
  environmentalContext: boolean;
}

export interface IntentCategory {
  categoryId: string;
  name: string;
  description: string;
  features: string[];
  confidence: number; // 0-1
}

export interface SessionLengthFeatures {
  historical: boolean;
  timeOfDay: boolean;
  dayOfWeek: boolean;
  userState: boolean;
  sessionGoals: boolean;
  environmentalFactors: boolean;
}

export interface SkillDevelopmentFeatures {
  practiceTime: boolean;
  errorRates: boolean;
  progressionRate: boolean;
  retentionRate: boolean;
  transferEffects: boolean;
  motivationLevel: boolean;
}

export interface MasteryThreshold {
  skill: string;
  threshold: number; // 0-1
  consistency: number; // 0-1
  retention: number; // 0-1
}

export interface PerformanceThreshold {
  warning: number;
  critical: number;
  optimal: number;
  target: number;
}

export interface ResourceThreshold {
  memory: PerformanceThreshold;
  cpu: PerformanceThreshold;
  network: PerformanceThreshold;
  storage: PerformanceThreshold;
}

export interface AdaptationTrigger {
  triggerId: string;
  condition: string;
  threshold: number;
  enabled: boolean;
}

export interface DegradationThreshold {
  metric: string;
  threshold: number;
  timeWindow: number; // ms
  action: string;
}

export interface AccuracyMetric {
  metricId: string;
  name: string;
  description: string;
  weight: number; // 0-1
  target: number; // 0-1
}

export interface AccuracyAlertThreshold {
  metric: string;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}

// Additional missing types for comprehensive completeness
export interface BehaviorPatternIntegrationConfig {
  enabled: boolean;
  patternTypes: string[];
  syncInterval: number; // ms
  dataTransformation: boolean;
  realTimeSync: boolean;
}

export interface PracticeSessionIntegrationConfig {
  enabled: boolean;
  sessionTracking: boolean;
  metricsExtraction: boolean;
  contextualData: boolean;
  realTimeUpdates: boolean;
}

export interface ProgressAnalysisIntegrationConfig {
  enabled: boolean;
  skillTracking: boolean;
  achievementTracking: boolean;
  trendAnalysis: boolean;
  predictiveInsights: boolean;
}

export interface DataExchangeProtocolConfig {
  protocol: 'rest' | 'graphql' | 'grpc' | 'websocket';
  encryption: boolean;
  compression: boolean;
  batchSize: number;
  syncStrategy: 'push' | 'pull' | 'bidirectional';
}

export interface RetrainingTrigger {
  triggerId: string;
  condition: string;
  threshold: number;
  enabled: boolean;
}

export interface LatencyRequirementsConfig {
  maxPredictionLatency: number; // ms
  maxPrefetchLatency: number; // ms
  realTimeRequirements: boolean;
  latencyBudget: number; // ms
}

export interface ResourceLimitsConfig {
  maxMemoryUsage: number; // bytes
  maxCpuUsage: number; // percentage
  maxNetworkUsage: number; // bytes/sec
  maxStorageUsage: number; // bytes
}

export interface OptimizationTargetsConfig {
  primaryTarget:
    | 'accuracy'
    | 'latency'
    | 'resource_efficiency'
    | 'user_satisfaction';
  secondaryTargets: string[];
  tradeoffWeights: Record<string, number>;
  constraints: OptimizationConstraint[];
}

export interface OptimizationConstraint {
  constraintId: string;
  type: 'hard' | 'soft';
  condition: string;
  penalty: number;
}

export interface PredictiveMonitoringConfig {
  enabled: boolean;
  metricsCollection: boolean;
  performanceTracking: boolean;
  errorTracking: boolean;
  alerting: boolean;
  dashboards: boolean;
}

export interface FeedbackAggregationStrategy {
  strategy:
    | 'weighted_average'
    | 'majority_vote'
    | 'expert_consensus'
    | 'adaptive';
  weights: Record<FeedbackSource, number>;
  confidenceThreshold: number; // 0-1
  minimumSamples: number;
}

export interface FeedbackWeightingConfig {
  timeDecay: boolean;
  sourceReliability: boolean;
  contextualRelevance: boolean;
  userExpertise: boolean;
  feedbackFrequency: boolean;
}

export interface RewardSignalConfig {
  signals: RewardSignal[];
  weighting: Record<string, number>;
  normalization: boolean;
  temporalAggregation: boolean;
}

export interface RewardSignal {
  signalId: string;
  source: string;
  weight: number; // 0-1
  delay: number; // ms
}

export interface PenaltySignalConfig {
  signals: PenaltySignal[];
  weighting: Record<string, number>;
  threshold: number;
  gracePeriod: number; // ms
}

export interface PenaltySignal {
  signalId: string;
  source: string;
  weight: number; // 0-1
  severity: 'low' | 'medium' | 'high';
}

export interface FeedbackValidationConfig {
  enabled: boolean;
  outlierDetection: boolean;
  consistencyChecks: boolean;
  sourceVerification: boolean;
  fraudDetection: boolean;
}

export interface UpdateFrequency {
  interval: number; // ms
  condition: 'time_based' | 'event_based' | 'performance_based' | 'hybrid';
  minInterval: number; // ms
  maxInterval: number; // ms
}

export interface RollbackStrategy {
  enabled: boolean;
  criteria: RollbackCriteria[];
  automaticRollback: boolean;
  rollbackDelay: number; // ms
  maxRollbacks: number;
}

export interface RollbackCriteria {
  criteriaId: string;
  condition: string;
  threshold: number;
  timeWindow: number; // ms
}

export interface ModelVersionControl {
  enabled: boolean;
  versioningStrategy: 'semantic' | 'timestamp' | 'hash' | 'sequential';
  maxVersions: number;
  branchingSupport: boolean;
  mergingSupport: boolean;
}

export interface SourceModelConfig {
  modelId: string;
  domain: string;
  similarity: number; // 0-1
  transferLayers: string[];
  freezeLayers: string[];
}

export interface ImprovementMetric {
  metricId: string;
  name: string;
  target: number;
  weight: number; // 0-1
  timeframe: number; // ms
}

export interface ExperimentationConfig {
  enabled: boolean;
  experimentTypes: ExperimentType[];
  statisticalSignificance: number; // 0-1
  minimumSampleSize: number;
  maxExperimentDuration: number; // ms
}

export interface ExperimentType {
  typeId: string;
  name: string;
  description: string;
  parameters: string[];
  metrics: string[];
}

export interface ABTestingConfig {
  enabled: boolean;
  trafficSplit: Record<string, number>; // variant -> percentage
  minimumSampleSize: number;
  confidenceLevel: number; // 0-1
  maxTestDuration: number; // ms
}

export interface PerformanceBaselineConfig {
  enabled: boolean;
  baselineMetrics: string[];
  updateFrequency: number; // ms
  historicalWindow: number; // ms
  alertOnRegression: boolean;
}

// User Segmentation
export interface UserSegment {
  segmentId: string;
  name: string;
  description: string;
  criteria: SegmentCriteria[];
  userIds: string[];
  characteristics: SegmentCharacteristics;
  createdAt: number;
  updatedAt: number;
}

export interface SegmentCriteria {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
  weight: number; // 0-1
}

export interface SegmentCharacteristics {
  averageSessionLength: number;
  preferredAssetTypes: AssetType[];
  skillLevel: number; // 0-100
  engagementLevel: number; // 0-1
  retentionRate: number; // 0-1
}

// Correlation Analysis
export interface CorrelationMatrix {
  matrixId: string;
  assets: string[];
  correlations: number[][]; // correlation coefficients matrix
  confidence: number; // 0-1
  sampleSize: number;
  lastUpdated: number;
  significanceLevel: number; // 0-1
}

// Prefetch Strategy Configuration
export interface PrefetchStrategy {
  strategyId: string;
  name: string;
  type: 'aggressive' | 'conservative' | 'adaptive' | 'user_driven';
  parameters: PrefetchStrategyParameters;
  conditions: PrefetchCondition[];
  enabled: boolean;
}

export interface PrefetchStrategyParameters {
  lookaheadTime: number; // ms
  maxPrefetchSize: number; // bytes
  minConfidence: number; // 0-1
  networkThreshold: number; // minimum bandwidth for prefetching
  batteryThreshold: number; // 0-100, minimum battery level
}

export interface PrefetchCondition {
  conditionId: string;
  type: 'time_based' | 'usage_based' | 'context_based' | 'performance_based';
  parameters: Record<string, any>;
  enabled: boolean;
}

// Rename for consistency - this should be used instead of PredictiveModelsConfig
export type PredictiveModelsConfig = PredictiveModelConfig;

// Performance optimization for predictive engine
export type PerformanceOptimizationConfig = PredictivePerformanceConfig;

// Model performance metrics for predictive engine
export interface ModelPerformanceMetrics {
  accuracy: number; // 0-1
  precision: number; // 0-1
  recall: number; // 0-1
  f1Score: number; // 0-1
  auc: number; // 0-1, Area Under Curve
  confusionMatrix: ConfusionMatrix;
  trainingTime: number; // ms
  inferenceTime: number; // ms
  memoryUsage: number; // bytes
  modelSize: number; // bytes
  lastEvaluated: number;
  crossValidationScore: number; // 0-1
}

// ============================================================================
// TASK 4: PROFESSIONAL AUDIO SAMPLE MANAGEMENT CONTRACTS
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
  customProperties: Record<string, any>;
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
 * Audio sample library information
 */
export interface AudioSampleLibrary {
  config: AudioSampleLibraryConfig;
  samples: AudioSampleMetadata[];
  statistics: AudioSampleLibraryStatistics;
  lastUpdated: number;
  syncStatus: 'synced' | 'syncing' | 'error' | 'outdated';
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

/**
 * Cache layer type
 */
export type CacheLayer = 'memory' | 'indexeddb' | 'serviceworker';

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

/**
 * Cache optimization categories
 */
export type CacheOptimizationCategory =
  | 'routing_optimization'
  | 'compression_tuning'
  | 'eviction_strategy'
  | 'layer_balancing'
  | 'sync_optimization'
  | 'ml_model_tuning';

// ===============================
// Advanced Cache Entry Interfaces
// ===============================

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
  data?: any;
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
  context?: Record<string, any>;
}

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

/**
 * Audio sample manager configuration
 */
export interface AudioSampleManagerConfig {
  // Core configuration
  enabled: boolean;
  maxConcurrentOperations: number;
  operationTimeout: number; // Operation timeout in ms

  // Library management
  libraryConfig: AudioSampleLibraryConfig;
  enableMultipleLibraries: boolean;
  maxLibraries: number;

  // Streaming configuration
  streamingConfig: AdaptiveAudioStreamingConfig;

  // Caching configuration
  cacheConfig: IntelligentSampleCacheConfig;

  // Advanced multi-level caching (Task 6)
  advancedCacheConfig?: AdvancedCacheManagerConfig;

  // Analytics configuration
  analyticsConfig: SampleAnalyticsConfig;

  // Integration settings
  storageClientConfig: SupabaseAssetClientConfig;
  cdnOptimizationEnabled: boolean;
  predictiveLoadingEnabled: boolean;

  // Quality management
  defaultQualityProfile: AudioSampleQualityProfile;
  enableQualityAdaptation: boolean;
  qualityAdaptationStrategy:
    | 'automatic'
    | 'user_preference'
    | 'performance_based';

  // Format management
  supportedFormats: AudioSampleFormat[];
  preferredFormat: AudioSampleFormat;
  enableFormatConversion: boolean;

  // Performance optimization
  enableBackgroundProcessing: boolean;
  backgroundProcessingPriority: 'low' | 'medium' | 'high';
  enableBatchOperations: boolean;
  batchSize: number;

  // Error handling
  enableErrorRecovery: boolean;
  maxRetryAttempts: number;
  retryBackoffMs: number;

  // Security
  enableContentValidation: boolean;
  enableVirusScanning: boolean;
  enableCopyrightCheck: boolean;
}

/**
 * Audio sample operation result
 */
export interface AudioSampleOperationResult {
  success: boolean;
  sampleId: string;
  operation: 'load' | 'save' | 'delete' | 'convert' | 'analyze';

  // Result data
  data?: ArrayBuffer | AudioSampleMetadata | SampleAnalyticsData;
  metadata?: AudioSampleMetadata;

  // Performance information
  duration: number; // Operation duration in ms
  size?: number; // Data size in bytes
  source: 'cache' | 'storage' | 'cdn' | 'conversion';

  // Quality information
  qualityProfile?: AudioSampleQualityProfile;
  qualityScore?: number; // Quality score (0-1)

  // Error information
  error?: Error;
  errorCode?: string;
  errorMessage?: string;

  // Additional metadata
  timestamp: number;
  userId?: string;
  sessionId?: string;
  context?: Record<string, any>;
}

/**
 * Audio metadata for comprehensive audio analysis
 */
export interface AudioMetadata {
  filename: string;
  duration: number;
  sampleRate: number;
  channels: number;
  size: number;
  format: AudioSampleFormat;
  bitDepth?: number;
  bitRate?: number;
  createdAt: number;
  modifiedAt: number;
  checksum?: string;
}

/**
 * Configuration for audio analysis operations
 */
export interface AnalysisConfig {
  enableTempoDetection: boolean;
  enableKeyDetection: boolean;
  enableSpectralAnalysis: boolean;
  enableQualityAssessment: boolean;
  enableMusicalFeatures: boolean;
  highPrecision: boolean;
  maxAnalysisDuration: number;
  customParameters?: Record<string, any>;
}

/**
 * Tempo detection result
 */
export interface TempoDetectionResult {
  bpm: number;
  confidence: number;
  candidates: Array<{ bpm: number; confidence: number }>;
  method: 'autocorrelation' | 'beat_tracking' | 'onset_detection';
}

/**
 * Key detection result
 */
export interface KeyDetectionResult {
  key: string;
  mode: 'major' | 'minor';
  confidence: number;
  alternatives: Array<{ key: string; mode: string; confidence: number }>;
}

/**
 * Frequency bin data for spectral analysis
 */
export interface FrequencyBinData {
  subBass: number; // 0-60 Hz
  bass: number; // 60-250 Hz
  lowMids: number; // 250-500 Hz
  mids: number; // 500-2000 Hz
  highMids: number; // 2000-4000 Hz
  highs: number; // 4000-8000 Hz
  airFreqs: number; // 8000+ Hz
}

/**
 * Harmonic content analysis
 */
export interface HarmonicContent {
  harmonicRatio: number;
  fundamentalStrength: number;
  harmonicDistribution: number[];
}

/**
 * Spectral analysis result
 */
export interface SpectralAnalysisResult {
  spectralCentroid: number;
  spectralRolloff: number;
  spectralFlux: number;
  zeroCrossingRate: number;
  frequencyBins: FrequencyBinData;
  dynamicRange: number;
  harmonicContent: HarmonicContent;
}

/**
 * Quality assessment result
 */
export interface QualityAssessmentResult {
  snr: number; // Signal-to-noise ratio in dB
  thd: number; // Total harmonic distortion
  peakLevel: number; // Peak level in dB
  rmsLevel: number; // RMS level in dB
  crestFactor: number; // Crest factor in dB
  clipping: {
    detected: boolean;
    percentage: number;
    samples: number[];
  };
  qualityScore: number; // Overall quality score (0-100)
  recommendations: string[];
}

/**
 * Musical features extraction result
 */
export interface MusicalFeatures {
  onsetDensity: number;
  rhythmComplexity: number;
  harmonicRatio: number;
  energyDistribution: {
    attack: number;
    sustain: number;
    decay: number;
    overall: 'percussive' | 'sustained' | 'mixed';
  };
  musicalGenre: string;
  instrumentClassification: string;
}

/**
 * Onset detection result
 */
export interface OnsetDetectionResult {
  onsets: number[]; // Onset times in seconds
  onsetDensity: number; // Onsets per second
  confidence: number[];
  method: 'spectral_flux' | 'complex_domain' | 'high_frequency_content';
}

/**
 * Comprehensive audio analysis result
 */
export interface AnalysisResult {
  filename: string;
  duration: number;
  sampleRate: number;
  channels: number;
  tempo: TempoDetectionResult;
  key: KeyDetectionResult;
  spectral: SpectralAnalysisResult;
  quality: QualityAssessmentResult;
  musical: MusicalFeatures;
  analyzedAt: string;
  version: string;
}

/**
 * Story 2.4 Task 5: Intelligent MIDI Orchestration System
 * Enterprise-grade MIDI asset management with version control, collaborative features, and real-time synchronization
 */

// Core MIDI orchestration configuration
export interface MIDIAssetOrchestratorConfig {
  enabled: boolean;

  // Version control settings
  versioningConfig: MIDIVersionControlConfig;

  // Collaborative editing configuration
  collaborativeConfig: MIDICollaborativeConfig;

  // Real-time synchronization
  realTimeSyncConfig: MIDIRealTimeSyncConfig;

  // Metadata processing
  metadataProcessingConfig: MIDIMetadataProcessingConfig;

  // Analytics configuration
  analyticsConfig: MIDIAnalyticsConfig;

  // Integration settings
  storageClientConfig: SupabaseAssetClientConfig;
  cdnOptimizationEnabled: boolean;
  predictiveLoadingEnabled: boolean;

  // Performance settings
  maxConcurrentOperations: number;
  operationTimeout: number; // ms
  enableBackgroundProcessing: boolean;

  // Error handling
  enableErrorRecovery: boolean;
  maxRetryAttempts: number;
  retryBackoffMs: number;
}

// MIDI file formats and types
export type MIDIFormat = 'mid' | 'midi' | 'smf' | 'rmi' | 'kar';

export type MIDIType =
  | 'type_0' // Single track
  | 'type_1' // Multi-track synchronous
  | 'type_2'; // Multi-track asynchronous

export type MIDITrackType =
  | 'bass'
  | 'drums'
  | 'harmony'
  | 'melody'
  | 'percussion'
  | 'vocals'
  | 'effects'
  | 'control'
  | 'meta'
  | 'tempo'
  | 'time_signature'
  | 'key_signature';

// Enhanced MIDI metadata extending existing ExtractedMetadata
export interface MIDIMetadata extends AssetMetadata {
  // Basic MIDI properties
  format: MIDIFormat;
  type: MIDIType;
  ticksPerQuarter: number;

  // Musical information
  trackCount: number;
  instrumentCount: number;
  tempo: number; // BPM
  tempoChanges: MIDITempoChange[];
  timeSignature: string;
  timeSignatureChanges: MIDITimeSignatureChange[];
  keySignature: string;
  keySignatureChanges: MIDIKeySignatureChange[];

  // Track information
  tracks: MIDITrackInfo[];
  channels: MIDIChannelInfo[];

  // Timing and duration
  duration: number; // seconds
  totalTicks: number;

  // Musical analysis
  musicalComplexity: MIDIComplexityAnalysis;
  harmonicAnalysis: MIDIHarmonicAnalysis;
  rhythmicAnalysis: MIDIRhythmicAnalysis;

  // Technical properties
  fileSize: number;
  checksum: string;
  encoding?: string;

  // Usage and analytics
  playCount: number;
  lastPlayed?: number;
  averageRating?: number;
  popularityScore: number;

  // Collaborative metadata
  collaborators: MIDICollaborator[];
  lastModified: number;
  lastModifiedBy: string;

  // Version information
  version: string;
  versionHistory: MIDIVersionInfo[];

  // Custom metadata
  customProperties: Record<string, any>;
}

// MIDI track information
export interface MIDITrackInfo {
  trackId: string;
  trackNumber: number;
  name: string;
  type: MIDITrackType;
  channel: number;
  instrument: MIDIInstrument;

  // Musical properties
  noteCount: number;
  noteRange: MIDINoteRange;
  velocity: MIDIVelocityInfo;

  // Timing information
  startTime: number; // ticks
  endTime: number; // ticks
  duration: number; // ticks

  // Events
  eventCount: number;
  eventTypes: string[];

  // Analysis
  complexity: number; // 0-1
  density: number; // notes per beat

  // Status
  isActive: boolean;
  isMuted: boolean;
  volume: number; // 0-127

  // Collaborative properties
  lockedBy?: string;
  lastEditedBy: string;
  lastEditedAt: number;
}

// MIDI channel information
export interface MIDIChannelInfo {
  channel: number;
  instrument: MIDIInstrument;
  volume: number; // 0-127
  pan: number; // 0-127
  bankSelect: number;
  programChange: number;

  // Effects
  reverb: number; // 0-127
  chorus: number; // 0-127
  pitchBend: number; // -8192 to 8191

  // Status
  isActive: boolean;
  isMuted: boolean;

  // Associated tracks
  trackIds: string[];
}

// MIDI instrument information
export interface MIDIInstrument {
  programNumber: number; // 0-127
  bankNumber: number; // 0-16383
  name: string;
  category: MIDIInstrumentCategory;
  family: string;

  // Properties
  isPercussion: boolean;
  isDrumKit: boolean;

  // Technical info
  polyphony: number;
  channels: number[];
}

export type MIDIInstrumentCategory =
  | 'piano'
  | 'chromatic_percussion'
  | 'organ'
  | 'guitar'
  | 'bass'
  | 'strings'
  | 'ensemble'
  | 'brass'
  | 'reed'
  | 'pipe'
  | 'synth_lead'
  | 'synth_pad'
  | 'synth_effects'
  | 'ethnic'
  | 'percussive'
  | 'sound_effects';

// Musical analysis structures
export interface MIDIComplexityAnalysis {
  overallComplexity: number; // 0-1
  harmonicComplexity: number; // 0-1
  rhythmicComplexity: number; // 0-1
  melodicComplexity: number; // 0-1

  // Factors contributing to complexity
  factors: MIDIComplexityFactor[];

  // Difficulty rating
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';

  // Technical requirements
  technicalRequirements: string[];
}

export interface MIDIComplexityFactor {
  factor: string;
  weight: number; // 0-1
  value: number; // 0-1
  description: string;
}

export interface MIDIHarmonicAnalysis {
  keyChanges: number;
  chordProgression: MIDIChord[];
  modalityShifts: number;
  chromaticism: number; // 0-1
  dissonanceLevel: number; // 0-1

  // Harmonic rhythm
  harmonicRhythm: number; // chord changes per measure

  // Tonal analysis
  tonalCenter: string;
  modulations: MIDIModulation[];

  // Chord statistics
  uniqueChords: number;
  chordDensity: number; // chords per beat
}

export interface MIDIChord {
  startTime: number; // ticks
  duration: number; // ticks
  root: string;
  quality: string; // major, minor, diminished, etc.
  inversion: number;
  notes: number[]; // MIDI note numbers
  voicing: string;
}

export interface MIDIModulation {
  startTime: number; // ticks
  fromKey: string;
  toKey: string;
  type: 'direct' | 'pivot' | 'common_tone' | 'chromatic';
  strength: number; // 0-1
}

export interface MIDIRhythmicAnalysis {
  timeSignatureChanges: number;
  tempoChanges: number;
  tempoStability: number; // 0-1

  // Rhythmic patterns
  patterns: MIDIRhythmicPattern[];
  syncopation: number; // 0-1
  complexity: number; // 0-1

  // Beat analysis
  strongBeats: number[];
  weakBeats: number[];
  offBeats: number[];

  // Groove characteristics
  groove: MIDIGroove;
}

export interface MIDIRhythmicPattern {
  pattern: number[]; // beat positions
  frequency: number; // occurrences
  strength: number; // 0-1
  description: string;
}

export interface MIDIGroove {
  swing: number; // 0-1
  shuffle: number; // 0-1
  straightness: number; // 0-1
  tightness: number; // 0-1
  humanization: number; // 0-1
}

// Timing structures
export interface MIDINoteRange {
  lowest: number; // MIDI note number
  highest: number; // MIDI note number
  range: number; // semitones
  mostCommon: number; // MIDI note number
}

export interface MIDIVelocityInfo {
  min: number; // 0-127
  max: number; // 0-127
  average: number; // 0-127
  variance: number;
  dynamics: 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff';
}

export interface MIDITempoChange {
  time: number; // ticks
  tempo: number; // BPM
  microsecondsPerQuarter: number;
}

export interface MIDITimeSignatureChange {
  time: number; // ticks
  numerator: number;
  denominator: number;
  clocksPerClick: number;
  notesPerQuarter: number;
}

export interface MIDIKeySignatureChange {
  time: number; // ticks
  key: string;
  sharpsFlats: number; // -7 to 7
  major: boolean;
}

// Version control configuration and structures
export interface MIDIVersionControlConfig {
  enabled: boolean;
  maxVersionsPerFile: number;
  versionRetentionDays: number;
  automaticVersioning: boolean;

  // Diff and merge settings
  enableDiffTracking: boolean;
  diffAlgorithm: 'binary' | 'musical' | 'track_based' | 'event_based';

  // Branching and merging
  enableBranching: boolean;
  mergeStrategy: 'automatic' | 'manual' | 'intelligent';
  conflictResolution: MIDIConflictResolutionStrategy;

  // Rollback settings
  enableRollback: boolean;
  rollbackGracePeriod: number; // ms

  // Backup and archival
  enableBackup: boolean;
  backupStrategy: 'incremental' | 'full' | 'differential';
}

export type MIDIConflictResolutionStrategy =
  | 'latest_wins'
  | 'manual_merge'
  | 'track_priority'
  | 'user_preference'
  | 'intelligent_merge';

export interface MIDIVersionInfo {
  versionId: string;
  versionNumber: string;
  parentVersionId?: string;
  branchName?: string;

  // Metadata
  createdAt: number;
  createdBy: string;
  commitMessage: string;
  tags: string[];

  // Changes
  changes: MIDIVersionChange[];
  diffSummary: MIDIVersionDiff;

  // File properties
  size: number;
  checksum: string;

  // Status
  isActive: boolean;
  isSnapshot: boolean;
  isMerged: boolean;
}

export interface MIDIVersionChange {
  changeId: string;
  type:
    | 'track_added'
    | 'track_removed'
    | 'track_modified'
    | 'event_added'
    | 'event_removed'
    | 'event_modified'
    | 'metadata_changed';
  trackId?: string;
  eventId?: string;

  // Change details
  oldValue?: any;
  newValue?: any;
  description: string;
  impact: 'minor' | 'major' | 'breaking';

  // Musical impact
  musicalImpact: MIDIMusicalImpact;

  // Timestamp
  timestamp: number;
  author: string;
}

export interface MIDIMusicalImpact {
  affects: string[]; // tracks, harmony, rhythm, etc.
  severity: 'cosmetic' | 'minor' | 'significant' | 'major';
  category: 'performance' | 'arrangement' | 'composition' | 'technical';
  description: string;
}

export interface MIDIVersionDiff {
  fromVersion: string;
  toVersion: string;
  diffType: 'track_based' | 'event_based' | 'musical';

  // Statistics
  tracksAdded: number;
  tracksRemoved: number;
  tracksModified: number;
  eventsAdded: number;
  eventsRemoved: number;
  eventsModified: number;

  // Musical changes
  tempoChanges: number;
  keyChanges: number;
  instrumentChanges: number;

  // Similarity metrics
  similarity: number; // 0-1
  musicalSimilarity: number; // 0-1
  structuralSimilarity: number; // 0-1

  // Generation metadata
  generatedAt: number;
  algorithm: string;
  processingTime: number; // ms
}

// Collaborative editing configuration
export interface MIDICollaborativeConfig {
  enabled: boolean;
  maxCollaborators: number;

  // Real-time features
  enableRealTimeEditing: boolean;
  enablePresenceIndicators: boolean;
  enableCursorSharing: boolean;

  // Locking and conflict prevention
  enableTrackLocking: boolean;
  lockTimeout: number; // ms
  enableConflictPrevention: boolean;

  // Change tracking
  enableChangeTracking: boolean;
  changeTrackingInterval: number; // ms

  // Permissions
  enablePermissions: boolean;
  permissionLevels: MIDIPermissionLevel[];

  // Communication
  enableChat: boolean;
  enableComments: boolean;
  enableAnnotations: boolean;

  // Synchronization
  syncInterval: number; // ms
  conflictDetectionEnabled: boolean;
  autoSaveInterval: number; // ms
}

export type MIDIPermissionLevel =
  | 'read'
  | 'comment'
  | 'edit_tracks'
  | 'edit_metadata'
  | 'manage_versions'
  | 'admin';

export interface MIDICollaborator {
  userId: string;
  username: string;
  displayName: string;

  // Permissions
  permissions: MIDIPermissionLevel[];
  canEdit: boolean;
  canComment: boolean;
  canManageVersions: boolean;

  // Status
  isOnline: boolean;
  isActive: boolean;
  lastActivity: number;
  currentTrack?: string;

  // Contribution tracking
  contributions: MIDIContribution[];
  totalEdits: number;
  joinedAt: number;

  // Preferences
  preferences: MIDICollaboratorPreferences;
}

export interface MIDIContribution {
  contributionId: string;
  type: 'edit' | 'comment' | 'version' | 'review';
  trackId?: string;
  timestamp: number;
  description: string;
  impact: 'minor' | 'major';
}

export interface MIDICollaboratorPreferences {
  notificationsEnabled: boolean;
  showPresenceIndicators: boolean;
  autoSave: boolean;
  preferredView: 'track' | 'piano_roll' | 'score';
  colorScheme: string;
}

// Real-time synchronization configuration
export interface MIDIRealTimeSyncConfig {
  enabled: boolean;

  // Connection settings
  connectionType: 'websocket' | 'webrtc' | 'polling';
  reconnectEnabled: boolean;
  reconnectInterval: number; // ms
  maxReconnectAttempts: number;

  // Synchronization strategy
  syncStrategy:
    | 'operational_transform'
    | 'conflict_free_replicated_data_type'
    | 'event_sourcing';

  // Performance settings
  batchUpdates: boolean;
  batchInterval: number; // ms
  maxBatchSize: number;

  // Conflict resolution
  enableConflictResolution: boolean;
  conflictResolutionTimeout: number; // ms

  // Change detection
  changeDetectionInterval: number; // ms
  enableChangeOptimization: boolean;

  // State management
  enableStateSnapshots: boolean;
  snapshotInterval: number; // ms
  maxStateHistory: number;
}

// Real-time synchronization structures
export interface MIDIRealtimeUpdate {
  updateId: string;
  type: MIDIUpdateType;

  // Source information
  userId: string;
  trackId?: string;
  timestamp: number;

  // Update data
  operation: MIDIOperation;
  data: any;

  // Synchronization metadata
  sequenceNumber: number;
  dependencies: string[];

  // Conflict resolution
  priority: number;
  conflictStrategy?: MIDIConflictResolutionStrategy;
}

export type MIDIUpdateType =
  | 'track_update'
  | 'event_update'
  | 'metadata_update'
  | 'cursor_update'
  | 'presence_update'
  | 'lock_update'
  | 'comment_update';

export interface MIDIOperation {
  operationType: 'insert' | 'delete' | 'update' | 'move';
  target: string; // track, event, etc.
  position?: number;
  length?: number;
  content?: any;
  attributes?: Record<string, any>;
}

// MIDI metadata processing configuration
export interface MIDIMetadataProcessingConfig {
  enabled: boolean;

  // Analysis settings
  enableMusicalAnalysis: boolean;
  enableComplexityAnalysis: boolean;
  enableHarmonicAnalysis: boolean;
  enableRhythmicAnalysis: boolean;

  // Auto-categorization
  enableAutoCategorization: boolean;
  categorizationModel: 'rule_based' | 'ml_based' | 'hybrid';

  // Tagging
  enableAutoTagging: boolean;
  taggingStrategies: MIDITaggingStrategy[];

  // Validation
  enableValidation: boolean;
  validationRules: MIDIValidationRule[];

  // Enrichment
  enableEnrichment: boolean;
  enrichmentSources: string[];

  // Performance
  processingTimeout: number; // ms
  enableBackgroundProcessing: boolean;
  batchProcessing: boolean;
  batchSize: number;
}

export type MIDITaggingStrategy =
  | 'instrument_based'
  | 'genre_based'
  | 'complexity_based'
  | 'key_based'
  | 'tempo_based'
  | 'duration_based'
  | 'structure_based';

export interface MIDIValidationRule {
  ruleId: string;
  name: string;
  description: string;

  // Rule definition
  category: 'format' | 'musical' | 'technical' | 'metadata';
  severity: 'error' | 'warning' | 'info';

  // Validation logic
  condition: string;
  validator: (midi: MIDIMetadata) => MIDIValidationResult;

  // Configuration
  enabled: boolean;
  autoFix: boolean;
  priority: number;
}

export interface MIDIValidationResult {
  passed: boolean;
  messages: MIDIValidationMessage[];
  autoFixApplied: boolean;
  suggestions: string[];
}

export interface MIDIValidationMessage {
  level: 'error' | 'warning' | 'info';
  message: string;
  location?: string; // track, measure, etc.
  code?: string;
}

// MIDI analytics configuration
export interface MIDIAnalyticsConfig {
  enabled: boolean;

  // Data collection
  trackUsage: boolean;
  trackCollaboration: boolean;
  trackPerformance: boolean;
  trackComplexity: boolean;

  // Complexity analysis
  enableComplexityAnalysis: boolean;
  complexityMetrics: MIDIComplexityMetric[];

  // Usage analytics
  enableUsageAnalytics: boolean;
  usageTrackingInterval: number; // ms

  // Performance monitoring
  enablePerformanceMonitoring: boolean;
  performanceThresholds: MIDIPerformanceThresholds;

  // Optimization recommendations
  enableOptimizationSuggestions: boolean;
  suggestionCategories: MIDIOptimizationCategory[];

  // Reporting
  enableReporting: boolean;
  reportingInterval: number; // ms
  reportRetentionPeriod: number; // ms

  // Alerts
  enableAlerts: boolean;
  alertThresholds: MIDIAlertThresholds;
}

export type MIDIComplexityMetric =
  | 'harmonic_complexity'
  | 'rhythmic_complexity'
  | 'melodic_complexity'
  | 'polyphonic_complexity'
  | 'temporal_complexity'
  | 'structural_complexity';

export type MIDIOptimizationCategory =
  | 'performance'
  | 'file_size'
  | 'compatibility'
  | 'musical_quality'
  | 'accessibility'
  | 'collaboration';

export interface MIDIPerformanceThresholds {
  maxLoadTime: number; // ms
  maxProcessingTime: number; // ms
  maxMemoryUsage: number; // bytes
  maxFileSize: number; // bytes

  // Musical thresholds
  maxComplexity: number; // 0-1
  maxTracks: number;
  maxEvents: number;
  maxDuration: number; // seconds
}

export interface MIDIAlertThresholds {
  complexityThreshold: number; // 0-1
  performanceDegradation: number; // 0-1
  errorRateIncrease: number; // 0-1
  collaborationConflicts: number; // conflicts per hour
  unusualUsagePatterns: number; // 0-1
}

// MIDI analytics data structures
export interface MIDIAnalyticsData {
  midiId: string;
  timestamp: number;

  // Usage metrics
  usageMetrics: MIDIUsageMetrics;

  // Complexity metrics
  complexityMetrics: MIDIComplexityMetrics;

  // Performance metrics
  performanceMetrics: MIDIPerformanceMetrics;

  // Collaboration metrics
  collaborationMetrics: MIDICollaborationMetrics;

  // Quality metrics
  qualityMetrics: MIDIQualityMetrics;
}

export interface MIDIUsageMetrics {
  totalPlays: number;
  totalDuration: number; // total playback time in seconds
  averagePlayDuration: number;
  completionRate: number; // 0-1
  skipRate: number; // 0-1
  repeatRate: number; // 0-1

  // User engagement
  uniqueUsers: number;
  sessionsWithMIDI: number;
  averageSessionDuration: number;

  // Popularity
  popularityScore: number; // 0-1
  popularityRank: number;
  trendingScore: number; // 0-1

  // Temporal patterns
  peakUsageTime: number; // hour of day
  usageFrequency: number; // plays per day
  seasonalVariation: number; // 0-1
}

export interface MIDIComplexityMetrics {
  overallComplexity: number; // 0-1
  harmonicComplexity: number; // 0-1
  rhythmicComplexity: number; // 0-1
  melodicComplexity: number; // 0-1
  polyphonicComplexity: number; // 0-1
  temporalComplexity: number; // 0-1
  structuralComplexity: number; // 0-1

  // Computed metrics
  complexityTrend: 'increasing' | 'stable' | 'decreasing';
  complexityDistribution: number[]; // per track
  complexityFactors: MIDIComplexityFactor[];

  // Comparisons
  relativeComplexity: number; // compared to similar files
  complexityPercentile: number; // 0-100
  difficultyRating: string;
}

export interface MIDIPerformanceMetrics {
  loadTime: number; // ms
  processingTime: number; // ms
  renderTime: number; // ms
  memoryUsage: number; // bytes

  // File metrics
  fileSize: number; // bytes
  compressionRatio: number;
  optimizationLevel: number; // 0-1

  // Playback metrics
  audioLatency: number; // ms
  midiLatency: number; // ms
  bufferUnderruns: number;
  dropouts: number;

  // Efficiency metrics
  cpuUsage: number; // 0-1
  gpuUsage: number; // 0-1
  networkUsage: number; // bytes/sec
  storageIops: number;

  // Error metrics
  errorRate: number; // 0-1
  warningCount: number;
  successRate: number; // 0-1
}

export interface MIDICollaborationMetrics {
  totalCollaborators: number;
  activeCollaborators: number;
  totalEdits: number;
  conflictCount: number;
  conflictResolutionTime: number; // average ms

  // Collaboration patterns
  editDistribution: Record<string, number>; // user -> edit count
  collaborationEfficiency: number; // 0-1
  communicationVolume: number;

  // Version control metrics
  totalVersions: number;
  branchCount: number;
  mergeCount: number;
  rollbackCount: number;

  // Real-time metrics
  simultaneousEditors: number;
  averageResponseTime: number; // ms
  syncSuccessRate: number; // 0-1

  // Quality metrics
  codeReviewCoverage: number; // 0-1
  approvalRate: number; // 0-1
  collaboratorSatisfaction: number; // 0-1
}

export interface MIDIQualityMetrics {
  musicalQuality: number; // 0-1
  technicalQuality: number; // 0-1
  structuralQuality: number; // 0-1

  // Validation results
  validationScore: number; // 0-1
  errorCount: number;
  warningCount: number;
  ruleCompliance: number; // 0-1

  // Musical coherence
  harmonicCoherence: number; // 0-1
  rhythmicCoherence: number; // 0-1
  melodicCoherence: number; // 0-1
  structuralCoherence: number; // 0-1

  // User feedback
  userRating: number; // 0-5
  ratingCount: number;
  feedbackScore: number; // 0-1

  // Automated assessment
  aiQualityScore: number; // 0-1
  professionalScore: number; // 0-1
  educationalValue: number; // 0-1
}

// MIDI orchestrator operation results
export interface MIDIOperationResult {
  success: boolean;
  midiId: string;
  operation:
    | 'load'
    | 'save'
    | 'delete'
    | 'analyze'
    | 'version'
    | 'merge'
    | 'sync';

  // Result data
  data?: MIDIMetadata | MIDIAnalyticsData | MIDIVersionInfo;
  metadata?: MIDIMetadata;

  // Performance information
  duration: number; // ms
  size?: number; // bytes
  source: 'cache' | 'storage' | 'cdn' | 'collaboration';

  // Quality information
  qualityScore?: number; // 0-1
  validationResults?: MIDIValidationResult[];

  // Collaboration information
  collaborators?: string[];
  conflicts?: MIDIConflictInfo[];

  // Error information
  error?: Error;
  errorCode?: string;
  errorMessage?: string;
  warnings?: string[];

  // Additional metadata
  timestamp: number;
  userId?: string;
  sessionId?: string;
  context?: Record<string, any>;
}

export interface MIDIConflictInfo {
  conflictId: string;
  type: 'track' | 'event' | 'metadata' | 'version';
  trackId?: string;
  eventId?: string;

  // Conflict details
  conflictingUsers: string[];
  conflictData: any;
  resolution?: 'automatic' | 'manual' | 'pending';

  // Timing
  detectedAt: number;
  resolvedAt?: number;

  // Impact
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;

  // Resolution
  resolutionStrategy?: MIDIConflictResolutionStrategy;
  resolutionData?: any;
}

/**
 * Compression benefit analysis result
 */
export interface CompressionBenefit {
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
  customParameters: Record<string, any>;
}

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
  metadata?: Record<string, any>;
  error?: string;
}

/**
 * Compression result for internal operations
 */
export interface CompressionResult {
  compressedData: ArrayBuffer;
  metadata: Record<string, any>;
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
  metrics: QualityMetrics;
}

/**
 * Quality metrics for assessment
 */
export interface QualityMetrics {
  averageQualityScore: number; // 0-1
  qualityPreservationRate: number; // 0-1
  losslessOperations: number;
  lossyOperations: number;
  totalOperations: number;
}

/**
 * Performance metrics for operations
 */
export interface PerformanceMetrics {
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
  performanceMetrics: PerformanceMetrics;
  qualityMetrics: QualityMetrics;
  operationsByType: Record<AssetType, number>;
  algorithmUsage: Record<string, number>;
  lastUpdated: number;
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

// ===============================
// Cache Synchronization Types
// ===============================

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
  value: any;
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
  customMetadata: Record<string, any>;
}

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
  metadata: Record<string, any>;
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
  data: any;
  source: string;
}

/**
 * Conflict information
 */
export interface ConflictInfo {
  conflictId: string;
  type: ConflictType;
  sourceLayerId: string;
  targetLayerId: string;
  entryKey: string;
  sourceValue: any;
  targetValue: any;
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
  resolvedValue: any;
  affectedLayers: string[];
  resolutionTime: number; // ms
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Merge strategy for conflicts
 */
export interface MergeStrategy {
  strategyId: string;
  name: string;
  description: string;
  applicableConflictTypes: ConflictType[];
  mergeFunction: (sourceValue: any, targetValue: any, metadata: any) => any;
  priority: number;
  enabled: boolean;
}

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

/**
 * Conflict types
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
 * Sync priority levels
 */
export type SyncPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Synchronization strategy
 */
export type SynchronizationStrategy =
  | 'eventual_consistency'
  | 'strong_consistency'
  | 'session_consistency'
  | 'causal_consistency';
