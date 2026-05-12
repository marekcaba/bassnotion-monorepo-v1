/**
 * Bucket Management Types
 * Advanced bucket organization, versioning, search, and cleanup.
 * Story 2.4 Subtask 1.3
 *
 * @module storage/bucket-management
 */

import type { TokenInfo } from './authentication.types.js';

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Bucket categories for organization
 */
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

/**
 * Bucket operations for auditing
 */
export type BucketOperation =
  | 'create_bucket'
  | 'delete_bucket'
  | 'update_bucket'
  | 'upload_asset'
  | 'download_asset'
  | 'delete_asset'
  | 'update_permissions'
  | 'create_version'
  | 'rollback_version';

// ============================================================================
// Bucket Configuration
// ============================================================================

/**
 * Retention policy conditions
 */
export interface RetentionCondition {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'greater_than'
    | 'less_than'
    | 'contains'
    | 'regex';
  value: unknown;
  logicalOperator?: 'AND' | 'OR';
}

/**
 * Retention policy actions
 */
export interface RetentionAction {
  type: 'delete' | 'archive' | 'compress' | 'move' | 'notify';
  parameters: Record<string, unknown>;
  delay?: number; // ms to wait before executing
}

/**
 * Retention policies for different asset types
 */
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

/**
 * Bucket management configuration
 */
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

// ============================================================================
// Bucket Information
// ============================================================================

/**
 * Bucket issues and problems
 */
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

/**
 * Bucket health monitoring
 */
export interface BucketHealthStatus {
  isHealthy: boolean;
  lastCheck: number;
  issues: BucketIssue[];
  storageUtilization: number; // 0-1
  accessFrequency: number;
  errorRate: number;
  averageResponseTime: number;
}

/**
 * Bucket permissions and access control
 */
export interface BucketPermissions {
  read: string[]; // User IDs or roles
  write: string[];
  delete: string[];
  admin: string[];
  publicRead: boolean;
  publicWrite: boolean;
  inheritFromParent: boolean;
}

/**
 * Bucket information and metadata
 */
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
  metadata: Record<string, unknown>;
  healthStatus: BucketHealthStatus;
}

// ============================================================================
// Asset Versioning
// ============================================================================

/**
 * Version-specific metadata
 */
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
  customMetadata: Record<string, unknown>;
}

/**
 * Asset version information
 */
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

/**
 * Asset versioning configuration
 */
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

/**
 * Individual version changes
 */
export interface VersionChange {
  changeId: string;
  type: 'added' | 'modified' | 'deleted' | 'moved';
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
  description: string;
  impact: 'minor' | 'major' | 'breaking';
}

/**
 * Version comparison and diff
 */
export interface VersionDiff {
  fromVersion: string;
  toVersion: string;
  diffType: 'binary' | 'text' | 'audio' | 'midi';
  changes: VersionChange[];
  similarity: number; // 0-1
  diffSize: number; // bytes
  generatedAt: number;
}

// ============================================================================
// Metadata Indexing and Search
// ============================================================================

/**
 * Extracted metadata from content analysis
 */
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
  customFields: Record<string, unknown>;
}

/**
 * Asset relationships for discovery
 */
export interface AssetRelationship {
  relationshipId: string;
  type: 'similar' | 'derived_from' | 'part_of' | 'used_in' | 'references';
  targetAssetId: string;
  strength: number; // 0-1
  description?: string;
  createdAt: number;
  metadata: Record<string, unknown>;
}

/**
 * Asset metadata index entry
 */
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

/**
 * Metadata indexing configuration
 */
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

/**
 * Search filters
 */
export interface AssetSearchFilters {
  buckets?: string[];
  categories?: BucketCategory[];
  contentTypes?: string[];
  tags?: string[];
  sizeRange?: { min: number; max: number };
  dateRange?: { from: number; to: number };
  owners?: string[];
  customFilters?: Record<string, unknown>;
}

/**
 * Search result sorting
 */
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

/**
 * Search pagination
 */
export interface SearchPagination {
  page: number;
  pageSize: number;
  totalResults?: number;
  totalPages?: number;
}

/**
 * Search query and filters
 */
export interface AssetSearchQuery {
  query?: string;
  filters: AssetSearchFilters;
  sorting: AssetSearchSorting;
  pagination: SearchPagination;
  includeMetadata: boolean;
  includeRelationships: boolean;
}

/**
 * Facet values with counts
 */
export interface FacetValue {
  value: string;
  count: number;
  selected: boolean;
}

/**
 * Search facets for filtering
 */
export interface SearchFacet {
  field: string;
  values: FacetValue[];
}

/**
 * Search results
 */
export interface AssetSearchResult {
  results: AssetMetadataIndex[];
  totalResults: number;
  totalPages: number;
  currentPage: number;
  searchTime: number; // ms
  suggestions?: string[];
  facets?: SearchFacet[];
}

// ============================================================================
// Cleanup Configuration
// ============================================================================

