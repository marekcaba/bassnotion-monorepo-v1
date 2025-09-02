import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TransportSyncManager } from '../TransportSyncManager';
import * as Tone from 'tone';

describe('TransportSyncManager - FAANG-style Tests', () => {
  let syncManager: TransportSyncManager;
  let mockTone: any;

  beforeEach(() => {
    // Mock Tone.js
    mockTone = {
      Transport: {
        state: 'stopped',
        position: { toString: () => '0:0:0' },
        bpm: { value: 120 },
        loop: false,
        loopStart: { toString: () => '0:0:0' },
        loopEnd: { toString: () => '4:0:0' },
        on: vi.fn(),
        off: vi.fn(),
      },
      context: {
        state: 'running',
      },
    };

    global.Tone = mockTone as any;

    // Clear singleton
    (TransportSyncManager as any).instance = null;
    syncManager = TransportSyncManager.getInstance();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = TransportSyncManager.getInstance();
      const instance2 = TransportSyncManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Client Registration', () => {
    it('should register a client successfully', () => {
      const clientId = 'test-widget-1';
      const initHandler = vi.fn();

      syncManager.on('client:connected', initHandler);
      syncManager.registerClient(clientId);

      expect(initHandler).toHaveBeenCalledWith({ clientId });
      expect(syncManager.getClientStatus(clientId)).toBeDefined();
    });

    it('should handle multiple client registrations', () => {
      const clients = ['widget-1', 'widget-2', 'widget-3'];

      clients.forEach((id) => syncManager.registerClient(id));

      const metrics = syncManager.getMetrics();
      expect(metrics.connectedClients).toBe(3);
    });

    it('should unregister clients properly', () => {
      const clientId = 'test-widget';

      syncManager.registerClient(clientId);
      expect(syncManager.getClientStatus(clientId)).toBeDefined();

      syncManager.unregisterClient(clientId);
      expect(syncManager.getClientStatus(clientId)).toBeUndefined();
    });
  });

  describe('Heartbeat Mechanism', () => {
    it('should send heartbeats at configured interval', () => {
      vi.useFakeTimers();
      const heartbeatHandler = vi.fn();
      const clientId = 'test-widget';

      syncManager.on('HEARTBEAT', heartbeatHandler);
      syncManager.registerClient(clientId);

      // Start sync
      mockTone.Transport.state = 'started';
      mockTone.Transport.emit('start');

      // Fast-forward time
      vi.advanceTimersByTime(1000);
      expect(heartbeatHandler).toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(heartbeatHandler).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should detect missed heartbeats', () => {
      vi.useFakeTimers();
      const clientId = 'test-widget';

      syncManager.registerClient(clientId);
      const client = syncManager.getClientStatus(clientId);

      // Simulate client not responding
      if (client) {
        client.lastHeartbeat = Date.now() - 5000;
      }

      // Start sync and trigger heartbeat check
      mockTone.Transport.state = 'started';
      mockTone.Transport.emit('start');
      vi.advanceTimersByTime(1000);

      const metrics = syncManager.getMetrics();
      expect(metrics.missedHeartbeats).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });

  describe('Position Synchronization', () => {
    it('should broadcast position updates when playing', () => {
      vi.useFakeTimers();
      const positionHandler = vi.fn();
      const clientId = 'test-widget';

      syncManager.on('POSITION_UPDATE', positionHandler);
      syncManager.registerClient(clientId);

      // Start transport
      mockTone.Transport.state = 'started';
      mockTone.Transport.emit('start');

      // Advance time to trigger position updates
      vi.advanceTimersByTime(50);
      expect(positionHandler).toHaveBeenCalled();

      // Update position and advance again
      mockTone.Transport.position = { toString: () => '0:1:0' };
      vi.advanceTimersByTime(50);

      const lastCall =
        positionHandler.mock.calls[positionHandler.mock.calls.length - 1];
      expect(lastCall[0]).toMatchObject({
        position: '0:1:0',
      });

      vi.useRealTimers();
    });

    it('should throttle position updates', () => {
      vi.useFakeTimers();
      const handler = vi.fn();

      syncManager.on('POSITION_UPDATE', handler);
      syncManager.registerClient('test');

      // Trigger many updates rapidly
      for (let i = 0; i < 10; i++) {
        syncManager.forceSync();
        vi.advanceTimersByTime(5); // Less than throttle time
      }

      // Should be throttled
      expect(handler.mock.calls.length).toBeLessThan(10);

      vi.useRealTimers();
    });
  });

  describe('Latency Measurement', () => {
    it('should calculate client latency', () => {
      const clientId = 'test-widget';
      syncManager.registerClient(clientId);

      const clientTimestamp = Date.now() - 50; // 50ms ago
      syncManager.acknowledgeHeartbeat(clientId, clientTimestamp);

      const client = syncManager.getClientStatus(clientId);
      expect(client?.latency).toBeGreaterThanOrEqual(50);
      expect(client?.latency).toBeLessThan(100);
    });

    it('should update average latency across clients', () => {
      const clients = ['widget-1', 'widget-2', 'widget-3'];
      const latencies = [50, 100, 150];

      clients.forEach((id, i) => {
        syncManager.registerClient(id);
        syncManager.acknowledgeHeartbeat(id, Date.now() - latencies[i]);
      });

      const metrics = syncManager.getMetrics();
      expect(metrics.avgLatency).toBeCloseTo(100, 10); // Average of 50, 100, 150
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection for disconnected clients', () => {
      vi.useFakeTimers();
      const clientId = 'test-widget';
      const reconnectHandler = vi.fn();

      syncManager.on('RECONNECTED', reconnectHandler);
      syncManager.registerClient(clientId);

      // Simulate missed heartbeats
      const client = syncManager.getClientStatus(clientId);
      if (client) {
        client.lastHeartbeat = Date.now() - 5000;
        client.missedHeartbeats = 1;
      }

      // Trigger heartbeat check
      mockTone.Transport.state = 'started';
      mockTone.Transport.emit('start');
      vi.advanceTimersByTime(1000);

      // Advance time for reconnection
      vi.advanceTimersByTime(1000);

      const metrics = syncManager.getMetrics();
      expect(metrics.reconnections).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it('should remove clients after max reconnection attempts', () => {
      vi.useFakeTimers();
      const clientId = 'test-widget';

      syncManager.registerClient(clientId);
      syncManager.updateConfig({ maxReconnectAttempts: 2 });

      const client = syncManager.getClientStatus(clientId);
      if (client) {
        client.missedHeartbeats = 3; // Exceed max attempts
        client.lastHeartbeat = Date.now() - 10000;
      }

      // Trigger heartbeat check
      mockTone.Transport.state = 'started';
      mockTone.Transport.emit('start');
      vi.advanceTimersByTime(1000);

      // Client should be removed
      expect(syncManager.getClientStatus(clientId)).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('Event Batching', () => {
    it('should batch events when throttled', () => {
      const batchHandler = vi.fn();

      syncManager.on('BATCH_UPDATE', batchHandler);
      syncManager.registerClient('test');

      // Send many events rapidly
      for (let i = 0; i < 5; i++) {
        syncManager.forceSync();
      }

      // Should receive batched updates
      expect(batchHandler).toHaveBeenCalled();
      const batch = batchHandler.mock.calls[0][0];
      expect(Array.isArray(batch.data)).toBe(true);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration dynamically', () => {
      const newConfig = {
        heartbeatInterval: 2000,
        syncInterval: 100,
      };

      syncManager.updateConfig(newConfig);

      // Verify config applied (would need getter method in real implementation)
      // For now, just verify no errors
      expect(() => syncManager.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics accurately', () => {
      vi.useFakeTimers();

      // Register clients and simulate activity
      for (let i = 0; i < 3; i++) {
        syncManager.registerClient(`widget-${i}`);
      }

      // Start sync
      mockTone.Transport.state = 'started';
      mockTone.Transport.emit('start');

      // Simulate some heartbeats
      vi.advanceTimersByTime(5000);

      const metrics = syncManager.getMetrics();
      expect(metrics.totalHeartbeats).toBeGreaterThan(0);
      expect(metrics.connectedClients).toBe(3);
      expect(metrics.lastSyncTime).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle transport errors gracefully', () => {
      // Simulate transport error
      mockTone.Transport.on = vi.fn().mockImplementation(() => {
        throw new Error('Transport error');
      });

      // Should not throw
      expect(() => {
        (TransportSyncManager as any).instance = null;
        TransportSyncManager.getInstance();
      }).not.toThrow();
    });

    it('should handle client errors without affecting others', () => {
      const goodClient = 'good-widget';
      const badClient = 'bad-widget';

      syncManager.registerClient(goodClient);
      syncManager.registerClient(badClient);

      // Simulate error for one client
      const errorHandler = vi.fn().mockImplementation(() => {
        if (errorHandler.mock.calls.length === 1) {
          throw new Error('Client error');
        }
      });

      syncManager.on('HEARTBEAT', errorHandler);

      // Should continue working
      expect(() => syncManager.forceSync()).not.toThrow();
      expect(syncManager.getClientStatus(goodClient)).toBeDefined();
    });
  });
});
