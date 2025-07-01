/**
 * Bundle Optimizer for Widget Components
 *
 * Provides comprehensive bundle optimization including:
 * - Code splitting for widget components
 * - Lazy loading for non-critical features
 * - Asset optimization and preloading
 * - Bundle size monitoring and analysis
 * - Dynamic import management
 */

export interface BundleMetrics {
  totalBundleSize: number; // bytes
  chunkSizes: Map<string, number>;
  loadedChunks: Set<string>;
  pendingChunks: Set<string>;
  failedChunks: Set<string>;
  cacheHitRate: number; // percentage
  compressionRatio: number; // gzip ratio
  timestamp: number;
}

export interface ChunkInfo {
  name: string;
  size: number;
  dependencies: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  preload: boolean;
  loaded: boolean;
  loadTime?: number;
  error?: Error;
}

export interface AssetOptimizationConfig {
  enableLazyLoading: boolean;
  enablePreloading: boolean;
  enableCompression: boolean;
  maxChunkSize: number; // bytes
  preloadThreshold: number; // ms
  cacheStrategy: 'aggressive' | 'balanced' | 'conservative';
  compressionLevel: number; // 1-9
}

export interface LazyLoadableComponent {
  componentName: string;
  importPath: string;
  preloadCondition?: () => boolean;
  fallbackComponent?: React.ComponentType;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export class BundleOptimizer {
  private static instance: BundleOptimizer | null = null;

  private chunkRegistry = new Map<string, ChunkInfo>();
  private loadedComponents = new Map<string, any>();
  private pendingLoads = new Map<string, Promise<any>>();
  private metricsHistory: BundleMetrics[] = [];
  private config: AssetOptimizationConfig;

  private readonly maxHistorySize = 50;
  private metricsTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.initializeBundleMonitoring();
    this.setupPerformanceObserver();
    this.startMetricsCollection();

    console.debug('[BundleOptimizer] Initialized with config:', this.config);
  }

  public static getInstance(): BundleOptimizer {
    if (!BundleOptimizer.instance) {
      BundleOptimizer.instance = new BundleOptimizer();
    }
    return BundleOptimizer.instance;
  }

  /**
   * Get default optimization configuration
   */
  private getDefaultConfig(): AssetOptimizationConfig {
    return {
      enableLazyLoading: true,
      enablePreloading: true,
      enableCompression: true,
      maxChunkSize: 250 * 1024, // 250KB
      preloadThreshold: 2000, // 2 seconds
      cacheStrategy: 'balanced',
      compressionLevel: 6,
    };
  }

  /**
   * Initialize bundle monitoring
   */
  private initializeBundleMonitoring(): void {
    // Monitor bundle loading events
    if (typeof window !== 'undefined' && 'performance' in window) {
      // Track resource loading
      this.trackResourceLoading();
    }
  }

