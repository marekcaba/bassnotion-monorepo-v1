import { useEffect, useRef, useCallback } from 'react';
import type { EventBus } from '@/domains/playback/services/core/EventBus';

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
  enabled = true 
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
    
    // Get EventBus directly from CoreServices
    const coreServices = (window as any).__coreServices || (window as any).__globalCoreServices;
    if (!coreServices || typeof coreServices.getEventBus !== 'function') {
      console.warn('useTransportPosition: EventBus not available', { 
        hasCoreServices: !!coreServices,
        hasGetEventBus: coreServices && typeof coreServices.getEventBus === 'function'
      });
      return;
    }
    
    const eventBus = coreServices.getEventBus() as EventBus;
    if (!eventBus) {
      console.warn('useTransportPosition: EventBus not initialized');
      return;
    }
    
    // Subscribe directly to transport position updates
    const handlePositionUpdate = (data: any) => {
      // The event data might be wrapped in a 'position' property
      const positionData = data?.position || data;
      
      if (positionData && typeof positionData === 'object' && 'bars' in positionData) {
        callbackRef.current(positionData as TransportPosition);
      }
    };
    
    // EventBus.on returns an unsubscribe function
    const unsubscribe = eventBus.on('transport:position-updated', handlePositionUpdate);
    
    return () => {
      unsubscribe();
    };
  }, [enabled]);
}

/**
 * Helper to check if we're at a specific beat position
 */
export function isAtBeat(position: TransportPosition, targetBeat: number, targetSixteenth: number = 0): boolean {
  return position.beats === targetBeat && position.sixteenths === targetSixteenth;
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