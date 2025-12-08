/**
 * CoreServices - Central Service Integration
 * Story 3.18.2: Core Services Foundation
 *
 * Wires all 5 core services together through ServiceRegistry.
 * Provides a single entry point for initializing the entire
 * playback domain architecture.
 */

import { ServiceRegistry } from './ServiceRegistry.js';
import { EventBus } from './EventBus.js';
import { AudioEngine } from '../../modules/audio-engine/core/AudioEngine.js';
import { TransportAdapter } from './TransportAdapter.js';
import { TransportSyncManager } from './TransportSyncManager.js';
import { PluginManager, registerExistingPlugins } from './PluginManager.js';
import { AudioEventRouter } from './AudioEventRouter.js';
import { InstrumentRegistry } from './InstrumentRegistry.js';
// Phase 3.2: RegionProcessor deleted - PlaybackEngine is at 100% rollout
// Phase 3.3: RegionProcessorAdapter deleted - all widgets use PlaybackEngine directly
import { PlaybackEngine } from './PlaybackEngine.js';
import { AudioDebugger } from './AudioDebugger.js';
import { getLogger } from '@/utils/logger.js';
import { getPreloadableRegistry } from './PreloadableInstrumentRegistry.js';
import {
  isNewPlaybackEngineEnabled,
  logPlaybackEngineMigrationEvent,
} from '../../config/featureFlags.js';
import { WindowRegistry } from '../WindowRegistry.js';

export interface CoreServicesConfig {
  enableHighPrecisionTiming?: boolean;
  enablePerformanceMonitoring?: boolean;
  autoLoadPlugins?: boolean;
  audioLatencyHint?: 'interactive' | 'balanced' | 'playback';
  sampleRate?: number;
}

export class CoreServicesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoreServicesError';
  }
}

export class CoreServices {
  private registry: ServiceRegistry;
  private eventBus: EventBus;
  private audioEngine: AudioEngine;
  private unifiedTransport: TransportAdapter;
  private transportSyncManager: TransportSyncManager;
  private pluginManager: PluginManager;
  private audioEventRouter: AudioEventRouter;
  private instrumentRegistry: InstrumentRegistry;
  // Phase 3.2: regionProcessor property removed - RegionProcessor deleted
  private playbackEngine: PlaybackEngine | null = null; // Phase 1 Task 1.4: New PlaybackEngine (feature flag)
  private isInitialized = false;
  private isPreInitialized = false;
  private config: Required<CoreServicesConfig>;

  constructor(config: CoreServicesConfig = {}) {
    this.config = {
      enableHighPrecisionTiming: true,
      enablePerformanceMonitoring: true,
      autoLoadPlugins: true,
      audioLatencyHint: 'interactive',
      sampleRate: 48000,
      ...config,
    };

    // Create service registry
    this.registry = new ServiceRegistry();

    // Create core services
    this.eventBus = new EventBus();
    console.log('🏗️ [CoreServices] EventBus created', {
      eventBusId: (this.eventBus as any)._instanceId || 'no-id',
    });
    this.audioEngine = new AudioEngine(this.eventBus, {
      sampleRate: this.config.sampleRate,
      latencyHint: this.config.audioLatencyHint,
    });
    this.unifiedTransport = TransportAdapter.getInstance(
      this.eventBus,
      this.audioEngine,
      {
        enableWebWorker: this.config.enableHighPrecisionTiming,
        enableAudioWorklet: this.config.enableHighPrecisionTiming,
        driftCompensation: 'basic',
        bufferStrategy: 'adaptive',
      },
    );
    this.transportSyncManager = TransportSyncManager.getInstance();
    this.pluginManager = new PluginManager(this.audioEngine, this.eventBus);
    this.audioEventRouter = new AudioEventRouter();
    this.instrumentRegistry = new InstrumentRegistry(this.eventBus);

    // Phase 3.2: PlaybackEngine is at 100% rollout - always created, no feature flag check
    this.playbackEngine = new PlaybackEngine(this.eventBus, {
      countdownBeats: 4,
      countdownEnabled: false,
      lookAheadTime: 0.1,
    });
    logPlaybackEngineMigrationEvent('PlaybackEngine created', {
      instanceId: (this.playbackEngine as any).instanceId,
    });

    // Register PlaybackEngine in WindowRegistry for debugging
    WindowRegistry.setPlaybackEngine(this.playbackEngine);

    // Register services with dependencies
    this.registerServices();

    // Set up event listeners for transport state changes
    this.setupEventListeners();
  }

