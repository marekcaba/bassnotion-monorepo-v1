'use client';

/**
 * AudioVisualSync Service
 *
 * Provides high-precision timing synchronization between audio playback
 * and visual components with <50ms latency and ±5ms accuracy requirements.
 *
 * Part of Story 3.5: Core Playback Integration
 */

export interface AudioVisualSyncConfig {
  targetLatency: number; // Target latency in ms (default: 50)
  syncAccuracy: number; // Target accuracy in ms (default: 5)
  driftCorrectionInterval: number; // Auto-correction interval in ms (default: 1000)
  visualFrameRate: number; // Target visual frame rate (default: 60)
}

export interface SyncMetrics {
  currentLatency: number;
  averageLatency: number;
  driftOffset: number;
  syncAccuracy: number;
  frameDrops: number;
  lastSyncTime: number;
  performanceScore: number; // 0-1 rating
}

export interface SyncPoint {
  audioTime: number;
  visualTime: number;
  scheduledTime: number;
  actualTime: number;
  latencyOffset: number;
}

export class AudioVisualSync {
  private config: AudioVisualSyncConfig;
  private audioContext: AudioContext | null = null;
  private lastSyncTime = 0;
  private driftOffset = 0;
  private latencyHistory: number[] = [];
  private frameTimeHistory: number[] = [];
  private syncPointHistory: SyncPoint[] = [];
  private animationFrameId: number | null = null;
  private isRunning = false;

  // Performance monitoring
  private frameDropCount = 0;
  private targetFrameTime: number;
  private lastFrameTime = 0;

  // Callbacks
  private onSyncUpdate?: (metrics: SyncMetrics) => void;
  private onLatencyAlert?: (latency: number) => void;

  constructor(config: Partial<AudioVisualSyncConfig> = {}) {
    this.config = {
      targetLatency: 50,
      syncAccuracy: 5,
      driftCorrectionInterval: 1000,
      visualFrameRate: 60,
      ...config,
    };

    this.targetFrameTime = 1000 / this.config.visualFrameRate;
  }

  /**
   * Initialize the sync system with audio context
   */
  public initialize(audioContext: AudioContext): void {
    this.audioContext = audioContext;
    this.lastSyncTime = performance.now();
    console.log('🔄 AudioVisualSync initialized');
  }

  /**
   * Start synchronization monitoring
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.lastSyncTime = performance.now(); // Initialize drift correction timing
    this.scheduleNextFrame();
    console.log('▶️ AudioVisualSync started');
  }

  /**
   * Stop synchronization monitoring
   */
  public stop(): void {
    this.isRunning = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    console.log('⏹️ AudioVisualSync stopped');
  }

  /**
   * Synchronize audio and visual components
   */
  public sync(audioTime: number, visualTime: number): SyncPoint {
    const now = performance.now();
    const latency = this.calculateLatency();
    const compensatedTime = audioTime - latency - this.driftOffset;

    const syncPoint: SyncPoint = {
      audioTime,
      visualTime,
      scheduledTime: compensatedTime,
      actualTime: now,
      latencyOffset: latency,
    };

    // Store sync point for analysis
    this.syncPointHistory.push(syncPoint);
    if (this.syncPointHistory.length > 100) {
      this.syncPointHistory.shift();
    }

    // Update drift correction
    this.updateDriftCorrection(syncPoint);

    return syncPoint;
  }

  /**
   * Calculate current audio latency
   */
  private calculateLatency(): number {
    if (!this.audioContext) return 0;

    // Base audio context latency
    const baseLatency = this.audioContext.baseLatency || 0;
    const outputLatency = this.audioContext.outputLatency || 0;

    // Estimate processing latency
    const processingLatency = 10; // Estimated processing time

    const totalLatency =
      (baseLatency + outputLatency) * 1000 + processingLatency;

    // Track latency history for average calculation
    this.latencyHistory.push(totalLatency);
    if (this.latencyHistory.length > 50) {
      this.latencyHistory.shift();
    }

    // Alert if latency exceeds target
    if (totalLatency > this.config.targetLatency && this.onLatencyAlert) {
      this.onLatencyAlert(totalLatency);
    }

    return totalLatency;
  }

  /**
   * Update drift correction based on sync history
   */
  private updateDriftCorrection(syncPoint: SyncPoint): void {
    const now = performance.now();

    // Only correct drift at specified intervals
    if (now - this.lastSyncTime < this.config.driftCorrectionInterval) {
      return;
    }

    // Calculate drift from recent sync points
    const recentPoints = this.syncPointHistory.slice(-10);

    if (recentPoints.length < 5) {
      return;
    }

    const driftValues = recentPoints.map(
      (point) => point.actualTime - point.scheduledTime,
    );

    const avgDrift =
      driftValues.reduce((sum, drift) => sum + drift, 0) / driftValues.length;

    // Only apply correction if there's significant drift (>1ms)
    if (Math.abs(avgDrift) >= 1) {
      // Apply gradual drift correction
      this.driftOffset += avgDrift * 0.1; // 10% correction factor
      this.lastSyncTime = now;

      console.log(
        `🔄 Drift correction applied: ${avgDrift.toFixed(2)}ms, offset: ${this.driftOffset.toFixed(2)}ms`,
      );
    }
  }

