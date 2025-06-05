/**
 * ResourceManager - Comprehensive Resource Lifecycle Management
 *
 * Provides enterprise-grade resource management with automatic cleanup,
 * memory leak detection, garbage collection optimization, and intelligent
 * resource allocation strategies.
 *
 * Part of Story 2.1: Core Audio Engine Foundation - Task 8
 */

import * as Tone from 'tone';
import {
  DeviceCapabilities,
  BatteryStatus,
  ThermalStatus,
} from '../types/audio.js';

// Extended performance interface to handle memory API
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

export type ResourceType =
  | 'audio_buffer'
  | 'audio_context'
  | 'tone_instrument'
  | 'tone_effect'
  | 'worker_thread'
  | 'audio_worklet'
  | 'shared_buffer'
  | 'canvas_context'
  | 'media_stream'
  | 'file_handle'
  | 'network_connection'
  | 'event_listener'
  | 'timer_handle'
  | 'animation_frame'
  | 'observer'
  | 'subscription'
  | 'webgl_context'
  | 'websocket'
  | 'service_worker';

export type ResourcePriority =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'disposable';
export type ResourceState =
  | 'initializing'
  | 'active'
  | 'idle'
  | 'disposed'
  | 'leaked';
export type CleanupStrategy =
  | 'immediate'
  | 'deferred'
  | 'batch'
  | 'graceful'
  | 'forced';

export interface ResourceMetadata {
  id: string;
  type: ResourceType;
  priority: ResourcePriority;
  state: ResourceState;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  memoryUsage: number; // bytes
  dependencies: Set<string>; // Resource IDs this depends on
  dependents: Set<string>; // Resource IDs that depend on this
  tags: Set<string>; // Semantic tags for resource categorization
  cleanupStrategy: CleanupStrategy;
  autoCleanupTimeout?: number; // ms after last access
  maxIdleTime?: number; // ms of allowed idle time
  onDispose?: () => Promise<void> | void;
}

export interface ManagedResource<T = any> {
  id: string;
  resource: T;
  metadata: ResourceMetadata;
  refs: number; // Reference count
  weakRefs: Set<WeakRef<object>>; // Weak references for leak detection
}

export interface ResourcePool<T = any> {
  type: ResourceType;
  maxSize: number;
  available: T[];
  inUse: Set<T>;
  factory: () => Promise<T> | T;
  validator: (resource: T) => boolean;
  cleanup: (resource: T) => Promise<void> | void;
  lastMaintenance: number;
}

export interface ResourceConstraints {
  maxTotalMemory: number; // bytes
  maxResourceCount: number;
  maxIdleResources: number;
  memoryPressureThreshold: number; // 0-1 percentage
  cpuPressureThreshold: number; // 0-1 percentage
  batteryAwareCleanup: boolean;
  thermalAwareCleanup: boolean;
  aggressiveCleanupOnLowMemory: boolean;
}

export interface CleanupReport {
  cleaned: number;
  memoryReclaimed: number;
  totalChecked: number;
}

export interface ResourceManagerConfig {
  constraints: ResourceConstraints;
  gcOptimization: {
    enabled: boolean;
    triggerThreshold: number;
    scheduledGCInterval: number;
    forcedGCThreshold: number;
    idleGCEnabled: boolean;
  };
  leakDetection: {
    enabled: boolean;
    weakRefThreshold: number;
    memoryGrowthThreshold: number;
    scanInterval: number;
    autoRemediation: boolean;
  };
  monitoring: {
    enabled: boolean;
    detailedMetrics: boolean;
    performanceTracking: boolean;
    alerting: boolean;
  };
  pools: Map<ResourceType, Partial<ResourcePool>>;
}

export interface ResourceUsageReport {
  totalResources: number;
  totalMemoryUsage: number;
  resourcesByType: Map<ResourceType, number>;
  memoryByType: Map<ResourceType, number>;
  idleResources: number;
  leakedResources: number;
  poolUtilization: Map<ResourceType, number>;
  memoryPressure: number; // 0-1
  recommendedActions: ResourceAction[];
  timestamp: number;
}

