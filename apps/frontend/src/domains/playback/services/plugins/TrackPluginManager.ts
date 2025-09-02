/**
 * Track Plugin Manager
 *
 * Manages plugin instances per track, ensuring proper resource allocation
 * and lifecycle management. Maintains compatibility with BaseAudioPlugin
 * while enabling track-based plugin architecture.
 *
 * Part of Story 3.21 Task 4 - Backward Compatibility Layer
 */

import { Track } from '../core/Track.js';
import { serviceRegistry } from '../core/ServiceRegistry.js';
import { EventBus } from '../core/EventBus.js';
import type { AudioPlugin, PluginCapability } from '../../types/plugin.js';
import { PlaybackError, ErrorSeverity } from '../errors/base.js';
import type * as Tone from 'tone';
import { createStructuredLogger } from '@bassnotion/contracts';

interface PluginInstance {
  plugin: AudioPlugin;
  trackId: string;
  instanceId: string;
  created: number;
  lastUsed: number;
  isActive: boolean;
}

interface PluginResourcePool {
  pluginType: string;
  instances: PluginInstance[];
  maxInstances: number;
  sharedResources?: any;
}

interface TrackPluginChain {
  trackId: string;
  plugins: string[]; // Plugin instance IDs in order
  bypassed: boolean;
}

/**
 * Manages plugin instances across tracks with resource optimization
 */
export class TrackPluginManager {
  // Plugin instance storage
  private pluginInstances = new Map<string, PluginInstance>();
  private trackPluginChains = new Map<string, TrackPluginChain>();

  // Resource pooling for optimization
  private resourcePools = new Map<string, PluginResourcePool>();

  // Plugin factory registry
  private pluginFactories = new Map<string, () => AudioPlugin>();

  // Services
  private eventBus?: EventBus;
  private tone: typeof Tone | null = null;

  // Performance tracking
  private metrics = {
    totalInstances: 0,
    activeInstances: 0,
    pooledInstances: 0,
    cpuUsage: 0,
    memoryUsage: 0,
  };

  constructor() {
    try {
      this.eventBus = serviceRegistry.get<EventBus>('eventBus');
    } catch (e) {
      logger.warn('EventBus not found in ServiceRegistry');
    }

    this.initializeDefaultFactories();
  }

  /**
   * Initialize with Tone.js instance
   */
  public initialize(tone: typeof Tone): void {
    this.tone = tone;
    logger.info('🔌 TrackPluginManager: Initialized');
  }

  /**
   * Register a plugin factory
   */
  public registerPluginFactory(
    pluginType: string,
    factory: () => AudioPlugin,
  ): void {
    this.pluginFactories.set(pluginType, factory);

    // Create resource pool for this plugin type
    this.resourcePools.set(pluginType, {
      pluginType,
      instances: [],
      maxInstances: this.calculateMaxInstances(pluginType),
    });

    logger.info(`🔌 TrackPluginManager: Registered factory for ${pluginType}`);
  }

  /**
   * Create or get a plugin instance for a track
   */
  public async createPluginForTrack(
    trackId: string,
    pluginType: string,
    config?: any,
  ): Promise<string> {
    // Check if we can reuse a pooled instance
    const pooledInstance = this.getPooledInstance(pluginType, trackId);
    if (pooledInstance) {
      logger.info(
        `🔌 TrackPluginManager: Reusing pooled ${pluginType} for track ${trackId}`,
      );
      return pooledInstance.instanceId;
    }

    // Create new instance
    const factory = this.pluginFactories.get(pluginType);
    if (!factory) {
      throw new PlaybackError(
        `Plugin factory not found for type: ${pluginType}`,
        'PLUGIN_FACTORY_NOT_FOUND',
        ErrorSeverity.HIGH,
      );
    }

    const plugin = factory();
    const instanceId = `${pluginType}-${trackId}-${Date.now()}`;

    // Initialize plugin
    if (this.tone && plugin.initialize) {
      await plugin.initialize(this.tone);
    }

    // Apply configuration
    if (config && plugin.applySettings) {
      plugin.applySettings(config);
    }

    // Store instance
    const instance: PluginInstance = {
      plugin,
      trackId,
      instanceId,
      created: Date.now(),
      lastUsed: Date.now(),
      isActive: true,
    };

    this.pluginInstances.set(instanceId, instance);

    // Add to track's plugin chain
    this.addToTrackChain(trackId, instanceId);

    // Update metrics
    this.metrics.totalInstances++;
    this.metrics.activeInstances++;

    // Emit creation event
    this.eventBus?.emit('plugin:created', {
      instanceId,
      trackId,
      pluginType,
    });

    logger.info(
      `🔌 TrackPluginManager: Created ${pluginType} instance ${instanceId} for track ${trackId}`,
    );

    return instanceId;
  }

