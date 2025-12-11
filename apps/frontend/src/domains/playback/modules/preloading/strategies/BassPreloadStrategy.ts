/**
 * Bass Preload Strategy
 *
 * Handles preloading of bass samples using FAANG MIDI-based smart loading
 * Only loads samples for notes actually used in the exercise's bassline MIDI file
 */

import { PreloadStrategy } from './PreloadStrategy.js';
import { PreloadConfig, PreloadResult } from '../types/index.js';
import { GlobalSampleCache } from '../../storage/cache/GlobalSampleCache.js';
import { getLogger } from '@/utils/logger.js';
import { extractNotesFromBasslineMidi } from '../../../utils/basslineNoteExtractor.js';
import type { Exercise } from '@bassnotion/contracts';

const logger = getLogger('BassPreloadStrategy');

export class BassPreloadStrategy implements PreloadStrategy {
  readonly name = 'bass';
  private bassInstrument: any = null;
  private loaded = 0;
  private total = 0;

  async loadEssentialSamples(_config?: PreloadConfig): Promise<PreloadResult> {
    logger.info('Loading essential bass samples...');

    try {
      // For bass, essential samples are typically not needed in Phase 2
      // Bass loading is exercise-specific and happens in Phase 3 (loadFullSamples)
      logger.info(
        '✅ Skipping essential bass samples - will load on-demand in Phase 3',
      );

      return {
        success: true,
        loaded: 0,
        total: 0,
      };
    } catch (error) {
      logger.error('Failed to load essential bass samples', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        loaded: 0,
        total: 0,
      };
    }
  }

  async loadFullSamples(
    _config?: PreloadConfig,
    exercise?: Exercise,
  ): Promise<PreloadResult> {
    logger.info('🎸 FAANG MIDI-based bass sample loading...', {
      exerciseId: exercise?.id,
      exerciseTitle: exercise?.title,
      hasBasslineMidi: !!exercise?.basslineMidiUrl,
    });

    try {
      // FAANG SOLUTION: Load ONLY samples needed for this exercise's bassline MIDI file
      // No exercise or no MIDI file = no samples loaded
      if (!exercise?.basslineMidiUrl) {
        logger.info('✅ No bassline MIDI file - skipping bass sample loading', {
          exerciseId: exercise?.id,
          reason: exercise ? 'no basslineMidiUrl' : 'no exercise provided',
        });

        return {
          success: true,
          loaded: 0,
          total: 0,
        };
      }

      // 1. Extract unique notes from bassline MIDI file
      const requiredNotes = await extractNotesFromBasslineMidi(
        exercise.basslineMidiUrl,
      );

      if (requiredNotes.length === 0) {
        logger.warn(
          '⚠️ Bassline MIDI file contains no notes - skipping sample loading',
          {
            midiUrl: exercise.basslineMidiUrl,
          },
        );

        return {
          success: true,
          loaded: 0,
          total: 0,
        };
      }

      logger.info(
        '📊 Bassline MIDI analysis complete - loading exercise-specific samples',
        {
          uniqueNotes: requiredNotes.length,
          noteRange: `${requiredNotes[0]} to ${requiredNotes[requiredNotes.length - 1]}`,
          totalSamplesToLoad: requiredNotes.length,
          savedSamples: 24 - requiredNotes.length, // vs loading all 24 bass notes
          savingsPercentage: `${Math.round((1 - requiredNotes.length / 24) * 100)}%`,
        },
      );

      // 2. Check if CoreServices and AudioEngine are available
      const coreServices =
        (window as any).__globalCoreServices || (window as any).__coreServices;

      if (!coreServices) {
        logger.warn(
          'CoreServices not available - bass samples will load on widget initialization',
        );
        return {
          success: true,
          loaded: 0,
          total: requiredNotes.length,
          metadata: { requiredNotes }, // Pass notes to widget for later use
        };
      }

      const audioEngine = coreServices.getAudioEngine?.();
      if (!audioEngine || !audioEngine.isReady()) {
        logger.warn(
          'AudioEngine not ready - bass samples will load on widget initialization',
        );
        return {
          success: true,
          loaded: 0,
          total: requiredNotes.length,
          metadata: { requiredNotes },
        };
      }

      const context = audioEngine.getContext();
      if (!context || context.state !== 'running') {
        logger.warn(
          'AudioContext not running - bass samples will load on widget initialization',
        );
        return {
          success: true,
          loaded: 0,
          total: requiredNotes.length,
          metadata: { requiredNotes },
        };
      }

      // 3. Store required notes metadata for BassLineWidget to use
      // The widget will load only these specific samples when it initializes
      GlobalSampleCache.getInstance().cacheMetadata('bass-required-notes', {
        exerciseId: exercise.id,
        requiredNotes,
        noteCount: requiredNotes.length,
        midiUrl: exercise.basslineMidiUrl,
      });

      logger.info('✅ Bass sample metadata cached for widget initialization', {
        requiredNotes: requiredNotes.join(', '),
        cacheKey: 'bass-required-notes',
      });

      // 4. Mark progress
      const totalToLoad = requiredNotes.length;
      this.total = totalToLoad;
      this.loaded = totalToLoad; // Metadata is ready, widget will handle actual loading

      logger.info('✅ Exercise-specific bass samples prepared', {
        loaded: this.loaded,
        total: this.total,
        savingsVsFullLoad: `${Math.round((1 - this.loaded / 24) * 100)}%`,
      });

      return {
        success: true,
        loaded: this.loaded,
        total: this.total,
        metadata: { requiredNotes },
      };
    } catch (error) {
      logger.error('❌ Failed to load MIDI-based bass samples', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        loaded: 0,
        total: 0,
      };
    }
  }

  async clear(): Promise<void> {
    this.bassInstrument = null;
    this.loaded = 0;
    this.total = 0;

    // Clear cached metadata
    GlobalSampleCache.getInstance().clearMetadata('bass-required-notes');
  }

  getProgress() {
    return {
      loaded: this.loaded,
      total: this.total,
      progress: this.total > 0 ? this.loaded / this.total : 0,
    };
  }
}
