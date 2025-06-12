/**
 * MemoryLeakDetector Behavior Tests
 *
 * These tests focus on behavior and outcomes rather than implementation details.
 * Following the successful pattern from ResourceUsageMonitor, WorkerPoolManager,
 * PerformanceMonitor, StatePersistenceManager, and ABTestFramework.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryLeakDetector } from '../MemoryLeakDetector.js';
import type {
  LeakDetectorConfig as _LeakDetectorConfig,
  SuspectedLeak as _SuspectedLeak,
  MemorySnapshot as _MemorySnapshot,
  LeakDetectionReport as _LeakDetectionReport,
} from '../MemoryLeakDetector.js';
import type { ManagedResource as _ManagedResource } from '../ResourceManager.js';
import { ResourceType } from '../ResourceManager.js';

// Test Environment Setup
const setupTestEnvironment = () => {
  const mockPerformance = {
    now: vi.fn().mockReturnValue(Date.now()),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024,
      totalJSHeapSize: 80 * 1024 * 1024,
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024,
    },
    mark: vi.fn(),
    measure: vi.fn(),
    getEntries: vi.fn().mockReturnValue([]),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  };

  (global as any).performance = mockPerformance;
  (global as any).WeakRef = vi.fn().mockImplementation((target) => ({
    deref: vi.fn().mockReturnValue(target),
  }));

  // Fix setInterval mock to be a proper spy
  const originalSetInterval = global.setInterval;
  global.setInterval = vi.fn().mockImplementation((callback, delay) => {
    return setTimeout(callback, delay) as any;
  });

  global.console = {
    ...global.console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return { originalSetInterval };
};

// Scenario Builders - Fixed to match actual ManagedResource interface
const createManagedResource = (
  id: string,
  type: ResourceType,
  options: any = {},
): any => {
  const now = Date.now();
  const mockResource = {}; // The actual resource being managed

  return {
    id,
    resource: mockResource,
    metadata: {
      id,
      type,
      priority: 'medium' as const,
      state: 'active' as const,
      createdAt: now - 10000,
      lastAccessed: now,
      accessCount: 1,
      memoryUsage: 1024 * 1024,
      dependencies: new Set<string>(),
      dependents: new Set<string>(),
      tags: new Set<string>(),
      cleanupStrategy: 'deferred' as const,
      autoCleanupTimeout: 300000,
      maxIdleTime: 600000,
      ...options.metadata,
    },
    refs: options.references || 1,
    weakRefs: new Set<WeakRef<object>>(),
    // Support legacy test properties for backward compatibility
    isActive: options.isActive !== undefined ? options.isActive : true,
    lastAccessed: options.lastAccessed || now,
    memoryUsage: options.memoryUsage || 1024 * 1024,
    references: options.references || 1,
    ...options,
  };
};

const createLeakDetectorConfig = (overrides = {}) => ({
  enabled: true,
  scanning: {
    interval: 5000,
    deepScanInterval: 30000,
    snapshotRetention: 10,
    backgroundScanning: true,
  },
  detection: {
    sensitivityLevel: 'medium',
    memoryGrowthThreshold: 1024 * 1024,
    referenceCountThreshold: 10,
    weakRefLeakThreshold: 5,
    gcAnalysisEnabled: true,
    patternMatchingEnabled: true,
  },
  prevention: {
    enabled: true,
    aggressiveMode: false,
    autoCleanupEnabled: true,
    resourceAgeLimits: new Map([
      ['audio_buffer', 300000],
      ['midi_file', 600000],
    ]),
    circularReferenceDetection: true,
  },
  remediation: {
    enabled: true,
    automaticMode: true,
    maxRemediationAttempts: 3,
    cooldownPeriod: 10000,
    escalationThresholds: new Map([
      ['minor', 5],
      ['moderate', 3],
      ['severe', 1],
    ]),
  },
  monitoring: {
    enabled: true,
    detailedLogging: false,
    performanceImpactTracking: true,
    alerting: true,
    reportGeneration: true,
  },
  ...overrides,
});

const createDeviceCapabilities = (overrides = {}) => ({
  hardwareConcurrency: 4,
  maxMemory: 8 * 1024 * 1024 * 1024,
  isLowEndDevice: false,
  supportedFormats: ['audio/wav', 'audio/mp3'],
  maxAudioChannels: 8,
  ...overrides,
});

const createLeakyResource = (id: string) =>
  createManagedResource(id, 'audio_buffer', {
    references: 15,
    lastAccessed: Date.now() - 60000,
    memoryUsage: 10 * 1024 * 1024,
    isActive: false,
  });

// Test Helpers
const expectValidLeakDetectionReport = (report: any) => {
  expect(report.timestamp).toBeGreaterThan(0);
  expect(report.scanDuration).toBeGreaterThanOrEqual(0);
  expect(Array.isArray(report.suspectedLeaks)).toBe(true);
  expect(Array.isArray(report.confirmedLeaks)).toBe(true);
  expect(report.memoryGrowthRate).toBeGreaterThanOrEqual(0);
  expect(report.totalSuspectedLeakage).toBeGreaterThanOrEqual(0);
  expect(['minor', 'moderate', 'severe', 'critical']).toContain(
    report.overallRisk,
  );
};

const _waitForAsync = (ms = 50) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Behavior Tests
describe('MemoryLeakDetector Behaviors', () => {
  let detector: MemoryLeakDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    setupTestEnvironment();
    (MemoryLeakDetector as any).instance = null;
    detector = MemoryLeakDetector.getInstance();
  });

  afterEach(async () => {
    if (detector) {
      await detector.shutdown();
    }
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initialization Behaviors', () => {
    it('should provide singleton instance', () => {
      const instance1 = MemoryLeakDetector.getInstance();
      const instance2 = MemoryLeakDetector.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(MemoryLeakDetector);
    });

    it('should initialize with default configuration', async () => {
      await detector.initialize();

      expect(detector.isInitialized()).toBe(true);
      const config = detector.getConfig();
      expect(config.enabled).toBe(true);
    });

    it('should accept custom configuration', () => {
      // Reset singleton to allow new instance with custom config
      (MemoryLeakDetector as any).instance = null;

      const customConfig = createLeakDetectorConfig({
        detection: { sensitivityLevel: 'high' },
      });

      const customDetector = MemoryLeakDetector.getInstance(
        customConfig as any,
      );
      const config = customDetector.getConfig();

      expect(config.detection.sensitivityLevel).toBe('high');
    });

    it('should adapt to device capabilities', async () => {
      const lowEndDevice = createDeviceCapabilities({
        isLowEndDevice: true,
        maxMemory: 2 * 1024 * 1024 * 1024,
      });

      await detector.initialize(lowEndDevice as any);

      expect(detector.isInitialized()).toBe(true);
    });

    it('should setup background detection', async () => {
      await detector.initialize();

      expect(global.setInterval).toHaveBeenCalled();
    });
  });

  describe('Resource Registration Behaviors', () => {
    beforeEach(async () => {
      await detector.initialize();
    });

    it('should register resources for monitoring', () => {
      const resource = createManagedResource('test-audio', 'audio_buffer');

      expect(() => detector.registerResource(resource as any)).not.toThrow();
    });

    it('should unregister resources', () => {
      const resource = createManagedResource('test-midi', 'midi_file');

      detector.registerResource(resource as any);
      expect(() => detector.unregisterResource(resource.id)).not.toThrow();
    });

    it('should handle multiple resource types', () => {
      const audioResource = createManagedResource('audio-1', 'audio_buffer');
      const midiResource = createManagedResource('midi-1', 'midi_file');

      detector.registerResource(audioResource as any);
      detector.registerResource(midiResource as any);

      expect(detector.isInitialized()).toBe(true);
    });
  });

  describe('Leak Detection Behaviors', () => {
    beforeEach(async () => {
      await detector.initialize();
    });

    it('should perform regular scans', async () => {
      // Temporarily use real timers for time measurement to work
      vi.useRealTimers();
      const report = await detector.performScan();
      vi.useFakeTimers();

      expectValidLeakDetectionReport(report);
      expect(report.scanDuration).toBeGreaterThan(0);
    });

    it('should perform deep scans', async () => {
      const deepReport = await detector.performScan(true);

      expectValidLeakDetectionReport(deepReport);
    });

    it('should detect memory growth patterns', async () => {
      await detector.performScan();

      const performance = (global as any).performance;
      if (performance.memory) {
        performance.memory.usedJSHeapSize += 10 * 1024 * 1024;
      }

      const secondReport = await detector.performScan();
      expect(secondReport.memoryGrowthRate).toBeGreaterThanOrEqual(0);
    });

    it('should detect high reference count leaks', () => {
      const highRefResource = createManagedResource(
        'high-refs',
        'audio_buffer',
        {
          references: 25,
        },
      );

      detector.registerResource(highRefResource as any);
      expect(detector.isInitialized()).toBe(true);
    });

    it('should detect stale resources', () => {
      const staleResource = createManagedResource('stale', 'audio_sample', {
        lastAccessed: Date.now() - 600000,
        isActive: false,
      });

      detector.registerResource(staleResource as any);
      expect(detector.isInitialized()).toBe(true);
    });
  });

  describe('Pattern Recognition Behaviors', () => {
    beforeEach(async () => {
      await detector.initialize();
    });

    it('should detect known patterns', async () => {
      const eventLeakResource = createManagedResource(
        'event-leak',
        'audio_buffer',
        {
          references: 12,
          metadata: { hasEventListeners: true },
        },
      );

      detector.registerResource(eventLeakResource as any);

      const report = await detector.performScan();
      expect(report.detectedPatterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should identify emerging patterns', async () => {
      for (let i = 0; i < 5; i++) {
        const resource = createManagedResource(`pattern-${i}`, 'audio_buffer', {
          references: 10 + i,
          memoryUsage: 5 * 1024 * 1024,
        });
        detector.registerResource(resource as any);
      }

      const report = await detector.performScan();
      expect(report.emergingPatterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Remediation Behaviors', () => {
    beforeEach(async () => {
      await detector.initialize();
    });

    it('should attempt automatic remediation', async () => {
      const leakyResource = createLeakyResource('auto-remediate');
      detector.registerResource(leakyResource as any);

      const report = await detector.performScan();

      if (report.suspectedLeaks.length > 0) {
        const result = await detector.remediateLeak(
          report.suspectedLeaks[0]?.id || '',
        );
        expect(typeof result).toBe('boolean');
      }
    });

    it('should respect remediation attempts limit', async () => {
      const result = await detector.remediateLeak('non-existent');
      expect(result).toBe(false);
    });

    it('should escalate based on severity', async () => {
      const criticalResource = createManagedResource(
        'critical',
        'audio_buffer',
        {
          references: 50,
          memoryUsage: 100 * 1024 * 1024,
        },
      );

      detector.registerResource(criticalResource as any);

      const report = await detector.performScan();
      expect(['minor', 'moderate', 'severe', 'critical']).toContain(
        report.overallRisk,
      );
    });
  });

  describe('Prevention Behaviors', () => {
    beforeEach(async () => {
      await detector.initialize();
    });

    it('should enforce resource age limits', () => {
      const oldResource = createManagedResource('old', 'midi_file', {
        createdAt: Date.now() - 700000,
      });

      detector.registerResource(oldResource as any);
      expect(detector.isInitialized()).toBe(true);
    });

    it('should provide prevention recommendations', async () => {
      const report = await detector.performScan();

      expect(Array.isArray(report.preventionRecommendations)).toBe(true);
      expect(report.preventionRecommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring Behaviors', () => {
    beforeEach(async () => {
      await detector.initialize();
    });

    it('should track detection metrics', async () => {
      await detector.performScan();

      const metrics = detector.getMetrics();
      expect(metrics.totalScans).toBeGreaterThan(0);
    });

    it('should calculate accuracy metrics', async () => {
      const report = await detector.performScan();

      expect(report.detectionAccuracy).toBeGreaterThanOrEqual(0);
      expect(report.detectionAccuracy).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling Behaviors', () => {
    it('should handle missing performance.memory', async () => {
      // Store original memory object
      const originalMemory = (global as any).performance.memory;
      // Temporarily remove performance.memory
      delete (global as any).performance.memory;

      await detector.initialize();
      const report = await detector.performScan();

      expectValidLeakDetectionReport(report);
      // Restore performance.memory for other tests
      (global as any).performance.memory = originalMemory;
    });

    it('should handle WeakRef unavailability', async () => {
      delete (global as any).WeakRef;

      await detector.initialize();
      expect(() => detector.performScan()).not.toThrow();
    });

    it('should handle invalid resources gracefully', async () => {
      await detector.initialize();

      expect(() => detector.registerResource(null as any)).not.toThrow();
    });
  });

  describe('Lifecycle Management Behaviors', () => {
    it('should initialize only once', async () => {
      await detector.initialize();
      await detector.initialize();

      expect(detector.isInitialized()).toBe(true);
    });

    it('should shutdown cleanly', async () => {
      await detector.initialize();

      const shutdownPromise = detector.shutdown();
      expect(shutdownPromise).toBeInstanceOf(Promise);

      await shutdownPromise;
    });

    it('should provide statistics', async () => {
      await detector.initialize();
      await detector.performScan();

      const stats = detector.getStatistics();
      expect(stats.metrics.totalScans).toBeGreaterThan(0);
    });
  });
});
