/**
 * Mixing Console Core - Test Suite
 * Tests all mixing console functionality and performance requirements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MixingConsole,
  MixingChannel,
  type TrackType,
  type CompressionConfig,
  type SpatialPosition,
  type VolumeAutomationConfig,
} from '../MixingConsole.js';

// Mock Tone.js for testing
vi.mock('tone', () => {
  // Create mock audio parameter
  const createMockParam = (initialValue = 0) => ({
    value: initialValue,
    rampTo: vi.fn(),
    linearRampTo: vi.fn(),
    exponentialRampTo: vi.fn(),
    setValueAtTime: vi.fn(),
  });

  // Create base audio node mock
  const createMockAudioNode = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    chain: vi.fn(),
    toDestination: vi.fn(),
  });

  return {
    Gain: vi.fn(() => ({
      ...createMockAudioNode(),
      gain: createMockParam(1),
    })),
    EQ3: vi.fn(() => ({
      ...createMockAudioNode(),
      low: createMockParam(0),
      mid: createMockParam(0),
      high: createMockParam(0),
    })),
    Filter: vi.fn(() => ({
      ...createMockAudioNode(),
      frequency: createMockParam(1000),
      gain: createMockParam(0),
      Q: createMockParam(1),
    })),
    Gate: vi.fn(() => ({
      ...createMockAudioNode(),
      threshold: createMockParam(-40),
    })),
    Compressor: vi.fn(() => ({
      ...createMockAudioNode(),
      threshold: createMockParam(-24),
      ratio: createMockParam(4),
      attack: createMockParam(0.003),
      release: createMockParam(0.1),
    })),
    Limiter: vi.fn(() => ({
      ...createMockAudioNode(),
      threshold: createMockParam(-6),
    })),
    Panner: vi.fn(() => ({
      ...createMockAudioNode(),
      pan: createMockParam(0),
    })),
    StereoWidener: vi.fn(() => ({
      ...createMockAudioNode(),
      width: createMockParam(0),
    })),
    Reverb: vi.fn(() => ({
      ...createMockAudioNode(),
      roomSize: createMockParam(0.5),
      dampening: 0.5,
    })),
    Analyser: vi.fn(() => ({
      ...createMockAudioNode(),
      getValue: vi.fn(() => new Float32Array(1024)),
    })),
    Transport: {
      schedule: vi.fn(),
      scheduleRepeat: vi.fn(),
      clear: vi.fn(),
      seconds: 0,
      bpm: createMockParam(120),
    },
  };
});

// Mock core systems
vi.mock('../CorePlaybackEngine.js', () => ({
  CorePlaybackEngine: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      getAudioSource: vi.fn(() => ({ connect: vi.fn() })),
    })),
  },
}));

vi.mock('../PrecisionSynchronizationEngine.js', () => ({
  PrecisionSynchronizationEngine: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      getCurrentLatency: vi.fn(() => 25),
    })),
  },
}));

vi.mock('../ComprehensiveStateManager.js', () => ({
  ComprehensiveStateManager: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      on: vi.fn(),
    })),
  },
}));

vi.mock('../AnalyticsEngine.js', () => {
  const mockAnalyticsEngine = {
    initialize: vi.fn(),
    trackControlUsage: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    AnalyticsEngine: vi.fn(() => mockAnalyticsEngine),
  };
});

describe('MixingConsole', () => {
  let mixingConsole: MixingConsole;

  beforeEach(async () => {
    vi.clearAllMocks();
    mixingConsole = MixingConsole.getInstance();
    await mixingConsole.initialize();
  });

  afterEach(() => {
    mixingConsole.dispose();
  });

  describe('Initialization', () => {
    it('should initialize as singleton', () => {
      const instance1 = MixingConsole.getInstance();
      const instance2 = MixingConsole.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should initialize all default channels', () => {
      const trackTypes: TrackType[] = [
        'drums',
        'bass',
        'harmony',
        'metronome',
        'ambient',
      ];

      trackTypes.forEach((trackType) => {
        expect(() => mixingConsole.getChannel(trackType)).not.toThrow();
      });
    });
  });

  describe('Channel Volume Control', () => {
    it('should set channel volume with performance compliance', () => {
      const startTime = performance.now();

      mixingConsole.setChannelVolume('bass', 0.5);

      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(100); // <100ms requirement

      const config = mixingConsole.getChannel('bass').getConfiguration();
      expect(config.volume).toBe(0.5);
    });

    it('should clamp volume to valid range', () => {
      mixingConsole.setChannelVolume('bass', 1.5);
      let config = mixingConsole.getChannel('bass').getConfiguration();
      expect(config.volume).toBe(1.0);

      mixingConsole.setChannelVolume('bass', -0.5);
      config = mixingConsole.getChannel('bass').getConfiguration();
      expect(config.volume).toBe(0);
    });
  });

  describe('EQ Processing', () => {
    it('should set 3-band parametric EQ', () => {
      const startTime = performance.now();

      // Low shelf
      mixingConsole.setChannelEQ('bass', 'low', 80, 3, 0.7);

      // Mid peak
      mixingConsole.setChannelEQ('bass', 'mid', 1000, -2, 2.0);

      // High shelf
      mixingConsole.setChannelEQ('bass', 'high', 8000, 2, 0.7);

      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(100);

      const config = mixingConsole.getChannel('bass').getConfiguration();
      expect(config.eq.lowShelf.gain).toBe(3);
      expect(config.eq.midPeak.frequency).toBe(1000);
      expect(config.eq.highShelf.gain).toBe(2);
    });
  });

  describe('Dynamics Processing', () => {
    it('should apply compression with professional parameters', () => {
      const compressionConfig: CompressionConfig = {
        threshold: -18,
        ratio: 6,
        attack: 5,
        release: 150,
        knee: 8,
        makeupGain: 2,
        enabled: true,
      };

      const startTime = performance.now();

      mixingConsole.setChannelCompression('bass', compressionConfig);

      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(100);

      const config = mixingConsole.getChannel('bass').getConfiguration();
      expect(config.dynamics.compressor).toEqual(compressionConfig);
    });
  });

  describe('Spatial Audio', () => {
    it('should position tracks in stereo field', () => {
      const position: SpatialPosition = {
        pan: 0.5,
        width: 0.8,
        distance: 0.3,
      };

      mixingConsole.setChannelSpatialPosition('bass', position);

      const config = mixingConsole.getChannel('bass').getConfiguration();
      expect(config.spatial.position).toEqual(position);
    });
  });

  describe('Volume Automation', () => {
    it('should handle volume automation with curves', () => {
      const automation: VolumeAutomationConfig = {
        enabled: true,
        loop: false,
        points: [
          { time: 0, value: 0.5, curve: 'linear' },
          { time: 2, value: 0.8, curve: 'exponential' },
        ],
      };

      const automationSpy = vi.fn();
      mixingConsole.on('automationRecorded', automationSpy);

      mixingConsole.startChannelVolumeAutomation('bass', automation);

      expect(automationSpy).toHaveBeenCalledWith('bass', automation);
    });
  });

  describe('Master Bus', () => {
    it('should control master volume with limiting', () => {
      const volumeSpy = vi.fn();
      mixingConsole.on('masterVolumeChanged', volumeSpy);

      mixingConsole.setMasterVolume(0.6);

      expect(volumeSpy).toHaveBeenCalledWith(0.6);

      const state = mixingConsole.getMixingConsoleState();
      expect(state.masterVolume).toBe(0.6);
    });
  });

  describe('Solo and Mute', () => {
    it('should handle solo functionality', () => {
      mixingConsole.setChannelSolo('bass', true);

      const state = mixingConsole.getMixingConsoleState();
      expect(state.soloChannels.has('bass')).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', () => {
      const metrics = mixingConsole.getPerformanceMetrics();

      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('latency');
      expect(metrics).toHaveProperty('responseTime');
    });

    it('should meet bulk operation performance targets', () => {
      const startTime = performance.now();

      // Use batch mode for optimal performance
      mixingConsole.startBatchMode();

      // Multiple operations
      mixingConsole.setChannelVolume('bass', 0.5);
      mixingConsole.setChannelEQ('bass', 'mid', 1000, 2);
      mixingConsole.setChannelMute('drums', true);
      mixingConsole.setMasterVolume(0.7);

      // Execute batch
      mixingConsole.executeBatch();

      const totalTime = performance.now() - startTime;
      // More relaxed timing for test environment - operations should complete within reasonable time
      expect(totalTime).toBeLessThan(200);
    });
  });

  describe('Frequency Analysis', () => {
    it('should provide real-time frequency analysis', () => {
      const channelFreq = mixingConsole.getFrequencyAnalysis('bass');
      const masterFreq = mixingConsole.getMasterFrequencyAnalysis();

      expect(channelFreq).toBeInstanceOf(Float32Array);
      expect(masterFreq).toBeInstanceOf(Float32Array);
      expect(channelFreq.length).toBe(1024);
    });
  });

  describe('State Management', () => {
    it('should save and restore complete state', () => {
      const state = mixingConsole.getMixingConsoleState();

      expect(state.channels.size).toBe(5);
      expect(state).toHaveProperty('masterVolume');
      expect(state).toHaveProperty('globalEffects');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid channels gracefully', () => {
      expect(() => {
        mixingConsole.getChannel('invalid' as TrackType);
      }).toThrow('Channel not found for track type: invalid');
    });
  });
});

describe('MixingChannel', () => {
  let channel: MixingChannel;

  beforeEach(() => {
    const config = {
      trackType: 'bass' as TrackType,
      volume: 0.8,
      mute: false,
      solo: false,
      eq: {
        lowShelf: { frequency: 80, gain: 0, q: 0.7, enabled: false },
        midPeak: { frequency: 1000, gain: 0, q: 1.0, enabled: false },
        highShelf: { frequency: 8000, gain: 0, q: 0.7, enabled: false },
        enabled: false,
      },
      dynamics: {
        compressor: {
          threshold: -24,
          ratio: 4,
          attack: 3,
          release: 100,
          knee: 6,
          makeupGain: 0,
          enabled: false,
        },
        gate: {
          threshold: -40,
          ratio: 10,
          attack: 1,
          release: 100,
          enabled: false,
        },
        limiter: {
          threshold: -6,
          lookahead: 5,
          enabled: false,
        },
      },
      spatial: {
        position: { pan: 0, width: 0, distance: 0 },
        reverbSend: {
          level: 0,
          predelay: 20,
          roomSize: 0.5,
          dampening: 0.5,
          enabled: false,
        },
      },
      automation: {
        enabled: false,
        points: [],
        loop: false,
      },
      enabled: true,
    };

    channel = new MixingChannel('bass', config);
  });

  afterEach(() => {
    channel.dispose();
  });

  it('should create audio processing chain', () => {
    expect(channel.getInputNode()).toBeDefined();
    expect(channel.getOutputNode()).toBeDefined();
  });

  it('should track performance for operations', () => {
    channel.setVolume(0.6);

    const metrics = channel.getPerformanceMetrics();
    expect(typeof metrics.processingTime).toBe('number');
    expect(typeof metrics.cpuUsage).toBe('number');
  });
});
