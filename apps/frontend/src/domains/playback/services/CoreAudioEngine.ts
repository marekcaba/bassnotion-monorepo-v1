/**
 * CoreAudioEngine - Main Audio Processing Service
 *
 * Provides unified interface for all audio operations (tempo, pitch, volume)
 * with Tone.js integration for low-latency audio processing.
 *
 * Part of Story 2.1: Core Audio Engine Foundation
 */

import * as Tone from 'tone';
import {
  AudioContextManager,
  AudioContextState,
} from './AudioContextManager.js';
import {
  PerformanceMonitor,
  AudioPerformanceMetrics,
  PerformanceAlert,
} from './PerformanceMonitor.js';
import { WorkerPoolManager } from './WorkerPoolManager.js';
import { StatePersistenceManager } from './StatePersistenceManager.js';
import { BackgroundProcessingConfig } from '../types/audio.js';

export type PlaybackState = 'stopped' | 'playing' | 'paused' | 'loading';
export type AudioSourceType =
  | 'drums'
  | 'bass'
  | 'harmony'
  | 'metronome'
  | 'ambient';

export interface AudioSourceConfig {
  id: string;
  type: AudioSourceType;
  volume: number; // 0-1
  pan: number; // -1 to 1
  muted: boolean;
  solo: boolean;
}

export interface CoreAudioEngineConfig {
  masterVolume: number;
  tempo: number; // BPM
  pitch: number; // Semitones offset
  swingFactor: number; // 0-1 (0 = straight, 0.5 = triplet swing)
  backgroundProcessing?: BackgroundProcessingConfig; // NEW: Worker thread configuration
}

export interface CoreAudioEngineEvents {
  stateChange: (state: PlaybackState) => void;
  audioContextChange: (contextState: AudioContextState) => void;
  performanceAlert: (alert: PerformanceAlert) => void;
  tempoChange: (tempo: number) => void;
  masterVolumeChange: (volume: number) => void;
}

export class CoreAudioEngine {
  private static instance: CoreAudioEngine;
  private audioContextManager: AudioContextManager;
  private performanceMonitor: PerformanceMonitor;
  private workerPoolManager: WorkerPoolManager;
  private statePersistenceManager: StatePersistenceManager;

  // Tone.js components
  private toneTransport: typeof Tone.Transport;
  private masterGain!: Tone.Gain;
  private limiter!: Tone.Limiter;
  private analyzer!: Tone.Analyser;

  // Audio source management
  private audioSources: Map<string, Tone.Gain> = new Map();
  private sourceConfigs: Map<string, AudioSourceConfig> = new Map();
  private soloSources: Set<string> = new Set();

  // Engine state
  private playbackState: PlaybackState = 'stopped';
  private isInitialized = false;
  private config: CoreAudioEngineConfig = {
    masterVolume: 0.8,
    tempo: 120,
    pitch: 0,
    swingFactor: 0,
    backgroundProcessing: {
      enableWorkerThreads: true,
      maxWorkerThreads: Math.min(navigator.hardwareConcurrency || 4, 6),
      priorityScheduling: true,
      adaptiveScaling: true,
      batteryOptimization: true,
      backgroundThrottling: true,
      workerConfigs: [], // Will use defaults from WorkerPoolManager
    },
  };

  // Event handlers
  private eventHandlers: Map<
    keyof CoreAudioEngineEvents,
    Set<(...args: any[]) => void>
  > = new Map();

  private constructor() {
    this.audioContextManager = AudioContextManager.getInstance();
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.workerPoolManager = WorkerPoolManager.getInstance();
    this.statePersistenceManager = StatePersistenceManager.getInstance();
    this.toneTransport = Tone.getTransport();

    this.setupEventHandlers();
  }

  public static getInstance(): CoreAudioEngine {
    if (!CoreAudioEngine.instance) {
      CoreAudioEngine.instance = new CoreAudioEngine();
    }
    return CoreAudioEngine.instance;
  }

