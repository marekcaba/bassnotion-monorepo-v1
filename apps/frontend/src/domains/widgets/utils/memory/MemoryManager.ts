/**
 * Memory Management System for Widget Components
 *
 * Provides comprehensive memory tracking, leak detection, and cleanup
 * management for the BassNotion widget ecosystem.
 *
 * Features:
 * - Real-time memory usage monitoring
 * - Memory leak detection and alerting
 * - Automatic cleanup registration and execution
 * - Component-level memory tracking
 * - Performance memory optimization hints
 *
 * @author BassNotion Team
 * @version 1.0.0
 */

import React from 'react';

export interface MemoryUsageMetrics {
  heapUsed: number;
  heapTotal: number;
  heapLimit: number;
  external: number;
  arrayBuffers: number;
  timestamp: number;
}

export interface ComponentMemoryInfo {
  name: string;
  estimatedSize: number;
  createdAt: number;
  lastAccessed: number;
  cleanupCallbacks: (() => void)[];
}

export interface MemoryThresholds {
  warning: number; // MB - warn when exceeded
  critical: number; // MB - trigger cleanup when exceeded
  emergency: number; // MB - emergency cleanup when exceeded
}

export interface MemoryLeakAlert {
  type: 'growth_rate' | 'absolute_threshold' | 'component_leak';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  currentUsage: number;
  threshold: number;
  component?: string;
  timestamp: number;
}

/**
 * Comprehensive memory management system for widget components
 */
export class MemoryManager {
  private static instance: MemoryManager | null = null;

  private components = new Map<string, ComponentMemoryInfo>();
  private memoryHistory: MemoryUsageMetrics[] = [];
  private cleanupCallbacks = new Set<() => void>();
  private monitoringInterval: NodeJS.Timeout | null = null;

  private readonly thresholds: MemoryThresholds = {
    warning: 150, // 150MB warning threshold
    critical: 200, // 200MB critical threshold
    emergency: 250, // 250MB emergency threshold
  };

  private readonly maxHistorySize = 100; // Keep last 100 measurements
  private readonly monitoringIntervalMs = 5000; // Monitor every 5 seconds

  private constructor() {
    this.startMonitoring();
  }

  /**
   * Get singleton instance of MemoryManager
   */
  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Register a component for memory tracking
   */
  public registerComponent(
    name: string,
    estimatedSize = 0,
    cleanupCallback?: () => void,
  ): void {
    const now = Date.now();

    const componentInfo: ComponentMemoryInfo = {
      name,
      estimatedSize,
      createdAt: now,
      lastAccessed: now,
      cleanupCallbacks: cleanupCallback ? [cleanupCallback] : [],
    };

    this.components.set(name, componentInfo);

    // Log registration
    console.debug(
      `[MemoryManager] Registered component: ${name} (${estimatedSize}MB estimated)`,
    );
  }

