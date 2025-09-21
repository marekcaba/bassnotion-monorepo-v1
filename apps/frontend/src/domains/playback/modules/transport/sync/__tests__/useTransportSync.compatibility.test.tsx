import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransportSync } from '@/domains/widgets/hooks/useTransportSync';
import { WidgetSyncManager } from '../WidgetSyncManager';
import { Transport } from '../../core/Transport';
import { EventBus } from '../../../shared/index.js';
import * as Tone from 'tone';

// Mock Tone.js
vi.mock('tone', () => ({
  Time: vi.fn().mockImplementation((value) => ({
    toTicks: () => value * 192, // Assuming 192 ticks per quarter note
  })),
  Ticks: vi.fn().mockImplementation((ticks) => ({
    toBarsBeatsSixteenths: () => '0:0:0',
  })),
  context: {
    state: 'running',
  },
}));

// Mock TransportSyncManager to use WidgetSyncManager
vi.mock('../../shared/legacy-bridge.js', () => {
  return {
    TransportSyncManager: class {
      private static instance: any;
      private widgetSyncManager: any;

      constructor() {
        this.widgetSyncManager = WidgetSyncManager.getInstance();
      }

      static getInstance() {
        if (!this.instance) {
          this.instance = new this();
        }
        return this.instance;
      }

      registerClient(clientId: string) {
        return this.widgetSyncManager.registerClient(clientId);
      }

      unregisterClient(clientId: string) {
        return this.widgetSyncManager.unregisterClient(clientId);
      }

      acknowledgeHeartbeat(clientId: string, timestamp: number) {
        return this.widgetSyncManager.acknowledgeHeartbeat(clientId, timestamp);
      }

      forceSync() {
        return this.widgetSyncManager.forceSync();
      }

      getMetrics() {
        return this.widgetSyncManager.getMetrics();
      }

      on(event: string, handler: Function) {
        return this.widgetSyncManager.on(event, handler);
      }

      off(event: string, handler: Function) {
        return this.widgetSyncManager.off(event, handler);
      }
    },
  };
});

describe('useTransportSync compatibility with WidgetSyncManager', () => {
  let mockTransport: Transport;
  let mockEventBus: EventBus;

  beforeEach(() => {
    // Clear singleton
    (WidgetSyncManager as any).instance = null;

    // Create mocks
    mockTransport = {
      getState: vi.fn().mockReturnValue('stopped'),
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

    // Initialize WidgetSyncManager
    const syncManager = WidgetSyncManager.getInstance();
    syncManager.initialize(mockTransport, mockEventBus);
  });

  afterEach(() => {
    const syncManager = WidgetSyncManager.getInstance();
    syncManager.dispose();
    vi.clearAllMocks();
  });

  it('should connect and receive initial state', async () => {
    const widgetId = 'test-widget-1';
    const { result } = renderHook(() => useTransportSync({ widgetId }));

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.position).toBe('0:0:0');
    expect(result.current.tempo).toBe(120);
    expect(result.current.isPlaying).toBe(false);
  });

  it('should handle transport play event', async () => {
    const widgetId = 'test-widget-2';
    const onPlay = vi.fn();

    const { result } = renderHook(() => useTransportSync({ widgetId, onPlay }));

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Emit transport start event
    act(() => {
      mockEventBus.emit('transport:start', {
        position: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
        tempo: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      });
    });

    expect(result.current.isPlaying).toBe(true);
    expect(onPlay).toHaveBeenCalled();
  });

  it('should handle transport stop event', async () => {
    const widgetId = 'test-widget-3';
    const onStop = vi.fn();

    const { result } = renderHook(() => useTransportSync({ widgetId, onStop }));

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Set playing state
    act(() => {
      mockEventBus.emit('transport:start', {
        position: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
        tempo: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      });
    });

    // Emit transport stop event
    act(() => {
      mockEventBus.emit('transport:stop', {
        position: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
      });
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.position).toBe('0:0:0');
    expect(onStop).toHaveBeenCalled();
  });

  it('should handle position updates', async () => {
    const widgetId = 'test-widget-4';
    const onPositionUpdate = vi.fn();

    const { result } = renderHook(() =>
      useTransportSync({ widgetId, onPositionUpdate }),
    );

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Emit position update
    act(() => {
      const syncManager = WidgetSyncManager.getInstance();
      syncManager.emit(`client:${widgetId}:POSITION_UPDATE`, {
        position: '1:2:3',
        time: 1.5,
        metrics: {
          currentTime: 1.5,
          drift: 0,
          latency: 0,
          lookahead: 100,
          updateInterval: 25,
        },
      });
    });

    expect(onPositionUpdate).toHaveBeenCalledWith('1:2:3');
  });

  it('should handle tempo changes', async () => {
    const widgetId = 'test-widget-5';
    const onTempoChange = vi.fn();

    const { result } = renderHook(() =>
      useTransportSync({ widgetId, onTempoChange }),
    );

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Emit tempo change
    act(() => {
      mockEventBus.emit('transport:tempo-change', { tempo: 140 });
    });

    expect(result.current.tempo).toBe(140);
    expect(onTempoChange).toHaveBeenCalledWith(140);
  });

  it('should handle heartbeats and maintain connection', async () => {
    const widgetId = 'test-widget-6';
    const { result } = renderHook(() => useTransportSync({ widgetId }));

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.isConnected).toBe(true);

    // Simulate heartbeat
    act(() => {
      const syncManager = WidgetSyncManager.getInstance();
      syncManager.emit(`client:${widgetId}:HEARTBEAT`, {
        timestamp: Date.now(),
        transportSnapshot: {
          state: 'stopped',
          position: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
          tempo: 120,
          loop: false,
          loopStart: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
          loopEnd: { bars: 4, beats: 0, sixteenths: 0, ticks: 0 },
          metrics: mockTransport.getMetrics(),
          timestamp: Date.now(),
        },
        serverTime: Date.now(),
      });
    });

    // Connection should still be maintained
    expect(result.current.isConnected).toBe(true);
    expect(result.current.lastSyncTime).toBeGreaterThan(0);
  });

  it('should support force sync', async () => {
    const widgetId = 'test-widget-7';
    const { result } = renderHook(() => useTransportSync({ widgetId }));

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Call force sync
    act(() => {
      result.current.forceSync();
    });

    // Should maintain state
    expect(result.current.isConnected).toBe(true);
  });

  it('should handle disconnection and reconnection', async () => {
    const widgetId = 'test-widget-8';
    const { result } = renderHook(() =>
      useTransportSync({ widgetId, reconnectAttempts: 2 }),
    );

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.isConnected).toBe(true);

    // Simulate disconnection
    act(() => {
      const syncManager = WidgetSyncManager.getInstance();
      syncManager.emit(`client:${widgetId}:DISCONNECTED`, {});
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReconnecting).toBe(true);
  });

  it('should provide performance metrics', async () => {
    const widgetId = 'test-widget-9';
    const { result } = renderHook(() => useTransportSync({ widgetId }));

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Get performance metrics
    const metrics = result.current.getPerformanceMetrics();

    expect(metrics).toHaveProperty('missedUpdates');
    expect(metrics).toHaveProperty('totalUpdates');
    expect(metrics).toHaveProperty('avgProcessingTime');
  });
});
