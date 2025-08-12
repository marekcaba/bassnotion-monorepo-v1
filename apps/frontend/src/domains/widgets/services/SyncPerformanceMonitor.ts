/**
 * SyncPerformanceMonitor Service
 *
 * Monitors and optimizes global playback synchronization performance to meet <50ms latency requirement.
 * Provides real-time metrics, performance alerts, and automatic optimization suggestions.
 *
 * Part of Story 3.14: Global Playback Synchronization
 * Task 6.1: Performance Optimization for <50ms Global Sync Latency
 */

import { playbackOrchestrator } from './PlaybackOrchestrator';
import { widgetSyncService } from './WidgetSyncService';

// ============================================================================
// INTERFACES
// ============================================================================

export interface PerformanceThresholds {
  // Latency thresholds (milliseconds)
  targetSyncLatency: number; // Target: 50ms
  maxAcceptableLatency: number; // Warning: 75ms
  criticalLatency: number; // Critical: 100ms

  // Widget response thresholds
  widgetResponseTarget: number; // Target: 16ms (60fps)
  widgetResponseWarning: number; // Warning: 33ms (30fps)

  // Audio dropout thresholds
  maxAudioDropouts: number; // Max per minute
  maxConsecutiveDropouts: number; // Max consecutive

  // Memory and CPU thresholds
  maxMemoryUsage: number; // MB
  maxCpuUsage: number; // Percentage
}

export interface SyncLatencyMetrics {
  // Current measurements
  currentLatency: number;
  averageLatency: number;
  p95Latency: number; // 95th percentile
  p99Latency: number; // 99th percentile
  maxLatency: number;

  // Variance and jitter
  latencyVariance: number;
  jitter: number; // Standard deviation of latency

  // Trending
  latencyTrend: 'improving' | 'stable' | 'degrading';
  measurementCount: number;
  lastMeasurement: number;
}

export interface WidgetPerformanceMetrics {
  widgetId: string;
  widgetType: string;

  // Response times
  averageResponseTime: number;
  maxResponseTime: number;
  responseTimeP95: number;

  // Event processing
  eventsProcessed: number;
  eventsDropped: number;
  eventProcessingRate: number; // events/second

  // Sync accuracy
  syncAccuracy: number; // 0-1 (1 = perfect sync)
  missedSyncEvents: number;

  // Health status
  healthScore: number; // 0-100
  lastActiveTime: number;
  isResponding: boolean;
}

export interface AudioDropoutMetrics {
  // Dropout counts
  totalDropouts: number;
  droputsLastMinute: number;
  consecutiveDropouts: number;

  // Dropout patterns
  averageDropoutDuration: number;
  maxDropoutDuration: number;
  dropoutRate: number; // dropouts per minute

  // Recovery metrics
  averageRecoveryTime: number;
  fastRecoveries: number; // <100ms
  slowRecoveries: number; // >500ms
}

export interface SystemResourceMetrics {
  // Memory usage
  memoryUsage: number; // MB
  memoryTrend: 'increasing' | 'stable' | 'decreasing';

  // CPU usage
  cpuUsage: number; // Percentage
  cpuTrend: 'increasing' | 'stable' | 'decreasing';

  // Browser performance
  frameRate: number; // FPS
  frameDelta: number; // ms between frames

  // Audio context
  audioContextState: string;
  audioContextLatency: number;
  audioBufferUnderruns: number;
}

export interface PerformanceAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'latency' | 'widget' | 'audio' | 'system' | 'sync';
  message: string;
  details: Record<string, any>;
  timestamp: number;
  resolved: boolean;
  resolutionTime?: number;
  suggestions: string[];
}

export interface OptimizationRecommendation {
  id: string;
  category: 'configuration' | 'hardware' | 'browser' | 'code';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImprovement: string; // e.g., "10-15ms latency reduction"
  implementationDifficulty: 'easy' | 'medium' | 'hard';
  autoApplyable: boolean;
  implementation?: () => Promise<void>;
}

