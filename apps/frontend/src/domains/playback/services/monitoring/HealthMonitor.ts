/**
 * HealthMonitor - Health monitoring and alerting system
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 * 
 * Production health monitoring with alerting capabilities
 */

import { EventBus } from '../core/EventBus.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { ProductionLogger } from '../logging/ProductionLogger.js';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'critical';

export interface HealthCheck {
  name: string;
  category: string;
  check: () => Promise<HealthCheckResult>;
  critical?: boolean;
  interval?: number;
  timeout?: number;
}

export interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  duration: number;
  details?: Record<string, any>;
  error?: Error;
}

export interface HealthReport {
  timestamp: number;
  overallStatus: HealthStatus;
  checks: Record<string, HealthCheckResult>;
  metrics: {
    uptime: number;
    checksRun: number;
    failedChecks: number;
    lastError?: string;
  };
}

export interface AlertConfig {
  enabled?: boolean;
  channels?: Array<'console' | 'logger' | 'webhook' | 'email'>;
  webhookUrl?: string;
  emailRecipients?: string[];
  throttleMinutes?: number;
  criticalOnly?: boolean;
}

export class HealthMonitor {
  private eventBus: EventBus;
  private logger: ProductionLogger;
  private checks: Map<string, HealthCheck> = new Map();
  private checkTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastResults: Map<string, HealthCheckResult> = new Map();
  private alertConfig: Required<AlertConfig>;
  private alertThrottle: Map<string, number> = new Map();
  private startTime: number;
  private checksRunCount = 0;
  private failedChecksCount = 0;
  private isMonitoring = false;

