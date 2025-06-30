/**
 * Story 2.4 Task 4.4: Intelligent Sample Caching - Memory Manager
 * MemoryManager - Monitors and manages memory usage for cache optimization
 *
 * Provides intelligent memory management including:
 * - Memory usage monitoring and tracking
 * - Memory pressure detection and handling
 * - Adaptive cache sizing based on available memory
 * - Memory cleanup and optimization
 * - Performance impact assessment
 */

/**
 * Memory usage information
 */
export interface MemoryUsageInfo {
  totalMemory: number; // Total available memory in bytes
  usedMemory: number; // Currently used memory in bytes
  cacheMemory: number; // Memory used by cache in bytes
  availableMemory: number; // Available memory in bytes
  memoryPressure: MemoryPressureLevel;
  lastUpdated: number;
}

export type MemoryPressureLevel =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface MemoryThresholds {
  lowPressure: number; // Memory usage percentage (0-1)
  mediumPressure: number;
  highPressure: number;
  criticalPressure: number;
}

export interface MemoryOptimizationAction {
  action:
    | 'reduce_cache'
    | 'compress_data'
    | 'evict_entries'
    | 'defer_operations';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  targetReduction: number; // Target memory reduction in bytes
  estimatedImpact: number; // Estimated performance impact (0-1)
  description: string;
}

export interface MemoryManagerConfig {
  enabled: boolean;
  monitoringInterval: number; // Memory monitoring interval in ms
  thresholds: MemoryThresholds;
  adaptiveSizing: boolean; // Enable adaptive cache sizing
  autoOptimization: boolean; // Enable automatic memory optimization
  maxCacheMemoryRatio: number; // Maximum cache memory as ratio of total (0-1)
  emergencyEvictionEnabled: boolean;
  compressionThreshold: number; // Memory pressure level to enable compression
  performanceMonitoring: boolean;
}

/**
 * Memory Manager
 *
 * Monitors system memory usage and optimizes cache behavior based on memory pressure.
 * Provides adaptive cache sizing, emergency eviction, and memory optimization recommendations.
 */
export class MemoryManager {
  private config: MemoryManagerConfig;
  private currentUsage: MemoryUsageInfo;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private pressureHistory: Array<{
    level: MemoryPressureLevel;
    timestamp: number;
  }> = [];

  // Performance monitoring
  private performanceMetrics = new Map<string, number>();
  private lastOptimizationTime = 0;

