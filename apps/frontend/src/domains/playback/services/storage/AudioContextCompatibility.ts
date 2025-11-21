/**
 * Audio Context Compatibility Helper
 *
 * Ensures cached AudioBuffers are compatible with the current AudioContext.
 * Automatically cleans up incompatible buffers from cache.
 */

import { GlobalSampleCache } from '../../modules/storage/cache/GlobalSampleCache.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('AudioContextCompatibility');

export class AudioContextCompatibility {
  private static hasCleanedUp = false;

  /**
   * Clean up any cached AudioBuffers that were decoded with a different AudioContext
   * This should be called once when the audio system initializes
   */
  static cleanupIncompatibleBuffers(): void {
    if (this.hasCleanedUp) {
      return;
    }

    logger.info('🧹 Checking for AudioBuffers from different contexts...');

    const stats = GlobalSampleCache.getCacheStats();
    if (stats.bufferCount === 0) {
      logger.info('✅ No cached buffers to check');
      this.hasCleanedUp = true;
      return;
    }

    // Get all cached samples
    const samples = (GlobalSampleCache as any).samples as Map<string, any>;
    let cleanedCount = 0;
    let skippedCount = 0;

    samples.forEach((sample, path) => {
      if (sample.buffer) {
        // CRITICAL: Skip buffers marked as context-compatible (from HarmonyPreloadStrategy)
        // These buffers were loaded with the real AudioContext, not OfflineAudioContext
        if (sample.isContextCompatible === true) {
          skippedCount++;
          logger.debug(`⏭️ Skipping context-compatible buffer: ${path}`);
          return;
        }

        // Clear buffers from InitialSamplePreloader (OfflineAudioContext)
        // These are not marked as context-compatible and should be re-decoded
        GlobalSampleCache.clearBuffer(path);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      logger.info(
        `🧹 Cleared ${cleanedCount} potentially incompatible AudioBuffers from cache`,
      );
      logger.info(
        '✅ Samples will be re-decoded with correct AudioContext when needed',
      );
    }

    if (skippedCount > 0) {
      logger.info(
        `⏭️ Kept ${skippedCount} context-compatible buffers (from HarmonyPreloadStrategy)`,
      );
    }

    if (cleanedCount === 0 && skippedCount === 0) {
      logger.info('✅ No incompatible buffers found');
    }

    this.hasCleanedUp = true;
  }

  /**
   * Reset the cleanup flag (mainly for testing)
   */
  static resetCleanupFlag(): void {
    this.hasCleanedUp = false;
  }
}