  /**
   * Initialize the Core Audio Engine
   * Must be called from a user interaction event
   */
  public async initialize(): Promise<void> {
    try {
      // Initialize audio context
      await this.audioContextManager.initialize();
      const audioContext = this.audioContextManager.getContext();

      // Connect Tone.js to our audio context
      if (Tone.getContext().rawContext !== audioContext) {
        await Tone.setContext(audioContext);
      }

      // Set up master audio chain
      this.setupAudioChain();

      // Initialize performance monitoring
      this.performanceMonitor.initialize(audioContext);
      this.performanceMonitor.startMonitoring();

      // Initialize worker pool for background processing
      await this.workerPoolManager.initialize(this.config.backgroundProcessing);

      // Initialize state persistence for session recovery
      await this.statePersistenceManager.initialize({
        enabled: true,
        autoSaveInterval: 30000, // Auto-save every 30 seconds
        storageType: 'localStorage',
        crossTabSync: true,
      });

      // Set up auto-save handler
      this.statePersistenceManager.on('autoSaveRequested', () => {
        this.saveCurrentState();
      });

      // Configure Tone.js transport
      this.configureTransport();

      this.isInitialized = true;
      this.setState('stopped');
    } catch (error) {
      console.error('Failed to initialize Core Audio Engine:', error);
      throw error;
    }
  }

  /**
   * Start playback
   */
  public async play(): Promise<void> {
    this.ensureInitialized();

    const { result: _result, responseTime } =
      await this.performanceMonitor.measureResponseTime(async () => {
        if (this.playbackState === 'paused') {
          this.toneTransport.start();
        } else {
          this.toneTransport.start(0);
        }
        return 'started';
      });

    this.setState('playing');
    console.log(`Playback started in ${responseTime.toFixed(1)}ms`);
  }

  /**
   * Pause playback
   */
  public async pause(): Promise<void> {
    this.ensureInitialized();

    const { result: _result, responseTime } =
      await this.performanceMonitor.measureResponseTime(async () => {
        this.toneTransport.pause();
        return 'paused';
      });

    this.setState('paused');
    console.log(`Playback paused in ${responseTime.toFixed(1)}ms`);
  }

  /**
   * Stop playback
   */
  public async stop(): Promise<void> {
    this.ensureInitialized();

    const { result: _result, responseTime } =
      await this.performanceMonitor.measureResponseTime(async () => {
        this.toneTransport.stop();
        this.toneTransport.position = 0;
        return 'stopped';
      });

    this.setState('stopped');
    console.log(`Playback stopped in ${responseTime.toFixed(1)}ms`);
  }

  /**
   * Set master volume (0-1)
   */
  public setMasterVolume(volume: number): void {
    this.ensureInitialized();

    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.config.masterVolume = clampedVolume;

    // Convert linear volume to decibels for more natural control
    const dbValue =
      clampedVolume === 0 ? -Infinity : Tone.gainToDb(clampedVolume);
    this.masterGain.gain.setValueAtTime(dbValue, Tone.now());

    this.emit('masterVolumeChange', clampedVolume);
  }

  /**
   * Set tempo in BPM
   */
  public setTempo(bpm: number): void {
    this.ensureInitialized();

    const clampedBpm = Math.max(60, Math.min(200, bpm)); // Reasonable tempo range
    this.config.tempo = clampedBpm;
    this.toneTransport.bpm.value = clampedBpm;

    this.emit('tempoChange', clampedBpm);
  }

  /**
   * Set pitch offset in semitones
   */
  public setPitch(semitones: number): void {
    this.ensureInitialized();

    const clampedPitch = Math.max(-12, Math.min(12, semitones)); // ±1 octave
    this.config.pitch = clampedPitch;

    // Pitch shifting will be implemented per audio source in future stories
    // For now, we just store the value
  }

  /**
   * Register an audio source with the engine
   */
  public registerAudioSource(config: AudioSourceConfig): Tone.Gain {
    this.ensureInitialized();

    // Create gain node for this source
    const sourceGain = new Tone.Gain(config.volume);
    const sourcePanner = new Tone.Panner(config.pan);

    // Connect to master chain
    sourceGain.chain(sourcePanner, this.masterGain);

    // Store references
    this.audioSources.set(config.id, sourceGain);
    this.sourceConfigs.set(config.id, { ...config });

    return sourceGain;
  }

  /**
   * Unregister an audio source
   */
  public unregisterAudioSource(sourceId: string): void {
    const sourceGain = this.audioSources.get(sourceId);
    if (sourceGain) {
      sourceGain.dispose();
      this.audioSources.delete(sourceId);
      this.sourceConfigs.delete(sourceId);
      this.soloSources.delete(sourceId);
    }
  }

