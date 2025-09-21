/**
 * WAM Host Manager
 *
 * Manages the lifecycle and registry of Web Audio Modules (WAM) plugins
 * within BassNotion's track-based architecture. Provides centralized
 * management, discovery, and performance monitoring for WAM plugins.
 *
 * Features:
 * - Plugin discovery and registration
 * - Instance management with resource pooling
 * - Performance monitoring and optimization
 * - Latency compensation coordination
 * - Device capability detection
 *
 * Part of Story 3.21 Task 7 - Web Audio Standards Compliance
 */

import type {
  WamEnv,
  WamGroup,
  WamDescriptor,
  WamPluginRegistration,
  WamHostCapabilities,
  WamError,
  WamErrorType,
} from '../../types/wam.js';

import type {
  AudioPlugin,
  PluginConfig,
  PluginCategory,
} from '../../types/plugin.js';

import { WamPluginAdapter } from './WamPluginAdapter.js';
import { TransportAdapter } from '../../../../services/core/TransportAdapter.js';
import { serviceRegistry } from '../../../../services/core/ServiceRegistry.js';
import { EventBus } from '../../../../services/core/EventBus.js';
import {
  PlaybackError,
  ErrorSeverity,
} from '../../../../services/errors/base.js';
import { PerformanceOptimizer } from '../core/PerformanceOptimizer.js';
import { DeviceCapabilityManager } from '../core/DeviceCapabilityManager.js';
import { createStructuredLogger } from '@bassnotion/contracts';

/**
 * WAM host configuration
 */
interface WamHostConfig {
  groupId: string;
  hostId: string;
  maxPluginsPerTrack: number;
  enableLatencyCompensation: boolean;
  enableDeviceOptimization: boolean;
  pluginSearchPaths: string[];
  preloadPlugins: string[];
}

/**
 * Plugin instance tracking
 */
interface PluginInstance {
  adapter: WamPluginAdapter;
  trackId: string;
  createdAt: number;
  lastUsed: number;
  usageCount: number;
}

/**
 * Performance metrics for WAM plugins
 */
interface WamPerformanceMetrics {
  pluginId: string;
  averageProcessingTime: number;
  maxProcessingTime: number;
  totalProcessingTime: number;
  sampleCount: number;
  cpuUsage: number;
  memoryUsage: number;
  latency: number;
}

/**
 * WAM Host Manager Service
 */
export class WamHostManager {
  private static instance: WamHostManager | null = null;

  // Core properties
  private wamEnv: any = null; // Using any since we're not using the external SDK
  private wamGroup: any = null; // Using any since we're not using the external SDK
  private config: WamHostConfig;

  // Plugin registry
  private registeredPlugins = new Map<string, WamPluginRegistration>();
  private pluginInstances = new Map<string, PluginInstance>();
  private pluginsByTrack = new Map<string, Set<string>>();

  // Performance tracking
  private performanceMetrics = new Map<string, WamPerformanceMetrics>();
  private latencyCompensation = new Map<string, number>();

  // Services
  private transport: TransportAdapter;
  private eventBus?: EventBus;
  private performanceOptimizer?: PerformanceOptimizer;
  private deviceCapabilityManager?: DeviceCapabilityManager;

  // Host capabilities
  private hostCapabilities: WamHostCapabilities = {
    supportsAudioWorklet: true,
    supportsSampleAccurateTiming: true,
    maxDriftTolerance: 1, // 1ms max drift
    supportsMultiChannel: true,
    maxChannelCount: 32,
    supportsSidechain: false, // Not yet implemented
    supportsTransportSync: true,
    supportsMusicalTime: true,
    supportsBarBeatSync: true,
    supportsParameterAutomation: true,
    supportsPatternBasedAutomation: true,
    maxPluginsPerTrack: 16,
    supportsPluginLatencyCompensation: true,
  };

  // Loading state
  private isInitialized = false;
  private loadingPlugins = new Set<string>();