export interface ResourceAction {
  type: 'cleanup' | 'gc' | 'pool_resize' | 'leak_remediation';
  priority: ResourcePriority;
  description: string;
  estimatedMemorySaving: number;
  estimatedPerformanceImpact: number;
  autoExecute: boolean;
}

export interface MemoryLeakReport {
  suspectedLeaks: Array<{
    resourceId: string;
    type: ResourceType;
    age: number; // ms
    memoryGrowth: number; // bytes
    weakRefCount: number;
    stackTrace?: string;
  }>;
  memoryGrowthRate: number; // bytes/second
  totalSuspectedLeakage: number; // bytes
  confidence: number; // 0-1
  timestamp: number;
}

export interface ResourceManagerEvents {
  resourceCreated: (metadata: ResourceMetadata) => void;
  resourceDisposed: (resourceId: string, metadata: ResourceMetadata) => void;
  resourceLeakDetected: (
    resourceId: string,
    metadata: ResourceMetadata,
  ) => void;
  memoryPressureAlert: (pressure: number, report: ResourceUsageReport) => void;
  gcTriggered: (reason: string, forcedGc: boolean) => void;
  cleanupCompleted: (cleanedCount: number, memoryReclaimed: number) => void;
  poolResized: (type: ResourceType, oldSize: number, newSize: number) => void;
}

export class ResourceManager {
  private static instance: ResourceManager;
  private resources: Map<string, ManagedResource> = new Map();
  private pools: Map<ResourceType, ResourcePool> = new Map();
  private config: ResourceManagerConfig;
  private isRunning = false;
  private cleanupTimer?: number;
  private gcTimer?: number;
  private leakScanTimer?: number;
  private memoryBaseline = 0;
  private lastMemoryCheck = 0;
  private deviceCapabilities?: DeviceCapabilities;
  private batteryStatus?: BatteryStatus;
  private thermalStatus?: ThermalStatus;

  // Event system with proper typing
  private eventHandlers: Map<
    keyof ResourceManagerEvents,
    Set<ResourceManagerEvents[keyof ResourceManagerEvents]>
  > = new Map();

  // Performance tracking
  private metrics = {
    totalResourcesCreated: 0,
    totalResourcesDisposed: 0,
    totalMemoryReclaimed: 0,
    gcExecutions: 0,
    leaksDetected: 0,
    cleanupCycles: 0,
  };

  private constructor(config?: Partial<ResourceManagerConfig>) {
    this.config = this.mergeConfig(config);
    this.initializePools();
    this.setupMemoryBaseline();
  }

