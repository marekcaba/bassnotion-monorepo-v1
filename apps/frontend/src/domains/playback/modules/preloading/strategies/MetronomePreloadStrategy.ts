/**
 * Metronome Preload Strategy
 *
 * Handles preloading of metronome samples
 */

import { PreloadStrategy } from './PreloadStrategy.js';
import { PreloadConfig, PreloadResult } from '../types/index.js';
import { GlobalSampleCache } from '../../storage/cache/GlobalSampleCache.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('MetronomePreloadStrategy');

export class MetronomePreloadStrategy implements PreloadStrategy {
  readonly name = 'metronome';
  private loaded = 0;
  private total = 0;

  async loadEssentialSamples(_config?: PreloadConfig): Promise<PreloadResult> {
    const startTime = performance.now();
    logger.info('📥 Loading essential metronome samples...');

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL not configured');
      }

      // Use the exact same paths as WamMetronome to ensure compatibility
      const clickHighUrl = `${supabaseUrl}/storage/v1/object/public/audio-samples/metronome/Click_high2_fixed.mp3`;
      const clickLowUrl = `${supabaseUrl}/storage/v1/object/public/audio-samples/metronome/Click_low2_fixed.mp3`;

      logger.info('🎵 Preloading metronome samples:', {
        highUrl: clickHighUrl,
        lowUrl: clickLowUrl,
      });

      // ✅ BUG #2 FIX: Removed OfflineAudioContext creation
      // We now cache raw ArrayBuffer data instead of decoding with OfflineContext
      // The real AudioContext will handle decoding during playback

      // Load and cache HIGH click
      logger.info('📥 Fetching high click...');
      const highResponse = await fetch(clickHighUrl);
      if (!highResponse.ok) {
        throw new Error(`Failed to fetch high click: ${highResponse.status}`);
      }
      const highArrayBuffer = await highResponse.arrayBuffer();

      // ✅ BUG #2 FIX: Cache raw ArrayBuffer, NOT decoded AudioBuffer from OfflineContext
      GlobalSampleCache.getInstance().cacheBuffer('metronome-high', highArrayBuffer);
      logger.info('✅ High click cached');

      // Load and cache LOW click
      logger.info('📥 Fetching low click...');
      const lowResponse = await fetch(clickLowUrl);
      if (!lowResponse.ok) {
        throw new Error(`Failed to fetch low click: ${lowResponse.status}`);
      }
      const lowArrayBuffer = await lowResponse.arrayBuffer();

      // ✅ BUG #2 FIX: Cache raw ArrayBuffer, NOT decoded AudioBuffer from OfflineContext
      GlobalSampleCache.getInstance().cacheBuffer('metronome-low', lowArrayBuffer);
      logger.info('✅ Low click cached');

      this.loaded = 2;
      this.total = 2;

      const duration = performance.now() - startTime;
      logger.info('✅ Essential metronome samples preloaded as raw ArrayBuffers (BUG #2 FIX)', {
        duration: `${duration.toFixed(2)}ms`,
        samplesLoaded: 2,
        averagePerSample: `${(duration / 2).toFixed(2)}ms`,
      });

      return {
        success: true,
        loaded: this.loaded,
        total: this.total,
      };
    } catch (error) {
      logger.error('Failed to load essential metronome samples', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        loaded: 0,
        total: 0,
      };
    }
  }

  async loadFullSamples(_config?: PreloadConfig): Promise<PreloadResult> {
    // Metronome doesn't need additional samples for full quality
    return {
      success: true,
      loaded: this.loaded,
      total: this.total,
    };
  }

  async clear(): Promise<void> {
    this.loaded = 0;
    this.total = 0;
  }

  getProgress() {
    return {
      loaded: this.loaded,
      total: this.total,
      progress: this.total > 0 ? this.loaded / this.total : 0,
    };
  }
}
