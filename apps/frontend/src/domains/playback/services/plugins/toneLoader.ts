/**
 * Centralized Tone.js loader for all instrument plugins
 * Story 3.18.3: Updated to use CoreServices from window
 * Ensures all plugins use the same global Tone instance and AudioContext
 */

import { getAudioArchitectureFlags } from '@/domains/playback/config/featureFlags';
import { createStructuredLogger } from '@bassnotion/contracts';
import { audioContextManager } from '../../utils/contextManager.js';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

/**
 * Get the global Tone.js instance, waiting if necessary
 * @param preferredContext - Optional AudioContext to use instead of default
 * @returns Promise<Tone> The global Tone.js instance
 */
export async function loadGlobalTone(
  preferredContext?: AudioContext,
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

  // Epic 3.18: Get CoreServices from window (set by AudioProvider)
  const coreServices = (window as any).__coreServices;

  if (!coreServices) {
    // Wait a bit for CoreServices to be available
    await new Promise((resolve) => setTimeout(resolve, 100));
    const coreServicesRetry = (window as any).__coreServices;
    if (!coreServicesRetry) {
      throw new Error(
        'CoreServices not found on window. Make sure AudioProvider is mounted.',
      );
    }
    return loadGlobalTone(preferredContext); // Retry
  }

  const audioEngine = coreServices.getAudioEngine();

  if (!audioEngine) {
    throw new Error('AudioEngine not found in CoreServices');
  }

  const tone = audioEngine.getTone();

  // If we have a preferred context, just log but don't switch
  // DON'T switch contexts - this causes buffer invalidation issues
  if (preferredContext && tone && tone.context._context !== preferredContext) {
    logger.info(
      '🎵 toneLoader: Preferred context provided but NOT switching to avoid buffer invalidation',
    );
  }

  if (flags.ENABLE_MIGRATION_MONITORING) {
    logger.info('🎵 toneLoader: Got Tone instance from AudioEngine', {
      contextState: tone.context.state,
    });
  }

  return tone;
}

/**
 * Verify that two Tone instances share the same context
 */
export function verifyToneContext(tone1: any, tone2: any): boolean {
  if (!tone1 || !tone2) return false;
  return tone1.context === tone2.context;
}

/**
 * Reset the cached Tone instance (useful for testing)
 */
export function resetToneCache(): void {
  // No-op since we're using the singleton manager
  // The singleton manager handles caching internally
}