  private constructor(config?: Partial<WamHostConfig>) {
    this.config = {
      groupId: 'bassnotion-main',
      hostId: 'bassnotion-daw',
      maxPluginsPerTrack: 16,
      enableLatencyCompensation: true,
      enableDeviceOptimization: true,
      pluginSearchPaths: ['/wam-plugins/', './plugins/wam/'],
      preloadPlugins: [],
      ...config,
    };

    // Get services
    this.transport = TransportAdapter.getInstance();

    try {
      this.eventBus = serviceRegistry.get<EventBus>('eventBus');
      this.performanceOptimizer = serviceRegistry.get<PerformanceOptimizer>(
        'performanceOptimizer',
      );
      this.deviceCapabilityManager =
        serviceRegistry.get<DeviceCapabilityManager>('deviceCapabilityManager');
    } catch (e) {
      logger.warn('Some services not found in ServiceRegistry');
    }

    // Update host capabilities based on device
    this.updateDeviceCapabilities();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<WamHostConfig>): WamHostManager {
    if (!WamHostManager.instance) {
      WamHostManager.instance = new WamHostManager(config);
    }
    return WamHostManager.instance;
  }

  /**
   * Initialize WAM environment
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create minimal WAM environment without external SDK
      // We implement our own WAM-compatible interface
      this.wamEnv = {
        apiVersion: '2.0.0',
        createGroup: (hostId: string, groupId: string) => ({
          groupId,
          hostId,
          addWam: () => {},
          removeWam: () => {},
          connectWams: () => {},
          disconnectWams: () => {},
        }),
        getModuleUrl: () => undefined,
        registerModule: () => {},
      };

      // Create WAM group
      this.wamGroup = this.wamEnv.createGroup(
        this.config.hostId,
        this.config.groupId,
      );

      // Preload configured plugins
      await this.preloadPlugins();

      this.isInitialized = true;

      // Emit initialization event
      this.eventBus?.emit('wam:host:initialized', {
        hostId: this.config.hostId,
        groupId: this.config.groupId,
        capabilities: this.hostCapabilities,
      });

      logger.info('✅ WAM Host Manager initialized');
    } catch (error) {
      throw new PlaybackError(
        `Failed to initialize WAM host: ${error}`,
        'WAM_HOST_INIT_FAILED',
        ErrorSeverity.HIGH,
      );
    }
  }

  /**
   * Register a WAM plugin
   */
  async registerPlugin(
    moduleId: string,
    url: string,
    descriptor?: WamDescriptor,
  ): Promise<void> {
    if (this.registeredPlugins.has(moduleId)) {
      logger.warn(`WAM plugin ${moduleId} already registered`);
      return;
    }

    // Load descriptor if not provided
    let pluginDescriptor = descriptor;
    if (!pluginDescriptor) {
      try {
        const response = await fetch(`${url}/descriptor.json`);
        pluginDescriptor = await response.json();
      } catch (error) {
        throw new PlaybackError(
          `Failed to load WAM descriptor: ${error}`,
          'WAM_DESCRIPTOR_LOAD_FAILED',
          ErrorSeverity.MEDIUM,
        );
      }
    }

    // Register with WAM environment
    if (this.wamEnv) {
      this.wamEnv.registerModule(moduleId, url);
    }

    // Store registration
    const registration: WamPluginRegistration = {
      moduleId,
      url,
      descriptor: pluginDescriptor!,
      loadedAt: Date.now(),
      instanceCount: 0,
    };

    this.registeredPlugins.set(moduleId, registration);

    // Emit registration event
    this.eventBus?.emit('wam:plugin:registered', {
      moduleId,
      descriptor: pluginDescriptor,
    });

    logger.info(`✅ WAM plugin registered: ${moduleId}`);
  }