  /**
   * Pre-initialize core services (loads Tone.js but doesn't create AudioContext)
   * Can be called during page load without user interaction
   */
  async preInitialize(): Promise<void> {
    if (this.isPreInitialized || this.isInitialized) {
      return;
    }

    try {
      logger.info('CoreServices: Starting pre-initialization...');

      // Pre-initialize AudioEngine (loads Tone.js, no AudioContext)
      logger.info('CoreServices: Pre-initializing AudioEngine...');
      await this.audioEngine.preInitialize();
      logger.info('CoreServices: AudioEngine pre-initialized (Tone.js loaded)');

      // 🔧 FIX: Register plugins early to prevent race condition with widgets
      // Widgets need plugins to be available before they mount
      if (this.config.autoLoadPlugins) {
        logger.info('CoreServices: Registering plugins during pre-initialization...');
        await registerExistingPlugins(this.pluginManager);
        logger.info('CoreServices: Plugins registered during pre-initialization');
      }

      this.isPreInitialized = true;
      logger.info('CoreServices: Pre-initialization complete (plugins ready)!');

      this.eventBus.emit('core-services:pre-initialized', {
        services: ['eventBus', 'audioEngine', 'pluginManager'],
      });
    } catch (error) {
      logger.error('CoreServices: Pre-initialization failed:', error as Error);
      throw new CoreServicesError(
        `Failed to pre-initialize CoreServices: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Initialize all core services
   * MUST be called from a user gesture (e.g., button click) if not pre-initialized
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('CoreServices: Starting full initialization...');

      // Pre-initialize if not done already
      if (!this.isPreInitialized) {
        await this.preInitialize();
      }

      // Initialize PreloadableInstrumentRegistry early so configs can be registered
      logger.info(
        'CoreServices: Initializing PreloadableInstrumentRegistry...',
      );
      getPreloadableRegistry().initialize(this.eventBus, this.audioEngine);
      logger.info('CoreServices: PreloadableInstrumentRegistry initialized');

      // Ensure AudioEngine is fully initialized first (must be called from user gesture)
      console.log('[DEBUG-INIT] 🔍 About to call audioEngine.initialize()...');
      logger.info('CoreServices: Fully initializing AudioEngine...');
      await this.audioEngine.initialize();
      console.log('[DEBUG-INIT] ✅ audioEngine.initialize() completed!');
      logger.info('CoreServices: AudioEngine fully initialized');

      // Initialize service registry (handles dependency order)
      console.log('[DEBUG-INIT] 🔍 About to call registry.initialize()...');
      logger.info('CoreServices: Initializing service registry...');
      await this.registry.initialize();
      console.log('[DEBUG-INIT] ✅ registry.initialize() completed!');
      logger.info('CoreServices: Service registry initialized');

      // NOTE: WamKeyboardPlugin is registered during preInitialize() but NOT eagerly loaded
      // The plugin will be loaded lazily when HarmonyWidget first needs it
      // This prevents race conditions with React mounting and StrictMode double-mounting
      console.log('[MILESTONE] 🎹 STEP 2.5: WamKeyboardPlugin registered (will load on-demand)');

      // Initialize TransportSyncManager after registry (it's not a registered service)
      logger.info('CoreServices: Initializing TransportSyncManager...');
      this.transportSyncManager.initialize(
        this.unifiedTransport,
        this.eventBus,
      );
      logger.info('CoreServices: TransportSyncManager initialized');

      // Register existing plugins if auto-load is enabled
      // Note: This is idempotent - safe to call even if already registered in preInitialize()
      if (this.config.autoLoadPlugins) {
        logger.info('CoreServices: Ensuring plugins are registered...');
        await registerExistingPlugins(this.pluginManager);
        logger.info('CoreServices: Plugins registration confirmed');
      }

      // Initialize AudioEventRouter with EventBus and AudioEngine
      logger.info('CoreServices: Initializing AudioEventRouter...');
      AudioDebugger.getInstance().log(
        'CoreServices',
        'initializing-audio-event-router',
      );
      await this.audioEventRouter.initialize(this.eventBus, this.audioEngine);
      logger.info('CoreServices: AudioEventRouter initialized');

      // Start AudioEventRouter to begin listening for trigger events
      logger.info('CoreServices: Starting AudioEventRouter...');
      AudioDebugger.getInstance().log(
        'CoreServices',
        'starting-audio-event-router',
      );
      await this.audioEventRouter.start();
      logger.info(
        'CoreServices: AudioEventRouter started and listening for events',
      );
      AudioDebugger.getInstance().log(
        'CoreServices',
        'audio-event-router-started',
      );

      const audioContext = await this.audioEngine.getContext();

      // Phase 1 Task 1.4: Initialize PlaybackEngine if feature flag is enabled
      if (this.playbackEngine) {
        logger.info('CoreServices: Initializing PlaybackEngine...');
        await this.playbackEngine.initialize(
          audioContext,
          audioContext.destination,
        );

        // Inject PluginManager for CC64 routing
        this.playbackEngine.setPluginManager(this.pluginManager);

        logPlaybackEngineMigrationEvent('PlaybackEngine initialized', {
          instanceId: (this.playbackEngine as any).instanceId,
          state: this.playbackEngine.getState(),
        });
        logger.info('CoreServices: PlaybackEngine initialized and ready');
      } else if (this.regionProcessor) {
        // Legacy path: Initialize RegionProcessor if PlaybackEngine is disabled
        logger.info('CoreServices: Setting AudioContext on RegionProcessor...');
        this.regionProcessor.setAudioContext(audioContext);
        logger.info(
          'CoreServices: RegionProcessor configured with AudioContext for sample-accurate timing',
        );

        // Inject PluginManager for accessing WamKeyboard (sustain pedal routing)
        this.regionProcessor.setPluginManager(this.pluginManager);
        logger.info(
          'CoreServices: PluginManager injected into RegionProcessor for CC event routing',
        );
      }

      // FAANG SOLUTION: Inject audio buffers for direct scheduling
      // This enables sample-perfect audio rendering by bypassing JavaScript callback timing
      // Both RegionProcessor (legacy) and PlaybackEngine need these buffers
      console.log('[CORESERVICES-BUFFER-INJECTION] Checking condition:', {
        hasRegionProcessor: !!this.regionProcessor,
        hasPlaybackEngine: !!this.playbackEngine,
        willInject: !!(this.regionProcessor || this.playbackEngine),
      });

      if (this.regionProcessor || this.playbackEngine) {
        console.log('[CORESERVICES-BUFFER-INJECTION] Starting buffer injection...');
        logger.info(
          'CoreServices: Injecting audio buffers for direct scheduling...',
        );
        const { GlobalSampleCache } = await import(
          '../../modules/storage/cache/GlobalSampleCache.js'
        );
        const sampleCache = GlobalSampleCache.getInstance();
        console.log('[CORESERVICES-BUFFER-INJECTION] Got GlobalSampleCache instance');

        // Inject metronome buffers for countdown
        // Note: Samples are cached as raw ArrayBuffers, need to decode first
        let accentBuffer = sampleCache.getCachedBuffer('metronome-high');
        let clickBuffer = sampleCache.getCachedBuffer('metronome-low');

        // Decode from raw if not already decoded
        if (!accentBuffer) {
          const rawAccent = await sampleCache.getCachedRawBuffer('metronome-high');
          if (rawAccent) {
            accentBuffer = await audioContext.decodeAudioData(rawAccent.slice(0));
            await sampleCache.cacheBuffer('metronome-high', accentBuffer, { isContextCompatible: true });
          }
        }

        if (!clickBuffer) {
          const rawClick = await sampleCache.getCachedRawBuffer('metronome-low');
          if (rawClick) {
            clickBuffer = await audioContext.decodeAudioData(rawClick.slice(0));
            await sampleCache.cacheBuffer('metronome-low', clickBuffer, { isContextCompatible: true });
          }
        }

        if (accentBuffer && clickBuffer && this.playbackEngine) {
          this.playbackEngine.setMetronomeBuffers(accentBuffer, clickBuffer, audioContext.destination);
          logger.info('✅ CoreServices: Metronome buffers injected for countdown');
        }

        // Inject drum buffers
        const kickBuffer = sampleCache.getCachedBuffer('drum-kick');
        const snareBuffer = sampleCache.getCachedBuffer('drum-snare');
        const hihatBuffer = sampleCache.getCachedBuffer('drum-hihat');

        if (kickBuffer && snareBuffer && hihatBuffer) {
          if (this.regionProcessor) {
            this.regionProcessor.setDrumBuffers(
              kickBuffer,
              snareBuffer,
              hihatBuffer,
              audioContext.destination,
            );
          }
          // Note: PlaybackEngine doesn't have setDrumBuffers yet - drums handled by DrummerWidget
          logger.info(
            '✅ CoreServices: Drum buffers injected - direct audio scheduling enabled',
          );
        } else {
          logger.warn(
            '⚠️ CoreServices: Drum buffers not found in cache - will fall back to event bus',
          );
          logger.warn('Drum buffer status:', {
            kickBuffer: kickBuffer ? 'found' : 'missing',
            snareBuffer: snareBuffer ? 'found' : 'missing',
            hihatBuffer: hihatBuffer ? 'found' : 'missing',
          });
        }

        // Inject voice cue buffers
        const voiceCueBuffers = new Map<string, AudioBuffer>();
        const cues = ['one', 'two', 'three', 'four'];
        let voiceCuesFound = 0;

        for (const cue of cues) {
          const buffer = sampleCache.getCachedBuffer(`voice-cue-${cue}`);
          if (buffer) {
            voiceCueBuffers.set(cue, buffer);
            voiceCuesFound++;
          }
        }

        if (voiceCuesFound === cues.length) {
          if (this.regionProcessor) {
            this.regionProcessor.setVoiceCueBuffers(
              voiceCueBuffers,
              audioContext.destination,
            );
          }
          if (this.playbackEngine) {
            const voiceCueRecord: Record<string, AudioBuffer> = {};
            voiceCueBuffers.forEach((buffer, key) => {
              voiceCueRecord[key] = buffer;
            });
            this.playbackEngine.setVoiceCueBuffers(
              voiceCueRecord,
              audioContext.destination,
            );
          }
          logger.info(
            '✅ CoreServices: Voice cue buffers injected - countdown guidance enabled',
          );
      } else {
        logger.warn(
          '⚠️ CoreServices: Some voice cue buffers not found in cache - countdown may be silent',
        );
        logger.debug('Voice cue buffer status:', {
          found: voiceCuesFound,
          total: cues.length,
          missing: cues.filter(
            (cue) => !sampleCache.getCachedBuffer(`voice-cue-${cue}`),
          ),
        });
      }

      // Inject harmony buffers (Wurlitzer/Grand Piano samples)
      // CRITICAL FIX: Use sharp notation (Cs, Ds, Fs, Gs, As) to match HarmonyPreloadStrategy
      // Try multiple instrument prefixes since we don't know which instrument was preloaded
      const harmonyBuffers = new Map<string, AudioBuffer>();
      const layers = ['v2', 'v3', 'v4', 'v5', 'v6', 'v7']; // Velocity layers (wurlitzer uses v2-v5, grandpiano uses v4-v7)
      const notes = [
        'C',
        'Cs',
        'D',
        'Ds',
        'E',
        'F',
        'Fs',
        'G',
        'Gs',
        'A',
        'As',
        'B',
      ]; // Sharp notation
      const octaves = [2, 3, 4, 5, 6]; // Typical piano range
      const instrumentPrefixes = [
        'wurlitzer',
        'grandpiano',
        'rhodes',
        'harmony',
      ]; // Try all possible prefixes
      let harmonyBuffersFound = 0;

      for (const layer of layers) {
        for (const octave of octaves) {
          for (const note of notes) {
            const noteName = `${note}${octave}`;

            // Try each instrument prefix until we find a cached buffer
            let buffer: AudioBuffer | undefined;
            for (const prefix of instrumentPrefixes) {
              const cacheKey = `${prefix}-${layer}-${noteName}`;
              buffer = sampleCache.getCachedBuffer(cacheKey);
              if (buffer) {
                break; // Found it!
              }
            }

            if (buffer) {
              // RegionProcessor expects key format: 'v3-C4' (without instrument prefix)
              harmonyBuffers.set(`${layer}-${noteName}`, buffer);
              harmonyBuffersFound++;
            }
          }
        }
      }

      if (harmonyBuffersFound > 0) {
        this.regionProcessor.setHarmonyBuffers(
          harmonyBuffers,
          audioContext.destination,
        );
        logger.info(
          '✅ CoreServices: Harmony buffers injected - direct harmony scheduling enabled',
          {
            buffersFound: harmonyBuffersFound,
            layers: layers.length,
          },
        );
      } else {
        logger.warn(
          '⚠️ CoreServices: No harmony buffers found in cache - will fall back to event bus',
        );
      }

        // Note: RegionProcessor will be started when transport starts (via event listener)
        logger.info(
          'CoreServices: RegionProcessor initialized (will start with transport)',
        );
        AudioDebugger.getInstance().log('CoreServices', 'region-processor-ready');
      } // End of RegionProcessor buffer injection guard

      this.isInitialized = true;
      logger.info('CoreServices: Full initialization complete!');

      this.eventBus.emit('core-services:initialized', {
        services: [
          'eventBus',
          'audioEngine',
          'unifiedTransport',
          'transportSyncManager',
          'pluginManager',
          'audioEventRouter',
          'regionProcessor',
        ],
      });
    } catch (error) {
      logger.error('CoreServices: Full initialization failed:', error as Error);
      throw new CoreServicesError(
        `Failed to initialize CoreServices: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Start all services
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new CoreServicesError(
        'CoreServices not initialized. Call initialize() first.',
      );
    }

    try {
      await this.registry.start();
      this.eventBus.emit('core-services:started', {});
    } catch (error) {
      throw new CoreServicesError(
        `Failed to start CoreServices: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Stop all services
   */
  async stop(): Promise<void> {
    try {
      // Stop RegionProcessor or PlaybackEngine first (they're generating events)
      if (this.regionProcessor) {
        this.regionProcessor.stop();
      }
      if (this.playbackEngine) {
        this.playbackEngine.stop();
      }
      // Stop AudioEventRouter (it depends on other services)
      await this.audioEventRouter.stop();
      await this.registry.stop();
      this.eventBus.emit('core-services:stopped', {});
    } catch (error) {
      throw new CoreServicesError(
        `Failed to stop CoreServices: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Dispose all services
   */
  async dispose(): Promise<void> {
    try {
      // Phase 1 Task 1.4: Dispose PlaybackEngine if it exists
      if (this.playbackEngine) {
        logger.info('CoreServices: Disposing PlaybackEngine...');
        this.playbackEngine.dispose();
        this.playbackEngine = null;
        logPlaybackEngineMigrationEvent('PlaybackEngine disposed');
      }

      await this.registry.dispose();
      this.isInitialized = false;
      this.eventBus.emit('core-services:disposed', {});
    } catch (error) {
      throw new CoreServicesError(
        `Failed to dispose CoreServices: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get service instances
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  getAudioEngine(): AudioEngine {
    return this.audioEngine;
  }

  getUnifiedTransport(): TransportAdapter {
    return this.unifiedTransport;
  }

  /**
   * Phase 3.3: Get PlaybackEngine instance (ONLY playback engine)
   * RegionProcessor and RegionProcessorAdapter have been deleted
   */
  getPlaybackEngine(): PlaybackEngine | null {
    return this.playbackEngine;
  }

  getTransportSyncManager(): TransportSyncManager {
    return this.transportSyncManager;
  }

  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  getAudioEventRouter(): AudioEventRouter {
    return this.audioEventRouter;
  }

  getServiceRegistry(): ServiceRegistry {
    return this.registry;
  }

  getInstrumentRegistry(): InstrumentRegistry {
    return this.instrumentRegistry;
  }

  /**
   * Check if services are initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get service status
   */
  getStatus(): Record<string, any> {
    return {
      initialized: this.isInitialized,
      services: {
        eventBus: { ready: true },
        audioEngine: {
          ready: this.audioEngine.getContext() !== null,
          sampleRate: this.audioEngine.getContext()?.sampleRate,
        },
        unifiedTransport: {
          ready: true,
          state: this.unifiedTransport.getState(),
          tempo: this.unifiedTransport.getTempo(),
          metrics: this.unifiedTransport.getMetrics(),
        },
        transportSyncManager: {
          ready: true,
          connectedClients:
            this.transportSyncManager.getConnectedClients().length,
          metrics: this.transportSyncManager.getMetrics(),
        },
        pluginManager: {
          ready: true,
          pluginCount: this.pluginManager.getAllPlugins().size,
        },
      },
      config: this.config,
    };
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for transport stop to stop all audio playback components
    this.eventBus.on(
      'transport:stop',
      async (data: { timestamp: number; graceful?: boolean }) => {
        const graceful = data.graceful ?? false;
        logger.info('Transport stopped, stopping all audio components', {
          graceful,
        });

        // Stop RegionProcessor or PlaybackEngine with graceful flag
        // graceful=true (auto-stop): Let one-shot drums/metronome finish naturally
        // graceful=false (manual stop): Force-stop all audio immediately
        if (this.regionProcessor) {
          this.regionProcessor.stop(graceful);
        }
        if (this.playbackEngine) {
          this.playbackEngine.stop(graceful);
        }

        // CRITICAL FIX: Stop AudioEventRouter (prevents new triggers from being routed)
        await this.audioEventRouter.stop();
        logger.info('AudioEventRouter stopped');

        // CRITICAL FIX: Stop PluginManager (stops all active WAM plugins)
        // This stops WamDrummer, WamMetronome, WamKeyboard, WamHarmonyProcessor
        await this.pluginManager.stop();
        logger.info('PluginManager stopped - all WAM plugins cleared');
      },
    );

    // Listen for transport start to restart audio components
    // This ensures second/third/etc playback rounds work the same as first playback
    this.eventBus.on('transport:start', async () => {
      logger.info('Transport starting, restarting audio components');

      // Restart AudioEventRouter if it was stopped
      // This allows drum/metronome/harmony triggers to flow through again
      const routerStatus = this.audioEventRouter.getStatus();
      if (!routerStatus.isRunning) {
        await this.audioEventRouter.start();
        logger.info('AudioEventRouter restarted');
      } else {
        logger.debug('AudioEventRouter already running, no restart needed');
      }

      // Restart PluginManager to re-activate WAM plugins
      try {
        await this.pluginManager.start();
        logger.info('PluginManager restarted - WAM plugins ready');
      } catch (error) {
        logger.error('Failed to restart PluginManager:', error);
      }
    });

    // NOTE: RegionProcessor start is managed by GlobalControls, not by event listener
    // This is because tracks are registered asynchronously by widgets (MetronomeWidget)
    // AFTER transport starts, so we need to start RegionProcessor before transport.start()
    // Keeping this event listener would cause double-scheduling of all events!
  }

  /**
   * Register services with proper dependencies
   */
  private registerServices(): void {
    // EventBus has no dependencies
    this.registry.register('eventBus', this.eventBus, []);

    // AudioEngine depends on EventBus
    this.registry.register('audioEngine', this.audioEngine, ['eventBus']);

    // UnifiedTransport depends on AudioEngine and EventBus
    this.registry.register('unifiedTransport', this.unifiedTransport as any, [
      'audioEngine',
      'eventBus',
    ]);

    // TransportSyncManager is NOT registered - it's initialized manually after registry
    // because it requires parameters for initialization

    // PluginManager depends on AudioEngine and EventBus
    this.registry.register('pluginManager', this.pluginManager, [
      'audioEngine',
      'eventBus',
    ]);

    // AudioEventRouter depends on EventBus and AudioEngine
    // It listens to events and plays audio samples
    this.registry.register('audioEventRouter', this.audioEventRouter, [
      'eventBus',
      'audioEngine',
    ]);

    // InstrumentRegistry depends only on EventBus
    this.registry.register('instrumentRegistry', this.instrumentRegistry, [
      'eventBus',
    ]);
  }
}

/**
 * Global Audio System Singleton - FAANG Best Practice
 * Ensures only one audio system exists per application lifecycle
 * Survives React component re-mounts and StrictMode double-mounting
 */
class GlobalAudioSystem {
  private static instance: CoreServices | null = null;
  private static initializationPromise: Promise<CoreServices> | null = null;
  private static isDisposing = false;

  /**
   * Get the global CoreServices instance (pre-initialized)
   * Safe to call multiple times - always returns the same instance
   */
  static async getPreInitializedInstance(
    config?: CoreServicesConfig,
  ): Promise<CoreServices> {
    // Prevent creation during disposal
    if (GlobalAudioSystem.isDisposing) {
      throw new Error(
        'GlobalAudioSystem is being disposed, cannot create new instance',
      );
    }

    // Return existing instance if available
    if (GlobalAudioSystem.instance) {
      logger.info(
        'GlobalAudioSystem: Returning existing pre-initialized instance',
      );
      return GlobalAudioSystem.instance;
    }

    // Return existing initialization promise if in progress
    if (GlobalAudioSystem.initializationPromise) {
      logger.info(
        'GlobalAudioSystem: Waiting for existing initialization to complete',
      );
      return GlobalAudioSystem.initializationPromise;
    }

    // Create new instance
    logger.info('GlobalAudioSystem: Creating new pre-initialized instance');
    GlobalAudioSystem.initializationPromise = (async () => {
      const services = new CoreServices(config);
      await services.preInitialize();

      // Store globally for cross-component access
      GlobalAudioSystem.instance = services;
      (window as any).__globalCoreServices = services;

      return services;
    })();

    try {
      const instance = await GlobalAudioSystem.initializationPromise;
      GlobalAudioSystem.initializationPromise = null;
      return instance;
    } catch (error) {
      GlobalAudioSystem.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Get the current instance without creating a new one
   */
  static getCurrentInstance(): CoreServices | null {
    return GlobalAudioSystem.instance;
  }

  /**
   * Check if the global system is initialized
   */
  static isInitialized(): boolean {
    return GlobalAudioSystem.instance !== null;
  }

  /**
   * Dispose the global audio system
   * Should only be called on app shutdown
   */
  static async dispose(): Promise<void> {
    if (!GlobalAudioSystem.instance) {
      return;
    }

    logger.info('GlobalAudioSystem: Disposing global audio system');
    GlobalAudioSystem.isDisposing = true;

    try {
      await GlobalAudioSystem.instance.dispose();
      GlobalAudioSystem.instance = null;
      delete (window as any).__globalCoreServices;
      logger.info(
        'GlobalAudioSystem: Global audio system disposed successfully',
      );
    } finally {
      GlobalAudioSystem.isDisposing = false;
    }
  }

  /**
   * Reset the global system (for testing only)
   * @internal
   */
  static _resetForTesting(): void {
    GlobalAudioSystem.instance = null;
    GlobalAudioSystem.initializationPromise = null;
    GlobalAudioSystem.isDisposing = false;
    delete (window as any).__globalCoreServices;
  }
}

// Create logger at module level
const logger = getLogger('CoreServices');

/**
 * Factory function to get pre-initialized core services (FAANG best practice)
 * Always returns the same global instance - safe for React re-mounts
 * This only loads Tone.js, doesn't create AudioContext
 */

export async function createCoreServicesWithPreInit(
  config?: CoreServicesConfig,
): Promise<CoreServices> {
  return GlobalAudioSystem.getPreInitializedInstance(config);
}

/**
 * Factory function to create and fully initialize core services
 * MUST be called from a user gesture if AudioContext needs to be created
 * @deprecated Use GlobalAudioSystem pattern instead for better lifecycle management
 */
export async function createCoreServices(
  config?: CoreServicesConfig,
): Promise<CoreServices> {
  const services = new CoreServices(config);
  await services.initialize();
  return services;
}

/**
 * Export the GlobalAudioSystem for advanced use cases
 */
export { GlobalAudioSystem };

/**
 * Export all core service types
 */
export { ServiceRegistry } from './ServiceRegistry.js';
export { EventBus } from './EventBus.js';
export { AudioEngine } from '../../modules/audio-engine/core/AudioEngine.js';
// export { UnifiedTransport } from './UnifiedTransport.js'; // Replaced by TransportAdapter
export { TransportAdapter } from './TransportAdapter.js';
export { TransportSyncManager } from './TransportSyncManager.js';
export { PluginManager } from './PluginManager.js';
export { InstrumentRegistry } from './InstrumentRegistry.js';

// Export types
export type { Service } from './ServiceRegistry.js';
export type { EventData, EventHandler } from './EventBus.js';
export type {
  AudioEngineConfig,
  AudioSampler,
} from '../../modules/audio-engine/types/index.js';

export type {
  TransportConfig,
  TransportState,
  MusicalPosition,
  TimingEvent,
  TimingMetrics,
} from '../../modules/transport/types/index.js';
export type { PluginRegistration } from './PluginManager.js';
export type { InstrumentType } from './InstrumentRegistry.js';
