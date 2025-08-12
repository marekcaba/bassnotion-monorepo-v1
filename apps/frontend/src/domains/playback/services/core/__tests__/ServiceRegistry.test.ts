import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceRegistry, Service, ServiceError } from '../ServiceRegistry.js';

class MockService implements Service {
  initialize = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  restart = vi.fn();
  dispose = vi.fn();
}

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  describe('service registration', () => {
    it('should register a service successfully', () => {
      const mockService = new MockService();
      registry.register('testService', mockService);

      expect(registry.has('testService')).toBe(true);
      expect(registry.get('testService')).toBe(mockService);
    });

    it('should throw error when registering duplicate service', () => {
      const mockService = new MockService();
      registry.register('testService', mockService);

      expect(() => {
        registry.register('testService', mockService);
      }).toThrow(ServiceError);
    });

    it('should validate dependencies during initialization', async () => {
      const service1 = new MockService();
      const service2 = new MockService();

      registry.register('service1', service1);
      registry.register('service2', service2, ['nonExistentService']);

      await expect(registry.initialize()).rejects.toThrow(ServiceError);
    });

    it('should register service with valid dependencies', () => {
      const service1 = new MockService();
      const service2 = new MockService();

      registry.register('service1', service1);
      registry.register('service2', service2, ['service1']);

      expect(registry.has('service2')).toBe(true);
    });
  });

  describe('service retrieval', () => {
    it('should get registered service', () => {
      const mockService = new MockService();
      registry.register('testService', mockService);

      const retrieved = registry.get<MockService>('testService');
      expect(retrieved).toBe(mockService);
    });

    it('should throw error when getting non-existent service', () => {
      expect(() => {
        registry.get('nonExistent');
      }).toThrow(ServiceError);
    });

    it('should return all service names', () => {
      registry.register('service1', new MockService());
      registry.register('service2', new MockService());
      registry.register('service3', new MockService());

      const names = registry.getServiceNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('service1');
      expect(names).toContain('service2');
      expect(names).toContain('service3');
    });
  });

  describe('initialization', () => {
    it('should initialize services in dependency order', async () => {
      const service1 = new MockService();
      const service2 = new MockService();
      const service3 = new MockService();

      const initOrder: string[] = [];
      service1.initialize.mockImplementation(async () => {
        initOrder.push('service1');
      });
      service2.initialize.mockImplementation(async () => {
        initOrder.push('service2');
      });
      service3.initialize.mockImplementation(async () => {
        initOrder.push('service3');
      });

      registry.register('service1', service1);
      registry.register('service2', service2, ['service1']);
      registry.register('service3', service3, ['service2', 'service1']);

      await registry.initialize();

      expect(initOrder).toEqual(['service1', 'service2', 'service3']);
      expect(service1.initialize).toHaveBeenCalledTimes(1);
      expect(service2.initialize).toHaveBeenCalledTimes(1);
      expect(service3.initialize).toHaveBeenCalledTimes(1);
    });

    it('should use custom initialization order when provided', async () => {
      const customRegistry = new ServiceRegistry({
        initializationOrder: ['service3', 'service2', 'service1']
      });

      const service1 = new MockService();
      const service2 = new MockService();
      const service3 = new MockService();

      const initOrder: string[] = [];
      service1.initialize.mockImplementation(async () => {
        initOrder.push('service1');
      });
      service2.initialize.mockImplementation(async () => {
        initOrder.push('service2');
      });
      service3.initialize.mockImplementation(async () => {
        initOrder.push('service3');
      });

      customRegistry.register('service1', service1);
      customRegistry.register('service2', service2);
      customRegistry.register('service3', service3);

      await customRegistry.initialize();

      expect(initOrder).toEqual(['service3', 'service2', 'service1']);
    });

    it('should handle services without initialize method', async () => {
      const service = { start: vi.fn() };
      registry.register('service', service);

      await expect(registry.initialize()).resolves.not.toThrow();
      
      const status = registry.getServiceStatus('service');
      expect(status?.status).toBe('initialized');
    });

    it('should throw error if initialization fails', async () => {
      const service = new MockService();
      service.initialize.mockRejectedValue(new Error('Init failed'));

      registry.register('service', service);

      await expect(registry.initialize()).rejects.toThrow(ServiceError);
    });

    it('should not re-initialize already initialized services', async () => {
      const service = new MockService();
      registry.register('service', service);

      await registry.initialize();
      await registry.initialize();

      expect(service.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('service lifecycle', () => {
    it('should start services in correct order', async () => {
      const service1 = new MockService();
      const service2 = new MockService();

      const startOrder: string[] = [];
      service1.start.mockImplementation(async () => {
        startOrder.push('service1');
      });
      service2.start.mockImplementation(async () => {
        startOrder.push('service2');
      });

      registry.register('service1', service1);
      registry.register('service2', service2, ['service1']);

      await registry.initialize();
      await registry.start();

      expect(startOrder).toEqual(['service1', 'service2']);
      expect(service1.start).toHaveBeenCalledTimes(1);
      expect(service2.start).toHaveBeenCalledTimes(1);
    });

    it('should stop services in reverse order', async () => {
      const service1 = new MockService();
      const service2 = new MockService();

      const stopOrder: string[] = [];
      service1.stop.mockImplementation(async () => {
        stopOrder.push('service1');
      });
      service2.stop.mockImplementation(async () => {
        stopOrder.push('service2');
      });

      registry.register('service1', service1);
      registry.register('service2', service2, ['service1']);

      await registry.initialize();
      await registry.start();
      await registry.stop();

      expect(stopOrder).toEqual(['service2', 'service1']);
      expect(service1.stop).toHaveBeenCalledTimes(1);
      expect(service2.stop).toHaveBeenCalledTimes(1);
    });

    it('should restart a specific service', async () => {
      const service = new MockService();
      registry.register('service', service);

      await registry.initialize();
      await registry.start();
      await registry.restart('service');

      expect(service.restart).toHaveBeenCalledTimes(1);
    });

    it('should handle restart without dedicated restart method', async () => {
      const service = {
        start: vi.fn(),
        stop: vi.fn()
      };
      registry.register('service', service);

      await registry.initialize();
      await registry.start();
      await registry.restart('service');

      expect(service.stop).toHaveBeenCalledTimes(1);
      expect(service.start).toHaveBeenCalledTimes(2); // Initial start + restart
    });
  });

  describe('disposal', () => {
    it('should dispose all services in reverse order', async () => {
      const service1 = new MockService();
      const service2 = new MockService();

      const disposeOrder: string[] = [];
      service1.dispose.mockImplementation(async () => {
        disposeOrder.push('service1');
      });
      service2.dispose.mockImplementation(async () => {
        disposeOrder.push('service2');
      });

      registry.register('service1', service1);
      registry.register('service2', service2, ['service1']);

      await registry.initialize();
      await registry.start();
      await registry.dispose();

      expect(disposeOrder).toEqual(['service2', 'service1']);
      expect(service1.dispose).toHaveBeenCalledTimes(1);
      expect(service2.dispose).toHaveBeenCalledTimes(1);
      expect(registry.getServiceNames()).toHaveLength(0);
    });

    it('should continue disposal even if a service fails', async () => {
      const service1 = new MockService();
      const service2 = new MockService();

      service1.dispose.mockRejectedValue(new Error('Dispose failed'));

      registry.register('service1', service1);
      registry.register('service2', service2);

      await expect(registry.dispose()).resolves.not.toThrow();
      expect(service2.dispose).toHaveBeenCalled();
    });
  });

  describe('service status', () => {
    it('should track service status correctly', async () => {
      const service = new MockService();
      registry.register('service', service);

      let status = registry.getServiceStatus('service');
      expect(status).toMatchObject({
        registered: true,
        status: 'registered'
      });

      await registry.initialize();
      status = registry.getServiceStatus('service');
      expect(status?.status).toBe('initialized');

      await registry.start();
      status = registry.getServiceStatus('service');
      expect(status?.status).toBe('started');

      await registry.stop();
      status = registry.getServiceStatus('service');
      expect(status?.status).toBe('stopped');
    });

    it('should return correct status for non-existent service', () => {
      const status = registry.getServiceStatus('nonExistent');
      expect(status).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should include service name in error', () => {
      try {
        registry.get('nonExistent');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).serviceName).toBe('nonExistent');
      }
    });

    it('should continue stopping services even if one fails', async () => {
      const service1 = new MockService();
      const service2 = new MockService();

      service1.stop.mockRejectedValue(new Error('Stop failed'));

      registry.register('service1', service1);
      registry.register('service2', service2);

      await registry.initialize();
      await registry.start();
      await expect(registry.stop()).resolves.not.toThrow();

      expect(service2.stop).toHaveBeenCalled();
    });
  });
});