/**
 * useTrackTiming Hook
 *
 * React hook for integrating tracks with the multi-track timing
 * synchronization system. Provides sample-accurate scheduling,
 * drift monitoring, and timing isolation management.
 *
 * Part of Story 3.21 Task 5 - Multi-Track Timing Precision
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MultiTrackTimingSynchronizer,
  type TrackTimingState,
  type TrackSyncMetrics,
} from '../services/core/MultiTrackTimingSynchronizer.js';
import {
  TimingIsolationManager,
  type IsolatedTrackInfo,
} from '../services/core/TimingIsolationManager.js';
import { serviceRegistry } from '../services/core/ServiceRegistry.js';
import { EventBus } from '../services/core/EventBus.js';
import type { Track } from '../types/track.js';
import type { MusicalPosition } from '../services/core/UnifiedTransport.js';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export interface UseTrackTimingOptions {
  track: Track;
  priority?: number;
  onIsolated?: (info: IsolatedTrackInfo) => void;
  onRecovered?: (trackId: string) => void;
  debugMode?: boolean;
}

export interface TrackTimingHookState {
  // Timing state
  isActive: boolean;
  drift: number;
  stability: number;
  errorCount: number;

  // Isolation state
  isIsolated: boolean;
  isolationReason?: string;
  canRecover: boolean;

  // Scheduling functions
  scheduleEvent: (
    callback: (time: number) => void,
    position: MusicalPosition,
    options?: { priority?: 'high' | 'normal' | 'low' },
  ) => string;

  cancelEvent: (eventId: string) => void;

  // Management functions
  resetErrors: () => void;
  recoverFromIsolation: () => boolean;

  // Metrics
  metrics?: TrackSyncMetrics;
}

/**
 * Hook for track timing synchronization
 */