  public static getInstance(
    config?: Partial<ResourceManagerConfig>,
  ): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager(config);
    }
    return ResourceManager.instance;
  }

  /**
   * Initialize the Resource Manager
   */
  public async initialize(
    deviceCapabilities?: DeviceCapabilities,
    batteryStatus?: BatteryStatus,
    thermalStatus?: ThermalStatus,
  ): Promise<void> {
    this.deviceCapabilities = deviceCapabilities;
    this.batteryStatus = batteryStatus;
    this.thermalStatus = thermalStatus;

    // Adjust constraints based on device capabilities
    if (deviceCapabilities) {
      this.adjustConstraintsForDevice(deviceCapabilities);
    }

    this.isRunning = true;
    this.startBackgroundTasks();

    console.log(
      'ResourceManager initialized with constraints:',
      this.config.constraints,
    );
  }

  /**
   * Register a new resource with automatic lifecycle management
   */
  public register<T>(
    resource: T,
    type: ResourceType,
    options: Partial<ResourceMetadata> = {},
  ): string {
    const id = options.id || this.generateResourceId(type);
    const now = Date.now();

    const metadata: ResourceMetadata = {
      id,
      type,
      priority: options.priority || 'medium',
      state: 'initializing',
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
      memoryUsage: this.estimateMemoryUsage(resource, type),
      dependencies: options.dependencies || new Set(),
      dependents: options.dependents || new Set(),
      tags: options.tags || new Set(),
      cleanupStrategy: options.cleanupStrategy || 'deferred',
      autoCleanupTimeout: options.autoCleanupTimeout,
      maxIdleTime: options.maxIdleTime || this.getDefaultIdleTime(type),
      onDispose: options.onDispose,
    };

    const managedResource: ManagedResource<T> = {
      id,
      resource,
      metadata,
      refs: 1,
      weakRefs: new Set(),
    };

    // Register weak reference for leak detection (only for objects)
    if (
      this.config.leakDetection.enabled &&
      resource &&
      typeof resource === 'object'
    ) {
      managedResource.weakRefs.add(new WeakRef(resource as object));
    }

    this.resources.set(id, managedResource);
    metadata.state = 'active';

    this.metrics.totalResourcesCreated++;
    this.emit('resourceCreated', metadata);

    // Check memory pressure after registration
    this.checkMemoryPressure();

    console.log(
      `Resource registered: ${type}:${id} (${metadata.memoryUsage} bytes)`,
    );
    return id;
  }

  /**
   * Access a resource and update its access tracking
   */
  public access<T>(resourceId: string): T | null {
    const managed = this.resources.get(resourceId);
    if (!managed || managed.metadata.state === 'disposed') {
      return null;
    }

    managed.metadata.lastAccessed = Date.now();
    managed.metadata.accessCount++;

    if (managed.metadata.state === 'idle') {
      managed.metadata.state = 'active';
    }

    return managed.resource as T;
  }

  /**
   * Add a reference to a resource
   */
  public addRef(resourceId: string): boolean {
    const managed = this.resources.get(resourceId);
    if (!managed || managed.metadata.state === 'disposed') {
      return false;
    }

    managed.refs++;
    managed.metadata.lastAccessed = Date.now();
    return true;
  }

  /**
   * Remove a reference from a resource
   */
  public removeRef(resourceId: string): boolean {
    const managed = this.resources.get(resourceId);
    if (!managed) {
      return false;
    }

    managed.refs = Math.max(0, managed.refs - 1);

    if (managed.refs === 0) {
      // Schedule for cleanup if no more references
      this.scheduleCleanup(resourceId);
    }

    return true;
  }

  /**
   * Dispose of a specific resource
   */
  public async dispose(resourceId: string, force = false): Promise<boolean> {
    const managed = this.resources.get(resourceId);
    if (!managed || managed.metadata.state === 'disposed') {
      return false;
    }

    if (!force && managed.refs > 0) {
      console.warn(
        `Cannot dispose resource ${resourceId}: still has ${managed.refs} references`,
      );
      return false;
    }

    return await this.disposeResource(managed);
  }

  /**
   * Get a resource from a pool or create a new one
   */
  public async getFromPool<T>(type: ResourceType): Promise<T> {
    const pool = this.pools.get(type);
    if (!pool) {
      throw new Error(`No pool configured for resource type: ${type}`);
    }

    if (pool.available.length > 0) {
      const resource = pool.available.pop();
      if (resource) {
        pool.inUse.add(resource);
        return resource as T;
      }
    }

    if (pool.inUse.size >= pool.maxSize) {
      throw new Error(
        `Pool for ${type} is at maximum capacity (${pool.maxSize})`,
      );
    }

    const resource = await pool.factory();
    pool.inUse.add(resource);
    return resource as T;
  }

  /**
   * Return a resource to its pool
   */
  public async returnToPool<T>(type: ResourceType, resource: T): Promise<void> {
    const pool = this.pools.get(type);
    if (!pool) {
      console.warn(`No pool configured for resource type: ${type}`);
      return;
    }

    pool.inUse.delete(resource);

    if (pool.validator(resource)) {
      pool.available.push(resource);
    } else {
      await pool.cleanup(resource);
    }
  }

  /**
   * Trigger immediate cleanup of idle resources
   */
  public async cleanupResources(
    options: {
      olderThan?: number;
      types?: ResourceType[];
      priority?: ResourcePriority;
      force?: boolean;
    } = {},
  ): Promise<CleanupReport> {
    let cleaned = 0;
    let memoryReclaimed = 0;

    // Use Array.from for iteration compatibility
    for (const [_id, managed] of Array.from(this.resources.entries())) {
      const { metadata } = managed;
      const now = Date.now();

      // Check if resource should be cleaned up
      if (options.types && !options.types.includes(metadata.type)) continue;

      if (options.priority && metadata.priority !== options.priority) continue;

      if (options.olderThan && now - metadata.createdAt < options.olderThan)
        continue;

      // Additional cleanup criteria
      const shouldCleanup =
        options.force ||
        metadata.state === 'idle' ||
        now - metadata.lastAccessed > (metadata.maxIdleTime || 60000);

      if (shouldCleanup) {
        try {
          const disposalResult = await this.disposeResource(managed);
          if (disposalResult) {
            cleaned++;
            memoryReclaimed += metadata.memoryUsage;
          }
        } catch (error) {
          console.warn(`Failed to clean up resource ${_id}:`, error);
        }
      }
    }

    console.log(
      `Cleanup completed: ${cleaned} resources cleaned, ${memoryReclaimed} bytes reclaimed`,
    );

    return {
      cleaned,
      memoryReclaimed,
      totalChecked: this.resources.size,
    };
  }

  /**
   * Force garbage collection if supported
   */
  public async triggerGC(forced = false): Promise<void> {
    const reason = forced ? 'forced' : 'scheduled';

    // Clean up disposed resources first
    await this.cleanupResources();

    // Trigger GC if available (development/Node.js environments)
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
      this.metrics.gcExecutions++;
      console.log(`Garbage collection triggered (${reason})`);
    } else if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc();
      this.metrics.gcExecutions++;
      console.log(`Garbage collection triggered (${reason})`);
    }

    this.emit('gcTriggered', reason, forced);
  }

  /**
   * Generate comprehensive usage report
   */
  public generateUsageReport(): ResourceUsageReport {
    const now = Date.now();
    const resourcesByType = new Map<ResourceType, number>();
    const memoryByType = new Map<ResourceType, number>();
    let totalMemoryUsage = 0;
    let idleResources = 0;
    let leakedResources = 0;

    // Use Array.from for iteration compatibility
    for (const managed of Array.from(this.resources.values())) {
      const { metadata } = managed;

      resourcesByType.set(
        metadata.type,
        (resourcesByType.get(metadata.type) || 0) + 1,
      );
      memoryByType.set(
        metadata.type,
        (memoryByType.get(metadata.type) || 0) + metadata.memoryUsage,
      );
      totalMemoryUsage += metadata.memoryUsage;

      if (
        metadata.state === 'idle' ||
        now - metadata.lastAccessed > (metadata.maxIdleTime || 60000)
      ) {
        idleResources++;
      }

      if (metadata.state === 'leaked') {
        leakedResources++;
      }
    }

    const poolUtilization = new Map<ResourceType, number>();
    // Use Array.from for iteration compatibility
    for (const [resourceType, pool] of Array.from(this.pools.entries())) {
      const utilization = pool.inUse.size / pool.maxSize;
      poolUtilization.set(resourceType, utilization);
    }

    const memoryPressure =
      totalMemoryUsage / this.config.constraints.maxTotalMemory;
    const recommendedActions = this.generateRecommendations(
      memoryPressure,
      idleResources,
    );

    return {
      totalResources: this.resources.size,
      totalMemoryUsage,
      resourcesByType,
      memoryByType,
      idleResources,
      leakedResources,
      poolUtilization,
      memoryPressure,
      recommendedActions,
      timestamp: now,
    };
  }

  /**
   * Detect memory leaks
   */
  public async detectMemoryLeaks(): Promise<MemoryLeakReport> {
    if (!this.config.leakDetection.enabled) {
      return {
        suspectedLeaks: [],
        memoryGrowthRate: 0,
        totalSuspectedLeakage: 0,
        confidence: 0,
        timestamp: Date.now(),
      };
    }

    const now = Date.now();
    const suspectedLeaks: MemoryLeakReport['suspectedLeaks'] = [];
    let totalSuspectedLeakage = 0;

    // Use Array.from for iteration compatibility
    for (const managed of Array.from(this.resources.values())) {
      const { metadata } = managed;

      // Check for leaked weak references
      const aliveWeakRefs = Array.from(managed.weakRefs).filter((ref) => {
        const deref = ref.deref();
        return deref !== undefined;
      });
      managed.weakRefs = new Set(aliveWeakRefs);

      if (managed.weakRefs.size > this.config.leakDetection.weakRefThreshold) {
        metadata.state = 'leaked';
        suspectedLeaks.push({
          resourceId: metadata.id,
          type: metadata.type,
          age: now - metadata.createdAt,
          memoryGrowth: metadata.memoryUsage,
          weakRefCount: managed.weakRefs.size,
        });
        totalSuspectedLeakage += metadata.memoryUsage;
      }
    }

    // Calculate memory growth rate
    const currentMemory = this.getCurrentMemoryUsage();
    const timeDelta = now - this.lastMemoryCheck;
    const memoryDelta = currentMemory - this.memoryBaseline;
    const memoryGrowthRate =
      timeDelta > 0 ? (memoryDelta / timeDelta) * 1000 : 0; // bytes/second

    this.lastMemoryCheck = now;
    this.memoryBaseline = currentMemory;

    const confidence = Math.min(
      1,
      suspectedLeaks.length / 10 +
        (memoryGrowthRate > this.config.leakDetection.memoryGrowthThreshold
          ? 0.5
          : 0),
    );

    if (suspectedLeaks.length > 0) {
      this.metrics.leaksDetected += suspectedLeaks.length;
      console.warn(
        `Memory leaks detected: ${suspectedLeaks.length} suspected leaks`,
      );
    }

    return {
      suspectedLeaks,
      memoryGrowthRate,
      totalSuspectedLeakage,
      confidence,
      timestamp: now,
    };
  }

  /**
   * Update device status for adaptive resource management
   */
  public updateDeviceStatus(
    batteryStatus?: BatteryStatus,
    thermalStatus?: ThermalStatus,
  ): void {
    this.batteryStatus = batteryStatus;
    this.thermalStatus = thermalStatus;

    // Adjust cleanup aggressiveness based on device status
    if (batteryStatus?.level && batteryStatus.level < 0.2) {
      // Aggressive cleanup when battery is low
      this.cleanupResources({ force: true, priority: 'disposable' });
    }

    if (thermalStatus?.state === 'critical') {
      // Emergency resource cleanup during thermal throttling
      this.cleanupResources({
        force: true,
        types: ['worker_thread', 'audio_worklet'],
      });
    }
  }

  /**
   * Event subscription with proper typing
   */
  public on<K extends keyof ResourceManagerEvents>(
    event: K,
    handler: ResourceManagerEvents[K],
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Shutdown and cleanup all resources
   */
  public async shutdown(): Promise<void> {
    this.isRunning = false;

    // Clear all timers
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.gcTimer) clearInterval(this.gcTimer);
    if (this.leakScanTimer) clearInterval(this.leakScanTimer);

    // Dispose all resources
    const disposalPromises = Array.from(this.resources.values()).map(
      (managed) => this.disposeResource(managed),
    );
    await Promise.all(disposalPromises);

    // Clear pools
    // Use Array.from for iteration compatibility
    for (const [, pool] of Array.from(this.pools.entries())) {
      const availableArray = Array.from(pool.available);
      const inUseArray = Array.from(pool.inUse);
      const allResources = availableArray.concat(inUseArray);
      const cleanupPromises = allResources.map((resource) =>
        pool.cleanup(resource),
      );
      await Promise.all(cleanupPromises);
    }

    this.resources.clear();
    this.pools.clear();

    console.log('ResourceManager shutdown completed');
  }

  // Private implementation methods...

  private mergeConfig(
    config?: Partial<ResourceManagerConfig>,
  ): ResourceManagerConfig {
    const defaultConfig: ResourceManagerConfig = {
      constraints: {
        maxTotalMemory: 500 * 1024 * 1024, // 500MB
        maxResourceCount: 10000,
        maxIdleResources: 100,
        memoryPressureThreshold: 0.8,
        cpuPressureThreshold: 0.9,
        batteryAwareCleanup: true,
        thermalAwareCleanup: true,
        aggressiveCleanupOnLowMemory: true,
      },
      gcOptimization: {
        enabled: true,
        triggerThreshold: 0.7,
        scheduledGCInterval: 60000, // 1 minute
        forcedGCThreshold: 0.9,
        idleGCEnabled: true,
      },
      leakDetection: {
        enabled: true,
        weakRefThreshold: 5,
        memoryGrowthThreshold: 1024 * 1024, // 1MB/second
        scanInterval: 30000, // 30 seconds
        autoRemediation: true,
      },
      monitoring: {
        enabled: true,
        detailedMetrics: false,
        performanceTracking: true,
        alerting: true,
      },
      pools: new Map(),
    };

    return {
      ...defaultConfig,
      ...config,
      constraints: { ...defaultConfig.constraints, ...config?.constraints },
      gcOptimization: {
        ...defaultConfig.gcOptimization,
        ...config?.gcOptimization,
      },
      leakDetection: {
        ...defaultConfig.leakDetection,
        ...config?.leakDetection,
      },
      monitoring: { ...defaultConfig.monitoring, ...config?.monitoring },
      pools: config?.pools || defaultConfig.pools,
    };
  }

  private initializePools(): void {
    // Initialize default pools for common resource types
    const defaultPools: Array<[ResourceType, Partial<ResourcePool>]> = [
      [
        'audio_buffer',
        {
          maxSize: 100,
          factory: () => this.createAudioBuffer(),
          validator: (_resource: AudioBuffer) => true,
          cleanup: async (_resource: AudioBuffer) => {
            // AudioBuffers are automatically garbage collected
          },
        },
      ],
      [
        'canvas_context',
        {
          maxSize: 10,
          factory: () => this.createCanvasContext(),
          validator: (ctx: CanvasRenderingContext2D) => ctx.canvas.width > 0,
          cleanup: async (ctx: CanvasRenderingContext2D) => {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          },
        },
      ],
    ];

    for (const [poolType, poolConfig] of defaultPools) {
      const pool: ResourcePool = {
        type: poolType,
        maxSize: poolConfig.maxSize || 50,
        available: [],
        inUse: new Set(),
        factory:
          poolConfig.factory ||
          (() => {
            return {};
          }),
        validator: poolConfig.validator || (() => true),
        cleanup:
          poolConfig.cleanup ||
          (() => {
            /* Default cleanup does nothing */
          }),
        lastMaintenance: Date.now(),
      };
      this.pools.set(poolType, pool);
    }
  }

  private setupMemoryBaseline(): void {
    this.memoryBaseline = this.getCurrentMemoryUsage();
    this.lastMemoryCheck = Date.now();
  }

  private getCurrentMemoryUsage(): number {
    const extendedPerformance = performance as ExtendedPerformance;
    if (typeof performance !== 'undefined' && extendedPerformance.memory) {
      return extendedPerformance.memory.usedJSHeapSize;
    }
    // Fallback: estimate based on registered resources
    return Array.from(this.resources.values()).reduce(
      (total, managed) => total + managed.metadata.memoryUsage,
      0,
    );
  }

  private generateResourceId(type: ResourceType): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateMemoryUsage(resource: any, type: ResourceType): number {
    switch (type) {
      case 'audio_buffer':
        if (resource instanceof AudioBuffer) {
          return resource.length * resource.numberOfChannels * 4; // 32-bit float
        }
        break;
      case 'shared_buffer':
        if (resource instanceof SharedArrayBuffer) {
          return resource.byteLength;
        }
        break;
      case 'canvas_context':
        if (resource instanceof CanvasRenderingContext2D) {
          const canvas = resource.canvas;
          return canvas.width * canvas.height * 4; // RGBA
        }
        break;
    }
    return 1024; // Default estimate: 1KB
  }

  private getDefaultIdleTime(type: ResourceType): number {
    const defaults: Partial<Record<ResourceType, number>> = {
      audio_buffer: 300000, // 5 minutes
      canvas_context: 60000, // 1 minute
      worker_thread: 600000, // 10 minutes
      timer_handle: 30000, // 30 seconds
      event_listener: 3600000, // 1 hour
    };
    return defaults[type] || 120000; // 2 minutes default
  }

  private adjustConstraintsForDevice(capabilities: DeviceCapabilities): void {
    const memoryGB = capabilities.memoryGB;
    const deviceClass = capabilities.deviceClass;

    // Adjust max memory based on device capabilities
    switch (deviceClass) {
      case 'low-end':
        this.config.constraints.maxTotalMemory = Math.min(
          100 * 1024 * 1024,
          memoryGB * 0.1 * 1024 * 1024 * 1024,
        );
        break;
      case 'mid-range':
        this.config.constraints.maxTotalMemory = Math.min(
          250 * 1024 * 1024,
          memoryGB * 0.15 * 1024 * 1024 * 1024,
        );
        break;
      case 'high-end':
        this.config.constraints.maxTotalMemory = Math.min(
          500 * 1024 * 1024,
          memoryGB * 0.2 * 1024 * 1024 * 1024,
        );
        break;
      case 'premium':
        this.config.constraints.maxTotalMemory = Math.min(
          1024 * 1024 * 1024,
          memoryGB * 0.25 * 1024 * 1024 * 1024,
        );
        break;
    }

    console.log(
      `Adjusted memory constraints for ${deviceClass} device: ${this.config.constraints.maxTotalMemory / 1024 / 1024}MB`,
    );
  }

  private async disposeResource(managed: ManagedResource): Promise<boolean> {
    const { metadata, resource } = managed;

    try {
      metadata.state = 'disposed';

      // Execute custom dispose callback
      if (metadata.onDispose) {
        await metadata.onDispose();
      }

      // Dispose based on resource type
      await this.disposeByType(resource, metadata.type);

      // Update dependencies - use Array.from for Set iteration
      for (const dependentId of Array.from(metadata.dependents)) {
        const dependent = this.resources.get(dependentId);
        if (dependent) {
          dependent.metadata.dependencies.delete(metadata.id);
        }
      }

      this.resources.delete(metadata.id);
      this.metrics.totalResourcesDisposed++;
      this.metrics.totalMemoryReclaimed += metadata.memoryUsage;

      this.emit('resourceDisposed', metadata.id, metadata);

      console.log(`Resource disposed: ${metadata.type}:${metadata.id}`);
      return true;
    } catch (error) {
      console.error(`Failed to dispose resource ${metadata.id}:`, error);
      return false;
    }
  }

  private async disposeByType(
    resource: any,
    type: ResourceType,
  ): Promise<void> {
    switch (type) {
      case 'audio_context':
        if (resource instanceof AudioContext) {
          await resource.close();
        }
        break;
      case 'tone_instrument':
        if (resource && typeof resource.dispose === 'function') {
          resource.dispose();
        }
        break;
      case 'tone_effect':
        if (resource instanceof Tone.ToneAudioNode) {
          resource.dispose();
        }
        break;
      case 'worker_thread':
        if (resource instanceof Worker) {
          resource.terminate();
        }
        break;
      case 'media_stream':
        if (resource instanceof MediaStream) {
          resource.getTracks().forEach((track) => track.stop());
        }
        break;
      case 'timer_handle':
        if (typeof resource === 'number') {
          clearTimeout(resource);
        }
        break;
      case 'animation_frame':
        if (typeof resource === 'number') {
          cancelAnimationFrame(resource);
        }
        break;
      case 'observer':
        if (resource && typeof resource.disconnect === 'function') {
          resource.disconnect();
        }
        break;
      case 'subscription':
        if (resource && typeof resource.unsubscribe === 'function') {
          resource.unsubscribe();
        }
        break;
    }
  }

  private scheduleCleanup(resourceId: string): void {
    const managed = this.resources.get(resourceId);
    if (!managed) return;

    const delay = managed.metadata.cleanupStrategy === 'immediate' ? 0 : 5000; // 5 second delay for deferred cleanup

    setTimeout(async () => {
      if (managed.refs === 0 && managed.metadata.state !== 'disposed') {
        await this.disposeResource(managed);
      }
    }, delay);
  }

  private checkMemoryPressure(): void {
    const report = this.generateUsageReport();

    if (
      report.memoryPressure > this.config.constraints.memoryPressureThreshold
    ) {
      this.emit('memoryPressureAlert', report.memoryPressure, report);

      if (this.config.constraints.aggressiveCleanupOnLowMemory) {
        this.cleanupResources({ force: true, priority: 'disposable' });
      }
    }
  }

  private generateRecommendations(
    memoryPressure: number,
    idleResources: number,
  ): ResourceAction[] {
    const actions: ResourceAction[] = [];

    if (memoryPressure > 0.8) {
      actions.push({
        type: 'cleanup',
        priority: 'high',
        description: 'Clean up idle resources to reduce memory pressure',
        estimatedMemorySaving: idleResources * 1024, // Estimate
        estimatedPerformanceImpact: 0.1,
        autoExecute: true,
      });
    }

    if (memoryPressure > 0.9) {
      actions.push({
        type: 'gc',
        priority: 'critical',
        description: 'Force garbage collection to reclaim memory',
        estimatedMemorySaving:
          memoryPressure * 0.2 * this.config.constraints.maxTotalMemory,
        estimatedPerformanceImpact: 0.3,
        autoExecute: true,
      });
    }

    return actions;
  }

  private startBackgroundTasks(): void {
    // Cleanup timer
    this.cleanupTimer = window.setInterval(async () => {
      await this.cleanupResources();
    }, 30000); // Every 30 seconds

    // GC timer
    if (this.config.gcOptimization.enabled) {
      this.gcTimer = window.setInterval(async () => {
        const report = this.generateUsageReport();
        if (
          report.memoryPressure > this.config.gcOptimization.triggerThreshold
        ) {
          await this.triggerGC(false);
        }
      }, this.config.gcOptimization.scheduledGCInterval);
    }

    // Leak detection timer
    if (this.config.leakDetection.enabled) {
      this.leakScanTimer = window.setInterval(async () => {
        const leakReport = await this.detectMemoryLeaks();
        if (
          leakReport.suspectedLeaks.length > 0 &&
          this.config.leakDetection.autoRemediation
        ) {
          // Auto-remediate detected leaks
          for (const leak of leakReport.suspectedLeaks) {
            await this.dispose(leak.resourceId, true);
          }
        }
      }, this.config.leakDetection.scanInterval);
    }
  }

  private emit<K extends keyof ResourceManagerEvents>(
    event: K,
    ...args: Parameters<ResourceManagerEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          (handler as any)(...args);
        } catch (error) {
          console.error(
            `Error in ResourceManager event handler for ${event}:`,
            error,
          );
        }
      });
    }
  }

  private createAudioBuffer(): AudioBuffer {
    // Create a minimal audio buffer for pooling
    const audioContext = new AudioContext();
    return audioContext.createBuffer(2, 1024, 44100);
  }

  private createCanvasContext(): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to create 2D canvas context');
    }
    return context;
  }

  // Getter methods for monitoring
  public getMetrics() {
    return { ...this.metrics };
  }

  public getConfig(): ResourceManagerConfig {
    return { ...this.config };
  }

  public isInitialized(): boolean {
    return this.isRunning;
  }
}
