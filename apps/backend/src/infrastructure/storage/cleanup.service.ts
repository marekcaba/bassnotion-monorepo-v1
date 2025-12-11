import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

/**
 * Cleanup Service - Removes expired temporary MIDI files
 * Story 4.4 - Task 2: Temporary MIDI File Storage System
 *
 * Deletes files from exercise-midi-temp bucket that are older than 2 hours.
 *
 * **Usage:**
 * 1. Manual: Call cleanupExpiredFiles() from endpoint
 * 2. Cron: Set up external cron (e.g., via Supabase Edge Functions)
 * 3. Scheduled: Install @nestjs/schedule and use @Cron decorator
 *
 * **Performance:**
 * - Runs in O(n) time where n = number of temp files
 * - Deletes in batches to avoid rate limits
 * - Logs all operations for monitoring
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private readonly EXPIRATION_HOURS = 2;
  private readonly BATCH_SIZE = 50; // Delete 50 files at a time

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Clean up expired temporary files
   * Files older than EXPIRATION_HOURS are deleted
   *
   * @returns Statistics about cleanup operation
   */
  async cleanupExpiredFiles(): Promise<{
    deletedCount: number;
    failedCount: number;
    totalScanned: number;
    durationMs: number;
  }> {
    const startTime = Date.now();

    this.logger.log('Starting cleanup of expired temp files', {
      expirationHours: this.EXPIRATION_HOURS,
    });

    try {
      // List all files in temp bucket
      const files = await this.supabaseService.listTempFiles();
      const totalScanned = files.length;

      this.logger.log(`Found ${totalScanned} temp files to scan`);

      if (totalScanned === 0) {
        return {
          deletedCount: 0,
          failedCount: 0,
          totalScanned: 0,
          durationMs: Date.now() - startTime,
        };
      }

      // Calculate expiration threshold
      const expirationThreshold =
        Date.now() - this.EXPIRATION_HOURS * 60 * 60 * 1000;

      // Filter expired files
      const expiredFiles = files.filter((file) => {
        const createdAt = new Date(file.created_at).getTime();
        return createdAt < expirationThreshold;
      });

      this.logger.log(
        `Found ${expiredFiles.length} expired files (older than ${this.EXPIRATION_HOURS} hours)`,
      );

      if (expiredFiles.length === 0) {
        return {
          deletedCount: 0,
          failedCount: 0,
          totalScanned,
          durationMs: Date.now() - startTime,
        };
      }

      // Delete files in batches
      let deletedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < expiredFiles.length; i += this.BATCH_SIZE) {
        const batch = expiredFiles.slice(i, i + this.BATCH_SIZE);

        this.logger.debug(
          `Deleting batch ${i / this.BATCH_SIZE + 1} (${batch.length} files)`,
        );

        for (const file of batch) {
          try {
            const deleted = await this.supabaseService.deleteTempFile(
              file.name,
            );
            if (deleted) {
              deletedCount++;
            } else {
              failedCount++;
              this.logger.warn(`Failed to delete temp file: ${file.name}`);
            }
          } catch (error) {
            failedCount++;
            this.logger.error(`Error deleting temp file: ${file.name}`, error);
          }
        }

        // Small delay between batches to avoid rate limits
        if (i + this.BATCH_SIZE < expiredFiles.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const durationMs = Date.now() - startTime;

      this.logger.log('Cleanup completed', {
        totalScanned,
        deletedCount,
        failedCount,
        durationMs,
        durationSeconds: (durationMs / 1000).toFixed(2),
      });

      return {
        deletedCount,
        failedCount,
        totalScanned,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      this.logger.error('Cleanup failed with error', error, {
        durationMs,
      });

      throw error;
    }
  }

  /**
   * Get statistics about temp storage usage
   * Useful for monitoring and alerting
   *
   * @returns Statistics about temp files
   */
  async getTempStorageStats(): Promise<{
    totalFiles: number;
    expiredFiles: number;
    activeFiles: number;
    oldestFileAge: string;
    newestFileAge: string;
  }> {
    this.logger.debug('Getting temp storage statistics');

    try {
      const files = await this.supabaseService.listTempFiles();
      const totalFiles = files.length;

      if (totalFiles === 0) {
        return {
          totalFiles: 0,
          expiredFiles: 0,
          activeFiles: 0,
          oldestFileAge: 'N/A',
          newestFileAge: 'N/A',
        };
      }

      const now = Date.now();
      const expirationThreshold = now - this.EXPIRATION_HOURS * 60 * 60 * 1000;

      const expiredFiles = files.filter((file) => {
        const createdAt = new Date(file.created_at).getTime();
        return createdAt < expirationThreshold;
      }).length;

      const activeFiles = totalFiles - expiredFiles;

      // Find oldest and newest files
      const timestamps = files.map((f) => new Date(f.created_at).getTime());
      const oldestTimestamp = Math.min(...timestamps);
      const newestTimestamp = Math.max(...timestamps);

      const oldestFileAge = this.formatAge(now - oldestTimestamp);
      const newestFileAge = this.formatAge(now - newestTimestamp);

      return {
        totalFiles,
        expiredFiles,
        activeFiles,
        oldestFileAge,
        newestFileAge,
      };
    } catch (error) {
      this.logger.error('Failed to get temp storage stats', error);
      throw error;
    }
  }

  /**
   * Format milliseconds into human-readable age
   */
  private formatAge(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}
