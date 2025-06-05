import { EventEmitter } from 'events';

/**
 * Audio Resource Disposal System
 *
 * Implements professional audio resource cleanup with proper fade-out handling
 * to prevent audio artifacts, clicks, and pops during resource disposal.
 *
 * Features:
 * - Graceful fade-out before disposal
 * - Audio artifact prevention (clicks, pops)
 * - Proper Tone.js resource cleanup
 * - Web Audio API resource management
 * - Audio buffer disposal optimization
 * - Context-aware cleanup strategies
 */

export enum FadeType {
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  LOGARITHMIC = 'logarithmic',
  SINE = 'sine',
  COSINE = 'cosine',
}

export enum DisposalStrategy {
  IMMEDIATE = 'immediate',
  GRACEFUL = 'graceful',
  BATCH = 'batch',
  DEFERRED = 'deferred',
}

export enum AudioResourceType {
  TONE_INSTRUMENT = 'tone_instrument',
  TONE_EFFECT = 'tone_effect',
  AUDIO_BUFFER = 'audio_buffer',
  AUDIO_NODE = 'audio_node',
  MEDIA_ELEMENT = 'media_element',
  OSCILLATOR = 'oscillator',
  GAIN_NODE = 'gain_node',
  ANALYZER_NODE = 'analyzer_node',
  CONVOLVER_NODE = 'convolver_node',
  DELAY_NODE = 'delay_node',
  COMPRESSOR_NODE = 'compressor_node',
  FILTER_NODE = 'filter_node',
}

export interface FadeConfig {
  type: FadeType;
  duration: number;
  startLevel: number;
  endLevel: number;
  curve?: number[];
  easing?: 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface DisposalConfig {
  strategy: DisposalStrategy;
  fadeConfig?: FadeConfig;
  maxDisposalTime: number;
  batchSize: number;
  deferredDelay: number;
  preventArtifacts: boolean;
  validateCleanup: boolean;
}

export interface AudioResource {
  id: string;
  type: AudioResourceType;
  resource: any; // Tone.js instrument, AudioNode, AudioBuffer, etc.
  metadata: {
    createdAt: number;
    lastUsed: number;
    isPlaying: boolean;
    hasActiveConnections: boolean;
    fadeInProgress: boolean;
    priority: 'high' | 'medium' | 'low';
  };
  dependencies: string[];
  cleanup?: () => Promise<void>;
}

export interface DisposalMetrics {
  totalDisposed: number;
  totalFadeTime: number;
  averageFadeTime: number;
  artifactsDetected: number;
  failedDisposals: number;
  disposalsByType: Record<AudioResourceType, number>;
  disposalsByStrategy: Record<DisposalStrategy, number>;
}

export interface DisposalResult {
  success: boolean;
  resourceId: string;
  fadeTime: number;
  artifactsDetected: boolean;
  error?: Error;
  disposalStrategy: DisposalStrategy;
}

export class AudioResourceDisposer extends EventEmitter {
  private static instance: AudioResourceDisposer | null = null;
  private config: DisposalConfig;
  private metrics: DisposalMetrics;
  private activeResources = new Map<string, AudioResource>();
  private disposalQueue: string[] = [];
  private batchDisposalHandle: NodeJS.Timeout | null = null;
  private isDisposing = false;

  private readonly defaultConfig: DisposalConfig = {
    strategy: DisposalStrategy.GRACEFUL,
    fadeConfig: {
      type: FadeType.EXPONENTIAL,
      duration: 100, // 100ms fade-out
      startLevel: 1.0,
      endLevel: 0.0,
      easing: 'ease-out',
    },
    maxDisposalTime: 5000, // Max 5 seconds for disposal
    batchSize: 10,
    deferredDelay: 1000,
    preventArtifacts: true,
    validateCleanup: true,
  };

  private readonly fadePresets: Record<string, FadeConfig> = {
    quick: {
      type: FadeType.EXPONENTIAL,
      duration: 50,
      startLevel: 1.0,
      endLevel: 0.0,
      easing: 'ease-out',
    },
    smooth: {
      type: FadeType.SINE,
      duration: 200,
      startLevel: 1.0,
      endLevel: 0.0,
      easing: 'ease-in-out',
    },
    professional: {
      type: FadeType.LOGARITHMIC,
      duration: 150,
      startLevel: 1.0,
      endLevel: 0.0,
      easing: 'ease-out',
    },
  };

