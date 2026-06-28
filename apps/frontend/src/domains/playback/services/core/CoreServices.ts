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
import { BeatEmitter, getBeatEmitter } from './BeatEmitter.js';
import { getLogger } from '@/utils/logger.js';
import { getPreloadableRegistry } from './PreloadableInstrumentRegistry.js';
import {
  isNewPlaybackEngineEnabled,
  logPlaybackEngineMigrationEvent,
} from '../../config/featureFlags.js';
import { WindowRegistry } from '../WindowRegistry.js';
import { RecoveryEventHandlers } from './RecoveryEventHandlers.js';
import { lifecycle } from '../../utils/InitializationLifecycleLogger.js';
import { Mixer } from '../../modules/tracks/mixing/Mixer.js';

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
  // Phase 3.2: RegionProcessor deleted. Phase 5b.5 (2026-05-17):
  // last zombie `this.regionProcessor` references in this file were
  // removed; harmony/drum/voice-cue buffer injection now routes only
  // to PlaybackEngine.
  private playbackEngine: PlaybackEngine | null = null;
  private recoveryHandlers: RecoveryEventHandlers | null = null; // Handles recovery events from ErrorRecoveryRegistry
  private beatEmitter: BeatEmitter | null = null; // Audio-synchronized beat events via Tone.Draw
  private isInitialized = false;
  private isPreInitialized = false;
  private hasSamplesReadyListener = false; // Track if we've set up the deferred buffer injection listener
  private config: Required<CoreServicesConfig>;
  private eventSubscriptions: Array<() => void> = []; // Store unsubscribe functions to prevent event listener leaks
  private samplesReadyHandler: (() => void) | null = null; // Store samplesReady handler for cleanup
  // De-dupe concurrent reinjectAllBuffers calls. samplesReady is dispatched
  // by 3 different places (ScrollTriggerLoader, InitialSamplePreloader,
  // useActAwarePreload) and used to fire reinjection in parallel — three
  // decodes racing on the same shared ArrayBuffer would detach it. Now the
  // second + third callers await the first promise instead.
  private reinjectionPromise: Promise<void> | null = null;

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
        logger.info(
          'CoreServices: Registering plugins during pre-initialization...',
        );
        await registerExistingPlugins(this.pluginManager);
        logger.info(
          'CoreServices: Plugins registered during pre-initialization',
        );
      }

      // ✅ FAANG-STYLE FIX: Set up samplesReady listener early (doesn't need AudioContext)
      // This guarantees the fast path by ensuring listener exists before samples finish loading
      this.setupDeferredBufferInjection();

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

      // Initialize service registry FIRST (handles dependency order)
      // This ensures EventBus is available for Mixer and other services
      console.log('[DEBUG-INIT] 🔍 About to call registry.initialize()...');
      logger.info('CoreServices: Initializing service registry...');
      await this.registry.initialize();
      console.log('[DEBUG-INIT] ✅ registry.initialize() completed!');
      logger.info('CoreServices: Service registry initialized');

      // Set global registry IMMEDIATELY after initialization
      // This allows singletons like Mixer to access EventBus via window.__serviceRegistry
      if (typeof window !== 'undefined') {
        window.__serviceRegistry = this.registry;
        logger.debug('CoreServices: Global __serviceRegistry set');
      }

      // Initialize Mixer AFTER registry so EventBus is available
      // The Mixer needs Tone.js (from AudioEngine) and EventBus (from registry)
      logger.info('CoreServices: Initializing Mixer (master bus)...');
      try {
        Mixer.getInstance();
        logger.info('CoreServices: Mixer initialized with master bus');
        console.log('[DEBUG-INIT] ✅ Mixer initialized with master bus');
      } catch (mixerError) {
        logger.warn(
          'CoreServices: Failed to initialize Mixer (will initialize on demand)',
          mixerError,
        );
      }

      // Initialize RecoveryEventHandlers to wire up recovery strategies from ErrorRecoveryRegistry
      // This fixes the "dead recovery strategies" issue where events were emitted but nobody listened
      logger.info('CoreServices: Initializing RecoveryEventHandlers...');
      this.recoveryHandlers = new RecoveryEventHandlers(this.eventBus);
      this.recoveryHandlers.register();
      logger.info('CoreServices: RecoveryEventHandlers registered');

      // NOTE: WamKeyboardPlugin is registered during preInitialize() but NOT eagerly loaded
      // The plugin will be loaded lazily when HarmonyWidget first needs it
      // This prevents race conditions with React mounting and StrictMode double-mounting
      console.log(
        '[MILESTONE] 🎹 STEP 2.5: WamKeyboardPlugin registered (will load on-demand)',
      );

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

        // Initialize BeatEmitter for audio-synchronized visual beat events
        logger.info('CoreServices: Initializing BeatEmitter...');
        this.beatEmitter = getBeatEmitter();
        this.beatEmitter.initialize(this.eventBus);
        logger.info('CoreServices: BeatEmitter initialized');
      }

      // ✅ OPTIMIZATION: Skip initial buffer injection - let setupDeferredBufferInjection() handle it
      // The deferred injection (set up in preInitialize) waits for samplesReady event
      // This avoids ~2 seconds of wasted time from failed injection + retry
      //
      // OLD BEHAVIOR (SLOW - 8+ seconds):
      //   T+0ms: initialize() runs buffer injection → FAILS (samples not loaded)
      //   T+3500ms: samplesReady fires → re-injection succeeds
      //
      // NEW BEHAVIOR (FAST - 2-3 seconds):
      //   T+150ms: preInitialize() sets up deferred listener
      //   T+3500ms: samplesReady fires → single injection succeeds
      const skipInitialBufferInjection = true;

      if (!skipInitialBufferInjection && this.playbackEngine) {
        console.log(
          '[CORESERVICES-BUFFER-INJECTION] Starting buffer injection...',
        );
        logger.info(
          'CoreServices: Injecting audio buffers for direct scheduling...',
        );
        const { GlobalSampleCache } =
          await import('../../modules/storage/cache/GlobalSampleCache.js');
        const sampleCache = GlobalSampleCache.getInstance();
        console.log(
          '[CORESERVICES-BUFFER-INJECTION] Got GlobalSampleCache instance',
        );
        lifecycle.checkpoint('BUFFER_INJECTION_START', {
          cacheStats: sampleCache.getStats(),
        });

        // Inject metronome buffers for countdown
        // Note: Samples are cached as raw ArrayBuffers, need to decode first
        let accentBuffer = sampleCache.getCachedBuffer('metronome-high-v2');
        let clickBuffer = sampleCache.getCachedBuffer('metronome-low-v2');

        // Decode from raw if not already decoded
        if (!accentBuffer) {
          const rawAccent =
            await sampleCache.getCachedRawBuffer('metronome-high-v2');
          if (rawAccent) {
            accentBuffer = await audioContext.decodeAudioData(
              rawAccent.slice(0),
            );
            await sampleCache.cacheBuffer('metronome-high-v2', accentBuffer, {
              isContextCompatible: true,
            });
          }
        }

        if (!clickBuffer) {
          const rawClick =
            await sampleCache.getCachedRawBuffer('metronome-low-v2');
          if (rawClick) {
            clickBuffer = await audioContext.decodeAudioData(rawClick.slice(0));
            await sampleCache.cacheBuffer('metronome-low-v2', clickBuffer, {
              isContextCompatible: true,
            });
          }
        }

        lifecycle.checkpoint('METRONOME_BUFFER_SEARCH', {
          hasAccent: !!accentBuffer,
          hasClick: !!clickBuffer,
          allFound: !!(accentBuffer && clickBuffer),
        });

        if (accentBuffer && clickBuffer && this.playbackEngine) {
          // Use instrument gain node for volume control
          const metronomeGainNode =
            this.playbackEngine.getOrCreateInstrumentGainNode('metronome');
          const metronomeDestination =
            metronomeGainNode || audioContext.destination;

          this.playbackEngine.setMetronomeBuffers(
            accentBuffer,
            clickBuffer,
            metronomeDestination,
          );
          logger.info(
            '✅ CoreServices: Metronome buffers injected for countdown',
          );
          lifecycle.checkpoint('METRONOME_BUFFERS_INJECTED');
        } else {
          lifecycle.checkpoint('BUFFER_INJECTION_FAILED', {
            bufferType: 'metronome',
            hasAccent: !!accentBuffer,
            hasClick: !!clickBuffer,
          });
        }

        // Inject drum buffers
        const kickBuffer = sampleCache.getCachedBuffer('drum-kick');
        const snareBuffer = sampleCache.getCachedBuffer('drum-snare');
        const hihatBuffer = sampleCache.getCachedBuffer('drum-hihat');

        lifecycle.checkpoint('DRUM_BUFFER_SEARCH', {
          hasKick: !!kickBuffer,
          hasSnare: !!snareBuffer,
          hasHihat: !!hihatBuffer,
          allFound: !!(kickBuffer && snareBuffer && hihatBuffer),
        });

        if (kickBuffer && snareBuffer && hihatBuffer) {
          // Use instrument gain node for volume control, fallback to destination
          const drumsGainNode =
            this.playbackEngine?.getOrCreateInstrumentGainNode('drums');
          const drumsDestination = drumsGainNode || audioContext.destination;

          // Inject drum buffers into PlaybackEngine for DrumScheduler
          if (this.playbackEngine) {
            const drumBuffers: Record<string, AudioBuffer> = {
              kick: kickBuffer,
              snare: snareBuffer,
              hihat: hihatBuffer,
            };
            this.playbackEngine.setDrumBuffers(drumBuffers, drumsDestination);
          }
          logger.info(
            '✅ CoreServices: Drum buffers injected - direct audio scheduling enabled',
          );
          lifecycle.checkpoint('DRUM_BUFFERS_INJECTED');
        } else {
          logger.warn(
            '⚠️ CoreServices: Drum buffers not found in cache - will fall back to event bus',
          );
          logger.warn('Drum buffer status:', {
            kickBuffer: kickBuffer ? 'found' : 'missing',
            snareBuffer: snareBuffer ? 'found' : 'missing',
            hihatBuffer: hihatBuffer ? 'found' : 'missing',
          });
          lifecycle.checkpoint('BUFFER_INJECTION_FAILED', {
            bufferType: 'drum',
            hasKick: !!kickBuffer,
            hasSnare: !!snareBuffer,
            hasHihat: !!hihatBuffer,
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

        lifecycle.checkpoint('VOICECUE_BUFFER_SEARCH', {
          found: voiceCuesFound,
          total: cues.length,
          allFound: voiceCuesFound === cues.length,
        });

        if (voiceCuesFound === cues.length) {
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
          lifecycle.checkpoint('VOICECUE_BUFFERS_INJECTED');
        } else {
          const missingCues = cues.filter(
            (cue) => !sampleCache.getCachedBuffer(`voice-cue-${cue}`),
          );
          logger.warn(
            '⚠️ CoreServices: Some voice cue buffers not found in cache - countdown may be silent',
          );
          logger.debug('Voice cue buffer status:', {
            found: voiceCuesFound,
            total: cues.length,
            missing: missingCues,
          });
          lifecycle.checkpoint('BUFFER_INJECTION_FAILED', {
            bufferType: 'voiceCue',
            found: voiceCuesFound,
            total: cues.length,
            missing: missingCues,
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
        const octaves = [0, 1, 2, 3, 4, 5, 6]; // Full piano range (Wurlitzer shifts down to octave 1)
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

        lifecycle.checkpoint('HARMONY_BUFFER_SEARCH', {
          found: harmonyBuffersFound,
          prefixesTried: instrumentPrefixes,
          layersTried: layers,
        });

        if (harmonyBuffersFound > 0) {
          if (this.playbackEngine) {
            this.playbackEngine.setHarmonyBuffers(
              harmonyBuffers,
              audioContext.destination,
            );
          }
          logger.info(
            '✅ CoreServices: Harmony buffers injected - direct harmony scheduling enabled',
            {
              buffersFound: harmonyBuffersFound,
              layers: layers.length,
            },
          );
          lifecycle.checkpoint('HARMONY_BUFFERS_INJECTED', {
            buffersFound: harmonyBuffersFound,
            layers: layers.length,
          });
        } else {
          logger.warn(
            '⚠️ CoreServices: No harmony buffers found in cache - will fall back to event bus',
          );
          lifecycle.checkpoint('BUFFER_INJECTION_FAILED', {
            bufferType: 'harmony',
            prefixesTried: instrumentPrefixes,
            layersTried: layers,
          });
        }

        // Note: PlaybackEngine will be started when transport starts (via event listener)
        logger.info(
          'CoreServices: PlaybackEngine initialized (will start with transport)',
        );
        AudioDebugger.getInstance().log(
          'CoreServices',
          'region-processor-ready',
        );
      } // End of RegionProcessor buffer injection guard

      // Note: setupDeferredBufferInjection() is now called in preInitialize() for faster path
      // This ensures the samplesReady listener exists before samples finish loading

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
          'playbackEngine',
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
      // Stop PlaybackEngine first (it's generating events)
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
   * FAANG-STYLE FIX: Set up deferred buffer injection
   *
   * This solves the race condition where buffer injection runs BEFORE samples are loaded.
   * The listener waits for the 'samplesReady' event and then re-injects all buffers.
   *
   * Timeline without fix:
   *   T+535ms: Buffer injection runs (samples NOT in cache) → FAILS
   *   T+6779ms: samples finally ready → TOO LATE
   *
   * Timeline with fix:
   *   T+535ms: Buffer injection runs (partial success if cached)
   *   T+6779ms: samplesReady fires → Re-inject ALL buffers (guaranteed success)
   */
  private setupDeferredBufferInjection(): void {
    if (this.hasSamplesReadyListener) {
      logger.debug('CoreServices: samplesReady listener already set up');
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    // Store handler reference for cleanup in dispose()
    this.samplesReadyHandler = async () => {
      logger.info(
        'CoreServices: samplesReady event received - re-injecting buffers...',
      );
      lifecycle.checkpoint('BUFFER_REINJECTION_START', {
        reason: 'samplesReady event received',
      });

      // ✅ FIX: Check if audioEngine is ready before attempting buffer injection
      // samplesReady often fires before user interaction (before AudioContext is available)
      if (!this.audioEngine.isReady()) {
        logger.info(
          'CoreServices: AudioEngine not ready yet - deferring buffer injection until initialization',
        );

        // Set up a one-time listener for when CoreServices is fully initialized
        let unsubscribe: (() => void) | null = null;
        const handleInitialized = async () => {
          // Unsubscribe immediately to simulate "once" behavior
          if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
          }

          logger.info(
            'CoreServices: AudioEngine now ready - retrying buffer injection',
          );
          try {
            await this.reinjectAllBuffers();
            lifecycle.checkpoint('BUFFER_REINJECTION_COMPLETE', {
              success: true,
            });
            logger.info(
              'CoreServices: Deferred buffer injection completed successfully',
            );
          } catch (error) {
            logger.error(
              'CoreServices: Deferred buffer re-injection failed:',
              error,
            );
            lifecycle.checkpoint('BUFFER_REINJECTION_COMPLETE', {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        };

        // Listen for initialization event (using subscribe which returns unsubscribe function)
        // Store unsubscribe for cleanup
        unsubscribe = this.eventBus.on(
          'core-services:initialized',
          handleInitialized,
        );
        this.eventSubscriptions.push(unsubscribe);
        return;
      }

      try {
        await this.reinjectAllBuffers();
        lifecycle.checkpoint('BUFFER_REINJECTION_COMPLETE', {
          success: true,
        });
      } catch (error) {
        logger.error('CoreServices: Buffer re-injection failed:', error);
        lifecycle.checkpoint('BUFFER_REINJECTION_COMPLETE', {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    // ✅ SAFETY: Handle edge case where samples already ready before listener attached
    // This handles rare scenarios where preInitialize() runs after samplesReady fires
    if (WindowRegistry.getSamplesReady()) {
      logger.info(
        'CoreServices: Samples already ready - immediately re-injecting buffers',
      );
      this.hasSamplesReadyListener = true;
      this.samplesReadyHandler();
      return;
    }

    // Normal fast path: Add listener before samples finish loading
    // Note: Using { once: true } means the listener auto-removes after firing,
    // but we still need to track it for cleanup if dispose() is called before the event fires
    window.addEventListener(
      'samplesReady',
      this.samplesReadyHandler as EventListener,
      { once: true },
    );
    this.hasSamplesReadyListener = true;

    logger.info(
      'CoreServices: Set up deferred buffer injection listener for samplesReady event',
    );
  }

  /**
   * Re-inject all buffers from GlobalSampleCache into PlaybackEngine
   * Called when samples are ready after initial buffer injection failed
   *
   * OPTIMIZATION: Uses Promise.all() to decode all buffers in parallel
   * Browser's decodeAudioData() already uses background threads, so parallel
   * calls benefit from concurrent decoding (~100ms vs ~500ms for 9 buffers)
   */
  private async reinjectAllBuffers(): Promise<void> {
    // Singleflight: if a reinjection is already in flight, just await it.
    // samplesReady fires 3x (ScrollTriggerLoader + InitialSamplePreloader +
    // useActAwarePreload), and three parallel decodes racing on the same
    // shared ArrayBuffer would detach it mid-flight.
    if (this.reinjectionPromise) {
      logger.debug(
        'CoreServices: reinjection already in flight — awaiting existing promise',
      );
      return this.reinjectionPromise;
    }

    this.reinjectionPromise = this.doReinjectAllBuffers().finally(() => {
      this.reinjectionPromise = null;
    });
    return this.reinjectionPromise;
  }

  private async doReinjectAllBuffers(): Promise<void> {
    if (!this.playbackEngine) {
      logger.warn(
        'CoreServices: No PlaybackEngine available for buffer re-injection',
      );
      return;
    }

    const audioContext = this.audioEngine.getContext();
    if (!audioContext) {
      logger.warn(
        'CoreServices: No AudioContext available for buffer re-injection',
      );
      return;
    }

    const { GlobalSampleCache } =
      await import('../../modules/storage/cache/GlobalSampleCache.js');
    const sampleCache = GlobalSampleCache.getInstance();

    // Helper: decode raw buffer if not already decoded (for parallel execution)
    //
    // Detached-buffer guard: `audioContext.decodeAudioData(rawBuffer.slice(0))`
    // in Chrome can detach the ORIGINAL backing ArrayBuffer even when we pass
    // a copy (`.slice(0)`) — and other callers (HarmonyPreloadStrategy,
    // BassPreloadStrategy, etc.) may decode the same key concurrently. When
    // samplesReady fires multiple times (ScrollTriggerLoader +
    // InitialSamplePreloader + useActAwarePreload all dispatch it), this
    // function runs three times concurrently per key. The second invocation
    // sees `getCachedBuffer(key)` still null (the first decode hasn't
    // resolved yet) and tries to slice an already-detached buffer →
    // `Cannot perform ArrayBuffer.prototype.slice on a detached ArrayBuffer`
    // → the whole re-injection batch aborts and drums/metronome stay silent.
    //
    // Fix: detect the detached state (byteLength === 0) and re-fetch from
    // IndexedDB on the spot. Also wrap the decode in try/catch so one bad
    // key doesn't take out the whole batch.
    const decodeIfNeeded = async (
      key: string,
    ): Promise<AudioBuffer | undefined> => {
      // Check if already decoded
      let buffer = sampleCache.getCachedBuffer(key);
      if (buffer) return buffer;

      // Get raw buffer and decode
      let rawBuffer = await sampleCache.getCachedRawBuffer(key);
      if (!rawBuffer) return undefined;

      // If a concurrent decode already detached this buffer, re-fetch from
      // IndexedDB. The re-fetch returns a fresh ArrayBuffer that hasn't
      // been transferred yet.
      if (rawBuffer.byteLength === 0) {
        logger.warn(
          `decodeIfNeeded: raw buffer for "${key}" is detached — refetching from IndexedDB`,
        );
        // Force a memory-cache eviction so getCachedRawBuffer re-reads from IDB.
        (sampleCache as any).samples?.delete?.(key);
        rawBuffer = await sampleCache.getCachedRawBuffer(key);
        if (!rawBuffer || rawBuffer.byteLength === 0) {
          logger.error(
            `decodeIfNeeded: re-fetched buffer for "${key}" is also empty/detached — giving up`,
          );
          return undefined;
        }
      }

      try {
        // Re-check the decoded cache in case a parallel decode just resolved
        // while we were awaiting getCachedRawBuffer above.
        buffer = sampleCache.getCachedBuffer(key);
        if (buffer) return buffer;

        buffer = await audioContext.decodeAudioData(rawBuffer.slice(0));
        await sampleCache.cacheBuffer(key, buffer, {
          isContextCompatible: true,
        });
        return buffer;
      } catch (err) {
        logger.error(
          `decodeIfNeeded: decode failed for "${key}" — returning undefined`,
          err as Error,
        );
        return undefined;
      }
    };

    // ✅ PARALLEL: Decode all essential buffers at once (FAANG optimization)
    // Browser uses dedicated decoding threads, so parallel calls are faster
    const [
      accentBuffer,
      clickBuffer,
      kickBuffer,
      snareBuffer,
      hihatBuffer,
      voiceCueOne,
      voiceCueTwo,
      voiceCueThree,
      voiceCueFour,
    ] = await Promise.all([
      decodeIfNeeded('metronome-high-v2'),
      decodeIfNeeded('metronome-low-v2'),
      decodeIfNeeded('drum-kick'),
      decodeIfNeeded('drum-snare'),
      decodeIfNeeded('drum-hihat'),
      decodeIfNeeded('voice-cue-one'),
      decodeIfNeeded('voice-cue-two'),
      decodeIfNeeded('voice-cue-three'),
      decodeIfNeeded('voice-cue-four'),
    ]);

    // Inject metronome buffers
    if (accentBuffer && clickBuffer) {
      // Use instrument gain node for volume control
      const metronomeGainNode =
        this.playbackEngine.getOrCreateInstrumentGainNode('metronome');
      const metronomeDestination =
        metronomeGainNode || audioContext.destination;

      this.playbackEngine.setMetronomeBuffers(
        accentBuffer,
        clickBuffer,
        metronomeDestination,
      );
      logger.info('✅ CoreServices: Metronome buffers re-injected');
      lifecycle.checkpoint('METRONOME_BUFFERS_INJECTED');
    }

    // Inject drum buffers
    if (kickBuffer && snareBuffer && hihatBuffer) {
      // Use instrument gain node for volume control
      const drumsGainNode =
        this.playbackEngine.getOrCreateInstrumentGainNode('drums');
      const drumsDestination = drumsGainNode || audioContext.destination;

      const drumBuffers: Record<string, AudioBuffer> = {
        kick: kickBuffer,
        snare: snareBuffer,
        hihat: hihatBuffer,
      };
      this.playbackEngine.setDrumBuffers(drumBuffers, drumsDestination);
      logger.info('✅ CoreServices: Drum buffers re-injected');
      lifecycle.checkpoint('DRUM_BUFFERS_INJECTED');
    } else {
      logger.warn(
        '⚠️ CoreServices: Drum buffers still not available for re-injection',
        {
          hasKick: !!kickBuffer,
          hasSnare: !!snareBuffer,
          hasHihat: !!hihatBuffer,
        },
      );
    }

    // Inject voice cue buffers
    const voiceCueBuffers: Record<string, AudioBuffer> = {};
    if (voiceCueOne) voiceCueBuffers.one = voiceCueOne;
    if (voiceCueTwo) voiceCueBuffers.two = voiceCueTwo;
    if (voiceCueThree) voiceCueBuffers.three = voiceCueThree;
    if (voiceCueFour) voiceCueBuffers.four = voiceCueFour;

    const voiceCuesFound = Object.keys(voiceCueBuffers).length;
    if (voiceCuesFound === 4) {
      this.playbackEngine.setVoiceCueBuffers(
        voiceCueBuffers,
        audioContext.destination,
      );
      logger.info('✅ CoreServices: Voice cue buffers re-injected');
      lifecycle.checkpoint('VOICECUE_BUFFERS_INJECTED');
    } else {
      logger.warn(
        `⚠️ CoreServices: Only ${voiceCuesFound}/4 voice cue buffers available`,
      );
    }

    // Re-inject harmony buffers
    const harmonyBuffers = new Map<string, AudioBuffer>();
    const layers = ['v2', 'v3', 'v4', 'v5', 'v6', 'v7'];
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
    ];
    const octaves = [0, 1, 2, 3, 4, 5, 6];
    const instrumentPrefixes = ['wurlitzer', 'grandpiano', 'rhodes', 'harmony'];
    let harmonyBuffersFound = 0;

    for (const layer of layers) {
      for (const octave of octaves) {
        for (const note of notes) {
          const noteName = `${note}${octave}`;

          let buffer: AudioBuffer | undefined;
          for (const prefix of instrumentPrefixes) {
            const cacheKey = `${prefix}-${layer}-${noteName}`;
            buffer = sampleCache.getCachedBuffer(cacheKey);
            if (buffer) break;
          }

          if (buffer) {
            harmonyBuffers.set(`${layer}-${noteName}`, buffer);
            harmonyBuffersFound++;
          }
        }
      }
    }

    if (harmonyBuffersFound > 0 && this.playbackEngine) {
      this.playbackEngine.setHarmonyBuffers(
        harmonyBuffers,
        audioContext.destination,
      );
      logger.info(
        `✅ CoreServices: Harmony buffers re-injected (${harmonyBuffersFound} buffers)`,
      );
      lifecycle.checkpoint('HARMONY_BUFFERS_INJECTED', {
        buffersFound: harmonyBuffersFound,
      });
    } else if (harmonyBuffersFound === 0) {
      logger.warn(
        '⚠️ CoreServices: No harmony buffers available for re-injection',
      );
    }

    logger.info('CoreServices: Buffer re-injection complete');
  }

  /**
   * Dispose all services
   */
  async dispose(): Promise<void> {
    try {
      // Unsubscribe all event listeners to prevent memory leaks
      logger.info('CoreServices: Unsubscribing event listeners...');
      for (const unsubscribe of this.eventSubscriptions) {
        unsubscribe();
      }
      this.eventSubscriptions = [];
      logger.info('CoreServices: Event listeners unsubscribed');

      // Remove samplesReady window listener if it exists
      if (this.samplesReadyHandler && typeof window !== 'undefined') {
        window.removeEventListener('samplesReady', this.samplesReadyHandler);
        this.samplesReadyHandler = null;
        this.hasSamplesReadyListener = false;
        logger.info('CoreServices: samplesReady listener removed');
      }

      // Dispose RecoveryEventHandlers first
      if (this.recoveryHandlers) {
        logger.info('CoreServices: Disposing RecoveryEventHandlers...');
        this.recoveryHandlers.dispose();
        this.recoveryHandlers = null;
      }

      // Phase 1 Task 1.4: Dispose PlaybackEngine if it exists
      if (this.playbackEngine) {
        logger.info('CoreServices: Disposing PlaybackEngine...');
        this.playbackEngine.dispose();
        this.playbackEngine = null;
        logPlaybackEngineMigrationEvent('PlaybackEngine disposed');
      }

      // Dispose BeatEmitter
      if (this.beatEmitter) {
        logger.info('CoreServices: Disposing BeatEmitter...');
        this.beatEmitter.dispose();
        this.beatEmitter = null;
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

  getBeatEmitter(): BeatEmitter | null {
    return this.beatEmitter;
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
   * All subscriptions are stored for cleanup in dispose() to prevent memory leaks
   */
  private setupEventListeners(): void {
    // Listen for transport stop to stop all audio playback components
    const unsubTransportStop = this.eventBus.on(
      'transport:stop',
      async (data: { timestamp: number; graceful?: boolean }) => {
        const graceful = data.graceful ?? false;
        logger.info('Transport stopped, stopping all audio components', {
          graceful,
        });

        // Stop PlaybackEngine with graceful flag
        // graceful=true (auto-stop): Let one-shot drums/metronome finish naturally
        // graceful=false (manual stop): Force-stop all audio immediately
        if (this.playbackEngine) {
          this.playbackEngine.stop(graceful);
        }

        // Stop BeatEmitter (stops audio-synchronized beat events)
        if (this.beatEmitter) {
          this.beatEmitter.stop();
          logger.info('BeatEmitter stopped');
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
    this.eventSubscriptions.push(unsubTransportStop);

    // Listen for playback:starting to configure and start BeatEmitter
    // BeatEmitter calculates beat position from Transport.seconds for jitter-free timing
    const unsubPlaybackStarting = this.eventBus.on('playback:starting', () => {
      if (this.beatEmitter && this.playbackEngine) {
        const countdownBeats = this.playbackEngine.getCountdownConfig().beats;
        this.beatEmitter.configure({
          countdownBeats,
          beatsPerMeasure: 4, // Default 4/4 time
        });
        this.beatEmitter.start();
        logger.info('BeatEmitter started', { countdownBeats });
      } else if (this.beatEmitter) {
        // Fallback if PlaybackEngine not available
        this.beatEmitter.start();
        logger.info('BeatEmitter started (no countdown config)');
      }
    });
    this.eventSubscriptions.push(unsubPlaybackStarting);

    // Listen for transport start to restart other audio components
    // This ensures second/third/etc playback rounds work the same as first playback
    const unsubTransportStart = this.eventBus.on(
      'transport:start',
      async () => {
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
      },
    );
    this.eventSubscriptions.push(unsubTransportStart);

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
      window.__globalCoreServices = services;

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
      delete window.__globalCoreServices;
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
    delete window.__globalCoreServices;
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
