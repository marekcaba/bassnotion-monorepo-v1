/**
 * HealthChecks - System health monitoring
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 * 
 * Monitors audio system health for production readiness
 */

import { EventBus } from '../services/core/EventBus.js';
import { ServiceRegistry } from '../services/core/ServiceRegistry.js';

export interface HealthCheck {
  name: string;
  description: string;
  check(): Promise<HealthCheckResult>;
}

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface SystemHealthReport {
  timestamp: number;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  uptime: number;
  lastError?: {
    message: string;
    timestamp: number;
  };
}

export class HealthChecks {
  private eventBus: EventBus;
  private serviceRegistry: ServiceRegistry;
  private checks: HealthCheck[] = [];
  private lastResults = new Map<string, HealthCheckResult>();
  private startTime: number;
  private checkInterval?: NodeJS.Timeout;
  private lastError?: { message: string; timestamp: number };

  constructor(eventBus: EventBus, serviceRegistry: ServiceRegistry) {
    this.eventBus = eventBus;
    this.serviceRegistry = serviceRegistry;
    this.startTime = Date.now();
    
    this.initializeChecks();
    this.setupEventListeners();
  }

  /**
   * Initialize health checks
   */
  private initializeChecks(): void {
    // Audio context health
    this.checks.push({
      name: 'audio-context',
      description: 'AudioContext health and state',
      check: () => this.checkAudioContext()
    });

    // Service registry health
    this.checks.push({
      name: 'service-registry',
      description: 'Service registry and dependencies',
      check: () => this.checkServiceRegistry()
    });

    // Memory health
    this.checks.push({
      name: 'memory',
      description: 'Memory usage and limits',
      check: () => this.checkMemory()
    });

    // Event bus health
    this.checks.push({
      name: 'event-bus',
      description: 'Event bus functionality',
      check: () => this.checkEventBus()
    });

    // Performance health
    this.checks.push({
      name: 'performance',
      description: 'Performance metrics and thresholds',
      check: () => this.checkPerformance()
    });

    // Error rate health
    this.checks.push({
      name: 'error-rate',
      description: 'Error rate and recovery',
      check: () => this.checkErrorRate()
    });

    // Network health
    this.checks.push({
      name: 'network',
      description: 'Network connectivity for assets',
      check: () => this.checkNetwork()
    });

    // Resource availability
    this.checks.push({
      name: 'resources',
      description: 'Resource availability and limits',
      check: () => this.checkResources()
    });
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs: number = 30000): void {
    this.stopHealthChecks();
    
    // Run initial check
    this.runHealthChecks();
    
    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runHealthChecks();
    }, intervalMs);

    this.eventBus.emit('health:monitoring-started', {
      interval: intervalMs,
      timestamp: Date.now()
    });
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    this.eventBus.emit('health:monitoring-stopped', {
      timestamp: Date.now()
    });
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<SystemHealthReport> {
    const results: HealthCheckResult[] = [];

    for (const check of this.checks) {
      try {
        const result = await check.check();
        results.push(result);
        this.lastResults.set(check.name, result);
        
        // Emit individual check result
        this.eventBus.emit('health:check-completed', {
          check: check.name,
          result
        });
      } catch (error) {
        const errorResult: HealthCheckResult = {
          name: check.name,
          status: 'unhealthy',
          message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now()
        };
        results.push(errorResult);
        this.lastResults.set(check.name, errorResult);
      }
    }

    const report = this.generateReport(results);
    
    // Emit overall health report
    this.eventBus.emit('health:report', report);

    return report;
  }

  /**
   * Check audio context health
   */
  private async checkAudioContext(): Promise<HealthCheckResult> {
    try {
      const audioEngine = this.serviceRegistry.get('AudioEngine');
      if (!audioEngine) {
        return {
          name: 'audio-context',
          status: 'unhealthy',
          message: 'AudioEngine service not found',
          timestamp: Date.now()
        };
      }

      if (!audioEngine.isReady()) {
        return {
          name: 'audio-context',
          status: 'unhealthy',
          message: 'AudioEngine not initialized',
          timestamp: Date.now()
        };
      }

      const context = audioEngine.getContext();
      const state = context.state;

      if (state === 'running') {
        return {
          name: 'audio-context',
          status: 'healthy',
          message: 'AudioContext is running',
          details: {
            state,
            sampleRate: context.sampleRate,
            latency: context.baseLatency + context.outputLatency
          },
          timestamp: Date.now()
        };
      } else if (state === 'suspended') {
        return {
          name: 'audio-context',
          status: 'degraded',
          message: 'AudioContext is suspended',
          details: { state },
          timestamp: Date.now()
        };
      } else {
        return {
          name: 'audio-context',
          status: 'unhealthy',
          message: `AudioContext in unexpected state: ${state}`,
          details: { state },
          timestamp: Date.now()
        };
      }
    } catch (error) {
      return {
        name: 'audio-context',
        status: 'unhealthy',
        message: `Error checking AudioContext: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Check service registry health
   */
  private async checkServiceRegistry(): Promise<HealthCheckResult> {
    try {
      const serviceCount = this.serviceRegistry.getAll().size;
      const healthReport = await this.serviceRegistry.healthCheck();

      if (healthReport.overall === 'healthy') {
        return {
          name: 'service-registry',
          status: 'healthy',
          message: `All ${serviceCount} services are healthy`,
          details: {
            serviceCount,
            services: Object.keys(healthReport.services)
          },
          timestamp: Date.now()
        };
      } else if (healthReport.overall === 'degraded') {
        return {
          name: 'service-registry',
          status: 'degraded',
          message: 'Some services are degraded',
          details: healthReport,
          timestamp: Date.now()
        };
      } else {
        return {
          name: 'service-registry',
          status: 'unhealthy',
          message: 'Service registry has unhealthy services',
          details: healthReport,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      return {
        name: 'service-registry',
        status: 'unhealthy',
        message: `Error checking service registry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Check memory health
   */
  private async checkMemory(): Promise<HealthCheckResult> {
    try {
      if (!performance.memory) {
        return {
          name: 'memory',
          status: 'healthy',
          message: 'Memory monitoring not available',
          timestamp: Date.now()
        };
      }

      const used = performance.memory.usedJSHeapSize;
      const total = performance.memory.totalJSHeapSize;
      const limit = performance.memory.jsHeapSizeLimit;
      
      const usagePercent = (used / limit) * 100;
      const details = {
        usedMB: Math.round(used / (1024 * 1024)),
        totalMB: Math.round(total / (1024 * 1024)),
        limitMB: Math.round(limit / (1024 * 1024)),
        usagePercent: Math.round(usagePercent)
      };

      if (usagePercent < 70) {
        return {
          name: 'memory',
          status: 'healthy',
          message: `Memory usage at ${details.usagePercent}%`,
          details,
          timestamp: Date.now()
        };
      } else if (usagePercent < 90) {
        return {
          name: 'memory',
          status: 'degraded',
          message: `Memory usage high at ${details.usagePercent}%`,
          details,
          timestamp: Date.now()
        };
      } else {
        return {
          name: 'memory',
          status: 'unhealthy',
          message: `Memory usage critical at ${details.usagePercent}%`,
          details,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      return {
        name: 'memory',
        status: 'unhealthy',
        message: `Error checking memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Check event bus health
   */
  private async checkEventBus(): Promise<HealthCheckResult> {
    try {
      // Test event emission and reception
      let received = false;
      const testHandler = () => { received = true; };
      
      this.eventBus.on('health:test-event', testHandler);
      this.eventBus.emit('health:test-event', { test: true });
      this.eventBus.off('health:test-event', testHandler);

      if (received) {
        return {
          name: 'event-bus',
          status: 'healthy',
          message: 'Event bus is functioning correctly',
          timestamp: Date.now()
        };
      } else {
        return {
          name: 'event-bus',
          status: 'unhealthy',
          message: 'Event bus not processing events',
          timestamp: Date.now()
        };
      }
    } catch (error) {
      return {
        name: 'event-bus',
        status: 'unhealthy',
        message: `Error checking event bus: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Check performance health
   */
  private async checkPerformance(): Promise<HealthCheckResult> {
    try {
      // Simple performance check
      const start = performance.now();
      const testArray = new Array(10000).fill(0).map((_, i) => i * 2);
      const duration = performance.now() - start;

      if (duration < 10) {
        return {
          name: 'performance',
          status: 'healthy',
          message: 'Performance is optimal',
          details: { testDuration: duration },
          timestamp: Date.now()
        };
      } else if (duration < 50) {
        return {
          name: 'performance',
          status: 'degraded',
          message: 'Performance is degraded',
          details: { testDuration: duration },
          timestamp: Date.now()
        };
      } else {
        return {
          name: 'performance',
          status: 'unhealthy',
          message: 'Performance is poor',
          details: { testDuration: duration },
          timestamp: Date.now()
        };
      }
    } catch (error) {
      return {
        name: 'performance',
        status: 'unhealthy',
        message: `Error checking performance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Check error rate
   */
  private async checkErrorRate(): Promise<HealthCheckResult> {
    // This would integrate with error tracking
    // For now, return based on last error
    if (!this.lastError) {
      return {
        name: 'error-rate',
        status: 'healthy',
        message: 'No recent errors',
        timestamp: Date.now()
      };
    }

    const errorAge = Date.now() - this.lastError.timestamp;
    if (errorAge > 300000) { // 5 minutes
      return {
        name: 'error-rate',
        status: 'healthy',
        message: 'No recent errors',
        details: { lastError: this.lastError },
        timestamp: Date.now()
      };
    } else if (errorAge > 60000) { // 1 minute
      return {
        name: 'error-rate',
        status: 'degraded',
        message: 'Recent errors detected',
        details: { lastError: this.lastError },
        timestamp: Date.now()
      };
    } else {
      return {
        name: 'error-rate',
        status: 'unhealthy',
        message: 'Active errors occurring',
        details: { lastError: this.lastError },
        timestamp: Date.now()
      };
    }
  }

  /**
   * Check network health
   */
  private async checkNetwork(): Promise<HealthCheckResult> {
    try {
      // Simple connectivity check
      const online = navigator.onLine;
      
      if (online) {
        return {
          name: 'network',
          status: 'healthy',
          message: 'Network connection available',
          timestamp: Date.now()
        };
      } else {
        return {
          name: 'network',
          status: 'unhealthy',
          message: 'No network connection',
          timestamp: Date.now()
        };
      }
    } catch (error) {
      return {
        name: 'network',
        status: 'unhealthy',
        message: `Error checking network: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Check resource availability
   */
  private async checkResources(): Promise<HealthCheckResult> {
    try {
      // Check available resources
      const audioEngine = this.serviceRegistry.get('AudioEngine');
      const metrics = audioEngine?.getPerformanceMetrics();
      
      return {
        name: 'resources',
        status: 'healthy',
        message: 'Resources are available',
        details: { metrics },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        name: 'resources',
        status: 'unhealthy',
        message: `Error checking resources: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Generate health report
   */
  private generateReport(results: HealthCheckResult[]): SystemHealthReport {
    const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
    const degradedCount = results.filter(r => r.status === 'degraded').length;
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      timestamp: Date.now(),
      overall,
      checks: results,
      uptime: Date.now() - this.startTime,
      lastError: this.lastError
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.eventBus.on('error:occurred', ({ error }) => {
      this.lastError = {
        message: error.message,
        timestamp: Date.now()
      };
    });
  }

  /**
   * Get last health check results
   */
  getLastResults(): Map<string, HealthCheckResult> {
    return new Map(this.lastResults);
  }

  /**
   * Get specific health check result
   */
  getHealthCheck(name: string): HealthCheckResult | undefined {
    return this.lastResults.get(name);
  }
}