/**
 * useTrackCompatibility Hook
 *
 * Provides backward compatibility for existing widget hooks to work
 * with the track-based system. Maintains existing hook interfaces
 * while internally using track architecture.
 *
 * Part of Story 3.21 Task 4 - Backward Compatibility Layer
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WidgetTrackAdapter } from '../services/adapters/WidgetTrackAdapter.js';
import { serviceRegistry } from '../services/core/ServiceRegistry.js';
import { EventBus } from '../services/core/EventBus.js';
import type { Track } from '../types/track.js';
import type { Pattern, PatternEvent } from '../types/pattern.js';
import type { WidgetSyncEvent } from '@/shared/types/widget-sync.types';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('useTrackCompatibility');

// Singleton adapter instance
let widgetTrackAdapter: WidgetTrackAdapter | null = null;

const getAdapter = (): WidgetTrackAdapter => {
  if (!widgetTrackAdapter) {
    widgetTrackAdapter = new WidgetTrackAdapter();
  }
  return widgetTrackAdapter;
};

/**
 * Hook options compatible with existing widget system
 */
export interface UseTrackCompatibilityOptions {
  widgetId: string;
  widgetType: string;
  pattern?: Pattern;
  enabled?: boolean;
  priority?: number;
  onPatternTrigger?: (event: PatternEvent, time: number) => void;
  onStateChange?: (state: any) => void;
  debugMode?: boolean;
}

/**
 * Return type maintaining widget compatibility
 */
export interface TrackCompatibilityState {
  // Widget compatibility
  isRegistered: boolean;
  isEnabled: boolean;

  // Track information
  trackId: string | null;
  track: Track | null;

  // Pattern management
  updatePattern: (pattern: Pattern) => void;
  setEnabled: (enabled: boolean) => void;

  // Migration support
  migrateToTrack: () => Promise<Track | null>;

  // Performance metrics
  metrics: {
    eventCount: number;
    lastEventTime: number;
  };
}

/**
 * Hook for backward compatibility with widget system
 */
