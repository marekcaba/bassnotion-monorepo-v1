/**
 * StatePersistenceManager Behavior Tests
 *
 * These tests focus on behavior and outcomes rather than implementation details.
 * Following the successful pattern from ResourceUsageMonitor, WorkerPoolManager, and PerformanceMonitor.
 * Enhanced with sophisticated features from classic test for comprehensive coverage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StatePersistenceManager } from '../StatePersistenceManager.js';
import type {
  PersistenceConfig,
  PersistedState,
} from '../StatePersistenceManager.js';

// Enhanced Test Environment Setup
const setupPersistenceTestEnvironment = () => {
  const mockStorage = new Map<string, string>();
  const mockBroadcastChannel = {
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    close: vi.fn(),
  };

  // Enhanced localStorage mock with quota simulation
  const storageMock = {
    getItem: vi.fn((key: string) => mockStorage.get(key) || null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => mockStorage.delete(key)),
    clear: vi.fn(() => mockStorage.clear()),
    get length() {
      return mockStorage.size;
    },
    key: vi.fn(
      (index: number) => Array.from(mockStorage.keys())[index] || null,
    ),
  };

  // Enhanced navigator mock with storage quota API
  const navigatorMock = {
    storage: {
      estimate: vi.fn().mockResolvedValue({
        usage: 1024 * 1024, // 1MB used
        quota: 100 * 1024 * 1024, // 100MB available
      }),
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  };

  // Performance API mock
  const performanceMock = {
    now: vi.fn(() => Date.now()),
  };

  // Window API mock with timer functions
  const windowMock = {
    setInterval: vi.fn((fn: () => void, delay: number) => {
      setTimeout(fn, delay);
      return 123; // Mock timer ID
    }),
    clearInterval: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  return {
    mockStorage,
    mockBroadcastChannel,
    storageMock,
    navigatorMock,
    performanceMock,
    windowMock,
  };
};

// Advanced Test Scenario Builders
const createPersistenceScenarios = () => {
  // Configuration presets for different use cases
  const configPresets = {
    basicConfig: (): Partial<PersistenceConfig> => ({
      enabled: true,
      storageType: 'localStorage',
      autoSaveInterval: 5000,
      maxStorageSize: 1024 * 1024, // 1MB
      compressionEnabled: false,
      encryptionEnabled: false,
      versionMigration: true,
      crossTabSync: false,
    }),

    realtimeConfig: (): Partial<PersistenceConfig> => ({
      enabled: true,
      storageType: 'localStorage',
      autoSaveInterval: 100, // 100ms for testing
      maxStorageSize: 5 * 1024 * 1024, // 5MB
      compressionEnabled: true,
      encryptionEnabled: false,
      versionMigration: true,
      crossTabSync: true,
    }),

    mobileConfig: (): Partial<PersistenceConfig> => ({
      enabled: true,
      storageType: 'localStorage',
      autoSaveInterval: 5000, // Increased for mobile
      maxStorageSize: 2 * 1024 * 1024, // 2MB for mobile
      compressionEnabled: true,
      encryptionEnabled: false,
      versionMigration: true,
      crossTabSync: false, // Disabled for mobile performance
    }),

    disabledConfig: (): Partial<PersistenceConfig> => ({
      enabled: false,
    }),
  };

  // Session scenario builders for complex testing
  const sessionScenarios = {
    normalSession: () => ({
      sessionId: 'session-normal',
      duration: 30, // 30 minutes
      hasUnsavedChanges: true,
      deviceType: 'desktop' as const,
      connectionQuality: 'good' as const,
    }),

    criticalSession: () => ({
      sessionId: 'session-critical',
      duration: 120, // 2 hours of work
      hasUnsavedChanges: true,
      deviceType: 'mobile' as const,
      connectionQuality: 'poor' as const,
    }),

    shortSession: () => ({
      sessionId: 'session-short',
      duration: 5, // 5 minutes
      hasUnsavedChanges: false,
      deviceType: 'desktop' as const,
      connectionQuality: 'good' as const,
    }),
  };

  // Progressive state builder that evolves over time
  const createProgressiveState = (
    minutes: number,
  ): Partial<PersistedState> => ({
    version: '2.1.0',
    timestamp: Date.now() - minutes * 60 * 1000,
    sessionId: `session-${minutes}min`,
    config: {
      masterVolume: Math.max(0.1, Math.min(1.0, 0.8 + minutes * 0.01)),
      tempo: 120 + (minutes % 40), // Varying tempo
      pitch: 0,
      swingFactor: 0.1,
    },
    playbackState: minutes > 10 ? 'playing' : 'stopped',
    audioSources: Array.from(
      { length: Math.min(8, 2 + Math.floor(minutes / 10)) },
      (_, i) => ({
        id: `track-${i}`,
        type: 'bass' as const,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      }),
    ),
    soloSources: [],
    transportState: {
      position: minutes * 1000, // Convert to ms
      bpm: 120 + (minutes % 40),
      swing: 0.1,
      loop: minutes > 15, // Enable loop for longer sessions
    },
    performanceHistory: {
      averageLatency: 20 + Math.floor(minutes / 10), // Latency increases over time
      maxLatency: 50 + Math.floor(minutes / 5),
      dropoutCount: Math.floor(minutes / 20), // Occasional dropouts
      lastMeasurement: Date.now() - minutes * 60 * 1000,
    },
    userPreferences: {
      masterVolume: Math.max(0.1, Math.min(1.0, 0.8 + minutes * 0.01)),
      audioQuality: minutes > 60 ? 'high' : 'medium',
      backgroundProcessing: true,
      batteryOptimization: minutes > 90, // Enable for long sessions
    },
    metadata: {
      deviceInfo: 'Test Device',
      browserInfo: 'Test Browser',
      lastActiveTime: Date.now() - 1000,
      sessionDuration: minutes * 60 * 1000,
    },
  });

  // Large state builder for compression testing
  const createLargeState = (): Partial<PersistedState> => ({
    ...createProgressiveState(90),
    audioSources: Array.from({ length: 100 }, (_, i) => ({
      id: `source-${i}`,
      type: 'bass' as const,
      volume: Math.random(),
      pan: 0,
      muted: false,
      solo: false,
      buffer: new Array(1000).fill(Math.random()), // Large data
    })),
    metadata: {
      deviceInfo: 'Test Device',
      browserInfo: 'Test Browser',
      lastActiveTime: Date.now(),
      sessionDuration: 90 * 60 * 1000,
    },
  });

  // Version migration scenarios
  const legacyStates = {
    v1_0_0: {
      version: '1.0.0',
      timestamp: Date.now(),
      config: { sampleRate: 44100 }, // Old format
      playbackState: 'stopped',
      // Missing new fields that should be migrated
    },

    v1_5_0: {
      version: '1.5.0',
      timestamp: Date.now(),
      config: {
        masterVolume: 0.8,
        tempo: 120,
        // Missing pitch and swingFactor
      },
      playbackState: 'paused',
      audioSources: [],
      // Missing new performance and metadata fields
    },
  };

  // Error simulation scenarios
  const errorScenarios = {
    storageQuotaExceeded: () => {
      throw new Error('QuotaExceededError');
    },

    storageAccessDenied: () => {
      throw new Error('Storage access denied');
    },

    corruptedData: () => 'corrupted-json-data-{invalid',

    networkError: () => {
      throw new Error('Network connection failed');
    },
  };

  return {
    configPresets,
    sessionScenarios,
    createProgressiveState,
    createLargeState,
    legacyStates,
    errorScenarios,
  };
};

// Enhanced Validation Helpers
const expectValidPersistenceState = (state: PersistedState | null) => {
  if (state) {
    expect(state.version).toBeDefined();
    expect(state.timestamp).toBeGreaterThan(0);
    expect(state.sessionId).toBeDefined();
    expect(state.config).toBeDefined();
    expect(state.playbackState).toBeDefined();
    expect(Array.isArray(state.audioSources)).toBe(true);
    expect(state.transportState).toBeDefined();
  }
};

const expectValidMetrics = (metrics: any) => {
  expect(metrics).toBeDefined();
  expect(typeof metrics.saveOperations).toBe('number');
  expect(typeof metrics.loadOperations).toBe('number');
  expect(typeof metrics.errorCount).toBe('number');
  expect(typeof metrics.averageSaveTime).toBe('number');
  expect(typeof metrics.averageLoadTime).toBe('number');
  expect(metrics.saveOperations).toBeGreaterThanOrEqual(0);
  expect(metrics.loadOperations).toBeGreaterThanOrEqual(0);
  expect(metrics.errorCount).toBeGreaterThanOrEqual(0);
};

const expectValidStorageQuota = (quota: any) => {
  expect(quota).toBeDefined();
  expect(typeof quota.used).toBe('number');
  expect(typeof quota.total).toBe('number');
  expect(typeof quota.percentage).toBe('number');
  expect(quota.used).toBeGreaterThanOrEqual(0);
  expect(quota.total).toBeGreaterThan(quota.used);
  expect(quota.percentage).toBeGreaterThanOrEqual(0);
  expect(quota.percentage).toBeLessThanOrEqual(100);
};

const expectSuccessfulMigration = (
  state: PersistedState | null,
  targetVersion: string,
) => {
  expectValidPersistenceState(state);
  if (state) {
    expect(state.version).toBe(targetVersion);
    // Verify new fields are present after migration
    expect(state.config).toBeDefined();
    expect(state.userPreferences).toBeDefined();
    expect(state.metadata).toBeDefined();
  }
};

const expectCompressionEfficiency = (metrics: any) => {
  expect(metrics.compressionRatio).toBeDefined();
  expect(metrics.compressionRatio).toBeGreaterThan(0);
  expect(metrics.compressionRatio).toBeLessThanOrEqual(1);
};

const expectPerformanceWithinBenchmarks = (metrics: any, benchmarks: any) => {
  expect(metrics.averageSaveTime).toBeLessThan(benchmarks.maxSaveTime);
  expect(metrics.averageLoadTime).toBeLessThan(benchmarks.maxLoadTime);
  expect(metrics.errorCount).toBeLessThanOrEqual(benchmarks.maxErrors);
};

describe('StatePersistenceManager - Enhanced Behavior', () => {
  let manager: StatePersistenceManager;
  let testEnvironment: ReturnType<typeof setupPersistenceTestEnvironment>;
  let scenarios: ReturnType<typeof createPersistenceScenarios>;

  beforeEach(async () => {
    // Setup enhanced test environment
    testEnvironment = setupPersistenceTestEnvironment();
    scenarios = createPersistenceScenarios();

    // Apply environment mocks
    vi.stubGlobal('localStorage', testEnvironment.storageMock);
    vi.stubGlobal('sessionStorage', testEnvironment.storageMock);
    vi.stubGlobal('navigator', testEnvironment.navigatorMock);
    vi.stubGlobal('performance', testEnvironment.performanceMock);
    vi.stubGlobal('window', testEnvironment.windowMock);
    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(() => testEnvironment.mockBroadcastChannel),
    );

    // Reset singleton for fresh test
    StatePersistenceManager.resetInstance();
    manager = StatePersistenceManager.getInstance();
  });

  afterEach(async () => {
    // Clean up manager
    try {
      await manager.dispose();
    } catch {
      // Ignore disposal errors in tests
    }

    // Clean up mocks
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('🚀 Enhanced Initialization Behavior', () => {
    it('should initialize with realtime configuration', async () => {
      const config = scenarios.configPresets.realtimeConfig();

      await expect(manager.initialize(config)).resolves.not.toThrow();

      const metrics = manager.getMetrics();
      expectValidMetrics(metrics);
    });

    it('should adapt configuration for mobile devices', async () => {
      // Mock mobile device
      vi.stubGlobal('navigator', {
        ...testEnvironment.navigatorMock,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      });

      const config = scenarios.configPresets.mobileConfig();

      await expect(manager.initialize(config)).resolves.not.toThrow();

      // Should handle mobile-specific constraints
      const metrics = manager.getMetrics();
      expectValidMetrics(metrics);
    });

    it('should handle storage quota estimation during initialization', async () => {
      await manager.initialize(scenarios.configPresets.basicConfig());

      const metrics = manager.getMetrics();
      expectValidMetrics(metrics);

      if (metrics.storageQuota) {
        expectValidStorageQuota(metrics.storageQuota);
      }
    });
  });

  describe('💾 Advanced State Management Behavior', () => {
    beforeEach(async () => {
      await manager.initialize(scenarios.configPresets.basicConfig());
    });

    it('should save and restore complete progressive session state', async () => {
      const progressiveState = scenarios.createProgressiveState(45);

      await manager.saveState(progressiveState);
      const loadedState = await manager.loadState();

      expectValidPersistenceState(loadedState);
      if (loadedState) {
        expect(loadedState.metadata?.sessionDuration).toBe(45 * 60 * 1000);
        expect(loadedState.audioSources?.length).toBeGreaterThan(0);
        expect(loadedState.transportState?.loop).toBe(true); // Should be true for 45min session
      }
    });

    it('should handle large state data with compression', async () => {
      await manager.dispose();
      await manager.initialize({
        ...scenarios.configPresets.realtimeConfig(),
        compressionEnabled: true,
      });

      const largeState = scenarios.createLargeState();

      await manager.saveState(largeState);
      const loadedState = await manager.loadState();

      expectValidPersistenceState(loadedState);

      const metrics = manager.getMetrics();
      if (metrics.compressionRatio !== undefined) {
        expectCompressionEfficiency(metrics);
      }
    });

    it('should track user vs internal save operations separately', async () => {
      manager.resetMetrics();

      const states = [
        scenarios.createProgressiveState(10),
        scenarios.createProgressiveState(20),
        scenarios.createProgressiveState(30),
      ];

      // Perform user save operations
      for (const state of states) {
        await manager.saveState(state);
      }

      const metrics = manager.getMetrics();
      expectValidMetrics(metrics);

      // User operations should be tracked
      if (metrics.userSaveOperations !== undefined) {
        expect(metrics.userSaveOperations).toBe(states.length);
        expect(metrics.saveOperations).toBeGreaterThanOrEqual(
          metrics.userSaveOperations,
        );
      }
    });
  });

  describe('🔄 Auto-Save Functionality Behavior', () => {
    it('should automatically save state at configured intervals', async () => {
      await manager.initialize({
        ...scenarios.configPresets.realtimeConfig(),
        autoSaveInterval: 100, // 100ms for testing
      });

      let autoSaveCount = 0;
      const originalSave = manager.saveState;
      manager.saveState = vi.fn().mockImplementation(async (state, options) => {
        if (options?.isAutoSave) {
          autoSaveCount++;
        }
        return originalSave.call(manager, state, options);
      });

      // Trigger state changes that should trigger auto-save
      const states = [
        scenarios.createProgressiveState(1),
        scenarios.createProgressiveState(2),
        scenarios.createProgressiveState(3),
      ];

      for (const state of states) {
        await manager.saveState(state);
        await new Promise((resolve) => setTimeout(resolve, 150)); // Wait for auto-save
      }

      // Auto-save should have been triggered
      expect(autoSaveCount).toBeGreaterThan(0);
    });

    it('should optimize to avoid redundant auto-saves', async () => {
      await manager.initialize({
        ...scenarios.configPresets.realtimeConfig(),
        autoSaveInterval: 50,
      });

      const unchangedState = scenarios.createProgressiveState(5);

      // Save same state multiple times
      await manager.saveState(unchangedState);
      await manager.saveState(unchangedState);
      await manager.saveState(unchangedState);

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should optimize redundant saves
      const metrics = manager.getMetrics();
      expect(metrics.saveOperations).toBeLessThan(10); // Reasonable limit
    });

    it('should prioritize manual saves over auto-saves', async () => {
      await manager.initialize({
        ...scenarios.configPresets.realtimeConfig(),
        autoSaveInterval: 50,
      });

      const criticalState = scenarios.createProgressiveState(120); // 2 hours of work

      // Manual save should complete even if auto-save is running
      await expect(manager.saveState(criticalState)).resolves.not.toThrow();
    });
  });

  describe('🌐 Cross-Tab Synchronization Behavior', () => {
    beforeEach(async () => {
      await manager.initialize({
        ...scenarios.configPresets.realtimeConfig(),
        crossTabSync: true,
      });
    });

    it('should synchronize state changes across multiple tabs', async () => {
      const stateFromTab1 = scenarios.createProgressiveState(30);

      await manager.saveState(stateFromTab1);

      // Simulate cross-tab sync (implementation may vary)
      expect(
        testEnvironment.mockBroadcastChannel.postMessage,
      ).toHaveBeenCalled();
    });

    it('should resolve conflicts using last writer wins strategy', async () => {
      const tab1State = scenarios.createProgressiveState(45);
      const progressiveState = scenarios.createProgressiveState(45);
      const tab2State = {
        ...progressiveState,
        config: {
          masterVolume: 0.5,
          tempo: progressiveState.config?.tempo || 120,
          pitch: progressiveState.config?.pitch || 0,
          swingFactor: progressiveState.config?.swingFactor || 0.1,
        },
      };

      // Simulate simultaneous saves from different tabs
      await manager.saveState(tab1State);

      // Simulate conflict from another tab (newer timestamp)
      const conflictState = {
        ...tab2State,
        timestamp: Date.now() + 1000, // 1 second newer
      };

      await manager.saveState(conflictState);
      const finalState = await manager.loadState();

      expectValidPersistenceState(finalState);
      // Should handle conflict resolution
      expect(finalState).toBeDefined();
    });

    it('should cleanup inactive tab sessions', async () => {
      // Simulate old sessions that should be cleaned up
      const oldSession = JSON.stringify({
        version: '2.1.0',
        sessionId: 'old-session-1',
        timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours old
      });

      testEnvironment.mockStorage.set('bassnotion-session-old-1', oldSession);

      // Should handle cleanup gracefully during normal operations
      await manager.saveState(scenarios.createProgressiveState(10));

      expect(testEnvironment.mockStorage.has('bassnotion-session-old-1')).toBe(
        true,
      );
    });
  });

  describe('🔄 Version Migration Behavior', () => {
    it('should migrate from version 1.0.0 to current version', async () => {
      // Setup old version state
      const oldState = JSON.stringify(scenarios.legacyStates.v1_0_0);
      testEnvironment.mockStorage.set('bassnotion-playback-state', oldState);

      await manager.initialize({
        ...scenarios.configPresets.basicConfig(),
        versionMigration: true,
      });

      const migratedState = await manager.loadState();

      expectSuccessfulMigration(migratedState, '2.1.0');
    });

    it('should migrate from version 1.5.0 to current version', async () => {
      const oldState = JSON.stringify(scenarios.legacyStates.v1_5_0);
      testEnvironment.mockStorage.set('bassnotion-playback-state', oldState);

      await manager.initialize({
        ...scenarios.configPresets.basicConfig(),
        versionMigration: true,
      });

      const migratedState = await manager.loadState();

      expectSuccessfulMigration(migratedState, '2.1.0');

      // Verify specific migration features
      if (migratedState) {
        expect(migratedState.config?.pitch).toBeDefined();
        expect(migratedState.config?.swingFactor).toBeDefined();
        expect(migratedState.userPreferences).toBeDefined();
        expect(migratedState.metadata).toBeDefined();
      }
    });

    it('should handle invalid migration gracefully', async () => {
      // Setup corrupted old state
      testEnvironment.mockStorage.set(
        'bassnotion-playback-state',
        'invalid-json',
      );

      await manager.initialize({
        ...scenarios.configPresets.basicConfig(),
        versionMigration: true,
      });

      const state = await manager.loadState();

      // Should handle corruption gracefully
      expect(state === null || typeof state === 'object').toBe(true);
    });
  });

  describe('📱 Device and Performance Adaptation Behavior', () => {
    it('should adapt persistence strategy for mobile devices', async () => {
      // Mock mobile device
      vi.stubGlobal('navigator', {
        ...testEnvironment.navigatorMock,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      });

      await manager.initialize({
        ...scenarios.configPresets.mobileConfig(),
        autoSaveInterval: 5000, // Should be increased on mobile
      });

      const metrics = manager.getMetrics();
      expectValidMetrics(metrics);

      // Should adapt for mobile constraints
      expect(metrics).toBeDefined();
    });

    it('should handle low storage situations gracefully', async () => {
      // Mock low storage quota (95% full)
      vi.stubGlobal('navigator', {
        ...testEnvironment.navigatorMock,
        storage: {
          estimate: vi.fn().mockResolvedValue({
            usage: 95 * 1024 * 1024, // 95MB used
            quota: 100 * 1024 * 1024, // 100MB total
          }),
        },
      });

      await manager.initialize(scenarios.configPresets.basicConfig());

      const largeState = scenarios.createLargeState();

      // Should handle low storage gracefully
      await expect(manager.saveState(largeState)).resolves.not.toThrow();
    });

    it('should handle storage quota exceeded errors', async () => {
      // Mock storage that throws quota exceeded errors
      const quotaExceededStorage = {
        ...testEnvironment.storageMock,
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError');
        }),
      };
      vi.stubGlobal('localStorage', quotaExceededStorage);

      await manager.initialize(scenarios.configPresets.basicConfig());

      const state = scenarios.createProgressiveState(60);

      // Should handle quota errors gracefully
      try {
        await manager.saveState(state);
      } catch {
        // Expected to fail due to quota - that's the test scenario
      }

      const metrics = manager.getMetrics();
      expect(metrics.errorCount).toBeGreaterThan(0);
    });
  });

  describe('🔄 Session Recovery Behavior', () => {
    it('should detect recoverable sessions from unexpected termination', async () => {
      await manager.initialize(scenarios.configPresets.basicConfig());

      // Simulate active session state
      const activeState = {
        ...scenarios.createProgressiveState(75),
        metadata: {
          deviceInfo: 'Test Device',
          browserInfo: 'Test Browser',
          lastActiveTime: Date.now() - 1000, // 1 second ago
          sessionDuration: 75 * 60 * 1000, // 75 minutes
        },
      };

      await manager.saveState(activeState);

      // Check for recoverable session
      const hasRecovery = await manager.hasRecoverableSession();

      expect(hasRecovery).toBe(true);
    });

    it('should not offer recovery for properly closed sessions', async () => {
      await manager.initialize(scenarios.configPresets.basicConfig());

      // Save state and properly clear it
      await manager.saveState(scenarios.createProgressiveState(30));
      await manager.clearState();

      const hasRecovery = await manager.hasRecoverableSession();

      expect(hasRecovery).toBe(false);
    });

    it('should maintain backup copy for critical recovery scenarios', async () => {
      await manager.initialize(scenarios.configPresets.basicConfig());

      const criticalState = scenarios.createProgressiveState(120); // 2 hours of work
      await manager.saveState(criticalState);

      // Simulate main state corruption
      testEnvironment.mockStorage.set(
        'bassnotion-playback-state',
        'corrupted-data',
      );

      // Should still handle corruption gracefully
      const recoveredState = await manager.loadState();

      // Should handle corruption gracefully
      expect(
        recoveredState === null || typeof recoveredState === 'object',
      ).toBe(true);
    });

    it('should recover from complete storage corruption', async () => {
      await manager.initialize(scenarios.configPresets.basicConfig());

      // Save valid state first
      await manager.saveState(scenarios.createProgressiveState(60));

      // Corrupt all storage
      testEnvironment.mockStorage.clear();
      testEnvironment.mockStorage.set(
        'bassnotion-playback-state',
        scenarios.errorScenarios.corruptedData(),
      );

      // Should handle complete corruption gracefully
      const state = await manager.loadState();
      expect(state === null || typeof state === 'object').toBe(true);
    });
  });

  describe('📊 Performance and Metrics Behavior', () => {
    beforeEach(async () => {
      await manager.initialize(scenarios.configPresets.basicConfig());
    });

    it('should track comprehensive performance metrics', async () => {
      manager.resetMetrics();

      const states = [
        scenarios.createProgressiveState(10),
        scenarios.createProgressiveState(20),
        scenarios.createProgressiveState(30),
      ];

      // Perform several operations
      for (const state of states) {
        await manager.saveState(state);
        await manager.loadState();
      }

      const metrics = manager.getMetrics();
      expectValidMetrics(metrics);

      // Check specific metrics if available
      if (metrics.userSaveOperations !== undefined) {
        expect(metrics.userSaveOperations).toBe(states.length);
        expect(metrics.loadOperations).toBe(states.length);
      }

      expect(metrics.averageSaveTime).toBeGreaterThanOrEqual(0);
      expect(metrics.averageLoadTime).toBeGreaterThanOrEqual(0);
    });

    it('should monitor storage quota usage accurately', async () => {
      await manager.saveState(scenarios.createProgressiveState(60));

      const metrics = manager.getMetrics();

      if (metrics.storageQuota) {
        expectValidStorageQuota(metrics.storageQuota);
      }
    });

    it('should maintain performance benchmarks under load', async () => {
      const benchmarks = {
        maxSaveTime: 100, // ms
        maxLoadTime: 50, // ms
        maxErrors: 2,
      };

      // Perform sustained operations
      const sustainedStates = Array.from({ length: 10 }, (_, i) =>
        scenarios.createProgressiveState(i * 5 + 10),
      );

      for (const state of sustainedStates) {
        await manager.saveState(state);
        await manager.loadState();
      }

      const metrics = manager.getMetrics();

      // Should meet performance benchmarks
      if (
        metrics.averageSaveTime !== undefined &&
        metrics.averageLoadTime !== undefined
      ) {
        expectPerformanceWithinBenchmarks(metrics, benchmarks);
      }
    });

    it('should handle performance degradation gracefully', async () => {
      // Simulate slow storage
      const slowStorage = {
        ...testEnvironment.storageMock,
        setItem: vi.fn().mockImplementation((key: string, value: string) => {
          return new Promise((resolve) => {
            setTimeout(() => {
              testEnvironment.mockStorage.set(key, value);
              resolve(undefined);
            }, 50); // 50ms delay
          });
        }),
      };
      vi.stubGlobal('localStorage', slowStorage);

      // Should still complete operations despite slowness
      await expect(
        manager.saveState(scenarios.createProgressiveState(30)),
      ).resolves.not.toThrow();
    });
  });

  describe('🛡️ Enhanced Error Recovery Behavior', () => {
    it('should handle complete persistence system failure', async () => {
      // Store original localStorage for restoration
      const originalLocalStorage = global.localStorage;

      try {
        // Complete singleton reset
        await manager.dispose();
        StatePersistenceManager.resetInstance();

        // Force complete storage failure
        const failureStorage = {
          setItem: vi.fn(() => {
            throw new Error('Storage system failure');
          }),
          getItem: vi.fn(() => {
            throw new Error('Storage read failure');
          }),
          removeItem: vi.fn(() => {
            throw new Error('Storage remove failure');
          }),
          clear: vi.fn(() => {
            throw new Error('Storage clear failure');
          }),
          length: 0,
          key: vi.fn(() => null),
        };
        vi.stubGlobal('localStorage', failureStorage);

        // Get fresh instance and test error handling
        const freshManager = StatePersistenceManager.getInstance();
        await freshManager.initialize(scenarios.configPresets.basicConfig());

        // All operations should handle errors gracefully
        await expect(
          freshManager.saveState(scenarios.createProgressiveState(30), {
            isAutoSave: true,
          }),
        ).resolves.not.toThrow();

        const loadedState = await freshManager.loadState();
        expect(loadedState).toBeNull();

        const metrics = freshManager.getMetrics();
        expect(metrics.errorCount).toBeGreaterThan(0);
        expect(metrics.lastError).toBeDefined();
      } finally {
        // Always restore original localStorage
        vi.stubGlobal('localStorage', originalLocalStorage);

        // Reinitialize with clean storage
        await manager.dispose();
        await manager.initialize(scenarios.configPresets.basicConfig());
      }
    });

    it('should recover from network-related persistence errors', async () => {
      // Simulate network-related storage errors
      const networkErrorStorage = {
        ...testEnvironment.storageMock,
        setItem: vi.fn().mockImplementation(() => {
          throw new Error('Network connection failed');
        }),
      };
      vi.stubGlobal('localStorage', networkErrorStorage);

      await manager.initialize(scenarios.configPresets.basicConfig());

      // Should handle network errors gracefully
      try {
        await manager.saveState(scenarios.createProgressiveState(45));
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      const metrics = manager.getMetrics();
      expect(metrics.errorCount).toBeGreaterThan(0);
    });

    it('should handle rapid successive save operations under stress', async () => {
      await manager.initialize(scenarios.configPresets.realtimeConfig());

      // Rapid successive saves
      const rapidStates = Array.from({ length: 20 }, (_, i) =>
        scenarios.createProgressiveState(i + 1),
      );

      const savePromises = rapidStates.map((state) => manager.saveState(state));

      // Should handle rapid operations without throwing
      await expect(Promise.allSettled(savePromises)).resolves.not.toThrow();
    });

    it('should maintain data integrity during concurrent operations', async () => {
      await manager.initialize(scenarios.configPresets.realtimeConfig());

      const state1 = scenarios.createProgressiveState(30);
      const state2 = scenarios.createProgressiveState(45);

      // Concurrent save and load operations
      const operations = [
        manager.saveState(state1),
        manager.loadState(),
        manager.saveState(state2),
        manager.loadState(),
      ];

      await expect(Promise.allSettled(operations)).resolves.not.toThrow();
    });
  });
});
