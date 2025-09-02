/**
 * ToneWrapper - Abstraction layer for Tone.js
 * 
 * Responsibilities:
 * - Load and initialize Tone.js
 * - Provide type-safe access to Tone.js functionality
 * - Handle Tone.js context synchronization
 * - Abstract Tone.js-specific APIs
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import { ToneModule, SamplerConfig, AudioSampler } from '../types/index.js';

const logger = createStructuredLogger('ToneWrapper');

// Global Tone.js storage
declare global {
  interface Window {
    __globalTone?: ToneModule | null;
  }
}

export class ToneWrapper {
  private static instance: ToneWrapper | null = null;
  private tone: ToneModule | null = null;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;
  
  // Selective loading support
  private loadedModules = new Map<string, any>();
  private useSelectiveLoading = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ToneWrapper {
    if (!ToneWrapper.instance) {
      ToneWrapper.instance = new ToneWrapper();
    }
    return ToneWrapper.instance;
  }

  /**
   * Enable selective loading for bundle optimization
   */
  enableSelectiveLoading(): void {
    this.useSelectiveLoading = true;
    logger.info('Selective loading enabled for bundle optimization');
  }

  /**
   * Load Tone.js module
   */
  async load(): Promise<void> {
    // Return if already loaded
    if (this.isLoaded && this.tone) {
      logger.debug('Tone.js already loaded');
      return;
    }

    // Return existing load promise if in progress
    if (this.loadPromise) {
      logger.debug('Tone.js load already in progress');
      return this.loadPromise;
    }

    this.loadPromise = this.useSelectiveLoading 
      ? this.performSelectiveLoad()
      : this.performLoad();
    
    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  /**
   * Perform the actual Tone.js load
   */
  private async performLoad(): Promise<void> {
    // Check global storage first
    if (typeof window !== 'undefined' && window.__globalTone) {
      this.tone = window.__globalTone;
      this.isLoaded = true;
      logger.info('Tone.js loaded from global storage');
      return;
    }

    try {
      logger.info('Loading Tone.js module...');
      const toneModule = await import('tone');
      
      // Handle both default export and namespace export
      this.tone = toneModule.default || toneModule;
      
      // Verify Tone has required methods
      if (!this.tone || typeof this.tone.start !== 'function') {
        throw new Error('Invalid Tone.js module structure');
      }
      
      // Store globally for other instances
      if (typeof window !== 'undefined') {
        window.__globalTone = this.tone;
      }
      
      this.isLoaded = true;
      logger.info('Tone.js loaded successfully');
    } catch (error) {
      logger.error('Failed to load Tone.js', error);
      throw error;
    }
  }

  /**
   * Perform selective load of Tone.js modules
   */
  private async performSelectiveLoad(): Promise<void> {
    try {
      logger.info('Loading minimal Tone.js modules...');
      
      // Load only essential modules
      const [
        { Transport },
        { getContext, setContext },
        { Sampler },
        { start }
      ] = await Promise.all([
        import('tone/build/esm/core/clock/Transport.js'),
        import('tone/build/esm/core/Global.js'),
        import('tone/build/esm/instrument/Sampler.js'),
        import('tone/build/esm/core/Global.js'),
      ]);
      
      // Create minimal Tone object
      this.tone = {
        Transport,
        start,
        setContext,
        getContext,
        now: () => Transport.now(),
        context: getContext(),
        Sampler,
      } as ToneModule;
      
      // Store globally
      if (typeof window !== 'undefined') {
        window.__globalTone = this.tone;
      }
      
      this.isLoaded = true;
      logger.info('Minimal Tone.js modules loaded successfully');
    } catch (error) {
      logger.error('Failed to load minimal Tone.js modules', error);
      throw error;
    }
  }

  /**
   * Lazy load additional Tone.js modules
   */
  async loadModule(moduleName: string): Promise<any> {
    // Check cache first
    if (this.loadedModules.has(moduleName)) {
      logger.debug(`Module ${moduleName} already loaded`);
      return this.loadedModules.get(moduleName);
    }

    const moduleMap: Record<string, () => Promise<any>> = {
      Reverb: () => import('tone/build/esm/effect/Reverb.js'),
      Delay: () => import('tone/build/esm/effect/Delay.js'),
      Filter: () => import('tone/build/esm/component/Filter.js'),
      Compressor: () => import('tone/build/esm/component/dynamics/Compressor.js'),
      Distortion: () => import('tone/build/esm/effect/Distortion.js'),
      EQ3: () => import('tone/build/esm/component/channel/EQ3.js'),
      Panner: () => import('tone/build/esm/component/channel/Panner.js'),
      Volume: () => import('tone/build/esm/component/channel/Volume.js'),
      // Add more as needed
    };

    if (!moduleMap[moduleName]) {
      throw new Error(`Unknown Tone.js module: ${moduleName}`);
    }

    try {
      logger.info(`Lazy loading Tone.js module: ${moduleName}`);
      const moduleExports = await moduleMap[moduleName]();
      const module = moduleExports[moduleName] || moduleExports.default;
      
      // Cache the loaded module
      this.loadedModules.set(moduleName, module);
      
      // Also add to the main Tone object if using selective loading
      if (this.useSelectiveLoading && this.tone) {
        (this.tone as any)[moduleName] = module;
      }
      
      logger.info(`Module ${moduleName} loaded successfully`);
      return module;
    } catch (error) {
      logger.error(`Failed to load module ${moduleName}`, error);
      throw error;
    }
  }

  /**
   * Get Tone.js instance
   */
  getTone(): ToneModule {
    if (!this.isLoaded || !this.tone) {
      throw new Error('Tone.js not loaded. Call load() first.');
    }
    return this.tone;
  }

  /**
   * Initialize Tone.js with AudioContext
   */
  async initialize(audioContext: AudioContext): Promise<void> {
    const tone = this.getTone();
    
    // Set the AudioContext for Tone.js to use
    tone.setContext(audioContext);
    
    logger.info('Tone.js initialized with AudioContext', {
      sampleRate: audioContext.sampleRate,
      state: audioContext.state,
    });
  }

  /**
   * Start Tone.js (resume AudioContext)
   */
  async start(): Promise<void> {
    const tone = this.getTone();
    
    logger.debug('Starting Tone.js...');
    await tone.start();
    logger.info('Tone.js started');
  }

  /**
   * Get current time from Tone.js
   */
  now(): number {
    const tone = this.getTone();
    return tone.now();
  }

  /**
   * Create a sampler
   */
  createSampler(config: SamplerConfig): AudioSampler {
    const tone = this.getTone();
    
    logger.debug('Creating sampler', { urls: Object.keys(config.urls || {}) });
    
    const toneSampler = new tone.Sampler(config);
    
    // Wrap Tone.Sampler to match our interface
    const sampler: AudioSampler = {
      triggerAttack: (note: string, time?: number, velocity?: number) => {
        toneSampler.triggerAttack(note, time, velocity);
      },
      triggerRelease: (note: string, time?: number) => {
        toneSampler.triggerRelease(note, time);
      },
      triggerAttackRelease: (
        note: string,
        duration: number,
        time?: number,
        velocity?: number,
      ) => {
        toneSampler.triggerAttackRelease(note, duration, time, velocity);
      },
      connect: (destination: AudioNode | AudioSampler) => {
        toneSampler.connect(destination as any);
      },
      disconnect: () => {
        toneSampler.disconnect();
      },
      dispose: () => {
        toneSampler.dispose();
        logger.debug('Sampler disposed');
      },
    };
    
    return sampler;
  }

  /**
   * Get Tone.js context wrapper
   */
  getContext(): any {
    const tone = this.getTone();
    return tone.context;
  }

  /**
   * Get Tone.js Transport
   */
  getTransport(): any {
    const tone = this.getTone();
    return tone.Transport;
  }

  /**
   * Apply transport timing configuration
   */
  async applyTimingConfig(): Promise<void> {
    const tone = this.getTone();
    
    try {
      // Import and apply professional DAW timing configuration
      const { applyTransportTimingConfig } = await import(
        '@/domains/playback/config/transportTiming'
      );
      applyTransportTimingConfig(tone);
      logger.info('Applied professional transport timing configuration');
    } catch (error) {
      logger.error('Failed to apply timing configuration', error);
      throw error;
    }
  }

  /**
   * Check if Tone.js is loaded
   */
  isReady(): boolean {
    return this.isLoaded && this.tone !== null;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Clear local reference
    this.tone = null;
    this.isLoaded = false;
    
    // Note: We don't clear global storage as other instances might be using it
    logger.info('ToneWrapper disposed (global storage preserved)');
  }
}