/**
 * Metronome Preload Strategy
 *
 * Handles preloading of metronome samples
 */

import { PreloadStrategy } from './PreloadStrategy.js';
import { PreloadConfig, PreloadResult } from '../types/index.js';
import { GlobalSampleCache } from '../../../services/storage/GlobalSampleCache.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('MetronomePreloadStrategy');

export class MetronomePreloadStrategy implements PreloadStrategy {
  readonly name = 'metronome';
  private loaded = 0;
  private total = 0;

  async loadEssentialSamples(_config?: PreloadConfig): Promise<PreloadResult> {
    logger.info('Loading essential metronome samples...');

    try {
      const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
      const { supabase } = await import('@/infrastructure/supabase/client');

      // Metronome sample URLs
      const clickHighUrl = supabase.storage
        .from('samples')
        .getPublicUrl('metronome/click-high.mp3').data.publicUrl;

      const clickLowUrl = supabase.storage
        .from('samples')
        .getPublicUrl('metronome/click-low.mp3').data.publicUrl;

      // Cache both metronome sounds
      await GlobalSampleCache.getInstance().cacheUrl(
        'metronome-high',
        clickHighUrl,
      );

      await GlobalSampleCache.getInstance().cacheUrl(
        'metronome-low',
        clickLowUrl,
      );

      this.loaded = 2;
      this.total = 2;

      logger.info('Essential metronome samples loaded');

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
