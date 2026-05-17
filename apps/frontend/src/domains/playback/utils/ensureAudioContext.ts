/**
 * Utility to ensure AudioContext is initialized before audio operations
 * Handles user gesture requirements for browser security
 */

import {
  getPersistentAudioContext,
  getOrCreatePersistentAudioContext,
  ensureToneUsesPersistentContext,
} from './audioContext.js';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { createStructuredLogger } from '@bassnotion/contracts';
import { WindowRegistry } from '../services/WindowRegistry.js';

// Helper to get Tone from window (must be initialized before these functions are used)
function getTone(): any {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error(
    'ensureAudioContext: Tone.js not loaded. Ensure AudioEngine is initialized first.',
  );
}

const logger = createStructuredLogger('ensureAudioContext');

/**
 * Ensures the AudioContext is initialized and running
 * Can be called from any user interaction (button click, etc.)
 *
 * @returns Promise that resolves when AudioContext is ready
 */
export async function ensureAudioContext(): Promise<void> {
  try {
    // First try to get or create persistent context
    const persistentContext = await getOrCreatePersistentAudioContext();

    // Ensure Tone.js uses the persistent context
    ensureToneUsesPersistentContext();

    // Get global services using WindowRegistry
    // ✅ FIX: Use WindowRegistry instead of direct window access
    const globalServices = WindowRegistry.getCoreServices();

    if (!globalServices) {
      logger.warn('ensureAudioContext: Global audio services not found');
      // Still ensure Tone is started with persistent context
      if (persistentContext.state === 'suspended') {
        await persistentContext.resume();
      }
      const Tone = getTone();
      if (Tone.context.state === 'suspended') {
        await Tone.start();
      }
      return;
    }

    // Get the audio engine
    const audioEngine = globalServices.getAudioEngine?.();

    if (!audioEngine) {
      logger.warn('ensureAudioContext: AudioEngine not found');
      // Still ensure Tone is started with persistent context
      if (persistentContext.state === 'suspended') {
        await persistentContext.resume();
      }
      const Tone = getTone();
      if (Tone.context.state === 'suspended') {
        await Tone.start();
      }
      return;
    }

    // Check if AudioEngine is initialized
    if (!audioEngine.isReady()) {
      logger.info('ensureAudioContext: AudioEngine not ready, initializing...');
      await audioEngine.initialize();
    }

    // Get Tone instance from AudioEngine with fallback
    let ToneFromEngine;
    try {
      ToneFromEngine = audioEngine.getTone();
    } catch (error) {
      logger.warn(
        'ensureAudioContext: AudioEngine.getTone() failed, using window.Tone fallback',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      ToneFromEngine = window.Tone;
    }

    if (ToneFromEngine && ToneFromEngine.context.state === 'suspended') {
      logger.info('ensureAudioContext: Starting audio context...');
      await ToneFromEngine.start();
      logger.info('ensureAudioContext: Audio context started successfully');
    }

    // Only initialize services if explicitly needed (not for simple audio tests)
    // This was causing ALL instruments to load when just testing metronome
    const shouldFullyInitialize = (
      window as { __ensureAudioContextFullInit?: boolean }
    ).__ensureAudioContextFullInit;

    if (shouldFullyInitialize && !globalServices.isReady()) {
      logger.info(
        'ensureAudioContext: CoreServices not fully initialized, initializing...',
      );
      await globalServices.initialize();
      logger.info('ensureAudioContext: CoreServices initialized successfully');
    }

    // Don't start services here - they should already be running
    // Just ensure audio context is resumed

    // Dispatch event to notify components
    window.dispatchEvent(new Event('audioContextStarted'));
  } catch (error) {
    logger.error(
      'ensureAudioContext: Failed to initialize audio context:',
      error,
    );
    throw error;
  }
}

/**
 * Check if AudioContext is currently available and running
 */
export function isAudioContextReady(): boolean {
  try {
    // ✅ FIX: Use WindowRegistry instead of direct window access
    const globalServices = WindowRegistry.getCoreServices();

    if (!globalServices) {
      return false;
    }

    const audioEngine = globalServices.getAudioEngine?.();

    if (!audioEngine || !audioEngine.isReady()) {
      return false;
    }

    const ToneFromEngine = audioEngine.getTone();

    return ToneFromEngine && ToneFromEngine.context.state === 'running';
  } catch {
    return false;
  }
}

/**
 * Lightweight audio context initialization - only starts audio without loading all instruments
 * Use this for simple audio tests like metronome clicks
 */
export async function ensureAudioContextLightweight(): Promise<void> {
  try {
    logger.info('ensureAudioContextLightweight: Called');

    // First ensure we have persistent context
    const persistentContext = await getOrCreatePersistentAudioContext();

    // Ensure Tone.js uses the persistent context
    ensureToneUsesPersistentContext();

    // First check if everything is already initialized
    // ✅ FIX: Use WindowRegistry instead of direct window access
    const globalServices = WindowRegistry.getCoreServices();

    // Get Tone once for this function
    const Tone = getTone();

    if (globalServices) {
      const audioEngine = globalServices.getAudioEngine?.();
      logger.info('ensureAudioContextLightweight: Global services check', {
        hasGlobalServices: !!globalServices,
        hasAudioEngine: !!audioEngine,
        isAudioEngineReady: audioEngine?.isReady?.(),
        toneContextState: Tone.context.state,
        servicesReady: globalServices.isReady?.(),
        persistentContextState: persistentContext.state,
      });

      if (
        audioEngine &&
        audioEngine.isReady() &&
        persistentContext.state === 'running'
      ) {
        logger.info(
          'ensureAudioContextLightweight: Audio already fully initialized, skipping all initialization',
        );
        // Dispatch event even if already started
        window.dispatchEvent(new Event('audioContextStarted'));
        return;
      }
    }

    // Ensure persistent context is running
    if (persistentContext.state === 'suspended') {
      logger.info(
        'ensureAudioContextLightweight: Resuming persistent context...',
      );
      await persistentContext.resume();
    }

    // Just ensure Tone.js audio context is started
    if (Tone.context.state === 'suspended') {
      logger.info(
        'ensureAudioContextLightweight: Starting Tone.js audio context...',
      );
      await Tone.start();
      logger.info('ensureAudioContextLightweight: Audio context started');
    }

    // Only initialize AudioEngine if it exists but isn't ready
    if (globalServices) {
      const audioEngine = globalServices.getAudioEngine?.();
      if (audioEngine && !audioEngine.isReady()) {
        logger.info(
          'ensureAudioContextLightweight: AudioEngine exists but not ready, initializing...',
        );
        await audioEngine.initialize();
        logger.info('ensureAudioContextLightweight: AudioEngine initialized');
      } else if (audioEngine && audioEngine.isReady()) {
        logger.info('ensureAudioContextLightweight: AudioEngine already ready');
      }
    }

    // Dispatch event to notify components
    window.dispatchEvent(new Event('audioContextStarted'));
  } catch (error) {
    logger.error('ensureAudioContextLightweight: Failed:', error);
    // Fallback to just starting Tone
    try {
      const ToneFallback = getTone();
      if (ToneFallback.context.state === 'suspended') {
        await ToneFallback.start();
      }
    } catch {
      // Tone not available, nothing we can do
    }
  }
}

/**
 * Higher-order function to wrap click handlers with audio context initialization
 *
 * @param handler The original click handler
 * @param options Options for initialization
 * @returns Wrapped handler that ensures audio context before executing
 */
export function withAudioContext<T extends (...args: any[]) => any>(
  handler: T,
  options?: { lightweight?: boolean },
): T {
  return (async (...args: Parameters<T>) => {
    if (options?.lightweight) {
      await ensureAudioContextLightweight();
    } else {
      await ensureAudioContext();
    }
    return handler(...args);
  }) as T;
}
