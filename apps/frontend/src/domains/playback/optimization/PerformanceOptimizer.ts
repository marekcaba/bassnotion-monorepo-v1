/**
 * PerformanceOptimizer - Production performance optimization
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 *
 * Optimizes audio performance for production use
 */

import { EventBus } from '../services/core/EventBus.js';
import { AudioError } from '../errors/AudioErrors.js';

export interface OptimizationConfig {
  enableMemoryPooling?: boolean;
  enableGarbageCollectionOptimization?: boolean;
  maxMemoryPoolSize?: number;
  gcOptimizationInterval?: number;
  performanceMonitoring?: boolean;
}

export interface MemoryPool<T> {
  name: string;
  factory: () => T;
  reset: (item: T) => void;
  maxSize: number;
  items: T[];
  inUse: Set<T>;
}

export interface PerformanceMetrics {
  initializationTime: number;
  memoryUsage: {
    current: number;
    peak: number;
    allocated: number;
  };
  cpuUsage: {
    current: number;
    average: number;
    peak: number;
  };
  audioMetrics: {
    latency: number;
    dropouts: number;
    bufferUnderruns: number;
  };
  gcMetrics: {
    collections: number;
    pauseTime: number;
    lastCollection: number;
  };
}

export class PerformanceOptimizer {
  private eventBus: EventBus;
  private config: Required<OptimizationConfig>;
  private memoryPools = new Map<string, MemoryPool<any>>();
  private metrics: PerformanceMetrics;
  private gcTimer?: NodeJS.Timeout;
  private initStartTime = 0;
  private isOptimizing = false;

  constructor(eventBus: EventBus, config: OptimizationConfig = {}) {
    this.eventBus = eventBus;
    this.config = {
      enableMemoryPooling: true,
      enableGarbageCollectionOptimization: true,
      maxMemoryPoolSize: 100,
      gcOptimizationInterval: 30000, // 30 seconds
      performanceMonitoring: true,
      ...config,
    };

    this.metrics = this.initializeMetrics();
    this.setupEventListeners();
  }

  /**
   * Start optimization tracking
   */
  startOptimization(): void {
    this.initStartTime = performance.now();
    this.isOptimizing = true;

    if (this.config.enableMemoryPooling) {
      this.initializeMemoryPools();
    }

    if (this.config.enableGarbageCollectionOptimization) {
      this.startGCOptimization();
    }

    this.eventBus.emit('optimization:started', {
      timestamp: Date.now(),
      config: this.config,
    });
  }

  /**
   * Complete initialization optimization
   */
  completeInitialization(): void {
    if (!this.isOptimizing) return;

    this.metrics.initializationTime = performance.now() - this.initStartTime;
    this.isOptimizing = false;

    this.eventBus.emit('optimization:initialization-complete', {
      duration: this.metrics.initializationTime,
      timestamp: Date.now(),
    });

    // Check if we met the < 2 second target
    if (this.metrics.initializationTime > 2000) {
      this.eventBus.emit('optimization:warning', {
        message: `Initialization took ${Math.round(this.metrics.initializationTime)}ms, exceeding 2s target`,
        metric: 'initializationTime',
        value: this.metrics.initializationTime,
        target: 2000,
      });
    }
  }

  /**
   * Initialize memory pools
   */
  private initializeMemoryPools(): void {
    // Audio buffer pool
    this.createPool('audioBuffers', {
      factory: () => new Float32Array(4096),
      reset: (buffer) => buffer.fill(0),
      maxSize: 20,
    });

    // Event object pool
    this.createPool('eventObjects', {
      factory: () => ({ type: '', data: null, timestamp: 0 }),
      reset: (obj) => {
        obj.type = '';
        obj.data = null;
        obj.timestamp = 0;
      },
      maxSize: 50,
    });

    // Command object pool
    this.createPool('commandObjects', {
      factory: () => ({ id: '', type: '', params: {} }),
      reset: (obj) => {
        obj.id = '';
        obj.type = '';
        obj.params = {};
      },
      maxSize: 30,
    });

    // Analysis data pool
    this.createPool('analysisData', {
      factory: () => new Float32Array(2048),
      reset: (buffer) => buffer.fill(0),
      maxSize: 10,
    });
  }

