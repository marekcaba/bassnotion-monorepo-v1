/**
 * AudioEngine - Modular audio engine implementation
 *
 * This is the new modular version that breaks down the monolithic AudioEngine
 * into focused components:
 * - AudioContextManager: Handles Web Audio API context
 * - ToneWrapper: Abstracts Tone.js functionality
 * - AudioNodeManager: Manages audio nodes and routing
 *
 * Provides a clean API for audio operations while maintaining
 * backward compatibility with the existing system.
 *
 * Enhanced with:
 * - Circuit breaker protection for reliable operation
 * - Singleton pattern for global instance management
 * - Advanced error handling and recovery
 */

import { AudioContextManager } from './AudioContextManager.js';
import { ToneWrapper } from './ToneWrapper.js';
import {
  AudioEngineConfig,
  AudioMetrics,
  AudioSampler,
  SamplerConfig,
  AudioContextState,
} from '../types/index.js';
import { CircuitBreaker, createStructuredLogger } from '../../shared/index.js';
import type { CircuitBreakerMetrics } from '../../shared/index.js';
import {
  AudioError,
  AudioInitializationError,
  AudioContextError,
  AudioNotSupportedError,
  AudioContextSuspendedError,
  AudioValidationError,
} from '../../../errors/AudioErrors.js';

const logger = createStructuredLogger('AudioEngine');

// Event types
export type AudioEngineEvent =
  | {
      type: 'initialized';
      data: {
        context: AudioContext;
        sampleRate: number;
        latency: number;
        attempts: number;
      };
    }
  | { type: 'tone-loaded'; data: { timestamp: number } }
  | {
      type: 'state-changed';
      data: { state: AudioContextState; timestamp: number };
    }
  | { type: 'error'; data: { error: AudioError } }
  | { type: 'warning'; data: { message: string; timestamp: number } }
  | { type: 'started'; data: { state: AudioContextState; timestamp: number } }
  | { type: 'stopped'; data: { state: AudioContextState; timestamp: number } }
  | {
      type: 'sampler-created';
      data: { samplerCount: number; creationTime: number; timestamp: number };
    }
  | {
      type: 'sampler-disposed';
      data: { samplerCount: number; timestamp: number };
    }
  | { type: 'disposed'; data: { timestamp: number } };

export class AudioEngine {
  private static instance: AudioEngine | null = null;

  private contextManager: AudioContextManager;
  private toneWrapper: ToneWrapper;
  private circuitBreaker: CircuitBreaker;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private samplerCount = 0;
  private initAttempts = 0;
  private instanceId = Math.random().toString(36).substring(2, 11);

  // Event handling
  private eventHandlers = new Map<
    string,
    Set<(event: AudioEngineEvent) => void>
  >();

  // Memory buffer pooling
  private bufferPool: Map<number, Float32Array[]> = new Map();
  private readonly MAX_POOL_SIZE = 20;
  private readonly COMMON_BUFFER_SIZES = [
    128, 256, 512, 1024, 2048, 4096, 8192,
  ];

  constructor(private config: AudioEngineConfig = {}) {
    this.contextManager = new AudioContextManager(config);
    this.toneWrapper = ToneWrapper.getInstance();

    // Initialize circuit breaker with config
    this.circuitBreaker = new CircuitBreaker('AudioEngine', {
      failureThreshold: config.circuitBreakerConfig?.failureThreshold || 5,
      recoveryTimeout: config.circuitBreakerConfig?.recoveryTimeout || 60000,
      timeout: config.circuitBreakerConfig?.timeout || 5000,
      ...config.circuitBreakerConfig,
    });

    logger.info('AudioEngine created', {
      config,
      instanceId: this.instanceId,
      circuitBreakerEnabled: true,
    });
  }

