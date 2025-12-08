/**
 * InstrumentDependencyManager
 *
 * FAANG-style lazy dependency loader for instruments.
 * Implements Service Locator pattern - each instrument independently requests dependencies.
 *
 * Key Features:
 * - Lazy loading: Only loads Tone.js when first instrument needs it
 * - Promise caching: Multiple simultaneous requests share single load
 * - Independent: No global state or CoreServices dependency
 * - Idempotent: Works on first instrument load AND subsequent loads
 *
 * Architecture Pattern: Like Spotify/Netflix audio engines
 * - First instrument load: Initializes Tone.js + AudioContext
 * - Subsequent loads: Reuses existing instances (instant)
 * - No blocking: Each instrument loads independently
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import { WindowRegistry } from './WindowRegistry.js';

const logger = createStructuredLogger('InstrumentDependencyManager');

export class InstrumentDependencyManager {
  // Promise caching - ensures only ONE load happens even with concurrent requests
  private static tonePromise: Promise<any> | null = null;
  private static audioContextPromise: Promise<AudioContext> | null = null;

  // Cached instances after successful load
  private static toneInstance: any = null;
  private static audioContextInstance: AudioContext | null = null;

  /**
   * Get Tone.js instance - loads lazily on first call
   *
   * @returns Promise<Tone.js instance>
   *
   * Fallback chain:
   * 1. Return cached instance if exists
   * 2. Check window.__globalTone (set by ToneWrapper)
   * 3. Check window.Tone (legacy)
   * 4. Try to get from CoreServices (if available)
   * 5. Dynamic import as last resort
   */
  static async getTone(): Promise<any> {
    const startTime = performance.now();

    // Return cached instance immediately
    if (this.toneInstance) {
      logger.debug('🎵 Using cached Tone.js instance');
      return this.toneInstance;
    }

    // Check if already loading - reuse promise to prevent duplicate loads
    if (this.tonePromise) {
      logger.debug('🎵 Waiting for in-progress Tone.js load...');
      return this.tonePromise;
    }

    // Start loading
    logger.info('🎵 Loading Tone.js for first time...');
    this.tonePromise = this.loadTone();

    try {
      const tone = await this.tonePromise;
      this.toneInstance = tone;
      const duration = (performance.now() - startTime).toFixed(2);
      logger.info(`✅ Tone.js loaded successfully in ${duration}ms`);
      return tone;
    } catch (error) {
      // Clear promise on error so next call can retry
      this.tonePromise = null;
      logger.error('❌ Failed to load Tone.js', error);
      throw error;
    }
  }

  /**
   * Internal: Load Tone.js with multiple fallback strategies
   */
  private static async loadTone(): Promise<any> {
    // Strategy 1: Check WindowRegistry.getTone() (set by ToneWrapper)
    const existingTone = WindowRegistry.getTone();
    if (existingTone) {
      logger.info('🎵 Found Tone.js via WindowRegistry');
      return existingTone;
    }

    // Strategy 2: Check window.Tone (legacy/manual script tag)
    if (typeof window !== 'undefined' && (window as any).Tone) {
      logger.info('🎵 Found Tone.js at window.Tone');
      return (window as any).Tone;
    }

    // Strategy 3: Try to get from CoreServices (if initialized)
    try {
      const coreServices = WindowRegistry.getCoreServices();
      if (coreServices) {
        logger.info('🎵 Attempting to get Tone.js from CoreServices...');
        const audioEngine = coreServices.getAudioEngine?.();
        if (audioEngine) {
          const tone = audioEngine.getTone?.();
          if (tone) {
            logger.info('🎵 Got Tone.js from CoreServices');
            return tone;
          }
        }
      }
    } catch (error) {
      logger.debug('🎵 CoreServices not available or not initialized yet', { error });
      // Continue to next strategy
    }

    // Strategy 4: Dynamic import as last resort
    logger.info('🎵 Loading Tone.js via dynamic import...');
    try {
      const ToneModule = await import('tone');
      const tone = ToneModule.default || ToneModule;

      // Store via WindowRegistry for compatibility with other code
      WindowRegistry.setTone(tone);
      // Keep window.Tone for legacy script tags (Strategy 2 fallback)
      if (typeof window !== 'undefined') {
        (window as any).Tone = tone;
      }

      logger.info('🎵 Tone.js dynamically imported successfully');
      return tone;
    } catch (error) {
      logger.error('❌ Dynamic import failed', error);
      throw new Error(`Failed to load Tone.js: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get AudioContext instance - creates lazily on first call
   *
   * @param preferredContext - Optional preferred AudioContext to use
   * @returns Promise<AudioContext>
   *
   * Features:
   * - Reuses persistent context if available
   * - Creates new context if needed
   * - Handles suspended state (resumes automatically)
   * - Compatible with Web Audio API security requirements
   */
  static async getAudioContext(preferredContext?: AudioContext): Promise<AudioContext> {
    const startTime = performance.now();

    // Use preferred context if provided
    if (preferredContext) {
      logger.debug('🎵 Using provided AudioContext');
      if (preferredContext.state === 'suspended') {
        logger.debug('🎵 Resuming suspended AudioContext...');
        await preferredContext.resume();
      }
      return preferredContext;
    }

    // Return cached instance immediately
    if (this.audioContextInstance) {
      logger.debug('🎵 Using cached AudioContext');
      if (this.audioContextInstance.state === 'suspended') {
        logger.debug('🎵 Resuming suspended cached AudioContext...');
        await this.audioContextInstance.resume();
      }
      return this.audioContextInstance;
    }

    // Check if already loading
    if (this.audioContextPromise) {
      logger.debug('🎵 Waiting for in-progress AudioContext creation...');
      return this.audioContextPromise;
    }

    // Start creating
    logger.info('🎵 Creating AudioContext for first time...');
    this.audioContextPromise = this.createAudioContext();

    try {
      const context = await this.audioContextPromise;
      this.audioContextInstance = context;
      const duration = (performance.now() - startTime).toFixed(2);
      logger.info(`✅ AudioContext created successfully in ${duration}ms`);
      return context;
    } catch (error) {
      // Clear promise on error so next call can retry
      this.audioContextPromise = null;
      logger.error('❌ Failed to create AudioContext', error);
      throw error;
    }
  }

  /**
   * Internal: Create AudioContext with fallback strategies
   */
  private static async createAudioContext(): Promise<AudioContext> {
    // Strategy 1: Check for persistent context (set by app)
    if (typeof window !== 'undefined' && (window as any).__persistentAudioContext) {
      logger.info('🎵 Found persistent AudioContext');
      const context = (window as any).__persistentAudioContext;
      if (context.state === 'suspended') {
        await context.resume();
      }
      return context;
    }

    // Strategy 2: Get from CoreServices (if available)
    try {
      const coreServices = WindowRegistry.getCoreServices();
      if (coreServices) {
        logger.info('🎵 Attempting to get AudioContext from CoreServices...');
        const audioEngine = coreServices.getAudioEngine?.();
        if (audioEngine) {
          const context = audioEngine.getContext?.();
          if (context) {
            logger.info('🎵 Got AudioContext from CoreServices');
            if (context.state === 'suspended') {
              await context.resume();
            }
            return context;
          }
        }
      }
    } catch (error) {
      logger.debug('🎵 CoreServices not available or not initialized yet', { error });
      // Continue to next strategy
    }

    // Strategy 3: Get from Tone.js (if loaded)
    try {
      const tone = await this.getTone();
      if (tone && tone.context) {
        logger.info('🎵 Using AudioContext from Tone.js');
        const context = tone.context.rawContext || tone.context;
        if (context.state === 'suspended') {
          await context.resume();
        }
        return context;
      }
    } catch (error) {
      logger.debug('🎵 Could not get context from Tone.js', { error });
      // Continue to next strategy
    }

    // Strategy 4: Create new AudioContext
    logger.info('🎵 Creating new AudioContext...');
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('AudioContext not supported in this browser');
    }

    const context = new AudioContextClass();

    // Resume if suspended (required by some browsers after user interaction)
    if (context.state === 'suspended') {
      logger.debug('🎵 Resuming newly created AudioContext...');
      await context.resume();
    }

    // Store as persistent context for future use
    if (typeof window !== 'undefined') {
      (window as any).__persistentAudioContext = context;
    }

    return context;
  }

  /**
   * Check if Tone.js is already loaded (non-blocking check)
   */
  static isToneLoaded(): boolean {
    return this.toneInstance !== null ||
           (typeof window !== 'undefined' && (
             !!WindowRegistry.getTone() ||
             !!(window as any).Tone
           ));
  }

  /**
   * Check if AudioContext is already created (non-blocking check)
   */
  static isAudioContextReady(): boolean {
    return this.audioContextInstance !== null ||
           (typeof window !== 'undefined' && !!(window as any).__persistentAudioContext);
  }

  /**
   * Reset cached instances (for testing or cleanup)
   */
  static reset(): void {
    logger.info('🔄 Resetting InstrumentDependencyManager');
    this.tonePromise = null;
    this.audioContextPromise = null;
    this.toneInstance = null;
    this.audioContextInstance = null;
  }

  /**
   * Get status for debugging
   */
  static getStatus(): {
    toneLoaded: boolean;
    audioContextReady: boolean;
    loading: boolean;
  } {
    return {
      toneLoaded: this.isToneLoaded(),
      audioContextReady: this.isAudioContextReady(),
      loading: this.tonePromise !== null || this.audioContextPromise !== null,
    };
  }
}
