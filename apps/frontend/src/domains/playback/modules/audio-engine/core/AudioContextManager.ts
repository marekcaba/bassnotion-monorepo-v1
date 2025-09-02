/**
 * AudioContextManager - Manages Web Audio API context lifecycle
 * 
 * Responsibilities:
 * - Create and manage AudioContext instance
 * - Handle browser compatibility
 * - Manage context state (suspended/running/closed)
 * - Provide keep-alive mechanism
 * - Handle iOS-specific requirements
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import { AudioContextState, BrowserInfo, AudioEngineConfig } from '../types/index.js';

const logger = createStructuredLogger('AudioContextManager');

// Browser compatibility constants
const REQUIRED_APIS = ['AudioContext', 'AudioWorkletNode', 'Promise', 'fetch'];
const SUPPORTED_BROWSERS = {
  chrome: 66,  // AudioWorklet support
  firefox: 76, // AudioWorklet support
  safari: 14.1, // AudioWorklet support
  edge: 79,    // Chromium-based Edge
};

export class AudioContextManager {
  private static globalContext: AudioContext | null = null;
  private context: AudioContext | null = null;
  private keepAliveInterval: number | null = null;
  private stateChangeHandlers: Set<(state: AudioContextState) => void> = new Set();
  private browserInfo: BrowserInfo | null = null;

  constructor(private config: AudioEngineConfig = {}) {
    this.detectBrowserCapabilities();
  }

  /**
   * Get or create AudioContext
   */
  async getOrCreateContext(): Promise<AudioContext> {
    // Use existing global context if available
    if (AudioContextManager.globalContext && AudioContextManager.globalContext.state !== 'closed') {
      logger.info('Using existing global AudioContext', {
        state: AudioContextManager.globalContext.state,
        sampleRate: AudioContextManager.globalContext.sampleRate,
      });
      
      this.context = AudioContextManager.globalContext;
      
      // Resume if suspended
      if (this.context.state === 'suspended') {
        await this.resume();
      }
      
      return this.context;
    }

    // Create new context
    logger.info('Creating new AudioContext');
    this.context = await this.createOptimalAudioContext();
    
    // Store as global context
    AudioContextManager.globalContext = this.context;
    
    // Also store on window for absolute persistence
    if (typeof window !== 'undefined') {
      (window as any).__persistentAudioContext = this.context;
    }
    
    // Setup state change handling
    this.setupStateChangeHandling();
    
    // Start keep-alive
    this.startKeepAlive();
    
    return this.context;
  }

  /**
   * Create AudioContext with optimal settings
   */
  private async createOptimalAudioContext(): Promise<AudioContext> {
    const contextOptions: AudioContextOptions = {
      sampleRate: this.config.sampleRate || this.getOptimalSampleRate(),
      latencyHint: this.config.latencyHint || 'balanced',
    };

    try {
      // Handle Safari's webkitAudioContext
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error('AudioContext not available');
      }

      const context = new AudioContextClass(contextOptions);

      // iOS specific handling
      if (this.isIOS()) {
        logger.info('iOS detected - AudioContext will require user gesture to start');
      }

      logger.info('AudioContext created', {
        sampleRate: context.sampleRate,
        baseLatency: context.baseLatency,
        outputLatency: context.outputLatency,
        state: context.state,
      });

      return context;
    } catch (error) {
      logger.error('Failed to create AudioContext', error);
      throw error;
    }
  }

  /**
   * Resume suspended context
   */
  async resume(): Promise<void> {
    if (!this.context) {
      throw new Error('No AudioContext available');
    }

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
        logger.info('AudioContext resumed', { state: this.context.state });
      } catch (error) {
        logger.error('Failed to resume AudioContext', error);
        throw error;
      }
    }

    // Wait for context to be running (up to 5 seconds)
    const timeout = 5000;
    const startTime = Date.now();

    while (this.context.state !== 'running' && Date.now() - startTime < timeout) {
      await this.delay(100);
      
      if (this.context.state === 'suspended') {
        try {
          await this.context.resume();
        } catch {
          // Ignore errors during retry
        }
      }
    }

    if (this.context.state !== 'running') {
      throw new Error(`AudioContext failed to start. State: ${this.context.state}`);
    }
  }

  /**
   * Suspend context
   */
  async suspend(): Promise<void> {
    if (!this.context || this.context.state !== 'running') {
      return;
    }

    try {
      await this.context.suspend();
      logger.info('AudioContext suspended');
    } catch (error) {
      logger.error('Failed to suspend AudioContext', error);
      throw error;
    }
  }

  /**
   * Close context
   */
  async close(): Promise<void> {
    this.stopKeepAlive();
    
    if (this.context && this.context.state !== 'closed') {
      try {
        await this.context.close();
        logger.info('AudioContext closed');
      } catch (error) {
        logger.error('Failed to close AudioContext', error);
      }
    }
    
    // Clear references
    if (this.context === AudioContextManager.globalContext) {
      AudioContextManager.globalContext = null;
    }
    this.context = null;
  }

  /**
   * Get current context
   */
  getContext(): AudioContext | null {
    return this.context;
  }

  /**
   * Get context state
   */
  getState(): AudioContextState | null {
    return this.context ? this.context.state as AudioContextState : null;
  }

  /**
   * Add state change listener
   */
  onStateChange(handler: (state: AudioContextState) => void): void {
    this.stateChangeHandlers.add(handler);
  }

  /**
   * Remove state change listener
   */
  offStateChange(handler: (state: AudioContextState) => void): void {
    this.stateChangeHandlers.delete(handler);
  }

  /**
   * Setup context state change handling
   */
  private setupStateChangeHandling(): void {
    if (!this.context) return;

    // Check if addEventListener exists (may not in test environments)
    if (typeof this.context.addEventListener === 'function') {
      this.context.addEventListener('statechange', () => {
        const state = this.context!.state as AudioContextState;
        logger.info('AudioContext state changed', { state });
        
        // Notify listeners
        this.stateChangeHandlers.forEach(handler => handler(state));
        
        // Attempt recovery if suspended
        if (state === 'suspended') {
          this.attemptRecovery().catch(error => {
            logger.error('Failed to recover suspended context', error);
          });
        }
      });
    }
  }

  /**
   * Attempt to recover suspended context
   */
  private async attemptRecovery(): Promise<void> {
    if (!this.context || this.context.state !== 'suspended') return;
    
    logger.info('Attempting to recover suspended AudioContext');
    
    try {
      await this.resume();
      logger.info('AudioContext recovered successfully');
    } catch (error) {
      logger.error('AudioContext recovery failed', error);
      throw error;
    }
  }

  /**
   * Start keep-alive mechanism
   */
  private startKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    
    // Play silent buffer every 10 seconds to keep context active
    this.keepAliveInterval = window.setInterval(() => {
      if (this.context && this.context.state === 'running') {
        try {
          const buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
          const source = this.context.createBufferSource();
          source.buffer = buffer;
          source.connect(this.context.destination);
          source.start();
          
          logger.debug('Keep-alive: played silent buffer');
        } catch (error) {
          logger.warn('Keep-alive failed:', error);
        }
      }
    }, 10000);
  }

  /**
   * Stop keep-alive mechanism
   */
  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Detect browser capabilities
   */
  private detectBrowserCapabilities(): void {
    const info = this.detectBrowser();
    
    this.browserInfo = {
      name: info?.name || 'unknown',
      version: info?.version || 0,
      supportsAudioWorklet: 'AudioWorkletNode' in window,
      supportsWebAudio: 'AudioContext' in window || 'webkitAudioContext' in window,
    };
    
    logger.info('Browser capabilities detected', this.browserInfo);
  }

  /**
   * Check if browser is supported
   */
  isBrowserSupported(): boolean {
    if (!this.config.enableBrowserCheck) return true;
    
    // Check required APIs
    for (const api of REQUIRED_APIS) {
      if (!(api in window)) {
        logger.warn(`Required API missing: ${api}`);
        return false;
      }
    }
    
    // Check browser version
    if (!this.browserInfo) return true;
    
    const minVersion = SUPPORTED_BROWSERS[this.browserInfo.name as keyof typeof SUPPORTED_BROWSERS];
    if (minVersion && this.browserInfo.version < minVersion) {
      logger.warn('Browser version too old', {
        browser: this.browserInfo.name,
        version: this.browserInfo.version,
        minVersion,
      });
      return false;
    }
    
    return true;
  }

  /**
   * Get browser info
   */
  getBrowserInfo(): BrowserInfo | null {
    return this.browserInfo;
  }

  /**
   * Detect browser and version
   */
  private detectBrowser(): { name: string; version: number } | null {
    const ua = navigator.userAgent.toLowerCase();

    if (ua.includes('chrome') && !ua.includes('edg')) {
      const match = ua.match(/chrome\/(\d+)/);
      return match ? { name: 'chrome', version: parseInt(match[1]) } : null;
    }

    if (ua.includes('firefox')) {
      const match = ua.match(/firefox\/(\d+)/);
      return match ? { name: 'firefox', version: parseInt(match[1]) } : null;
    }

    if (ua.includes('safari') && !ua.includes('chrome')) {
      const match = ua.match(/version\/(\d+)/);
      return match ? { name: 'safari', version: parseInt(match[1]) } : null;
    }

    if (ua.includes('edg')) {
      const match = ua.match(/edg\/(\d+)/);
      return match ? { name: 'edge', version: parseInt(match[1]) } : null;
    }

    return null;
  }

  /**
   * Check if running on iOS
   */
  private isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }

  /**
   * Get optimal sample rate
   */
  private getOptimalSampleRate(): number {
    if (this.config.sampleRate) return this.config.sampleRate;
    
    // Use browser default for best compatibility
    const tempContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = tempContext.sampleRate;
    tempContext.close();
    
    return sampleRate;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}