  /**
   * Set source volume
   */
  public setSourceVolume(sourceId: string, volume: number): void {
    const sourceGain = this.audioSources.get(sourceId);
    const config = this.sourceConfigs.get(sourceId);

    if (sourceGain && config) {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      config.volume = clampedVolume;

      const dbValue =
        clampedVolume === 0 ? -Infinity : Tone.gainToDb(clampedVolume);
      sourceGain.gain.setValueAtTime(dbValue, Tone.now());
    }
  }

  /**
   * Mute/unmute source
   */
  public setSourceMute(sourceId: string, muted: boolean): void {
    const sourceGain = this.audioSources.get(sourceId);
    const config = this.sourceConfigs.get(sourceId);

    if (sourceGain && config) {
      config.muted = muted;
      this.updateSourceAudibility(sourceId);
    }
  }

  /**
   * Solo/unsolo source
   */
  public setSourceSolo(sourceId: string, solo: boolean): void {
    const config = this.sourceConfigs.get(sourceId);

    if (config) {
      config.solo = solo;

      if (solo) {
        this.soloSources.add(sourceId);
      } else {
        this.soloSources.delete(sourceId);
      }

      // Update audibility for all sources
      this.sourceConfigs.forEach((_, id) => {
        this.updateSourceAudibility(id);
      });
    }
  }

  /**
   * Get current playback state
   */
  public getPlaybackState(): PlaybackState {
    return this.playbackState;
  }

  /**
   * Get current configuration
   */
  public getConfig(): CoreAudioEngineConfig {
    return { ...this.config };
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): AudioPerformanceMetrics {
    return this.performanceMonitor.getMetrics();
  }

  /**
   * Get Tone.js Transport for advanced timing control
   */
  public getTransport(): typeof Tone.Transport {
    this.ensureInitialized();
    return this.toneTransport;
  }

  /**
   * Process MIDI data in background worker thread
   * @param midiData Raw MIDI data bytes
   * @param scheduleTime When to execute the MIDI event (in Tone.Transport time)
   * @param velocity MIDI velocity (0-127)
   * @param channel MIDI channel (0-15)
   */
  public async processMidiInBackground(
    midiData: Uint8Array,
    scheduleTime: number,
    velocity = 127,
    channel = 0,
  ): Promise<void> {
    this.ensureInitialized();

    try {
      await this.workerPoolManager.processMidi(
        midiData,
        scheduleTime,
        velocity,
        channel,
      );
    } catch (error) {
      console.error('Background MIDI processing failed:', error);
      throw error;
    }
  }

  /**
   * Process audio data with effects in background worker thread
   * @param audioData Array of Float32Array (one per channel)
   * @param effectParameters Effect configuration object
   */
  public async processAudioEffectsInBackground(
    audioData: Float32Array[],
    effectParameters: {
      gain?: number;
      distortion?: number;
      compression?: number;
      compressionThreshold?: number;
      compressionRatio?: number;
    } = {},
  ): Promise<Float32Array[]> {
    this.ensureInitialized();

    try {
      return await this.workerPoolManager.processAudio(
        audioData,
        'effects',
        effectParameters,
      );
    } catch (error) {
      console.error('Background audio effects processing failed:', error);
      throw error;
    }
  }

  /**
   * Perform audio analysis in background worker thread
   * @param audioData Array of Float32Array (one per channel)
   * @param analysisParameters Analysis configuration
   */
  public async performAudioAnalysisInBackground(
    audioData: Float32Array[],
    analysisParameters: {
      includeFrequencyAnalysis?: boolean;
      fftSize?: number;
    } = {},
  ): Promise<{
    timestamp: number;
    rms: number[];
    peak: number[];
    frequencyBins?: number[][];
  }> {
    this.ensureInitialized();

    try {
      // Process and wait for analysis result
      const resultPromise = this.workerPoolManager.processAudio(
        audioData,
        'analysis',
        analysisParameters,
      );

      // The analysis worker sends results via separate message
      // For now, we'll return the processed audio data response
      await resultPromise;

      // Return a placeholder result - in production, you'd listen for analysis_result messages
      return {
        timestamp: Date.now(),
        rms: audioData.map(() => 0),
        peak: audioData.map(() => 0),
        frequencyBins: analysisParameters.includeFrequencyAnalysis
          ? audioData.map(() => [])
          : undefined,
      };
    } catch (error) {
      console.error('Background audio analysis failed:', error);
      throw error;
    }
  }