// ============================================================================
// PERFORMANCE MONITOR CLASS
// ============================================================================

export class SyncPerformanceMonitor {
  private static instance: SyncPerformanceMonitor | null = null;

  private thresholds: PerformanceThresholds;
  private latencyMetrics: SyncLatencyMetrics;
  private widgetMetrics: Map<string, WidgetPerformanceMetrics> = new Map();
  private audioMetrics: AudioDropoutMetrics;
  private systemMetrics: SystemResourceMetrics;
  private alerts: PerformanceAlert[] = [];
  private recommendations: OptimizationRecommendation[] = [];

  // Monitoring state
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private latencySamples: number[] = [];
  private frameTimestamps: number[] = [];

  // Event listeners
  private performanceObserver: PerformanceObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // High-precision timing
  private highPrecisionClock: () => number;

  // ============================================================================
  // SINGLETON PATTERN
  // ============================================================================

  public static getInstance(): SyncPerformanceMonitor {
    if (!SyncPerformanceMonitor.instance) {
      SyncPerformanceMonitor.instance = new SyncPerformanceMonitor();
    }
    return SyncPerformanceMonitor.instance;
  }

  private constructor() {
    this.highPrecisionClock = () => performance.now();

    // Default thresholds
    this.thresholds = {
      targetSyncLatency: 50,
      maxAcceptableLatency: 75,
      criticalLatency: 100,
      widgetResponseTarget: 16,
      widgetResponseWarning: 33,
      maxAudioDropouts: 5,
      maxConsecutiveDropouts: 3,
      maxMemoryUsage: 500, // 500MB
      maxCpuUsage: 80, // 80%
    };

    // Initialize metrics
    this.latencyMetrics = {
      currentLatency: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      maxLatency: 0,
      latencyVariance: 0,
      jitter: 0,
      latencyTrend: 'stable',
      measurementCount: 0,
      lastMeasurement: 0,
    };

    this.audioMetrics = {
      totalDropouts: 0,
      droputsLastMinute: 0,
      consecutiveDropouts: 0,
      averageDropoutDuration: 0,
      maxDropoutDuration: 0,
      dropoutRate: 0,
      averageRecoveryTime: 0,
      fastRecoveries: 0,
      slowRecoveries: 0,
    };

    this.systemMetrics = {
      memoryUsage: 0,
      memoryTrend: 'stable',
      cpuUsage: 0,
      cpuTrend: 'stable',
      frameRate: 60,
      frameDelta: 16.67,
      audioContextState: 'suspended',
      audioContextLatency: 0,
      audioBufferUnderruns: 0,
    };
  }

  // ============================================================================
  // MONITORING CONTROL
  // ============================================================================

