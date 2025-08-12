/**
 * CoreServices - Central Service Integration
 * Story 3.18.2: Core Services Foundation
 * 
 * Wires all 5 core services together through ServiceRegistry.
 * Provides a single entry point for initializing the entire
 * playback domain architecture.
 */

import { ServiceRegistry, setGlobalServiceRegistry } from './ServiceRegistry.js';
import { EventBus } from './EventBus.js';
import { AudioEngine } from './AudioEngine.js';
import { UnifiedTransport } from './UnifiedTransport.js';
import { TransportSyncManager } from './TransportSyncManager.js';
import { PluginManager, registerExistingPlugins } from './PluginManager.js';
import { PatternScheduler } from './PatternScheduler.js';

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
  private unifiedTransport: UnifiedTransport;
  private transportSyncManager: TransportSyncManager;
  private pluginManager: PluginManager;
  private patternScheduler: PatternScheduler;
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
      enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
    });
    console.log('CoreServices: Creating UnifiedTransport with:', {
      hasEventBus: !!this.eventBus,
      hasAudioEngine: !!this.audioEngine,
      audioEngineType: this.audioEngine?.constructor?.name
    });
    
    this.unifiedTransport = UnifiedTransport.getInstance(this.eventBus, this.audioEngine, {
      enableWebWorker: this.config.enableHighPrecisionTiming,
      enableAudioWorklet: this.config.enableHighPrecisionTiming,
      driftCompensation: 'adaptive',
      bufferStrategy: 'adaptive'
    });
    
    console.log('CoreServices: UnifiedTransport created:', {
      hasUnifiedTransport: !!this.unifiedTransport,
      transportHasAudioEngine: !!(this.unifiedTransport as any).audioEngine
    });
    this.transportSyncManager = TransportSyncManager.getInstance();
    this.pluginManager = new PluginManager(this.audioEngine, this.eventBus);
    this.patternScheduler = new PatternScheduler();

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
      console.log('CoreServices: Starting pre-initialization...');
      
      // Pre-initialize AudioEngine (loads Tone.js, no AudioContext)
      console.log('CoreServices: Pre-initializing AudioEngine...');
      await this.audioEngine.preInitialize();
      console.log('CoreServices: AudioEngine pre-initialized (Tone.js loaded)');
      
      this.isPreInitialized = true;
      console.log('CoreServices: Pre-initialization complete!');
      
      this.eventBus.emit('core-services:pre-initialized', {
        services: ['eventBus', 'audioEngine'],
      });
    } catch (error) {
      console.error('CoreServices: Pre-initialization failed:', error);
      throw new CoreServicesError(
        `Failed to pre-initialize CoreServices: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      console.log('CoreServices: Starting full initialization...');
      
      // Pre-initialize if not done already
      if (!this.isPreInitialized) {
        await this.preInitialize();
      }
      
      // Ensure AudioEngine is fully initialized first (must be called from user gesture)
      console.log('CoreServices: Fully initializing AudioEngine...');
      await this.audioEngine.initialize();
      console.log('CoreServices: AudioEngine fully initialized');
      
      // Initialize service registry (handles dependency order)
      console.log('CoreServices: Initializing service registry...');
      console.log('CoreServices: Before registry.initialize, checking UnifiedTransport:', {
        hasUnifiedTransport: !!this.unifiedTransport,
        transportHasAudioEngine: !!(this.unifiedTransport as any).audioEngine,
        registryHasUnifiedTransport: this.registry.has('unifiedTransport')
      });
      
      await this.registry.initialize();
      console.log('CoreServices: Service registry initialized');
      
      // Initialize TransportSyncManager after registry (it's not a registered service)
      console.log('CoreServices: Initializing TransportSyncManager...');
      this.transportSyncManager.initialize(this.unifiedTransport, this.eventBus);
      console.log('CoreServices: TransportSyncManager initialized');

      // Register existing plugins if auto-load is enabled
      if (this.config.autoLoadPlugins) {
        console.log('CoreServices: Registering existing plugins...');
        await registerExistingPlugins(this.pluginManager);
        console.log('CoreServices: Plugins registered');
      }

      this.isInitialized = true;
      console.log('CoreServices: Full initialization complete!');
      
      this.eventBus.emit('core-services:initialized', {
        services: ['eventBus', 'audioEngine', 'unifiedTransport', 'transportSyncManager', 'pluginManager', 'patternScheduler'],
      });
    } catch (error) {
      console.error('CoreServices: Full initialization failed:', error);
      throw new CoreServicesError(
        `Failed to initialize CoreServices: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Start all services
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new CoreServicesError('CoreServices not initialized. Call initialize() first.');
    }

    try {
      await this.registry.start();
      this.eventBus.emit('core-services:started', {});
    } catch (error) {
      throw new CoreServicesError(
        `Failed to start CoreServices: ${error instanceof Error ? error.message : 'Unknown error'}`
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
        `Failed to stop CoreServices: ${error instanceof Error ? error.message : 'Unknown error'}`
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
        `Failed to dispose CoreServices: ${error instanceof Error ? error.message : 'Unknown error'}`
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
  
  getPatternScheduler(): PatternScheduler {
    return this.patternScheduler;
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
          connectedClients: this.transportSyncManager.getConnectedClients().length,
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
    // Set this registry as the global instance
    setGlobalServiceRegistry(this.registry);
    
    // EventBus has no dependencies
    this.registry.register('eventBus', this.eventBus, []);

    // AudioEngine depends on EventBus
    this.registry.register('audioEngine', this.audioEngine, ['eventBus']);

    // UnifiedTransport depends on AudioEngine and EventBus
    this.registry.register('unifiedTransport', this.unifiedTransport, ['audioEngine', 'eventBus']);
    
    // TransportSyncManager is NOT registered - it's initialized manually after registry
    // because it requires parameters for initialization

    // PluginManager depends on AudioEngine and EventBus
    this.registry.register('pluginManager', this.pluginManager, ['audioEngine', 'eventBus']);
    
    // PatternScheduler depends on EventBus and UnifiedTransport
    this.registry.register('patternScheduler', this.patternScheduler, ['eventBus', 'unifiedTransport']);
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
    config?: CoreServicesConfig
  ): Promise<CoreServices> {
    // Prevent creation during disposal
    if (GlobalAudioSystem.isDisposing) {
      throw new Error('GlobalAudioSystem is being disposed, cannot create new instance');
    }

    // Return existing instance if available
    if (GlobalAudioSystem.instance) {
      console.log('GlobalAudioSystem: Returning existing pre-initialized instance');
      return GlobalAudioSystem.instance;
    }

    // Return existing initialization promise if in progress
    if (GlobalAudioSystem.initializationPromise) {
      console.log('GlobalAudioSystem: Waiting for existing initialization to complete');
      return GlobalAudioSystem.initializationPromise;
    }

    // Create new instance
    console.log('GlobalAudioSystem: Creating new pre-initialized instance');
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

    console.log('GlobalAudioSystem: Disposing global audio system');
    GlobalAudioSystem.isDisposing = true;

    try {
      await GlobalAudioSystem.instance.dispose();
      GlobalAudioSystem.instance = null;
      delete (window as any).__globalCoreServices;
      console.log('GlobalAudioSystem: Global audio system disposed successfully');
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

/**
 * Factory function to get pre-initialized core services (FAANG best practice)
 * Always returns the same global instance - safe for React re-mounts
 * This only loads Tone.js, doesn't create AudioContext
 */
export async function createCoreServicesWithPreInit(
  config?: CoreServicesConfig
): Promise<CoreServices> {
  return GlobalAudioSystem.getPreInitializedInstance(config);
}

/**
 * Factory function to create and fully initialize core services
 * MUST be called from a user gesture if AudioContext needs to be created
 * @deprecated Use GlobalAudioSystem pattern instead for better lifecycle management
 */
export async function createCoreServices(
  config?: CoreServicesConfig
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
export { AudioEngine } from './AudioEngine.js';
export { UnifiedTransport } from './UnifiedTransport.js';
export { TransportSyncManager } from './TransportSyncManager.js';
export { PluginManager } from './PluginManager.js';

// Export types
export type { Service } from './ServiceRegistry.js';
export type { EventData, EventHandler } from './EventBus.js';
export type { AudioEngineConfig, AudioSampler } from './AudioEngine.js';

export type { TransportConfig, TransportState, MusicalPosition, TimingEvent, TimingMetrics } from './UnifiedTransport.js';
export type { PluginRegistration } from './PluginManager.js';