  constructor(config: MemoryManagerConfig) {
    this.config = config;
    this.currentUsage = this.getInitialMemoryUsage();

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Get current memory usage information
   */
  public getMemoryUsage(): MemoryUsageInfo {
    this.updateMemoryUsage();
    return { ...this.currentUsage };
  }

  /**
   * Get current memory pressure level
   */
  public getMemoryPressure(): MemoryPressureLevel {
    return this.currentUsage.memoryPressure;
  }

  /**
   * Check if cache operations should be throttled due to memory pressure
   */
  public shouldThrottleOperations(): boolean {
    const pressure = this.getMemoryPressure();
    return pressure === 'high' || pressure === 'critical';
  }

  /**
   * Get recommended cache size based on current memory conditions
   */
  public getRecommendedCacheSize(): number {
    const memoryInfo = this.getMemoryUsage();
    const availableForCache =
      memoryInfo.totalMemory * this.config.maxCacheMemoryRatio;

    switch (memoryInfo.memoryPressure) {
      case 'none':
        return availableForCache;
      case 'low':
        return availableForCache * 0.8;
      case 'medium':
        return availableForCache * 0.6;
      case 'high':
        return availableForCache * 0.4;
      case 'critical':
        return availableForCache * 0.2;
      default:
        return availableForCache * 0.5;
    }
  }

  /**
   * Generate memory optimization actions based on current pressure
   */
  public generateOptimizationActions(): MemoryOptimizationAction[] {
    const actions: MemoryOptimizationAction[] = [];
    const pressure = this.getMemoryPressure();
    const memoryInfo = this.getMemoryUsage();

    if (pressure === 'none' || pressure === 'low') {
      return actions; // No optimization needed
    }

    // Calculate target reduction based on pressure level
    const targetReduction = this.calculateTargetReduction(memoryInfo);

    if (pressure === 'medium') {
      actions.push({
        action: 'compress_data',
        urgency: 'low',
        targetReduction: targetReduction * 0.3,
        estimatedImpact: 0.1,
        description:
          'Enable compression for cached data to reduce memory usage',
      });

      actions.push({
        action: 'evict_entries',
        urgency: 'medium',
        targetReduction: targetReduction * 0.5,
        estimatedImpact: 0.2,
        description: 'Evict least recently used cache entries',
      });
    }

    if (pressure === 'high') {
      actions.push({
        action: 'reduce_cache',
        urgency: 'high',
        targetReduction: targetReduction * 0.6,
        estimatedImpact: 0.3,
        description: 'Reduce maximum cache size to free memory',
      });

      actions.push({
        action: 'evict_entries',
        urgency: 'high',
        targetReduction: targetReduction * 0.4,
        estimatedImpact: 0.2,
        description: 'Aggressively evict cache entries',
      });
    }

    if (pressure === 'critical') {
      actions.push({
        action: 'reduce_cache',
        urgency: 'critical',
        targetReduction: targetReduction * 0.8,
        estimatedImpact: 0.5,
        description: 'Emergency cache reduction to prevent memory exhaustion',
      });

      actions.push({
        action: 'defer_operations',
        urgency: 'critical',
        targetReduction: 0,
        estimatedImpact: 0.3,
        description: 'Defer non-critical cache operations',
      });
    }

    return actions;
  }

  /**
   * Record cache memory usage for tracking
   */
  public recordCacheMemoryUsage(bytes: number): void {
    this.currentUsage.cacheMemory = bytes;
    this.updateMemoryPressure();
  }

  /**
   * Check if memory pressure has changed significantly
   */
  public hasMemoryPressureChanged(): boolean {
    if (this.pressureHistory.length < 2) {
      return false;
    }

    const current = this.pressureHistory[this.pressureHistory.length - 1];
    const previous = this.pressureHistory[this.pressureHistory.length - 2];

    return current?.level !== previous?.level;
  }

  /**
   * Get memory pressure trend over time
   */
  public getMemoryPressureTrend(): 'improving' | 'stable' | 'worsening' {
    if (this.pressureHistory.length < 3) {
      return 'stable';
    }

    const recent = this.pressureHistory.slice(-3);
    const levels = ['none', 'low', 'medium', 'high', 'critical'];

    const indices = recent.map((entry) => levels.indexOf(entry.level));

    const firstIndex = indices[0];
    const lastIndex = indices[2];

    if (firstIndex !== undefined && lastIndex !== undefined) {
      if (lastIndex > firstIndex) {
        return 'worsening';
      } else if (lastIndex < firstIndex) {
        return 'improving';
      }
    }

    return 'stable';
  }

  /**
   * Start memory monitoring
   */
  public startMonitoring(): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    this.monitoringInterval = setInterval(() => {
      this.updateMemoryUsage();
      this.recordPressureHistory();

      if (this.config.autoOptimization) {
        this.performAutoOptimization();
      }
    }, this.config.monitoringInterval);
  }

  /**
   * Stop memory monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Get performance metrics related to memory management
   */
  public getPerformanceMetrics(): Record<string, number> {
    return Object.fromEntries(this.performanceMetrics);
  }

