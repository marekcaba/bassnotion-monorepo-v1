/**
 * Transport integration test
 * Verifies all components work together correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Transport } from '../core/Transport.js';
import { TransportConfig } from '../types/index.js';

// Mock Tone.js
vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
  Transport: {
    bpm: {
      value: 120,
    },
    schedule: vi.fn(() => 'mock-schedule-id'),
    scheduleRepeat: vi.fn(() => 'mock-schedule-repeat-id'),
    clear: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    state: 'stopped',
    seconds: 0,
    position: '0:0:0',
    loop: false,
    loopStart: '0:0:0',
    loopEnd: '1:0:0',
  },
  getContext: vi.fn(() => ({})),
  context: {},
}));

// Mock AudioContext
class MockAudioContext {
  currentTime = 0;
  sampleRate = 48000;
  baseLatency = 0.01;
  outputLatency = 0.02;
  state: 'suspended' | 'running' | 'closed' = 'running';

  constructor() {
    // Simulate time progression
    setInterval(() => {
      if (this.state === 'running') {
        this.currentTime += 0.001;
      }
    }, 1);
  }
}

describe('Transport Integration', () => {
  let transport: Transport;
  let mockAudioContext: MockAudioContext;

  beforeEach(async () => {
    mockAudioContext = new MockAudioContext();
    transport = new Transport({
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
    });
  });

  afterEach(() => {
    transport.dispose();
  });

  describe('basic lifecycle', () => {
    it('should initialize, start, stop', async () => {
      // Initialize
      await transport.initialize(mockAudioContext as any);

      // Verify initial state
      expect(transport.getState()).toBe('stopped');
      expect(transport.getPosition()).toEqual({
        bars: 0,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      });

      // Start
      await transport.start();
      expect(transport.getState()).toBe('playing');

      // Stop
      await transport.stop();
      expect(transport.getState()).toBe('stopped');
    });

    it('should handle pause and resume', async () => {
      await transport.initialize(mockAudioContext as any);
      await transport.start();

      // Pause
      await transport.pause();
      expect(transport.getState()).toBe('paused');

      // Resume
      await transport.resume();
      expect(transport.getState()).toBe('playing');
    });
  });

  describe('position management', () => {
    it('should seek to position', async () => {
      await transport.initialize(mockAudioContext as any);

      const targetPosition = {
        bars: 2,
        beats: 3,
        sixteenths: 1,
        ticks: 0,
      };

      await transport.seek(targetPosition);

      const position = transport.getPosition();
      expect(position).toEqual(targetPosition);
    });

    it('should get transport position with time', async () => {
      await transport.initialize(mockAudioContext as any);

      const position = transport.getTransportPosition();
      expect(position).toHaveProperty('seconds');
      expect(position).toHaveProperty('bars');
      expect(position).toHaveProperty('beats');
    });
  });

  describe('tempo management', () => {
    it('should set and get tempo', async () => {
      await transport.initialize(mockAudioContext as any);

      transport.setTempo(140);
      expect(transport.getTempo()).toBe(140);
    });
  });

  describe('event scheduling', () => {
    it('should schedule and cancel events', async () => {
      await transport.initialize(mockAudioContext as any);

      const callback = vi.fn();
      const eventId = transport.schedule(callback, 1.0);

      expect(eventId).toBeDefined();

      // Cancel should not throw
      expect(() => transport.cancelEvent(eventId)).not.toThrow();
    });

    it('should schedule repeating events', async () => {
      await transport.initialize(mockAudioContext as any);

      const callback = vi.fn();
      const eventId = transport.scheduleRepeat(callback, '4n');

      expect(eventId).toBeDefined();

      // Cancel should work
      transport.cancelEvent(eventId);
    });
  });

  describe('loop functionality', () => {
    it('should set loop points', async () => {
      await transport.initialize(mockAudioContext as any);

      const loopStart = { bars: 0, beats: 0, sixteenths: 0, ticks: 0 };
      const loopEnd = { bars: 4, beats: 0, sixteenths: 0, ticks: 0 };

      // Should not throw
      transport.setLoopPoints(loopStart, loopEnd);
      transport.setLoopEnabled(true);
    });
  });

  describe('metrics and debugging', () => {
    it('should provide timing metrics', async () => {
      await transport.initialize(mockAudioContext as any);

      const metrics = transport.getMetrics();

      expect(metrics).toHaveProperty('stability');
      expect(metrics).toHaveProperty('totalEvents');
      expect(metrics).toHaveProperty('cpuLoad');
      expect(metrics.stability).toBeGreaterThanOrEqual(0);
      expect(metrics.stability).toBeLessThanOrEqual(100);
    });

    it('should provide scheduler stats', async () => {
      await transport.initialize(mockAudioContext as any);

      const stats = transport.getSchedulerStats();

      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('scheduledCount');
      expect(stats).toHaveProperty('isRunning');
    });

    it('should provide clock sync data', async () => {
      await transport.initialize(mockAudioContext as any);

      const syncData = transport.getClockSyncData();

      expect(syncData).toHaveProperty('audioTime');
      expect(syncData).toHaveProperty('systemTime');
      expect(syncData).toHaveProperty('offset');
      expect(syncData).toHaveProperty('confidence');
    });
  });

  describe('configuration updates', () => {
    it('should update configuration', async () => {
      await transport.initialize(mockAudioContext as any);

      transport.updateConfig({
        tempo: 140,
        timeSignature: { numerator: 3, denominator: 4 },
      });

      expect(transport.getTempo()).toBe(140);
    });
  });

  describe('error handling', () => {
    it('should throw when not initialized', async () => {
      await expect(transport.start()).rejects.toThrow(
        'Transport not initialized',
      );
    });

    it('should handle multiple initializations gracefully', async () => {
      await transport.initialize(mockAudioContext as any);

      // Second initialization should not throw
      await expect(
        transport.initialize(mockAudioContext as any),
      ).resolves.not.toThrow();
    });
  });
});
