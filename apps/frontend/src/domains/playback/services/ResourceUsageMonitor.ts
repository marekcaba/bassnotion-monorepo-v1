import { EventEmitter } from 'events';

/**
 * Resource Usage Monitoring & Alerting System
 *
 * Provides comprehensive monitoring of resource usage with real-time alerting,
 * anomaly detection, and optimization recommendations for audio applications.
 *
 * Features:
 * - Real-time resource consumption monitoring
 * - Configurable alert thresholds and escalation
 * - Trend analysis and anomaly detection
 * - Resource optimization recommendations
 * - Device-specific monitoring strategies
 * - Performance impact analysis
 */

export enum ResourceType {
  MEMORY = 'memory',
  CPU = 'cpu',
  AUDIO_BUFFER = 'audio_buffer',
  AUDIO_CONTEXT = 'audio_context',
  TONE_INSTRUMENT = 'tone_instrument',
  WEB_WORKER = 'web_worker',
  NETWORK_BANDWIDTH = 'network_bandwidth',
  STORAGE = 'storage',
  BATTERY = 'battery',
  THERMAL = 'thermal',
}

export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency',
}

export enum AlertType {
  THRESHOLD_EXCEEDED = 'threshold_exceeded',
  ANOMALY_DETECTED = 'anomaly_detected',
  TREND_ALERT = 'trend_alert',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  LEAK_DETECTED = 'leak_detected',
}

export interface ResourceMetrics {
  resourceType: ResourceType;
  currentUsage: number;
  maxUsage: number;
  averageUsage: number;
  peakUsage: number;
  usageHistory: number[];
  timestamp: number;
  metricUnit: string;
  deviceSpecific?: Record<string, any>;
}

export interface Alert {
  id: string;
  type: AlertType;
  level: AlertLevel;
  resourceType: ResourceType;
  message: string;
  details: {
    currentValue: number;
    threshold: number;
    recommendation?: string;
    automaticAction?: string;
  };
  timestamp: number;
  acknowledged: boolean;
  resolved: boolean;
  escalated: boolean;
}

export interface AlertThreshold {
  resourceType: ResourceType;
  level: AlertLevel;
  threshold: number;
  hysteresis?: number; // Prevent alert flapping
  duration?: number; // Sustained threshold breach
  enabled: boolean;
}

export interface MonitoringConfig {
  samplingInterval: number;
  historyRetention: number;
  alertThresholds: AlertThreshold[];
  enableAnomalyDetection: boolean;
  enableTrendAnalysis: boolean;
  enableAutoOptimization: boolean;
  deviceAdaptive: boolean;
  batteryAware: boolean;
}

export interface UsagePattern {
  resourceType: ResourceType;
  pattern: 'increasing' | 'decreasing' | 'stable' | 'oscillating' | 'irregular';
  confidence: number;
  trend: number; // -1 to 1, negative = decreasing, positive = increasing
  volatility: number;
  predictedPeak?: number;
  timeToExhaustion?: number;
}

export interface OptimizationRecommendation {
  resourceType: ResourceType;
  priority: 'high' | 'medium' | 'low';
  action: string;
  expectedImpact: string;
  implementationComplexity: 'low' | 'medium' | 'high';
  automated: boolean;
  estimate: {
    resourceSaving: number;
    performanceImpact: number;
  };
}

export interface MonitoringStats {
  totalSamples: number;
  totalAlerts: number;
  alertsByLevel: Record<AlertLevel, number>;
  alertsByType: Record<AlertType, number>;
  averageResponseTime: number;
  falsePositiveRate: number;
  optimizationsApplied: number;
  resourcesSaved: Record<ResourceType, number>;
}

