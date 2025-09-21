/**
 * PluginManager - Simplified Plugin Management
 * Story 3.18.2: Core Services Foundation
 *
 * Manages all audio plugins while preserving BaseAudioPlugin compatibility.
 * Integrates with new AudioEngine for Tone.js access and simplifies
 * plugin lifecycle management.
 */

import { Service } from './ServiceRegistry.js';
import { EventBus } from './EventBus.js';
import { AudioEngine } from '../../modules/audio-engine/core/AudioEngine.js';
import { getLogger } from '@/utils/logger.js';
import { PluginState, PluginCategory } from '../../types/plugin.js';
import type {
  AudioPlugin,
  PluginMetadata,
  PluginAudioContext,
  PluginCapabilities,
  PluginProcessingResult,
} from '../../types/plugin.js';

const logger = getLogger('PluginManager');

// BaseAudioPlugin stub - replaced by plugin types
// BaseAudioPlugin stub - replaced by plugin types
// This class is kept for backward compatibility but not actively used
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class BaseAudioPlugin {
  id: string;
  type: string;
  state: PluginState = PluginState.UNLOADED;
  metadata: PluginMetadata;

  constructor(id: string, type: string) {
    this.id = id;
    this.type = type;
    this.metadata = {
      id: id,
      name: id,
      version: '1.0.0',
      author: 'BassNotion',
      description: 'Audio plugin',
      license: 'MIT',
      category: PluginCategory.PROCESSOR,
      tags: [],
      capabilities: {} as PluginCapabilities,
      dependencies: [],
    };
  }

  async initialize(_context: PluginAudioContext): Promise<void> {
    // Implementation placeholder
  }
  async process(
    _inputBuffer: AudioBuffer,
    _outputBuffer: AudioBuffer,
    _context: PluginAudioContext,
  ): Promise<PluginProcessingResult> {
    // Implementation placeholder
    return {
      success: true,
      status: 'success' as any,
      processingTime: 0,
      bypassMode: false,
      processedSamples: 0,
      cpuUsage: 0,
    };
  }
  async dispose(): Promise<void> {
    // Implementation placeholder
  }

  start(): void {
    // Implementation placeholder
  }
  stop(): void {
    // Implementation placeholder
  }
  getParameters(): Record<string, any> {
    return {};
  }
  async setParameter(_name: string, _value: any): Promise<void> {
    // Implementation placeholder
  }
  getState(): PluginState {
    return this.state;
  }
  setState(state: PluginState): void {
    this.state = state;
  }
  getMetadata(): PluginMetadata {
    return this.metadata;
  }
}

export interface PluginRegistration {
  plugin: AudioPlugin;
  metadata: PluginMetadata;
  dependencies?: string[];
}

