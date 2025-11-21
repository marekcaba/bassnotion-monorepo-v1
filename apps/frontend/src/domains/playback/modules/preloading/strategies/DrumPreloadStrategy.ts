/**
 * Drum Preload Strategy
 *
 * Handles preloading of drum samples
 */

import { PreloadStrategy } from './PreloadStrategy.js';
import { PreloadConfig, PreloadResult } from '../types/index.js';
import { GlobalSampleCache } from '../../storage/cache/GlobalSampleCache.js';
import { wamPluginSingleton } from '@/domains/widgets/utils/wamPluginSingleton.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('DrumPreloadStrategy');

export class DrumPreloadStrategy implements PreloadStrategy {
  readonly name = 'drums';
  private drumInstrument: any = null;
  private loaded = 0;
  private total = 0;

  private readonly drumConfig = [
    { pad: 0, file: 'kick', name: 'Kick' },
    { pad: 1, file: 'snare', name: 'Snare' },
    { pad: 2, file: 'hi-hat', name: 'Hi-Hat' },
    { pad: 3, file: 'crash', name: 'Crash' },
    { pad: 4, file: 'tom-1', name: 'Tom 1' },
    { pad: 5, file: 'tom-2', name: 'Tom 2' },
    { pad: 6, file: 'ride', name: 'Ride' },
    { pad: 7, file: 'open-hat', name: 'Open Hat' },
    { pad: 8, file: 'floor-tom', name: 'Floor Tom' },
  ];

  async loadEssentialSamples(_config?: PreloadConfig): Promise<PreloadResult> {
    logger.info('Loading essential drum samples...');

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

      // Create WamDrummer instance through singleton
      this.drumInstrument =
        await wamPluginSingleton.getOrCreateDrummerPlugin(context);

      // Connect to destination if needed
      if (
        this.drumInstrument.audioNode &&
        !this.drumInstrument.audioNode.isConnected
      ) {
        this.drumInstrument.audioNode.connect(context.destination);
      }

      // Store in global cache
      GlobalSampleCache.getInstance().cacheInstrument(
        'drums-preloaded',
        this.drumInstrument,
      );

      // Essential drums count
      this.loaded = this.drumConfig.length;
      this.total = this.drumConfig.length;

      logger.info('Essential drum samples loaded');

      return {
        success: true,
        loaded: this.loaded,
        total: this.total,
      };
    } catch (error) {
      logger.error('Failed to load essential drum samples', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        loaded: 0,
        total: 0,
      };
    }
  }

  async loadFullSamples(_config?: PreloadConfig): Promise<PreloadResult> {
    logger.info('Loading full drum samples...');

    try {
      // Currently, all drum samples are loaded in the essential phase
      // This could be extended to load additional drum kits or variations

      return {
        success: true,
        loaded: this.loaded,
        total: this.total,
      };
    } catch (error) {
      logger.error('Failed to load full drum samples', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        loaded: this.loaded,
        total: this.total,
      };
    }
  }

  async clear(): Promise<void> {
    this.drumInstrument = null;
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
    const startTime = performance.now();
    logger.info('📥 Falling back to buffer preloading for drum samples (AudioEngine not ready)');

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL not configured');
      }

      // Create offline context for decoding
      const offlineContext = new OfflineAudioContext(2, 44100, 44100);

      // Load only the 3 essential drum samples (kick, snare, hihat)
      const essentialDrums = [
        { key: 'kick', pad: 1, file: 'kick-v1.wav' },
        { key: 'snare', pad: 3, file: 'snare-v1.wav' },
        { key: 'hihat', pad: 5, file: 'hihat-v1.wav' },
      ];

      logger.info('📥 Loading essential drum samples:', {
        count: essentialDrums.length,
        drums: essentialDrums.map(d => d.key),
      });

      for (const drum of essentialDrums) {
        const kitPath = 'drums/hydrogen-kits/colombo-acoustic';
        const url = `${supabaseUrl}/storage/v1/object/public/audio-samples/${kitPath}/${drum.file}`;

        logger.info(`📥 Fetching ${drum.key}...`);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${drum.key}: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);

        // Cache with multiple keys for compatibility
        GlobalSampleCache.getInstance().cacheBuffer(`drum-${drum.key}`, audioBuffer);
        GlobalSampleCache.getInstance().cacheBuffer(`drum-pad-${drum.pad}`, audioBuffer);

        logger.info(`✅ ${drum.key} cached`);
      }

      this.loaded = essentialDrums.length;
      this.total = essentialDrums.length;

      const duration = performance.now() - startTime;
      logger.info('✅ Essential drum samples preloaded as AudioBuffers', {
        duration: `${duration.toFixed(2)}ms`,
        samplesLoaded: essentialDrums.length,
        averagePerSample: `${(duration / essentialDrums.length).toFixed(2)}ms`,
        drums: essentialDrums.map(d => d.key),
      });

      return {
        success: true,
        loaded: this.loaded,
        total: this.total,
      };
    } catch (error) {
      logger.error('Failed to preload drum samples:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        loaded: 0,
        total: 0,
      };
    }
  }
}