  /**
   * Normalize audio levels in background worker thread
   * @param audioData Array of Float32Array (one per channel)
   * @param targetLevel Target peak level (0-1)
   */
  public async normalizeAudioInBackground(
    audioData: Float32Array[],
    targetLevel = 0.8,
  ): Promise<Float32Array[]> {
    this.ensureInitialized();

    try {
      return await this.workerPoolManager.processAudio(
        audioData,
        'normalization',
        { targetLevel },
      );
    } catch (error) {
      console.error('Background audio normalization failed:', error);
      throw error;
    }
  }

  /**
   * Apply audio filtering in background worker thread
   * @param audioData Array of Float32Array (one per channel)
   * @param filterParameters Filter configuration
   */
  public async applyAudioFilteringInBackground(
    audioData: Float32Array[],
    filterParameters: {
      highPass?: boolean;
      lowPass?: boolean;
      cutoffFrequency?: number;
    },
  ): Promise<Float32Array[]> {
    this.ensureInitialized();

    try {
      return await this.workerPoolManager.processAudio(
        audioData,
        'filtering',
        filterParameters,
      );
    } catch (error) {
      console.error('Background audio filtering failed:', error);
      throw error;
    }
  }

  /**
   * Get worker pool performance metrics
   */
  public getWorkerPoolMetrics() {
    return this.workerPoolManager.getMetrics();
  }

  /**
   * Check if background processing is available and enabled
   */
  public isBackgroundProcessingEnabled(): boolean {
    return this.config.backgroundProcessing?.enableWorkerThreads ?? false;
  }

  /**
   * Add event listener
   */
  public on<K extends keyof CoreAudioEngineEvents>(
    event: K,
    handler: CoreAudioEngineEvents[K],
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.add(handler);
    }

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Clean up and dispose of the Core Audio Engine
   */
  public async dispose(): Promise<void> {
    try {
      if (this.isInitialized) {
        // Stop transport
        this.toneTransport.stop();
        this.toneTransport.cancel();

        // Dispose worker pool
        await this.workerPoolManager.dispose();

        // Dispose state persistence manager
        await this.statePersistenceManager.dispose();

        // Stop performance monitoring
        this.performanceMonitor.stopMonitoring();

        // Disconnect audio nodes
        if (this.masterGain) {
          this.masterGain.disconnect();
        }
        if (this.limiter) {
          this.limiter.disconnect();
        }
        if (this.analyzer) {
          this.analyzer.disconnect();
        }

        // Clear audio sources
        this.audioSources.clear();
        this.sourceConfigs.clear();
        this.soloSources.clear();

        // Dispose audio context
        await this.audioContextManager.dispose();

        this.isInitialized = false;
      }
    } catch (error) {
      console.error('Error disposing Core Audio Engine:', error);
    }
  }

  private setupAudioChain(): void {
    // Create master audio processing chain
    this.masterGain = new Tone.Gain(Tone.gainToDb(this.config.masterVolume));
    this.limiter = new Tone.Limiter(-6); // Prevent clipping
    this.analyzer = new Tone.Analyser('waveform', 256);

    // Connect master chain: masterGain -> limiter -> analyzer -> destination
    this.masterGain.chain(this.limiter, this.analyzer, Tone.getDestination());
  }

  private configureTransport(): void {
    this.toneTransport.bpm.value = this.config.tempo;
    this.toneTransport.swing = this.config.swingFactor;

    // Set up transport event handlers
    this.toneTransport.on('start', () => {
      if (this.playbackState !== 'playing') {
        this.setState('playing');
      }
    });

    this.toneTransport.on('stop', () => {
      if (this.playbackState !== 'stopped') {
        this.setState('stopped');
      }
    });

    this.toneTransport.on('pause', () => {
      if (this.playbackState !== 'paused') {
        this.setState('paused');
      }
    });
  }

  private setupEventHandlers(): void {
    // Audio context state changes
    this.audioContextManager.onStateChange((state) => {
      this.emit('audioContextChange', state);
    });

    // Performance alerts
    this.performanceMonitor.onAlert((alert) => {
      this.emit('performanceAlert', alert);
    });
  }

  private updateSourceAudibility(sourceId: string): void {
    const sourceGain = this.audioSources.get(sourceId);
    const config = this.sourceConfigs.get(sourceId);

    if (!sourceGain || !config) return;

    // Determine if source should be audible
    let isAudible = !config.muted;

    // Handle solo logic
    if (this.soloSources.size > 0) {
      isAudible = isAudible && config.solo;
    }

    // Apply audibility
    const volume = isAudible ? config.volume : 0;
    const dbValue = volume === 0 ? -Infinity : Tone.gainToDb(volume);
    sourceGain.gain.setValueAtTime(dbValue, Tone.now());
  }

