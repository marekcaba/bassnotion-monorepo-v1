/**
 * useTransportPosition Hook
 *
 * Direct subscription to EventBus transport position updates for timing-critical audio playback.
 * This bypasses WidgetSyncService for minimal latency.
 *
 * FAANG FIX: Uses stable callback pattern via useEventBusSubscription to prevent
 * unnecessary resubscriptions and rerenders.
 *
 * @module widgets/hooks/useTransportPosition
 */

import { useCallback } from 'react';
import { useEventBusSubscription } from '@/domains/playback/hooks/utils/useEventBusSubscription.js';

/**
 * Transport position structure
 */
export interface TransportPosition {
  bars: number;
  beats: number;
  sixteenths: number;
  ticks: number;
  seconds: number;
}

/**
 * Position update event data from EventBus
 */
interface PositionUpdateEvent {
  position?: TransportPosition;
  bars?: number;
  beats?: number;
  sixteenths?: number;
  ticks?: number;
  seconds?: number;
}

/**
 * Options for useTransportPosition hook
 */
export interface UseTransportPositionOptions {
  /** Callback invoked on each position update */
  onPositionUpdate: (position: TransportPosition) => void;
  /** Whether the subscription is active (default: true) */
  enabled?: boolean;
}

/**
 * Direct subscription to EventBus transport position updates for timing-critical audio playback.
 *
 * This hook uses a stable callback pattern to prevent:
 * - Unnecessary resubscriptions when callback changes
 * - Stale closure issues
 * - Memory leaks from leaked subscriptions
 *
 * @example
 * ```tsx
 * const handlePositionUpdate = useCallback((position: TransportPosition) => {
 *   setCurrentPosition(position);
 * }, []);
 *
 * useTransportPosition({
 *   onPositionUpdate: handlePositionUpdate,
 *   enabled: isPlaying,
 * });
 * ```
 */
export function useTransportPosition({
  onPositionUpdate,
  enabled = true,
}: UseTransportPositionOptions): void {
  // Memoize the handler to extract position from event data
  // The useEventBusSubscription hook stores this in a ref, so changes don't cause resubscription
  const handlePositionUpdate = useCallback(
    (data: PositionUpdateEvent) => {
      // The event data might be wrapped in a 'position' property
      const positionData = data?.position || data;

      if (
        positionData &&
        typeof positionData === 'object' &&
        'bars' in positionData
      ) {
        onPositionUpdate(positionData as TransportPosition);
      }
    },
    [onPositionUpdate],
  );

  // Use the stable subscription utility
  // This stores the handler in a ref, preventing resubscription when onPositionUpdate changes
  useEventBusSubscription('transport:position-updated', handlePositionUpdate, enabled);
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
