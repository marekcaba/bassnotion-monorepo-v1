/**
 * Track Plugin Manager - Advanced Plugin Resource Management
 *
 * Extracted from services/plugins/TrackPluginManager.ts
 *
 * Manages plugin instances across tracks with resource optimization:
 * - Per-track plugin instance pooling
 * - Resource sharing across plugin instances
 * - Plugin chain management with bypass capability
 * - Performance tracking and optimization
 * - Automatic resource allocation and cleanup
 */

import { EventBus } from '../../shared/index.js';
import { createStructuredLogger } from '@/shared/utils/errorHandling';
import { getPersistentAudioContext } from '../../../utils/audioContext.js';
import type { AudioPlugin } from '../../../types/plugin.js';
import {
  PluginCategory,
  PluginPriority,
  PluginState,
  ProcessingResultStatus,
} from '../../../types/plugin.js';
import type * as Tone from 'tone';

const logger = createStructuredLogger('TrackPluginManager');

// Plugin management interfaces
export interface PluginInstance {
  plugin: AudioPlugin;
  trackId: string;
  instanceId: string;
  created: number;
  lastUsed: number;
  isActive: boolean;
}

export interface PluginResourcePool {
  pluginType: string;
  instances: PluginInstance[];
  maxInstances: number;
  sharedResources?: any;
}

export interface TrackPluginChain {
  trackId: string;
  plugins: string[]; // Plugin instance IDs in order
  bypassed: boolean;
}

export interface PluginMetrics {
  totalInstances: number;
  activeInstances: number;
  pooledInstances: number;
  cpuUsage: number;
  memoryUsage: number;
}

export interface PluginAllocationOptions {
  preferPooled?: boolean;
  maxConcurrent?: number;
  resourceSharing?: boolean;
  priority?: 'low' | 'normal' | 'high';
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