  /**
   * Remove a plugin from a track
   */
  public async removePluginFromTrack(
    trackId: string,
    instanceId: string,
  ): Promise<void> {
    const instance = this.pluginInstances.get(instanceId);
    if (!instance) return;

    // Remove from track chain
    this.removeFromTrackChain(trackId, instanceId);

    // Check if plugin can be pooled for reuse
    if (this.canPoolInstance(instance)) {
      await this.poolInstance(instance);
    } else {
      // Dispose plugin
      if (instance.plugin.dispose) {
        await instance.plugin.dispose();
      }

      this.pluginInstances.delete(instanceId);
      this.metrics.totalInstances--;
    }

    this.metrics.activeInstances--;

    // Emit removal event
    this.eventBus?.emit('plugin:removed', {
      instanceId,
      trackId,
    });
  }

  /**
   * Get all plugins for a track
   */
  public getTrackPlugins(trackId: string): AudioPlugin[] {
    const chain = this.trackPluginChains.get(trackId);
    if (!chain) return [];

    return chain.plugins
      .map((instanceId) => this.pluginInstances.get(instanceId))
      .filter((instance) => instance !== undefined)
      .map((instance) => instance!.plugin);
  }

  /**
   * Process audio through track's plugin chain
   */
  public processTrackAudio(
    trackId: string,
    input: any, // Tone.js audio node
    output: any, // Tone.js audio node
  ): void {
    const chain = this.trackPluginChains.get(trackId);
    if (!chain || chain.bypassed) {
      // Direct connection if no plugins or bypassed
      input.connect(output);
      return;
    }

    let currentNode = input;

    // Process through each plugin in the chain
    for (const instanceId of chain.plugins) {
      const instance = this.pluginInstances.get(instanceId);
      if (!instance || !instance.plugin.process) continue;

      // Update last used time
      instance.lastUsed = Date.now();

      // Process through plugin
      const pluginOutput = instance.plugin.process(currentNode);
      if (pluginOutput) {
        currentNode = pluginOutput;
      }
    }

    // Connect final output
    currentNode.connect(output);
  }

  /**
   * Bypass/unbypass track plugin chain
   */
  public setTrackBypass(trackId: string, bypassed: boolean): void {
    const chain = this.trackPluginChains.get(trackId);
    if (chain) {
      chain.bypassed = bypassed;

      this.eventBus?.emit('plugin:chainBypassed', {
        trackId,
        bypassed,
      });
    }
  }

  /**
   * Reorder plugins in track chain
   */
  public reorderTrackPlugins(trackId: string, newOrder: string[]): void {
    const chain = this.trackPluginChains.get(trackId);
    if (!chain) return;

    // Validate all plugins exist
    const validPlugins = newOrder.filter((id) => chain.plugins.includes(id));

    chain.plugins = validPlugins;

    this.eventBus?.emit('plugin:chainReordered', {
      trackId,
      order: validPlugins,
    });
  }

  /**
   * Optimize resource usage by cleaning up unused instances
   */
  public optimizeResources(): void {
    const now = Date.now();
    const maxIdleTime = 60000; // 1 minute

    for (const [instanceId, instance] of this.pluginInstances.entries()) {
      if (!instance.isActive && now - instance.lastUsed > maxIdleTime) {
        // Dispose idle instances
        if (instance.plugin.dispose) {
          instance.plugin.dispose();
        }

        this.pluginInstances.delete(instanceId);
        this.metrics.totalInstances--;

        logger.info(
          `🔌 TrackPluginManager: Disposed idle instance ${instanceId}`,
        );
      }
    }

    // Update metrics
    this.updateResourceMetrics();
  }

  /**
   * Initialize default plugin factories
   */
  private initializeDefaultFactories(): void {
    // These would be imported from existing plugins
    // Placeholder for actual plugin imports

    // Example: Bass processor
    this.registerPluginFactory('bass', () => {
      // Would import and create BassProcessor instance
      return {
        id: 'bass-processor',
        name: 'Bass Processor',
        type: 'processor',
        capabilities: ['process', 'bypass'] as PluginCapability[],
        version: '1.0.0',
      } as AudioPlugin;
    });

    // Add more default factories...
  }