export function useTrackTiming(
  options: UseTrackTimingOptions,
): TrackTimingHookState {
  const {
    track,
    priority = 50,
    onIsolated,
    onRecovered,
    debugMode = false,
  } = options;

  // Services
  const synchronizerRef = useRef<MultiTrackTimingSynchronizer>();
  const isolationManagerRef = useRef<TimingIsolationManager>();
  const eventBusRef = useRef<EventBus>();

  // State
  const [timingState, setTimingState] = useState<TrackTimingState | null>(null);
  const [isolationInfo, setIsolationInfo] = useState<IsolatedTrackInfo | null>(
    null,
  );
  const [metrics, setMetrics] = useState<TrackSyncMetrics | undefined>();

  // Scheduled events tracking
  const scheduledEventsRef = useRef<Set<string>>(new Set());

  // Debug logging
  const debug = useCallback(
    (message: string, data?: any) => {
      if (debugMode) {
        logger.info(`🎯 useTrackTiming[${track.id}]: ${message}`, data);
      }
    },
    [track.id, debugMode],
  );

  /**
   * Initialize services
   */
  useEffect(() => {
    synchronizerRef.current = MultiTrackTimingSynchronizer.getInstance();
    isolationManagerRef.current = new TimingIsolationManager();

    try {
      eventBusRef.current = serviceRegistry.get<EventBus>('eventBus');
    } catch (e) {
      logger.warn('EventBus not found in ServiceRegistry');
    }

    debug('Initialized services');
  }, [debug]);

  /**
   * Register track with timing system
   */
  useEffect(() => {
    if (!synchronizerRef.current) return;

    debug('Registering track', { priority });

    // Register track
    synchronizerRef.current.registerTrack(track, priority);

    // Set initial timing state
    const state = synchronizerRef.current.getTrackTimingState(track.id);
    if (state) {
      setTimingState(state);
    }

    // Cleanup on unmount
    return () => {
      debug('Unregistering track');
      synchronizerRef.current?.unregisterTrack(track.id);

      // Cancel any remaining scheduled events
      for (const eventId of scheduledEventsRef.current) {
        synchronizerRef.current?.cancelTrackEvent(eventId);
      }
      scheduledEventsRef.current.clear();
    };
  }, [track, priority, debug]);

  /**
   * Subscribe to timing events
   */
  useEffect(() => {
    if (!eventBusRef.current) return;

    const unsubscribers: (() => void)[] = [];

    // Subscribe to drift violations
    const unsubDrift = eventBusRef.current.on(
      'timing:driftViolation',
      (data: any) => {
        if (data.trackId === track.id) {
          debug('Drift violation', data);
          updateTimingState();
        }
      },
    );
    unsubscribers.push(unsubDrift);

    // Subscribe to sync reports
    const unsubSync = eventBusRef.current.on(
      'timing:syncReport',
      (report: any) => {
        const trackMetric = report.tracks?.find(
          (t: any) => t.trackId === track.id,
        );
        if (trackMetric) {
          setMetrics(trackMetric);
        }
      },
    );
    unsubscribers.push(unsubSync);

    // Subscribe to isolation events
    const unsubIsolated = eventBusRef.current.on(
      'isolation:trackIsolated',
      (info: IsolatedTrackInfo) => {
        if (info.trackId === track.id) {
          debug('Track isolated', info);
          setIsolationInfo(info);
          updateTimingState();
          onIsolated?.(info);
        }
      },
    );
    unsubscribers.push(unsubIsolated);

    // Subscribe to recovery events
    const unsubRecovered = eventBusRef.current.on(
      'isolation:trackRecovered',
      (data: any) => {
        if (data.trackId === track.id) {
          debug('Track recovered', data);
          setIsolationInfo(null);
          updateTimingState();
          onRecovered?.(track.id);
        }
      },
    );
    unsubscribers.push(unsubRecovered);

    // Cleanup
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [track.id, onIsolated, onRecovered, debug]);

  /**
   * Update timing state
   */
  const updateTimingState = useCallback(() => {
    if (!synchronizerRef.current) return;

    const state = synchronizerRef.current.getTrackTimingState(track.id);
    if (state) {
      setTimingState(state);
    }
  }, [track.id]);

  /**
   * Schedule an event
   */
  const scheduleEvent = useCallback(
    (
      callback: (time: number) => void,
      position: MusicalPosition,
      options?: { priority?: 'high' | 'normal' | 'low' },
    ): string => {
      if (!synchronizerRef.current) {
        throw new Error('Timing synchronizer not initialized');
      }

      debug('Scheduling event', { position, priority: options?.priority });

      try {
        const eventId = synchronizerRef.current.scheduleTrackEvent(
          track.id,
          callback,
          position,
          options,
        );

        // Track scheduled event
        scheduledEventsRef.current.add(eventId);

        return eventId;
      } catch (error) {
        logger.error('Failed to schedule event:', error);
        throw error;
      }
    },
    [track.id, debug],
  );

  /**
   * Cancel a scheduled event
   */
  const cancelEvent = useCallback(
    (eventId: string) => {
      if (!synchronizerRef.current) return;

      debug('Canceling event', { eventId });

      synchronizerRef.current.cancelTrackEvent(eventId);
      scheduledEventsRef.current.delete(eventId);
    },
    [debug],
  );

  /**
   * Reset timing errors
   */
  const resetErrors = useCallback(() => {
    if (!synchronizerRef.current) return;

    debug('Resetting errors');

    synchronizerRef.current.resetTrackErrors(track.id);
    updateTimingState();
  }, [track.id, updateTimingState, debug]);

  /**
   * Recover from isolation
   */
  const recoverFromIsolation = useCallback((): boolean => {
    if (!isolationManagerRef.current) return false;

    debug('Attempting recovery from isolation');

    const success = isolationManagerRef.current.recoverTrack(track.id);

    if (success) {
      setIsolationInfo(null);
      updateTimingState();
    }

    return success;
  }, [track.id, updateTimingState, debug]);

  // Compute derived state
  const isActive = timingState?.isActive ?? false;
  const drift = timingState?.driftMeasurement ?? 0;
  const errorCount = timingState?.errorCount ?? 0;
  const isIsolated = isolationInfo !== null;
  const isolationReason = isolationInfo?.reason;
  const canRecover = isolationInfo?.canRecover ?? true;
  const stability = metrics?.stability ?? 100;

  return {
    // Timing state
    isActive,
    drift,
    stability,
    errorCount,

    // Isolation state
    isIsolated,
    isolationReason,
    canRecover,

    // Scheduling functions
    scheduleEvent,
    cancelEvent,

    // Management functions
    resetErrors,
    recoverFromIsolation,

    // Metrics
    metrics,
  };
}

/**
 * Hook for monitoring overall timing health
 */
export function useTimingHealth() {
  const [syncHealth, setSyncHealth] = useState(100);
  const [isolatedTracks, setIsolatedTracks] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    let eventBus: EventBus | undefined;

    try {
      eventBus = serviceRegistry.get<EventBus>('eventBus');
    } catch (e) {
      logger.warn('EventBus not found in ServiceRegistry');
      return;
    }

    const unsubSync = eventBus.on('timing:syncReport', (report: any) => {
      setSyncHealth(report.syncHealth || 100);
      setWarnings(report.warnings || []);
    });

    const unsubIsolation = eventBus.on('isolation:trackIsolated', () => {
      setIsolatedTracks((prev) => prev + 1);
    });

    const unsubRecovery = eventBus.on('isolation:trackRecovered', () => {
      setIsolatedTracks((prev) => Math.max(0, prev - 1));
    });

    return () => {
      unsubSync();
      unsubIsolation();
      unsubRecovery();
    };
  }, []);

  return {
    syncHealth,
    isolatedTracks,
    warnings,
    isHealthy: syncHealth >= 90 && isolatedTracks === 0,
  };
}
