/**
 * Audio Context Compatibility Helper
 *
 * Ensures cached AudioBuffers are compatible with the current AudioContext.
 * Automatically cleans up incompatible buffers from cache.
 */

import { GlobalSampleCache } from './GlobalSampleCache.js';
import { createStructuredLogger } from '@bassnotion/contracts';

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

    samples.forEach((sample, path) => {
      if (sample.buffer) {
        // Since we can't check if buffers are from different contexts without Tone.js,
        // and we know InitialSamplePreloader was using OfflineAudioContext,
        // we'll clear all buffers on first run to be safe
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
    } else {
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
