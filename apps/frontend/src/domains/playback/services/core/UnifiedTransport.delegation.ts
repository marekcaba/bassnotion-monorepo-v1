/**
 * UnifiedTransport Delegation Layer
 * 
 * This file contains the delegation logic for migrating from UnifiedTransport
 * to the new modular Transport implementation. It's kept separate for clarity
 * and easy rollback if needed.
 */

import { TransportWithEventBus } from '../../modules/transport/core/TransportWithEventBus.js';
import { Transport } from '../../modules/transport/index.js';
import { EventBus } from './EventBus.js';
import { AudioEngine } from './AudioEngine.js';
import { TransportConfig, MusicalPosition, TransportState, TimingMetrics } from '../../modules/transport/index.js';
import { isModularTransportEnabled, logTransportMigrationEvent } from '../../config/featureFlags.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('UnifiedTransportDelegation');

/**
 * Create a modular transport instance that matches UnifiedTransport's interface
 */
export function createModularTransport(
  eventBus: EventBus,
  audioEngine: AudioEngine,
  config?: Partial<TransportConfig>
): TransportWithEventBus | null {
  try {
    if (!isModularTransportEnabled()) {
      return null;
    }

    logTransportMigrationEvent('Creating modular transport', { config });

    // Create the new transport with EventBus support
    const transport = new TransportWithEventBus(eventBus, config);

    // Initialize with audio context from AudioEngine
    const audioContext = audioEngine.getContext();
    if (audioContext) {
      transport.initialize(audioContext).catch(error => {
        logger.error('Failed to initialize modular transport', error);
      });
    }

    logTransportMigrationEvent('Modular transport created successfully');
    return transport;
  } catch (error) {
    logger.error('Failed to create modular transport', error);
    logTransportMigrationEvent('Failed to create modular transport', { error });
    return null;
  }
}

/**
 * Delegation helpers to handle method forwarding
 */
export class TransportDelegator {
  private modularTransport: TransportWithEventBus | null;
  private useModular: boolean;

  constructor(modularTransport: TransportWithEventBus | null) {
    this.modularTransport = modularTransport;
    this.useModular = modularTransport !== null && isModularTransportEnabled();
  }

  /**
   * Check if we should use modular transport for a specific operation
   */
  shouldUseModular(operation: string): boolean {
    const use = this.useModular && this.modularTransport !== null;
    
    if (use) {
      logTransportMigrationEvent(`Delegating ${operation} to modular transport`);
    }
    
    return use;
  }

  /**
   * Get the modular transport instance
   */
  getModularTransport(): TransportWithEventBus | null {
    return this.modularTransport;
  }

  /**
   * Log delegation metrics for monitoring
   */
  logDelegationMetrics(operation: string, success: boolean, duration?: number): void {
    logTransportMigrationEvent('Delegation metrics', {
      operation,
      success,
      duration,
      usingModular: this.useModular,
    });
  }

  /**
   * Wrap async operations with error handling and metrics
   */
  async delegateAsync<T>(
    operation: string,
    modularImpl: () => Promise<T>,
    fallbackImpl: () => Promise<T>
  ): Promise<T> {
    if (!this.shouldUseModular(operation)) {
      return fallbackImpl();
    }

    const startTime = performance.now();
    
    try {
      const result = await modularImpl();
      const duration = performance.now() - startTime;
      this.logDelegationMetrics(operation, true, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error(`Modular transport ${operation} failed, falling back`, error);
      this.logDelegationMetrics(operation, false, duration);
      
      // Fall back to legacy implementation
      return fallbackImpl();
    }
  }

  /**
   * Wrap sync operations with error handling and metrics
   */
  delegateSync<T>(
    operation: string,
    modularImpl: () => T,
    fallbackImpl: () => T
  ): T {
    if (!this.shouldUseModular(operation)) {
      return fallbackImpl();
    }

    const startTime = performance.now();
    
    try {
      const result = modularImpl();
      const duration = performance.now() - startTime;
      this.logDelegationMetrics(operation, true, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error(`Modular transport ${operation} failed, falling back`, error);
      this.logDelegationMetrics(operation, false, duration);
      
      // Fall back to legacy implementation
      return fallbackImpl();
    }
  }
}

/**
 * Performance comparison helper
 */
export class TransportPerformanceComparator {
  private metrics: Map<string, { legacy: number[], modular: number[] }> = new Map();

  recordMetric(operation: string, isModular: boolean, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, { legacy: [], modular: [] });
    }
    
    const operationMetrics = this.metrics.get(operation)!;
    if (isModular) {
      operationMetrics.modular.push(duration);
    } else {
      operationMetrics.legacy.push(duration);
    }
  }

  getComparison(): Record<string, any> {
    const comparison: Record<string, any> = {};
    
    this.metrics.forEach((metrics, operation) => {
      const legacyAvg = metrics.legacy.length > 0
        ? metrics.legacy.reduce((a, b) => a + b, 0) / metrics.legacy.length
        : 0;
      
      const modularAvg = metrics.modular.length > 0
        ? metrics.modular.reduce((a, b) => a + b, 0) / metrics.modular.length
        : 0;
      
      comparison[operation] = {
        legacyAvg,
        modularAvg,
        improvement: legacyAvg > 0 ? ((legacyAvg - modularAvg) / legacyAvg) * 100 : 0,
        sampleCount: {
          legacy: metrics.legacy.length,
          modular: metrics.modular.length,
        },
      };
    });
    
    return comparison;
  }

  logComparison(): void {
    const comparison = this.getComparison();
    logTransportMigrationEvent('Performance comparison', comparison);
  }
}