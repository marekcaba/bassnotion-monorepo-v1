import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WidgetSyncManager } from '../WidgetSyncManager';
import { Transport } from '../../core/Transport';
import { EventBus } from '../../../shared/index.js';
import type { TransportState } from '../../types';

describe('WidgetSyncManager', () => {
  let syncManager: WidgetSyncManager;
  let mockTransport: Transport;
  let mockEventBus: EventBus;

  beforeEach(() => {
    // Clear singleton
    (WidgetSyncManager as any).instance = null;

    // Create mocks
    mockTransport = {
      getState: vi.fn().mockReturnValue('stopped' as TransportState),
      getPosition: vi
        .fn()
        .mockReturnValue({ bars: 0, beats: 0, sixteenths: 0, ticks: 0 }),
      getTempo: vi.fn().mockReturnValue(120),
      isLooping: vi.fn().mockReturnValue(false),
      getLoopStart: vi
        .fn()
        .mockReturnValue({ bars: 0, beats: 0, sixteenths: 0, ticks: 0 }),
      getLoopEnd: vi
        .fn()
        .mockReturnValue({ bars: 4, beats: 0, sixteenths: 0, ticks: 0 }),
      getMetrics: vi.fn().mockReturnValue({
        currentTime: 0,
        drift: 0,
        latency: 0,
        lookahead: 100,
        updateInterval: 25,
      }),
    } as any;

    mockEventBus = new EventBus();

    syncManager = WidgetSyncManager.getInstance();
    syncManager.initialize(mockTransport, mockEventBus);
  });

  afterEach(() => {
    syncManager.dispose();
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = WidgetSyncManager.getInstance();
      const instance2 = WidgetSyncManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Client Registration', () => {
    it('should register a client', () => {
      const clientId = 'widget-1';
      const connectSpy = vi.fn();

      syncManager.on('client:connected', connectSpy);
      syncManager.registerClient(clientId);

      expect(connectSpy).toHaveBeenCalledWith({ clientId });
      expect(syncManager.getConnectedClients()).toHaveLength(1);
      expect(syncManager.getConnectedClients()[0].id).toBe(clientId);
    });

    it('should send initial state on registration', () => {
      const clientId = 'widget-1';
      const initSpy = vi.fn();

      syncManager.on(`client:${clientId}:SYNC_INIT`, initSpy);
      syncManager.registerClient(clientId);

      expect(initSpy).toHaveBeenCalled();
      const initData = initSpy.mock.calls[0][0];
      expect(initData).toMatchObject({
        state: 'stopped',
        position: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
        tempo: 120,
        loop: false,
      });
    });

    it('should unregister a client', () => {
      const clientId = 'widget-1';
      const disconnectSpy = vi.fn();

      syncManager.on('client:disconnected', disconnectSpy);
      syncManager.registerClient(clientId);
      syncManager.unregisterClient(clientId);

      expect(disconnectSpy).toHaveBeenCalledWith({ clientId });
      expect(syncManager.getConnectedClients()).toHaveLength(0);
    });
  });

  describe('Heartbeat System', () => {
    it('should handle client heartbeat', () => {
      const clientId = 'widget-1';
      syncManager.registerClient(clientId);

      const timestamp = Date.now() - 50; // 50ms ago
      syncManager.handleClientHeartbeat(clientId, timestamp);

      const clients = syncManager.getConnectedClients();
      expect(clients[0].latency).toBeGreaterThanOrEqual(50);
      expect(clients[0].latency).toBeLessThan(100);
    });

    it('should send heartbeats periodically', async () => {
      const clientId = 'widget-1';
      const heartbeatSpy = vi.fn();

      syncManager.on(`client:${clientId}:HEARTBEAT`, heartbeatSpy);
      syncManager.registerClient(clientId);

      // Wait for heartbeat
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(heartbeatSpy).toHaveBeenCalled();
      const heartbeatData = heartbeatSpy.mock.calls[0][0];
      expect(heartbeatData).toHaveProperty('timestamp');
      expect(heartbeatData).toHaveProperty('transportSnapshot');
      expect(heartbeatData).toHaveProperty('serverTime');
    });
  });

  describe('Transport Event Broadcasting', () => {
    it('should broadcast transport start', () => {
      const clientId = 'widget-1';
      const startSpy = vi.fn();

      syncManager.on(`client:${clientId}:TRANSPORT_START`, startSpy);
      syncManager.registerClient(clientId);

      mockEventBus.emit('transport:start', {
        position: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
        tempo: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      });

      expect(startSpy).toHaveBeenCalledWith({
        position: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
        tempo: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      });
    });

    it('should broadcast transport stop', () => {
      const clientId = 'widget-1';
      const stopSpy = vi.fn();

      syncManager.on(`client:${clientId}:TRANSPORT_STOP`, stopSpy);
      syncManager.registerClient(clientId);

      mockEventBus.emit('transport:stop', {
        position: { bars: 1, beats: 2, sixteenths: 0, ticks: 0 },
      });

      expect(stopSpy).toHaveBeenCalledWith({
        position: { bars: 1, beats: 2, sixteenths: 0, ticks: 0 },
      });
    });

    it('should broadcast tempo changes', () => {
      const clientId = 'widget-1';
      const tempoSpy = vi.fn();

      syncManager.on(`client:${clientId}:TEMPO_CHANGE`, tempoSpy);
      syncManager.registerClient(clientId);

      mockEventBus.emit('transport:tempo-change', { tempo: 140 });

      expect(tempoSpy).toHaveBeenCalledWith({ tempo: 140 });
    });
  });

  describe('Position Update Throttling', () => {
    it('should throttle position updates', async () => {
      const clientId = 'widget-1';
      const positionSpy = vi.fn();
      const batchSpy = vi.fn();

      syncManager.on(`client:${clientId}:POSITION_UPDATE`, positionSpy);
      syncManager.on(`client:${clientId}:BATCH_UPDATE`, batchSpy);
      syncManager.registerClient(clientId);

      // Send multiple position updates rapidly
      for (let i = 0; i < 10; i++) {
        mockEventBus.emit('transport:timing-update', {
          time: i * 0.001,
          position: { bars: 0, beats: 0, sixteenths: 0, ticks: i },
          metrics: {
            currentTime: i * 0.001,
            drift: 0,
            latency: 0,
            lookahead: 100,
            updateInterval: 25,
          },
        });
      }

      // Wait for throttle period
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Should receive batched updates instead of individual ones
      expect(positionSpy.mock.calls.length).toBeLessThan(10);
      expect(batchSpy.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('Force Sync', () => {
    it('should force sync all clients', () => {
      const clientId1 = 'widget-1';
      const clientId2 = 'widget-2';
      const forceSpy1 = vi.fn();
      const forceSpy2 = vi.fn();

      syncManager.on(`client:${clientId1}:FORCE_SYNC`, forceSpy1);
      syncManager.on(`client:${clientId2}:FORCE_SYNC`, forceSpy2);
      syncManager.registerClient(clientId1);
      syncManager.registerClient(clientId2);

      syncManager.forceSync();

      expect(forceSpy1).toHaveBeenCalled();
      expect(forceSpy2).toHaveBeenCalled();

      const syncData = forceSpy1.mock.calls[0][0];
      expect(syncData).toMatchObject({
        state: 'stopped',
        position: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
        tempo: 120,
      });
    });
  });

  describe('Metrics', () => {
    it('should track sync metrics', () => {
      const clientId = 'widget-1';
      syncManager.registerClient(clientId);

      const metrics = syncManager.getMetrics();
      expect(metrics).toMatchObject({
        connectedClients: 1,
        avgLatency: 0,
      });
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      syncManager.updateConfig({
        heartbeatInterval: 2000,
        throttleMs: 32,
      });

      // Configuration should be applied
      // (We can't directly test the internal config, but we can observe behavior changes)
      const clientId = 'widget-1';
      syncManager.registerClient(clientId);
      expect(syncManager.getConnectedClients()).toHaveLength(1);
    });
  });

  describe('Backward Compatibility', () => {
    it('should support acknowledgeHeartbeat method', () => {
      const clientId = 'widget-1';
      syncManager.registerClient(clientId);

      const timestamp = Date.now() - 100;
      syncManager.acknowledgeHeartbeat(clientId, timestamp);

      const clients = syncManager.getConnectedClients();
      expect(clients[0].latency).toBeGreaterThanOrEqual(100);
    });
  });
});
