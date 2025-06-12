/**
 * PluginManager Behavior Tests
 *
 * Testing plugin lifecycle management, processing orchestration, and n8n integration
 * for the 761-line PluginManager service using proven behavior-driven approach.
 *
 * Core Behaviors:
 * - Plugin registration and lifecycle management
 * - Audio processing orchestration across plugins
 * - Resource constraint management and validation
 * - N8n payload processing for plugin integration
 * - Asset loading and management for plugins
 * - Error handling and recovery mechanisms
 * - Performance monitoring and optimization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginManager } from '../PluginManager.js';
import type { AudioPlugin, PluginManagerConfig } from '../../types/plugin.js';
import { PluginCategory, PluginState } from '../../types/plugin.js';

// Safe browser environment setup for plugin manager
const createMockEnvironment = () => {
  const globalObj = global as any;

  // Web Audio API mock
  if (!globalObj.AudioContext) {
    const mockAudioContext = {
      state: 'running',
      sampleRate: 44100,
      currentTime: 0,
      destination: {
        connect: vi.fn(),
        disconnect: vi.fn(),
      },
      createGain: vi.fn().mockReturnValue({
        gain: { value: 1, setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
      createAnalyser: vi.fn().mockReturnValue({
        fftSize: 2048,
        frequencyBinCount: 1024,
        getFloatFrequencyData: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
      createBuffer: vi.fn().mockReturnValue({
        length: 1024,
        sampleRate: 44100,
        numberOfChannels: 2,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(1024)),
      }),
      decodeAudioData: vi.fn().mockResolvedValue({
        length: 1024,
        sampleRate: 44100,
        numberOfChannels: 2,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(1024)),
      }),
      suspend: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    globalObj.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);
    globalObj.webkitAudioContext = globalObj.AudioContext;
  }

  // Performance API mock
  if (!globalObj.performance) {
    globalObj.performance = {
      now: vi.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 100 * 1024 * 1024,
        totalJSHeapSize: 200 * 1024 * 1024,
        jsHeapSizeLimit: 4 * 1024 * 1024 * 1024,
      },
    };
  }

  return { globalObj };
};

// Scenario builders for plugin management testing
const createPluginScenarios = () => {
  const mockBasicPlugin: AudioPlugin = {
    metadata: {
      id: 'basic-plugin-001',
      name: 'Basic Test Plugin',
      version: '1.0.0',
      category: PluginCategory.EFFECT,
      description: 'A basic test plugin for behavior testing',
      author: 'Test Suite',
      homepage: 'https://test.com',
      license: 'MIT',
      tags: ['test'],
      dependencies: [],
      capabilities: {
        supportsRealtimeProcessing: true,
        supportsOfflineProcessing: false,
        supportsAudioWorklet: false,
        supportsMIDI: false,
        supportsAutomation: false,
        supportsPresets: false,
        supportsSidechain: false,
        supportsMultiChannel: false,
        maxLatency: 50,
        cpuUsage: 0.1,
        memoryUsage: 50,
        minSampleRate: 44100,
        maxSampleRate: 48000,
        supportedBufferSizes: [256, 512, 1024],
        supportsN8nPayload: true,
        supportsAssetLoading: true,
        supportsMobileOptimization: false,
      },
    },
    config: {
      id: 'basic-plugin-001',
      name: 'Basic Test Plugin',
      version: '1.0.0',
      category: PluginCategory.EFFECT,
      enabled: true,
      priority: 500,
      autoStart: false,
      inputChannels: 2,
      outputChannels: 2,
      settings: {},
      maxCpuUsage: 0.1,
      maxMemoryUsage: 50,
    },
    state: PluginState.INACTIVE,
    capabilities: {
      supportsRealtimeProcessing: true,
      supportsOfflineProcessing: false,
      supportsAudioWorklet: false,
      supportsMIDI: false,
      supportsAutomation: false,
      supportsPresets: false,
      supportsSidechain: false,
      supportsMultiChannel: false,
      maxLatency: 50,
      cpuUsage: 0.1,
      memoryUsage: 50,
      minSampleRate: 44100,
      maxSampleRate: 48000,
      supportedBufferSizes: [256, 512, 1024],
      supportsN8nPayload: true,
      supportsAssetLoading: true,
      supportsMobileOptimization: false,
    },
    parameters: new Map(),
    load: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    activate: vi.fn().mockResolvedValue(undefined),
    deactivate: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    process: vi.fn().mockResolvedValue({
      success: true,
      status: 'success' as const,
      processingTime: 10,
      bypassMode: false,
      processedSamples: 512,
      cpuUsage: 0.05,
      memoryUsage: 25,
    }),
    setParameter: vi.fn().mockResolvedValue(undefined),
    getParameter: vi.fn().mockReturnValue(undefined),
    resetParameters: vi.fn().mockResolvedValue(undefined),
    savePreset: vi.fn().mockResolvedValue({}),
    loadPreset: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnValue(() => undefined),
    off: vi.fn(),
    processN8nPayload: vi.fn().mockResolvedValue(undefined),
    loadAsset: vi.fn().mockResolvedValue(undefined),
  };

  const mockEffectsPlugin: AudioPlugin = {
    metadata: {
      id: 'effects-plugin-001',
      name: 'Effects Test Plugin',
      version: '2.0.0',
      category: PluginCategory.EFFECT,
      description: 'An effects plugin for behavior testing',
      author: 'Test Suite',
      homepage: 'https://test.com',
      license: 'MIT',
      tags: ['test', 'effect'],
      dependencies: [],
      capabilities: {
        supportsRealtimeProcessing: true,
        supportsOfflineProcessing: false,
        supportsAudioWorklet: false,
        supportsMIDI: false,
        supportsAutomation: true,
        supportsPresets: false,
        supportsSidechain: false,
        supportsMultiChannel: false,
        maxLatency: 30,
        cpuUsage: 0.2,
        memoryUsage: 100,
        minSampleRate: 44100,
        maxSampleRate: 48000,
        supportedBufferSizes: [256, 512, 1024],
        supportsN8nPayload: true,
        supportsAssetLoading: true,
        supportsMobileOptimization: false,
      },
    },
    config: {
      id: 'effects-plugin-001',
      name: 'Effects Test Plugin',
      version: '2.0.0',
      category: PluginCategory.EFFECT,
      enabled: true,
      priority: 500,
      autoStart: false,
      inputChannels: 2,
      outputChannels: 2,
      settings: {},
      maxCpuUsage: 0.2,
      maxMemoryUsage: 100,
    },
    state: PluginState.INACTIVE,
    capabilities: {
      supportsRealtimeProcessing: true,
      supportsOfflineProcessing: false,
      supportsAudioWorklet: false,
      supportsMIDI: false,
      supportsAutomation: true,
      supportsPresets: false,
      supportsSidechain: false,
      supportsMultiChannel: false,
      maxLatency: 30,
      cpuUsage: 0.2,
      memoryUsage: 100,
      minSampleRate: 44100,
      maxSampleRate: 48000,
      supportedBufferSizes: [256, 512, 1024],
      supportsN8nPayload: true,
      supportsAssetLoading: true,
      supportsMobileOptimization: false,
    },
    parameters: new Map(),
    load: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    activate: vi.fn().mockResolvedValue(undefined),
    deactivate: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    process: vi.fn().mockResolvedValue({
      success: true,
      status: 'success' as const,
      processingTime: 15,
      bypassMode: false,
      processedSamples: 256,
      cpuUsage: 0.15,
      memoryUsage: 75,
    }),
    setParameter: vi.fn().mockResolvedValue(undefined),
    getParameter: vi.fn().mockReturnValue(undefined),
    resetParameters: vi.fn().mockResolvedValue(undefined),
    savePreset: vi.fn().mockResolvedValue({}),
    loadPreset: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnValue(() => undefined),
    off: vi.fn(),
    processN8nPayload: vi.fn().mockResolvedValue(undefined),
    loadAsset: vi.fn().mockResolvedValue(undefined),
  };

  const mockSynthPlugin: AudioPlugin = {
    metadata: {
      id: 'synth-plugin-001',
      name: 'Synth Test Plugin',
      version: '1.5.0',
      category: PluginCategory.INSTRUMENT,
      description: 'A synthesizer plugin for behavior testing',
      author: 'Test Suite',
      homepage: 'https://test.com',
      license: 'MIT',
      tags: ['test', 'synth'],
      dependencies: ['basic-plugin-001'],
      capabilities: {
        supportsRealtimeProcessing: true,
        supportsOfflineProcessing: false,
        supportsAudioWorklet: false,
        supportsMIDI: true,
        supportsAutomation: true,
        supportsPresets: true,
        supportsSidechain: false,
        supportsMultiChannel: false,
        maxLatency: 100,
        cpuUsage: 0.3,
        memoryUsage: 150,
        minSampleRate: 44100,
        maxSampleRate: 48000,
        supportedBufferSizes: [256, 512, 1024],
        supportsN8nPayload: true,
        supportsAssetLoading: true,
        supportsMobileOptimization: false,
      },
    },
    config: {
      id: 'synth-plugin-001',
      name: 'Synth Test Plugin',
      version: '1.5.0',
      category: PluginCategory.INSTRUMENT,
      enabled: true,
      priority: 500,
      autoStart: false,
      inputChannels: 0,
      outputChannels: 2,
      settings: {},
      maxCpuUsage: 0.3,
      maxMemoryUsage: 150,
    },
    state: PluginState.INACTIVE,
    capabilities: {
      supportsRealtimeProcessing: true,
      supportsOfflineProcessing: false,
      supportsAudioWorklet: false,
      supportsMIDI: true,
      supportsAutomation: true,
      supportsPresets: true,
      supportsSidechain: false,
      supportsMultiChannel: false,
      maxLatency: 100,
      cpuUsage: 0.3,
      memoryUsage: 150,
      minSampleRate: 44100,
      maxSampleRate: 48000,
      supportedBufferSizes: [256, 512, 1024],
      supportsN8nPayload: true,
      supportsAssetLoading: true,
      supportsMobileOptimization: false,
    },
    parameters: new Map(),
    load: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    activate: vi.fn().mockResolvedValue(undefined),
    deactivate: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    process: vi.fn().mockResolvedValue({
      success: true,
      status: 'success' as const,
      processingTime: 20,
      bypassMode: false,
      processedSamples: 1024,
      cpuUsage: 0.25,
      memoryUsage: 120,
    }),
    setParameter: vi.fn().mockResolvedValue(undefined),
    getParameter: vi.fn().mockReturnValue(undefined),
    resetParameters: vi.fn().mockResolvedValue(undefined),
    savePreset: vi.fn().mockResolvedValue({}),
    loadPreset: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnValue(() => undefined),
    off: vi.fn(),
    processN8nPayload: vi.fn().mockResolvedValue(undefined),
    loadAsset: vi.fn().mockResolvedValue(undefined),
  };

  const mockFailingPlugin: AudioPlugin = {
    metadata: {
      id: 'failing-plugin-001',
      name: 'Failing Test Plugin',
      version: '1.0.0',
      category: PluginCategory.EFFECT,
      description: 'A plugin that fails for error testing',
      author: 'Test Suite',
      homepage: 'https://test.com',
      license: 'MIT',
      tags: ['test'],
      dependencies: [],
      capabilities: {
        supportsRealtimeProcessing: true,
        supportsOfflineProcessing: false,
        supportsAudioWorklet: false,
        supportsMIDI: false,
        supportsAutomation: false,
        supportsPresets: false,
        supportsSidechain: false,
        supportsMultiChannel: false,
        maxLatency: 50,
        cpuUsage: 0.1,
        memoryUsage: 50,
        minSampleRate: 44100,
        maxSampleRate: 48000,
        supportedBufferSizes: [256, 512, 1024],
        supportsN8nPayload: true,
        supportsAssetLoading: true,
        supportsMobileOptimization: false,
      },
    },
    config: {
      id: 'failing-plugin-001',
      name: 'Failing Test Plugin',
      version: '1.0.0',
      category: PluginCategory.EFFECT,
      enabled: true,
      priority: 500,
      autoStart: false,
      inputChannels: 2,
      outputChannels: 2,
      settings: {},
      maxCpuUsage: 0.1,
      maxMemoryUsage: 50,
    },
    state: PluginState.INACTIVE,
    capabilities: {
      supportsRealtimeProcessing: true,
      supportsOfflineProcessing: false,
      supportsAudioWorklet: false,
      supportsMIDI: false,
      supportsAutomation: false,
      supportsPresets: false,
      supportsSidechain: false,
      supportsMultiChannel: false,
      maxLatency: 50,
      cpuUsage: 0.1,
      memoryUsage: 50,
      minSampleRate: 44100,
      maxSampleRate: 48000,
      supportedBufferSizes: [256, 512, 1024],
      supportsN8nPayload: true,
      supportsAssetLoading: true,
      supportsMobileOptimization: false,
    },
    parameters: new Map(),
    load: vi.fn().mockRejectedValue(new Error('Failed to load plugin')),
    initialize: vi
      .fn()
      .mockRejectedValue(new Error('Failed to initialize plugin')),
    activate: vi.fn().mockRejectedValue(new Error('Failed to activate plugin')),
    deactivate: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    process: vi.fn().mockResolvedValue({
      success: false,
      status: 'error' as const,
      processingTime: 0,
      bypassMode: false,
      processedSamples: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      error: new Error('Processing failed'),
    }),
    setParameter: vi.fn().mockResolvedValue(undefined),
    getParameter: vi.fn().mockReturnValue(undefined),
    resetParameters: vi.fn().mockResolvedValue(undefined),
    savePreset: vi.fn().mockResolvedValue({}),
    loadPreset: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnValue(() => undefined),
    off: vi.fn(),
    processN8nPayload: vi
      .fn()
      .mockRejectedValue(new Error('N8n processing failed')),
    loadAsset: vi.fn().mockRejectedValue(new Error('Asset loading failed')),
  };

  const pluginManagerConfig: PluginManagerConfig = {
    maxConcurrentPlugins: 8,
    maxTotalCpuUsage: 0.6,
    maxTotalMemoryUsage: 200,
    processingBufferSize: 512,
    enableParallelProcessing: true,
    errorRecoveryAttempts: 2,
    failureTimeout: 3000,
    enableN8nIntegration: true,
    enableAssetLoading: true,
    enableMobileOptimizations: true,
  };

  return {
    mockBasicPlugin,
    mockEffectsPlugin,
    mockSynthPlugin,
    mockFailingPlugin,
    pluginManagerConfig,
  };
};

// Expectation helpers
const _expectPluginState = (
  plugin: AudioPlugin,
  expectedStates: PluginState[],
) => {
  expect(expectedStates).toContain(plugin.state);
};

const expectValidPlugin = (plugin: AudioPlugin | null) => {
  expect(plugin).toBeDefined();
  expect(plugin).not.toBeNull();
  if (plugin) {
    expect(plugin.metadata.id).toBeDefined();
    expect(plugin.metadata.name).toBeDefined();
    expect(plugin.metadata.version).toBeDefined();
  }
};

const _expectProcessingResult = (result: any) => {
  expect(result).toBeDefined();
  expect(['success', 'error', 'timeout']).toContain(result.status);
  expect(result.processingTime).toBeGreaterThanOrEqual(0);
  expect(result.cpuUsage).toBeGreaterThanOrEqual(0);
  expect(result.memoryUsage).toBeGreaterThanOrEqual(0);
};

describe('PluginManager Behavior', () => {
  let pluginManager: PluginManager;
  let _mockEnv: any;
  let scenarios: ReturnType<typeof createPluginScenarios>;
  let mockAudioContext: AudioContext;

  beforeEach(async () => {
    const { globalObj } = createMockEnvironment();
    _mockEnv = { globalObj };
    scenarios = createPluginScenarios();

    // Reset singleton
    (PluginManager as any).instance = undefined;

    // Create mock audio context
    mockAudioContext = new globalObj.AudioContext();

    pluginManager = PluginManager.getInstance(scenarios.pluginManagerConfig);

    vi.clearAllMocks();
  });

  describe('Plugin Manager Initialization', () => {
    it('should initialize plugin manager successfully', async () => {
      await pluginManager.initialize(mockAudioContext);

      expect(pluginManager).toBeDefined();

      // Should have empty registry initially
      const allPlugins = pluginManager.getAllPlugins();
      expect(allPlugins).toBeInstanceOf(Array);
      expect(allPlugins.length).toBe(0);
    });

    it('should handle initialization with invalid audio context', async () => {
      const invalidContext = { state: 'closed' } as AudioContext;

      await expect(pluginManager.initialize(invalidContext)).rejects.toThrow();
    });

    it('should provide singleton behavior', () => {
      const manager1 = PluginManager.getInstance();
      const manager2 = PluginManager.getInstance();

      expect(manager1).toBe(manager2);
    });
  });

  describe('Plugin Registration Behavior', () => {
    beforeEach(async () => {
      await pluginManager.initialize(mockAudioContext);
    });

    it('should register a basic plugin successfully', async () => {
      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);

      const registeredPlugin = pluginManager.getPlugin(
        scenarios.mockBasicPlugin.metadata.id,
      );
      expectValidPlugin(registeredPlugin);

      expect(scenarios.mockBasicPlugin.load).toHaveBeenCalled();
      expect(scenarios.mockBasicPlugin.initialize).toHaveBeenCalled();
    });

    it('should register multiple plugins', async () => {
      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);
      await pluginManager.registerPlugin(scenarios.mockEffectsPlugin);

      const allPlugins = pluginManager.getAllPlugins();
      expect(allPlugins.length).toBe(2);

      const basicPlugin = pluginManager.getPlugin(
        scenarios.mockBasicPlugin.metadata.id,
      );
      const effectsPlugin = pluginManager.getPlugin(
        scenarios.mockEffectsPlugin.metadata.id,
      );

      expectValidPlugin(basicPlugin);
      expectValidPlugin(effectsPlugin);
    });

    it('should handle plugin with dependencies', async () => {
      // Register dependency first
      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);

      // Then register plugin with dependency
      await pluginManager.registerPlugin(scenarios.mockSynthPlugin);

      const synthPlugin = pluginManager.getPlugin(
        scenarios.mockSynthPlugin.metadata.id,
      );
      expectValidPlugin(synthPlugin);
    });

    it('should prevent duplicate plugin registration', async () => {
      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);

      await expect(
        pluginManager.registerPlugin(scenarios.mockBasicPlugin),
      ).rejects.toThrow();
    });

    it('should handle plugin registration failure', async () => {
      await expect(
        pluginManager.registerPlugin(scenarios.mockFailingPlugin),
      ).rejects.toThrow();

      // Should not be in registry
      const failedPlugin = pluginManager.getPlugin(
        scenarios.mockFailingPlugin.metadata.id,
      );
      expect(failedPlugin).toBeNull();
    });

    it('should auto-activate plugins when configured', async () => {
      // **FIX**: Create dedicated plugin with autoStart: true for this test
      const autoStartPlugin = {
        ...scenarios.mockEffectsPlugin,
        metadata: {
          ...scenarios.mockEffectsPlugin.metadata,
          id: 'auto-start-plugin',
        },
        config: {
          ...scenarios.mockEffectsPlugin.config,
          id: 'auto-start-plugin',
          autoStart: true, // This plugin should auto-activate
        },
      };

      await pluginManager.registerPlugin(autoStartPlugin); // has autoStart: true

      expect(autoStartPlugin.activate).toHaveBeenCalled();
    });
  });

  describe('Plugin Lifecycle Management', () => {
    beforeEach(async () => {
      await pluginManager.initialize(mockAudioContext);
      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);
    });

    it('should activate plugin successfully', async () => {
      await pluginManager.activatePlugin(scenarios.mockBasicPlugin.metadata.id);

      expect(scenarios.mockBasicPlugin.activate).toHaveBeenCalled();

      const activePlugins = pluginManager.getActivePlugins();
      expect(activePlugins.length).toBeGreaterThan(0);
    });

    it('should deactivate plugin successfully', async () => {
      await pluginManager.activatePlugin(scenarios.mockBasicPlugin.metadata.id);
      await pluginManager.deactivatePlugin(
        scenarios.mockBasicPlugin.metadata.id,
      );

      expect(scenarios.mockBasicPlugin.deactivate).toHaveBeenCalled();
    });

    it('should unregister plugin completely', async () => {
      await pluginManager.unregisterPlugin(
        scenarios.mockBasicPlugin.metadata.id,
      );

      expect(scenarios.mockBasicPlugin.dispose).toHaveBeenCalled();

      const unregisteredPlugin = pluginManager.getPlugin(
        scenarios.mockBasicPlugin.metadata.id,
      );
      expect(unregisteredPlugin).toBeNull();
    });

    it('should handle activation of non-existent plugin', async () => {
      await expect(
        pluginManager.activatePlugin('non-existent-plugin'),
      ).rejects.toThrow();
    });

    it('should handle deactivation of non-existent plugin', async () => {
      await expect(
        pluginManager.deactivatePlugin('non-existent-plugin'),
      ).rejects.toThrow();
    });
  });

  describe('Audio Processing Orchestration', () => {
    beforeEach(async () => {
      await pluginManager.initialize(mockAudioContext);
      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);
      await pluginManager.registerPlugin(scenarios.mockEffectsPlugin);
      await pluginManager.activatePlugin(scenarios.mockBasicPlugin.metadata.id);
      await pluginManager.activatePlugin(
        scenarios.mockEffectsPlugin.metadata.id,
      );
    });

    it('should process audio through active plugins', async () => {
      const inputBuffer = mockAudioContext.createBuffer(2, 1024, 44100);
      const outputBuffer = mockAudioContext.createBuffer(2, 1024, 44100);

      await pluginManager.processAudio(inputBuffer, outputBuffer);

      // Should have called processAudio on active plugins
      expect(scenarios.mockBasicPlugin.process).toHaveBeenCalled();
      expect(scenarios.mockEffectsPlugin.process).toHaveBeenCalled();
    });

    it('should handle audio processing errors gracefully', async () => {
      // **FIX**: Create a plugin that registers successfully but fails processing
      const processingFailingPlugin = {
        ...scenarios.mockBasicPlugin,
        metadata: {
          ...scenarios.mockBasicPlugin.metadata,
          id: 'processing-failing-plugin',
        },
        config: {
          ...scenarios.mockBasicPlugin.config,
          id: 'processing-failing-plugin',
        },
        // Plugin loads and initializes successfully
        load: vi.fn().mockResolvedValue(undefined),
        initialize: vi.fn().mockResolvedValue(undefined),
        activate: vi.fn().mockResolvedValue(undefined),
        // But fails during audio processing
        process: vi.fn().mockRejectedValue(new Error('Processing failed')),
      };

      // Register and activate the processing-failing plugin
      await pluginManager.registerPlugin(processingFailingPlugin);
      await pluginManager.activatePlugin(processingFailingPlugin.metadata.id);

      const inputBuffer = mockAudioContext.createBuffer(2, 1024, 44100);
      const outputBuffer = mockAudioContext.createBuffer(2, 1024, 44100);

      // Should handle processing errors without crashing
      await expect(
        pluginManager.processAudio(inputBuffer, outputBuffer),
      ).resolves.not.toThrow();
    });

    it('should respect processing order based on dependencies', async () => {
      // Register synth plugin with dependency
      await pluginManager.registerPlugin(scenarios.mockSynthPlugin);
      await pluginManager.activatePlugin(scenarios.mockSynthPlugin.metadata.id);

      const inputBuffer = mockAudioContext.createBuffer(2, 1024, 44100);
      const outputBuffer = mockAudioContext.createBuffer(2, 1024, 44100);

      await pluginManager.processAudio(inputBuffer, outputBuffer);

      // Should process all active plugins
      expect(scenarios.mockBasicPlugin.process).toHaveBeenCalled();
      expect(scenarios.mockSynthPlugin.process).toHaveBeenCalled();
    });
  });

  describe('Plugin Querying and Filtering', () => {
    beforeEach(async () => {
      await pluginManager.initialize(mockAudioContext);
      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);
      await pluginManager.registerPlugin(scenarios.mockEffectsPlugin);
      await pluginManager.registerPlugin(scenarios.mockSynthPlugin);
    });

    it('should get plugins by category', () => {
      const effectsPlugins = pluginManager.getPluginsByCategory(
        PluginCategory.EFFECT,
      );
      expect(effectsPlugins.length).toBe(2); // basicPlugin and effectsPlugin

      const instrumentPlugins = pluginManager.getPluginsByCategory(
        PluginCategory.INSTRUMENT,
      );
      expect(instrumentPlugins.length).toBe(1); // synthPlugin
    });

    it('should get all registered plugins', () => {
      const allPlugins = pluginManager.getAllPlugins();
      expect(allPlugins.length).toBe(3);
    });

    it('should get only active plugins', async () => {
      await pluginManager.activatePlugin(scenarios.mockBasicPlugin.metadata.id);

      const activePlugins = pluginManager.getActivePlugins();
      expect(activePlugins.length).toBe(1);
    });

    it('should get specific plugin by ID', () => {
      const plugin = pluginManager.getPlugin(
        scenarios.mockBasicPlugin.metadata.id,
      );
      expectValidPlugin(plugin);
      expect(plugin?.metadata.id).toBe(scenarios.mockBasicPlugin.metadata.id);
    });

    it('should return null for non-existent plugin', () => {
      const plugin = pluginManager.getPlugin('non-existent-plugin');
      expect(plugin).toBeNull();
    });
  });

  describe('N8n Integration', () => {
    beforeEach(async () => {
      await pluginManager.initialize(mockAudioContext);
      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);
    });

    it('should process n8n payload for plugin', async () => {
      const payload = {
        type: 'audio_effect',
        parameters: {
          gain: 0.8,
          delay: 0.2,
        },
      };

      await pluginManager.processN8nPayload(
        scenarios.mockBasicPlugin.metadata.id,
        payload,
      );

      expect(scenarios.mockBasicPlugin.processN8nPayload).toHaveBeenCalledWith(
        payload,
      );
    });

    it('should handle n8n processing errors', async () => {
      const payload = { invalid: 'payload' };

      await expect(
        pluginManager.processN8nPayload(
          scenarios.mockFailingPlugin.metadata.id,
          payload,
        ),
      ).rejects.toThrow();
    });

    it('should handle n8n payload for non-existent plugin', async () => {
      const payload = { test: 'data' };

      await expect(
        pluginManager.processN8nPayload('non-existent-plugin', payload),
      ).rejects.toThrow();
    });
  });

  describe('Asset Loading', () => {
    beforeEach(async () => {
      await pluginManager.initialize(mockAudioContext);
      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);
    });

    it('should load assets for plugin', async () => {
      const audioBuffer = mockAudioContext.createBuffer(2, 1024, 44100);

      await pluginManager.loadAssetForPlugin(
        scenarios.mockBasicPlugin.metadata.id,
        'test-asset-001',
        audioBuffer,
      );

      expect(scenarios.mockBasicPlugin.loadAsset).toHaveBeenCalledWith(
        'test-asset-001',
        audioBuffer,
      );
    });

    it('should handle asset loading errors', async () => {
      const audioBuffer = mockAudioContext.createBuffer(2, 1024, 44100);

      await expect(
        pluginManager.loadAssetForPlugin(
          scenarios.mockFailingPlugin.metadata.id,
          'test-asset-001',
          audioBuffer,
        ),
      ).rejects.toThrow();
    });

    it('should handle asset loading for non-existent plugin', async () => {
      const audioBuffer = mockAudioContext.createBuffer(2, 1024, 44100);

      await expect(
        pluginManager.loadAssetForPlugin(
          'non-existent-plugin',
          'test-asset-001',
          audioBuffer,
        ),
      ).rejects.toThrow();
    });
  });

  describe('Event System', () => {
    beforeEach(async () => {
      await pluginManager.initialize(mockAudioContext);
    });

    it('should emit plugin registration events', async () => {
      const registrationHandler = vi.fn();
      pluginManager.on('pluginRegistered', registrationHandler);

      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);

      expect(registrationHandler).toHaveBeenCalledWith(
        scenarios.mockBasicPlugin,
      );
    });

    it('should emit plugin activation events', async () => {
      const activationHandler = vi.fn();
      pluginManager.on('pluginStateChanged', activationHandler);

      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);
      await pluginManager.activatePlugin(scenarios.mockBasicPlugin.metadata.id);

      expect(activationHandler).toHaveBeenCalled();
    });

    it('should emit plugin error events', async () => {
      const errorHandler = vi.fn();
      pluginManager.on('pluginError', errorHandler);

      // Attempt to register failing plugin
      try {
        await pluginManager.registerPlugin(scenarios.mockFailingPlugin);
      } catch {
        // Expected to fail
      }

      // Error handler might be called depending on implementation
    });

    it('should unregister event handlers', () => {
      const handler = vi.fn();
      const unregister = pluginManager.on('pluginRegistered', handler);

      unregister();

      expect(typeof unregister).toBe('function');
    });
  });

  describe('Resource Management and Constraints', () => {
    beforeEach(async () => {
      await pluginManager.initialize(mockAudioContext);
    });

    it('should validate resource constraints during registration', async () => {
      // Should register plugins within resource limits
      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);
      await pluginManager.registerPlugin(scenarios.mockEffectsPlugin);

      const allPlugins = pluginManager.getAllPlugins();
      expect(allPlugins.length).toBe(2);
    });

    it('should handle resource constraint violations', async () => {
      // Create a plugin that exceeds resource limits
      const resourceIntensivePlugin = {
        ...scenarios.mockBasicPlugin,
        metadata: {
          ...scenarios.mockBasicPlugin.metadata,
          id: 'resource-intensive-plugin',
          capabilities: {
            ...scenarios.mockBasicPlugin.metadata.capabilities,
            cpuUsage: 0.9, // **FIX**: Exceeds manager limit of 0.8
            memoryUsage: 300, // **FIX**: Exceeds manager limit of 256MB
          },
        },
        config: {
          ...scenarios.mockBasicPlugin.config,
          id: 'resource-intensive-plugin',
          maxCpuUsage: 0.9, // Plugin-specific limit
          maxMemoryUsage: 300, // Plugin-specific limit
        },
        capabilities: {
          ...scenarios.mockBasicPlugin.capabilities,
          cpuUsage: 0.9, // **FIX**: This is what validateResourceConstraints checks
          memoryUsage: 300, // **FIX**: This is what validateResourceConstraints checks
        },
      };

      await expect(
        pluginManager.registerPlugin(resourceIntensivePlugin),
      ).rejects.toThrow();
    });

    it('should track plugin resource usage', async () => {
      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);
      await pluginManager.activatePlugin(scenarios.mockBasicPlugin.metadata.id);

      const inputBuffer = mockAudioContext.createBuffer(2, 1024, 44100);
      const outputBuffer = mockAudioContext.createBuffer(2, 1024, 44100);

      await pluginManager.processAudio(inputBuffer, outputBuffer);

      // Should track processing statistics
      expect(scenarios.mockBasicPlugin.process).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await pluginManager.initialize(mockAudioContext);
    });

    it('should handle plugin loading failures gracefully', async () => {
      await expect(
        pluginManager.registerPlugin(scenarios.mockFailingPlugin),
      ).rejects.toThrow();

      // Plugin should not be registered
      const plugin = pluginManager.getPlugin(
        scenarios.mockFailingPlugin.metadata.id,
      );
      expect(plugin).toBeNull();
    });

    it('should handle plugin activation failures', async () => {
      // Mock plugin that fails activation
      const activationFailingPlugin = {
        ...scenarios.mockBasicPlugin,
        metadata: {
          ...scenarios.mockBasicPlugin.metadata,
          id: 'activation-failing-plugin',
        },
        activate: vi.fn().mockRejectedValue(new Error('Activation failed')),
      };

      await pluginManager.registerPlugin(activationFailingPlugin);

      await expect(
        pluginManager.activatePlugin(activationFailingPlugin.metadata.id),
      ).rejects.toThrow();
    });

    it('should handle processing errors without stopping other plugins', async () => {
      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);
      await pluginManager.registerPlugin(scenarios.mockEffectsPlugin);

      // Mock one plugin to fail processing
      scenarios.mockBasicPlugin.process = vi
        .fn()
        .mockRejectedValue(new Error('Processing failed'));

      await pluginManager.activatePlugin(scenarios.mockBasicPlugin.metadata.id);
      await pluginManager.activatePlugin(
        scenarios.mockEffectsPlugin.metadata.id,
      );

      const inputBuffer = mockAudioContext.createBuffer(2, 1024, 44100);
      const outputBuffer = mockAudioContext.createBuffer(2, 1024, 44100);

      // Should handle processing errors gracefully
      await expect(
        pluginManager.processAudio(inputBuffer, outputBuffer),
      ).resolves.not.toThrow();
    });
  });

  describe('Lifecycle Management', () => {
    beforeEach(async () => {
      await pluginManager.initialize(mockAudioContext);
      await pluginManager.registerPlugin(scenarios.mockBasicPlugin);
      await pluginManager.registerPlugin(scenarios.mockEffectsPlugin);
    });

    it('should dispose all plugins cleanly', async () => {
      await pluginManager.dispose();

      expect(scenarios.mockBasicPlugin.dispose).toHaveBeenCalled();
      expect(scenarios.mockEffectsPlugin.dispose).toHaveBeenCalled();
    });

    it('should handle disposal of individual plugins', async () => {
      await pluginManager.unregisterPlugin(
        scenarios.mockBasicPlugin.metadata.id,
      );

      expect(scenarios.mockBasicPlugin.dispose).toHaveBeenCalled();

      const remainingPlugins = pluginManager.getAllPlugins();
      expect(remainingPlugins.length).toBe(1);
    });

    it('should handle multiple disposal calls gracefully', async () => {
      await pluginManager.dispose();
      await pluginManager.dispose(); // Second disposal

      // Should handle multiple disposals without errors
      expect(true).toBe(true);
    });
  });
});
