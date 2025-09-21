/**
 * Harmony Preload Strategy
 *
 * Handles preloading of harmony/piano samples
 */

import { PreloadStrategy } from './PreloadStrategy.js';
import { PreloadConfig, PreloadResult } from '../types/index.js';
import { GlobalSampleCache } from '../../../services/storage/GlobalSampleCache.js';
import { wamPluginSingleton } from '@/domains/widgets/utils/wamPluginSingleton.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('HarmonyPreloadStrategy');

export class HarmonyPreloadStrategy implements PreloadStrategy {
  readonly name = 'harmony';
  private harmonyInstrument: any = null;
  private loaded = 0;
  private total = 0;

  async loadEssentialSamples(_config?: PreloadConfig): Promise<PreloadResult> {
    logger.info('Loading essential harmony samples...');

    try {
      // Check if CoreServices and AudioEngine are available
      const coreServices =
        (window as any).__globalCoreServices || (window as any).__coreServices;

      if (!coreServices) {
        return this.fallbackToUrlCaching();
      }

      const audioEngine = coreServices.getAudioEngine?.();
      if (!audioEngine || !audioEngine.isReady()) {
        return this.fallbackToUrlCaching();
      }

      // Get AudioContext from AudioEngine
      const context = audioEngine.getContext();
      if (!context || context.state !== 'running') {
        return this.fallbackToUrlCaching();
      }

      // Create WamKeyboard instance through singleton
      this.harmonyInstrument =
        await wamPluginSingleton.getOrCreateKeyboardPlugin(context);

      // Connect to destination if needed
      if (
        this.harmonyInstrument.audioNode &&
        !this.harmonyInstrument.audioNode.isConnected
      ) {
        this.harmonyInstrument.audioNode.connect(context.destination);
      }

      // Store in global cache
      GlobalSampleCache.getInstance().cacheInstrument(
        'harmony-preloaded',
        this.harmonyInstrument,
      );

      // Essential samples count (v10 layer)
      this.loaded = 24; // Approximate count for essential notes
      this.total = 24;

      logger.info('Essential harmony samples loaded');

      return {
        success: true,
        loaded: this.loaded,
        total: this.total,
      };
    } catch (error) {
      logger.error('Failed to load essential harmony samples', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        loaded: 0,
        total: 0,
      };
    }
  }

  async loadFullSamples(_config?: PreloadConfig): Promise<PreloadResult> {
    logger.info('Loading full harmony samples...');

    try {
      // In the current implementation, full samples loading is disabled
      // for debugging. When enabled, this would load additional velocity layers
      logger.info('Full harmony sample loading is currently disabled');

      return {
        success: true,
        loaded: this.loaded,
        total: this.total,
      };
    } catch (error) {
      logger.error('Failed to load full harmony samples', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        loaded: this.loaded,
        total: this.total,
      };
    }
  }

  async clear(): Promise<void> {
    this.harmonyInstrument = null;
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

  private async fallbackToUrlCaching(): Promise<PreloadResult> {
    logger.info('Falling back to URL caching for harmony samples');

    try {
      const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);

      // Cache essential sample URLs
      const essentialNotes = [
        'A0',
        'C1',
        'Ds1',
        'Fs1',
        'A1',
        'C2',
        'Ds2',
        'Fs2',
        'A2',
        'C3',
        'Ds3',
        'Fs3',
        'A3',
        'C4',
        'Ds4',
        'Fs4',
        'A4',
        'C5',
        'Ds5',
        'Fs5',
        'A5',
        'C6',
        'Ds6',
        'Fs6',
      ];

      const { supabase } = await import('@/infrastructure/supabase/client');
      const layer = 'v10';

      for (const note of essentialNotes) {
        const url = supabase.storage
          .from('samples')
          .getPublicUrl(
            `acoustic-piano/Salamander Grand Piano V3/${layer}/${note}.mp3`,
          ).data.publicUrl;

        await GlobalSampleCache.getInstance().cacheUrl(
          `harmony-${layer}-${note}`,
          url,
        );
      }

      this.loaded = essentialNotes.length;
      this.total = essentialNotes.length;

      return {
        success: true,
        loaded: this.loaded,
        total: this.total,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        loaded: 0,
        total: 0,
      };
    }
  }
}