  /**
   * Schedule next animation frame with performance monitoring
   */
  private scheduleNextFrame(): void {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame((currentTime) => {
      this.handleAnimationFrame(currentTime);
      this.scheduleNextFrame();
    });
  }

  /**
   * Handle animation frame and monitor performance
   */
  private handleAnimationFrame(currentTime: number): void {
    const frameTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // Track frame time history
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }

    // Detect frame drops (frames significantly longer than target)
    if (frameTime > this.targetFrameTime * 1.5) {
      this.frameDropCount++;
    }

    // Update sync metrics
    this.updateSyncMetrics();
  }

  /**
   * Update and emit sync metrics
   */
  private updateSyncMetrics(): void {
    const metrics: SyncMetrics = {
      currentLatency: this.latencyHistory[this.latencyHistory.length - 1] || 0,
      averageLatency:
        this.latencyHistory.length > 0
          ? this.latencyHistory.reduce((sum, lat) => sum + lat, 0) /
            this.latencyHistory.length
          : 0,
      driftOffset: this.driftOffset,
      syncAccuracy: this.calculateSyncAccuracy(),
      frameDrops: this.frameDropCount,
      lastSyncTime: this.lastSyncTime,
      performanceScore: this.calculatePerformanceScore(),
    };

    if (this.onSyncUpdate) {
      this.onSyncUpdate(metrics);
    }
  }

  /**
   * Calculate current sync accuracy
   */
  private calculateSyncAccuracy(): number {
    if (this.syncPointHistory.length < 5) return 0;

    const recentPoints = this.syncPointHistory.slice(-10);
    const accuracyValues = recentPoints.map((point) =>
      Math.abs(point.actualTime - point.scheduledTime),
    );

    return (
      accuracyValues.reduce((sum, acc) => sum + acc, 0) / accuracyValues.length
    );
  }

  /**
   * Calculate overall performance score (0-1)
   */
  private calculatePerformanceScore(): number {
    const latencyScore = Math.max(
      0,
      1 - this.calculateLatency() / this.config.targetLatency,
    );
    const accuracyScore = Math.max(
      0,
      1 - this.calculateSyncAccuracy() / this.config.syncAccuracy,
    );
    const frameScore = Math.max(0, 1 - this.frameDropCount / 60); // Reset every 60 frames

    return (latencyScore + accuracyScore + frameScore) / 3;
  }

  /**
   * Get compensated time for visual updates
   */
  public getCompensatedTime(audioTime: number): number {
    const latency = this.calculateLatency();
    return audioTime - latency - this.driftOffset;
  }

  /**
   * Check if sync is within acceptable parameters
   */
  public isInSync(): boolean {
    const currentLatency = this.calculateLatency();
    const currentAccuracy = this.calculateSyncAccuracy();

    return (
      currentLatency <= this.config.targetLatency &&
      currentAccuracy <= this.config.syncAccuracy
    );
  }

  /**
   * Set sync update callback
   */
  public onSync(callback: (metrics: SyncMetrics) => void): void {
    this.onSyncUpdate = callback;
  }

  /**
   * Set latency alert callback
   */
  public onLatencyExceeded(callback: (latency: number) => void): void {
    this.onLatencyAlert = callback;
  }

  /**
   * Get current sync metrics
   */
  public getMetrics(): SyncMetrics {
    return {
      currentLatency: this.calculateLatency(),
      averageLatency:
        this.latencyHistory.length > 0
          ? this.latencyHistory.reduce((sum, lat) => sum + lat, 0) /
            this.latencyHistory.length
          : 0,
      driftOffset: this.driftOffset,
      syncAccuracy: this.calculateSyncAccuracy(),
      frameDrops: this.frameDropCount,
      lastSyncTime: this.lastSyncTime,
      performanceScore: this.calculatePerformanceScore(),
    };
  }

  /**
   * Reset sync state and metrics
   */
  public reset(): void {
    this.driftOffset = 0;
    this.latencyHistory = [];
    this.frameTimeHistory = [];
    this.syncPointHistory = [];
    this.frameDropCount = 0;
    this.lastSyncTime = performance.now();
    console.log('🔄 AudioVisualSync reset');
  }

  /**
   * Dispose of the sync system
   */
  public dispose(): void {
    this.stop();
    this.audioContext = null;
    this.onSyncUpdate = undefined;
    this.onLatencyAlert = undefined;
    console.log('🗑️ AudioVisualSync disposed');
  }
}