  /**
   * Create WAM plugin instance
   */
  async createPluginInstance(
    moduleId: string,
    trackId: string,
    config?: Partial<PluginConfig>,
  ): Promise<AudioPlugin> {
    const registration = this.registeredPlugins.get(moduleId);
    if (!registration) {
      throw new PlaybackError(
        `WAM plugin not registered: ${moduleId}`,
        'WAM_PLUGIN_NOT_FOUND',
        ErrorSeverity.MEDIUM,
      );
    }

    // Check track plugin limit
    const trackPlugins = this.pluginsByTrack.get(trackId) || new Set();
    if (trackPlugins.size >= this.config.maxPluginsPerTrack) {
      throw new PlaybackError(
        `Track plugin limit exceeded: ${trackId}`,
        'WAM_TRACK_PLUGIN_LIMIT',
        ErrorSeverity.LOW,
      );
    }

    try {
      // Create adapter instance
      const adapter = new WamPluginAdapter(
        registration.url,
        registration.descriptor,
        config,
      );

      // Generate unique instance ID using adapter's metadata ID
      const instanceId = adapter.metadata.id + '-' + Date.now();

      // Store instance
      const instance: PluginInstance = {
        adapter,
        trackId,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        usageCount: 0,
      };

      this.pluginInstances.set(instanceId, instance);

      // Update track mapping
      trackPlugins.add(instanceId);
      this.pluginsByTrack.set(trackId, trackPlugins);

      // Update registration count
      registration.instanceCount++;

      // Add to WAM group if initialized
      if (this.wamGroup && adapter.getWamInfo().instance) {
        this.wamGroup.addWam(adapter.getWamInfo().instance);
      }

      // Emit creation event
      this.eventBus?.emit('wam:plugin:created', {
        moduleId,
        instanceId,
        trackId,
      });

      return adapter;
    } catch (error) {
      throw new PlaybackError(
        `Failed to create WAM plugin instance: ${error}`,
        'WAM_INSTANCE_CREATE_FAILED',
        ErrorSeverity.MEDIUM,
      );
    }
  }

  /**
   * Get all plugin instances for a track
   */
  getTrackPlugins(trackId: string): AudioPlugin[] {
    const instanceIds = this.pluginsByTrack.get(trackId) || new Set();
    const plugins: AudioPlugin[] = [];

    for (const instanceId of instanceIds) {
      const instance = this.pluginInstances.get(instanceId);
      if (instance) {
        plugins.push(instance.adapter);
      }
    }

    return plugins;
  }

  /**
   * Remove plugin instance
   */
  async removePluginInstance(instanceId: string): Promise<void> {
    // Find instance by checking all stored instances
    let foundInstanceId: string | null = null;
    let instance: PluginInstance | null = null;

    // Since instanceId might be the adapter's metadata.id, we need to search for it
    for (const [storedId, storedInstance] of this.pluginInstances.entries()) {
      if (
        storedId === instanceId ||
        storedInstance.adapter.metadata.id === instanceId
      ) {
        foundInstanceId = storedId;
        instance = storedInstance;
        break;
      }
    }

    if (!instance || !foundInstanceId) return;

    // Dispose adapter
    await instance.adapter.dispose();

    // Remove from WAM group
    if (this.wamGroup) {
      const wamInfo = instance.adapter.getWamInfo();
      if (wamInfo.instance) {
        this.wamGroup.removeWam(wamInfo.instance.instanceId);
      }
    }

    // Remove from track mapping
    const trackPlugins = this.pluginsByTrack.get(instance.trackId);
    if (trackPlugins) {
      trackPlugins.delete(foundInstanceId);
      if (trackPlugins.size === 0) {
        this.pluginsByTrack.delete(instance.trackId);
      }
    }

    // Remove instance
    this.pluginInstances.delete(foundInstanceId);

    // Update registration count - need to find the moduleId
    // The adapter's metadata.id format is "wam-vendor-name"
    for (const [moduleId, registration] of this.registeredPlugins.entries()) {
      const expectedId =
        `wam-${registration.descriptor.vendor}-${registration.descriptor.name}`
          .toLowerCase()
          .replace(/\s+/g, '-');
      if (expectedId === instance.adapter.metadata.id) {
        registration.instanceCount--;
        break;
      }
    }

    // Remove performance metrics
    this.performanceMetrics.delete(foundInstanceId);
    this.latencyCompensation.delete(foundInstanceId);

    // Emit removal event
    this.eventBus?.emit('wam:plugin:removed', {
      instanceId: foundInstanceId,
      trackId: instance.trackId,
    });
  }

  /**
   * Get total latency compensation for a track
   */
  getTrackLatencyCompensation(trackId: string): number {
    const instanceIds = this.pluginsByTrack.get(trackId) || new Set();
    let totalLatency = 0;

    for (const instanceId of instanceIds) {
      const latency = this.latencyCompensation.get(instanceId) || 0;
      totalLatency += latency;
    }

    return totalLatency;
  }

