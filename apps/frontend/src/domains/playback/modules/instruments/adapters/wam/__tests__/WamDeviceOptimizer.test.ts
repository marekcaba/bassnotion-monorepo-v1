/**
 * WAM Device Optimizer Tests
 *
 * Test suite for device-specific WAM plugin optimization,
 * ensuring optimal performance across different hardware.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WamDeviceOptimizer } from '../WamDeviceOptimizer.js';
import { WamHostManager } from '../WamHostManager.js';
import { DeviceCapabilityDetector } from '../../../../optimization/DeviceCapabilityDetector.js';
import { PerformanceOptimizer } from '../../../../optimization/PerformanceOptimizer.js';
import { EventBus } from '../../../../../services/core/EventBus.js';
import { serviceRegistry } from '../../../../../services/core/ServiceRegistry.js';
import type { AudioPlugin, PluginConfig } from '../../../../../types/plugin.js';
import type { WamPluginRegistration } from '../../../../../types/wam.js';
import { PluginCategory } from '../../../../../types/plugin.js';

// Mock dependencies
vi.mock('../WamHostManager.js');
vi.mock('../../../../optimization/DeviceCapabilityDetector.js');
vi.mock('../../../../optimization/PerformanceOptimizer.js');
vi.mock('../../../../../services/core/EventBus.js');
vi.mock('../../../../../services/core/ServiceRegistry.js');

describe('WamDeviceOptimizer', () => {
  let optimizer: WamDeviceOptimizer;
  let mockHostManager: any;
  let mockDeviceCapabilityDetector: any;
  let mockPerformanceOptimizer: any;
  let mockEventBus: any;

  const createMockPlugin = (id: string): AudioPlugin => ({
    metadata: {
      id,
      name: `Plugin ${id}`,
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test',
      license: 'MIT',
      category: PluginCategory.EFFECT,
      tags: [],
      capabilities: {
        supportsRealtimeProcessing: true,
        supportsOfflineProcessing: false,
        supportsAudioWorklet: true,
        supportsMIDI: false,
        supportsAutomation: true,
        supportsPresets: true,
        supportsSidechain: false,
        supportsMultiChannel: false,
        maxLatency: 0,
        cpuUsage: 0.5,
        memoryUsage: 10,
        minSampleRate: 44100,
        maxSampleRate: 96000,
        supportedBufferSizes: [128, 256, 512, 1024],
      },
      dependencies: [],
    },
    config: {
      id,
      name: `Plugin ${id}`,
      version: '1.0.0',
      category: PluginCategory.EFFECT,
      enabled: true,
      priority: 500,
      autoStart: true,
      inputChannels: 2,
      outputChannels: 2,
      settings: {},
    },
    state: 'active' as any,
    capabilities: {} as any,
    parameters: new Map(),
    load: vi.fn(),
    initialize: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    dispose: vi.fn(),
    process: vi.fn(),
    setParameter: vi.fn(),
    getParameter: vi.fn(),
    resetParameters: vi.fn(),
    savePreset: vi.fn(),
    loadPreset: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  });

  const createMockRegistration = (
    moduleId: string,
    isInstrument = false,
  ): WamPluginRegistration => ({
    moduleId,
    url: `/plugins/${moduleId}`,
    descriptor: {
      name: `Plugin ${moduleId}`,
      vendor: 'Test',
      version: '1.0.0',
      sdkVersion: '2.0.0',
      thumbnail: '',
      keywords: isInstrument ? ['synth', 'essential'] : ['effect'],
      isInstrument,
      website: 'https://test.com',
      hasAudioInput: true,
      hasAudioOutput: true,
      hasMidiInput: isInstrument,
      hasMidiOutput: false,
      supportsMpe: false,
    },
    loadedAt: Date.now(),
    instanceCount: 0,
  });

  beforeEach(() => {
    // Reset singleton
    (WamDeviceOptimizer as any).instance = null;

    // Setup mocks
    mockHostManager = {
      getInstance: vi.fn().mockReturnThis(),
      getPerformanceReport: vi.fn().mockReturnValue({
        totalPlugins: 0,
        totalCpuUsage: 0,
        averageLatency: 0,
        pluginMetrics: [],
      }),
      getRegisteredPlugins: vi.fn().mockReturnValue([]),
      getHostCapabilities: vi.fn().mockReturnValue({
        maxPluginsPerTrack: 16,
        maxPlugins: 64,
        supportedFormats: ['WAM2'],
      }),
    };

    mockDeviceCapabilityDetector = {
      getCapabilities: vi.fn().mockReturnValue({
        device: {
          isMobile: false,
          isTablet: false,
          hasTouch: false,
        },
        performance: {
          tier: 'high',
          score: 0.9,
          recommendedMaxTracks: 16,
        },
        audio: {
          maxChannelCount: 32,
        },
      }),
    };

    mockPerformanceOptimizer = {};

    mockEventBus = {
      emit: vi.fn(),
    };

    // Setup service registry
    vi.mocked(serviceRegistry.get).mockImplementation((name) => {
      if (name === 'deviceCapabilityDetector')
        return mockDeviceCapabilityDetector;
      if (name === 'performanceOptimizer') return mockPerformanceOptimizer;
      if (name === 'eventBus') return mockEventBus;
      throw new Error(`Service not found: ${name}`);
    });

    vi.mocked(WamHostManager.getInstance).mockReturnValue(mockHostManager);

    // Create instance
    optimizer = WamDeviceOptimizer.getInstance();
  });

  afterEach(() => {
    optimizer.stopMonitoring();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('device profile selection', () => {
    it('should select high-end profile for powerful devices', () => {
      // Reset singleton before setting up new mocks
      (WamDeviceOptimizer as any).instance = null;

      mockDeviceCapabilityDetector.getCapabilities.mockReturnValue({
        device: { isMobile: false },
        performance: { tier: 'high', score: 0.9, recommendedMaxTracks: 16 },
        audio: { maxChannelCount: 32 },
      });

      const newOptimizer = WamDeviceOptimizer.getInstance();
      const state = newOptimizer.getState();

      expect(state.currentProfile.name).toBe('high-end');
      expect(state.currentQuality.name).toBe('high');
    });

    it('should select mobile profile for mobile devices', () => {
      // Reset singleton before setting up new mocks
      (WamDeviceOptimizer as any).instance = null;

      mockDeviceCapabilityDetector.getCapabilities.mockReturnValue({
        device: { isMobile: true },
        performance: { tier: 'low', score: 0.3 },
        audio: { maxChannelCount: 2 },
      });

      const newOptimizer = WamDeviceOptimizer.getInstance();
      const state = newOptimizer.getState();

      expect(state.currentProfile.name).toBe('mobile');
      expect(state.currentQuality.name).toBe('low');
    });

    it('should select mid-range profile for average devices', () => {
      // Reset singleton before setting up new mocks
      (WamDeviceOptimizer as any).instance = null;

      mockDeviceCapabilityDetector.getCapabilities.mockReturnValue({
        device: { isMobile: false },
        performance: { tier: 'medium', score: 0.6 },
        audio: { maxChannelCount: 8 },
      });

      const newOptimizer = WamDeviceOptimizer.getInstance();
      const state = newOptimizer.getState();

      expect(state.currentProfile.name).toBe('mid-range');
      expect(state.currentQuality.name).toBe('medium');
    });

    it('should allow manual profile setting', () => {
      optimizer.setProfile('low-end');

      const state = optimizer.getState();
      expect(state.currentProfile.name).toBe('low-end');
    });
  });

  describe('plugin configuration optimization', () => {
    it('should optimize plugin config for current device', () => {
      optimizer.setProfile('mobile');
      // Mobile profile defaults to low quality
      (optimizer as any).state.currentQuality = (
        optimizer as any
      ).qualityPresets.get('low');

      const baseConfig: Partial<PluginConfig> = {
        name: 'Test Plugin',
        settings: {
          customSetting: 'value',
        },
      };

      const optimizedConfig = optimizer.getOptimalPluginConfig(baseConfig);

      expect(optimizedConfig.settings?.bufferSize).toBe(1024 * 8); // mobile = 8x multiplier
      expect(optimizedConfig.settings?.oversampling).toBe(1);
      expect(optimizedConfig.settings?.quality).toBe('low');
      expect(optimizedConfig.settings?.useSimplifiedGUI).toBe(true);
      expect(optimizedConfig.settings?.disableVisualization).toBe(true);
      expect(optimizedConfig.settings?.customSetting).toBe('value'); // Preserve custom
    });

    it('should apply quality presets correctly', () => {
      // Set internal quality directly to ultra preset
      (optimizer as any).state.currentQuality = {
        name: 'ultra',
        oversampling: 4,
        bufferSize: 128,
        processingQuality: 'ultra',
        disabledFeatures: [],
      };

      const config = optimizer.getOptimalPluginConfig({});

      expect(config.settings?.oversampling).toBe(4);
      expect(config.settings?.quality).toBe('ultra');
      expect(config.settings?.disabledFeatures).toEqual([]);
    });
  });

  describe('plugin loading decisions', () => {
    it('should allow loading when under limits', () => {
      const registration = createMockRegistration('test-plugin');

      const shouldLoad = optimizer.shouldLoadPlugin(registration, 0);
      expect(shouldLoad).toBe(true);
    });

    it('should prevent loading when track limit exceeded', () => {
      optimizer.setProfile('mobile'); // Max 2 plugins per track

      const registration = createMockRegistration('test-plugin');

      const shouldLoad = optimizer.shouldLoadPlugin(registration, 2);
      expect(shouldLoad).toBe(false);
    });

    it('should prevent loading when total limit exceeded', () => {
      optimizer.setProfile('mobile'); // Max 8 total plugins

      mockHostManager.getPerformanceReport.mockReturnValue({
        totalPlugins: 8,
        totalCpuUsage: 0.5,
        averageLatency: 0,
        pluginMetrics: [],
      });

      const registration = createMockRegistration('test-plugin');

      const shouldLoad = optimizer.shouldLoadPlugin(registration, 1);
      expect(shouldLoad).toBe(false);
    });

    it('should block non-essential plugins when near CPU limit', () => {
      // Set internal state for CPU usage
      (optimizer as any).state.cpuUsage = 0.75; // 75% CPU usage
      (optimizer as any).state.currentProfile.maxCpuUsage = 0.8; // 80% limit

      const nonEssential = createMockRegistration('effect', false);
      const essential = createMockRegistration('synth', true);
      essential.descriptor.keywords = ['synth', 'essential'];

      expect(optimizer.shouldLoadPlugin(nonEssential, 0)).toBe(false);
      expect(optimizer.shouldLoadPlugin(essential, 0)).toBe(true);
    });

    it('should check disabled plugins list', () => {
      const state = optimizer.getState();
      state.disabledPlugins.add('blocked-plugin');

      const registration = createMockRegistration('blocked-plugin');

      expect(optimizer.shouldLoadPlugin(registration, 0)).toBe(false);
    });
  });

  describe('plugin optimization', () => {
    it('should apply quality settings to plugin', () => {
      const plugin = createMockPlugin('test-plugin');

      optimizer.optimizePlugin(plugin);

      expect(plugin.setParameter).toHaveBeenCalledWith(
        'oversampling',
        expect.any(Number),
      );
      expect(plugin.setParameter).toHaveBeenCalledWith(
        'bufferSize',
        expect.any(Number),
      );
      expect(plugin.setParameter).toHaveBeenCalledWith(
        'quality',
        expect.any(String),
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'wam:optimizer:plugin-optimized',
        {
          instanceId: 'test-plugin',
          profile: 'high-end',
          quality: 'high',
        },
      );
    });

    it('should disable features based on quality preset', () => {
      // Set the optimizer to use low quality profile
      optimizer.setProfile('low-end');

      // Now get state directly from the optimizer internal state
      (optimizer as any).state.currentQuality = {
        name: 'low',
        oversampling: 1,
        bufferSize: 1024,
        processingQuality: 'low',
        disabledFeatures: ['convolution', 'reverb-tails'],
      };

      const plugin = createMockPlugin('test-plugin');

      optimizer.optimizePlugin(plugin);

      expect(plugin.setParameter).toHaveBeenCalledWith(
        'disable_convolution',
        true,
      );
      expect(plugin.setParameter).toHaveBeenCalledWith(
        'disable_reverb-tails',
        true,
      );
    });
  });

  describe('performance monitoring', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start monitoring at intervals', () => {
      optimizer.startMonitoring();

      // Fast forward time
      vi.advanceTimersByTime(1000);

      expect(mockHostManager.getPerformanceReport).toHaveBeenCalled();
    });

    it('should detect overload conditions', () => {
      optimizer.startMonitoring();

      // Simulate high CPU usage
      mockHostManager.getPerformanceReport.mockReturnValue({
        totalPlugins: 10,
        totalCpuUsage: 0.9, // 90% CPU
        averageLatency: 10,
        pluginMetrics: [],
      });

      // Update memory usage
      Object.defineProperty(performance, 'memory', {
        value: { usedJSHeapSize: 300 * 1024 * 1024 }, // 300MB
        configurable: true,
      });

      vi.advanceTimersByTime(1000);

      const state = optimizer.getState();
      expect(state.isOverloaded).toBe(true);
      expect(state.cpuUsage).toBe(0.9);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'wam:optimizer:overload',
        expect.any(Object),
      );
    });

    it('should recover from overload when performance improves', () => {
      // Set internal state to overloaded
      (optimizer as any).state.isOverloaded = true;

      optimizer.startMonitoring();

      // Simulate improved performance
      mockHostManager.getPerformanceReport.mockReturnValue({
        totalPlugins: 5,
        totalCpuUsage: 0.3, // 30% CPU
        averageLatency: 5,
        pluginMetrics: [],
      });

      vi.advanceTimersByTime(1000);

      const state = optimizer.getState();
      expect(state.isOverloaded).toBe(false);
    });
  });

  describe('overload handling', () => {
    it('should reduce quality on overload', () => {
      // Set internal state directly
      (optimizer as any).state.currentQuality = {
        name: 'high',
        oversampling: 2,
        bufferSize: 256,
        processingQuality: 'high',
        disabledFeatures: [],
      };

      optimizer.handleOverload();

      const state = optimizer.getState();
      expect(state.currentQuality.name).toBe('medium');
      expect(state.isOverloaded).toBe(true);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'wam:optimizer:quality-changed',
        {
          quality: 'medium',
        },
      );
    });

    it('should disable non-essential effects on overload', () => {
      optimizer.setProfile('mid-range'); // Has disableEffectsOnOverload = true

      mockHostManager.getRegisteredPlugins.mockReturnValue([
        createMockRegistration('essential-synth', true),
        createMockRegistration('effect-1', false),
        createMockRegistration('effect-2', false),
      ]);

      // Update descriptor for essential plugin
      const plugins = mockHostManager.getRegisteredPlugins();
      plugins[0].descriptor.keywords = ['synth', 'essential'];

      optimizer.handleOverload();

      const state = optimizer.getState();
      expect(state.disabledPlugins.has('effect-1')).toBe(true);
      expect(state.disabledPlugins.has('effect-2')).toBe(true);
      expect(state.disabledPlugins.has('essential-synth')).toBe(false);
    });

    it('should not handle overload twice', () => {
      const state = optimizer.getState();
      state.isOverloaded = true;

      optimizer.handleOverload();

      // Quality should not change
      expect(state.currentQuality.name).toBe('high');
    });
  });

  describe('recovery from overload', () => {
    it('should re-enable plugins gradually', () => {
      // Set internal state directly
      (optimizer as any).state.isOverloaded = true;
      (optimizer as any).state.disabledPlugins.add('plugin-1');
      (optimizer as any).state.disabledPlugins.add('plugin-2');
      (optimizer as any).state.disabledPlugins.add('plugin-3');
      (optimizer as any).state.cpuUsage = 0.5;

      optimizer.recoverFromOverload();

      const state = optimizer.getState();
      expect(state.isOverloaded).toBe(false);
      // Should re-enable some but not all plugins
      expect(state.disabledPlugins.size).toBeLessThan(3);
    });

    it('should increase quality when CPU is low', () => {
      // Set internal state directly
      (optimizer as any).state.isOverloaded = true;
      (optimizer as any).state.currentQuality = {
        name: 'low',
        oversampling: 1,
        bufferSize: 1024,
        processingQuality: 'low',
        disabledFeatures: [],
      };
      (optimizer as any).state.cpuUsage = 0.3; // 30% CPU
      (optimizer as any).state.currentProfile.maxCpuUsage = 0.8;

      optimizer.recoverFromOverload();

      const state = optimizer.getState();
      expect(state.currentQuality.name).toBe('medium');
    });

    it('should stop re-enabling plugins if CPU rises', () => {
      // Set internal state directly
      (optimizer as any).state.isOverloaded = true;
      (optimizer as any).state.cpuUsage = 0.7; // 70% CPU
      (optimizer as any).state.currentProfile.maxCpuUsage = 0.8; // 80% limit
      (optimizer as any).state.disabledPlugins.add('plugin-1');
      (optimizer as any).state.disabledPlugins.add('plugin-2');

      optimizer.recoverFromOverload();

      const state = optimizer.getState();
      // Should not re-enable any plugins due to high CPU
      expect(state.disabledPlugins.size).toBeGreaterThan(0);
    });
  });

  describe('quality management', () => {
    it('should reduce quality progressively', () => {
      // Start at ultra
      (optimizer as any).state.currentQuality = { name: 'ultra' } as any;
      (optimizer as any).reduceQuality();

      let state = optimizer.getState();
      expect(state.currentQuality.name).toBe('high');

      // Then high to medium
      (optimizer as any).reduceQuality();
      state = optimizer.getState();
      expect(state.currentQuality.name).toBe('medium');

      // Then medium to low
      (optimizer as any).reduceQuality();
      state = optimizer.getState();
      expect(state.currentQuality.name).toBe('low');

      // Can't go lower than low
      (optimizer as any).reduceQuality();
      state = optimizer.getState();
      expect(state.currentQuality.name).toBe('low');
    });

    it('should increase quality progressively', () => {
      // Start at low
      (optimizer as any).state.currentQuality = { name: 'low' } as any;
      (optimizer as any).increaseQuality();

      let state = optimizer.getState();
      expect(state.currentQuality.name).toBe('medium');

      // Then medium to high
      (optimizer as any).increaseQuality();
      state = optimizer.getState();
      expect(state.currentQuality.name).toBe('high');

      // Then high to ultra
      (optimizer as any).increaseQuality();
      state = optimizer.getState();
      expect(state.currentQuality.name).toBe('ultra');

      // Can't go higher than ultra
      (optimizer as any).increaseQuality();
      state = optimizer.getState();
      expect(state.currentQuality.name).toBe('ultra');
    });
  });

  describe('edge cases', () => {
    it('should handle unknown profile gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      optimizer.setProfile('non-existent');

      expect(consoleSpy).toHaveBeenCalledWith('Unknown profile: non-existent');

      // Profile should not change
      const state = optimizer.getState();
      expect(state.currentProfile.name).toBe('high-end');

      consoleSpy.mockRestore();
    });

    it('should handle missing device capability detector', () => {
      // Reset singleton before setting up new mocks
      (WamDeviceOptimizer as any).instance = null;

      vi.mocked(serviceRegistry.get).mockImplementation((name) => {
        if (name === 'deviceCapabilityDetector') throw new Error('Not found');
        if (name === 'eventBus') return mockEventBus;
        throw new Error(`Service not found: ${name}`);
      });

      const newOptimizer = WamDeviceOptimizer.getInstance();
      const state = newOptimizer.getState();

      // Should default to mid-range
      expect(state.currentProfile.name).toBe('mid-range');
    });

    it('should handle missing performance.memory API', () => {
      vi.useFakeTimers();

      optimizer.startMonitoring();

      // Remove memory property
      Object.defineProperty(performance, 'memory', {
        value: undefined,
        configurable: true,
      });

      vi.advanceTimersByTime(1000);

      // Should not crash
      const state = optimizer.getState();
      expect(state.memoryUsage).toBe(0);

      vi.useRealTimers();
    });
  });
});
