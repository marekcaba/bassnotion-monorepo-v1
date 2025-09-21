/**
 * WAM Plugin Adapter Tests
 *
 * Comprehensive test suite for WAM plugin integration,
 * ensuring compatibility with BassNotion's track-based architecture
 * and timing precision requirements.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WamPluginAdapter } from '../WamPluginAdapter.js';
import type {
  WamDescriptor,
  WebAudioModule,
  WamNode,
} from '../../../../../types/wam.js';
import type { PluginAudioContext } from '../../../../../types/plugin.js';
import {
  PluginState,
  PluginCategory,
  ProcessingResultStatus,
} from '../../../../../types/plugin.js';
import { TransportAdapter } from '../../../../../services/core/TransportAdapter.js';
import { EventBus } from '../../../../../services/core/EventBus.js';
import { serviceRegistry } from '../../../../../services/core/ServiceRegistry.js';

// Mock dependencies
vi.mock('../../../../../services/core/TransportAdapter.js');
vi.mock('../../../../../services/core/EventBus.js');
vi.mock('../../../../../services/core/ServiceRegistry.js');
vi.mock('@bassnotion/contracts', () => ({
  createStructuredLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('WamPluginAdapter', () => {
  let adapter: WamPluginAdapter;
  let mockTransport: any;
  let mockEventBus: any;
  let mockWamConstructor: any;
  let mockWamInstance: any;
  let mockWamNode: any;

  const testDescriptor: WamDescriptor = {
    name: 'Test Plugin',
    vendor: 'Test Vendor',
    version: '1.0.0',
    sdkVersion: '2.0.0',
    thumbnail: '',
    keywords: ['test', 'synth'],
    isInstrument: true,
    website: 'https://test.com',
    hasAudioInput: true,
    hasAudioOutput: true,
    hasMidiInput: true,
    hasMidiOutput: false,
    supportsMpe: false,
  };

  const testUrl = '/test-plugin/index.js';

  beforeEach(() => {
    // Setup mocks
    mockTransport = {
      getInstance: vi.fn().mockReturnThis(),
      getTempo: vi.fn().mockReturnValue(120),
      getSampleRate: vi.fn().mockReturnValue(48000),
      isPlaying: vi.fn().mockReturnValue(false),
      musicalPositionToSeconds: vi.fn((pos) => pos.bars * 2),
      on: vi.fn(),
      off: vi.fn(),
    };

    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    mockWamNode = {
      getParameterInfo: vi.fn().mockResolvedValue({
        gain: {
          label: 'Gain',
          type: 'float',
          defaultValue: 0.5,
          minValue: 0,
          maxValue: 1,
          discreteStep: 0.01,
        },
        frequency: {
          label: 'Frequency',
          type: 'float',
          defaultValue: 440,
          minValue: 20,
          maxValue: 20000,
          units: 'Hz',
        },
      }),
      getCompensationDelay: vi.fn().mockResolvedValue(128),
      setParameterValues: vi.fn().mockResolvedValue(undefined),
      getParameterValues: vi
        .fn()
        .mockResolvedValue({ gain: 0.5, frequency: 440 }),
      getState: vi
        .fn()
        .mockResolvedValue({ parameterValues: {}, internalState: {} }),
      setState: vi.fn().mockResolvedValue(undefined),
      scheduleEvents: vi.fn(),
      clearEvents: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    mockWamInstance = {
      audioContext: {},
      audioNode: mockWamNode,
      createAudioNode: vi.fn().mockResolvedValue(mockWamNode),
      createGui: vi.fn().mockResolvedValue(document.createElement('div')),
      destroyGui: vi.fn(),
    };

    mockWamConstructor = {
      isWebAudioModuleConstructor: true,
      createInstance: vi.fn().mockResolvedValue(mockWamInstance),
    };

    // Setup service registry
    vi.mocked(serviceRegistry.get).mockImplementation((name) => {
      if (name === 'eventBus') return mockEventBus;
      throw new Error(`Service not found: ${name}`);
    });

    vi.mocked(TransportAdapter.getInstance).mockReturnValue(mockTransport);

    // Create adapter
    adapter = new WamPluginAdapter(testUrl, testDescriptor);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create adapter with correct metadata', () => {
      expect(adapter.metadata.name).toBe('Test Plugin');
      expect(adapter.metadata.vendor).toBe('Test Vendor');
      expect(adapter.metadata.category).toBe(PluginCategory.INSTRUMENT);
      expect(adapter.metadata.tags).toContain('test');
      expect(adapter.metadata.tags).toContain('synth');
    });

    it('should initialize with correct config', () => {
      expect(adapter.config.id).toBe('wam-test-vendor-test-plugin');
      expect(adapter.config.name).toBe('Test Plugin');
      expect(adapter.config.version).toBe('1.0.0');
      expect(adapter.config.enabled).toBe(true);
      expect(adapter.config.category).toBe(PluginCategory.INSTRUMENT);
    });

    it('should set capabilities from descriptor', () => {
      expect(adapter.capabilities.supportsAudioWorklet).toBe(true);
      expect(adapter.capabilities.supportsMIDI).toBe(true);
      expect(adapter.capabilities.supportsAutomation).toBe(true);
      expect(adapter.capabilities.supportsPresets).toBe(true);
    });
  });

  describe('lifecycle', () => {
    it('should load plugin module', async () => {
      // Mock dynamic import
      vi.doMock(testUrl, () => ({ default: mockWamConstructor }));

      await adapter.load();

      expect(adapter.state).toBe(PluginState.LOADED);
    });

    it('should initialize with audio context', async () => {
      // Load first
      vi.doMock(testUrl, () => ({ default: mockWamConstructor }));
      await adapter.load();

      // Initialize
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };

      await adapter.initialize(context);

      expect(mockWamConstructor.createInstance).toHaveBeenCalled();
      expect(mockWamInstance.createAudioNode).toHaveBeenCalled();
      expect(adapter.state).toBe(PluginState.ACTIVE);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'wam:initialized',
        expect.any(Object),
      );
    });

    it('should handle activation and deactivation', async () => {
      // Setup
      vi.doMock(testUrl, () => ({ default: mockWamConstructor }));
      await adapter.load();
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };
      await adapter.initialize(context);

      // Deactivate
      await adapter.deactivate();
      expect(adapter.state).toBe(PluginState.INACTIVE);
      expect(adapter.config.enabled).toBe(false);
      expect(mockWamNode.clearEvents).toHaveBeenCalled();

      // Activate
      await adapter.activate();
      expect(adapter.state).toBe(PluginState.ACTIVE);
      expect(adapter.config.enabled).toBe(true);
    });

    it('should dispose properly', async () => {
      // Setup
      vi.doMock(testUrl, () => ({ default: mockWamConstructor }));
      await adapter.load();
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };
      await adapter.initialize(context);

      // Dispose
      await adapter.dispose();

      expect(mockWamNode.destroy).toHaveBeenCalled();
      expect(adapter.state).toBe(PluginState.UNLOADED);
    });
  });

  describe('parameter management', () => {
    beforeEach(async () => {
      // Setup adapter in active state
      vi.doMock(testUrl, () => ({ default: mockWamConstructor }));
      await adapter.load();
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };
      await adapter.initialize(context);
    });

    it('should create parameter mappings', () => {
      expect(adapter.parameters.size).toBe(2);
      expect(adapter.parameters.has('gain')).toBe(true);
      expect(adapter.parameters.has('frequency')).toBe(true);

      const gainParam = adapter.parameters.get('gain');
      expect(gainParam?.name).toBe('Gain');
      expect(gainParam?.min).toBe(0);
      expect(gainParam?.max).toBe(1);
      expect(gainParam?.defaultValue).toBe(0.5);
    });

    it('should set parameter values', async () => {
      await adapter.setParameter('gain', 0.75);

      expect(mockWamNode.setParameterValues).toHaveBeenCalledWith({
        gain: 0.75,
      });

      const param = adapter.parameters.get('gain');
      expect(param?.defaultValue).toBe(0.75);
    });

    it('should get parameter values', () => {
      const value = adapter.getParameter('gain');
      expect(value).toBe(0.5);
    });

    it('should reset parameters', async () => {
      await adapter.resetParameters();

      expect(mockWamNode.setParameterValues).toHaveBeenCalledWith({
        gain: 0.5,
        frequency: 440,
      });
    });
  });

  describe('audio processing', () => {
    beforeEach(async () => {
      vi.doMock(testUrl, () => ({ default: mockWamConstructor }));
      await adapter.load();
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };
      await adapter.initialize(context);
    });

    it('should process audio and return metrics', async () => {
      const inputBuffer = new AudioBuffer({ length: 128, sampleRate: 48000 });
      const outputBuffer = new AudioBuffer({ length: 128, sampleRate: 48000 });
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };

      const result = await adapter.process(inputBuffer, outputBuffer, context);

      expect(result.success).toBe(true);
      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
      expect(result.processedSamples).toBe(128);
      expect(result.metadata?.wamLatency).toBe(128);
    });

    it('should handle bypass mode', async () => {
      adapter.config.bypassMode = true;

      const inputBuffer = new AudioBuffer({ length: 128, sampleRate: 48000 });
      const outputBuffer = new AudioBuffer({ length: 128, sampleRate: 48000 });
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };

      const result = await adapter.process(inputBuffer, outputBuffer, context);

      expect(result.status).toBe(ProcessingResultStatus.BYPASSED);
      expect(result.bypassMode).toBe(true);
    });
  });

  describe('automation and scheduling', () => {
    beforeEach(async () => {
      vi.doMock(testUrl, () => ({ default: mockWamConstructor }));
      await adapter.load();
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };
      await adapter.initialize(context);
    });

    it('should schedule automation events', () => {
      const position = { bars: 2, beats: 0, sixteenths: 0, ticks: 0 };

      adapter.scheduleAutomation('gain', 0.8, position);

      expect(mockWamNode.scheduleEvents).toHaveBeenCalledWith({
        type: 'wam-automation',
        time: 4, // 2 bars * 2 seconds per bar
        data: {
          id: 'gain',
          value: 0.8,
          normalized: false,
        },
      });
    });

    it('should schedule MIDI events', () => {
      const position = { bars: 1, beats: 0, sixteenths: 0, ticks: 0 };
      const midiData = new Uint8Array([0x90, 60, 127]); // Note On C4

      adapter.scheduleMidiEvent(midiData, position);

      expect(mockWamNode.scheduleEvents).toHaveBeenCalledWith({
        type: 'wam-midi',
        time: 2,
        data: {
          bytes: midiData,
        },
      });
    });
  });

  describe('transport synchronization', () => {
    beforeEach(async () => {
      vi.doMock(testUrl, () => ({ default: mockWamConstructor }));
      await adapter.load();
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };
      await adapter.initialize(context);
    });

    it('should sync with transport position', async () => {
      await adapter.activate();

      // Simulate transport position update
      const positionHandler = mockTransport.on.mock.calls.find(
        (call) => call[0] === 'position',
      )?.[1];

      const position = {
        bars: 4,
        beats: 2,
        sixteenths: 0,
        ticks: 0,
        seconds: 8.5,
      };

      positionHandler(position);

      expect(mockWamNode.scheduleEvents).toHaveBeenCalledWith({
        type: 'wam-transport',
        time: 8.5,
        data: {
          playing: false,
          recording: false,
          hostBpm: 120,
          hostCurrentBar: 4,
          hostCurrentBarStarted: expect.any(Number),
          hostSampleRate: 48000,
          hostBlockSize: 128,
        },
      });
    });

    it('should clear events on transport stop', async () => {
      await adapter.activate();

      const stateHandler = mockTransport.on.mock.calls.find(
        (call) => call[0] === 'stateChange',
      )?.[1];

      stateHandler('stopped');

      expect(mockWamNode.clearEvents).toHaveBeenCalled();
    });
  });

  describe('preset management', () => {
    beforeEach(async () => {
      vi.doMock(testUrl, () => ({ default: mockWamConstructor }));
      await adapter.load();
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };
      await adapter.initialize(context);
    });

    it('should save presets', async () => {
      const preset = await adapter.savePreset('My Preset');

      expect(preset.name).toBe('My Preset');
      expect(preset.wamState).toBeDefined();
      expect(preset.parameterValues).toBeDefined();
      expect(preset.metadata.pluginId).toBe(adapter.config.id);
    });

    it('should load presets', async () => {
      const preset = {
        name: 'Test Preset',
        wamState: { test: true },
        parameterValues: { gain: 0.9, frequency: 880 },
      };

      await adapter.loadPreset(preset);

      expect(mockWamNode.setState).toHaveBeenCalledWith({ test: true });
      expect(mockWamNode.setParameterValues).toHaveBeenCalledWith({
        gain: 0.9,
        frequency: 880,
      });
    });
  });

  describe('GUI management', () => {
    beforeEach(async () => {
      vi.doMock(testUrl, () => ({ default: mockWamConstructor }));
      await adapter.load();
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };
      await adapter.initialize(context);
    });

    it('should create GUI element', async () => {
      const gui = await adapter.createGui();

      expect(gui).toBeInstanceOf(HTMLElement);
      expect(mockWamInstance.createGui).toHaveBeenCalled();
    });

    it('should destroy GUI element', () => {
      const gui = document.createElement('div');

      adapter.destroyGui(gui);

      expect(mockWamInstance.destroyGui).toHaveBeenCalledWith(gui);
    });
  });

  describe('error handling', () => {
    it('should handle load failures', async () => {
      vi.doMock(testUrl, () => {
        throw new Error('Module not found');
      });

      await expect(adapter.load()).rejects.toThrow('Failed to load WAM plugin');
      expect(adapter.state).toBe(PluginState.ERROR);
    });

    it('should handle initialization failures', async () => {
      vi.doMock(testUrl, () => ({ default: mockWamConstructor }));
      await adapter.load();

      mockWamConstructor.createInstance.mockRejectedValue(
        new Error('Init failed'),
      );

      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };

      await expect(adapter.initialize(context)).rejects.toThrow(
        'Failed to initialize WAM plugin',
      );
      expect(adapter.state).toBe(PluginState.ERROR);
    });

    it('should validate state transitions', async () => {
      // Try to initialize before loading
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };

      await expect(adapter.initialize(context)).rejects.toThrow(
        'Plugin must be loaded before initialization',
      );
    });
  });

  describe('performance tracking', () => {
    beforeEach(async () => {
      vi.doMock(testUrl, () => ({ default: mockWamConstructor }));
      await adapter.load();
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };
      await adapter.initialize(context);
    });

    it('should track processing time', async () => {
      const inputBuffer = new AudioBuffer({ length: 128, sampleRate: 48000 });
      const outputBuffer = new AudioBuffer({ length: 128, sampleRate: 48000 });
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };

      const result = await adapter.process(inputBuffer, outputBuffer, context);

      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(result.cpuUsage).toBeLessThanOrEqual(1);
    });
  });

  describe('latency reporting', () => {
    beforeEach(async () => {
      vi.doMock(testUrl, () => ({ default: mockWamConstructor }));
      await adapter.load();
      const context: PluginAudioContext = {
        audioContext: new AudioContext(),
        sampleRate: 48000,
        bufferSize: 128,
        currentTime: 0,
      };
      await adapter.initialize(context);
    });

    it('should report plugin latency', () => {
      const info = adapter.getWamInfo();

      expect(info.latency).toBe(128);
      expect(info.descriptor).toEqual(testDescriptor);
      expect(info.instance).toBe(mockWamInstance);
      expect(info.node).toBe(mockWamNode);
    });
  });
});
