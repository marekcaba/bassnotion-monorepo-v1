/**
 * PluginManager - Core Plugin Management System
 *
 * Provides enterprise-grade plugin registration, lifecycle management,
 * and processing coordination for the audio engine plugin architecture.
 *
 * Part of Story 2.1: Task 1, Subtask 1.4
 */

import * as Tone from 'tone';
import {
  AudioPlugin,
  PluginManagerConfig,
  PluginManagerEvents,
  PluginRegistryEntry,
  PluginState,
  PluginCategory,
  PluginAudioContext,
  PluginProcessingResult,
  ProcessingResultStatus,
} from '../types/plugin';
import { PerformanceMonitor } from './PerformanceMonitor';
import {
  createAudioContextError,
  AudioContextErrorCode,
} from './errors/AudioContextError';
import { createResourceError, ResourceErrorCode } from './errors/ResourceError';
import {
  createPerformanceError,
  PerformanceErrorCode,
} from './errors/PerformanceError';

/**
 * Default plugin manager configuration
 */
const DEFAULT_CONFIG: PluginManagerConfig = {
  maxConcurrentPlugins: 16,
  maxTotalCpuUsage: 0.8, // 80% max CPU usage
  maxTotalMemoryUsage: 256, // 256MB max memory
  processingBufferSize: 512,
  enableParallelProcessing: true,
  errorRecoveryAttempts: 3,
  failureTimeout: 5000, // 5 seconds
  enableN8nIntegration: true,
  enableAssetLoading: true,
  enableMobileOptimizations: true,
};

export class PluginManager {
  private static instance: PluginManager;

  private config: PluginManagerConfig;
  private registry: Map<string, PluginRegistryEntry> = new Map();
  private processingOrder: string[] = [];
  private isInitialized = false;

  // Audio context and performance monitoring
  private audioContext: AudioContext | null = null;
  private performanceMonitor: PerformanceMonitor;

  // Processing state
  private isProcessing = false;
  private processingStats = {
    totalProcessingTime: 0,
    totalCpuUsage: 0,
    totalMemoryUsage: 0,
    processedSamples: 0,
  };

  // Performance monitoring interval - CRITICAL FIX for memory leaks
  private performanceMonitoringInterval?: NodeJS.Timeout;

  // Event handling
  private eventHandlers: Map<
    keyof PluginManagerEvents,
    Set<(...args: any[]) => void>
  > = new Map();

  // Epic 2 integration state
  private n8nPayloadQueue: Array<{
    pluginId: string;
    assetId: string;
    asset: AudioBuffer | ArrayBuffer;
  }> = [];
  private assetLoadingQueue: Array<{
    pluginId: string;
    assetId: string;
    asset: AudioBuffer | ArrayBuffer;
  }> = [];

  private constructor(config: Partial<PluginManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.initializeEventHandlers();
  }

