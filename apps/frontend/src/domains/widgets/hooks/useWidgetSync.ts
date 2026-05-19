/**
 * Compatibility shim for useWidgetSync hook
 * This provides backward compatibility while widgets are migrated
 * to the new useTrack system from Story 3.22
 *
 * @deprecated Use useTrack hook instead
 */
import { useState, useCallback, useMemo } from 'react';
import { createStructuredLogger } from '@bassnotion/contracts';
import { useTrackMigration } from '@/domains/playback/hooks/useTrackMigration';

const logger = createStructuredLogger('useWidgetSync');

export interface UseWidgetSyncOptions {
  widgetId: string;
  subscribeTo?: string[];
  throttleUpdates?: boolean;
  throttleMs?: number;
  debugMode?: boolean;
}

export interface WidgetSyncState {
  isConnected: boolean;
  hasError: boolean;
  errorMessage?: string;
  lastUpdate: number;
}

export interface PerformanceMetrics {
  totalEvents: number;
  averageLatency: number;
  droppedUpdates: number;
}

/**
 * @deprecated Legacy widget sync hook
 * Provides basic synchronization for widgets using global playback state
 */
export function useWidgetSync(options: UseWidgetSyncOptions) {
  const { widgetId, debugMode = false } = options;

  // Get global playback state using migration hook
  const playbackState = useTrackMigration({ widgetId, debug: debugMode });

  // Local state
  const [state] = useState<WidgetSyncState>({
    isConnected: true,
    hasError: false,
    lastUpdate: Date.now(),
  });

  const [performanceMetrics] = useState<PerformanceMetrics>({
    totalEvents: 0,
    averageLatency: 0,
    droppedUpdates: 0,
  });

  // Methods that widgets expect
  const emitUpdate = useCallback(
    (eventType: string, data: any) => {
      if (debugMode) {
        logger.info(`[${widgetId}] Emitting ${eventType}:`, data);
      }
      // In the new system, this would update the track/region
      // For now, we just log it
    },
    [widgetId, debugMode],
  );

  const handleCommand = useCallback(
    (command: string, data?: any) => {
      if (debugMode) {
        logger.info(`[${widgetId}] Handling command ${command}:`, data);
      }
      // Commands would be handled by the track system
    },
    [widgetId, debugMode],
  );

  // Create stable actions object using useMemo
  const actions = useMemo(
    () => ({
      emitEvent: emitUpdate,
      reconnect: () => {
        if (debugMode) {
          logger.info(`[${widgetId}] Reconnect requested`);
        }
      },
    }),
    [emitUpdate, widgetId, debugMode],
  );

  // Create stable subscribe/unsubscribe functions
  const subscribe = useCallback((event: string, handler: Function) => {
    // No-op for compatibility
  }, []);

  const unsubscribe = useCallback((event: string, handler: Function) => {
    // No-op for compatibility
  }, []);

  // Deprecation warning commented out to reduce console noise
  // TODO: Migrate components to useTrack hook
  // useEffect(() => {
  //   logger.warn(
  //     `[${widgetId}] Using deprecated useWidgetSync hook. ` +
  //     `Please migrate to useTrack hook for better performance and features.`
  //   );
  // }, [widgetId]);

  // Return API that matches what widgets expect
  // Use useMemo to prevent object recreation on every render
  return useMemo(
    () => ({
      // State
      state,
      performanceMetrics,

      // Playback state (from global store via useTrackMigration)
      isPlaying: playbackState.isPlaying,
      currentTime: playbackState.currentTime || 0,
      tempo: playbackState.tempo,
      masterVolume: playbackState.masterVolume, // Fixed: was using .volume but useTrackMigration returns .masterVolume
      // REMOVED: selectedExercise - should come from parent props

      // Methods
      emitUpdate,
      handleCommand,

      // Actions object (now stable)
      actions,

      // Placeholder methods (now stable)
      subscribe,
      unsubscribe,
    }),
    [
      state,
      performanceMetrics,
      playbackState.isPlaying,
      playbackState.currentTime,
      playbackState.tempo,
      playbackState.masterVolume,
      emitUpdate,
      handleCommand,
      actions,
      subscribe,
      unsubscribe,
    ],
  );
}
