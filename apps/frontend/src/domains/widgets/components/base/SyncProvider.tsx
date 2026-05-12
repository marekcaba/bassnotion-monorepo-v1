/**
 * SyncProvider - Context provider for sync state
 *
 * Provides global sync state management and context for widget components.
 * Enables widgets to access sync state without direct hook dependencies.
 *
 * Part of Story 3.6: Widget Synchronization
 * Task 3.6.3: Widget Base Components
 */

import React, {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { widgetSyncService } from '../../services/WidgetSyncService';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('SyncProvider');
import type {
  SyncState,
  SyncPerformanceMetrics,
} from '../../services/WidgetSyncService';

// ============================================================================
// CONTEXT INTERFACES
// ============================================================================

export interface SyncContextValue {
  // Current sync state
  syncState: SyncState;

  // Performance metrics
  performanceMetrics: SyncPerformanceMetrics;

  // Connection status
  isConnected: boolean;
  lastUpdateTime: number;

  // Actions
  refreshState: () => void;
  resetMetrics: () => void;

  // Global sync controls
  emitGlobalEvent: (
    eventType:
      | 'PLAYBACK_STATE'
      | 'TIMELINE_UPDATE'
      | 'EXERCISE_CHANGE'
      | 'TEMPO_CHANGE'
      | 'VOLUME_CHANGE'
      | 'CUSTOM_BASSLINE',
    payload: any,
  ) => void;
}

export interface SyncProviderProps {
  children: ReactNode;

  // Configuration
  enableGlobalMonitoring?: boolean;
  monitoringInterval?: number; // ms

  // Event handlers
  onGlobalError?: (error: Error) => void;
  onPerformanceWarning?: (metric: string, value: number) => void;

  // Debug mode
  debugMode?: boolean;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const SyncContext = createContext<SyncContextValue | null>(null);

// ============================================================================
// SYNC PROVIDER COMPONENT
// ============================================================================

// Render counter for debugging
let syncProviderRenderCount = 0;

export const SyncProvider: React.FC<SyncProviderProps> = ({
  children,
  enableGlobalMonitoring = true,
  monitoringInterval = 1000,
  onGlobalError,
  onPerformanceWarning,
  debugMode = false,
}) => {
  syncProviderRenderCount++;
  // Only log every 10th render to reduce noise
  if (syncProviderRenderCount % 10 === 0 || debugMode) {
    logger.info(`🔄 SyncProvider RENDER #${syncProviderRenderCount}`, {
      enableGlobalMonitoring,
      monitoringInterval,
      debugMode,
      timestamp: Date.now(),
    });
  }
  // State management
  const [syncState, setSyncStateRaw] = useState<SyncState>(() =>
    widgetSyncService.getSyncState(),
  );

  // Wrap setSyncState to log updates
  const setSyncState = useCallback(
    (newState: SyncState | ((prev: SyncState) => SyncState)) => {
      if (syncProviderRenderCount % 10 === 0 || debugMode) {
        logger.info(`🔄 [SyncProvider] setSyncState called`, {
          renderCount: syncProviderRenderCount,
          timestamp: new Date().toISOString(),
          stack: new Error().stack?.split('\n').slice(2, 5).join(' <- '),
        });
      }
      setSyncStateRaw(newState);
    },
    [debugMode],
  );

  const [performanceMetrics, setPerformanceMetrics] =
    useState<SyncPerformanceMetrics>(() =>
      widgetSyncService.getPerformanceMetrics(),
    );

  const [isConnected, setIsConnected] = useState(true);

  // Derive lastUpdateTime from performanceMetrics to avoid separate state updates
  // CRITICAL FIX: Use a stable value that only updates when connection status might change
  const lastUpdateTime = useMemo(() => {
    // Round to nearest second to prevent constant updates
    return Math.floor(performanceMetrics.lastUpdateTime / 1000) * 1000;
  }, [Math.floor(performanceMetrics.lastUpdateTime / 1000)]);

  // Memoized actions to prevent re-renders
  const refreshState = useCallback(() => {
    try {
      const currentState = widgetSyncService.getSyncState();
      const currentMetrics = widgetSyncService.getPerformanceMetrics();

      setSyncState(currentState);
      setPerformanceMetrics(currentMetrics);
      setIsConnected(true);

      if (debugMode) {
        logger.info('[SyncProvider] State refreshed', {
          currentState,
          currentMetrics,
        });
      }
    } catch (error) {
      setIsConnected(false);
      if (onGlobalError) {
        onGlobalError(
          error instanceof Error
            ? error
            : new Error('Failed to refresh sync state'),
        );
      }
      logger.error('[SyncProvider] Failed to refresh state:', error);
    }
  }, [debugMode, onGlobalError]);

  const resetMetrics = useCallback(() => {
    try {
      widgetSyncService.resetMetrics();
      setPerformanceMetrics(widgetSyncService.getPerformanceMetrics());

      if (debugMode) {
        logger.info('[SyncProvider] Metrics reset');
      }
    } catch (error) {
      if (onGlobalError) {
        onGlobalError(
          error instanceof Error ? error : new Error('Failed to reset metrics'),
        );
      }
      logger.error('[SyncProvider] Failed to reset metrics:', error);
    }
  }, [debugMode, onGlobalError]);

  // Subscribe to sync state changes
  useEffect(() => {
    const handleStateChange = (event: any) => {
      if (debugMode) {
        logger.info('[SyncProvider] Received state change event:', event);
      }

      // Skip refreshing state for certain event types that don't change global state
      // This prevents infinite loops where widgets emit events that trigger re-renders
      const skipEvents = [
        'CUSTOM_BASSLINE',
        'WIDGET_HEARTBEAT',
        'PERFORMANCE_UPDATE',
        'AUDIO_SOURCE_REGISTERED',
        'AUDIO_SOURCE_UNREGISTERED',
        'POSITION', // CRITICAL FIX: Skip 50ms position updates to prevent 20 re-renders per second
        'HEARTBEAT', // CRITICAL FIX: Skip heartbeat events (1 second interval from TransportSyncManager)
        'heartbeat', // Also skip lowercase variant
        'TIMELINE_UPDATE', // CRITICAL FIX: Skip timeline updates
        'MUSICAL_TIME_UPDATE', // CRITICAL FIX: Skip musical time updates
        'SEEK', // Skip seek events that don't change state
        'MUTE_CHANGE', // Skip mute changes
        'SOLO_CHANGE', // Skip solo changes
        'TIME_SIGNATURE_CHANGE', // Skip time signature changes
        'WIDGET_RECONNECT', // Skip widget reconnect events
        'SYNC_RESTART', // Skip sync restart events
        'PERFORMANCE_TEST', // Skip performance test events
        'track-regions-updated', // CRITICAL FIX: Skip track regions updates that might come from metronome
      ];

      // Add debug logging to track ALL events
      if (debugMode || event.type !== 'POSITION') {
        // Always log non-POSITION events
        logger.info(`🔍 [SyncProvider] Received event: ${event.type}`, {
          type: event.type,
          timestamp: Date.now(),
          shouldSkip: skipEvents.includes(event.type),
          source: event.source,
          payload: event.payload,
        });
      }

      if (skipEvents.includes(event.type)) {
        if (debugMode) {
          logger.info(
            `[SyncProvider] Skipping state refresh for ${event.type} event`,
          );
        }
        return;
      }

      refreshState();
    };

    // Subscribe to all events to catch state changes
    widgetSyncService.subscribe('*', handleStateChange);

    // Initial state refresh
    refreshState();

    return () => {
      widgetSyncService.unsubscribe('*', handleStateChange);
    };
  }, [refreshState, debugMode]);

  const emitGlobalEvent = useCallback(
    (
      eventType: SyncContextValue['emitGlobalEvent'] extends (
        a: infer T,
        b: any,
      ) => void
        ? T
        : never,
      payload: any,
    ) => {
      try {
        widgetSyncService.emit({
          type: eventType,
          payload,
          timestamp: Date.now(),
          source: 'SyncProvider',
          priority: 'normal',
        });

        if (debugMode) {
          logger.info('[SyncProvider] Emitted global event', {
            eventType,
            payload,
          });
        }
      } catch (error) {
        if (onGlobalError) {
          onGlobalError(
            error instanceof Error
              ? error
              : new Error('Failed to emit global event'),
          );
        }
        logger.error('[SyncProvider] Failed to emit global event:', error);
      }
    },
    [debugMode, onGlobalError],
  );

  // Global monitoring
  useEffect(() => {
    if (!enableGlobalMonitoring) return;

    const monitorPerformance = () => {
      try {
        const metrics = widgetSyncService.getPerformanceMetrics();

        // Only update state if metrics have actually changed (excluding lastUpdateTime)
        setPerformanceMetrics((prevMetrics) => {
          // Compare metrics excluding lastUpdateTime to prevent constant updates
          const { lastUpdateTime: prevTime, ...prevWithoutTime } = prevMetrics;
          const { lastUpdateTime: currentTime, ...currentWithoutTime } =
            metrics;

          if (
            JSON.stringify(prevWithoutTime) !==
            JSON.stringify(currentWithoutTime)
          ) {
            return metrics;
          }
          return prevMetrics;
        });

        // Check for performance warnings
        if (onPerformanceWarning) {
          if (metrics.averageLatency > 5.0) {
            onPerformanceWarning('latency', metrics.averageLatency);
          }

          if (metrics.droppedEvents > 10) {
            onPerformanceWarning('droppedEvents', metrics.droppedEvents);
          }

          // Check for memory leaks (too many events without cleanup)
          if (metrics.totalEvents > 10000 && metrics.totalEvents % 1000 === 0) {
            onPerformanceWarning('highEventCount', metrics.totalEvents);
          }
        }

        // Update connection status with longer timeout and more stable logic
        const timeSinceLastUpdate = Date.now() - metrics.lastUpdateTime;
        const CONNECTION_TIMEOUT = 30000; // 30 seconds instead of 5 seconds
        const shouldBeConnected = timeSinceLastUpdate <= CONNECTION_TIMEOUT;

        setIsConnected((prevConnected) => {
          // Only update if there's a significant change to avoid constant flipping
          if (prevConnected !== shouldBeConnected) {
            if (debugMode) {
              logger.info(
                `[SyncProvider] Connection status changing from ${prevConnected} to ${shouldBeConnected} (${timeSinceLastUpdate}ms since last update)`,
              );
            }
            return shouldBeConnected;
          }
          return prevConnected;
        });
      } catch (error) {
        setIsConnected(false);
        if (debugMode) {
          logger.error('[SyncProvider] Performance monitoring error:', error);
        }
      }
    };

    // Use the monitoring interval as specified (removed 15s minimum for better real-time performance)
    const actualInterval = monitoringInterval;
    const interval = setInterval(monitorPerformance, actualInterval);

    if (debugMode) {
      logger.info(
        `[SyncProvider] Starting performance monitoring with ${actualInterval}ms interval`,
      );
    }

    return () => {
      clearInterval(interval);
      if (debugMode) {
        logger.info('[SyncProvider] Stopped performance monitoring');
      }
    };
  }, [
    enableGlobalMonitoring,
    monitoringInterval,
    onPerformanceWarning,
    debugMode,
  ]);

  // Listen for sync state changes
  useEffect(() => {
    const handleSyncEvent = (event?: any) => {
      // CRITICAL FIX: Filter out events that shouldn't trigger state updates
      const skipEvents = [
        'CUSTOM_BASSLINE',
        'WIDGET_HEARTBEAT',
        'PERFORMANCE_UPDATE',
        'AUDIO_SOURCE_REGISTERED',
        'AUDIO_SOURCE_UNREGISTERED',
        'POSITION',
        'HEARTBEAT', // Skip uppercase heartbeat from TransportSyncManager (1s interval)
        'heartbeat', // Also skip lowercase variant
        'TIMELINE_UPDATE',
        'MUSICAL_TIME_UPDATE',
        'SEEK',
        'MUTE_CHANGE',
        'SOLO_CHANGE',
        'TIME_SIGNATURE_CHANGE',
        'WIDGET_RECONNECT',
        'SYNC_RESTART',
        'PERFORMANCE_TEST',
        'track-regions-updated', // CRITICAL FIX: Skip track regions updates
      ];

      // Log the event for debugging
      if (event && event.type) {
        if (debugMode || event.type !== 'POSITION') {
          // Always log non-POSITION events unless in debug mode
          logger.info(
            `🔍 [SyncProvider subscribeToAll] Received event: ${event.type}`,
            {
              type: event.type,
              timestamp: Date.now(),
              shouldSkip: skipEvents.includes(event.type),
            },
          );
        }

        if (skipEvents.includes(event.type)) {
          return; // Skip processing this event
        }
      }

      try {
        // Log what event is causing us to get new state
        if (!skipEvents.includes(event?.type || '')) {
          logger.info(
            `🔄 [SyncProvider] Getting new sync state due to event: ${event?.type}`,
            {
              timestamp: new Date().toISOString(),
              eventPayload: event?.payload,
            },
          );
        }

        const newState = widgetSyncService.getSyncState();
        setSyncState(newState);
        setIsConnected(true); // Mark as connected when we receive events
      } catch (error) {
        setIsConnected(false);
        if (debugMode) {
          logger.error('[SyncProvider] Sync event handling error:', error);
        }
      }
    };

    // Subscribe to all events to track state changes
    widgetSyncService.subscribeToAll(handleSyncEvent);

    // Initial sync
    refreshState();

    if (debugMode) {
      logger.info('[SyncProvider] Initialized and subscribed to sync events');
    }

    return () => {
      widgetSyncService.unsubscribe('*', handleSyncEvent);
      if (debugMode) {
        logger.info('[SyncProvider] Unsubscribed from sync events');
      }
    };
  }, [debugMode, refreshState]);

  // CRITICAL FIX: Create stable performance metrics that don't change on every update
  const stablePerformanceMetrics = useMemo(() => {
    // Only include metrics that actually matter for UI, exclude lastUpdateTime
    return {
      totalEvents: performanceMetrics.totalEvents,
      throttledEvents: performanceMetrics.throttledEvents,
      batchedEvents: performanceMetrics.batchedEvents,
      averageLatency: performanceMetrics.averageLatency,
      maxLatency: performanceMetrics.maxLatency,
      eventQueue: performanceMetrics.eventQueue,
      droppedEvents: performanceMetrics.droppedEvents,
      subscriberCount: performanceMetrics.subscriberCount,
      // CRITICAL: Don't include lastUpdateTime - it changes constantly
      lastUpdateTime: 0, // Set to 0 to prevent re-renders
    };
  }, [
    performanceMetrics.totalEvents,
    performanceMetrics.throttledEvents,
    performanceMetrics.batchedEvents,
    performanceMetrics.averageLatency,
    performanceMetrics.maxLatency,
    performanceMetrics.eventQueue,
    performanceMetrics.droppedEvents,
    performanceMetrics.subscriberCount,
    // Don't include lastUpdateTime in dependencies
  ]);

  // Track what's changing to cause context recreations
  const prevDepsRef = useRef<any>({});

  // Stable context value with better memoization
  const contextValue: SyncContextValue = useMemo(() => {
    // Track dependency changes
    const depChanges: string[] = [];
    if (prevDepsRef.current.syncState !== syncState) {
      depChanges.push('syncState');
      // Log what's changing in syncState
      if (syncProviderRenderCount % 10 === 0) {
        logger.info(`🔍 [SyncProvider] syncState reference changed:`, {
          renderCount: syncProviderRenderCount,
          timestamp: new Date().toISOString(),
          syncStateObject: syncState,
          prevSyncStateObject: prevDepsRef.current.syncState,
          sameReference: prevDepsRef.current.syncState === syncState,
        });
      }
    }
    if (
      prevDepsRef.current.stablePerformanceMetrics !== stablePerformanceMetrics
    )
      depChanges.push('stablePerformanceMetrics');
    if (prevDepsRef.current.isConnected !== isConnected)
      depChanges.push('isConnected');
    if (prevDepsRef.current.lastUpdateTime !== lastUpdateTime)
      depChanges.push('lastUpdateTime');
    if (prevDepsRef.current.refreshState !== refreshState)
      depChanges.push('refreshState');
    if (prevDepsRef.current.resetMetrics !== resetMetrics)
      depChanges.push('resetMetrics');
    if (prevDepsRef.current.emitGlobalEvent !== emitGlobalEvent)
      depChanges.push('emitGlobalEvent');

    prevDepsRef.current = {
      syncState,
      stablePerformanceMetrics,
      isConnected,
      lastUpdateTime,
      refreshState,
      resetMetrics,
      emitGlobalEvent,
    };

    // Only log context recreation in debug mode and when actually changing
    if (syncProviderRenderCount % 10 === 0 && depChanges.length > 0) {
      logger.info(
        `🔄 SyncProvider CONTEXT VALUE RECREATED #${syncProviderRenderCount}:`,
        {
          depChanges,
          isConnected,
          lastUpdateTime: performanceMetrics.lastUpdateTime,
          syncStateKeys: Object.keys(syncState),
          timestamp: new Date().toISOString(),
        },
      );
    }

    return {
      syncState,
      performanceMetrics: stablePerformanceMetrics, // Use stable metrics
      isConnected,
      lastUpdateTime, // Use the derived lastUpdateTime (line 114)
      refreshState,
      resetMetrics,
      emitGlobalEvent,
    };
  }, [
    syncState,
    stablePerformanceMetrics, // Use stable metrics in dependencies
    isConnected,
    lastUpdateTime, // Add back as dependency since it's derived from performanceMetrics
    refreshState,
    resetMetrics,
    emitGlobalEvent,
    // Remove debugMode from dependencies as it shouldn't trigger context recreation
  ]);

  // Debug info setup (client-side only)
  useEffect(() => {
    if (debugMode && typeof window !== 'undefined') {
      // Add debug info to global window for debugging
      window.__syncProviderDebug = {
        widgetSyncService,
        getState: () => syncState,
      };

      // Make widgetSyncService available globally for debugging
      window.widgetSyncService = widgetSyncService;
    }
  }, [debugMode, syncState, performanceMetrics, isConnected, lastUpdateTime]);

  return (
    <SyncContext.Provider value={contextValue}>{children}</SyncContext.Provider>
  );
};

// ============================================================================
// CONTEXT HOOK
// ============================================================================

// Track useSyncContext calls
let useSyncContextCallCount = 0;

export const useSyncContext = (): SyncContextValue => {
  useSyncContextCallCount++;
  const context = useContext(SyncContext);

  if (!context) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }

  // Only log every 10th call to reduce noise
  if (useSyncContextCallCount % 10 === 0) {
    logger.info(`🔄 useSyncContext call #${useSyncContextCallCount}:`, {
      exerciseId: context.syncState?.exercise?.selectedExercise?.id,
      isPlaying: context.syncState?.playback?.isPlaying,
      tempo: context.syncState?.playback?.tempo,
      isConnected: context.isConnected,
      contextObjectIdentity: context,
    });
  }

  return context;
};

// ============================================================================
// HIGHER ORDER COMPONENT
// ============================================================================

export interface WithSyncProps {
  sync: SyncContextValue;
}

export function withSync<P extends object>(
  WrappedComponent: React.ComponentType<P & WithSyncProps>,
): React.FC<Omit<P, keyof WithSyncProps>> {
  return function WithSyncComponent(props) {
    const sync = useSyncContext();

    return <WrappedComponent {...(props as P)} sync={sync} />;
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to get specific parts of sync state
 */
export const useSyncState = <T,>(selector: (state: SyncState) => T): T => {
  const { syncState } = useSyncContext();
  return selector(syncState);
};

/**
 * Hook to get performance metrics
 */
export const useSyncMetrics = () => {
  const { performanceMetrics } = useSyncContext();
  return performanceMetrics;
};

/**
 * Hook to get connection status
 */
export const useSyncConnection = () => {
  const { isConnected, lastUpdateTime } = useSyncContext();
  return { isConnected, lastUpdateTime };
};

/**
 * Hook to emit global sync events
 */
export const useSyncEmitter = () => {
  const { emitGlobalEvent } = useSyncContext();
  return emitGlobalEvent;
};

// ============================================================================
// DEBUG COMPONENT
// ============================================================================

export const SyncDebugPanel: React.FC<{ show?: boolean }> = ({
  show = false,
}) => {
  const sync = useSyncContext();

  if (!show) return null;

  return (
    <div
      className="sync-debug-panel"
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '10px',
        fontSize: '12px',
        zIndex: 9999,
        maxWidth: '300px',
        borderRadius: '4px',
      }}
    >
      <h4>Sync Debug Panel</h4>
      <div>Connected: {sync.isConnected ? '✅' : '❌'}</div>
      <div>Playing: {sync.syncState.playback.isPlaying ? '▶️' : '⏸️'}</div>
      <div>Tempo: {sync.syncState.playback.tempo} BPM</div>
      <div>Time: {sync.syncState.playback.currentTime.toFixed(2)}s</div>
      <div>Events: {sync.performanceMetrics.totalEvents}</div>
      <div>Latency: {sync.performanceMetrics.averageLatency.toFixed(2)}ms</div>
      <div>Dropped: {sync.performanceMetrics.droppedEvents}</div>
      <button
        onClick={sync.resetMetrics}
        style={{ marginTop: '5px', fontSize: '10px' }}
      >
        Reset Metrics
      </button>
    </div>
  );
};