  // Performance tracking
  private metrics: PluginMetrics = {
    totalInstances: 0,
    activeInstances: 0,
    pooledInstances: 0,
    cpuUsage: 0,
    memoryUsage: 0,
  };

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus;
    this.initializeDefaultFactories();
  }

  /**
   * Initialize with Tone.js instance
   */
  initialize(_tone: typeof Tone): void {
    // Tone instance is not used in this implementation
    logger.info('🔌 TrackPluginManager: Initialized');
  }

  /**
   * Register a plugin factory
   */
  registerPluginFactory(pluginType: string, factory: () => AudioPlugin): void {
    this.pluginFactories.set(pluginType, factory);

    // Create resource pool for this plugin type
    this.resourcePools.set(pluginType, {
      pluginType,
      instances: [],
      maxInstances: this.calculateMaxInstances(pluginType),
    });

    logger.info(`🔌 Registered plugin factory: ${pluginType}`);
  }

  /**
   * Allocate a plugin instance for a track
   */
  async allocatePlugin(
    trackId: string,
    pluginType: string,
    options: PluginAllocationOptions = {},
  ): Promise<string | null> {
    try {
      // Check if we can reuse from pool
      if (options.preferPooled !== false) {
        const pooledInstance = this.getPooledInstance(pluginType, trackId);
        if (pooledInstance) {
          return this.activatePooledInstance(pooledInstance, trackId);
        }
      }

      // Create new instance if factory available
      const factory = this.pluginFactories.get(pluginType);
      if (!factory) {
        logger.error(`No factory registered for plugin type: ${pluginType}`);
        return null;
      }

      // Check resource limits
      if (!this.canAllocateInstance(pluginType, options)) {
        logger.warn(`Resource limit reached for plugin type: ${pluginType}`);
        return null;
      }

      // Create new plugin instance
      const plugin = factory();
      const instanceId = this.generateInstanceId(pluginType, trackId);

      const instance: PluginInstance = {
        plugin,
        trackId,
        instanceId,
        created: Date.now(),
        lastUsed: Date.now(),
        isActive: true,
      };

      // Initialize plugin with the shared AudioContext singleton
      const sharedContext = getPersistentAudioContext();
      const context: any = {
        audioContext: sharedContext,
        sampleRate: sharedContext?.sampleRate ?? 48000,
        bufferSize: 1024,
        currentTime: sharedContext?.currentTime ?? 0,
      };
      await plugin.initialize(context);

      this.pluginInstances.set(instanceId, instance);
      this.addToTrackChain(trackId, instanceId);
      this.updateMetrics();

      logger.info(`🔌 Allocated plugin: ${pluginType} for track ${trackId}`);
      this.emitEvent('plugin:allocated', { trackId, pluginType, instanceId });

      return instanceId;
    } catch (error) {
      logger.error(
        `Failed to allocate plugin ${pluginType} for track ${trackId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      return null;
    }
  }

  /**
   * Deallocate a plugin instance
   */
  async deallocatePlugin(instanceId: string): Promise<boolean> {
    const instance = this.pluginInstances.get(instanceId);
    if (!instance) {
      logger.warn(`Plugin instance not found: ${instanceId}`);
      return false;
    }

    try {
      // Remove from track chain
      this.removeFromTrackChain(instance.trackId, instanceId);

      // Check if we should pool or dispose
      if (this.shouldPool(instance)) {
        await this.poolInstance(instance);
      } else {
        await this.disposeInstance(instance);
      }

      this.pluginInstances.delete(instanceId);
      this.updateMetrics();

      logger.info(`🔌 Deallocated plugin: ${instanceId}`);
      this.emitEvent('plugin:deallocated', {
        instanceId,
        trackId: instance.trackId,
      });

      return true;
    } catch (error) {
      logger.error(
        `Failed to deallocate plugin ${instanceId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /**
   * Get plugin instance by ID
   */
  getPluginInstance(instanceId: string): PluginInstance | undefined {
    return this.pluginInstances.get(instanceId);
  }

  /**
   * Get all plugins for a track
   */
  getTrackPlugins(trackId: string): PluginInstance[] {
    const chain = this.trackPluginChains.get(trackId);
    if (!chain) return [];

    return chain.plugins
      .map((id) => this.pluginInstances.get(id))
      .filter((instance): instance is PluginInstance => instance !== undefined);
  }

  /**
   * Update plugin chain order for a track
   */
  updateTrackChain(trackId: string, pluginIds: string[]): boolean {
    const chain = this.trackPluginChains.get(trackId);
    if (!chain) {
      logger.warn(`No plugin chain found for track: ${trackId}`);
      return false;
    }

    // Validate all plugin IDs exist
    const validIds = pluginIds.filter((id) => this.pluginInstances.has(id));
    if (validIds.length !== pluginIds.length) {
      logger.warn(`Some plugin IDs not found for track ${trackId}`);
    }

    chain.plugins = validIds;
    this.emitEvent('chain:updated', { trackId, pluginIds: validIds });

    return true;
  }

  /**
   * Bypass/unbypass plugin chain for a track
   */
  setTrackChainBypass(trackId: string, bypassed: boolean): boolean {
    const chain = this.trackPluginChains.get(trackId);
    if (!chain) {
      logger.warn(`No plugin chain found for track: ${trackId}`);
      return false;
    }

    chain.bypassed = bypassed;
    this.emitEvent('chain:bypass', { trackId, bypassed });

    return true;
  }

  /**
   * Process audio through track's plugin chain
   */
  async processTrackAudio(trackId: string, audioData: any): Promise<any> {
    const chain = this.trackPluginChains.get(trackId);
    if (!chain || chain.bypassed) {
      return audioData; // Pass through unchanged
    }

    let processedData = audioData;

    // Process through each plugin in the chain
    for (const instanceId of chain.plugins) {
      const instance = this.pluginInstances.get(instanceId);
      if (!instance || !instance.isActive) continue;

      try {
        // Update usage tracking
        instance.lastUsed = Date.now();

        // Process audio through plugin's process method
        const outputBuffer = processedData; // Assuming processedData is AudioBuffer
        const sharedContext = getPersistentAudioContext();
        const context: any = {
          audioContext: sharedContext,
          sampleRate: sharedContext?.sampleRate ?? 48000,
          bufferSize: 1024,
          currentTime: sharedContext?.currentTime ?? Date.now() / 1000,
        };
        const result = await instance.plugin.process(
          processedData,
          outputBuffer,
          context,
        );
        if (result.success) {
          processedData = outputBuffer;
        }
      } catch (error) {
        logger.error(
          `Plugin processing error in ${instanceId}:`,
          error instanceof Error ? error : new Error(String(error)),
        );
        // Continue with next plugin instead of failing entire chain
      }
    }

    return processedData;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PluginMetrics {
    return { ...this.metrics };
  }

  /**
   * Get resource pool statistics
   */
  getPoolStats(): Record<
    string,
    { total: number; active: number; pooled: number }
  > {
    const stats: Record<
      string,
      { total: number; active: number; pooled: number }
    > = {};

    for (const [pluginType, pool] of this.resourcePools.entries()) {
      const total = pool.instances.length;
      const active = pool.instances.filter((i) => i.isActive).length;
      const pooled = total - active;

      stats[pluginType] = { total, active, pooled };
    }

    return stats;
  }

  /**
   * Cleanup unused plugin instances
   */
  async cleanupUnusedInstances(
    maxAge: number = 5 * 60 * 1000,
  ): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();

    const instancesToCleanup = Array.from(this.pluginInstances.values()).filter(
      (instance) => !instance.isActive && now - instance.lastUsed > maxAge,
    );

    for (const instance of instancesToCleanup) {
      try {
        await this.disposeInstance(instance);
        this.pluginInstances.delete(instance.instanceId);
        cleanedCount++;
      } catch (error) {
        logger.error(
          `Failed to cleanup instance ${instance.instanceId}:`,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    this.updateMetrics();

    if (cleanedCount > 0) {
      logger.info(`🧹 Cleaned up ${cleanedCount} unused plugin instances`);
      this.emitEvent('cleanup:completed', { cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Optimize resource pools
   */
  async optimizePools(): Promise<void> {
    for (const [_pluginType, pool] of this.resourcePools.entries()) {
      // Remove inactive instances from pool
      const activeInstances = pool.instances.filter((i) => i.isActive);
      const inactiveInstances = pool.instances.filter((i) => !i.isActive);

      // Track instances to dispose
      let toDispose: PluginInstance[] = [];

      // Dispose oldest inactive instances if pool is too large
      if (inactiveInstances.length > pool.maxInstances * 0.3) {
        toDispose = inactiveInstances
          .sort((a, b) => a.lastUsed - b.lastUsed)
          .slice(0, Math.floor(inactiveInstances.length * 0.5));

        for (const instance of toDispose) {
          await this.disposeInstance(instance);
          this.pluginInstances.delete(instance.instanceId);
        }
      }

      // Update pool
      pool.instances = activeInstances.concat(
        inactiveInstances.filter((i) => !toDispose.includes(i)),
      );
    }

    this.updateMetrics();
    logger.info('🔧 Optimized plugin resource pools');
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    // Dispose all instances
    const disposePromises = Array.from(this.pluginInstances.values()).map(
      (instance) => this.disposeInstance(instance),
    );
    await Promise.all(disposePromises);

    // Clear all data structures
    this.pluginInstances.clear();
    this.trackPluginChains.clear();
    this.resourcePools.clear();
    this.pluginFactories.clear();

    this.updateMetrics();
    logger.info('🧹 TrackPluginManager cleanup completed');
  }

  // ==========================================
  // Private Implementation Methods
  // ==========================================

  private initializeDefaultFactories(): void {
    // Register basic plugin types with simple factories
    this.registerPluginFactory('effect', () => this.createBasicEffectPlugin());
    this.registerPluginFactory('analyzer', () =>
      this.createBasicAnalyzerPlugin(),
    );
  }

  private createBasicEffectPlugin(): AudioPlugin {
    const plugin: AudioPlugin = {
      metadata: {
        id: this.generatePluginId('effect'),
        name: 'Basic Effect',
        version: '1.0.0',
        description: 'Basic effect plugin for testing',
        author: 'Bassicology',
        license: 'MIT',
        category: PluginCategory.EFFECT,
        tags: ['effect', 'basic'],
        capabilities: {
          supportsRealtimeProcessing: true,
          supportsOfflineProcessing: false,
          supportsAudioWorklet: false,
          supportsMIDI: false,
          supportsAutomation: false,
          supportsPresets: false,
          supportsSidechain: false,
          supportsMultiChannel: false,
          maxLatency: 0,
          cpuUsage: 0.1,
          memoryUsage: 1,
          minSampleRate: 44100,
          maxSampleRate: 192000,
          supportedBufferSizes: [256, 512, 1024, 2048],
          supportsN8nPayload: false,
          supportsAssetLoading: false,
          supportsMobileOptimization: false,
        },
        dependencies: [],
      },
      config: {
        id: this.generatePluginId('effect'),
        name: 'Basic Effect',
        version: '1.0.0',
        category: PluginCategory.EFFECT,
        enabled: true,
        priority: PluginPriority.NORMAL,
        autoStart: false,
        inputChannels: 2,
        outputChannels: 2,
        settings: {},
      },
      state: PluginState.UNLOADED,
      capabilities: {
        supportsRealtimeProcessing: true,
        supportsOfflineProcessing: false,
        supportsAudioWorklet: false,
        supportsMIDI: false,
        supportsAutomation: false,
        supportsPresets: false,
        supportsSidechain: false,
        supportsMultiChannel: false,
        maxLatency: 0,
        cpuUsage: 0.1,
        memoryUsage: 1,
        minSampleRate: 44100,
        maxSampleRate: 192000,
        supportedBufferSizes: [256, 512, 1024, 2048],
        supportsN8nPayload: false,
        supportsAssetLoading: false,
        supportsMobileOptimization: false,
      },
      parameters: new Map(),
      load: async () => {
        logger.debug('Basic effect plugin loaded');
      },
      initialize: async () => {
        logger.debug('Basic effect plugin initialized');
      },
      activate: async () => {
        logger.debug('Basic effect plugin activated');
      },
      deactivate: async () => {
        logger.debug('Basic effect plugin deactivated');
      },
      dispose: async () => {
        logger.debug('Basic effect plugin disposed');
      },
      process: async (_inputBuffer: AudioBuffer, outputBuffer: AudioBuffer) => {
        // Basic pass-through processing
        return {
          success: true,
          status: ProcessingResultStatus.SUCCESS,
          processingTime: 0,
          bypassMode: false,
          processedSamples: outputBuffer.length,
          cpuUsage: 0.1,
          memoryUsage: 1,
        };
      },
      setParameter: async () => {
        // No parameters to set
      },
      getParameter: () => undefined,
      resetParameters: async () => {
        // No parameters to reset
      },
      savePreset: async () => ({}),
      loadPreset: async () => {
        // No preset to load
      },
      on: () => () => {
        // Event handler stub
      },
      off: () => {
        // Event handler stub
      },
    };
    return plugin;
  }

  private createBasicAnalyzerPlugin(): AudioPlugin {
    const plugin: AudioPlugin = {
      metadata: {
        id: this.generatePluginId('analyzer'),
        name: 'Basic Analyzer',
        version: '1.0.0',
        description: 'Basic analyzer plugin for testing',
        author: 'Bassicology',
        license: 'MIT',
        category: PluginCategory.ANALYZER,
        tags: ['analyzer', 'basic'],
        capabilities: {
          supportsRealtimeProcessing: true,
          supportsOfflineProcessing: false,
          supportsAudioWorklet: false,
          supportsMIDI: false,
          supportsAutomation: false,
          supportsPresets: false,
          supportsSidechain: false,
          supportsMultiChannel: false,
          maxLatency: 0,
          cpuUsage: 0.05,
          memoryUsage: 0.5,
          minSampleRate: 44100,
          maxSampleRate: 192000,
          supportedBufferSizes: [256, 512, 1024, 2048],
          supportsN8nPayload: false,
          supportsAssetLoading: false,
          supportsMobileOptimization: false,
        },
        dependencies: [],
      },
      config: {
        id: this.generatePluginId('analyzer'),
        name: 'Basic Analyzer',
        version: '1.0.0',
        category: PluginCategory.ANALYZER,
        enabled: true,
        priority: PluginPriority.NORMAL,
        autoStart: false,
        inputChannels: 2,
        outputChannels: 2,
        settings: {},
      },
      state: PluginState.UNLOADED,
      capabilities: {
        supportsRealtimeProcessing: true,
        supportsOfflineProcessing: false,
        supportsAudioWorklet: false,
        supportsMIDI: false,
        supportsAutomation: false,
        supportsPresets: false,
        supportsSidechain: false,
        supportsMultiChannel: false,
        maxLatency: 0,
        cpuUsage: 0.05,
        memoryUsage: 0.5,
        minSampleRate: 44100,
        maxSampleRate: 192000,
        supportedBufferSizes: [256, 512, 1024, 2048],
        supportsN8nPayload: false,
        supportsAssetLoading: false,
        supportsMobileOptimization: false,
      },
      parameters: new Map(),
      load: async () => {
        logger.debug('Basic analyzer plugin loaded');
      },
      initialize: async () => {
        logger.debug('Basic analyzer plugin initialized');
      },
      activate: async () => {
        logger.debug('Basic analyzer plugin activated');
      },
      deactivate: async () => {
        logger.debug('Basic analyzer plugin deactivated');
      },
      dispose: async () => {
        logger.debug('Basic analyzer plugin disposed');
      },
      process: async (_inputBuffer: AudioBuffer, outputBuffer: AudioBuffer) => {
        // Basic analysis processing
        return {
          success: true,
          status: ProcessingResultStatus.SUCCESS,
          processingTime: 0,
          bypassMode: false,
          processedSamples: outputBuffer.length,
          cpuUsage: 0.05,
          memoryUsage: 0.5,
        };
      },
      setParameter: async () => {
        // No parameters to set
      },
      getParameter: () => undefined,
      resetParameters: async () => {
        // No parameters to reset
      },
      savePreset: async () => ({}),
      loadPreset: async () => {
        // No preset to load
      },
      on: () => () => {
        // Event handler stub
      },
      off: () => {
        // Event handler stub
      },
    };
    return plugin;
  }

  private calculateMaxInstances(pluginType: string): number {
    // Calculate reasonable limits based on plugin type
    switch (pluginType) {
      case 'effect':
        return 16; // Allow many effect instances
      case 'instrument':
        return 8; // Moderate instrument instances
      case 'analyzer':
        return 4; // Few analyzer instances needed
      default:
        return 6;
    }
  }

  private getPooledInstance(
    pluginType: string,
    trackId: string,
  ): PluginInstance | null {
    const pool = this.resourcePools.get(pluginType);
    if (!pool) return null;

    // Find inactive instance that can be reused
    const availableInstance = pool.instances.find(
      (instance) => !instance.isActive && instance.trackId === trackId,
    );

    // If no track-specific instance, try any inactive instance
    if (!availableInstance) {
      return pool.instances.find((instance) => !instance.isActive) || null;
    }

    return availableInstance;
  }

  private activatePooledInstance(
    instance: PluginInstance,
    trackId: string,
  ): string {
    instance.isActive = true;
    instance.trackId = trackId;
    instance.lastUsed = Date.now();

    this.addToTrackChain(trackId, instance.instanceId);
    this.updateMetrics();

    logger.info(`♻️ Reactivated pooled plugin: ${instance.instanceId}`);
    return instance.instanceId;
  }

  private canAllocateInstance(
    pluginType: string,
    options: PluginAllocationOptions,
  ): boolean {
    const pool = this.resourcePools.get(pluginType);
    if (!pool) return true; // No pool limits

    const activeCount = pool.instances.filter((i) => i.isActive).length;
    const maxConcurrent = options.maxConcurrent || pool.maxInstances;

    return activeCount < maxConcurrent;
  }

  private generateInstanceId(pluginType: string, trackId: string): string {
    return `${pluginType}_${trackId}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generatePluginId(type: string): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

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

    if (!chain.plugins.includes(instanceId)) {
      chain.plugins.push(instanceId);
    }
  }

  private removeFromTrackChain(trackId: string, instanceId: string): void {
    const chain = this.trackPluginChains.get(trackId);
    if (!chain) return;

    const index = chain.plugins.indexOf(instanceId);
    if (index > -1) {
      chain.plugins.splice(index, 1);
    }

    // Remove empty chains
    if (chain.plugins.length === 0) {
      this.trackPluginChains.delete(trackId);
    }
  }

  private shouldPool(instance: PluginInstance): boolean {
    // Pool instances that are recently used and not resource-intensive
    const recentlyUsed = Date.now() - instance.lastUsed < 2 * 60 * 1000; // 2 minutes
    const pool = this.resourcePools.get((instance.plugin as any).type);
    const hasCapacity = pool
      ? pool.instances.length < pool.maxInstances
      : false;

    return recentlyUsed && hasCapacity;
  }

  private async poolInstance(instance: PluginInstance): Promise<void> {
    instance.isActive = false;

    const pool = this.resourcePools.get((instance.plugin as any).type);
    if (pool) {
      // Check if already in pool
      const existingIndex = pool.instances.findIndex(
        (i) => i.instanceId === instance.instanceId,
      );
      if (existingIndex === -1) {
        pool.instances.push(instance);
      }
    }

    logger.debug(`♻️ Pooled plugin instance: ${instance.instanceId}`);
  }

  private async disposeInstance(instance: PluginInstance): Promise<void> {
    try {
      // Call plugin's dispose method if available
      if (instance.plugin.dispose) {
        await instance.plugin.dispose();
      }

      // Remove from pool if present
      const pool = this.resourcePools.get((instance.plugin as any).type);
      if (pool) {
        const index = pool.instances.findIndex(
          (i) => i.instanceId === instance.instanceId,
        );
        if (index > -1) {
          pool.instances.splice(index, 1);
        }
      }

      logger.debug(`🗑️ Disposed plugin instance: ${instance.instanceId}`);
    } catch (error) {
      logger.error(
        `Error disposing plugin instance ${instance.instanceId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private updateMetrics(): void {
    this.metrics.totalInstances = this.pluginInstances.size;
    this.metrics.activeInstances = Array.from(
      this.pluginInstances.values(),
    ).filter((i) => i.isActive).length;

    let pooledCount = 0;
    for (const pool of this.resourcePools.values()) {
      pooledCount += pool.instances.filter((i) => !i.isActive).length;
    }
    this.metrics.pooledInstances = pooledCount;

    // Estimate resource usage
    this.metrics.memoryUsage = this.metrics.totalInstances * 1024 * 1024; // 1MB per instance estimate
    this.metrics.cpuUsage = this.metrics.activeInstances * 5; // 5% per active instance estimate
  }

  private emitEvent(eventType: string, data: any): void {
    if (this.eventBus) {
      this.eventBus.emit(eventType, data);
    }
    logger.debug(`Event: ${eventType}`, data);
  }
}

// Factory function for easier instantiation
export function createTrackPluginManager(
  eventBus?: EventBus,
): TrackPluginManager {
  return new TrackPluginManager(eventBus);
}
