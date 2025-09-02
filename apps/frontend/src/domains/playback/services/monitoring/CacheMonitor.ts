/**
 * CacheMonitor - Tracks and measures sample cache usage
 * Provides detailed metrics on cache hits, misses, and performance
 */

import { GlobalSampleCache } from '../storage/GlobalSampleCache.js';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface LoadEvent {
  url: string;
  timestamp: number;
  fromCache: boolean;
  loadTime: number;
  plugin?: string;
  layer?: string;
  context?: string;
}

interface CacheMetrics {
  totalLoads: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  averageLoadTime: {
    cached: number;
    network: number;
  };
  byPlugin: Record<
    string,
    {
      loads: number;
      hits: number;
      misses: number;
      hitRate: number;
    }
  >;
  recentLoads: LoadEvent[];
}

export class CacheMonitor {
  private static instance: CacheMonitor | null = null;
  private loadEvents: LoadEvent[] = [];
  private maxRecentLoads = 100;

  private constructor() {
    logger.info('🔍 CacheMonitor initialized');
  }

  static getInstance(): CacheMonitor {
    if (!CacheMonitor.instance) {
      CacheMonitor.instance = new CacheMonitor();
    }
    return CacheMonitor.instance;
  }

  /**
   * Record a sample load event
   */
  recordLoad(event: Omit<LoadEvent, 'timestamp'>): void {
    const fullEvent: LoadEvent = {
      ...event,
      timestamp: performance.now(),
    };

    this.loadEvents.push(fullEvent);

    // Keep only recent events in memory
    if (this.loadEvents.length > 1000) {
      this.loadEvents = this.loadEvents.slice(-500);
    }

    // Log significant events
    if (event.fromCache) {
      logger.info(
        `📊 Cache HIT: ${event.url} (${event.loadTime.toFixed(2)}ms)${event.plugin ? ` [${event.plugin}]` : ''}`,
      );
    } else {
      logger.warn(
        `📊 Cache MISS: ${event.url} (${event.loadTime.toFixed(2)}ms)${event.plugin ? ` [${event.plugin}]` : ''}`,
      );
    }
  }

  /**
   * Get comprehensive cache metrics
   */
  getMetrics(): CacheMetrics {
    const totalLoads = this.loadEvents.length;
    const cacheHits = this.loadEvents.filter((e) => e.fromCache).length;
    const cacheMisses = totalLoads - cacheHits;
    const hitRate = totalLoads > 0 ? cacheHits / totalLoads : 0;

    // Calculate average load times
    const cachedLoads = this.loadEvents.filter((e) => e.fromCache);
    const networkLoads = this.loadEvents.filter((e) => !e.fromCache);

    const averageLoadTime = {
      cached:
        cachedLoads.length > 0
          ? cachedLoads.reduce((sum, e) => sum + e.loadTime, 0) /
            cachedLoads.length
          : 0,
      network:
        networkLoads.length > 0
          ? networkLoads.reduce((sum, e) => sum + e.loadTime, 0) /
            networkLoads.length
          : 0,
    };

    // Group by plugin
    const byPlugin: Record<string, any> = {};
    this.loadEvents.forEach((event) => {
      const plugin = event.plugin || 'unknown';
      if (!byPlugin[plugin]) {
        byPlugin[plugin] = { loads: 0, hits: 0, misses: 0, hitRate: 0 };
      }
      byPlugin[plugin].loads++;
      if (event.fromCache) {
        byPlugin[plugin].hits++;
      } else {
        byPlugin[plugin].misses++;
      }
    });

    // Calculate hit rates per plugin
    Object.keys(byPlugin).forEach((plugin) => {
      const stats = byPlugin[plugin];
      stats.hitRate = stats.loads > 0 ? stats.hits / stats.loads : 0;
    });

    // Get recent loads
    const recentLoads = this.loadEvents.slice(-this.maxRecentLoads);

    return {
      totalLoads,
      cacheHits,
      cacheMisses,
      hitRate,
      averageLoadTime,
      byPlugin,
      recentLoads,
    };
  }

  /**
   * Print a formatted report to console
   */
  printReport(): void {
    const metrics = this.getMetrics();
    const globalStats = GlobalSampleCache.getCacheStats();

    console.group('📊 Cache Performance Report');

    logger.info(`Total Loads: ${metrics.totalLoads}`);
    logger.info(
      `Cache Hits: ${metrics.cacheHits} (${(metrics.hitRate * 100).toFixed(1)}%)`,
    );
    logger.info(`Cache Misses: ${metrics.cacheMisses}`);
    logger.info(
      `Average Load Time - Cached: ${metrics.averageLoadTime.cached.toFixed(2)}ms`,
    );
    logger.info(
      `Average Load Time - Network: ${metrics.averageLoadTime.network.toFixed(2)}ms`,
    );
    logger.info(
      `Speed Improvement: ${
        metrics.averageLoadTime.network > 0
          ? (
              metrics.averageLoadTime.network / metrics.averageLoadTime.cached
            ).toFixed(1) + 'x faster'
          : 'N/A'
      }`,
    );

    console.group('By Plugin:');
    Object.entries(metrics.byPlugin).forEach(([plugin, stats]) => {
      logger.info(
        `${plugin}: ${stats.loads} loads, ${(stats.hitRate * 100).toFixed(1)}% hit rate`,
      );
    });
    console.groupEnd();

    console.group('Global Cache Stats:');
    logger.info(`Total URLs in cache: ${globalStats.urlCount}`);
    logger.info(`Total buffers cached: ${globalStats.bufferCount}`);
    logger.info(
      `Cache memory: ~${(globalStats.bufferCount * 0.5).toFixed(1)}MB (estimated)`,
    );
    console.groupEnd();

    console.groupEnd();
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.loadEvents = [];
    logger.info('🔍 CacheMonitor metrics reset');
  }

  /**
   * Get load events for a specific plugin
   */
  getPluginEvents(plugin: string): LoadEvent[] {
    return this.loadEvents.filter((e) => e.plugin === plugin);
  }

  /**
   * Check if a specific URL has been loaded from cache
   */
  wasLoadedFromCache(url: string): boolean {
    const events = this.loadEvents.filter((e) => e.url === url);
    return events.some((e) => e.fromCache);
  }

  /**
   * Get cache performance summary as a string
   */
  getSummary(): string {
    const metrics = this.getMetrics();
    return (
      `Cache Performance: ${(metrics.hitRate * 100).toFixed(1)}% hit rate | ` +
      `${metrics.cacheHits} hits, ${metrics.cacheMisses} misses | ` +
      `Cached: ${metrics.averageLoadTime.cached.toFixed(0)}ms, Network: ${metrics.averageLoadTime.network.toFixed(0)}ms`
    );
  }
}

// Export singleton instance
export const cacheMonitor = CacheMonitor.getInstance();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).cacheMonitor = cacheMonitor;
  logger.info('📊 Cache monitor available at window.cacheMonitor');
  logger.info('   - window.cacheMonitor.printReport() - Show full report');
  logger.info('   - window.cacheMonitor.getSummary() - Get summary');
  logger.info('   - window.cacheMonitor.getMetrics() - Get raw metrics');
}