  /**
   * Reset memory manager state
   */
  public reset(): void {
    this.stopMonitoring();
    this.pressureHistory = [];
    this.performanceMetrics.clear();
    this.lastOptimizationTime = 0;

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  // Private implementation methods

  private getInitialMemoryUsage(): MemoryUsageInfo {
    const memoryInfo = this.getSystemMemoryInfo();

    return {
      totalMemory: memoryInfo.totalMemory,
      usedMemory: memoryInfo.usedMemory,
      cacheMemory: 0,
      availableMemory: memoryInfo.availableMemory,
      memoryPressure: 'none',
      lastUpdated: Date.now(),
    };
  }

  private updateMemoryUsage(): void {
    const memoryInfo = this.getSystemMemoryInfo();

    this.currentUsage = {
      totalMemory: memoryInfo.totalMemory,
      usedMemory: memoryInfo.usedMemory,
      cacheMemory: this.currentUsage.cacheMemory, // Keep tracked cache memory
      availableMemory: memoryInfo.availableMemory,
      memoryPressure: this.calculateMemoryPressure(memoryInfo),
      lastUpdated: Date.now(),
    };
  }

  private getSystemMemoryInfo(): {
    totalMemory: number;
    usedMemory: number;
    availableMemory: number;
  } {
    // In a browser environment, we have limited memory information
    // We'll use performance.memory if available, otherwise estimate

    if ('memory' in performance && performance.memory) {
      const memory = performance.memory as any;
      return {
        totalMemory: memory.jsHeapSizeLimit || 2 * 1024 * 1024 * 1024, // 2GB default
        usedMemory: memory.usedJSHeapSize || 0,
        availableMemory:
          (memory.jsHeapSizeLimit || 2 * 1024 * 1024 * 1024) -
          (memory.usedJSHeapSize || 0),
      };
    }

    // Fallback estimation for browsers without performance.memory
    const estimatedTotal = 2 * 1024 * 1024 * 1024; // 2GB
    const estimatedUsed = estimatedTotal * 0.3; // Assume 30% usage

    return {
      totalMemory: estimatedTotal,
      usedMemory: estimatedUsed,
      availableMemory: estimatedTotal - estimatedUsed,
    };
  }

  private calculateMemoryPressure(memoryInfo: {
    totalMemory: number;
    usedMemory: number;
    availableMemory: number;
  }): MemoryPressureLevel {
    const usageRatio = memoryInfo.usedMemory / memoryInfo.totalMemory;

    if (usageRatio >= this.config.thresholds.criticalPressure) {
      return 'critical';
    } else if (usageRatio >= this.config.thresholds.highPressure) {
      return 'high';
    } else if (usageRatio >= this.config.thresholds.mediumPressure) {
      return 'medium';
    } else if (usageRatio >= this.config.thresholds.lowPressure) {
      return 'low';
    } else {
      return 'none';
    }
  }

  private updateMemoryPressure(): void {
    const memoryInfo = this.getSystemMemoryInfo();
    this.currentUsage.memoryPressure = this.calculateMemoryPressure(memoryInfo);
  }

  private recordPressureHistory(): void {
    this.pressureHistory.push({
      level: this.currentUsage.memoryPressure,
      timestamp: Date.now(),
    });

    // Keep only recent history (last hour)
    const cutoff = Date.now() - 60 * 60 * 1000;
    this.pressureHistory = this.pressureHistory.filter(
      (entry) => entry.timestamp >= cutoff,
    );
  }

  private calculateTargetReduction(memoryInfo: MemoryUsageInfo): number {
    const excessMemory =
      memoryInfo.usedMemory -
      memoryInfo.totalMemory * this.config.thresholds.lowPressure;
    return Math.max(0, excessMemory);
  }

  private performAutoOptimization(): void {
    const now = Date.now();
    const timeSinceLastOptimization = now - this.lastOptimizationTime;

    // Don't optimize too frequently
    if (timeSinceLastOptimization < this.config.monitoringInterval * 5) {
      return;
    }

    const pressure = this.getMemoryPressure();

    if (pressure === 'high' || pressure === 'critical') {
      this.triggerEmergencyOptimization();
      this.lastOptimizationTime = now;
    } else if (pressure === 'medium' && this.config.adaptiveSizing) {
      this.triggerAdaptiveOptimization();
      this.lastOptimizationTime = now;
    }
  }

  private triggerEmergencyOptimization(): void {
    // Record emergency optimization event
    this.performanceMetrics.set(
      'emergency_optimizations',
      (this.performanceMetrics.get('emergency_optimizations') || 0) + 1,
    );

    // This would trigger cache eviction in the actual cache manager
    // For now, we just record the event
    console.warn(
      'Memory Manager: Emergency optimization triggered due to memory pressure',
    );
  }

  private triggerAdaptiveOptimization(): void {
    // Record adaptive optimization event
    this.performanceMetrics.set(
      'adaptive_optimizations',
      (this.performanceMetrics.get('adaptive_optimizations') || 0) + 1,
    );

    // This would trigger gradual cache optimization
    console.info('Memory Manager: Adaptive optimization triggered');
  }
}

export default MemoryManager;
