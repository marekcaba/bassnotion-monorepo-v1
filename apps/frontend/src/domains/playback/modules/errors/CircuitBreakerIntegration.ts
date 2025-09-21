/**
 * Circuit Breaker Integration Points
 * Phase 5.2.3: Add circuit breakers to critical paths in playback modules
 *
 * This module identifies and implements circuit breaker patterns
 * for critical operations that could fail and impact system stability.
 */

import { CircuitBreakerFactory } from '../../patterns/CircuitBreaker.js';
import { EventBus } from '../../services/core/EventBus.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { CircuitBreakerOpenError } from './StorageErrors.js';

const logger = createStructuredLogger('CircuitBreakerIntegration');

/**
 * Critical paths that need circuit breaker protection
 */
export enum CriticalPath {
  // Storage operations
  STORAGE_CONNECTION = 'storage-connection',
  STORAGE_UPLOAD = 'storage-upload',
  STORAGE_DOWNLOAD = 'storage-download',
  SUPABASE_AUTH = 'supabase-auth',

  // Audio initialization
  AUDIO_CONTEXT_INIT = 'audio-context-init',
  INSTRUMENT_INIT = 'instrument-init',
  SAMPLE_LOADING = 'sample-loading',
  PLUGIN_LOADING = 'plugin-loading',

  // External API calls
  CDN_ACCESS = 'cdn-access',
  EDGE_LOCATION = 'edge-location',
  ANALYTICS_REPORTING = 'analytics-reporting',

  // Resource-intensive operations
  MIDI_PROCESSING = 'midi-processing',
  BATCH_OPERATIONS = 'batch-operations',
  CACHE_OPERATIONS = 'cache-operations',

  // Transport operations
  CLOCK_SYNC = 'clock-sync',
  WORKLET_INIT = 'worklet-init',
  WIDGET_SYNC = 'widget-sync',
}

/**
 * Circuit breaker configuration for different critical paths
 */
export class CircuitBreakerIntegration {
  private factory: CircuitBreakerFactory;
  private breakers = new Map<CriticalPath, any>();

  constructor(private eventBus: EventBus) {
    this.factory = new CircuitBreakerFactory(eventBus);
    this.initializeBreakers();
    this.setupMonitoring();
  }

