import { useEffect, useRef, useCallback } from 'react';
import type { EventBus } from '@/domains/playback/services/core/EventBus';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface TransportPosition {
  bars: number;
  beats: number;
  sixteenths: number;
  ticks: number;
  seconds: number;
}

interface UseTransportPositionOptions {
  onPositionUpdate: (position: TransportPosition) => void;
  enabled?: boolean;
}

/**
 * Direct subscription to EventBus transport position updates for timing-critical audio playback.
 * This bypasses WidgetSyncService for minimal latency.
 */
export function useTransportPosition({
  onPositionUpdate,
  enabled = true,
}: UseTransportPositionOptions) {
  const callbackRef = useRef(onPositionUpdate);

  // Update callback ref to avoid stale closures
  useEffect(() => {
    callbackRef.current = onPositionUpdate;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Removed console.log to prevent performance issues
    // logger.info('[useTransportPosition] Hook enabled, attempting to connect to EventBus...');

    // Get EventBus directly from CoreServices
    const coreServices =
      (window as any).__coreServices || (window as any).__globalCoreServices;
    if (!coreServices || typeof coreServices.getEventBus !== 'function') {
      // Only log warnings once, not on every render
      // logger.warn('useTransportPosition: EventBus not available', {
      //   hasCoreServices: !!coreServices,
      //   hasGetEventBus:
      //     coreServices && typeof coreServices.getEventBus === 'function',
      // });
      return;
    }

    const eventBus = coreServices.getEventBus() as EventBus;
    if (!eventBus) {
      // logger.warn('useTransportPosition: EventBus not initialized');
      return;
    }

    // Removed console.log to prevent performance issues
    // logger.info('[useTransportPosition] Successfully connected to EventBus, subscribing to transport:position-updated');

    // Subscribe directly to transport position updates
    const handlePositionUpdate = (data: any) => {
      // The event data might be wrapped in a 'position' property
      const positionData = data?.position || data;

      // Removed console.log that fires on every position update (50ms) - causes massive performance issues!
      // logger.info('[useTransportPosition] Received position update:', positionData);

      if (
        positionData &&
        typeof positionData === 'object' &&
        'bars' in positionData
      ) {
        callbackRef.current(positionData as TransportPosition);
      }
    };

    // EventBus.on returns an unsubscribe function
    const unsubscribe = eventBus.on(
      'transport:position-updated',
      handlePositionUpdate,
    );

    // Removed console.log to prevent performance issues
    // logger.info('[useTransportPosition] Subscribed to transport:position-updated events');

    return () => {
      // Removed console.log to prevent performance issues
      // logger.info('[useTransportPosition] Unsubscribing from transport:position-updated');
      unsubscribe();
    };
  }, [enabled]);
}

/**
 * Helper to check if we're at a specific beat position
 */
export function isAtBeat(
  position: TransportPosition,
  targetBeat: number,
  targetSixteenth = 0,
): boolean {
  return (
    position.beats === targetBeat && position.sixteenths === targetSixteenth
  );
}

/**
 * Helper to check if we're at the start of a bar
 */
export function isBarStart(position: TransportPosition): boolean {
  return position.beats === 0 && position.sixteenths === 0;
}

/**
 * Helper to convert position to a beat index (0-7 for 8th notes in a bar)
 */
export function positionToBeatIndex(position: TransportPosition): number {
  return position.beats * 2 + Math.floor(position.sixteenths / 2);
}
