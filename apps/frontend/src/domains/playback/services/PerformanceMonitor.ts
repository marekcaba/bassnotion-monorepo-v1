/**
 * PerformanceMonitor - Audio Performance Tracking Service
 *
 * Monitors audio dropouts, latency, and performance metrics
 * to ensure NFR compliance (NFR-PO-15: <50ms latency, NFR-PF-04: <200ms response)
 * Enhanced with network latency and cache hit rate monitoring for Epic 2
 *
 * Part of Story 2.1: Core Audio Engine Foundation + Task 12, Subtask 12.5
 */

import { NetworkLatencyMonitor } from './NetworkLatencyMonitor.js';
import { CacheMetricsCollector } from './CacheMetricsCollector.js';

export interface AudioPerformanceMetrics {
  latency: number; // Current audio latency in ms
  averageLatency: number; // Average latency over time
  maxLatency: number; // Maximum recorded latency
  dropoutCount: number; // Number of audio dropouts detected
  bufferUnderruns: number; // Buffer underrun events
  cpuUsage: number; // Estimated CPU usage percentage
  memoryUsage: number; // Memory usage in MB
  sampleRate: number; // Current sample rate
  bufferSize: number; // Current buffer size
  timestamp: number; // Last measurement timestamp
  networkLatency?: number; // Network latency for asset loading (ms) - NEW for Epic 2
  cacheHitRate?: number; // Cache hit rate (0-1) - NEW for Epic 2
}

export interface PerformanceAlert {
  type: 'latency' | 'dropout' | 'cpu' | 'memory';
  severity: 'warning' | 'critical';
  message: string;
  metrics: Partial<AudioPerformanceMetrics>;
  timestamp: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isMonitoring = false;
  private monitoringInterval: number | null = null;
  private networkMonitor: NetworkLatencyMonitor;
  private cacheMetrics: CacheMetricsCollector;

  // Performance thresholds (based on NFRs)
  private readonly LATENCY_WARNING_MS = 30; // Warning at 30ms
  private readonly LATENCY_CRITICAL_MS = 50; // Critical at 50ms (NFR limit)
  private readonly RESPONSE_TIME_CRITICAL_MS = 200; // NFR-PF-04
  private readonly CPU_WARNING_THRESHOLD = 0.7; // Warning at 70% CPU (0.7 in 0-1 range)
  private readonly CPU_CRITICAL_THRESHOLD = 0.85; // Critical at 85% CPU (0.85 in 0-1 range)

  // Metrics tracking
  private metrics: AudioPerformanceMetrics = {
    latency: 0,
    averageLatency: 0,
    maxLatency: 0,
    dropoutCount: 0,
    bufferUnderruns: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    sampleRate: 44100,
    bufferSize: 128,
    timestamp: Date.now(),
  };

  private latencyHistory: number[] = [];
  private alertHandlers: Set<(alert: PerformanceAlert) => void> = new Set();
  private metricsHandlers: Set<(metrics: AudioPerformanceMetrics) => void> =
    new Set();

