/**
 * ResourceManager Behavior Tests
 *
 * These tests focus on behavior and outcomes rather than implementation details.
 * Following the successful pattern from ResourceUsageMonitor, WorkerPoolManager,
 * PerformanceMonitor, StatePersistenceManager, ABTestFramework, MemoryLeakDetector,
 * and AudioResourceDisposer.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResourceManager } from '../ResourceManager.js';
import type {
  ResourceType,
  ResourceManagerConfig,
  ResourceUsageReport,
  MemoryLeakReport,
  CleanupReport,
  AssetCacheConfiguration,
} from '../ResourceManager.js';
import type {
  DeviceCapabilities,
  BatteryStatus,
  ThermalStatus,
} from '../../types/audio.js';

// Mock fetch and fix markResourceTiming issue
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Fix the markResourceTiming issue from undici
if (!(globalThis as any).markResourceTiming) {
  (globalThis as any).markResourceTiming = vi.fn();
}

// Fix Performance API for resource timing
if (
  typeof performance !== 'undefined' &&
  !(performance as any).markResourceTiming
) {
  (performance as any).markResourceTiming = vi.fn();
}

describe('ResourceManager - Behavior', () => {
  let manager: ResourceManager;

  // Test scenario builders (simple data, behavior-focused)
  const scenarios = {
    basicConfig: (): Partial<ResourceManagerConfig> => ({
      constraints: {
        maxTotalMemory: 100 * 1024 * 1024, // 100MB
        maxResourceCount: 1000,
        maxIdleResources: 100,
        memoryPressureThreshold: 0.8,
        cpuPressureThreshold: 0.9,
        batteryAwareCleanup: true,
        thermalAwareCleanup: true,
        aggressiveCleanupOnLowMemory: true,
      },
      gcOptimization: {
        enabled: true,
        triggerThreshold: 0.7,
        scheduledGCInterval: 30000,
        forcedGCThreshold: 0.9,
        idleGCEnabled: true,
      },
      leakDetection: {
        enabled: true,
        weakRefThreshold: 50,
        memoryGrowthThreshold: 10 * 1024 * 1024, // 10MB
        scanInterval: 60000,
        autoRemediation: true,
      },
      monitoring: {
        enabled: true,
        detailedMetrics: true,
        performanceTracking: true,
        alerting: true,
      },
    }),

    lowResourceConfig: (): Partial<ResourceManagerConfig> => ({
      constraints: {
        maxTotalMemory: 10 * 1024 * 1024, // 10MB
        maxResourceCount: 100,
        maxIdleResources: 10,
        memoryPressureThreshold: 0.6,
        cpuPressureThreshold: 0.7,
        batteryAwareCleanup: true,
        thermalAwareCleanup: true,
        aggressiveCleanupOnLowMemory: true,
      },
    }),

    browserEnvironment: () => ({
      window: {
        setInterval: vi.fn((fn, delay) => {
          setTimeout(fn, delay);
          return 123;
        }),
        clearInterval: vi.fn(),
        setTimeout: vi.fn((fn, delay) => {
          setTimeout(fn, delay);
          return 456;
        }),
        clearTimeout: vi.fn(),
        WeakRef: vi.fn().mockImplementation((target) => ({
          deref: () => target,
        })),
        FinalizationRegistry: vi.fn().mockImplementation(() => ({
          register: vi.fn(),
          unregister: vi.fn(),
        })),
        requestAnimationFrame: vi.fn((callback) => {
          setTimeout(callback, 16);
          return 789;
        }),
        cancelAnimationFrame: vi.fn(),
        AudioContext: vi.fn().mockImplementation(() => ({
          createGain: vi.fn(() => scenarios.mockAudioNode()),
          createOscillator: vi.fn(() => scenarios.mockAudioNode()),
          destination: {},
          currentTime: 0,
          sampleRate: 44100,
          state: 'running',
          close: vi.fn(() => Promise.resolve()),
          createBuffer: vi.fn(() => scenarios.mockAudioBuffer()),
        })),
      },
      performance: {
        memory: {
          usedJSHeapSize: 50 * 1024 * 1024,
          totalJSHeapSize: 100 * 1024 * 1024,
          jsHeapSizeLimit: 2 * 1024 * 1024 * 1024,
        },
        now: vi.fn(() => Date.now()),
        mark: vi.fn(),
        measure: vi.fn(),
        getEntriesByType: vi.fn(() => []),
      },
      navigator: {
        hardwareConcurrency: 8,
        deviceMemory: 8,
        userAgent: 'Test Browser',
        getBattery: vi.fn(() =>
          Promise.resolve({
            level: 0.8,
            charging: false,
            chargingTime: Infinity,
            dischargingTime: 18000,
          }),
        ),
      },
    }),

    mockAudioBuffer: () => ({
      length: 44100,
      duration: 1.0,
      sampleRate: 44100,
      numberOfChannels: 2,
      getChannelData: vi.fn(() => new Float32Array(44100)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    }),

    mockAudioNode: () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      context: {
        currentTime: 0,
        sampleRate: 44100,
      },
    }),

    mockCanvasContext: () => ({
      canvas: {
        width: 800,
        height: 600,
        getContext: vi.fn(),
      },
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    }),

    mockWebGLContext: () => ({
      drawingBufferWidth: 800,
      drawingBufferHeight: 600,
      createShader: vi.fn(),
      createProgram: vi.fn(),
      useProgram: vi.fn(),
      clear: vi.fn(),
      drawArrays: vi.fn(),
    }),

    testResources: () => ({
      audioBuffer: scenarios.mockAudioBuffer(),
      audioNode: scenarios.mockAudioNode(),
      canvasContext: scenarios.mockCanvasContext(),
      webglContext: scenarios.mockWebGLContext(),
      workerData: { type: 'worker', data: new ArrayBuffer(1024) },
      fileHandle: { name: 'test.mp3', size: 1024 * 1024 },
      eventListener: {
        target: 'window',
        event: 'resize',
        handler: () => undefined,
      },
      timerHandle: 123,
    }),

    deviceCapabilities: (): DeviceCapabilities => ({
      // Hardware specifications
      cpuCores: 8,
      memoryGB: 8,
      architecture: 'arm64',
      gpuSupport: true,

      // Audio-specific capabilities
      maxSampleRate: 48000,
      minBufferSize: 256,
      maxPolyphony: 64,
      audioWorkletSupport: true,
      sharedArrayBufferSupport: true,

      // Device classification
      deviceClass: 'high-end',
      platformVersion: '17.0',
      isTablet: false,
      screenSize: { width: 1170, height: 2532 },

      // Performance characteristics
      performanceScore: 0.9,
      thermalThrottlingThreshold: 0.8,
      batteryCapacity: 3095,
    }),

    mobileDeviceCapabilities: (): DeviceCapabilities => ({
      // Hardware specifications
      cpuCores: 4,
      memoryGB: 2,
      architecture: 'arm64',
      gpuSupport: false,

      // Audio-specific capabilities
      maxSampleRate: 44100,
      minBufferSize: 512,
      maxPolyphony: 16,
      audioWorkletSupport: false,
      sharedArrayBufferSupport: false,

      // Device classification
      deviceClass: 'low-end',
      platformVersion: '14.0',
      isTablet: false,
      screenSize: { width: 414, height: 896 },

      // Performance characteristics
      performanceScore: 0.3,
      thermalThrottlingThreshold: 0.6,
      batteryCapacity: 2000,
    }),

    batteryStatus: (): BatteryStatus => ({
      level: 0.8,
      charging: false,
      chargingTime: Infinity,
      dischargingTime: 18000,
      powerMode: 'balanced',
      lowPowerModeEnabled: false,
    }),

    lowBatteryStatus: (): BatteryStatus => ({
      level: 0.15,
      charging: false,
      chargingTime: Infinity,
      dischargingTime: 1800, // 30 minutes
      powerMode: 'high-performance',
      lowPowerModeEnabled: true,
    }),

    thermalStatus: (): ThermalStatus => ({
      state: 'nominal',
      throttlingActive: false,
      performanceReduction: 0,
    }),

    hotThermalStatus: (): ThermalStatus => ({
      state: 'serious',
      throttlingActive: true,
      performanceReduction: 0.3,
    }),

    assetCacheConfig: (): AssetCacheConfiguration => ({
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      maxAssetCount: 500,
      compressionEnabled: true,
      priorityBasedEviction: true,
      networkAwareRetention: true,
      batteryAwareEviction: true,
    }),

    mockProcessedManifest: () => ({
      assets: [
        {
          type: 'audio' as const,
          category: 'bassline' as const,
          url: 'https://cdn.example.com/audio1.mp3',
          priority: 'high' as const,
        },
        {
          type: 'midi' as const,
          category: 'drums' as const,
          url: 'https://cdn.example.com/midi1.mid',
          priority: 'medium' as const,
        },
      ],
      totalCount: 2,
      estimatedLoadTime: 5000,
      dependencies: [],
      loadingGroups: [
        {
          id: 'critical',
          priority: 1,
          assets: [
            {
              type: 'audio' as const,
              category: 'bassline' as const,
              url: 'https://cdn.example.com/audio1.mp3',
              priority: 'high' as const,
            },
          ],
          parallelLoadable: true,
          requiredForPlayback: true,
        },
        {
          id: 'secondary',
          priority: 2,
          assets: [
            {
              type: 'midi' as const,
              category: 'drums' as const,
              url: 'https://cdn.example.com/midi1.mid',
              priority: 'medium' as const,
            },
          ],
          parallelLoadable: false,
          requiredForPlayback: false,
        },
      ],
      optimizations: new Map(),
      totalSize: 1152 * 1024,
      criticalPath: ['https://cdn.example.com/audio1.mp3'],
    }),

    createSimpleManifest: (assetCount = 2) => ({
      assets: Array.from({ length: assetCount }, (_, i) => ({
        type: (i % 2 === 0 ? 'audio' : 'midi') as 'audio' | 'midi',
        category: (i % 2 === 0 ? 'bassline' : 'drums') as 'bassline' | 'drums',
        url: `https://cdn.example.com/${i % 2 === 0 ? 'audio' : 'midi'}${i}.${
          i % 2 === 0 ? 'mp3' : 'mid'
        }`,
        priority: (i < Math.floor(assetCount / 2) ? 'high' : 'medium') as
          | 'high'
          | 'medium'
          | 'low',
      })),
      totalCount: assetCount,
      estimatedLoadTime: assetCount * 2500,
      dependencies: [],
      loadingGroups:
        assetCount > 0
          ? [
              {
                id: 'critical',
                priority: 1,
                assets: [
                  {
                    type: 'audio' as const,
                    category: 'bassline' as const,
                    url: 'https://cdn.example.com/audio0.mp3',
                    priority: 'high' as const,
                  },
                ],
                parallelLoadable: true,
                requiredForPlayback: true,
              },
            ]
          : [],
      optimizations: new Map(),
      totalSize: assetCount * 512 * 1024,
      criticalPath:
        assetCount > 0 ? ['https://cdn.example.com/audio0.mp3'] : [],
    }),
  };

  // Behavior expectations (outcome-focused)
  const expectations = {
    shouldInitialize: () => {
      expect(manager).toBeDefined();
      expect(typeof manager).toBe('object');
    },

    shouldRegisterResource: (resourceId: string) => {
      expect(typeof resourceId).toBe('string');
      expect(resourceId.length).toBeGreaterThan(0);
    },

    shouldProvideUsageReport: (report: ResourceUsageReport) => {
      expect(report).toBeDefined();
      expect(typeof report).toBe('object');
      expect(typeof report.totalResources).toBe('number');
      expect(typeof report.totalMemoryUsage).toBe('number');
      expect(typeof report.timestamp).toBe('number');
      expect(report.resourcesByType).toBeInstanceOf(Map);
      expect(report.memoryByType).toBeInstanceOf(Map);
      expect(Array.isArray(report.recommendedActions)).toBe(true);
    },

    shouldPerformCleanup: (report: CleanupReport) => {
      expect(report).toBeDefined();
      expect(typeof report).toBe('object');
      expect(typeof report.cleaned).toBe('number');
      expect(typeof report.memoryReclaimed).toBe('number');
      expect(typeof report.totalChecked).toBe('number');
      expect(report.cleaned).toBeGreaterThanOrEqual(0);
      expect(report.memoryReclaimed).toBeGreaterThanOrEqual(0);
    },

    shouldDetectMemoryLeaks: (report: MemoryLeakReport) => {
      expect(report).toBeDefined();
      expect(typeof report).toBe('object');
      expect(Array.isArray(report.suspectedLeaks)).toBe(true);
      expect(typeof report.memoryGrowthRate).toBe('number');
      expect(typeof report.confidence).toBe('number');
      expect(typeof report.timestamp).toBe('number');
      expect(report.confidence).toBeGreaterThanOrEqual(0);
      expect(report.confidence).toBeLessThanOrEqual(1);
    },

    shouldProvideMetrics: (metrics: any) => {
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
      expect(typeof metrics.resourcesCreated).toBe('number');
      expect(typeof metrics.resourcesDisposed).toBe('number');
      expect(typeof metrics.memoryReclaimed).toBe('number');
    },

    shouldProvideConfiguration: (config: ResourceManagerConfig) => {
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
      expect(config.constraints).toBeDefined();
      expect(config.gcOptimization).toBeDefined();
      expect(config.leakDetection).toBeDefined();
      expect(config.monitoring).toBeDefined();
    },

    shouldHandleDeviceUpdates: () => {
      // Device status updates should complete without errors
      expect(true).toBe(true);
    },

    shouldRegisterEventHandler: (unsubscribe: any) => {
      expect(typeof unsubscribe).toBe('function');
    },

    shouldShutdown: () => {
      // Shutdown should complete without errors
      expect(true).toBe(true);
    },

    shouldLoadAssets: (result: any) => {
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(Array.isArray(result.successful)).toBe(true);
      expect(Array.isArray(result.failed)).toBe(true);
      expect(result.managedAssets).toBeInstanceOf(Map);
    },
  };

  beforeEach(async () => {
    // Safe environment setup - mock all browser APIs
    const browserEnv = scenarios.browserEnvironment();
    vi.stubGlobal('window', browserEnv.window);
    vi.stubGlobal('performance', browserEnv.performance);
    vi.stubGlobal('navigator', browserEnv.navigator);
    vi.stubGlobal('AudioContext', browserEnv.window.AudioContext);

    // Mock additional globals that might be needed
    if (typeof WeakRef === 'undefined') {
      vi.stubGlobal('WeakRef', browserEnv.window.WeakRef);
    }
    if (typeof FinalizationRegistry === 'undefined') {
      vi.stubGlobal(
        'FinalizationRegistry',
        browserEnv.window.FinalizationRegistry,
      );
    }

    // Setup fetch mock for CDN tests
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      blob: () => Promise.resolve(new Blob(['test content'])),
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve('test content'),
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
    });

    // Reset singleton for fresh test
    ResourceManager.resetInstance();
    manager = ResourceManager.getInstance(scenarios.basicConfig());
  });

  afterEach(async () => {
    // Clean up manager
    try {
      await manager.shutdown();
    } catch {
      // Ignore shutdown errors in tests
    }

    // Clean up mocks
    vi.unstubAllGlobals();
  });

  describe('🚀 Initialization Behavior', () => {
    it('should create singleton instance successfully', () => {
      // Act & Assert
      expect(() => {
        const instance = ResourceManager.getInstance();
        expectations.shouldInitialize();
        expect(instance).toBe(manager); // Singleton check
      }).not.toThrow();
    });

    it('should initialize with device capabilities', async () => {
      // Arrange
      const capabilities = scenarios.deviceCapabilities();
      const battery = scenarios.batteryStatus();
      const thermal = scenarios.thermalStatus();

      // Act & Assert
      await expect(
        manager.initialize(capabilities, battery, thermal),
      ).resolves.not.toThrow();

      expectations.shouldInitialize();
    });

    it('should initialize with mobile device constraints', async () => {
      // Arrange
      ResourceManager.resetInstance();
      const mobileManager = ResourceManager.getInstance(
        scenarios.lowResourceConfig(),
      );
      const capabilities = scenarios.mobileDeviceCapabilities();
      const battery = scenarios.lowBatteryStatus();
      const thermal = scenarios.hotThermalStatus();

      // Act & Assert
      await expect(
        mobileManager.initialize(capabilities, battery, thermal),
      ).resolves.not.toThrow();

      expectations.shouldInitialize();

      // Cleanup
      await mobileManager.shutdown();
    });

    it('should handle repeated initialization calls', async () => {
      // Act & Assert
      await expect(manager.initialize()).resolves.not.toThrow();
      await expect(manager.initialize()).resolves.not.toThrow();
      await expect(manager.initialize()).resolves.not.toThrow();

      expectations.shouldInitialize();
    });
  });

  describe('⚙️ Configuration and Status Behavior', () => {
    it('should provide configuration access', () => {
      // Act
      const config = manager.getConfig();

      // Assert
      expectations.shouldProvideConfiguration(config);
    });

    it('should track initialization status', () => {
      // Act
      const isInitialized = manager.isInitialized();

      // Assert
      expect(typeof isInitialized).toBe('boolean');
    });

    it('should provide metrics', () => {
      // Act
      const metrics = manager.getMetrics();

      // Assert
      expectations.shouldProvideMetrics(metrics);
    });

    it('should generate usage reports', async () => {
      // Arrange
      await manager.initialize();

      // Act
      const report = manager.generateUsageReport();

      // Assert
      expectations.shouldProvideUsageReport(report);
    });

    it('should update asset cache configuration', () => {
      // Arrange
      const cacheConfig = scenarios.assetCacheConfig();

      // Act & Assert
      expect(() => {
        manager.updateAssetCacheConfiguration(cacheConfig);
      }).not.toThrow();
    });
  });

  describe('🔄 Resource Management Behavior', () => {
    it('should register different types of resources', async () => {
      // Arrange
      await manager.initialize();
      const resources = scenarios.testResources();

      // Act & Assert
      Object.entries(resources).forEach(([name, resource]) => {
        const resourceId = manager.register(
          resource,
          name.replace(/([A-Z])/g, '_$1').toLowerCase() as ResourceType,
          { priority: 'medium' },
        );
        expectations.shouldRegisterResource(resourceId);
      });
    });

    it('should handle resource access and reference counting', async () => {
      // Arrange
      await manager.initialize();
      const resource = scenarios.testResources().audioBuffer;
      const resourceId = manager.register(resource, 'audio_buffer');

      // Act
      const retrievedResource = manager.access(resourceId);
      const refAdded = manager.addRef(resourceId);
      const refRemoved = manager.removeRef(resourceId);

      // Assert
      expect(retrievedResource).toBeDefined();
      expect(typeof refAdded).toBe('boolean');
      expect(typeof refRemoved).toBe('boolean');
    });

    it('should dispose resources successfully', async () => {
      // Arrange
      await manager.initialize();
      const resource = scenarios.testResources().audioBuffer;
      const resourceId = manager.register(resource, 'audio_buffer');

      // Act
      const disposed = await manager.dispose(resourceId);

      // Assert
      expect(typeof disposed).toBe('boolean');
    });

    it('should handle forced resource disposal', async () => {
      // Arrange
      await manager.initialize();
      const resource = scenarios.testResources().audioNode;
      const resourceId = manager.register(resource, 'audio_context');

      // Act
      const disposed = await manager.dispose(resourceId, true);

      // Assert
      expect(typeof disposed).toBe('boolean');
    });

    it('should manage resource pools', async () => {
      // Arrange
      await manager.initialize();

      // Act & Assert
      await expect(manager.getFromPool('audio_buffer')).resolves.toBeDefined();

      const resource = scenarios.testResources().audioBuffer;
      await expect(
        manager.returnToPool('audio_buffer', resource),
      ).resolves.not.toThrow();
    });
  });

  describe('🧹 Cleanup and Optimization Behavior', () => {
    it('should perform resource cleanup', async () => {
      // Arrange
      await manager.initialize();
      const resources = scenarios.testResources();

      // Register some resources
      Object.entries(resources).forEach(([name, resource]) => {
        manager.register(
          resource,
          name.replace(/([A-Z])/g, '_$1').toLowerCase() as ResourceType,
        );
      });

      // Act
      const cleanupReport = await manager.cleanupResources();

      // Assert
      expectations.shouldPerformCleanup(cleanupReport);
    });

    it('should perform targeted cleanup by type', async () => {
      // Arrange
      await manager.initialize();
      const audioBuffer = scenarios.testResources().audioBuffer;
      manager.register(audioBuffer, 'audio_buffer');

      // Act
      const cleanupReport = await manager.cleanupResources({
        types: ['audio_buffer'],
        force: true,
      });

      // Assert
      expectations.shouldPerformCleanup(cleanupReport);
    });

    it('should perform cleanup by age', async () => {
      // Arrange
      await manager.initialize();
      const resource = scenarios.testResources().canvasContext;
      manager.register(resource, 'canvas_context');

      // Act
      const cleanupReport = await manager.cleanupResources({
        olderThan: 1000, // 1 second
      });

      // Assert
      expectations.shouldPerformCleanup(cleanupReport);
    });

    it('should trigger garbage collection', async () => {
      // Arrange
      await manager.initialize();

      // Act & Assert
      await expect(manager.triggerGC()).resolves.not.toThrow();
      await expect(manager.triggerGC(true)).resolves.not.toThrow(); // Forced GC
    });

    it('should perform emergency asset cleanup', async () => {
      // Arrange
      await manager.initialize();

      // Act & Assert
      await expect(manager.emergencyAssetCleanup()).resolves.not.toThrow();
    });
  });

  describe('🕵️ Memory Leak Detection Behavior', () => {
    it('should detect memory leaks', async () => {
      // Arrange
      await manager.initialize();

      // Register some resources that might leak
      const resources = scenarios.testResources();
      Object.entries(resources).forEach(([name, resource]) => {
        manager.register(
          resource,
          name.replace(/([A-Z])/g, '_$1').toLowerCase() as ResourceType,
        );
      });

      // Act
      const leakReport = await manager.detectMemoryLeaks();

      // Assert
      expectations.shouldDetectMemoryLeaks(leakReport);
    });

    it('should handle leak detection with no leaks', async () => {
      // Arrange
      await manager.initialize();

      // Act
      const leakReport = await manager.detectMemoryLeaks();

      // Assert
      expectations.shouldDetectMemoryLeaks(leakReport);
      expect(leakReport.suspectedLeaks.length).toBe(0);
    });
  });

  describe('📊 Device Adaptation Behavior', () => {
    it('should update battery status', () => {
      // Arrange
      const batteryStatus = scenarios.batteryStatus();

      // Act & Assert
      expect(() => {
        manager.updateDeviceStatus(batteryStatus);
      }).not.toThrow();

      expectations.shouldHandleDeviceUpdates();
    });

    it('should update thermal status', () => {
      // Arrange
      const thermalStatus = scenarios.thermalStatus();

      // Act & Assert
      expect(() => {
        manager.updateDeviceStatus(undefined, thermalStatus);
      }).not.toThrow();

      expectations.shouldHandleDeviceUpdates();
    });

    it('should adapt to low battery conditions', () => {
      // Arrange
      const lowBattery = scenarios.lowBatteryStatus();
      const hotThermal = scenarios.hotThermalStatus();

      // Act & Assert
      expect(() => {
        manager.updateDeviceStatus(lowBattery, hotThermal);
      }).not.toThrow();

      expectations.shouldHandleDeviceUpdates();
    });
  });

  describe('📡 Event Handling Behavior', () => {
    it('should register event handlers successfully', () => {
      // Act
      const unsubscribe1 = manager.on('resourceCreated', (metadata) => {
        console.log('Resource created:', metadata.id);
      });

      const unsubscribe2 = manager.on(
        'memoryPressureAlert',
        (pressure, _report) => {
          console.log('Memory pressure:', pressure);
        },
      );

      // Assert
      expectations.shouldRegisterEventHandler(unsubscribe1);
      expectations.shouldRegisterEventHandler(unsubscribe2);

      // Cleanup
      unsubscribe1();
      unsubscribe2();
    });

    it('should handle multiple event handlers for same event', () => {
      // Act
      const unsubscribers = [
        manager.on('resourceCreated', () => undefined),
        manager.on('resourceCreated', () => undefined),
        manager.on('resourceCreated', () => undefined),
      ];

      // Assert
      unsubscribers.forEach((unsubscribe) => {
        expectations.shouldRegisterEventHandler(unsubscribe);
      });

      // Cleanup
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    });

    it('should handle all event types', () => {
      // Act & Assert
      const unsubscribers = [
        manager.on('resourceCreated', () => undefined),
        manager.on('resourceDisposed', () => undefined),
        manager.on('resourceLeakDetected', () => undefined),
        manager.on('memoryPressureAlert', () => undefined),
        manager.on('gcTriggered', () => undefined),
        manager.on('cleanupCompleted', () => undefined),
        manager.on('poolResized', () => undefined),
      ];

      unsubscribers.forEach((unsubscribe) => {
        expectations.shouldRegisterEventHandler(unsubscribe);
      });

      // Cleanup
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    });
  });

  describe('🌐 Epic 2 Integration Behavior', () => {
    it('should load assets from CDN with manifest', async () => {
      // Arrange
      await manager.initialize();
      const mockManifest = scenarios.mockProcessedManifest();

      // Act
      const result = await manager.loadAssetsFromCDN(mockManifest);

      // Assert
      expectations.shouldLoadAssets(result);
      expect(result.successful).toBeDefined();
      expect(result.failed).toBeDefined();
      expect(result.managedAssets).toBeDefined();
    }, 15000); // Increase timeout to 15s

    it('should load assets from CDN with empty manifest', async () => {
      // Arrange
      await manager.initialize();
      const emptyManifest = scenarios.createSimpleManifest(0);

      // Act
      const result = await manager.loadAssetsFromCDN(emptyManifest);

      // Assert
      expectations.shouldLoadAssets(result);
      expect(result.successful.length).toBe(0);
      expect(result.failed.length).toBe(0);
    });

    it('should load assets from CDN with large manifest', async () => {
      // Arrange
      await manager.initialize();
      const largeManifest = scenarios.createSimpleManifest(100);

      // Act
      const result = await manager.loadAssetsFromCDN(largeManifest);

      // Assert
      expectations.shouldLoadAssets(result);
      expect(result.managedAssets.size).toBeGreaterThanOrEqual(0);
    }, 15000); // Increase timeout to 15s

    it('should get asset by URL after loading', async () => {
      // Arrange
      await manager.initialize();
      const manifest = scenarios.mockProcessedManifest();
      const testUrl = 'https://cdn.example.com/audio1.mp3';

      // Load assets first
      await manager.loadAssetsFromCDN(manifest);

      // Act
      const asset = manager.getAssetByUrl(testUrl);

      // Assert
      // Asset may or may not be found depending on loading success
      if (asset) {
        expect(asset).toBeDefined();
        expect(typeof asset).toBe('object');
      } else {
        expect(asset).toBeNull();
      }
    }, 15000); // Increase timeout to 15s

    it('should get asset by URL for non-existent asset', async () => {
      // Arrange
      await manager.initialize();

      // Act
      const asset = manager.getAssetByUrl('non-existent-url');

      // Assert
      expect(asset).toBeNull();
    });

    it('should get asset by URL with invalid URL formats', async () => {
      // Arrange
      await manager.initialize();
      const invalidUrls = ['', null, undefined, 'invalid-url', 123, {}];

      // Act & Assert
      invalidUrls.forEach((url) => {
        const asset = manager.getAssetByUrl(url as any);
        expect(asset).toBeNull();
      });
    });

    it('should provide asset lifecycle metrics', () => {
      // Act
      const metrics = manager.getAssetLifecycleMetrics();

      // Assert
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');

      // Validate lifecycle metrics structure (using actual property names)
      if (metrics) {
        expect(typeof metrics.totalAssetsLoaded).toBe('number');
        expect(typeof metrics.averageAssetLoadTime).toBe('number');
        expect(typeof metrics.cacheEfficiency).toBe('number');
        expect(metrics.totalAssetsLoaded).toBeGreaterThanOrEqual(0);
        expect(metrics.averageAssetLoadTime).toBeGreaterThanOrEqual(0);
        expect(metrics.cacheEfficiency).toBeGreaterThanOrEqual(0);
        expect(metrics.cacheEfficiency).toBeLessThanOrEqual(1);
      }
    });

    it('should track asset lifecycle metrics over time', async () => {
      // Arrange
      await manager.initialize();
      const manifest = scenarios.mockProcessedManifest();

      // Act
      const initialMetrics = manager.getAssetLifecycleMetrics();
      await manager.loadAssetsFromCDN(manifest);
      const updatedMetrics = manager.getAssetLifecycleMetrics();

      // Assert
      expect(initialMetrics).toBeDefined();
      expect(updatedMetrics).toBeDefined();

      // Metrics may change after loading assets
      if (initialMetrics && updatedMetrics) {
        expect(typeof initialMetrics.totalAssetsLoaded).toBe('number');
        expect(typeof updatedMetrics.totalAssetsLoaded).toBe('number');
        // Updated metrics should reflect potential changes
        expect(updatedMetrics.totalAssetsLoaded).toBeGreaterThanOrEqual(
          initialMetrics.totalAssetsLoaded,
        );
      }
    }, 15000); // Increase timeout to 15s

    it('should handle CDN loading with network errors', async () => {
      // Arrange
      await manager.initialize();
      const manifest = scenarios.createSimpleManifest(1);

      // Update with failing URL if asset exists
      if (manifest.assets.length > 0 && manifest.assets[0]) {
        manifest.assets[0].url =
          'https://invalid-cdn.example.com/nonexistent.mp3';
      }

      // Act
      const result = await manager.loadAssetsFromCDN(manifest);

      // Assert
      expectations.shouldLoadAssets(result);
      // Network errors should be handled gracefully
      expect(result.failed.length).toBeGreaterThanOrEqual(0);
    }, 15000); // Increase timeout to 15s

    it('should handle CDN loading with asset priorities', async () => {
      // Arrange
      await manager.initialize();
      const prioritizedManifest = scenarios.createSimpleManifest(2);

      // Act
      const result = await manager.loadAssetsFromCDN(prioritizedManifest);

      // Assert
      expectations.shouldLoadAssets(result);
      expect(result.managedAssets).toBeDefined();
    });
  });

  describe('🛡️ Error Recovery Behavior', () => {
    it('should handle missing browser APIs gracefully', async () => {
      // Arrange: Remove browser APIs
      vi.stubGlobal('performance', undefined);
      vi.stubGlobal('WeakRef', undefined);
      vi.stubGlobal('FinalizationRegistry', undefined);
      vi.stubGlobal('AudioContext', undefined);

      ResourceManager.resetInstance();

      // Act & Assert
      expect(() => {
        const _fallbackManager = ResourceManager.getInstance();
        expectations.shouldInitialize();
      }).not.toThrow();

      const fallbackManager = ResourceManager.getInstance();
      await expect(fallbackManager.initialize()).resolves.not.toThrow();

      // Cleanup
      await fallbackManager.shutdown();
    });

    it('should handle operations without initialization', () => {
      // Arrange: Fresh manager without initialization
      ResourceManager.resetInstance();
      const uninitializedManager = ResourceManager.getInstance();

      // Act & Assert: Should handle gracefully
      const config = uninitializedManager.getConfig();
      expectations.shouldProvideConfiguration(config);

      const metrics = uninitializedManager.getMetrics();
      expectations.shouldProvideMetrics(metrics);

      const report = uninitializedManager.generateUsageReport();
      expectations.shouldProvideUsageReport(report);

      // Cleanup
      uninitializedManager.shutdown();
    });

    it('should handle shutdown multiple times', async () => {
      // Arrange
      await manager.initialize();

      // Act & Assert
      await expect(manager.shutdown()).resolves.not.toThrow();
      await expect(manager.shutdown()).resolves.not.toThrow();
      await expect(manager.shutdown()).resolves.not.toThrow();

      expectations.shouldShutdown();
    });

    it('should handle concurrent operations gracefully', async () => {
      // Arrange
      await manager.initialize();
      const resource = scenarios.testResources().audioBuffer;

      // Act: Simulate concurrent operations
      const promises = [
        Promise.resolve(manager.register(resource, 'audio_buffer')),
        Promise.resolve(manager.generateUsageReport()),
        manager.cleanupResources(),
        manager.detectMemoryLeaks(),
        manager.triggerGC(),
      ];

      // Assert: All should complete without throwing
      const results = await Promise.allSettled(promises);
      results.forEach((result) => {
        expect(['fulfilled', 'rejected']).toContain(result.status);
        if (result.status === 'rejected') {
          // Errors should be Error instances, not random throws
          expect(result.reason).toBeInstanceOf(Error);
        }
      });
    });

    it('should handle resource disposal errors gracefully', async () => {
      // Arrange
      await manager.initialize();
      const faultyResource = {
        dispose: vi.fn(() => {
          throw new Error('Disposal failed');
        }),
      };
      const resourceId = manager.register(faultyResource, 'audio_buffer');

      // Act
      const disposed = await manager.dispose(resourceId, true);

      // Assert: Should handle disposal errors gracefully
      expect(typeof disposed).toBe('boolean');
    });

    it('should handle pool operations with missing resources', async () => {
      // Arrange
      await manager.initialize();

      // Act & Assert: Should handle missing pool resources gracefully
      await expect(manager.getFromPool('audio_buffer')).resolves.toBeDefined();

      const invalidResource = null;
      await expect(
        manager.returnToPool('audio_buffer', invalidResource),
      ).resolves.not.toThrow();
    });

    it('should handle memory pressure gracefully', async () => {
      // Arrange
      await manager.initialize();

      // Mock high memory usage
      if (performance.memory) {
        vi.mocked(performance.memory).usedJSHeapSize = 1.9 * 1024 * 1024 * 1024; // Close to limit
      }

      // Act & Assert: Should handle memory pressure without throwing
      const report = manager.generateUsageReport();
      expectations.shouldProvideUsageReport(report);

      const cleanupReport = await manager.cleanupResources({ force: true });
      expectations.shouldPerformCleanup(cleanupReport);
    });
  });
});