  public static getInstance(
    config?: Partial<PluginManagerConfig>,
  ): PluginManager {
    // TODO: Review non-null assertion - consider null safety
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager(config);
    }
    return PluginManager.instance;
  }

  /**
   * Initialize the plugin manager
   */
  public async initialize(audioContext: AudioContext): Promise<void> {
    try {
      this.audioContext = audioContext;

      // Validate audio context capabilities
      // TODO: Review non-null assertion - consider null safety
      if (!audioContext || audioContext.state === 'closed') {
        throw createAudioContextError(
          AudioContextErrorCode.INVALID_STATE,
          'AudioContext is invalid or closed',
        );
      }

      // Initialize performance monitoring for plugins
      this.setupPerformanceMonitoring();

      // Setup processing pipeline
      this.setupProcessingPipeline();

      this.isInitialized = true;
      console.log(
        'PluginManager initialized with',
        this.registry.size,
        'registered plugins',
      );
    } catch (error) {
      console.error('Failed to initialize PluginManager:', error);
      throw error;
    }
  }

  /**
   * Register a new plugin
   */
  public async registerPlugin(plugin: AudioPlugin): Promise<void> {
    try {
      this.validatePluginForRegistration(plugin);

      // Check if plugin already exists
      if (this.registry.has(plugin.metadata.id)) {
        throw new Error(`Plugin ${plugin.metadata.id} is already registered`);
      }

      // **ARCHITECTURE UPGRADE**: Resource validation during registration
      await this.validateResourceConstraints(plugin);

      // Create registry entry with manager-controlled state
      const registryEntry: PluginRegistryEntry = {
        plugin,
        registeredAt: Date.now(),
        lastUsed: 0,
        usageCount: 0,
        managerState: PluginState.LOADING, // Manager controls state
        averageProcessingTime: 0,
        averageCpuUsage: 0,
        totalErrors: 0,
        dependents: new Set(),
        dependencies: new Set(plugin.metadata.dependencies),
      };

      // Load the plugin
      await plugin.load();
      registryEntry.managerState = PluginState.LOADED;

      // Initialize if audio context is available
      if (this.audioContext) {
        const context = this.createPluginAudioContext();
        registryEntry.managerState = PluginState.INITIALIZING;
        await plugin.initialize(context);
        registryEntry.managerState = PluginState.INACTIVE;
      }

      // Register plugin
      this.registry.set(plugin.metadata.id, registryEntry);

      // Update processing order
      this.updateProcessingOrder();

      // Setup plugin event handlers
      this.setupPluginEventHandlers(plugin);

      // Auto-activate if configured
      if (plugin.config.autoStart && plugin.config.enabled) {
        await this.activatePlugin(plugin.metadata.id);
      }

      this.emit('pluginRegistered', plugin);
      console.log(
        `Plugin registered: ${plugin.metadata.name} v${plugin.metadata.version}`,
      );
    } catch (error) {
      console.error(`Failed to register plugin ${plugin.metadata.id}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a plugin
   */
  public async unregisterPlugin(pluginId: string): Promise<void> {
    const entry = this.registry.get(pluginId);
    // TODO: Review non-null assertion - consider null safety
    if (!entry) {
      console.warn(`Plugin ${pluginId} not found in registry`);
      return;
    }

    try {
      // Deactivate plugin if active
      if (entry.managerState === PluginState.ACTIVE) {
        await this.deactivatePlugin(pluginId);
      }

      // Check for dependents
      if (entry.dependents.size > 0) {
        const dependentList = Array.from(entry.dependents).join(', ');
        console.warn(
          `Plugin ${pluginId} has dependents: ${dependentList}. Unregistering anyway.`,
        );
      }

      // Dispose plugin
      await entry.plugin.dispose();

      // Remove from registry
      this.registry.delete(pluginId);

      // Update processing order
      this.updateProcessingOrder();

      this.emit('pluginUnregistered', pluginId);
      console.log(`Plugin unregistered: ${pluginId}`);
    } catch (error) {
      console.error(`Failed to unregister plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Activate a plugin
   */
  public async activatePlugin(pluginId: string): Promise<void> {
    const entry = this.registry.get(pluginId);
    // TODO: Review non-null assertion - consider null safety
    if (!entry) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    try {
      // Check if plugin is already active using manager state
      if (entry.managerState === PluginState.ACTIVE) {
        console.warn(`Plugin ${pluginId} is already active`);
        return;
      }

      // Validate resource constraints before activation
      await this.validateResourceConstraints(entry.plugin);

      // Activate dependencies first
      for (const depId of Array.from(entry.dependencies)) {
        const depEntry = this.registry.get(depId);
        if (depEntry && depEntry.managerState !== PluginState.ACTIVE) {
          await this.activatePlugin(depId);
        }
      }

      // Activate the plugin
      await entry.plugin.activate();

      // **ARCHITECTURE UPGRADE**: Update manager-controlled state
      entry.managerState = PluginState.ACTIVE;

      // Update processing order to include newly activated plugin
      this.updateProcessingOrder();

      this.emit('pluginStateChanged', pluginId, PluginState.ACTIVE);
      console.log(`Plugin activated: ${pluginId}`);
    } catch (error) {
      this.handlePluginError(pluginId, error as Error);
      throw error;
    }
  }

  /**
   * Deactivate a plugin
   */
  public async deactivatePlugin(pluginId: string): Promise<void> {
    const entry = this.registry.get(pluginId);
    // TODO: Review non-null assertion - consider null safety
    if (!entry) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    try {
      // Check if plugin is already inactive using manager state
      if (entry.managerState !== PluginState.ACTIVE) {
        console.warn(`Plugin ${pluginId} is not active`);
        return;
      }

      // Deactivate dependents first
      for (const dependentId of Array.from(entry.dependents)) {
        const dependentEntry = this.registry.get(dependentId);
        if (
          dependentEntry &&
          dependentEntry.managerState === PluginState.ACTIVE
        ) {
          await this.deactivatePlugin(dependentId);
        }
      }

      // Deactivate the plugin
      await entry.plugin.deactivate();

      // **ARCHITECTURE UPGRADE**: Update manager-controlled state
      entry.managerState = PluginState.INACTIVE;

      // Update processing order to exclude deactivated plugin
      this.updateProcessingOrder();

      this.emit('pluginStateChanged', pluginId, PluginState.INACTIVE);
      console.log(`Plugin deactivated: ${pluginId}`);
    } catch (error) {
      this.handlePluginError(pluginId, error as Error);
      throw error;
    }
  }

  /**
   * Process audio through all active plugins
   */
  public async processAudio(
    inputBuffer: AudioBuffer,
    outputBuffer: AudioBuffer,
  ): Promise<void> {
    // TODO: Review non-null assertion - consider null safety
    if (!this.isInitialized || !this.audioContext) {
      throw createAudioContextError(
        AudioContextErrorCode.INVALID_STATE,
        'PluginManager not initialized',
      );
    }

    if (this.isProcessing) {
      console.warn('Plugin processing already in progress, skipping frame');
      return;
    }

    this.isProcessing = true;
    const startTime = performance.now();

    try {
      const context = this.createPluginAudioContext();
      let currentInput = inputBuffer;
      let currentOutput: AudioBuffer;

      // Process through plugins in priority order
      for (const pluginId of this.processingOrder) {
        const entry = this.registry.get(pluginId);

        if (!entry || entry.managerState !== PluginState.ACTIVE) {
          continue;
        }

        // Create output buffer for this plugin
        currentOutput = this.audioContext.createBuffer(
          currentInput.numberOfChannels,
          currentInput.length,
          currentInput.sampleRate,
        );

        // Process audio through plugin
        const result = await this.processPluginAudio(
          entry,
          currentInput,
          currentOutput,
          context,
        );

        // Update statistics
        this.updatePluginStatistics(entry, result);

        // Use output as input for next plugin
        currentInput = currentOutput;
      }

      // Copy final result to output buffer
      this.copyAudioBuffer(currentInput, outputBuffer);

      // Update processing statistics
      const processingTime = performance.now() - startTime;
      this.updateProcessingStatistics(processingTime);
    } catch (error) {
      console.error('Error processing audio through plugins:', error);
      // Copy input to output as fallback
      this.copyAudioBuffer(inputBuffer, outputBuffer);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get plugin by ID
   */
  public getPlugin(pluginId: string): AudioPlugin | null {
    const entry = this.registry.get(pluginId);
    return entry?.plugin || null;
  }

  /**
   * Get all registered plugins
   */
  public getAllPlugins(): AudioPlugin[] {
    return Array.from(this.registry.values()).map((entry) => entry.plugin);
  }

  /**
   * Get plugins by category
   */
  public getPluginsByCategory(category: PluginCategory): AudioPlugin[] {
    return this.getAllPlugins().filter(
      (plugin) => plugin.metadata.category === category,
    );
  }

  /**
   * Get active plugins - **ARCHITECTURE UPGRADE**: Use manager state
   */
  public getActivePlugins(): AudioPlugin[] {
    return Array.from(this.registry.values())
      .filter((entry) => entry.managerState === PluginState.ACTIVE)
      .map((entry) => entry.plugin);
  }

  /**
   * Event system
   */
  public on<K extends keyof PluginManagerEvents>(
    event: K,
    handler: PluginManagerEvents[K],
  ): () => void {
    // TODO: Review non-null assertion - consider null safety
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.add(handler);

      return () => handlers.delete(handler);
    }

    return () => {
      // No-op function when handlers don't exist
    };
  }

  /**
   * Epic 2 Integration: Process n8n payload for specific plugin
   */
  public async processN8nPayload(
    pluginId: string,
    payload: unknown,
  ): Promise<void> {
    const entry = this.registry.get(pluginId);
    // TODO: Review non-null assertion - consider null safety
    if (!entry) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // TODO: Review non-null assertion - consider null safety
    if (!entry.plugin.processN8nPayload) {
      console.warn(
        `Plugin ${pluginId} does not support n8n payload processing`,
      );
      return;
    }

    try {
      await entry.plugin.processN8nPayload(payload);
      console.log(`n8n payload processed by plugin: ${pluginId}`);
    } catch (error) {
      this.handlePluginError(pluginId, error as Error);
      throw error;
    }
  }

  /**
   * Epic 2 Integration: Load asset for specific plugin
   */
  public async loadAssetForPlugin(
    pluginId: string,
    assetId: string,
    asset: AudioBuffer | ArrayBuffer,
  ): Promise<void> {
    const entry = this.registry.get(pluginId);
    // TODO: Review non-null assertion - consider null safety
    if (!entry) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // TODO: Review non-null assertion - consider null safety
    if (!entry.plugin.loadAsset) {
      console.warn(`Plugin ${pluginId} does not support asset loading`);
      return;
    }

    try {
      await entry.plugin.loadAsset(assetId, asset);
      console.log(`Asset ${assetId} loaded for plugin: ${pluginId}`);
    } catch (error) {
      this.handlePluginError(pluginId, error as Error);
      throw error;
    }
  }

  /**
   * Dispose plugin manager
   */
  public async dispose(): Promise<void> {
    // Deactivate all plugins
    for (const [pluginId] of Array.from(this.registry.entries())) {
      try {
        await this.deactivatePlugin(pluginId);
      } catch (error) {
        console.error(`Error deactivating plugin ${pluginId}:`, error);
      }
    }

    // Dispose all plugins
    for (const [pluginId] of Array.from(this.registry.entries())) {
      try {
        await this.unregisterPlugin(pluginId);
      } catch (error) {
        console.error(`Error unregistering plugin ${pluginId}:`, error);
      }
    }

    // Clear performance monitoring interval to prevent memory leaks
    if (this.performanceMonitoringInterval) {
      clearInterval(this.performanceMonitoringInterval);
      this.performanceMonitoringInterval = undefined;
    }

    this.registry.clear();
    this.processingOrder = [];
    this.isInitialized = false;

    console.log('PluginManager disposed');

    // Reset singleton instance to ensure clean state for next initialization
    PluginManager.instance = null as any;
  }

  // Private implementation methods...

  private validatePluginForRegistration(plugin: AudioPlugin): void {
    // TODO: Review non-null assertion - consider null safety
    if (!plugin.metadata?.id) {
      throw new Error('Plugin must have a valid metadata.id');
    }

    // TODO: Review non-null assertion - consider null safety
    if (!plugin.metadata?.name) {
      throw new Error('Plugin must have a valid metadata.name');
    }

    if (plugin.config?.enabled === undefined) {
      throw new Error('Plugin must have a valid config.enabled property');
    }
  }

  private async validateResourceConstraints(
    plugin: AudioPlugin,
  ): Promise<void> {
    // **ARCHITECTURE UPGRADE**: Comprehensive resource validation
    const currentCpuUsage = this.processingStats.totalCpuUsage;
    const currentMemoryUsage = this.processingStats.totalMemoryUsage;

    // Calculate estimated resource usage if this plugin were added/activated
    const estimatedCpuUsage = currentCpuUsage + plugin.capabilities.cpuUsage;
    const estimatedMemoryUsage =
      currentMemoryUsage + plugin.capabilities.memoryUsage;

    // **CRITICAL FIX**: Enforce CPU usage constraints
    if (estimatedCpuUsage > this.config.maxTotalCpuUsage) {
      throw createPerformanceError(
        PerformanceErrorCode.CPU_USAGE_HIGH,
        `Plugin would exceed CPU usage limit: ${estimatedCpuUsage.toFixed(3)} > ${this.config.maxTotalCpuUsage}`,
      );
    }

    // **CRITICAL FIX**: Enforce memory usage constraints
    if (estimatedMemoryUsage > this.config.maxTotalMemoryUsage) {
      throw createResourceError(
        ResourceErrorCode.MEMORY_LIMIT_EXCEEDED,
        `Plugin would exceed memory usage limit: ${estimatedMemoryUsage}MB > ${this.config.maxTotalMemoryUsage}MB`,
      );
    }

    // **ARCHITECTURE UPGRADE**: Validate plugin-specific constraints
    if (
      plugin.config.maxCpuUsage &&
      plugin.capabilities.cpuUsage > plugin.config.maxCpuUsage
    ) {
      throw createPerformanceError(
        PerformanceErrorCode.CPU_USAGE_HIGH,
        `Plugin CPU usage ${plugin.capabilities.cpuUsage} exceeds plugin limit ${plugin.config.maxCpuUsage}`,
      );
    }

    if (
      plugin.config.maxMemoryUsage &&
      plugin.capabilities.memoryUsage > plugin.config.maxMemoryUsage
    ) {
      throw createResourceError(
        ResourceErrorCode.MEMORY_LIMIT_EXCEEDED,
        `Plugin memory usage ${plugin.capabilities.memoryUsage}MB exceeds plugin limit ${plugin.config.maxMemoryUsage}MB`,
      );
    }

    // **ARCHITECTURE UPGRADE**: Check concurrent plugin limits
    const activePluginCount = Array.from(this.registry.values()).filter(
      (entry) => entry.managerState === PluginState.ACTIVE,
    ).length;

    if (activePluginCount >= this.config.maxConcurrentPlugins) {
      throw createResourceError(
        ResourceErrorCode.CONCURRENT_LIMIT_EXCEEDED,
        `Cannot activate plugin: would exceed maximum concurrent plugins limit of ${this.config.maxConcurrentPlugins}`,
      );
    }
  }

  private updateProcessingOrder(): void {
    // Sort plugins by priority and dependencies
    const plugins = Array.from(this.registry.values());

    // Simple priority-based sorting (could be enhanced with dependency resolution)
    this.processingOrder = plugins
      .filter((entry) => entry.plugin.config.enabled)
      .sort((a, b) => b.plugin.config.priority - a.plugin.config.priority)
      .map((entry) => entry.plugin.metadata.id);

    this.emit('processingOrderChanged', this.processingOrder);
  }

  private createPluginAudioContext(): PluginAudioContext {
    // TODO: Review non-null assertion - consider null safety
    if (!this.audioContext) {
      throw createAudioContextError(
        AudioContextErrorCode.INVALID_STATE,
        'AudioContext not available',
      );
    }

    return {
      audioContext: this.audioContext,
      sampleRate: this.audioContext.sampleRate,
      bufferSize: this.config.processingBufferSize,
      currentTime: this.audioContext.currentTime,
      toneContext: Tone.getContext(),
      transport: Tone.getTransport(),
      performanceMetrics: {
        processingTime: this.processingStats.totalProcessingTime,
        cpuUsage: this.processingStats.totalCpuUsage,
        memoryUsage: this.processingStats.totalMemoryUsage,
      },
    };
  }

  private async processPluginAudio(
    entry: PluginRegistryEntry,
    inputBuffer: AudioBuffer,
    outputBuffer: AudioBuffer,
    context: PluginAudioContext,
  ): Promise<PluginProcessingResult> {
    const startTime = performance.now();

    try {
      const result = await entry.plugin.process(
        inputBuffer,
        outputBuffer,
        context,
      );
      entry.lastUsed = Date.now();
      entry.usageCount++;
      return result;
    } catch (error) {
      entry.totalErrors++;
      this.handlePluginError(entry.plugin.metadata.id, error as Error);

      // Return failed result
      return {
        success: false,
        status: ProcessingResultStatus.ERROR,
        processingTime: performance.now() - startTime,
        bypassMode: true,
        processedSamples: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        memoryDelta: 0,
        error: {
          code: 'PLUGIN_PROCESSING_ERROR',
          message: (error as Error).message,
          recoverable: true,
        },
      };
    }
  }

  private updatePluginStatistics(
    entry: PluginRegistryEntry,
    result: PluginProcessingResult,
  ): void {
    // Update running averages
    const alpha = 0.1; // Smoothing factor
    entry.averageProcessingTime =
      (1 - alpha) * entry.averageProcessingTime + alpha * result.processingTime;
    entry.averageCpuUsage =
      (1 - alpha) * entry.averageCpuUsage + alpha * result.cpuUsage;
  }

  private updateProcessingStatistics(processingTime: number): void {
    this.processingStats.totalProcessingTime = processingTime;
    this.processingStats.processedSamples++;

    // Update total resource usage
    this.processingStats.totalCpuUsage = Array.from(this.registry.values())
      .filter((entry) => entry.managerState === PluginState.ACTIVE)
      .reduce((total, entry) => total + entry.averageCpuUsage, 0);

    this.processingStats.totalMemoryUsage = Array.from(this.registry.values())
      .filter((entry) => entry.managerState === PluginState.ACTIVE)
      .reduce(
        (total, entry) => total + entry.plugin.capabilities.memoryUsage,
        0,
      );
  }

  private copyAudioBuffer(source: AudioBuffer, destination: AudioBuffer): void {
    const channels = Math.min(
      source.numberOfChannels,
      destination.numberOfChannels,
    );
    const length = Math.min(source.length, destination.length);

    for (let channel = 0; channel < channels; channel++) {
      const sourceData = source.getChannelData(channel);
      const destData = destination.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        const sourceValue = sourceData[i];
        if (sourceValue !== undefined) {
          destData[i] = sourceValue;
        }
      }
    }
  }

  private setupPerformanceMonitoring(): void {
    // Monitor plugin performance - simplified without recordMetric
    this.performanceMonitoringInterval = setInterval(() => {
      // Only log performance metrics in development environment
      // Skip logging during tests to prevent memory buildup and console spam
      if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
        console.debug('Plugin Performance:', {
          totalCpuUsage: this.processingStats.totalCpuUsage,
          totalMemoryUsage: this.processingStats.totalMemoryUsage,
          totalProcessingTime: this.processingStats.totalProcessingTime,
        });
      }
    }, 10000); // Log every 10 seconds
  }

  private setupProcessingPipeline(): void {
    // Setup audio processing pipeline
    // This would integrate with the main audio engine processing loop
    console.log('Plugin processing pipeline initialized');
  }

  private setupPluginEventHandlers(plugin: AudioPlugin): void {
    // Setup event handlers for plugin lifecycle events
    plugin.on('error', (error, _context) => {
      this.handlePluginError(plugin.metadata.id, error);
    });
  }

  private handlePluginError(pluginId: string, error: Error): void {
    console.error(`Plugin error in ${pluginId}:`, error);
    this.emit('pluginError', pluginId, error);

    const entry = this.registry.get(pluginId);
    if (entry) {
      entry.totalErrors++;
    }
  }

  private initializeEventHandlers(): void {
    const events: Array<keyof PluginManagerEvents> = [
      'pluginRegistered',
      'pluginUnregistered',
      'pluginStateChanged',
      'pluginError',
      'processingOrderChanged',
    ];

    events.forEach((event) => {
      this.eventHandlers.set(event, new Set());
    });
  }

  private emit<K extends keyof PluginManagerEvents>(
    event: K,
    ...args: Parameters<PluginManagerEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          (handler as any)(...args);
        } catch (error) {
          console.error(
            `Error in plugin manager event handler for ${event}:`,
            error,
          );
        }
      });
    }
  }
}
