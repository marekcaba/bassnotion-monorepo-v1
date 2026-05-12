import { useEffect, useRef, useState, useCallback } from 'react';
import { WidgetSyncManager } from '../../playback/modules/transport/sync/WidgetSyncManager';

// Helper to get Tone from window (must be initialized before useTransportSync is used)
function getTone(): typeof import('tone') {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone as typeof import('tone');
    }
  }
  throw new Error('useTransportSync: Tone.js not loaded. Ensure AudioEngine is initialized first.');
}

// Helper function to format musical position
const formatPosition = (pos: {
  bars: number;
  beats: number;
  sixteenths: number;
  ticks?: number;
}): string => {
  return `${pos.bars}:${pos.beats}:${pos.sixteenths}`;
};

/**
 * FAANG-style Transport Sync Hook
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Latency compensation
 * - State reconciliation
 * - Performance monitoring
 * - Error boundaries
 */

interface TransportSyncState {
  isConnected: boolean;
  isPlaying: boolean;
  position: string;
  tempo: number;
  loop: boolean;
  loopStart: string;
  loopEnd: string;
  latency: number;
  lastSyncTime: number;
}

interface UseTransportSyncOptions {
  widgetId: string;
  onPlay?: (time?: number) => void;
  onStop?: (time?: number) => void;
  onPositionUpdate?: (position: string) => void;
  onTempoChange?: (tempo: number) => void;
  enableLatencyCompensation?: boolean;
  reconnectAttempts?: number;
}

