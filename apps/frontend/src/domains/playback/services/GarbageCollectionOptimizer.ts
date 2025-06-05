import { EventEmitter } from 'events';

/**
 * Garbage Collection Optimization System
 *
 * Implements intelligent garbage collection timing strategies to minimize
 * performance impact during audio playback while ensuring optimal memory management.
 *
 * Features:
 * - Smart GC timing based on audio state and user activity
 * - Memory pressure-based scheduling
 * - Performance impact measurement and adaptation
 * - Mobile and battery optimization
 * - CPU idle detection for optimal GC timing
 */

export enum GCStrategy {
  AGGRESSIVE = 'aggressive',
  BALANCED = 'balanced',
  CONSERVATIVE = 'conservative',
  MANUAL = 'manual',
}

export enum GCTrigger {
  IDLE_DETECTION = 'idle_detection',
  MEMORY_PRESSURE = 'memory_pressure',
  SCHEDULED = 'scheduled',
  MANUAL = 'manual',
  CRITICAL = 'critical',
}

export interface GCMetrics {
  totalCollections: number;
  totalTimeSpent: number;
  averageCollectionTime: number;
  memoryFreed: number;
  performanceImpact: number;
  interruptedOperations: number;
  lastCollectionTime: number;
  collectionsPerStrategy: Record<GCStrategy, number>;
}

export interface GCSchedule {
  idleThreshold: number;
  memoryPressureThreshold: number;
  maxCollectionInterval: number;
  minCollectionInterval: number;
  batteryAwareScaling: boolean;
  thermalAwareScaling: boolean;
}

export interface GCConfig {
  strategy: GCStrategy;
  schedule: GCSchedule;
  enableSmartTiming: boolean;
  enablePerformanceMonitoring: boolean;
  enableBatteryOptimization: boolean;
  maxConcurrentCollections: number;
  forceCollectionMemoryThreshold: number;
}

export interface IdleDetectionConfig {
  userInputTimeout: number;
  audioSilenceTimeout: number;
  cpuUsageThreshold: number;
  networkActivityThreshold: number;
  animationFrameThreshold: number;
}

export interface DeviceConstraints {
  batteryLevel?: number;
  thermalState?: 'normal' | 'fair' | 'serious' | 'critical';
  memoryPressure: 'none' | 'moderate' | 'severe' | 'critical';
  cpuUsage: number;
  isLowEndDevice: boolean;
}

// Extended Performance interface for memory API
interface ExtendedPerformance extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export class GarbageCollectionOptimizer extends EventEmitter {
  private static instance: GarbageCollectionOptimizer | null = null;
  private config: GCConfig;
  private metrics: GCMetrics;
  private isCollecting = false;
  private lastUserActivity = Date.now();
  private lastAudioActivity = Date.now();
  private scheduledCollectionHandle: number | null = null;
  private performanceObserver: PerformanceObserver | null = null;
  private memoryMonitorHandle: number | null = null;
  private idleDetectionHandle: number | null = null;
  private eventListeners: Array<{
    element: EventTarget;
    event: string;
    handler: EventListener;
  }> = [];

  private readonly defaultConfig: GCConfig = {
    strategy: GCStrategy.BALANCED,
    schedule: {
      idleThreshold: 5000, // 5 seconds of idle time
      memoryPressureThreshold: 0.8, // 80% memory usage
      maxCollectionInterval: 300000, // 5 minutes max
      minCollectionInterval: 10000, // 10 seconds min
      batteryAwareScaling: true,
      thermalAwareScaling: true,
    },
    enableSmartTiming: true,
    enablePerformanceMonitoring: true,
    enableBatteryOptimization: true,
    maxConcurrentCollections: 1,
    forceCollectionMemoryThreshold: 0.95, // Force GC at 95% memory
  };

  private readonly idleDetectionConfig: IdleDetectionConfig = {
    userInputTimeout: 3000,
    audioSilenceTimeout: 2000,
    cpuUsageThreshold: 30,
    networkActivityThreshold: 1000,
    animationFrameThreshold: 60,
  };

  private constructor(config?: Partial<GCConfig>) {
    super();
    this.config = { ...this.defaultConfig, ...config };
    this.metrics = this.initializeMetrics();
    this.setupMonitoring();
    this.setupIdleDetection();
  }

  public static getInstance(
    config?: Partial<GCConfig>,
  ): GarbageCollectionOptimizer {
    if (!GarbageCollectionOptimizer.instance) {
      GarbageCollectionOptimizer.instance = new GarbageCollectionOptimizer(
        config,
      );
    }
    return GarbageCollectionOptimizer.instance;
  }

