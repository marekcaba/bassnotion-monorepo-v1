/**
 * useWidgetSync Hook
 *
 * React hook for widgets to subscribe to sync events and manage state updates.
 * Provides state update optimization, selective re-rendering logic, and error handling.
 *
 * Part of Story 3.6: Widget Synchronization
 * Task 3.6.2: Synchronized State Hook
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { widgetSyncService } from '../services/WidgetSyncService';
import type { WidgetSyncEvent, SyncState } from '../services/WidgetSyncService';

// ============================================================================
// HOOK INTERFACES
// ============================================================================

export interface UseWidgetSyncOptions {
  // Widget identification
  widgetId: string;

  // Event subscriptions
  subscribeTo?: string[]; // Specific event types to subscribe to
  subscribeToAll?: boolean; // Subscribe to all events (default: false)

  // Performance optimization
  throttleUpdates?: boolean; // Throttle state updates (default: true)
  throttleMs?: number; // Throttle interval in ms (default: 16)

  // Selective re-rendering
  stateFilter?: (state: SyncState) => Partial<SyncState>; // Filter which state changes trigger re-renders

  // Error handling
  onError?: (error: Error) => void;
  onSyncLoss?: () => void; // Called when sync connection is lost

  // Debug mode
  debugMode?: boolean; // Enable console logging (default: false)
}

export interface WidgetSyncState {
  // Current sync state
  syncState: SyncState;

  // Connection status
  isConnected: boolean;
  lastSyncTime: number;

  // Performance metrics
  eventCount: number;
  averageLatency: number;

  // Error state
  hasError: boolean;
  lastError: string | null;
}

export interface WidgetSyncActions {
  // Emit events
  emitEvent: (
    eventType: WidgetSyncEvent['type'],
    payload: any,
    priority?: WidgetSyncEvent['priority'],
  ) => void;

  // State management
  refreshState: () => void;
  resetMetrics: () => void;

  // Connection management
  reconnect: () => void;
  disconnect: () => void;
}

export interface UseWidgetSyncReturn {
  // State
  state: WidgetSyncState;

  // Actions
  actions: WidgetSyncActions;

  // Convenience getters for common state
  isPlaying: boolean;
  currentTime: number;
  tempo: number;
  masterVolume: number;
  selectedExercise: any | undefined;

  // Performance monitoring
  performanceMetrics: {
    totalEvents: number;
    averageLatency: number;
    droppedUpdates: number;
  };
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useWidgetSync(
  options: UseWidgetSyncOptions,
): UseWidgetSyncReturn {
  const {
    widgetId,
    subscribeTo = [],
    subscribeToAll = false,
    throttleUpdates = true,
    throttleMs = 16,
    stateFilter,
    onError,
    onSyncLoss,
    debugMode = false,
  } = options;

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [syncState, setSyncState] = useState<SyncState>(() =>
    widgetSyncService.getSyncState(),
  );

  const [isConnected, setIsConnected] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const [eventCount, setEventCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Performance tracking
  const latencySamples = useRef<number[]>([]);
  const droppedUpdatesRef = useRef(0);
  const lastUpdateTime = useRef(Date.now());
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateUpdate = useRef<SyncState | null>(null);

  // ============================================================================
  // STATE UPDATE OPTIMIZATION
  // ============================================================================

  // Use refs to break dependency cycles
  const shouldUpdateStateRef = useRef<(newState: SyncState) => boolean>(
    () => false,
  );
  const updateStateThrottledRef = useRef<(newState: SyncState) => void>(() => {
    // Initial no-op function
  });

  shouldUpdateStateRef.current = (newState: SyncState): boolean => {
    // Apply state filter if provided
    if (stateFilter) {
      const filteredPrevious = stateFilter(syncState);
      const filteredNew = stateFilter(newState);

      // Deep comparison of filtered state
      return JSON.stringify(filteredPrevious) !== JSON.stringify(filteredNew);
    }

    // Default: update if state has changed
    return JSON.stringify(syncState) !== JSON.stringify(newState);
  };

  updateStateThrottledRef.current = (newState: SyncState) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime.current;

    if (!throttleUpdates || timeSinceLastUpdate >= throttleMs) {
      // Immediate update
      if (shouldUpdateStateRef.current?.(newState)) {
        setSyncState(newState);
        setLastSyncTime(now);
        lastUpdateTime.current = now;

        if (debugMode) {
          console.log(`[${widgetId}] State updated immediately`, newState);
        }
      }
    } else {
      // Throttled update
      pendingStateUpdate.current = newState;

      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }

      throttleTimerRef.current = setTimeout(() => {
        const pendingState = pendingStateUpdate.current;
        if (pendingState && shouldUpdateStateRef.current?.(pendingState)) {
          setSyncState(pendingState);
          setLastSyncTime(Date.now());
          lastUpdateTime.current = Date.now();

          if (debugMode) {
            console.log(
              `[${widgetId}] State updated (throttled)`,
              pendingState,
            );
          }
        }
        pendingStateUpdate.current = null;
        throttleTimerRef.current = null;
      }, throttleMs - timeSinceLastUpdate);

      droppedUpdatesRef.current++;
    }
  };

  const updateStateThrottled = useCallback((newState: SyncState) => {
    updateStateThrottledRef.current?.(newState);
  }, []);

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  // Use ref to break dependency cycle and prevent infinite re-renders
  const handleSyncEventRef = useRef<(event: WidgetSyncEvent) => void>(() => {
    // Initial no-op function
  });

  handleSyncEventRef.current = (event: WidgetSyncEvent) => {
    const startTime = performance.now();

    try {
      // Skip events from same widget to prevent loops
      if (event.source === widgetId) {
        return;
      }

      // Update event count
      setEventCount((prev) => prev + 1);

      // Get updated sync state
      const newState = widgetSyncService.getSyncState();

      // Update state with optimization
      updateStateThrottled(newState);

      // Track performance
      const latency = performance.now() - startTime;
      latencySamples.current.push(latency);
      if (latencySamples.current.length > 100) {
        latencySamples.current.shift();
      }

      // Clear error state on successful event
      if (hasError) {
        setHasError(false);
        setLastError(null);
      }

      if (debugMode) {
        console.log(
          `[${widgetId}] Processed event ${event.type} in ${latency.toFixed(2)}ms`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown sync error';
      setHasError(true);
      setLastError(errorMessage);

      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }

      console.error(`[${widgetId}] Sync event error:`, error);
    }
  };

  const handleSyncEvent = useCallback((event: WidgetSyncEvent) => {
    handleSyncEventRef.current?.(event);
  }, []);

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  const reconnect = useCallback(() => {
    try {
      // Refresh state
      const currentState = widgetSyncService.getSyncState();
      setSyncState(currentState);
      setIsConnected(true);
      setLastSyncTime(Date.now());

      if (debugMode) {
        console.log(`[${widgetId}] Reconnected to sync service`);
      }
    } catch (error) {
      setIsConnected(false);
      if (onSyncLoss) {
        onSyncLoss();
      }
      console.error(`[${widgetId}] Failed to reconnect:`, error);
    }
  }, [widgetId, onSyncLoss, debugMode]);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    if (debugMode) {
      console.log(`[${widgetId}] Disconnected from sync service`);
    }
  }, [widgetId, debugMode]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const emitEvent = useCallback(
    (
      eventType: WidgetSyncEvent['type'],
      payload: any,
      priority: WidgetSyncEvent['priority'] = 'normal',
    ) => {
      try {
        const event: WidgetSyncEvent = {
          type: eventType,
          payload,
          timestamp: Date.now(),
          source: widgetId,
          priority,
        };

        widgetSyncService.emit(event);

        if (debugMode) {
          console.log(`[${widgetId}] Emitted event ${eventType}`, payload);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to emit event';
        setHasError(true);
        setLastError(errorMessage);

        if (onError) {
          onError(error instanceof Error ? error : new Error(errorMessage));
        }

        console.error(`[${widgetId}] Failed to emit event:`, error);
      }
    },
    [widgetId, onError, debugMode],
  );

  const refreshState = useCallback(() => {
    try {
      const currentState = widgetSyncService.getSyncState();
      setSyncState(currentState);
      setLastSyncTime(Date.now());
    } catch (error) {
      console.error(`[${widgetId}] Failed to refresh state:`, error);
    }
  }, [widgetId]);

  const resetMetrics = useCallback(() => {
    setEventCount(0);
    latencySamples.current = [];
    droppedUpdatesRef.current = 0;
    setHasError(false);
    setLastError(null);
  }, []);

  // ============================================================================
  // EFFECT HOOKS
  // ============================================================================

  // Create stable string representation of subscribeTo array to prevent infinite re-renders
  const subscribeToString = useMemo(() => {
    return JSON.stringify(subscribeTo?.sort() || []);
  }, [subscribeTo]);

  // Subscribe to sync events on mount
  useEffect(() => {
    const subscribeToEvents = subscribeToAll ? ['*'] : subscribeTo;

    // Subscribe to specified events
    subscribeToEvents.forEach((eventType) => {
      if (eventType === '*') {
        widgetSyncService.subscribeToAll(handleSyncEvent);
      } else {
        widgetSyncService.subscribe(eventType, handleSyncEvent);
      }
    });

    // Initial state sync
    try {
      const currentState = widgetSyncService.getSyncState();
      setSyncState(currentState);
      setLastSyncTime(Date.now());
    } catch (error) {
      console.error(`[${widgetId}] Failed to refresh state:`, error);
    }

    if (debugMode) {
      console.log(`[${widgetId}] Subscribed to events:`, subscribeToEvents);
    }

    // Cleanup on unmount
    return () => {
      subscribeToEvents.forEach((eventType) => {
        if (eventType === '*') {
          widgetSyncService.unsubscribe('*', handleSyncEvent);
        } else {
          widgetSyncService.unsubscribe(eventType, handleSyncEvent);
        }
      });

      // Clear throttle timer
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }

      if (debugMode) {
        console.log(`[${widgetId}] Unsubscribed from sync service`);
      }
    };
  }, [subscribeToString, subscribeToAll, handleSyncEvent, widgetId, debugMode]);

  // Monitor connection health
  useEffect(() => {
    const checkConnection = () => {
      const now = Date.now();
      const timeSinceLastSync = now - lastSyncTime;

      // Consider connection lost if no sync for 30 seconds (increased from 5 seconds)
      const CONNECTION_TIMEOUT = 30000;
      if (timeSinceLastSync > CONNECTION_TIMEOUT && isConnected) {
        setIsConnected(false);
        if (onSyncLoss) {
          onSyncLoss();
        }

        if (debugMode) {
          console.warn(
            `[${widgetId}] Sync connection lost (${timeSinceLastSync}ms since last sync)`,
          );
        }
      }
    };

    // Check connection every 5 seconds instead of every second
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [lastSyncTime, isConnected, onSyncLoss, widgetId, debugMode]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const averageLatency =
    latencySamples.current.length > 0
      ? latencySamples.current.reduce((sum, val) => sum + val, 0) /
        latencySamples.current.length
      : 0;

  const performanceMetrics = {
    totalEvents: eventCount,
    averageLatency,
    droppedUpdates: droppedUpdatesRef.current,
  };

  // ============================================================================
  // RETURN OBJECT
  // ============================================================================

  return {
    // State
    state: {
      syncState,
      isConnected,
      lastSyncTime,
      eventCount,
      averageLatency,
      hasError,
      lastError,
    },

    // Actions
    actions: {
      emitEvent,
      refreshState,
      resetMetrics,
      reconnect,
      disconnect,
    },

    // Convenience getters
    isPlaying: syncState.playback.isPlaying,
    currentTime: syncState.playback.currentTime,
    tempo: syncState.playback.tempo,
    masterVolume: syncState.ui.masterVolume,
    selectedExercise: syncState.exercise.selectedExercise,

    // Performance monitoring
    performanceMetrics,
  };
}