export function useTransportSync({
  widgetId,
  onPlay,
  onStop,
  onPositionUpdate,
  onTempoChange,
  enableLatencyCompensation = true,
  reconnectAttempts = 5,
}: UseTransportSyncOptions) {
  const [syncState, setSyncState] = useState<TransportSyncState>({
    isConnected: false,
    isPlaying: false,
    position: '0:0:0',
    tempo: 120,
    loop: false,
    loopStart: '0:0:0',
    loopEnd: '4:0:0',
    latency: 0,
    lastSyncTime: Date.now(),
  });

  const syncManager = useRef<WidgetSyncManager>();
  const reconnectTimer = useRef<NodeJS.Timeout>();
  const reconnectCount = useRef(0);
  const lastHeartbeatTime = useRef(Date.now());
  const positionOffset = useRef(0);

  // Performance monitoring
  const performanceMetrics = useRef({
    missedUpdates: 0,
    totalUpdates: 0,
    avgProcessingTime: 0,
  });

  /**
   * Calculate latency-compensated time
   */
  const getCompensatedTime = useCallback(
    (serverTime: number): number => {
      if (!enableLatencyCompensation) return serverTime;

      const latencyCompensation = syncState.latency / 2; // Half RTT
      return serverTime + latencyCompensation / 1000; // Convert to seconds
    },
    [syncState.latency, enableLatencyCompensation],
  );

  /**
   * Handle connection
   */
  const connect = useCallback(() => {
    syncManager.current = WidgetSyncManager.getInstance();
    syncManager.current.registerClient(widgetId);

    setSyncState((prev) => ({ ...prev, isConnected: true }));
    reconnectCount.current = 0;
  }, [widgetId]);

  /**
   * Handle disconnection with exponential backoff
   */
  const handleDisconnect = useCallback(() => {
    setSyncState((prev) => ({ ...prev, isConnected: false }));

    if (reconnectCount.current < reconnectAttempts) {
      // Increment reconnect count immediately to show isReconnecting state
      reconnectCount.current++;

      const delay = Math.min(
        1000 * Math.pow(2, reconnectCount.current - 1),
        30000,
      );
      reconnectTimer.current = setTimeout(() => {
        connect();
      }, delay);
    }
  }, [connect, reconnectAttempts]);

  /**
   * Process heartbeat
   */
  const handleHeartbeat = useCallback(
    (data: any) => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - lastHeartbeatTime.current;

      // Detect missed heartbeats
      if (timeSinceLastHeartbeat > 2000) {
        performanceMetrics.current.missedUpdates++;
      }

      lastHeartbeatTime.current = now;

      // Send acknowledgment for latency calculation
      if (syncManager.current) {
        syncManager.current.acknowledgeHeartbeat(widgetId, data.timestamp);
      }

      // Update sync state
      setSyncState((prev) => ({
        ...prev,
        lastSyncTime: now,
        isPlaying: data.transportSnapshot?.state === 'playing',
        tempo: data.transportSnapshot?.tempo || prev.tempo,
        loop: data.transportSnapshot?.loop || prev.loop,
        loopStart: data.transportSnapshot?.loopStart
          ? formatPosition(data.transportSnapshot.loopStart)
          : prev.loopStart,
        loopEnd: data.transportSnapshot?.loopEnd
          ? formatPosition(data.transportSnapshot.loopEnd)
          : prev.loopEnd,
      }));
    },
    [widgetId],
  );

  /**
   * Handle position updates with interpolation
   */
  const handlePositionUpdate = useCallback(
    (data: any) => {
      const startTime = performance.now();

      // Calculate position with latency compensation
      let compensatedPosition = data.position;
      if (enableLatencyCompensation && syncState.isPlaying) {
        const Tone = getTone();
        const latencyOffset = syncState.latency / 1000;
        const ticks =
          Tone.Time(data.position).toTicks() +
          Tone.Time(latencyOffset).toTicks();
        compensatedPosition = Tone.Ticks(ticks).toBarsBeatsSixteenths();
      }

      setSyncState((prev) => ({ ...prev, position: compensatedPosition }));

      if (onPositionUpdate) {
        onPositionUpdate(compensatedPosition);
      }

      // Update performance metrics
      const processingTime = performance.now() - startTime;
      performanceMetrics.current.totalUpdates++;
      performanceMetrics.current.avgProcessingTime =
        (performanceMetrics.current.avgProcessingTime *
          (performanceMetrics.current.totalUpdates - 1) +
          processingTime) /
        performanceMetrics.current.totalUpdates;
    },
    [
      syncState.isPlaying,
      syncState.latency,
      enableLatencyCompensation,
      onPositionUpdate,
    ],
  );

  /**
   * Handle play event
   */
  const handlePlay = useCallback(
    (data: any) => {
      const compensatedTime = getCompensatedTime(data.timestamp);

      setSyncState((prev) => ({ ...prev, isPlaying: true }));

      if (onPlay) {
        // Schedule play at the compensated time
        const Tone = getTone();
        if (Tone.context.state === 'running') {
          onPlay(compensatedTime);
        } else {
          // If context not running, play immediately
          onPlay();
        }
      }
    },
    [onPlay, getCompensatedTime],
  );

  /**
   * Handle stop event
   */
  const handleStop = useCallback(
    (data: any) => {
      setSyncState((prev) => ({
        ...prev,
        isPlaying: false,
        position: '0:0:0',
      }));

      if (onStop) {
        onStop(data.timestamp);
      }
    },
    [onStop],
  );

  /**
   * Handle tempo change
   */
  const handleTempoChange = useCallback(
    (data: any) => {
      setSyncState((prev) => ({ ...prev, tempo: data.tempo }));

      if (onTempoChange) {
        onTempoChange(data.tempo);
      }
    },
    [onTempoChange],
  );

  /**
   * Handle batch updates efficiently
   */
  const handleBatchUpdate = useCallback(
    (batch: any[]) => {
      batch.forEach((update) => {
        switch (update.type) {
          case 'POSITION_UPDATE':
            handlePositionUpdate(update.data);
            break;
          case 'TEMPO_CHANGE':
            handleTempoChange(update.data);
            break;
          // Add more batch handlers as needed
        }
      });
    },
    [handlePositionUpdate, handleTempoChange],
  );

  /**
   * Setup effect
   */
  useEffect(() => {
    connect();

    // Setup event listeners
    const manager = WidgetSyncManager.getInstance();

    const handlers = {
      [`client:${widgetId}:HEARTBEAT`]: handleHeartbeat,
      [`client:${widgetId}:POSITION_UPDATE`]: handlePositionUpdate,
      [`client:${widgetId}:TRANSPORT_START`]: handlePlay,
      [`client:${widgetId}:TRANSPORT_STOP`]: handleStop,
      [`client:${widgetId}:TEMPO_CHANGE`]: handleTempoChange,
      [`client:${widgetId}:BATCH_UPDATE`]: handleBatchUpdate,
      [`client:${widgetId}:DISCONNECTED`]: handleDisconnect,
    };

    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      manager.on(event, handler);
    });

    // Cleanup
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }

      // Unregister all handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        manager.off(event, handler);
      });

      // Unregister client
      if (syncManager.current) {
        syncManager.current.unregisterClient(widgetId);
      }
    };
  }, [widgetId]); // Only re-run if widgetId changes

  /**
   * Force sync - useful for error recovery
   */
  const forceSync = useCallback(() => {
    if (syncManager.current) {
      syncManager.current.forceSync();
    }
  }, []);

  /**
   * Get performance metrics
   */
  const getPerformanceMetrics = useCallback(() => {
    const syncMetrics = syncManager.current?.getMetrics();
    return {
      ...performanceMetrics.current,
      ...syncMetrics,
    };
  }, []);

  return {
    ...syncState,
    forceSync,
    getPerformanceMetrics,
    isReconnecting: reconnectCount.current > 0,
  };
}
