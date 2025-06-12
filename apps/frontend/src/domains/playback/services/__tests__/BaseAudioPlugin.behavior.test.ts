/**
 * BaseAudioPlugin Behavior Tests
 *
 * Tests the audio plugin foundation behaviors including lifecycle management,
 * parameter handling, event system, Tone.js integration, and error recovery.
 *
 * Focus: What the service DOES, not how it's implemented
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseAudioPlugin } from '../BaseAudioPlugin.js';
import {
  PluginMetadata,
  PluginConfig,
  PluginState,
  PluginCategory,
  PluginPriority,
  PluginParameterType,
  PluginAudioContext,
  PluginProcessingResult,
  ProcessingResultStatus,
} from '../../types/plugin.js';

// Test Environment Setup
const setupTestEnvironment = () => {
  // Mock console to prevent test noise
  global.console = {
    ...global.console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  // Mock Tone.js
  const mockToneNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    toDestination: vi.fn(),
    chain: vi.fn(),
  };

  const mockTone = {
    Gain: vi.fn().mockReturnValue(mockToneNode),
    Filter: vi.fn().mockReturnValue(mockToneNode),
    Compressor: vi.fn().mockReturnValue(mockToneNode),
    EQ3: vi.fn().mockReturnValue(mockToneNode),
    getContext: vi.fn().mockReturnValue({
      state: 'running',
      sampleRate: 44100,
      currentTime: 0,
    }),
  };

  // Mock Tone module
  vi.doMock('tone', () => mockTone);

  return { mockTone, mockToneNode };
};

// Test Plugin Implementation
class TestAudioPlugin extends BaseAudioPlugin {
  public readonly metadata: PluginMetadata = {
    id: 'test.audio-plugin',
    name: 'Test Audio Plugin',
    version: '1.0.0',
    description: 'Test plugin for behavioral testing',
    author: 'Test Team',
    homepage: 'https://test.com',
    license: 'MIT',
    category: PluginCategory.EFFECT,
    tags: ['test', 'effect'],
    capabilities: {
      supportsRealtimeProcessing: true,
      supportsOfflineProcessing: true,
      supportsAudioWorklet: false,
      supportsMIDI: false,
      supportsAutomation: true,
      supportsPresets: true,
      supportsSidechain: false,
      supportsMultiChannel: true,
      maxLatency: 10,
      cpuUsage: 0.1,
      memoryUsage: 4,
      minSampleRate: 44100,
      maxSampleRate: 96000,
      supportedBufferSizes: [128, 256, 512],
      supportsN8nPayload: true,
      supportsAssetLoading: true,
      supportsMobileOptimization: true,
    },
    dependencies: [],
    epicIntegration: {
      supportedMidiTypes: ['note-on', 'note-off'],
      supportedAudioFormats: ['wav', 'mp3'],
      assetProcessingCapabilities: ['volume-analysis'],
    },
  };

  public readonly config: PluginConfig = {
    id: this.metadata.id,
    name: this.metadata.name,
    version: this.metadata.version,
    category: PluginCategory.EFFECT,
    enabled: true,
    priority: PluginPriority.MEDIUM,
    autoStart: false,
    inputChannels: 2,
    outputChannels: 2,
    settings: {},
    maxCpuUsage: 20,
    maxMemoryUsage: 8,
    n8nIntegration: {
      acceptsPayload: true,
      payloadTypes: ['test-config'],
    },
  };

  public readonly capabilities = this.metadata.capabilities;

  private loadCalled = false;
  private initializeCalled = false;
  private activateCalled = false;
  private deactivateCalled = false;
  private disposeCalled = false;
  private parameterChanges: Array<{ id: string; value: unknown }> = [];

  constructor() {
    super();
    this.initializeTestParameters();
  }

  protected async onLoad(): Promise<void> {
    this.loadCalled = true;
  }

  protected async onInitialize(_context: PluginAudioContext): Promise<void> {
    this.initializeCalled = true;
  }

  protected async onActivate(): Promise<void> {
    this.activateCalled = true;
  }

  protected async onDeactivate(): Promise<void> {
    this.deactivateCalled = true;
  }

  protected async onDispose(): Promise<void> {
    this.disposeCalled = true;
  }

  protected async onParameterChanged(
    parameterId: string,
    value: unknown,
  ): Promise<void> {
    this.parameterChanges.push({ id: parameterId, value });
  }

  public async process(
    _inputBuffer: AudioBuffer,
    outputBuffer: AudioBuffer,
    _context: PluginAudioContext,
  ): Promise<PluginProcessingResult> {
    // Simple passthrough for testing
    return {
      success: true,
      status: ProcessingResultStatus.SUCCESS,
      processingTime: 0,
      bypassMode: false,
      processedSamples: outputBuffer.length,
      cpuUsage: 0.1,
      memoryUsage: 1,
    };
  }

  // Test inspection methods
  public getTestState() {
    return {
      loadCalled: this.loadCalled,
      initializeCalled: this.initializeCalled,
      activateCalled: this.activateCalled,
      deactivateCalled: this.deactivateCalled,
      disposeCalled: this.disposeCalled,
      parameterChanges: [...this.parameterChanges],
    };
  }

  private initializeTestParameters(): void {
    this.addParameter({
      id: 'gain',
      name: 'Gain',
      type: PluginParameterType.FLOAT,
      defaultValue: 1.0,
      minValue: 0.0,
      maxValue: 2.0,
      unit: 'linear',
      description: 'Output gain control',
      automatable: true,
    });

    this.addParameter({
      id: 'frequency',
      name: 'Frequency',
      type: PluginParameterType.FLOAT,
      defaultValue: 1000,
      minValue: 20,
      maxValue: 20000,
      unit: 'Hz',
      description: 'Filter frequency',
      automatable: true,
    });

    this.addParameter({
      id: 'enabled',
      name: 'Enabled',
      type: PluginParameterType.BOOLEAN,
      defaultValue: true,
      description: 'Enable/disable plugin',
      automatable: false,
    });
  }
}

// Mock Audio Data Helpers
const createMockAudioContext = (): PluginAudioContext => ({
  audioContext: {
    state: 'running',
    sampleRate: 44100,
    currentTime: 0,
    destination: {} as any,
  } as any,
  sampleRate: 44100,
  bufferSize: 512,
  currentTime: 0,
  toneContext: {} as any,
  transport: {} as any,
  performanceMetrics: {
    processingTime: 0,
    cpuUsage: 0,
    memoryUsage: 0,
  },
});

const createMockAudioBuffer = (channels = 2, length = 1024): AudioBuffer =>
  ({
    numberOfChannels: channels,
    length,
    sampleRate: 44100,
    duration: length / 44100,
    getChannelData: vi.fn().mockReturnValue(new Float32Array(length)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  }) as any;

// Test Helpers
const expectValidPluginState = (state: PluginState) => {
  expect(Object.values(PluginState)).toContain(state);
};

const _expectValidParameterValue = (
  value: unknown,
  type: PluginParameterType,
) => {
  switch (type) {
    case PluginParameterType.FLOAT:
    case PluginParameterType.NUMBER:
      expect(typeof value).toBe('number');
      break;
    case PluginParameterType.BOOLEAN:
      expect(typeof value).toBe('boolean');
      break;
    case PluginParameterType.STRING:
      expect(typeof value).toBe('string');
      break;
    case PluginParameterType.ENUM:
      expect(value).toBeDefined();
      break;
  }
};

const expectValidProcessingResult = (result: PluginProcessingResult) => {
  expect(result).toBeDefined();
  expect(Object.values(ProcessingResultStatus)).toContain(result.status);
  expect(typeof result.processingTime).toBe('number');
  expect(typeof result.cpuUsage).toBe('number');
  expect(typeof result.memoryUsage).toBe('number');
  expect(result.processingTime).toBeGreaterThanOrEqual(0);
  expect(result.cpuUsage).toBeGreaterThanOrEqual(0);
  expect(result.memoryUsage).toBeGreaterThanOrEqual(0);
};

// Behavior Tests
describe('BaseAudioPlugin Behaviors', () => {
  let plugin: TestAudioPlugin;
  let mockEnvironment: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    mockEnvironment = setupTestEnvironment();
    plugin = new TestAudioPlugin();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      if (plugin.state !== PluginState.UNLOADED) {
        await plugin.dispose();
      }
    } catch {
      // Ignore disposal errors in tests
    }
    vi.restoreAllMocks();
  });

  describe('Plugin Lifecycle Behaviors', () => {
    test('should start in unloaded state', () => {
      const state = plugin.state;

      expect(state).toBe(PluginState.UNLOADED);
      expectValidPluginState(state);
    });

    test('should load successfully from unloaded state', async () => {
      await plugin.load();

      expect(plugin.state).toBe(PluginState.LOADED);
      expect(plugin.getTestState().loadCalled).toBe(true);
    });

    test('should initialize after loading', async () => {
      await plugin.load();
      const context = createMockAudioContext();

      await plugin.initialize(context);

      expect(plugin.state).toBe(PluginState.INACTIVE);
      expect(plugin.getTestState().initializeCalled).toBe(true);
    });

    test('should activate after initialization', async () => {
      await plugin.load();
      await plugin.initialize(createMockAudioContext());

      await plugin.activate();

      expect(plugin.state).toBe(PluginState.ACTIVE);
      expect(plugin.getTestState().activateCalled).toBe(true);
    });

    test('should deactivate from active state', async () => {
      await plugin.load();
      await plugin.initialize(createMockAudioContext());
      await plugin.activate();

      await plugin.deactivate();

      expect(plugin.state).toBe(PluginState.INACTIVE);
      expect(plugin.getTestState().deactivateCalled).toBe(true);
    });

    test('should dispose from any state', async () => {
      await plugin.load();
      await plugin.initialize(createMockAudioContext());
      await plugin.activate();

      await plugin.dispose();

      expect(plugin.state).toBe(PluginState.UNLOADED);
      expect(plugin.getTestState().disposeCalled).toBe(true);
    });

    test('should handle complete lifecycle sequence', async () => {
      const context = createMockAudioContext();

      // Full lifecycle
      await plugin.load();
      await plugin.initialize(context);
      await plugin.activate();
      await plugin.deactivate();
      await plugin.dispose();

      const testState = plugin.getTestState();
      expect(testState.loadCalled).toBe(true);
      expect(testState.initializeCalled).toBe(true);
      expect(testState.activateCalled).toBe(true);
      expect(testState.deactivateCalled).toBe(true);
      expect(testState.disposeCalled).toBe(true);
    });

    test('should prevent invalid state transitions', async () => {
      // Try to initialize without loading
      await expect(
        plugin.initialize(createMockAudioContext()),
      ).rejects.toThrow();

      // Reset plugin for next test scenario
      plugin = new TestAudioPlugin();

      // Try to activate without initialization
      await plugin.load();
      await expect(plugin.activate()).rejects.toThrow();

      // Reset plugin for next test scenario
      plugin = new TestAudioPlugin();

      // Try to deactivate without activation
      await plugin.load();
      await plugin.initialize(createMockAudioContext());
      await expect(plugin.deactivate()).rejects.toThrow();
    });

    test('should handle repeated operations gracefully', async () => {
      await plugin.load();

      // Loading again should be handled gracefully
      await plugin.load();

      expect(plugin.state).toBe(PluginState.LOADED);
    });
  });

  describe('Parameter Management Behaviors', () => {
    beforeEach(async () => {
      await plugin.load();
      await plugin.initialize(createMockAudioContext());
    });

    test('should provide access to all parameters', () => {
      const parameters = plugin.parameters;

      expect(parameters).toBeInstanceOf(Map);
      expect(parameters.size).toBeGreaterThan(0);

      // Check specific test parameters
      expect(parameters.has('gain')).toBe(true);
      expect(parameters.has('frequency')).toBe(true);
      expect(parameters.has('enabled')).toBe(true);
    });

    test('should set and get parameter values', async () => {
      await plugin.setParameter('gain', 1.5);

      const value = plugin.getParameter('gain');
      expect(value).toBe(1.5);

      const changes = plugin.getTestState().parameterChanges;
      expect(changes).toContainEqual({ id: 'gain', value: 1.5 });
    });

    test('should validate parameter types', async () => {
      // Valid values
      await plugin.setParameter('gain', 1.5);
      await plugin.setParameter('enabled', false);
      await plugin.setParameter('frequency', 440);

      // Invalid types should be handled gracefully or throw
      await expect(plugin.setParameter('gain', 'invalid')).rejects.toThrow();
    });

    test('should validate parameter ranges', async () => {
      const gainParam = plugin.parameters.get('gain');
      expect(gainParam?.minValue).toBe(0.0);
      expect(gainParam?.maxValue).toBe(2.0);

      // Test boundary values
      await plugin.setParameter('gain', 0.0);
      expect(plugin.getParameter('gain')).toBe(0.0);

      await plugin.setParameter('gain', 2.0);
      expect(plugin.getParameter('gain')).toBe(2.0);

      // Values outside range should be clamped or rejected
      await expect(plugin.setParameter('gain', -1.0)).rejects.toThrow();
      await expect(plugin.setParameter('gain', 3.0)).rejects.toThrow();
    });

    test('should handle unknown parameters', async () => {
      await expect(plugin.setParameter('unknown', 123)).rejects.toThrow();

      const value = plugin.getParameter('unknown');
      expect(value).toBeUndefined();
    });

    test('should reset parameters to defaults', async () => {
      // Change some parameters
      await plugin.setParameter('gain', 1.5);
      await plugin.setParameter('enabled', false);

      // Reset
      await plugin.resetParameters();

      // Check defaults
      expect(plugin.getParameter('gain')).toBe(1.0);
      expect(plugin.getParameter('enabled')).toBe(true);
    });

    test('should save and load presets', async () => {
      // Set custom values
      await plugin.setParameter('gain', 1.8);
      await plugin.setParameter('frequency', 2000);
      await plugin.setParameter('enabled', false);

      // Save preset
      const preset = await plugin.savePreset('test-preset');

      expect(preset).toBeDefined();
      expect(preset.parameters).toBeDefined();
      const parameters = preset.parameters as Record<string, unknown>;
      expect(parameters.gain).toBe(1.8);
      expect(parameters.frequency).toBe(2000);
      expect(parameters.enabled).toBe(false);

      // Reset parameters
      await plugin.resetParameters();
      expect(plugin.getParameter('gain')).toBe(1.0);

      // Load preset
      await plugin.loadPreset(preset);
      expect(plugin.getParameter('gain')).toBe(1.8);
      expect(plugin.getParameter('frequency')).toBe(2000);
      expect(plugin.getParameter('enabled')).toBe(false);
    });
  });

  describe('Event System Behaviors', () => {
    beforeEach(async () => {
      await plugin.load();
    });

    test('should emit lifecycle events', async () => {
      const loadedHandler = vi.fn();
      const initializedHandler = vi.fn();
      const activatedHandler = vi.fn();

      plugin.on('loaded', loadedHandler);
      plugin.on('initialized', initializedHandler);
      plugin.on('activated', activatedHandler);

      await plugin.initialize(createMockAudioContext());
      await plugin.activate();

      expect(initializedHandler).toHaveBeenCalled();
      expect(activatedHandler).toHaveBeenCalled();
    });

    test('should support multiple event handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      plugin.on('initialized', handler1);
      plugin.on('initialized', handler2);
      plugin.on('initialized', handler3);

      await plugin.initialize(createMockAudioContext());

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
    });

    test('should remove event handlers', async () => {
      const handler = vi.fn();
      const unsubscribe = plugin.on('initialized', handler);

      unsubscribe();

      await plugin.initialize(createMockAudioContext());

      expect(handler).not.toHaveBeenCalled();
    });

    test('should handle error events', async () => {
      const errorHandler = vi.fn();
      plugin.on('error', errorHandler);

      // Simulate an error by trying invalid state transition
      try {
        await plugin.activate(); // Should fail without initialization
      } catch {
        // Expected error
      }

      expect(errorHandler).toHaveBeenCalled();
    });

    test('should clean up event handlers on disposal', async () => {
      const handler = vi.fn();
      plugin.on('activated', handler);

      await plugin.initialize(createMockAudioContext());
      await plugin.dispose();

      // Try to activate a new instance - shouldn't trigger old handlers
      try {
        await plugin.activate(); // Should fail without initialization
      } catch {
        // Expected error
      }

      expect(handler).not.toHaveBeenCalled();

      await plugin.dispose();
    });
  });

  describe('Audio Processing Behaviors', () => {
    beforeEach(async () => {
      await plugin.load();
      await plugin.initialize(createMockAudioContext());
      await plugin.activate();
    });

    test('should process audio buffers', async () => {
      const inputBuffer = createMockAudioBuffer();
      const outputBuffer = createMockAudioBuffer();
      const context = createMockAudioContext();

      const result = await plugin.process(inputBuffer, outputBuffer, context);

      expectValidProcessingResult(result);
      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
    });

    test('should handle different buffer sizes', async () => {
      const sizes = [128, 256, 512, 1024];
      const context = createMockAudioContext();

      for (const size of sizes) {
        const inputBuffer = createMockAudioBuffer(2, size);
        const outputBuffer = createMockAudioBuffer(2, size);

        const result = await plugin.process(inputBuffer, outputBuffer, context);

        expectValidProcessingResult(result);
        expect(outputBuffer.length).toBe(size);
      }
    });

    test('should handle multichannel audio', async () => {
      const channelCounts = [1, 2, 4, 8];
      const context = createMockAudioContext();

      for (const channels of channelCounts) {
        const inputBuffer = createMockAudioBuffer(channels);
        const outputBuffer = createMockAudioBuffer(channels);

        const result = await plugin.process(inputBuffer, outputBuffer, context);

        expectValidProcessingResult(result);
        expect(outputBuffer.numberOfChannels).toBe(channels);
      }
    });

    test('should report processing metrics', async () => {
      const inputBuffer = createMockAudioBuffer();
      const outputBuffer = createMockAudioBuffer();
      const context = createMockAudioContext();

      const result = await plugin.process(inputBuffer, outputBuffer, context);

      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(result.cpuUsage).toBeLessThanOrEqual(1);
      expect(result.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Tone.js Integration Behaviors', () => {
    beforeEach(async () => {
      await plugin.load();
      await plugin.initialize(createMockAudioContext());
    });

    test('should provide Tone.js node access', () => {
      const toneNode = plugin.getToneNode();

      // May be null if not using Tone.js
      if (toneNode) {
        expect(toneNode).toBeDefined();
        expect(typeof toneNode.connect).toBe('function');
        expect(typeof toneNode.disconnect).toBe('function');
      }
    });

    test('should connect to Tone.js destinations', () => {
      const mockDestination = mockEnvironment.mockToneNode as any;

      expect(() => plugin.connectToTone(mockDestination)).not.toThrow();
    });

    test('should disconnect from Tone.js destinations', () => {
      const mockDestination = mockEnvironment.mockToneNode as any;

      plugin.connectToTone(mockDestination);

      expect(() => plugin.disconnectFromTone()).not.toThrow();
    });
  });

  describe('N8n Integration Behaviors', () => {
    beforeEach(async () => {
      await plugin.load();
      await plugin.initialize(createMockAudioContext());
    });

    test('should process N8n payloads if supported', async () => {
      const mockPayload = {
        type: 'test-config',
        parameters: {
          gain: 1.5,
          frequency: 440,
        },
      };

      if (plugin.processN8nPayload) {
        await expect(
          plugin.processN8nPayload(mockPayload),
        ).resolves.not.toThrow();
      }
    });

    test('should load assets if supported', async () => {
      const mockAsset = createMockAudioBuffer();

      if (plugin.loadAsset) {
        await expect(
          plugin.loadAsset('test-asset', mockAsset),
        ).resolves.not.toThrow();
      }
    });

    test('should optimize for mobile if supported', async () => {
      if (plugin.optimizeForMobile) {
        await expect(plugin.optimizeForMobile()).resolves.not.toThrow();
      }
    });
  });

  describe('Error Handling Behaviors', () => {
    test('should handle load errors gracefully', async () => {
      // Create plugin that throws on load
      class FailingPlugin extends TestAudioPlugin {
        protected async onLoad(): Promise<void> {
          throw new Error('Load failed');
        }
      }

      const failingPlugin = new FailingPlugin();

      await expect(failingPlugin.load()).rejects.toThrow('Load failed');
      expect(failingPlugin.state).toBe(PluginState.ERROR);
    });

    test('should handle initialization errors gracefully', async () => {
      class FailingPlugin extends TestAudioPlugin {
        protected async onInitialize(
          _context: PluginAudioContext,
        ): Promise<void> {
          throw new Error('Initialize failed');
        }
      }

      const failingPlugin = new FailingPlugin();
      await failingPlugin.load();

      await expect(
        failingPlugin.initialize(createMockAudioContext()),
      ).rejects.toThrow('Initialize failed');
      expect(failingPlugin.state).toBe(PluginState.ERROR);
    });

    test('should handle activation errors gracefully', async () => {
      class FailingPlugin extends TestAudioPlugin {
        protected async onActivate(): Promise<void> {
          throw new Error('Activate failed');
        }
      }

      const failingPlugin = new FailingPlugin();
      await failingPlugin.load();
      await failingPlugin.initialize(createMockAudioContext());

      await expect(failingPlugin.activate()).rejects.toThrow('Activate failed');
      expect(failingPlugin.state).toBe(PluginState.ERROR);
    });

    test('should handle disposal errors gracefully', async () => {
      class FailingPlugin extends TestAudioPlugin {
        protected async onDispose(): Promise<void> {
          throw new Error('Dispose failed');
        }
      }

      const failingPlugin = new FailingPlugin();
      await failingPlugin.load();

      await expect(failingPlugin.dispose()).rejects.toThrow('Dispose failed');
      expect(failingPlugin.state).toBe(PluginState.ERROR);
    });

    test('should emit error events on failures', async () => {
      const errorHandler = vi.fn();
      plugin.on('error', errorHandler);

      // Force an error
      try {
        await plugin.activate(); // Will fail without initialization
      } catch {
        // Expected
      }

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Real-World Usage Scenarios', () => {
    test('should handle typical plugin lifecycle in audio application', async () => {
      const context = createMockAudioContext();

      // Application startup - load plugin
      await plugin.load();
      expect(plugin.state).toBe(PluginState.LOADED);

      // Initialize for audio context
      await plugin.initialize(context);
      expect(plugin.state).toBe(PluginState.INACTIVE);

      // Configure parameters
      await plugin.setParameter('gain', 0.8);
      await plugin.setParameter('frequency', 1000);

      // Start processing
      await plugin.activate();
      expect(plugin.state).toBe(PluginState.ACTIVE);

      // Process audio
      const inputBuffer = createMockAudioBuffer();
      const outputBuffer = createMockAudioBuffer();
      const result = await plugin.process(inputBuffer, outputBuffer, context);
      expectValidProcessingResult(result);

      // Change parameters during processing
      await plugin.setParameter('gain', 1.2);

      // Stop processing
      await plugin.deactivate();
      expect(plugin.state).toBe(PluginState.INACTIVE);

      // Application shutdown
      await plugin.dispose();
      expect(plugin.state).toBe(PluginState.UNLOADED);
    });

    test('should handle preset management workflow', async () => {
      await plugin.load();
      await plugin.initialize(createMockAudioContext());

      // Configure custom settings
      await plugin.setParameter('gain', 1.5);
      await plugin.setParameter('frequency', 2000);
      await plugin.setParameter('enabled', false);

      // Save as preset
      const rockPreset = await plugin.savePreset('rock-setting');

      // Configure different settings
      await plugin.setParameter('gain', 0.3);
      await plugin.setParameter('frequency', 100);
      await plugin.setParameter('enabled', true);

      // Save another preset
      const bassPreset = await plugin.savePreset('bass-setting');

      // Load rock preset
      await plugin.loadPreset(rockPreset);
      expect(plugin.getParameter('gain')).toBe(1.5);
      expect(plugin.getParameter('frequency')).toBe(2000);

      // Load bass preset
      await plugin.loadPreset(bassPreset);
      expect(plugin.getParameter('gain')).toBe(0.3);
      expect(plugin.getParameter('frequency')).toBe(100);
    });

    test('should handle rapid parameter changes', async () => {
      await plugin.load();
      await plugin.initialize(createMockAudioContext());
      await plugin.activate();

      // Rapid parameter automation
      const values = [0.1, 0.5, 1.0, 1.5, 0.8, 0.3];

      for (const value of values) {
        await plugin.setParameter('gain', value);
        expect(plugin.getParameter('gain')).toBe(value);
      }

      // Should have recorded all changes
      const changes = plugin.getTestState().parameterChanges;
      expect(changes.length).toBeGreaterThanOrEqual(values.length);
    });

    test('should handle concurrent operations safely', async () => {
      const context = createMockAudioContext();

      // Concurrent initialization and parameter setting
      const promises = [
        plugin.load(),
        plugin.load(), // Duplicate load
      ];

      await Promise.all(promises);
      expect(plugin.state).toBe(PluginState.LOADED);

      await plugin.initialize(context);
      await plugin.activate();

      // Concurrent parameter changes
      const parameterPromises = [
        plugin.setParameter('gain', 1.0),
        plugin.setParameter('frequency', 440),
        plugin.setParameter('enabled', true),
      ];

      await Promise.all(parameterPromises);

      expect(plugin.getParameter('gain')).toBe(1.0);
      expect(plugin.getParameter('frequency')).toBe(440);
      expect(plugin.getParameter('enabled')).toBe(true);
    });

    test('should handle graceful shutdown under load', async () => {
      await plugin.load();
      await plugin.initialize(createMockAudioContext());
      await plugin.activate();

      // Simulate heavy processing
      const processingPromises = [];
      for (let i = 0; i < 10; i++) {
        const inputBuffer = createMockAudioBuffer();
        const outputBuffer = createMockAudioBuffer();
        processingPromises.push(
          plugin.process(inputBuffer, outputBuffer, createMockAudioContext()),
        );
      }

      // Dispose while processing
      await plugin.dispose();

      expect(plugin.state).toBe(PluginState.UNLOADED);

      // Wait for any pending processing to complete
      await Promise.allSettled(processingPromises);
    });
  });
});