  private setState(state: PlaybackState): void {
    if (this.playbackState !== state) {
      this.playbackState = state;
      this.emit('stateChange', state);
    }
  }

  private emit<K extends keyof CoreAudioEngineEvents>(
    event: K,
    ...args: Parameters<CoreAudioEngineEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          (handler as any)(...args);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        'Core Audio Engine not initialized. Call initialize() first.',
      );
    }
  }

  // Session Recovery Methods (NEW: Subtask 4.5)

  /**
   * Save current engine state for session recovery
   */
  public async saveCurrentState(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      const currentState = {
        config: this.config,
        playbackState: this.playbackState,
        audioSources: Array.from(this.sourceConfigs.values()),
        soloSources: Array.from(this.soloSources),
        transportState: {
          position: this.toneTransport.seconds,
          bpm: this.toneTransport.bpm.value,
          swing: this.toneTransport.swing,
          loop: this.toneTransport.loop,
          loopStart:
            typeof this.toneTransport.loopStart === 'number'
              ? this.toneTransport.loopStart
              : undefined,
          loopEnd:
            typeof this.toneTransport.loopEnd === 'number'
              ? this.toneTransport.loopEnd
              : undefined,
        },
        performanceHistory: {
          averageLatency: this.performanceMonitor.getMetrics().averageLatency,
          maxLatency: this.performanceMonitor.getMetrics().maxLatency,
          dropoutCount: this.performanceMonitor.getMetrics().dropoutCount,
          lastMeasurement: Date.now(),
        },
        userPreferences: {
          masterVolume: this.config.masterVolume,
          audioQuality: 'high' as const,
          backgroundProcessing:
            this.config.backgroundProcessing?.enableWorkerThreads ?? false,
          batteryOptimization:
            this.config.backgroundProcessing?.batteryOptimization ?? false,
        },
      };

      await this.statePersistenceManager.saveState(currentState);
    } catch (error) {
      console.error('Failed to save current state:', error);
    }
  }

  /**
   * Check if a recoverable session exists
   */
  public async hasRecoverableSession(): Promise<boolean> {
    try {
      return await this.statePersistenceManager.hasRecoverableSession();
    } catch {
      return false;
    }
  }

  /**
   * Recover from a previous session
   */
  public async recoverSession(): Promise<boolean> {
    try {
      const persistedState = await this.statePersistenceManager.loadState();

      if (!persistedState) {
        console.log('No recoverable session found');
        return false;
      }

      // Restore configuration
      this.config = { ...this.config, ...persistedState.config };

      // Restore playback state
      this.setState(persistedState.playbackState);

      // Restore transport state
      if (persistedState.transportState) {
        this.toneTransport.bpm.value = persistedState.transportState.bpm;
        this.toneTransport.swing = persistedState.transportState.swing;
        this.toneTransport.loop = persistedState.transportState.loop;
        if (persistedState.transportState.loopStart !== undefined) {
          this.toneTransport.loopStart =
            persistedState.transportState.loopStart;
        }
        if (persistedState.transportState.loopEnd !== undefined) {
          this.toneTransport.loopEnd = persistedState.transportState.loopEnd;
        }
      }

      // Restore master volume
      if (persistedState.userPreferences?.masterVolume !== undefined) {
        this.setMasterVolume(persistedState.userPreferences.masterVolume);
      }

      // Restore audio sources
      for (const sourceConfig of persistedState.audioSources) {
        try {
          this.registerAudioSource(sourceConfig);
        } catch (error) {
          console.warn(
            `Failed to restore audio source ${sourceConfig.id}:`,
            error,
          );
        }
      }

      // Restore solo states
      for (const sourceId of persistedState.soloSources) {
        this.setSourceSolo(sourceId, true);
      }

      console.log('Session recovered successfully');
      return true;
    } catch (error) {
      console.error('Failed to recover session:', error);
      return false;
    }
  }

  /**
   * Clear persisted session data
   */
  public async clearPersistedSession(): Promise<void> {
    try {
      await this.statePersistenceManager.clearState();
      console.log('Persisted session data cleared');
    } catch (error) {
      console.error('Failed to clear persisted session:', error);
      throw error;
    }
  }

  /**
   * Get state persistence metrics
   */
  public getStatePersistenceMetrics() {
    return this.statePersistenceManager.getMetrics();
  }
}
