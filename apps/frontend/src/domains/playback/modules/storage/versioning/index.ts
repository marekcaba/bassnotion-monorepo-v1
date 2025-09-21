/**
 * Versioning Module
 *
 * Provides comprehensive asset versioning functionality including:
 * - Version creation and management
 * - Version history tracking
 * - Rollback capabilities
 * - Diff generation and comparison
 * - Retention policies
 */

export { VersionManager } from './VersionManager.js';

export type {
  // Core version types
  AssetVersion,
  VersionMetadata,
  VersionDiff,
  VersionChange,
  VersionComparison,

  // Configuration types
  VersioningConfig,
  RetentionPolicy,
  RetentionRule,
  CompressionConfig,
  DiffConfig,

  // Query and operation types
  VersionHistoryOptions,
  VersionOperationResult,
  BatchVersionOperation,
  VersionStatistics,
} from './types.js';
