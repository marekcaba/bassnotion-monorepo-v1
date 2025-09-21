/**
 * Health Monitor
 * 
 * Monitors health of storage infrastructure components
 * Extracted from playback domain for shared use
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  DetailedHealthStatus,
  ComponentHealth,
  HealthIssue,
} from '@bassnotion/contracts';
import type { HealthCheck, MonitoringConfig } from './IMonitoringService.js';

const logger = createStructuredLogger('HealthMonitor');

export class HealthMonitor {
  private config: MonitoringConfig;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private healthStatus: DetailedHealthStatus;
  private checkInterval?: NodeJS.Timeout;
  private isRunning = false;
  private lastCheckTime = 0;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.healthStatus = this.initializeHealthStatus();
  }

  private initializeHealthStatus(): DetailedHealthStatus {
    return {
      timestamp: Date.now(),
      overallStatus: 'healthy',
      components: new Map(),
      issues: [],
      lastSuccessfulCheck: Date.now(),
      checkDuration: 0,
      metadata: {},
    };
  }

  /**
   * Register a health check
   */
  registerHealthCheck(check: HealthCheck): void {
    this.healthChecks.set(check.name, check);
    
    // Initialize component health
    this.healthStatus.components.set(check.name, {
      status: 'unknown',
      lastCheck: Date.now(),
      responseTime: 0,
      issues: [],
      metadata: {},
    });

    logger.info('Health check registered', { name: check.name, critical: check.critical });
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Health monitor started', { 
      checkCount: this.healthChecks.size,
      interval: this.config.healthCheckInterval,
    });

    // Run initial health check
    await this.runHealthChecks();

    // Schedule periodic checks
    if (this.config.enabled) {
      this.checkInterval = setInterval(() => {
        this.runHealthChecks().catch((error) => {
          logger.error('Health check failed', error);
        });
      }, this.config.healthCheckInterval);
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    logger.info('Health monitor stopped');
  }

  /**
   * Run all health checks
   */
  private async runHealthChecks(): Promise<void> {
    const startTime = Date.now();
    const issues: HealthIssue[] = [];
    const componentStatuses: Array<'healthy' | 'degraded' | 'unhealthy'> = [];

    for (const [name, check] of this.healthChecks) {
      const checkStartTime = Date.now();
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      const componentIssues: HealthIssue[] = [];

      try {
        const isHealthy = await Promise.race([
          check.check(),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          ),
        ]);

        if (!isHealthy) {
          status = check.critical ? 'unhealthy' : 'degraded';
          componentIssues.push({
            component: name,
            severity: check.critical ? 'critical' : 'warning',
            message: `Health check failed for ${name}`,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        status = check.critical ? 'unhealthy' : 'degraded';
        componentIssues.push({
          component: name,
          severity: check.critical ? 'critical' : 'error',
          message: `Health check error: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
          error,
        });
      }

      const responseTime = Date.now() - checkStartTime;

      // Update component health
      this.healthStatus.components.set(name, {
        status,
        lastCheck: Date.now(),
        responseTime,
        issues: componentIssues,
        metadata: {},
      });

      componentStatuses.push(status);
      issues.push(...componentIssues);
    }

    // Calculate overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (componentStatuses.some((s) => s === 'unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (componentStatuses.some((s) => s === 'degraded')) {
      overallStatus = 'degraded';
    }

    // Update health status
    this.healthStatus = {
      timestamp: Date.now(),
      overallStatus,
      components: this.healthStatus.components,
      issues,
      lastSuccessfulCheck: issues.length === 0 ? Date.now() : this.healthStatus.lastSuccessfulCheck,
      checkDuration: Date.now() - startTime,
      metadata: {
        checksRun: this.healthChecks.size,
        failedChecks: issues.length,
      },
    };

    this.lastCheckTime = Date.now();

    if (issues.length > 0) {
      logger.warn('Health issues detected', { 
        issues: issues.length, 
        overallStatus,
      });
    } else {
      logger.debug('Health check completed', { 
        duration: this.healthStatus.checkDuration,
        status: overallStatus,
      });
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus(): DetailedHealthStatus {
    return {
      ...this.healthStatus,
      components: new Map(this.healthStatus.components),
      issues: [...this.healthStatus.issues],
    };
  }

  /**
   * Check if specific component is healthy
   */
  isComponentHealthy(componentName: string): boolean {
    const component = this.healthStatus.components.get(componentName);
    return component?.status === 'healthy';
  }

  /**
   * Get component health
   */
  getComponentHealth(componentName: string): ComponentHealth | undefined {
    return this.healthStatus.components.get(componentName);
  }

  /**
   * Force health check
   */
  async checkHealth(): Promise<DetailedHealthStatus> {
    await this.runHealthChecks();
    return this.getHealthStatus();
  }

  /**
   * Get last check time
   */
  getLastCheckTime(): number {
    return this.lastCheckTime;
  }
}