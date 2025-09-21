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
import { getLogger } from '@/utils/logger.js';

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
        driftCompensation: 'adaptive',
        bufferStrategy: 'adaptive',
      },
    );
    this.transportSyncManager = TransportSyncManager.getInstance();
    this.pluginManager = new PluginManager(this.audioEngine, this.eventBus);

    // Register services with dependencies
    this.registerServices();
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

      this.isPreInitialized = true;
      logger.info('CoreServices: Pre-initialization complete!');

      this.eventBus.emit('core-services:pre-initialized', {
        services: ['eventBus', 'audioEngine'],
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

      // Ensure AudioEngine is fully initialized first (must be called from user gesture)
      logger.info('CoreServices: Fully initializing AudioEngine...');
      await this.audioEngine.initialize();
      logger.info('CoreServices: AudioEngine fully initialized');

      // Initialize service registry (handles dependency order)
      logger.info('CoreServices: Initializing service registry...');
      await this.registry.initialize();
      logger.info('CoreServices: Service registry initialized');

      // Initialize TransportSyncManager after registry (it's not a registered service)
      logger.info('CoreServices: Initializing TransportSyncManager...');
      this.transportSyncManager.initialize(
        this.unifiedTransport,
        this.eventBus,
      );
      logger.info('CoreServices: TransportSyncManager initialized');

      // Register existing plugins if auto-load is enabled
      if (this.config.autoLoadPlugins) {
        logger.info('CoreServices: Registering existing plugins...');
        await registerExistingPlugins(this.pluginManager);
        logger.info('CoreServices: Plugins registered');
      }

      this.isInitialized = true;
      logger.info('CoreServices: Full initialization complete!');

      this.eventBus.emit('core-services:initialized', {
        services: [
          'eventBus',
          'audioEngine',
          'unifiedTransport',
          'transportSyncManager',
          'pluginManager',
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

  getUnifiedTransport(): UnifiedTransport {
    return this.unifiedTransport;
  }

  getTransportSyncManager(): TransportSyncManager {
    return this.transportSyncManager;
  }

  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  getServiceRegistry(): ServiceRegistry {
    return this.registry;
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
