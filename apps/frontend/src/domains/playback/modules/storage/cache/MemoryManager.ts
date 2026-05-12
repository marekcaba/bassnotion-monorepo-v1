/**
 * MemoryManager - Intelligent memory monitoring and management
 *
 * Monitors system memory usage, provides pressure-aware caching decisions,
 * and implements adaptive memory management strategies to prevent
 * out-of-memory situations while maximizing cache efficiency.
 */

import { EventBus, createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('MemoryManager');

export type MemoryPressureLevel =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface MemoryThresholds {
  lowPressure: number; // e.g., 0.7 (70% memory used)
  mediumPressure: number; // e.g., 0.8 (80% memory used)
  highPressure: number; // e.g., 0.9 (90% memory used)
  criticalPressure: number; // e.g., 0.95 (95% memory used)
}

export interface MemoryManagerConfig {
  enabled: boolean;
  monitoringInterval: number; // ms
  thresholds: MemoryThresholds;
  adaptiveSizing: boolean;
  autoOptimization: boolean;
  maxCacheMemoryRatio: number; // Max % of available memory for cache
  emergencyEvictionEnabled: boolean;
  compressionThreshold: number; // Memory pressure level to start compression
  performanceMonitoring: boolean;
}

export interface MemoryUsageInfo {
  totalMemory: number;
  usedMemory: number;
  availableMemory: number;
  cacheMemory: number;
  pressureLevel: MemoryPressureLevel;
  usagePercentage: number;
  cachePercentage: number;
  recommendation: MemoryRecommendation;
}

export interface MemoryRecommendation {
  action: 'none' | 'reduce' | 'compress' | 'evict' | 'emergency';
  targetReduction?: number;
  reason: string;
}

export interface MemorySnapshot {
  timestamp: number;
  usage: MemoryUsageInfo;
  processMemory?: NodeJS.MemoryUsage;
}

/**
 * Manages memory usage and provides adaptive caching strategies
 */
export class MemoryManager {
  private config: MemoryManagerConfig;
  private eventBus?: EventBus;
  private monitoringInterval?: number;
  private isMonitoring = false;

  // Memory tracking
  private currentPressureLevel: MemoryPressureLevel = 'none';
  private memoryHistory: MemorySnapshot[] = [];
  private readonly HISTORY_SIZE = 60; // Keep 1 minute of history at 1s intervals

  // Performance tracking
  private lastGC?: number;
  private gcCount = 0;

  // Cache size tracking
  private currentCacheSize = 0;
  private peakCacheSize = 0;

  constructor(config: MemoryManagerConfig, eventBus?: EventBus) {
    this.config = config;
    this.eventBus = eventBus;

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.performMemoryCheck();

    // Set up periodic monitoring
    this.monitoringInterval = window.setInterval(() => {
      this.performMemoryCheck();
    }, this.config.monitoringInterval);

    logger.info('Memory monitoring started');
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.isMonitoring = false;
    logger.info('Memory monitoring stopped');
  }

  /**
   * Perform memory check and analysis
   */
  private performMemoryCheck(): void {
    const usage = this.calculateMemoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      usage,
    };

    // Add Node.js memory info if available
    if (typeof process !== 'undefined' && process.memoryUsage) {
      snapshot.processMemory = process.memoryUsage();
    }

    // Update history
    this.memoryHistory.push(snapshot);
    if (this.memoryHistory.length > this.HISTORY_SIZE) {
      this.memoryHistory.shift();
    }

    // Check for pressure level changes
    const previousLevel = this.currentPressureLevel;
    this.currentPressureLevel = usage.pressureLevel;

    if (previousLevel !== this.currentPressureLevel) {
      this.handlePressureLevelChange(previousLevel, this.currentPressureLevel);
    }

    // Auto-optimization if enabled
    if (this.config.autoOptimization && usage.pressureLevel !== 'none') {
      this.performAutoOptimization(usage);
    }

    // Emit usage update
    this.eventBus?.emit('memory:usage', { usage });
  }

  /**
   * Calculate current memory usage
   */
  private calculateMemoryUsage(): MemoryUsageInfo {
    // Get memory info based on environment
    const memoryInfo = this.getSystemMemoryInfo();

    const usagePercentage = memoryInfo.usedMemory / memoryInfo.totalMemory;
    const cachePercentage = this.currentCacheSize / memoryInfo.totalMemory;

    // Determine pressure level
    const pressureLevel = this.calculatePressureLevel(usagePercentage);

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      pressureLevel,
      usagePercentage,
      cachePercentage,
    );

    return {
      totalMemory: memoryInfo.totalMemory,
      usedMemory: memoryInfo.usedMemory,
      availableMemory: memoryInfo.availableMemory,
      cacheMemory: this.currentCacheSize,
      pressureLevel,
      usagePercentage,
      cachePercentage,
      recommendation,
    };
  }

  /**
   * Get system memory information
   */
  private getSystemMemoryInfo(): {
    totalMemory: number;
    usedMemory: number;
    availableMemory: number;
  } {
    // Browser environment - use typed performance.memory (window.d.ts)
    if (typeof window !== 'undefined' && window.performance.memory) {
      const perfMemory = window.performance.memory;
      return {
        totalMemory: perfMemory.jsHeapSizeLimit || 2 * 1024 * 1024 * 1024, // 2GB default
        usedMemory: perfMemory.usedJSHeapSize || 0,
        availableMemory:
          (perfMemory.jsHeapSizeLimit || 2 * 1024 * 1024 * 1024) -
          (perfMemory.usedJSHeapSize || 0),
      };
    }

    // Node.js environment
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const _usage = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const freeMemory = require('os').freemem();

      return {
        totalMemory,
        usedMemory: totalMemory - freeMemory,
        availableMemory: freeMemory,
      };
    }

    // Fallback - estimate based on typical constraints
    return {
      totalMemory: 2 * 1024 * 1024 * 1024, // 2GB
      usedMemory: this.currentCacheSize * 2, // Rough estimate
      availableMemory: 2 * 1024 * 1024 * 1024 - this.currentCacheSize * 2,
    };
  }

  /**
   * Calculate pressure level based on usage
   */
  private calculatePressureLevel(usagePercentage: number): MemoryPressureLevel {
    const { thresholds } = this.config;

    if (usagePercentage >= thresholds.criticalPressure) {
      return 'critical';
    } else if (usagePercentage >= thresholds.highPressure) {
      return 'high';
    } else if (usagePercentage >= thresholds.mediumPressure) {
      return 'medium';
    } else if (usagePercentage >= thresholds.lowPressure) {
      return 'low';
    } else {
      return 'none';
    }
  }

  /**
   * Generate memory management recommendation
   */
  private generateRecommendation(
    pressureLevel: MemoryPressureLevel,
    _usagePercentage: number,
    cachePercentage: number,
  ): MemoryRecommendation {
    // Check if cache is using too much memory
    if (cachePercentage > this.config.maxCacheMemoryRatio) {
      return {
        action: 'reduce',
        targetReduction: this.currentCacheSize * 0.2, // Reduce by 20%
        reason: 'Cache exceeds maximum memory ratio',
      };
    }

    switch (pressureLevel) {
      case 'critical':
        return {
          action: 'emergency',
          targetReduction: this.currentCacheSize * 0.5, // Reduce by 50%
          reason: 'Critical memory pressure detected',
        };

      case 'high':
        return {
          action: 'evict',
          targetReduction: this.currentCacheSize * 0.3, // Reduce by 30%
          reason: 'High memory pressure detected',
        };

      case 'medium':
        return {
          action: 'compress',
          reason: 'Medium memory pressure - consider compression',
        };

      case 'low':
        return {
          action: 'reduce',
          targetReduction: this.currentCacheSize * 0.1, // Reduce by 10%
          reason: 'Low memory pressure - optimize cache size',
        };

      default:
        return {
          action: 'none',
          reason: 'Memory usage within normal parameters',
        };
    }
  }

  /**
   * Handle pressure level changes
   */
  private handlePressureLevelChange(
    oldLevel: MemoryPressureLevel,
    newLevel: MemoryPressureLevel,
  ): void {
    logger.warn(`Memory pressure changed from ${oldLevel} to ${newLevel}`);

    this.eventBus?.emit('memory:pressureChanged', {
      oldLevel,
      newLevel,
      timestamp: Date.now(),
    });

    // Trigger garbage collection if available and pressure increased
    if (this.shouldTriggerGC(oldLevel, newLevel)) {
      this.triggerGarbageCollection();
    }
  }

  /**
   * Perform auto-optimization based on memory state
   */
  private performAutoOptimization(usage: MemoryUsageInfo): void {
    const { recommendation } = usage;

    if (recommendation.action === 'none') return;

    logger.info(
      `Auto-optimization: ${recommendation.action} - ${recommendation.reason}`,
    );

    this.eventBus?.emit('memory:optimize', {
      action: recommendation.action,
      targetReduction: recommendation.targetReduction,
      currentUsage: usage,
    });
  }

  /**
   * Check if GC should be triggered
   */
  private shouldTriggerGC(
    oldLevel: MemoryPressureLevel,
    newLevel: MemoryPressureLevel,
  ): boolean {
    const levelValues = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    return (
      levelValues[newLevel] > levelValues[oldLevel] &&
      levelValues[newLevel] >= levelValues.medium
    );
  }

  /**
   * Trigger garbage collection if available
   */
  private triggerGarbageCollection(): void {
    if (typeof window !== 'undefined' && window.gc) {
      try {
        window.gc();
        this.lastGC = Date.now();
        this.gcCount++;
        logger.info('Garbage collection triggered');
      } catch (error) {
        logger.warn('Failed to trigger garbage collection:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Update cache size tracking
   */
  updateCacheSize(size: number): void {
    this.currentCacheSize = size;
    this.peakCacheSize = Math.max(this.peakCacheSize, size);
  }

  /**
   * Get current memory pressure level
   */
  getMemoryPressure(): MemoryPressureLevel {
    return this.currentPressureLevel;
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): MemoryUsageInfo {
    return this.calculateMemoryUsage();
  }

  /**
   * Get memory history
   */
  getMemoryHistory(): MemorySnapshot[] {
    return [...this.memoryHistory];
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): {
    currentCacheSize: number;
    peakCacheSize: number;
    gcCount: number;
    lastGC?: number;
    averageUsage: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    // Calculate average usage
    const recentHistory = this.memoryHistory.slice(-10);
    const averageUsage =
      recentHistory.length > 0
        ? recentHistory.reduce((sum, s) => sum + s.usage.usagePercentage, 0) /
          recentHistory.length
        : 0;

    // Calculate trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recentHistory.length >= 3) {
      const firstThird = recentHistory.slice(0, 3);
      const lastThird = recentHistory.slice(-3);

      const firstAvg =
        firstThird.reduce((sum, s) => sum + s.usage.usagePercentage, 0) / 3;
      const lastAvg =
        lastThird.reduce((sum, s) => sum + s.usage.usagePercentage, 0) / 3;

      if (lastAvg > firstAvg + 0.05) {
        trend = 'increasing';
      } else if (lastAvg < firstAvg - 0.05) {
        trend = 'decreasing';
      }
    }

    return {
      currentCacheSize: this.currentCacheSize,
      peakCacheSize: this.peakCacheSize,
      gcCount: this.gcCount,
      lastGC: this.lastGC,
      averageUsage,
      trend,
    };
  }

  /**
   * Can allocate memory check
   */
  canAllocate(size: number): boolean {
    const usage = this.calculateMemoryUsage();
    const afterAllocation = (usage.usedMemory + size) / usage.totalMemory;

    // Don't allocate if it would push us into high pressure
    return afterAllocation < this.config.thresholds.highPressure;
  }

  /**
   * Get recommended cache size based on memory
   */
  getRecommendedCacheSize(): number {
    const usage = this.calculateMemoryUsage();
    const availableForCache =
      usage.totalMemory * this.config.maxCacheMemoryRatio;

    // Adjust based on pressure
    switch (usage.pressureLevel) {
      case 'critical':
        return availableForCache * 0.3;
      case 'high':
        return availableForCache * 0.5;
      case 'medium':
        return availableForCache * 0.7;
      case 'low':
        return availableForCache * 0.9;
      default:
        return availableForCache;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MemoryManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart monitoring if interval changed
    if (newConfig.monitoringInterval !== undefined) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  /**
   * Dispose of the memory manager
   */
  dispose(): void {
    this.stopMonitoring();
    this.memoryHistory = [];
  }
}