  /**
   * Update plugin latency
   */
  updatePluginLatency(instanceId: string, latency: number): void {
    this.latencyCompensation.set(instanceId, latency);

    // Notify transport of latency change
    const instance = this.pluginInstances.get(instanceId);
    if (instance) {
      this.eventBus?.emit('wam:latency:updated', {
        instanceId,
        trackId: instance.trackId,
        latency,
        totalTrackLatency: this.getTrackLatencyCompensation(instance.trackId),
      });
    }
  }

  /**
   * Update plugin performance metrics
   */
  updatePerformanceMetrics(
    instanceId: string,
    processingTime: number,
    cpuUsage: number,
  ): void {
    let metrics = this.performanceMetrics.get(instanceId);

    if (!metrics) {
      const instance = this.pluginInstances.get(instanceId);
      if (!instance) return;

      metrics = {
        pluginId: instanceId,
        averageProcessingTime: processingTime,
        maxProcessingTime: processingTime,
        totalProcessingTime: processingTime,
        sampleCount: 1,
        cpuUsage,
        memoryUsage: 0,
        latency: this.latencyCompensation.get(instanceId) || 0,
      };
    } else {
      // Update metrics
      metrics.sampleCount++;
      metrics.totalProcessingTime += processingTime;
      metrics.averageProcessingTime =
        metrics.totalProcessingTime / metrics.sampleCount;
      metrics.maxProcessingTime = Math.max(
        metrics.maxProcessingTime,
        processingTime,
      );
      metrics.cpuUsage = (metrics.cpuUsage + cpuUsage) / 2; // Running average
    }

    this.performanceMetrics.set(instanceId, metrics);

    // Check performance thresholds
    if (this.performanceOptimizer) {
      this.checkPerformanceThresholds(instanceId, metrics);
    }
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): {
    totalPlugins: number;
    totalCpuUsage: number;
    averageLatency: number;
    pluginMetrics: WamPerformanceMetrics[];
  } {
    const metrics = Array.from(this.performanceMetrics.values());

    const totalCpuUsage = metrics.reduce((sum, m) => sum + m.cpuUsage, 0);
    const totalLatency = metrics.reduce((sum, m) => sum + m.latency, 0);

    return {
      totalPlugins: this.pluginInstances.size,
      totalCpuUsage,
      averageLatency: metrics.length > 0 ? totalLatency / metrics.length : 0,
      pluginMetrics: metrics,
    };
  }

  /**
   * Get registered plugins
   */
  getRegisteredPlugins(): WamPluginRegistration[] {
    return Array.from(this.registeredPlugins.values());
  }

  /**
   * Search for plugins by category
   */
  searchPlugins(
    category?: PluginCategory,
    tags?: string[],
  ): WamPluginRegistration[] {
    return Array.from(this.registeredPlugins.values()).filter((reg) => {
      const descriptor = reg.descriptor;

      // Check category
      if (category) {
        const isInstrument = category === PluginCategory.INSTRUMENT;
        if (descriptor.isInstrument !== isInstrument) return false;
      }

      // Check tags
      if (tags && tags.length > 0) {
        const hasTag = tags.some((tag) => descriptor.keywords.includes(tag));
        if (!hasTag) return false;
      }

      return true;
    });
  }

  /**
   * Get host capabilities
   */
  getHostCapabilities(): WamHostCapabilities {
    return { ...this.hostCapabilities };
  }

  /**
   * Connect two WAM plugins
   */
  connectPlugins(
    fromInstanceId: string,
    toInstanceId: string,
    fromOutput = 0,
    toInput = 0,
  ): void {
    if (!this.wamGroup) {
      throw new PlaybackError(
        'WAM group not initialized',
        'WAM_GROUP_NOT_READY',
        ErrorSeverity.MEDIUM,
      );
    }

    const fromInstance = this.pluginInstances.get(fromInstanceId);
    const toInstance = this.pluginInstances.get(toInstanceId);

    if (!fromInstance || !toInstance) {
      throw new PlaybackError(
        'Plugin instance not found',
        'WAM_INSTANCE_NOT_FOUND',
        ErrorSeverity.MEDIUM,
      );
    }

    const fromWam = fromInstance.adapter.getWamInfo().instance;
    const toWam = toInstance.adapter.getWamInfo().instance;

    if (!fromWam || !toWam) {
      throw new PlaybackError(
        'WAM instance not initialized',
        'WAM_NOT_INITIALIZED',
        ErrorSeverity.MEDIUM,
      );
    }

    this.wamGroup.connectWams(
      fromWam.instanceId,
      toWam.instanceId,
      fromOutput,
      toInput,
    );
  }

