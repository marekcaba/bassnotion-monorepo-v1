/**
 * ToneWrapper - Abstraction layer for Tone.js
 *
 * Responsibilities:
 * - Load and initialize Tone.js
 * - Provide type-safe access to Tone.js functionality
 * - Handle Tone.js context synchronization
 * - Abstract Tone.js-specific APIs
 */

import { createStructuredLogger } from '../../shared/index.js';
import {
  ToneModule,
  SamplerConfig,
  AudioSampler,
  ToneGain,
  ToneEQ3,
  ToneCompressor,
  ToneFilter,
  TonePanner,
  ToneVolume,
  ToneMeter,
  ToneAnalyser,
  ToneReverb,
  ToneDelay,
  ToneDistortion,
  ToneGate,
  ToneLimiter,
  ToneSynth,
  ToneMonoSynth,
  ToneNoiseSynth,
  ToneMembraneSynth,
  TonePlayer,
  ToneOscillator,
  ToneAmplitudeEnvelope,
  ToneSequence,
  ToneTransport,
  ToneAudioNode,
} from '../types/index.js';

const logger = createStructuredLogger('ToneWrapper');

export class ToneWrapper {
  private static instance: ToneWrapper | null = null;
  private tone: ToneModule | null = null;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  // Selective loading support
  private loadedModules = new Map<string, unknown>();
  private useSelectiveLoading = false;

