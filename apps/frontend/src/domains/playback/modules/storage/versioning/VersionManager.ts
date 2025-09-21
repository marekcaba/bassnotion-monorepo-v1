/**
 * Version Manager Module
 *
 * Manages asset versioning with comprehensive version control capabilities
 * including diff tracking, rollback, and version history management.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../../utils/logger.js';
import {
  VersioningConfig,
  AssetVersion,
  VersionDiff,
  VersionComparison,
  VersionMetadata,
} from './types.js';

/**
 * Version Manager
 * Implements asset versioning with diff tracking and rollback capabilities
 */
export class VersionManager {
  private config: VersioningConfig;
  private supabaseClient: SupabaseClient | null;
  private versions: Map<string, AssetVersion[]> = new Map();
  private isInitialized = false;

  constructor(config: VersioningConfig, supabaseClient?: SupabaseClient) {
    this.config = config;
    this.supabaseClient = supabaseClient || null;
  }

  /**
   * Initialize the version manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('VersionManager already initialized');
      return;
    }

    try {
      // Load existing versions if using persistent storage
      if (this.supabaseClient && this.config.persistToStorage) {
        await this.loadVersionsFromStorage();
      }

      this.isInitialized = true;
      logger.info('📚 VersionManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize VersionManager:', error);
      throw error;
    }
  }

  /**
   * Create a new version of an asset
   */
  async createVersion(
    assetId: string,
    data: Blob,
    metadata: Partial<VersionMetadata> = {},
  ): Promise<AssetVersion> {
    if (!this.isInitialized) {
      throw new Error('VersionManager not initialized');
    }

    const existingVersions = this.versions.get(assetId) || [];

    // Check version limit
    if (
      this.config.maxVersionsPerAsset &&
      existingVersions.length >= this.config.maxVersionsPerAsset
    ) {
      if (this.config.retentionPolicy.autoDeleteOldest) {
        await this.deleteOldestVersion(assetId);
      } else {
        throw new Error(
          `Maximum versions (${this.config.maxVersionsPerAsset}) reached for asset ${assetId}`,
        );
      }
    }

    const versionId = this.generateVersionId();
    const versionNumber = this.generateVersionNumber(existingVersions);

    const version: AssetVersion = {
      versionId,
      assetId,
      versionNumber,
      parentVersionId: existingVersions[existingVersions.length - 1]?.versionId,
      createdAt: Date.now(),
      createdBy: metadata.createdBy || 'system',
      size: data.size,
      checksum: await this.calculateChecksum(data),
      changeDescription: metadata.changeDescription,
      tags: metadata.tags || [],
      metadata: {
        contentType: data.type,
        encoding: metadata.encoding,
        dimensions: metadata.dimensions,
        customMetadata: metadata.customMetadata || {},
      },
      isActive: true,
      isDraft: metadata.isDraft || false,
      isArchived: false,
    };

    // Mark previous versions as inactive
    if (!metadata.keepPreviousActive) {
      existingVersions.forEach((v) => (v.isActive = false));
    }

    // Store the actual data if configured
    if (this.config.storeVersionData) {
      await this.storeVersionData(version, data);
    }

    // Add to version history
    existingVersions.push(version);
    this.versions.set(assetId, existingVersions);

    // Persist if configured
    if (this.supabaseClient && this.config.persistToStorage) {
      await this.persistVersion(version);
    }

    logger.info(
      `📝 Created version ${version.versionNumber} for asset ${assetId}`,
    );
    return version;
  }