  private constructor() {
    // Private constructor to enforce singleton pattern
    this.networkMonitor = NetworkLatencyMonitor.getInstance();
    this.cacheMetrics = CacheMetricsCollector.getInstance();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Initialize performance monitoring with audio context
   */
  public initialize(audioContext: AudioContext): void {
    this.audioContext = audioContext;
    this.setupAnalyser();
    this.updateBasicMetrics();

    // Enhanced audio context property sanitization
    this.sanitizeAudioContextProperties(audioContext);
  }

  /**
   * Sanitize and extract safe values from potentially malicious audio context properties
   */
  private sanitizeAudioContextProperties(audioContext: any): void {
    // Only apply enhanced sanitization if properties exist and might be malicious
    if (audioContext.sampleRate !== undefined) {
      const sampleRate = this.extractNumericValue(
        audioContext.sampleRate,
        44100,
      );
      this.metrics.sampleRate = this.sanitizeNumericValue(
        sampleRate,
        8000,
        192000,
      );
    }

    // Only calculate latency if both properties exist
    if (
      audioContext.baseLatency !== undefined &&
      audioContext.outputLatency !== undefined
    ) {
      const baseLatency = this.extractNumericValue(
        audioContext.baseLatency,
        0.005,
      );
      const outputLatency = this.extractNumericValue(
        audioContext.outputLatency,
        0.01,
      );

      // Calculate total latency in milliseconds
      const totalLatencyMs = (baseLatency + outputLatency) * 1000;
      this.metrics.latency = this.sanitizeNumericValue(totalLatencyMs, 0, 1000);
      this.metrics.averageLatency = this.metrics.latency;
      this.metrics.maxLatency = this.metrics.latency;
    }
    // If latency properties are missing, leave them at default 0 (handled by updateBasicMetrics)
  }

  /**
   * Extract numeric value from potentially malicious input with fallback default
   */
  private extractNumericValue(value: any, defaultValue: number): number {
    // If already a valid number, return it
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    // Try to extract numbers from strings (e.g., "44100" from malicious content)
    if (typeof value === 'string') {
      // Remove all non-numeric characters and try to parse
      const cleaned = value.replace(/[^\d.-]/g, '');
      const parsed = parseFloat(cleaned);

      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    // Return safe default for invalid inputs
    return defaultValue;
  }

  /**
   * Start performance monitoring
   */
  public startMonitoring(intervalMs = 1000): void {
    if (this.isMonitoring) {
      // Already monitoring, return early to prevent duplicate intervals
      return;
    }

    // Sanitize and validate monitoring interval
    const sanitizedInterval = this.sanitizeMonitoringInterval(intervalMs);

    this.isMonitoring = true;

    // Use window.setInterval if available (for proper test mocking), otherwise fallback
    const setIntervalFn =
      (typeof window !== 'undefined' && window.setInterval) ||
      globalThis.setInterval ||
      (global as any)?.setInterval ||
      setInterval;

    this.monitoringInterval = setIntervalFn(() => {
      try {
        this.collectMetrics();
      } catch (error) {
        console.error('Error collecting metrics:', error);
        // Continue monitoring even if one collection fails
      }
    }, sanitizedInterval) as any;
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval !== null) {
      // Use window.clearInterval if available (for proper test mocking), otherwise fallback
      const clearIntervalFn =
        (typeof window !== 'undefined' && window.clearInterval) ||
        globalThis.clearInterval ||
        (global as any)?.clearInterval ||
        clearInterval;
      clearIntervalFn(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): AudioPerformanceMetrics {
    // Return a sanitized copy to prevent prototype pollution
    return this.sanitizeMetrics(this.metrics);
  }

  /**
   * Get current performance metrics (alias for getMetrics for compatibility)
   */
  public getCurrentMetrics(): AudioPerformanceMetrics {
    return this.getMetrics();
  }

  /**
   * Measure playback control response time
   */
  public async measureResponseTime<T>(
    operation: () => Promise<T>,
  ): Promise<{ result: T; responseTime: number }> {
    const startTime = performance.now();
    const result = await operation();
    const responseTime = performance.now() - startTime;

    // Sanitize operation result to prevent XSS
    const sanitizedResult = this.sanitizeOperationResult(result);

    // Check against NFR-PF-04 (200ms response time)
    if (responseTime > this.RESPONSE_TIME_CRITICAL_MS) {
      this.emitAlert({
        type: 'latency',
        severity: 'critical',
        message: `Control response time exceeded ${this.RESPONSE_TIME_CRITICAL_MS}ms: ${responseTime.toFixed(1)}ms`,
        metrics: { latency: responseTime },
        timestamp: Date.now(),
      });
    }

    return { result: sanitizedResult, responseTime };
  }

  /**
   * Sanitize operation results to prevent XSS and other security issues
   */
  private sanitizeOperationResult<T>(result: T): T {
    if (typeof result === 'string') {
      // Apply the same sanitization as alert messages
      const sanitized = this.sanitizeAlertMessage(result);
      return sanitized as T;
    }

    if (typeof result === 'object' && result !== null) {
      // Deep sanitize object properties
      const sanitizedObj = {} as T;
      for (const [key, value] of Object.entries(result)) {
        (sanitizedObj as any)[key] = this.sanitizeOperationResult(value);
      }
      return sanitizedObj;
    }

    // Return primitive values as-is (numbers, booleans, etc.)
    return result;
  }

  /**
   * Record audio dropout event
   */
  public recordDropout(): void {
    this.metrics.dropoutCount++;
    this.emitAlert({
      type: 'dropout',
      severity: 'warning',
      message: `Audio dropout detected. Total dropouts: ${this.metrics.dropoutCount}`,
      metrics: { dropoutCount: this.metrics.dropoutCount },
      timestamp: Date.now(),
    });
  }

  /**
   * Record buffer underrun event
   */
  public recordBufferUnderrun(): void {
    this.metrics.bufferUnderruns++;
    this.emitAlert({
      type: 'dropout',
      severity: 'critical',
      message: `Buffer underrun detected. Total underruns: ${this.metrics.bufferUnderruns}`,
      metrics: { bufferUnderruns: this.metrics.bufferUnderruns },
      timestamp: Date.now(),
    });
  }

  /**
   * Add performance alert handler
   */
  public onAlert(handler: (alert: PerformanceAlert) => void): () => void {
    // Validate handler parameter gracefully
    if (typeof handler !== 'function') {
      // Return a no-op unsubscriber instead of throwing
      console.warn('Invalid alert handler provided, ignoring');
      return () => {
        // No-op unsubscriber for invalid handlers
      };
    }

    this.alertHandlers.add(handler);
    return () => this.alertHandlers.delete(handler);
  }

  /**
   * Add metrics update handler
   */
  public onMetrics(
    handler: (metrics: AudioPerformanceMetrics) => void,
  ): () => void {
    // Validate handler parameter gracefully
    if (typeof handler !== 'function') {
      // Return a no-op unsubscriber instead of throwing
      console.warn('Invalid metrics handler provided, ignoring');
      return () => {
        // No-op unsubscriber for invalid handlers
      };
    }

    this.metricsHandlers.add(handler);
    return () => this.metricsHandlers.delete(handler);
  }

  /**
   * Reset performance metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      ...this.metrics,
      latency: 0,
      averageLatency: 0,
      maxLatency: 0,
      dropoutCount: 0,
      bufferUnderruns: 0,
      timestamp: Date.now(),
    };
    this.latencyHistory = [];
  }

  private setupAnalyser(): void {
    if (!this.audioContext) return;

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;
  }

  private collectMetrics(): void {
    if (!this.audioContext) return;

    // Update basic metrics
    this.updateBasicMetrics();

    // Calculate latency
    this.calculateLatency();

    // Estimate CPU usage (simplified)
    this.estimateCPUUsage();

    // Update memory usage
    this.updateMemoryUsage();

    // Update network latency and cache hit rate (NEW for Epic 2)
    this.updateNetworkAndCacheMetrics();

    // Check thresholds and emit alerts
    this.checkThresholds();

    // Notify metrics handlers
    this.emitMetrics();
  }

  private updateBasicMetrics(): void {
    if (!this.audioContext) return;

    this.metrics.sampleRate = this.audioContext.sampleRate;
    this.metrics.bufferSize =
      this.audioContext.baseLatency * this.audioContext.sampleRate;
    this.metrics.timestamp = Date.now();
  }

  private calculateLatency(): void {
    if (!this.audioContext) return;

    // Calculate total latency: baseLatency + outputLatency
    const baseLatency = this.audioContext.baseLatency || 0;
    const outputLatency = this.audioContext.outputLatency || 0;
    const totalLatency = (baseLatency + outputLatency) * 1000; // Convert to ms

    this.metrics.latency = totalLatency;
    this.latencyHistory.push(totalLatency);

    // Keep only recent history (last 100 measurements)
    if (this.latencyHistory.length > 100) {
      this.latencyHistory.shift();
    }

    // Calculate average and max latency
    this.metrics.averageLatency =
      this.latencyHistory.reduce((a, b) => a + b, 0) /
      this.latencyHistory.length;
    this.metrics.maxLatency = Math.max(this.metrics.maxLatency, totalLatency);
  }

  private estimateCPUUsage(): void {
    // Simplified CPU usage estimation based on audio processing
    // In a real implementation, this would use more sophisticated metrics
    const baseUsage = 0.05; // Base audio processing overhead (5% as 0.05)
    const latencyPenalty =
      this.metrics.latency > 20 ? (this.metrics.latency - 20) * 0.02 : 0;
    const dropoutPenalty = this.metrics.dropoutCount * 0.05;

    // Return CPU usage as 0-1 range (not 0-100 percentage)
    this.metrics.cpuUsage = Math.min(
      1.0,
      baseUsage + latencyPenalty + dropoutPenalty,
    );
  }

  private updateMemoryUsage(): void {
    // Get memory usage if available (Chrome only)
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const memoryMB = memInfo.usedJSHeapSize / (1024 * 1024); // Convert to MB
      // Sanitize memory value to prevent injection
      this.metrics.memoryUsage = this.sanitizeNumericValue(memoryMB, 0, 16384); // Max 16GB
    }
  }

  /**
   * Update network latency and cache hit rate metrics (NEW for Epic 2)
   */
  private updateNetworkAndCacheMetrics(): void {
    // Get network latency from NetworkLatencyMonitor
    const networkMetrics = this.networkMonitor.getMetrics();
    this.metrics.networkLatency = this.sanitizeNumericValue(
      networkMetrics.averageLatency,
      0,
      10000, // Max 10 seconds
    );

    // Get cache hit rate from CacheMetricsCollector
    const cacheMetrics = this.cacheMetrics.getMetrics();
    this.metrics.cacheHitRate = this.sanitizeNumericValue(
      cacheMetrics.hitRate,
      0,
      1, // 0-1 range
    );
  }

  private checkThresholds(): void {
    // Check latency thresholds
    if (this.metrics.latency > this.LATENCY_CRITICAL_MS) {
      this.emitAlert({
        type: 'latency',
        severity: 'critical',
        message: `Audio latency critical: ${this.metrics.latency.toFixed(1)}ms (NFR limit: ${this.LATENCY_CRITICAL_MS}ms)`,
        metrics: { latency: this.metrics.latency },
        timestamp: Date.now(),
      });
    } else if (this.metrics.latency > this.LATENCY_WARNING_MS) {
      this.emitAlert({
        type: 'latency',
        severity: 'warning',
        message: `Audio latency warning: ${this.metrics.latency.toFixed(1)}ms`,
        metrics: { latency: this.metrics.latency },
        timestamp: Date.now(),
      });
    }

    // Check CPU usage thresholds
    if (this.metrics.cpuUsage > this.CPU_CRITICAL_THRESHOLD) {
      this.emitAlert({
        type: 'cpu',
        severity: 'critical',
        message: `CPU usage critical: ${this.metrics.cpuUsage.toFixed(1)}%`,
        metrics: { cpuUsage: this.metrics.cpuUsage },
        timestamp: Date.now(),
      });
    } else if (this.metrics.cpuUsage > this.CPU_WARNING_THRESHOLD) {
      this.emitAlert({
        type: 'cpu',
        severity: 'warning',
        message: `CPU usage warning: ${this.metrics.cpuUsage.toFixed(1)}%`,
        metrics: { cpuUsage: this.metrics.cpuUsage },
        timestamp: Date.now(),
      });
    }
  }

  private emitAlert(alert: PerformanceAlert): void {
    // Sanitize alert message before emitting
    const sanitizedAlert: PerformanceAlert = {
      ...alert,
      message: this.sanitizeAlertMessage(alert.message),
      metrics: this.sanitizeMetrics(alert.metrics as AudioPerformanceMetrics),
    };

    this.alertHandlers.forEach((handler) => {
      try {
        handler(sanitizedAlert);
      } catch (error) {
        console.error('Error in performance alert handler:', error);
      }
    });
  }

  private emitMetrics(): void {
    this.metricsHandlers.forEach((handler) => {
      try {
        handler(this.getMetrics());
      } catch (error) {
        console.error('Error in metrics handler:', error);
      }
    });
  }

  /**
   * Dispose of performance monitor
   */
  public dispose(): void {
    this.stopMonitoring();
    this.audioContext = null;
    this.analyserNode = null;
    this.alertHandlers.clear();
    this.metricsHandlers.clear();
    this.latencyHistory = [];
  }

  private sanitizeMonitoringInterval(intervalMs: number): number {
    // Ensure interval is a safe number
    if (typeof intervalMs !== 'number' || !Number.isFinite(intervalMs)) {
      return 1000; // Default safe interval
    }

    // Enforce minimum interval to prevent DoS (minimum 10ms)
    const minInterval = 10;
    const maxInterval = 60000; // Maximum 1 minute

    return Math.max(minInterval, Math.min(maxInterval, Math.floor(intervalMs)));
  }

  private sanitizeMetrics(
    metrics: AudioPerformanceMetrics,
  ): AudioPerformanceMetrics {
    // Create a clean object to prevent prototype pollution
    // Use Object.create(null) to avoid inheriting from Object.prototype
    const sanitizedMetrics = Object.create(null) as AudioPerformanceMetrics;

    // Explicitly set each property to avoid prototype pollution
    sanitizedMetrics.latency = this.sanitizeNumericValue(
      metrics.latency,
      0,
      1000,
    );
    sanitizedMetrics.averageLatency = this.sanitizeNumericValue(
      metrics.averageLatency,
      0,
      1000,
    );
    sanitizedMetrics.maxLatency = this.sanitizeNumericValue(
      metrics.maxLatency,
      0,
      1000,
    );
    sanitizedMetrics.dropoutCount = this.sanitizeNumericValue(
      metrics.dropoutCount,
      0,
      999999,
    );
    sanitizedMetrics.bufferUnderruns = this.sanitizeNumericValue(
      metrics.bufferUnderruns,
      0,
      999999,
    );
    sanitizedMetrics.cpuUsage = this.sanitizeNumericValue(
      metrics.cpuUsage,
      0,
      1,
    );
    sanitizedMetrics.memoryUsage = this.sanitizeNumericValue(
      metrics.memoryUsage,
      0,
      16384,
    );
    sanitizedMetrics.sampleRate = this.sanitizeNumericValue(
      metrics.sampleRate,
      8000,
      192000,
    );
    sanitizedMetrics.bufferSize = this.sanitizeNumericValue(
      metrics.bufferSize,
      32,
      8192,
    );
    sanitizedMetrics.timestamp = this.sanitizeNumericValue(
      metrics.timestamp,
      0,
      Date.now() + 86400000,
    ); // Within 24 hours

    // Return the clean metrics object
    return sanitizedMetrics;
  }

  private sanitizeNumericValue(value: any, min: number, max: number): number {
    // Handle non-numeric values
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0; // Safe default
    }

    // Clamp to safe bounds
    return Math.max(min, Math.min(max, value));
  }

  private sanitizeAlertMessage(message: string): string {
    // Remove potential script injection and limit length
    if (typeof message !== 'string') {
      return 'Invalid alert message';
    }

    return message
      .replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        '[script removed]',
      )
      .replace(/javascript:/gi, '[js removed]')
      .replace(/on\w+\s*=/gi, '[event removed]')
      .substring(0, 500); // Limit message length
  }
}
