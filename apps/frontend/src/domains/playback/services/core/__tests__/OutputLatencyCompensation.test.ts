/**
 * Output Latency Compensation Tests
 *
 * Test suite for the latency compensation system,
 * ensuring sample-accurate delay compensation across tracks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  OutputLatencyCompensation,
  LatencySource,
} from '../OutputLatencyCompensation.js';
import type { Track, TrackState } from '../../../types/track.js';
import { UnifiedTransport } from '../UnifiedTransport.js';
import { EventBus } from '../EventBus.js';
import { serviceRegistry } from '../ServiceRegistry.js';
import { TrackMixingEngine } from '../TrackMixingEngine.js';

// Import InstrumentType from the correct location
const InstrumentType = {
  BASS: 'bass',
  DRUMS: 'drums',
  CHORDS: 'chords',
  METRONOME: 'metronome',
} as const;

const TrackStates = {
  READY: 'READY' as TrackState,
};

// Mock dependencies
vi.mock('../UnifiedTransport.js');
vi.mock('../EventBus.js');
vi.mock('../ServiceRegistry.js');
vi.mock('../TrackMixingEngine.js');

describe('OutputLatencyCompensation', () => {
  let compensation: OutputLatencyCompensation;
  let mockTransport: any;
  let mockEventBus: any;
  let mockMixingEngine: any;
  let mockAudioContext: any;

  const createMockTrack = (id: string): Track => ({
    id,
    name: `Track ${id}`,
    color: '#000000',
    index: 0,
    instrumentType: InstrumentType.BASS,
    state: TrackStates.READY,
    musical: {
      timeSignature: { numerator: 4, denominator: 4 },
      velocityRange: { min: 0, max: 127 },
    },
    mixing: {
      volume: 1,
      pan: 0,
      mute: false,
      solo: false,
      recordArm: false,
      phaseInvert: false,
      delayCompensation: 0,
    },
    routing: {
      outputDestination: 'master',
      sends: [],
      inputMonitoring: false,
      listeningPoint: 'post-fader',
    },
    sync: {
      quantization: {
        enabled: false,
        gridSize: '1/16',
        strength: 1,
        swing: 0,
      },
      dependencies: [],
      priority: 1,
      humanization: 0,
      timingOffset: 0,
    },
    automation: [],
    plugins: [],
    patterns: [],
    metrics: {
      cpuUsage: 0,
      memoryUsage: 0,
      pluginCount: 0,
      voiceCount: 0,
      timingDrift: 0,
      droppedEvents: 0,
      lastUpdate: Date.now(),
    },
    metadata: {
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      version: '1.0.0',
    },
  });

  beforeEach(() => {
    // Reset singleton
    (OutputLatencyCompensation as any).instance = null;

    // Setup global window mock for setInterval
    global.window = {
      setInterval: vi.fn((callback, delay) => {
        return setInterval(callback, delay);
      }),
      clearInterval: vi.fn((id) => {
        clearInterval(id);
      }),
    } as any;

    // Setup mocks
    mockTransport = {
      getInstance: vi.fn().mockReturnThis(),
    };

    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    mockMixingEngine = {
      getTrack: vi.fn(),
    };

    mockAudioContext = {
      sampleRate: 48000,
      baseLatency: 0.01, // 10ms
      outputLatency: 0.02, // 20ms
    };

    // Setup service registry
    vi.mocked(serviceRegistry.get).mockImplementation((name) => {
      if (name === 'eventBus') return mockEventBus;
      if (name === 'mixingEngine') return mockMixingEngine;
      throw new Error(`Service not found: ${name}`);
    });

    vi.mocked(UnifiedTransport.getInstance).mockReturnValue(mockTransport);

    // Create instance
    compensation = OutputLatencyCompensation.getInstance();
  });

  afterEach(() => {
    compensation.dispose();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('initialization', () => {
    it('should initialize with audio context', async () => {
      await compensation.initialize(mockAudioContext);

      const report = compensation.getLatencyReport();
      expect(report.systemLatency).toBe(30); // baseLatency + outputLatency in ms
    });

    it('should start measurement timer in adaptive mode', async () => {
      vi.useFakeTimers();

      const adaptiveCompensation = OutputLatencyCompensation.getInstance({
        adaptiveMode: true,
        measurementInterval: 1000,
      });

      await adaptiveCompensation.initialize(mockAudioContext);

      // Fast forward time
      vi.advanceTimersByTime(1000);

      // Should attempt to measure tracks
      expect(mockMixingEngine.getTrack).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('track registration', () => {
    beforeEach(async () => {
      await compensation.initialize(mockAudioContext);
    });

    it('should register track for compensation', () => {
      const track = createMockTrack('track-1');

      compensation.registerTrack(track);

      const report = compensation.getLatencyReport();
      expect(report.trackLatencies.has('track-1')).toBe(true);

      const trackInfo = report.trackLatencies.get('track-1');
      expect(trackInfo).toBeDefined();
      expect(trackInfo?.trackId).toBe('track-1');
      expect(trackInfo?.totalLatencyMs).toBeGreaterThan(0);
    });

    it('should not register duplicate tracks', () => {
      const track = createMockTrack('track-1');

      compensation.registerTrack(track);
      compensation.registerTrack(track);

      const report = compensation.getLatencyReport();
      expect(report.trackLatencies.size).toBe(1);
    });

    it('should unregister track and clean up', () => {
      const track = createMockTrack('track-1');

      compensation.registerTrack(track);
      compensation.unregisterTrack('track-1');

      const report = compensation.getLatencyReport();
      expect(report.trackLatencies.has('track-1')).toBe(false);
    });
  });

  describe('latency measurement', () => {
    beforeEach(async () => {
      await compensation.initialize(mockAudioContext);
    });

    it('should update plugin latency', () => {
      const track = createMockTrack('track-1');
      compensation.registerTrack(track);

      // Add plugin latency (in samples)
      compensation.updatePluginLatency('track-1', 'plugin-1', 256);

      const report = compensation.getLatencyReport();
      const trackInfo = report.trackLatencies.get('track-1');

      expect(trackInfo?.measurements).toContainEqual(
        expect.objectContaining({
          source: 'plugin',
          sourceId: 'plugin-1',
          latencySamples: 256,
          latencyMs: (256 / 48000) * 1000,
        }),
      );
    });

    it('should calculate total track latency', () => {
      const track = createMockTrack('track-1');
      compensation.registerTrack(track);

      // Add multiple plugin latencies
      compensation.updatePluginLatency('track-1', 'plugin-1', 128);
      compensation.updatePluginLatency('track-1', 'plugin-2', 256);

      const report = compensation.getLatencyReport();
      const trackInfo = report.trackLatencies.get('track-1');

      // Total should include system + buffer + plugins
      const expectedLatency =
        (mockAudioContext.baseLatency + mockAudioContext.outputLatency) * 1000 + // System
        (128 / 48000) * 1000 + // Buffer
        (128 / 48000) * 1000 + // Plugin 1
        (256 / 48000) * 1000; // Plugin 2

      expect(trackInfo?.totalLatencyMs).toBeCloseTo(expectedLatency, 2);
    });

    it('should update existing plugin latency', () => {
      const track = createMockTrack('track-1');
      compensation.registerTrack(track);

      // Initial latency
      compensation.updatePluginLatency('track-1', 'plugin-1', 128);

      // Update latency
      compensation.updatePluginLatency('track-1', 'plugin-1', 256);

      const report = compensation.getLatencyReport();
      const trackInfo = report.trackLatencies.get('track-1');

      // Should only have one measurement for the plugin
      const pluginMeasurements = trackInfo?.measurements.filter(
        (m) => m.sourceId === 'plugin-1',
      );
      expect(pluginMeasurements?.length).toBe(1);
      expect(pluginMeasurements?.[0].latencySamples).toBe(256);
    });
  });

  describe('compensation calculation', () => {
    beforeEach(async () => {
      await compensation.initialize(mockAudioContext);
    });

    it('should calculate compensation delay for tracks', () => {
      const track1 = createMockTrack('track-1');
      const track2 = createMockTrack('track-2');

      compensation.registerTrack(track1);
      compensation.registerTrack(track2);

      // Track 1 has more latency
      compensation.updatePluginLatency('track-1', 'plugin-1', 512);

      // Track 2 has less latency
      compensation.updatePluginLatency('track-2', 'plugin-1', 128);

      const delay1 = compensation.getTrackCompensationDelay('track-1');
      const delay2 = compensation.getTrackCompensationDelay('track-2');

      // Track with less latency should have more compensation
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay1).toBe(0); // Track with max latency has no compensation
      expect(delay2).toBe(512 - 128); // Difference in samples
    });

    it('should align compensation to buffer boundaries when enabled', () => {
      const alignedCompensation = OutputLatencyCompensation.getInstance({
        bufferAlignment: true,
      });

      alignedCompensation.initialize(mockAudioContext);

      const track1 = createMockTrack('track-1');
      const track2 = createMockTrack('track-2');

      alignedCompensation.registerTrack(track1);
      alignedCompensation.registerTrack(track2);

      // Add latencies that don't align to 128 sample blocks
      alignedCompensation.updatePluginLatency('track-1', 'plugin-1', 300);
      alignedCompensation.updatePluginLatency('track-2', 'plugin-1', 100);

      const report = alignedCompensation.getLatencyReport();
      const trackInfo2 = report.trackLatencies.get('track-2');

      // Compensation should be aligned to 128 sample blocks
      expect(trackInfo2?.compensationDelaySamples).toBe(128); // Aligned to block size
    });
  });

  describe('audio processing', () => {
    beforeEach(async () => {
      await compensation.initialize(mockAudioContext);
    });

    it('should bypass compensation when disabled', () => {
      compensation.setEnabled(false);

      const track = createMockTrack('track-1');
      compensation.registerTrack(track);

      const inputBuffer = new AudioBuffer({
        numberOfChannels: 2,
        length: 128,
        sampleRate: 48000,
      });
      const outputBuffer = new AudioBuffer({
        numberOfChannels: 2,
        length: 128,
        sampleRate: 48000,
      });

      // Fill input with test data
      for (let ch = 0; ch < 2; ch++) {
        const data = inputBuffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.random();
        }
      }

      compensation.processWithCompensation(
        'track-1',
        inputBuffer,
        outputBuffer,
      );

      // Output should match input (no compensation)
      for (let ch = 0; ch < 2; ch++) {
        const input = inputBuffer.getChannelData(ch);
        const output = outputBuffer.getChannelData(ch);
        expect(output).toEqual(input);
      }
    });

    it('should bypass compensation in zero-latency monitoring mode', () => {
      compensation.setZeroLatencyMonitoring(true);

      const track = createMockTrack('track-1');
      compensation.registerTrack(track);
      compensation.updatePluginLatency('track-1', 'plugin-1', 256);

      const inputBuffer = new AudioBuffer({
        numberOfChannels: 2,
        length: 128,
        sampleRate: 48000,
      });
      const outputBuffer = new AudioBuffer({
        numberOfChannels: 2,
        length: 128,
        sampleRate: 48000,
      });

      compensation.processWithCompensation(
        'track-1',
        inputBuffer,
        outputBuffer,
      );

      // Should have no delay despite plugin latency
      const delay = compensation.getTrackCompensationDelay('track-1');
      expect(delay).toBe(0);
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await compensation.initialize(mockAudioContext);
    });

    it('should listen for WAM latency updates', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'wam:latency:updated',
        expect.any(Function),
      );

      // Get the handler
      const handler = mockEventBus.on.mock.calls.find(
        (call) => call[0] === 'wam:latency:updated',
      )?.[1];

      // Simulate WAM latency update
      const track = createMockTrack('track-1');
      compensation.registerTrack(track);

      handler({
        trackId: 'track-1',
        instanceId: 'wam-1',
        latency: 5.33, // ms
      });

      // Should convert ms to samples and update
      const expectedSamples = Math.round((5.33 * 48000) / 1000);
      const delay = compensation.getTrackCompensationDelay('track-1');

      const report = compensation.getLatencyReport();
      const trackInfo = report.trackLatencies.get('track-1');

      expect(trackInfo?.measurements).toContainEqual(
        expect.objectContaining({
          sourceId: 'wam-1',
          latencySamples: expectedSamples,
        }),
      );
    });

    it('should auto-register tracks on creation', () => {
      // Get the handler
      const handler = mockEventBus.on.mock.calls.find(
        (call) => call[0] === 'track:created',
      )?.[1];

      const track = createMockTrack('track-1');
      handler(track);

      const report = compensation.getLatencyReport();
      expect(report.trackLatencies.has('track-1')).toBe(true);
    });

    it('should auto-unregister tracks on removal', () => {
      const track = createMockTrack('track-1');
      compensation.registerTrack(track);

      // Get the handler
      const handler = mockEventBus.on.mock.calls.find(
        (call) => call[0] === 'track:removed',
      )?.[1];

      handler('track-1');

      const report = compensation.getLatencyReport();
      expect(report.trackLatencies.has('track-1')).toBe(false);
    });
  });

  describe('state management', () => {
    beforeEach(async () => {
      await compensation.initialize(mockAudioContext);
    });

    it('should toggle compensation enabled state', () => {
      compensation.setEnabled(false);

      const report = compensation.getLatencyReport();
      expect(report.isCompensating).toBe(false);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'latency:compensation:toggled',
        { enabled: false },
      );

      compensation.setEnabled(true);

      const report2 = compensation.getLatencyReport();
      expect(report2.isCompensating).toBe(true);
    });

    it('should toggle zero-latency monitoring', () => {
      const track1 = createMockTrack('track-1');
      const track2 = createMockTrack('track-2');

      compensation.registerTrack(track1);
      compensation.registerTrack(track2);

      // Add different latencies
      compensation.updatePluginLatency('track-1', 'plugin-1', 256);
      compensation.updatePluginLatency('track-2', 'plugin-1', 128);

      // Enable zero-latency monitoring
      compensation.setZeroLatencyMonitoring(true);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'latency:monitoring:toggled',
        { enabled: true },
      );

      // All tracks should have zero compensation
      expect(compensation.getTrackCompensationDelay('track-1')).toBe(0);
      expect(compensation.getTrackCompensationDelay('track-2')).toBe(0);

      // Disable zero-latency monitoring
      compensation.setZeroLatencyMonitoring(false);

      // Compensation should be restored
      expect(compensation.getTrackCompensationDelay('track-1')).toBe(0);
      expect(compensation.getTrackCompensationDelay('track-2')).toBeGreaterThan(
        0,
      );
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await compensation.initialize(mockAudioContext);
    });

    it('should handle many tracks efficiently', () => {
      const startTime = performance.now();

      // Register 100 tracks
      for (let i = 0; i < 100; i++) {
        const track = createMockTrack(`track-${i}`);
        compensation.registerTrack(track);

        // Add random plugin latencies
        const pluginCount = Math.floor(Math.random() * 5) + 1;
        for (let j = 0; j < pluginCount; j++) {
          compensation.updatePluginLatency(
            `track-${i}`,
            `plugin-${j}`,
            Math.floor(Math.random() * 512),
          );
        }
      }

      const registrationTime = performance.now() - startTime;

      // Should complete in reasonable time
      expect(registrationTime).toBeLessThan(100); // 100ms for 100 tracks

      // Get report
      const reportStart = performance.now();
      const report = compensation.getLatencyReport();
      const reportTime = performance.now() - reportStart;

      expect(report.trackLatencies.size).toBe(100);
      expect(reportTime).toBeLessThan(10); // Report should be fast
    });
  });

  describe('cleanup', () => {
    it('should dispose properly', async () => {
      vi.useFakeTimers();

      const adaptiveCompensation = OutputLatencyCompensation.getInstance({
        adaptiveMode: true,
        measurementInterval: 1000,
      });

      await adaptiveCompensation.initialize(mockAudioContext);

      const track = createMockTrack('track-1');
      adaptiveCompensation.registerTrack(track);

      adaptiveCompensation.dispose();

      // Fast forward - should not trigger timer
      vi.advanceTimersByTime(2000);

      // Should have cleared everything
      const report = adaptiveCompensation.getLatencyReport();
      expect(report.trackLatencies.size).toBe(0);

      vi.useRealTimers();
    });
  });
});