  /**
   * Setup performance observer for bundle metrics
   */
  private setupPerformanceObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (
            entry.entryType === 'navigation' ||
            entry.entryType === 'resource'
          ) {
            this.processPerformanceEntry(entry);
          }
        });
      });

      observer.observe({ entryTypes: ['navigation', 'resource'] });
    } catch (error) {
      console.debug(
        '[BundleOptimizer] PerformanceObserver not available:',
        error,
      );
    }
  }

  /**
   * Process performance entry for bundle metrics
   */
  private processPerformanceEntry(entry: PerformanceEntry): void {
    if (entry.name.includes('.js') || entry.name.includes('.ts')) {
      const chunkName = this.extractChunkName(entry.name);
      const existingChunk = this.chunkRegistry.get(chunkName);

      if (existingChunk) {
        existingChunk.loadTime = entry.duration;
        existingChunk.loaded = true;

        console.debug(
          `[BundleOptimizer] Chunk loaded: ${chunkName} (${entry.duration.toFixed(1)}ms)`,
        );
      }
    }
  }

  /**
   * Extract chunk name from resource URL
   */
  private extractChunkName(url: string): string {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    if (!filename) {
      return 'unknown-chunk';
    }
    return filename.split('.')[0] || 'unknown-chunk';
  }

  /**
   * Track resource loading for bundle analysis
   */
  private trackResourceLoading(): void {
    // Check for fetch availability in both browser and test environments
    const globalObj = typeof window !== 'undefined' ? window : globalThis;
    if (!globalObj) return;

    // Store reference to original fetch if it exists
    const originalFetch = globalObj.fetch;
    if (!originalFetch) return;

    // Override fetch to track dynamic imports
    globalObj.fetch = async (...args) => {
      const response = await originalFetch.apply(globalObj, args);

      if (args[0] && typeof args[0] === 'string' && args[0].includes('.js')) {
        this.trackChunkLoad(
          args[0],
          response.headers?.get?.('content-length') || '0',
        );
      }

      return response;
    };
  }

  /**
   * Track chunk loading
   */
  private trackChunkLoad(url: string, sizeHeader: string): void {
    const chunkName = this.extractChunkName(url);
    const size = parseInt(sizeHeader, 10) || 0;

    if (!this.chunkRegistry.has(chunkName)) {
      this.chunkRegistry.set(chunkName, {
        name: chunkName,
        size,
        dependencies: [],
        priority: 'medium',
        preload: false,
        loaded: false,
      });
    }

    console.debug(
      `[BundleOptimizer] Tracked chunk: ${chunkName} (${size} bytes)`,
    );
  }

  /**
   * Register a lazy loadable component
   */
  public registerLazyComponent(component: LazyLoadableComponent): void {
    const chunkInfo: ChunkInfo = {
      name: component.componentName,
      size: 0, // Will be updated when loaded
      dependencies: [],
      priority: component.priority,
      preload: component.preloadCondition?.() || false,
      loaded: false,
    };

    this.chunkRegistry.set(component.componentName, chunkInfo);

    console.debug(
      `[BundleOptimizer] Registered lazy component: ${component.componentName} (priority: ${component.priority})`,
    );
  }

  /**
   * Lazy load a component with optimization
   */
  public async lazyLoadComponent<T = any>(
    componentName: string,
    importFn: () => Promise<{ default: T }>,
    options: {
      preload?: boolean;
      priority?: 'critical' | 'high' | 'medium' | 'low';
      timeout?: number;
    } = {},
  ): Promise<T> {
    const { preload = false, priority = 'medium', timeout = 10000 } = options;

    // Check if already loaded
    if (this.loadedComponents.has(componentName)) {
      return this.loadedComponents.get(componentName);
    }

    // Check if loading is in progress
    if (this.pendingLoads.has(componentName)) {
      return this.pendingLoads.get(componentName);
    }

    // Create loading promise with timeout
    const loadPromise = this.createLoadPromise(
      componentName,
      importFn,
      timeout,
    );
    this.pendingLoads.set(componentName, loadPromise);

    // Update chunk info
    const chunkInfo = this.chunkRegistry.get(componentName);
    if (chunkInfo) {
      chunkInfo.priority = priority;
      chunkInfo.preload = preload;
    }

    try {
      const startTime = performance.now();
      const component = await loadPromise;
      const loadTime = performance.now() - startTime;

      // Update metrics
      if (chunkInfo) {
        chunkInfo.loaded = true;
        chunkInfo.loadTime = loadTime;
      }

      // Cache the component
      this.loadedComponents.set(componentName, component);
      this.pendingLoads.delete(componentName);

      console.debug(
        `[BundleOptimizer] Lazy loaded: ${componentName} (${loadTime.toFixed(1)}ms)`,
      );
      return component;
    } catch (error) {
      this.pendingLoads.delete(componentName);

      // Update error info
      if (chunkInfo) {
        chunkInfo.error = error as Error;
      }

      console.error(
        `[BundleOptimizer] Failed to load component: ${componentName}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Create load promise with timeout
   */
  private createLoadPromise<T>(
    componentName: string,
    importFn: () => Promise<{ default: T }>,
    timeout: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Component load timeout: ${componentName}`));
      }, timeout);

      importFn()
        .then((module) => {
          clearTimeout(timeoutId);
          resolve(module.default);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Preload critical components
   */
  public async preloadCriticalComponents(): Promise<void> {
    const criticalChunks = Array.from(this.chunkRegistry.values())
      .filter((chunk) => chunk.priority === 'critical' || chunk.preload)
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    console.debug(
      `[BundleOptimizer] Preloading ${criticalChunks.length} critical components`,
    );

    const preloadPromises = criticalChunks.map(async (chunk) => {
      try {
        // Use link rel="modulepreload" for better performance
        this.preloadModule(chunk.name);
      } catch (error) {
        console.warn(
          `[BundleOptimizer] Failed to preload: ${chunk.name}`,
          error,
        );
      }
    });

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Preload module using link rel="modulepreload"
   */
  private preloadModule(chunkName: string): void {
    if (typeof document === 'undefined') return;

    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = this.getChunkUrl(chunkName);
    link.crossOrigin = 'anonymous';

    link.onload = () => {
      console.debug(`[BundleOptimizer] Preloaded module: ${chunkName}`);
    };

    link.onerror = () => {
      console.warn(`[BundleOptimizer] Failed to preload module: ${chunkName}`);
    };

    document.head.appendChild(link);
  }

  /**
   * Get chunk URL for preloading
   */
  private getChunkUrl(chunkName: string): string {
    // This would be configured based on your build system
    return `/_next/static/chunks/${chunkName}.js`;
  }

  /**
   * Get current bundle metrics
   */
  public getCurrentMetrics(): BundleMetrics {
    const chunks = Array.from(this.chunkRegistry.values());
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const loadedChunks = new Set(
      chunks.filter((c) => c.loaded).map((c) => c.name),
    );
    const pendingChunks = new Set(this.pendingLoads.keys());
    const failedChunks = new Set(
      chunks.filter((c) => c.error).map((c) => c.name),
    );

    return {
      totalBundleSize: totalSize,
      chunkSizes: new Map(chunks.map((c) => [c.name, c.size])),
      loadedChunks,
      pendingChunks,
      failedChunks,
      cacheHitRate: this.calculateCacheHitRate(),
      compressionRatio: this.estimateCompressionRatio(),
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const totalRequests = this.loadedComponents.size + this.pendingLoads.size;
    if (totalRequests === 0) return 100;

    const cacheHits = this.loadedComponents.size;
    return (cacheHits / totalRequests) * 100;
  }

  /**
   * Estimate compression ratio
   */
  private estimateCompressionRatio(): number {
    // Typical gzip compression ratio for JavaScript
    return 0.3; // 30% of original size
  }

  /**
   * Optimize bundle loading based on usage patterns
   */
  public optimizeBundleLoading(): void {
    const metrics = this.getCurrentMetrics();

    // Analyze loading patterns
    const slowChunks = Array.from(this.chunkRegistry.values()).filter(
      (chunk) =>
        chunk.loadTime && chunk.loadTime > this.config.preloadThreshold,
    );

    if (slowChunks.length > 0) {
      console.debug(
        `[BundleOptimizer] Found ${slowChunks.length} slow-loading chunks`,
      );

      // Mark slow chunks for preloading
      slowChunks.forEach((chunk) => {
        if (chunk.priority !== 'low') {
          chunk.preload = true;
          console.debug(`[BundleOptimizer] Marked for preload: ${chunk.name}`);
        }
      });
    }

    // Check bundle size warnings
    if (metrics.totalBundleSize > this.config.maxChunkSize * 10) {
      console.warn(
        `[BundleOptimizer] Large bundle size detected: ${(metrics.totalBundleSize / 1024).toFixed(1)}KB`,
      );
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      const metrics = this.getCurrentMetrics();
      this.metricsHistory.push(metrics);

      // Keep history size manageable
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }

      // Auto-optimize based on metrics
      this.optimizeBundleLoading();
    }, 10000); // Collect metrics every 10 seconds
  }

  /**
   * Generate bundle optimization report
   */
  public generateOptimizationReport(): string {
    const metrics = this.getCurrentMetrics();
    const chunks = Array.from(this.chunkRegistry.values());
    const avgLoadTime =
      chunks
        .filter((c) => c.loadTime)
        .reduce((sum, c) => sum + (c.loadTime || 0), 0) /
      chunks.filter((c) => c.loadTime).length;

    return `
# Bundle Optimization Report
Generated: ${new Date().toISOString()}

## Bundle Metrics
- Total Bundle Size: ${(metrics.totalBundleSize / 1024).toFixed(1)}KB
- Loaded Chunks: ${metrics.loadedChunks.size}
- Pending Chunks: ${metrics.pendingChunks.size}
- Failed Chunks: ${metrics.failedChunks.size}
- Cache Hit Rate: ${metrics.cacheHitRate.toFixed(1)}%
- Compression Ratio: ${(metrics.compressionRatio * 100).toFixed(1)}%

## Performance Analysis
- Average Load Time: ${avgLoadTime ? avgLoadTime.toFixed(1) : 'N/A'}ms
- Slow Chunks (>${this.config.preloadThreshold}ms): ${chunks.filter((c) => c.loadTime && c.loadTime > this.config.preloadThreshold).length}

## Chunk Details
${chunks
  .map(
    (chunk) =>
      `- ${chunk.name}: ${chunk.size ? (chunk.size / 1024).toFixed(1) : '?'}KB (${chunk.priority}) ${chunk.loaded ? '✅' : chunk.error ? '❌' : '⏳'}`,
  )
  .join('\n')}

## Optimization Recommendations
${this.generateOptimizationRecommendations(metrics, chunks).join('\n')}

## Configuration
- Lazy Loading: ${this.config.enableLazyLoading ? 'Enabled' : 'Disabled'}
- Preloading: ${this.config.enablePreloading ? 'Enabled' : 'Disabled'}
- Max Chunk Size: ${(this.config.maxChunkSize / 1024).toFixed(1)}KB
- Cache Strategy: ${this.config.cacheStrategy}
`;
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizationRecommendations(
    metrics: BundleMetrics,
    chunks: ChunkInfo[],
  ): string[] {
    const recommendations: string[] = [];

    // Bundle size recommendations
    if (metrics.totalBundleSize > this.config.maxChunkSize * 8) {
      recommendations.push('⚠️ Consider code splitting for large chunks');
    }

    // Cache recommendations
    if (metrics.cacheHitRate < 80) {
      recommendations.push(
        '⚠️ Low cache hit rate - consider preloading critical components',
      );
    }

    // Loading time recommendations
    const slowChunks = chunks.filter(
      (c) => c.loadTime && c.loadTime > this.config.preloadThreshold,
    );
    if (slowChunks.length > 0) {
      recommendations.push(
        `⚠️ ${slowChunks.length} slow-loading chunks detected - enable preloading`,
      );
    }

    // Failed chunks
    if (metrics.failedChunks.size > 0) {
      recommendations.push(
        `❌ ${metrics.failedChunks.size} failed chunks - check network connectivity`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Bundle optimization is performing well');
    }

    return recommendations;
  }

  /**
   * Update optimization configuration
   */
  public updateConfig(newConfig: Partial<AssetOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.debug('[BundleOptimizer] Configuration updated:', this.config);
  }

  /**
   * Get metrics history
   */
  public getMetricsHistory(): BundleMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get chunk registry
   */
  public getChunkRegistry(): Map<string, ChunkInfo> {
    return this.chunkRegistry;
  }

  /**
   * Simulate resource tracking for testing
   */
  public simulateResourceLoad(url: string, contentLength = '1024'): void {
    this.trackChunkLoad(url, contentLength);
  }

  /**
   * Destroy the bundle optimizer
   */
  public destroy(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    this.chunkRegistry.clear();
    this.loadedComponents.clear();
    this.pendingLoads.clear();
    this.metricsHistory.length = 0;

    BundleOptimizer.instance = null;

    console.debug('[BundleOptimizer] Destroyed');
  }
}

// Export singleton instance for direct access
export const bundleOptimizer = BundleOptimizer.getInstance();
