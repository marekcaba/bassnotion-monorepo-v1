/**
 * Monitoring Service Interface
 *
 * Generic monitoring functionality for storage infrastructure
 */

import type {
  StoragePerformanceMetrics,
  DetailedHealthStatus,
  AlertNotification,
  MonitoringSession,
} from '@bassnotion/contracts';

export interface IMonitoringService {
  /**
   * Start monitoring
   */
  start(): Promise<void>;

  /**
   * Stop monitoring
   */
  stop(): Promise<void>;

  /**
   * Get current health status
   */
  getHealthStatus(): DetailedHealthStatus;

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): StoragePerformanceMetrics;

  /**
   * Record custom metric
   */
  recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
  ): void;

  /**
   * Record event
   */
  recordEvent(event: MonitoringEvent): void;

  /**
   * Get monitoring session
   */
  getSession(): MonitoringSession | null;

  /**
   * Subscribe to alerts
   */
  subscribeToAlerts(handler: (alert: AlertNotification) => void): () => void;
}

export interface MonitoringEvent {
  type: string;
  timestamp: Date;
  data: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  correlationId?: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  healthCheckInterval: number;
  alertThresholds?: {
    errorRate?: number;
    latency?: number;
    memoryUsage?: number;
  };
}

export interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
  critical?: boolean;
}

export interface MetricCollector {
  name: string;
  collect: () => Promise<number>;
  unit?: string;
  tags?: Record<string, string>;
}