  /**
   * Create a memory pool
   */
  private createPool<T>(
    name: string,
    options: {
      factory: () => T;
      reset: (item: T) => void;
      maxSize: number;
    },
  ): void {
    const pool: MemoryPool<T> = {
      name,
      factory: options.factory,
      reset: options.reset,
      maxSize: options.maxSize,
      items: [],
      inUse: new Set(),
    };

    // Pre-allocate some items
    const preAllocateCount = Math.min(5, options.maxSize);
    for (let i = 0; i < preAllocateCount; i++) {
      pool.items.push(options.factory());
    }

    this.memoryPools.set(name, pool);
  }

  /**
   * Get item from pool
   */
  getFromPool<T>(poolName: string): T | null {
    const pool = this.memoryPools.get(poolName);
    if (!pool) return null;

    let item: T;
    if (pool.items.length > 0) {
      item = pool.items.pop()!;
    } else if (pool.inUse.size < pool.maxSize) {
      item = pool.factory();
    } else {
      // Pool exhausted
      this.eventBus.emit('optimization:pool-exhausted', {
        pool: poolName,
        size: pool.maxSize,
      });
      return null;
    }

    pool.inUse.add(item);
    return item;
  }

  /**
   * Return item to pool
   */
  returnToPool<T>(poolName: string, item: T): void {
    const pool = this.memoryPools.get(poolName);
    if (!pool || !pool.inUse.has(item)) return;

    pool.inUse.delete(item);
    pool.reset(item);

    if (pool.items.length < pool.maxSize) {
      pool.items.push(item);
    }
  }

  /**
   * Start garbage collection optimization
   */
  private startGCOptimization(): void {
    if (this.gcTimer) return;

    this.gcTimer = setInterval(() => {
      this.optimizeGarbageCollection();
    }, this.config.gcOptimizationInterval);
  }

