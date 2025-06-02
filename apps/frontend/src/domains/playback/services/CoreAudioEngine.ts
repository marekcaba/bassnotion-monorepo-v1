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
  };

  // Event handlers
  private eventHandlers: Map<
    keyof CoreAudioEngineEvents,
    Set<(...args: any[]) => void>
  > = new Map();

  private constructor() {
    this.audioContextManager = AudioContextManager.getInstance();
    this.performanceMonitor = PerformanceMonitor.getInstance();
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
   * Get Tone.js transport for advanced scheduling
   */
  public getTransport(): typeof Tone.Transport {
    this.ensureInitialized();
    return this.toneTransport;
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
   * Dispose of the audio engine
   */
  public async dispose(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Stop playback
      await this.stop();

      // Dispose of all audio sources
      this.audioSources.forEach((source) => source.dispose());
      this.audioSources.clear();
      this.sourceConfigs.clear();
      this.soloSources.clear();

      // Dispose of master chain
      this.analyzer?.dispose();
      this.limiter?.dispose();
      this.masterGain?.dispose();

      // Stop performance monitoring
      this.performanceMonitor.stopMonitoring();

      // Dispose audio context
      await this.audioContextManager.dispose();

      this.isInitialized = false;
      this.setState('stopped');
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
}
