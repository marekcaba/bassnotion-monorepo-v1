/**
 * Audio Buffer Management System for Widget Components
 *
 * Provides efficient audio buffer management, preloading, and optimization
 * for the BassNotion widget ecosystem to achieve <50ms latency targets.
 *
 * Features:
 * - Intelligent buffer preloading and caching
 * - Dynamic buffer size optimization based on device capabilities
 * - Memory-efficient buffer pooling and reuse
 * - Latency monitoring and optimization
 * - Audio context management and cleanup
 *
 * @author BassNotion Team
 * @version 1.0.0
 */

export interface AudioBufferConfig {
  sampleRate: number;
  bufferSize: number;
  channels: number;
  latencyHint: AudioContextLatencyCategory;
}

export interface AudioBufferMetrics {
  latency: number;
  bufferUnderruns: number;
  dropouts: number;
  cpuUsage: number;
  memoryUsage: number;
  timestamp: number;
}

export interface AudioAssetInfo {
  name: string;
  url: string;
  buffer?: AudioBuffer;
  loadTime?: number;
  lastAccessed: number;
  priority: 'high' | 'medium' | 'low';
  preload: boolean;
}

export interface DeviceAudioProfile {
  isLowEnd: boolean;
  recommendedBufferSize: number;
  maxConcurrentSounds: number;
  supportsWebAudio: boolean;
  supportsAudioWorklet: boolean;
  latencyCapability: 'low' | 'medium' | 'high';
}

/**
 * Comprehensive audio buffer management system
 */
export class AudioBufferManager {
  private static instance: AudioBufferManager | null = null;

  private audioContext: AudioContext | null = null;
  private audioAssets = new Map<string, AudioAssetInfo>();
  private bufferPool = new Map<string, AudioBuffer[]>();
  private metricsHistory: AudioBufferMetrics[] = [];
  private deviceProfile: DeviceAudioProfile | null = null;

  private readonly maxPoolSize = 10; // Maximum buffers per type in pool
  private readonly maxHistorySize = 50; // Keep last 50 measurements
  private readonly cleanupInterval = 30000; // Cleanup every 30 seconds

