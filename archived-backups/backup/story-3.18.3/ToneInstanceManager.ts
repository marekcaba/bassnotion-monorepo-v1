/**
 * ToneInstanceManager - Singleton manager for Tone.js instance
 * 
 * Ensures all components use the same Tone.js instance with the shared AudioContext.
 * This is critical for a professional DAW to prevent AudioContext mismatches.
 */

import { AudioContextManager } from './AudioContextManager';

class ToneInstanceManager {
  private static instance: ToneInstanceManager;
  private toneInstance: any = null;
  private initPromise: Promise<any> | null = null;
  private isInitialized = false;
  private instanceId: string | null = null;

  private constructor() {}

  static getInstance(): ToneInstanceManager {
    if (!ToneInstanceManager.instance) {
      ToneInstanceManager.instance = new ToneInstanceManager();
    }
    return ToneInstanceManager.instance;
  }

  /**
   * Get or create the singleton Tone.js instance
   */
  async getTone(): Promise<any> {
    if (this.toneInstance) {
      return this.toneInstance;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initializeTone();
    return this.initPromise;
  }

  /**
   * Initialize Tone.js with the shared AudioContext
   */
  private async initializeTone(): Promise<any> {
    try {
      // Get the shared AudioContext first
      const audioContextManager = AudioContextManager.getInstance();
      await audioContextManager.initialize();
      const sharedContext = audioContextManager.getContext();

      // Import Tone.js dynamically
      const Tone = await import('tone');
      
      // Set the shared context BEFORE creating any Tone objects
      Tone.setContext(sharedContext);
      
      // Configure defaults
      Tone.Transport.bpm.value = 120;
      
      // Generate unique ID for tracking
      this.instanceId = `tone-singleton-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Add tracking info
      (Tone as any).__instanceId = this.instanceId;
      (Tone as any).__sharedContext = true;
      (sharedContext as any).__contextId = `ctx-singleton-${Date.now()}`;
      
      // Store the instance
      this.toneInstance = Tone;
      this.isInitialized = true;
      
      // No longer pollute global scope - clean architecture
      
      console.log('🎚️ [ToneInstanceManager] Initialized singleton Tone.js instance', {
        instanceId: this.instanceId,
        contextId: (sharedContext as any).__contextId,
        contextState: sharedContext.state,
        sampleRate: sharedContext.sampleRate,
      });
      
      return Tone;
    } catch (error) {
      console.error('[ToneInstanceManager] Failed to initialize Tone.js:', error);
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * Get the instance ID for debugging
   */
  getInstanceId(): string | null {
    return this.instanceId;
  }

  /**
   * Check if Tone.js is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get the Transport from the singleton instance
   */
  async getTransport(): Promise<any> {
    const tone = await this.getTone();
    return tone.Transport;
  }

  /**
   * Start the audio context (requires user gesture)
   */
  async startContext(): Promise<void> {
    const tone = await this.getTone();
    const audioContextManager = AudioContextManager.getInstance();
    
    // Resume the shared context
    await audioContextManager.resume();
    
    // Start Tone.js if needed
    if (tone.context.state !== 'running') {
      await tone.start();
    }
    
    console.log('✅ [ToneInstanceManager] Audio context started', {
      contextState: tone.context.state,
      instanceId: this.instanceId,
    });
  }
}

export const toneInstanceManager = ToneInstanceManager.getInstance();