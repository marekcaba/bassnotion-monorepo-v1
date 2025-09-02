/**
 * Transport compatibility test
 * Verifies that the new Transport provides all methods needed by UnifiedTransport
 */

import { describe, it, expect } from 'vitest';
import { Transport } from '../core/Transport.js';
import { TransportWithEventBus } from '../core/TransportWithEventBus.js';

describe('Transport API Compatibility', () => {
  const transport = new Transport();

  describe('required methods exist', () => {
    // Core lifecycle methods
    it('should have initialize method', () => {
      expect(transport.initialize).toBeDefined();
      expect(typeof transport.initialize).toBe('function');
    });

    it('should have start method', () => {
      expect(transport.start).toBeDefined();
      expect(typeof transport.start).toBe('function');
    });

    it('should have stop method', () => {
      expect(transport.stop).toBeDefined();
      expect(typeof transport.stop).toBe('function');
    });

    it('should have pause method', () => {
      expect(transport.pause).toBeDefined();
      expect(typeof transport.pause).toBe('function');
    });

    it('should have resume method', () => {
      expect(transport.resume).toBeDefined();
      expect(typeof transport.resume).toBe('function');
    });

    it('should have seek method', () => {
      expect(transport.seek).toBeDefined();
      expect(typeof transport.seek).toBe('function');
    });

    // State and position methods
    it('should have getState method', () => {
      expect(transport.getState).toBeDefined();
      expect(typeof transport.getState).toBe('function');
    });

    it('should have getPosition method', () => {
      expect(transport.getPosition).toBeDefined();
      expect(typeof transport.getPosition).toBe('function');
    });

    it('should have getTransportPosition method', () => {
      expect(transport.getTransportPosition).toBeDefined();
      expect(typeof transport.getTransportPosition).toBe('function');
    });

    // Tempo and timing methods
    it('should have setTempo method', () => {
      expect(transport.setTempo).toBeDefined();
      expect(typeof transport.setTempo).toBe('function');
    });

    it('should have getTempo method', () => {
      expect(transport.getTempo).toBeDefined();
      expect(typeof transport.getTempo).toBe('function');
    });

    // Scheduling methods
    it('should have schedule method', () => {
      expect(transport.schedule).toBeDefined();
      expect(typeof transport.schedule).toBe('function');
    });

    it('should have scheduleEvent method', () => {
      expect(transport.scheduleEvent).toBeDefined();
      expect(typeof transport.scheduleEvent).toBe('function');
    });

    it('should have scheduleRepeat method', () => {
      expect(transport.scheduleRepeat).toBeDefined();
      expect(typeof transport.scheduleRepeat).toBe('function');
    });

    it('should have cancelEvent method', () => {
      expect(transport.cancelEvent).toBeDefined();
      expect(typeof transport.cancelEvent).toBe('function');
    });

    // Loop methods
    it('should have setLoopEnabled method', () => {
      expect(transport.setLoopEnabled).toBeDefined();
      expect(typeof transport.setLoopEnabled).toBe('function');
    });

    it('should have setLoopPoints method', () => {
      expect(transport.setLoopPoints).toBeDefined();
      expect(typeof transport.setLoopPoints).toBe('function');
    });

    // Metrics and debugging
    it('should have getMetrics method', () => {
      expect(transport.getMetrics).toBeDefined();
      expect(typeof transport.getMetrics).toBe('function');
    });

    // Cleanup
    it('should have dispose method', () => {
      expect(transport.dispose).toBeDefined();
      expect(typeof transport.dispose).toBe('function');
    });
  });

  describe('TransportWithEventBus compatibility', () => {
    const mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    const transportWithEvents = new TransportWithEventBus(mockEventBus);

    it('should have all base Transport methods', () => {
      // Check that it extends Transport properly
      expect(transportWithEvents).toBeInstanceOf(Transport);
    });

    it('should emit events on state changes', async () => {
      const mockAudioContext = {
        currentTime: 0,
        sampleRate: 48000,
        baseLatency: 0.01,
        outputLatency: 0.02,
        state: 'running',
      };

      await transportWithEvents.initialize(mockAudioContext as any);
      await transportWithEvents.start();

      expect(mockEventBus.emit).toHaveBeenCalledWith('transport:start', expect.any(Object));
    });
  });

  describe('return types match expectations', () => {
    it('getState should return transport state', () => {
      const state = transport.getState();
      expect(['stopped', 'playing', 'paused']).toContain(state);
    });

    it('getPosition should return musical position', () => {
      const position = transport.getPosition();
      expect(position).toHaveProperty('bars');
      expect(position).toHaveProperty('beats');
      expect(position).toHaveProperty('sixteenths');
      expect(position).toHaveProperty('ticks');
    });

    it('getTempo should return number', () => {
      const tempo = transport.getTempo();
      expect(typeof tempo).toBe('number');
    });

    it('getMetrics should return timing metrics', () => {
      const metrics = transport.getMetrics();
      expect(metrics).toHaveProperty('stability');
      expect(metrics).toHaveProperty('avgDrift');
      expect(metrics).toHaveProperty('totalEvents');
    });
  });
});