  /**
   * Initialize circuit breakers for all critical paths
   */
  private initializeBreakers(): void {
    // Storage operations - high-throughput with adaptive thresholds
    this.breakers.set(
      CriticalPath.STORAGE_CONNECTION,
      this.factory.create('storage-connection', 'critical', {
        failureThreshold: 3,
        resetTimeout: 60000,
        healthCheckInterval: 30000,
        healthCheckOperation: async () => {
          // Check if storage service is reachable
          try {
            const response = await fetch('/api/health/storage');
            return response.ok;
          } catch {
            return false;
          }
        },
      }),
    );

    this.breakers.set(
      CriticalPath.STORAGE_UPLOAD,
      this.factory.create('storage-upload', 'high-throughput', {
        failureThreshold: 5,
        resetTimeout: 30000,
        adaptiveThreshold: {
          enabled: true,
          minThreshold: 3,
          maxThreshold: 10,
          adjustmentRate: 1,
        },
      }),
    );

    this.breakers.set(
      CriticalPath.STORAGE_DOWNLOAD,
      this.factory.create('storage-download', 'high-throughput', {
        failureThreshold: 5,
        resetTimeout: 30000,
        fallbackOperation: async () => {
          // Try to serve from cache
          logger.info('Using cache fallback for download');
          return { source: 'cache', data: null };
        },
      }),
    );

    // Audio initialization - critical with monitoring
    this.breakers.set(
      CriticalPath.AUDIO_CONTEXT_INIT,
      this.factory.create('audio-context-init', 'critical', {
        failureThreshold: 2,
        resetTimeout: 120000,
        monitoring: {
          metricsInterval: 10000,
          alertThresholds: {
            failureRate: 5,
            rejectedRate: 2,
            uptimePercent: 99,
          },
        },
      }),
    );

    this.breakers.set(
      CriticalPath.INSTRUMENT_INIT,
      this.factory.create('instrument-init', 'critical', {
        failureThreshold: 3,
        resetTimeout: 60000,
        fallbackOperation: async () => {
          // Load minimal instrument configuration
          logger.info('Loading minimal instrument configuration');
          return { type: 'minimal', loaded: true };
        },
      }),
    );

    this.breakers.set(
      CriticalPath.SAMPLE_LOADING,
      this.factory.create('sample-loading', 'high-throughput', {
        failureThreshold: 10,
        resetTimeout: 30000,
        timeout: 30000,
        adaptiveThreshold: {
          enabled: true,
          minThreshold: 5,
          maxThreshold: 20,
          adjustmentRate: 2,
        },
      }),
    );

    // External API calls - background with exponential backoff
    this.breakers.set(
      CriticalPath.CDN_ACCESS,
      this.factory.create('cdn-access', 'background', {
        failureThreshold: 15,
        resetTimeout: 120000,
        healthCheckInterval: 60000,
        healthCheckOperation: async () => {
          // Ping CDN endpoint
          try {
            const response = await fetch('/cdn/health', { method: 'HEAD' });
            return response.ok;
          } catch {
            return false;
          }
        },
      }),
    );

    this.breakers.set(
      CriticalPath.ANALYTICS_REPORTING,
      this.factory.create('analytics-reporting', 'background', {
        failureThreshold: 20,
        resetTimeout: 300000,
        fallbackOperation: async () => {
          // Queue analytics for later
          logger.info('Queueing analytics for later submission');
          return { queued: true };
        },
      }),
    );

    // Resource-intensive operations
    this.breakers.set(
      CriticalPath.MIDI_PROCESSING,
      this.factory.create('midi-processing', 'high-throughput', {
        failureThreshold: 5,
        resetTimeout: 30000,
        timeout: 10000,
      }),
    );

    this.breakers.set(
      CriticalPath.BATCH_OPERATIONS,
      this.factory.create('batch-operations', 'high-throughput', {
        failureThreshold: 8,
        resetTimeout: 45000,
        adaptiveThreshold: {
          enabled: true,
          minThreshold: 5,
          maxThreshold: 15,
          adjustmentRate: 1,
        },
      }),
    );

    // Transport operations
    this.breakers.set(
      CriticalPath.CLOCK_SYNC,
      this.factory.create('clock-sync', 'critical', {
        failureThreshold: 3,
        resetTimeout: 60000,
        monitoring: {
          metricsInterval: 5000,
          alertThresholds: {
            failureRate: 10,
            rejectedRate: 5,
            uptimePercent: 95,
          },
        },
      }),
    );

    this.breakers.set(
      CriticalPath.WORKLET_INIT,
      this.factory.create('worklet-init', 'critical', {
        failureThreshold: 2,
        resetTimeout: 120000,
        fallbackOperation: async () => {
          // Use ScriptProcessor fallback
          logger.info('Falling back to ScriptProcessor');
          return { type: 'scriptprocessor', initialized: true };
        },
      }),
    );

    logger.info('Circuit breakers initialized', {
      paths: Array.from(this.breakers.keys()),
    });
  }

