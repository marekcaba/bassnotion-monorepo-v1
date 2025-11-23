/**
 * Audio Context Manager (DEPRECATED)
 *
 * ⚠️ DEPRECATED - BUG #4 FIX ⚠️
 *
 * This file uses POLLING-BASED context detection (500ms intervals),
 * which is inefficient and causes 500ms delays in state synchronization.
 *
 * USE INSTEAD:
 * - For React components: useAudioContext() hook (event-driven, 0ms delay)
 * - For services: AudioContextManager.onGlobalStateChange() (event-driven)
 * - For AudioEngine access: window.__globalCoreServices.getAudioEngine()
 *
 * This file will be removed in a future version.
 *
 * @deprecated Use event-driven AudioContextManager instead
 */

import * as Tone from 'tone';
import { GlobalSampleCache } from '../modules/storage/cache/GlobalSampleCache.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('context-manager');

class AudioContextManager {
  private static instance: AudioContextManager;
  private currentContext: AudioContext | null = null;
  private isMonitoring = false;

  private constructor() {}

  static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  /**
   * Start monitoring Tone.js context changes
   * @deprecated BUG #4 FIX: Use AudioContextManager.onGlobalStateChange() instead (event-driven, no polling)
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    logger.warn(
      '⚠️ DEPRECATED: contextManager.startMonitoring() uses 500ms polling. ' +
        'Use AudioContextManager.onGlobalStateChange() for event-driven updates (0ms delay).',
    );
    this.isMonitoring = true;

    // Check context periodically
    this.checkContext();

    // Set up periodic check (every 500ms) - DEPRECATED, use event-driven approach instead!
    setInterval(() => this.checkContext(), 500);
  }

  /**
   * Check if Tone.js context has changed
   */
  private checkContext(): void {
    try {
      const toneContext = Tone.context?.rawContext;

      if (!toneContext) return;

      if (this.currentContext && this.currentContext !== toneContext) {
        logger.warn('AudioContext has changed, clearing cached buffers');
        GlobalSampleCache.clearAllBuffers();
      }

      this.currentContext = toneContext;
    } catch (error) {
      logger.debug('Error checking context:', error);
    }
  }

  /**
   * Manually trigger a context check and cache clear if needed
   * @deprecated BUG #4 FIX: Use event-driven AudioContextManager.onGlobalStateChange() instead
   */
  checkAndClearIfNeeded(): void {
    logger.warn(
      '⚠️ DEPRECATED: checkAndClearIfNeeded() is polling-based. ' +
        'Use AudioContextManager.onGlobalStateChange() for event-driven updates.',
    );
    this.checkContext();
  }
}

/**
 * @deprecated BUG #4 FIX: This polling-based manager will be removed in a future version.
 *
 * USE INSTEAD:
 * - React components: useAudioContext() hook
 * - Services: AudioContextManager.onGlobalStateChange()
 * - Direct access: window.__globalCoreServices.getAudioEngine()
 */
export const audioContextManager = AudioContextManager.getInstance();