export class PluginError extends Error {
  constructor(
    message: string,
    public pluginId?: string,
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

export class PluginManager implements Service {
  private plugins = new Map<string, PluginRegistration>();
  private pluginStates = new Map<string, PluginState>();
  private eventBus: EventBus;
  private audioEngine: AudioEngine;
  private isInitialized = false;
  private audioContext: PluginAudioContext | null = null;

  constructor(audioEngine: AudioEngine, eventBus: EventBus) {
    this.audioEngine = audioEngine;
    this.eventBus = eventBus;
    this.setupEventHandlers();
  }

  /**
   * Initialize plugin manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create plugin audio context from audio engine
      const context = this.audioEngine.getContext();
      this.audioContext = {
        audioContext: context,
        sampleRate: context.sampleRate,
        bufferSize: 128, // Default buffer size
        currentTime: context.currentTime,
        baseLatency: context.baseLatency || 0,
        // Additional context properties for plugins
        getTone: () => this.audioEngine.getTone(),
      } as PluginAudioContext;

      this.isInitialized = true;
      this.eventBus.emit('plugin-manager:initialized', {});
    } catch (error) {
      throw new PluginError(
        `Failed to initialize PluginManager: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Register a plugin
   */
  async register(plugin: AudioPlugin, dependencies?: string[]): Promise<void> {
    const metadata = plugin.metadata;

    if (this.plugins.has(metadata.id)) {
      throw new PluginError(
        `Plugin ${metadata.id} is already registered`,
        metadata.id,
      );
    }

    // Validate dependencies exist
    if (dependencies) {
      for (const dep of dependencies) {
        if (!this.plugins.has(dep)) {
          throw new PluginError(
            `Plugin ${metadata.id} depends on ${dep} which is not registered`,
            metadata.id,
          );
        }
      }
    }

    // Register the plugin
    this.plugins.set(metadata.id, {
      plugin,
      metadata,
      dependencies,
    });

    this.pluginStates.set(metadata.id, plugin.state);

    // Set up plugin event handlers
    this.setupPluginEventHandlers(plugin);

    this.eventBus.emit('plugin-manager:plugin-registered', {
      pluginId: metadata.id,
      metadata,
    });
  }

  /**
   * Load and initialize a plugin
   */
  async loadPlugin(pluginId: string): Promise<void> {
    const registration = this.plugins.get(pluginId);
    if (!registration) {
      throw new PluginError(`Plugin ${pluginId} not found`, pluginId);
    }

    const { plugin, dependencies } = registration;

    // Load dependencies first
    if (dependencies) {
      for (const dep of dependencies) {
        const depState = this.pluginStates.get(dep);
        if (depState === PluginState.UNLOADED) {
          await this.loadPlugin(dep);
        }
      }
    }

    // Load the plugin
    if (plugin.state === PluginState.UNLOADED) {
      await plugin.load();
    }

    // Initialize the plugin
    if (plugin.state === PluginState.LOADED && this.audioContext) {
      await plugin.initialize(this.audioContext);
    }

    this.pluginStates.set(pluginId, plugin.state);

    this.eventBus.emit('plugin-manager:plugin-loaded', {
      pluginId,
      state: plugin.state,
    });
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(pluginId: string): Promise<void> {
    const registration = this.plugins.get(pluginId);
    if (!registration) {
      throw new PluginError(`Plugin ${pluginId} not found`, pluginId);
    }

    const { plugin } = registration;

    // Ensure plugin is loaded and initialized
    if (
      plugin.state === PluginState.UNLOADED ||
      plugin.state === PluginState.LOADED
    ) {
      await this.loadPlugin(pluginId);
    }

    // Activate the plugin
    if (plugin.state === PluginState.INACTIVE) {
      await plugin.activate();
    }

    this.pluginStates.set(pluginId, plugin.state);

    this.eventBus.emit('plugin-manager:plugin-activated', {
      pluginId,
      state: plugin.state,
    });
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    const registration = this.plugins.get(pluginId);
    if (!registration) {
      throw new PluginError(`Plugin ${pluginId} not found`, pluginId);
    }

    const { plugin } = registration;

    if (plugin.state === PluginState.ACTIVE) {
      await plugin.deactivate();
    }

    this.pluginStates.set(pluginId, plugin.state);

    this.eventBus.emit('plugin-manager:plugin-deactivated', {
      pluginId,
      state: plugin.state,
    });
  }

  /**
   * Get a plugin instance
   */
  getPlugin<T extends AudioPlugin = AudioPlugin>(pluginId: string): T {
    const registration = this.plugins.get(pluginId);
    if (!registration) {
      throw new PluginError(`Plugin ${pluginId} not found`, pluginId);
    }

    return registration.plugin as T;
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Map<string, AudioPlugin> {
    const result = new Map<string, AudioPlugin>();
    for (const [id, registration] of this.plugins) {
      result.set(id, registration.plugin);
    }
    return result;
  }

  /**
   * Get plugins by capability
   */
  getPluginsByCapability(capability: string): AudioPlugin[] {
    const result: AudioPlugin[] = [];

    for (const registration of this.plugins.values()) {
      if (
        registration.plugin.capabilities &&
        'features' in registration.plugin.capabilities &&
        (registration.plugin.capabilities as any).features?.includes(capability)
      ) {
        result.push(registration.plugin);
      }
    }

    return result;
  }

  /**
   * Get plugin state
   */
  getPluginState(pluginId: string): PluginState | undefined {
    return this.pluginStates.get(pluginId);
  }

  /**
   * Load all registered plugins
   */
  async loadAllPlugins(): Promise<void> {
    // Sort plugins by dependencies
    const sortedIds = this.topologicalSort();

    // Load plugins in dependency order
    for (const pluginId of sortedIds) {
      try {
        await this.loadPlugin(pluginId);
      } catch (error) {
        this.eventBus.emit('plugin-manager:error', {
          pluginId,
          error: error instanceof Error ? error : new Error('Unknown error'),
          operation: 'load',
        });
      }
    }
  }

  /**
   * Start plugin manager service
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new PluginError('PluginManager not initialized');
    }

    // Load and activate any auto-start plugins
    for (const [pluginId, registration] of this.plugins) {
      if (registration.plugin.config?.autoStart) {
        try {
          await this.activatePlugin(pluginId);
        } catch (error) {
          this.eventBus.emit('plugin-manager:error', {
            pluginId,
            error: error instanceof Error ? error : new Error('Unknown error'),
            operation: 'auto-start',
          });
        }
      }
    }

    this.eventBus.emit('plugin-manager:started', {});
  }

  /**
   * Stop plugin manager service
   */
  async stop(): Promise<void> {
    // Deactivate all active plugins
    for (const [pluginId, state] of this.pluginStates) {
      if (state === PluginState.ACTIVE) {
        try {
          await this.deactivatePlugin(pluginId);
        } catch (error) {
          this.eventBus.emit('plugin-manager:error', {
            pluginId,
            error: error instanceof Error ? error : new Error('Unknown error'),
            operation: 'stop',
          });
        }
      }
    }

    this.eventBus.emit('plugin-manager:stopped', {});
  }

  /**
   * Dispose plugin manager
   */
  async dispose(): Promise<void> {
    // Stop the service
    await this.stop();

    // Dispose all plugins
    for (const [pluginId, registration] of this.plugins) {
      try {
        await registration.plugin.dispose();
      } catch (error) {
        this.eventBus.emit('plugin-manager:error', {
          pluginId,
          error: error instanceof Error ? error : new Error('Unknown error'),
          operation: 'dispose',
        });
      }
    }

    // Clear all registrations
    this.plugins.clear();
    this.pluginStates.clear();
    this.audioContext = null;
    this.isInitialized = false;

    this.eventBus.emit('plugin-manager:disposed', {});
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Listen for transport events to notify plugins
    this.eventBus.on('transport:started', () => {
      this.notifyActivePlugins('transport-started');
    });

    this.eventBus.on('transport:stopped', () => {
      this.notifyActivePlugins('transport-stopped');
    });

    this.eventBus.on('transport:tempo-changed', (data) => {
      this.notifyActivePlugins('tempo-changed', data);
    });
  }

  /**
   * Set up plugin event handlers
   */
  private setupPluginEventHandlers(plugin: AudioPlugin): void {
    // Forward plugin errors
    plugin.on('error', (error, context) => {
      this.eventBus.emit('plugin-manager:plugin-error', {
        pluginId: plugin.metadata.id,
        error,
        context,
      });
    });

    // Track state changes
    plugin.on('loaded', () => {
      this.pluginStates.set(plugin.metadata.id, PluginState.LOADED);
    });

    plugin.on('initialized', () => {
      this.pluginStates.set(plugin.metadata.id, PluginState.INACTIVE);
    });

    plugin.on('activated', () => {
      this.pluginStates.set(plugin.metadata.id, PluginState.ACTIVE);
    });

    plugin.on('deactivated', () => {
      this.pluginStates.set(plugin.metadata.id, PluginState.INACTIVE);
    });

    plugin.on('disposed', () => {
      this.pluginStates.set(plugin.metadata.id, PluginState.UNLOADED);
    });
  }

  /**
   * Notify active plugins of an event
   */
  private notifyActivePlugins(event: string, data?: any): void {
    for (const [pluginId, state] of this.pluginStates) {
      if (state === PluginState.ACTIVE) {
        const registration = this.plugins.get(pluginId);
        if (registration) {
          // Emit event to plugin if it has a handler
          const handler = (registration.plugin as any)[
            `on${event.charAt(0).toUpperCase() + event.slice(1)}`
          ];
          if (typeof handler === 'function') {
            try {
              handler.call(registration.plugin, data);
            } catch (error) {
              this.eventBus.emit('plugin-manager:plugin-error', {
                pluginId,
                error:
                  error instanceof Error ? error : new Error('Unknown error'),
                context: { event, data },
              });
            }
          }
        }
      }
    }
  }

  /**
   * Topological sort for dependency resolution
   */
  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const registration = this.plugins.get(id);
      if (registration?.dependencies) {
        for (const dep of registration.dependencies) {
          visit(dep);
        }
      }

      result.push(id);
    };

    for (const id of this.plugins.keys()) {
      visit(id);
    }

    return result;
  }
}

/**
 * Factory function to register all existing plugins
 */
export async function registerExistingPlugins(
  pluginManager: PluginManager,
): Promise<void> {
  // Dynamically import all existing plugins
  const pluginModules = [
    import('../../modules/instruments/implementations/bass/BassProcessor.js'),
    import('../../modules/instruments/implementations/drums/DrumProcessor.js'),
    import(
      '../../modules/instruments/implementations/metronome/MetronomeInstrumentProcessor.js'
    ),
    // ChordInstrumentProcessor removed - use WamHarmonyProcessor instead
    import(
      '../../modules/instruments/implementations/drums/DrumInstrumentProcessor.js'
    ),
    // All these plugins have been removed or relocated:
    // import('../plugins/SyncProcessor.js'),
    // import('../plugins/InstrumentAssetOptimizer.js'),
    // import('../plugins/InstrumentLifecycleManager.js'),
    // import('../plugins/MusicalContextAnalyzer.js'),
    // import('../plugins/N8nAssetPipelineProcessor.js'),
    // import('../plugins/PerformanceTunerOptimizer.js'),
    // import('../plugins/AssetInstrumentIntegrationProcessor.js'),
    // Add more plugins as needed
  ];

  // Load all plugin modules
  const loadedModules = await Promise.all(pluginModules);

  // Register each plugin
  for (const module of loadedModules) {
    // Each module should export a default plugin class
    const PluginClass =
      (module as any).BassProcessor ||
      (module as any).DrumProcessor ||
      (module as any).HarmonyProcessor ||
      (module as any).MetronomeProcessor ||
      (module as any).EffectsProcessor ||
      Object.values(module)[0];
    if (PluginClass && typeof PluginClass === 'function') {
      try {
        const plugin = new PluginClass();
        if (plugin) {
          await pluginManager.register(plugin as AudioPlugin);
        }
      } catch (error) {
        logger.warn('Failed to register plugin:', {
          error,
          correlationId: 'system',
        });
      }
    }
  }
}
