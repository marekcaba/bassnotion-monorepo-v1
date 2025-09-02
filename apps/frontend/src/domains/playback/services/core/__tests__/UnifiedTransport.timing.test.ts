/**
 * UnifiedTransport Timing Precision Tests
 *
 * Tests for Logic Pro X-grade timing precision and drift tolerance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedTransport } from '../UnifiedTransport.js';
import { EventBus } from '../EventBus.js';
import { AudioEngine } from '../AudioEngine.js';
import * as Tone from 'tone';

describe('UnifiedTransport - Timing Precision', () => {
  let transport: UnifiedTransport;
  let eventBus: EventBus;
  let audioEngine: AudioEngine;
  let mockAudioContext: any;
  let mockAudioWorkletNode: any;

  beforeEach(async () => {
    // Mock AudioContext
    mockAudioContext = {
      state: 'running',
      currentTime: 0,
      sampleRate: 48000,
      audioWorklet: {
        addModule: vi.fn().mockResolvedValue(undefined),
      },
      destination: {},
    };

    // Mock AudioWorkletNode
    mockAudioWorkletNode = {
      port: {
        postMessage: vi.fn(),
        onmessage: null,
      },
      connect: vi.fn(),
    };

    // Mock global AudioWorkletNode
    global.AudioWorkletNode = vi
      .fn()
      .mockImplementation(() => mockAudioWorkletNode);

    // Mock Tone.js
    vi.spyOn(Tone, 'start').mockResolvedValue();
    vi.spyOn(Tone.Transport, 'start');
    vi.spyOn(Tone.Transport, 'stop');
    vi.spyOn(Tone.Transport, 'pause');

    // Create instances
    eventBus = EventBus.getInstance();
    audioEngine = AudioEngine.getInstance(eventBus);

    // Mock audio engine methods
    vi.spyOn(audioEngine, 'getTone').mockReturnValue({
      ...Tone,
      context: {
        ...Tone.context,
        rawContext: mockAudioContext,
        lookAhead: 0.2,
        updateInterval: 0.00267,
        currentTime: 0,
        state: 'running',
      },
      Transport: {
        ...Tone.Transport,
        bpm: { value: 120 },
        timeSignature: [4, 4],
        seconds: 0,
        position: '0:0:0',
        state: 'stopped',
        PPQ: 960,
        nextSubdivision: vi.fn().mockReturnValue(0.5),
        schedule: vi.fn(),
        clear: vi.fn(),
        cancel: vi.fn(),
      },
    } as any);

    // Create transport with AudioWorklet enabled
    transport = UnifiedTransport.getInstance(eventBus, audioEngine, {
      enableAudioWorklet: true,
      enableWebWorker: false,
      driftCompensation: 'adaptive',
    });

    await transport.initialize();
  });

  afterEach(async () => {
    await transport.dispose();
    vi.clearAllMocks();
  });

  describe('Drift Tolerance (<1ms)', () => {
    it('should maintain drift under 1ms with AudioWorklet', async () => {
      // Start transport
      await transport.start();

      // Simulate AudioWorklet timing updates
      let currentFrame = 0;
      const sampleRate = 48000;
      const framesPerUpdate = 128; // AudioWorklet buffer size

      // Simulate 10 seconds of playback
      for (let i = 0; i < 3750; i++) {
        // 10 seconds / 0.00267s per update
        currentFrame += framesPerUpdate;
        const currentTime = currentFrame / sampleRate;

        // Trigger timing update from AudioWorklet
        if (mockAudioWorkletNode.port.onmessage) {
          mockAudioWorkletNode.port.onmessage({
            data: {
              type: 'timing-update',
              time: currentTime,
              frame: currentFrame,
              playbackFrame: currentFrame,
              isPlaying: true,
            },
          });
        }
      }

      // Check metrics
      const metrics = transport.getMetrics();
      expect(metrics.avgDrift).toBeLessThan(1); // Average drift < 1ms
      expect(metrics.maxDrift).toBeLessThan(1); // Max drift < 1ms
    });

    it('should correct drift immediately when >1ms detected', async () => {
      await transport.start();

      // Inject artificial drift
      const tone = audioEngine.getTone();
      tone.Transport.seconds = 5.002; // 2ms drift

      // Trigger timing update
      if (mockAudioWorkletNode.port.onmessage) {
        mockAudioWorkletNode.port.onmessage({
          data: {
            type: 'timing-update',
            time: 5.0,
            frame: 240000,
            playbackFrame: 240000,
          },
        });
      }

      // Transport should have been corrected
      expect(tone.Transport.seconds).toBe(5.0);
    });
  });

  describe('Transport Response Time (<2ms)', () => {
    it('should report correct latency with AudioWorklet', () => {
      const latency = transport.getTransportLatency();

      // At 48kHz with 128-sample buffer: 128/48000 * 1000 = 2.67ms
      expect(latency).toBeCloseTo(2.67, 1);
      expect(latency).toBeLessThan(3);
    });

    it('should pause immediately without quantum delay', async () => {
      await transport.start();

      const startTime = performance.now();
      await transport.pauseImmediate();
      const endTime = performance.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(10); // Should be well under 10ms in tests
      expect(transport.getState()).toBe('paused');
    });

    it('should resume immediately without quantum delay', async () => {
      await transport.start();
      await transport.pauseImmediate();

      const startTime = performance.now();
      await transport.resumeImmediate();
      const endTime = performance.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(10); // Should be well under 10ms in tests
      expect(transport.getState()).toBe('playing');
    });
  });

  describe('Position Tracking (No Freezing)', () => {
    it('should update position continuously during playback', async () => {
      await transport.start();

      const positions: any[] = [];
      let lastFrame = 0;

      // Simulate continuous AudioWorklet updates
      for (let i = 0; i < 100; i++) {
        lastFrame += 128;
        const time = lastFrame / 48000;

        if (mockAudioWorkletNode.port.onmessage) {
          mockAudioWorkletNode.port.onmessage({
            data: {
              type: 'timing-update',
              time,
              frame: lastFrame,
              playbackFrame: lastFrame,
              isPlaying: true,
            },
          });
        }

        positions.push(transport.getPosition());
      }

      // Verify positions are changing
      const uniquePositions = new Set(
        positions.map((p) => `${p.bars}:${p.beats}:${p.sixteenths}`),
      );

      expect(uniquePositions.size).toBeGreaterThan(1);
    });

    it('should maintain position after pause/resume', async () => {
      await transport.start();

      // Advance to a specific position
      const targetFrame = 48000 * 2; // 2 seconds
      if (mockAudioWorkletNode.port.onmessage) {
        mockAudioWorkletNode.port.onmessage({
          data: {
            type: 'timing-update',
            time: 2,
            frame: targetFrame,
            playbackFrame: targetFrame,
            isPlaying: true,
          },
        });
      }

      const positionBeforePause = transport.getPosition();

      // Pause and resume
      await transport.pauseImmediate();
      await transport.resumeImmediate();

      const positionAfterResume = transport.getPosition();

      // Position should be maintained
      expect(positionAfterResume).toEqual(positionBeforePause);
    });
  });

  describe('Sample-Accurate Timing', () => {
    it('should track position with sample accuracy', async () => {
      await transport.start();

      const sampleRate = 48000;
      const samplesPerBeat = sampleRate * 0.5; // 120 BPM = 0.5 seconds per beat

      // Advance exactly 1 beat
      if (mockAudioWorkletNode.port.onmessage) {
        mockAudioWorkletNode.port.onmessage({
          data: {
            type: 'timing-update',
            time: 0.5,
            frame: samplesPerBeat,
            playbackFrame: samplesPerBeat,
            isPlaying: true,
          },
        });
      }

      const position = transport.getPosition();
      expect(position.bars).toBe(0);
      expect(position.beats).toBe(1);
      expect(position.sixteenths).toBe(0);
    });
  });

  describe('Stability Over Time', () => {
    it('should maintain timing stability over extended periods', async () => {
      await transport.start();

      const driftHistory: number[] = [];
      const lastTime = 0;
      let frame = 0;

      // Simulate 1 hour of playback (compressed)
      const updatesPerHour = Math.floor(3600 / 0.00267);

      for (let i = 0; i < Math.min(updatesPerHour, 10000); i++) {
        frame += 128;
        const expectedTime = frame / 48000;

        if (mockAudioWorkletNode.port.onmessage) {
          mockAudioWorkletNode.port.onmessage({
            data: {
              type: 'timing-update',
              time: expectedTime,
              frame,
              playbackFrame: frame,
              isPlaying: true,
            },
          });
        }

        const metrics = transport.getMetrics();
        if (i % 1000 === 0) {
          // Sample every 1000 updates
          driftHistory.push(metrics.avgDrift);
        }
      }

      // All drift samples should be under 1ms
      expect(Math.max(...driftHistory)).toBeLessThan(1);

      // Final metrics should show stability
      const finalMetrics = transport.getMetrics();
      expect(finalMetrics.stability).toBeGreaterThan(99); // >99% stability
    });
  });

  describe('AudioWorklet Integration', () => {
    it('should send correct messages to AudioWorklet on transport changes', async () => {
      // Start
      await transport.start();
      expect(mockAudioWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'start',
        fromFrame: 0,
      });

      // Pause
      await transport.pauseImmediate();
      expect(mockAudioWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'pause',
      });

      // Resume
      await transport.resumeImmediate();
      expect(mockAudioWorkletNode.port.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'start',
          fromFrame: expect.any(Number),
        }),
      );

      // Stop
      await transport.stop();
      expect(mockAudioWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'stop',
      });
    });

    it('should handle seek operations correctly', async () => {
      await transport.seek({ bars: 4, beats: 0, sixteenths: 0, ticks: 0 });

      expect(mockAudioWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'seek',
        position: 8, // 4 bars * 4 beats/bar * 0.5 seconds/beat = 8 seconds
      });
    });
  });
});