  /**
   * Optimize garbage collection
   */
  private optimizeGarbageCollection(): void {
    const startTime = performance.now();

    // Check if we're in a good state to GC
    if (!this.isGoodTimeForGC()) {
      return;
    }

    // Trim memory pools
    this.trimMemoryPools();

    // Clear weak references
    this.clearWeakReferences();

    // Force GC if available (development only)
    if ('gc' in globalThis && typeof (globalThis as any).gc === 'function') {
      (globalThis as any).gc();
    }

    const gcTime = performance.now() - startTime;
    this.metrics.gcMetrics.collections++;
    this.metrics.gcMetrics.pauseTime += gcTime;
    this.metrics.gcMetrics.lastCollection = Date.now();

    this.eventBus.emit('optimization:gc-complete', {
      duration: gcTime,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if it's a good time for GC
   */
  private isGoodTimeForGC(): boolean {
    // Don't GC during audio playback or critical operations
    // This should be enhanced with actual playback state checking
    const memoryPressure = this.getMemoryPressure();
    return memoryPressure < 0.7; // Only GC if memory usage is below 70%
  }

  /**
   * Trim memory pools to free unused memory
   */
  private trimMemoryPools(): void {
    for (const [name, pool] of this.memoryPools) {
      const excessItems = pool.items.length - 5; // Keep 5 items ready
      if (excessItems > 0) {
        pool.items.splice(0, excessItems);
        this.eventBus.emit('optimization:pool-trimmed', {
          pool: name,
          removed: excessItems,
        });
      }
    }
  }

  /**
   * Clear weak references
   */
  private clearWeakReferences(): void {
    // This would clear any WeakMap/WeakSet references
    // Placeholder for actual implementation
  }

  /**
   * Get memory pressure (0-1)
   */
  private getMemoryPressure(): number {
    if (!performance.memory) return 0;

    const used = performance.memory.usedJSHeapSize;
    const limit = performance.memory.jsHeapSizeLimit;
    return used / limit;
  }

  /**
   * Monitor performance
   */
  async monitorPerformance(): Promise<PerformanceMetrics> {
    // Update memory metrics
    if (performance.memory) {
      this.metrics.memoryUsage = {
        current: performance.memory.usedJSHeapSize / (1024 * 1024),
        peak: Math.max(
          this.metrics.memoryUsage.peak,
          performance.memory.usedJSHeapSize / (1024 * 1024),
        ),
        allocated: performance.memory.totalJSHeapSize / (1024 * 1024),
      };
    }

    // Update CPU metrics (simplified estimation)
    const cpuUsage = await this.estimateCPUUsage();
    this.metrics.cpuUsage = {
      current: cpuUsage,
      average: (this.metrics.cpuUsage.average + cpuUsage) / 2,
      peak: Math.max(this.metrics.cpuUsage.peak, cpuUsage),
    };

    // Check performance targets
    this.checkPerformanceTargets();

    return { ...this.metrics };
  }

  /**
   * Estimate CPU usage
   */
  private async estimateCPUUsage(): Promise<number> {
    const start = performance.now();
    let iterations = 0;

    // Run for 5ms
    while (performance.now() - start < 5) {
      iterations++;
    }

    // Baseline is ~50000 iterations in 5ms on typical CPU
    const baseline = 50000;
    const usage = Math.max(0, 100 - (iterations / baseline) * 100);

    return Math.min(100, usage);
  }

  /**
   * Check performance targets
   */
  private checkPerformanceTargets(): void {
    // Memory target: < 50% of old system
    const memoryTarget = 200; // MB (assuming old system used 400MB)
    if (this.metrics.memoryUsage.current > memoryTarget) {
      this.eventBus.emit('optimization:target-exceeded', {
        metric: 'memory',
        current: this.metrics.memoryUsage.current,
        target: memoryTarget,
      });
    }

    // CPU target: optimized for sustained playback
    const cpuTarget = 30; // %
    if (this.metrics.cpuUsage.average > cpuTarget) {
      this.eventBus.emit('optimization:target-exceeded', {
        metric: 'cpu',
        current: this.metrics.cpuUsage.average,
        target: cpuTarget,
      });
    }
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      initializationTime: 0,
      memoryUsage: {
        current: 0,
        peak: 0,
        allocated: 0,
      },
      cpuUsage: {
        current: 0,
        average: 0,
        peak: 0,
      },
      audioMetrics: {
        latency: 0,
        dropouts: 0,
        bufferUnderruns: 0,
      },
      gcMetrics: {
        collections: 0,
        pauseTime: 0,
        lastCollection: 0,
      },
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Track audio metrics
    this.eventBus.on('audio:dropout', () => {
      this.metrics.audioMetrics.dropouts++;
    });

    this.eventBus.on('audio:buffer-underrun', () => {
      this.metrics.audioMetrics.bufferUnderruns++;
    });

    this.eventBus.on('audio:latency-measured', ({ latency }) => {
      this.metrics.audioMetrics.latency = latency;
    });
  }

  /**
   * Get optimization report
   */
  getOptimizationReport(): {
    metrics: PerformanceMetrics;
    pools: Array<{
      name: string;
      size: number;
      inUse: number;
      available: number;
    }>;
    recommendations: string[];
  } {
    const pools = Array.from(this.memoryPools.entries()).map(
      ([name, pool]) => ({
        name,
        size: pool.maxSize,
        inUse: pool.inUse.size,
        available: pool.items.length,
      }),
    );

    const recommendations = this.generateRecommendations();

    return {
      metrics: { ...this.metrics },
      pools,
      recommendations,
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.initializationTime > 2000) {
      recommendations.push(
        'Consider lazy loading non-essential components to reduce initialization time',
      );
    }

    if (this.metrics.memoryUsage.current > 200) {
      recommendations.push(
        'Memory usage exceeds target. Review sample loading and caching strategies',
      );
    }

    if (this.metrics.cpuUsage.average > 30) {
      recommendations.push(
        'CPU usage is high. Consider optimizing audio processing algorithms',
      );
    }

    if (this.metrics.audioMetrics.dropouts > 0) {
      recommendations.push(
        'Audio dropouts detected. Increase buffer sizes or reduce processing load',
      );
    }

    if (this.metrics.gcMetrics.pauseTime > 100) {
      recommendations.push(
        'GC pause time is high. Review object allocation patterns',
      );
    }

    return recommendations;
  }

  /**
   * Dispose of optimizer
   */
  dispose(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = undefined;
    }

    // Clear memory pools
    this.memoryPools.clear();

    this.eventBus.emit('optimization:disposed', {
      timestamp: Date.now(),
    });
  }
}
