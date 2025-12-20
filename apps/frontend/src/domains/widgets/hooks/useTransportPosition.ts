import { useEffect, useRef, useState } from 'react';
import type { EventBus } from '@/domains/playback/services/core/EventBus';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';

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
 *
 * Automatically retries connection when CoreServices becomes available.
 */
export function useTransportPosition({
  onPositionUpdate,
  enabled = true,
}: UseTransportPositionOptions) {
  const callbackRef = useRef(onPositionUpdate);
  const [retryCount, setRetryCount] = useState(0);

  // Update callback ref to avoid stale closures
  useEffect(() => {
    callbackRef.current = onPositionUpdate;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Get EventBus directly from CoreServices via WindowRegistry
    const coreServices = WindowRegistry.getCoreServices();

    if (!coreServices || typeof coreServices.getEventBus !== 'function') {
      // CoreServices not ready yet - set up listener for when they become available
      const handleServicesReady = () => {
        console.log('[useTransportPosition] Services ready event received, retrying...');
        setRetryCount((c) => c + 1);
      };

      // Listen for various service ready events
      window.addEventListener('audioServicesReady', handleServicesReady);
      window.addEventListener('coreServicesReady', handleServicesReady);

      // Also set up a polling retry (in case events are missed)
      const retryTimer = setTimeout(() => {
        const services = WindowRegistry.getCoreServices();
        if (services && typeof services.getEventBus === 'function') {
          console.log('[useTransportPosition] Services found on retry, connecting...');
          setRetryCount((c) => c + 1);
        }
      }, 500);

      return () => {
        window.removeEventListener('audioServicesReady', handleServicesReady);
        window.removeEventListener('coreServicesReady', handleServicesReady);
        clearTimeout(retryTimer);
      };
    }

    const eventBus = coreServices.getEventBus() as EventBus;
    if (!eventBus) {
      return;
    }

    console.log('[useTransportPosition] Connected to EventBus, subscribing to position updates');

    // Subscribe directly to transport position updates
    const handlePositionUpdate = (data: any) => {
      // The event data might be wrapped in a 'position' property
      const positionData = data?.position || data;

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

    return () => {
      unsubscribe();
    };
  }, [enabled, retryCount]);
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
 *
 * @param position - TransportPosition with 1-based display beats (from getDisplayPosition())
 * @returns Zero-based beat index for grid highlighting (0-7 for 8 eighth notes)
 *
 * Display position uses 1-based beats (1,2,3,4) - DAW convention
 * Array indices are 0-based (0,1,2,3) - programming convention
 * We subtract 1 to convert from 1-based to 0-based
 */
export function positionToBeatIndex(position: TransportPosition): number {
  // Convert 1-based display beat to 0-based for array indexing
  const zeroBasedBeats = position.beats - 1;
  return zeroBasedBeats * 2 + Math.floor(position.sixteenths / 2);
}