  constructor(
    eventBus: EventBus,
    logger: ProductionLogger,
    alertConfig: AlertConfig = {}
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.alertConfig = {
      enabled: true,
      channels: ['logger', 'webhook'],
      webhookUrl: '/api/health/alerts',
      emailRecipients: [],
      throttleMinutes: 5,
      criticalOnly: false,
      ...alertConfig
    };
    
    this.startTime = Date.now();
    this.registerDefaultChecks();
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    // Audio context health
    this.registerCheck({
      name: 'audio-context',
      category: 'audio',
      critical: true,
      interval: 30000, // 30 seconds
      check: async () => {
        const start = performance.now();
        
        try {
          const audioEngine = this.getAudioEngine();
          if (!audioEngine || !audioEngine.isReady()) {
            return {
              status: 'critical',
              message: 'Audio engine not initialized',
              duration: performance.now() - start
            };
          }

          const context = audioEngine.getContext();
          const state = context.state;
          
          if (state === 'running') {
            return {
              status: 'healthy',
              message: 'Audio context is running',
              duration: performance.now() - start,
              details: {
                sampleRate: context.sampleRate,
                baseLatency: context.baseLatency,
                outputLatency: context.outputLatency
              }
            };
          } else if (state === 'suspended') {
            return {
              status: 'degraded',
              message: 'Audio context is suspended',
              duration: performance.now() - start,
              details: { state }
            };
          } else {
            return {
              status: 'unhealthy',
              message: `Audio context in unexpected state: ${state}`,
              duration: performance.now() - start,
              details: { state }
            };
          }
        } catch (error) {
          return {
            status: 'critical',
            message: 'Failed to check audio context',
            duration: performance.now() - start,
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
    });

    // Memory usage check
    this.registerCheck({
      name: 'memory-usage',
      category: 'performance',
      interval: 60000, // 1 minute
      check: async () => {
        const start = performance.now();
        
        if (!performance.memory) {
          return {
            status: 'healthy',
            message: 'Memory monitoring not available',
            duration: performance.now() - start
          };
        }

        const used = performance.memory.usedJSHeapSize / (1024 * 1024);
        const limit = performance.memory.jsHeapSizeLimit / (1024 * 1024);
        const percentage = (used / limit) * 100;

        let status: HealthStatus;
        if (percentage < 70) {
          status = 'healthy';
        } else if (percentage < 85) {
          status = 'degraded';
        } else if (percentage < 95) {
          status = 'unhealthy';
        } else {
          status = 'critical';
        }

        return {
          status,
          message: `Memory usage: ${used.toFixed(2)}MB (${percentage.toFixed(1)}%)`,
          duration: performance.now() - start,
          details: {
            usedMB: used,
            limitMB: limit,
            percentage
          }
        };
      }
    });

    // Audio performance check
    this.registerCheck({
      name: 'audio-performance',
      category: 'performance',
      interval: 45000,
      check: async () => {
        const start = performance.now();
        
        try {
          const audioEngine = this.getAudioEngine();
          const metrics = audioEngine?.getPerformanceMetrics();
          
          if (!metrics) {
            return {
              status: 'degraded',
              message: 'Performance metrics not available',
              duration: performance.now() - start
            };
          }

          const dropouts = metrics.audioDropouts || 0;
          const bufferUnderruns = metrics.bufferUnderruns || 0;
          
          let status: HealthStatus;
          if (dropouts === 0 && bufferUnderruns === 0) {
            status = 'healthy';
          } else if (dropouts < 5 && bufferUnderruns < 10) {
            status = 'degraded';
          } else {
            status = 'unhealthy';
          }

          return {
            status,
            message: `Audio performance: ${dropouts} dropouts, ${bufferUnderruns} underruns`,
            duration: performance.now() - start,
            details: metrics
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            message: 'Failed to check audio performance',
            duration: performance.now() - start,
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
    });

    // Error rate check
    this.registerCheck({
      name: 'error-rate',
      category: 'reliability',
      interval: 120000, // 2 minutes
      check: async () => {
        const start = performance.now();
        const stats = this.logger.getStats();
        
        const errorRate = stats.totalLogs > 0 
          ? (stats.errors / stats.totalLogs) * 100 
          : 0;

        let status: HealthStatus;
        if (errorRate < 1) {
          status = 'healthy';
        } else if (errorRate < 5) {
          status = 'degraded';
        } else if (errorRate < 10) {
          status = 'unhealthy';
        } else {
          status = 'critical';
        }

        return {
          status,
          message: `Error rate: ${errorRate.toFixed(2)}%`,
          duration: performance.now() - start,
          details: {
            totalLogs: stats.totalLogs,
            errors: stats.errors,
            errorRate
          }
        };
      }
    });

    // Network connectivity check
    this.registerCheck({
      name: 'network-connectivity',
      category: 'infrastructure',
      interval: 300000, // 5 minutes
      timeout: 5000,
      check: async () => {
        const start = performance.now();
        
        try {
          const response = await fetch('/api/health/ping', {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          });

          if (response.ok) {
            return {
              status: 'healthy',
              message: 'Network connectivity is good',
              duration: performance.now() - start,
              details: {
                responseTime: performance.now() - start,
                status: response.status
              }
            };
          } else {
            return {
              status: 'degraded',
              message: `Network request returned ${response.status}`,
              duration: performance.now() - start,
              details: { status: response.status }
            };
          }
        } catch (error) {
          return {
            status: 'unhealthy',
            message: 'Network connectivity check failed',
            duration: performance.now() - start,
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
    });
  }

  /**
   * Register a health check
   */
  registerCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
    
    if (this.isMonitoring && check.interval) {
      this.startCheckTimer(check);
    }
    
    this.logger.info('health', `Registered health check: ${check.name}`, {
      category: check.category,
      critical: check.critical,
      interval: check.interval
    });
  }

  /**
   * Start monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.logger.info('health', 'Health monitoring started');
    
    // Start all check timers
    for (const check of this.checks.values()) {
      if (check.interval) {
        this.startCheckTimer(check);
      }
    }
    
    // Run initial check
    this.runAllChecks();
    
    this.eventBus.emit('health:monitoring-started', {
      timestamp: Date.now(),
      checks: Array.from(this.checks.keys())
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    // Clear all timers
    for (const timer of this.checkTimers.values()) {
      clearInterval(timer);
    }
    this.checkTimers.clear();
    
    this.logger.info('health', 'Health monitoring stopped');
    this.eventBus.emit('health:monitoring-stopped', {
      timestamp: Date.now()
    });
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<HealthReport> {
    const results: Record<string, HealthCheckResult> = {};
    const promises: Promise<void>[] = [];
    
    for (const [name, check] of this.checks) {
      promises.push(
        this.runCheck(check).then(result => {
          results[name] = result;
        })
      );
    }
    
    await Promise.all(promises);
    
    const report = this.generateReport(results);
    this.processReport(report);
    
    return report;
  }

  /**
   * Run a single health check
   */
  private async runCheck(check: HealthCheck): Promise<HealthCheckResult> {
    this.checksRunCount++;
    
    try {
      const timeout = check.timeout || 10000;
      const result = await Promise.race([
        check.check(),
        new Promise<HealthCheckResult>((_, reject) => 
          setTimeout(() => reject(new Error('Check timeout')), timeout)
        )
      ]);
      
      this.lastResults.set(check.name, result);
      
      if (result.status === 'unhealthy' || result.status === 'critical') {
        this.failedChecksCount++;
      }
      
      return result;
    } catch (error) {
      this.failedChecksCount++;
      
      const result: HealthCheckResult = {
        status: 'critical',
        message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0,
        error: error instanceof Error ? error : new Error(String(error))
      };
      
      this.lastResults.set(check.name, result);
      return result;
    }
  }

  /**
   * Start timer for a check
   */
  private startCheckTimer(check: HealthCheck): void {
    if (!check.interval) return;
    
    // Clear existing timer
    const existingTimer = this.checkTimers.get(check.name);
    if (existingTimer) {
      clearInterval(existingTimer);
    }
    
    // Run immediately
    this.runCheck(check);
    
    // Set up interval
    const timer = setInterval(() => {
      this.runCheck(check);
    }, check.interval);
    
    this.checkTimers.set(check.name, timer);
  }

  /**
   * Generate health report
   */
  private generateReport(results: Record<string, HealthCheckResult>): HealthReport {
    // Determine overall status
    let overallStatus: HealthStatus = 'healthy';
    let hasCritical = false;
    let hasUnhealthy = false;
    let hasDegraded = false;
    
    for (const result of Object.values(results)) {
      if (result.status === 'critical') hasCritical = true;
      if (result.status === 'unhealthy') hasUnhealthy = true;
      if (result.status === 'degraded') hasDegraded = true;
    }
    
    if (hasCritical) {
      overallStatus = 'critical';
    } else if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    }
    
    const lastError = Object.values(results)
      .find(r => r.error)?.error?.message;
    
    return {
      timestamp: Date.now(),
      overallStatus,
      checks: results,
      metrics: {
        uptime: Date.now() - this.startTime,
        checksRun: this.checksRunCount,
        failedChecks: this.failedChecksCount,
        lastError
      }
    };
  }

  /**
   * Process health report
   */
  private processReport(report: HealthReport): void {
    // Log report
    if (report.overallStatus === 'healthy') {
      this.logger.debug('health', 'Health check passed', report);
    } else {
      this.logger.warn('health', `Health check ${report.overallStatus}`, report);
    }
    
    // Send alerts if needed
    if (this.alertConfig.enabled) {
      this.checkAlerts(report);
    }
    
    // Emit to event bus
    this.eventBus.emit('health:report', report);
  }

  /**
   * Check if alerts should be sent
   */
  private checkAlerts(report: HealthReport): void {
    // Check if we should alert
    const shouldAlert = report.overallStatus === 'critical' || 
      (!this.alertConfig.criticalOnly && report.overallStatus === 'unhealthy');
    
    if (!shouldAlert) return;
    
    // Check throttling
    const lastAlert = this.alertThrottle.get(report.overallStatus) || 0;
    const throttleMs = this.alertConfig.throttleMinutes * 60 * 1000;
    
    if (Date.now() - lastAlert < throttleMs) {
      return;
    }
    
    // Send alerts
    this.sendAlerts(report);
    this.alertThrottle.set(report.overallStatus, Date.now());
  }

  /**
   * Send alerts through configured channels
   */
  private async sendAlerts(report: HealthReport): Promise<void> {
    const alertPromises: Promise<void>[] = [];
    
    for (const channel of this.alertConfig.channels) {
      switch (channel) {
        case 'console':
          console.error('🚨 HEALTH ALERT:', report);
          break;
          
        case 'logger':
          this.logger.error('health', `Health alert: ${report.overallStatus}`, undefined, report);
          break;
          
        case 'webhook':
          if (this.alertConfig.webhookUrl) {
            alertPromises.push(this.sendWebhookAlert(report));
          }
          break;
          
        case 'email':
          if (this.alertConfig.emailRecipients?.length) {
            alertPromises.push(this.sendEmailAlert(report));
          }
          break;
      }
    }
    
    await Promise.allSettled(alertPromises);
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(report: HealthReport): Promise<void> {
    try {
      await fetch(this.alertConfig.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'health_alert',
          severity: report.overallStatus,
          timestamp: report.timestamp,
          report
        })
      });
    } catch (error) {
      this.logger.error('health', 'Failed to send webhook alert', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Send email alert (placeholder)
   */
  private async sendEmailAlert(report: HealthReport): Promise<void> {
    // In production, this would integrate with an email service
    this.logger.info('health', 'Email alert would be sent', {
      recipients: this.alertConfig.emailRecipients,
      severity: report.overallStatus
    });
  }

  /**
   * Get audio engine instance
   */
  private getAudioEngine(): AudioEngine | null {
    // This would be injected or retrieved from service registry
    return null;
  }

  /**
   * Get current health status
   */
  getCurrentStatus(): HealthReport {
    const results: Record<string, HealthCheckResult> = {};
    
    for (const [name, result] of this.lastResults) {
      results[name] = result;
    }
    
    return this.generateReport(results);
  }

  /**
   * Export health data
   */
  exportHealthData(): {
    report: HealthReport;
    history: Array<{ name: string; result: HealthCheckResult }>;
  } {
    const report = this.getCurrentStatus();
    const history = Array.from(this.lastResults.entries()).map(([name, result]) => ({
      name,
      result
    }));
    
    return { report, history };
  }

  /**
   * Dispose health monitor
   */
  dispose(): void {
    this.stopMonitoring();
    this.checks.clear();
    this.lastResults.clear();
    this.alertThrottle.clear();
  }
}