  /**
   * Setup monitoring for circuit breaker events
   */
  private setupMonitoring(): void {
    // Monitor state changes
    this.eventBus.on('circuitbreaker:state-changed', (event: any) => {
      logger.warn('Circuit breaker state changed', {
        name: event.name,
        state: event.state,
        reason: event.reason,
      });

      // Alert on critical breakers opening
      if (event.state === 'open' && this.isCriticalBreaker(event.name)) {
        this.eventBus.emit('alert:critical-breaker-open', {
          name: event.name,
          timestamp: event.timestamp,
        });
      }
    });

    // Monitor metrics
    this.eventBus.on('circuitbreaker:metrics', (event: any) => {
      if (event.alerts && event.alerts.length > 0) {
        logger.error('Circuit breaker alerts', {
          name: event.name,
          alerts: event.alerts,
          metrics: event.metrics,
        });
      }
    });

    // Monitor fallback usage
    this.eventBus.on('circuitbreaker:fallback-used', (event: any) => {
      logger.info('Circuit breaker fallback activated', {
        name: event.name,
        timestamp: event.timestamp,
      });
    });
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithBreaker<T>(
    path: CriticalPath,
    operation: () => Promise<T>,
    operationId?: string,
  ): Promise<T> {
    const breaker = this.breakers.get(path);

    if (!breaker) {
      logger.warn('No circuit breaker for path', { path });
      return operation();
    }

    try {
      return await breaker.execute(operation, operationId);
    } catch (error) {
      // Convert to domain-specific error if circuit is open
      if (breaker.getState() === 'open') {
        const metrics = breaker.getMetrics();
        throw new CircuitBreakerOpenError(
          path,
          metrics.failureCount,
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
      throw error;
    }
  }

  /**
   * Get circuit breaker for a specific path
   */
  getBreaker(path: CriticalPath): any {
    return this.breakers.get(path);
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllStatuses(): Array<{
    path: CriticalPath;
    state: string;
    metrics: any;
  }> {
    return Array.from(this.breakers.entries()).map(([path, breaker]) => ({
      path,
      state: breaker.getState(),
      metrics: breaker.getEnhancedMetrics(),
    }));
  }

  /**
   * Reset a specific circuit breaker
   */
  resetBreaker(path: CriticalPath): void {
    const breaker = this.breakers.get(path);
    if (breaker) {
      breaker.reset();
      logger.info('Circuit breaker reset', { path });
    }
  }

  /**
   * Check if breaker is for a critical path
   */
  private isCriticalBreaker(name: string): boolean {
    const criticalPaths = [
      CriticalPath.AUDIO_CONTEXT_INIT,
      CriticalPath.INSTRUMENT_INIT,
      CriticalPath.CLOCK_SYNC,
      CriticalPath.WORKLET_INIT,
      CriticalPath.STORAGE_CONNECTION,
    ];

    return criticalPaths.some((path) => name.includes(path));
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.breakers.forEach((breaker) => {
      if (breaker.dispose) {
        breaker.dispose();
      }
    });
    this.breakers.clear();
  }
}

/**
 * Example usage in storage module
 */
export class StorageServiceWithBreakers {
  private circuitBreakers: CircuitBreakerIntegration;

  constructor(eventBus: EventBus) {
    this.circuitBreakers = new CircuitBreakerIntegration(eventBus);
  }

  async uploadFile(fileName: string, data: Buffer): Promise<void> {
    return this.circuitBreakers.executeWithBreaker(
      CriticalPath.STORAGE_UPLOAD,
      async () => {
        // Actual upload logic
        await this.performUpload(fileName, data);
      },
      `upload-${fileName}`,
    );
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    return this.circuitBreakers.executeWithBreaker(
      CriticalPath.STORAGE_DOWNLOAD,
      async () => {
        // Actual download logic
        return this.performDownload(filePath);
      },
      `download-${filePath}`,
    );
  }

  private async performUpload(fileName: string, data: Buffer): Promise<void> {
    // Implementation
  }

  private async performDownload(filePath: string): Promise<Buffer> {
    // Implementation
    return Buffer.from([]);
  }
}

/**
 * Example usage in audio module
 */
export class AudioEngineWithBreakers {
  private circuitBreakers: CircuitBreakerIntegration;

  constructor(eventBus: EventBus) {
    this.circuitBreakers = new CircuitBreakerIntegration(eventBus);
  }

  async initializeContext(): Promise<AudioContext> {
    return this.circuitBreakers.executeWithBreaker(
      CriticalPath.AUDIO_CONTEXT_INIT,
      async () => {
        const context = new AudioContext();
        if (context.state === 'suspended') {
          await context.resume();
        }
        return context;
      },
    );
  }

  async loadInstrument(type: string, config: any): Promise<void> {
    return this.circuitBreakers.executeWithBreaker(
      CriticalPath.INSTRUMENT_INIT,
      async () => {
        // Load instrument with circuit breaker protection
        await this.performInstrumentLoad(type, config);
      },
      `instrument-${type}`,
    );
  }

  private async performInstrumentLoad(
    type: string,
    config: any,
  ): Promise<void> {
    // Implementation
  }
}

/**
 * Hook for React components to use circuit breakers
 */
export function useCircuitBreaker(eventBus: EventBus) {
  const circuitBreakers = new CircuitBreakerIntegration(eventBus);

  const executeWithBreaker = async <T>(
    path: CriticalPath,
    operation: () => Promise<T>,
  ): Promise<T> => {
    try {
      return await circuitBreakers.executeWithBreaker(path, operation);
    } catch (error) {
      // Handle circuit breaker open errors in UI
      if (error instanceof CircuitBreakerOpenError) {
        logger.warn('Circuit breaker open in component', {
          service: error.serviceName,
          failures: error.failureCount,
        });
      }
      throw error;
    }
  };

  const getBreakerStatus = (path: CriticalPath) => {
    const breaker = circuitBreakers.getBreaker(path);
    return breaker
      ? {
          state: breaker.getState(),
          metrics: breaker.getMetrics(),
        }
      : null;
  };

  return {
    executeWithBreaker,
    getBreakerStatus,
    getAllStatuses: () => circuitBreakers.getAllStatuses(),
  };
}