  // Private constructor for singleton pattern
  private constructor() {
    // Intentionally empty
  }

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
      this.tone = window.__globalTone as ToneModule;
      this.isLoaded = true;
      logger.info('Tone.js loaded from global storage');
      return;
    }

    try {
      logger.info('Loading Tone.js module...');
      const toneModule = await import('tone');

      // Handle both default export and namespace export
      // Tone.js exports match our ToneModule interface
      const loadedTone =
        (toneModule as unknown as { default?: ToneModule }).default ||
        (toneModule as unknown as ToneModule);
      this.tone = loadedTone;

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
      logger.error('Failed to load Tone.js', error as Error);
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
        transportModule,
        { getContext, setContext },
        { Sampler },
        { start },
      ] = await Promise.all([
        import('tone/build/esm/core/clock/Transport.js'),
        import('tone/build/esm/core/Global.js'),
        import('tone/build/esm/instrument/Sampler.js'),
        import('tone/build/esm/core/Global.js'),
      ]);

      // Extract Transport (it might be default export or named export)
      const transportExport = transportModule as unknown as {
        Transport?: ToneTransport;
        default?: ToneTransport;
      };
      const Transport =
        transportExport.Transport ||
        transportExport.default ||
        (transportModule as unknown as ToneTransport);

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
      logger.error('Failed to load minimal Tone.js modules', error as Error);
      throw error;
    }
  }

  /**
   * Lazy load additional Tone.js modules
   */
  async loadModule(moduleName: string): Promise<unknown> {
    // Check cache first
    if (this.loadedModules.has(moduleName)) {
      logger.debug(`Module ${moduleName} already loaded`);
      return this.loadedModules.get(moduleName);
    }

    const moduleMap: Record<string, () => Promise<Record<string, unknown>>> = {
      Reverb: async () => {
        const Tone = await import('tone');
        return { Reverb: Tone.Reverb };
      },
      Delay: async () => {
        const Tone = await import('tone');
        return { Delay: Tone.Delay };
      },
      Filter: async () => {
        const Tone = await import('tone');
        return { Filter: Tone.Filter };
      },
      Compressor: async () => {
        const Tone = await import('tone');
        return { Compressor: Tone.Compressor };
      },
      Distortion: async () => {
        const Tone = await import('tone');
        return { Distortion: Tone.Distortion };
      },
      EQ3: async () => {
        const Tone = await import('tone');
        return { EQ3: Tone.EQ3 };
      },
      Panner: async () => {
        const Tone = await import('tone');
        return { Panner: Tone.Panner };
      },
      Volume: async () => {
        const Tone = await import('tone');
        return { Volume: Tone.Volume };
      },
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
        // Use index signature for dynamic module assignment
        this.tone[moduleName] = module;
      }

      logger.info(`Module ${moduleName} loaded successfully`);
      return module;
    } catch (error) {
      logger.error(`Failed to load module ${moduleName}`, error as Error);
      throw error;
    }
  }

  /**
   * Get Tone.js instance
   * Returns null if not loaded (instead of throwing) to allow InstrumentDependencyManager fallback
   */
  getTone(): ToneModule | null {
    if (!this.isLoaded || !this.tone) {
      return null; // Let caller handle missing Tone.js
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
        // ToneSampler.connect accepts ToneAudioNode | AudioNode
        toneSampler.connect(destination as ToneAudioNode | AudioNode);
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
  getContext(): AudioContext {
    const tone = this.getTone();
    if (!tone) {
      throw new Error('Tone.js not loaded');
    }
    return tone.context;
  }

  /**
   * Get Tone.js Transport
   */
  getTransport(): ToneTransport {
    const tone = this.getTone();
    if (!tone) {
      throw new Error('Tone.js not loaded');
    }
    return tone.Transport;
  }

  /**
   * Apply transport timing configuration
   */
  async applyTimingConfig(): Promise<void> {
    const tone = this.getTone();

    try {
      // Import and apply professional DAW timing configuration
      const { applyTransportTimingConfig } =
        await import('@/domains/playback/config/transportTiming');
      applyTransportTimingConfig(tone);
      logger.info('Applied professional transport timing configuration');
    } catch (error) {
      logger.error('Failed to apply timing configuration', error as Error);
      throw error;
    }
  }

  /**
   * Check if Tone.js is loaded
   */
  isReady(): boolean {
    return this.isLoaded && this.tone !== null;
  }

  // Factory methods for creating Tone.js objects
  // These provide a centralized way to create Tone objects for dependency injection

  /**
   * Helper to get tone module with null check
   */
  private getToneOrThrow(): ToneModule {
    const tone = this.getTone();
    if (!tone) {
      throw new Error('Tone.js not loaded');
    }
    return tone;
  }

  /**
   * Create a Gain node
   */
  createGain(gain?: number): ToneGain {
    const tone = this.getToneOrThrow();
    if (!tone.Gain) {
      throw new Error('Tone.Gain not available');
    }
    return new tone.Gain(gain);
  }

  /**
   * Create an EQ3 node
   */
  createEQ3(options?: Partial<{ low: number; mid: number; high: number }>): ToneEQ3 {
    const tone = this.getToneOrThrow();
    if (!tone.EQ3) {
      throw new Error('Tone.EQ3 not available');
    }
    return new tone.EQ3(options);
  }

  /**
   * Create a Compressor node
   */
  createCompressor(
    options?: Partial<{
      threshold: number;
      ratio: number;
      attack: number;
      release: number;
    }>,
  ): ToneCompressor {
    const tone = this.getToneOrThrow();
    if (!tone.Compressor) {
      throw new Error('Tone.Compressor not available');
    }
    return new tone.Compressor(options);
  }

  /**
   * Create a Filter node
   */
  createFilter(
    frequency?: number,
    type?: BiquadFilterType,
    rolloff?: number,
  ): ToneFilter {
    const tone = this.getToneOrThrow();
    if (!tone.Filter) {
      throw new Error('Tone.Filter not available');
    }
    return new tone.Filter(frequency, type, rolloff);
  }

  /**
   * Create a Panner node
   */
  createPanner(pan?: number): TonePanner {
    const tone = this.getToneOrThrow();
    if (!tone.Panner) {
      throw new Error('Tone.Panner not available');
    }
    return new tone.Panner(pan);
  }

  /**
   * Create a Volume node
   */
  createVolume(volume?: number): ToneVolume {
    const tone = this.getToneOrThrow();
    if (!tone.Volume) {
      throw new Error('Tone.Volume not available');
    }
    return new tone.Volume(volume);
  }

  /**
   * Create a Meter node
   */
  createMeter(options?: Partial<{ normalRange: boolean }>): ToneMeter {
    const tone = this.getToneOrThrow();
    if (!tone.Meter) {
      throw new Error('Tone.Meter not available');
    }
    return new tone.Meter(options);
  }

  /**
   * Create an Analyser node
   */
  createAnalyser(type?: 'fft' | 'waveform', size?: number): ToneAnalyser {
    const tone = this.getToneOrThrow();
    if (!tone.Analyser) {
      throw new Error('Tone.Analyser not available');
    }
    return new tone.Analyser(type, size);
  }

  /**
   * Create a MonoSynth
   */
  createMonoSynth(options?: Record<string, unknown>): ToneMonoSynth {
    const tone = this.getToneOrThrow();
    if (!tone.MonoSynth) {
      throw new Error('Tone.MonoSynth not available');
    }
    return new tone.MonoSynth(options);
  }

  /**
   * Create a Player
   */
  createPlayer(url?: string | AudioBuffer): TonePlayer {
    const tone = this.getToneOrThrow();
    if (!tone.Player) {
      throw new Error('Tone.Player not available');
    }
    return new tone.Player(url);
  }

  /**
   * Create an Oscillator
   */
  createOscillator(frequency?: number, type?: string): ToneOscillator {
    const tone = this.getToneOrThrow();
    if (!tone.Oscillator) {
      throw new Error('Tone.Oscillator not available');
    }
    return new tone.Oscillator(frequency, type);
  }

  /**
   * Create an AmplitudeEnvelope
   */
  createAmplitudeEnvelope(
    options?: Partial<{
      attack: number;
      decay: number;
      sustain: number;
      release: number;
    }>,
  ): ToneAmplitudeEnvelope {
    const tone = this.getToneOrThrow();
    if (!tone.AmplitudeEnvelope) {
      throw new Error('Tone.AmplitudeEnvelope not available');
    }
    return new tone.AmplitudeEnvelope(options);
  }

  /**
   * Create a Sequence
   */
  createSequence(
    callback: (time: number, note: unknown) => void,
    events: unknown[],
    subdivision?: string,
  ): ToneSequence {
    const tone = this.getToneOrThrow();
    if (!tone.Sequence) {
      throw new Error('Tone.Sequence not available');
    }
    return new tone.Sequence(callback, events, subdivision);
  }

  /**
   * Create a Synth
   */
  createSynth(options?: Record<string, unknown>): ToneSynth {
    const tone = this.getToneOrThrow();
    if (!tone.Synth) {
      throw new Error('Tone.Synth not available');
    }
    return new tone.Synth(options);
  }

  /**
   * Create a NoiseSynth
   */
  createNoiseSynth(options?: Record<string, unknown>): ToneNoiseSynth {
    const tone = this.getToneOrThrow();
    if (!tone.NoiseSynth) {
      throw new Error('Tone.NoiseSynth not available');
    }
    return new tone.NoiseSynth(options);
  }

  /**
   * Create a MembraneSynth
   */
  createMembraneSynth(options?: Record<string, unknown>): ToneMembraneSynth {
    const tone = this.getToneOrThrow();
    if (!tone.MembraneSynth) {
      throw new Error('Tone.MembraneSynth not available');
    }
    return new tone.MembraneSynth(options);
  }

  /**
   * Create a Gate
   */
  createGate(threshold?: number): ToneGate {
    const tone = this.getToneOrThrow();
    if (!tone.Gate) {
      throw new Error('Tone.Gate not available');
    }
    return new tone.Gate(threshold);
  }

  /**
   * Create a Limiter
   */
  createLimiter(threshold?: number): ToneLimiter {
    const tone = this.getToneOrThrow();
    if (!tone.Limiter) {
      throw new Error('Tone.Limiter not available');
    }
    return new tone.Limiter(threshold);
  }

  /**
   * Create a Reverb
   */
  createReverb(decay?: number): ToneReverb {
    const tone = this.getToneOrThrow();
    if (!tone.Reverb) {
      throw new Error('Tone.Reverb not available');
    }
    return new tone.Reverb(decay);
  }

  /**
   * Create a Delay
   */
  createDelay(delayTime?: number, feedback?: number): ToneDelay {
    const tone = this.getToneOrThrow();
    if (!tone.Delay) {
      throw new Error('Tone.Delay not available');
    }
    return new tone.Delay(delayTime, feedback);
  }

  /**
   * Create a Distortion
   */
  createDistortion(distortion?: number): ToneDistortion {
    const tone = this.getToneOrThrow();
    if (!tone.Distortion) {
      throw new Error('Tone.Distortion not available');
    }
    return new tone.Distortion(distortion);
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
