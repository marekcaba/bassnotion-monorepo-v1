/**
 * Monitoring Types for Storage
 *
 * Types for tracking performance, health, and analytics
 * in the storage infrastructure.
 */

export interface StorageMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    inProgress: number;
  };
  performance: {
    averageLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    slowestOperation: {
      operation: string;
      duration: number;
      timestamp: number;
    };
  };
  bandwidth: {
    uploaded: number;
    downloaded: number;
    cached: number;
  };
  errors: {
    byType: Record<string, number>;
    recent: Array<{
      timestamp: number;
      error: string;
      operation: string;
    }>;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheckTime: number;
  components: {
    connection: ComponentHealth;
    authentication: ComponentHealth;
    storage: ComponentHealth;
    cdn?: ComponentHealth;
  };
  issues: HealthIssue[];
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  metrics?: Record<string, any>;
}

export interface HealthIssue {
  component: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
}

export interface PerformanceAlert {
  id: string;
  type: 'latency' | 'error_rate' | 'bandwidth' | 'availability';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: number;
  acknowledged: boolean;
}

export interface UsageAnalytics {
  period: 'hour' | 'day' | 'week' | 'month';
  storage: {
    totalBytes: number;
    fileCount: number;
    averageFileSize: number;
    byFileType: Record<string, number>;
  };
  operations: {
    uploads: number;
    downloads: number;
    deletes: number;
    lists: number;
  };
  users: {
    activeUsers: number;
    topUsers: Array<{
      userId: string;
      operations: number;
      bandwidth: number;
    }>;
  };
  trends: {
    storageGrowth: number; // percentage
    operationGrowth: number; // percentage
    bandwidthGrowth: number; // percentage
  };
}

export interface IStorageMonitor {
  /**
   * Get current metrics
   */
  getMetrics(): StorageMetrics;

  /**
   * Get health status
   */
  getHealthStatus(): HealthStatus;

  /**
   * Get performance alerts
   */
  getAlerts(acknowledged?: boolean): PerformanceAlert[];

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void;

  /**
   * Get usage analytics
   */
  getUsageAnalytics(period: 'hour' | 'day' | 'week' | 'month'): UsageAnalytics;

  /**
   * Start monitoring
   */
  start(): void;

  /**
   * Stop monitoring
   */
  stop(): void;

  /**
   * Record a metric
   */
  recordMetric(
    metric: string,
    value: number,
    tags?: Record<string, string>,
  ): void;

  /**
   * Record an error
   */
  recordError(error: Error, context?: Record<string, any>): void;
}