  /**
   * Get singleton instance of AudioEngine
   */
  static getInstance(config?: AudioEngineConfig): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine(config);
    }
    return AudioEngine.instance;
  }

  /**
   * Reset singleton instance (mainly for testing)
   */
  static resetInstance(): void {
    if (AudioEngine.instance) {
      AudioEngine.instance
        .dispose()
        .catch((err) =>
          logger.error('Error disposing AudioEngine instance', err),
        );
    }
    AudioEngine.instance = null;
  }

  /**
   * Pre-initialize by loading Tone.js (can be done without user gesture)
   */
  async preInitialize(): Promise<void> {
    if (this.toneWrapper.isReady()) {
      logger.debug('Already pre-initialized');
      return;
    }

    logger.info('Pre-initializing AudioEngine...');

    // Check browser support
    if (
      this.config.enableBrowserCheck &&
      !this.contextManager.isBrowserSupported()
    ) {
      throw new AudioNotSupportedError(
        'Browser does not support required audio features',
        { userAgent: navigator.userAgent },
      );
    }

    // Load Tone.js module
    await this.toneWrapper.load();

    this.emit({ type: 'tone-loaded', data: { timestamp: Date.now() } });
    logger.info('Pre-initialization complete');
  }

  /**
   * Initialize audio engine (requires user gesture)
   */
  async initialize(): Promise<void> {
    // Return existing promise if initializing
    if (this.initPromise) {
      logger.debug('Already initializing, returning existing promise', {
        instanceId: this.instanceId,
      });
      return this.initPromise;
    }

    // Return if already initialized
    if (this.isInitialized) {
      logger.debug('Already initialized', {
        instanceId: this.instanceId,
      });
      return;
    }

    logger.info('Initializing AudioEngine...', {
      instanceId: this.instanceId,
    });

    // Start initialization with circuit breaker protection
    this.initPromise = this.circuitBreaker.execute(() =>
      this.performInitialization(),
    );

    try {
      await this.initPromise;
    } catch (error) {
      // Log circuit breaker state if it's open
      const metrics = this.getCircuitBreakerMetrics();
      if (metrics.state === 'open') {
        logger.error(
          'Circuit breaker is OPEN - audio system unavailable',
          error as Error,
          {
            metrics,
            instanceId: this.instanceId,
          },
        );
      }
      throw error;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Perform initialization with retry logic
   */
  private async performInitialization(): Promise<void> {
    const maxRetries = this.config.maxInitRetries || 3;
    const retryDelay = this.config.initRetryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.initAttempts = attempt;

        console.log('[AUDIOENGINE-INIT] Step 1: Starting preInitialize()');
        // Pre-initialize if needed
        await this.preInitialize();
        console.log('[AUDIOENGINE-INIT] Step 1: preInitialize() done');

        console.log('[AUDIOENGINE-INIT] Step 2: Getting or creating AudioContext');
        // Get or create AudioContext
        const context = await this.contextManager.getOrCreateContext();
        console.log('[AUDIOENGINE-INIT] Step 2: AudioContext ready, state:', context.state);

        console.log('[AUDIOENGINE-INIT] Step 3: Initializing ToneWrapper');
        // Initialize Tone.js with the context
        await this.toneWrapper.initialize(context);
        console.log('[AUDIOENGINE-INIT] Step 3: ToneWrapper initialized');

        // DON'T start Tone.js here - context is suspended and will hang without user gesture
        // The context will be resumed on first user interaction in AudioProvider
        // await this.toneWrapper.start();

        console.log('[AUDIOENGINE-INIT] Step 4: Applying timing config');
        // Apply timing configuration
        await this.toneWrapper.applyTimingConfig();
        console.log('[AUDIOENGINE-INIT] Step 4: Timing config applied');

        console.log('[AUDIOENGINE-INIT] Step 5: Setting up state change handling');
        // Setup state change handling
        this.contextManager.onStateChange(
          this.handleContextStateChange.bind(this),
        );
        console.log('[AUDIOENGINE-INIT] Step 5: State change handler registered');

        console.log('[AUDIOENGINE-INIT] Step 6: Validation check');
        // Validate if enabled
        if (this.config.enableValidation) {
          console.log('[AUDIOENGINE-INIT] Step 6: Running validation');
          await this.validateAudioSystem();
          console.log('[AUDIOENGINE-INIT] Step 6: Validation complete');
        } else {
          console.log('[AUDIOENGINE-INIT] Step 6: Validation disabled');
        }

        this.isInitialized = true;

        const latency = context
          ? context.baseLatency + context.outputLatency
          : 0;
        this.emit({
          type: 'initialized',
          data: {
            context,
            sampleRate: context.sampleRate,
            latency,
            attempts: attempt,
          },
        });

        logger.info('AudioEngine initialized successfully', {
          attempts: attempt,
          contextState: context.state,
          sampleRate: context.sampleRate,
        });

        return;
      } catch (error) {
        const audioError =
          error instanceof AudioError
            ? error
            : new AudioInitializationError(
                `Initialization attempt ${attempt} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error instanceof Error ? error : undefined,
                {
                  details: { attempt, maxAttempts: maxRetries },
                },
              );

        this.emit({ type: 'error', data: { error: audioError } });
        logger.error(
          `Initialization attempt ${attempt} failed`,
          error as Error,
        );

        if (attempt === maxRetries) {
          throw audioError;
        }

        // Wait before retry with exponential backoff
        await this.delay(retryDelay * attempt);
      }
    }
  }

  /**
   * Start audio engine (resume context)
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    logger.info('Starting AudioEngine...', {
      instanceId: this.instanceId,
    });

    // Start with circuit breaker protection
    await this.circuitBreaker.execute(async () => {
      await this.contextManager.resume();

      const state = this.contextManager.getState();
      if (state !== 'running') {
        throw new Error(`Failed to start AudioContext. State: ${state}`);
      }
    });

    const state = this.contextManager.getState();

    this.emit({
      type: 'started',
      data: { state: state || 'unknown', timestamp: Date.now() },
    });

    logger.info('AudioEngine started', {
      state,
      instanceId: this.instanceId,
    });
  }

  /**
   * Stop audio engine (suspend context)
   */
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Stopping AudioEngine...', {
      instanceId: this.instanceId,
    });

    // Stop with circuit breaker protection
    await this.circuitBreaker.execute(async () => {
      await this.contextManager.suspend();
    });

    const state = this.contextManager.getState();

    this.emit({
      type: 'stopped',
      data: { state: state || 'unknown', timestamp: Date.now() },
    });

    logger.info('AudioEngine stopped', {
      state,
      instanceId: this.instanceId,
    });
  }

  /**
   * Get AudioContext
   */
  getContext(): AudioContext {
    const context = this.contextManager.getContext();
    if (!context) {
      throw new AudioContextError(
        'AudioContext not available. Call initialize() first.',
      );
    }
    return context;
  }

  /**
   * Get Tone.js instance
   */
  getTone(): any {
    if (!this.isInitialized) {
      throw new AudioInitializationError(
        'AudioEngine not initialized. Call initialize() first.',
      );
    }
    return this.toneWrapper.getTone();
  }

  /**
   * Get current audio time
   */
  getCurrentTime(): number {
    if (!this.isInitialized) {
      return 0;
    }
    return this.toneWrapper.now();
  }

  /**
   * Pre-initialize Tone.js (backward compatibility)
   * This matches the legacy AudioEngine behavior
   */
  async ensureToneLoaded(): Promise<void> {
    if (!this.toneWrapper.isReady()) {
      await this.preInitialize();
    }
  }

  /**
   * Create a sampler
   */
  async createSampler(config: SamplerConfig): Promise<AudioSampler> {
    if (!this.isInitialized) {
      throw new AudioInitializationError(
        'AudioEngine not initialized. Call initialize() first.',
      );
    }

    return this.circuitBreaker.execute(async () => {
      const startTime = performance.now();

      try {
        const sampler = this.toneWrapper.createSampler(config);
        this.samplerCount++;

        const creationTime = performance.now() - startTime;

        this.emit({
          type: 'sampler-created',
          data: {
            samplerCount: this.samplerCount,
            creationTime,
            timestamp: Date.now(),
          },
        });

        logger.info('Sampler created', {
          samplerCount: this.samplerCount,
          creationTime,
          instanceId: this.instanceId,
        });

        // Wrap dispose to track count
        const originalDispose = sampler.dispose.bind(sampler);
        sampler.dispose = () => {
          originalDispose();
          this.samplerCount--;

          this.emit({
            type: 'sampler-disposed',
            data: {
              samplerCount: this.samplerCount,
              timestamp: Date.now(),
            },
          });

          logger.info('Sampler disposed', {
            samplerCount: this.samplerCount,
            instanceId: this.instanceId,
          });
        };

        return sampler;
      } catch (error) {
        const audioError = new AudioError(
          `Failed to create sampler: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SAMPLE_CREATE_FAILED',
          error instanceof Error ? error : undefined,
        );
        this.emit({ type: 'error', data: { error: audioError } });
        logger.error('Failed to create sampler', error as Error, {
          instanceId: this.instanceId,
        });
        throw audioError;
      }
    });
  }

  /**
   * Get performance metrics
   */
  getMetrics(): AudioMetrics {
    const context = this.contextManager.getContext();

    return {
      latency: context ? context.baseLatency + context.outputLatency : 0,
      sampleRate: context?.sampleRate || 0,
      bufferSize: 0, // Not directly available in Web Audio API
      cpuUsage: 0, // Would need performance monitoring
      memoryUsage: 0, // Would need performance monitoring
      dropouts: 0, // Would need monitoring
      bufferUnderruns: 0, // Would need monitoring
    };
  }

  /**
   * Get engine stats
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      samplerCount: this.samplerCount,
      contextState: this.contextManager.getState(),
      initAttempts: this.initAttempts,
      browserInfo: this.contextManager.getBrowserInfo(),
      instanceId: this.instanceId,
      circuitBreakerState: this.circuitBreaker.getMetrics().state,
    };
  }

  /**
   * Get circuit breaker metrics
   */
  getCircuitBreakerMetrics(): CircuitBreakerMetrics {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Check if engine is ready
   */
  isReady(): boolean {
    return (
      this.isInitialized &&
      this.contextManager.getContext() !== null &&
      this.toneWrapper.isReady()
    );
  }

  /**
   * Validate audio system
   */
  private async validateAudioSystem(): Promise<void> {
    const context = this.contextManager.getContext();
    if (!context) {
      throw new AudioValidationError('No AudioContext for validation');
    }

    try {
      // Create test nodes to validate audio pipeline
      const testOsc = context.createOscillator();
      const testGain = context.createGain();
      const testAnalyser = context.createAnalyser();

      testGain.gain.value = 0; // Silent test
      testOsc.connect(testGain);
      testGain.connect(testAnalyser);
      testAnalyser.connect(context.destination);

      testOsc.start();
      testOsc.stop(context.currentTime + 0.1);

      // Check AudioWorklet support
      if ('audioWorklet' in context) {
        logger.info('AudioWorklet is available');
      }

      logger.info('Audio system validation passed');
    } catch (error) {
      throw new AudioValidationError(
        `Audio system validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { details: { validationError: error } },
      );
    }
  }

  /**
   * Handle context state changes
   * BUG #4 NOTE: Global broadcasting handled by AudioContextManager.setupStateChangeHandling()
   */
  private handleContextStateChange(state: AudioContextState): void {
    logger.info('AudioContext state changed', { state });

    // Emit to AudioEngine event listeners
    this.emit({
      type: 'state-changed',
      data: { state, timestamp: Date.now() },
    });

    // Handle state-specific logic
    if (state === 'suspended') {
      logger.warn('AudioContext suspended - may need user gesture to resume');

      // Attempt automatic recovery
      this.contextManager.resume().catch((error) => {
        const audioError = new AudioContextSuspendedError(
          'Failed to recover suspended context',
          { details: { error } },
        );
        this.emit({ type: 'error', data: { error: audioError } });
      });
    }
  }

  /**
   * Get buffer from memory pool
   */
  getPooledBuffer(size = 4096): Float32Array {
    // Round up to nearest common size
    let targetSize = size;
    for (const commonSize of this.COMMON_BUFFER_SIZES) {
      if (commonSize >= size) {
        targetSize = commonSize;
        break;
      }
    }

    // Check if we have a pooled buffer
    const pool = this.bufferPool.get(targetSize);
    if (pool && pool.length > 0) {
      const buffer = pool.pop() as Float32Array;
      logger.debug('Reusing pooled buffer', {
        size: targetSize,
        poolSize: pool.length,
        instanceId: this.instanceId,
      });

      // Clear buffer before returning
      buffer.fill(0);
      return buffer;
    }

    // Create new buffer
    logger.debug('Creating new buffer', {
      size: targetSize,
      instanceId: this.instanceId,
    });
    return new Float32Array(targetSize);
  }

  /**
   * Return buffer to memory pool
   */
  returnPooledBuffer(buffer: Float32Array): void {
    const size = buffer.length;

    // Only pool common sizes
    if (!this.COMMON_BUFFER_SIZES.includes(size)) {
      logger.debug('Buffer size not pooled', {
        size,
        instanceId: this.instanceId,
      });
      return;
    }

    // Get or create pool for this size
    let pool = this.bufferPool.get(size);
    if (!pool) {
      pool = [];
      this.bufferPool.set(size, pool);
    }

    // Add to pool if not at capacity
    if (pool.length < this.MAX_POOL_SIZE) {
      pool.push(buffer);
      logger.debug('Buffer returned to pool', {
        size,
        poolSize: pool.length,
        instanceId: this.instanceId,
      });
    } else {
      logger.debug('Buffer pool at capacity', {
        size,
        maxSize: this.MAX_POOL_SIZE,
        instanceId: this.instanceId,
      });
    }
  }

  /**
   * Clear buffer pool
   */
  clearBufferPool(): void {
    const totalBuffers = Array.from(this.bufferPool.values()).reduce(
      (sum, pool) => sum + pool.length,
      0,
    );

    this.bufferPool.clear();

    logger.info('Buffer pool cleared', {
      totalBuffers,
      instanceId: this.instanceId,
    });
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    logger.info('Disposing AudioEngine...');

    // Warn if samplers still active
    if (this.samplerCount > 0) {
      this.emit({
        type: 'warning',
        data: {
          message: `Disposing AudioEngine with ${this.samplerCount} active samplers`,
          timestamp: Date.now(),
        },
      });
      logger.warn(`Disposing with ${this.samplerCount} active samplers`);
    }

    // Clear buffer pool
    this.clearBufferPool();

    // Close audio context
    await this.contextManager.close();

    // Dispose Tone wrapper
    this.toneWrapper.dispose();

    // Reset state
    this.isInitialized = false;
    this.initPromise = null;
    this.samplerCount = 0;

    this.emit({ type: 'disposed', data: { timestamp: Date.now() } });
    logger.info('AudioEngine disposed');
  }

  /**
   * Subscribe to audio engine events
   */
  on(
    eventType: AudioEngineEvent['type'],
    handler: (event: AudioEngineEvent) => void,
  ): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Emit an event
   */
  private emit(event: AudioEngineEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          logger.error(
            `Error in event handler for ${event.type}`,
            error as Error,
          );
        }
      });
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Factory methods - delegate to ToneWrapper
  // These provide dependency injection support for instruments

  createGain(gain?: number): any {
    return this.toneWrapper.createGain(gain);
  }

  createEQ3(options?: any): any {
    return this.toneWrapper.createEQ3(options);
  }

  createCompressor(options?: any): any {
    return this.toneWrapper.createCompressor(options);
  }

  createFilter(options?: any): any {
    return this.toneWrapper.createFilter(options);
  }

  createPanner(pan?: number): any {
    return this.toneWrapper.createPanner(pan);
  }

  createVolume(volume?: number): any {
    return this.toneWrapper.createVolume(volume);
  }

  createMeter(options?: any): any {
    return this.toneWrapper.createMeter(options);
  }

  createAnalyser(type?: string, size?: number): any {
    return this.toneWrapper.createAnalyser(type, size);
  }

  createMonoSynth(options?: any): any {
    return this.toneWrapper.createMonoSynth(options);
  }

  createPlayer(options?: any): any {
    return this.toneWrapper.createPlayer(options);
  }

  createOscillator(options?: any): any {
    return this.toneWrapper.createOscillator(options);
  }

  createAmplitudeEnvelope(options?: any): any {
    return this.toneWrapper.createAmplitudeEnvelope(options);
  }

  createSequence(callback: any, events: any, subdivision?: any): any {
    return this.toneWrapper.createSequence(callback, events, subdivision);
  }

  createSynth(options?: any): any {
    return this.toneWrapper.createSynth(options);
  }

  createNoiseSynth(options?: any): any {
    return this.toneWrapper.createNoiseSynth(options);
  }

  createMembraneSynth(options?: any): any {
    return this.toneWrapper.createMembraneSynth(options);
  }

  createGate(options?: any): any {
    return this.toneWrapper.createGate(options);
  }

  createLimiter(options?: any): any {
    return this.toneWrapper.createLimiter(options);
  }

  createReverb(options?: any): any {
    return this.toneWrapper.createReverb(options);
  }

  createDelay(options?: any): any {
    return this.toneWrapper.createDelay(options);
  }

  createDistortion(options?: any): any {
    return this.toneWrapper.createDistortion(options);
  }
}
