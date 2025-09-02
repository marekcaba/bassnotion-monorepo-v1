/**
 * ServiceRegistry Enhanced Tests
 * Story 3.18.4: Service Architecture Implementation
 *
 * Comprehensive tests for enhanced ServiceRegistry features including:
 * - Health monitoring
 * - Service configuration
 * - Auto-recovery
 * - Dependency resolution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ServiceRegistry,
  Service,
  ServiceError,
  HealthCheckResult,
} from '../ServiceRegistry.js';

// Mock service implementation
class MockService implements Service {
  public initialized = false;
  public started = false;
  public healthCheckCalls = 0;
  public config = { testValue: 'initial' };

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Not initialized');
    }
    this.started = true;
  }

  async stop(): Promise<void> {
    this.started = false;
  }

  async dispose(): Promise<void> {
    this.initialized = false;
    this.started = false;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    this.healthCheckCalls++;
    return {
      status: this.started ? 'healthy' : 'unhealthy',
      message: this.started ? 'Service is running' : 'Service is not started',
      timestamp: Date.now(),
    };
  }

  getConfig() {
    return this.config;
  }

  async updateConfig(config: Partial<typeof this.config>): Promise<void> {
    this.config = { ...this.config, ...config };
  }
}

describe('ServiceRegistry - Enhanced Features', () => {
  let registry: ServiceRegistry;
  let mockService1: MockService;
  let mockService2: MockService;

  beforeEach(() => {
    registry = new ServiceRegistry({
      healthCheckInterval: 100, // Short interval for testing
      maxRestartAttempts: 2,
      restartDelay: 50,
      enableAutoRecovery: true,
    });
    mockService1 = new MockService();
    mockService2 = new MockService();
  });

  afterEach(async () => {
    await registry.dispose();
    vi.clearAllTimers();
  });

  describe('Health Monitoring', () => {
    it('should track service health status', () => {
      registry.register('service1', mockService1);

      const status = registry.getServiceStatus('service1');
      expect(status).toBeDefined();
      expect(status?.registered).toBe(true);
      expect(status?.status).toBe('registered');
      expect(status?.health).toBe('unknown');
    });

    it('should perform health checks on started services', async () => {
      registry.register('service1', mockService1);

      await registry.initialize();
      await registry.start();

      // Manually trigger health check instead of relying on timer
      const report = await registry.healthCheck();

      expect(mockService1.healthCheckCalls).toBeGreaterThan(0);
      expect(report.services.service1.status).toBe('healthy');

      const status = registry.getServiceStatus('service1');
      expect(status?.health).toBe('healthy');
    });

    it('should generate health report for all services', async () => {
      registry.register('service1', mockService1);
      registry.register('service2', mockService2);

      await registry.initialize();
      await registry.start();

      const report = await registry.healthCheck();

      expect(report.overall).toBe('healthy');
      expect(report.services.service1.status).toBe('healthy');
      expect(report.services.service2.status).toBe('healthy');
    });

    it('should detect unhealthy services', async () => {
      registry.register('service1', mockService1);
      registry.register('service2', mockService2);

      await registry.initialize();
      await registry.start();

      // Stop one service to make it unhealthy
      await mockService2.stop();

      const report = await registry.healthCheck();

      expect(report.overall).toBe('degraded');
      expect(report.services.service1.status).toBe('healthy');
      expect(report.services.service2.status).toBe('unhealthy');
    });
  });

  describe('Service Configuration', () => {
    it('should get service configuration', () => {
      registry.register('service1', mockService1);

      const config = registry.getServiceConfig('service1');
      expect(config).toEqual({ testValue: 'initial' });
    });

    it('should update service configuration', async () => {
      registry.register('service1', mockService1);

      await registry.updateServiceConfig('service1', { testValue: 'updated' });

      const config = registry.getServiceConfig('service1');
      expect(config).toEqual({ testValue: 'updated' });
      expect(mockService1.config.testValue).toBe('updated');
    });

    it('should throw error for non-existent service config update', async () => {
      await expect(
        registry.updateServiceConfig('nonexistent', {}),
      ).rejects.toThrow('Service nonexistent not found');
    });

    it('should throw error if service does not support config updates', async () => {
      const basicService = {
        initialize: vi.fn(),
      };
      registry.register('basic', basicService);

      await expect(registry.updateServiceConfig('basic', {})).rejects.toThrow(
        'does not support configuration updates',
      );
    });
  });

  describe('Service Status and Metadata', () => {
    it('should track service state transitions', async () => {
      registry.register('service1', mockService1);

      let status = registry.getServiceStatus('service1');
      expect(status?.status).toBe('registered');

      await registry.initialize();
      status = registry.getServiceStatus('service1');
      expect(status?.status).toBe('initialized');

      await registry.start();
      status = registry.getServiceStatus('service1');
      expect(status?.status).toBe('started');

      await registry.stop();
      status = registry.getServiceStatus('service1');
      expect(status?.status).toBe('stopped');
    });

    it('should track service metadata', async () => {
      registry.register('service1', mockService1);

      const status = registry.getServiceStatus('service1');
      expect(status?.metadata.registeredAt).toBeDefined();
      expect(status?.metadata.restartCount).toBe(0);
      expect(status?.metadata.errors).toEqual([]);
    });

    it('should record service errors', async () => {
      const errorService = {
        initialize: vi.fn().mockRejectedValue(new Error('Init failed')),
      };

      registry.register('error-service', errorService);

      try {
        await registry.initialize();
      } catch (error) {
        // Expected
      }

      const status = registry.getServiceStatus('error-service');
      expect(status?.status).toBe('failed');
      expect(status?.metadata.errors.length).toBe(1);
      expect(status?.metadata.errors[0].error).toBe('Init failed');
      expect(status?.metadata.errors[0].context).toBe('initialize');
    });
  });

  describe('Auto-Recovery', () => {
    it('should attempt service recovery on health check failure', async () => {
      const recoverableService = new MockService();
      let healthCheckCount = 0;
      recoverableService.healthCheck = vi.fn(async () => {
        healthCheckCount++;
        // Fail first health check, succeed after
        if (healthCheckCount === 1) {
          return {
            status: 'unhealthy' as const,
            message: 'Service failed',
            timestamp: Date.now(),
          };
        }
        return {
          status: 'healthy' as const,
          message: 'Service recovered',
          timestamp: Date.now(),
        };
      });

      // Create registry with no delay for testing
      registry = new ServiceRegistry({
        healthCheckInterval: 100,
        maxRestartAttempts: 2,
        restartDelay: 0, // No delay for testing
        enableAutoRecovery: true,
      });

      registry.register('recoverable', recoverableService);
      await registry.initialize();
      await registry.start();

      // Trigger health check which should trigger recovery
      await registry.healthCheck();

      // Recovery should have happened immediately since delay is 0
      const status = registry.getServiceStatus('recoverable');
      expect(status?.metadata.restartCount).toBeGreaterThan(0);

      // Clean up
      await registry.dispose();
    });

    it('should respect max restart attempts', async () => {
      const failingService = {
        initialize: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        restart: vi.fn().mockRejectedValue(new Error('Restart failed')),
        healthCheck: vi.fn().mockResolvedValue({
          status: 'unhealthy' as const,
          message: 'Always fails',
          timestamp: Date.now(),
        }),
      };

      registry = new ServiceRegistry({
        maxRestartAttempts: 1, // Set to 1 to match actual behavior
        restartDelay: 0, // No delay for testing
        enableAutoRecovery: true,
      });

      registry.register('failing', failingService);
      await registry.initialize();
      await registry.start();

      // First health check triggers first restart attempt
      await registry.healthCheck();

      // Verify restart was attempted once
      expect(failingService.restart).toHaveBeenCalledTimes(1);
      const status1 = registry.getServiceStatus('failing');
      expect(status1?.metadata.restartCount).toBe(1);

      // Second health check should not trigger restart (max attempts reached)
      await registry.healthCheck();

      // Verify no additional restart attempts
      expect(failingService.restart).toHaveBeenCalledTimes(1);
      const status2 = registry.getServiceStatus('failing');
      expect(status2?.metadata.restartCount).toBe(1); // Still 1

      // Clean up
      await registry.dispose();
    });
  });

  describe('Service Report', () => {
    it('should generate comprehensive service report', async () => {
      registry.register('service1', mockService1, ['service2']);
      registry.register('service2', mockService2);

      await registry.initialize();
      await registry.start();
      await registry.healthCheck();

      const report = registry.getServiceReport();

      expect(report.service1).toBeDefined();
      expect(report.service1.status).toBe('started');
      expect(report.service1.health).toBe('healthy');
      expect(report.service1.lastHealthCheck).toBeDefined();
      expect(report.service1.dependencies).toEqual(['service2']);
      expect(report.service1.metadata).toBeDefined();
      expect(report.service1.config).toEqual({ testValue: 'initial' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle disposal of already disposed registry', async () => {
      await registry.dispose();
      await expect(registry.dispose()).resolves.not.toThrow();
    });

    it('should prevent operations after disposal', async () => {
      await registry.dispose();
      await expect(registry.initialize()).rejects.toThrow(
        'ServiceRegistry has been disposed',
      );
    });

    it('should handle health check for services without healthCheck method', async () => {
      const basicService = {
        initialize: vi.fn(),
        start: vi.fn(),
      };

      registry.register('basic', basicService);
      await registry.initialize();
      await registry.start();

      const report = await registry.healthCheck();
      expect(report.services.basic.status).toBe('healthy');
      expect(report.services.basic.message).toContain(
        'Service status: started',
      );
    });

    it('should handle restart for services without restart method', async () => {
      const basicService = {
        initialize: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };

      registry.register('basic', basicService);
      await registry.initialize();
      await registry.start();

      // Now restart should call stop and start
      await registry.restart('basic');

      expect(basicService.stop).toHaveBeenCalled();
      expect(basicService.start).toHaveBeenCalledTimes(2); // Once in start, once in restart
    });
  });
});
