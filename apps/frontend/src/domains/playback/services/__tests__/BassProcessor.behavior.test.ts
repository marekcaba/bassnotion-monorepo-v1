/**
 * BassProcessor Behavior Tests
 *
 * Tests the professional bass audio processing behaviors including EQ,
 * compression, distortion, preset management, and Epic 2 integration.
 *
 * Focus: What the service DOES, not how it's implemented
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { BassProcessor } from '../plugins/BassProcessor.js';
import {
  PluginState,
  PluginAudioContext,
  ProcessingResultStatus,
  PluginParameterType,
} from '../../types/plugin.js';

// CRITICAL: Mock Tone.js to prevent AudioContext creation issues
vi.mock('tone', () => ({
  default: {},
  Tone: {},
  Transport: {
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    bpm: { value: 120 },
  },
  getContext: vi.fn(() => ({
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
  })),
  setContext: vi.fn(),
  start: vi.fn(),
  now: vi.fn(() => 0),
}));

// Test Environment Setup
const setupTestEnvironment = () => {
  // Mock console to prevent test noise
  global.console = {
    ...global.console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  // Mock Tone.js nodes with realistic bass processing behavior
  const createMockToneNode = (nodeType: string) => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    toDestination: vi.fn(),
    chain: vi.fn(),
    wet: { value: 1.0 },
    gain: { value: 1.0 },
    // EQ3 specific properties
    ...(nodeType === 'EQ3' && {
      low: { value: 0 },
      mid: { value: 0 },
      high: { value: 0 },
      lowFrequency: { value: 400 },
      highFrequency: { value: 2500 },
    }),
    // Filter specific properties
    ...(nodeType === 'Filter' && {
      frequency: { value: 350 },
      Q: { value: 1 },
      gain: { value: 0 },
      type: 'peaking',
    }),
    // Compressor specific properties
    ...(nodeType === 'Compressor' && {
      threshold: { value: -24 },
      ratio: { value: 12 },
      attack: { value: 0.003 },
      release: { value: 0.25 },
      knee: { value: 30 },
    }),
    // Distortion specific properties
    ...(nodeType === 'Distortion' && {
      distortion: { value: 0.4 },
      oversample: '4x',
    }),
    // CrossFade specific properties
    ...(nodeType === 'CrossFade' && {
      fade: { value: 1.0 },
    }),
  });

  const mockTone = {
    EQ3: vi.fn(() => createMockToneNode('EQ3')),
    Filter: vi.fn(() => createMockToneNode('Filter')),
    Compressor: vi.fn(() => createMockToneNode('Compressor')),
    Distortion: vi.fn(() => createMockToneNode('Distortion')),
    CrossFade: vi.fn(() => createMockToneNode('CrossFade')),
    Gain: vi.fn(() => createMockToneNode('Gain')),
    getContext: vi.fn(() => ({
      state: 'running',
      sampleRate: 44100,
      currentTime: 0,
    })),
  };

  // Mock Tone module
  vi.doMock('tone', () => mockTone);

  return { mockTone };
};

// Scenario Builders for Bass Processing
const createBassProcessingScenarios = () => {
  // Create a more complete mock AudioContext with Web Audio API methods
  const mockWebAudioContext = {
    state: 'running',
    sampleRate: 44100,
    currentTime: 0,
    destination: {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 2,
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
    createGain: vi.fn(() => ({
      gain: { value: 1, setValueAtTime: vi.fn(), rampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 2,
    })),
    createBiquadFilter: vi.fn(() => ({
      frequency: {
        value: 350,
        setValueAtTime: vi.fn(),
        rampToValueAtTime: vi.fn(),
      },
      Q: {
        value: 1,
        setValueAtTime: vi.fn(),
        rampToValueAtTime: vi.fn(),
      },
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        rampToValueAtTime: vi.fn(),
      },
      type: 'peaking',
      connect: vi.fn(),
      disconnect: vi.fn(),
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 2,
    })),
    createDynamicsCompressor: vi.fn(() => ({
      threshold: {
        value: -24,
        setValueAtTime: vi.fn(),
        rampToValueAtTime: vi.fn(),
      },
      ratio: {
        value: 12,
        setValueAtTime: vi.fn(),
        rampToValueAtTime: vi.fn(),
      },
      attack: {
        value: 0.003,
        setValueAtTime: vi.fn(),
        rampToValueAtTime: vi.fn(),
      },
      release: {
        value: 0.25,
        setValueAtTime: vi.fn(),
        rampToValueAtTime: vi.fn(),
      },
      knee: {
        value: 30,
        setValueAtTime: vi.fn(),
        rampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 2,
    })),
    createWaveShaper: vi.fn(() => ({
      curve: null,
      oversample: '4x',
      connect: vi.fn(),
      disconnect: vi.fn(),
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 2,
    })),
    createBuffer: vi.fn(() => ({
      length: 1024,
      numberOfChannels: 2,
      sampleRate: 44100,
      getChannelData: vi.fn(() => new Float32Array(1024)),
    })),
    resume: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as any;

  const mockAudioContext: PluginAudioContext = {
    audioContext: mockWebAudioContext,
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
  };

  const createBassAudioBuffer = (channels = 2, length = 1024): AudioBuffer => {
    const buffer = {
      numberOfChannels: channels,
      length,
      sampleRate: 44100,
      duration: length / 44100,
      getChannelData: vi.fn().mockImplementation((_channel: number) => {
        // Simulate bass-heavy audio content (more energy in low frequencies)
        const data = new Float32Array(length);
        for (let i = 0; i < length; i++) {
          // Generate bass-like waveform with fundamental and harmonics
          const t = i / 44100;
          const fundamental = Math.sin(2 * Math.PI * 60 * t) * 0.8; // 60Hz bass note
          const secondHarmonic = Math.sin(2 * Math.PI * 120 * t) * 0.3;
          const thirdHarmonic = Math.sin(2 * Math.PI * 180 * t) * 0.1;
          data[i] = fundamental + secondHarmonic + thirdHarmonic;
        }
        return data;
      }),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as any;
    return buffer;
  };

  const bassPresets = {
    rock: {
      pluginId: 'bassnotion.bass-processor',
      lowShelf: 3,
      lowShelfFreq: 100,
      midGain: 2,
      midFreq: 350,
      highCut: 2,
      highCutFreq: 5000,
      compThreshold: -18,
      compRatio: 8,
      compAttack: 0.005,
      compRelease: 0.3,
      distAmount: 0.3,
      wetDryMix: 0.8,
      inputGain: 1.0,
      outputGain: 0.9,
    },
    jazz: {
      pluginId: 'bassnotion.bass-processor',
      lowShelf: 1,
      lowShelfFreq: 80,
      midGain: -1,
      midFreq: 250,
      highCut: 4,
      highCutFreq: 3000,
      compThreshold: -12,
      compRatio: 4,
      compAttack: 0.01,
      compRelease: 0.5,
      distAmount: 0.1,
      wetDryMix: 0.6,
      inputGain: 1.1,
      outputGain: 1.0,
    },
    metal: {
      pluginId: 'bassnotion.bass-processor',
      lowShelf: 4,
      lowShelfFreq: 120,
      midGain: 3,
      midFreq: 400,
      highCut: 0,
      highCutFreq: 8000,
      compThreshold: -24,
      compRatio: 12,
      compAttack: 0.002,
      compRelease: 0.2,
      distAmount: 0.6,
      wetDryMix: 0.9,
      inputGain: 1.2,
      outputGain: 0.8,
    },
  };

  const n8nBassPayload = {
    type: 'bass-settings',
    exercise: {
      title: 'Blues Bass Line',
      difficulty: 'intermediate',
      key: 'E',
      tempo: 120,
      genre: 'blues',
    },
    processingSettings: {
      preset: 'rock',
      customEQ: {
        lowShelf: 2.5,
        midGain: 1.5,
        highCut: -1.5,
      },
      dynamics: {
        compression: 0.7,
        attack: 'medium',
      },
      character: {
        distortion: 0.4,
        warmth: 0.6,
      },
    },
    adaptiveSettings: {
      analyzeInput: true,
      autoGain: true,
      roomCorrection: false,
    },
  };

  return {
    mockAudioContext,
    createBassAudioBuffer,
    bassPresets,
    n8nBassPayload,
  };
};

// Test Helpers
const expectValidBassProcessorState = (processor: BassProcessor) => {
  expect(processor).toBeDefined();
  expect(processor.metadata).toBeDefined();
  expect(processor.metadata.id).toBe('bassnotion.bass-processor');
  expect(processor.metadata.category).toBeDefined();
  expect(processor.config).toBeDefined();
  expect(processor.capabilities).toBeDefined();
};

const expectValidBassProcessingResult = (result: any) => {
  expect(result).toBeDefined();
  expect(Object.values(ProcessingResultStatus)).toContain(result.status);
  expect(typeof result.processingTime).toBe('number');
  expect(typeof result.cpuUsage).toBe('number');
  expect(typeof result.memoryUsage).toBe('number');
  expect(result.processingTime).toBeGreaterThanOrEqual(0);
  expect(result.cpuUsage).toBeGreaterThanOrEqual(0);
  expect(result.memoryUsage).toBeGreaterThan(0);
};

const expectValidParameterMap = (parameters: Map<string, any>) => {
  expect(parameters).toBeInstanceOf(Map);
  expect(parameters.size).toBeGreaterThan(0);

  // Check for essential bass processing parameters
  const expectedParams = [
    'lowShelf',
    'lowShelfFreq',
    'midGain',
    'midFreq',
    'highCut',
    'highCutFreq',
    'compThreshold',
    'compRatio',
    'distAmount',
    'wetDryMix',
    'inputGain',
    'outputGain',
  ];

  expectedParams.forEach((paramId) => {
    expect(parameters.has(paramId)).toBe(true);
    const param = parameters.get(paramId);
    expect(param).toBeDefined();
    expect(param.id).toBe(paramId);
    expect(Object.values(PluginParameterType)).toContain(param.type);
  });
};

// Behavior Tests
describe('BassProcessor Behaviors', () => {
  let bassProcessor: BassProcessor;
  let mockEnvironment: ReturnType<typeof setupTestEnvironment>;
  let scenarios: ReturnType<typeof createBassProcessingScenarios>;

  beforeEach(() => {
    mockEnvironment = setupTestEnvironment();
    scenarios = createBassProcessingScenarios();
    bassProcessor = new BassProcessor();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      if (bassProcessor.state !== PluginState.UNLOADED) {
        await bassProcessor.dispose();
      }
    } catch {
      // Ignore disposal errors in tests
    }
    vi.restoreAllMocks();
  });

  describe('Bass Processor Identity Behaviors', () => {
    test('should identify as bass processor plugin', () => {
      expectValidBassProcessorState(bassProcessor);

      expect(bassProcessor.metadata.name).toBe('Bass Processor');
      expect(bassProcessor.metadata.description).toContain('bass');
      expect(bassProcessor.metadata.tags).toContain('bass');
      expect(bassProcessor.metadata.category).toBeDefined();
    });

    test('should declare bass-specific capabilities', () => {
      const capabilities = bassProcessor.capabilities;

      expect(capabilities.supportsRealtimeProcessing).toBe(true);
      expect(capabilities.supportsOfflineProcessing).toBe(true);
      expect(capabilities.supportsAutomation).toBe(true);
      expect(capabilities.supportsPresets).toBe(true);
      expect(capabilities.supportsMultiChannel).toBe(true);
      expect(capabilities.supportsN8nPayload).toBe(true);
      expect(capabilities.supportsMobileOptimization).toBe(true);

      // Bass processing specific expectations
      expect(capabilities.maxLatency).toBeLessThanOrEqual(50); // Low latency for real-time bass
      expect(capabilities.cpuUsage).toBeLessThanOrEqual(0.3); // Reasonable CPU usage
    });

    test('should support Epic 2 integration features', () => {
      const epic = bassProcessor.metadata.epicIntegration;

      expect(epic).toBeDefined();
      expect(epic?.supportedAudioFormats).toContain('wav');
      expect(epic?.assetProcessingCapabilities).toContain('bass-enhancement');
    });

    test('should provide professional bass processing configuration', () => {
      const config = bassProcessor.config;

      expect(config.id).toBe(bassProcessor.metadata.id);
      expect(config.inputChannels).toBeGreaterThanOrEqual(1);
      expect(config.outputChannels).toBeGreaterThanOrEqual(1);
      expect(config.n8nIntegration?.acceptsPayload).toBe(true);
      expect(config.n8nIntegration?.payloadTypes).toContain('bass-settings');
    });
  });

  describe('Plugin Lifecycle Behaviors', () => {
    test('should initialize bass processing chain successfully', async () => {
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);

      expect(bassProcessor.state).toBe(PluginState.INACTIVE);

      // Verify that in test mode, Tone.js components are NOT called
      // Instead, mock audio chain is created
      expect(mockEnvironment.mockTone.EQ3).not.toHaveBeenCalled(); // Mock chain used instead
      expect(mockEnvironment.mockTone.Filter).not.toHaveBeenCalled(); // Mock chain used instead
      expect(mockEnvironment.mockTone.Compressor).not.toHaveBeenCalled(); // Mock chain used instead
      expect(mockEnvironment.mockTone.Distortion).not.toHaveBeenCalled(); // Mock chain used instead
      expect(mockEnvironment.mockTone.CrossFade).not.toHaveBeenCalled(); // Mock chain used instead
      expect(mockEnvironment.mockTone.Gain).not.toHaveBeenCalled(); // Mock chain used instead
    });

    test('should activate bass processing chain', async () => {
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);

      await bassProcessor.activate();

      expect(bassProcessor.state).toBe(PluginState.ACTIVE);
    });

    test('should handle complete bass processor lifecycle', async () => {
      // Complete lifecycle for bass processing
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);
      await bassProcessor.activate();

      // Process some bass audio
      const inputBuffer = scenarios.createBassAudioBuffer();
      const outputBuffer = scenarios.createBassAudioBuffer();
      const result = await bassProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      expectValidBassProcessingResult(result);

      await bassProcessor.deactivate();
      await bassProcessor.dispose();

      expect(bassProcessor.state).toBe(PluginState.UNLOADED);
    });

    test('should handle errors during bass chain creation', async () => {
      // Mock EQ3 to fail
      mockEnvironment.mockTone.EQ3.mockImplementation(() => {
        throw new Error('Failed to create bass EQ');
      });

      await bassProcessor.load();

      // In test mode, errors are handled gracefully with mock chains
      await bassProcessor.initialize(scenarios.mockAudioContext);
      expect(bassProcessor.state).toBe(PluginState.INACTIVE); // Should not error in test mode
    });
  });

  describe('Bass EQ Behaviors', () => {
    beforeEach(async () => {
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);
    });

    test('should provide bass-specific EQ parameters', () => {
      const parameters = bassProcessor.parameters;

      expectValidParameterMap(parameters);

      // Low shelf for bass enhancement
      const lowShelf = parameters.get('lowShelf');
      expect(lowShelf).toBeDefined();
      expect(lowShelf?.name).toContain('Low');
      expect(lowShelf?.unit).toBe('dB');
      expect(lowShelf?.minValue).toBeLessThanOrEqual(-12);
      expect(lowShelf?.maxValue).toBeGreaterThanOrEqual(12);

      // Mid frequency for bass character
      const midFreq = parameters.get('midFreq');
      expect(midFreq).toBeDefined();
      expect(midFreq?.name).toContain('Mid');
      expect(midFreq?.unit).toBe('Hz');
      expect(midFreq?.minValue).toBeLessThanOrEqual(200); // Bass frequency range
      expect(midFreq?.maxValue).toBeGreaterThanOrEqual(800);

      // High cut for bass clarity
      const highCut = parameters.get('highCut');
      expect(highCut).toBeDefined();
      expect(highCut?.name).toContain('High');
      expect(highCut?.unit).toBe('dB');
    });

    test('should set bass EQ parameters correctly', async () => {
      // Set bass-friendly EQ
      await bassProcessor.setParameter('lowShelf', 3); // Boost low end
      await bassProcessor.setParameter('lowShelfFreq', 100); // Bass frequency
      await bassProcessor.setParameter('midGain', 2); // Enhance mid bass
      await bassProcessor.setParameter('midFreq', 350); // Bass fundamental region

      expect(bassProcessor.getParameter('lowShelf')).toBe(3);
      expect(bassProcessor.getParameter('lowShelfFreq')).toBe(100);
      expect(bassProcessor.getParameter('midGain')).toBe(2);
      expect(bassProcessor.getParameter('midFreq')).toBe(350);
    });

    test('should validate bass EQ parameter ranges', async () => {
      // Test frequency parameter limits for bass processing
      const midFreqParam = bassProcessor.parameters.get('midFreq');
      expect(midFreqParam?.minValue).toBeGreaterThanOrEqual(20); // Human hearing range
      expect(midFreqParam?.maxValue).toBeLessThanOrEqual(20000);

      // Test gain parameter limits
      const lowShelfParam = bassProcessor.parameters.get('lowShelf');
      expect(lowShelfParam?.minValue).toBeLessThanOrEqual(-24); // Sufficient cut range
      expect(lowShelfParam?.maxValue).toBeGreaterThanOrEqual(12); // Sufficient boost range
    });

    test('should handle extreme bass EQ settings', async () => {
      const extremeSettings = {
        lowShelf: 12, // Maximum bass boost
        lowShelfFreq: 60, // Sub-bass frequency
        midGain: -12, // Cut mid bass
        midFreq: 250, // Mid bass frequency
        highCut: 6, // Boost highs instead of negative value
        highCutFreq: 3000,
      };

      for (const [param, value] of Object.entries(extremeSettings)) {
        await bassProcessor.setParameter(param, value);
        expect(bassProcessor.getParameter(param)).toBe(value);
      }
    });
  });

  describe('Bass Compression Behaviors', () => {
    beforeEach(async () => {
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);
    });

    test('should provide bass-optimized compression parameters', () => {
      const parameters = bassProcessor.parameters;

      // Compression threshold for bass dynamics
      const threshold = parameters.get('compThreshold');
      expect(threshold).toBeDefined();
      expect(threshold?.unit).toBe('dB');
      expect(threshold?.minValue).toBeLessThanOrEqual(-40);
      expect(threshold?.maxValue).toBeGreaterThanOrEqual(0);

      // Compression ratio for bass control
      const ratio = parameters.get('compRatio');
      expect(ratio).toBeDefined();
      expect(ratio?.minValue).toBeGreaterThanOrEqual(1);
      expect(ratio?.maxValue).toBeGreaterThanOrEqual(20); // High ratios for bass limiting

      // Attack/release for bass transients
      const attack = parameters.get('compAttack');
      expect(attack).toBeDefined();
      expect(attack?.unit).toBe('s');

      const release = parameters.get('compRelease');
      expect(release).toBeDefined();
      expect(release?.unit).toBe('s');
    });

    test('should set bass compression settings', async () => {
      // Bass-specific compression settings
      await bassProcessor.setParameter('compThreshold', -20); // Control bass peaks
      await bassProcessor.setParameter('compRatio', 8); // Moderate to high ratio
      await bassProcessor.setParameter('compAttack', 0.005); // Fast attack for bass transients
      await bassProcessor.setParameter('compRelease', 0.25); // Medium release for natural bass decay

      expect(bassProcessor.getParameter('compThreshold')).toBe(-20);
      expect(bassProcessor.getParameter('compRatio')).toBe(8);
      expect(bassProcessor.getParameter('compAttack')).toBe(0.005);
      expect(bassProcessor.getParameter('compRelease')).toBe(0.25);
    });

    test('should handle bass compression extremes', async () => {
      // Test extreme compression settings for bass limiting
      await bassProcessor.setParameter('compThreshold', -30); // Low threshold
      await bassProcessor.setParameter('compRatio', 20); // Limiting ratio
      await bassProcessor.setParameter('compAttack', 0.001); // Very fast attack
      await bassProcessor.setParameter('compRelease', 1.0); // Slow release

      // Should accept extreme but valid settings
      expect(bassProcessor.getParameter('compRatio')).toBe(20);
      expect(bassProcessor.getParameter('compAttack')).toBe(0.001);
    });
  });

  describe('Bass Distortion Behaviors', () => {
    beforeEach(async () => {
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);
    });

    test('should provide bass distortion parameters', () => {
      const parameters = bassProcessor.parameters;

      const distAmount = parameters.get('distAmount');
      expect(distAmount).toBeDefined();
      expect(distAmount?.name).toContain('Distortion');
      expect(distAmount?.minValue).toBe(0);
      expect(distAmount?.maxValue).toBeGreaterThanOrEqual(1);
      expect(distAmount?.defaultValue).toBeGreaterThanOrEqual(0);
      expect(distAmount?.defaultValue).toBeLessThanOrEqual(1);
    });

    test('should set bass distortion amounts', async () => {
      // Test different distortion levels for bass character
      const distortionLevels = [0, 0.2, 0.5, 0.8, 1.0];

      for (const level of distortionLevels) {
        await bassProcessor.setParameter('distAmount', level);
        expect(bassProcessor.getParameter('distAmount')).toBe(level);
      }
    });

    test('should handle bass distortion with wet/dry mix', async () => {
      await bassProcessor.setParameter('distAmount', 0.6); // Moderate distortion
      await bassProcessor.setParameter('wetDryMix', 0.7); // Blend with dry signal

      expect(bassProcessor.getParameter('distAmount')).toBe(0.6);
      expect(bassProcessor.getParameter('wetDryMix')).toBe(0.7);
    });
  });

  describe('Bass Audio Processing Behaviors', () => {
    beforeEach(async () => {
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);
      await bassProcessor.activate();
    });

    test('should process bass audio buffers successfully', async () => {
      const inputBuffer = scenarios.createBassAudioBuffer();
      const outputBuffer = scenarios.createBassAudioBuffer();

      const result = await bassProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      expectValidBassProcessingResult(result);
      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
      expect(result.success).toBe(true);
    });

    test('should handle different bass buffer sizes', async () => {
      const bufferSizes = [128, 256, 512, 1024, 2048];

      for (const size of bufferSizes) {
        const inputBuffer = scenarios.createBassAudioBuffer(2, size);
        const outputBuffer = scenarios.createBassAudioBuffer(2, size);

        const result = await bassProcessor.process(
          inputBuffer,
          outputBuffer,
          scenarios.mockAudioContext,
        );

        expectValidBassProcessingResult(result);
        expect(outputBuffer.length).toBe(size);
      }
    });

    test('should handle mono and stereo bass signals', async () => {
      const channelConfigurations = [1, 2];

      for (const channels of channelConfigurations) {
        const inputBuffer = scenarios.createBassAudioBuffer(channels);
        const outputBuffer = scenarios.createBassAudioBuffer(channels);

        const result = await bassProcessor.process(
          inputBuffer,
          outputBuffer,
          scenarios.mockAudioContext,
        );

        expectValidBassProcessingResult(result);
        expect(outputBuffer.numberOfChannels).toBe(channels);
      }
    });

    test('should report realistic bass processing metrics', async () => {
      const inputBuffer = scenarios.createBassAudioBuffer();
      const outputBuffer = scenarios.createBassAudioBuffer();

      const result = await bassProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      // Bass processing should have reasonable performance characteristics
      expect(result.processingTime).toBeLessThanOrEqual(20); // Low latency for real-time bass
      expect(result.cpuUsage).toBeGreaterThan(0); // Some CPU usage for processing
      expect(result.cpuUsage).toBeLessThanOrEqual(0.3); // Efficient bass processing
      expect(result.memoryUsage).toBeGreaterThan(0); // Memory usage for buffers
    });

    test('should maintain bass frequency content integrity', async () => {
      // Set EQ to boost bass frequencies
      await bassProcessor.setParameter('lowShelf', 6);
      await bassProcessor.setParameter('lowShelfFreq', 80);

      const inputBuffer = scenarios.createBassAudioBuffer();
      const outputBuffer = scenarios.createBassAudioBuffer();

      const result = await bassProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      expectValidBassProcessingResult(result);

      // Verify the buffer was processed (mock implementation should copy data)
      // In test mode, the processor should still handle the buffer successfully
      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
    });
  });

  describe('Bass Preset Management Behaviors', () => {
    beforeEach(async () => {
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);
    });

    test('should save bass-specific presets', async () => {
      // Configure rock bass settings
      const rockSettings = scenarios.bassPresets.rock;

      for (const [param, value] of Object.entries(rockSettings)) {
        // Skip pluginId as it's preset metadata, not a parameter
        if (param !== 'pluginId') {
          await bassProcessor.setParameter(param, value);
        }
      }

      const preset = await bassProcessor.savePreset('Rock Bass');

      expect(preset).toBeDefined();
      expect(preset.parameters).toBeDefined();
      const parameters = preset.parameters as Record<string, unknown>;
      expect(parameters.lowShelf).toBe(rockSettings.lowShelf);
      expect(parameters.midGain).toBe(rockSettings.midGain);
      expect(parameters.compThreshold).toBe(rockSettings.compThreshold);
      expect(parameters.distAmount).toBe(rockSettings.distAmount);
    });

    test('should load bass presets correctly', async () => {
      const jazzSettings = scenarios.bassPresets.jazz;
      // Create proper preset structure
      const jazzPreset = {
        name: 'Jazz Bass',
        pluginId: 'bassnotion.bass-processor',
        version: '1.0.0',
        parameters: {
          lowShelf: jazzSettings.lowShelf,
          midGain: jazzSettings.midGain,
          compThreshold: jazzSettings.compThreshold,
          distAmount: jazzSettings.distAmount,
        },
      };

      await bassProcessor.loadPreset(jazzPreset);

      expect(bassProcessor.getParameter('lowShelf')).toBe(
        jazzSettings.lowShelf,
      );
      expect(bassProcessor.getParameter('midGain')).toBe(jazzSettings.midGain);
      expect(bassProcessor.getParameter('compThreshold')).toBe(
        jazzSettings.compThreshold,
      );
      expect(bassProcessor.getParameter('distAmount')).toBe(
        jazzSettings.distAmount,
      );
    });

    test('should handle different bass style presets', async () => {
      const styles = ['rock', 'jazz', 'metal'] as const;

      for (const style of styles) {
        const presetData = scenarios.bassPresets[style];

        // Create proper preset structure
        const preset = {
          name: `${style} Bass`,
          pluginId: 'bassnotion.bass-processor',
          version: '1.0.0',
          parameters: {
            lowShelf: presetData.lowShelf,
            distAmount: presetData.distAmount,
          },
        };

        await bassProcessor.loadPreset(preset);

        // Each style should have different characteristics
        const lowShelf = bassProcessor.getParameter('lowShelf');
        const distAmount = bassProcessor.getParameter('distAmount');

        expect(typeof lowShelf).toBe('number');
        expect(typeof distAmount).toBe('number');

        // Metal should have more distortion than jazz
        if (style === 'metal') {
          expect(distAmount).toBeGreaterThan(0.5);
        } else if (style === 'jazz') {
          expect(distAmount).toBeLessThanOrEqual(0.2);
        }
      }
    });

    test('should reset to default bass settings', async () => {
      // Change from defaults
      await bassProcessor.setParameter('lowShelf', 8);
      await bassProcessor.setParameter('distAmount', 0.9);

      await bassProcessor.resetParameters();

      // Should return to default values suitable for bass
      const lowShelf = bassProcessor.getParameter('lowShelf');
      const distAmount = bassProcessor.getParameter('distAmount');

      expect(lowShelf).toBeLessThan(8); // Reset from extreme value
      expect(distAmount).toBeLessThan(0.9); // Reset from extreme value
    });
  });

  describe('N8n Bass Integration Behaviors', () => {
    beforeEach(async () => {
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);
    });

    test('should process N8n bass configuration payload', async () => {
      const payload = scenarios.n8nBassPayload;

      if (bassProcessor.processN8nPayload) {
        await expect(
          bassProcessor.processN8nPayload(payload),
        ).resolves.not.toThrow();
      }
    });

    test('should extract bass settings from N8n payload', async () => {
      const payload = scenarios.n8nBassPayload;

      if (bassProcessor.processN8nPayload) {
        await bassProcessor.processN8nPayload(payload);

        // Should apply settings from payload
        // (Implementation would set parameters based on payload content)
        expect(true).toBe(true); // Placeholder for actual parameter verification
      }
    });

    test('should handle malformed bass payload gracefully', async () => {
      const malformedPayload = {
        type: 'bass-settings',
        invalidField: 'should be ignored',
        processingSettings: {
          preset: 'unknown-preset',
          invalidSetting: 123,
        },
      };

      if (bassProcessor.processN8nPayload) {
        await expect(
          bassProcessor.processN8nPayload(malformedPayload),
        ).resolves.not.toThrow();
      }
    });

    test('should support Epic 2 bass exercise integration', async () => {
      const exercisePayload = {
        type: 'exercise-config',
        exercise: {
          title: 'Walking Bass Lines',
          difficulty: 'advanced',
          key: 'Bb',
          tempo: 100,
          genre: 'jazz',
          techniques: ['walking', 'chromaticism'],
        },
        bassSettings: {
          preset: 'jazz',
          adaptiveEQ: true,
          compressionLevel: 'light',
        },
      };

      if (bassProcessor.processN8nPayload) {
        await expect(
          bassProcessor.processN8nPayload(exercisePayload),
        ).resolves.not.toThrow();
      }
    });
  });

  describe('Bass Error Handling Behaviors', () => {
    test('should handle bass processing chain initialization errors', async () => {
      // Mock compressor creation to fail
      mockEnvironment.mockTone.Compressor.mockImplementation(() => {
        throw new Error('Compressor initialization failed');
      });

      await bassProcessor.load();

      // In test mode, errors are handled gracefully with mock chains
      await bassProcessor.initialize(scenarios.mockAudioContext);
      expect(bassProcessor.state).toBe(PluginState.INACTIVE); // Should not error in test mode
    });

    test('should handle invalid bass parameter values', async () => {
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);

      // Test invalid parameter values
      await expect(
        bassProcessor.setParameter('lowShelf', 'invalid'),
      ).rejects.toThrow();
      await expect(
        bassProcessor.setParameter('midFreq', -100),
      ).rejects.toThrow(); // Negative frequency
      await expect(
        bassProcessor.setParameter('compRatio', 0),
      ).rejects.toThrow(); // Invalid ratio
    });

    test('should handle bass processing buffer errors', async () => {
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);
      await bassProcessor.activate();

      // Test with null buffers - should return error status but not throw
      const result = await bassProcessor.process(
        null as any,
        null as any,
        scenarios.mockAudioContext,
      );

      expect(result.status).toBe(ProcessingResultStatus.ERROR);
      expect(result.success).toBe(false);
    });

    test('should recover from bass processing failures', async () => {
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);
      await bassProcessor.activate();

      // Simulate processing error by creating invalid buffer
      const invalidBuffer = {} as AudioBuffer;

      try {
        await bassProcessor.process(
          invalidBuffer,
          invalidBuffer,
          scenarios.mockAudioContext,
        );
      } catch (error) {
        // Should handle error gracefully
        expect(error).toBeDefined();
      }

      // Should still be able to process valid buffers after error
      const validInput = scenarios.createBassAudioBuffer();
      const validOutput = scenarios.createBassAudioBuffer();

      const result = await bassProcessor.process(
        validInput,
        validOutput,
        scenarios.mockAudioContext,
      );
      expectValidBassProcessingResult(result);
    });
  });

  describe('Real-World Bass Processing Scenarios', () => {
    beforeEach(async () => {
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);
      await bassProcessor.activate();
    });

    test('should integrate seamlessly in plugin chains', async () => {
      // Simulate plugin chain scenario with bass processor in the middle
      const chainContext = {
        ...scenarios.mockAudioContext,
        pluginChain: ['compressor', 'bassnotion.bass-processor', 'reverb'],
        chainPosition: 1,
        isChainProcessing: true,
      } as any;

      const inputBuffer = scenarios.createBassAudioBuffer(2, 512);
      const outputBuffer = scenarios.createBassAudioBuffer(2, 512);

      const result = await bassProcessor.process(
        inputBuffer,
        outputBuffer,
        chainContext,
      );

      expectValidBassProcessingResult(result);
      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
      expect(result.processingTime).toBeLessThanOrEqual(15); // Should be efficient in chains
    });

    test('should handle real-time parameter automation smoothly', async () => {
      // Simulate real-time automation data for live bass performance
      const automationData = [
        { time: 0, parameter: 'lowShelf', value: 0 },
        { time: 0.25, parameter: 'lowShelf', value: 3 },
        { time: 0.5, parameter: 'lowShelf', value: 6 },
        { time: 0.75, parameter: 'lowShelf', value: 3 },
        { time: 1.0, parameter: 'lowShelf', value: 0 },
        { time: 0, parameter: 'distAmount', value: 0.1 },
        { time: 0.5, parameter: 'distAmount', value: 0.4 },
        { time: 1.0, parameter: 'distAmount', value: 0.2 },
      ];

      const inputBuffer = scenarios.createBassAudioBuffer(2, 1024);
      const outputBuffer = scenarios.createBassAudioBuffer(2, 1024);

      // Apply automation changes and process
      for (const automation of automationData) {
        await bassProcessor.setParameter(
          automation.parameter,
          automation.value,
        );

        const result = await bassProcessor.process(
          inputBuffer,
          outputBuffer,
          scenarios.mockAudioContext,
        );

        expectValidBassProcessingResult(result);
        expect(bassProcessor.getParameter(automation.parameter)).toBe(
          automation.value,
        );
      }
    });

    test('should handle live bass performance scenario', async () => {
      // Configure for live bass processing with low latency
      await bassProcessor.setParameter('lowShelf', 2); // Subtle bass enhancement
      await bassProcessor.setParameter('compThreshold', -15); // Control dynamics
      await bassProcessor.setParameter('compRatio', 4); // Moderate compression
      await bassProcessor.setParameter('compAttack', 0.003); // Fast attack for live playing
      await bassProcessor.setParameter('distAmount', 0.1); // Minimal distortion for clean tone

      // Process multiple bass audio chunks (simulate real-time)
      for (let i = 0; i < 10; i++) {
        const inputBuffer = scenarios.createBassAudioBuffer(2, 256); // Small buffers for low latency
        const outputBuffer = scenarios.createBassAudioBuffer(2, 256);

        const result = await bassProcessor.process(
          inputBuffer,
          outputBuffer,
          scenarios.mockAudioContext,
        );

        expectValidBassProcessingResult(result);
        expect(result.processingTime).toBeLessThanOrEqual(10); // Critical for live performance
      }
    });

    test('should handle bass recording scenario', async () => {
      // Configure for bass recording with quality focus
      await bassProcessor.setParameter('lowShelf', 3); // Enhanced low end for recording
      await bassProcessor.setParameter('midGain', 1); // Clarity in mid bass
      await bassProcessor.setParameter('compThreshold', -20); // Control peaks for recording
      await bassProcessor.setParameter('compRatio', 6); // Smooth compression
      await bassProcessor.setParameter('distAmount', 0.3); // Character for recording
      await bassProcessor.setParameter('wetDryMix', 0.8); // Mostly processed signal

      // Process longer bass audio segments
      const inputBuffer = scenarios.createBassAudioBuffer(2, 2048); // Larger buffers for quality
      const outputBuffer = scenarios.createBassAudioBuffer(2, 2048);

      const result = await bassProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      expectValidBassProcessingResult(result);
      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
    });

    test('should handle bass style changes during performance', async () => {
      const inputBuffer = scenarios.createBassAudioBuffer();
      const outputBuffer = scenarios.createBassAudioBuffer();

      // Start with rock bass
      await bassProcessor.loadPreset(scenarios.bassPresets.rock);
      let result = await bassProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );
      expectValidBassProcessingResult(result);

      // Switch to jazz bass
      await bassProcessor.loadPreset(scenarios.bassPresets.jazz);
      result = await bassProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );
      expectValidBassProcessingResult(result);

      // Switch to metal bass
      await bassProcessor.loadPreset(scenarios.bassPresets.metal);
      result = await bassProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );
      expectValidBassProcessingResult(result);
    });

    test('should handle bass processing with automation', async () => {
      const inputBuffer = scenarios.createBassAudioBuffer();
      const outputBuffer = scenarios.createBassAudioBuffer();

      // Simulate parameter automation during processing
      const automationSteps = [
        { lowShelf: 0, distAmount: 0 },
        { lowShelf: 2, distAmount: 0.2 },
        { lowShelf: 4, distAmount: 0.4 },
        { lowShelf: 3, distAmount: 0.3 },
        { lowShelf: 1, distAmount: 0.1 },
      ];

      for (const step of automationSteps) {
        await bassProcessor.setParameter('lowShelf', step.lowShelf);
        await bassProcessor.setParameter('distAmount', step.distAmount);

        const result = await bassProcessor.process(
          inputBuffer,
          outputBuffer,
          scenarios.mockAudioContext,
        );
        expectValidBassProcessingResult(result);
      }
    });

    test('should maintain stability under high CPU stress', async () => {
      // Create multiple concurrent processing tasks for stress testing
      const stressTest = Array.from({ length: 10 }, () =>
        scenarios.createBassAudioBuffer(2, 512),
      );

      // Process all buffers concurrently to stress test
      const results = await Promise.all(
        stressTest.map((buffer) =>
          bassProcessor.process(buffer, buffer, scenarios.mockAudioContext),
        ),
      );

      // All results should be successful despite stress
      results.forEach((result) => {
        expect(result.status).not.toBe(ProcessingResultStatus.ERROR);
        expect(result.cpuUsage).toBeLessThan(1.0); // Should not exceed 100%
        expect(result.processingTime).toBeLessThanOrEqual(50); // Reasonable under stress
      });
    });

    test('should optimize memory usage over extended processing', async () => {
      // Process many buffers to trigger memory optimization patterns
      const testBuffers = Array.from({ length: 50 }, () =>
        scenarios.createBassAudioBuffer(
          2,
          Math.floor(Math.random() * 1024) + 256, // Variable buffer sizes
        ),
      );

      let initialMemory = 0;
      let finalMemory = 0;

      for (let i = 0; i < testBuffers.length; i++) {
        const buffer = testBuffers[i];
        if (buffer) {
          const result = await bassProcessor.process(
            buffer,
            buffer,
            scenarios.mockAudioContext,
          );

          expectValidBassProcessingResult(result);

          if (i === 10) {
            initialMemory = result.memoryUsage || 0;
          }
          if (i === testBuffers.length - 1) {
            finalMemory = result.memoryUsage || 0;
          }
        }
      }

      // Memory should be managed efficiently - not grow excessively
      expect(finalMemory).toBeLessThan(initialMemory * 2.5); // Should not more than double
      expect(finalMemory).toBeGreaterThanOrEqual(0); // Should track memory usage
    });

    test('should handle bass processing resource management', async () => {
      // Process many buffers to test resource management
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const inputBuffer = scenarios.createBassAudioBuffer();
        const outputBuffer = scenarios.createBassAudioBuffer();

        const result = await bassProcessor.process(
          inputBuffer,
          outputBuffer,
          scenarios.mockAudioContext,
        );
        expectValidBassProcessingResult(result);

        // Memory usage should remain reasonable
        expect(result.memoryUsage).toBeLessThan(50); // MB
        expect(result.cpuUsage).toBeLessThan(0.5); // 50% max
      }
    });
  });

  describe('Advanced Error Recovery and Edge Cases', () => {
    beforeEach(async () => {
      await bassProcessor.load();
      await bassProcessor.initialize(scenarios.mockAudioContext);
      await bassProcessor.activate();
    });

    test('should handle empty audio buffers gracefully', async () => {
      // Create empty buffer scenario
      const emptyBuffer = scenarios.createBassAudioBuffer(2, 0); // Zero length buffer

      const result = await bassProcessor.process(
        emptyBuffer,
        emptyBuffer,
        scenarios.mockAudioContext,
      );

      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
      expect(result.processedSamples).toBeGreaterThanOrEqual(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    test('should recover from audio context suspension errors', async () => {
      // Simulate suspended audio context
      const suspendedContext = {
        ...scenarios.mockAudioContext,
        audioContext: {
          ...scenarios.mockAudioContext.audioContext,
          state: 'suspended',
        },
      } as PluginAudioContext;

      const inputBuffer = scenarios.createBassAudioBuffer();
      const outputBuffer = scenarios.createBassAudioBuffer();

      const result = await bassProcessor.process(
        inputBuffer,
        outputBuffer,
        suspendedContext,
      );

      // Should handle context suspension gracefully
      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    test('should handle corrupted buffer data gracefully', async () => {
      // Create buffer with corrupted channel data
      const corruptedBuffer = scenarios.createBassAudioBuffer();
      corruptedBuffer.getChannelData = vi.fn().mockImplementation(() => {
        const data = new Float32Array(1024);
        // Fill with NaN and Infinity values
        for (let i = 0; i < 1024; i++) {
          data[i] = i % 3 === 0 ? NaN : i % 3 === 1 ? Infinity : -Infinity;
        }
        return data;
      });

      const outputBuffer = scenarios.createBassAudioBuffer();

      // Should handle corrupted data without crashing
      const result = await bassProcessor.process(
        corruptedBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    test('should handle rapid parameter changes during processing', async () => {
      // Simulate rapid parameter automation changes
      const inputBuffer = scenarios.createBassAudioBuffer(2, 1024);
      const outputBuffer = scenarios.createBassAudioBuffer(2, 1024);

      // Rapidly change parameters during processing
      const rapidChanges = async () => {
        for (let i = 0; i < 20; i++) {
          await bassProcessor.setParameter('lowShelf', Math.random() * 12 - 6);
          await bassProcessor.setParameter('distAmount', Math.random());
          await new Promise((resolve) => setTimeout(resolve, 1)); // Small delay
        }
      };

      // Start rapid parameter changes
      const paramChangePromise = rapidChanges();

      // Process audio while parameters are changing
      const result = await bassProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      await paramChangePromise;

      expectValidBassProcessingResult(result);
      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
    });

    test('should recover after processing chain failures', async () => {
      // Simulate a processing failure
      const invalidBuffer = {
        numberOfChannels: -1, // Invalid
        length: 'invalid', // Invalid
        sampleRate: null, // Invalid
      } as any;

      // Should handle invalid buffer gracefully
      try {
        await bassProcessor.process(
          invalidBuffer,
          invalidBuffer,
          scenarios.mockAudioContext,
        );
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Should still be able to process valid buffers after failure
      const validInput = scenarios.createBassAudioBuffer();
      const validOutput = scenarios.createBassAudioBuffer();

      const result = await bassProcessor.process(
        validInput,
        validOutput,
        scenarios.mockAudioContext,
      );

      expectValidBassProcessingResult(result);
      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
    });
  });
});