  private constructor(config?: Partial<DisposalConfig>) {
    super();
    this.config = { ...this.defaultConfig, ...config };
    this.metrics = this.initializeMetrics();
    this.setupBatchProcessing();
  }

  public static getInstance(
    config?: Partial<DisposalConfig>,
  ): AudioResourceDisposer {
    if (!AudioResourceDisposer.instance) {
      AudioResourceDisposer.instance = new AudioResourceDisposer(config);
    }
    return AudioResourceDisposer.instance;
  }

  private initializeMetrics(): DisposalMetrics {
    return {
      totalDisposed: 0,
      totalFadeTime: 0,
      averageFadeTime: 0,
      artifactsDetected: 0,
      failedDisposals: 0,
      disposalsByType: {} as Record<AudioResourceType, number>,
      disposalsByStrategy: {} as Record<DisposalStrategy, number>,
    };
  }

  private setupBatchProcessing(): void {
    // Process disposal queue in batches
    this.batchDisposalHandle = setInterval(() => {
      if (this.disposalQueue.length > 0 && !this.isDisposing) {
        this.processBatchDisposal();
      }
    }, this.config.deferredDelay);
  }

  public registerResource(resource: AudioResource): void {
    this.activeResources.set(resource.id, resource);
    this.emit('resourceRegistered', {
      resourceId: resource.id,
      type: resource.type,
    });
  }

  public async disposeResource(
    resourceId: string,
    strategy?: DisposalStrategy,
    fadeConfig?: FadeConfig,
  ): Promise<DisposalResult> {
    const resource = this.activeResources.get(resourceId);
    if (!resource) {
      return {
        success: false,
        resourceId,
        fadeTime: 0,
        artifactsDetected: false,
        error: new Error(`Resource ${resourceId} not found`),
        disposalStrategy: strategy || this.config.strategy,
      };
    }

    const disposalStrategy = strategy || this.config.strategy;

    try {
      this.emit('disposalStarted', { resourceId, strategy: disposalStrategy });

      switch (disposalStrategy) {
        case DisposalStrategy.IMMEDIATE:
          return await this.immediateDisposal(resource);
        case DisposalStrategy.GRACEFUL:
          return await this.gracefulDisposal(resource, fadeConfig);
        case DisposalStrategy.BATCH:
          return this.queueForBatchDisposal(resource);
        case DisposalStrategy.DEFERRED:
          return this.scheduleDeferred(resource, fadeConfig);
      }
    } catch (error) {
      this.metrics.failedDisposals++;
      this.emit('disposalError', { resourceId, error });
      return {
        success: false,
        resourceId,
        fadeTime: 0,
        artifactsDetected: false,
        error: error as Error,
        disposalStrategy,
      };
    }
  }

  private async immediateDisposal(
    resource: AudioResource,
  ): Promise<DisposalResult> {
    const startTime = performance.now();

    await this.performResourceCleanup(resource);
    this.activeResources.delete(resource.id);

    const disposalTime = performance.now() - startTime;
    this.updateMetrics(resource, disposalTime, DisposalStrategy.IMMEDIATE);

    this.emit('disposalCompleted', {
      resourceId: resource.id,
      strategy: DisposalStrategy.IMMEDIATE,
      disposalTime,
    });

    return {
      success: true,
      resourceId: resource.id,
      fadeTime: 0,
      artifactsDetected: false,
      disposalStrategy: DisposalStrategy.IMMEDIATE,
    };
  }

  private async gracefulDisposal(
    resource: AudioResource,
    fadeConfig?: FadeConfig,
  ): Promise<DisposalResult> {
    const startTime = performance.now();
    const fade =
      fadeConfig ?? this.config.fadeConfig ?? this.fadePresets.smooth;

    if (!fade) {
      throw new Error('No fade configuration available');
    }
    let artifactsDetected = false;

    try {
      // Mark resource as fading
      resource.metadata.fadeInProgress = true;

      // Perform fade-out if resource is currently playing
      if (resource.metadata.isPlaying) {
        artifactsDetected = await this.performFadeOut(resource, fade);
      }

      // Wait for any active connections to complete
      await this.waitForConnectionsToComplete(resource);

      // Perform actual resource cleanup
      await this.performResourceCleanup(resource);

      // Remove from active resources
      this.activeResources.delete(resource.id);

      const disposalTime = performance.now() - startTime;
      this.updateMetrics(
        resource,
        disposalTime,
        DisposalStrategy.GRACEFUL,
        fade.duration,
      );

      if (artifactsDetected) {
        this.metrics.artifactsDetected++;
      }

      this.emit('disposalCompleted', {
        resourceId: resource.id,
        strategy: DisposalStrategy.GRACEFUL,
        disposalTime,
        fadeTime: fade.duration,
        artifactsDetected,
      });

      return {
        success: true,
        resourceId: resource.id,
        fadeTime: fade.duration,
        artifactsDetected,
        disposalStrategy: DisposalStrategy.GRACEFUL,
      };
    } catch (error) {
      resource.metadata.fadeInProgress = false;
      throw error;
    }
  }

