/**
 * CorePlaybackEngine - Main Audio Processing Service (Refactored)
 *
 * Provides unified interface for all audio operations (tempo, pitch, volume)
 * with Tone.js integration for low-latency audio processing.
 *
 * Aligned with Epic 2 architecture for n8n payload processing and
 * Supabase CDN asset loading integration.
 *
 * Part of Story 2.1: Core Playback Engine Foundation Module
 */

import { AudioContextManager } from '../../AudioContextManager';
import { PerformanceMonitor } from '../PerformanceMonitor';
import { WorkerPoolManager } from '../WorkerPoolManager';
import { StatePersistenceManager } from '../StatePersistenceManager';
import { N8nPayloadProcessor } from '../N8nPayloadProcessor';
import { AssetManifestProcessor } from '../AssetManifestProcessor';
import { AssetManager } from '../AssetManager';
import { ResourceManager } from '../ResourceManager';
import { UnifiedTransport } from '../core/index.js';
import type { ServiceRegistry } from '../core/index.js';

// Types for TransportObserver implementation
type TransportState = 'stopped' | 'playing' | 'paused';
interface TransportObserver {
  widgetId: string;
  onTransportStart?: () => Promise<void>;
  onTransportStop?: () => void;
  onTransportPause?: () => void;
  onTransportPositionChange?: (position: string) => void;
  onTransportStateChange?: (state: TransportState) => void;
}

import type {
  PlaybackState,
  AudioSourceConfig,
  CorePlaybackEngineConfig,
  CorePlaybackEngineEvents,
  SessionState,
} from './types';

import {
  AudioSourceManager,
  EventManager,
  StateManager,
  ToneManager,
} from './managers';

// TODO: Fix these imports - controllers directory doesn't exist
// import { TransportController, AssetLoadingController } from './controllers';

import type { AudioPerformanceMetrics } from '../PerformanceMonitor';
import type { N8nPayloadConfig } from '../../types/audio';

export class CorePlaybackEngine implements TransportObserver {
  private static instance: CorePlaybackEngine;
  private static isInstantiating = false;

  // Core dependencies
  private audioContextManager: AudioContextManager | null = null;
  private performanceMonitor: PerformanceMonitor | null = null;
  private workerPoolManager: WorkerPoolManager | null = null;
  private statePersistenceManager: StatePersistenceManager | null = null;
  private n8nPayloadProcessor: N8nPayloadProcessor | null = null;
  private assetManifestProcessor: AssetManifestProcessor | null = null;
  private assetManager: AssetManager | null = null;
  private resourceManager: ResourceManager | null = null; // eslint-disable-line @typescript-eslint/no-unused-vars
  // private unifiedTransportController: UnifiedTransportController | null = null; // No longer needed - we use UnifiedTransport

  // Managers
  private eventManager: EventManager;
  private stateManager: StateManager;
  private toneManager: ToneManager;
  private audioSourceManager: AudioSourceManager;

  // Controllers
  private transportController: UnifiedTransport | null = null;
  // private assetLoadingController: AssetLoadingController; // TODO: Implement this controller

  // Transport ID for debugging
  private _transportId = 'no-id'; // eslint-disable-line @typescript-eslint/no-unused-vars

  private constructor() {
    // Initialize event manager first as others depend on it
    this.eventManager = new EventManager();

    // Initialize state manager
    this.stateManager = new StateManager(this.eventManager);

    // Initialize dependencies with graceful degradation for test environments
    this.initializeDependencies();

    // Initialize managers
    this.toneManager = new ToneManager(
      this.audioContextManager,
      this.eventManager,
    );
    this.audioSourceManager = new AudioSourceManager();

    // Initialize controllers
    // UnifiedTransport will be obtained from CoreServices or ServiceRegistry
    this.initializeTransportController();
  }