export function useTrackCompatibility(
  options: UseTrackCompatibilityOptions,
): TrackCompatibilityState {
  const {
    widgetId,
    widgetType,
    pattern: initialPattern,
    enabled: initialEnabled = true,
    priority = 50,
    onPatternTrigger,
    onStateChange,
    debugMode = false,
  } = options;

  // State
  const [isRegistered, setIsRegistered] = useState(false);
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [metrics, setMetrics] = useState({
    eventCount: 0,
    lastEventTime: 0,
  });

  // Refs
  const adapterRef = useRef<WidgetTrackAdapter>();
  const eventBusRef = useRef<EventBus>();
  const patternRef = useRef<Pattern | undefined>(initialPattern);
  const cleanupRef = useRef<(() => void)[]>([]);

  // Debug logging
  const debug = useCallback(
    (message: string, data?: any) => {
      if (debugMode) {
        logger.info(`🎵 useTrackCompatibility[${widgetId}]: ${message}`, data);
      }
    },
    [widgetId, debugMode],
  );

  /**
   * Initialize adapter and services
   */
  useEffect(() => {
    adapterRef.current = getAdapter();

    try {
      eventBusRef.current = serviceRegistry.get<EventBus>('eventBus');
    } catch (e) {
      logger.warn('EventBus not found in ServiceRegistry');
    }

    debug('Initialized');
  }, [debug]);

  /**
   * Register widget with track system
   */
  useEffect(() => {
    if (!adapterRef.current || !widgetId || !widgetType) return;

    debug('Registering widget', { widgetType, pattern: patternRef.current });

    // Register widget
    const newTrackId = adapterRef.current.registerWidget(
      widgetId,
      widgetType,
      patternRef.current || { type: widgetType as any, events: [] },
      { priority, enabled: isEnabled },
    );

    setTrackId(newTrackId);
    setIsRegistered(true);

    // Get track reference
    const trackInstance = adapterRef.current.getTrackForWidget(widgetId);
    if (trackInstance) {
      setTrack(trackInstance);
    }

    // Cleanup on unmount
    return () => {
      debug('Unregistering widget');
      adapterRef.current?.unregisterWidget(widgetId);
      setIsRegistered(false);
      setTrackId(null);
      setTrack(null);
    };
  }, [widgetId, widgetType, priority, debug]);

  /**
   * Subscribe to pattern trigger events
   */
  useEffect(() => {
    if (!eventBusRef.current || !onPatternTrigger) return;

    const handleTrigger = (data: any) => {
      if (data.widgetId === widgetId) {
        onPatternTrigger(data.event, data.time);

        // Update metrics
        setMetrics((prev) => ({
          eventCount: prev.eventCount + 1,
          lastEventTime: data.time,
        }));
      }
    };

    const unsubscribe = eventBusRef.current.on(
      'widget:triggerEvent',
      handleTrigger,
    );
    cleanupRef.current.push(unsubscribe);

    return () => {
      const index = cleanupRef.current.indexOf(unsubscribe);
      if (index >= 0) {
        cleanupRef.current.splice(index, 1);
        unsubscribe();
      }
    };
  }, [widgetId, onPatternTrigger]);

  /**
   * Subscribe to state changes
   */
  useEffect(() => {
    if (!eventBusRef.current || !onStateChange) return;

    const handleStateChange = (data: any) => {
      if (data.widgetId === widgetId || data.trackId === trackId) {
        onStateChange(data);
      }
    };

    const unsubscribe = eventBusRef.current.on(
      'widget:stateUpdated',
      handleStateChange,
    );
    cleanupRef.current.push(unsubscribe);

    return () => {
      const index = cleanupRef.current.indexOf(unsubscribe);
      if (index >= 0) {
        cleanupRef.current.splice(index, 1);
        unsubscribe();
      }
    };
  }, [widgetId, trackId, onStateChange]);

  /**
   * Update pattern
   */
  const updatePattern = useCallback(
    (newPattern: Pattern) => {
      if (!adapterRef.current || !isRegistered) return;

      debug('Updating pattern', newPattern);

      patternRef.current = newPattern;
      adapterRef.current.updateWidgetPattern(widgetId, newPattern);
    },
    [widgetId, isRegistered, debug],
  );

  /**
   * Set enabled state
   */
  const setEnabledCallback = useCallback(
    (enabled: boolean) => {
      if (!adapterRef.current || !isRegistered) return;

      debug('Setting enabled', enabled);

      setIsEnabled(enabled);
      adapterRef.current.setWidgetEnabled(widgetId, enabled);
    },
    [widgetId, isRegistered, debug],
  );

  /**
   * Migrate widget to full track mode
   */
  const migrateToTrack = useCallback(async (): Promise<Track | null> => {
    if (!adapterRef.current || !isRegistered) return null;

    try {
      debug('Migrating to track mode');

      const migratedTrack =
        await adapterRef.current.migrateWidgetToTrack(widgetId);
      setTrack(migratedTrack);

      debug('Migration complete', { trackId: migratedTrack.id });

      return migratedTrack;
    } catch (error) {
      logger.error('Failed to migrate widget to track:', error);
      return null;
    }
  }, [widgetId, isRegistered, debug]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Run all cleanup functions
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];
    };
  }, []);

  return {
    // Widget compatibility
    isRegistered,
    isEnabled,

    // Track information
    trackId,
    track,

    // Pattern management
    updatePattern,
    setEnabled: setEnabledCallback,

    // Migration support
    migrateToTrack,

    // Performance metrics
    metrics,
  };
}

/**
 * Props interface for components wrapped with track compatibility
 */
export interface WithTrackCompatibilityProps {
  trackCompatibility: TrackCompatibilityState;
}

/**
 * Higher-order component for widget compatibility
 */
export function withTrackCompatibility<P extends object>(
  Component: React.ComponentType<P & WithTrackCompatibilityProps>,
  widgetType: string,
): React.ComponentType<P & { widgetId: string }> {
  return function WrappedComponent(props: P & { widgetId: string }) {
    const compatibility = useTrackCompatibility({
      widgetId: props.widgetId,
      widgetType,
    });

    return React.createElement(Component, {
      ...props,
      trackCompatibility: compatibility,
    } as P & WithTrackCompatibilityProps);
  };
}