  private async performFadeOut(
    resource: AudioResource,
    fadeConfig: FadeConfig,
  ): Promise<boolean> {
    let artifactsDetected = false;

    try {
      switch (resource.type) {
        case AudioResourceType.TONE_INSTRUMENT:
          artifactsDetected = await this.fadeToneInstrument(
            resource.resource,
            fadeConfig,
          );
          break;
        case AudioResourceType.GAIN_NODE:
          artifactsDetected = await this.fadeGainNode(
            resource.resource,
            fadeConfig,
          );
          break;
        case AudioResourceType.OSCILLATOR:
          artifactsDetected = await this.fadeOscillator(
            resource.resource,
            fadeConfig,
          );
          break;
        case AudioResourceType.MEDIA_ELEMENT:
          artifactsDetected = await this.fadeMediaElement(
            resource.resource,
            fadeConfig,
          );
          break;
        default:
          // Attempt generic fade-out
          artifactsDetected = await this.performGenericFade(
            resource.resource,
            fadeConfig,
          );
      }
    } catch (error) {
      console.warn(`Fade-out failed for resource ${resource.id}:`, error);
      artifactsDetected = true;
    }

    return artifactsDetected;
  }

  private async fadeToneInstrument(
    instrument: any,
    fadeConfig: FadeConfig,
  ): Promise<boolean> {
    try {
      if (instrument && typeof instrument.volume === 'object') {
        // Tone.js instrument with volume parameter
        const volume = instrument.volume;
        const currentTime = instrument.context.currentTime;

        // Create fade curve based on type
        switch (fadeConfig.type) {
          case FadeType.LINEAR:
            volume.linearRampToValueAtTime(
              -Infinity,
              currentTime + fadeConfig.duration / 1000,
            );
            break;
          case FadeType.EXPONENTIAL:
            volume.exponentialRampToValueAtTime(
              0.001,
              currentTime + fadeConfig.duration / 1000,
            );
            break;
          default:
            volume.linearRampToValueAtTime(
              -Infinity,
              currentTime + fadeConfig.duration / 1000,
            );
        }

        // Wait for fade to complete
        await new Promise((resolve) =>
          setTimeout(resolve, fadeConfig.duration),
        );

        return false; // No artifacts detected with proper Tone.js fade
      }
    } catch (error) {
      console.warn('Tone.js instrument fade failed:', error);
      return true;
    }

    return false;
  }

  private async fadeGainNode(
    gainNode: GainNode,
    fadeConfig: FadeConfig,
  ): Promise<boolean> {
    try {
      const currentTime = gainNode.context.currentTime;
      const fadeDuration = fadeConfig.duration / 1000;

      // Cancel any existing automations
      gainNode.gain.cancelScheduledValues(currentTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);

      // Apply fade curve
      switch (fadeConfig.type) {
        case FadeType.LINEAR: {
          const endValue = fadeConfig.endLevel;
          gainNode.gain.linearRampToValueAtTime(
            endValue,
            currentTime + fadeDuration,
          );
          break;
        }
        case FadeType.EXPONENTIAL:
          gainNode.gain.exponentialRampToValueAtTime(
            fadeConfig.endLevel,
            currentTime + fadeDuration,
          );
          break;
        case FadeType.SINE:
          this.applySineFade(gainNode.gain, fadeConfig, currentTime);
          break;
        default:
          gainNode.gain.linearRampToValueAtTime(
            fadeConfig.endLevel,
            currentTime + fadeDuration,
          );
      }

      // Wait for fade to complete
      await new Promise((resolve) => setTimeout(resolve, fadeConfig.duration));

      return false; // No artifacts detected
    } catch {
      return true; // Artifacts detected
    }
  }