  private cleanupTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeAudioContext();
    this.profileDevice();
    this.startMetricsCollection();
    this.startPeriodicCleanup();
  }

  /**
   * Get singleton instance of AudioBufferManager
   */
  public static getInstance(): AudioBufferManager {
    if (!AudioBufferManager.instance) {
      AudioBufferManager.instance = new AudioBufferManager();
    }
    return AudioBufferManager.instance;
  }

  /**
   * Initialize audio context with optimal settings
   */
  private async initializeAudioContext(): Promise<void> {
    // Check for AudioContext in both global and window scope (for test environments)
    const AudioContextConstructor =
      (typeof window !== 'undefined' && window.AudioContext) ||
      (typeof AudioContext !== 'undefined' && AudioContext);

    if (!AudioContextConstructor) {
      console.warn('[AudioBufferManager] Web Audio API not available');
      return;
    }

    try {
      const config = this.getOptimalAudioConfig();

      this.audioContext = new AudioContextConstructor({
        latencyHint: config.latencyHint,
        sampleRate: config.sampleRate,
      });

      // Resume context if suspended (required for user interaction policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.debug('[AudioBufferManager] Audio context initialized:', {
        sampleRate: this.audioContext.sampleRate,
        state: this.audioContext.state,
        baseLatency: this.audioContext.baseLatency,
        outputLatency: this.audioContext.outputLatency,
      });
    } catch (error) {
      console.error(
        '[AudioBufferManager] Failed to initialize audio context:',
        error,
      );
    }
  }

  /**
   * Profile device capabilities for audio optimization
   */
  private profileDevice(): void {
    const isLowEnd = this.detectLowEndDevice();

    this.deviceProfile = {
      isLowEnd,
      recommendedBufferSize: isLowEnd ? 512 : 256,
      maxConcurrentSounds: isLowEnd ? 8 : 16,
      supportsWebAudio: typeof AudioContext !== 'undefined',
      supportsAudioWorklet: typeof AudioWorkletNode !== 'undefined',
      latencyCapability: isLowEnd ? 'high' : 'low',
    };

    console.debug('[AudioBufferManager] Device profile:', this.deviceProfile);
  }

  /**
   * Detect if device is low-end based on various heuristics
   */
  private detectLowEndDevice(): boolean {
    // Check memory (if available)
    if (typeof navigator !== 'undefined' && (navigator as any).deviceMemory) {
      return (navigator as any).deviceMemory < 4; // Less than 4GB RAM
    }

    // Check CPU cores (if available)
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      return navigator.hardwareConcurrency < 4; // Less than 4 CPU cores
    }

    // Fallback to user agent detection
    const userAgent = navigator.userAgent.toLowerCase();
    const lowEndPatterns = [
      /android.*4\./,
      /iphone.*os [89]_/,
      /ipad.*os [89]_/,
      /windows phone/,
      /blackberry/,
    ];

    return lowEndPatterns.some((pattern) => pattern.test(userAgent));
  }

  /**
   * Get optimal audio configuration based on device profile
   */
  private getOptimalAudioConfig(): AudioBufferConfig {
    const profile = this.deviceProfile;

    return {
      sampleRate: 44100, // Standard sample rate
      bufferSize: profile?.recommendedBufferSize ?? 256,
      channels: 2, // Stereo
      latencyHint:
        profile?.latencyCapability === 'low' ? 'interactive' : 'balanced',
    };
  }

  /**
   * Register audio asset for management
   */
  public registerAudioAsset(
    name: string,
    url: string,
    priority: 'high' | 'medium' | 'low' = 'medium',
    preload = false,
  ): void {
    const assetInfo: AudioAssetInfo = {
      name,
      url,
      lastAccessed: Date.now(),
      priority,
      preload,
    };

    this.audioAssets.set(name, assetInfo);

    if (preload) {
      this.preloadAsset(name);
    }

    console.debug(
      `[AudioBufferManager] Registered asset: ${name} (priority: ${priority}, preload: ${preload})`,
    );
  }

  /**
   * Preload audio asset
   */
  public async preloadAsset(name: string): Promise<AudioBuffer | null> {
    const asset = this.audioAssets.get(name);
    if (!asset) {
      console.warn(`[AudioBufferManager] Asset not found: ${name}`);
      return null;
    }

    if (asset.buffer) {
      return asset.buffer; // Already loaded
    }

    if (!this.audioContext) {
      console.warn('[AudioBufferManager] Audio context not available');
      return null;
    }

    try {
      const startTime = performance.now();

      const response = await fetch(asset.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const loadTime = performance.now() - startTime;

      asset.buffer = audioBuffer;
      asset.loadTime = loadTime;
      asset.lastAccessed = Date.now();

      console.debug(
        `[AudioBufferManager] Preloaded asset: ${name} (${loadTime.toFixed(1)}ms)`,
      );

      return audioBuffer;
    } catch (error) {
      console.error(
        `[AudioBufferManager] Failed to preload asset: ${name}`,
        error,
      );
      return null;
    }
  }

  /**
   * Get audio buffer (load if not cached)
   */
  public async getAudioBuffer(name: string): Promise<AudioBuffer | null> {
    const asset = this.audioAssets.get(name);
    if (!asset) {
      console.warn(`[AudioBufferManager] Asset not found: ${name}`);
      return null;
    }

    asset.lastAccessed = Date.now();

    if (asset.buffer) {
      return asset.buffer;
    }

    // Load on demand
    return await this.preloadAsset(name);
  }

  /**
   * Get pooled audio buffer (for efficient reuse)
   */
  public getPooledBuffer(
    type: string,
    createFn: () => AudioBuffer,
  ): AudioBuffer {
    const pool = this.bufferPool.get(type) ?? [];

    if (pool.length > 0) {
      const buffer = pool.pop();
      if (buffer) {
        return buffer;
      }
    }

    // Create new buffer if pool is empty
    return createFn();
  }

  /**
   * Return buffer to pool for reuse
   */
  public returnToPool(type: string, buffer: AudioBuffer): void {
    const pool = this.bufferPool.get(type) ?? [];

    if (pool.length < this.maxPoolSize) {
      pool.push(buffer);
      this.bufferPool.set(type, pool);
    }
    // Discard if pool is full
  }

  /**
   * Preload multiple assets in parallel
   */
  public async preloadAssets(assetNames: string[]): Promise<void> {
    const preloadPromises = assetNames.map((name) => this.preloadAsset(name));

    try {
      await Promise.allSettled(preloadPromises);
      console.debug(
        `[AudioBufferManager] Preloaded ${assetNames.length} assets`,
      );
    } catch (error) {
      console.error('[AudioBufferManager] Error during batch preload:', error);
    }
  }

  /**
   * Get current audio metrics
   */
  public getCurrentMetrics(): AudioBufferMetrics {
    const metrics: AudioBufferMetrics = {
      latency: this.calculateLatency(),
      bufferUnderruns: 0, // Would be tracked by audio worklet
      dropouts: 0, // Would be tracked by audio worklet
      cpuUsage: this.estimateCpuUsage(),
      memoryUsage: this.calculateMemoryUsage(),
      timestamp: Date.now(),
    };

    return metrics;
  }

  /**
   * Calculate current audio latency
   */
  private calculateLatency(): number {
    if (!this.audioContext) return 0;

    // Base latency + output latency (if available)
    const baseLatency = this.audioContext.baseLatency || 0;
    const outputLatency = this.audioContext.outputLatency || 0;

    return Math.round((baseLatency + outputLatency) * 1000); // Convert to milliseconds
  }

  /**
   * Estimate CPU usage (simplified heuristic)
   */
  private estimateCpuUsage(): number {
    if (!this.audioContext) return 0;

    // Estimate based on active sources and processing load
    const activeAssets = Array.from(this.audioAssets.values()).filter(
      (asset) => asset.buffer && Date.now() - asset.lastAccessed < 5000,
    ).length;

    // Simple heuristic: each active asset uses ~5% CPU
    return Math.min(activeAssets * 5, 100);
  }

  /**
   * Calculate memory usage of audio buffers
   */
  private calculateMemoryUsage(): number {
    let totalBytes = 0;

    this.audioAssets.forEach((asset) => {
      if (asset.buffer) {
        // Calculate buffer size: channels * length * 4 bytes (float32)
        totalBytes += asset.buffer.numberOfChannels * asset.buffer.length * 4;
      }
    });

    // Add pool memory
    this.bufferPool.forEach((pool) => {
      pool.forEach((buffer) => {
        totalBytes += buffer.numberOfChannels * buffer.length * 4;
      });
    });

    return Math.round(totalBytes / (1024 * 1024)); // Convert to MB
  }

  /**
   * Optimize buffer settings based on current performance
   */
  public optimizeBufferSettings(): void {
    const currentMetrics = this.getCurrentMetrics();

    if (currentMetrics.latency > 50) {
      // Above 50ms target
      console.warn(
        `[AudioBufferManager] High latency detected: ${currentMetrics.latency}ms`,
      );

      // Suggest optimizations
      if (this.deviceProfile?.isLowEnd) {
        console.debug(
          '[AudioBufferManager] Recommending larger buffer size for stability',
        );
      } else {
        console.debug(
          '[AudioBufferManager] Recommending smaller buffer size for lower latency',
        );
      }
    }

    if (currentMetrics.memoryUsage > 50) {
      // Above 50MB
      console.warn(
        `[AudioBufferManager] High memory usage: ${currentMetrics.memoryUsage}MB`,
      );
      this.cleanupUnusedAssets();
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

      // Auto-optimize if needed
      this.optimizeBufferSettings();
    }, 5000); // Collect metrics every 5 seconds
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupUnusedAssets();
      this.cleanupBufferPools();
    }, this.cleanupInterval);
  }

  /**
   * Clean up unused audio assets
   */
  private cleanupUnusedAssets(): void {
    const now = Date.now();
    const unusedThreshold = 5 * 60 * 1000; // 5 minutes

    const assetsToRemove: string[] = [];

    this.audioAssets.forEach((asset, name) => {
      if (
        !asset.preload && // Don't remove preloaded assets
        asset.priority !== 'high' && // Don't remove high priority assets
        now - asset.lastAccessed > unusedThreshold
      ) {
        assetsToRemove.push(name);
      }
    });

    assetsToRemove.forEach((name) => {
      this.audioAssets.delete(name);
      console.debug(`[AudioBufferManager] Cleaned up unused asset: ${name}`);
    });

    if (assetsToRemove.length > 0) {
      console.debug(
        `[AudioBufferManager] Cleaned up ${assetsToRemove.length} unused assets`,
      );
    }
  }

  /**
   * Clean up buffer pools
   */
  private cleanupBufferPools(): void {
    let totalCleaned = 0;

    this.bufferPool.forEach((pool, _type) => {
      // Keep only half the pool size during cleanup
      const targetSize = Math.floor(this.maxPoolSize / 2);
      if (pool.length > targetSize) {
        const removed = pool.splice(targetSize);
        totalCleaned += removed.length;
      }
    });

    if (totalCleaned > 0) {
      console.debug(
        `[AudioBufferManager] Cleaned up ${totalCleaned} pooled buffers`,
      );
    }
  }

  /**
   * Get audio performance report
   */
  public generatePerformanceReport(): string {
    const currentMetrics = this.getCurrentMetrics();
    const avgLatency =
      this.metricsHistory.length > 0
        ? this.metricsHistory.reduce((sum, m) => sum + m.latency, 0) /
          this.metricsHistory.length
        : 0;

    return `
# Audio Performance Report
Generated: ${new Date().toISOString()}

## Current Metrics
- Latency: ${currentMetrics.latency}ms (avg: ${avgLatency.toFixed(1)}ms)
- CPU Usage: ${currentMetrics.cpuUsage}%
- Memory Usage: ${currentMetrics.memoryUsage}MB
- Buffer Underruns: ${currentMetrics.bufferUnderruns}
- Dropouts: ${currentMetrics.dropouts}

## Device Profile
- Low-end Device: ${this.deviceProfile?.isLowEnd ? 'Yes' : 'No'}
- Recommended Buffer: ${this.deviceProfile?.recommendedBufferSize} samples
- Max Concurrent: ${this.deviceProfile?.maxConcurrentSounds} sounds
- Web Audio Support: ${this.deviceProfile?.supportsWebAudio ? 'Yes' : 'No'}
- Audio Worklet Support: ${this.deviceProfile?.supportsAudioWorklet ? 'Yes' : 'No'}

## Audio Assets (${this.audioAssets.size})
${Array.from(this.audioAssets.entries())
  .map(
    ([name, asset]) =>
      `- ${name}: ${asset.buffer ? 'Loaded' : 'Not loaded'} (priority: ${asset.priority}, accessed: ${Math.round((Date.now() - asset.lastAccessed) / 1000)}s ago)`,
  )
  .join('\n')}

## Buffer Pools
${Array.from(this.bufferPool.entries())
  .map(([type, pool]) => `- ${type}: ${pool.length} buffers`)
  .join('\n')}

## Performance Status
${currentMetrics.latency <= 50 ? '✅ Latency within target (<50ms)' : '⚠️ Latency above target (>50ms)'}
${currentMetrics.memoryUsage <= 50 ? '✅ Memory usage acceptable' : '⚠️ High memory usage'}
${avgLatency <= 30 ? '✅ Excellent average latency' : avgLatency <= 50 ? '✅ Good average latency' : '⚠️ Poor average latency'}
`;
  }

  /**
   * Get device profile
   */
  public getDeviceProfile(): DeviceAudioProfile | null {
    return this.deviceProfile;
  }

  /**
   * Get metrics history
   */
  public getMetricsHistory(): AudioBufferMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Destroy the audio buffer manager
   */
  public async destroy(): Promise<void> {
    // Stop timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch (error) {
        // Handle cases where close() might not be available (e.g., in test environments)
        console.debug(
          '[AudioBufferManager] Audio context close() not available or failed:',
          error,
        );
      }
    }

    // Clear all data
    this.audioAssets.clear();
    this.bufferPool.clear();
    this.metricsHistory.length = 0;

    AudioBufferManager.instance = null;

    console.debug('[AudioBufferManager] Destroyed');
  }
}

// Export singleton instance for direct access
export const audioBufferManager = AudioBufferManager.getInstance();
