/**
 * Audio Context Manager
 *
 * Monitors Tone.js AudioContext changes and clears cached buffers
 * when the context changes to prevent decoding errors.
 */

import * as Tone from 'tone';
import { GlobalSampleCache } from '../services/storage/GlobalSampleCache.js';
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
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    logger.info('Starting AudioContext monitoring');
    this.isMonitoring = true;

    // Check context periodically
    this.checkContext();

    // Set up periodic check (every 500ms)
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
   */
  checkAndClearIfNeeded(): void {
    this.checkContext();
  }
}

export const audioContextManager = AudioContextManager.getInstance();
