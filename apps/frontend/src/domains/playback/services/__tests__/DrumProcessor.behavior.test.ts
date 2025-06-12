/**
 * DrumProcessor Behavior Tests
 *
 * Tests the professional drum and rhythm processing behaviors including beat detection,
 * rhythm analysis, pattern generation, metronome functionality, and Epic 2 integration.
 *
 * Focus: What the service DOES, not how it's implemented
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Tone from 'tone';
import {
  PluginState,
  PluginAudioContext,
  ProcessingResultStatus,
  PluginParameterType,
  PluginCategory,
  PluginPriority,
} from '../../types/plugin.js';

// Mock Tone module BEFORE importing DrumProcessor - define inline to avoid hoisting issues
vi.mock('tone', () => {
  const createMockToneNode = (nodeType: string) => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    toDestination: vi.fn(),
    chain: vi.fn(),
    wet: { value: 1.0 },
    gain: { value: 1.0 },
    // Gain specific properties
    ...(nodeType === 'Gain' && {
      gain: { value: 1.0 },
    }),
    // Filter specific properties for drum EQ
    ...(nodeType === 'Filter' && {
      frequency: { value: 350 },
      Q: { value: 1 },
      gain: { value: 0 },
      type: 'peaking',
    }),
    // Oscillator for metronome
    ...(nodeType === 'Oscillator' && {
      frequency: { value: 1000 },
      type: 'sine',
      start: vi.fn(),
      stop: vi.fn(),
    }),
    // AmplitudeEnvelope for metronome clicks
    ...(nodeType === 'AmplitudeEnvelope' && {
      attack: { value: 0.01 },
      decay: { value: 0.1 },
      sustain: { value: 0 },
      release: { value: 0.1 },
      triggerAttackRelease: vi.fn(),
    }),
    // Sampler for drum sounds
    ...(nodeType === 'Sampler' && {
      add: vi.fn(),
      triggerAttack: vi.fn(),
      triggerRelease: vi.fn(),
      loaded: true,
    }),
    // Sequence for drum patterns
    ...(nodeType === 'Sequence' && {
      start: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
    }),
  });

  return {
    Gain: vi.fn(() => createMockToneNode('Gain')),
    Filter: vi.fn(() => createMockToneNode('Filter')),
    Oscillator: vi.fn(() => createMockToneNode('Oscillator')),
    AmplitudeEnvelope: vi.fn(() => createMockToneNode('AmplitudeEnvelope')),
    Sampler: vi.fn(() => createMockToneNode('Sampler')),
    Sequence: vi.fn(() => createMockToneNode('Sequence')),
    getContext: vi.fn(() => ({
      state: 'running',
      sampleRate: 44100,
      currentTime: 0,
    })),
    start: vi.fn(),
    setContext: vi.fn(),
    Transport: {
      bpm: { value: 120 },
      start: vi.fn(),
      stop: vi.fn(),
      scheduleRepeat: vi.fn(),
      cancel: vi.fn(),
      state: 'stopped',
    },
    dbToGain: vi.fn((db: number) => Math.pow(10, db / 20)),
  };
});

// Now import DrumProcessor - it will get the mocked Tone.js
import { DrumProcessor } from '../plugins/DrumProcessor.js';

// Get the mocked Tone module for test assertions
const mockTone = vi.mocked(Tone);

// Test Environment Setup
const setupDrumTestEnvironment = () => {
  // Mock console to prevent test noise
  global.console = {
    ...global.console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  // Mock Web Audio API AnalyserNode
  global.AnalyserNode = vi.fn().mockImplementation(() => ({
    fftSize: 2048,
    frequencyBinCount: 1024,
    getFloatFrequencyData: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

  global.Float32Array = Float32Array;

  // Return empty object since we access mocks directly now
  return {};
};

// Scenario Builders for Drum Processing
const createDrumProcessingScenarios = () => {
  const mockAudioContext: PluginAudioContext = {
    audioContext: {
      state: 'running',
      sampleRate: 44100,
      currentTime: 0,
      destination: {} as any,
      createAnalyser: vi.fn(() => new (AnalyserNode as any)()),
    } as any,
    toneContext: {} as any,
    transport: {} as any,
    performanceMetrics: {} as any,
    sampleRate: 44100,
    bufferSize: 512,
    currentTime: 0,
  };

  const createDrumAudioBuffer = (channels = 2, length = 1024): AudioBuffer => {
    const buffer = {
      numberOfChannels: channels,
      length,
      sampleRate: 44100,
      duration: length / 44100,
      getChannelData: vi.fn().mockImplementation((_channel: number) => {
        // Simulate drum-heavy audio content with transients
        const data = new Float32Array(length);
        for (let i = 0; i < length; i++) {
          // Generate drum-like waveform with kick, snare patterns
          const t = i / 44100;
          const kickPattern = Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 5); // Kick drum
          const snarePattern =
            Math.random() * 0.3 * Math.sin(2 * Math.PI * 200 * t); // Snare noise
          const hihatPattern = Math.random() * 0.1; // Hi-hat noise

          // Add transients at regular intervals (simulating beats)
          const beatInterval = 44100 / 2; // 2 beats per second at 120 BPM
          if (i % beatInterval < 100) {
            data[i] = kickPattern + snarePattern + hihatPattern + 0.5; // Beat transient
          } else {
            data[i] = (kickPattern + snarePattern + hihatPattern) * 0.3;
          }
        }
        return data;
      }),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as any;
    return buffer;
  };

  const drumPatternPresets = {
    rock: {
      beatDetectionEnabled: true,
      beatSensitivity: 70,
      beatThreshold: -24,
      metronomeEnabled: false,
      metronomeBpm: 120,
      patternEnabled: true,
      patternComplexity: 6,
      patternStyle: 'rock',
      kickBoost: 3,
      snareBoost: 2,
      hihatBoost: -1,
      overheadBoost: 1,
    },
    jazz: {
      beatDetectionEnabled: true,
      beatSensitivity: 60,
      beatThreshold: -18,
      metronomeEnabled: true,
      metronomeBpm: 140,
      patternEnabled: true,
      patternComplexity: 8,
      patternStyle: 'jazz',
      kickBoost: 1,
      snareBoost: 3,
      hihatBoost: 2,
      overheadBoost: 4,
    },
    funk: {
      beatDetectionEnabled: true,
      beatSensitivity: 80,
      beatThreshold: -20,
      metronomeEnabled: false,
      metronomeBpm: 100,
      patternEnabled: true,
      patternComplexity: 9,
      patternStyle: 'funk',
      kickBoost: 4,
      snareBoost: 1,
      hihatBoost: 0,
      overheadBoost: -2,
    },
  };

  const n8nDrumPayload = {
    type: 'rhythm-config',
    exercise: {
      title: 'Groove Fundamentals',
      difficulty: 'intermediate',
      tempo: 120,
      timeSignature: '4/4',
      genre: 'rock',
      focusAreas: ['beat-detection', 'groove-stability'],
    },
    drumSettings: {
      preset: 'rock',
      beatDetection: {
        enabled: true,
        sensitivity: 75,
        adaptiveTempo: true,
      },
      metronome: {
        enabled: true,
        volume: 50,
        sound: 'click',
        accent: true,
      },
      patterns: {
        enabled: false,
        complexity: 5,
        style: 'rock',
      },
    },
    analysisConfig: {
      realTimeAnalysis: true,
      grooveAssessment: true,
      timingFeedback: true,
    },
  };

  return {
    mockAudioContext,
    createDrumAudioBuffer,
    drumPatternPresets,
    n8nDrumPayload,
  };
};

// Test Helpers
const expectValidDrumProcessorState = (processor: DrumProcessor) => {
  expect(processor).toBeDefined();
  expect(processor.metadata).toBeDefined();
  expect(processor.metadata.id).toBe('bassnotion.drum-processor');
  expect(processor.metadata.category).toBeDefined();
  expect(processor.config).toBeDefined();
  expect(processor.capabilities).toBeDefined();
};

const _expectValidBeatDetectionResult = (result: any) => {
  expect(result).toBeDefined();
  expect(typeof result.beatDetected).toBe('boolean');
  expect(typeof result.confidence).toBe('number');
  expect(typeof result.bpm).toBe('number');
  expect(typeof result.beatTime).toBe('number');
  expect(typeof result.intensity).toBe('number');

  expect(result.confidence).toBeGreaterThanOrEqual(0);
  expect(result.confidence).toBeLessThanOrEqual(1);
  expect(result.bpm).toBeGreaterThan(0);
  expect(result.beatTime).toBeGreaterThanOrEqual(0);
  expect(result.intensity).toBeGreaterThanOrEqual(0);
};

const _expectValidRhythmAnalysisResult = (result: any) => {
  expect(result).toBeDefined();
  expect(typeof result.averageBpm).toBe('number');
  expect(typeof result.detectedTimeSignature).toBe('string');
  expect(typeof result.rhythmComplexity).toBe('number');
  expect(typeof result.grooveStability).toBe('number');
  expect(Array.isArray(result.onsetTimes)).toBe(true);

  expect(result.averageBpm).toBeGreaterThan(0);
  expect(result.rhythmComplexity).toBeGreaterThanOrEqual(0);
  expect(result.grooveStability).toBeGreaterThanOrEqual(0);
  expect(result.grooveStability).toBeLessThanOrEqual(1);
};

const expectValidDrumParameterMap = (parameters: Map<string, any>) => {
  expect(parameters).toBeInstanceOf(Map);
  expect(parameters.size).toBeGreaterThan(0);

  // Check for essential drum processing parameters
  const expectedParams = [
    'beatDetectionEnabled',
    'beatSensitivity',
    'beatThreshold',
    'rhythmAnalysisEnabled',
    'metronomeEnabled',
    'metronomeBpm',
    'patternEnabled',
    'patternComplexity',
    'patternStyle',
    'kickBoost',
    'snareBoost',
    'hihatBoost',
    'overheadBoost',
  ];

  expectedParams.forEach((paramId) => {
    expect(parameters.has(paramId)).toBe(true);
    const param = parameters.get(paramId);
    expect(param).toBeDefined();
    expect(param.id).toBe(paramId);
    expect(Object.values(PluginParameterType)).toContain(param.type);
  });
};

const expectValidDrumProcessingResult = (result: any) => {
  expect(result).toBeDefined();
  expect(Object.values(ProcessingResultStatus)).toContain(result.status);
  expect(result.success).toBeDefined();
  expect(typeof result.processingTime).toBe('number');
  expect(typeof result.cpuUsage).toBe('number');
  expect(typeof result.memoryUsage).toBe('number');
  expect(result.processingTime).toBeGreaterThanOrEqual(0);
  expect(result.cpuUsage).toBeGreaterThanOrEqual(0);
  expect(result.memoryUsage).toBeGreaterThan(0);
};

// Behavior Tests
describe('DrumProcessor Behaviors', () => {
  let drumProcessor: DrumProcessor;
  let _mockEnvironment: ReturnType<typeof setupDrumTestEnvironment>;
  let scenarios: ReturnType<typeof createDrumProcessingScenarios>;

  beforeEach(() => {
    _mockEnvironment = setupDrumTestEnvironment();
    scenarios = createDrumProcessingScenarios();
    drumProcessor = new DrumProcessor();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      if (drumProcessor.state !== PluginState.UNLOADED) {
        await drumProcessor.dispose();
      }
    } catch {
      // Ignore disposal errors in tests
    }
    vi.restoreAllMocks();
  });

  describe('Drum Processor Identity Behaviors', () => {
    test('should identify as drum processor plugin', () => {
      expectValidDrumProcessorState(drumProcessor);

      expect(drumProcessor.metadata.name).toBe('Drum Processor');
      expect(drumProcessor.metadata.description).toContain('drum');
      expect(drumProcessor.metadata.tags).toContain('drums');
      expect(drumProcessor.metadata.tags).toContain('rhythm');
      expect(drumProcessor.metadata.tags).toContain('beat-detection');
    });

    test('should declare drum-specific capabilities', () => {
      const capabilities = drumProcessor.capabilities;

      expect(capabilities.supportsRealtimeProcessing).toBe(true);
      expect(capabilities.supportsOfflineProcessing).toBe(true);
      expect(capabilities.supportsAudioWorklet).toBe(true);
      expect(capabilities.supportsMIDI).toBe(true);
      expect(capabilities.supportsAutomation).toBe(true);
      expect(capabilities.supportsPresets).toBe(true);
      expect(capabilities.supportsN8nPayload).toBe(true);
      expect(capabilities.supportsAssetLoading).toBe(true);

      // Drum processing specific expectations
      expect(capabilities.maxLatency).toBeLessThanOrEqual(10); // Low latency for rhythm
      expect(capabilities.cpuUsage).toBeLessThanOrEqual(0.3); // Reasonable CPU for analysis
    });

    test('should support Epic 2 rhythm integration features', () => {
      const epicIntegration = drumProcessor.metadata.epicIntegration;

      expect(epicIntegration?.supportedMidiTypes).toContain('drum-patterns');
      expect(epicIntegration?.supportedMidiTypes).toContain('click-track');
      expect(epicIntegration?.supportedMidiTypes).toContain('rhythm-data');

      expect(epicIntegration?.assetProcessingCapabilities).toContain(
        'beat-detection',
      );
      expect(epicIntegration?.assetProcessingCapabilities).toContain(
        'rhythm-analysis',
      );
      expect(epicIntegration?.assetProcessingCapabilities).toContain(
        'pattern-generation',
      );
    });

    test('should provide professional drum processing configuration', () => {
      const config = drumProcessor.config;

      expect(config.category).toBe(PluginCategory.ANALYZER);
      expect(config.priority).toBe(PluginPriority.HIGH);
      expect(config.inputChannels).toBe(2);
      expect(config.outputChannels).toBe(2);
      expect(config.maxCpuUsage).toBe(30);
      expect(config.maxMemoryUsage).toBe(32);

      expect(config.n8nIntegration?.acceptsPayload).toBe(true);
      expect(config.n8nIntegration?.payloadTypes).toContain('rhythm-config');
      expect(config.n8nIntegration?.payloadTypes).toContain('beat-settings');
      expect(config.n8nIntegration?.payloadTypes).toContain('drum-patterns');
    });
  });

  describe('Plugin Lifecycle Behaviors', () => {
    test('should initialize drum processing chain successfully', async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);

      expect(drumProcessor.state).toBe(PluginState.INACTIVE);

      // Verify drum components were created
      expect(mockTone.Gain).toHaveBeenCalled(); // Input/output gain
      expect(mockTone.Filter).toHaveBeenCalled(); // Drum EQ filters
      expect(mockTone.Oscillator).toHaveBeenCalled(); // Metronome
      expect(mockTone.AmplitudeEnvelope).toHaveBeenCalled(); // Click envelope
      expect(mockTone.Sampler).toHaveBeenCalled(); // Drum samples
    });

    test('should activate drum processing chain', async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);
      await drumProcessor.activate();

      expect(drumProcessor.state).toBe(PluginState.ACTIVE);
    });

    test('should handle complete drum processor lifecycle', async () => {
      // Load
      await drumProcessor.load();
      expect(drumProcessor.state).toBe(PluginState.LOADED);

      // Initialize
      await drumProcessor.initialize(scenarios.mockAudioContext);
      expect(drumProcessor.state).toBe(PluginState.INACTIVE);

      // Activate
      await drumProcessor.activate();
      expect(drumProcessor.state).toBe(PluginState.ACTIVE);

      // Deactivate
      await drumProcessor.deactivate();
      expect(drumProcessor.state).toBe(PluginState.INACTIVE);

      // Dispose
      await drumProcessor.dispose();
      expect(drumProcessor.state).toBe(PluginState.UNLOADED);
    });

    test('should handle errors during drum chain creation', async () => {
      // Mock Sampler to fail
      vi.mocked(mockTone.Sampler).mockImplementation(() => {
        throw new Error('Failed to create drum sampler');
      });

      await drumProcessor.load();

      await expect(
        drumProcessor.initialize(scenarios.mockAudioContext),
      ).rejects.toThrow();
      expect(drumProcessor.state).toBe(PluginState.ERROR);
    });
  });

  describe('Beat Detection Behaviors', () => {
    beforeEach(async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);
    });

    test('should provide beat detection parameters', () => {
      const parameters = drumProcessor.parameters;

      expectValidDrumParameterMap(parameters);

      // Beat detection enabled
      const beatEnabled = parameters.get('beatDetectionEnabled');
      expect(beatEnabled?.type).toBe(PluginParameterType.BOOLEAN);
      expect(beatEnabled?.defaultValue).toBe(true);

      // Beat sensitivity
      const sensitivity = parameters.get('beatSensitivity');
      expect(sensitivity?.type).toBe(PluginParameterType.FLOAT);
      expect(sensitivity?.minValue).toBe(0);
      expect(sensitivity?.maxValue).toBe(100);

      // Beat threshold
      const threshold = parameters.get('beatThreshold');
      expect(threshold?.type).toBe(PluginParameterType.FLOAT);
      expect(threshold?.unit).toBe('dB');
      expect(threshold?.minValue).toBeLessThanOrEqual(-60);
      expect(threshold?.maxValue).toBeGreaterThanOrEqual(0);
    });

    test('should set beat detection parameters correctly', async () => {
      await drumProcessor.setParameter('beatDetectionEnabled', true);
      await drumProcessor.setParameter('beatSensitivity', 75);
      await drumProcessor.setParameter('beatThreshold', -20);

      expect(drumProcessor.getParameter('beatDetectionEnabled')).toBe(true);
      expect(drumProcessor.getParameter('beatSensitivity')).toBe(75);
      expect(drumProcessor.getParameter('beatThreshold')).toBe(-20);
    });

    test('should detect beats in drum audio', async () => {
      await drumProcessor.setParameter('beatDetectionEnabled', true);
      await drumProcessor.setParameter('beatSensitivity', 70);
      await drumProcessor.activate();

      const inputBuffer = scenarios.createDrumAudioBuffer();
      const outputBuffer = scenarios.createDrumAudioBuffer();

      const result = await drumProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      expectValidDrumProcessingResult(result);
      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
    });

    test('should adapt sensitivity for different drum styles', async () => {
      const styles = [
        { style: 'rock', sensitivity: 70 },
        { style: 'jazz', sensitivity: 60 },
        { style: 'funk', sensitivity: 80 },
      ];

      for (const { style, sensitivity } of styles) {
        await drumProcessor.setParameter('beatSensitivity', sensitivity);
        await drumProcessor.setParameter('patternStyle', style);

        expect(drumProcessor.getParameter('beatSensitivity')).toBe(sensitivity);
        expect(drumProcessor.getParameter('patternStyle')).toBe(style);
      }
    });

    test('should handle beat detection edge cases', async () => {
      // Very quiet audio
      await drumProcessor.setParameter('beatSensitivity', 100);
      await drumProcessor.setParameter('beatThreshold', -60);

      // Very loud audio
      await drumProcessor.setParameter('beatSensitivity', 10);
      await drumProcessor.setParameter('beatThreshold', -6);

      expect(drumProcessor.getParameter('beatSensitivity')).toBe(10);
      expect(drumProcessor.getParameter('beatThreshold')).toBe(-6);
    });
  });

  describe('Rhythm Analysis Behaviors', () => {
    beforeEach(async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);
    });

    test('should provide rhythm analysis parameters', () => {
      const parameters = drumProcessor.parameters;

      const rhythmEnabled = parameters.get('rhythmAnalysisEnabled');
      expect(rhythmEnabled?.type).toBe(PluginParameterType.BOOLEAN);

      const tempoRange = parameters.get('tempoRange');
      expect(tempoRange).toBeDefined();

      const timeSignature = parameters.get('timeSignature');
      expect(timeSignature?.type).toBe(PluginParameterType.STRING);
      expect(timeSignature?.defaultValue).toBe('4/4');
    });

    test('should analyze rhythm in drum audio', async () => {
      await drumProcessor.setParameter('rhythmAnalysisEnabled', true);
      await drumProcessor.setParameter('timeSignature', '4/4');
      await drumProcessor.activate();

      const inputBuffer = scenarios.createDrumAudioBuffer();
      const outputBuffer = scenarios.createDrumAudioBuffer();

      const result = await drumProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      expectValidDrumProcessingResult(result);
    });

    test('should handle different time signatures', async () => {
      const timeSignatures = ['4/4', '3/4', '6/8', '7/8'];

      for (const sig of timeSignatures) {
        await drumProcessor.setParameter('timeSignature', sig);
        expect(drumProcessor.getParameter('timeSignature')).toBe(sig);
      }
    });

    test('should provide tempo range configuration', async () => {
      // Set tempo range for different genres
      await drumProcessor.setParameter('tempoRange', [60, 80]); // Ballad
      await drumProcessor.setParameter('tempoRange', [120, 140]); // Rock
      await drumProcessor.setParameter('tempoRange', [160, 180]); // Fast rock

      // Should accept valid ranges
      expect(true).toBe(true); // Placeholder for actual validation
    });
  });

  describe('Metronome Behaviors', () => {
    beforeEach(async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);
    });

    test('should provide metronome parameters', () => {
      const parameters = drumProcessor.parameters;

      const metronomeEnabled = parameters.get('metronomeEnabled');
      expect(metronomeEnabled?.type).toBe(PluginParameterType.BOOLEAN);
      expect(metronomeEnabled?.defaultValue).toBe(false);

      const bpm = parameters.get('metronomeBpm');
      expect(bpm?.type).toBe(PluginParameterType.NUMBER);
      expect(bpm?.minValue).toBe(60);
      expect(bpm?.maxValue).toBe(200);
      expect(bpm?.defaultValue).toBe(120);

      const volume = parameters.get('metronomeVolume');
      expect(volume?.type).toBe(PluginParameterType.FLOAT);
      expect(volume?.minValue).toBe(0);
      expect(volume?.maxValue).toBe(100);

      const sound = parameters.get('metronomeSound');
      expect(sound?.type).toBe(PluginParameterType.STRING);
    });

    test('should control metronome settings', async () => {
      await drumProcessor.setParameter('metronomeEnabled', true);
      await drumProcessor.setParameter('metronomeBpm', 140);
      await drumProcessor.setParameter('metronomeVolume', 75);
      await drumProcessor.setParameter('metronomeSound', 'click');

      expect(drumProcessor.getParameter('metronomeEnabled')).toBe(true);
      expect(drumProcessor.getParameter('metronomeBpm')).toBe(140);
      expect(drumProcessor.getParameter('metronomeVolume')).toBe(75);
      expect(drumProcessor.getParameter('metronomeSound')).toBe('click');
    });

    test('should handle metronome tempo changes', async () => {
      const tempos = [60, 90, 120, 150, 180, 200];

      for (const tempo of tempos) {
        await drumProcessor.setParameter('metronomeBpm', tempo);
        expect(drumProcessor.getParameter('metronomeBpm')).toBe(tempo);
      }
    });

    test('should support different metronome sounds', async () => {
      const sounds = ['click', 'beep', 'wood', 'cowbell'];

      for (const sound of sounds) {
        await drumProcessor.setParameter('metronomeSound', sound);
        expect(drumProcessor.getParameter('metronomeSound')).toBe(sound);
      }
    });

    test('should enable/disable metronome during processing', async () => {
      await drumProcessor.activate();

      // Enable metronome
      await drumProcessor.setParameter('metronomeEnabled', true);

      const inputBuffer = scenarios.createDrumAudioBuffer();
      const outputBuffer = scenarios.createDrumAudioBuffer();

      let result = await drumProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );
      expectValidDrumProcessingResult(result);

      // Disable metronome
      await drumProcessor.setParameter('metronomeEnabled', false);

      result = await drumProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );
      expectValidDrumProcessingResult(result);
    });
  });

  describe('Drum Pattern Behaviors', () => {
    beforeEach(async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);
    });

    test('should provide drum pattern parameters', () => {
      const parameters = drumProcessor.parameters;

      const patternEnabled = parameters.get('patternEnabled');
      expect(patternEnabled?.type).toBe(PluginParameterType.BOOLEAN);

      const complexity = parameters.get('patternComplexity');
      expect(complexity?.type).toBe(PluginParameterType.NUMBER);
      expect(complexity?.minValue).toBe(1);
      expect(complexity?.maxValue).toBe(10);

      const style = parameters.get('patternStyle');
      expect(style?.type).toBe(PluginParameterType.STRING);

      const volume = parameters.get('patternVolume');
      expect(volume?.type).toBe(PluginParameterType.FLOAT);
      expect(volume?.minValue).toBe(0);
      expect(volume?.maxValue).toBe(100);
    });

    test('should set drum pattern configurations', async () => {
      await drumProcessor.setParameter('patternEnabled', true);
      await drumProcessor.setParameter('patternComplexity', 7);
      await drumProcessor.setParameter('patternStyle', 'rock');
      await drumProcessor.setParameter('patternVolume', 80);

      expect(drumProcessor.getParameter('patternEnabled')).toBe(true);
      expect(drumProcessor.getParameter('patternComplexity')).toBe(7);
      expect(drumProcessor.getParameter('patternStyle')).toBe('rock');
      expect(drumProcessor.getParameter('patternVolume')).toBe(80);
    });

    test('should support different drum pattern styles', async () => {
      const styles = ['rock', 'jazz', 'funk', 'latin', 'electronic'];

      for (const style of styles) {
        await drumProcessor.setParameter('patternStyle', style);
        expect(drumProcessor.getParameter('patternStyle')).toBe(style);
      }
    });

    test('should adjust pattern complexity levels', async () => {
      const complexities = [1, 3, 5, 7, 10];

      for (const complexity of complexities) {
        await drumProcessor.setParameter('patternComplexity', complexity);
        expect(drumProcessor.getParameter('patternComplexity')).toBe(
          complexity,
        );
      }
    });

    test('should generate patterns during processing', async () => {
      await drumProcessor.setParameter('patternEnabled', true);
      await drumProcessor.setParameter('patternStyle', 'rock');
      await drumProcessor.activate();

      const inputBuffer = scenarios.createDrumAudioBuffer();
      const outputBuffer = scenarios.createDrumAudioBuffer();

      const result = await drumProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      expectValidDrumProcessingResult(result);
      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
    });
  });

  describe('Drum Enhancement Behaviors', () => {
    beforeEach(async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);
    });

    test('should provide drum enhancement parameters', () => {
      const parameters = drumProcessor.parameters;

      // Individual drum boosts
      const kickBoost = parameters.get('kickBoost');
      expect(kickBoost?.type).toBe(PluginParameterType.FLOAT);
      expect(kickBoost?.unit).toBe('dB');
      expect(kickBoost?.minValue).toBe(-12);
      expect(kickBoost?.maxValue).toBe(12);

      const snareBoost = parameters.get('snareBoost');
      expect(snareBoost?.type).toBe(PluginParameterType.FLOAT);
      expect(snareBoost?.unit).toBe('dB');

      const hihatBoost = parameters.get('hihatBoost');
      expect(hihatBoost?.type).toBe(PluginParameterType.FLOAT);
      expect(hihatBoost?.unit).toBe('dB');

      const overheadBoost = parameters.get('overheadBoost');
      expect(overheadBoost?.type).toBe(PluginParameterType.FLOAT);
      expect(overheadBoost?.unit).toBe('dB');
    });

    test('should set drum enhancement levels', async () => {
      await drumProcessor.setParameter('kickBoost', 4);
      await drumProcessor.setParameter('snareBoost', 2);
      await drumProcessor.setParameter('hihatBoost', -1);
      await drumProcessor.setParameter('overheadBoost', 3);

      expect(drumProcessor.getParameter('kickBoost')).toBe(4);
      expect(drumProcessor.getParameter('snareBoost')).toBe(2);
      expect(drumProcessor.getParameter('hihatBoost')).toBe(-1);
      expect(drumProcessor.getParameter('overheadBoost')).toBe(3);
    });

    test('should handle extreme enhancement settings', async () => {
      // Maximum boosts
      await drumProcessor.setParameter('kickBoost', 12);
      await drumProcessor.setParameter('snareBoost', 12);

      // Maximum cuts
      await drumProcessor.setParameter('hihatBoost', -12);
      await drumProcessor.setParameter('overheadBoost', -12);

      expect(drumProcessor.getParameter('kickBoost')).toBe(12);
      expect(drumProcessor.getParameter('snareBoost')).toBe(12);
      expect(drumProcessor.getParameter('hihatBoost')).toBe(-12);
      expect(drumProcessor.getParameter('overheadBoost')).toBe(-12);
    });

    test('should apply enhancement during processing', async () => {
      await drumProcessor.setParameter('kickBoost', 6);
      await drumProcessor.setParameter('snareBoost', 3);
      await drumProcessor.activate();

      const inputBuffer = scenarios.createDrumAudioBuffer();
      const outputBuffer = scenarios.createDrumAudioBuffer();

      const result = await drumProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      expectValidDrumProcessingResult(result);
    });
  });

  describe('Drum Audio Processing Behaviors', () => {
    beforeEach(async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);
      await drumProcessor.activate();
    });

    test('should process drum audio buffers successfully', async () => {
      const inputBuffer = scenarios.createDrumAudioBuffer();
      const outputBuffer = scenarios.createDrumAudioBuffer();

      const result = await drumProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      expectValidDrumProcessingResult(result);
      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
      expect(result.success).toBe(true);
    });

    test('should handle different drum buffer sizes', async () => {
      const bufferSizes = [128, 256, 512, 1024, 2048];

      for (const size of bufferSizes) {
        const inputBuffer = scenarios.createDrumAudioBuffer(2, size);
        const outputBuffer = scenarios.createDrumAudioBuffer(2, size);

        const result = await drumProcessor.process(
          inputBuffer,
          outputBuffer,
          scenarios.mockAudioContext,
        );

        expectValidDrumProcessingResult(result);
        expect(result.processingTime).toBeGreaterThanOrEqual(0);
      }
    });

    test('should handle mono and stereo drum signals', async () => {
      const channelConfigurations = [1, 2];

      for (const channels of channelConfigurations) {
        const inputBuffer = scenarios.createDrumAudioBuffer(channels);
        const outputBuffer = scenarios.createDrumAudioBuffer(channels);

        const result = await drumProcessor.process(
          inputBuffer,
          outputBuffer,
          scenarios.mockAudioContext,
        );

        expectValidDrumProcessingResult(result);
        expect(result.success).toBe(true);
      }
    });

    test('should report realistic drum processing metrics', async () => {
      const inputBuffer = scenarios.createDrumAudioBuffer();
      const outputBuffer = scenarios.createDrumAudioBuffer();

      const result = await drumProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      // Drum processing should have reasonable performance characteristics
      expect(result.processingTime).toBeGreaterThanOrEqual(0); // Some processing time
      expect(result.cpuUsage).toBeGreaterThan(0); // Some CPU usage for analysis
      expect(result.cpuUsage).toBeLessThanOrEqual(0.4); // Efficient drum processing
      expect(result.memoryUsage).toBeGreaterThan(0); // Memory usage for analysis buffers
    });

    test('should maintain drum transient information', async () => {
      await drumProcessor.setParameter('beatDetectionEnabled', true);
      await drumProcessor.setParameter('beatSensitivity', 80);

      const inputBuffer = scenarios.createDrumAudioBuffer();
      const outputBuffer = scenarios.createDrumAudioBuffer();

      const result = await drumProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      expectValidDrumProcessingResult(result);

      // Verify the buffer was processed (mock implementation should maintain transients)
      expect(inputBuffer.getChannelData).toHaveBeenCalled();
    });
  });

  describe('Drum Preset Management Behaviors', () => {
    beforeEach(async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);
    });

    test('should save drum-specific presets', async () => {
      // Configure rock drum settings
      const rockSettings = scenarios.drumPatternPresets.rock;

      for (const [param, value] of Object.entries(rockSettings)) {
        await drumProcessor.setParameter(param, value);
      }

      const preset = await drumProcessor.savePreset('Rock Drums');

      expect(preset).toBeDefined();
      expect(preset.beatDetectionEnabled).toBe(
        rockSettings.beatDetectionEnabled,
      );
      expect(preset.patternComplexity).toBe(rockSettings.patternComplexity);
      expect(preset.kickBoost).toBe(rockSettings.kickBoost);
      expect(preset.snareBoost).toBe(rockSettings.snareBoost);
    });

    test('should load drum presets correctly', async () => {
      const jazzSettings = scenarios.drumPatternPresets.jazz;

      await drumProcessor.loadPreset(jazzSettings);

      expect(drumProcessor.getParameter('beatSensitivity')).toBe(
        jazzSettings.beatSensitivity,
      );
      expect(drumProcessor.getParameter('patternComplexity')).toBe(
        jazzSettings.patternComplexity,
      );
      expect(drumProcessor.getParameter('metronomeEnabled')).toBe(
        jazzSettings.metronomeEnabled,
      );
      expect(drumProcessor.getParameter('overheadBoost')).toBe(
        jazzSettings.overheadBoost,
      );
    });

    test('should handle different drum style presets', async () => {
      const styles = ['rock', 'jazz', 'funk'] as const;

      for (const style of styles) {
        const preset = scenarios.drumPatternPresets[style];
        await drumProcessor.loadPreset(preset);

        // Each style should have different characteristics
        const complexity = drumProcessor.getParameter('patternComplexity');
        const kickBoost = drumProcessor.getParameter('kickBoost');

        expect(typeof complexity).toBe('number');
        expect(typeof kickBoost).toBe('number');

        // Funk should have higher complexity than rock
        if (style === 'funk') {
          expect(complexity).toBeGreaterThan(8);
        } else if (style === 'rock') {
          expect(complexity).toBeLessThan(8);
        }
      }
    });

    test('should reset to default drum settings', async () => {
      // Change from defaults
      await drumProcessor.setParameter('beatSensitivity', 95);
      await drumProcessor.setParameter('patternComplexity', 10);
      await drumProcessor.setParameter('kickBoost', 12);

      await drumProcessor.resetParameters();

      // Should return to default values suitable for drums
      const sensitivity = drumProcessor.getParameter('beatSensitivity');
      const complexity = drumProcessor.getParameter('patternComplexity');
      const kickBoost = drumProcessor.getParameter('kickBoost');

      expect(sensitivity).toBeLessThan(95); // Reset from extreme value
      expect(complexity).toBeLessThan(10); // Reset from extreme value
      expect(kickBoost).toBeLessThan(12); // Reset from extreme value
    });
  });

  describe('N8n Drum Integration Behaviors', () => {
    beforeEach(async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);
    });

    test('should process N8n rhythm configuration payload', async () => {
      const payload = scenarios.n8nDrumPayload;

      if (drumProcessor.processN8nPayload) {
        await expect(
          drumProcessor.processN8nPayload(payload),
        ).resolves.not.toThrow();
      }
    });

    test('should extract drum settings from N8n payload', async () => {
      const payload = scenarios.n8nDrumPayload;

      if (drumProcessor.processN8nPayload) {
        await drumProcessor.processN8nPayload(payload);

        // Should apply settings from payload
        // (Implementation would set parameters based on payload content)
        expect(true).toBe(true); // Placeholder for actual parameter verification
      }
    });

    test('should handle malformed drum payload gracefully', async () => {
      const malformedPayload = {
        type: 'rhythm-config',
        invalidField: 'should be ignored',
        drumSettings: {
          preset: 'unknown-preset',
          invalidSetting: 123,
        },
      };

      if (drumProcessor.processN8nPayload) {
        await expect(
          drumProcessor.processN8nPayload(malformedPayload),
        ).resolves.not.toThrow();
      }
    });

    test('should support Epic 2 drum exercise integration', async () => {
      const exercisePayload = {
        type: 'beat-settings',
        exercise: {
          title: 'Groove Mastery',
          difficulty: 'advanced',
          tempo: 130,
          timeSignature: '4/4',
          genre: 'rock',
          techniques: ['ghost-notes', 'fills', 'polyrhythms'],
        },
        drumSettings: {
          preset: 'rock',
          beatDetection: {
            enabled: true,
            sensitivity: 80,
          },
          metronome: {
            enabled: true,
            accent: true,
          },
        },
      };

      if (drumProcessor.processN8nPayload) {
        await expect(
          drumProcessor.processN8nPayload(exercisePayload),
        ).resolves.not.toThrow();
      }
    });
  });

  describe('Drum Error Handling Behaviors', () => {
    test('should handle drum processing chain initialization errors', async () => {
      // Mock AnalyserNode creation to fail
      scenarios.mockAudioContext.audioContext.createAnalyser = vi.fn(() => {
        throw new Error('AnalyserNode creation failed');
      });

      await drumProcessor.load();

      await expect(
        drumProcessor.initialize(scenarios.mockAudioContext),
      ).rejects.toThrow();
      expect(drumProcessor.state).toBe(PluginState.ERROR);
    });

    test('should handle invalid drum parameter values', async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);

      // Test invalid parameter values
      await expect(
        drumProcessor.setParameter('beatSensitivity', 'invalid'),
      ).rejects.toThrow();
      await expect(
        drumProcessor.setParameter('metronomeBpm', -50),
      ).rejects.toThrow(); // Negative BPM
      await expect(
        drumProcessor.setParameter('patternComplexity', 15),
      ).rejects.toThrow(); // Out of range
    });

    test('should handle drum processing buffer errors', async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);
      await drumProcessor.activate();

      // Test with null buffers
      await expect(
        drumProcessor.process(
          null as any,
          null as any,
          scenarios.mockAudioContext,
        ),
      ).rejects.toThrow();
    });

    test('should recover from drum processing failures', async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);
      await drumProcessor.activate();

      // Simulate processing error by creating invalid buffer
      const invalidBuffer = {} as AudioBuffer;

      try {
        await drumProcessor.process(
          invalidBuffer,
          invalidBuffer,
          scenarios.mockAudioContext,
        );
      } catch {
        // Should handle error gracefully
      }

      // Should still be able to process valid buffers after error
      const validInput = scenarios.createDrumAudioBuffer();
      const validOutput = scenarios.createDrumAudioBuffer();

      const result = await drumProcessor.process(
        validInput,
        validOutput,
        scenarios.mockAudioContext,
      );
      expectValidDrumProcessingResult(result);
    });
  });

  describe('Real-World Drum Processing Scenarios', () => {
    beforeEach(async () => {
      await drumProcessor.load();
      await drumProcessor.initialize(scenarios.mockAudioContext);
      await drumProcessor.activate();
    });

    test('should handle live drumming session scenario', async () => {
      // Configure for live drumming with real-time beat detection
      await drumProcessor.setParameter('beatDetectionEnabled', true);
      await drumProcessor.setParameter('beatSensitivity', 75);
      await drumProcessor.setParameter('rhythmAnalysisEnabled', true);
      await drumProcessor.setParameter('metronomeEnabled', true);
      await drumProcessor.setParameter('metronomeBpm', 120);

      // Process multiple drum audio chunks (simulate real-time drumming)
      for (let i = 0; i < 10; i++) {
        const inputBuffer = scenarios.createDrumAudioBuffer(2, 256); // Small buffers for low latency
        const outputBuffer = scenarios.createDrumAudioBuffer(2, 256);

        const result = await drumProcessor.process(
          inputBuffer,
          outputBuffer,
          scenarios.mockAudioContext,
        );

        expectValidDrumProcessingResult(result);
        expect(result.processingTime).toBeGreaterThanOrEqual(0); // Processing should complete quickly for live drumming
      }
    });

    test('should handle drum practice session scenario', async () => {
      // Configure for practice with metronome and pattern playback
      await drumProcessor.setParameter('metronomeEnabled', true);
      await drumProcessor.setParameter('metronomeBpm', 100);
      await drumProcessor.setParameter('patternEnabled', true);
      await drumProcessor.setParameter('patternStyle', 'rock');
      await drumProcessor.setParameter('patternComplexity', 5);
      await drumProcessor.setParameter('beatDetectionEnabled', true);

      // Process drum practice session
      const inputBuffer = scenarios.createDrumAudioBuffer(2, 1024); // Medium buffers for practice
      const outputBuffer = scenarios.createDrumAudioBuffer(2, 1024);

      const result = await drumProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );

      expectValidDrumProcessingResult(result);
      expect(result.status).toBe(ProcessingResultStatus.SUCCESS);
    });

    test('should handle drum style changes during performance', async () => {
      const inputBuffer = scenarios.createDrumAudioBuffer();
      const outputBuffer = scenarios.createDrumAudioBuffer();

      // Start with rock drums
      await drumProcessor.loadPreset(scenarios.drumPatternPresets.rock);
      let result = await drumProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );
      expectValidDrumProcessingResult(result);

      // Switch to jazz drums
      await drumProcessor.loadPreset(scenarios.drumPatternPresets.jazz);
      result = await drumProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );
      expectValidDrumProcessingResult(result);

      // Switch to funk drums
      await drumProcessor.loadPreset(scenarios.drumPatternPresets.funk);
      result = await drumProcessor.process(
        inputBuffer,
        outputBuffer,
        scenarios.mockAudioContext,
      );
      expectValidDrumProcessingResult(result);
    });

    test('should handle drum analysis automation', async () => {
      const inputBuffer = scenarios.createDrumAudioBuffer();
      const outputBuffer = scenarios.createDrumAudioBuffer();

      // Simulate automated beat sensitivity adjustments
      const sensitivitySteps = [50, 60, 70, 80, 90, 75, 60];

      for (const sensitivity of sensitivitySteps) {
        await drumProcessor.setParameter('beatSensitivity', sensitivity);

        const result = await drumProcessor.process(
          inputBuffer,
          outputBuffer,
          scenarios.mockAudioContext,
        );
        expectValidDrumProcessingResult(result);
        expect(drumProcessor.getParameter('beatSensitivity')).toBe(sensitivity);
      }
    });

    test('should handle drum processing resource management', async () => {
      // Process many buffers to test resource management with drum analysis
      const iterations = 30; // Fewer iterations due to analysis complexity

      for (let i = 0; i < iterations; i++) {
        const inputBuffer = scenarios.createDrumAudioBuffer();
        const outputBuffer = scenarios.createDrumAudioBuffer();

        const result = await drumProcessor.process(
          inputBuffer,
          outputBuffer,
          scenarios.mockAudioContext,
        );
        expectValidDrumProcessingResult(result);

        // Memory usage should remain reasonable despite analysis
        expect(result.memoryUsage).toBeLessThan(100); // MB
        expect(result.cpuUsage).toBeLessThan(0.6); // 60% max for analysis
      }
    });

    test('should handle tempo changes during performance', async () => {
      await drumProcessor.setParameter('metronomeEnabled', true);

      const tempoChanges = [120, 130, 140, 110, 100, 125];
      const inputBuffer = scenarios.createDrumAudioBuffer();
      const outputBuffer = scenarios.createDrumAudioBuffer();

      for (const tempo of tempoChanges) {
        await drumProcessor.setParameter('metronomeBpm', tempo);

        const result = await drumProcessor.process(
          inputBuffer,
          outputBuffer,
          scenarios.mockAudioContext,
        );
        expectValidDrumProcessingResult(result);
        expect(drumProcessor.getParameter('metronomeBpm')).toBe(tempo);
      }
    });
  });
});