export class ResourceUsageMonitor extends EventEmitter {
  private static instance: ResourceUsageMonitor | null = null;
  private config: MonitoringConfig;
  private metrics = new Map<ResourceType, ResourceMetrics>();
  private alerts = new Map<string, Alert>();
  private patterns = new Map<ResourceType, UsagePattern>();
  private thresholds = new Map<string, AlertThreshold>();
  private stats: MonitoringStats;
  private monitoringHandle: NodeJS.Timeout | null = null;
  private analysisHandle: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  private readonly defaultConfig: MonitoringConfig = {
    samplingInterval: 1000, // 1 second
    historyRetention: 300, // 5 minutes of history
    alertThresholds: [
      {
        resourceType: ResourceType.MEMORY,
        level: AlertLevel.WARNING,
        threshold: 0.8,
        enabled: true,
      },
      {
        resourceType: ResourceType.MEMORY,
        level: AlertLevel.CRITICAL,
        threshold: 0.95,
        enabled: true,
      },
      {
        resourceType: ResourceType.CPU,
        level: AlertLevel.WARNING,
        threshold: 0.7,
        enabled: true,
      },
      {
        resourceType: ResourceType.CPU,
        level: AlertLevel.CRITICAL,
        threshold: 0.9,
        enabled: true,
      },
      {
        resourceType: ResourceType.BATTERY,
        level: AlertLevel.WARNING,
        threshold: 0.2,
        enabled: true,
      },
      {
        resourceType: ResourceType.AUDIO_BUFFER,
        level: AlertLevel.WARNING,
        threshold: 0.85,
        enabled: true,
      },
    ],
    enableAnomalyDetection: true,
    enableTrendAnalysis: true,
    enableAutoOptimization: false,
    deviceAdaptive: true,
    batteryAware: true,
  };

  private readonly resourceCollectors: Record<
    ResourceType,
    () => Promise<number>
  > = {
    [ResourceType.MEMORY]: this.collectMemoryUsage.bind(this),
    [ResourceType.CPU]: this.collectCPUUsage.bind(this),
    [ResourceType.AUDIO_BUFFER]: this.collectAudioBufferUsage.bind(this),
    [ResourceType.AUDIO_CONTEXT]: this.collectAudioContextUsage.bind(this),
    [ResourceType.TONE_INSTRUMENT]: this.collectToneInstrumentUsage.bind(this),
    [ResourceType.WEB_WORKER]: this.collectWebWorkerUsage.bind(this),
    [ResourceType.NETWORK_BANDWIDTH]: this.collectNetworkUsage.bind(this),
    [ResourceType.STORAGE]: this.collectStorageUsage.bind(this),
    [ResourceType.BATTERY]: this.collectBatteryUsage.bind(this),
    [ResourceType.THERMAL]: this.collectThermalUsage.bind(this),
  };

  private constructor(config?: Partial<MonitoringConfig>) {
    super();
    this.config = { ...this.defaultConfig, ...config };
    this.stats = this.initializeStats();
    this.setupThresholds();
    this.initializeMetrics();
  }

  public static getInstance(
    config?: Partial<MonitoringConfig>,
  ): ResourceUsageMonitor {
    if (!ResourceUsageMonitor.instance) {
      ResourceUsageMonitor.instance = new ResourceUsageMonitor(config);
    }
    return ResourceUsageMonitor.instance;
  }

  private initializeStats(): MonitoringStats {
    return {
      totalSamples: 0,
      totalAlerts: 0,
      alertsByLevel: {
        [AlertLevel.INFO]: 0,
        [AlertLevel.WARNING]: 0,
        [AlertLevel.CRITICAL]: 0,
        [AlertLevel.EMERGENCY]: 0,
      },
      alertsByType: {} as Record<AlertType, number>,
      averageResponseTime: 0,
      falsePositiveRate: 0,
      optimizationsApplied: 0,
      resourcesSaved: {} as Record<ResourceType, number>,
    };
  }

  private setupThresholds(): void {
    this.config.alertThresholds.forEach((threshold) => {
      const key = `${threshold.resourceType}_${threshold.level}`;
      this.thresholds.set(key, threshold);
    });
  }

  private initializeMetrics(): void {
    Object.values(ResourceType).forEach((resourceType) => {
      this.metrics.set(resourceType, {
        resourceType,
        currentUsage: 0,
        maxUsage: 1,
        averageUsage: 0,
        peakUsage: 0,
        usageHistory: [],
        timestamp: Date.now(),
        metricUnit: this.getMetricUnit(resourceType),
      });
    });
  }