  private initializeMetrics(): GCMetrics {
    return {
      totalCollections: 0,
      totalTimeSpent: 0,
      averageCollectionTime: 0,
      memoryFreed: 0,
      performanceImpact: 0,
      interruptedOperations: 0,
      lastCollectionTime: 0,
      collectionsPerStrategy: {
        [GCStrategy.AGGRESSIVE]: 0,
        [GCStrategy.BALANCED]: 0,
        [GCStrategy.CONSERVATIVE]: 0,
        [GCStrategy.MANUAL]: 0,
      },
    };
  }

  private setupMonitoring(): void {
    if (this.config.enablePerformanceMonitoring) {
      this.setupPerformanceObserver();
    }

    // Monitor memory pressure
    this.memoryMonitorHandle = window.setInterval(() => {
      this.checkMemoryPressure();
    }, 5000);

    // Schedule regular collections based on strategy
    this.scheduleNextCollection();
  }

  private setupPerformanceObserver(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.name === 'garbage-collection') {
            this.updateMetricsFromGC(entry);
          }
        }
      });

      try {
        this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] });
      } catch (error) {
        console.warn(
          'GC Optimizer: Performance observer not fully supported',
          error,
        );
      }
    }
  }

  private setupIdleDetection(): void {
    if (!this.config.enableSmartTiming || typeof document === 'undefined')
      return;

    // Track user input activity
    const trackUserActivity = () => {
      this.lastUserActivity = Date.now();
    };

    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
    ];
    events.forEach((event) => {
      document.addEventListener(event, trackUserActivity, { passive: true });
      this.eventListeners.push({
        element: document,
        event,
        handler: trackUserActivity,
      });
    });

    // Monitor idle state
    this.idleDetectionHandle = window.setInterval(() => {
      this.checkIdleState();
    }, 1000);
  }

  private checkIdleState(): void {
    const now = Date.now();
    const userIdle =
      now - this.lastUserActivity > this.idleDetectionConfig.userInputTimeout;
    const audioIdle =
      now - this.lastAudioActivity >
      this.idleDetectionConfig.audioSilenceTimeout;

    if (userIdle && audioIdle) {
      this.shouldCollectBasedOnCPU()
        .then((shouldCollect) => {
          if (shouldCollect) {
            this.scheduleIdleCollection();
          }
        })
        .catch((error) => {
          console.warn('CPU detection failed:', error);
        });
    }
  }

  private async shouldCollectBasedOnCPU(): Promise<boolean> {
    // Use requestIdleCallback if available for more accurate CPU detection
    if (typeof requestIdleCallback !== 'undefined') {
      return new Promise<boolean>((resolve) => {
        requestIdleCallback((deadline) => {
          resolve(deadline.timeRemaining() > 10); // At least 10ms of idle time
        });
      });
    }

    // Fallback: estimate CPU usage based on frame timing
    const cpuUsage = await this.estimateCPUUsage();
    return cpuUsage < this.idleDetectionConfig.cpuUsageThreshold;
  }

  private async estimateCPUUsage(): Promise<number> {
    return new Promise<number>((resolve) => {
      let frameCount = 0;
      let totalFrameTime = 0;
      const startTime = performance.now();

      const measureFrame = () => {
        const frameTime = performance.now() - startTime;
        totalFrameTime += frameTime;
        frameCount++;

        if (frameCount < 10) {
          requestAnimationFrame(measureFrame);
        } else {
          // Return estimated CPU usage percentage
          const averageFrameTime = totalFrameTime / frameCount;
          const cpuUsage = Math.min((averageFrameTime / 16.67) * 100, 100); // 16.67ms = 60fps
          resolve(cpuUsage);
        }
      };

      requestAnimationFrame(measureFrame);
    });
  }

  private checkMemoryPressure(): void {
    const extendedPerformance = performance as ExtendedPerformance;
    if (typeof performance !== 'undefined' && extendedPerformance.memory) {
      const memory = extendedPerformance.memory;
      const memoryPressure = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

      if (memoryPressure > this.config.forceCollectionMemoryThreshold) {
        this.forceCollection(GCTrigger.CRITICAL);
      } else if (
        memoryPressure > this.config.schedule.memoryPressureThreshold
      ) {
        this.scheduleCollection(GCTrigger.MEMORY_PRESSURE);
      }
    }
  }

  public async optimizedGarbageCollection(
    trigger: GCTrigger,
    deviceConstraints?: DeviceConstraints,
  ): Promise<void> {
    if (this.isCollecting) {
      this.metrics.interruptedOperations++;
      return;
    }

    this.isCollecting = true;
    const startTime = performance.now();

    try {
      this.emit('gcStarted', {
        detail: { trigger, timestamp: Date.now() },
      });

      // Adjust collection strategy based on device constraints
      const adjustedStrategy = this.adjustStrategyForDevice(deviceConstraints);

      // Pre-collection preparation
      await this.prepareForCollection(adjustedStrategy);

      // Perform garbage collection based on strategy
      await this.performCollection(adjustedStrategy, trigger);

      // Post-collection cleanup and metrics
      const endTime = performance.now();
      const collectionTime = endTime - startTime;
      this.updateMetrics(collectionTime, trigger);

      this.emit('gcCompleted', {
        detail: {
          trigger,
          duration: collectionTime,
          memoryFreed: this.calculateMemoryFreed(),
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      this.emit('gcError', {
        detail: { error, trigger, timestamp: Date.now() },
      });
      throw error;
    } finally {
      this.isCollecting = false;
      this.scheduleNextCollection();
    }
  }

  private adjustStrategyForDevice(constraints?: DeviceConstraints): GCStrategy {
    if (!constraints) return this.config.strategy;

    // Conservative strategy for low battery or thermal issues
    if (constraints.batteryLevel && constraints.batteryLevel < 20) {
      return GCStrategy.CONSERVATIVE;
    }

    if (
      constraints.thermalState === 'serious' ||
      constraints.thermalState === 'critical'
    ) {
      return GCStrategy.CONSERVATIVE;
    }

    // Aggressive strategy for critical memory pressure
    if (constraints.memoryPressure === 'critical') {
      return GCStrategy.AGGRESSIVE;
    }

    // Low-end device optimizations
    if (constraints.isLowEndDevice) {
      return GCStrategy.CONSERVATIVE;
    }

    return this.config.strategy;
  }

  private async prepareForCollection(strategy: GCStrategy): Promise<void> {
    // Notify audio engine to prepare for potential brief interruption
    this.emit('gcPreparing', { detail: { strategy } });

    // For aggressive collections, request audio buffer completion
    if (strategy === GCStrategy.AGGRESSIVE) {
      this.emit('requestAudioBufferFlush');
    }

    // Allow other systems to prepare
    await new Promise((resolve) => setTimeout(resolve, 1));
  }

  private async performCollection(
    strategy: GCStrategy,
    _trigger: GCTrigger,
  ): Promise<void> {
    this.metrics.collectionsPerStrategy[strategy]++;

    switch (strategy) {
      case GCStrategy.AGGRESSIVE:
        await this.performAggressiveCollection();
        break;
      case GCStrategy.BALANCED:
        await this.performBalancedCollection();
        break;
      case GCStrategy.CONSERVATIVE:
        await this.performConservativeCollection();
        break;
      case GCStrategy.MANUAL:
        // Manual collections are handled externally
        break;
    }
  }

  private async performAggressiveCollection(): Promise<void> {
    // Force immediate garbage collection if available (development environments)
    if (typeof globalThis !== 'undefined' && globalThis.gc) {
      globalThis.gc();
    }

    // Clear weak references and cached objects
    this.clearWeakReferences();
    this.clearObjectCaches();

    // Force DOM cleanup
    this.triggerDOMCleanup();
  }

  private async performBalancedCollection(): Promise<void> {
    // Use requestIdleCallback for non-blocking collection
    return new Promise<void>((resolve) => {
      const performGC = () => {
        this.clearWeakReferences();
        this.performSelectiveCleanup();
        resolve();
      };

      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(performGC, { timeout: 100 });
      } else {
        setTimeout(performGC, 0);
      }
    });
  }

  private async performConservativeCollection(): Promise<void> {
    // Minimal, spread-out cleanup to avoid performance impact
    await this.performIncrementalCleanup();
  }

  private clearWeakReferences(): void {
    // Clear any WeakMap/WeakSet collections that may be holding references
    this.emit('clearWeakReferences');
  }

  private clearObjectCaches(): void {
    // Request cache clearing from other systems
    this.emit('clearObjectCaches');
  }

  private triggerDOMCleanup(): void {
    // Clean up any potential DOM memory leaks
    this.emit('domCleanup');
  }

  private performSelectiveCleanup(): void {
    // Selective cleanup of non-critical cached objects
    this.emit('selectiveCleanup');
  }

  private async performIncrementalCleanup(): Promise<void> {
    // Spread cleanup across multiple frames
    const tasks = [
      () =>
        this.emit('incrementalCleanup', { detail: { phase: 'references' } }),
      () => this.emit('incrementalCleanup', { detail: { phase: 'caches' } }),
      () => this.emit('incrementalCleanup', { detail: { phase: 'dom' } }),
    ];

    for (const task of tasks) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          task();
          resolve();
        });
      });
    }
  }

  private scheduleIdleCollection(): void {
    if (this.isCollecting) return;

    setTimeout(() => {
      this.optimizedGarbageCollection(GCTrigger.IDLE_DETECTION);
    }, 100); // Small delay to ensure we're still idle
  }

  private scheduleCollection(trigger: GCTrigger): void {
    if (this.scheduledCollectionHandle) {
      clearTimeout(this.scheduledCollectionHandle);
    }

    const delay = this.calculateOptimalDelay(trigger);
    this.scheduledCollectionHandle = window.setTimeout(() => {
      this.optimizedGarbageCollection(trigger);
    }, delay);
  }

  private forceCollection(trigger: GCTrigger): void {
    // Cancel any scheduled collections
    if (this.scheduledCollectionHandle) {
      clearTimeout(this.scheduledCollectionHandle);
      this.scheduledCollectionHandle = null;
    }

    // Force immediate collection using setTimeout for browser compatibility
    setTimeout(() => {
      this.optimizedGarbageCollection(trigger);
    }, 0);
  }

  private scheduleNextCollection(): void {
    const interval = this.calculateCollectionInterval();
    this.scheduledCollectionHandle = window.setTimeout(() => {
      this.optimizedGarbageCollection(GCTrigger.SCHEDULED);
    }, interval);
  }

  private calculateOptimalDelay(trigger: GCTrigger): number {
    switch (trigger) {
      case GCTrigger.CRITICAL:
        return 0;
      case GCTrigger.MEMORY_PRESSURE:
        return 1000;
      case GCTrigger.IDLE_DETECTION:
        return 500;
      case GCTrigger.SCHEDULED:
        return this.calculateCollectionInterval();
      default:
        return 5000;
    }
  }

  private calculateCollectionInterval(): number {
    const { minCollectionInterval, maxCollectionInterval } =
      this.config.schedule;

    // Adjust interval based on memory pressure and performance
    let interval = maxCollectionInterval;

    const extendedPerformance = performance as ExtendedPerformance;
    if (typeof performance !== 'undefined' && extendedPerformance.memory) {
      const memory = extendedPerformance.memory;
      const memoryPressure = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

      // More frequent collections under memory pressure
      interval = Math.max(
        minCollectionInterval,
        maxCollectionInterval * (1 - memoryPressure),
      );
    }

    return interval;
  }

  private updateMetrics(collectionTime: number, _trigger: GCTrigger): void {
    this.metrics.totalCollections++;
    this.metrics.totalTimeSpent += collectionTime;
    this.metrics.averageCollectionTime =
      this.metrics.totalTimeSpent / this.metrics.totalCollections;
    this.metrics.lastCollectionTime = Date.now();

    // Calculate performance impact (rough estimate)
    this.metrics.performanceImpact = (collectionTime / 16.67) * 100; // % of frame time

    this.emit('metricsUpdated', { detail: this.metrics });
  }

  private updateMetricsFromGC(entry: PerformanceEntry): void {
    // Update metrics from actual GC performance entries if available
    if (entry.duration) {
      this.updateMetrics(entry.duration, GCTrigger.MANUAL);
    }
  }

  private calculateMemoryFreed(): number {
    const extendedPerformance = performance as ExtendedPerformance;
    if (typeof performance !== 'undefined' && extendedPerformance.memory) {
      const memory = extendedPerformance.memory;
      // This is a rough estimate - actual freed memory is hard to measure
      return memory.totalJSHeapSize - memory.usedJSHeapSize;
    }
    return 0;
  }

  public updateAudioActivity(): void {
    this.lastAudioActivity = Date.now();
  }

  public updateConfig(newConfig: Partial<GCConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', { detail: this.config });
  }

  public getMetrics(): GCMetrics {
    return { ...this.metrics };
  }

  public getConfig(): GCConfig {
    return { ...this.config };
  }

  public async performManualCollection(): Promise<void> {
    await this.optimizedGarbageCollection(GCTrigger.MANUAL);
  }

  public destroy(): void {
    // Clean up performance observer
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    // Clear intervals
    if (this.memoryMonitorHandle) {
      clearInterval(this.memoryMonitorHandle);
      this.memoryMonitorHandle = null;
    }

    if (this.idleDetectionHandle) {
      clearInterval(this.idleDetectionHandle);
      this.idleDetectionHandle = null;
    }

    // Clear timeout
    if (this.scheduledCollectionHandle) {
      clearTimeout(this.scheduledCollectionHandle);
      this.scheduledCollectionHandle = null;
    }

    // Remove event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // Clear singleton instance
    GarbageCollectionOptimizer.instance = null;
  }
}

export default GarbageCollectionOptimizer;