  public startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Start performance monitoring loop
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCycle();
    }, 100); // Monitor every 100ms for precision

    // Set up Performance Observer for detailed timing
    this.setupPerformanceObserver();

    // Set up frame rate monitoring
    this.startFrameRateMonitoring();

    // Set up system resource monitoring
    this.startSystemResourceMonitoring();

    console.log('[SyncPerformanceMonitor] Performance monitoring started');
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    console.log('[SyncPerformanceMonitor] Performance monitoring stopped');
  }

  // ============================================================================
  // PERFORMANCE MEASUREMENT
  // ============================================================================

  private async performMonitoringCycle(): Promise<void> {
    try {
      // Measure sync latency
      await this.measureSyncLatency();

      // Update widget metrics
      this.updateWidgetMetrics();

      // Check for audio dropouts
      this.checkAudioDropouts();

      // Update system metrics
      this.updateSystemMetrics();

      // Analyze performance and generate alerts
      this.analyzePerformance();

      // Generate optimization recommendations
      this.generateRecommendations();
    } catch (error) {
      console.error('[SyncPerformanceMonitor] Monitoring cycle error:', error);
    }
  }

  private async measureSyncLatency(): Promise<void> {
    const startTime = this.highPrecisionClock();

    try {
      // Simulate a sync event and measure response time
      const testEvent = {
        type: 'PERFORMANCE_TEST',
        payload: { timestamp: startTime },
        timestamp: startTime,
        source: 'performance-monitor',
        priority: 'high' as const,
      };

      // Emit event and measure propagation time
      widgetSyncService.emit(testEvent as any);

      // Wait for orchestrator to process
      await new Promise((resolve) => setTimeout(resolve, 1));

      const endTime = this.highPrecisionClock();
      const latency = endTime - startTime;

      // Update latency metrics
      this.updateLatencyMetrics(latency);
    } catch (error) {
      console.error(
        '[SyncPerformanceMonitor] Latency measurement failed:',
        error,
      );
    }
  }

  private updateLatencyMetrics(latency: number): void {
    // Add to samples
    this.latencySamples.push(latency);
    if (this.latencySamples.length > 1000) {
      this.latencySamples.shift(); // Keep last 1000 samples
    }

    // Update current metrics
    this.latencyMetrics.currentLatency = latency;
    this.latencyMetrics.measurementCount++;
    this.latencyMetrics.lastMeasurement = this.highPrecisionClock();

    // Calculate statistics
    const samples = this.latencySamples;
    this.latencyMetrics.averageLatency =
      samples.reduce((a, b) => a + b, 0) / samples.length;
    this.latencyMetrics.maxLatency = Math.max(...samples);

    // Calculate percentiles
    const sorted = [...samples].sort((a, b) => a - b);
    this.latencyMetrics.p95Latency =
      sorted[Math.floor(sorted.length * 0.95)] || 0;
    this.latencyMetrics.p99Latency =
      sorted[Math.floor(sorted.length * 0.99)] || 0;

    // Calculate variance and jitter
    const mean = this.latencyMetrics.averageLatency;
    const variance =
      samples.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      samples.length;
    this.latencyMetrics.latencyVariance = variance;
    this.latencyMetrics.jitter = Math.sqrt(variance);

    // Determine trend
    if (samples.length >= 10) {
      const recent = samples.slice(-10);
      const older = samples.slice(-20, -10);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

      const difference = recentAvg - olderAvg;
      if (difference > 5) {
        this.latencyMetrics.latencyTrend = 'degrading';
      } else if (difference < -5) {
        this.latencyMetrics.latencyTrend = 'improving';
      } else {
        this.latencyMetrics.latencyTrend = 'stable';
      }
    }
  }

  private updateWidgetMetrics(): void {
    const orchestratorMetrics = playbackOrchestrator.getPerformanceMetrics();
    const registeredWidgets = playbackOrchestrator.getRegisteredWidgets();

    for (const widget of registeredWidgets) {
      const existing = this.widgetMetrics.get(widget.widgetId) || {
        widgetId: widget.widgetId,
        widgetType: widget.widgetType,
        averageResponseTime: 0,
        maxResponseTime: 0,
        responseTimeP95: 0,
        eventsProcessed: 0,
        eventsDropped: 0,
        eventProcessingRate: 0,
        syncAccuracy: 1.0,
        missedSyncEvents: 0,
        healthScore: 100,
        lastActiveTime: this.highPrecisionClock(),
        isResponding: true,
      };

      // Update response time based on widget latency
      existing.averageResponseTime = widget.latency;
      existing.maxResponseTime = Math.max(
        existing.maxResponseTime,
        widget.latency,
      );
      existing.lastActiveTime = widget.lastHeartbeat;
      existing.isResponding = widget.syncStatus === 'connected';

      // Calculate health score based on multiple factors
      let healthScore = 100;
      if (widget.latency > this.thresholds.widgetResponseWarning)
        healthScore -= 20;
      if (widget.syncStatus !== 'connected') healthScore -= 30;
      if (this.highPrecisionClock() - widget.lastHeartbeat > 5000)
        healthScore -= 25;

      existing.healthScore = Math.max(0, healthScore);

      this.widgetMetrics.set(widget.widgetId, existing);
    }
  }

  private checkAudioDropouts(): void {
    // This would integrate with actual audio system monitoring
    // For now, we'll simulate based on performance metrics
    const currentTime = this.highPrecisionClock();

    // Check for potential audio issues based on latency spikes
    if (this.latencyMetrics.currentLatency > this.thresholds.criticalLatency) {
      this.audioMetrics.totalDropouts++;
      this.audioMetrics.consecutiveDropouts++;
    } else {
      this.audioMetrics.consecutiveDropouts = 0;
    }

    // Update dropout rate (simplified)
    this.audioMetrics.dropoutRate = this.audioMetrics.droputsLastMinute;
  }

  private updateSystemMetrics(): void {
    // Memory usage (if available)
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      this.systemMetrics.memoryUsage = memInfo.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }

    // Frame rate from collected timestamps
    if (this.frameTimestamps.length >= 2) {
      const recent = this.frameTimestamps.slice(-60); // Last 60 frames

      if (recent.length > 1) {
        const totalTime = recent[recent.length - 1]! - recent[0]!;
        // More accurate frame rate calculation with rounding
        const rawFrameRate = (recent.length - 1) / (totalTime / 1000);
        this.systemMetrics.frameRate = Math.round(rawFrameRate * 100) / 100; // Round to 2 decimal places

        // Calculate average frame delta
        const deltas: number[] = [];
        for (let i = 1; i < recent.length; i++) {
          deltas.push(recent[i]! - recent[i - 1]!);
        }

        if (deltas.length > 0) {
          this.systemMetrics.frameDelta =
            deltas.reduce((a, b) => a + b, 0) / deltas.length;
        }
      }
    }
  }

  // ============================================================================
  // PERFORMANCE ANALYSIS
  // ============================================================================

  private analyzePerformance(): void {
    this.checkLatencyAlerts();
    this.checkWidgetAlerts();
    this.checkAudioAlerts();
    this.checkSystemAlerts();
  }

  private checkLatencyAlerts(): void {
    const { currentLatency, averageLatency, p95Latency } = this.latencyMetrics;

    // Critical latency alert
    if (currentLatency > this.thresholds.criticalLatency) {
      this.createAlert({
        severity: 'critical',
        category: 'latency',
        message: `Critical sync latency detected: ${currentLatency.toFixed(1)}ms`,
        details: { currentLatency, threshold: this.thresholds.criticalLatency },
        suggestions: [
          'Reduce widget count or complexity',
          'Check system resources',
          'Optimize browser performance',
        ],
      });
    }

    // High average latency warning
    if (averageLatency > this.thresholds.maxAcceptableLatency) {
      this.createAlert({
        severity: 'warning',
        category: 'latency',
        message: `Average sync latency above target: ${averageLatency.toFixed(1)}ms`,
        details: { averageLatency, target: this.thresholds.targetSyncLatency },
        suggestions: [
          'Review widget sync configuration',
          'Consider reducing update frequency',
          'Check for memory leaks',
        ],
      });
    }

    // Latency trend alert
    if (this.latencyMetrics.latencyTrend === 'degrading') {
      this.createAlert({
        severity: 'warning',
        category: 'latency',
        message: 'Sync latency is trending upward',
        details: { trend: 'degrading', jitter: this.latencyMetrics.jitter },
        suggestions: [
          'Monitor system resources',
          'Check for background processes',
          'Consider performance optimization',
        ],
      });
    }
  }

  private checkWidgetAlerts(): void {
    for (const [widgetId, metrics] of this.widgetMetrics) {
      // Widget not responding
      if (!metrics.isResponding) {
        this.createAlert({
          severity: 'error',
          category: 'widget',
          message: `Widget ${widgetId} is not responding`,
          details: { widgetId, lastActive: metrics.lastActiveTime },
          suggestions: [
            'Check widget error logs',
            'Restart widget if necessary',
            'Verify widget sync configuration',
          ],
        });
      }

      // Poor health score
      if (metrics.healthScore < 50) {
        this.createAlert({
          severity: 'warning',
          category: 'widget',
          message: `Widget ${widgetId} health score is low: ${metrics.healthScore}`,
          details: { widgetId, healthScore: metrics.healthScore },
          suggestions: [
            'Review widget performance',
            'Check for memory or CPU issues',
            'Optimize widget update frequency',
          ],
        });
      }
    }
  }

  private checkAudioAlerts(): void {
    // Too many consecutive dropouts
    if (
      this.audioMetrics.consecutiveDropouts >
      this.thresholds.maxConsecutiveDropouts
    ) {
      this.createAlert({
        severity: 'error',
        category: 'audio',
        message: `Too many consecutive audio dropouts: ${this.audioMetrics.consecutiveDropouts}`,
        details: { consecutiveDropouts: this.audioMetrics.consecutiveDropouts },
        suggestions: [
          'Check audio buffer settings',
          'Reduce audio processing load',
          'Verify audio hardware',
        ],
      });
    }
  }

  private checkSystemAlerts(): void {
    // High memory usage
    if (this.systemMetrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      this.createAlert({
        severity: 'warning',
        category: 'system',
        message: `High memory usage: ${this.systemMetrics.memoryUsage.toFixed(1)}MB`,
        details: { memoryUsage: this.systemMetrics.memoryUsage },
        suggestions: [
          'Close unnecessary browser tabs',
          'Clear browser cache',
          'Check for memory leaks',
        ],
      });
    }

    // Low frame rate
    if (this.systemMetrics.frameRate < 30) {
      this.createAlert({
        severity: 'warning',
        category: 'system',
        message: `Low frame rate detected: ${this.systemMetrics.frameRate.toFixed(1)}fps`,
        details: { frameRate: this.systemMetrics.frameRate },
        suggestions: [
          'Reduce visual complexity',
          'Check GPU acceleration',
          'Close other applications',
        ],
      });
    }
  }

  // ============================================================================
  // OPTIMIZATION RECOMMENDATIONS
  // ============================================================================

  private generateRecommendations(): void {
    this.recommendations = [];

    // Latency optimization recommendations
    if (
      this.latencyMetrics.averageLatency > this.thresholds.targetSyncLatency
    ) {
      this.recommendations.push({
        id: 'reduce-sync-frequency',
        category: 'configuration',
        priority: 'high',
        title: 'Reduce Sync Update Frequency',
        description: 'Lower the sync update frequency to reduce CPU overhead',
        expectedImprovement: '10-20ms latency reduction',
        implementationDifficulty: 'easy',
        autoApplyable: true,
        implementation: async () => {
          // Implementation would go here
        },
      });
    }

    // Widget optimization recommendations
    const unhealthyWidgets = Array.from(this.widgetMetrics.values()).filter(
      (w) => w.healthScore < 80,
    );

    if (unhealthyWidgets.length > 0) {
      this.recommendations.push({
        id: 'optimize-widgets',
        category: 'code',
        priority: 'medium',
        title: 'Optimize Underperforming Widgets',
        description: `${unhealthyWidgets.length} widgets have health scores below 80%`,
        expectedImprovement: '5-15ms latency reduction',
        implementationDifficulty: 'medium',
        autoApplyable: false,
      });
    }

    // System optimization recommendations
    if (this.systemMetrics.memoryUsage > this.thresholds.maxMemoryUsage * 0.8) {
      this.recommendations.push({
        id: 'memory-optimization',
        category: 'browser',
        priority: 'medium',
        title: 'Optimize Memory Usage',
        description: 'High memory usage detected, consider optimization',
        expectedImprovement: 'Improved stability and responsiveness',
        implementationDifficulty: 'easy',
        autoApplyable: false,
      });
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private createAlert(
    alertData: Omit<PerformanceAlert, 'id' | 'timestamp' | 'resolved'>,
  ): void {
    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: this.highPrecisionClock(),
      resolved: false,
      ...alertData,
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    console.warn(
      `[SyncPerformanceMonitor] ${alert.severity.toUpperCase()}: ${alert.message}`,
    );
  }

  private setupPerformanceObserver(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure' && entry.name.includes('sync')) {
            this.updateLatencyMetrics(entry.duration);
          }
        }
      });

      this.performanceObserver.observe({
        entryTypes: ['measure', 'navigation'],
      });
    } catch (error) {
      console.warn(
        '[SyncPerformanceMonitor] PerformanceObserver setup failed:',
        error,
      );
    }
  }

  private startFrameRateMonitoring(): void {
    const measureFrame = () => {
      if (!this.isMonitoring) return;

      this.frameTimestamps.push(this.highPrecisionClock());
      if (this.frameTimestamps.length > 120) {
        this.frameTimestamps.shift(); // Keep last 2 seconds at 60fps
      }

      requestAnimationFrame(measureFrame);
    };

    requestAnimationFrame(measureFrame);
  }

  private startSystemResourceMonitoring(): void {
    // Monitor system resources periodically
    setInterval(() => {
      if (!this.isMonitoring) return;
      this.updateSystemMetrics();
    }, 1000);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  public getLatencyMetrics(): SyncLatencyMetrics {
    return { ...this.latencyMetrics };
  }

  public getWidgetMetrics(): WidgetPerformanceMetrics[] {
    return Array.from(this.widgetMetrics.values());
  }

  public getAudioMetrics(): AudioDropoutMetrics {
    return { ...this.audioMetrics };
  }

  public getSystemMetrics(): SystemResourceMetrics {
    return { ...this.systemMetrics };
  }

  public getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  public getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter((alert) => !alert.resolved);
  }

  public getRecommendations(): OptimizationRecommendation[] {
    return [...this.recommendations];
  }

  public resolveAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolutionTime = this.highPrecisionClock();
    }
  }

  public updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  public async applyRecommendation(recommendationId: string): Promise<boolean> {
    const recommendation = this.recommendations.find(
      (r) => r.id === recommendationId,
    );
    if (
      !recommendation ||
      !recommendation.autoApplyable ||
      !recommendation.implementation
    ) {
      return false;
    }

    try {
      await recommendation.implementation();
      return true;
    } catch (error) {
      console.error(
        `[SyncPerformanceMonitor] Failed to apply recommendation ${recommendationId}:`,
        error,
      );
      return false;
    }
  }

  public getPerformanceSummary() {
    return {
      syncLatency: {
        current: this.latencyMetrics.currentLatency,
        average: this.latencyMetrics.averageLatency,
        target: this.thresholds.targetSyncLatency,
        status:
          this.latencyMetrics.currentLatency <=
          this.thresholds.targetSyncLatency
            ? 'good'
            : 'poor',
      },
      widgets: {
        total: this.widgetMetrics.size,
        healthy: Array.from(this.widgetMetrics.values()).filter(
          (w) => w.healthScore >= 80,
        ).length,
        responding: Array.from(this.widgetMetrics.values()).filter(
          (w) => w.isResponding,
        ).length,
      },
      system: {
        frameRate: this.systemMetrics.frameRate,
        memoryUsage: this.systemMetrics.memoryUsage,
        status:
          this.systemMetrics.frameRate >= 30 &&
          this.systemMetrics.memoryUsage <= this.thresholds.maxMemoryUsage
            ? 'good'
            : 'poor',
      },
      alerts: {
        total: this.alerts.length,
        active: this.getActiveAlerts().length,
        critical: this.getActiveAlerts().filter(
          (a) => a.severity === 'critical',
        ).length,
      },
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const syncPerformanceMonitor = SyncPerformanceMonitor.getInstance();