  private getMetricUnit(resourceType: ResourceType): string {
    const units: Record<ResourceType, string> = {
      [ResourceType.MEMORY]: 'MB',
      [ResourceType.CPU]: '%',
      [ResourceType.AUDIO_BUFFER]: 'count',
      [ResourceType.AUDIO_CONTEXT]: 'count',
      [ResourceType.TONE_INSTRUMENT]: 'count',
      [ResourceType.WEB_WORKER]: 'count',
      [ResourceType.NETWORK_BANDWIDTH]: 'Mbps',
      [ResourceType.STORAGE]: 'MB',
      [ResourceType.BATTERY]: '%',
      [ResourceType.THERMAL]: '°C',
    };
    return units[resourceType] || 'units';
  }

  public startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.emit('monitoringStarted', { timestamp: Date.now() });

    // Start resource sampling
    this.monitoringHandle = setInterval(() => {
      this.collectAllMetrics();
    }, this.config.samplingInterval);

    // Start pattern analysis
    if (this.config.enableTrendAnalysis) {
      this.analysisHandle = setInterval(() => {
        this.analyzeUsagePatterns();
      }, this.config.samplingInterval * 10); // Every 10 samples
    }
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringHandle) {
      clearInterval(this.monitoringHandle);
      this.monitoringHandle = null;
    }

    if (this.analysisHandle) {
      clearInterval(this.analysisHandle);
      this.analysisHandle = null;
    }

    this.emit('monitoringStopped', { timestamp: Date.now() });
  }

  private async collectAllMetrics(): Promise<void> {
    const startTime = performance.now();

    try {
      const collectionPromises = Object.entries(this.resourceCollectors).map(
        async ([resourceType, collector]) => {
          try {
            const usage = await collector();
            this.updateResourceMetrics(resourceType as ResourceType, usage);
          } catch (error) {
            console.warn(`Failed to collect ${resourceType} metrics:`, error);
          }
        },
      );

      await Promise.all(collectionPromises);

      this.stats.totalSamples++;
      this.checkThresholds();

      if (this.config.enableAnomalyDetection) {
        this.detectAnomalies();
      }

      const responseTime = performance.now() - startTime;
      this.updateResponseTime(responseTime);
    } catch (error) {
      this.emit('monitoringError', { error, timestamp: Date.now() });
    }
  }

  private updateResourceMetrics(
    resourceType: ResourceType,
    usage: number,
  ): void {
    const metrics = this.metrics.get(resourceType);
    if (!metrics) return;

    metrics.currentUsage = usage;
    metrics.timestamp = Date.now();

    // Update history
    metrics.usageHistory.push(usage);
    if (metrics.usageHistory.length > this.config.historyRetention) {
      metrics.usageHistory.shift();
    }

    // Update statistics
    metrics.peakUsage = Math.max(metrics.peakUsage, usage);
    metrics.averageUsage =
      metrics.usageHistory.reduce((a, b) => a + b, 0) /
      metrics.usageHistory.length;

    this.emit('metricsUpdated', { resourceType, metrics: { ...metrics } });
  }

  private async collectMemoryUsage(): Promise<number> {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
    return 0;
  }

  private async collectCPUUsage(): Promise<number> {
    // Estimate CPU usage using frame timing
    return new Promise((resolve) => {
      const startTime = performance.now();
      requestAnimationFrame(() => {
        const frameTime = performance.now() - startTime;
        const cpuUsage = Math.min((frameTime / 16.67) * 100, 100); // 16.67ms = 60fps
        resolve(cpuUsage);
      });
    });
  }

  private async collectAudioBufferUsage(): Promise<number> {
    // This would be integrated with ResourceManager to get actual buffer count
    return 0; // Placeholder
  }

  private async collectAudioContextUsage(): Promise<number> {
    // This would be integrated with AudioContextManager
    return 0; // Placeholder
  }

  private async collectToneInstrumentUsage(): Promise<number> {
    // This would be integrated with Tone.js resource tracking
    return 0; // Placeholder
  }

  private async collectWebWorkerUsage(): Promise<number> {
    // This would be integrated with WorkerPoolManager
    return 0; // Placeholder
  }

  private async collectNetworkUsage(): Promise<number> {
    // Network usage estimation (would need actual implementation)
    return 0; // Placeholder
  }

  private async collectStorageUsage(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const usedMB = (estimate.usage || 0) / (1024 * 1024);
        return usedMB;
      } catch {
        return 0;
      }
    }
    return 0;
  }

  private async collectBatteryUsage(): Promise<number> {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        return battery.level * 100; // Convert to percentage
      } catch {
        return 100; // Assume full battery if unavailable
      }
    }
    return 100;
  }

  private async collectThermalUsage(): Promise<number> {
    // Thermal monitoring (limited browser support)
    return 25; // Placeholder normal temperature
  }

  private checkThresholds(): void {
    this.metrics.forEach((metrics, resourceType) => {
      const usage = metrics.currentUsage;
      const normalizedUsage = this.normalizeUsage(resourceType, usage);

      // Check each threshold level for this resource type
      Object.values(AlertLevel).forEach((level) => {
        const thresholdKey = `${resourceType}_${level}`;
        const threshold = this.thresholds.get(thresholdKey);

        if (
          threshold &&
          threshold.enabled &&
          normalizedUsage > threshold.threshold
        ) {
          this.createThresholdAlert(
            resourceType,
            level,
            normalizedUsage,
            threshold.threshold,
          );
        }
      });
    });
  }

  private normalizeUsage(resourceType: ResourceType, usage: number): number {
    const metrics = this.metrics.get(resourceType);
    if (!metrics) return 0;

    // Normalize to 0-1 range based on expected maximum
    switch (resourceType) {
      case ResourceType.MEMORY:
        // Assume 2GB as typical max for web apps
        return Math.min(usage / (2 * 1024), 1);
      case ResourceType.CPU:
        return Math.min(usage / 100, 1);
      case ResourceType.BATTERY:
        return 1 - usage / 100; // Inverted: low battery = high alert
      default:
        return Math.min(usage / 100, 1);
    }
  }

  private createThresholdAlert(
    resourceType: ResourceType,
    level: AlertLevel,
    currentValue: number,
    threshold: number,
  ): void {
    const alertId = `${resourceType}_${level}_${Date.now()}`;

    const alert: Alert = {
      id: alertId,
      type: AlertType.THRESHOLD_EXCEEDED,
      level,
      resourceType,
      message: this.generateAlertMessage(
        resourceType,
        level,
        currentValue,
        threshold,
      ),
      details: {
        currentValue,
        threshold,
        recommendation: this.generateRecommendation(resourceType, level),
        automaticAction: this.getAutomaticAction(resourceType, level),
      },
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false,
      escalated: false,
    };

    this.alerts.set(alertId, alert);
    this.updateAlertStats(alert);
    this.emit('alertCreated', alert);

    // Handle automatic actions
    if (this.config.enableAutoOptimization && alert.details.automaticAction) {
      this.executeAutomaticAction(alert);
    }
  }

  private generateAlertMessage(
    resourceType: ResourceType,
    level: AlertLevel,
    currentValue: number,
    threshold: number,
  ): string {
    const resourceName = resourceType.replace('_', ' ').toUpperCase();
    const unit = this.getMetricUnit(resourceType);

    return (
      `${level.toUpperCase()}: ${resourceName} usage (${currentValue.toFixed(2)}${unit}) ` +
      `exceeded ${level} threshold (${threshold.toFixed(2)}${unit})`
    );
  }

  private generateRecommendation(
    resourceType: ResourceType,
    level: AlertLevel,
  ): string {
    const recommendations: Record<ResourceType, Record<AlertLevel, string>> = {
      [ResourceType.MEMORY]: {
        [AlertLevel.INFO]: 'Monitor memory usage trends',
        [AlertLevel.WARNING]: 'Consider clearing unused audio buffers',
        [AlertLevel.CRITICAL]: 'Immediately dispose unused resources',
        [AlertLevel.EMERGENCY]: 'Force garbage collection and resource cleanup',
      },
      [ResourceType.CPU]: {
        [AlertLevel.INFO]: 'Monitor CPU usage patterns',
        [AlertLevel.WARNING]: 'Reduce audio processing complexity',
        [AlertLevel.CRITICAL]: 'Disable non-essential audio effects',
        [AlertLevel.EMERGENCY]: 'Switch to low-CPU fallback mode',
      },
      [ResourceType.BATTERY]: {
        [AlertLevel.INFO]: 'Monitor battery drain',
        [AlertLevel.WARNING]: 'Enable battery optimization mode',
        [AlertLevel.CRITICAL]: 'Reduce audio quality and processing',
        [AlertLevel.EMERGENCY]: 'Switch to minimal power mode',
      },
    } as any;

    return recommendations[resourceType]?.[level] || 'Monitor resource usage';
  }

  private getAutomaticAction(
    resourceType: ResourceType,
    level: AlertLevel,
  ): string | undefined {
    if (!this.config.enableAutoOptimization) return undefined;

    const actions: Record<
      ResourceType,
      Record<AlertLevel, string | undefined>
    > = {
      [ResourceType.MEMORY]: {
        [AlertLevel.CRITICAL]: 'trigger_gc',
        [AlertLevel.EMERGENCY]: 'force_resource_cleanup',
      },
      [ResourceType.CPU]: {
        [AlertLevel.CRITICAL]: 'reduce_audio_quality',
        [AlertLevel.EMERGENCY]: 'enable_fallback_mode',
      },
      [ResourceType.BATTERY]: {
        [AlertLevel.WARNING]: 'enable_battery_mode',
        [AlertLevel.CRITICAL]: 'reduce_processing',
      },
    } as any;

    return actions[resourceType]?.[level];
  }

  private executeAutomaticAction(alert: Alert): void {
    const action = alert.details.automaticAction;
    if (!action) return;

    this.emit('automaticActionTriggered', {
      alertId: alert.id,
      action,
      resourceType: alert.resourceType,
    });

    // Actions would be implemented based on specific needs
    switch (action) {
      case 'trigger_gc':
        this.emit('triggerGarbageCollection');
        break;
      case 'force_resource_cleanup':
        this.emit('forceResourceCleanup');
        break;
      case 'reduce_audio_quality':
        this.emit('reduceAudioQuality');
        break;
      case 'enable_battery_mode':
        this.emit('enableBatteryMode');
        break;
    }

    this.stats.optimizationsApplied++;
  }

  private detectAnomalies(): void {
    this.metrics.forEach((metrics, resourceType) => {
      if (metrics.usageHistory.length < 30) return; // Need sufficient data

      const recent = metrics.usageHistory.slice(-10);
      const historical = metrics.usageHistory.slice(0, -10);

      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const historicalAvg =
        historical.reduce((a, b) => a + b, 0) / historical.length;

      // Detect significant deviation (more than 2 standard deviations)
      const historicalStdDev = this.calculateStandardDeviation(historical);
      const threshold = historicalAvg + 2 * historicalStdDev;

      if (recentAvg > threshold) {
        this.createAnomalyAlert(resourceType, recentAvg, threshold);
      }
    });
  }

  private calculateStandardDeviation(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((value) => Math.pow(value - avg, 2));
    const avgSquaredDiff =
      squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    return Math.sqrt(avgSquaredDiff);
  }

  private createAnomalyAlert(
    resourceType: ResourceType,
    currentValue: number,
    threshold: number,
  ): void {
    const alertId = `anomaly_${resourceType}_${Date.now()}`;

    const alert: Alert = {
      id: alertId,
      type: AlertType.ANOMALY_DETECTED,
      level: AlertLevel.WARNING,
      resourceType,
      message: `Anomalous ${resourceType} usage pattern detected`,
      details: {
        currentValue,
        threshold,
        recommendation: 'Investigate recent changes in resource usage patterns',
      },
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false,
      escalated: false,
    };

    this.alerts.set(alertId, alert);
    this.updateAlertStats(alert);
    this.emit('anomalyDetected', alert);
  }

  private analyzeUsagePatterns(): void {
    this.metrics.forEach((metrics, resourceType) => {
      if (metrics.usageHistory.length < 10) return;

      const pattern = this.identifyPattern(metrics.usageHistory);
      this.patterns.set(resourceType, pattern);

      if (pattern.confidence > 0.8) {
        this.emit('patternIdentified', { resourceType, pattern });

        // Generate trend alerts if needed
        if (pattern.pattern === 'increasing' && pattern.trend > 0.7) {
          this.createTrendAlert(resourceType, pattern);
        }
      }
    });
  }

  private identifyPattern(history: number[]): UsagePattern {
    const recent = history.slice(-20); // Last 20 samples
    if (recent.length < 10) {
      return {
        resourceType: ResourceType.MEMORY, // Placeholder
        pattern: 'irregular',
        confidence: 0,
        trend: 0,
        volatility: 0,
      };
    }

    // Calculate trend using linear regression
    const trend = this.calculateTrend(recent);
    const volatility =
      this.calculateStandardDeviation(recent) /
      (recent.reduce((a, b) => a + b, 0) / recent.length);

    let pattern: UsagePattern['pattern'] = 'stable';
    let confidence = 0.5;

    if (Math.abs(trend) > 0.1) {
      pattern = trend > 0 ? 'increasing' : 'decreasing';
      confidence = Math.min(Math.abs(trend) * 2, 1);
    } else if (volatility > 0.3) {
      pattern = 'oscillating';
      confidence = Math.min(volatility, 1);
    } else if (volatility < 0.1) {
      pattern = 'stable';
      confidence = 1 - volatility;
    } else {
      pattern = 'irregular';
      confidence = 0.3;
    }

    return {
      resourceType: ResourceType.MEMORY, // Will be set by caller
      pattern,
      confidence,
      trend,
      volatility,
    };
  }

  private calculateTrend(values: number[]): number {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    const numerator = x.reduce((sum, xi, i) => {
      const value = values[i];
      return value !== undefined ? sum + (xi - xMean) * (value - yMean) : sum;
    }, 0);
    const denominator = x.reduce((sum, xi) => sum + Math.pow(xi - xMean, 2), 0);

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private createTrendAlert(
    resourceType: ResourceType,
    pattern: UsagePattern,
  ): void {
    const alertId = `trend_${resourceType}_${Date.now()}`;

    const alert: Alert = {
      id: alertId,
      type: AlertType.TREND_ALERT,
      level: AlertLevel.INFO,
      resourceType,
      message: `${resourceType} usage shows ${pattern.pattern} trend`,
      details: {
        currentValue: pattern.trend,
        threshold: 0.5,
        recommendation: `Monitor ${resourceType} usage and consider optimization`,
      },
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false,
      escalated: false,
    };

    this.alerts.set(alertId, alert);
    this.updateAlertStats(alert);
    this.emit('trendAlert', alert);
  }

  private updateAlertStats(alert: Alert): void {
    this.stats.totalAlerts++;
    this.stats.alertsByLevel[alert.level]++;

    if (!this.stats.alertsByType[alert.type]) {
      this.stats.alertsByType[alert.type] = 0;
    }
    this.stats.alertsByType[alert.type]++;
  }

  private updateResponseTime(responseTime: number): void {
    const totalResponseTime =
      this.stats.averageResponseTime * (this.stats.totalSamples - 1);
    this.stats.averageResponseTime =
      (totalResponseTime + responseTime) / this.stats.totalSamples;
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alertAcknowledged', alert);
      return true;
    }
    return false;
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((alert) => !alert.resolved);
  }

  public getMetrics(
    resourceType?: ResourceType,
  ): ResourceMetrics | ResourceMetrics[] | null {
    if (resourceType) {
      return this.metrics.get(resourceType) || null;
    }
    return Array.from(this.metrics.values());
  }

  public getUsagePatterns(): Map<ResourceType, UsagePattern> {
    return new Map(this.patterns);
  }

  public getStats(): MonitoringStats {
    return { ...this.stats };
  }

  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.setupThresholds();
    this.emit('configUpdated', this.config);
  }

  public generateOptimizationRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    this.patterns.forEach((pattern, resourceType) => {
      if (pattern.pattern === 'increasing' && pattern.confidence > 0.7) {
        recommendations.push({
          resourceType,
          priority: 'high',
          action: `Optimize ${resourceType} usage to prevent resource exhaustion`,
          expectedImpact: `Reduce ${resourceType} consumption by 15-30%`,
          implementationComplexity: 'medium',
          automated: false,
          estimate: {
            resourceSaving: 25,
            performanceImpact: 5,
          },
        });
      }
    });

    return recommendations;
  }

  public destroy(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    ResourceUsageMonitor.instance = null;
  }
}

export default ResourceUsageMonitor;