  /**
   * Get all versions for an asset
   */
  async getVersions(assetId: string): Promise<AssetVersion[]> {
    const versions = this.versions.get(assetId) || [];
    return [...versions].sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get a specific version
   */
  async getVersion(
    assetId: string,
    versionId: string,
  ): Promise<AssetVersion | null> {
    const versions = this.versions.get(assetId) || [];
    return versions.find((v) => v.versionId === versionId) || null;
  }

  /**
   * Get the active version
   */
  async getActiveVersion(assetId: string): Promise<AssetVersion | null> {
    const versions = this.versions.get(assetId) || [];
    return versions.find((v) => v.isActive) || null;
  }

  /**
   * Rollback to a specific version
   */
  async rollbackToVersion(
    assetId: string,
    versionId: string,
  ): Promise<AssetVersion> {
    const versions = this.versions.get(assetId) || [];
    const targetVersion = versions.find((v) => v.versionId === versionId);

    if (!targetVersion) {
      throw new Error(`Version ${versionId} not found for asset ${assetId}`);
    }

    // Mark all versions as inactive
    versions.forEach((v) => (v.isActive = false));

    // Mark target version as active
    targetVersion.isActive = true;

    // Update persistence if configured
    if (this.supabaseClient && this.config.persistToStorage) {
      await this.updateVersionStatus(assetId, versionId, true);
    }

    logger.info(
      `↩️ Rolled back to version ${targetVersion.versionNumber} for asset ${assetId}`,
    );
    return targetVersion;
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    assetId: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<VersionDiff> {
    const fromVersion = await this.getVersion(assetId, fromVersionId);
    const toVersion = await this.getVersion(assetId, toVersionId);

    if (!fromVersion || !toVersion) {
      throw new Error('One or both versions not found');
    }

    const comparison = await this.performVersionComparison(
      fromVersion,
      toVersion,
    );

    const diff: VersionDiff = {
      fromVersion: fromVersionId,
      toVersion: toVersionId,
      diffType: comparison.diffType,
      changes: comparison.changes,
      similarity: comparison.similarity,
      diffSize: Math.abs(toVersion.size - fromVersion.size),
      generatedAt: Date.now(),
    };

    return diff;
  }

  /**
   * Archive a version
   */
  async archiveVersion(assetId: string, versionId: string): Promise<void> {
    const versions = this.versions.get(assetId) || [];
    const version = versions.find((v) => v.versionId === versionId);

    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }

    version.isArchived = true;
    version.archivedAt = Date.now();

    if (this.supabaseClient && this.config.persistToStorage) {
      await this.updateVersionArchiveStatus(assetId, versionId, true);
    }

    logger.info(
      `📦 Archived version ${version.versionNumber} for asset ${assetId}`,
    );
  }

  /**
   * Delete a version
   */
  async deleteVersion(assetId: string, versionId: string): Promise<void> {
    const versions = this.versions.get(assetId) || [];
    const versionIndex = versions.findIndex((v) => v.versionId === versionId);

    if (versionIndex === -1) {
      throw new Error(`Version ${versionId} not found`);
    }

    const version = versions[versionIndex];

    // Don't delete active versions unless forced
    if (version.isActive && !this.config.allowActiveVersionDeletion) {
      throw new Error('Cannot delete active version');
    }

    // Remove from array
    versions.splice(versionIndex, 1);

    // Update map
    if (versions.length === 0) {
      this.versions.delete(assetId);
    } else {
      this.versions.set(assetId, versions);
    }

    // Remove from storage if configured
    if (this.supabaseClient && this.config.persistToStorage) {
      await this.removeVersionFromStorage(assetId, versionId);
    }

    logger.info(
      `🗑️ Deleted version ${version.versionNumber} for asset ${assetId}`,
    );
  }

  /**
   * Get version history with filtering
   */
  async getVersionHistory(
    assetId: string,
    options: VersionHistoryOptions = {},
  ): Promise<AssetVersion[]> {
    let versions = await this.getVersions(assetId);

    // Apply filters
    if (options.excludeArchived) {
      versions = versions.filter((v) => !v.isArchived);
    }

    if (options.excludeDrafts) {
      versions = versions.filter((v) => !v.isDraft);
    }

    if (options.fromDate) {
      versions = versions.filter((v) => v.createdAt >= options.fromDate!);
    }

    if (options.toDate) {
      versions = versions.filter((v) => v.createdAt <= options.toDate!);
    }

    if (options.tags && options.tags.length > 0) {
      versions = versions.filter((v) =>
        options.tags!.some((tag) => v.tags.includes(tag)),
      );
    }

    // Apply limit
    if (options.limit) {
      versions = versions.slice(0, options.limit);
    }

    return versions;
  }

  /**
   * Cleanup old versions based on retention policy
   */
  async cleanupOldVersions(assetId?: string): Promise<number> {
    let deletedCount = 0;
    const assets = assetId ? [assetId] : Array.from(this.versions.keys());

    for (const aid of assets) {
      const versions = this.versions.get(aid) || [];
      const policy = this.config.retentionPolicy;

      // Sort by creation date (oldest first)
      const sortedVersions = [...versions].sort(
        (a, b) => a.createdAt - b.createdAt,
      );

      for (let i = 0; i < sortedVersions.length; i++) {
        const version = sortedVersions[i];
        let shouldDelete = false;

        // Check age
        if (policy.maxAgeInDays) {
          const ageInDays =
            (Date.now() - version.createdAt) / (1000 * 60 * 60 * 24);
          if (ageInDays > policy.maxAgeInDays) {
            shouldDelete = true;
          }
        }

        // Check version count - keep only the last N versions
        if (policy.keepLastNVersions) {
          // If this version is not in the last N versions, mark for deletion
          if (i < sortedVersions.length - policy.keepLastNVersions) {
            shouldDelete = true;
          }
        }

        // Don't delete active versions if deleteInactiveOnly is true
        if (version.isActive && policy.deleteInactiveOnly) {
          shouldDelete = false;
        }

        if (shouldDelete) {
          try {
            await this.deleteVersion(aid, version.versionId);
            deletedCount++;
          } catch (error) {
            logger.warn(
              `Failed to delete version ${version.versionId}:`,
              error,
            );
          }
        }
      }
    }

    logger.info(`🧹 Cleaned up ${deletedCount} old versions`);
    return deletedCount;
  }

  // Private helper methods
  private generateVersionId(): string {
    return `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateVersionNumber(existingVersions: AssetVersion[]): string {
    if (existingVersions.length === 0) {
      return '1.0.0';
    }

    const latest = existingVersions[existingVersions.length - 1];
    const parts = latest.versionNumber.split('.');
    const patch = parseInt(parts[2] || '0') + 1;

    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  private async calculateChecksum(data: Blob): Promise<string> {
    if (this.config.enableChecksumValidation) {
      try {
        // Use Web Crypto API for proper checksum if available
        if (
          typeof data.arrayBuffer === 'function' &&
          typeof crypto !== 'undefined' &&
          crypto.subtle
        ) {
          const arrayBuffer = await data.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          return hashHex;
        }
      } catch (error) {
        logger.warn(
          'Failed to calculate SHA-256 checksum, using fallback',
          error,
        );
      }
    }

    // Fallback to simple checksum
    return `checksum_${data.size}_${data.type}_${Date.now()}`;
  }

  private async deleteOldestVersion(assetId: string): Promise<void> {
    const versions = this.versions.get(assetId) || [];
    if (versions.length === 0) return;

    // Find the oldest inactive version first
    const inactiveVersions = versions.filter((v) => !v.isActive);
    if (inactiveVersions.length > 0) {
      const oldest = inactiveVersions.reduce((prev, curr) =>
        prev.createdAt < curr.createdAt ? prev : curr,
      );
      await this.deleteVersion(assetId, oldest.versionId);
    } else if (this.config.allowActiveVersionDeletion) {
      // If no inactive versions and we can delete active ones, delete the oldest
      const oldest = versions.reduce((prev, curr) =>
        prev.createdAt < curr.createdAt ? prev : curr,
      );
      await this.deleteVersion(assetId, oldest.versionId);
    } else {
      throw new Error(
        'Cannot delete oldest version - all versions are active and deletion of active versions is not allowed',
      );
    }
  }

  private async performVersionComparison(
    fromVersion: AssetVersion,
    toVersion: AssetVersion,
  ): Promise<VersionComparison> {
    // Simple comparison based on metadata
    const changes: string[] = [];

    if (fromVersion.size !== toVersion.size) {
      const sizeDiff = toVersion.size - fromVersion.size;
      changes.push(
        `Size changed by ${sizeDiff > 0 ? '+' : ''}${sizeDiff} bytes`,
      );
    }

    if (fromVersion.metadata.contentType !== toVersion.metadata.contentType) {
      changes.push(
        `Content type changed from ${fromVersion.metadata.contentType} to ${toVersion.metadata.contentType}`,
      );
    }

    // Calculate similarity (simplified)
    const similarity = fromVersion.checksum === toVersion.checksum ? 1 : 0.5;

    return {
      diffType: changes.length === 0 ? 'identical' : 'binary',
      changes,
      similarity,
    };
  }

  // Storage persistence methods (stubs for now)
  private async loadVersionsFromStorage(): Promise<void> {
    // TODO: Implement loading from Supabase
    logger.info('Loading versions from storage...');
  }

  private async persistVersion(version: AssetVersion): Promise<void> {
    // TODO: Implement persistence to Supabase
    logger.info(`Persisting version ${version.versionId} to storage`);
  }

  private async storeVersionData(
    version: AssetVersion,
    data: Blob,
  ): Promise<void> {
    // TODO: Implement data storage to Supabase
    logger.info(`Storing version data for ${version.versionId}`);
  }

  private async updateVersionStatus(
    assetId: string,
    versionId: string,
    isActive: boolean,
  ): Promise<void> {
    // TODO: Implement status update in Supabase
    logger.info(
      `Updating version ${versionId} status to ${isActive ? 'active' : 'inactive'}`,
    );
  }

  private async updateVersionArchiveStatus(
    assetId: string,
    versionId: string,
    isArchived: boolean,
  ): Promise<void> {
    // TODO: Implement archive status update in Supabase
    logger.info(
      `Updating version ${versionId} archive status to ${isArchived}`,
    );
  }

  private async removeVersionFromStorage(
    assetId: string,
    versionId: string,
  ): Promise<void> {
    // TODO: Implement removal from Supabase
    logger.info(`Removing version ${versionId} from storage`);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.versions.clear();
    this.isInitialized = false;
    logger.info('🛑 VersionManager disposed');
  }
}

// Types
interface VersionHistoryOptions {
  limit?: number;
  excludeArchived?: boolean;
  excludeDrafts?: boolean;
  fromDate?: number;
  toDate?: number;
  tags?: string[];
}

interface VersionComparison {
  diffType: 'identical' | 'binary' | 'text' | 'structured';
  changes: string[];
  similarity: number;
}
