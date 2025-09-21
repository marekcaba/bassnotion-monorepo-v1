/**
 * Versioning Module Types
 *
 * Type definitions for asset versioning functionality
 */

/**
 * Asset version metadata
 */
export interface AssetVersion {
  /** Unique version identifier */
  versionId: string;

  /** Associated asset ID */
  assetId: string;

  /** Semantic version number (e.g., "1.0.0") */
  versionNumber: string;

  /** Parent version ID for tracking lineage */
  parentVersionId?: string;

  /** Creation timestamp */
  createdAt: number;

  /** Creator identifier */
  createdBy: string;

  /** Version size in bytes */
  size: number;

  /** Content checksum for integrity verification */
  checksum: string;

  /** Human-readable change description */
  changeDescription?: string;

  /** Version tags for categorization */
  tags: string[];

  /** Additional metadata */
  metadata: VersionMetadata;

  /** Whether this is the currently active version */
  isActive: boolean;

  /** Whether this is a draft version */
  isDraft: boolean;

  /** Whether this version is archived */
  isArchived: boolean;

  /** Archive timestamp */
  archivedAt?: number;

  /** Associated data URL (if stored) */
  dataUrl?: string;
}

/**
 * Version metadata
 */
export interface VersionMetadata {
  /** MIME type */
  contentType: string;

  /** Content encoding */
  encoding?: string;

  /** Media dimensions */
  dimensions?: {
    width: number;
    height: number;
  };

  /** Custom application-specific metadata */
  customMetadata: Record<string, any>;
}

/**
 * Version comparison result
 */
export interface VersionDiff {
  /** Source version ID */
  fromVersion: string;

  /** Target version ID */
  toVersion: string;

  /** Type of difference */
  diffType: 'identical' | 'binary' | 'text' | 'structured';

  /** List of changes */
  changes: string[];

  /** Similarity score (0-1) */
  similarity: number;

  /** Size difference in bytes */
  diffSize: number;

  /** When the diff was generated */
  generatedAt: number;

  /** Detailed change records (optional) */
  detailedChanges?: VersionChange[];
}

/**
 * Individual version change
 */
export interface VersionChange {
  /** Type of change */
  type: 'added' | 'modified' | 'deleted' | 'renamed' | 'moved';

  /** Path or identifier of changed element */
  path: string;

  /** Previous value (for modifications) */
  oldValue?: any;

  /** New value (for modifications) */
  newValue?: any;

  /** Additional change metadata */
  metadata?: Record<string, any>;
}

/**
 * Version comparison details
 */
export interface VersionComparison {
  /** Type of difference detected */
  diffType: 'identical' | 'binary' | 'text' | 'structured';

  /** List of changes found */
  changes: string[];

  /** Similarity score (0-1) */
  similarity: number;

  /** Detailed analysis results */
  analysis?: {
    added: number;
    modified: number;
    deleted: number;
    unchanged: number;
  };
}

/**
 * Versioning system configuration
 */
export interface VersioningConfig {
  /** Maximum versions to keep per asset */
  maxVersionsPerAsset: number;

  /** Whether to enable checksum validation */
  enableChecksumValidation: boolean;

  /** Whether to store version data alongside metadata */
  storeVersionData: boolean;

  /** Whether to persist versions to storage backend */
  persistToStorage: boolean;

  /** Allow deletion of active versions */
  allowActiveVersionDeletion: boolean;

  /** Version retention policy */
  retentionPolicy: RetentionPolicy;

  /** Compression settings for version storage */
  compression?: CompressionConfig;

  /** Diff generation settings */
  diffSettings?: DiffConfig;
}

/**
 * Version retention policy
 */
export interface RetentionPolicy {
  /** Maximum age in days before automatic deletion */
  maxAgeInDays?: number;

  /** Keep only the last N versions */
  keepLastNVersions?: number;

  /** Automatically delete oldest when limit reached */
  autoDeleteOldest: boolean;

  /** Only delete inactive versions */
  deleteInactiveOnly: boolean;

  /** Archive before deletion */
  archiveBeforeDelete: boolean;

  /** Custom retention rules */
  customRules?: RetentionRule[];
}

/**
 * Custom retention rule
 */
export interface RetentionRule {
  /** Rule identifier */
  ruleId: string;

  /** Rule description */
  description: string;

  /** Condition to match */
  condition: {
    /** Match by tags */
    tags?: string[];

    /** Match by age */
    olderThan?: number;

    /** Match by size */
    largerThan?: number;

    /** Match by custom predicate */
    customPredicate?: (version: AssetVersion) => boolean;
  };

  /** Action to take when condition matches */
  action: 'delete' | 'archive' | 'compress';
}

/**
 * Compression configuration
 */
export interface CompressionConfig {
  /** Enable compression */
  enabled: boolean;

  /** Compression algorithm */
  algorithm: 'gzip' | 'brotli' | 'zstd';

  /** Compression level (1-9) */
  level: number;

  /** Minimum size to compress (bytes) */
  minSize: number;

  /** File types to compress */
  compressibleTypes: string[];
}

/**
 * Diff generation configuration
 */
export interface DiffConfig {
  /** Enable diff generation */
  enabled: boolean;

  /** Maximum file size for diff generation */
  maxFileSize: number;

  /** Diff algorithms by content type */
  algorithms: {
    text: 'myers' | 'patience' | 'histogram';
    binary: 'bsdiff' | 'xdelta' | 'none';
    structured: 'json-patch' | 'xml-diff' | 'custom';
  };

  /** Store diffs for faster comparisons */
  storeDiffs: boolean;
}

/**
 * Version history query options
 */
export interface VersionHistoryOptions {
  /** Maximum results to return */
  limit?: number;

  /** Exclude archived versions */
  excludeArchived?: boolean;

  /** Exclude draft versions */
  excludeDrafts?: boolean;

  /** Filter by date range - from */
  fromDate?: number;

  /** Filter by date range - to */
  toDate?: number;

  /** Filter by tags */
  tags?: string[];

  /** Filter by creator */
  createdBy?: string;

  /** Sort order */
  sortBy?: 'createdAt' | 'versionNumber' | 'size';

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Version operation result
 */
export interface VersionOperationResult {
  /** Whether operation succeeded */
  success: boolean;

  /** Result data */
  data?: any;

  /** Error if operation failed */
  error?: Error;

  /** Operation metadata */
  metadata?: {
    duration: number;
    bytesProcessed?: number;
    warnings?: string[];
  };
}

/**
 * Batch version operation
 */
export interface BatchVersionOperation {
  /** Operation type */
  type: 'create' | 'delete' | 'archive' | 'rollback';

  /** Target asset IDs */
  assetIds: string[];

  /** Operation parameters */
  params: Record<string, any>;

  /** Whether to continue on error */
  continueOnError: boolean;
}

/**
 * Version statistics
 */
export interface VersionStatistics {
  /** Total number of versions */
  totalVersions: number;

  /** Active versions count */
  activeVersions: number;

  /** Draft versions count */
  draftVersions: number;

  /** Archived versions count */
  archivedVersions: number;

  /** Total storage used (bytes) */
  totalStorageBytes: number;

  /** Average version size (bytes) */
  averageVersionSize: number;

  /** Versions by content type */
  versionsByType: Record<string, number>;

  /** Creation rate (versions per day) */
  creationRate: number;

  /** Last cleanup timestamp */
  lastCleanup?: number;
}
