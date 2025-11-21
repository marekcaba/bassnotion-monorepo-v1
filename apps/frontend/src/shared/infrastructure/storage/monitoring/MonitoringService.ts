/**
 * Monitoring Service Implementation
 * 
 * Provides comprehensive monitoring for storage infrastructure
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  StoragePerformanceMetrics,
  DetailedHealthStatus,
  AlertNotification,
  MonitoringSession,
} from '@bassnotion/contracts';
import type { 
  IMonitoringService, 
  MonitoringEvent, 
  MonitoringConfig,
  HealthCheck,
  MetricCollector,
} from './IMonitoringService.js';
import { HealthMonitor } from './HealthMonitor.js';
import { PerformanceMetricsCollector } from './PerformanceMetrics.js';

const logger = createStructuredLogger('MonitoringService');

export class MonitoringService implements IMonitoringService {
  private config: MonitoringConfig;
  private healthMonitor: HealthMonitor;
  private metricsCollector: PerformanceMetricsCollector;
  private session: MonitoringSession | null = null;
  private alertHandlers: Set<(alert: AlertNotification) => void> = new Set();
  private events: MonitoringEvent[] = [];
  private isStarted = false;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.healthMonitor = new HealthMonitor(config);
    this.metricsCollector = new PerformanceMetricsCollector();
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (this.isStarted) return;

    try {
      // Create monitoring session
      this.session = {
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        startTime: new Date(),
        config: this.config,
        metrics: [],
        events: [],
        alerts: [],
      };

      // Start health monitoring
      await this.healthMonitor.start();

      // Start metrics collection
      this.metricsCollector.start(this.config.metricsInterval);

      this.isStarted = true;
      logger.info('Monitoring service started', { 
        sessionId: this.session.id,
        config: this.config,
      });

      this.recordEvent({
        type: 'monitoring_started',
        timestamp: new Date(),
        data: { sessionId: this.session.id },
        severity: 'info',
      });
    } catch (error) {
      logger.error('Failed to start monitoring service', error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (!this.isStarted) return;

    try {
      // Stop health monitoring
      await this.healthMonitor.stop();

      // Stop metrics collection
      this.metricsCollector.stop();

      // End session
      if (this.session) {
        this.session.endTime = new Date();
        this.session.summary = {
          duration: this.session.endTime.getTime() - this.session.startTime.getTime(),
          eventsCount: this.events.length,
          alertsCount: this.session.alerts.length,
          healthChecksRun: this.session.metrics.length,
        };
      }

      this.isStarted = false;
      logger.info('Monitoring service stopped', { 
        sessionId: this.session?.id,
        summary: this.session?.summary,
      });

      this.recordEvent({
        type: 'monitoring_stopped',
        timestamp: new Date(),
        data: { sessionId: this.session?.id },
        severity: 'info',
      });
    } catch (error) {
      logger.error('Failed to stop monitoring service', error);
      throw error;
    }
  }

  /**
   * Register health check
   */
  registerHealthCheck(check: HealthCheck): void {
    this.healthMonitor.registerHealthCheck(check);
  }

  /**
   * Register metric collector
   */
  registerMetricCollector(collector: MetricCollector): void {
    this.metricsCollector.registerCollector(collector);
  }

  /**
   * Get current health status
   */
  getHealthStatus(): DetailedHealthStatus {
    return this.healthMonitor.getHealthStatus();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): StoragePerformanceMetrics {
    return this.metricsCollector.getMetrics();
  }

  /**
   * Record custom metric
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.metricsCollector.recordMetric(name, value, tags);
    
    if (this.session) {
      this.session.metrics.push({
        name,
        value,
        timestamp: Date.now(),
        tags,
      });
    }
  }

  /**
   * Record event
   */
  recordEvent(event: MonitoringEvent): void {
    this.events.push(event);
    
    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-500);
    }

    if (this.session) {
      this.session.events.push({
        ...event,
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      });
    }

    logger.debug('Event recorded', {
      type: event.type,
      severity: event.severity,
      correlationId: event.correlationId,
    });

    // Check if event should trigger an alert
    this.checkEventForAlert(event);
  }

  /**
   * Check if event should trigger an alert
   */
  private checkEventForAlert(event: MonitoringEvent): void {
    if (event.severity === 'error' || event.severity === 'critical') {
      const alert: AlertNotification = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'event_alert',
        severity: event.severity === 'critical' ? 'critical' : 'high',
        title: `${event.severity.toUpperCase()}: ${event.type}`,
        message: `Event of type '${event.type}' with severity '${event.severity}' occurred`,
        timestamp: new Date(),
        source: 'MonitoringService',
        metadata: {
          event,
          correlationId: event.correlationId,
        },
      };

      this.triggerAlert(alert);
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(alert: AlertNotification): void {
    logger.warn('Alert triggered', alert);

    if (this.session) {
      this.session.alerts.push(alert);
    }

    // Notify all alert handlers
    for (const handler of this.alertHandlers) {
      try {
        handler(alert);
      } catch (error) {
        logger.error('Alert handler error', error as Error, { alert });
      }
    }
  }

  /**
   * Subscribe to alerts
   */
  subscribeToAlerts(handler: (alert: AlertNotification) => void): () => void {
    this.alertHandlers.add(handler);
    
    return () => {
      this.alertHandlers.delete(handler);
    };
  }

  /**
   * Get monitoring session
   */
  getSession(): MonitoringSession | null {
    return this.session ? { ...this.session } : null;
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit = 100): MonitoringEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Check thresholds and generate alerts
   */
  checkThresholds(): void {
    if (!this.config.alertThresholds) return;

    const metrics = this.getPerformanceMetrics();
    const health = this.getHealthStatus();

    // Check error rate threshold
    if (
      this.config.alertThresholds.errorRate &&
      metrics.availability.errorRate > this.config.alertThresholds.errorRate
    ) {
      this.triggerAlert({
        id: `alert_${Date.now()}_error_rate`,
        type: 'threshold_exceeded',
        severity: 'high',
        title: 'High Error Rate',
        message: `Error rate ${metrics.availability.errorRate.toFixed(2)}% exceeds threshold of ${this.config.alertThresholds.errorRate}%`,
        timestamp: new Date(),
        source: 'MonitoringService',
        metadata: { metrics },
      });
    }

    // Check latency threshold
    if (
      this.config.alertThresholds.latency &&
      metrics.latency.p95 > this.config.alertThresholds.latency
    ) {
      this.triggerAlert({
        id: `alert_${Date.now()}_latency`,
        type: 'threshold_exceeded',
        severity: 'medium',
        title: 'High Latency',
        message: `P95 latency ${metrics.latency.p95}ms exceeds threshold of ${this.config.alertThresholds.latency}ms`,
        timestamp: new Date(),
        source: 'MonitoringService',
        metadata: { metrics },
      });
    }

    // Check component health
    if (health.overallStatus === 'unhealthy') {
      this.triggerAlert({
        id: `alert_${Date.now()}_health`,
        type: 'health_degraded',
        severity: 'critical',
        title: 'System Unhealthy',
        message: 'One or more critical components are unhealthy',
        timestamp: new Date(),
        source: 'MonitoringService',
        metadata: { health },
      });
    }
  }
}