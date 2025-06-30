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
} from 'react';
import { widgetSyncService } from '../../services/WidgetSyncService.js';
import type {
  SyncState,
  SyncPerformanceMetrics,
} from '../../services/WidgetSyncService.js';

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

export const SyncProvider: React.FC<SyncProviderProps> = ({
  children,
  enableGlobalMonitoring = true,
  monitoringInterval = 1000,
  onGlobalError,
  onPerformanceWarning,
  debugMode = false,
}) => {
  // State management
  const [syncState, setSyncState] = useState<SyncState>(() =>
    widgetSyncService.getSyncState(),
  );

  const [performanceMetrics, setPerformanceMetrics] =
    useState<SyncPerformanceMetrics>(() =>
      widgetSyncService.getPerformanceMetrics(),
    );

  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Actions
  const refreshState = () => {
    try {
      const currentState = widgetSyncService.getSyncState();
      const currentMetrics = widgetSyncService.getPerformanceMetrics();

      setSyncState(currentState);
      setPerformanceMetrics(currentMetrics);
      setLastUpdateTime(Date.now());
      setIsConnected(true);

      if (debugMode) {
        console.log('[SyncProvider] State refreshed', {
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
      console.error('[SyncProvider] Failed to refresh state:', error);
    }
  };

  const resetMetrics = () => {
    try {
      widgetSyncService.resetMetrics();
      setPerformanceMetrics(widgetSyncService.getPerformanceMetrics());

      if (debugMode) {
        console.log('[SyncProvider] Metrics reset');
      }
    } catch (error) {
      if (onGlobalError) {
        onGlobalError(
          error instanceof Error ? error : new Error('Failed to reset metrics'),
        );
      }
      console.error('[SyncProvider] Failed to reset metrics:', error);
    }
  };

  const emitGlobalEvent = (
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
        console.log('[SyncProvider] Emitted global event', {
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
      console.error('[SyncProvider] Failed to emit global event:', error);
    }
  };

  // Global monitoring
  useEffect(() => {
    if (!enableGlobalMonitoring) return;

    const monitorPerformance = () => {
      try {
        const metrics = widgetSyncService.getPerformanceMetrics();
        setPerformanceMetrics(metrics);

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

        // Update connection status
        const timeSinceLastUpdate = Date.now() - metrics.lastUpdateTime;
        if (timeSinceLastUpdate > 5000) {
          setIsConnected(false);
        } else {
          setIsConnected(true);
        }
      } catch (error) {
        setIsConnected(false);
        if (debugMode) {
          console.error('[SyncProvider] Performance monitoring error:', error);
        }
      }
    };

    const interval = setInterval(monitorPerformance, monitoringInterval);
    return () => clearInterval(interval);
  }, [
    enableGlobalMonitoring,
    monitoringInterval,
    onPerformanceWarning,
    debugMode,
  ]);

  // Listen for sync state changes
  useEffect(() => {
    const handleSyncEvent = () => {
      try {
        const newState = widgetSyncService.getSyncState();
        setSyncState(newState);
        setLastUpdateTime(Date.now());
        setIsConnected(true);
      } catch (error) {
        setIsConnected(false);
        if (debugMode) {
          console.error('[SyncProvider] Sync event handling error:', error);
        }
      }
    };

    // Subscribe to all events to track state changes
    widgetSyncService.subscribeToAll(handleSyncEvent);

    // Initial sync
    refreshState();

    if (debugMode) {
      console.log('[SyncProvider] Initialized and subscribed to sync events');
    }

    return () => {
      widgetSyncService.unsubscribe('*', handleSyncEvent);
      if (debugMode) {
        console.log('[SyncProvider] Unsubscribed from sync events');
      }
    };
  }, [debugMode]);

  // Context value
  const contextValue: SyncContextValue = {
    syncState,
    performanceMetrics,
    isConnected,
    lastUpdateTime,
    refreshState,
    resetMetrics,
    emitGlobalEvent,
  };

  if (debugMode) {
    // Add debug info to global window for debugging
    (window as any).__syncProviderDebug = {
      syncState,
      performanceMetrics,
      isConnected,
      contextValue,
    };
  }

  return (
    <SyncContext.Provider value={contextValue}>{children}</SyncContext.Provider>
  );
};

// ============================================================================
// CONTEXT HOOK
// ============================================================================

export const useSyncContext = (): SyncContextValue => {
  const context = useContext(SyncContext);

  if (!context) {
    throw new Error('useSyncContext must be used within a SyncProvider');
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