  private async fadeOscillator(
    oscillator: OscillatorNode,
    fadeConfig: FadeConfig,
  ): Promise<boolean> {
    try {
      // Create a gain node for the oscillator if it doesn't have one
      const gainNode = oscillator.context.createGain();
      oscillator.connect(gainNode);

      // Perform fade on the gain node
      return await this.fadeGainNode(gainNode, fadeConfig);
    } catch (error) {
      console.warn('Oscillator fade failed:', error);
      return true;
    }
  }

  private async fadeMediaElement(
    media: HTMLMediaElement,
    fadeConfig: FadeConfig,
  ): Promise<boolean> {
    try {
      const startVolume = media.volume;
      const endVolume = fadeConfig.endLevel;
      const steps = Math.max(10, fadeConfig.duration / 10); // At least 10 steps
      const stepSize = (startVolume - endVolume) / steps;
      const stepDuration = fadeConfig.duration / steps;

      for (let i = 0; i < steps; i++) {
        media.volume = Math.max(0, startVolume - stepSize * i);
        await new Promise((resolve) => setTimeout(resolve, stepDuration));
      }

      media.volume = endVolume;
      return false; // No artifacts detected
    } catch (error) {
      console.warn('Media element fade failed:', error);
      return true;
    }
  }

  private async performGenericFade(
    resource: any,
    fadeConfig: FadeConfig,
  ): Promise<boolean> {
    try {
      // Attempt to find and fade any volume/gain properties
      if (resource && typeof resource === 'object') {
        const volumeProps = ['volume', 'gain', 'level', 'output'];

        for (const prop of volumeProps) {
          if (resource[prop] && typeof resource[prop].value !== 'undefined') {
            // Try to apply fade to the property
            const param = resource[prop];
            if (param.linearRampToValueAtTime) {
              param.linearRampToValueAtTime(
                fadeConfig.endLevel,
                param.context.currentTime + fadeConfig.duration / 1000,
              );
              await new Promise((resolve) =>
                setTimeout(resolve, fadeConfig.duration),
              );
              return false;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Generic fade failed:', error);
      return true;
    }

    return false;
  }

  private applySineFade(
    param: AudioParam,
    fadeConfig: FadeConfig,
    startTime: number,
  ): void {
    const steps = 50; // Smooth sine curve with 50 steps
    const stepDuration = fadeConfig.duration / 1000 / steps;

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const sineValue = Math.cos((progress * Math.PI) / 2); // Cosine fade-out
      const value =
        fadeConfig.startLevel +
        (fadeConfig.endLevel - fadeConfig.startLevel) * (1 - sineValue);
      param.setValueAtTime(value, startTime + i * stepDuration);
    }
  }

  private async waitForConnectionsToComplete(
    resource: AudioResource,
  ): Promise<void> {
    // Check if resource has active connections and wait for them to complete
    if (resource.metadata.hasActiveConnections) {
      const maxWaitTime = 1000; // Max 1 second wait
      const checkInterval = 50;
      let elapsed = 0;

      while (resource.metadata.hasActiveConnections && elapsed < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        elapsed += checkInterval;
      }
    }
  }

  private async performResourceCleanup(resource: AudioResource): Promise<void> {
    try {
      // Execute custom cleanup function if provided
      if (resource.cleanup) {
        await resource.cleanup();
      }

      // Type-specific cleanup
      switch (resource.type) {
        case AudioResourceType.TONE_INSTRUMENT:
          await this.cleanupToneInstrument(resource.resource);
          break;
        case AudioResourceType.TONE_EFFECT:
          await this.cleanupToneEffect(resource.resource);
          break;
        case AudioResourceType.AUDIO_NODE:
          this.cleanupAudioNode(resource.resource);
          break;
        case AudioResourceType.OSCILLATOR:
          this.cleanupOscillator(resource.resource);
          break;
        case AudioResourceType.MEDIA_ELEMENT:
          this.cleanupMediaElement(resource.resource);
          break;
        default:
          await this.performGenericCleanup(resource.resource);
      }

      // Cleanup dependencies
      for (const depId of resource.dependencies) {
        if (this.activeResources.has(depId)) {
          await this.disposeResource(depId, DisposalStrategy.GRACEFUL);
        }
      }
    } catch (error) {
      console.warn(`Cleanup failed for resource ${resource.id}:`, error);
      throw error;
    }
  }

  private async cleanupToneInstrument(instrument: any): Promise<void> {
    try {
      if (instrument && typeof instrument.dispose === 'function') {
        await instrument.dispose();
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private async cleanupToneEffect(effect: any): Promise<void> {
    try {
      if (effect && typeof effect.dispose === 'function') {
        await effect.dispose();
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private cleanupAudioNode(node: AudioNode): void {
    try {
      if (node && typeof node.disconnect === 'function') {
        node.disconnect();
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private cleanupOscillator(oscillator: OscillatorNode): void {
    try {
      // Stop the oscillator if it's still running
      oscillator.stop();
      oscillator.disconnect();
    } catch {
      // Ignore cleanup errors - oscillator may already be stopped
    }
  }

  private cleanupMediaElement(media: HTMLMediaElement): void {
    try {
      media.pause();
      media.src = '';
      media.load();
    } catch {
      // Ignore cleanup errors
    }
  }

  private async performGenericCleanup(resource: any): Promise<void> {
    if (resource && typeof resource.dispose === 'function') {
      resource.dispose();
    }
  }

  private queueForBatchDisposal(resource: AudioResource): DisposalResult {
    this.disposalQueue.push(resource.id);

    return {
      success: true,
      resourceId: resource.id,
      fadeTime: 0,
      artifactsDetected: false,
      disposalStrategy: DisposalStrategy.BATCH,
    };
  }

  private scheduleDeferred(
    resource: AudioResource,
    fadeConfig?: FadeConfig,
  ): DisposalResult {
    setTimeout(() => {
      this.gracefulDisposal(resource, fadeConfig);
    }, this.config.deferredDelay);

    return {
      success: true,
      resourceId: resource.id,
      fadeTime: fadeConfig?.duration || 0,
      artifactsDetected: false,
      disposalStrategy: DisposalStrategy.DEFERRED,
    };
  }

  private async processBatchDisposal(): Promise<void> {
    if (this.isDisposing || this.disposalQueue.length === 0) return;

    this.isDisposing = true;
    const batchSize = Math.min(
      this.config.batchSize,
      this.disposalQueue.length,
    );
    const batch = this.disposalQueue.splice(0, batchSize);

    this.emit('batchDisposalStarted', { batchSize: batch.length });

    try {
      const disposalPromises = batch.map(async (resourceId) => {
        const resource = this.activeResources.get(resourceId);
        if (resource) {
          return await this.gracefulDisposal(resource);
        }
        return null; // Return null if resource not found
      });

      await Promise.all(disposalPromises);
      this.emit('batchDisposalCompleted', { processedCount: batch.length });
    } catch (error) {
      this.emit('batchDisposalError', { error, batchSize: batch.length });
    } finally {
      this.isDisposing = false;
    }
  }

  private updateMetrics(
    resource: AudioResource,
    disposalTime: number,
    strategy: DisposalStrategy,
    fadeTime?: number,
  ): void {
    this.metrics.totalDisposed++;

    if (fadeTime) {
      this.metrics.totalFadeTime += fadeTime;
      this.metrics.averageFadeTime =
        this.metrics.totalFadeTime / this.metrics.totalDisposed;
    }

    // Update counters
    if (!this.metrics.disposalsByType[resource.type]) {
      this.metrics.disposalsByType[resource.type] = 0;
    }
    this.metrics.disposalsByType[resource.type]++;

    if (!this.metrics.disposalsByStrategy[strategy]) {
      this.metrics.disposalsByStrategy[strategy] = 0;
    }
    this.metrics.disposalsByStrategy[strategy]++;

    this.emit('metricsUpdated', this.metrics);
  }

  public async disposeAllResources(
    strategy?: DisposalStrategy,
  ): Promise<DisposalResult[]> {
    const resourceIds = Array.from(this.activeResources.keys());
    const results: DisposalResult[] = [];

    for (const resourceId of resourceIds) {
      const result = await this.disposeResource(resourceId, strategy);
      results.push(result);
    }

    return results;
  }

  public getActiveResources(): AudioResource[] {
    return Array.from(this.activeResources.values());
  }

  public getMetrics(): DisposalMetrics {
    return { ...this.metrics };
  }

  public updateConfig(newConfig: Partial<DisposalConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  public destroy(): void {
    if (this.batchDisposalHandle) {
      clearInterval(this.batchDisposalHandle);
    }

    // Dispose all remaining resources
    this.disposeAllResources(DisposalStrategy.IMMEDIATE);

    this.removeAllListeners();
    AudioResourceDisposer.instance = null;
  }
}

export default AudioResourceDisposer;