  private initializeDependencies(): void {
    // Initialize AudioContextManager
    try {
      this.audioContextManager = AudioContextManager.getInstance();
    } catch (error) {
      this.audioContextManager = null;
    }

    // Initialize PerformanceMonitor
    try {
      this.performanceMonitor = PerformanceMonitor.getInstance();
    } catch (error) {
      this.performanceMonitor = null;
    }

    // Initialize WorkerPoolManager
    try {
      this.workerPoolManager = WorkerPoolManager.getInstance();
    } catch (error) {
      this.workerPoolManager = null;
    }

    // Initialize StatePersistenceManager
    try {
      this.statePersistenceManager = StatePersistenceManager.getInstance();
    } catch (error) {
      this.statePersistenceManager = null;
    }

    // Initialize N8nPayloadProcessor
    try {
      this.n8nPayloadProcessor = N8nPayloadProcessor.getInstance();
    } catch (error) {
      this.n8nPayloadProcessor = null;
    }

    // Initialize AssetManifestProcessor
    try {
      this.assetManifestProcessor = AssetManifestProcessor.getInstance();
    } catch (error) {
      this.assetManifestProcessor = null;
    }

    // Initialize AssetManager
    try {
      this.assetManager = AssetManager.getInstance();
    } catch (error) {
      this.assetManager = null;
    }

    // Initialize ResourceManager
    try {
      this.resourceManager = ResourceManager.getInstance();
    } catch (error) {
      this.resourceManager = null;
    }

    // UnifiedTransportController no longer needed - we get UnifiedTransport from core services
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CorePlaybackEngine {
    if (!CorePlaybackEngine.instance) {
      if (CorePlaybackEngine.isInstantiating) {
        throw new Error('CorePlaybackEngine is already being instantiated');
      }
      CorePlaybackEngine.isInstantiating = true;
      try {
        CorePlaybackEngine.instance = new CorePlaybackEngine();
      } finally {
        CorePlaybackEngine.isInstantiating = false;
      }
    }
    return CorePlaybackEngine.instance;
  }

  /**
   * Initialize the engine
   */
  public async initialize(): Promise<void> {
    if (this.stateManager.isInitialized()) {
      return;
    }

    // Silent initialization

    try {
      // Initialize AudioContext through manager
      if (this.audioContextManager) {
        await this.audioContextManager.initialize();
        const contextState = this.audioContextManager.getState();
        this.eventManager.emit('audioContextChange', contextState);
      }

      // Initialize Tone.js
      await this.toneManager.initialize();

      // Pass master gain to audio source manager
      this.audioSourceManager.setMasterGain(this.toneManager.getMasterGain());

      // Initialize performance monitoring if available
      if (this.performanceMonitor && this.audioContextManager) {
        const audioContext = this.audioContextManager.getContext();
        if (audioContext) {
          this.performanceMonitor.initialize(audioContext);
          this.performanceMonitor.startMonitoring();

          // Subscribe to performance alerts
          this.performanceMonitor.onAlert((alert) => {
            this.eventManager.emit('performanceAlert', alert);
          });
        }
      }

      // Initialize worker pool if background processing is enabled
      if (
        this.workerPoolManager &&
        this.stateManager.getConfig().backgroundProcessing?.enableWorkerThreads
      ) {
        await this.workerPoolManager.initialize(
          this.stateManager.getConfig().backgroundProcessing,
        );
      }

      // Initialize state persistence
      if (this.statePersistenceManager) {
        await this.statePersistenceManager.initialize();
      }

      // Initialize transport ID
      const transport = this.toneManager.getTransport();
      this._transportId = transport
        ? `transport-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        : 'no-transport';

      // Get UnifiedTransport from core services
      this.initializeTransportController();
      
      // Note: UnifiedTransport doesn't have register/unregister methods
      // Widgets should use TransportSyncManager for coordination

      // Setup event handlers
      this.setupEventHandlers();

      this.stateManager.setInitialized(true);
      // Engine initialization successful
    } catch (error) {
      console.error('Failed to initialize engine:', error);
      this.stateManager.setInitialized(false);
      throw error;
    }
  }

  /**
   * Setup event handlers for Tone.js transport
   */
  private setupEventHandlers(): void {
    const transport = this.toneManager.getTransport();
    if (!transport) return;

    // Handle transport state changes
    transport.on('start', () => {
      this.stateManager.setPlaybackState('playing');
    });

    transport.on('stop', () => {
      this.stateManager.setPlaybackState('stopped');
    });

    transport.on('pause', () => {
      this.stateManager.setPlaybackState('paused');
    });
  }

  // ============================================================================
  // PUBLIC API - Transport Control
  // ============================================================================

  public async play(): Promise<void> {
    if (!this.transportController) {
      this.initializeTransportController();
      if (!this.transportController) {
        throw new Error('Transport controller not initialized');
      }
    }
    return this.transportController.start();
  }

  public pause(): void {
    if (!this.transportController) {
      this.initializeTransportController();
      if (!this.transportController) {
        throw new Error('Transport controller not initialized');
      }
    }
    this.transportController.pause();
  }

  public stop(): void {
    if (!this.transportController) {
      this.initializeTransportController();
      if (!this.transportController) {
        throw new Error('Transport controller not initialized');
      }
    }
    this.transportController.stop();
  }

  public seek(position: number): void {
    if (!this.transportController) {
      this.initializeTransportController();
      if (!this.transportController) {
        throw new Error('Transport controller not initialized');
      }
    }
    this.transportController.seek(position);
  }

  public seekToMusicalPosition(bars: number, beats = 0, sixteenths = 0): void {
    if (!this.transportController) {
      this.initializeTransportController();
      if (!this.transportController) {
        throw new Error('Transport controller not initialized');
      }
    }
    this.transportController.seekToMusicalPosition(bars, beats, sixteenths);
  }

  // ============================================================================
  // PUBLIC API - Audio Parameters
  // ============================================================================

  public setMasterVolume(volume: number): void {
    this.ensureInitialized();
    this.stateManager.setMasterVolume(volume);
    this.toneManager.updateConfig({
      masterVolume: volume,
      tempo: this.stateManager.getTempo(),
      pitch: this.stateManager.getPitch(),
      swingFactor: this.stateManager.getSwingFactor(),
    });
  }

  public setTempo(bpm: number): void {
    this.ensureInitialized();
    this.stateManager.setTempo(bpm);
    this.toneManager.updateConfig({
      masterVolume: this.stateManager.getMasterVolume(),
      tempo: bpm,
      pitch: this.stateManager.getPitch(),
      swingFactor: this.stateManager.getSwingFactor(),
    });
  }

  public setPitch(semitones: number): void {
    this.ensureInitialized();
    this.stateManager.setPitch(semitones);
    this.toneManager.updateConfig({
      masterVolume: this.stateManager.getMasterVolume(),
      tempo: this.stateManager.getTempo(),
      pitch: semitones,
      swingFactor: this.stateManager.getSwingFactor(),
    });
  }

  // ============================================================================
  // PUBLIC API - Audio Sources
  // ============================================================================

  public registerAudioSource(config: AudioSourceConfig): any {
    this.ensureInitialized();
    const Tone = this.toneManager.getTone();
    if (!Tone) {
      throw new Error('Tone.js not initialized');
    }
    return this.audioSourceManager.registerAudioSource(config, Tone);
  }

  public unregisterAudioSource(sourceId: string): void {
    this.audioSourceManager.unregisterAudioSource(sourceId);
  }

  public setSourceVolume(sourceId: string, volume: number): void {
    this.audioSourceManager.setSourceVolume(sourceId, volume);
  }

  public setSourceMute(sourceId: string, muted: boolean): void {
    this.audioSourceManager.setSourceMute(sourceId, muted);
  }

  public setSourceSolo(sourceId: string, solo: boolean): void {
    this.audioSourceManager.setSourceSolo(sourceId, solo);
  }

  // ============================================================================
  // PUBLIC API - State & Configuration
  // ============================================================================

  public getPlaybackState(): PlaybackState {
    return this.stateManager.getPlaybackState();
  }

  public isInitialized(): boolean {
    return this.stateManager.isInitialized();
  }

  public getConfig(): CorePlaybackEngineConfig {
    return this.stateManager.getConfig();
  }

  public getPerformanceMetrics(): AudioPerformanceMetrics {
    if (this.performanceMonitor) {
      return this.performanceMonitor.getMetrics();
    }
    return {
      latency: 0,
      averageLatency: 0,
      maxLatency: 0,
      dropoutCount: 0,
      bufferUnderruns: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      sampleRate: 44100,
      bufferSize: 128,
      timestamp: Date.now(),
    };
  }

  public getTransport(): any {
    return this.toneManager.getTransport();
  }

  public getTone(): any {
    return this.toneManager.getTone();
  }

  public scheduleAtMusicalTime(
    callback: () => void,
    time: string | number,
  ): number {
    this.ensureInitialized();
    return this.toneManager.scheduleAtMusicalTime(callback, time);
  }

  public cancelAllScheduledEvents(): void {
    this.toneManager.cancelAllScheduledEvents();
  }

  public getCurrentTransportTicks(): number {
    return this.toneManager.getCurrentTransportTicks();
  }

  // ============================================================================
  // PUBLIC API - Event Handling
  // ============================================================================

  public on<K extends keyof CorePlaybackEngineEvents>(
    event: K,
    handler: CorePlaybackEngineEvents[K],
  ): () => void {
    return this.eventManager.on(event, handler);
  }

  public off<K extends keyof CorePlaybackEngineEvents>(
    event: K,
    handler: CorePlaybackEngineEvents[K],
  ): void {
    this.eventManager.off(event, handler);
  }

  // ============================================================================
  // PUBLIC API - Asset Loading
  // ============================================================================

  public async loadN8nPayload(payload: N8nPayloadConfig): Promise<void> {
    // TODO: Implement asset loading controller
    console.warn('Asset loading controller not yet implemented');
    return Promise.resolve();
  }

  public async loadAssetManifests(manifests: any[]): Promise<void> {
    // TODO: Implement asset loading controller
    console.warn('Asset loading controller not yet implemented');
    return Promise.resolve();
  }

  public getAssetLoadingState() {
    // TODO: Implement asset loading controller
    return { isLoading: false, progress: 100, error: null };
  }

  public getAssetLoadingProgress(): number {
    // TODO: Implement asset loading controller
    return 100;
  }

  // ============================================================================
  // PUBLIC API - Background Processing
  // ============================================================================

  public getWorkerPoolMetrics() {
    try {
      if (
        this.workerPoolManager &&
        typeof this.workerPoolManager.getMetrics === 'function'
      ) {
        return this.workerPoolManager.getMetrics();
      } else {
        console.warn(
          '🔧 WorkerPoolManager.getMetrics() not available, likely in test environment',
        );
        return {
          activeWorkers: 0,
          idleWorkers: 0,
          queuedTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          averageTaskTime: 0,
        };
      }
    } catch (error) {
      console.warn(
        '🔧 WorkerPoolManager.getMetrics() failed, likely in test environment:',
        error,
      );
      return {
        activeWorkers: 0,
        idleWorkers: 0,
        queuedTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageTaskTime: 0,
      };
    }
  }

  public isBackgroundProcessingEnabled(): boolean {
    return (
      this.stateManager.getConfig().backgroundProcessing?.enableWorkerThreads ??
      false
    );
  }

  // ============================================================================
  // PUBLIC API - Session Management
  // ============================================================================

  public async saveSession(): Promise<void> {
    if (!this.statePersistenceManager) {
      throw new Error('State persistence not available');
    }

    const position = this.transportController ? this.transportController.getPosition() : 0;
    const state = this.stateManager.getSessionState(position);
    const config = this.stateManager.getConfig();

    // Convert SessionState to PersistedState format
    await this.statePersistenceManager.saveState({
      version: '1.0.0',
      timestamp: state.timestamp,
      sessionId: `session-${Date.now()}`,
      config,
      playbackState: state.playbackState,
      audioSources: [],
      soloSources: [],
      transportState: {
        position: state.position,
        bpm: config.tempo,
        swing: config.swingFactor,
        loop: false,
      },
      performanceHistory: {
        averageLatency: 0,
        maxLatency: 0,
        dropoutCount: 0,
        lastMeasurement: Date.now(),
      },
      userPreferences: {
        masterVolume: config.masterVolume,
        audioQuality: 'high',
        backgroundProcessing:
          config.backgroundProcessing?.enableWorkerThreads || false,
        batteryOptimization:
          config.backgroundProcessing?.batteryOptimization || false,
      },
      metadata: {
        deviceInfo: 'unknown',
        browserInfo:
          typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        lastActiveTime: Date.now(),
        sessionDuration: 0,
      },
    });
  }

  public async restoreSession(): Promise<SessionState | null> {
    if (!this.statePersistenceManager) {
      console.warn('💾 State persistence not available');
      return null;
    }

    try {
      const persistedState = await this.statePersistenceManager.loadState();

      if (persistedState) {
        const sessionState: SessionState = {
          playbackState: persistedState.playbackState,
          config: persistedState.config,
          position: persistedState.transportState.position,
          timestamp: persistedState.timestamp,
        };

        this.stateManager.restoreSessionState(sessionState);
        if (this.transportController) {
          this.transportController.seek(sessionState.position);
        }

        // Update Tone.js configuration
        this.toneManager.updateConfig({
          masterVolume: sessionState.config.masterVolume,
          tempo: sessionState.config.tempo,
          pitch: sessionState.config.pitch,
          swingFactor: sessionState.config.swingFactor,
        });

        return sessionState;
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
    }

    return null;
  }

  public async clearSession(): Promise<void> {
    if (!this.statePersistenceManager) {
      throw new Error('State persistence not available');
    }

    await this.statePersistenceManager.clearState();
  }

  public getStatePersistenceMetrics() {
    try {
      if (
        this.statePersistenceManager &&
        typeof this.statePersistenceManager.getMetrics === 'function'
      ) {
        return this.statePersistenceManager.getMetrics();
      } else {
        console.warn(
          '💾 StatePersistenceManager.getMetrics() not available, likely in test environment',
        );
        return {
          lastSaveTime: null,
          saveCount: 0,
          loadCount: 0,
          storageSize: 0,
        };
      }
    } catch (error) {
      console.warn(
        '💾 StatePersistenceManager.getMetrics() failed, likely in test environment:',
        error,
      );
      return {
        lastSaveTime: null,
        saveCount: 0,
        loadCount: 0,
        storageSize: 0,
      };
    }
  }

  // ============================================================================
  // TRANSPORT OBSERVER IMPLEMENTATION
  // ============================================================================

  public get widgetId(): string {
    return 'core-playback-engine';
  }

  public async onTransportStart(): Promise<void> {
    // Ensure audio context is running
    await this.toneManager.ensureAudioContextStarted();
    // The transport is already started by UnifiedTransportController
    // Just update our state
    this.stateManager.setPlaybackState('playing');
  }

  public onTransportStop(): void {
    this.stateManager.setPlaybackState('stopped');
  }

  public onTransportPause(): void {
    this.stateManager.setPlaybackState('paused');
  }

  public onTransportPositionChange(_position: string): void {
    // Position updates handled by transport itself
    // This is for widgets that need position notifications
  }

  public onTransportStateChange(state: TransportState): void {
    // Map transport state to playback state
    switch (state) {
      case 'playing':
        this.stateManager.setPlaybackState('playing');
        break;
      case 'paused':
        this.stateManager.setPlaybackState('paused');
        break;
      case 'stopped':
        this.stateManager.setPlaybackState('stopped');
        break;
    }
  }

  /**
   * Execute MIDI Panic - Professional DAW-style all notes off
   * @private Currently unused but kept for future implementation
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async executeMidiPanic(): Promise<void> {
    try {
      // Cancel all scheduled Transport events
      this.toneManager.cancelAllScheduledEvents();

      // Get current audio context and master gain
      const Tone = this.toneManager.getTone();
      const masterGain = this.toneManager.getMasterGain();
      const transport = this.toneManager.getTransport();

      if (Tone && masterGain && transport) {
        // Momentarily mute master gain
        const originalGain = masterGain.gain.value;
        const audioContext = Tone.getContext();
        masterGain.gain.setValueAtTime(0, audioContext.currentTime);
        masterGain.gain.setValueAtTime(
          originalGain,
          audioContext.currentTime + 0.1,
        );
      }

      // TODO: Implement source-specific panic when audio sources support it
    } catch (error) {
      console.error('MIDI PANIC failed:', error);
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private ensureInitialized(): void {
    if (!this.stateManager.isInitialized()) {
      throw new Error(
        'CorePlaybackEngine not initialized. Call initialize() first.',
      );
    }
  }

  /**
   * Initialize transport controller from core services
   */
  private initializeTransportController(): void {
    // Try to get UnifiedTransport from CoreServices first
    const coreServices = (window as any).__coreServices;
    if (coreServices) {
      try {
        this.transportController = coreServices.getUnifiedTransport() as UnifiedTransport;
        console.log('CorePlaybackEngine: Got UnifiedTransport from CoreServices');
        return;
      } catch (error) {
        console.warn('CorePlaybackEngine: Failed to get UnifiedTransport from CoreServices:', error);
      }
    }
    
    // Fallback to ServiceRegistry
    const registry = (window as any).__serviceRegistry as ServiceRegistry;
    if (registry) {
      try {
        this.transportController = registry.get('transportController') as UnifiedTransport;
        console.log('CorePlaybackEngine: Got UnifiedTransport from ServiceRegistry');
        return;
      } catch (error) {
        console.warn('CorePlaybackEngine: Failed to get UnifiedTransport from ServiceRegistry:', error);
      }
    }
    
    console.warn('CorePlaybackEngine: Could not obtain UnifiedTransport from any source');
  }

  /**
   * Dispose of all resources
   */
  public async dispose(): Promise<void> {
    // Stop playback
    if (this.stateManager.getPlaybackState() !== 'stopped') {
      this.stop();
    }

    // Note: UnifiedTransport doesn't have unregister method
    // Cleanup is handled by TransportSyncManager

    // Dispose managers
    this.audioSourceManager.dispose();
    this.toneManager.dispose();

    // Clear event listeners
    this.eventManager.removeAllListeners();

    // Dispose other services
    if (this.performanceMonitor) {
      this.performanceMonitor.stopMonitoring();
    }

    if (this.workerPoolManager) {
      await this.workerPoolManager.dispose();
    }

    // Clear references
    this.audioContextManager = null;
    this.performanceMonitor = null;
    this.workerPoolManager = null;
    this.statePersistenceManager = null;
    this.n8nPayloadProcessor = null;
    this.assetManifestProcessor = null;
    this.assetManager = null;
    this.resourceManager = null;
    // this.unifiedTransportController = null; // No longer used

    this.stateManager.setInitialized(false);
  }
}

// Export types
export type {
  PlaybackState,
  AudioSourceType,
  AudioSourceConfig,
  CorePlaybackEngineConfig,
  CorePlaybackEngineEvents,
} from './types';
