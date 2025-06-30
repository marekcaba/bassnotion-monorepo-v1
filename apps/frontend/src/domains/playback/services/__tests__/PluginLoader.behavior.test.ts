/**
 * PluginLoader Behavior Tests
 *
 * Testing dynamic plugin loading, caching, security validation, hot reloading,
 * and dependency management for the 624-line PluginLoader service.
 *
 * Core Behaviors:
 * - Dynamic plugin loading from URLs
 * - Plugin caching and cache management
 * - Security validation and origin checking
 * - Hot reload functionality
 * - Dependency management and preloading
 * - Concurrent loading management
 * - Error handling and retries
 * - Performance optimization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginLoader } from '../PluginLoader.js';
import type {
  AudioPlugin,
  PluginMetadata,
  PluginCapabilities,
  PluginConfig,
} from '../../types/plugin.js';
import {
  PluginCategory,
  PluginPriority,
  PluginState,
} from '../../types/plugin.js';
import type { PluginLoaderConfig, PluginLoadResult } from '../PluginLoader.js';

// Safe browser environment setup for plugin loader
const createMockEnvironment = () => {
  const globalObj = global as any;

  // Performance API mock for timing
  if (!globalObj.performance) {
    globalObj.performance = {
      now: vi.fn(() => Date.now()),
    };
  }

  // Dynamic import mock for ES modules
  if (!globalObj.import) {
    globalObj.import = vi.fn();
  }

  // Environment variables
  if (!globalObj.process) {
    globalObj.process = {
      env: {
        NODE_ENV: 'test',
      },
    };
  }

  // Mock URL for validation
  if (!globalObj.URL) {
    globalObj.URL = class MockURL {
      constructor(
        public href: string,
        base?: string,
      ) {
        if (base && !href.startsWith('http')) {
          this.href = base + href;
        }
        this.origin = this.href.split('/').slice(0, 3).join('/');
        this.pathname = '/' + this.href.split('/').slice(3).join('/');
      }

      public origin: string;
      public pathname: string;
    };
  }

  return { globalObj };
};

// Mock plugin factory
const createMockPlugin = (id: string): AudioPlugin => {
  const capabilities: PluginCapabilities = {
    supportsRealtimeProcessing: true,
    supportsOfflineProcessing: true,
    supportsAudioWorklet: true,
    supportsMIDI: false,
    supportsAutomation: true,
    supportsPresets: true,
    supportsSidechain: false,
    supportsMultiChannel: true,
    maxLatency: 10,
    cpuUsage: 0.1,
    memoryUsage: 16,
    minSampleRate: 22050,
    maxSampleRate: 96000,
    supportedBufferSizes: [128, 256, 512, 1024],
    supportsN8nPayload: false,
    supportsAssetLoading: false,
    supportsMobileOptimization: true,
  };

  const config: PluginConfig = {
    id,
    name: `Mock Plugin ${id}`,
    version: '1.0.0',
    category: PluginCategory.EFFECT,
    enabled: true,
    priority: PluginPriority.NORMAL,
    autoStart: false,
    inputChannels: 2,
    outputChannels: 2,
    settings: {},
  };

  const metadata: PluginMetadata = {
    id,
    name: `Mock Plugin ${id}`,
    version: '1.0.0',
    description: `Mock audio plugin for testing ${id}`,
    author: 'Test Author',
    license: 'MIT',
    category: PluginCategory.EFFECT,
    tags: ['test', 'mock'],
    capabilities,
    dependencies: [],
  };

  const mockPlugin: AudioPlugin = {
    metadata,
    config,
    state: PluginState.LOADED,
    capabilities,
    parameters: new Map(),

    // Lifecycle methods
    load: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    activate: vi.fn().mockResolvedValue(undefined),
    deactivate: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),

    // Processing
    process: vi.fn().mockImplementation(async (input, _output, _context) => ({
      success: true,
      status: 'success' as const,
      processingTime: 1,
      bypassMode: false,
      processedSamples: input.length,
      cpuUsage: 0.1,
    })),

    // Parameter management
    setParameter: vi.fn().mockResolvedValue(undefined),
    getParameter: vi.fn().mockReturnValue(0),
    resetParameters: vi.fn().mockResolvedValue(undefined),

    // Preset management
    savePreset: vi.fn().mockResolvedValue({}),
    loadPreset: vi.fn().mockResolvedValue(undefined),

    // Event handling
    on: vi.fn().mockReturnValue(() => undefined),
    off: vi.fn().mockReturnValue(undefined),
  };

  return mockPlugin;
};

// Mock ES module factory
const createMockModule = (pluginId: string) => ({
  default: createMockPlugin(pluginId),
  PluginClass: class MockPluginClass {
    constructor() {
      return createMockPlugin(pluginId);
    }
  },
  createPlugin: () => createMockPlugin(pluginId),
  metadata: {
    id: pluginId,
    name: `Mock Plugin ${pluginId}`,
    version: '1.0.0',
  },
});

// Scenario builders for plugin loader testing
const createPluginScenarios = () => {
  const basicConfig: Partial<PluginLoaderConfig> = {
    timeout: 5000,
    retryAttempts: 2,
    enableValidation: true,
    enableSandbox: false,
    maxConcurrentLoads: 3,
    developmentMode: true,
  };

  const productionConfig: Partial<PluginLoaderConfig> = {
    timeout: 10000,
    retryAttempts: 3,
    enableValidation: true,
    enableSandbox: true,
    allowedOrigins: ['https://plugins.bassnotion.com'],
    trustedPlugins: ['trusted-plugin-1', 'trusted-plugin-2'],
    requireSignature: true,
    maxConcurrentLoads: 2,
    developmentMode: false,
  };

  const securityConfig: Partial<PluginLoaderConfig> = {
    enableValidation: true,
    enableSandbox: true,
    allowedOrigins: [
      'https://secure.plugins.com',
      'https://plugins.bassnotion.com',
    ],
    trustedPlugins: ['verified-plugin'],
    requireSignature: true,
  };

  const hotReloadConfig: Partial<PluginLoaderConfig> = {
    enableHotReload: true,
    developmentMode: true,
    enableValidation: false, // Faster reloads in dev
  };

  const pluginUrls = {
    valid: 'https://plugins.bassnotion.com/effects/reverb.js',
    trustedDomain: 'https://cdn.bassnotion.com/plugins/delay.js',
    untrustedDomain: 'https://malicious.example.com/plugin.js',
    local: '/plugins/local-plugin.js',
    malformed: 'not-a-valid-url',
  };

  const testPlugins = {
    reverb: 'reverb-plugin',
    delay: 'delay-plugin',
    compressor: 'compressor-plugin',
    distortion: 'distortion-plugin',
    analyzer: 'analyzer-plugin',
  };

  return {
    basicConfig,
    productionConfig,
    securityConfig,
    hotReloadConfig,
    pluginUrls,
    testPlugins,
  };
};

// Mock setup helpers
const setupMockImport = (
  mockEnv: any,
  _scenarios: ReturnType<typeof createPluginScenarios>,
) => {
  mockEnv.globalObj.import = vi.fn().mockImplementation((url: string) => {
    // Simulate network delay
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (url.includes('malicious')) {
          reject(new Error('Network error: Untrusted domain'));
        } else if (url.includes('timeout')) {
          // Never resolve to simulate timeout
          return;
        } else if (url.includes('error')) {
          reject(new Error('Module loading error'));
        } else {
          // Extract plugin ID from URL
          const pluginId =
            url.split('/').pop()?.replace('.js', '') || 'default';
          resolve(createMockModule(pluginId));
        }
      }, 10);
    });
  });
};

// Expectation helpers
const expectPluginLoadResult = (
  result: PluginLoadResult,
  shouldSucceed = true,
) => {
  expect(result).toBeDefined();
  expect(typeof result.success).toBe('boolean');
  expect(typeof result.loadTime).toBe('number');
  expect(typeof result.fromCache).toBe('boolean');

  if (shouldSucceed) {
    expect(result.success).toBe(true);
    expect(result.plugin).toBeDefined();
    expect(result.error).toBeUndefined();
  } else {
    expect(result.success).toBe(false);
    expect(result.plugin).toBeUndefined();
    expect(result.error).toBeDefined();
  }
};

const expectValidPlugin = (plugin: AudioPlugin) => {
  expect(plugin).toBeDefined();
  expect(typeof plugin.metadata.id).toBe('string');
  expect(typeof plugin.metadata.name).toBe('string');
  expect(typeof plugin.metadata.version).toBe('string');
  expect(typeof plugin.initialize).toBe('function');
  expect(typeof plugin.dispose).toBe('function');
  expect(typeof plugin.process).toBe('function');
};

const expectLoadingStats = (stats: any) => {
  expect(stats).toBeDefined();
  expect(typeof stats.cacheSize).toBe('number');
  expect(typeof stats.dependencyCacheSize).toBe('number');
  expect(typeof stats.currentLoads).toBe('number');
  expect(typeof stats.watchedPlugins).toBe('number');
  expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
  expect(stats.dependencyCacheSize).toBeGreaterThanOrEqual(0);
  expect(stats.currentLoads).toBeGreaterThanOrEqual(0);
  expect(stats.watchedPlugins).toBeGreaterThanOrEqual(0);
};

describe('PluginLoader Behavior', () => {
  let pluginLoader: PluginLoader;
  let mockEnv: any;
  let scenarios: ReturnType<typeof createPluginScenarios>;

  beforeEach(async () => {
    const { globalObj } = createMockEnvironment();
    mockEnv = { globalObj };
    scenarios = createPluginScenarios();

    setupMockImport(mockEnv, scenarios);

    // Reset singleton - access private static field
    (PluginLoader as any).instance = undefined;

    pluginLoader = PluginLoader.getInstance(scenarios.basicConfig);

    vi.clearAllMocks();
  });

  describe('Plugin Loading Basics', () => {
    it('should load a plugin successfully from valid URL', async () => {
      const result = await pluginLoader.loadPlugin(
        scenarios.pluginUrls.valid,
        scenarios.testPlugins.reverb,
      );

      expectPluginLoadResult(result, true);
      expectValidPlugin(result.plugin!);
      expect(result.fromCache).toBe(false);
      expect(result.loadTime).toBeGreaterThan(0);
    });

    it('should load plugin from trusted domain', async () => {
      const result = await pluginLoader.loadPlugin(
        scenarios.pluginUrls.trustedDomain,
        scenarios.testPlugins.delay,
      );

      expectPluginLoadResult(result, true);
      expectValidPlugin(result.plugin!);
    });

    it('should handle plugin loading with auto-generated ID', async () => {
      const result = await pluginLoader.loadPlugin(scenarios.pluginUrls.valid);

      expectPluginLoadResult(result, true);
      expectValidPlugin(result.plugin!);
    });

    it('should load multiple plugins concurrently', async () => {
      const urls = [
        scenarios.pluginUrls.valid,
        scenarios.pluginUrls.trustedDomain,
        scenarios.pluginUrls.local,
      ];

      const results = await pluginLoader.loadPlugins(urls);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expectPluginLoadResult(result, true);
        expectValidPlugin(result.plugin!);
      });
    });

    it('should return consistent results for same URL', async () => {
      const url = scenarios.pluginUrls.valid;
      const pluginId = scenarios.testPlugins.reverb;

      const result1 = await pluginLoader.loadPlugin(url, pluginId);
      const result2 = await pluginLoader.loadPlugin(url, pluginId);

      expectPluginLoadResult(result1, true);
      expectPluginLoadResult(result2, true);
      expect(result1.plugin!.metadata.id).toBe(result2.plugin!.metadata.id);
    });

    it('should handle concurrent requests for same plugin', async () => {
      const url = scenarios.pluginUrls.valid;
      const pluginId = scenarios.testPlugins.reverb;

      const promises = Array(5)
        .fill(0)
        .map(() => pluginLoader.loadPlugin(url, pluginId));

      const results = await Promise.all(promises);

      results.forEach((result) => expectPluginLoadResult(result, true));

      // Should all reference the same plugin
      const firstPlugin = results[0]?.plugin;
      results.forEach((result) => {
        expect(result.plugin!.metadata.id).toBe(firstPlugin!.metadata.id);
      });
    });
  });

  describe('Plugin Caching', () => {
    it('should cache loaded plugins', async () => {
      const pluginId = scenarios.testPlugins.reverb;
      const url = scenarios.pluginUrls.valid;

      // First load
      const result1 = await pluginLoader.loadPlugin(url, pluginId);
      expectPluginLoadResult(result1, true);
      expect(result1.fromCache).toBe(false);

      // Check cache
      expect(pluginLoader.isPluginCached(pluginId)).toBe(true);
      const cachedPlugin = pluginLoader.getCachedPlugin(pluginId);
      expect(cachedPlugin).toBeDefined();
      expectValidPlugin(cachedPlugin!);

      // Second load should come from cache
      const result2 = await pluginLoader.loadPlugin(url, pluginId);
      expectPluginLoadResult(result2, true);
      expect(result2.fromCache).toBe(true);
    });

    it('should clear specific plugin from cache', async () => {
      const pluginId = scenarios.testPlugins.reverb;
      await pluginLoader.loadPlugin(scenarios.pluginUrls.valid, pluginId);

      expect(pluginLoader.isPluginCached(pluginId)).toBe(true);

      pluginLoader.clearCache(pluginId);

      expect(pluginLoader.isPluginCached(pluginId)).toBe(false);
      expect(pluginLoader.getCachedPlugin(pluginId)).toBe(null);
    });

    it('should clear entire cache', async () => {
      // Load multiple plugins
      await pluginLoader.loadPlugin(
        scenarios.pluginUrls.valid,
        scenarios.testPlugins.reverb,
      );
      await pluginLoader.loadPlugin(
        scenarios.pluginUrls.trustedDomain,
        scenarios.testPlugins.delay,
      );

      expect(pluginLoader.isPluginCached(scenarios.testPlugins.reverb)).toBe(
        true,
      );
      expect(pluginLoader.isPluginCached(scenarios.testPlugins.delay)).toBe(
        true,
      );

      pluginLoader.clearCache();

      expect(pluginLoader.isPluginCached(scenarios.testPlugins.reverb)).toBe(
        false,
      );
      expect(pluginLoader.isPluginCached(scenarios.testPlugins.delay)).toBe(
        false,
      );
    });

    it('should provide accurate loading statistics', async () => {
      const initialStats = pluginLoader.getLoadingStats();
      expectLoadingStats(initialStats);
      expect(initialStats.cacheSize).toBe(0);

      // Load some plugins
      await pluginLoader.loadPlugin(
        scenarios.pluginUrls.valid,
        scenarios.testPlugins.reverb,
      );
      await pluginLoader.loadPlugin(
        scenarios.pluginUrls.trustedDomain,
        scenarios.testPlugins.delay,
      );

      const afterLoadStats = pluginLoader.getLoadingStats();
      expectLoadingStats(afterLoadStats);
      expect(afterLoadStats.cacheSize).toBeGreaterThan(initialStats.cacheSize);
    });

    it('should handle cache access patterns', async () => {
      const pluginId = scenarios.testPlugins.reverb;
      await pluginLoader.loadPlugin(scenarios.pluginUrls.valid, pluginId);

      // Multiple cache accesses
      for (let i = 0; i < 5; i++) {
        const cachedPlugin = pluginLoader.getCachedPlugin(pluginId);
        expectValidPlugin(cachedPlugin!);
      }

      expect(pluginLoader.isPluginCached(pluginId)).toBe(true);
    });
  });

  describe('Security and Validation', () => {
    beforeEach(() => {
      (PluginLoader as any).instance = undefined;
      pluginLoader = PluginLoader.getInstance(scenarios.securityConfig);
    });

    it('should reject plugins from untrusted domains', async () => {
      await expect(
        pluginLoader.loadPlugin(scenarios.pluginUrls.untrustedDomain),
      ).rejects.toThrow();
    });

    it('should validate plugin URLs', async () => {
      await expect(
        pluginLoader.loadPlugin(scenarios.pluginUrls.malformed),
      ).rejects.toThrow();
    });

    it('should handle trusted plugins specially', async () => {
      const trustedPlugin = scenarios.securityConfig.trustedPlugins![0];

      const result = await pluginLoader.loadPlugin(
        scenarios.pluginUrls.valid,
        trustedPlugin,
      );

      expectPluginLoadResult(result, true);
    });

    it('should enforce origin restrictions', async () => {
      // Mock with restricted origins
      const restrictedUrl = 'https://unknown.domain.com/plugin.js';

      await expect(pluginLoader.loadPlugin(restrictedUrl)).rejects.toThrow();
    });

    it('should validate plugin structure after loading', async () => {
      // Mock a malformed plugin
      mockEnv.globalObj.import = vi.fn().mockImplementation(() =>
        Promise.resolve({
          // Missing required methods
          default: { id: 'malformed', name: 'Malformed Plugin' },
        }),
      );

      await expect(
        pluginLoader.loadPlugin(scenarios.pluginUrls.valid),
      ).rejects.toThrow();
    });

    it('should handle plugin validation errors gracefully', async () => {
      // Mock validation that throws
      mockEnv.globalObj.import = vi.fn().mockImplementation(() =>
        Promise.resolve({
          default: {
            ...createMockPlugin('invalid'),
            initialize: () => {
              throw new Error('Validation failed');
            },
          },
        }),
      );

      const result = await pluginLoader.loadPlugin(scenarios.pluginUrls.valid);
      expectPluginLoadResult(result, false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Hot Reload Functionality', () => {
    beforeEach(() => {
      (PluginLoader as any).instance = undefined;
      pluginLoader = PluginLoader.getInstance(scenarios.hotReloadConfig);
    });

    it('should enable hot reload for plugins', async () => {
      const pluginId = scenarios.testPlugins.reverb;
      const url = scenarios.pluginUrls.valid;

      // Load plugin first
      await pluginLoader.loadPlugin(url, pluginId);

      // Enable hot reload
      pluginLoader.enableHotReload(pluginId, url);

      const stats = pluginLoader.getLoadingStats();
      expect(stats.watchedPlugins).toBeGreaterThan(0);
    });

    it('should reload plugins on demand', async () => {
      const pluginId = scenarios.testPlugins.reverb;
      const url = scenarios.pluginUrls.valid;

      // Load and enable hot reload
      await pluginLoader.loadPlugin(url, pluginId);
      pluginLoader.enableHotReload(pluginId, url);

      // Reload plugin
      const reloadResult = await pluginLoader.reloadPlugin(pluginId);
      expectPluginLoadResult(reloadResult, true);
      expect(reloadResult.fromCache).toBe(false); // Should be fresh load
    });

    it('should disable hot reload for plugins', async () => {
      const pluginId = scenarios.testPlugins.reverb;
      const url = scenarios.pluginUrls.valid;

      await pluginLoader.loadPlugin(url, pluginId);
      pluginLoader.enableHotReload(pluginId, url);

      let stats = pluginLoader.getLoadingStats();
      const watchedBefore = stats.watchedPlugins;

      pluginLoader.disableHotReload(pluginId);

      stats = pluginLoader.getLoadingStats();
      expect(stats.watchedPlugins).toBeLessThan(watchedBefore);
    });

    it('should reject reload of non-watched plugins', async () => {
      const pluginId = 'non-watched-plugin';

      await expect(pluginLoader.reloadPlugin(pluginId)).rejects.toThrow();
    });

    it('should handle hot reload errors gracefully', async () => {
      const pluginId = scenarios.testPlugins.reverb;
      const url = scenarios.pluginUrls.valid;

      await pluginLoader.loadPlugin(url, pluginId);
      pluginLoader.enableHotReload(pluginId, url);

      // Mock reload failure
      mockEnv.globalObj.import = vi
        .fn()
        .mockRejectedValue(new Error('Hot reload failed'));

      const reloadResult = await pluginLoader.reloadPlugin(pluginId);
      expectPluginLoadResult(reloadResult, false);
      expect(reloadResult.error).toBeDefined();
    });
  });

  describe('Dependency Management', () => {
    it('should preload dependencies', async () => {
      const dependencies = [
        'https://cdn.example.com/lib1.js',
        'https://cdn.example.com/lib2.js',
      ];

      await pluginLoader.preloadDependencies(dependencies);

      const stats = pluginLoader.getLoadingStats();
      expect(stats.dependencyCacheSize).toBeGreaterThan(0);
    });

    it('should handle dependency loading errors', async () => {
      const dependencies = ['https://invalid.domain.com/missing.js'];

      // Mock dependency loading failure
      mockEnv.globalObj.import = vi
        .fn()
        .mockRejectedValue(new Error('Dependency not found'));

      await expect(
        pluginLoader.preloadDependencies(dependencies),
      ).rejects.toThrow();
    });

    it('should validate dependency URLs', async () => {
      const invalidDependencies = ['not-a-url', 'javascript:alert("xss")'];

      await expect(
        pluginLoader.preloadDependencies(invalidDependencies),
      ).rejects.toThrow();
    });

    it('should handle circular dependencies', async () => {
      const dependencies = [
        'https://cdn.example.com/dep1.js',
        'https://cdn.example.com/dep2.js',
      ];

      // Mock dependencies that reference each other
      mockEnv.globalObj.import = vi.fn().mockImplementation((url: string) => {
        if (url.includes('dep1')) {
          return Promise.resolve({
            dependencies: ['https://cdn.example.com/dep2.js'],
          });
        } else {
          return Promise.resolve({
            dependencies: ['https://cdn.example.com/dep1.js'],
          });
        }
      });

      // Should handle gracefully without infinite loop
      await expect(
        pluginLoader.preloadDependencies(dependencies),
      ).resolves.not.toThrow();
    });
  });

  describe('Concurrent Loading Management', () => {
    it('should respect maximum concurrent loads limit', async () => {
      const urls = Array(10)
        .fill(0)
        .map((_, i) => `https://plugins.bassnotion.com/plugin-${i}.js`);

      const loadPromises = urls.map((url) => pluginLoader.loadPlugin(url));

      // Should not reject due to concurrency limits
      const results = await Promise.allSettled(loadPromises);

      const successful = results.filter((r) => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle concurrent loading limitations', async () => {
      // Mock slow loading plugins with actual delays
      mockEnv.globalObj.import = vi.fn().mockImplementation(
        (_url) =>
          new Promise((resolve) =>
            // Make each plugin load take at least 100ms to properly test concurrent limiting
            setTimeout(() => resolve(createMockModule('slow')), 100),
          ),
      );

      const urls = Array(5)
        .fill(0)
        .map((_, i) => `https://plugins.bassnotion.com/slow-plugin-${i}.js`);

      const startTime = Date.now();
      const results = await Promise.all(
        urls.map((url) => pluginLoader.loadPlugin(url)),
      );
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      results.forEach((result) => expectPluginLoadResult(result, true));

      // Should take some time due to queuing
      // With maxConcurrentLoads = 3, and 5 plugins taking 100ms each:
      // First 3 load concurrently (100ms), then 2 more load (another 100ms)
      // Total should be at least 150ms (accounting for some overhead)
      expect(totalTime).toBeGreaterThan(150);
    });

    it('should handle concurrent loading of same plugin', async () => {
      const url = scenarios.pluginUrls.valid;

      // Start multiple loads of same plugin simultaneously
      const promises = Array(5)
        .fill(0)
        .map(() => pluginLoader.loadPlugin(url));
      const results = await Promise.all(promises);

      results.forEach((result) => expectPluginLoadResult(result, true));

      // All should reference the same plugin instance
      const pluginId = results[0]?.plugin?.metadata.id;
      results.forEach((result) => {
        expect(result.plugin?.metadata.id).toBe(pluginId);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors during loading', async () => {
      mockEnv.globalObj.import = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));

      const result = await pluginLoader.loadPlugin(scenarios.pluginUrls.valid);
      expectPluginLoadResult(result, false);
      expect(result.error?.message).toContain('Network error');
    });

    it('should retry failed plugin loads', async () => {
      let attempts = 0;
      mockEnv.globalObj.import = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve(createMockModule('retry-success'));
      });

      const result = await pluginLoader.loadPlugin(
        scenarios.pluginUrls.valid,
        'retry-success',
      );
      expectPluginLoadResult(result, true);
      expect(attempts).toBeGreaterThan(1);
    });

    it('should timeout on slow plugin loads', async () => {
      // Mock plugin that never loads
      mockEnv.globalObj.import = vi.fn().mockImplementation(
        () => new Promise(() => undefined), // Never resolves
      );

      // Configure short timeout
      (PluginLoader as any).instance = undefined;
      pluginLoader = PluginLoader.getInstance({ timeout: 100 });

      const result = await pluginLoader.loadPlugin(scenarios.pluginUrls.valid);
      expectPluginLoadResult(result, false);
      expect(result.error?.message).toMatch(/timeout/i);
    });

    it('should handle malformed plugin modules', async () => {
      mockEnv.globalObj.import = vi.fn().mockResolvedValue({
        // Missing default export and other required fields
        someOtherExport: 'not a plugin',
      });

      const result = await pluginLoader.loadPlugin(scenarios.pluginUrls.valid);
      expectPluginLoadResult(result, false);
    });

    it('should handle plugin initialization failures', async () => {
      mockEnv.globalObj.import = vi.fn().mockResolvedValue({
        default: {
          ...createMockPlugin('failing'),
          initialize: vi.fn().mockRejectedValue(new Error('Init failed')),
        },
      });

      const result = await pluginLoader.loadPlugin(
        scenarios.pluginUrls.valid,
        'failing',
      );
      expectPluginLoadResult(result, false);
      expect(result.error?.message).toContain('Init failed');
    });

    it('should clean up after failed loads', async () => {
      mockEnv.globalObj.import = vi
        .fn()
        .mockRejectedValue(new Error('Load failed'));

      const initialStats = pluginLoader.getLoadingStats();

      await pluginLoader.loadPlugin(scenarios.pluginUrls.valid);

      const afterStats = pluginLoader.getLoadingStats();
      expect(afterStats.currentLoads).toBe(initialStats.currentLoads);
    });
  });

  describe('Configuration and Environment', () => {
    it('should use production configuration in production mode', () => {
      (PluginLoader as any).instance = undefined;
      const prodLoader = PluginLoader.getInstance(scenarios.productionConfig);

      const stats = prodLoader.getLoadingStats();
      expectLoadingStats(stats);
    });

    it('should handle development mode features', () => {
      (PluginLoader as any).instance = undefined;
      const devLoader = PluginLoader.getInstance(scenarios.hotReloadConfig);

      const stats = devLoader.getLoadingStats();
      expectLoadingStats(stats);
    });

    it('should provide singleton behavior', () => {
      const loader1 = PluginLoader.getInstance();
      const loader2 = PluginLoader.getInstance();

      expect(loader1).toBe(loader2);
    });

    it('should handle configuration merging', () => {
      (PluginLoader as any).instance = undefined;
      const customLoader = PluginLoader.getInstance({
        timeout: 15000,
        retryAttempts: 5,
      });

      // Should create without throwing
      expect(customLoader).toBeDefined();
    });

    it('should adapt to different environments', async () => {
      // Test in different NODE_ENV
      const originalEnv = mockEnv.globalObj.process.env.NODE_ENV;

      mockEnv.globalObj.process.env.NODE_ENV = 'production';
      (PluginLoader as any).instance = undefined;
      const prodLoader = PluginLoader.getInstance();

      mockEnv.globalObj.process.env.NODE_ENV = 'development';
      (PluginLoader as any).instance = undefined;
      const devLoader = PluginLoader.getInstance();

      expect(prodLoader).toBeDefined();
      expect(devLoader).toBeDefined();

      // Restore original
      mockEnv.globalObj.process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Performance and Optimization', () => {
    it('should track loading performance metrics', async () => {
      const result = await pluginLoader.loadPlugin(
        scenarios.pluginUrls.valid,
        scenarios.testPlugins.reverb!,
      );

      expectPluginLoadResult(result, true);
      expect(result.loadTime).toBeGreaterThan(0);
      expect(typeof result.loadTime).toBe('number');
    });

    it('should optimize cache performance', async () => {
      // Load multiple plugins from safe URLs only
      const pluginIds = Object.values(scenarios.testPlugins);
      const safeUrls = [
        scenarios.pluginUrls.valid,
        scenarios.pluginUrls.trustedDomain,
        scenarios.pluginUrls.local,
      ];

      for (let i = 0; i < Math.min(pluginIds.length, safeUrls.length); i++) {
        const pluginId = pluginIds[i];
        const url = safeUrls[i];
        if (pluginId && url) {
          await pluginLoader.loadPlugin(url, pluginId);
        }
      }

      // Access from cache multiple times
      const cacheStartTime = performance.now();
      for (const pluginId of pluginIds) {
        if (pluginId) {
          pluginLoader.getCachedPlugin(pluginId);
        }
      }
      const cacheEndTime = performance.now();

      // Cache access should be fast
      expect(cacheEndTime - cacheStartTime).toBeLessThan(100);
    });

    it('should handle cache cleanup efficiently', async () => {
      // Load several plugins
      for (let i = 0; i < 5; i++) {
        await pluginLoader.loadPlugin(
          `https://plugins.bassnotion.com/plugin-${i}.js`,
          `plugin-${i}`,
        );
      }

      const beforeClear = pluginLoader.getLoadingStats();
      expect(beforeClear.cacheSize).toBeGreaterThan(0);

      pluginLoader.clearCache();

      const afterClear = pluginLoader.getLoadingStats();
      expect(afterClear.cacheSize).toBe(0);
    });

    it('should minimize redundant loading operations', async () => {
      const url = scenarios.pluginUrls.valid;
      const pluginId = scenarios.testPlugins.reverb;

      // Load same plugin multiple times in sequence
      const results = [];
      if (pluginId) {
        for (let i = 0; i < 3; i++) {
          results.push(await pluginLoader.loadPlugin(url, pluginId));
        }
      }

      // First should be fresh, others from cache
      if (results.length >= 3) {
        expect(results[0]?.fromCache).toBe(false);
        expect(results[1]?.fromCache).toBe(true);
        expect(results[2]?.fromCache).toBe(true);
      }
    });
  });
});