  /**
   * Disconnect two WAM plugins
   */
  disconnectPlugins(
    fromInstanceId: string,
    toInstanceId: string,
    fromOutput = 0,
    toInput = 0,
  ): void {
    if (!this.wamGroup) return;

    const fromInstance = this.pluginInstances.get(fromInstanceId);
    const toInstance = this.pluginInstances.get(toInstanceId);

    if (!fromInstance || !toInstance) return;

    const fromWam = fromInstance.adapter.getWamInfo().instance;
    const toWam = toInstance.adapter.getWamInfo().instance;

    if (!fromWam || !toWam) return;

    this.wamGroup.disconnectWams(
      fromWam.instanceId,
      toWam.instanceId,
      fromOutput,
      toInput,
    );
  }

  /**
   * Dispose host manager
   */
  async dispose(): Promise<void> {
    // Dispose all plugin instances
    const instances = Array.from(this.pluginInstances.keys());
    for (const instanceId of instances) {
      await this.removePluginInstance(instanceId);
    }

    // Clear registrations
    this.registeredPlugins.clear();

    // Delete WAM group
    if (this.wamEnv && this.wamGroup) {
      this.wamEnv.deleteGroup(this.config.groupId);
    }

    // Clear references
    this.wamEnv = null;
    this.wamGroup = null;

    this.isInitialized = false;

    logger.info('🗑️ WAM Host Manager disposed');
  }

  // Private helper methods

  private async preloadPlugins(): Promise<void> {
    const preloadPromises = this.config.preloadPlugins.map(
      async (pluginUrl) => {
        try {
          const moduleId = this.extractModuleId(pluginUrl);
          await this.registerPlugin(moduleId, pluginUrl);
        } catch (error) {
          logger.warn(`Failed to preload WAM plugin ${pluginUrl}:`, error);
        }
      },
    );

    await Promise.allSettled(preloadPromises);
  }

  private extractModuleId(url: string): string {
    // Extract module ID from URL path
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1] || parts[parts.length - 2];
    return lastPart.replace(/[^a-zA-Z0-9-_]/g, '');
  }

  private updateDeviceCapabilities(): void {
    if (!this.deviceCapabilityManager) return;

    const capabilities = this.deviceCapabilityManager.getCapabilities();

    // Update host capabilities based on device
    this.hostCapabilities.maxPluginsPerTrack =
      capabilities.performance.recommendedMaxTracks;
    this.hostCapabilities.maxChannelCount = capabilities.audio.maxChannelCount;
    this.hostCapabilities.supportsMultiChannel =
      capabilities.audio.maxChannelCount > 2;

    // Update config
    this.config.maxPluginsPerTrack = Math.min(
      this.config.maxPluginsPerTrack,
      capabilities.performance.recommendedMaxTracks,
    );
  }

  private checkPerformanceThresholds(
    instanceId: string,
    metrics: WamPerformanceMetrics,
  ): void {
    // Check CPU usage threshold
    if (metrics.cpuUsage > 0.8) {
      this.eventBus?.emit('wam:performance:warning', {
        instanceId,
        type: 'cpu',
        value: metrics.cpuUsage,
        threshold: 0.8,
      });
    }

    // Check processing time threshold (must be under 2.67ms for 128 samples @ 48kHz)
    const maxProcessingTime = 2.67; // ms
    if (metrics.averageProcessingTime > maxProcessingTime) {
      this.eventBus?.emit('wam:performance:warning', {
        instanceId,
        type: 'processing-time',
        value: metrics.averageProcessingTime,
        threshold: maxProcessingTime,
      });
    }
  }
}
