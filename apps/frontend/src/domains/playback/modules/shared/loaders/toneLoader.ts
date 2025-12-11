/**
 * Centralized Tone.js loader for all instrument plugins
 * Story 3.18.3: Updated to use CoreServices from window
 * Ensures all plugins use the same global Tone instance and AudioContext
 */

import { getAudioArchitectureFlags } from '@/domains/playback/config/featureFlags';
import { createStructuredLogger } from '../index.js';

const logger = createStructuredLogger('toneLoader');

/**
 * Get the global Tone.js instance, waiting if necessary
 * @param preferredContext - Optional AudioContext to use instead of default
 * @param audioEngine - Optional AudioEngine instance for dependency injection
 * @returns Promise<Tone> The global Tone.js instance
 */
export async function loadGlobalTone(
  preferredContext?: AudioContext,
  audioEngine?: any,
): Promise<any> {
  const flags = getAudioArchitectureFlags();

  // If we have a preferred context and Tone is available, just return Tone
  // DON'T switch contexts - this causes buffer invalidation issues
  if (preferredContext && (window as any).Tone) {
    const Tone = (window as any).Tone;
    logger.info(
      '🎵 toneLoader: Using shared AudioContext, not switching Tone.js context',
    );
    return Tone;
  }

  // If audioEngine is provided (dependency injection), use it directly
  if (audioEngine) {
    try {
      const tone = audioEngine.getTone();

      // If we have a preferred context, just log but don't switch
      // DON'T switch contexts - this causes buffer invalidation issues
      if (
        preferredContext &&
        tone &&
        tone.context._context !== preferredContext
      ) {
        logger.info(
          '🎵 toneLoader: Preferred context provided but NOT switching to avoid buffer invalidation',
        );
      }

      if (flags.ENABLE_MIGRATION_MONITORING) {
        logger.info(
          '🎵 toneLoader: Got Tone instance from injected AudioEngine',
          {
            contextState: tone.context.state,
          },
        );
      }

      return tone;
    } catch (error) {
      // AudioEngine not initialized yet - fallback to window.Tone
      logger.warn(
        '🎵 toneLoader: AudioEngine not initialized (injected), falling back to window.Tone',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      // Fall through to other methods below
    }
  }

  // Use CoreServices if available (new approach)
  const coreServices =
    (window as any).__coreServices || (window as any).__globalCoreServices;

  if (coreServices?.getAudioEngine) {
    try {
      const audioEngine = coreServices.getAudioEngine();
      const tone = audioEngine.getTone();

      if (flags.ENABLE_MIGRATION_MONITORING) {
        logger.info('🎵 toneLoader: Got Tone instance from AudioEngine', {
          contextState: tone.context.state,
        });
      }

      return tone;
    } catch (error) {
      // AudioEngine not initialized yet - fallback to window.Tone
      logger.warn(
        '🎵 toneLoader: AudioEngine not initialized (CoreServices), falling back to window.Tone',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      // Fall through to window.Tone below
    }
  }

  // Fallback: Try to get from window.Tone
  if ((window as any).Tone) {
    const tone = (window as any).Tone;

    if (flags.ENABLE_MIGRATION_MONITORING) {
      logger.info('🎵 toneLoader: Using window.Tone as fallback', {
        contextState: tone.context.state,
      });
    }

    return tone;
  }

  // No CoreServices available - error
  throw new Error(
    'CoreServices not found on window. Make sure AudioProvider is mounted.',
  );
}

/**
 * Get Tone.js instance synchronously (for components that need immediate access)
 * @returns Tone instance or null if not available
 */
export function getToneSync(): any {
  // Try CoreServices first
  const coreServices =
    (window as any).__coreServices || (window as any).__globalCoreServices;

  if (coreServices?.getAudioEngine) {
    try {
      const audioEngine = coreServices.getAudioEngine();
      return audioEngine.getTone();
    } catch (error) {
      logger.warn('🎵 toneLoader: Failed to get Tone from CoreServices', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to window.Tone
  return (window as any).Tone || null;
}