  /**
   * Calculate maximum instances for a plugin type
   */
  private calculateMaxInstances(pluginType: string): number {
    // Resource-based calculation
    // Could be made more sophisticated based on device capabilities
    switch (pluginType) {
      case 'reverb':
      case 'delay':
        return 4; // Expensive effects
      case 'eq':
      case 'compressor':
        return 8; // Moderate cost
      default:
        return 16; // Default for lightweight plugins
    }
  }

  /**
   * Get a pooled instance if available
   */
  private getPooledInstance(
    pluginType: string,
    trackId: string,
  ): PluginInstance | undefined {
    const pool = this.resourcePools.get(pluginType);
    if (!pool) return undefined;

    // Find an inactive instance we can reuse
    const available = Array.from(this.pluginInstances.values()).find(
      (instance) =>
        instance.plugin.type === pluginType &&
        !instance.isActive &&
        instance.trackId !== trackId, // Don't reuse on same track
    );

    if (available) {
      // Reactivate instance
      available.isActive = true;
      available.trackId = trackId;
      available.lastUsed = Date.now();

      this.metrics.pooledInstances++;

      return available;
    }

    return undefined;
  }

  /**
   * Check if instance can be pooled
   */
  private canPoolInstance(instance: PluginInstance): boolean {
    const pool = this.resourcePools.get(instance.plugin.type || '');
    if (!pool) return false;

    // Check if we're under the max pool size
    const pooledCount = Array.from(this.pluginInstances.values()).filter(
      (inst) => inst.plugin.type === instance.plugin.type && !inst.isActive,
    ).length;

    return pooledCount < pool.maxInstances;
  }

  /**
   * Pool an instance for reuse
   */
  private async poolInstance(instance: PluginInstance): Promise<void> {
    // Reset plugin state if possible
    if (instance.plugin.reset) {
      await instance.plugin.reset();
    }

    // Mark as inactive
    instance.isActive = false;

    logger.info(
      `🔌 TrackPluginManager: Pooled instance ${instance.instanceId}`,
    );
  }

  /**
   * Add plugin to track chain
   */
  private addToTrackChain(trackId: string, instanceId: string): void {
    let chain = this.trackPluginChains.get(trackId);

    if (!chain) {
      chain = {
        trackId,
        plugins: [],
        bypassed: false,
      };
      this.trackPluginChains.set(trackId, chain);
    }

    chain.plugins.push(instanceId);
  }

  /**
   * Remove plugin from track chain
   */
  private removeFromTrackChain(trackId: string, instanceId: string): void {
    const chain = this.trackPluginChains.get(trackId);
    if (!chain) return;

    chain.plugins = chain.plugins.filter((id) => id !== instanceId);

    // Remove chain if empty
    if (chain.plugins.length === 0) {
      this.trackPluginChains.delete(trackId);
    }
  }

  /**
   * Update resource usage metrics
   */
  private updateResourceMetrics(): void {
    // Calculate CPU usage estimate
    let cpuEstimate = 0;
    for (const instance of this.pluginInstances.values()) {
      if (instance.isActive) {
        // Rough estimates per plugin type
        switch (instance.plugin.type) {
          case 'reverb':
            cpuEstimate += 5;
            break;
          case 'delay':
            cpuEstimate += 3;
            break;
          case 'compressor':
            cpuEstimate += 2;
            break;
          default:
            cpuEstimate += 1;
        }
      }
    }

    this.metrics.cpuUsage = cpuEstimate;

    // Memory usage estimate (very rough)
    this.metrics.memoryUsage = this.metrics.totalInstances * 0.5; // MB

    // Emit metrics update
    this.eventBus?.emit('plugin:metricsUpdated', this.metrics);
  }

  /**
   * Get current metrics
   */
  public getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Dispose all plugins and cleanup
   */
  public async dispose(): Promise<void> {
    // Dispose all plugin instances
    for (const instance of this.pluginInstances.values()) {
      if (instance.plugin.dispose) {
        await instance.plugin.dispose();
      }
    }

    // Clear all data
    this.pluginInstances.clear();
    this.trackPluginChains.clear();
    this.resourcePools.clear();
    this.pluginFactories.clear();

    logger.info('🔌 TrackPluginManager: Disposed');
  }
}