/**
 * Cleanup scheduling
 */
export interface CleanupSchedule {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time?: string; // HH:MM format
  dayOfWeek?: number; // 0-6, Sunday = 0
  dayOfMonth?: number; // 1-31
  timezone: string;
}

/**
 * Orphaned asset cleanup
 */
export interface OrphanedAssetCleanupConfig {
  enabled: boolean;
  detectionInterval: number; // ms
  gracePeriod: number; // ms before cleanup
  autoCleanup: boolean;
  notifyBeforeCleanup: boolean;
  backupBeforeCleanup: boolean;
}

/**
 * Duplicate detection and cleanup
 */
export interface DuplicateDetectionConfig {
  enabled: boolean;
  detectionMethod: 'checksum' | 'content_analysis' | 'metadata' | 'hybrid';
  similarityThreshold: number; // 0-1
  autoMerge: boolean;
  keepStrategy: 'newest' | 'oldest' | 'largest' | 'most_accessed';
  notifyOnDuplicates: boolean;
}

/**
 * Storage optimization settings
 */
export interface StorageOptimizationConfig {
  enabled: boolean;
  compressionEnabled: boolean;
  compressionLevel: 'low' | 'medium' | 'high' | 'adaptive';
  formatOptimization: boolean;
  qualityOptimization: boolean;
  batchOptimization: boolean;
  optimizationSchedule: CleanupSchedule;
}

/**
 * Archival configuration
 */
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

/**
 * Cleanup notifications
 */
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

/**
 * Automated cleanup configuration
 */
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

/**
 * Cleanup errors
 */
export interface CleanupError {
  errorId: string;
  assetId?: string;
  errorType: string;
  message: string;
  timestamp: number;
  retryable: boolean;
}

/**
 * Cleanup operation result
 */
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

// ============================================================================
// Analytics
// ============================================================================

/**
 * Analytics time period
 */
export interface AnalyticsPeriod {
  startTime: number;
  endTime: number;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

/**
 * Data points for trends
 */
export interface DataPoint {
  timestamp: number;
  value: number;
}

/**
 * Category usage breakdown
 */
export interface CategoryUsage {
  category: BucketCategory;
  size: number;
  count: number;
  percentage: number;
}

/**
 * Asset size information
 */
export interface AssetSizeInfo {
  assetId: string;
  name: string;
  size: number;
  lastAccessed: number;
}

/**
 * Storage usage analytics
 */
export interface StorageUsageAnalytics {
  totalSize: number;
  assetCount: number;
  averageAssetSize: number;
  growthRate: number; // bytes per day
  utilizationTrend: DataPoint[];
  categoryBreakdown: CategoryUsage[];
  largestAssets: AssetSizeInfo[];
}

/**
 * Popular asset information
 */
export interface PopularAssetInfo {
  assetId: string;
  name: string;
  accessCount: number;
  uniqueUsers: number;
  lastAccessed: number;
}

/**
 * User access patterns
 */
export interface UserAccessPattern {
  userId: string;
  accessCount: number;
  favoriteCategories: BucketCategory[];
  accessTimes: number[]; // hours of day
  averageSessionDuration: number;
}

/**
 * Access pattern analytics
 */
export interface AccessPatternAnalytics {
  totalAccesses: number;
  uniqueUsers: number;
  averageAccessesPerDay: number;
  peakAccessTime: string;
  accessTrend: DataPoint[];
  popularAssets: PopularAssetInfo[];
  userAccessPatterns: UserAccessPattern[];
}

/**
 * Slow operation information
 */
export interface SlowOperationInfo {
  operation: string;
  averageTime: number;
  count: number;
  lastOccurrence: number;
}

/**
 * Bucket performance metrics
 */
export interface BucketPerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  throughput: number; // requests per second
  cacheHitRate: number;
  performanceTrend: DataPoint[];
  slowestOperations: SlowOperationInfo[];
}

/**
 * Category cost breakdown
 */
export interface CategoryCost {
  category: BucketCategory;
  cost: number;
  percentage: number;
}

/**
 * Storage cost analytics
 */
export interface StorageCostAnalytics {
  totalCost: number;
  costPerGB: number;
  costTrend: DataPoint[];
  costByCategory: CategoryCost[];
  projectedMonthlyCost: number;
  costOptimizationPotential: number;
}

/**
 * Bucket recommendations
 */
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

/**
 * Bucket analytics and insights
 */
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

// ============================================================================
// Extended Types
// ============================================================================

/**
 * Extended storage token info for bucket operations
 */
export interface StorageTokenInfo extends TokenInfo {
  bucketPermissions?: Record<string, string[]>; // bucket -> permissions
  scopedAccess?: string[]; // specific scopes for bucket operations
}

/**
 * Bucket operation audit log
 */
export interface BucketAuditLog {
  logId: string;
  bucketId: string;
  operation: BucketOperation;
  userId: string;
  timestamp: number;
  details: Record<string, unknown>;
  result: 'success' | 'failure';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}
