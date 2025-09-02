import { useEffect, useRef, useState, useCallback } from 'react';
import { TransportSyncManager } from '../../playback/services/core/TransportSyncManager';
import * as Tone from 'tone';

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

  const syncManager = useRef<TransportSyncManager>();
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
    syncManager.current = TransportSyncManager.getInstance();
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
      const delay = Math.min(1000 * Math.pow(2, reconnectCount.current), 30000);
      reconnectTimer.current = setTimeout(() => {
        reconnectCount.current++;
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
        isPlaying: data.transportState.isPlaying,
        tempo: data.transportState.tempo,
        loop: data.transportState.loop,
        loopStart: data.transportState.loopStart,
        loopEnd: data.transportState.loopEnd,
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
    const manager = TransportSyncManager.getInstance();

    const handlers = {
      [`client:${widgetId}:HEARTBEAT`]: handleHeartbeat,
      [`client:${widgetId}:POSITION_UPDATE`]: handlePositionUpdate,
      [`client:${widgetId}:PLAY`]: handlePlay,
      [`client:${widgetId}:STOP`]: handleStop,
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
