/**
 * ToneProvider
 *
 * Provides a centralized Tone.js instance to ensure all components use the same
 * Transport and AudioContext. This prevents issues with multiple Tone.js instances
 * where Transport.start() in one instance doesn't affect loops in another.
 *
 * Updated to use shared AudioContext from AudioContextManager for DAW-grade audio.
 */

import { logInfo, logError, logDebug } from '../utils/logger';
import { AudioContextManager } from './AudioContextManager';

let toneInstance: typeof import('tone') | null = null;
let initializationPromise: Promise<typeof import('tone')> | null = null;

// Get singleton AudioContextManager
const audioContextManager = AudioContextManager.getInstance();

export class ToneProvider {
  /**
   * Get the shared Tone.js instance
   * This ensures all components use the same Transport
   */
  public static async getTone(): Promise<typeof import('tone')> {
    // If already initialized, return the instance
    if (toneInstance) {
      return toneInstance;
    }

    // If initialization is in progress, wait for it
    if (initializationPromise) {
      return initializationPromise;
    }

    // Start initialization
    initializationPromise = (async () => {
      try {
        // Initialize AudioContextManager first
        await audioContextManager.initialize();
        const sharedContext = audioContextManager.getContext();

        // Dynamic import to avoid SSR issues
        const Tone = await import('tone');

        // Set Tone.js to use the shared AudioContext
        Tone.setContext(sharedContext);

        toneInstance = Tone;

        logInfo(
          '🎵 ToneProvider',
          'Tone.js initialized with shared AudioContext',
          {
            sampleRate: sharedContext.sampleRate,
            latency: sharedContext.baseLatency,
            state: sharedContext.state,
          },
        );
        logDebug('🎵 ToneProvider', 'Transport instance:', Tone.getTransport());

        return Tone;
      } catch (error) {
        logError('🎵 ToneProvider', 'Failed to load Tone.js:', error);
        initializationPromise = null;
        throw error;
      }
    })();

    return initializationPromise;
  }

  /**
   * Get the Transport directly (for convenience)
   */
  public static async getTransport() {
    const Tone = await this.getTone();
    return Tone.getTransport();
  }

  /**
   * Start the audio context (requires user gesture)
   */
  public static async start() {
    // Use AudioContextManager to resume the shared context
    await audioContextManager.resume();
  }

  /**
   * Check if Tone.js is loaded
   */
  public static isLoaded(): boolean {
    return toneInstance !== null;
  }
}