  /**
   * Unregister a component and run its cleanup
   */
  public unregisterComponent(name: string): void {
    const component = this.components.get(name);
    if (!component) {
      console.warn(
        `[MemoryManager] Attempted to unregister unknown component: ${name}`,
      );
      return;
    }

    // Run cleanup callbacks
    component.cleanupCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error(
          `[MemoryManager] Error in cleanup callback for ${name}:`,
          error,
        );
      }
    });

    this.components.delete(name);
    console.debug(`[MemoryManager] Unregistered component: ${name}`);
  }

  /**
   * Add cleanup callback to existing component
   */
  public addCleanupCallback(name: string, callback: () => void): void {
    const component = this.components.get(name);
    if (component) {
      component.cleanupCallbacks.push(callback);
    } else {
      console.warn(
        `[MemoryManager] Cannot add cleanup to unknown component: ${name}`,
      );
    }
  }

  /**
   * Update component access time (for LRU cleanup)
   */
  public touchComponent(name: string): void {
    const component = this.components.get(name);
    if (component) {
      component.lastAccessed = Date.now();
    }
  }

  /**
   * Get current memory usage metrics
   */
  public getCurrentMemoryUsage(): MemoryUsageMetrics {
    const metrics: MemoryUsageMetrics = {
      heapUsed: 0,
      heapTotal: 0,
      heapLimit: 0,
      external: 0,
      arrayBuffers: 0,
      timestamp: Date.now(),
    };

    // Use performance.memory if available (Chrome/Edge)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      metrics.heapUsed = this.bytesToMB(memory.usedJSHeapSize || 0);
      metrics.heapTotal = this.bytesToMB(memory.totalJSHeapSize || 0);
      metrics.heapLimit = this.bytesToMB(memory.jsHeapSizeLimit || 0);
    } else {
      // Fallback estimation based on registered components
      metrics.heapUsed = this.estimateMemoryUsage();
      metrics.heapTotal = metrics.heapUsed * 1.2; // Estimate total as 120% of used
      metrics.heapLimit = 2048; // Assume 2GB limit
    }

    return metrics;
  }

  /**
   * Get memory usage history
   */
  public getMemoryHistory(): MemoryUsageMetrics[] {
    return [...this.memoryHistory];
  }

  /**
   * Check for memory leaks and return alerts
   */
  public checkForMemoryLeaks(): MemoryLeakAlert[] {
    const alerts: MemoryLeakAlert[] = [];
    const currentUsage = this.getCurrentMemoryUsage();

    // Check absolute thresholds
    if (currentUsage.heapUsed > this.thresholds.emergency) {
      alerts.push({
        type: 'absolute_threshold',
        severity: 'critical',
        message: `Emergency memory threshold exceeded: ${currentUsage.heapUsed.toFixed(1)}MB`,
        currentUsage: currentUsage.heapUsed,
        threshold: this.thresholds.emergency,
        timestamp: Date.now(),
      });
    } else if (currentUsage.heapUsed > this.thresholds.critical) {
      alerts.push({
        type: 'absolute_threshold',
        severity: 'high',
        message: `Critical memory threshold exceeded: ${currentUsage.heapUsed.toFixed(1)}MB`,
        currentUsage: currentUsage.heapUsed,
        threshold: this.thresholds.critical,
        timestamp: Date.now(),
      });
    } else if (currentUsage.heapUsed > this.thresholds.warning) {
      alerts.push({
        type: 'absolute_threshold',
        severity: 'medium',
        message: `Warning memory threshold exceeded: ${currentUsage.heapUsed.toFixed(1)}MB`,
        currentUsage: currentUsage.heapUsed,
        threshold: this.thresholds.warning,
        timestamp: Date.now(),
      });
    }

    // Check growth rate over last 10 measurements
    if (this.memoryHistory.length >= 10) {
      const recentHistory = this.memoryHistory.slice(-10);
      const oldestUsage = recentHistory[0]?.heapUsed ?? 0;
      const newestUsage =
        recentHistory[recentHistory.length - 1]?.heapUsed ?? 0;
      const timeDiff =
        (recentHistory[recentHistory.length - 1]?.timestamp ?? 0) -
        (recentHistory[0]?.timestamp ?? 0);

      if (timeDiff > 0) {
        const growthRate =
          (newestUsage - oldestUsage) / (timeDiff / 1000 / 60 / 60); // MB per hour

        if (growthRate > 10) {
          // More than 10MB growth per hour
          alerts.push({
            type: 'growth_rate',
            severity: 'high',
            message: `High memory growth rate detected: ${growthRate.toFixed(1)}MB/hour`,
            currentUsage: newestUsage,
            threshold: 10,
            timestamp: Date.now(),
          });
        } else if (growthRate > 5) {
          // More than 5MB growth per hour
          alerts.push({
            type: 'growth_rate',
            severity: 'medium',
            message: `Elevated memory growth rate: ${growthRate.toFixed(1)}MB/hour`,
            currentUsage: newestUsage,
            threshold: 5,
            timestamp: Date.now(),
          });
        }
      }
    }

    // Check for component-specific leaks (components that haven't been accessed in a while)
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes

    this.components.forEach((component, name) => {
      if (
        now - component.lastAccessed > staleThreshold &&
        component.estimatedSize > 10
      ) {
        alerts.push({
          type: 'component_leak',
          severity: 'medium',
          message: `Stale component detected: ${name} (${component.estimatedSize}MB, unused for ${Math.round((now - component.lastAccessed) / 60000)}min)`,
          currentUsage: component.estimatedSize,
          threshold: staleThreshold,
          component: name,
          timestamp: Date.now(),
        });
      }
    });

    return alerts;
  }

  /**
   * Trigger cleanup based on memory pressure
   */
  public triggerCleanup(force = false): void {
    const currentUsage = this.getCurrentMemoryUsage();

    if (force || currentUsage.heapUsed > this.thresholds.critical) {
      console.warn(
        `[MemoryManager] Triggering cleanup - Memory usage: ${currentUsage.heapUsed.toFixed(1)}MB`,
      );

      // Run global cleanup callbacks
      this.cleanupCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error(
            '[MemoryManager] Error in global cleanup callback:',
            error,
          );
        }
      });

      // Clean up stale components (LRU cleanup)
      if (currentUsage.heapUsed > this.thresholds.emergency) {
        this.cleanupStaleComponents();
      }

      // Suggest garbage collection
      this.suggestGarbageCollection();
    }
  }

  /**
   * Register global cleanup callback
   */
  public registerGlobalCleanup(callback: () => void): void {
    this.cleanupCallbacks.add(callback);
  }

  /**
   * Unregister global cleanup callback
   */
  public unregisterGlobalCleanup(callback: () => void): void {
    this.cleanupCallbacks.delete(callback);
  }

  /**
   * Get memory report
   */
  public generateMemoryReport(): string {
    const currentUsage = this.getCurrentMemoryUsage();
    const alerts = this.checkForMemoryLeaks();

    let report = `
# Memory Usage Report
Generated: ${new Date().toISOString()}

## Current Usage
- Heap Used: ${currentUsage.heapUsed.toFixed(1)}MB
- Heap Total: ${currentUsage.heapTotal.toFixed(1)}MB
- Heap Limit: ${currentUsage.heapLimit.toFixed(1)}MB
- External: ${currentUsage.external.toFixed(1)}MB
- Array Buffers: ${currentUsage.arrayBuffers.toFixed(1)}MB

## Thresholds
- Warning: ${this.thresholds.warning}MB
- Critical: ${this.thresholds.critical}MB
- Emergency: ${this.thresholds.emergency}MB

## Registered Components (${this.components.size})
`;

    this.components.forEach((component, name) => {
      const ageMinutes = Math.round((Date.now() - component.createdAt) / 60000);
      const lastAccessMinutes = Math.round(
        (Date.now() - component.lastAccessed) / 60000,
      );
      report += `- ${name}: ${component.estimatedSize}MB (age: ${ageMinutes}min, last access: ${lastAccessMinutes}min)\n`;
    });

    if (alerts.length > 0) {
      report += `\n## Alerts (${alerts.length})\n`;
      alerts.forEach((alert) => {
        report += `- [${alert.severity.toUpperCase()}] ${alert.message}\n`;
      });
    } else {
      report += '\n## Alerts\nNo memory alerts detected.\n';
    }

    return report;
  }

  /**
   * Start memory monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    this.monitoringInterval = setInterval(() => {
      const usage = this.getCurrentMemoryUsage();
      this.memoryHistory.push(usage);

      // Keep history size manageable
      if (this.memoryHistory.length > this.maxHistorySize) {
        this.memoryHistory.shift();
      }

      // Check for alerts
      const alerts = this.checkForMemoryLeaks();
      alerts.forEach((alert) => {
        if (alert.severity === 'critical' || alert.severity === 'high') {
          console.warn('[MemoryManager] Memory Alert:', alert.message);
        }
      });

      // Auto-trigger cleanup if critical
      if (usage.heapUsed > this.thresholds.critical) {
        this.triggerCleanup();
      }
    }, this.monitoringIntervalMs);
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
   * Clean up stale components using LRU strategy
   */
  private cleanupStaleComponents(): void {
    const now = Date.now();
    const componentsToCleanup: [string, ComponentMemoryInfo][] = [];

    // Find components that haven't been accessed recently
    this.components.forEach((component, name) => {
      const timeSinceAccess = now - component.lastAccessed;
      if (timeSinceAccess > 5 * 60 * 1000) {
        // 5 minutes
        componentsToCleanup.push([name, component]);
      }
    });

    // Sort by last access time (oldest first)
    componentsToCleanup.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    // Clean up oldest components first
    const maxCleanup = Math.min(componentsToCleanup.length, 3); // Clean up max 3 components
    for (let i = 0; i < maxCleanup; i++) {
      const [name] = componentsToCleanup[i] ?? [];
      if (name) {
        console.warn(`[MemoryManager] Auto-cleaning stale component: ${name}`);
        this.unregisterComponent(name);
      }
    }
  }

  /**
   * Estimate memory usage based on registered components
   */
  private estimateMemoryUsage(): number {
    let totalEstimate = 50; // Base app memory estimate

    this.components.forEach((component) => {
      totalEstimate += component.estimatedSize;
    });

    return totalEstimate;
  }

  /**
   * Convert bytes to megabytes
   */
  private bytesToMB(bytes: number): number {
    return bytes / (1024 * 1024);
  }

  /**
   * Suggest garbage collection (browser-dependent)
   */
  private suggestGarbageCollection(): void {
    // Force garbage collection if available (development/debugging)
    if (typeof window !== 'undefined' && (window as any).gc) {
      try {
        (window as any).gc();
        console.debug('[MemoryManager] Triggered garbage collection');
      } catch {
        // Ignore errors - GC not available
      }
    }

    // Log memory usage for debugging
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      console.debug('[MemoryManager] Memory after cleanup:', {
        used: this.bytesToMB(memory.usedJSHeapSize).toFixed(1) + 'MB',
        total: this.bytesToMB(memory.totalJSHeapSize).toFixed(1) + 'MB',
      });
    }
  }

  /**
   * Destroy the memory manager instance
   */
  public destroy(): void {
    this.stopMonitoring();

    // Clean up all components
    this.components.forEach((_, name) => {
      this.unregisterComponent(name);
    });

    this.components.clear();
    this.cleanupCallbacks.clear();
    this.memoryHistory.length = 0;

    MemoryManager.instance = null;
  }
}

/**
 * Memory management hook for React components
 */
export function useMemoryManager(componentName: string, estimatedSize = 1) {
  const memoryManager = MemoryManager.getInstance();

  // Register component on mount
  React.useEffect(() => {
    memoryManager.registerComponent(componentName, estimatedSize);

    return () => {
      memoryManager.unregisterComponent(componentName);
    };
  }, [componentName, estimatedSize, memoryManager]);

  // Touch component on each render (activity tracking)
  React.useEffect(() => {
    memoryManager.touchComponent(componentName);
  });

  return {
    addCleanupCallback: (callback: () => void) =>
      memoryManager.addCleanupCallback(componentName, callback),
    triggerCleanup: () => memoryManager.triggerCleanup(),
    getMemoryUsage: () => memoryManager.getCurrentMemoryUsage(),
  };
}

// Export singleton instance for direct access
export const memoryManager = MemoryManager.getInstance();
